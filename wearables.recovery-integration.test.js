/* NXTFRM R2 recovery-integration tests. Run: node wearables.recovery-integration.test.js */
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
    apm_settings: JSON.stringify({ cutSupport: { recovery: {} } }),
    apm_current_read: JSON.stringify({ sleep: "", energy: "", soreness: "" }),
    nxtfrm_recovery_snapshot: JSON.stringify({ reason: "seed", createdAt: "2026-09-14T00:00:00.000Z", data: {} })
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
  [
    "wearables.js", "wearables.fixtures.js", "wearables.adapters.js", "wearables.ingest.js",
    "wearables.canonical.js", "wearables.days.js", "wearables.snapshots.js",
    "wearables.resolution.js", "wearables.recovery.js", "wearables.recovery-integration.js"
  ].forEach(function (file) {
    if (file === "wearables.fixtures.js" && options.loadFixtures === false) return;
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    recovery: ctx.NXTFRMWearableRecovery.createRecovery(),
    integration: ctx.NXTFRMWearableRecoveryIntegration.createIntegration()
  };
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function emptyField() {
  return {
    candidates: [],
    primary_candidate_id: null,
    selection: { rule: "none_empty", policy_id: null, policy_version: null }
  };
}

function wearableResult(extra) {
  extra = extra || {};
  const status = extra.status || "ready";
  const score = Object.prototype.hasOwnProperty.call(extra, "score") ? extra.score : 82;
  return {
    document_type: "recovery_result",
    schema_version: "g1.2.1",
    policy_id: "nxtfrm.recovery.personal_baseline",
    policy_version: "1",
    user_id: extra.user_id || "u_r1",
    day_window_id: extra.day_window_id || "dw_cur",
    snapshot_id: extra.snapshot_id || "snap:current",
    snapshot_version: extra.snapshot_version == null ? 1 : extra.snapshot_version,
    result_id: extra.result_id || "rec:fixture",
    status: status,
    score: score,
    components: extra.components || {
      hrv: { status: "usable", raw: 55, baseline: 50, contribution: 60, weight: 1 },
      resting_hr: { status: "usable", raw: 58, baseline: 60, contribution: 53.333333333333336, weight: 1 },
      sleep: { status: "usable", raw: 28800, baseline: 28800, contribution: 100, weight: 1 }
    },
    missing: extra.missing || [],
    unresolved: extra.unresolved || [],
    unsupported: extra.unsupported || [],
    explanation: extra.explanation || ["hrv_above_baseline"],
    quality_flags: extra.quality_flags || []
  };
}

function manualRecord(extra) {
  extra = extra || {};
  return {
    sleep: Object.prototype.hasOwnProperty.call(extra, "sleep") ? extra.sleep : 8,
    energy: Object.prototype.hasOwnProperty.call(extra, "energy") ? extra.energy : 5,
    soreness: Object.prototype.hasOwnProperty.call(extra, "soreness") ? extra.soreness : 1,
    date: extra.date || "2026-09-14"
  };
}

function integrate(world, extra) {
  return fromVm(world.integration.integrate(Object.assign({ local_date: "2026-09-14" }, extra || {})));
}

function existingReadiness(record) {
  const s = Number(record.sleep);
  const e = Number(record.energy || 3);
  const sore = Number(record.soreness || 2);
  let score = 78;
  if (s) score += Math.min(10, Math.max(-18, (s - 6.5) * 7));
  score += (e - 3) * 6;
  score -= Math.max(0, sore - 2) * 8;
  score = Math.max(35, Math.min(96, Math.round(score)));
  const msg = score >= 80 ? "Ready" : score >= 65 ? "Manage fatigue" : "Go light";
  return { score: score, msg: msg, known: true };
}

test("syntax: G3A–R2 scripts parse", function () {
  [
    "wearables.js", "wearables.recovery.js", "wearables.recovery-integration.js",
    "wearables.recovery-integration.test.js", "sw.js"
  ].forEach(syntaxCheck);
});

test("policy: v1 is provenance/status-only with no blended score", function () {
  const world = loadWorld();
  const policy = fromVm(world.integration.describePolicy());
  assert.strictEqual(policy.policy_id, "nxtfrm.recovery.integration");
  assert.strictEqual(policy.policy_version, "1");
  assert.strictEqual(policy.integrated_score, null);
  assert.strictEqual(policy.blend, "none");
  assert.strictEqual(policy.date_alignment, "exact_local_date");
  assert.strictEqual(policy.agreement_rules.uses_soreness_as_wearable, false);
  assert.strictEqual(policy.agreement_rules.uses_manual_sleep, false);
  const src = fs.readFileSync(path.join(ROOT, "wearables.recovery-integration.js"), "utf8");
  assert.ok(src.indexOf(".evaluate(") === -1);
  assert.ok(src.indexOf("localStorage") === -1);
  assert.ok(src.indexOf("fetch(") === -1);
});

test("1. No manual + no wearable → no_data", function () {
  const world = loadWorld();
  const out = integrate(world, {}).result;
  assert.strictEqual(out.availability, "none");
  assert.strictEqual(out.integrated_status, "no_data");
  assert.strictEqual(out.integrated_score, null);
  assert.strictEqual(out.manual.present, false);
  assert.strictEqual(out.wearable.present, false);
});

test("2. Manual only → manual_only", function () {
  const world = loadWorld();
  const out = integrate(world, { manualRecovery: manualRecord() }).result;
  assert.strictEqual(out.availability, "manual_only");
  assert.strictEqual(out.integrated_status, "manual_only");
  assert.strictEqual(out.manual.present, true);
  assert.strictEqual(out.wearable.present, false);
  assert.strictEqual(out.integrated_score, null);
});

test("3. Wearable only → wearable_only", function () {
  const world = loadWorld();
  const wear = wearableResult();
  const out = integrate(world, { wearableRecovery: wear, wearableLocalDate: "2026-09-14" }).result;
  assert.strictEqual(out.availability, "wearable_only");
  assert.strictEqual(out.integrated_status, "wearable_only");
  assert.strictEqual(out.manual.present, false);
  assert.strictEqual(out.wearable.present, true);
  assert.strictEqual(out.wearable.score, 82);
});

test("4,15-18. Manual + wearable ready preserves both R1 fields unchanged", function () {
  const world = loadWorld();
  const wear = wearableResult({ result_id: "rec:keep", snapshot_id: "snap:keep", snapshot_version: 3, score: 82 });
  const before = JSON.stringify(wear);
  const out = integrate(world, {
    manualRecovery: manualRecord(),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.availability, "both");
  assert.strictEqual(out.integrated_status, "both_available");
  assert.strictEqual(out.wearable.score, 82);
  assert.strictEqual(out.wearable.status, "ready");
  assert.strictEqual(out.wearable.result_id, "rec:keep");
  assert.strictEqual(out.wearable.snapshot_id, "snap:keep");
  assert.strictEqual(out.wearable.snapshot_version, 3);
  assert.strictEqual(out.wearable.policy_id, "nxtfrm.recovery.personal_baseline");
  assert.strictEqual(out.wearable.policy_version, "1");
  assert.deepStrictEqual(out.wearable.result.components, wear.components);
  assert.strictEqual(JSON.stringify(wear), before);
  assert.strictEqual(out.integrated_score, null);
});

test("5. Manual + wearable partial remains explicit", function () {
  const world = loadWorld();
  const wear = wearableResult({ status: "partial", score: 50, missing: ["sleep"] });
  wear.components.sleep = { status: "missing", raw: null, contribution: null, weight: 1 };
  const out = integrate(world, {
    manualRecovery: manualRecord(),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.availability, "both");
  assert.strictEqual(out.integrated_status, "wearable_partial");
  assert.strictEqual(out.wearable.partial, true);
  assert.strictEqual(out.wearable.status, "partial");
  assert.ok(out.reasons.indexOf("wearable_partial") !== -1);
  assert.strictEqual(out.agreement, "not_comparable");
});

test("6. Manual + wearable unresolved remains explicit", function () {
  const world = loadWorld();
  const wear = wearableResult({
    status: "unresolved_evidence",
    score: null,
    unresolved: ["hrv"],
    result_id: "rec:unresolved"
  });
  wear.components.hrv = { status: "unresolved", raw: null, contribution: null, weight: 1 };
  const out = integrate(world, {
    manualRecovery: manualRecord({ energy: 5, soreness: 1, sleep: 8 }),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.availability, "both");
  assert.strictEqual(out.integrated_status, "wearable_unresolved");
  assert.strictEqual(out.wearable.unresolved, true);
  assert.strictEqual(out.wearable.score, null);
  assert.strictEqual(out.agreement, "not_comparable");
  assert.strictEqual(out.manual.energy, 5);
});

test("7. Wearable insufficient_data score null remains null", function () {
  const world = loadWorld();
  const wear = wearableResult({ status: "insufficient_data", score: null });
  const out = integrate(world, { wearableRecovery: wear, wearableLocalDate: "2026-09-14" }).result;
  assert.strictEqual(out.wearable.score, null);
  assert.notStrictEqual(out.wearable.score, 0);
  assert.strictEqual(out.integrated_status, "wearable_insufficient");
  assert.strictEqual(out.integrated_score, null);
});

test("8-10. Missing manual fields stay null, not 0", function () {
  const world = loadWorld();
  const out = integrate(world, {
    manualRecovery: { sleep: "", energy: "", soreness: "", date: "2026-09-14" }
  }).result;
  assert.strictEqual(out.manual.present, false);
  assert.strictEqual(out.manual.sleep_hours, null);
  assert.strictEqual(out.manual.energy, null);
  assert.strictEqual(out.manual.soreness, null);
  const partial = integrate(world, {
    manualRecovery: { sleep: "", energy: 4, soreness: "", date: "2026-09-14" }
  }).result;
  assert.strictEqual(partial.manual.sleep_hours, null);
  assert.strictEqual(partial.manual.soreness, null);
  assert.strictEqual(partial.manual.energy, 4);
  assert.notStrictEqual(partial.manual.sleep_hours, 0);
  assert.notStrictEqual(partial.manual.soreness, 0);
});

test("11-14. Manual and wearable sleep/energy/soreness stay independent", function () {
  const world = loadWorld();
  const wear = wearableResult();
  wear.components.sleep = { status: "usable", raw: 28800, baseline: 28800, contribution: 100, weight: 1 };
  const out = integrate(world, {
    manualRecovery: manualRecord({ sleep: 4, energy: 2, soreness: 5 }),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.manual.sleep_hours, 4);
  assert.strictEqual(out.wearable.result.components.sleep.raw, 28800);
  assert.notStrictEqual(out.manual.sleep_hours, out.wearable.result.components.sleep.raw);
  assert.strictEqual(out.manual.soreness, 5);
  assert.strictEqual(out.manual.energy, 2);
  assert.strictEqual(out.manual.kind, "manual_check_in");
  assert.ok(!out.wearable.result.soreness);
});

test("19. Manual existing readiness/status preserved", function () {
  const world = loadWorld();
  const rec = manualRecord({ sleep: 8, energy: 5, soreness: 1 });
  const expected = existingReadiness(rec);
  const out = integrate(world, { manualRecovery: rec }).result;
  assert.deepStrictEqual(out.manual.readiness, expected);
  assert.strictEqual(out.manual.home_label, "Good");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(html.indexOf("function readiness(){") !== -1);
  assert.ok(html.indexOf("let score=78;") !== -1);
  assert.ok(html.indexOf("score+=(e-3)*6; score-=Math.max(0,sore-2)*8;") !== -1);
});

test("20-21. Manual storage object and R1 object are not mutated", function () {
  const world = loadWorld();
  const rec = manualRecord();
  const wear = wearableResult();
  const recBefore = JSON.stringify(rec);
  const wearBefore = JSON.stringify(wear);
  integrate(world, { manualRecovery: rec, wearableRecovery: wear, wearableLocalDate: "2026-09-14" });
  assert.strictEqual(JSON.stringify(rec), recBefore);
  assert.strictEqual(JSON.stringify(wear), wearBefore);
});

test("22-23. Same inputs + same policy produce same identity independent of wall clock", function () {
  const world = loadWorld();
  const extra = {
    manualRecovery: manualRecord(),
    wearableRecovery: wearableResult({ result_id: "rec:same" }),
    wearableLocalDate: "2026-09-14"
  };
  const a = integrate(world, Object.assign({ computed_at_utc: "2026-09-14T09:00:00Z" }, extra)).result;
  const b = integrate(world, Object.assign({ computed_at_utc: "2026-09-14T23:00:00Z" }, extra)).result;
  assert.strictEqual(a.result_id, b.result_id);
  assert.strictEqual(a.availability, b.availability);
  assert.strictEqual(a.agreement, b.agreement);
  assert.strictEqual(a.integrated_status, b.integrated_status);
  assert.notStrictEqual(a.computed_at_utc, b.computed_at_utc);
});

test("24-25. Source updates change integration without mutating the other source", function () {
  const world = loadWorld();
  const rec = manualRecord({ energy: 5, soreness: 1, sleep: 8 });
  const wear = wearableResult({ score: 85, result_id: "rec:v1" });
  const first = integrate(world, { manualRecovery: rec, wearableRecovery: wear, wearableLocalDate: "2026-09-14" }).result;
  const recAfter = manualRecord({ energy: 2, soreness: 5, sleep: 4, date: rec.date });
  const second = integrate(world, { manualRecovery: recAfter, wearableRecovery: wear, wearableLocalDate: "2026-09-14" }).result;
  assert.notStrictEqual(first.result_id, second.result_id);
  assert.strictEqual(second.wearable.result_id, "rec:v1");
  assert.strictEqual(JSON.stringify(wear.components), JSON.stringify(wearableResult({ score: 85, result_id: "rec:v1" }).components));
  const wear2 = wearableResult({ score: 40, result_id: "rec:v2", status: "ready" });
  const third = integrate(world, { manualRecovery: rec, wearableRecovery: wear2, wearableLocalDate: "2026-09-14" }).result;
  assert.notStrictEqual(first.result_id, third.result_id);
  assert.strictEqual(third.manual.energy, 5);
  assert.strictEqual(third.manual.soreness, 1);
});

test("26. Manual date mismatch with wearable day is not same-day integrated", function () {
  const world = loadWorld();
  const out = integrate(world, {
    local_date: "2026-09-14",
    manualRecovery: manualRecord({ date: "2026-09-14" }),
    wearableRecovery: wearableResult({ day_window_id: "dw_13" }),
    wearableLocalDate: "2026-09-13"
  });
  assert.strictEqual(out.outcome, "date_mismatch");
  assert.strictEqual(out.result.aligned, false);
  assert.strictEqual(out.result.integrated_status, "date_mismatch");
  assert.strictEqual(out.result.agreement, "not_comparable");
  assert.strictEqual(out.result.manual.present, true);
  assert.strictEqual(out.result.wearable.present, true);
  assert.ok(out.result.reasons.indexOf("date_mismatch") !== -1);
});

test("27-30. R2 never selects day-window, snapshot, resolves conflicts, or recomputes R1", function () {
  const world = loadWorld();
  const wear = wearableResult({ day_window_id: "zzz-stockholm", snapshot_id: "snap:sto", snapshot_version: 1, score: 70 });
  const decoy = wearableResult({ day_window_id: "aaa-singapore", snapshot_id: "snap:sg", snapshot_version: 9, score: 10 });
  const out = integrate(world, {
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14",
    windows: [{ day_window_id: "aaa-singapore" }, { day_window_id: "zzz-stockholm" }],
    history: [decoy],
    dayWindowPointers: [{ user_id: "u_r1", local_date: "2026-09-14", day_window_id: "aaa-singapore" }]
  }).result;
  assert.strictEqual(out.wearable.day_window_id, "zzz-stockholm");
  assert.strictEqual(out.wearable.snapshot_id, "snap:sto");
  assert.strictEqual(out.wearable.snapshot_version, 1);
  assert.strictEqual(out.wearable.score, 70);
  const st = fromVm(world.integration.status());
  assert.strictEqual(st.recomputes_r1, false);
  assert.strictEqual(st.selects_snapshot, false);
  assert.strictEqual(st.selects_day_window, false);
  assert.strictEqual(world.ctx.NXT.wearables.recoveryIntegration.status().blend, "none");
});

test("31. Conflicting manual-low / wearable-high preserves both", function () {
  const world = loadWorld();
  const out = integrate(world, {
    manualRecovery: manualRecord({ sleep: 4, energy: 2, soreness: 5 }),
    wearableRecovery: wearableResult({ score: 85, status: "ready" }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.manual.energy, 2);
  assert.strictEqual(out.manual.soreness, 5);
  assert.strictEqual(out.wearable.score, 85);
  assert.strictEqual(out.wearable.status, "ready");
  assert.strictEqual(out.agreement, "conflicting");
  assert.strictEqual(out.integrated_score, null);
  assert.notStrictEqual(out.integrated_score, Math.round((existingReadiness({ sleep: 4, energy: 2, soreness: 5 }).score + 85) / 2));
});

test("32. Consistent manual-high / wearable-high preserves both", function () {
  const world = loadWorld();
  const out = integrate(world, {
    manualRecovery: manualRecord({ sleep: 8, energy: 5, soreness: 1 }),
    wearableRecovery: wearableResult({ score: 88, status: "ready" }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.agreement, "broadly_consistent");
  assert.strictEqual(out.manual.energy, 5);
  assert.strictEqual(out.wearable.score, 88);
  assert.strictEqual(out.integrated_score, null);
});

test("33-34. No averaging; integrated_score remains null", function () {
  const world = loadWorld();
  const policy = fromVm(world.integration.describePolicy());
  assert.strictEqual(policy.blend, "none");
  const out = integrate(world, {
    manualRecovery: manualRecord({ energy: 2, soreness: 5, sleep: 4 }),
    wearableRecovery: wearableResult({ score: 85 }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.integrated_score, null);
  const src = fs.readFileSync(path.join(ROOT, "wearables.recovery-integration.js"), "utf8");
  assert.ok(!/integrated_score\s*=\s*[^\n]*\/\s*2/.test(src));
  const validated = fromVm(world.integration.validateResult(out));
  assert.strictEqual(validated.outcome, "ok");
});

test("35-36. Existing readiness() and check-in persistence files are unchanged by R2 source", function () {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const cut = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const ui = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
  assert.ok(html.indexOf("function readiness(){") !== -1);
  assert.ok(cut.indexOf("N.cfg().recovery[state.date]=r") !== -1);
  assert.ok(ui.indexOf("recLabel=!recLogged?'Not logged'") !== -1);
  const r2 = fs.readFileSync(path.join(ROOT, "wearables.recovery-integration.js"), "utf8");
  assert.ok(r2.indexOf("cutSupport") === -1);
  assert.ok(r2.indexOf("apm_current_read") === -1);
  assert.ok(r2.indexOf("nxtfrm_recovery_snapshot") === -1);
  assert.ok(r2.indexOf("premium-ui") === -1);
});

test("39-44. Zero I/O from integrate()", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  integrate(world, {
    manualRecovery: manualRecord(),
    wearableRecovery: wearableResult(),
    wearableLocalDate: "2026-09-14"
  });
  const st = fromVm(world.integration.status());
  assert.strictEqual(st.persists, false);
  assert.strictEqual(st.network, false);
  assert.strictEqual(st.writes_app_recovery, false);
  assert.strictEqual(st.renders_ui, false);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
  assert.ok(world.storage.store.nxtfrm_recovery_snapshot.indexOf("\"reason\":\"seed\"") !== -1);
  assert.ok(world.storage.store.apm_current_read.indexOf("\"energy\":\"\"") !== -1);
});

test("unwrap evaluate() wrapper without calling R1", function () {
  const world = loadWorld();
  const wrapped = { outcome: "evaluated", result: wearableResult({ score: 77, result_id: "rec:wrap" }) };
  const out = integrate(world, { wearableRecovery: wrapped, wearableLocalDate: "2026-09-14" }).result;
  assert.strictEqual(out.wearable.result_id, "rec:wrap");
  assert.strictEqual(out.wearable.score, 77);
});

test("namespace attaches beside R1 without overload", function () {
  const world = loadWorld();
  assert.ok(world.wearables.recovery);
  assert.ok(world.wearables.recoveryIntegration);
  assert.strictEqual(typeof world.recovery.evaluate, "function");
  assert.strictEqual(typeof world.integration.integrate, "function");
  assert.notStrictEqual(world.wearables.recovery, world.wearables.recoveryIntegration);
});

test("45. Existing G3A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  15 passed") !== -1);
});

test("46. Existing G3B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("47. Existing G3C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("48. Existing G3D tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.canonical.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  24 passed") !== -1);
});

test("49. Existing G4A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.days.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  16 passed") !== -1);
});

test("50. Existing G4B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.snapshots.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  26 passed") !== -1);
});

test("51. Existing G4C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.resolution.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  19 passed") !== -1);
});

test("52. Existing R1 tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.recovery.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  28 passed") !== -1);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
