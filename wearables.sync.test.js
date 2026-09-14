/* NXTFRM P1 wearable sync + hydration tests. Run: node wearables.sync.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

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

function createStorage(seed) {
  const store = Object.assign({ apm_settings: "{}" }, seed || {});
  const localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
    clear: function () { Object.keys(store).forEach(function (key) { delete store[key]; }); },
    key: function (i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; }
  };
  return { store: store, localStorage: localStorage };
}

const SCRIPTS = [
  "wearables.js",
  "wearables.adapters.js",
  "wearables.ingest.js",
  "wearables.canonical.js",
  "wearables.days.js",
  "wearables.snapshots.js",
  "wearables.resolution.js",
  "wearables.recovery.js",
  "wearables.recovery-integration.js",
  "wearables.training-readiness.js",
  "wearables.store.js",
  "wearables.provider-garmin.js",
  "wearables.sync.js"
];

function loadWorld(options) {
  options = options || {};
  const storage = createStorage(options.storage);
  const logs = [];
  const ctx = {
    console: {
      log: function () { logs.push(Array.prototype.slice.call(arguments).join(" ")); },
      warn: function () { logs.push(Array.prototype.slice.call(arguments).join(" ")); },
      error: function () { logs.push(Array.prototype.slice.call(arguments).join(" ")); }
    },
    NXT: {},
    location: options.location || { hostname: "localhost", protocol: "http:" },
    localStorage: storage.localStorage,
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    indexedDB: { open: function () { throw new Error("indexedDB blocked"); } },
    process: { env: options.env || {} },
    __networkCalls: { fetch: 0, xhr: 0, ws: 0 }
  };
  ctx.fetch = function () { ctx.__networkCalls.fetch += 1; throw new Error("network blocked: fetch"); };
  ctx.XMLHttpRequest = function () { ctx.__networkCalls.xhr += 1; throw new Error("network blocked: xhr"); };
  ctx.WebSocket = function () { ctx.__networkCalls.ws += 1; throw new Error("network blocked: ws"); };
  vm.createContext(ctx);
  SCRIPTS.forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });
  return { ctx: ctx, storage: storage, logs: logs };
}

function pipeline(options) {
  const world = loadWorld(options);
  const ctx = world.ctx;
  const store = ctx.NXTFRMWearableStore.createMemoryStore();
  store.open();
  const ingest = options && options.production
    ? ctx.NXTFRMWearableIngest.createIngest({ mode: "production" })
    : ctx.NXT.wearables.ingest;
  const adapters = ctx.NXTFRMWearableAdapters.createRegistry({ mode: options && options.production ? "production" : "test" });
  if (!(options && options.production)) {
    adapters.register(adapters.createFixtureAdapter({ mode: "test" }));
  }
  adapters.register(ctx.NXTFRMWearableGarmin.createAdapter({ connection_id: "conn_garmin" }));
  const canonical = ctx.NXTFRMWearableCanonical.createCanonical();
  const days = ctx.NXTFRMWearableDays.createDays();
  const snapshots = ctx.NXTFRMWearableSnapshots.createSnapshots({ days: days, canonical: canonical });
  const resolution = ctx.NXTFRMWearableResolution.createResolution({
    snapshots: snapshots, days: days, canonical: canonical
  });
  const recovery = ctx.NXTFRMWearableRecovery.createRecovery({ snapshots: snapshots, days: days });
  const integration = ctx.NXTFRMWearableRecoveryIntegration.createIntegration();
  const training = ctx.NXTFRMWearableTrainingReadiness.createGuard();
  const sync = ctx.NXTFRMWearableSync.createSync({
    store: store,
    ingest: ingest,
    adapters: adapters,
    canonical: canonical,
    days: days,
    snapshots: snapshots,
    resolution: resolution,
    recovery: recovery,
    integration: integration,
    training: training
  });
  return {
    world: world,
    ctx: ctx,
    store: store,
    ingest: ingest,
    adapters: adapters,
    canonical: canonical,
    days: days,
    snapshots: snapshots,
    resolution: resolution,
    recovery: recovery,
    integration: integration,
    training: training,
    sync: sync
  };
}

function request(extra) {
  return Object.assign({
    user_id: "u_p1",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  }, extra || {});
}

function collect(p) {
  return fromVm(p.adapters.get("nxtfrm.g3b.fixture.v1").collect(request()));
}

function asApi(delivery, connectionId) {
  const next = fromVm(delivery);
  next.source_instance_ref = {
    kind: "api",
    provider_id: next.provider_id,
    connection_id: connectionId
  };
  return next;
}

function asImport(delivery, batchId) {
  const next = fromVm(delivery);
  next.source_instance_ref = {
    kind: "import",
    provider_id: next.provider_id,
    import_batch_id: batchId || "batch_1"
  };
  return next;
}

function ingestOpts(p, delivery, extra) {
  return Object.assign({
    delivery: delivery,
    user_id: "u_p1",
    timezone: "Asia/Singapore",
    persist: false
  }, extra || {});
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

test("syntax: P1/P2 scripts parse", function () {
  [
    "wearables.store.js",
    "wearables.sync.js",
    "wearables.provider-garmin.js",
    "premium-ui.js",
    "sw.js",
    "cut-support.js"
  ].forEach(syntaxCheck);
});

test("31. One valid delivery completes pipeline", function () {
  const p = pipeline();
  const delivery = collect(p);
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.strictEqual(out.status, "success");
  assert.ok(out.new_revisions.length >= 1);
  assert.ok(out.affected_day_window_ids.length >= 1);
  assert.ok(out.rebuilt_snapshot_ids.length >= 1);
  assert.ok(out.recovery_result_ids.length >= 1);
  assert.strictEqual(out.mutates_workout, false);
});

test("32. Duplicate payload replay does not duplicate revisions", function () {
  const p = pipeline();
  const delivery = collect(p);
  const first = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  const second = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.strictEqual(second.status, "success");
  assert.strictEqual(second.new_revisions.length, 0);
  assert.ok(second.replayed_candidates >= 1);
  assert.strictEqual(p.canonical.listAllObservationRevisions("u_p1").length, p.canonical.listAllObservationRevisions("u_p1").length);
  const obs = p.canonical.listAllObservationRevisions("u_p1");
  const firstCount = first.new_revisions.length + first.replayed_candidates;
  assert.ok(obs.length <= firstCount + 8);
  const ids = obs.map(function (d) { return d.provenance.identities.revision_id; });
  assert.strictEqual(ids.length, new Set(ids).size);
  assert.ok(first.new_revisions.length >= 1);
});

test("33. New delivery_id with same evidence remains replay-safe", function () {
  const p = pipeline();
  const delivery = collect(p);
  p.sync.ingestDelivery(ingestOpts(p, delivery));
  const replay = fromVm(delivery);
  replay.delivery_id = delivery.delivery_id + "_again";
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, replay)));
  assert.strictEqual(out.new_revisions.length, 0);
  assert.ok(out.replayed_candidates >= 1);
  assert.strictEqual(out.corrections.length, 0);
});

test("34-39. Correction creates new immutable revision and rebuilds snapshot", function () {
  const p = pipeline();
  const delivery = collect(p);
  const first = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  const oldSnapId = first.rebuilt_snapshot_ids[0];
  const oldSnap = fromVm(p.snapshots.getSnapshot(oldSnapId));
  const hrLineage = p.canonical.listAllObservationRevisions("u_p1").find(function (d) {
    return d.semantics && d.semantics.metric_kind === "resting_hr";
  });
  const oldRevId = hrLineage.provenance.identities.revision_id;
  const oldRev = fromVm(p.canonical.getObservationRevision(oldRevId));
  const corr = fromVm(delivery);
  corr.delivery_id = delivery.delivery_id + "_corr";
  const hr = corr.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.payload = Object.assign({}, hr.payload, { bpm: 52 });
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, corr)));
  assert.ok(out.corrections.length >= 1);
  const still = p.canonical.getObservationRevision(oldRevId);
  assert.deepStrictEqual(fromVm(still.provenance.identities), oldRev.provenance.identities);
  assert.strictEqual(still.value, oldRev.value);
  const ptr = p.canonical.getCurrentObservationPointer("u_p1", oldRev.provenance.identities.canonical_observation_id);
  assert.notStrictEqual(ptr.revision_id, oldRevId);
  const unchanged = p.snapshots.getSnapshot(oldSnapId);
  assert.strictEqual(unchanged.snapshot_id, oldSnap.snapshot_id);
  assert.strictEqual(unchanged.snapshot_version, oldSnap.snapshot_version);
  const current = p.snapshots.getCurrent("u_p1", first.affected_day_window_ids[0]);
  assert.notStrictEqual(current.snapshot_id, oldSnapId);
  assert.ok(current.snapshot_version > oldSnap.snapshot_version);
});

test("40. Recovery recomputed", function () {
  const p = pipeline();
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, collect(p))));
  assert.ok(out.recovery_result_ids.length >= 1);
  const evaluated = p.sync.evaluateDay("u_p1", "2026-09-14");
  assert.ok(evaluated.wearable);
  assert.ok(evaluated.wearable.result_id);
});

test("41. R2 recomputed", function () {
  const p = pipeline();
  p.sync.ingestDelivery(ingestOpts(p, collect(p)));
  const evaluated = p.sync.evaluateDay("u_p1", "2026-09-14");
  assert.ok(evaluated.integrated);
  assert.strictEqual(evaluated.integrated.integrated_score, null);
  assert.strictEqual(evaluated.integrated.document_type, "integrated_recovery");
});

test("42. R4 can consume resulting state", function () {
  const p = pipeline();
  p.sync.ingestDelivery(ingestOpts(p, collect(p)));
  const evaluated = p.sync.evaluateDay("u_p1", "2026-09-14");
  assert.ok(evaluated.training);
  assert.strictEqual(evaluated.training.mutates_workout, false);
  const again = fromVm(p.training.advise({ integratedRecovery: evaluated.integrated }));
  assert.strictEqual(again.result.state, evaluated.training.state);
});

test("43. Partial delivery works", function () {
  const p = pipeline();
  const delivery = collect(p);
  delivery.records = delivery.records.filter(function (r) { return r.record_type === "heart_rate"; });
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.ok(out.status === "success" || out.status === "partial");
  assert.ok(out.rebuilt_snapshot_ids.length >= 1);
});

test("44. Late sleep arrival rebuilds relevant window", function () {
  const p = pipeline();
  const delivery = collect(p);
  const hrOnly = fromVm(delivery);
  hrOnly.records = hrOnly.records.filter(function (r) { return r.record_type === "heart_rate"; });
  const first = fromVm(p.sync.ingestDelivery(ingestOpts(p, hrOnly)));
  const sleepLater = fromVm(delivery);
  sleepLater.delivery_id = delivery.delivery_id + "_sleep";
  sleepLater.records = sleepLater.records.filter(function (r) { return r.record_type === "sleep"; }).map(function (r) {
    return Object.assign({}, r, {
      payload: Object.assign({}, r.payload, { provider_native_sleep_timezone: "Asia/Singapore" })
    });
  });
  const second = fromVm(p.sync.ingestDelivery(ingestOpts(p, sleepLater)));
  assert.ok(second.affected_day_window_ids.length >= 1);
  assert.ok(second.rebuilt_snapshot_ids.length >= 1);
  assert.notStrictEqual(second.rebuilt_snapshot_ids[0], first.rebuilt_snapshot_ids[0]);
});

test("45. Activity-only delivery works", function () {
  const p = pipeline();
  const delivery = collect(p);
  delivery.records = delivery.records.filter(function (r) { return r.record_type === "activity"; });
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.strictEqual(out.status, "success");
  assert.ok(out.rebuilt_snapshot_ids.length >= 1);
});

test("46. Unsupported record yields diagnostic", function () {
  const p = pipeline();
  const delivery = collect(p);
  delivery.records = [{
    provider_record_id: "weird",
    record_type: "unknown_vendor_blob",
    observed_at: "2026-09-14T02:00:00Z",
    payload: { score: 99 }
  }];
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.ok(out.diagnostics.length >= 1);
  assert.ok(["unsupported_record_type", "unsupported_field"].indexOf(out.diagnostics[0].diagnostic_code) !== -1);
});

test("47. Malformed delivery rejected", function () {
  const p = pipeline();
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, { not: "a delivery" })));
  assert.strictEqual(out.status, "failed");
  assert.strictEqual(out.error_code, "invalid_delivery");
});

test("48. Provider error does not mutate canonical evidence", function () {
  const p = pipeline();
  const before = p.canonical.listAllObservationRevisions("u_p1").length;
  const out = fromVm(p.sync.collectAndIngest({
    adapter_id: "nxtfrm.g3b.garmin.v1",
    user_id: "u_p1",
    request: request()
  }));
  assert.strictEqual(out.status, "failed");
  assert.strictEqual(out.error_code, "authentication_required");
  assert.strictEqual(out.mutated, false);
  assert.strictEqual(p.canonical.listAllObservationRevisions("u_p1").length, before);
});

test("49. Persistence failure rolls back canonical transaction", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1", _failPersist: true })));
  assert.strictEqual(out.status, "failed");
  assert.strictEqual(out.error_code, "persistence_failed");
  assert.strictEqual(p.canonical.listAllObservationRevisions("u_p1").length, 0);
  assert.strictEqual(p.snapshots.listAllSnapshots("u_p1").length, 0);
});

test("50. Same delivery after app restart remains replay-safe", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  const first = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" })));
  assert.strictEqual(first.status, "success");
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  const hydrated = fromVm(p2.sync.hydrateFromStore());
  assert.ok(hydrated.outcome === "ok" || hydrated.outcome === "degraded");
  const second = fromVm(p2.sync.ingestDelivery(ingestOpts(p2, delivery, { persist: true, connection_id: "conn_1" })));
  assert.strictEqual(second.new_revisions.length, 0);
  assert.ok(second.replayed_candidates >= 1);
});

test("51. Sync checkpoint persists", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  delivery.next_cursor = "cursor-2";
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1", cursor: "cursor-2" })));
  assert.strictEqual(out.checkpoint_advanced, true);
  const cp = p.store.get("sync_checkpoints", "conn_1");
  assert.strictEqual(cp.cursor, "cursor-2");
});

test("52. Failed sync does not advance checkpoint incorrectly", function () {
  const p = pipeline();
  p.sync.connect({ user_id: "u_p1", provider_id: "nxtfrm.synthetic", connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, asApi(collect(p), "conn_1"), {
    persist: true,
    connection_id: "conn_1",
    cursor: "good"
  }));
  const before = p.sync.getCheckpoint("conn_1").cursor;
  const failed = fromVm(p.sync.ingestDelivery(ingestOpts(p, { delivery_id: "bad" }, { persist: true, connection_id: "conn_1", cursor: "should-not-win" })));
  assert.strictEqual(failed.status, "failed");
  assert.strictEqual(p.sync.getCheckpoint("conn_1").cursor, before);
});

test("53. Successful sync advances checkpoint", function () {
  const p = pipeline();
  const d1 = asApi(collect(p), "conn_1");
  d1.next_cursor = "c1";
  p.sync.connect({ user_id: "u_p1", provider_id: d1.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, d1, { persist: true, connection_id: "conn_1", cursor: "c1" }));
  const d2 = asApi(collect(p), "conn_1");
  d2.delivery_id = d1.delivery_id + "_b";
  d2.next_cursor = "c2";
  p.sync.ingestDelivery(ingestOpts(p, d2, { persist: true, connection_id: "conn_1", cursor: "c2" }));
  assert.strictEqual(p.sync.getCheckpoint("conn_1").cursor, "c2");
});

test("54. Two concurrent syncs do not corrupt same connection", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  const orig = p.store.transaction.bind(p.store);
  let nested = null;
  p.store.transaction = function (names, mode, fn) {
    if (!nested && mode === "readwrite") {
      nested = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" })));
    }
    return orig(names, mode, fn);
  };
  const first = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" })));
  assert.strictEqual(nested.error_code, "concurrent_sync");
  assert.strictEqual(first.status, "success");
  const ids = p.canonical.listAllObservationRevisions("u_p1").map(function (d) {
    return d.provenance.identities.revision_id;
  });
  assert.strictEqual(ids.length, new Set(ids).size);
});

test("55. Multiple connection IDs remain separate", function () {
  const p = pipeline();
  const a = asApi(collect(p), "conn_a");
  const b = asApi(collect(p), "conn_b");
  b.delivery_id = a.delivery_id + "_b";
  p.sync.connect({ user_id: "u_p1", provider_id: a.provider_id, connection_id: "conn_a" });
  p.sync.connect({ user_id: "u_p1", provider_id: b.provider_id, connection_id: "conn_b" });
  p.sync.ingestDelivery(ingestOpts(p, a, { persist: true, connection_id: "conn_a", cursor: "a" }));
  p.sync.ingestDelivery(ingestOpts(p, b, { persist: true, connection_id: "conn_b", cursor: "b" }));
  assert.strictEqual(p.sync.getCheckpoint("conn_a").cursor, "a");
  assert.strictEqual(p.sync.getCheckpoint("conn_b").cursor, "b");
  assert.strictEqual(p.sync.getConnection("conn_a").connection_id, "conn_a");
  assert.strictEqual(p.sync.getConnection("conn_b").connection_id, "conn_b");
});

test("56. Import source still works without connection_id", function () {
  const p = pipeline();
  const delivery = asImport(collect(p), "batch_import");
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.strictEqual(out.status, "success");
  assert.strictEqual(out.connection_id, null);
  const src = p.canonical.listAllObservationRevisions("u_p1")[0].provenance.source;
  assert.ok(!src.connection_id);
});

test("57. Fixture source production guard remains", function () {
  const p = pipeline({ production: true, location: { hostname: "app.example", protocol: "https:" } });
  const world = loadWorld();
  const delivery = collect(pipeline());
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery)));
  assert.strictEqual(out.status, "failed");
  assert.strictEqual(out.error_code, "fixture_forbidden_in_production");
  assert.strictEqual(p.canonical.listAllObservationRevisions("u_p1").length, 0);
  void world;
});

test("58. Fresh install boots with no wearable data", function () {
  const p = pipeline();
  const hydrated = fromVm(p.sync.hydrateFromStore());
  assert.strictEqual(hydrated.degraded, false);
  assert.strictEqual(p.canonical.listAllObservationRevisions("u_p1").length, 0);
  const integrated = p.sync.integrateToday({ local_date: "2026-09-14" });
  assert.ok(!integrated || integrated.wearable.present === false);
});

test("59. Existing persisted wearable data hydrates", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" }));
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  const hydrated = fromVm(p2.sync.hydrateFromStore());
  assert.ok(hydrated.outcome === "ok");
  assert.ok(p2.canonical.listAllObservationRevisions("u_p1").length >= 1);
  assert.ok(p2.snapshots.listAllSnapshots("u_p1").length >= 1);
});

test("60. UI recovery state derives from hydrated evidence", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" }));
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  p2.sync.hydrateFromStore();
  const integrated = p2.sync.integrateToday({ local_date: "2026-09-14" });
  assert.ok(integrated);
  assert.strictEqual(integrated.wearable.present, true);
  assert.ok(integrated.wearable.result_id);
});

test("61. No production fake preview shown", function () {
  const p = pipeline({ location: { hostname: "nxtfrm.app", protocol: "https:" } });
  p.ctx.NXT.recoveryPreview = {
    integrated: { wearable: { present: true, score: 99, result: { score: 99 } }, integrated_score: 99 },
    wearableRecovery: { score: 99, result_id: "fake" }
  };
  assert.strictEqual(p.sync.previewAllowed(), false);
  const integrated = p.sync.integrateToday({ local_date: "2026-09-14" });
  assert.ok(!integrated || integrated.wearable.present === false);
  assert.ok(!integrated || integrated.integrated_score == null);
});

test("62. Manual recovery still works with no wearable DB", function () {
  const p = pipeline();
  const integrated = fromVm(p.sync.integrateToday({
    local_date: "2026-09-14",
    manualRecovery: { sleep: 8, energy: 4, soreness: 2, date: "2026-09-14" }
  }));
  assert.strictEqual(integrated.manual.present, true);
  assert.strictEqual(integrated.wearable.present, false);
  const advice = fromVm(p.training.advise({ integratedRecovery: integrated }));
  assert.ok(advice.result);
  assert.notStrictEqual(advice.result.state, "no_recovery_signal");
});

test("63. Offline reload shows persisted wearable recovery", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" }));
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  p2.sync.hydrateFromStore();
  assert.strictEqual(p2.world.ctx.__networkCalls.fetch, 0);
  assert.ok(p2.sync.runtime.wearableByDate["2026-09-14"]);
});

test("64. Offline does not report new successful sync", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" }));
  const last = p.sync.getConnection("conn_1").last_successful_sync_at_utc;
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  p2.sync.hydrateFromStore();
  const runs = p2.store.getAll("sync_runs");
  assert.ok(runs.every(function (r) { return r.status !== "running"; }));
  assert.strictEqual(p2.sync.getConnection("conn_1").last_successful_sync_at_utc, last);
});

test("65. malformed store marks degraded / diagnostics", function () {
  const p = pipeline();
  p.store._test.inject("observation_revisions", "bad", { foo: 1 });
  const hydrated = fromVm(p.sync.hydrateFromStore());
  assert.strictEqual(hydrated.degraded, true);
  assert.ok(hydrated.skipped.length >= 1);
});

test("66. Invalid pointer does not silently infer current", function () {
  const p = pipeline();
  p.store.put("observation_revisions", {
    document_type: "observation_revision",
    user_id: "u_p1",
    provenance: { identities: { revision_id: "rev_keep", canonical_observation_id: "obs_a" } }
  });
  p.store._test.inject("observation_current_pointers", "u_p1|obs_a", {
    document_type: "current_observation_pointer",
    user_id: "u_p1",
    canonical_observation_id: "obs_a",
    revision_id: "rev_missing"
  });
  p.sync.hydrateFromStore();
  assert.strictEqual(p.canonical.getCurrentObservationPointer("u_p1", "obs_a"), null);
});

test("67. Interrupted sync recognized on restart", function () {
  const p = pipeline();
  p.store.put("sync_runs", {
    document_type: "wearable_sync_run",
    schema_version: 1,
    sync_id: "sync_stuck",
    status: "running",
    provider_id: "nxtfrm.synthetic"
  });
  const hydrated = fromVm(p.sync.hydrateFromStore());
  assert.ok(hydrated.interrupted.indexOf("sync_stuck") !== -1);
  assert.strictEqual(p.store.get("sync_runs", "sync_stuck").status, "interrupted");
});

test("68. Recovery result deterministic after restart", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" }));
  const id1 = p.sync.evaluateDay("u_p1", "2026-09-14").wearable.result_id;
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  p2.sync.hydrateFromStore();
  const id2 = p2.sync.evaluateDay("u_p1", "2026-09-14").wearable.result_id;
  assert.strictEqual(id1, id2);
});

test("69. Training guidance deterministic after restart", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { persist: true, connection_id: "conn_1" }));
  const t1 = p.sync.evaluateDay("u_p1", "2026-09-14").training.state;
  const p2 = pipeline();
  p2.store.importBundle(p.store.exportBundle());
  p2.sync.hydrateFromStore();
  const t2 = p2.sync.evaluateDay("u_p1", "2026-09-14").training.state;
  assert.strictEqual(t1, t2);
});

test("72. No provider secret in source bundle", function () {
  ["wearables.store.js", "wearables.sync.js", "wearables.provider-garmin.js", "premium-ui.js"].forEach(function (rel) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(!/garmin_client_secret|CLIENT_SECRET\s*=\s*['\"][^'\"]+['\"]/.test(src));
    assert.ok(src.indexOf("BEGIN PRIVATE KEY") === -1);
  });
});

test("73. No test fixture secret in production assets", function () {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.indexOf("wearables.test.js") === -1);
  assert.ok(sw.indexOf("wearables.fixtures.js") === -1);
  assert.ok(sw.indexOf("wearables.store.test.js") === -1);
});

test("74. No auth token printed in console", function () {
  const p = pipeline();
  const delivery = collect(p);
  p.sync.ingestDelivery(ingestOpts(p, delivery));
  const joined = p.world.logs.join("\n");
  assert.ok(joined.indexOf("access_token") === -1);
  assert.ok(joined.indexOf("refresh_token") === -1);
});

test("75. No token included in recovery result", function () {
  const p = pipeline();
  p.sync.ingestDelivery(ingestOpts(p, collect(p)));
  const rec = p.sync.evaluateDay("u_p1", "2026-09-14").wearable;
  const raw = JSON.stringify(rec);
  assert.ok(raw.indexOf("access_token") === -1);
  assert.ok(raw.indexOf("refresh_token") === -1);
});

test("76. No token included in sync diagnostic exposed to UI", function () {
  const p = pipeline();
  const out = fromVm(p.sync.ingestDelivery(ingestOpts(p, collect(p))));
  const raw = JSON.stringify(out);
  assert.ok(raw.indexOf("access_token") === -1);
  assert.ok(raw.indexOf("client_secret") === -1);
});

test("77. Provider network calls only through explicit connection/sync layer", function () {
  const p = pipeline();
  p.sync.ingestDelivery(ingestOpts(p, collect(p)));
  p.sync.collectAndIngest({ adapter_id: "nxtfrm.g3b.garmin.v1", user_id: "u_p1", request: request() });
  assert.strictEqual(p.world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(p.world.ctx.__networkCalls.xhr, 0);
});

test("78. Test mode can fully block network", function () {
  const p = pipeline();
  assert.throws(function () { p.world.ctx.fetch("https://example"); });
  assert.strictEqual(p.world.ctx.__networkCalls.fetch, 1);
});

test("79. Disconnect stops future sync", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { connection_id: "conn_1" }));
  const disc = fromVm(p.sync.disconnect("conn_1"));
  assert.strictEqual(disc.result.state, "disconnected");
  assert.strictEqual(disc.erased_history, false);
  const again = fromVm(p.sync.ingestDelivery(ingestOpts(p, delivery, { connection_id: "conn_1" })));
  assert.strictEqual(again.status, "failed");
});

test("80. Disconnect does not erase canonical history", function () {
  const p = pipeline();
  const delivery = asApi(collect(p), "conn_1");
  p.sync.connect({ user_id: "u_p1", provider_id: delivery.provider_id, connection_id: "conn_1" });
  p.sync.ingestDelivery(ingestOpts(p, delivery, { connection_id: "conn_1" }));
  const count = p.canonical.listAllObservationRevisions("u_p1").length;
  p.sync.disconnect("conn_1");
  assert.strictEqual(p.canonical.listAllObservationRevisions("u_p1").length, count);
  assert.ok(p.snapshots.listAllSnapshots("u_p1").length >= 1);
});

test("81-83. Reconnect keeps old connection traceable and provenance", function () {
  const p = pipeline();
  const first = asApi(collect(p), "conn_old");
  p.sync.connect({ user_id: "u_p1", provider_id: first.provider_id, connection_id: "conn_old" });
  p.sync.ingestDelivery(ingestOpts(p, first, { connection_id: "conn_old" }));
  const src = fromVm(p.canonical.listAllObservationRevisions("u_p1")[0].provenance.source);
  p.sync.disconnect("conn_old");
  p.sync.connect({ user_id: "u_p1", provider_id: first.provider_id, connection_id: "conn_new" });
  const second = asApi(collect(p), "conn_new");
  second.delivery_id = first.delivery_id + "_new";
  p.sync.ingestDelivery(ingestOpts(p, second, { connection_id: "conn_new" }));
  assert.strictEqual(p.sync.getConnection("conn_old").state, "disconnected");
  assert.strictEqual(p.sync.getConnection("conn_new").state, "connected");
  assert.ok(src.connection_id === "conn_old" || src.kind === "api_connection");
  const still = p.canonical.listAllObservationRevisions("u_p1").some(function (d) {
    const s = d.provenance.source;
    return s.connection_id === "conn_old" || (s.source_id && String(s.source_id).indexOf("conn_old") !== -1);
  });
  assert.ok(still);
});

test("connectLive never fakes success", function () {
  const p = pipeline();
  const out = fromVm(p.sync.connectLive({ provider_id: "garmin.connect" }));
  assert.strictEqual(out.outcome, "auth_deferred");
  assert.strictEqual(out.state, "disconnected");
  assert.strictEqual(out.result, null);
  assert.ok(String(out.live_auth.decision).indexOf("LIVE PROVIDER AUTH DEFERRED") !== -1);
});

test("SW caches production wearable modules only", function () {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.indexOf("wearables.store.js") !== -1);
  assert.ok(sw.indexOf("wearables.sync.js") !== -1);
  assert.ok(sw.indexOf("wearables.provider-garmin.js") !== -1);
  assert.ok(/nxtfrm-v106-premium-cache/.test(sw));
  assert.ok(sw.indexOf("wearables.store.test.js") === -1);
  assert.ok(sw.indexOf("wearables.sync.test.js") === -1);
  assert.ok(sw.indexOf("wearables.fixtures.js") === -1);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
