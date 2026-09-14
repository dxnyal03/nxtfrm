/* NXTFRM G3D canonical-acceptance tests. Run: node wearables.canonical.test.js */
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
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    adapters: ctx.NXT.wearables.adapters,
    ingest: ctx.NXT.wearables.ingest,
    canonical: ctx.NXTFRMWearableCanonical.createCanonical()
  };
}

function request(extra) {
  return Object.assign({
    user_id: "u_g3d",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  }, extra || {});
}

function collect(world) {
  return fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect(request()));
}

function normalize(world, delivery, userId) {
  return fromVm(world.ingest.normalizeDelivery(delivery, { user_id: userId || "u_g3d" }));
}

function ctxFor(delivery, at) {
  return { delivery_id: delivery.delivery_id, accepted_at_utc: at || "2026-09-14T08:05:00Z" };
}

function metricOf(batch, kind) {
  return batch.candidates.find(function (c) {
    return c.candidate_kind === "metric_observation" && c.semantics.metric_kind === kind;
  });
}

function activityOf(batch) {
  return batch.candidates.find(function (c) { return c.candidate_kind === "activity"; });
}

function correctedMetric(world, delivery, bpm) {
  const next = fromVm(delivery);
  next.delivery_id = (delivery.delivery_id || "del") + "_corr";
  const hr = next.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.payload = Object.assign({}, hr.payload, { bpm: bpm });
  return { delivery: next, batch: normalize(world, next) };
}

function sleepDelivery(world, records) {
  const delivery = collect(world);
  delivery.records = records;
  return delivery;
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

test("syntax: G3A–G3D scripts parse", function () {
  [
    "wearables.js", "wearables.adapters.js", "wearables.ingest.js", "wearables.canonical.js",
    "wearables.test.js", "wearables.adapters.test.js", "wearables.ingest.test.js", "wearables.canonical.test.js",
    "sw.js", "cut-support.js", "premium-ui.js"
  ].forEach(syntaxCheck);
});

test("1-4. New metric candidate creates revision, pointer, no is_current, first delivery id", function () {
  const world = loadWorld();
  const delivery = collect(world);
  const batch = normalize(world, delivery);
  const cand = metricOf(batch, "resting_hr");
  const result = fromVm(world.canonical.acceptCandidate(cand, ctxFor(delivery)));
  assert.strictEqual(result.outcome, "accepted_new");
  const rev = fromVm(world.canonical.getObservationRevision(result.revision_id));
  const ptr = fromVm(world.canonical.getCurrentObservationPointer("u_g3d", result.lineage_id));
  assert.strictEqual(rev.document_type, "observation_revision");
  assert.strictEqual(rev.value, 58);
  assert.ok(!("is_current" in rev));
  assert.strictEqual(rev.provenance.accepted_delivery_id, delivery.delivery_id);
  assert.strictEqual(ptr.revision_id, rev.provenance.identities.revision_id);
  assert.strictEqual(ptr.document_type, "current_observation_pointer");
});

test("5-7. Metric replay under a new delivery is a no-op", function () {
  const world = loadWorld();
  const a = collect(world);
  const b = collect(world);
  assert.notStrictEqual(a.delivery_id, b.delivery_id);
  const ca = metricOf(normalize(world, a), "resting_hr");
  const cb = metricOf(normalize(world, b), "resting_hr");
  const first = fromVm(world.canonical.acceptCandidate(ca, ctxFor(a)));
  const before = JSON.stringify(fromVm(world.canonical.getObservationRevision(first.revision_id)));
  const replay = fromVm(world.canonical.acceptCandidate(cb, ctxFor(b, "2026-09-14T09:00:00Z")));
  assert.strictEqual(replay.outcome, "replay_current");
  assert.strictEqual(replay.revision_id, first.revision_id);
  const after = fromVm(world.canonical.getObservationRevision(first.revision_id));
  assert.strictEqual(after.provenance.accepted_delivery_id, a.delivery_id);
  assert.strictEqual(JSON.stringify(after), before);
  assert.strictEqual(world.canonical.listObservationRevisions("u_g3d", first.lineage_id).length, 1);
});

test("8-11. Metric correction appends, supersedes leaf, advances pointer, keeps R1", function () {
  const world = loadWorld();
  const a = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  const r1 = fromVm(world.canonical.getObservationRevision(first.revision_id));
  const corr = correctedMetric(world, a, 61);
  const second = fromVm(world.canonical.acceptCandidate(metricOf(corr.batch, "resting_hr"), ctxFor(corr.delivery, "2026-09-14T10:00:00Z")));
  assert.strictEqual(second.outcome, "accepted_correction");
  assert.strictEqual(second.supersedes_revision_id, first.revision_id);
  const r1b = fromVm(world.canonical.getObservationRevision(first.revision_id));
  const r2 = fromVm(world.canonical.getObservationRevision(second.revision_id));
  assert.deepStrictEqual(r1b, r1);
  assert.strictEqual(r2.value, 61);
  assert.strictEqual(r2.provenance.identities.supersedes_revision_id, first.revision_id);
  assert.strictEqual(world.canonical.getCurrentObservationPointer("u_g3d", first.lineage_id).revision_id, second.revision_id);
});

test("12-13. Historical replay of R1 does not roll back; R3 supersedes R2", function () {
  const world = loadWorld();
  const a = collect(world);
  const r1c = metricOf(normalize(world, a), "resting_hr");
  const first = fromVm(world.canonical.acceptCandidate(r1c, ctxFor(a)));
  const c2 = correctedMetric(world, a, 61);
  const second = fromVm(world.canonical.acceptCandidate(metricOf(c2.batch, "resting_hr"), ctxFor(c2.delivery, "2026-09-14T10:00:00Z")));
  const hist = fromVm(world.canonical.acceptCandidate(r1c, ctxFor({ delivery_id: "del_hist_r1" }, "2026-09-14T11:00:00Z")));
  assert.strictEqual(hist.outcome, "replay_historical");
  assert.strictEqual(world.canonical.getCurrentObservationPointer("u_g3d", first.lineage_id).revision_id, second.revision_id);
  const c3 = correctedMetric(world, a, 64);
  const third = fromVm(world.canonical.acceptCandidate(metricOf(c3.batch, "resting_hr"), ctxFor(c3.delivery, "2026-09-14T12:00:00Z")));
  assert.strictEqual(third.outcome, "accepted_correction");
  assert.strictEqual(third.supersedes_revision_id, second.revision_id);
  assert.notStrictEqual(third.supersedes_revision_id, first.revision_id);
});

test("14-17. Activity new, pointer, replay, unchanged accepted_delivery_id", function () {
  const world = loadWorld();
  const a = collect(world);
  const b = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(activityOf(normalize(world, a)), ctxFor(a)));
  assert.strictEqual(first.outcome, "accepted_new");
  const rev = fromVm(world.canonical.getActivityRevision(first.revision_id));
  assert.strictEqual(rev.document_type, "wearable_activity_revision");
  assert.ok(!("is_current" in rev));
  const ptr = fromVm(world.canonical.getCurrentActivityPointer("u_g3d", first.lineage_id));
  assert.strictEqual(ptr.activity_revision_id, first.revision_id);
  const replay = fromVm(world.canonical.acceptCandidate(activityOf(normalize(world, b)), ctxFor(b, "2026-09-14T09:00:00Z")));
  assert.strictEqual(replay.outcome, "replay_current");
  assert.strictEqual(world.canonical.getActivityRevision(first.revision_id).provenance.accepted_delivery_id, a.delivery_id);
  assert.strictEqual(world.canonical.listActivityRevisions("u_g3d", first.lineage_id).length, 1);
});

test("18-21. Activity correction, pointer advance, immutability, field overrides", function () {
  const world = loadWorld();
  const a = collect(world);
  a.records = [{
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
  const first = fromVm(world.canonical.acceptCandidate(activityOf(normalize(world, a)), ctxFor(a)));
  const r1 = fromVm(world.canonical.getActivityRevision(first.revision_id));
  assert.strictEqual(r1.field_overrides[0].field_path, "duration_s");
  assert.ok(!r1.field_overrides[0].provenance.identities);
  const b = fromVm(a);
  b.delivery_id = "del_act_corr";
  b.records[0].payload = Object.assign({}, b.records[0].payload, { elapsed_s: 2460 });
  const second = fromVm(world.canonical.acceptCandidate(activityOf(normalize(world, b)), ctxFor(b, "2026-09-14T10:00:00Z")));
  assert.strictEqual(second.outcome, "accepted_correction");
  assert.deepStrictEqual(fromVm(world.canonical.getActivityRevision(first.revision_id)), r1);
  assert.strictEqual(world.canonical.getCurrentActivityPointer("u_g3d", first.lineage_id).activity_revision_id, second.revision_id);
  assert.strictEqual(fromVm(world.canonical.getActivityRevision(second.revision_id)).field_overrides[0].field_path, "duration_s");
});

test("22-23. delivery_id is not in content hash; same evidence maps to one revision", function () {
  const world = loadWorld();
  const a = collect(world);
  const b = collect(world);
  const ca = metricOf(normalize(world, a), "resting_hr");
  const cb = metricOf(normalize(world, b), "resting_hr");
  assert.strictEqual(ca.provenance.identities.content_hash, cb.provenance.identities.content_hash);
  assert.ok(!JSON.stringify(ca.provenance.identities).includes(a.delivery_id));
  const r1 = fromVm(world.canonical.acceptCandidate(ca, ctxFor(a)));
  const r2 = fromVm(world.canonical.acceptCandidate(cb, ctxFor(b)));
  assert.strictEqual(r1.revision_id, r2.revision_id);
});

test("24-25. Duplicate revision id: same content is safe, conflict fails closed", function () {
  const world = loadWorld();
  const a = collect(world);
  const cand = metricOf(normalize(world, a), "resting_hr");
  const first = fromVm(world.canonical.acceptCandidate(cand, ctxFor(a)));
  const existing = fromVm(world.canonical.getObservationRevision(first.revision_id));
  world.canonical._test.installObservationRevision(existing);
  const again = fromVm(world.canonical.acceptCandidate(cand, ctxFor({ delivery_id: "del_dup_same" }, "2026-09-14T09:00:00Z")));
  assert.strictEqual(again.outcome, "replay_current");
  const conflict = fromVm(existing);
  conflict.value = 99;
  conflict.provenance.identities.content_hash = existing.provenance.identities.content_hash;
  world.canonical._test.installObservationRevision(conflict);
  const bad = fromVm(world.canonical.acceptCandidate(cand, ctxFor({ delivery_id: "del_dup_bad" }, "2026-09-14T09:30:00Z")));
  assert.strictEqual(bad.outcome, "integrity_conflict");
});

test("26. Missing superseded parent is detected", function () {
  const world = loadWorld();
  const a = collect(world);
  const cand = metricOf(normalize(world, a), "resting_hr");
  const first = fromVm(world.canonical.acceptCandidate(cand, ctxFor(a)));
  const r2 = fromVm(world.canonical.getObservationRevision(first.revision_id));
  world.canonical = world.ctx.NXTFRMWearableCanonical.createCanonical();
  r2.provenance.identities.revision_id = "rev_orphan";
  r2.provenance.identities.supersedes_revision_id = "missing-R1";
  world.canonical._test.installObservationRevision(r2);
  world.canonical._test.installObservationPointer({
    document_type: "current_observation_pointer",
    schema_version: "g1.2.1",
    user_id: "u_g3d",
    canonical_observation_id: r2.provenance.identities.canonical_observation_id,
    revision_id: "rev_orphan",
    advanced_at_utc: "2026-09-14T08:05:00Z",
    accepted_delivery_id: a.delivery_id
  });
  const chain = world.canonical.validateObservationChain("u_g3d", r2.provenance.identities.canonical_observation_id);
  assert.strictEqual(chain.status, "missing_parent");
});

test("27. Revision cycle is detected", function () {
  const world = loadWorld();
  const a = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  const r1 = fromVm(world.canonical.getObservationRevision(first.revision_id));
  const store = world.ctx.NXTFRMWearableCanonical.createCanonical();
  const a1 = fromVm(r1);
  const a2 = fromVm(r1);
  a1.provenance.identities.revision_id = "rev_cycle_1";
  a1.provenance.identities.supersedes_revision_id = "rev_cycle_2";
  a2.provenance.identities.revision_id = "rev_cycle_2";
  a2.provenance.identities.supersedes_revision_id = "rev_cycle_1";
  store._test.installObservationRevision(a1);
  store._test.installObservationRevision(a2);
  store._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g3d",
    canonical_observation_id: first.lineage_id, revision_id: "rev_cycle_1",
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: a.delivery_id
  });
  assert.strictEqual(store.validateObservationChain("u_g3d", first.lineage_id).status, "cycle");
});

test("28-29. Fork and multiple unsuperseded leaves are detected", function () {
  const world = loadWorld();
  const a = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  const r1 = fromVm(world.canonical.getObservationRevision(first.revision_id));
  const store = world.ctx.NXTFRMWearableCanonical.createCanonical();
  const rootRev = fromVm(r1);
  rootRev.provenance.identities.revision_id = "R1";
  rootRev.provenance.identities.supersedes_revision_id = null;
  const r2 = fromVm(r1);
  r2.provenance.identities.revision_id = "R2";
  r2.provenance.identities.supersedes_revision_id = "R1";
  r2.value = 61;
  const r3 = fromVm(r1);
  r3.provenance.identities.revision_id = "R3";
  r3.provenance.identities.supersedes_revision_id = "R1";
  r3.value = 62;
  store._test.installObservationRevision(rootRev);
  store._test.installObservationRevision(r2);
  store._test.installObservationRevision(r3);
  store._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g3d",
    canonical_observation_id: first.lineage_id, revision_id: "R2",
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: a.delivery_id
  });
  const status = store.validateObservationChain("u_g3d", first.lineage_id).status;
  assert.ok(status === "fork" || status === "multiple_leaves");
});

test("30-32. Pointer inconsistencies are detected", function () {
  const world = loadWorld();
  const a = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  const r1 = fromVm(world.canonical.getObservationRevision(first.revision_id));
  const store = world.ctx.NXTFRMWearableCanonical.createCanonical();
  store._test.installObservationRevision(r1);
  store._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g3d",
    canonical_observation_id: first.lineage_id, revision_id: "missing-rev",
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: a.delivery_id
  });
  assert.strictEqual(store.validateObservationChain("u_g3d", first.lineage_id).status, "pointer_missing_revision");
  const store2 = world.ctx.NXTFRMWearableCanonical.createCanonical();
  store2._test.installObservationRevision(r1);
  store2._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g3d",
    canonical_observation_id: "other_lineage", revision_id: first.revision_id,
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: a.delivery_id
  });
  assert.strictEqual(store2.validateObservationChain("u_g3d", first.lineage_id).status, "pointer_missing");
  const r2 = fromVm(r1);
  r2.provenance.identities.revision_id = "R2leaf";
  r2.provenance.identities.supersedes_revision_id = first.revision_id;
  const store3 = world.ctx.NXTFRMWearableCanonical.createCanonical();
  store3._test.installObservationRevision(r1);
  store3._test.installObservationRevision(r2);
  store3._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g3d",
    canonical_observation_id: first.lineage_id, revision_id: first.revision_id,
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: a.delivery_id
  });
  assert.strictEqual(store3.validateObservationChain("u_g3d", first.lineage_id).status, "pointer_non_leaf");
});

test("33-34. Unresolved chain blocks correction and does not mutate", function () {
  const world = loadWorld();
  const a = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  const r1 = fromVm(world.canonical.getObservationRevision(first.revision_id));
  const store = world.ctx.NXTFRMWearableCanonical.createCanonical();
  const rootRev = fromVm(r1);
  rootRev.provenance.identities.revision_id = "R1";
  const r2 = fromVm(r1); r2.provenance.identities.revision_id = "R2"; r2.provenance.identities.supersedes_revision_id = "R1";
  const r3 = fromVm(r1); r3.provenance.identities.revision_id = "R3"; r3.provenance.identities.supersedes_revision_id = "R1";
  store._test.installObservationRevision(rootRev);
  store._test.installObservationRevision(r2);
  store._test.installObservationRevision(r3);
  store._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g3d",
    canonical_observation_id: first.lineage_id, revision_id: "R2",
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: a.delivery_id
  });
  const before = JSON.stringify(fromVm(store.listObservationRevisions("u_g3d", first.lineage_id)));
  const corr = correctedMetric(world, a, 70);
  const out = fromVm(store.acceptCandidate(metricOf(corr.batch, "resting_hr"), ctxFor(corr.delivery)));
  assert.strictEqual(out.outcome, "unresolved_chain");
  assert.strictEqual(JSON.stringify(fromVm(store.listObservationRevisions("u_g3d", first.lineage_id))), before);
  assert.strictEqual(store.getCurrentObservationPointer("u_g3d", first.lineage_id).revision_id, "R2");
});

test("35-37. Same-source extra lineage and cross-source stay separate; no winner", function () {
  const world = loadWorld();
  const a = collect(world);
  const batch = normalize(world, a);
  const hr = metricOf(batch, "resting_hr");
  const mass = metricOf(batch, "body_mass");
  const r1 = fromVm(world.canonical.acceptCandidate(hr, ctxFor(a)));
  const r2 = fromVm(world.canonical.acceptCandidate(mass, ctxFor(a)));
  assert.notStrictEqual(r1.lineage_id, r2.lineage_id);
  const other = fromVm(a);
  other.delivery_id = "del_cross";
  other.provider_id = "other.provider";
  other.source_instance_ref = { kind: "api", provider_id: "other.provider", connection_id: "c9", source_id: "src_other" };
  world.ingest.registerNormalizer({
    normalizer_id: "other.norm",
    provider_id: "other.provider",
    normalizeRecord: world.ingest.createFixtureNormalizer().normalizeRecord
  });
  const cross = metricOf(normalize(world, other), "resting_hr");
  const r3 = fromVm(world.canonical.acceptCandidate(cross, ctxFor(other)));
  assert.notStrictEqual(r3.lineage_id, r1.lineage_id);
  assert.ok(world.canonical.getCurrentObservationPointer("u_g3d", r1.lineage_id));
  assert.ok(world.canonical.getCurrentObservationPointer("u_g3d", r3.lineage_id));
  assert.ok(!world.canonical.status().winner);
});

test("38-42. Sleep assignment persists; no winner, aggregate, or subjective quality", function () {
  const world = loadWorld();
  const delivery = sleepDelivery(world, [{
    provider_record_id: "sleep_night",
    record_type: "sleep",
    observed_at: "2026-09-13T23:50:00Z",
    payload: {
      start: "2026-09-13T16:20:00Z",
      end: "2026-09-13T23:50:00Z",
      duration_min: 450,
      vendor_sleep_date: "2026-09-14",
      timezone: "Asia/Singapore"
    }
  }, {
    provider_record_id: "sleep_nap",
    record_type: "sleep",
    observed_at: "2026-09-14T07:00:00Z",
    payload: {
      start: "2026-09-14T06:20:00Z",
      end: "2026-09-14T07:00:00Z",
      duration_min: 40,
      vendor_sleep_date: "2026-09-14",
      timezone: "Europe/Stockholm",
      aggregation: "bout"
    }
  }]);
  const batch = normalize(world, delivery);
  const accepted = fromVm(world.canonical.acceptBatch(batch, ctxFor(delivery)));
  assert.strictEqual(accepted.results.filter(function (r) { return r.outcome === "accepted_new"; }).length, 2);
  const revs = accepted.results.map(function (r) { return fromVm(world.canonical.getObservationRevision(r.revision_id)); });
  assert.notStrictEqual(revs[0].semantics.sleep.assignment_timezone, revs[1].semantics.sleep.assignment_timezone);
  assert.ok(!accepted.primary_candidate_id);
  assert.ok(!world.canonical.status().freshness_aggregate);
  revs.forEach(function (rev) {
    assert.ok(["high", "medium", "low", "unknown"].indexOf(rev.measurement_quality) !== -1);
    assert.ok(!rev.quality);
  });
});

test("43-44. Invalid candidate and malformed revision do not write", function () {
  const world = loadWorld();
  const before = world.canonical.status();
  const bad = fromVm(world.canonical.acceptCandidate({ candidate_kind: "metric_observation" }, ctxFor({ delivery_id: "del_bad" })));
  assert.strictEqual(bad.outcome, "invalid_candidate");
  assert.strictEqual(world.canonical.status().observation_revisions, before.observation_revisions);
  const a = collect(world);
  world.canonical._test.corruptNextRevision();
  const malformed = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  assert.strictEqual(malformed.outcome, "malformed_revision");
  assert.strictEqual(world.canonical.status().observation_revisions, 0);
});

test("45-46. Failed correction transaction leaves no partial state", function () {
  const world = loadWorld();
  const a = collect(world);
  const first = fromVm(world.canonical.acceptCandidate(metricOf(normalize(world, a), "resting_hr"), ctxFor(a)));
  const ptr = fromVm(world.canonical.getCurrentObservationPointer("u_g3d", first.lineage_id));
  const corr = correctedMetric(world, a, 61);
  world.canonical._test.failNextPointer();
  const failed = fromVm(world.canonical.acceptCandidate(metricOf(corr.batch, "resting_hr"), ctxFor(corr.delivery, "2026-09-14T10:00:00Z")));
  assert.strictEqual(failed.outcome, "malformed_revision");
  assert.strictEqual(world.canonical.listObservationRevisions("u_g3d", first.lineage_id).length, 1);
  assert.deepStrictEqual(fromVm(world.canonical.getCurrentObservationPointer("u_g3d", first.lineage_id)), ptr);
});

test("47-54. Zero I/O and no snapshot/window/recovery writes", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  const delivery = collect(world);
  world.canonical.acceptBatch(normalize(world, delivery), ctxFor(delivery));
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
  const st = world.canonical.status();
  assert.strictEqual(st.snapshots, 0);
  assert.strictEqual(st.day_windows, 0);
  assert.strictEqual(st.interprets_recovery, false);
});

test("55. Existing G3A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  15 passed") !== -1);
});

test("56. Existing G3B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("57. Existing G3C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("58-60. G3A/G3B/G3C behavior unchanged after acceptance", function () {
  const world = loadWorld();
  const a = collect(world);
  const b = collect(world);
  const na = normalize(world, a);
  const nb = normalize(world, b);
  world.canonical.acceptBatch(na, ctxFor(a));
  assert.strictEqual(fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" })).snapshot_id, "snap_syn_a");
  assert.notStrictEqual(a.delivery_id, b.delivery_id);
  assert.deepStrictEqual(a.records, b.records);
  assert.deepStrictEqual(na.candidates, nb.candidates);
});

test("G3A public methods remain present after canonical attaches", function () {
  const api = loadWorld().wearables;
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof api[name], "function");
  });
  assert.ok(api.adapters);
  assert.ok(api.ingest);
  assert.ok(api.canonical);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
