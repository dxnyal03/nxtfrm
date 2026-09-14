/* NXTFRM R4 training recovery-guard tests. Run: node wearables.training-readiness.test.js */
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
    apm_settings: JSON.stringify({ cutSupport: { recovery: {} } }),
    apm_current_read: JSON.stringify({ sleep: "", energy: "", soreness: "" }),
    nxtfrm_recovery_snapshot: JSON.stringify({ reason: "seed", createdAt: "2026-09-14T00:00:00.000Z", data: {} })
  }, seed || {});
  let writes = 0;
  const localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { writes += 1; store[key] = String(value); },
    removeItem: function (key) { writes += 1; delete store[key]; },
    clear: function () { writes += 1; Object.keys(store).forEach(function (key) { delete store[key]; }); }
  };
  return { store: store, writes: function () { return writes; }, localStorage: localStorage };
}

function loadWorld() {
  const storage = createStorage();
  const sessionStore = {};
  let sessionWrites = 0;
  let idbWrites = 0;
  const ctx = {
    console: console,
    NXT: {},
    localStorage: storage.localStorage,
    sessionStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(sessionStore, key) ? sessionStore[key] : null; },
      setItem: function (key, value) { sessionWrites += 1; sessionStore[key] = String(value); }
    },
    indexedDB: { open: function () { idbWrites += 1; throw new Error("indexedDB blocked"); } },
    __networkCalls: { fetch: 0, xhr: 0, ws: 0 }
  };
  ctx.fetch = function () { ctx.__networkCalls.fetch += 1; throw new Error("network blocked: fetch"); };
  ctx.XMLHttpRequest = function () { ctx.__networkCalls.xhr += 1; throw new Error("network blocked: xhr"); };
  ctx.WebSocket = function () { ctx.__networkCalls.ws += 1; throw new Error("network blocked: ws"); };
  vm.createContext(ctx);
  [
    "wearables.js", "wearables.recovery.js", "wearables.recovery-integration.js", "wearables.training-readiness.js"
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    integration: ctx.NXTFRMWearableRecoveryIntegration.createIntegration(),
    guard: ctx.NXTFRMWearableTrainingReadiness.createGuard()
  };
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
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
    user_id: "u_r1",
    day_window_id: extra.day_window_id || "dw_cur",
    snapshot_id: extra.snapshot_id || "snap:current",
    snapshot_version: extra.snapshot_version == null ? 1 : extra.snapshot_version,
    result_id: extra.result_id || "rec:fixture",
    status: status,
    score: score,
    components: extra.components || {
      hrv: { status: "usable", raw: 62, baseline: 50, contribution: 74, weight: 1 },
      resting_hr: { status: "usable", raw: 54, baseline: 57, contribution: 55, weight: 1 },
      sleep: { status: "usable", raw: 24480, baseline: 25860, contribution: 95, weight: 1 }
    },
    missing: extra.missing || [],
    unresolved: extra.unresolved || []
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

function integrated(world, extra) {
  extra = extra || {};
  return fromVm(world.integration.integrate({
    local_date: extra.local_date || "2026-09-14",
    manualRecovery: extra.manualRecovery,
    wearableRecovery: extra.wearableRecovery,
    wearableLocalDate: extra.wearableLocalDate
  })).result;
}

function advise(world, extra, clock) {
  const r2 = integrated(world, extra);
  return fromVm(world.guard.advise({ integratedRecovery: r2, computed_at_utc: clock }));
}

test("syntax: R4 scripts parse", function () {
  ["wearables.training-readiness.js", "wearables.training-readiness.test.js", "premium-ui.js", "sw.js"].forEach(syntaxCheck);
});

test("policy: recovery_guard v1 is advisory and unblended", function () {
  const world = loadWorld();
  const policy = fromVm(world.guard.describePolicy());
  assert.strictEqual(policy.policy_id, "nxtfrm.training.recovery_guard");
  assert.strictEqual(policy.policy_version, "1");
  assert.strictEqual(policy.blend, "none");
  assert.strictEqual(policy.mutates_workout, false);
  const src = fs.readFileSync(path.join(ROOT, "wearables.training-readiness.js"), "utf8");
  assert.ok(src.indexOf("localStorage") === -1);
  assert.ok(src.indexOf(".evaluate(") === -1);
  assert.ok(src.indexOf("fetch(") === -1);
});

test("1. no sources → no_recovery_signal", function () {
  const world = loadWorld();
  const out = advise(world, {}).result;
  assert.strictEqual(out.state, "no_recovery_signal");
  assert.strictEqual(out.mutates_workout, false);
});

test("2. manual soreness 5 → recovery_focus", function () {
  const world = loadWorld();
  const out = advise(world, { manualRecovery: manualRecord({ soreness: 5, energy: 3 }) }).result;
  assert.strictEqual(out.state, "recovery_focus");
  assert.ok(out.reasons.indexOf("manual_soreness_severe") !== -1);
  assert.strictEqual(out.guidance.detail, "High soreness reported");
});

test("3. manual soreness 4 → reduce_intensity", function () {
  const world = loadWorld();
  const out = advise(world, { manualRecovery: manualRecord({ soreness: 4, energy: 3 }) }).result;
  assert.strictEqual(out.state, "reduce_intensity");
});

test("4. manual energy <= 2 influences caution", function () {
  const world = loadWorld();
  const out = advise(world, { manualRecovery: manualRecord({ energy: 2, soreness: 1 }) }).result;
  assert.strictEqual(out.state, "proceed_with_caution");
  assert.ok(out.reasons.indexOf("manual_energy_low") !== -1);
});

test("5. wearable >= 70 supports proceed", function () {
  const world = loadWorld();
  const out = advise(world, {
    wearableRecovery: wearableResult({ score: 82, status: "ready" }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "proceed");
});

test("6. wearable 45–69 does not overclaim readiness", function () {
  const world = loadWorld();
  const out = advise(world, {
    wearableRecovery: wearableResult({ score: 60, status: "ready" }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "proceed_with_caution");
  assert.notStrictEqual(out.state, "proceed");
});

test("7. wearable < 45 produces reduction", function () {
  const world = loadWorld();
  const out = advise(world, {
    wearableRecovery: wearableResult({ score: 35, status: "ready" }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "reduce_intensity");
});

test("8. manual severe soreness overrides wearable high", function () {
  const world = loadWorld();
  const wear = wearableResult({ score: 85, status: "ready" });
  const out = advise(world, {
    manualRecovery: manualRecord({ sleep: 4, energy: 2, soreness: 5 }),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "recovery_focus");
  assert.strictEqual(out.source_summary.wearable.score, 85);
  assert.strictEqual(out.source_summary.checkin.label, "Review");
  assert.strictEqual(out.source_summary.integrated_score, null);
});

test("9. wearable low is not erased by manual high", function () {
  const world = loadWorld();
  const out = advise(world, {
    manualRecovery: manualRecord({ energy: 5, soreness: 1, sleep: 8 }),
    wearableRecovery: wearableResult({ score: 35, status: "ready" }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "reduce_intensity");
  assert.ok(out.reasons.indexOf("wearable_low") !== -1);
});

test("10. wearable unresolved never becomes numeric readiness", function () {
  const world = loadWorld();
  const wear = wearableResult({ status: "unresolved_evidence", score: null, unresolved: ["hrv"] });
  wear.components.hrv = { status: "unresolved", raw: 20, baseline: 50, contribution: null, weight: 1 };
  const out = advise(world, {
    manualRecovery: manualRecord({ energy: 5, soreness: 1 }),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "manual_review_required");
  assert.strictEqual(out.source_summary.wearable.has_score, false);
  assert.strictEqual(out.source_summary.wearable.score, null);
  const signals = fromVm(world.guard.describeSignals(integrated(world, {
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  })));
  const hrv = signals.filter(function (s) { return s.name === "HRV"; })[0];
  assert.ok(hrv);
  assert.strictEqual(hrv.value, null);
  assert.strictEqual(hrv.selected, false);
});

test("11. wearable insufficient falls back to manual", function () {
  const world = loadWorld();
  const wear = wearableResult({ status: "insufficient_data", score: null });
  const withManual = advise(world, {
    manualRecovery: manualRecord({ energy: 5, soreness: 1 }),
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(withManual.state, "proceed");
  const none = advise(world, {
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(none.state, "no_recovery_signal");
});

test("12. wearable partial marked as partial coverage", function () {
  const world = loadWorld();
  const wear = wearableResult({ status: "partial", score: 82, missing: ["sleep"] });
  const out = advise(world, {
    wearableRecovery: wear,
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(out.state, "proceed_with_caution");
  assert.strictEqual(out.coverage, "partial");
  assert.ok(out.reasons.indexOf("wearable_partial_coverage") !== -1);
  assert.strictEqual(out.source_summary.wearable.status_note, "Partial data");
  assert.strictEqual(out.source_summary.wearable.has_score, true);
});

test("13. date mismatch excludes wearable from same-day training decision", function () {
  const world = loadWorld();
  const out = advise(world, {
    manualRecovery: manualRecord({ energy: 5, soreness: 1 }),
    wearableRecovery: wearableResult({ score: 35, status: "ready" }),
    wearableLocalDate: "2026-09-13"
  }).result;
  assert.notStrictEqual(out.state, "reduce_intensity");
  assert.strictEqual(out.state, "proceed");
  assert.ok(out.reasons.indexOf("date_mismatch_excludes_wearable") !== -1);
  assert.strictEqual(out.source_summary.wearable.has_score, false);
});

test("14-15. manual-only and wearable-only work", function () {
  const world = loadWorld();
  const man = advise(world, { manualRecovery: manualRecord({ energy: 4, soreness: 1 }) }).result;
  assert.strictEqual(man.state, "proceed");
  const wear = advise(world, {
    wearableRecovery: wearableResult({ score: 80 }),
    wearableLocalDate: "2026-09-14"
  }).result;
  assert.strictEqual(wear.state, "proceed");
});

test("16-19. R2 not mutated; identity deterministic and versioned", function () {
  const world = loadWorld();
  const extra = {
    manualRecovery: manualRecord(),
    wearableRecovery: wearableResult({ score: 80, result_id: "rec:keep" }),
    wearableLocalDate: "2026-09-14"
  };
  const r2 = integrated(world, extra);
  const before = JSON.stringify(r2);
  const a = fromVm(world.guard.advise({ integratedRecovery: r2, computed_at_utc: "2026-09-14T08:00:00Z" })).result;
  const b = fromVm(world.guard.advise({ integratedRecovery: r2, computed_at_utc: "2026-09-14T21:00:00Z" })).result;
  assert.strictEqual(JSON.stringify(r2), before);
  assert.strictEqual(a.guidance_id, b.guidance_id);
  assert.strictEqual(a.policy_id, "nxtfrm.training.recovery_guard");
  assert.strictEqual(a.policy_version, "1");
  assert.notStrictEqual(a.computed_at_utc, b.computed_at_utc);
});

test("20-24. no raw wearable access, snapshot selection, provider, storage, or workout mutation", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  advise(world, {
    wearableRecovery: wearableResult(),
    wearableLocalDate: "2026-09-14",
    windows: [{ day_window_id: "aaa" }],
    history: [{ snapshot_id: "snap:other" }]
  });
  const st = fromVm(world.guard.status());
  assert.strictEqual(st.reads_raw_wearable, false);
  assert.strictEqual(st.selects_snapshot, false);
  assert.strictEqual(st.mutates_workout, false);
  assert.strictEqual(st.persists, false);
  assert.strictEqual(st.network, false);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
});

test("UI copy: missing metrics stay non-numeric; no blended score", function () {
  const world = loadWorld();
  const none = fromVm(world.guard.presentWearable(integrated(world, {})));
  assert.strictEqual(none.has_score, false);
  assert.strictEqual(none.headline, null);
  assert.notStrictEqual(none.headline, "0");
  const check = fromVm(world.guard.presentCheckin(integrated(world, {})));
  assert.strictEqual(check.label, "Not logged");
  assert.ok(check.detail.indexOf("Energy 0") === -1);
  const unresolved = fromVm(world.guard.presentWearable(integrated(world, {
    wearableRecovery: wearableResult({ status: "unresolved_evidence", score: null }),
    wearableLocalDate: "2026-09-14"
  })));
  assert.strictEqual(unresolved.caption, "Wearable data needs review");
  const low = fromVm(world.guard.presentWearable(integrated(world, {
    wearableRecovery: wearableResult({ status: "insufficient_data", score: null }),
    wearableLocalDate: "2026-09-14"
  })));
  assert.strictEqual(low.caption, "Not enough wearable history");
  const ui = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
  assert.ok(ui.indexOf("nxp-home-recovery") !== -1);
  assert.ok(ui.indexOf("Update check-in") !== -1);
  assert.ok(ui.indexOf("apx96OpenReadiness()") !== -1);
  assert.ok(ui.indexOf("integrated_score") === -1 || ui.indexOf("average") === -1);
});

test("signals: usable values and unresolved never shown as selected", function () {
  const world = loadWorld();
  const r2 = integrated(world, {
    wearableRecovery: wearableResult(),
    wearableLocalDate: "2026-09-14"
  });
  const signals = fromVm(world.guard.describeSignals(r2));
  const hrv = signals.filter(function (s) { return s.name === "HRV"; })[0];
  const rhr = signals.filter(function (s) { return s.name === "Resting HR"; })[0];
  const sleep = signals.filter(function (s) { return s.name === "Sleep"; })[0];
  assert.strictEqual(hrv.value, "62 ms");
  assert.ok(hrv.trend.indexOf("% vs baseline") !== -1);
  assert.strictEqual(rhr.value, "54 bpm");
  assert.ok(rhr.trend.indexOf("below baseline") !== -1);
  assert.ok(sleep.value.indexOf("h") !== -1);
  assert.notStrictEqual(hrv.value, "0");
});

test("G3A tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  18 passed") !== -1);
});

test("G3B tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("G3C tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("G3D tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.canonical.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  24 passed") !== -1);
});

test("G4A tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.days.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  16 passed") !== -1);
});

test("G4B tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.snapshots.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  26 passed") !== -1);
});

test("G4C tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.resolution.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  19 passed") !== -1);
});

test("R1 tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.recovery.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  28 passed") !== -1);
});

test("R2 tests still pass", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.recovery-integration.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
