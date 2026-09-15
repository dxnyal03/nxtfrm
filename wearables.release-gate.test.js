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
const RELEASE_CACHE = "nxtfrm-v107-premium-cache";

test("index does not statically load fixtures on every host", function () {
  assert.ok(!/<script src="wearables\.fixtures\.js"><\/script>/.test(html));
  assert.ok(html.indexOf("loadWearableFixturesDevOnly") !== -1);
  assert.ok(html.indexOf('s.src="wearables.fixtures.js"') !== -1);
});

test("early legacy render() is not invoked before premium-ui", function () {
  assert.ok(html.indexOf("an early render() is the old-version flash") !== -1);
  assert.ok(!/initCloudFromStorage\(\);\s*try\{render\(\)/.test(html));
});

test("leftover top chrome is hidden before paint", function () {
  assert.ok(html.indexOf("header.top{display:none!important}") !== -1);
  assert.ok(/\.top\s*\{[^}]*display:\s*none\s*!important/i.test(css));
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
