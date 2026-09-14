/* NXTFRM G4C resolution-policy tests. Run: node wearables.resolution.test.js */
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
  [
    "wearables.js", "wearables.fixtures.js", "wearables.adapters.js", "wearables.ingest.js",
    "wearables.canonical.js", "wearables.days.js", "wearables.snapshots.js", "wearables.resolution.js"
  ].forEach(function (file) {
    if (file === "wearables.fixtures.js" && options.loadFixtures === false) return;
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });
  const days = ctx.NXTFRMWearableDays.createDays();
  const canonical = ctx.NXTFRMWearableCanonical.createCanonical();
  const snapshots = ctx.NXTFRMWearableSnapshots.createSnapshots({ days: days, canonical: canonical });
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    adapters: ctx.NXT.wearables.adapters,
    ingest: ctx.NXT.wearables.ingest,
    canonical: canonical,
    days: days,
    snapshots: snapshots,
    resolution: ctx.NXTFRMWearableResolution.createResolution({ snapshots: snapshots, days: days, canonical: canonical }),
    obsL: [],
    actL: []
  };
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function request() {
  return {
    user_id: "u_g4c",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  };
}

function collect(world) {
  return fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect(request()));
}

function normalize(world, delivery) {
  return fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g4c" }));
}

function ctxFor(delivery, at) {
  return { delivery_id: delivery.delivery_id, accepted_at_utc: at || "2026-09-14T08:05:00Z" };
}

function track(world, result) {
  if (!result || !result.lineage_id || !result.revision_id) return result;
  if (world.canonical.getObservationRevision(result.revision_id)) world.obsL.push(result.lineage_id);
  if (world.canonical.getActivityRevision(result.revision_id)) world.actL.push(result.lineage_id);
  return result;
}

function evidence(world) {
  const obs = [];
  const acts = [];
  Array.from(new Set(world.obsL)).forEach(function (id) {
    fromVm(world.canonical.listObservationRevisions("u_g4c", id)).forEach(function (r) { obs.push(r); });
  });
  Array.from(new Set(world.actL)).forEach(function (id) {
    fromVm(world.canonical.listActivityRevisions("u_g4c", id)).forEach(function (r) { acts.push(r); });
  });
  return { observations: obs, activities: acts };
}

function openWindow(world, extra) {
  const created = fromVm(world.days.createWindow(Object.assign({
    user_id: "u_g4c",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "profile"
  }, extra || {})));
  assert.ok(created.outcome === "created" || created.outcome === "reused", created.outcome);
  world.days.setCurrent("u_g4c", created.window.local_date, created.day_window_id, "2026-09-14T00:00:00Z");
  return created.window;
}

function assembleNow(world, window, built) {
  return fromVm(world.snapshots.assemble(Object.assign({
    user_id: "u_g4c",
    day_window_id: window.day_window_id,
    built_at_utc: built || "2026-09-14T18:00:00Z"
  }, evidence(world))));
}

function acceptHrAt(world, at) {
  const delivery = collect(world);
  const hr = delivery.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.observed_at = at;
  hr.updated_at = at;
  delivery.records = [hr];
  const batch = normalize(world, delivery);
  const cand = batch.candidates.find(function (c) { return c.semantics && c.semantics.metric_kind === "resting_hr"; });
  return track(world, fromVm(world.canonical.acceptCandidate(cand, ctxFor(delivery))));
}

function srcA() {
  return { kind: "fixture_dataset", source_id: "src_a", provider: "vendor.a", fixture_dataset_id: "fix_a" };
}
function srcB() {
  return { kind: "api_connection", source_id: "src_b", provider: "vendor.b", connection_id: "conn_b" };
}
function srcImport() {
  return { kind: "import_batch", source_id: "src_imp", provider: "vendor.a", import_batch_id: "imp_1" };
}

function cand(opts) {
  const at = opts.at || "2026-09-14T01:00:00Z";
  const ingested = opts.ingested || "2026-09-14T08:05:00Z";
  return {
    candidate_id: opts.candidate_id || ("cand:" + opts.revision_id),
    availability: opts.availability || "present",
    reason: Object.prototype.hasOwnProperty.call(opts, "reason") ? opts.reason : null,
    value: Object.prototype.hasOwnProperty.call(opts, "value") ? opts.value : 58,
    semantics: opts.semantics || {
      metric_kind: "resting_hr",
      unit: "bpm",
      aggregation: "instant",
      interval_start_utc: at,
      interval_end_utc: at
    },
    measurement_quality: "unknown",
    provenance: {
      source: opts.source || srcA(),
      raw: {
        raw_id: "raw_" + opts.revision_id,
        payload_sha256: HEX64,
        ingested_at_utc: ingested,
        adapter_id: "adp",
        adapter_version: "1"
      },
      accepted_delivery_id: opts.delivery || "del",
      observed_at_utc: at,
      recorded_at_utc: at,
      ingested_at_utc: ingested,
      identities: {
        canonical_observation_id: opts.lineage,
        provider_record_id: opts.provider_record_id || opts.lineage,
        revision_id: opts.revision_id,
        content_hash: HEX64,
        supersedes_revision_id: opts.parent || null
      }
    }
  };
}

function scoreSem(id, range, direction) {
  return {
    metric_kind: "proprietary_score",
    score_id: id,
    score_range: range || { min: 0, max: 100 },
    direction: direction || "higher_better",
    aggregation: "nightly",
    interval_start_utc: "2026-09-13T16:10:00Z",
    interval_end_utc: "2026-09-13T23:40:00Z"
  };
}

function withField(snap, name, candidates, extra) {
  const next = fromVm(snap);
  next[name] = Object.assign({
    candidates: candidates,
    primary_candidate_id: extra && extra.primary !== undefined ? extra.primary : null,
    selection: extra && extra.selection || { rule: "none_empty", policy_id: null, policy_version: null }
  }, extra && extra.field || {});
  if (extra && extra.flags) next.quality_flags = extra.flags;
  if (extra && extra.sources) next.contributing_sources = extra.sources;
  if (extra && extra.freshness) next.source_freshness = extra.freshness;
  if (extra && extra.sources && !extra.freshness) {
    const have = {};
    (next.source_freshness || []).forEach(function (row) { have[row.source_id] = row; });
    next.source_freshness = extra.sources.map(function (src) {
      return have[src.source_id] || {
        source_id: src.source_id,
        last_successful_sync_at_utc: null,
        source_updated_at_utc: null,
        newest_observation_at_utc: null,
        expected_update_window: null
      };
    });
  }
  if (extra && extra.bouts) next.sleep_bouts = extra.bouts;
  if (extra && extra.aggregate) next.freshness_aggregate = extra.aggregate;
  return next;
}

function resolveProposed(world, snap, extra) {
  return fromVm(world.resolution.resolve(Object.assign({ snapshot: snap }, extra || {})));
}

function assertSamePointer(a, b) {
  assert.ok(a && b);
  assert.strictEqual(a.user_id, b.user_id);
  assert.strictEqual(a.day_window_id, b.day_window_id);
  assert.strictEqual(a.snapshot_id, b.snapshot_id);
  assert.strictEqual(a.snapshot_version, b.snapshot_version);
}

function withExtraSource(snap, source, extraCand) {
  const next = fromVm(snap);
  if (extraCand) {
    next.resting_hr_bpm = fromVm(next.resting_hr_bpm);
    next.resting_hr_bpm.candidates = (next.resting_hr_bpm.candidates || []).concat([extraCand]);
  }
  const sources = (next.contributing_sources || []).slice();
  if (!sources.some(function (s) { return s.source_id === source.source_id; })) sources.push(source);
  next.contributing_sources = sources;
  const have = {};
  (next.source_freshness || []).forEach(function (row) { have[row.source_id] = row; });
  next.source_freshness = sources.map(function (s) {
    return have[s.source_id] || {
      source_id: s.source_id,
      last_successful_sync_at_utc: null,
      source_updated_at_utc: null,
      newest_observation_at_utc: null,
      expected_update_window: null
    };
  });
  return next;
}

test("syntax: G3A–G4C scripts parse", function () {
  [
    "wearables.js", "wearables.adapters.js", "wearables.ingest.js", "wearables.canonical.js",
    "wearables.days.js", "wearables.snapshots.js", "wearables.resolution.js",
    "wearables.test.js", "wearables.snapshots.test.js", "wearables.resolution.test.js", "sw.js"
  ].forEach(syntaxCheck);
});

test("1-2. Valid G4B snapshot enters resolution; malformed snapshot is rejected", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const assembled = assembleNow(world, window);
  assert.strictEqual(assembled.outcome, "assembled");
  const out = fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id));
  assert.strictEqual(out.outcome, "reused");
  assert.strictEqual(out.snapshot_id, assembled.snapshot_id);
  assert.strictEqual(out.snapshot.resting_hr_bpm.selection.rule, "unique_unsuperseded_leaf");
  const bad = fromVm(world.resolution.resolve({ snapshot: { document_type: "nope" } }));
  assert.strictEqual(bad.outcome, "invalid_snapshot");
});

test("3-7. Same-lineage chain selects unique leaf; fork/cycle/missing-parent/multi-leaf unresolved", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const base = assembleNow(world, window).snapshot;
  const r1 = cand({ lineage: "L1", revision_id: "R1", value: 58 });
  const r2 = cand({ lineage: "L1", revision_id: "R2", value: 60, parent: "R1" });
  const r3 = cand({ lineage: "L1", revision_id: "R3", value: 61, parent: "R1" });
  const chain = withField(base, "resting_hr_bpm", [r2, r1]);
  const leaf = resolveProposed(world, chain);
  assert.strictEqual(leaf.outcome, "resolved_version");
  assert.strictEqual(leaf.snapshot.resting_hr_bpm.selection.rule, "unique_unsuperseded_leaf");
  assert.strictEqual(leaf.snapshot.resting_hr_bpm.primary_candidate_id, "cand:R2");
  assert.strictEqual(leaf.snapshot.resting_hr_bpm.candidates.length, 2);

  function ruleOf(cands) {
    const w = loadWorld();
    const win = openWindow(w);
    const snap = assembleNow(w, win).snapshot;
    const doc = withField(snap, "resting_hr_bpm", cands);
    return resolveProposed(w, doc).snapshot.resting_hr_bpm;
  }
  const forked = ruleOf([r1, r2, r3]);
  assert.strictEqual(forked.selection.rule, "none_revision_fork");
  assert.strictEqual(forked.primary_candidate_id, null);
  const cyclic = ruleOf([
    cand({ lineage: "L1", revision_id: "R1", parent: "R2" }),
    cand({ lineage: "L1", revision_id: "R2", parent: "R1" })
  ]);
  assert.strictEqual(cyclic.selection.rule, "none_revision_cycle");
  const missing = ruleOf([cand({ lineage: "L1", revision_id: "R2", parent: "R1" })]);
  assert.strictEqual(missing.selection.rule, "none_missing_parent");
  const multi = ruleOf([
    cand({ lineage: "L1", revision_id: "R1" }),
    cand({ lineage: "L1", revision_id: "R2" })
  ]);
  assert.strictEqual(multi.selection.rule, "none_multiple_leaves");
});

test("8-18. Same-source multi-lineage and cross-source stay unresolved without provider priority", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const base = assembleNow(world, window).snapshot;
  const a = cand({ lineage: "LA", revision_id: "RA", value: 58, source: srcA(), at: "2026-09-14T01:00:00Z" });
  const bSame = cand({ lineage: "LB", revision_id: "RB", value: 61, source: srcA() });
  const sameSrc = withField(base, "resting_hr_bpm", [bSame, a], {
    sources: [srcA()],
    freshness: [{
      source_id: "src_a", last_successful_sync_at_utc: "2026-09-14T11:00:00Z",
      source_updated_at_utc: null, newest_observation_at_utc: "2026-09-14T01:00:00Z", expected_update_window: null
    }]
  });
  const sameOut = resolveProposed(world, sameSrc).snapshot.resting_hr_bpm;
  assert.strictEqual(sameOut.selection.rule, "none_unresolved_lineages");
  assert.strictEqual(sameOut.primary_candidate_id, null);
  assert.strictEqual(sameOut.candidates.length, 2);

  const bApi = cand({ lineage: "LB", revision_id: "RB", value: 61, source: srcB(), at: "2026-09-14T02:00:00Z" });
  const cross = withField(base, "resting_hr_bpm", [bApi, a], {
    sources: [srcA(), srcB()],
    freshness: [{
      source_id: "src_a", last_successful_sync_at_utc: "2026-09-14T10:00:00Z",
      source_updated_at_utc: "2026-09-14T08:40:00Z", newest_observation_at_utc: "2026-09-14T01:00:00Z", expected_update_window: null
    }, {
      source_id: "src_b", last_successful_sync_at_utc: "2026-09-14T11:00:00Z",
      source_updated_at_utc: "2026-09-14T10:30:00Z", newest_observation_at_utc: "2026-09-14T02:00:00Z", expected_update_window: null
    }]
  });
  const world2 = loadWorld();
  const w2 = openWindow(world2);
  const base2 = assembleNow(world2, w2).snapshot;
  const crossDoc = withField(base2, "resting_hr_bpm", [bApi, a], {
    sources: [srcA(), srcB()],
    freshness: cross.source_freshness
  });
  const crossOut = resolveProposed(world2, crossDoc);
  const field = crossOut.snapshot.resting_hr_bpm;
  assert.strictEqual(field.selection.rule, "none_cross_source_conflict");
  assert.strictEqual(field.primary_candidate_id, null);
  assert.strictEqual(field.candidates.length, 2);
  assert.ok(crossOut.snapshot.quality_flags.indexOf("conflict") !== -1);
  assert.ok(crossOut.snapshot.quality_flags.indexOf("multi_source") !== -1);
  assert.strictEqual(field.selection.policy_id, null);
  assert.strictEqual(field.selection.policy_version, null);

  const world3 = loadWorld();
  const w3 = openWindow(world3);
  const imp = cand({ lineage: "LI", revision_id: "RI", value: 70, source: srcImport() });
  const apiVsImp = withField(assembleNow(world3, w3).snapshot, "resting_hr_bpm", [a, imp], { sources: [srcA(), srcImport()] });
  const mixed = resolveProposed(world3, apiVsImp).snapshot.resting_hr_bpm;
  assert.strictEqual(mixed.selection.rule, "none_cross_source_conflict");
  assert.strictEqual(mixed.primary_candidate_id, null);
});

test("19-20. Empty vs unsupported remain distinct", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const empty = assembleNow(world, window).snapshot;
  const none = fromVm(world.resolution.resolveSnapshot(empty.snapshot_id));
  assert.strictEqual(none.snapshot.hrv.selection.rule, "none_empty");
  const unsupported = cand({
    lineage: "LU", revision_id: "RU", value: null, availability: "unsupported",
    reason: "unsupported_by_source"
  });
  const doc = withField(empty, "hrv", [unsupported]);
  doc.hrv.candidates[0].semantics = { metric_kind: "hrv", unit: "ms", hrv_metric: "rmssd", aggregation: "nightly", interval_start_utc: "2026-09-13T16:00:00Z", interval_end_utc: "2026-09-13T23:00:00Z" };
  const worldU = loadWorld();
  const wu = openWindow(worldU);
  const baseU = assembleNow(worldU, wu).snapshot;
  const uDoc = withField(baseU, "hrv", doc.hrv.candidates);
  const uOut = resolveProposed(worldU, uDoc).snapshot.hrv;
  assert.strictEqual(uOut.selection.rule, "none_all_non_present");
  assert.notStrictEqual(uOut.selection.rule, "none_empty");
});

test("21-26. Proprietary scores require exact identity; no translation or averaging", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const base = assembleNow(world, window).snapshot;
  const a = cand({
    lineage: "SA", revision_id: "SA1", value: 82, source: srcA(),
    semantics: scoreSem("vendorA:sleep_score")
  });
  const bSame = cand({
    lineage: "SA", revision_id: "SA2", value: 80, source: srcA(), parent: "SA1",
    semantics: scoreSem("vendorA:sleep_score")
  });
  const compatible = withField(base, "sleep_score", [a, bSame]);
  const compat = resolveProposed(world, compatible).snapshot.sleep_score;
  assert.strictEqual(compat.selection.rule, "unique_unsuperseded_leaf");
  assert.strictEqual(compat.primary_candidate_id, "cand:SA2");

  function scoreRule(other) {
    const w = loadWorld();
    const win = openWindow(w);
    const snap = withField(assembleNow(w, win).snapshot, "sleep_score", [a, other], { sources: [srcA(), srcB()] });
    return resolveProposed(w, snap).snapshot.sleep_score;
  }
  const otherVendor = cand({
    lineage: "SB", revision_id: "SB1", value: 91, source: srcB(),
    semantics: scoreSem("vendorB:sleep_score")
  });
  const mismatchId = scoreRule(otherVendor);
  assert.strictEqual(mismatchId.selection.rule, "none_incompatible_semantics");
  assert.strictEqual(mismatchId.primary_candidate_id, null);
  assert.strictEqual(mismatchId.candidates.length, 2);
  const mismatchRange = scoreRule(cand({
    lineage: "SB", revision_id: "SB1", value: 91, source: srcB(),
    semantics: scoreSem("vendorA:sleep_score", { min: 0, max: 10 })
  }));
  assert.strictEqual(mismatchRange.selection.rule, "none_incompatible_semantics");
  const mismatchDir = scoreRule(cand({
    lineage: "SB", revision_id: "SB1", value: 91, source: srcB(),
    semantics: scoreSem("vendorA:sleep_score", { min: 0, max: 100 }, "lower_better")
  }));
  assert.strictEqual(mismatchDir.selection.rule, "none_incompatible_semantics");
  const mean = (82 + 91) / 2;
  assert.ok(mismatchId.candidates.every(function (c) { return c.value !== mean; }));
});

test("27-34. Sleep nightly/nap/providers/travel stay separate; no snapshot-wide assignment", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const delivery = collect(world);
  delivery.records = [{
    provider_record_id: "sleep_sg",
    record_type: "sleep",
    observed_at: "2026-09-13T23:50:00Z",
    payload: {
      start: "2026-09-13T16:20:00Z", end: "2026-09-13T23:50:00Z", duration_min: 450,
      vendor_sleep_date: "2026-09-14", timezone: "Asia/Singapore"
    }
  }, {
    provider_record_id: "sleep_nap",
    record_type: "sleep",
    observed_at: "2026-09-14T07:00:00Z",
    payload: {
      start: "2026-09-14T06:20:00Z", end: "2026-09-14T07:00:00Z", duration_min: 40,
      vendor_sleep_date: "2026-09-14", timezone: "Europe/Stockholm", aggregation: "bout"
    }
  }];
  const batch = normalize(world, delivery);
  batch.candidates.filter(function (c) { return c.semantics && c.semantics.metric_kind === "sleep_duration"; }).forEach(function (c) {
    track(world, fromVm(world.canonical.acceptCandidate(c, ctxFor(delivery))));
  });
  const other = collect(world);
  other.delivery_id = "del_sleep_b";
  other.provider_id = "other.provider";
  other.source_instance_ref = { kind: "api", provider_id: "other.provider", connection_id: "c9", source_id: "src_other" };
  world.ingest.registerNormalizer({
    normalizer_id: "other.norm",
    provider_id: "other.provider",
    normalizeRecord: world.ingest.createFixtureNormalizer().normalizeRecord
  });
  other.records = [{
    provider_record_id: "sleep_sto",
    record_type: "sleep",
    observed_at: "2026-09-13T22:00:00Z",
    payload: {
      start: "2026-09-13T21:00:00Z", end: "2026-09-13T22:00:00Z", duration_min: 60,
      vendor_sleep_date: "2026-09-14", timezone: "Europe/Stockholm"
    }
  }];
  normalize(world, other).candidates.filter(function (c) { return c.semantics && c.semantics.metric_kind === "sleep_duration"; }).forEach(function (c) {
    track(world, fromVm(world.canonical.acceptCandidate(c, ctxFor(other))));
  });
  const assembled = assembleNow(world, window);
  const resolved = fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id));
  const snap = resolved.snapshot;
  assert.ok(!snap.sleep_assignment);
  assert.ok(!snap.primary_sleep);
  assert.ok(snap.sleep_duration_s.candidates.length >= 2);
  assert.strictEqual(snap.sleep_duration_s.selection.rule, "none_cross_source_conflict");
  assert.strictEqual(snap.sleep_duration_s.primary_candidate_id, null);
  assert.ok(snap.sleep_bouts.length >= 1);
  assert.strictEqual(snap.sleep_bouts[0].semantics.aggregation, "bout");
  const tz = snap.sleep_duration_s.candidates.map(function (c) { return c.semantics.sleep.assignment_timezone; });
  assert.ok(tz.indexOf("Asia/Singapore") !== -1);
  assert.ok(tz.indexOf("Europe/Stockholm") !== -1);
  assert.ok(snap.sleep_bouts[0].semantics.sleep.assignment_timezone === "Europe/Stockholm");
});

test("35-39. Freshness stays per-source; aggregate is max of non-null clocks", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const base = assembleNow(world, window).snapshot;
  const rows = [{
    source_id: "src_a", last_successful_sync_at_utc: "2026-09-14T09:00:00Z",
    source_updated_at_utc: "2026-09-14T08:40:00Z", newest_observation_at_utc: "2026-09-14T08:30:00Z", expected_update_window: null
  }, {
    source_id: "src_b", last_successful_sync_at_utc: "2026-09-14T11:00:00Z",
    source_updated_at_utc: "2026-09-14T10:30:00Z", newest_observation_at_utc: "2026-09-14T07:00:00Z", expected_update_window: null
  }];
  const doc = withField(base, "resting_hr_bpm", [
    cand({ lineage: "LA", revision_id: "RA", source: srcA() }),
    cand({ lineage: "LB", revision_id: "RB", value: 61, source: srcB() })
  ], { sources: [srcA(), srcB()], freshness: rows });
  const out = resolveProposed(world, doc);
  assert.strictEqual(out.snapshot.source_freshness.length, 2);
  assert.strictEqual(out.snapshot.freshness_aggregate.derivation_id, "freshness.aggregate.g1.2");
  assert.strictEqual(out.snapshot.freshness_aggregate.derivation_version, "1");
  assert.strictEqual(out.snapshot.freshness_aggregate.last_successful_sync_at_utc, "2026-09-14T11:00:00Z");
  assert.strictEqual(out.snapshot.freshness_aggregate.newest_observation_at_utc, "2026-09-14T08:30:00Z");
  const again = fromVm(world.resolution.freshnessAggregate(rows));
  assert.deepStrictEqual(again, out.snapshot.freshness_aggregate);
  const emptyAgg = fromVm(world.resolution.freshnessAggregate([]));
  assert.strictEqual(emptyAgg.last_successful_sync_at_utc, null);
  assert.strictEqual(emptyAgg.newest_observation_at_utc, null);
});

test("40-48. Quality flags follow frozen predicates; no quality.band or named policy", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const assembled = assembleNow(world, window);
  const resolved = fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id)).snapshot;
  assert.ok(resolved.quality_flags.indexOf("partial_day") !== -1);
  assert.ok(!resolved.quality || !resolved.quality.band);
  assert.ok(resolved.quality_flags.indexOf("conflict") === -1);
  const travelWorld = loadWorld();
  const travel = fromVm(travelWorld.days.createWindow({
    user_id: "u_g4c",
    local_date: "2026-09-13",
    representative_timezone: "Asia/Singapore",
    assignment_source: "travel_override",
    start_utc: "2026-09-12T16:00:00Z",
    end_utc: "2026-09-13T22:00:00Z",
    day_window_id: "dw_g4c_travel"
  }));
  travelWorld.days.setCurrent("u_g4c", "2026-09-13", travel.day_window_id, "2026-09-13T00:00:00Z");
  const tSnap = fromVm(travelWorld.snapshots.assemble({
    user_id: "u_g4c",
    day_window_id: travel.day_window_id,
    built_at_utc: "2026-09-13T23:00:00Z"
  })).snapshot;
  const tOut = fromVm(travelWorld.resolution.resolve({ snapshot: tSnap })).snapshot;
  assert.ok(tOut.quality_flags.indexOf("timezone_change") !== -1);
  assert.strictEqual(tOut.sleep_duration_s.selection.policy_id, null);
});

test("49-57. Replay is idempotent; selection change versions; pointer rollback and failed advance", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const assembled = assembleNow(world, window);
  assert.strictEqual(typeof world.snapshots.appendVersion, "function");
  const v1Ptr = fromVm(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id));
  assert.strictEqual(v1Ptr.snapshot_id, assembled.snapshot_id);
  assert.strictEqual(v1Ptr.snapshot_version, 1);
  const first = fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id));
  const before = JSON.stringify(fromVm(world.snapshots.getSnapshot(assembled.snapshot_id)));
  const replay = fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id, { built_at_utc: "2026-09-14T21:00:00Z" }));
  assert.strictEqual(replay.outcome, "reused");
  assert.strictEqual(replay.snapshot_id, first.snapshot_id);
  assert.strictEqual(replay.snapshot_id, assembled.snapshot_id);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(assembled.snapshot_id))), before);
  assertSamePointer(
    fromVm(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id)),
    v1Ptr
  );
  assertSamePointer(
    fromVm(world.resolution.getCurrentPointer("u_g4c", window.day_window_id)),
    fromVm(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id))
  );
  assert.strictEqual(world.resolution.status().snapshot_pointers, 0);
  assert.strictEqual(world.resolution.status().snapshots, 0);

  const clone = withExtraSource(assembled.snapshot, srcB(), cand({ lineage: "LB", revision_id: "RB", value: 61, source: srcB() }));
  const changed = fromVm(world.resolution.resolve({ snapshot: clone, built_at_utc: "2026-09-14T22:00:00Z" }));
  assert.strictEqual(changed.outcome, "resolved_version");
  assert.strictEqual(changed.snapshot_version, assembled.snapshot_version + 1);
  assert.strictEqual(changed.snapshot.supersedes_snapshot_id, assembled.snapshot_id);
  assert.strictEqual(changed.snapshot.build_reason, "rebuild");
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(assembled.snapshot_id))), before);
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id).snapshot_id, changed.snapshot_id);
  assert.strictEqual(world.snapshots.getCurrent("u_g4c", window.day_window_id).snapshot_id, changed.snapshot_id);
  assert.ok(world.snapshots.getSnapshot(changed.snapshot_id));
  const listed = fromVm(world.snapshots.listSnapshots("u_g4c", window.day_window_id)).map(function (s) { return s.snapshot_id; });
  assert.ok(listed.indexOf(assembled.snapshot_id) !== -1);
  assert.ok(listed.indexOf(changed.snapshot_id) !== -1);
  assertSamePointer(
    fromVm(world.resolution.getCurrentPointer("u_g4c", window.day_window_id)),
    fromVm(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id))
  );
  const rollback = fromVm(world.resolution.setCurrent("u_g4c", window.day_window_id, assembled.snapshot_id, 1, "2026-09-14T23:00:00Z"));
  assert.strictEqual(rollback.outcome, "invalid_pointer");
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id).snapshot_id, changed.snapshot_id);

  const v3Doc = withExtraSource(changed.snapshot, srcImport(), cand({ lineage: "LI", revision_id: "RI", value: 70, source: srcImport() }));
  const v3 = fromVm(world.resolution.resolve({ snapshot: v3Doc, built_at_utc: "2026-09-14T22:30:00Z" }));
  assert.strictEqual(v3.outcome, "resolved_version");
  assert.strictEqual(v3.snapshot_version, 3);
  assert.strictEqual(v3.snapshot.supersedes_snapshot_id, changed.snapshot_id);
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4c", window.day_window_id).snapshot_id, v3.snapshot_id);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(assembled.snapshot_id))), before);
  assert.strictEqual(fromVm(world.snapshots.getSnapshot(changed.snapshot_id)).snapshot_id, changed.snapshot_id);
  assert.strictEqual(fromVm(world.snapshots.listSnapshots("u_g4c", window.day_window_id)).length, 3);

  const worldF = loadWorld();
  const wf = openWindow(worldF);
  acceptHrAt(worldF, "2026-09-14T01:00:00Z");
  const s1 = assembleNow(worldF, wf);
  fromVm(worldF.resolution.resolveSnapshot(s1.snapshot_id));
  const ptr = fromVm(worldF.snapshots.getCurrentPointer("u_g4c", wf.day_window_id));
  const next = withExtraSource(s1.snapshot, srcB(), cand({ lineage: "LB", revision_id: "RB", value: 61, source: srcB() }));
  worldF.resolution._test.failNextPointer();
  const failed = fromVm(worldF.resolution.resolve({ snapshot: next, built_at_utc: "2026-09-14T22:00:00Z" }));
  assert.strictEqual(failed.outcome, "invalid_pointer");
  assert.deepStrictEqual(fromVm(worldF.snapshots.getCurrentPointer("u_g4c", wf.day_window_id)), ptr);
  assert.deepStrictEqual(fromVm(worldF.resolution.getCurrentPointer("u_g4c", wf.day_window_id)), ptr);
  assert.strictEqual(worldF.snapshots.listSnapshots("u_g4c", wf.day_window_id).length, 1);
  assert.strictEqual(worldF.resolution.listSnapshots("u_g4c", wf.day_window_id).length, 1);
});

test("58-64. Ordering and dual day-window lineages stay independent of wall clock and delivery_id", function () {
  function build(order) {
    const world = loadWorld();
    const window = openWindow(world);
    const base = assembleNow(world, window).snapshot;
    const cands = order.map(function (id, i) {
      return cand({ lineage: id, revision_id: id, value: 50 + i, source: id === "LA" ? srcA() : srcB() });
    });
    const doc = withField(base, "resting_hr_bpm", cands, { sources: [srcA(), srcB()] });
    return resolveProposed(world, doc, { built_at_utc: "2026-09-14T19:00:00Z" }).snapshot;
  }
  const a = build(["LB", "LA"]);
  const b = build(["LA", "LB"]);
  assert.deepStrictEqual(
    a.resting_hr_bpm.candidates.map(function (c) { return c.provenance.identities.revision_id; }),
    b.resting_hr_bpm.candidates.map(function (c) { return c.provenance.identities.revision_id; })
  );
  const world = loadWorld();
  const sg = openWindow(world);
  const sto = fromVm(world.days.createWindow({
    user_id: "u_g4c",
    local_date: "2026-09-14",
    representative_timezone: "Europe/Stockholm",
    assignment_source: "profile"
  }));
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const aSnap = assembleNow(world, sg);
  fromVm(world.resolution.resolveSnapshot(aSnap.snapshot_id));
  world.days.setCurrent("u_g4c", "2026-09-14", sto.day_window_id, "2026-09-14T00:10:00Z");
  const bSnap = assembleNow(world, sto.window);
  fromVm(world.resolution.resolveSnapshot(bSnap.snapshot_id));
  const clone = withExtraSource(aSnap.snapshot, srcB(), cand({ lineage: "LX", revision_id: "RX", value: 99, source: srcB() }));
  fromVm(world.resolution.resolve({ snapshot: clone }));
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4c", sto.day_window_id).snapshot_id, bSnap.snapshot_id);
  assert.notStrictEqual(world.snapshots.getCurrentPointer("u_g4c", sg.day_window_id).snapshot_id, bSnap.snapshot_id);
  assertSamePointer(
    fromVm(world.resolution.getCurrentPointer("u_g4c", sto.day_window_id)),
    fromVm(world.snapshots.getCurrentPointer("u_g4c", sto.day_window_id))
  );
  assertSamePointer(
    fromVm(world.resolution.getCurrentPointer("u_g4c", sg.day_window_id)),
    fromVm(world.snapshots.getCurrentPointer("u_g4c", sg.day_window_id))
  );
});

test("65-76. G4C creates no revisions/windows/recovery and writes no I/O", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const assembled = assembleNow(world, window);
  fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id));
  const st = world.resolution.status();
  assert.strictEqual(st.snapshot_pointers, 0);
  assert.strictEqual(st.snapshots, 0);
  assert.strictEqual(st.observation_revisions, 0);
  assert.strictEqual(st.activity_revisions, 0);
  assert.strictEqual(st.day_windows, 0);
  assert.strictEqual(st.interprets_recovery, false);
  assert.ok(!assembled.snapshot.recovery);
  assert.ok(!fromVm(world.resolution.getCurrent("u_g4c", window.day_window_id)).readiness);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
});

test("77. Existing G3A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  18 passed") !== -1);
});

test("78. Existing G3B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("79. Existing G3C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("80. Existing G3D tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.canonical.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  24 passed") !== -1);
});

test("81. Existing G4A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.days.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  16 passed") !== -1);
});

test("82-84. Existing G4B tests and assembly/reader behavior unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.snapshots.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  26 passed") !== -1);
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const assembled = assembleNow(world, window);
  fromVm(world.resolution.resolveSnapshot(assembled.snapshot_id));
  assert.strictEqual(fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" })).snapshot_id, "snap_syn_a");
  assert.strictEqual(world.snapshots.getSnapshot(assembled.snapshot_id).snapshot_id, assembled.snapshot_id);
});

test("G3A public methods remain present after resolution attach", function () {
  const api = loadWorld().wearables;
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof api[name], "function");
  });
  assert.ok(api.days);
  assert.ok(api.canonical);
  assert.ok(api.snapshots);
  assert.ok(api.resolution);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
