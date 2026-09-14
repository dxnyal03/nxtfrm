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

test("dayType re-derives from weeklyPlan when no dated override exists", function () {
  assert.ok(html.indexOf("NXT.typeFor(state.date)") !== -1);
});

test("SW cache bumped and remains network-first", function () {
  assert.ok(/nxtfrm-v106-premium-cache/.test(sw));
  assert.ok(sw.indexOf("event.respondWith") !== -1);
  assert.ok(sw.indexOf("fetch(event.request)") !== -1);
  assert.ok(sw.indexOf("caches.match(event.request)") !== -1);
  assert.ok(sw.indexOf("skipWaiting") !== -1);
  assert.ok(sw.indexOf("clients.claim") !== -1);
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
