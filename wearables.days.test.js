/* NXTFRM G4A UserDayWindow tests. Run: node wearables.days.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { spawnSync } = require("child_process");

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
    console.error("FAIL  " + name);
    console.error("      " + (err && err.stack ? err.stack : String(err)));
  }
}

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
}

function fingerprint(store) {
  const keys = Object.keys(store).sort();
  const sig = {};
  keys.forEach(function (key) {
    const value = String(store[key] ?? "");
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    sig[key] = value.length + ":" + hash;
  });
  return { keys: keys, sig: sig };
}

function createStorage(seed) {
  const store = Object.assign({
    apm_bws: JSON.stringify([{ id: "w1", date: "2026-09-14", weight: 81.4, timeOfDay: "Morning" }]),
    apm_logs: "[]",
    apm_cardio: "[]",
    apm_floorball: "[]",
    apm_settings: "{}"
  }, seed || {});
  let writes = 0;
  const localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { writes += 1; store[key] = String(value); },
    removeItem: function (key) { writes += 1; delete store[key]; },
    clear: function () { writes += 1; Object.keys(store).forEach(function (key) { delete store[key]; }); },
    key: function (i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; }
  };
  return { store: store, writes: function () { return writes; }, localStorage: localStorage };
}

function loadWorld(options) {
  options = options || {};
  const storage = createStorage(options.storage);
  const sessionStore = {};
  let sessionWrites = 0;
  let idbWrites = 0;
  const ctx = {
    console: console,
    NXT: {},
    location: options.location || { hostname: "localhost", protocol: "http:" },
    localStorage: storage.localStorage,
    sessionStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(sessionStore, key) ? sessionStore[key] : null; },
      setItem: function (key, value) { sessionWrites += 1; sessionStore[key] = String(value); },
      removeItem: function (key) { sessionWrites += 1; delete sessionStore[key]; }
    },
    indexedDB: { open: function () { idbWrites += 1; throw new Error("indexedDB blocked"); } },
    process: { env: options.env || {} },
    __networkCalls: { fetch: 0, xhr: 0, ws: 0 }
  };
  ctx.fetch = function () { ctx.__networkCalls.fetch += 1; throw new Error("network blocked: fetch"); };
  ctx.XMLHttpRequest = function () { ctx.__networkCalls.xhr += 1; throw new Error("network blocked: xhr"); };
  ctx.WebSocket = function () { ctx.__networkCalls.ws += 1; throw new Error("network blocked: ws"); };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.js"), "utf8"), ctx, { filename: "wearables.js" });
  if (options.loadFixtures !== false) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.fixtures.js"), "utf8"), ctx, { filename: "wearables.fixtures.js" });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.adapters.js"), "utf8"), ctx, { filename: "wearables.adapters.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.ingest.js"), "utf8"), ctx, { filename: "wearables.ingest.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.canonical.js"), "utf8"), ctx, { filename: "wearables.canonical.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.days.js"), "utf8"), ctx, { filename: "wearables.days.js" });
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    adapters: ctx.NXT.wearables.adapters,
    ingest: ctx.NXT.wearables.ingest,
    canonical: ctx.NXTFRMWearableCanonical.createCanonical(),
    days: ctx.NXTFRMWearableDays.createDays()
  };
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function hoursBetween(start, end) {
  return (Date.parse(end) - Date.parse(start)) / 3600000;
}

function createProfile(days, extra) {
  return fromVm(days.createWindow(Object.assign({
    user_id: "u_g4a",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "profile"
  }, extra || {})));
}

const G2_TRAVEL = [
  {
    day_window_id: "dw_u_syn_h_2026-09-12",
    user_id: "u_syn_h",
    local_date: "2026-09-12",
    representative_timezone: "Asia/Singapore",
    start_utc: "2026-09-11T16:00:00Z",
    end_utc: "2026-09-12T16:00:00Z",
    assignment_source: "profile"
  },
  {
    day_window_id: "dw_u_syn_h_2026-09-13",
    user_id: "u_syn_h",
    local_date: "2026-09-13",
    representative_timezone: "Asia/Singapore",
    start_utc: "2026-09-12T16:00:00Z",
    end_utc: "2026-09-13T22:00:00Z",
    assignment_source: "travel_override"
  },
  {
    day_window_id: "dw_u_syn_h_2026-09-14",
    user_id: "u_syn_h",
    local_date: "2026-09-14",
    representative_timezone: "Europe/Stockholm",
    start_utc: "2026-09-13T22:00:00Z",
    end_utc: "2026-09-14T22:00:00Z",
    assignment_source: "travel_override"
  }
];

test("syntax: G3A–G4A scripts parse", function () {
  [
    "wearables.js", "wearables.adapters.js", "wearables.ingest.js", "wearables.canonical.js", "wearables.days.js",
    "wearables.test.js", "wearables.adapters.test.js", "wearables.ingest.test.js", "wearables.canonical.test.js",
    "wearables.days.test.js", "sw.js", "cut-support.js", "premium-ui.js"
  ].forEach(syntaxCheck);
});

test("1-4. Valid date/IANA accepted; invalid date/timezone rejected", function () {
  const days = loadWorld().days;
  const ok = fromVm(days.deriveBoundaries("2026-09-14", "Asia/Singapore"));
  assert.strictEqual(ok.outcome, "ok");
  assert.strictEqual(ok.start_utc, "2026-09-13T16:00:00Z");
  const badDate = fromVm(days.deriveBoundaries("2026-2-3", "Asia/Singapore"));
  assert.strictEqual(badDate.outcome, "invalid_date");
  assert.strictEqual(fromVm(days.deriveBoundaries("2026-02-30", "Asia/Singapore")).outcome, "invalid_date");
  assert.strictEqual(fromVm(days.deriveBoundaries("2026-09-14T00:00:00Z", "Asia/Singapore")).outcome, "invalid_date");
  assert.strictEqual(fromVm(days.deriveBoundaries("2026-09-14", "Not/AZone")).outcome, "invalid_timezone");
  assert.strictEqual(fromVm(days.deriveBoundaries("2026-09-14", "")).outcome, "invalid_timezone");
  assert.strictEqual(fromVm(days.deriveBoundaries("2026-09-14", "+08:00")).outcome, "invalid_timezone");
  assert.strictEqual(fromVm(days.deriveBoundaries("2026-09-14", "UTC+8")).outcome, "invalid_timezone");
});

test("5-9. Derived UTC bounds: 24h, DST 23h/25h, next local midnight, half-open", function () {
  const days = loadWorld().days;
  const normal = fromVm(days.deriveBoundaries("2026-09-14", "Europe/Stockholm"));
  assert.strictEqual(normal.start_utc, "2026-09-13T22:00:00Z");
  assert.strictEqual(normal.end_utc, "2026-09-14T22:00:00Z");
  assert.strictEqual(hoursBetween(normal.start_utc, normal.end_utc), 24);
  const spring = fromVm(days.deriveBoundaries("2026-03-29", "Europe/Stockholm"));
  assert.strictEqual(spring.start_utc, "2026-03-28T23:00:00Z");
  assert.strictEqual(spring.end_utc, "2026-03-29T22:00:00Z");
  assert.strictEqual(hoursBetween(spring.start_utc, spring.end_utc), 23);
  const fall = fromVm(days.deriveBoundaries("2026-10-25", "Europe/Stockholm"));
  assert.strictEqual(fall.start_utc, "2026-10-24T22:00:00Z");
  assert.strictEqual(fall.end_utc, "2026-10-25T23:00:00Z");
  assert.strictEqual(hoursBetween(fall.start_utc, fall.end_utc), 25);
  const plus24 = new Date(Date.parse(spring.start_utc) + 24 * 3600000).toISOString().replace(".000Z", "Z");
  assert.notStrictEqual(spring.end_utc, plus24);
  assert.strictEqual(days.intervalsOverlap(spring.start_utc, spring.end_utc, spring.start_utc, spring.end_utc), true);
  assert.strictEqual(days.intervalsOverlap(spring.start_utc, spring.end_utc, spring.end_utc, "2026-03-30T22:00:00Z"), false);
});

test("10-14. Idempotent same lineage; distinct timezone lineages coexist and stay immutable", function () {
  const days = loadWorld().days;
  const a1 = createProfile(days);
  const a2 = createProfile(days);
  assert.strictEqual(a1.outcome, "created");
  assert.strictEqual(a2.outcome, "reused");
  assert.strictEqual(a1.day_window_id, a2.day_window_id);
  assert.strictEqual(days.listWindows("u_g4a", "2026-09-14").length, 1);
  const beforeA = JSON.stringify(fromVm(days.getWindow(a1.day_window_id)));
  const b = createProfile(days, { representative_timezone: "Europe/Stockholm" });
  assert.strictEqual(b.outcome, "created");
  assert.notStrictEqual(a1.day_window_id, b.day_window_id);
  assert.notStrictEqual(a1.window.start_utc, b.window.start_utc);
  assert.strictEqual(days.listWindows("u_g4a", "2026-09-14").length, 2);
  assert.strictEqual(JSON.stringify(fromVm(days.getWindow(a1.day_window_id))), beforeA);
  assert.ok(!("is_current" in a1.window));
  assert.ok(!("is_current" in b.window));
});

test("15-19. Current pointer selects one window; A→B does not mutate either window", function () {
  const days = loadWorld().days;
  const a = createProfile(days);
  const b = createProfile(days, { representative_timezone: "Europe/Stockholm" });
  const hashA1 = JSON.stringify(fromVm(days.getWindow(a.day_window_id)));
  const setA = fromVm(days.setCurrent("u_g4a", "2026-09-14", a.day_window_id, "2026-09-14T08:00:00Z"));
  assert.strictEqual(setA.outcome, "pointer_set");
  assert.strictEqual(days.getCurrent("u_g4a", "2026-09-14").day_window_id, a.day_window_id);
  const hashB1 = JSON.stringify(fromVm(days.getWindow(b.day_window_id)));
  const setB = fromVm(days.setCurrent("u_g4a", "2026-09-14", b.day_window_id, "2026-09-14T09:00:00Z"));
  assert.strictEqual(setB.outcome, "pointer_set");
  assert.strictEqual(days.getCurrentPointer("u_g4a", "2026-09-14").day_window_id, b.day_window_id);
  assert.strictEqual(JSON.stringify(fromVm(days.getWindow(a.day_window_id))), hashA1);
  assert.strictEqual(JSON.stringify(fromVm(days.getWindow(b.day_window_id))), hashB1);
  assert.ok(!("is_current" in days.getWindow(a.day_window_id)));
  assert.ok(!("is_current" in days.getWindow(b.day_window_id)));
});

test("20-25. Invalid pointers fail closed; missing pointer does not guess latest", function () {
  const days = loadWorld().days;
  const a = createProfile(days);
  const b = createProfile(days, { representative_timezone: "Europe/Stockholm" });
  days.setCurrent("u_g4a", "2026-09-14", a.day_window_id, "2026-09-14T08:00:00Z");
  const ptr = fromVm(days.getCurrentPointer("u_g4a", "2026-09-14"));
  assert.strictEqual(fromVm(days.setCurrent("u_g4a", "2026-09-14", "missing-dw", "2026-09-14T10:00:00Z")).outcome, "invalid_pointer");
  assert.strictEqual(fromVm(days.setCurrent("other", "2026-09-14", a.day_window_id, "2026-09-14T10:00:00Z")).outcome, "invalid_pointer");
  assert.strictEqual(fromVm(days.setCurrent("u_g4a", "2026-09-15", a.day_window_id, "2026-09-14T10:00:00Z")).outcome, "invalid_pointer");
  days._test.failNextPointer();
  const failed = fromVm(days.setCurrent("u_g4a", "2026-09-14", b.day_window_id, "2026-09-14T10:00:00Z"));
  assert.strictEqual(failed.outcome, "invalid_pointer");
  assert.deepStrictEqual(fromVm(days.getCurrentPointer("u_g4a", "2026-09-14")), ptr);
  const isolated = loadWorld().days;
  createProfile(isolated);
  createProfile(isolated, { representative_timezone: "Europe/Stockholm" });
  assert.strictEqual(isolated.getCurrent("u_g4a", "2026-09-14"), null);
  assert.strictEqual(fromVm(isolated.resolveCurrent("u_g4a", "2026-09-14")).outcome, "missing_pointer");
});

test("26-28. G2 travel windows derive expected bounds and stay contiguous when current", function () {
  const days = loadWorld().days;
  const created = G2_TRAVEL.map(function (w) {
    return fromVm(days.createWindow(Object.assign({
      user_id: w.user_id,
      local_date: w.local_date,
      representative_timezone: w.representative_timezone,
      assignment_source: w.assignment_source,
      start_utc: w.start_utc,
      end_utc: w.end_utc,
      day_window_id: w.day_window_id
    })));
  });
  created.forEach(function (r, i) {
    assert.strictEqual(r.outcome, "created");
    assert.strictEqual(r.window.start_utc, G2_TRAVEL[i].start_utc);
    assert.strictEqual(r.window.end_utc, G2_TRAVEL[i].end_utc);
  });
  const derived12 = fromVm(days.deriveBoundaries("2026-09-12", "Asia/Singapore"));
  assert.strictEqual(created[0].window.start_utc, derived12.start_utc);
  assert.strictEqual(created[0].window.end_utc, derived12.end_utc);
  const derived14 = fromVm(days.deriveBoundaries("2026-09-14", "Europe/Stockholm"));
  assert.strictEqual(created[2].window.start_utc, derived14.start_utc);
  assert.strictEqual(created[2].window.end_utc, derived14.end_utc);
  assert.notStrictEqual(created[1].window.end_utc, fromVm(days.deriveBoundaries("2026-09-13", "Asia/Singapore")).end_utc);
  assert.strictEqual(created[0].window.end_utc, created[1].window.start_utc);
  assert.strictEqual(created[1].window.end_utc, created[2].window.start_utc);
  G2_TRAVEL.forEach(function (w) {
    const set = fromVm(days.setCurrent(w.user_id, w.local_date, w.day_window_id, "2026-09-14T00:00:00Z"));
    assert.strictEqual(set.outcome, "pointer_set");
  });
  const alt = createProfile(days, { user_id: "u_syn_h", local_date: "2026-09-14", representative_timezone: "Asia/Singapore" });
  assert.strictEqual(alt.outcome, "created");
  assert.notStrictEqual(alt.day_window_id, "dw_u_syn_h_2026-09-14");
  assert.strictEqual(days.getWindow("dw_u_syn_h_2026-09-14").representative_timezone, "Europe/Stockholm");
});

test("29-32. Host timezone cannot shift dates; invalid order and +00:00 rejected", function () {
  const days = loadWorld().days;
  const here = fromVm(days.deriveBoundaries("2026-09-14", "Asia/Singapore"));
  const script = [
    "const fs=require('fs'); const vm=require('vm');",
    "const ctx={NXT:{}, console}; vm.createContext(ctx);",
    "vm.runInContext(fs.readFileSync(" + JSON.stringify(path.join(ROOT, "wearables.days.js")) + ",'utf8'), ctx);",
    "const r=ctx.NXTFRMWearableDays.deriveBoundaries('2026-09-14','Asia/Singapore');",
    "process.stdout.write(JSON.stringify(r));"
  ].join("");
  const child = spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    env: Object.assign({}, process.env, { TZ: "America/Sao_Paulo" })
  });
  assert.strictEqual(child.status, 0, child.stderr);
  const there = JSON.parse(child.stdout);
  assert.deepStrictEqual(there, here);
  assert.strictEqual(here.start_utc, "2026-09-13T16:00:00Z");
  const badOrder = fromVm(days.createWindow({
    user_id: "u_g4a",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "travel_override",
    start_utc: "2026-09-14T16:00:00Z",
    end_utc: "2026-09-13T16:00:00Z"
  }));
  assert.strictEqual(badOrder.outcome, "invalid_window");
  const plus = fromVm(days.createWindow({
    user_id: "u_g4a",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "travel_override",
    start_utc: "2026-09-13T16:00:00+00:00",
    end_utc: "2026-09-14T16:00:00+00:00"
  }));
  assert.strictEqual(plus.outcome, "invalid_window");
  const created = createProfile(days);
  assert.strictEqual(created.window.start_utc, "2026-09-13T16:00:00Z");
  assert.ok(/Z$/.test(created.window.start_utc));
  assert.ok(!created.window.start_utc.includes("+00:00"));
});

test("33-38. Interval geometry only; Singapore midnight bout misses Stockholm 14 Sep", function () {
  const days = loadWorld().days;
  const sto = fromVm(days.deriveBoundaries("2026-09-14", "Europe/Stockholm"));
  assert.strictEqual(sto.start_utc, "2026-09-13T22:00:00Z");
  assert.strictEqual(sto.end_utc, "2026-09-14T22:00:00Z");
  assert.strictEqual(days.intervalsOverlap("2026-09-13T15:40:00Z", "2026-09-13T17:10:00Z", sto.start_utc, sto.end_utc), false);
  assert.strictEqual(days.intervalsOverlap("2026-09-13T21:00:00Z", "2026-09-13T22:00:00Z", sto.start_utc, sto.end_utc), false);
  assert.strictEqual(days.intervalsOverlap("2026-09-14T22:00:00Z", "2026-09-14T23:00:00Z", sto.start_utc, sto.end_utc), false);
  assert.strictEqual(days.intervalsOverlap("2026-09-13T21:00:00Z", "2026-09-13T23:00:00Z", sto.start_utc, sto.end_utc), true);
  assert.strictEqual(days.intervalsOverlap("2026-09-14T21:00:00Z", "2026-09-14T23:00:00Z", sto.start_utc, sto.end_utc), true);
  assert.strictEqual(days.status().activity_revisions, 0);
});

test("39-50. No evidence/snapshot writes and zero I/O", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  createProfile(world.days);
  createProfile(world.days, { representative_timezone: "Europe/Stockholm" });
  world.days.setCurrent("u_g4a", "2026-09-14", world.days.listWindows("u_g4a", "2026-09-14")[0].day_window_id, "2026-09-14T08:00:00Z");
  const st = world.days.status();
  assert.strictEqual(st.observation_revisions, 0);
  assert.strictEqual(st.activity_revisions, 0);
  assert.strictEqual(st.snapshots, 0);
  assert.strictEqual(st.snapshot_pointers, 0);
  assert.ok(!st.winner);
  assert.ok(!st.freshness_aggregate);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
  assert.strictEqual(world.canonical.status().observation_revisions, 0);
  assert.strictEqual(world.canonical.status().activity_revisions, 0);
});

test("51. Existing G3A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  18 passed") !== -1);
});

test("52. Existing G3B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("53. Existing G3C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("54. Existing G3D tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.canonical.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  24 passed") !== -1);
});

test("55-56. G3A reader and G3D acceptance remain unchanged after G4A", function () {
  const world = loadWorld();
  createProfile(world.days);
  assert.strictEqual(fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" })).snapshot_id, "snap_syn_a");
  assert.strictEqual(world.wearables.getDayWindow("2026-09-14", { userId: "u_syn_a" }).day_window_id, "dw_u_syn_a_2026-09-14");
  const delivery = fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect({
    user_id: "u_g3d",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  }));
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3d" }));
  const accepted = fromVm(world.canonical.acceptCandidate(batch.candidates[0], {
    delivery_id: delivery.delivery_id,
    accepted_at_utc: "2026-09-14T08:05:00Z"
  }));
  assert.ok(accepted.outcome === "accepted_new" || accepted.outcome === "replay_current");
  assert.strictEqual(world.days.status().observation_revisions, 0);
});

test("G3A public methods remain present after days attach", function () {
  const api = loadWorld().wearables;
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof api[name], "function");
  });
  assert.ok(api.adapters);
  assert.ok(api.ingest);
  assert.ok(api.canonical);
  assert.ok(api.days);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
