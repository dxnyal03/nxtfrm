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
const RELEASE_CACHE = "nxtfrm-v109-premium-cache";

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

/* ===========================================================================
   V108 Phase 3 — Train premium + interactive refinement.
   These are behavioural and layout contracts, not snapshots of a particular
   look: each one names a way the screen previously failed a lifter, so a later
   restyle is free to change the paint but not to reintroduce the failure.
   =========================================================================== */

test("load and reps are steppers wired to the engine's own inputs", function () {
  // Tapping a value must not require the numeric keyboard: opening it is what
  // used to push the CTA off screen mid-set.
  assert.ok(ui.indexOf('class="nxp-step"') !== -1, "stepper buttons must ship");
  assert.ok(/data-step-target="\$\{id\}"/.test(ui), "a stepper must name the input it drives");
  // The engine reads these two ids with val(); the steppers write through them
  // rather than keeping a parallel value of their own.
  assert.ok(ui.indexOf("stepper('weightInput'") !== -1);
  assert.ok(ui.indexOf("stepper('repsInput'") !== -1);
  assert.ok(/function stepValue\(btn\)[\s\S]{0,700}rememberInput\(input\)/.test(ui),
    "a step must go through rememberInput so the draft survives the next repaint");
  // The weight increment is the exercise's own, not a constant invented here.
  assert.ok(ui.indexOf("trimNum(t.inc||2.5)") !== -1, "weight steps by the exercise increment");
});

test("press-and-hold cannot fire by accident and cannot eat a scroll", function () {
  const hold = ui.slice(ui.indexOf("const HOLD_DELAY"), ui.indexOf("function noteRestTotal"));
  const delay = hold.match(/HOLD_DELAY=(\d+)/);
  assert.ok(delay && Number(delay[1]) >= 350, "a repeat must need a deliberate hold");
  // A drag that starts on a stepper is a scroll, not an input.
  assert.ok(/function holdMove\(event\)[\s\S]{0,400}holdEnd\(\)/.test(hold));
  assert.ok(hold.indexOf("HOLD_SLOP") !== -1);
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) {
    assert.ok(hold.indexOf("'" + name + "'") !== -1, name + " must end a hold");
  });
  // Keyboard activation still steps exactly once (a pointer tap already
  // stepped on pointerdown, so the click handler must skip it).
  assert.ok(hold.indexOf("event.detail!==0") !== -1, "keyboard activation must step once");
  assert.ok(css.indexOf("touch-action: manipulation") !== -1, "steppers must let the page scroll");
});

test("a logged set is confirmed in place, never in a modal", function () {
  assert.ok(ui.indexOf("ui.confirmFrom=before") !== -1, "the confirmation is armed before the engine repaints");
  assert.ok(ui.indexOf("is-just-logged") !== -1);
  assert.ok(ui.indexOf("nxp-cta-check") !== -1);
  // It clears itself without a second repaint: replacing the DOM again would
  // reset scroll position and blur whatever the lifter touched next.
  const reset = ui.slice(ui.indexOf("function scheduleConfirmReset"));
  assert.ok(reset.indexOf("classList.remove('is-just-logged')") !== -1);
  assert.strictEqual(/scheduleConfirmReset[\s\S]{0,400}(render|training)\(\)/.test(reset), false,
    "the confirmation must not trigger another full render");
  // No celebration for an ordinary working set.
  ["confetti", "fireworks", "sparkle"].forEach(function (word) {
    assert.strictEqual(css.toLowerCase().indexOf(word), -1, word + " has no place in a gym");
    assert.strictEqual(ui.toLowerCase().indexOf(word), -1, word + " has no place in a gym");
  });
});

test("the rest timer is a region of the page, not an overlay", function () {
  const block = css.slice(css.indexOf("/* ---- Rest timer ----"), css.indexOf("/* ---- Exercise navigation"));
  const scoped = block.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.strictEqual(/position:\s*(fixed|absolute|sticky)/.test(scoped), false,
    "a floating timer can collide with the controls under it");
  assert.ok(scoped.indexOf("z-index") === -1, "nothing here should need to win a stacking fight");
  // It knows the whole rest, not only what is left, so it can show progress.
  assert.ok(ui.indexOf("function noteRestTotal") !== -1);
  assert.ok(ui.indexOf("apx96StartRestSource") !== -1, "the engine still owns the countdown");
});

test("exercise progress is shown without turning it into tiny targets", function () {
  const rail = ui.slice(ui.indexOf('<div class="nxp-ex-rail">'), ui.indexOf('<section class="nxp-ex-head">'));
  assert.ok(rail.indexOf('<ol aria-hidden="true">') !== -1, "the segments are presentation");
  assert.strictEqual(/<li[^>]*><button/.test(rail), false,
    "a six-segment rail is six targets too small to hit; navigation stays full-size");
  // The full-size controls are still the way to move between exercises.
  assert.ok(ui.indexOf('class="nxp-ex-nav"') !== -1);
  assert.ok(ui.indexOf("NXP.goExercise(-1)") !== -1 && ui.indexOf("NXP.goExercise(1)") !== -1);
  // Nothing requires a swipe.
  assert.strictEqual(/addEventListener\('touchstart'|onswipe|swipeLeft/.test(ui), false,
    "navigation must not depend on a gesture");
});

test("Train controls are at least 44px and keep their states", function () {
  // Measured from the declarations rather than trusted: the pre-V108 header
  // button shipped at 36px.
  const train = css.slice(css.indexOf("/* V107 Train lifting workspace."), css.indexOf("/* ---- Narrow phones"));
  const shortMin = train.match(/min-height:\s*(\d+)px/g) || [];
  shortMin.forEach(function (decl) {
    const px = Number(decl.match(/(\d+)px/)[1]);
    assert.ok(px === 3 || px === 4 || px === 20 || px >= 44,
      "an interactive min-height of " + px + "px is under the touch minimum");
  });
  assert.ok(train.indexOf(".nxp-step:active") !== -1);
  assert.ok(train.indexOf(".nxp-step:disabled") !== -1);
  assert.ok(train.indexOf(".nxp-ex-nav button:disabled") !== -1);
  assert.ok(train.indexOf(".nxp-train-cta:active") !== -1);
  assert.ok(train.indexOf(".nxp-train-cta:disabled") !== -1);
});

test("the comparison line is typography, not three cards", function () {
  const aim = css.slice(css.indexOf("/* ---- Last / Target / Rest ----"), css.indexOf("/* ---- Coach note ----"));
  const cell = aim.slice(aim.indexOf(".nxp-aim-cell {"), aim.indexOf(".nxp-aim-cell + .nxp-aim-cell"));
  assert.ok(cell.indexOf("background: none") !== -1, "a reading is not a card");
  assert.ok(cell.indexOf("border: 0") !== -1);
  // Only the divider between readings carries a line.
  assert.ok(aim.indexOf(".nxp-aim-cell + .nxp-aim-cell") !== -1);
});

test("Train uses the shared surfaces instead of inventing card systems", function () {
  assert.ok(css.indexOf(".nxp-surface {") !== -1 && css.indexOf(".nxp-surface-raised {") !== -1);
  const train = css.slice(css.indexOf("/* V107 Train lifting workspace."), css.indexOf("/* ---- Narrow phones"));
  // Every filled region on Train reads from the token scale, so no rule can
  // drift a private grey or radius into the screen.
  assert.strictEqual(/background:\s*#[0-9a-f]{3,8}/i.test(train.replace(/\/\*[\s\S]*?\*\//g, "")), false,
    "Train must not hard-code a surface colour");
  assert.strictEqual(/border-radius:\s*\d+px/.test(train.replace(/\/\*[\s\S]*?\*\//g, "")), false,
    "Train must not hard-code a radius");
});

test("purple marks the few things it is meant to mark", function () {
  const train = css.slice(css.indexOf("/* V107 Train lifting workspace."), css.indexOf("/* ---- Narrow phones"));
  const decls = train.replace(/\/\*[\s\S]*?\*\//g, "");
  // It is the CTA, the selected option, the current position and the active
  // timer — not a default border or a default text colour.
  assert.strictEqual(/border-color:\s*var\(--nxt-purple-edge\);\s*\n\s*background:\s*var\(--nxt-surface\)/.test(decls), false);
  const purpleBorders = (decls.match(/border(?:-color)?:[^;]*--nxt-purple/g) || []).length;
  assert.ok(purpleBorders <= 6, "purple borders have spread to " + purpleBorders + " rules");
});

test("the workout queue is a sheet over the engine's own plan", function () {
  assert.ok(ui.indexOf("class=\"nxp-queue-sheet\"") !== -1);
  assert.ok(ui.indexOf("nxp-queue-open") !== -1, "Train needs one obvious way into the queue");
  // Selection goes through the engine.
  assert.ok(ui.indexOf("NXP.chooseExercise(") !== -1);
  assert.ok(ui.indexOf("function chooseExercise(i) {closeModal();N.selectExercise(i);}") !== -1);
  // Every sheet gets the grab bar and the safe-area floor from one rule.
  assert.ok(css.indexOf(".n99-modal .sheet::before") !== -1, "sheets need a grab affordance");
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.css"), "utf8");
  assert.ok(/\.n99-modal \.sheet[^}]*max-height:\s*90dvh/.test(cut), "a sheet must stay in the viewport");
  assert.ok(/\.n99-modal \.sheet[^}]*overflow-y:\s*auto/.test(cut), "a sheet scrolls inside itself");
  assert.ok(/\.n99-modal \.sheet[^}]*--nxt-safe-bottom/.test(cut), "a sheet must clear the home indicator");
});

test("Train shows only metadata the engine actually holds", function () {
  const train = ui.slice(ui.indexOf("function training() {"), ui.indexOf("function scheduleConfirmReset"));
  /* This guard originally banned the word "muscle" outright, because at the time
     NXTFRM held no anatomy data and anything on screen would have been invented.
     Researched per-exercise muscle metadata now ships in train-anatomy.js, so the
     ban is obsolete — but its INTENT is not. Restated and tightened: Train may
     display muscles, and may ONLY display ones it looked up. It must never infer
     anatomy from the exercise name, which is the failure mode the original rule
     was really protecting against. */
  ["primary mover", "activation", "EMG", "% of"].forEach(function (word) {
    assert.strictEqual(train.indexOf(word), -1, "Train must not invent " + word);
  });
  const lib = fs.readFileSync(path.join(ROOT, "train-anatomy.js"), "utf8");
  assert.ok(ui.indexOf("NXTLIB.musclesFor(ex)") !== -1,
    "muscle text must come from the stored library lookup");
  // No name-string heuristics anywhere in the muscle path.
  const helpers = ui.slice(ui.indexOf("function muscleLine("), ui.indexOf("function exerciseDetails()"));
  assert.strictEqual(/\.(test|match|includes|indexOf)\(\s*["'\/]/.test(helpers), false,
    "muscles must be looked up, never parsed out of the exercise name");
  // An unknown exercise yields nothing rather than a guess.
  assert.ok(lib.indexOf("{ primary: [], secondary: [] }") !== -1,
    "an exercise the library does not know returns no muscles");
  // The equipment note is shown only when one was saved.
  assert.ok(train.indexOf("${note?' · '+esc(note):''}") !== -1);
  const detail = ui.slice(ui.indexOf("function exerciseDetails()"));
  assert.ok(detail.indexOf("note?`<section") !== -1, "an absent note shows nothing, not a placeholder");
});

test("the session plan is the one source of truth for queue order", function () {
  // Two similarly named functions caused a false report that queue editing was
  // dead. Keep them distinguishable:
  //   template()        -> ensureSessionPlan() -> state.sessionPlans[key]  (live session)
  //   NXT.templateFor() -> cfg().templates / TEMPLATES                     (base programme)
  // Train renders template(), so every queue mutation must write sessionPlans.
  const tpl = html.slice(html.indexOf("function template(){"), html.indexOf("function currentExerciseIndex()"));
  assert.ok(tpl.indexOf("ensureSessionPlan(state.dayType)") !== -1,
    "template() must resolve through the session plan");
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const ensure = cut.slice(cut.indexOf("ensureSessionPlan=function"));
  const body = ensure.slice(0, ensure.indexOf("\n"));
  assert.ok(body.indexOf("state.sessionPlans[key]") !== -1);
  assert.ok(body.indexOf("NXT.templateFor(type)") !== -1, "an absent plan seeds from the base programme");
  // Train reads template(), never templateFor(), so the two cannot drift apart
  // in the one screen that edits the queue.
  const train = ui.slice(ui.indexOf("function training() {"), ui.indexOf("function scheduleConfirmReset"));
  /* Train's queue still comes from template() on a training day. Non-strength
     days have no session plan at all — Rest and Zone 2 seed an empty or
     cardio-only plan — so an optional add-on supplies its own list there. That
     is the ONLY alternative branch permitted; the strength path must still read
     template() and nothing else. */
  assert.ok(train.indexOf("template()") !== -1, "the strength queue still resolves through template()");
  assert.ok(/const list\s*=\s*addOnActive\(\)/.test(train),
    "the only alternative queue source is an explicit add-on list");
  assert.strictEqual(/const list\s*=\s*[^;]*templateFor\(/.test(train), false,
    "Train must not read the base programme for its queue");
  assert.strictEqual(train.indexOf("templateFor()"), -1, "Train must not read the base programme for its queue");
});

test("every queue mutation writes the store Train reads", function () {
  // A mutation that edits some other array is a dead button. Each of these must
  // land in state.sessionPlans under the current session key.
  ["moveSessionExercise", "v88AddExercise", "v88RemoveExercise", "v88ReplaceAt", "resetSessionOrder"].forEach(function (name) {
    const start = html.indexOf("function " + name + "(");
    assert.ok(start !== -1, name + " must exist");
    const body = html.slice(start, html.indexOf("\nfunction ", start + 1));
    assert.ok(/state\.sessionPlans\[[^\]]+\]\s*=|sessionPlansSafe\(\)\[[^\]]+\]\s*=/.test(body),
      name + " must write the session plan");
    assert.ok(body.indexOf("persist()") !== -1, name + " must persist");
    assert.ok(body.indexOf("render()") !== -1, name + " must repaint");
  });
});

test("reorder keeps the current exercise by identity, not by index", function () {
  const move = html.slice(html.indexOf("function moveSessionExercise(index,dir){"));
  const body = move.slice(0, move.indexOf("\nfunction ", 1));
  assert.ok(body.indexOf("const active=state.exercise;") !== -1);
  assert.ok(body.indexOf("state.exercise=active") !== -1,
    "moving an exercise must not switch the lifter to whatever now sits at that index");
  // Logged sets are keyed by exercise and date; reordering must not touch them.
  assert.strictEqual(/state\.logs\s*=/.test(body), false, "reorder must never rewrite history");
});

test("removing the current exercise has a defined fallback", function () {
  const rm = html.slice(html.indexOf("function v88RemoveExercise(index){"));
  const body = rm.slice(0, rm.indexOf("\nfunction ", 1));
  assert.ok(body.indexOf("state.exercise=plan[Math.min(i,plan.length-1)]||\"\"") !== -1,
    "removal must fall back to the nearest remaining exercise, then to none");
  // An empty plan is a state the UI handles, not a crash.
  assert.ok(ui.indexOf("function trainEmpty()") !== -1);
  assert.ok(ui.indexOf("if(!list.length)return trainEmpty();") !== -1);
});

test("reset restores the programme a session is seeded from", function () {
  // Reset read TEMPLATES directly, so a lifter with a saved programme was reset
  // onto the factory default instead of their own.
  const reset = html.slice(html.indexOf("function resetSessionOrder(){"));
  const body = reset.slice(0, reset.indexOf("\nfunction ", 1));
  assert.ok(body.indexOf("NXT.templateFor(state.dayType)") !== -1,
    "reset must use the same base ensureSessionPlan() seeds from");
  // It restores order only; nothing else is cleared.
  ["state.logs", "exerciseNotes", "cfg().templates", "sessionTargets"].forEach(function (store) {
    assert.strictEqual(body.indexOf(store + "="), -1, "reset must not clear " + store);
  });
});

test("queue reordering is offered only through accessible controls", function () {
  assert.ok(ui.indexOf("function queueMove(index,delta)") !== -1);
  assert.ok(ui.indexOf("moveSessionExercise(index,delta)") !== -1, "reorder goes through the engine");
  // Buttons, not a drag target: reachable by keyboard and unable to capture a
  // scroll on a sheet that scrolls.
  assert.ok(/class="nxp-queue-move">[\s\S]{0,400}<button type="button"/.test(ui));
  assert.ok(ui.indexOf('aria-label="Move ${esc(e.name)} up"') !== -1);
  assert.ok(ui.indexOf('aria-label="Move ${esc(e.name)} down"') !== -1);
  assert.strictEqual(/draggable="true"|dragstart/.test(ui), false, "no drag target on a scrolling sheet");
  // The move buttons meet the touch minimum.
  const moveCss = css.slice(css.indexOf(".nxp-queue-move button {"), css.indexOf(".nxp-queue-move button:active"));
  assert.ok(moveCss.indexOf("width: var(--nxt-touch-min)") !== -1);
  assert.ok(moveCss.indexOf("height: var(--nxt-touch-min)") !== -1);
  // The current exercise stays identifiable in both modes.
  assert.ok(css.indexOf(".nxp-queue-row.is-current .nxp-queue-index") !== -1);
});

test("full reset clears the wearable database, not just localStorage", function () {
  // The More > App reset button ships in index.html with a legacy inline handler
  // that only clears localStorage. cut-support.js swaps that exact literal for
  // NXT.resetData(), which also deletes the wearable IndexedDB. The swap is a
  // string replace, so if either side of it drifts the replace silently no-ops
  // and the raw handler ships — localStorage is cleared, the wearable evidence
  // survives, and the UI's "will be cleared by reset" promise quietly breaks.
  // These assertions fail on that drift.
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const LEGACY = "if(confirm('Clear all local NXTFRM data?')){localStorage.clear();location.reload()}";

  // 1. The literal the swap looks for must still exist in the page, exactly once.
  assert.strictEqual(html.split(LEGACY).length - 1, 1,
    "the legacy reset handler literal must appear exactly once in index.html");

  // 2. cut-support must still replace that literal with NXT.resetData().
  const swap = cut.slice(cut.indexOf("apx96MoreSectionHTML(view).replace("));
  const call = swap.slice(0, swap.indexOf("\n"));
  assert.ok(call.indexOf(LEGACY) !== -1, "the replace target no longer matches index.html");
  assert.ok(call.indexOf('"NXT.resetData()"') !== -1, "reset must be routed to NXT.resetData()");

  // 3. resetData must delete the wearable database, not only drop localStorage keys.
  const fn = cut.slice(cut.indexOf("function resetData() {"));
  const body = fn.slice(0, fn.indexOf("\n  }") + 4);
  assert.ok(body.indexOf("store.deleteDatabase") !== -1,
    "reset must delete the wearable database");
  assert.ok(/deleteDatabase\(\)\)\.then\(reload, ?reload\)/.test(body.replace(/\s+/g, " ")) ||
    body.indexOf("Promise.resolve(store.deleteDatabase()).then(reload,reload)") !== -1,
    "reset must reload only after the database delete settles, on success or failure");
  assert.ok(body.indexOf("location.reload()") !== -1, "reset must restart the app");

  // 4. It must clear the app records the UI says it clears.
  ["apm_logs", "apm_bws", "apm_settings", "apm_session_plans", "apm_exercise_notes"].forEach(function (key) {
    assert.ok(body.indexOf("'" + key + "'") !== -1, "reset must clear " + key);
  });

  // 5. The live path must never fall back to a bare localStorage.clear().
  assert.strictEqual(/localStorage\.clear\(\)/.test(body), false,
    "reset must remove named keys, not blanket-clear storage it does not own");

  // 6. The copy promises wearable deletion; the promise and the code move together.
  assert.ok(html.indexOf("will be cleared by reset") !== -1,
    "reset copy must keep telling the user wearable evidence is cleared");

  // 7. The store must actually expose the delete the reset depends on.
  const store = fs.readFileSync(path.join(ROOT, "wearables.store.js"), "utf8");
  assert.ok(store.indexOf("indexedDB.deleteDatabase(DB_NAME)") !== -1,
    "the store must delete the real database");
  assert.ok(/DB_NAME = "nxtfrm_wearables_db"/.test(store));
});

/* ===========================================================================
   V109.1 Progress/Weight hotfix.
   =========================================================================== */

test("weigh-in date and weight cannot collide in the sheet", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.css"), "utf8");
  const grid = cut.slice(cut.indexOf(".n99-form-grid {"), cut.indexOf(".n99 label.n99-check"));
  // `1fr` is minmax(auto,1fr); that auto floor is the child's min-content, and an
  // <input type="date"> reports the dd/mm/yyyy spinner width as its min-content.
  // On a 320px sheet neither track could shrink to fit, so the borders collided.
  assert.ok(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(grid),
    "tracks must be allowed to shrink below min-content");
  assert.strictEqual(/grid-template-columns:\s*1fr 1fr\s*;/.test(grid), false,
    "the auto-floor form of the track list must not come back");
  assert.ok(/\.n99-form-grid > \*\s*\{[^}]*min-width:\s*0/.test(grid),
    "the flex label between grid and input must be allowed to shrink too");
  assert.ok(/gap:\s*0 12px/.test(grid), "the two controls must keep a visible gap");
  // Below 360px there is not room for two date-sized controls at all, so they stack.
  assert.ok(/@media \(max-width:359px\)[\s\S]{0,200}\.n99-form-grid \{ grid-template-columns:1fr/.test(cut),
    "narrow phones must stack rather than squeeze");
  // The inputs themselves were already shrinkable; keep it that way.
  assert.ok(/\.n99 input[^{]*\{[^}]*min-width:0/.test(cut));
  assert.ok(/\.n99 input[^{]*\{[^}]*max-width:100%/.test(cut));
});

test("post-workout weight is charted without touching the canonical row set", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  // cleanRows() feeds every trend, forecast and cut calculation. The new series
  // must not be built by changing it.
  const clean = cut.slice(cut.indexOf("function cleanRows(input,key=\"weight\")"), cut.indexOf("function weights()"));
  assert.strictEqual(clean.indexOf("Post-workout"), -1, "cleanRows must stay timing-agnostic apart from its morning preference");
  assert.ok(clean.indexOf('morning=String(r.timeOfDay||"").toLowerCase()==="morning"') !== -1,
    "the existing morning preference and its legacy fallback must be unchanged");
  // The chart series is a separate read-only aggregation.
  assert.ok(cut.indexOf("function timingRows(timing,input=state.bws)") !== -1);
  const tr = cut.slice(cut.indexOf("function timingRows("), cut.indexOf("function windowStats("));
  assert.strictEqual(/state\.bws\s*=|\.push\(|\.splice\(/.test(tr), false, "timingRows must not mutate stored weigh-ins");
  assert.ok(tr.indexOf("Number(r.ts)>=Number(prior.ts)") !== -1, "latest-per-date must follow the stored ts order contract");
});

test("both weight series share one kg axis", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const model = cut.slice(cut.indexOf("function chartModel("), cut.indexOf("function chartHTML()"));
  // Post-workout values widen the same domain the primary series built...
  assert.ok(model.indexOf("for(const r of postRows)values.push(r.weight);") !== -1,
    "post-workout must be inside the shared y-domain, not clipped out of the plot");
  // ...and are projected through the same x()/y() closures, so a second axis
  // cannot be introduced without deleting this line.
  assert.ok(model.indexOf("const post=postRows.map(r=>({...r,x:x(r.date),y:y(r.weight)}));") !== -1,
    "post-workout must use the primary scales");
  const scaleDefs = (model.match(/const xMs=|,y=v=>top\+/g) || []).length;
  assert.ok(scaleDefs <= 2, "only one x and one y scale may be defined");
  assert.strictEqual(/y2=|yRight|secondAxis|rightAxis/.test(model), false, "no second y-axis");
});

test("post-workout never reaches a progress calculation", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const model = cut.slice(cut.indexOf("function chartModel("), cut.indexOf("function chartHTML()"));
  // Every derived-progress call in the model must read the canonical rows, never
  // the post-workout rows.
  ["N.trend(rows)", "N.trendConfidence(rows)", "N.forecastGoal(rows)", "N.detectPlateau(rows)"].forEach(function (call) {
    assert.ok(model.indexOf(call) !== -1, call + " must still read the canonical rows");
  });
  assert.strictEqual(/N\.(trend|trendConfidence|forecastGoal|detectPlateau|trendStats)\(\s*post/.test(model), false,
    "no progress calculation may be handed the post-workout series");
  // The whole-file check: the canonical helpers default to weights(), which is
  // cleanRows(state.bws) — morning-preferred and unchanged.
  ["function ewmaTrend(rows=weights())", "function trend(rows=weights())", "function trendConfidence(rows=weights())",
   "function forecastGoal(rows=weights())", "function detectPlateau(rows=weights())", "function trendStats(rows=weights())"
  ].forEach(function (sig) {
    assert.ok(cut.indexOf(sig) !== -1, "unchanged signature expected: " + sig);
  });
  assert.strictEqual(/timingRows\([^)]*\)[^;]*(trend|forecast|plateau|tdee|adherence)/i.test(cut), false,
    "timingRows output must not feed coaching maths");
});

test("a missing timing is drawn as absent, never as zero or a copy", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const tr = cut.slice(cut.indexOf("function timingRows("), cut.indexOf("function windowStats("));
  // Only real readings enter the series; there is no fill, default or carry-forward.
  assert.strictEqual(/\|\|\s*0|=\s*0\b|fill\(|interpolat/i.test(tr), false,
    "an absent reading must stay absent");
  assert.ok(tr.indexOf("if(String(r.timeOfDay||'').toLowerCase()!==want)continue;") !== -1,
    "a row of another timing must be skipped, not coerced");
  // The readout hides rather than invents when there is no post-workout row.
  const sel = cut.slice(cut.indexOf("function selectPoint(index)"), cut.indexOf("function scrub(event)"));
  assert.ok(sel.indexOf("postBox.hidden=!postRow") !== -1, "no post-workout reading hides the block");
  assert.ok(sel.indexOf("postRow?postRow.weight.toFixed(1)+' kg':''") !== -1, "never substitute a value");
});

test("the two series are named for the user, not by internal timing keys", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.ok(cut.indexOf('<i class="raw"></i>Morning') !== -1, "primary series is labelled Morning");
  assert.ok(cut.indexOf('<i class="post"></i>Post-workout') !== -1, "secondary series is labelled Post-workout");
  const css = fs.readFileSync(path.join(ROOT, "cut-support.css"), "utf8");
  assert.ok(css.indexOf(".n99-legend i.post") !== -1, "the legend needs a swatch for the second series");
  // The primary row keeps the existing legacy fallback, so the readout names the
  // timing actually recorded instead of claiming every point is a morning one.
  assert.ok(cut.indexOf("function pointTiming(p)") !== -1);
  assert.ok(cut.indexOf("'Timing not recorded'") !== -1, "legacy rows with no timing must say so");
  // Copy matches the new behaviour.
  assert.ok(cut.indexOf("Morning readings drive your progress trend") !== -1);
  assert.ok(cut.indexOf("post-workout readings are shown separately for context") !== -1);
  assert.ok(cut.indexOf("Every original entry stays saved") !== -1);
  assert.strictEqual(cut.indexOf("The chart keeps the latest morning reading for each day"), -1,
    "the superseded copy must be gone");
});

test("the weight hotfix introduces no storage migration", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  // Saving a weigh-in still writes exactly the record it always did.
  assert.ok(cut.indexOf("state.bws.push({id:uid(),date,weight,timeOfDay:val('apx95WeightTime')||'Morning',ts:Date.now()})") !== -1,
    "the stored weigh-in shape must be unchanged");
  assert.ok(cut.indexOf("<option>Morning</option><option>Pre-workout</option><option>Post-workout</option><option>Night</option>") !== -1,
    "the four timing options must be unchanged");
  // No rewriting of existing rows anywhere in the new code.
  const tr = cut.slice(cut.indexOf("function timingRows("), cut.indexOf("function windowStats("));
  assert.strictEqual(/timeOfDay\s*=/.test(tr), false, "stored timings must never be reassigned");
});

test("morning outranks post-workout in the canonical row, and the one gap is pinned", function () {
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const clean = cut.slice(cut.indexOf("function cleanRows(input,key=\"weight\")"), cut.indexOf("  /* Chart-only view"));
  // What holds today, verified in the running app:
  //   * a post-workout row can NEVER displace a morning row for the same date;
  //   * on a date with NO morning row, the last non-morning row wins — so a
  //     post-workout entry becomes that day's canonical trend point.
  // The second case means post-workout CAN reach the trend on a skipped-morning
  // day. Fixing it changes trend output for existing users, so it is deliberately
  // out of scope for a presentation hotfix. This test pins the current rule: if
  // the fallback is ever changed, it must be a considered decision with its own
  // verification, not a silent side effect.
  assert.ok(clean.indexOf('const prior=byDate.get(r.date),morning=String(r.timeOfDay||"").toLowerCase()==="morning";') !== -1,
    "morning preference must stay as shipped");
  assert.ok(clean.indexOf('if(!prior||morning||String(prior.timeOfDay||"").toLowerCase()!=="morning")byDate.set(r.date,{...r,[key]:v});') !== -1,
    "the last-non-morning-wins fallback must stay as shipped until it is deliberately changed");
  // Whatever that rule is, the chart series must not be what enforces it.
  const tr = cut.slice(cut.indexOf("function timingRows("), cut.indexOf("function windowStats("));
  assert.strictEqual(tr.indexOf("byDate.set") === -1, false);
  assert.strictEqual(/cleanRows|weights\(\)/.test(tr), false, "the chart series must not route through the canonical set");
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
