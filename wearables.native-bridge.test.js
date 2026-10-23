/* NXTFRM Native 1 bridge tests (native.js). Run: node wearables.native-bridge.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const SRC = fs.readFileSync(path.join(__dirname, "native.js"), "utf8");
let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) { queue.push({ name, fn }); }

function pad(n) { return (n < 10 ? "0" : "") + n; }
function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

/* A fake page: window/document/localStorage, a plugin that records calls, and the globals native.js wraps. */
function world(opts) {
  opts = opts || {};
  const calls = [];
  const store = {};
  const ls = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };
  const plugin = new Proxy({}, {
    get(_, method) {
      return function (args) {
        calls.push({ m: String(method), a: args });
        if (opts.reject) return Promise.reject(new Error("boom"));
        if (method === "healthAvailable") return Promise.resolve({ available: true });
        if (method === "healthAuthorize" || method === "notifyPermission") return Promise.resolve({ granted: true });
        if (method === "liveStart" || method === "liveUpdate") return Promise.resolve({ ok: true });
        return Promise.resolve({});
      };
    }
  });
  const listeners = {};
  const ctx = {
    console: { log() {}, warn() {}, error: console.error },
    setTimeout: () => 0,
    clearTimeout() {},
    localStorage: ls,
    document: {
      visibilityState: "visible",
      documentElement: { classList: { contains: () => false } },
      getElementById: () => null,
      addEventListener(t, f) { listeners[t] = f; }
    },
    state: { tab: "home", logs: [], exercise: "Bench Press", setNum: 2, date: ymd(new Date()) },
    template: () => [{ name: "Bench Press", sets: 3 }],
    apx96RestEnd: 0
  };
  ctx.window = ctx;
  if (opts.native !== false) ctx.Capacitor = { isNativePlatform: () => true, Plugins: { NxtNative: plugin } };
  /* The engine's rule, as cut-support.js cleanRows applies it: Morning or untimed, one row per date. */
  ctx.NXT = {
    weights() {
      const rows = JSON.parse(ls.getItem("apm_bws") || "[]"), by = new Map();
      rows.forEach(r => {
        const t = String(r.timeOfDay || "").trim().toLowerCase();
        if (t && t !== "morning") return;
        by.set(r.date, r);
      });
      return [...by.values()];
    }
  };
  vm.createContext(ctx);
  /* The page globals native.js wraps (function declarations live on the global object). */
  vm.runInContext(`
    var restStarts = 0;
    function apx96StartRest(s) { apx96RestEnd = Date.now() + s * 1000; restStarts++; return "start-ret"; }
    function apx96AdjustRest(s) { apx96RestEnd += s * 1000; return "adj-ret"; }
    function apx96SkipRest() { apx96RestEnd = 0; return "skip-ret"; }
    function apx96TickTimer() { if (apx96RestEnd && Date.now() >= apx96RestEnd) apx96RestEnd = 0; }
    function switchTab(t) { state.tab = t; return "tab-ret"; }
  `, ctx);
  vm.runInContext(SRC, ctx, { filename: "native.js" });
  const names = () => calls.map(c => c.m);
  return { ctx, calls, ls, names, run: code => vm.runInContext(code, ctx) };
}

const TODAY = ymd(new Date());
function setPrefs(w, p) { w.ls.setItem("nxt_native_prefs", JSON.stringify(p)); }
function saveWeights(w, rows) { w.ctx.localStorage.setItem("apm_bws", JSON.stringify(rows)); }
const morning = (id, weight, extra) => Object.assign({ id, date: TODAY, weight, timeOfDay: "Morning", ts: Date.now() }, extra || {});

test("does nothing when not native", async () => {
  const w = world({ native: false });
  assert.strictEqual(w.ctx.__nxtNative, undefined);
  assert.strictEqual(w.run("apx96StartRest(60)"), "start-ret");
  assert.strictEqual(w.calls.length, 0);
});

test("does nothing when the plugin is absent", async () => {
  const w = world();
  assert.ok(w.ctx.__nxtNative);
  const bare = world({ native: false });
  bare.ctx.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  vm.runInContext(SRC, bare.ctx);
  assert.strictEqual(bare.ctx.__nxtNative, undefined);
});

test("a Morning weigh-in sends one Health save, only with the Health pref on", async () => {
  const off = world();
  saveWeights(off, [morning("a", 81.4)]);
  await off.ctx.__nxtNative._flush();
  assert.ok(!off.names().includes("healthSaveWeight"));

  const w = world();
  setPrefs(w, { health: true, reminder: false, reminderTime: "07:30" });
  const row = morning("a", 81.4);
  saveWeights(w, [row]);
  await w.ctx.__nxtNative._flush();
  const saves = w.calls.filter(c => c.m === "healthSaveWeight");
  assert.strictEqual(saves.length, 1);
  assert.strictEqual(saves[0].a.id, "a");
  assert.strictEqual(saves[0].a.kg, 81.4);
  assert.strictEqual(saves[0].a.at, row.ts);
  assert.ok(saves[0].a.version > 0);
  /* Unchanged data is not rewritten. */
  await w.ctx.__nxtNative._flush();
  assert.strictEqual(w.calls.filter(c => c.m === "healthSaveWeight").length, 1);
});

test("editing the weigh-in saves again with a higher version", async () => {
  const w = world();
  setPrefs(w, { health: true, reminder: false, reminderTime: "07:30" });
  const row = morning("a", 81.4);
  saveWeights(w, [row]);
  await w.ctx.__nxtNative._flush();
  saveWeights(w, [Object.assign({}, row, { weight: 81.0 })]);
  await w.ctx.__nxtNative._flush();
  const saves = w.calls.filter(c => c.m === "healthSaveWeight");
  assert.strictEqual(saves.length, 2);
  assert.strictEqual(saves[1].a.kg, 81);
  assert.ok(saves[1].a.version > saves[0].a.version);
});

test("deleting the weigh-in deletes the Health sample", async () => {
  const w = world();
  setPrefs(w, { health: true, reminder: false, reminderTime: "07:30" });
  saveWeights(w, [morning("a", 81.4)]);
  await w.ctx.__nxtNative._flush();
  saveWeights(w, []);
  await w.ctx.__nxtNative._flush();
  const del = w.calls.filter(c => c.m === "healthDeleteWeight");
  assert.strictEqual(del.length, 1);
  assert.strictEqual(del[0].a.id, "a");
});

const scan = (id, bodyFat, extra) => Object.assign({ id, date: TODAY, bodyFat }, extra || {});
function saveScans(w, rows) { w.ctx.localStorage.setItem("apm_evo_scans", JSON.stringify(rows)); }
const HP = { health: true, reminder: false, reminderTime: "07:30" };

test("a scan with body fat saves once with the right pct and noon time; unchanged is not resent", async () => {
  const w = world();
  setPrefs(w, HP);
  saveScans(w, [scan("s1", 26.2)]);
  await w.ctx.__nxtNative._flush();
  const s = w.calls.filter(c => c.m === "healthSaveBodyFat");
  assert.strictEqual(s.length, 1);
  assert.strictEqual(s[0].a.id, "s1");
  assert.strictEqual(s[0].a.pct, 26.2);
  const d = new Date(s[0].a.at);
  assert.strictEqual(d.getHours(), 12);
  assert.strictEqual(d.getMinutes(), 0);
  await w.ctx.__nxtNative._flush();
  assert.strictEqual(w.calls.filter(c => c.m === "healthSaveBodyFat").length, 1);
});

test("editing scan body fat saves again with a higher version", async () => {
  const w = world();
  setPrefs(w, HP);
  saveScans(w, [scan("s1", 26.2)]);
  await w.ctx.__nxtNative._flush();
  saveScans(w, [scan("s1", 25.8)]);
  await w.ctx.__nxtNative._flush();
  const s = w.calls.filter(c => c.m === "healthSaveBodyFat");
  assert.strictEqual(s.length, 2);
  assert.strictEqual(s[1].a.pct, 25.8);
  assert.ok(s[1].a.version > s[0].a.version);
});

test("removing the scan deletes its body fat sample", async () => {
  const w = world();
  setPrefs(w, HP);
  saveScans(w, [scan("s1", 26.2)]);
  await w.ctx.__nxtNative._flush();
  saveScans(w, []);
  await w.ctx.__nxtNative._flush();
  const d = w.calls.filter(c => c.m === "healthDeleteBodyFat");
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].a.id, "s1");
});

test("a scan without body fat sends nothing", async () => {
  const w = world();
  setPrefs(w, HP);
  saveScans(w, [scan("s1", undefined, { weight: 82 }), scan("s2", null)]);
  await w.ctx.__nxtNative._flush();
  assert.ok(!w.names().some(n => /BodyFat|Weight/.test(n)));
});

test("scans send nothing when the Health pref is off", async () => {
  const w = world();
  saveScans(w, [scan("s1", 26.2)]);
  await w.ctx.__nxtNative._flush();
  assert.ok(!w.names().some(n => /^health/.test(n)));
});

test("a Post-workout weigh-in sends nothing", async () => {
  const w = world();
  setPrefs(w, { health: true, reminder: false, reminderTime: "07:30" });
  saveWeights(w, [morning("p", 82.2, { timeOfDay: "Post-workout" })]);
  await w.ctx.__nxtNative._flush();
  assert.ok(!w.names().includes("healthSaveWeight"));
  assert.ok(!w.names().includes("healthDeleteWeight"));
});

test("a weigh-in saved through localStorage.setItem is picked up by the debounced flush", async () => {
  const timers = [];
  const w = world();
  w.ctx.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length; };
  /* re-install against the timer-capturing world */
  w.ctx.__nxtNative = undefined;
  vm.runInContext(SRC, w.ctx);
  setPrefs(w, { health: true, reminder: false, reminderTime: "07:30" });
  const before = timers.length;
  saveWeights(w, [morning("a", 80)]);
  const t = timers.slice(before).find(x => x.ms === 400);
  assert.ok(t, "a 400 ms flush was scheduled");
});

test("rest start schedules the notification and starts the Live Activity; skip cancels both", async () => {
  const w = world();
  assert.strictEqual(w.run("apx96StartRest(90)"), "start-ret");
  /* The rest alert waits for the one-time notification permission (asked at the first rest), then schedules. */
  await new Promise(r => setImmediate(r));
  const names = w.names();
  assert.ok(names.indexOf("notifyPermission") > -1 && names.indexOf("notifyPermission") < names.indexOf("schedule"), "permission is asked before the first rest alert");
  const sch = w.calls.find(c => c.m === "schedule");
  assert.strictEqual(sch.a.id, "rest");
  assert.strictEqual(sch.a.title, "Rest done");
  assert.ok(sch.a.at > Date.now());
  const live = w.calls.find(c => c.m === "liveStart");
  assert.strictEqual(live.a.title, "Bench Press");
  assert.strictEqual(live.a.subtitle, "Set 2 of 3 next");
  assert.strictEqual(live.a.endAt, sch.a.at);

  assert.strictEqual(w.run("apx96AdjustRest(30)"), "adj-ret");
  assert.ok(w.names().includes("liveUpdate"));

  w.calls.length = 0;
  assert.strictEqual(w.run("apx96SkipRest()"), "skip-ret");
  assert.deepStrictEqual(w.calls.map(c => c.m), ["cancel", "liveEnd"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.calls[0].a)), { ids: ["rest"] });
});

test("haptics: set logged, tab change, rest finishing by itself", async () => {
  const w = world();
  w.run("state.logs.push({})");
  w.run("apx96StartRest(60)");
  assert.deepStrictEqual(w.calls.filter(c => c.m === "haptic").map(c => c.a.style), ["medium"]);
  w.run("apx96StartRest(60)"); /* resume: no new log */
  assert.strictEqual(w.calls.filter(c => c.m === "haptic").length, 1);

  assert.strictEqual(w.run("switchTab('train')"), "tab-ret");
  w.run("switchTab('train')");
  assert.deepStrictEqual(w.calls.filter(c => c.m === "haptic").map(c => c.a.style), ["medium", "selection"]);

  w.calls.length = 0;
  w.run("apx96RestEnd = Date.now() - 1; apx96TickTimer()");
  assert.deepStrictEqual(w.calls.map(c => c.m), ["haptic", "liveEnd"]);
  assert.strictEqual(w.calls[0].a.style, "success");
  w.calls.length = 0;
  w.run("apx96TickTimer()"); /* nothing running: silent */
  assert.strictEqual(w.calls.length, 0);
});

test("reminder schedules 7 days and skips a day with a Morning entry", async () => {
  const w = world();
  setPrefs(w, { health: false, reminder: true, reminderTime: "23:59" });
  await w.ctx.__nxtNative._refreshReminders();
  assert.strictEqual(w.calls[0].m, "cancelPrefix");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.calls[0].a)), { prefix: "rem-" });
  const rem = w.calls.filter(c => c.m === "schedule");
  assert.strictEqual(rem.length, 7);
  assert.ok(rem.every(c => /^rem-\d{4}-\d\d-\d\d$/.test(c.a.id) && c.a.title === "Morning weigh-in"));

  saveWeights(w, [morning("a", 80)]);
  w.calls.length = 0;
  await w.ctx.__nxtNative._refreshReminders();
  const ids = w.calls.filter(c => c.m === "schedule").map(c => c.a.id);
  assert.strictEqual(ids.length, 6);
  assert.ok(!ids.includes("rem-" + TODAY));

  setPrefs(w, { health: false, reminder: false, reminderTime: "23:59" });
  w.calls.length = 0;
  await w.ctx.__nxtNative._refreshReminders();
  assert.deepStrictEqual(w.names(), ["cancelPrefix"]);
});

test("a rejected native call never throws", async () => {
  const w = world({ reject: true });
  setPrefs(w, { health: true, reminder: true, reminderTime: "23:59" });
  assert.strictEqual(w.run("apx96StartRest(60)"), "start-ret");
  assert.strictEqual(w.run("apx96SkipRest()"), "skip-ret");
  saveWeights(w, [morning("a", 80)]);
  await w.ctx.__nxtNative._flush();
  await w.ctx.__nxtNative._refreshReminders();
  assert.ok(w.calls.length > 0);
  /* A failed save is not recorded as sent, so it is retried next time. */
  assert.strictEqual(w.ls.getItem("nxt_native_health"), "{}");
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed += 1; console.log("PASS  " + t.name); }
    catch (err) { failed += 1; console.error("FAIL  " + t.name); console.error("      " + (err && err.stack ? err.stack : String(err))); }
  }
  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
