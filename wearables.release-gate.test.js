"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("PASS  " + name);
  } catch (err) {
    failed += 1;
    console.log("FAIL  " + name);
    console.log("      " + (err && err.stack ? err.stack : err));
  }
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "premium-ui.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const fixtures = fs.readFileSync(path.join(ROOT, "wearables.fixtures.js"), "utf8");

// Bump with each shipped release; the gate asserts the SW cache matches.
const RELEASE_CACHE = "nxtfrm-v108-premium-cache";

test("index does not statically load fixtures on every host", function () {
  assert.ok(!/<script src="wearables\.fixtures\.js"><\/script>/.test(html));
  assert.ok(html.indexOf("loadWearableFixturesDevOnly") !== -1);
  assert.ok(html.indexOf('s.src="wearables.fixtures.js"') !== -1);
});

test("early legacy render() is not invoked before premium-ui", function () {
  assert.ok(html.indexOf("an early render() is the old-version flash") !== -1);
  assert.ok(!/initCloudFromStorage\(\);\s*try\{render\(\)/.test(html));
});

test("the legacy top chrome is gone, not hidden", function () {
  // V107.5: the V-era header was being shipped and then hidden with a
  // display:none hack. The markup itself is removed now, so there is nothing
  // to hide and nothing that can flash.
  assert.strictEqual(/<header[^>]*class="top"/.test(html), false, "legacy header markup still ships");
  assert.strictEqual(html.indexOf('id="headScore"'), -1);
  assert.strictEqual(html.indexOf('class="brand-lockup"'), -1);
  // The writers must tolerate its absence.
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const fn = cut.slice(cut.indexOf("function updateCloudSyncStatus()"));
  const body = fn.slice(0, fn.indexOf("\nfunction ", 1));
  assert.strictEqual(/if\s*\(\s*!el\s*\)\s*return/.test(body), false,
    "a missing status element must not short-circuit the banner update");
  assert.ok(body.indexOf("updateCloudLocalBanner()") !== -1);
});

test("backup copy does not claim a full wearable export", function () {
  assert.ok(ui.indexOf("Export full backup") === -1);
  assert.ok(ui.indexOf("Export app backup") !== -1);
  assert.ok(ui.indexOf("Wearable evidence in the on-device wearable store is not included") !== -1);
  assert.ok(html.indexOf("EXPORT FULL BACKUP") === -1);
  assert.ok(html.indexOf("Export a full backup first") === -1);
  assert.ok(html.indexOf("Wearable evidence on this device is not in that file") !== -1);
  const support = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.ok(support.indexOf("Export your current full backup instead") === -1);
  const start = html.indexOf("function getFullBackup(){");
  const end = html.indexOf("function exportFullBackup()");
  assert.ok(start !== -1 && end > start);
  const backupFn = html.slice(start, end);
  assert.ok(backupFn.indexOf("apm_") !== -1);
  assert.ok(backupFn.indexOf("indexedDB") === -1);
  assert.ok(backupFn.indexOf("nxtfrm_wearables") === -1);
});

test("workout queue empty state is explicit", function () {
  assert.ok(ui.indexOf("No exercises are queued for this session") !== -1);
  assert.ok(ui.indexOf("nxp-queue-empty") !== -1);
});

test("Your Week is visible on Home without a hidden disclosure", function () {
  assert.ok(ui.indexOf('details class="nxp-home-week nxp-disclosure" open') !== -1);
});

test("dayType resolves through one shared resolver everywhere", function () {
  // V107: the four hand-rolled "override || weeklyPlan[dow] || PLAN[dow]" chains
  // were replaced by resolveDayType(), so a plan edit cannot be read one way on
  // Today and another way on Train.
  assert.ok(html.indexOf("function resolveDayType(date)") !== -1);
  assert.ok(html.indexOf("state.dayType=resolveDayType(state.date)") !== -1);
  assert.ok(html.indexOf("state.dayType=resolveDayType(today)") !== -1);
  // Reading the weekly plan for a weekday goes through planTypeForDow; no
  // caller may hand-roll the fallback chain any more.
  assert.ok(html.indexOf("function planTypeForDow(dow)") !== -1);
  const chains = html.match(/settings\.weeklyPlan(\?)?\.?\[[a-z]+\]\s*\|\|\s*PLAN\[[a-z]+\]/g) || [];
  assert.strictEqual(chains.length, 0, "inline plan chains left: " + chains.join(" | "));
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.ok(cut.indexOf("if(typeof resolveDayType===\"function\")return resolveDayType(d);") !== -1);
});

test("the weekly plan editor maps its rows to real day numbers", function () {
  // weeklyPlan is keyed by getDay() (0 = Sunday) but the editor lists Monday
  // first; indexing it by row position edited the wrong day.
  assert.ok(html.indexOf("const WEEK_ROW_DOW=[1,2,3,4,5,6,0];") !== -1);
  assert.ok(html.indexOf("const dow=WEEK_ROW_DOW[i];") !== -1);
  // An edit has to reach the rest of the app, not just repaint the list.
  const cycle = html.slice(html.indexOf("function cycleWeeklyDay(i){"));
  assert.ok(cycle.slice(0, 600).indexOf("state.dayType=resolveDayType(state.date)") !== -1);
});

test("SW cache bumped and remains network-first", function () {
  assert.ok(sw.indexOf(RELEASE_CACHE) !== -1, "sw.js cache name must be " + RELEASE_CACHE);
  assert.ok(sw.indexOf("event.respondWith") !== -1);
  assert.ok(sw.indexOf("fetch(event.request)") !== -1);
  assert.ok(sw.indexOf("caches.match(event.request)") !== -1);
  assert.ok(sw.indexOf("skipWaiting") !== -1);
  assert.ok(sw.indexOf("clients.claim") !== -1);
});

test("Train lays out in document flow, not by coordinate", function () {
  // The Log Set CTA used to be position:fixed at a hard-coded bottom offset and
  // covered the set dots and both inputs on short screens.
  assert.strictEqual(css.indexOf("nxp-log-action"), -1, "floating CTA wrapper must be gone");
  assert.strictEqual(ui.indexOf("nxp-log-action"), -1, "floating CTA wrapper must be gone");
  assert.strictEqual(css.indexOf("--nxt-cta-clearance"), -1, "magic CTA offsets must be gone");
  assert.strictEqual(css.indexOf("--nxt-cta-keyboard"), -1, "magic CTA offsets must be gone");
  // Nothing inside the lifting workspace may be positioned out of flow.
  const block = css.slice(css.indexOf("/* V107 Train lifting workspace."));
  const scoped = block.slice(0, block.indexOf("/* ---- Narrow phones"))
    .replace(/\/\*[\s\S]*?\*\//g, ""); // declarations only, not the prose
  assert.strictEqual(/position:\s*(fixed|absolute)/.test(scoped), false);
  // The CTA is a plain submit button inside the form.
  assert.ok(ui.indexOf('type="submit" class="n99-button nxp-train-cta"') !== -1);
});

test("Train set controls stay reachable by the workout engine", function () {
  // The segmented controls replaced <select>s, so the hidden inputs the engine
  // reads with val() must still exist under the same ids.
  assert.ok(ui.indexOf('type="hidden" id="n99-set-type"') !== -1);
  assert.ok(ui.indexOf('type="hidden" id="n99-rir"') !== -1);
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.ok(cut.indexOf("val('n99-set-type')") !== -1);
  assert.ok(cut.indexOf("val('n99-rir')") !== -1);
});

test("presentation styles are render-blocking in <head>", function () {
  // Loading these at the end of <body> let the legacy in-head CSS paint the old
  // chrome first, which is the stale-UI flash on refresh.
  const split = html.indexOf("</head>");
  const head = html.slice(0, split);
  assert.ok(head.indexOf('href="premium-ui.css') !== -1);
  assert.ok(head.indexOf('href="cut-support.css') !== -1);
  const body = html.slice(split);
  assert.strictEqual(/<link[^>]+premium-ui\.css/.test(body), false);
  assert.strictEqual(/<link[^>]+cut-support\.css/.test(body), false);
});

test("no corrupted CSS declarations ship", function () {
  assert.strictEqual(html.indexOf("legs + corecase"), -1);
});

test("safe-area insets are read in exactly one place", function () {
  // Every consumer reads --nxt-safe-*, so the whole system can be exercised at
  // any inset and no rule hard-codes one device's offset.
  assert.ok(css.indexOf("--nxt-safe-top: env(safe-area-inset-top, 0px)") !== -1);
  assert.ok(css.indexOf("--nxt-safe-bottom: env(safe-area-inset-bottom, 0px)") !== -1);
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.css"), "utf8");
  assert.strictEqual(/env\(safe-area/.test(cut), false, "cut-support.css must use the tokens");
  // premium-ui.css may only name env() in the token definitions themselves.
  const envHits = (css.match(/env\(safe-area-inset-[a-z]+/g) || []);
  assert.strictEqual(envHits.length, 4, "unexpected env() use: " + envHits.join(","));
  // Only one element reserves the top inset at a time.
  assert.ok(css.indexOf('body:has(.cloud-local-banner:not([hidden])) .content') !== -1);
});

test("premium-ui is the last word; no versioned layer can override it", function () {
  // V107.5 retired the V98 stylesheet outright rather than reordering it.
  assert.strictEqual(html.indexOf("nxtfrm-v98-premium"), -1, "the V98 layer still ships");
  // Exactly one inline <style>, and it is parsed before both stylesheets.
  const styleOpens = (html.match(/<style\b/g) || []).length;
  assert.strictEqual(styleOpens, 1, "expected one inline <style>, found " + styleOpens);
  const head = html.slice(0, html.indexOf("</head>"));
  const inline = head.indexOf("<style>");
  const cut = head.indexOf('href="cut-support.css');
  const prem = head.indexOf('href="premium-ui.css');
  assert.ok(inline !== -1 && inline < cut && cut < prem, "order must be inline -> cut-support -> premium");
  // Nothing may define styles after premium-ui.
  const after = html.slice(html.indexOf("</head>"));
  assert.strictEqual(/<style\b/.test(after), false, "a <style> block ships after the premium layer");
  assert.strictEqual(/<link[^>]+rel="stylesheet"/.test(after), false, "a stylesheet ships after the premium layer");
});

test("retired presentation generations are gone", function () {
  // Each of these was a whole superseded UI generation left under the runtime.
  for (const fam of ["v73-", "v75-", "v76-", "v87-", "nxt98"]) {
    assert.strictEqual(html.indexOf(fam), -1, fam + "* presentation still ships");
  }
  // v77/v79/v80 remain only as CSS for the pre-V99 weight chart, which is
  // reachable solely from the legacy renderWeight declaration that cut-support
  // and premium-ui both overwrite. It never executes. Retiring it means
  // removing the dead render* entry points, which is startup-path surgery and
  // is deliberately left for its own change. It must not grow.
  const legacyChartRules = (html.match(/\.v(77|79|80)-[\w-]+/g) || []).length;
  assert.ok(legacyChartRules <= 100, "legacy chart CSS grew to " + legacyChartRules);
  const noCss = html.replace(/<style[\s\S]*?<\/style>/g, "");
  assert.strictEqual(/class="[^"]*\bv(73|75|76|87)-/.test(noCss), false, "retired markup is still emitted");
  // Their render functions must go with them.
  for (const fn of ["apx96TrainHeaderHTML", "apx96FocusHTML", "apx96QueueHTML",
                    "apx96WeekHTML", "nxt98HistoryFeedHTML", "nxt98SetHistoryFilter"]) {
    assert.strictEqual(html.indexOf(fn), -1, fn + " still defined");
  }
  // The live History filters must own their handler.
  assert.ok(ui.indexOf("NXP.setHistoryFilter(") !== -1);
  assert.strictEqual(ui.indexOf("nxt98SetHistoryFilter"), -1);
});

test("the service-worker shell matches what the page requests", function () {
  const RELEASE = /const RELEASE = .(\d+)./.exec(sw)[1];
  const versioned = JSON.parse("[" + /const VERSIONED = \[([\s\S]*?)\];/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*$/, "") + "]");
  const plain = JSON.parse("[" + /const ASSETS = \[([\s\S]*?)\]/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*$/, "") + "]");
  const precached = new Set(plain.concat(versioned.map(f => "./" + f + "?v=" + RELEASE)));
  const requested = [...html.matchAll(/<(?:script|link)[^>]*?(?:src|href)="((?!https?:|\/\/|data:)[^"]+?\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m => "./" + m[1]);
  const missing = [...new Set(requested)].filter(u => !precached.has(u));
  assert.deepStrictEqual(missing, [], "offline shell misses assets the page requests");
  const extra = [...precached].filter(u => /\.(js|css)(\?|$)/.test(u) && !requested.includes(u));
  assert.deepStrictEqual(extra, [], "offline shell caches assets nothing requests");
  // Cache cleanup must only ever touch this app's own shells.
  assert.ok(sw.indexOf("caches.delete(key)") !== -1);
  const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.strictEqual(/localStorage|indexedDB/i.test(swCode), false, "the SW must not touch user data");
});

test("navigation uses one icon family, not glyphs", function () {
  const nav = html.slice(html.indexOf('<nav class="tabs"'), html.indexOf("</nav>"));
  for (const glyph of ["\u2302", "\uff0b", "\u25cc", "\u2261", "\u2022\u2022\u2022"]) {
    assert.strictEqual(nav.indexOf(glyph), -1, "legacy nav glyph still present");
  }
  assert.strictEqual((nav.match(/class="tab-icon"/g) || []).length, 5);
  assert.strictEqual((nav.match(/stroke-width="1\.75"/g) || []).length, 5, "one stroke weight");
  assert.strictEqual((nav.match(/viewBox="0 0 24 24"/g) || []).length, 5, "one icon geometry");
  // The dock must not change size with the selection.
  assert.ok(css.indexOf("--nxt-nav-height:") !== -1);
});

test("semantic tokens exist and resolve", function () {
  const required = [
    "--nxt-background", "--nxt-background-elevated", "--nxt-surface", "--nxt-surface-alt",
    "--nxt-surface-interactive", "--nxt-surface-selected",
    "--nxt-text-primary", "--nxt-text-secondary", "--nxt-text-muted", "--nxt-text-disabled",
    "--nxt-border-subtle", "--nxt-border-strong",
    "--nxt-purple-primary", "--nxt-purple-soft", "--nxt-purple-deep", "--nxt-purple-glow",
    "--nxt-success", "--nxt-warning", "--nxt-danger",
    "--nxt-shadow-low", "--nxt-shadow-medium",
    "--nxt-radius-sm", "--nxt-radius-md", "--nxt-radius-lg", "--nxt-radius-xl",
    "--nxt-space-1", "--nxt-space-8",
    "--nxt-button-height", "--nxt-nav-height", "--nxt-control-height",
    "--nxt-motion-fast", "--nxt-motion-normal"
  ];
  for (const t of required) assert.ok(css.indexOf(t + ":") !== -1, "missing token " + t);
  // Every var() must resolve to something defined.
  const used = new Set((css.match(/var\(--nxt-[a-z0-9-]+/g) || []).map(v => v.slice(4)));
  const defined = new Set((css.match(/--nxt-[a-z0-9-]+(?=\s*:)/g) || []));
  for (const u of used) assert.ok(defined.has(u), "undefined token referenced: " + u);
});

test("charts share one theme instead of literals", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.ok(cut.indexOf("const CHART = {") !== -1);
  assert.strictEqual(cut.indexOf("#b18aff"), -1, "chart purple literal still present");
  assert.ok(css.indexOf("--nxt-chart-ink:") !== -1);
  assert.ok(css.indexOf("--nxt-chart-grid:") !== -1);
});

test("the local-only banner reads as information, not caution", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.css"), "utf8");
  const block = cut.slice(cut.indexOf(".cloud-local-banner {"), cut.indexOf(".cloud-local-banner-dismiss"));
  assert.strictEqual(/#e8bf7c|232,\s*191,\s*124/.test(block), false, "gold caution styling still present");
  assert.ok(block.indexOf("--nxt-info-tint") !== -1);
  assert.ok(block.indexOf("--nxt-safe-top") !== -1, "banner must clear the top inset");
});

test("motion is short and respects prefers-reduced-motion", function () {
  assert.ok(css.indexOf("@media (prefers-reduced-motion: reduce)") !== -1);
  assert.ok(css.indexOf('[data-nxp-motion="reduced"]') !== -1);
  const fast = css.match(/--nxt-motion-fast:\s*(\d+)ms/);
  assert.ok(fast && Number(fast[1]) <= 150, "gym controls need an immediate response");
});

test("interactive controls have focus, pressed and disabled states", function () {
  assert.ok(css.indexOf(":focus-visible") !== -1);
  assert.ok(css.indexOf(".nxp .n99-button:active") !== -1);
  assert.ok(css.indexOf(".nxp .n99-button:disabled") !== -1);
  assert.ok(css.indexOf(".nxp-seg button:active") !== -1);
  assert.ok(css.indexOf(".nxp-seg button:disabled") !== -1);
  assert.ok(css.indexOf(".tabs .tab:focus-visible") !== -1);
});

test("production fixture runtime does not attach docs", function () {
  const ctx = vm.createContext({
    location: { hostname: "app.nxtfrm.example", protocol: "https:" },
    NXT: { wearables: { useFixtureProvider: function () { ctx.used = true; } } }
  });
  vm.runInContext(fixtures, ctx, { filename: "wearables.fixtures.js" });
  assert.strictEqual(ctx.NXTFRM_G3A_FIXTURE_DOCS, undefined);
  assert.strictEqual(ctx.used, undefined);
});

function loadProdWearables() {
  const ctx = vm.createContext({
    console: console,
    NXT: {},
    location: { hostname: "app.nxtfrm.example", protocol: "https:" },
    process: { env: {} }
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.js"), "utf8"), ctx, { filename: "wearables.js" });
  return ctx;
}

function assertProdGuard(api) {
  const st = api.status();
  assert.strictEqual(st.mode, "production");
  assert.strictEqual(st.ready, false);
  assert.strictEqual(st.fixture_allowed, false);
  assert.strictEqual(st.provider, "none");
  assert.strictEqual(st.production_guard, "fixture_forbidden_in_production");
  assert.strictEqual(api.getDaily("2026-09-14", { userId: "u_syn_a" }), null);
}

test("production host rejects useFixtureProvider({mode:development})", function () {
  const ctx = loadProdWearables();
  const api = ctx.NXT.wearables;
  assert.throws(function () {
    api.useFixtureProvider([], { mode: "development" });
  }, function (err) {
    return err && err.code === "fixture_forbidden_in_production";
  });
  assertProdGuard(api);
});

test("production host rejects create({mode:development})", function () {
  const ctx = loadProdWearables();
  const api = ctx.NXTFRMWearables.create({ mode: "development" });
  assert.throws(function () {
    api.useFixtureProvider([], { mode: "development" });
  }, function (err) {
    return err && err.code === "fixture_forbidden_in_production";
  });
  assertProdGuard(api);
});

test("localhost fixture runtime still attaches docs", function () {
  const ctx = vm.createContext({
    location: { hostname: "127.0.0.1", protocol: "http:" },
    NXT: { wearables: { useFixtureProvider: function (docs) { ctx.used = docs.length; } } }
  });
  vm.runInContext(fixtures, ctx, { filename: "wearables.fixtures.js" });
  assert.ok(Array.isArray(ctx.NXTFRM_G3A_FIXTURE_DOCS));
  assert.ok(ctx.NXTFRM_G3A_FIXTURE_DOCS.length > 0);
  assert.ok(ctx.used > 0);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
