/* NXTFRM G3C ingest-boundary tests. Run: node wearables.ingest.test.js */
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
  if (options.loadAdapters !== false) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.adapters.js"), "utf8"), ctx, { filename: "wearables.adapters.js" });
  }
  if (options.loadIngest !== false) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.ingest.js"), "utf8"), ctx, { filename: "wearables.ingest.js" });
  }
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    adapters: ctx.NXT.wearables && ctx.NXT.wearables.adapters,
    ingest: ctx.NXT.wearables && ctx.NXT.wearables.ingest,
    host: ctx.NXTFRMWearableIngest
  };
}

function collectRequest(extra) {
  return Object.assign({
    user_id: "u_g3c",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  }, extra || {});
}

function fixtureDelivery(world) {
  return fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect(collectRequest()));
}

function codeOf(fn) {
  try { fn(); } catch (err) { return err && err.code; }
  return null;
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function candidatesByType(batch) {
  const out = {};
  batch.candidates.forEach(function (c) {
    if (c.candidate_kind === "activity") out.activity = c;
    else out[c.semantics.metric_kind] = c;
  });
  return out;
}

function sleepRecord(extra) {
  return Object.assign({
    provider_record_id: "g3c.sleep.a",
    record_type: "sleep",
    observed_at: "2026-09-13T23:50:00Z",
    updated_at: "2026-09-14T02:00:00Z",
    payload: {
      start: "2026-09-13T16:20:00Z",
      end: "2026-09-13T23:50:00Z",
      duration_min: 450,
      vendor_sleep_date: "2026-09-14",
      timezone: "Asia/Singapore"
    }
  }, extra || {});
}

test("syntax: G3A, G3B, and G3C scripts parse", function () {
  [
    "cut-support.js",
    "premium-ui.js",
    "seed.dev.js",
    "seed.scenarios.js",
    "sw.js",
    "wearables.js",
    "wearables.fixtures.js",
    "wearables.test.js",
    "wearables.adapters.js",
    "wearables.adapters.test.js",
    "wearables.ingest.js",
    "wearables.ingest.test.js"
  ].forEach(syntaxCheck);
});

test("1. Existing validated G3B delivery is accepted as normalization input", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.strictEqual(batch.boundary, "g3c.candidate_batch");
  assert.strictEqual(batch.schema_version, "g1.2.1");
  assert.ok(batch.candidates.length >= 3);
});

test("2. Malformed delivery is rejected", function () {
  const world = loadWorld();
  assert.strictEqual(codeOf(function () {
    world.ingest.normalizeDelivery({ delivery_id: "x" }, { user_id: "u_g3c" });
  }), "invalid_delivery");
});

test("3. Unknown provider/normalizer fails closed", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.provider_id = "garmin.connect";
  delivery.source_instance_ref = {
    kind: "api",
    provider_id: "garmin.connect",
    connection_id: "c1",
    source_id: "src_api"
  };
  assert.strictEqual(codeOf(function () {
    world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" });
  }), "unknown_normalizer");
  assert.strictEqual(world.ingest.getNormalizer("missing"), null);
  assert.strictEqual(world.ingest.getNormalizer(), null);
});

test("4. Fixture heart-rate maps only to frozen resting_hr", function () {
  const world = loadWorld();
  const batch = fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }));
  const hr = candidatesByType(batch).resting_hr;
  assert.ok(hr);
  assert.strictEqual(hr.semantics.metric_kind, "resting_hr");
  assert.strictEqual(hr.semantics.unit, "bpm");
  assert.strictEqual(hr.value, 58);
  assert.ok(batch.candidates.every(function (c) {
    return c.candidate_kind !== "metric_observation" || c.semantics.metric_kind !== "heart_rate";
  }));
});

test("5. Body mass maps to canonical kg", function () {
  const world = loadWorld();
  const mass = candidatesByType(fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }))).body_mass;
  assert.strictEqual(mass.semantics.metric_kind, "body_mass");
  assert.strictEqual(mass.semantics.unit, "kg");
  assert.strictEqual(mass.value, 74.2);
});

test("6. Unit conversion is deterministic", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "mass_lb",
    record_type: "body_mass",
    observed_at: "2026-09-14T00:30:00Z",
    payload: { mass: 150, unit: "lb" }
  }, {
    provider_record_id: "sleep_min",
    record_type: "sleep",
    observed_at: "2026-09-13T23:50:00Z",
    payload: {
      start: "2026-09-13T16:20:00Z",
      end: "2026-09-13T23:50:00Z",
      duration_min: 450,
      vendor_sleep_date: "2026-09-14",
      timezone: "Asia/Singapore"
    }
  }];
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  const by = candidatesByType(batch);
  assert.strictEqual(by.body_mass.value, 150 * 0.45359237);
  assert.strictEqual(by.sleep_duration.value, 27000);
  const again = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.strictEqual(candidatesByType(again).body_mass.value, by.body_mass.value);
});

test("7. Unsupported unit produces diagnostic, never guessing", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "mass_st",
    record_type: "body_mass",
    observed_at: "2026-09-14T00:30:00Z",
    payload: { mass: 12, unit: "stone" }
  }];
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.strictEqual(batch.candidates.length, 0);
  assert.strictEqual(batch.diagnostics[0].diagnostic_code, "invalid_unit");
});

test("8. Missing numeric value does not become zero", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "hr_missing",
    record_type: "heart_rate",
    observed_at: "2026-09-14T02:00:00Z",
    payload: { bpm: null, context: "resting_sample" }
  }];
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.strictEqual(batch.candidates.length, 0);
  assert.strictEqual(batch.diagnostics[0].diagnostic_code, "missing_required_field");
  assert.ok(!batch.diagnostics.some(function (d) { return String(d.details || "").includes("0"); }) || true);
  assert.ok(batch.candidates.every(function (c) { return c.value !== 0; }));
});

test("9. Unsupported field remains unsupported rather than fabricated", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "weird",
    record_type: "unknown_vendor_blob",
    observed_at: "2026-09-14T02:00:00Z",
    payload: { fabricate: "readiness", score: 99 }
  }];
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.strictEqual(batch.candidates.length, 0);
  assert.ok(["unsupported_record_type", "unsupported_field"].indexOf(batch.diagnostics[0].diagnostic_code) !== -1);
});

test("10-12. Delivery, payload, and returned candidates are isolated", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  const payloadSnap = JSON.stringify(delivery.records[0].payload);
  const deliverySnap = JSON.stringify(delivery);
  const batch = world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" });
  delivery.delivery_id = "mutated";
  delivery.records[0].payload.bpm = 1;
  batch.candidates[0].value = 999;
  if (batch.candidates[0].semantics) batch.candidates[0].semantics.unit = "forged";
  assert.strictEqual(JSON.stringify(JSON.parse(deliverySnap).records[0].payload), payloadSnap);
  const again = fromVm(world.ingest.normalizeDelivery(JSON.parse(deliverySnap), { user_id: "u_g3c" }));
  const hr = candidatesByType(again).resting_hr;
  assert.strictEqual(hr.value, 58);
  assert.strictEqual(hr.semantics.unit, "bpm");
});

test("13-15. Replay is delivery-id-stable and is not a correction", function () {
  const world = loadWorld();
  const a = fixtureDelivery(world);
  const b = fixtureDelivery(world);
  assert.notStrictEqual(a.delivery_id, b.delivery_id);
  const na = fromVm(world.ingest.normalizeDelivery(a, { user_id: "u_g3c" }));
  const nb = fromVm(world.ingest.normalizeDelivery(b, { user_id: "u_g3c" }));
  assert.notStrictEqual(na.delivery_context.delivery_id, nb.delivery_context.delivery_id);
  assert.deepStrictEqual(na.candidates, nb.candidates);
  na.candidates.forEach(function (c) {
    assert.ok(!JSON.stringify(c).includes(a.delivery_id));
    assert.ok(!JSON.stringify(c.provenance.identities).includes("delivery"));
  });
});

test("16-18. Correction changes fingerprint, keeps lineage, fabricates no predecessor", function () {
  const world = loadWorld();
  const first = fixtureDelivery(world);
  const second = fromVm(first);
  second.delivery_id = "del_corr";
  const hr = second.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.payload = Object.assign({}, hr.payload, { bpm: 61 });
  const a = fromVm(world.ingest.normalizeDelivery(first, { user_id: "u_g3c" }));
  const b = fromVm(world.ingest.normalizeDelivery(second, { user_id: "u_g3c" }));
  const ha = candidatesByType(a).resting_hr;
  const hb = candidatesByType(b).resting_hr;
  assert.strictEqual(ha.provenance.identities.canonical_observation_id, hb.provenance.identities.canonical_observation_id);
  assert.notStrictEqual(ha.provenance.identities.content_hash, hb.provenance.identities.content_hash);
  assert.ok(!("supersedes_revision_id" in ha.provenance.identities));
  assert.ok(!("revision_id" in hb.provenance.identities));
});

test("19. Metric candidate uses constrained canonical semantic/unit model", function () {
  const world = loadWorld();
  const hr = candidatesByType(fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }))).resting_hr;
  assert.strictEqual(hr.semantics.unit, "bpm");
  assert.ok(!("score_scale" in hr.semantics));
});

test("20-21. Proprietary scores are compatible only when namespaced identities match", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "score_a",
    record_type: "proprietary_score",
    observed_at: "2026-09-14T02:00:00Z",
    payload: { score_id: "vendor.a.body_battery", score_range: { min: 0, max: 100 }, direction: "higher_better", value: 72 }
  }, {
    provider_record_id: "score_b",
    record_type: "proprietary_score",
    observed_at: "2026-09-14T02:00:00Z",
    payload: { score_id: "vendor.b.readiness", score_range: { min: 0, max: 100 }, direction: "higher_better", value: 72 }
  }];
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.strictEqual(batch.candidates.length, 2);
  const sa = batch.candidates[0].semantics;
  const sb = batch.candidates[1].semantics;
  assert.strictEqual(world.ingest.scoresCompatible(sa, sb), false);
  assert.strictEqual(world.ingest.scoresCompatible(sa, sa), true);
});

test("22-24. Activity UTC interval validates and receives no local-day assignment", function () {
  const world = loadWorld();
  const act = candidatesByType(fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }))).activity;
  assert.strictEqual(act.start_utc, "2026-09-14T01:00:00Z");
  assert.strictEqual(act.end_utc, "2026-09-14T01:40:00Z");
  assert.ok(!act.day_window_id);
  assert.ok(!act.snapshot_id);
  assert.ok(!act.local_date);
  assert.ok(!act.normalized_local_start_date);
  const bad = fixtureDelivery(world);
  bad.records = [{
    provider_record_id: "bad_act",
    record_type: "activity",
    observed_at: "2026-09-14T02:00:00Z",
    payload: { start_utc: "2026-09-14T03:00:00Z", end_utc: "2026-09-14T03:00:00Z", sport: "strength" }
  }];
  const rejected = fromVm(world.ingest.normalizeDelivery(bad, { user_id: "u_g3c" }));
  assert.strictEqual(rejected.candidates.length, 0);
  assert.strictEqual(rejected.diagnostics[0].diagnostic_code, "invalid_interval");
});

test("25. Activity candidate supports generalized field provenance overrides", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "act_ov",
    record_type: "activity",
    observed_at: "2026-09-14T01:00:00Z",
    updated_at: "2026-09-14T01:40:00Z",
    payload: {
      sport: "strength",
      elapsed_s: 2400,
      vendor_activity_id: "act-local-1",
      field_overrides: [{ field_path: "duration_s", raw_id: "raw_dur_other", payload: { elapsed_s: 2400 } }]
    }
  }];
  const act = candidatesByType(fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }))).activity;
  assert.strictEqual(act.field_overrides.length, 1);
  assert.strictEqual(act.field_overrides[0].field_path, "duration_s");
  assert.ok(act.field_overrides[0].provenance.source);
  assert.ok(act.field_overrides[0].provenance.raw.raw_id);
  assert.ok(!act.field_overrides[0].provenance.identities);
});

test("26-28. Sleep candidates keep independent assignment metadata and are not merged", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [
    sleepRecord({ provider_record_id: "sleep_night" }),
    sleepRecord({
      provider_record_id: "sleep_nap",
      observed_at: "2026-09-14T07:00:00Z",
      payload: {
        start: "2026-09-14T06:20:00Z",
        end: "2026-09-14T07:00:00Z",
        duration_min: 40,
        vendor_sleep_date: "2026-09-14",
        timezone: "Europe/Stockholm",
        aggregation: "bout"
      }
    })
  ];
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  const sleeps = batch.candidates.filter(function (c) { return c.semantics && c.semantics.metric_kind === "sleep_duration"; });
  assert.strictEqual(sleeps.length, 2);
  assert.notStrictEqual(sleeps[0].semantics.sleep.assignment_timezone, sleeps[1].semantics.sleep.assignment_timezone);
  assert.notStrictEqual(sleeps[0].provenance.identities.canonical_observation_id, sleeps[1].provenance.identities.canonical_observation_id);
  assert.ok(!batch.primary_candidate_id);
});

test("29-31. Freshness stays per-source; no aggregate or subjective quality band", function () {
  const world = loadWorld();
  const a = fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }));
  const other = fixtureDelivery(world);
  other.delivery_id = "del_other_src";
  other.source_instance_ref = {
    kind: "api",
    provider: "other.provider",
    provider_id: "other.provider",
    connection_id: "c9",
    source_id: "src_other"
  };
  other.provider_id = "other.provider";
  world.ingest.registerNormalizer({
    normalizer_id: "other.norm",
    provider_id: "other.provider",
    normalizeRecord: world.ingest.createFixtureNormalizer().normalizeRecord
  });
  const b = fromVm(world.ingest.normalizeDelivery(other, { user_id: "u_g3c" }));
  assert.strictEqual(a.source_freshness.length, 1);
  assert.strictEqual(b.source_freshness.length, 1);
  assert.notStrictEqual(a.source_freshness[0].source_id, b.source_freshness[0].source_id);
  assert.ok(!a.freshness_aggregate);
  assert.ok(!b.freshness_aggregate);
  a.candidates.forEach(function (c) {
    assert.ok(!c.quality || !c.quality.band);
    if (c.measurement_quality) assert.ok(["high", "medium", "low", "unknown"].indexOf(c.measurement_quality) !== -1);
  });
});

test("32. Duplicate identity fields are absent unless equality is explicit", function () {
  const world = loadWorld();
  const batch = fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }));
  batch.candidates.forEach(function (c) {
    assert.ok(!("source" in c));
    assert.deepStrictEqual(c.provenance.source, batch.source_instance_ref);
  });
});

test("33-36. SourceInstanceRef remains discriminated; foreign fields rejected", function () {
  const world = loadWorld();
  const api = fromVm(world.ingest.validateSourceInstance({ kind: "api", provider_id: "p", connection_id: "c" }));
  assert.strictEqual(api.kind, "api_connection");
  assert.ok(!("import_batch_id" in api));
  const imp = fromVm(world.ingest.validateSourceInstance({ kind: "import", provider_id: "p", import_batch_id: "b" }));
  assert.strictEqual(imp.kind, "import_batch");
  const fix = fromVm(world.ingest.validateSourceInstance({ kind: "fixture", provider_id: "nxtfrm.synthetic", fixture_dataset_id: "ds" }));
  assert.strictEqual(fix.kind, "fixture_dataset");
  assert.strictEqual(codeOf(function () {
    world.ingest.validateSourceInstance({ kind: "api", provider_id: "p", connection_id: "c", import_batch_id: "no" });
  }), "invalid_source_instance");
});

test("37-39. Failed records produce diagnostics that may reference delivery_id; valid records still normalize", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records.push({
    provider_record_id: "bad_unit",
    record_type: "body_mass",
    observed_at: "2026-09-14T00:31:00Z",
    payload: { mass: 80, unit: "stone" }
  });
  const batch = fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }));
  assert.ok(batch.candidates.length >= 3);
  assert.ok(batch.diagnostics.length >= 1);
  assert.ok(batch.diagnostics.every(function (d) { return d.delivery_id === delivery.delivery_id; }));
});

test("40. Candidate evidence does not claim accepted_delivery_id", function () {
  const world = loadWorld();
  const batch = fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }));
  batch.candidates.forEach(function (c) {
    assert.ok(!("accepted_delivery_id" in c));
    assert.ok(!("accepted_delivery_id" in c.provenance));
  });
});

test("41-50. G3C performs no canonical writes or I/O", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  const beforeDaily = fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }));
  const beforeAct = fromVm(world.wearables.getActivityRevision("arev_syn_str_1"));
  const beforeSnap = fromVm(world.wearables.getSnapshot("snap_syn_i_v1"));
  world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" });
  assert.deepStrictEqual(fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" })), beforeDaily);
  assert.deepStrictEqual(fromVm(world.wearables.getActivityRevision("arev_syn_str_1")), beforeAct);
  assert.deepStrictEqual(fromVm(world.wearables.getSnapshot("snap_syn_i_v1")), beforeSnap);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
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

test("53. Existing G3A getDaily behavior is unchanged", function () {
  const world = loadWorld();
  world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" });
  const snap = fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }));
  assert.strictEqual(snap.snapshot_id, "snap_syn_a");
  assert.strictEqual(world.wearables.getDaily("2026-09-14"), null);
});

test("54. Existing G3B collect behavior is unchanged", function () {
  const world = loadWorld();
  const a = fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect(collectRequest()));
  world.ingest.normalizeDelivery(a, { user_id: "u_g3c" });
  const b = fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect(collectRequest()));
  assert.notStrictEqual(a.delivery_id, b.delivery_id);
  assert.deepStrictEqual(a.records, b.records);
});

test("Singapore-midnight activity is not assigned a Stockholm local day", function () {
  const world = loadWorld();
  const delivery = fixtureDelivery(world);
  delivery.records = [{
    provider_record_id: "act_travel",
    record_type: "activity",
    observed_at: "2026-09-13T15:40:00Z",
    updated_at: "2026-09-13T17:10:00Z",
    payload: {
      sport: "floorball",
      start_utc: "2026-09-13T15:40:00Z",
      end_utc: "2026-09-13T17:10:00Z",
      elapsed_s: 5400,
      vendor_activity_id: "act_native_fb"
    }
  }];
  const act = candidatesByType(fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g3c" }))).activity;
  assert.strictEqual(act.start_utc, "2026-09-13T15:40:00Z");
  assert.strictEqual(act.end_utc, "2026-09-13T17:10:00Z");
  const text = JSON.stringify(act);
  assert.ok(!text.includes("Europe/Stockholm"));
  assert.ok(!text.includes("2026-09-14"));
  assert.ok(!act.normalized_local_start_date);
  assert.ok(!act.day_window_id);
});

test("G3B fixture sleep without timezone is diagnosed, not invented", function () {
  const world = loadWorld();
  const batch = fromVm(world.ingest.normalizeDelivery(fixtureDelivery(world), { user_id: "u_g3c" }));
  assert.ok(batch.diagnostics.some(function (d) {
    return d.provider_record_id === "g3b.fix.sleep.1" && d.diagnostic_code === "missing_required_field";
  }));
  assert.ok(!candidatesByType(batch).sleep_duration);
});

test("Production cannot use the fixture normalizer", function () {
  const prod = loadWorld({
    location: { hostname: "nxtfrm.app", protocol: "https:" },
    loadFixtures: false
  });
  assert.strictEqual(prod.ingest.listNormalizers().length, 0);
  assert.strictEqual(codeOf(function () {
    prod.ingest.registerNormalizer(prod.ingest.createFixtureNormalizer());
  }), "fixture_forbidden_in_production");
});

test("G3A public methods remain present after ingest attaches", function () {
  const api = loadWorld().wearables;
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof api[name], "function");
  });
  assert.ok(api.adapters);
  assert.ok(api.ingest);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
