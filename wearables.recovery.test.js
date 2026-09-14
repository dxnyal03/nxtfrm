/* NXTFRM R1 recovery-consumer tests. Run: node wearables.recovery.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let passed = 0;
let failed = 0;
const HEX64 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

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
    apm_settings: "{}",
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
    "wearables.resolution.js", "wearables.recovery.js"
  ].forEach(function (file) {
    if (file === "wearables.fixtures.js" && options.loadFixtures === false) return;
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });
  const days = ctx.NXTFRMWearableDays.createDays();
  const canonical = ctx.NXTFRMWearableCanonical.createCanonical();
  const snapshots = ctx.NXTFRMWearableSnapshots.createSnapshots({ days: days, canonical: canonical });
  const resolution = ctx.NXTFRMWearableResolution.createResolution({ snapshots: snapshots, days: days, canonical: canonical });
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    snapshots: snapshots,
    resolution: resolution,
    days: days,
    canonical: canonical,
    recovery: ctx.NXTFRMWearableRecovery.createRecovery({ snapshots: snapshots, days: days })
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

function cand(opts) {
  const at = opts.at || "2026-09-14T01:00:00Z";
  return {
    candidate_id: opts.candidate_id || ("cand:" + opts.revision_id),
    availability: opts.availability || "present",
    reason: Object.prototype.hasOwnProperty.call(opts, "reason") ? opts.reason : null,
    value: Object.prototype.hasOwnProperty.call(opts, "value") ? opts.value : 50,
    semantics: opts.semantics || {
      metric_kind: opts.kind || "hrv",
      unit: opts.unit || "ms",
      hrv_metric: opts.kind === "hrv" || !opts.kind ? "rmssd" : undefined,
      aggregation: "nightly",
      interval_start_utc: at,
      interval_end_utc: at
    },
    measurement_quality: "unknown",
    provenance: {
      source: opts.source || { kind: "fixture_dataset", source_id: "src_a", provider: "vendor.a", fixture_dataset_id: "fix_a" },
      raw: {
        raw_id: "raw_" + opts.revision_id,
        payload_sha256: HEX64,
        ingested_at_utc: "2026-09-14T08:05:00Z",
        adapter_id: "adp",
        adapter_version: "1"
      },
      accepted_delivery_id: "del",
      observed_at_utc: at,
      recorded_at_utc: at,
      ingested_at_utc: "2026-09-14T08:05:00Z",
      identities: {
        canonical_observation_id: opts.lineage || opts.revision_id,
        provider_record_id: opts.lineage || opts.revision_id,
        revision_id: opts.revision_id,
        content_hash: HEX64,
        supersedes_revision_id: opts.parent || null
      }
    }
  };
}

function resolvedField(kind, value, extra) {
  extra = extra || {};
  const semantics = extra.semantics || (
    kind === "hrv" ? { metric_kind: "hrv", unit: "ms", hrv_metric: "rmssd", aggregation: "nightly", interval_start_utc: "2026-09-13T16:00:00Z", interval_end_utc: "2026-09-13T23:00:00Z" }
      : kind === "resting_hr" ? { metric_kind: "resting_hr", unit: "bpm", aggregation: "instant", interval_start_utc: "2026-09-14T01:00:00Z", interval_end_utc: "2026-09-14T01:00:00Z" }
        : kind === "sleep_duration" ? { metric_kind: "sleep_duration", unit: "s", aggregation: "nightly", interval_start_utc: "2026-09-13T16:00:00Z", interval_end_utc: "2026-09-13T23:00:00Z" }
          : extra.semantics
  );
  const c = cand({
    revision_id: extra.revision_id || (kind + "_r1"),
    lineage: extra.lineage || (kind + "_l1"),
    value: value,
    kind: kind,
    semantics: semantics,
    source: extra.source,
    availability: extra.availability
  });
  return {
    candidates: [c],
    primary_candidate_id: extra.availability && extra.availability !== "present" ? null : c.candidate_id,
    selection: {
      rule: extra.rule || "unique_unsuperseded_leaf",
      policy_id: null,
      policy_version: null
    }
  };
}

function conflictField(kind, a, b) {
  const left = cand({ revision_id: kind + "_a", lineage: kind + "_la", value: a, kind: kind, source: { kind: "fixture_dataset", source_id: "src_a", provider: "vendor.a", fixture_dataset_id: "fix_a" } });
  const right = cand({ revision_id: kind + "_b", lineage: kind + "_lb", value: b, kind: kind, source: { kind: "api_connection", source_id: "src_b", provider: "vendor.b", connection_id: "conn_b" } });
  if (kind === "hrv") {
    left.semantics = { metric_kind: "hrv", unit: "ms", hrv_metric: "rmssd", aggregation: "nightly", interval_start_utc: "2026-09-13T16:00:00Z", interval_end_utc: "2026-09-13T23:00:00Z" };
    right.semantics = left.semantics;
  }
  return {
    candidates: [left, right],
    primary_candidate_id: null,
    selection: { rule: "none_cross_source_conflict", policy_id: null, policy_version: null }
  };
}

function makeWindow(id, localDate, startUtc, tz, userId) {
  return {
    day_window_id: id,
    user_id: userId || "u_r1",
    local_date: localDate,
    representative_timezone: tz || "Asia/Singapore",
    assignment_source: "profile",
    start_utc: startUtc,
    end_utc: "2026-09-14T16:00:00Z"
  };
}

function dwPointer(localDate, dayWindowId, userId) {
  return {
    document_type: "current_day_window_pointer",
    schema_version: "g1.2.1",
    user_id: userId || "u_r1",
    local_date: localDate,
    day_window_id: dayWindowId,
    advanced_at_utc: "2026-09-14T00:00:00Z"
  };
}

function snapPointer(dayWindowId, snapshotId, version, userId) {
  return {
    document_type: "current_snapshot_pointer",
    schema_version: "g1.2.1",
    user_id: userId || "u_r1",
    day_window_id: dayWindowId,
    snapshot_id: snapshotId,
    snapshot_version: version == null ? 1 : version,
    advanced_at_utc: "2026-09-14T00:00:00Z"
  };
}

function makeSnap(opts) {
  opts = opts || {};
  const snap = {
    document_type: "wearable_daily_snapshot",
    schema_version: "g1.2.1",
    snapshot_id: opts.snapshot_id || "snap:current",
    snapshot_version: opts.snapshot_version || 1,
    user_id: "u_r1",
    day_window_id: opts.day_window_id || "dw_cur",
    built_at_utc: opts.built_at_utc || "2026-09-14T18:00:00Z",
    quality_flags: opts.quality_flags || [],
    hrv: opts.hrv || emptyField(),
    resting_hr_bpm: opts.rhr || emptyField(),
    sleep_duration_s: opts.sleep || emptyField(),
    sleep_score: emptyField(),
    stress: emptyField(),
    energy_reserve: opts.energy || emptyField()
  };
  if (opts.sleep_score) snap.sleep_score = opts.sleep_score;
  return snap;
}

function sgStart(localDate) {
  const [y, m, d] = localDate.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  return prev.getUTCFullYear() + "-" + pm + "-" + pd + "T16:00:00Z";
}

function historyDays(n, values, opts) {
  opts = opts || {};
  const currentDate = opts.currentDate || "2026-09-14";
  const currentDw = opts.currentDw || "dw_cur";
  const startDay = opts.startDay || 7;
  const history = [];
  const windows = [];
  const dayWindowPointers = [];
  const snapshotPointers = [];
  let i;
  for (i = 0; i < n; i++) {
    const day = startDay + i;
    const localDate = "2026-09-" + String(day).padStart(2, "0");
    const dw = "dw_h" + String(day).padStart(2, "0");
    const hrv = values && values.hrv ? values.hrv[i] : 50;
    const rhr = values && values.rhr ? values.rhr[i] : 60;
    const sleep = values && values.sleep ? values.sleep[i] : 28800;
    const snapId = "snap:h" + localDate;
    windows.push(makeWindow(dw, localDate, sgStart(localDate)));
    history.push(makeSnap({
      snapshot_id: snapId,
      day_window_id: dw,
      hrv: resolvedField("hrv", hrv, { revision_id: "h_hrv_" + day }),
      rhr: resolvedField("resting_hr", rhr, { revision_id: "h_rhr_" + day }),
      sleep: resolvedField("sleep_duration", sleep, { revision_id: "h_slp_" + day })
    }));
    dayWindowPointers.push(dwPointer(localDate, dw));
    snapshotPointers.push(snapPointer(dw, snapId, 1));
  }
  windows.push(makeWindow(currentDw, currentDate, sgStart(currentDate)));
  return {
    history: history,
    windows: windows,
    dayWindowPointers: dayWindowPointers,
    snapshotPointers: snapshotPointers
  };
}

function readySnap(extra) {
  extra = extra || {};
  return makeSnap({
    snapshot_id: extra.snapshot_id || "snap:current",
    snapshot_version: extra.snapshot_version || 1,
    day_window_id: extra.day_window_id || "dw_cur",
    hrv: resolvedField("hrv", extra.hrv == null ? 50 : extra.hrv),
    rhr: resolvedField("resting_hr", extra.rhr == null ? 60 : extra.rhr),
    sleep: resolvedField("sleep_duration", extra.sleep == null ? 28800 : extra.sleep),
    quality_flags: extra.quality_flags || []
  });
}

function evaluate(world, snap, extra) {
  return fromVm(world.recovery.evaluate(Object.assign({ snapshot: snap }, extra || {})));
}

test("syntax: G3A–R1 scripts parse", function () {
  [
    "wearables.js", "wearables.snapshots.js", "wearables.resolution.js", "wearables.recovery.js",
    "wearables.recovery.test.js", "sw.js"
  ].forEach(syntaxCheck);
});

test("1-2. Valid resolved snapshot accepted; malformed snapshot rejected", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const snap = makeSnap({
    hrv: resolvedField("hrv", 55),
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const out = evaluate(world, snap, hist);
  assert.strictEqual(out.outcome, "evaluated");
  assert.strictEqual(out.result.status, "ready");
  assert.ok(Number.isFinite(out.result.score));
  const bad = evaluate(world, { document_type: "nope" });
  assert.strictEqual(bad.outcome, "invalid_snapshot");
  assert.strictEqual(bad.result.status, "invalid_snapshot");
  assert.strictEqual(bad.result.score, null);
});

test("3-8. Unresolved/missing/unsupported inputs are distinct and never chosen or zero-filled", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const conflicted = makeSnap({
    hrv: conflictField("hrv", 20, 80),
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const cOut = evaluate(world, conflicted, hist).result;
  assert.strictEqual(cOut.inputs.hrv.usable, false);
  assert.strictEqual(cOut.inputs.hrv.reason, "unresolved");
  assert.strictEqual(cOut.inputs.hrv.value, null);
  assert.strictEqual(cOut.components.hrv.raw, null);
  assert.strictEqual(cOut.components.hrv.contribution, null);
  assert.ok(cOut.unresolved.indexOf("hrv") !== -1);
  assert.ok(cOut.inputs.hrv.candidates.length === 2);
  assert.strictEqual(cOut.hrv, undefined);

  const missing = makeSnap({
    hrv: resolvedField("hrv", 55),
    rhr: resolvedField("resting_hr", 58)
  });
  const mOut = evaluate(world, missing, hist).result;
  assert.strictEqual(mOut.inputs.sleep.reason, "missing");
  assert.strictEqual(mOut.inputs.sleep.value, null);
  assert.notStrictEqual(mOut.inputs.sleep.value, 0);
  assert.strictEqual(mOut.components.sleep.raw, null);
  assert.ok(mOut.missing.indexOf("sleep") !== -1);

  const emptyHrv = makeSnap({
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const hOut = evaluate(world, emptyHrv, hist).result;
  assert.strictEqual(hOut.inputs.hrv.reason, "missing");
  assert.strictEqual(hOut.inputs.hrv.value, null);

  const emptyRhr = makeSnap({
    hrv: resolvedField("hrv", 55),
    sleep: resolvedField("sleep_duration", 28800)
  });
  assert.strictEqual(evaluate(world, emptyRhr, hist).result.inputs.resting_hr.value, null);

  const unsupported = emptyField();
  unsupported.candidates = [cand({
    revision_id: "u1", lineage: "lu", value: null, availability: "unsupported", kind: "hrv",
    semantics: { metric_kind: "hrv", unit: "ms", hrv_metric: "rmssd", aggregation: "nightly", interval_start_utc: "2026-09-13T16:00:00Z", interval_end_utc: "2026-09-13T23:00:00Z" }
  })];
  unsupported.selection.rule = "none_all_non_present";
  const uSnap = makeSnap({
    hrv: unsupported,
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const uOut = evaluate(world, uSnap, hist).result;
  assert.strictEqual(uOut.inputs.hrv.reason, "unsupported");
  assert.notStrictEqual(uOut.inputs.hrv.reason, "missing");
});

test("9-10. Proprietary scores require exact supported semantic identity", function () {
  const world = loadWorld();
  const policy = fromVm(world.recovery.describePolicy());
  assert.deepStrictEqual(policy.supported_score_ids, []);
  const semA = { score_id: "vendorA:energy_score.v1", score_range: { min: 0, max: 100 }, direction: "higher_better" };
  const semB = { score_id: "vendorB:energy_score.v1", score_range: { min: 0, max: 100 }, direction: "higher_better" };
  assert.strictEqual(world.recovery.semanticSupported(semA), false);
  assert.strictEqual(world.recovery.semanticSupported(semB), false);
  const energy = resolvedField("proprietary_score", 91, {
    revision_id: "e1",
    semantics: Object.assign({ metric_kind: "proprietary_score", aggregation: "daily", interval_start_utc: "2026-09-13T16:00:00Z", interval_end_utc: "2026-09-14T16:00:00Z" }, semA)
  });
  const hist = historyDays(7);
  const snap = makeSnap({
    hrv: resolvedField("hrv", 55),
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800),
    energy: energy
  });
  const out = evaluate(world, snap, hist).result;
  assert.ok(out.explanation.indexOf("energy_reserve_unsupported_semantic") !== -1);
  assert.ok(!out.components.energy_reserve);
});

test("11-14. Quality flags propagate without invented numeric penalties", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const base = makeSnap({
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800),
    quality_flags: ["conflict", "partial_day", "timezone_change", "corrected"]
  });
  const plain = makeSnap({
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const flagged = evaluate(world, base, hist).result;
  const clean = evaluate(world, plain, hist).result;
  assert.ok(flagged.quality_flags.indexOf("conflict") !== -1);
  assert.ok(flagged.quality_flags.indexOf("timezone_change") !== -1);
  assert.ok(flagged.quality_flags.indexOf("partial_day") !== -1);
  assert.ok(flagged.explanation.indexOf("snapshot_conflict") !== -1);
  assert.ok(flagged.explanation.indexOf("snapshot_timezone_change") !== -1);
  assert.strictEqual(flagged.score, clean.score);
  assert.strictEqual(flagged.status, "ready");
});

test("15-21. Baseline uses prior resolved leaves, min samples, no duplicates or alt-lineage double-count", function () {
  const world = loadWorld();
  const hist = historyDays(7, { hrv: [50, 50, 50, 50, 50, 50, 50] });
  const current = readySnap();
  const contaminated = hist.history.concat([
    makeSnap({
      snapshot_id: "snap:current",
      hrv: resolvedField("hrv", 999, { revision_id: "cur_dup" }),
      rhr: resolvedField("resting_hr", 60),
      sleep: resolvedField("sleep_duration", 28800)
    }),
    makeSnap({
      snapshot_id: "snap:h2026-09-13v1",
      snapshot_version: 1,
      day_window_id: "dw_h13",
      hrv: resolvedField("hrv", 10, { revision_id: "oldv" }),
      rhr: resolvedField("resting_hr", 60),
      sleep: resolvedField("sleep_duration", 28800)
    }),
    makeSnap({
      snapshot_id: "snap:h2026-09-13",
      snapshot_version: 2,
      day_window_id: "dw_h13",
      hrv: resolvedField("hrv", 50, { revision_id: "newv" }),
      rhr: resolvedField("resting_hr", 60),
      sleep: resolvedField("sleep_duration", 28800)
    })
  ]);
  const unresolvedHist = makeSnap({
    snapshot_id: "snap:badhrv",
    day_window_id: "dw_h07",
    hrv: conflictField("hrv", 1, 2),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const mixedHistory = contaminated.map(function (s) {
    return s.day_window_id === "dw_h07" ? unresolvedHist : s;
  });
  const sto = makeWindow("dw_zz_sto", "2026-09-12", "2026-09-11T22:00:00Z", "Europe/Stockholm");
  const stoSnap = makeSnap({
    snapshot_id: "snap:sto12",
    day_window_id: "dw_zz_sto",
    hrv: resolvedField("hrv", 500, { revision_id: "sto" }),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const windows = hist.windows.concat([sto]);
  const snapshotPointers = hist.snapshotPointers.map(function (p) {
    if (p.day_window_id === "dw_h13") return snapPointer("dw_h13", "snap:h2026-09-13", 2);
    if (p.day_window_id === "dw_h07") return snapPointer("dw_h07", "snap:badhrv", 1);
    return p;
  });
  const extra = {
    history: mixedHistory.concat([stoSnap]),
    windows: windows,
    dayWindowPointers: hist.dayWindowPointers.concat([dwPointer("2026-09-12", "dw_h12")]),
    snapshotPointers: snapshotPointers
  };
  const out = evaluate(world, current, extra).result;
  assert.strictEqual(out.components.hrv.baseline, 50);
  const base = fromVm(world.recovery.buildBaseline("hrv", current, extra.history, extra.windows, extra));
  assert.ok(base.count >= 5);
  assert.ok(base.snapshot_ids.indexOf("snap:current") === -1);
  assert.ok(base.snapshot_ids.indexOf("snap:sto12") === -1);
  assert.ok(base.values.every(function (v) { return v !== 999 && v !== 500 && v !== 10; }));
  assert.ok(out.explanation.indexOf("ambiguous_day_window_lineage") === -1);

  const short = historyDays(3);
  const few = evaluate(world, current, short).result;
  assert.strictEqual(few.components.hrv.status, "insufficient_baseline");
  assert.strictEqual(few.score, null);

  const shuffled = extra.history.slice().reverse();
  const again = evaluate(world, current, {
    history: shuffled,
    windows: extra.windows.slice().reverse(),
    dayWindowPointers: extra.dayWindowPointers.slice().reverse(),
    snapshotPointers: extra.snapshotPointers.slice().reverse()
  }).result;
  assert.strictEqual(again.components.hrv.baseline, out.components.hrv.baseline);
  assert.strictEqual(again.result_id, out.result_id);
});

test("22-28. Component and aggregate scores are bounded, finite, and deterministic", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const snap = makeSnap({
    hrv: resolvedField("hrv", 55),
    rhr: resolvedField("resting_hr", 54),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const out = evaluate(world, snap, hist).result;
  ["hrv", "resting_hr", "sleep"].forEach(function (name) {
    assert.ok(out.components[name].contribution >= 0 && out.components[name].contribution <= 100);
    assert.ok(Number.isFinite(out.components[name].contribution));
  });
  assert.ok(out.score >= 0 && out.score <= 100);
  assert.ok(Number.isFinite(out.score));
  assert.ok(!Number.isNaN(out.score));
  const hrvRel = (55 - 50) / 50;
  assert.strictEqual(out.components.hrv.normalized, hrvRel);
  const rhrRel = (60 - 54) / 60;
  assert.strictEqual(out.components.resting_hr.normalized, rhrRel);
  assert.strictEqual(out.components.sleep.contribution, 100);
});

test("29-32. Missing is omitted not zeroed; partial/insufficient/unresolved statuses stay distinct", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const two = makeSnap({
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60)
  });
  const partial = evaluate(world, two, hist).result;
  assert.strictEqual(partial.status, "partial");
  assert.ok(Number.isFinite(partial.score));
  assert.strictEqual(partial.components.sleep.contribution, null);
  assert.strictEqual(partial.score, 50);

  const none = evaluate(world, makeSnap({}), hist).result;
  assert.strictEqual(none.status, "insufficient_data");
  assert.strictEqual(none.score, null);

  const conflictOnly = makeSnap({
    hrv: conflictField("hrv", 20, 80)
  });
  const unresolved = evaluate(world, conflictOnly, hist).result;
  assert.strictEqual(unresolved.status, "unresolved_evidence");
  assert.strictEqual(unresolved.score, null);
  assert.notStrictEqual(unresolved.status, none.status);

  const ready = evaluate(world, makeSnap({
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  }), hist).result;
  assert.strictEqual(ready.status, "ready");
});

test("33-42. Replay, identity, wall-clock independence, and snapshot binding", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const snap = makeSnap({
    snapshot_id: "snap:bind",
    snapshot_version: 2,
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const a = evaluate(world, snap, Object.assign({ computed_at_utc: "2026-09-14T09:00:00Z" }, hist)).result;
  const b = evaluate(world, snap, Object.assign({ computed_at_utc: "2026-09-14T14:00:00Z" }, hist)).result;
  const c = evaluate(world, snap, Object.assign({ computed_at_utc: "2026-09-14T23:00:00Z" }, hist)).result;
  assert.strictEqual(a.score, b.score);
  assert.strictEqual(a.result_id, b.result_id);
  assert.strictEqual(a.result_id, c.result_id);
  assert.strictEqual(a.status, c.status);
  assert.notStrictEqual(a.computed_at_utc, c.computed_at_utc);
  assert.strictEqual(a.snapshot_id, "snap:bind");
  assert.strictEqual(a.snapshot_version, 2);
  assert.strictEqual(a.policy_id, "nxtfrm.recovery.personal_baseline");
  assert.strictEqual(a.policy_version, "1");

  const v3 = makeSnap({
    snapshot_id: "snap:bind3",
    snapshot_version: 3,
    hrv: resolvedField("hrv", 60),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  });
  const later = evaluate(world, v3, hist).result;
  assert.notStrictEqual(later.result_id, a.result_id);
  assert.notStrictEqual(later.score, a.score);
  const oldAgain = evaluate(world, snap, hist).result;
  assert.strictEqual(oldAgain.result_id, a.result_id);
});

test("43-48. R1 does not mutate snapshot, history, pointers, or create records", function () {
  const world = loadWorld();
  const window = fromVm(world.days.createWindow({
    user_id: "u_r1",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "profile"
  }));
  world.days.setCurrent("u_r1", "2026-09-14", window.day_window_id, "2026-09-14T00:00:00Z");
  const assembled = fromVm(world.snapshots.assemble({
    user_id: "u_r1",
    day_window_id: window.day_window_id,
    built_at_utc: "2026-09-14T18:00:00Z"
  }));
  const beforeSnap = JSON.stringify(fromVm(world.snapshots.getSnapshot(assembled.snapshot_id)));
  const beforePtr = JSON.stringify(fromVm(world.snapshots.getCurrentPointer("u_r1", window.day_window_id)));
  const hist = historyDays(7);
  hist.windows[hist.windows.length - 1].day_window_id = window.day_window_id;
  const historyJson = JSON.stringify(hist.history);
  const snap = fromVm(assembled.snapshot);
  snap.hrv = resolvedField("hrv", 50);
  snap.resting_hr_bpm = resolvedField("resting_hr", 60);
  snap.sleep_duration_s = resolvedField("sleep_duration", 28800);
  const beforeEval = JSON.stringify(snap);
  evaluate(world, snap, { history: hist.history, windows: hist.windows });
  assert.strictEqual(JSON.stringify(snap), beforeEval);
  assert.strictEqual(JSON.stringify(hist.history), historyJson);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(assembled.snapshot_id))), beforeSnap);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getCurrentPointer("u_r1", window.day_window_id))), beforePtr);
  assert.strictEqual(world.snapshots.listSnapshots("u_r1", window.day_window_id).length, 1);
  assert.strictEqual(world.canonical.status().observation_revisions, 0);
  assert.strictEqual(world.days.status().day_windows, 1);
  fromVm(world.recovery.evaluateCurrent("u_r1", window.day_window_id, hist));
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getCurrentPointer("u_r1", window.day_window_id))), beforePtr);
});

test("49-55. Zero I/O and no nxtfrm_recovery_snapshot writes", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  const hist = historyDays(7);
  const snap = makeSnap({
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60),
    sleep: resolvedField("sleep_duration", 28800)
  });
  evaluate(world, snap, hist);
  const st = world.recovery.status();
  assert.strictEqual(st.persists, false);
  assert.strictEqual(st.network, false);
  assert.strictEqual(st.writes_app_recovery, false);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
  assert.ok(world.storage.store.nxtfrm_recovery_snapshot);
});

function travelPack() {
  const hist = historyDays(4, {
    hrv: [10, 20, 30, 40],
    rhr: [70, 71, 72, 73],
    sleep: [20000, 21000, 22000, 23000]
  }, { currentDate: "2026-09-15", currentDw: "dw_cur" });
  const sg = makeWindow("aaa-singapore", "2026-09-14", "2026-09-13T16:00:00Z", "Asia/Singapore");
  const sto = makeWindow("zzz-stockholm", "2026-09-14", "2026-09-13T22:00:00Z", "Europe/Stockholm");
  const sgSnap = makeSnap({
    snapshot_id: "snap:sg14",
    day_window_id: "aaa-singapore",
    hrv: resolvedField("hrv", 12, { revision_id: "sg_hrv" }),
    rhr: resolvedField("resting_hr", 90, { revision_id: "sg_rhr" }),
    sleep: resolvedField("sleep_duration", 10000, { revision_id: "sg_slp" })
  });
  const stoSnap = makeSnap({
    snapshot_id: "snap:sto14",
    day_window_id: "zzz-stockholm",
    hrv: resolvedField("hrv", 88, { revision_id: "sto_hrv" }),
    rhr: resolvedField("resting_hr", 50, { revision_id: "sto_rhr" }),
    sleep: resolvedField("sleep_duration", 40000, { revision_id: "sto_slp" })
  });
  const current = readySnap({ day_window_id: "dw_cur", hrv: 50, rhr: 60, sleep: 28800 });
  return {
    hist: hist,
    current: current,
    sg: sg,
    sto: sto,
    sgSnap: sgSnap,
    stoSnap: stoSnap,
    windows: hist.windows.concat([sg, sto]),
    history: hist.history.concat([sgSnap, stoSnap])
  };
}

function travelInput(pack, pointerDw, extraPointers) {
  extraPointers = extraPointers || [];
  const dayWindowPointers = pointerDw
    ? pack.hist.dayWindowPointers.concat([dwPointer("2026-09-14", pointerDw)]).concat(extraPointers)
    : pack.hist.dayWindowPointers.concat(extraPointers);
  const snapshotPointers = pack.hist.snapshotPointers.concat([
    snapPointer("aaa-singapore", "snap:sg14", 1),
    snapPointer("zzz-stockholm", "snap:sto14", 1)
  ]);
  return {
    history: pack.history,
    windows: pack.windows,
    dayWindowPointers: dayWindowPointers,
    snapshotPointers: snapshotPointers
  };
}

test("R1-R1 1-4. Explicit CurrentDayWindowPointer selects one historical lineage; lexical IDs are ignored", function () {
  const world = loadWorld();
  const pack = travelPack();
  const stoOut = evaluate(world, pack.current, travelInput(pack, "zzz-stockholm")).result;
  assert.strictEqual(stoOut.components.hrv.baseline, 30);
  assert.strictEqual(stoOut.components.resting_hr.baseline, 71);
  assert.strictEqual(stoOut.components.sleep.baseline, 22000);
  const stoBase = fromVm(world.recovery.buildBaseline("hrv", pack.current, pack.history, pack.windows, travelInput(pack, "zzz-stockholm")));
  assert.strictEqual(stoBase.count, 5);
  assert.ok(stoBase.snapshot_ids.indexOf("snap:sto14") !== -1);
  assert.ok(stoBase.snapshot_ids.indexOf("snap:sg14") === -1);
  assert.ok(stoBase.values.indexOf(88) !== -1);
  assert.ok(stoBase.values.indexOf(12) === -1);

  const sgOut = evaluate(world, pack.current, travelInput(pack, "aaa-singapore")).result;
  assert.strictEqual(sgOut.components.hrv.baseline, 20);
  assert.strictEqual(sgOut.components.resting_hr.baseline, 72);
  assert.strictEqual(sgOut.components.sleep.baseline, 21000);
  const sgBase = fromVm(world.recovery.buildBaseline("hrv", pack.current, pack.history, pack.windows, travelInput(pack, "aaa-singapore")));
  assert.ok(sgBase.snapshot_ids.indexOf("snap:sg14") !== -1);
  assert.ok(sgBase.snapshot_ids.indexOf("snap:sto14") === -1);
  assert.notStrictEqual(stoOut.result_id, sgOut.result_id);

  const dates = {};
  stoBase.snapshot_ids.forEach(function (id) {
    const snap = pack.history.filter(function (s) { return s.snapshot_id === id; })[0];
    const win = pack.windows.filter(function (w) { return w.day_window_id === snap.day_window_id; })[0];
    assert.ok(!dates[win.local_date], "one lineage per local_date");
    dates[win.local_date] = snap.day_window_id;
  });
});

test("R1-R1 5,10-14. Missing pointer with multiple lineages fails closed and does not contribute", function () {
  const world = loadWorld();
  const pack = travelPack();
  const extra = travelInput(pack, null);
  const out = evaluate(world, pack.current, extra).result;
  assert.ok(out.explanation.indexOf("ambiguous_day_window_lineage") !== -1);
  const reasons = (out.baseline_exclusions || []).map(function (e) { return e.reason; });
  assert.ok(reasons.indexOf("ambiguous_day_window_lineage") !== -1);
  assert.strictEqual(out.components.hrv.status, "insufficient_baseline");
  assert.strictEqual(out.components.resting_hr.status, "insufficient_baseline");
  assert.strictEqual(out.components.sleep.status, "insufficient_baseline");
  assert.strictEqual(out.score, null);
  assert.strictEqual(out.status, "insufficient_data");
  ["hrv", "resting_hr", "sleep"].forEach(function (name) {
    const base = fromVm(world.recovery.buildBaseline(name, pack.current, extra.history, extra.windows, extra));
    assert.strictEqual(base.count, 4);
    assert.ok(base.snapshot_ids.indexOf("snap:sg14") === -1);
    assert.ok(base.snapshot_ids.indexOf("snap:sto14") === -1);
    assert.ok(base.reasons.indexOf("ambiguous_day_window_lineage") !== -1);
  });
});

test("R1-R1 6-9. Invalid, wrong-user, wrong-date, and missing-window pointers fail closed", function () {
  const world = loadWorld();
  const pack = travelPack();
  function assertRejected(pointers, reason) {
    const extra = travelInput(pack, null, pointers);
    const out = evaluate(world, pack.current, extra).result;
    const reasons = (out.baseline_exclusions || []).map(function (e) { return e.reason; });
    assert.ok(reasons.indexOf(reason) !== -1, reasons.join(","));
    const base = fromVm(world.recovery.buildBaseline("hrv", pack.current, extra.history, extra.windows, extra));
    assert.ok(base.snapshot_ids.indexOf("snap:sg14") === -1);
    assert.ok(base.snapshot_ids.indexOf("snap:sto14") === -1);
    assert.strictEqual(out.components.hrv.status, "insufficient_baseline");
  }
  assertRejected([dwPointer("2026-09-14", "zzz-stockholm"), dwPointer("2026-09-14", "aaa-singapore")], "invalid_day_window_pointer");
  assertRejected([dwPointer("2026-09-14", "zzz-stockholm", "u_other")], "invalid_day_window_pointer");
  assertRejected([dwPointer("2026-09-13", "zzz-stockholm")], "invalid_day_window_pointer");
  assertRejected([dwPointer("2026-09-14", "dw_does_not_exist")], "invalid_day_window_pointer");
});

test("R1-R1 15. Current evaluation local_date contributes no historical sample from any timezone lineage", function () {
  const world = loadWorld();
  const hist = historyDays(5, { hrv: [50, 50, 50, 50, 50] });
  const alt = makeWindow("zzz-stockholm-today", "2026-09-14", "2026-09-13T22:00:00Z", "Europe/Stockholm");
  const altSnap = makeSnap({
    snapshot_id: "snap:sto-today",
    day_window_id: "zzz-stockholm-today",
    hrv: resolvedField("hrv", 777, { revision_id: "today_alt" }),
    rhr: resolvedField("resting_hr", 40, { revision_id: "today_alt_rhr" }),
    sleep: resolvedField("sleep_duration", 1000, { revision_id: "today_alt_slp" })
  });
  const extra = {
    history: hist.history.concat([altSnap]),
    windows: hist.windows.concat([alt]),
    dayWindowPointers: hist.dayWindowPointers.concat([dwPointer("2026-09-14", "zzz-stockholm-today")]),
    snapshotPointers: hist.snapshotPointers.concat([snapPointer("zzz-stockholm-today", "snap:sto-today", 1)])
  };
  const out = evaluate(world, readySnap(), extra).result;
  assert.strictEqual(out.components.hrv.baseline, 50);
  const base = fromVm(world.recovery.buildBaseline("hrv", readySnap(), extra.history, extra.windows, extra));
  assert.strictEqual(base.count, 5);
  assert.ok(base.snapshot_ids.indexOf("snap:sto-today") === -1);
  assert.ok(base.snapshot_ids.indexOf("snap:current") === -1);
  assert.ok(base.values.indexOf(777) === -1);
});

test("R1-R1 16. Historical canonical snapshot follows explicit snapshot pointer, not max(snapshot_version)", function () {
  const world = loadWorld();
  const hist = historyDays(4, { hrv: [10, 20, 30, 40] });
  const dw = "dw_ptr_snap";
  const win = makeWindow(dw, "2026-09-11", sgStart("2026-09-11"));
  const v1 = makeSnap({
    snapshot_id: "snap:ptr-v1",
    snapshot_version: 1,
    day_window_id: dw,
    hrv: resolvedField("hrv", 100, { revision_id: "ptr_v1" }),
    rhr: resolvedField("resting_hr", 60, { revision_id: "ptr_v1_rhr" }),
    sleep: resolvedField("sleep_duration", 28800, { revision_id: "ptr_v1_slp" })
  });
  const v2 = makeSnap({
    snapshot_id: "snap:ptr-v2",
    snapshot_version: 2,
    day_window_id: dw,
    hrv: resolvedField("hrv", 5, { revision_id: "ptr_v2" }),
    rhr: resolvedField("resting_hr", 60, { revision_id: "ptr_v2_rhr" }),
    sleep: resolvedField("sleep_duration", 28800, { revision_id: "ptr_v2_slp" })
  });
  const extra = {
    history: hist.history.concat([v1, v2]),
    windows: hist.windows.concat([win]),
    dayWindowPointers: hist.dayWindowPointers.concat([dwPointer("2026-09-11", dw)]),
    snapshotPointers: hist.snapshotPointers.concat([snapPointer(dw, "snap:ptr-v1", 1)])
  };
  const out = evaluate(world, readySnap(), extra).result;
  assert.strictEqual(out.components.hrv.baseline, 30);
  const base = fromVm(world.recovery.buildBaseline("hrv", readySnap(), extra.history, extra.windows, extra));
  assert.ok(base.snapshot_ids.indexOf("snap:ptr-v1") !== -1);
  assert.ok(base.snapshot_ids.indexOf("snap:ptr-v2") === -1);
  assert.ok(base.values.indexOf(100) !== -1);
  assert.ok(base.values.indexOf(5) === -1);

  const missingPtr = {
    history: extra.history,
    windows: extra.windows,
    dayWindowPointers: extra.dayWindowPointers,
    snapshotPointers: hist.snapshotPointers
  };
  const closed = evaluate(world, readySnap(), missingPtr).result;
  assert.strictEqual(closed.components.hrv.status, "insufficient_baseline");
  const closedBase = fromVm(world.recovery.buildBaseline("hrv", readySnap(), missingPtr.history, missingPtr.windows, missingPtr));
  assert.ok(closedBase.reasons.indexOf("ambiguous_snapshot") !== -1);
});

test("R1-R1 17. History, window, and pointer input ordering does not alter baseline", function () {
  const world = loadWorld();
  const pack = travelPack();
  const extra = travelInput(pack, "zzz-stockholm");
  const a = evaluate(world, pack.current, extra).result;
  const b = evaluate(world, pack.current, {
    history: extra.history.slice().reverse(),
    windows: extra.windows.slice().reverse(),
    dayWindowPointers: extra.dayWindowPointers.slice().reverse(),
    snapshotPointers: extra.snapshotPointers.slice().reverse()
  }).result;
  assert.strictEqual(a.components.hrv.baseline, b.components.hrv.baseline);
  assert.strictEqual(a.components.resting_hr.baseline, b.components.resting_hr.baseline);
  assert.strictEqual(a.components.sleep.baseline, b.components.sleep.baseline);
  assert.strictEqual(a.score, b.score);
  assert.strictEqual(a.status, b.status);
  assert.strictEqual(a.result_id, b.result_id);
});

test("R1-R1 18-22. Policy v1 formulas, weights, and minimum-evidence status are unchanged", function () {
  const world = loadWorld();
  const policy = fromVm(world.recovery.describePolicy());
  assert.strictEqual(policy.policy_id, "nxtfrm.recovery.personal_baseline");
  assert.strictEqual(policy.policy_version, "1");
  assert.deepStrictEqual(policy.weights, { hrv: 1, resting_hr: 1, sleep: 1 });
  assert.strictEqual(policy.baseline_days, 14);
  assert.strictEqual(policy.baseline_min_samples, 5);
  assert.strictEqual(policy.min_components, 2);
  assert.strictEqual(policy.formulas.hrv, "contribution = clamp(50 + 100 * (raw - baseline) / baseline, 0, 100)");
  assert.strictEqual(policy.formulas.resting_hr, "contribution = clamp(50 + 100 * (baseline - raw) / baseline, 0, 100)");
  assert.strictEqual(policy.formulas.sleep, "contribution = clamp(100 - 100 * abs(raw - baseline) / baseline, 0, 100)");
  const hist = historyDays(7);
  const out = evaluate(world, readySnap({ hrv: 55, rhr: 54, sleep: 28800 }), hist).result;
  assert.strictEqual(out.components.hrv.normalized, (55 - 50) / 50);
  assert.strictEqual(out.components.hrv.contribution, 50 + 100 * ((55 - 50) / 50));
  assert.strictEqual(out.components.resting_hr.normalized, (60 - 54) / 60);
  assert.strictEqual(out.components.resting_hr.contribution, 50 + 100 * ((60 - 54) / 60));
  assert.strictEqual(out.components.sleep.contribution, 100);
  assert.strictEqual(out.components.hrv.weight, 1);
  assert.strictEqual(out.components.resting_hr.weight, 1);
  assert.strictEqual(out.components.sleep.weight, 1);
  const two = evaluate(world, makeSnap({
    hrv: resolvedField("hrv", 50),
    rhr: resolvedField("resting_hr", 60)
  }), hist).result;
  assert.strictEqual(two.status, "partial");
  assert.strictEqual(two.score, 50);
  const none = evaluate(world, makeSnap({}), hist).result;
  assert.strictEqual(none.status, "insufficient_data");
  const few = evaluate(world, readySnap(), historyDays(4)).result;
  assert.strictEqual(few.status, "insufficient_data");
  assert.strictEqual(few.components.hrv.status, "insufficient_baseline");
});

test("R1-R1 23-26. Existing conflicted-HRV, missing-sleep, proprietary-score, and wall-clock tests still pass", function () {
  const world = loadWorld();
  const hist = historyDays(7);
  const conflicted = evaluate(world, makeSnap({
    hrv: conflictField("hrv", 20, 80),
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800)
  }), hist).result;
  assert.strictEqual(conflicted.inputs.hrv.reason, "unresolved");
  assert.strictEqual(conflicted.status, "partial");
  const missingSleep = evaluate(world, makeSnap({
    hrv: resolvedField("hrv", 55),
    rhr: resolvedField("resting_hr", 58)
  }), hist).result;
  assert.strictEqual(missingSleep.inputs.sleep.reason, "missing");
  assert.strictEqual(missingSleep.status, "partial");
  const energy = resolvedField("proprietary_score", 91, {
    revision_id: "e1",
    semantics: {
      metric_kind: "proprietary_score",
      aggregation: "daily",
      interval_start_utc: "2026-09-13T16:00:00Z",
      interval_end_utc: "2026-09-14T16:00:00Z",
      score_id: "vendorA:energy_score.v1",
      score_range: { min: 0, max: 100 },
      direction: "higher_better"
    }
  });
  const proprietary = evaluate(world, makeSnap({
    hrv: resolvedField("hrv", 55),
    rhr: resolvedField("resting_hr", 58),
    sleep: resolvedField("sleep_duration", 28800),
    energy: energy
  }), hist).result;
  assert.ok(proprietary.explanation.indexOf("energy_reserve_unsupported_semantic") !== -1);
  const snap = readySnap({ snapshot_id: "snap:bind", snapshot_version: 2 });
  const a = evaluate(world, snap, Object.assign({ computed_at_utc: "2026-09-14T09:00:00Z" }, hist)).result;
  const b = evaluate(world, snap, Object.assign({ computed_at_utc: "2026-09-14T23:00:00Z" }, hist)).result;
  assert.strictEqual(a.result_id, b.result_id);
  assert.strictEqual(a.score, b.score);
  assert.notStrictEqual(a.computed_at_utc, b.computed_at_utc);
});

test("R1-R1 28-30. Manual app recovery, storage, and network remain untouched", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  const pack = travelPack();
  evaluate(world, pack.current, travelInput(pack, "zzz-stockholm"));
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
  assert.ok(world.storage.store.nxtfrm_recovery_snapshot.indexOf("\"reason\":\"seed\"") !== -1);
  const src = fs.readFileSync(path.join(ROOT, "wearables.recovery.js"), "utf8");
  assert.ok(src.indexOf("cutSupport") === -1);
  assert.ok(src.indexOf("apm_current_read") === -1);
  assert.ok(src.indexOf("nxtfrm_recovery_snapshot") === -1);
});

test("56. Existing G3A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  15 passed") !== -1);
});

test("57. Existing G3B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("58. Existing G3C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("59. Existing G3D tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.canonical.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  24 passed") !== -1);
});

test("60. Existing G4A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.days.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  16 passed") !== -1);
});

test("61. Existing G4B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.snapshots.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  26 passed") !== -1);
});

test("62. Existing G4C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.resolution.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  19 passed") !== -1);
});

test("63-67. G3A reader and recovery namespace attach without wearable UI coupling", function () {
  const world = loadWorld();
  assert.strictEqual(fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" })).snapshot_id, "snap_syn_a");
  assert.ok(world.wearables.recovery);
  assert.strictEqual(typeof world.recovery.evaluate, "function");
  assert.strictEqual(typeof world.recovery.evaluateCurrent, "function");
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof world.wearables[name], "function");
  });
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
