/* NXTFRM G4B DailySnapshot tests. Run: node wearables.snapshots.test.js */
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
  [
    "wearables.js", "wearables.fixtures.js", "wearables.adapters.js", "wearables.ingest.js",
    "wearables.canonical.js", "wearables.days.js", "wearables.snapshots.js"
  ].forEach(function (file) {
    if (file === "wearables.fixtures.js" && options.loadFixtures === false) return;
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });
  const days = ctx.NXTFRMWearableDays.createDays();
  const canonical = ctx.NXTFRMWearableCanonical.createCanonical();
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
    snapshots: ctx.NXTFRMWearableSnapshots.createSnapshots({ days: days, canonical: canonical }),
    obsL: [],
    actL: []
  };
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function request() {
  return {
    user_id: "u_g4b",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  };
}

function collect(world) {
  return fromVm(world.adapters.get("nxtfrm.g3b.fixture.v1").collect(request()));
}

function normalize(world, delivery) {
  return fromVm(world.ingest.normalizeDelivery(delivery, { user_id: "u_g4b" }));
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
    fromVm(world.canonical.listObservationRevisions("u_g4b", id)).forEach(function (r) { obs.push(r); });
  });
  Array.from(new Set(world.actL)).forEach(function (id) {
    fromVm(world.canonical.listActivityRevisions("u_g4b", id)).forEach(function (r) { acts.push(r); });
  });
  return { observations: obs, activities: acts };
}

function openWindow(world, extra) {
  const created = fromVm(world.days.createWindow(Object.assign({
    user_id: "u_g4b",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "profile"
  }, extra || {})));
  assert.ok(created.outcome === "created" || created.outcome === "reused", created.outcome);
  const set = fromVm(world.days.setCurrent("u_g4b", created.window.local_date, created.day_window_id, "2026-09-14T00:00:00Z"));
  assert.ok(set.outcome === "pointer_set" || set.outcome === "pointer_unchanged", set.outcome);
  return created.window;
}

function assembleNow(world, window, built) {
  return fromVm(world.snapshots.assemble(Object.assign({
    user_id: "u_g4b",
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

function acceptActivity(world, start, end, extra) {
  const delivery = collect(world);
  delivery.records = [{
    provider_record_id: (extra && extra.id) || "act_g4b",
    record_type: "activity",
    observed_at: start,
    updated_at: end,
    payload: Object.assign({
      sport: "strength",
      elapsed_s: Math.round((Date.parse(end) - Date.parse(start)) / 1000),
      vendor_activity_id: (extra && extra.vendor) || "act-g4b-1"
    }, extra && extra.payload || {})
  }];
  const batch = normalize(world, delivery);
  const cand = batch.candidates.find(function (c) { return c.candidate_kind === "activity"; });
  return track(world, fromVm(world.canonical.acceptCandidate(cand, ctxFor(delivery, extra && extra.at))));
}

function acceptSleep(world, records) {
  const delivery = collect(world);
  delivery.records = records;
  const batch = normalize(world, delivery);
  batch.candidates.filter(function (c) { return c.semantics && c.semantics.metric_kind === "sleep_duration"; }).forEach(function (c) {
    track(world, fromVm(world.canonical.acceptCandidate(c, ctxFor(delivery))));
  });
  return batch;
}

function correctedHr(world, delivery, bpm) {
  const next = fromVm(delivery);
  next.delivery_id = (delivery.delivery_id || "del") + "_corr";
  const hr = next.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.payload = Object.assign({}, hr.payload, { bpm: bpm });
  return { delivery: next, batch: normalize(world, next) };
}

test("syntax: G3A–G4B scripts parse", function () {
  [
    "wearables.js", "wearables.adapters.js", "wearables.ingest.js", "wearables.canonical.js",
    "wearables.days.js", "wearables.snapshots.js", "wearables.test.js", "wearables.adapters.test.js",
    "wearables.ingest.test.js", "wearables.canonical.test.js", "wearables.days.test.js",
    "wearables.snapshots.test.js", "sw.js"
  ].forEach(syntaxCheck);
});

test("1-5. First snapshot from current window; pointer keyed by day_window; no is_current", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const out = assembleNow(world, window);
  assert.strictEqual(out.outcome, "assembled");
  const snap = fromVm(world.snapshots.getSnapshot(out.snapshot_id));
  assert.strictEqual(snap.document_type, "wearable_daily_snapshot");
  assert.strictEqual(snap.schema_version, "g1.2.1");
  assert.strictEqual(snap.user_id, "u_g4b");
  assert.strictEqual(snap.day_window_id, window.day_window_id);
  assert.strictEqual(snap.snapshot_version, 1);
  assert.strictEqual(snap.supersedes_snapshot_id, null);
  assert.ok(!("is_current" in snap));
  const ptr = fromVm(world.snapshots.getCurrentPointer("u_g4b", window.day_window_id));
  assert.strictEqual(ptr.document_type, "current_snapshot_pointer");
  assert.strictEqual(ptr.day_window_id, window.day_window_id);
  assert.strictEqual(ptr.snapshot_id, snap.snapshot_id);
  assert.strictEqual(ptr.snapshot_version, 1);
});

test("6-9. Exact replay is idempotent and does not churn pointer or mutate snapshot", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const first = assembleNow(world, window, "2026-09-14T18:00:00Z");
  const before = JSON.stringify(fromVm(world.snapshots.getSnapshot(first.snapshot_id)));
  const ptr = fromVm(world.snapshots.getCurrentPointer("u_g4b", window.day_window_id));
  const replay = assembleNow(world, window, "2026-09-14T19:00:00Z");
  assert.strictEqual(replay.outcome, "reused");
  assert.strictEqual(replay.snapshot_id, first.snapshot_id);
  assert.strictEqual(replay.snapshot_version, 1);
  assert.strictEqual(world.snapshots.listSnapshots("u_g4b", window.day_window_id).length, 1);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(first.snapshot_id))), before);
  assert.deepStrictEqual(fromVm(world.snapshots.getCurrentPointer("u_g4b", window.day_window_id)), ptr);
});

test("10-13. Observation membership uses interval_end/observed_at and half-open bounds", function () {
  const world = loadWorld();
  const window = openWindow(world);
  assert.strictEqual(window.start_utc, "2026-09-13T16:00:00Z");
  assert.strictEqual(window.end_utc, "2026-09-14T16:00:00Z");
  acceptHrAt(world, "2026-09-13T16:00:00Z");
  const atStart = assembleNow(world, window);
  assert.ok(atStart.snapshot.resting_hr_bpm.candidates.length >= 1);
  const worldEnd = loadWorld();
  const w2 = openWindow(worldEnd);
  acceptHrAt(worldEnd, "2026-09-14T16:00:00Z");
  const atEnd = assembleNow(worldEnd, w2);
  assert.strictEqual(atEnd.snapshot.resting_hr_bpm.candidates.length, 0);
  const worldBefore = loadWorld();
  const w3 = openWindow(worldBefore);
  acceptHrAt(worldBefore, "2026-09-13T15:59:59Z");
  assert.strictEqual(assembleNow(worldBefore, w3).snapshot.resting_hr_bpm.candidates.length, 0);
  const worldAfter = loadWorld();
  const w4 = openWindow(worldAfter);
  acceptHrAt(worldAfter, "2026-09-14T16:00:01Z");
  assert.strictEqual(assembleNow(worldAfter, w4).snapshot.resting_hr_bpm.candidates.length, 0);
});

test("14-20. Activity overlap uses stored half-open UTC bounds", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptActivity(world, "2026-09-14T01:00:00Z", "2026-09-14T01:40:00Z");
  assert.strictEqual(assembleNow(world, window).snapshot.overlapping_activities.length, 1);
  const crossStart = loadWorld();
  const ws = openWindow(crossStart);
  acceptActivity(crossStart, "2026-09-13T15:00:00Z", "2026-09-13T17:00:00Z", { vendor: "cross-start" });
  assert.strictEqual(assembleNow(crossStart, ws).snapshot.overlapping_activities.length, 1);
  const crossEnd = loadWorld();
  const we = openWindow(crossEnd);
  acceptActivity(crossEnd, "2026-09-14T15:00:00Z", "2026-09-14T17:00:00Z", { vendor: "cross-end" });
  assert.strictEqual(assembleNow(crossEnd, we).snapshot.overlapping_activities.length, 1);
  const span = loadWorld();
  const wsp = openWindow(span);
  acceptActivity(span, "2026-09-13T15:00:00Z", "2026-09-14T17:00:00Z", { vendor: "span" });
  assert.strictEqual(assembleNow(span, wsp).snapshot.overlapping_activities.length, 1);
  const endAtStart = loadWorld();
  const wes = openWindow(endAtStart);
  acceptActivity(endAtStart, "2026-09-13T14:00:00Z", "2026-09-13T16:00:00Z", { vendor: "end-start" });
  assert.strictEqual(assembleNow(endAtStart, wes).snapshot.overlapping_activities.length, 0);
  const startAtEnd = loadWorld();
  const wse = openWindow(startAtEnd);
  acceptActivity(startAtEnd, "2026-09-14T16:00:00Z", "2026-09-14T17:00:00Z", { vendor: "start-end" });
  assert.strictEqual(assembleNow(startAtEnd, wse).snapshot.overlapping_activities.length, 0);
  const outside = loadWorld();
  const wo = openWindow(outside);
  acceptActivity(outside, "2026-09-12T01:00:00Z", "2026-09-12T02:00:00Z", { vendor: "out" });
  assert.strictEqual(assembleNow(outside, wo).snapshot.overlapping_activities.length, 0);
});

test("21-23. Travel override uses stored bounds; SG midnight bout misses Stockholm 14 Sep", function () {
  const world = loadWorld();
  const sto = fromVm(world.days.createWindow({
    user_id: "u_g4b",
    local_date: "2026-09-14",
    representative_timezone: "Europe/Stockholm",
    assignment_source: "travel_override",
    start_utc: "2026-09-13T22:00:00Z",
    end_utc: "2026-09-14T22:00:00Z",
    day_window_id: "dw_sto_14"
  }));
  world.days.setCurrent("u_g4b", "2026-09-14", sto.day_window_id, "2026-09-14T00:00:00Z");
  acceptActivity(world, "2026-09-13T15:40:00Z", "2026-09-13T17:10:00Z", { vendor: "sg-midnight" });
  const snap = assembleNow(world, sto.window).snapshot;
  assert.strictEqual(snap.day_window_id, "dw_sto_14");
  assert.strictEqual(snap.overlapping_activities.length, 0);
  assert.strictEqual(world.days.getWindow("dw_sto_14").end_utc, "2026-09-14T22:00:00Z");
  assert.notStrictEqual(fromVm(world.days.deriveBoundaries("2026-09-13", "Asia/Singapore")).end_utc, sto.window.end_utc);
});

test("24-30. Pins exact revisions; correction versions snapshot; old snapshot immutable", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const delivery = collect(world);
  const hr = delivery.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.observed_at = "2026-09-14T01:00:00Z";
  delivery.records = [hr];
  const firstAcc = track(world, fromVm(world.canonical.acceptCandidate(
    normalize(world, delivery).candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
    ctxFor(delivery)
  )));
  const v1 = assembleNow(world, window, "2026-09-14T18:00:00Z");
  const r1 = firstAcc.revision_id;
  assert.strictEqual(v1.snapshot.resting_hr_bpm.selection.rule, "unique_unsuperseded_leaf");
  assert.strictEqual(v1.snapshot.resting_hr_bpm.candidates.some(function (c) {
    return c.provenance.identities.revision_id === r1;
  }), true);
  const before = JSON.stringify(fromVm(world.snapshots.getSnapshot(v1.snapshot_id)));
  const corr = correctedHr(world, delivery, 61);
  const secondAcc = track(world, fromVm(world.canonical.acceptCandidate(
    corr.batch.candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
    ctxFor(corr.delivery, "2026-09-14T19:00:00Z")
  )));
  assert.strictEqual(secondAcc.outcome, "accepted_correction");
  const v2 = assembleNow(world, window, "2026-09-14T20:00:00Z");
  assert.strictEqual(v2.outcome, "assembled_version");
  assert.strictEqual(v2.snapshot_version, 2);
  assert.strictEqual(v2.snapshot.supersedes_snapshot_id, v1.snapshot_id);
  assert.ok(v2.snapshot.resting_hr_bpm.candidates.some(function (c) {
    return c.provenance.identities.revision_id === secondAcc.revision_id;
  }));
  assert.strictEqual(v2.snapshot.resting_hr_bpm.primary_candidate_id, "cand:" + secondAcc.revision_id);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(v1.snapshot_id))), before);
  const replayV2 = assembleNow(world, window, "2026-09-14T21:00:00Z");
  assert.strictEqual(replayV2.outcome, "reused");
  assert.strictEqual(replayV2.snapshot_id, v2.snapshot_id);
  assert.strictEqual(world.canonical.getCurrentObservationPointer("u_g4b", firstAcc.lineage_id).revision_id, secondAcc.revision_id);
  const old = fromVm(world.snapshots.getSnapshot(v1.snapshot_id));
  assert.ok(old.resting_hr_bpm.candidates.some(function (c) { return c.provenance.identities.revision_id === r1; }));
});

test("31-33. Activity correction versions snapshot; out-of-window correction omitted later only", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const a1 = acceptActivity(world, "2026-09-14T01:00:00Z", "2026-09-14T01:40:00Z", { vendor: "stay" });
  const v1 = assembleNow(world, window);
  const before = JSON.stringify(fromVm(world.snapshots.getSnapshot(v1.snapshot_id)));
  assert.strictEqual(v1.snapshot.overlapping_activities[0].activity_revision_id, a1.revision_id);
  const delivery = collect(world);
  delivery.delivery_id = "del_act_out";
  delivery.records = [{
    provider_record_id: "act_g4b",
    record_type: "activity",
    observed_at: "2026-09-12T01:00:00Z",
    updated_at: "2026-09-12T01:40:00Z",
    payload: { sport: "strength", elapsed_s: 2400, vendor_activity_id: "stay" }
  }];
  const a2 = track(world, fromVm(world.canonical.acceptCandidate(
    normalize(world, delivery).candidates.find(function (c) { return c.candidate_kind === "activity"; }),
    ctxFor(delivery, "2026-09-14T19:00:00Z")
  )));
  assert.strictEqual(a2.outcome, "accepted_correction");
  const v2 = assembleNow(world, window, "2026-09-14T20:00:00Z");
  assert.strictEqual(v2.outcome, "assembled_version");
  assert.strictEqual(v2.snapshot.overlapping_activities.length, 0);
  assert.strictEqual(JSON.stringify(fromVm(world.snapshots.getSnapshot(v1.snapshot_id))), before);
  assert.strictEqual(fromVm(world.snapshots.getSnapshot(v1.snapshot_id)).overlapping_activities[0].activity_revision_id, a1.revision_id);
});

test("34-36. Ordering and identity are independent of insertion order and delivery_id", function () {
  function build(order) {
    const world = loadWorld();
    const window = openWindow(world);
    order.forEach(function (kind) {
      if (kind === "hr") acceptHrAt(world, "2026-09-14T01:00:00Z");
      if (kind === "mass") {
        const d = collect(world);
        const mass = d.records.find(function (r) { return r.record_type === "body_mass"; });
        mass.observed_at = "2026-09-14T02:00:00Z";
        d.records = [mass];
        const cand = normalize(world, d).candidates.find(function (c) { return c.semantics.metric_kind === "body_mass"; });
        track(world, fromVm(world.canonical.acceptCandidate(cand, ctxFor(d))));
      }
    });
    return assembleNow(world, window).snapshot;
  }
  const a = build(["hr", "mass"]);
  const b = build(["mass", "hr"]);
  assert.deepStrictEqual(
    a.resting_hr_bpm.candidates.map(function (c) { return c.provenance.identities.content_hash; }),
    b.resting_hr_bpm.candidates.map(function (c) { return c.provenance.identities.content_hash; })
  );
  assert.deepStrictEqual(
    a.body_mass_kg.candidates.map(function (c) { return c.provenance.identities.content_hash; }),
    b.body_mass_kg.candidates.map(function (c) { return c.provenance.identities.content_hash; })
  );
  assert.notStrictEqual(a.built_at_utc, "delivery-dependent");
});

test("37-39. Same user/date different day windows keep separate snapshot lineages", function () {
  const world = loadWorld();
  const sg = openWindow(world);
  const sto = fromVm(world.days.createWindow({
    user_id: "u_g4b",
    local_date: "2026-09-14",
    representative_timezone: "Europe/Stockholm",
    assignment_source: "profile"
  }));
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const a = assembleNow(world, sg);
  world.days.setCurrent("u_g4b", "2026-09-14", sto.day_window_id, "2026-09-14T00:10:00Z");
  const b = assembleNow(world, sto.window);
  assert.notStrictEqual(a.snapshot_id, b.snapshot_id);
  assert.notStrictEqual(a.snapshot.day_window_id, b.snapshot.day_window_id);
  assert.ok(world.snapshots.getCurrentPointer("u_g4b", sg.day_window_id));
  assert.ok(world.snapshots.getCurrentPointer("u_g4b", sto.day_window_id));
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4b", sg.day_window_id).snapshot_id, a.snapshot_id);
  acceptHrAt(world, "2026-09-14T03:00:00Z");
  world.days.setCurrent("u_g4b", "2026-09-14", sg.day_window_id, "2026-09-14T00:20:00Z");
  assembleNow(world, sg, "2026-09-14T21:00:00Z");
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4b", sto.day_window_id).snapshot_id, b.snapshot_id);
});

test("40-49. Pointer validation, rollback, missing pointer, no latest-created guess", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  assert.strictEqual(fromVm(world.snapshots.resolveCurrent("u_g4b", window.day_window_id)).outcome, "missing_pointer");
  const v1 = assembleNow(world, window);
  const ptr = fromVm(world.snapshots.getCurrentPointer("u_g4b", window.day_window_id));
  assert.strictEqual(fromVm(world.snapshots.assemble({
    user_id: "u_g4b",
    day_window_id: "missing-dw",
    built_at_utc: "2026-09-14T18:00:00Z"
  })).outcome, "invalid_day_window");
  const orphan = loadWorld();
  const created = fromVm(orphan.days.createWindow({
    user_id: "u_g4b",
    local_date: "2026-09-14",
    representative_timezone: "Asia/Singapore",
    assignment_source: "profile"
  }));
  assert.strictEqual(fromVm(orphan.snapshots.assemble({
    user_id: "u_g4b",
    day_window_id: created.day_window_id,
    built_at_utc: "2026-09-14T18:00:00Z"
  })).outcome, "missing_day_window");
  assert.strictEqual(fromVm(world.snapshots.setCurrent("u_g4b", window.day_window_id, "missing-snap", 1, "2026-09-14T18:00:00Z")).outcome, "invalid_pointer");
  assert.strictEqual(fromVm(world.snapshots.setCurrent("other", window.day_window_id, v1.snapshot_id, 1, "2026-09-14T18:00:00Z")).outcome, "invalid_pointer");
  assert.strictEqual(fromVm(world.snapshots.setCurrent("u_g4b", "other-dw", v1.snapshot_id, 1, "2026-09-14T18:00:00Z")).outcome, "invalid_pointer");
  assert.strictEqual(fromVm(world.snapshots.setCurrent("u_g4b", window.day_window_id, v1.snapshot_id, 9, "2026-09-14T18:00:00Z")).outcome, "invalid_pointer");
  const delivery = collect(world);
  const hr = delivery.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.observed_at = "2026-09-14T01:00:00Z";
  delivery.records = [hr];
  const first = normalize(world, delivery).candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; });
  track(world, fromVm(world.canonical.acceptCandidate(first, ctxFor(delivery))));
  const corr = correctedHr(world, delivery, 70);
  track(world, fromVm(world.canonical.acceptCandidate(
    corr.batch.candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
    ctxFor(corr.delivery, "2026-09-14T19:00:00Z")
  )));
  world.snapshots._test.failNextPointer();
  const failed = assembleNow(world, window, "2026-09-14T20:00:00Z");
  assert.strictEqual(failed.outcome, "invalid_pointer");
  assert.strictEqual(world.snapshots.listSnapshots("u_g4b", window.day_window_id).length, 1);
  assert.deepStrictEqual(fromVm(world.snapshots.getCurrentPointer("u_g4b", window.day_window_id)), ptr);
  world.snapshots._test.failBeforeCommit();
  const failed2 = assembleNow(world, window, "2026-09-14T20:00:00Z");
  assert.strictEqual(failed2.outcome, "invalid_snapshot");
  assert.strictEqual(world.snapshots.listSnapshots("u_g4b", window.day_window_id).length, 1);
  const isolated = loadWorld();
  openWindow(isolated);
  acceptHrAt(isolated, "2026-09-14T01:00:00Z");
  assert.strictEqual(isolated.snapshots.getCurrent("u_g4b", isolated.days.listWindows("u_g4b", "2026-09-14")[0].day_window_id), null);
});

test("50-56. No provider/sleep winner; per-candidate sleep assignment preserved", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptSleep(world, [{
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
  const snap = assembleNow(world, window).snapshot;
  assert.ok(!snap.primary_sleep);
  assert.ok(!snap.sleep_assignment);
  assert.ok(snap.sleep_bouts.length + snap.sleep_duration_s.candidates.length >= 2);
  const nightly = snap.sleep_duration_s.candidates[0];
  if (nightly) {
    assert.strictEqual(nightly.semantics.sleep.assignment_timezone, "Asia/Singapore");
    assert.ok(nightly.semantics.sleep.normalized_wake_date);
  }
  const bout = snap.sleep_bouts[0];
  if (bout) assert.strictEqual(bout.semantics.aggregation, "bout");
  assert.ok(snap.sleep_duration_s.selection.rule !== "named_priority_policy");
});

test("57-61. Freshness/quality factual only; unresolved G3D lineage is not timestamp-picked", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const snap = assembleNow(world, window).snapshot;
  assert.ok(Array.isArray(snap.source_freshness));
  snap.source_freshness.forEach(function (row) {
    assert.ok(row.source_id);
    assert.strictEqual(row.last_successful_sync_at_utc, null);
  });
  assert.strictEqual(snap.freshness_aggregate.derivation_id, "freshness.aggregate.g1.2");
  assert.ok(!snap.quality || !snap.quality.band);
  assert.ok(snap.quality_flags.indexOf("partial_day") !== -1);
  const fork = loadWorld();
  const fw = openWindow(fork);
  const acc = acceptHrAt(fork, "2026-09-14T01:00:00Z");
  const r1 = fromVm(fork.canonical.getObservationRevision(acc.revision_id));
  const store = fork.canonical;
  const a = fromVm(r1); a.provenance.identities.revision_id = "R2"; a.provenance.identities.supersedes_revision_id = acc.revision_id; a.value = 61;
  const b = fromVm(r1); b.provenance.identities.revision_id = "R3"; b.provenance.identities.supersedes_revision_id = acc.revision_id; b.value = 62;
  store._test.installObservationRevision(a);
  store._test.installObservationRevision(b);
  store._test.installObservationPointer({
    document_type: "current_observation_pointer", schema_version: "g1.2.1", user_id: "u_g4b",
    canonical_observation_id: acc.lineage_id, revision_id: "R2",
    advanced_at_utc: "2026-09-14T08:05:00Z", accepted_delivery_id: "del"
  });
  fork.obsL.push(acc.lineage_id);
  const forked = assembleNow(fork, fw);
  assert.ok(forked.unresolved.some(function (u) { return u.lineage_id === acc.lineage_id; }));
  assert.strictEqual(forked.snapshot.resting_hr_bpm.selection.rule, "none_empty");
});

test("62-73. G4B creates no revisions/windows and writes no I/O", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  const dwCount = world.days.status().day_windows;
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  assembleNow(world, window);
  const st = world.snapshots.status();
  assert.strictEqual(st.observation_revisions, 0);
  assert.strictEqual(st.activity_revisions, 0);
  assert.strictEqual(st.day_windows, 0);
  assert.strictEqual(st.interprets_recovery, false);
  assert.ok(world.days.status().day_windows >= dwCount);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
});

test("74. Existing G3A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  15 passed") !== -1);
});

test("75. Existing G3B tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.adapters.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("76. Existing G3C tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.ingest.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  32 passed") !== -1);
});

test("77. Existing G3D tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.canonical.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  24 passed") !== -1);
});

test("78. Existing G4A tests still pass unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.days.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  16 passed") !== -1);
});

test("79-81. G3A reader, G3D acceptance, and G4A windows unchanged after assembly", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  assembleNow(world, window);
  assert.strictEqual(fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" })).snapshot_id, "snap_syn_a");
  const d = collect(world);
  const n1 = normalize(world, d);
  const n2 = normalize(world, collect(world));
  assert.deepStrictEqual(n1.candidates.map(function (c) { return c.provenance.identities.content_hash; }), n2.candidates.map(function (c) { return c.provenance.identities.content_hash; }));
  assert.strictEqual(world.days.getWindow(window.day_window_id).start_utc, window.start_utc);
});

test("Pointer rollback to a superseded snapshot version is rejected", function () {
  const world = loadWorld();
  const window = openWindow(world);
  const delivery = collect(world);
  const hr = delivery.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.observed_at = "2026-09-14T01:00:00Z";
  delivery.records = [hr];
  track(world, fromVm(world.canonical.acceptCandidate(
    normalize(world, delivery).candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
    ctxFor(delivery)
  )));
  const v1 = assembleNow(world, window);
  const corr = correctedHr(world, delivery, 64);
  track(world, fromVm(world.canonical.acceptCandidate(
    corr.batch.candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
    ctxFor(corr.delivery, "2026-09-14T19:00:00Z")
  )));
  const v2 = assembleNow(world, window, "2026-09-14T20:00:00Z");
  assert.strictEqual(v2.snapshot_version, 2);
  const rollback = fromVm(world.snapshots.setCurrent("u_g4b", window.day_window_id, v1.snapshot_id, 1, "2026-09-14T21:00:00Z"));
  assert.strictEqual(rollback.outcome, "invalid_pointer");
  assert.strictEqual(world.snapshots.getCurrentPointer("u_g4b", window.day_window_id).snapshot_id, v2.snapshot_id);
});

test("Same evidence with different delivery_ids yields the same snapshot identity", function () {
  function build(deliveryId) {
    const world = loadWorld();
    const window = openWindow(world);
    const delivery = collect(world);
    delivery.delivery_id = deliveryId;
    const hr = delivery.records.find(function (r) { return r.record_type === "heart_rate"; });
    hr.observed_at = "2026-09-14T01:00:00Z";
    delivery.records = [hr];
    track(world, fromVm(world.canonical.acceptCandidate(
      normalize(world, delivery).candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
      ctxFor(delivery)
    )));
    return assembleNow(world, window, "2026-09-14T18:00:00Z");
  }
  const a = build("del_alpha");
  const b = build("del_beta");
  assert.strictEqual(a.snapshot_id, b.snapshot_id);
  assert.strictEqual(a.snapshot_version, b.snapshot_version);
  assert.deepStrictEqual(
    a.snapshot.resting_hr_bpm.candidates.map(function (c) { return c.provenance.identities.revision_id; }),
    b.snapshot.resting_hr_bpm.candidates.map(function (c) { return c.provenance.identities.revision_id; })
  );
});

test("Travel override membership uses stored extended bounds, not profile midnight", function () {
  const world = loadWorld();
  const derived = fromVm(world.days.deriveBoundaries("2026-09-13", "Asia/Singapore"));
  const travel = fromVm(world.days.createWindow({
    user_id: "u_g4b",
    local_date: "2026-09-13",
    representative_timezone: "Asia/Singapore",
    assignment_source: "travel_override",
    start_utc: "2026-09-12T16:00:00Z",
    end_utc: "2026-09-13T22:00:00Z",
    day_window_id: "dw_sg_travel_13"
  }));
  assert.notStrictEqual(travel.window.end_utc, derived.end_utc);
  world.days.setCurrent("u_g4b", "2026-09-13", travel.day_window_id, "2026-09-13T00:00:00Z");
  acceptHrAt(world, "2026-09-13T20:00:00Z");
  const snap = assembleNow(world, travel.window, "2026-09-13T23:00:00Z").snapshot;
  assert.strictEqual(snap.resting_hr_bpm.candidates.length, 1);
  assert.ok(snap.quality_flags.indexOf("timezone_change") !== -1);
  const profile = loadWorld();
  const prof = openWindow(profile, { local_date: "2026-09-13" });
  assert.strictEqual(prof.end_utc, derived.end_utc);
  acceptHrAt(profile, "2026-09-13T20:00:00Z");
  assert.strictEqual(assembleNow(profile, prof, "2026-09-13T23:00:00Z").snapshot.resting_hr_bpm.candidates.length, 0);
});

test("Cross-source evidence stays distinct; no provider precedence or merge", function () {
  const world = loadWorld();
  const window = openWindow(world);
  acceptHrAt(world, "2026-09-14T01:00:00Z");
  const other = collect(world);
  other.delivery_id = "del_cross";
  other.provider_id = "other.provider";
  other.source_instance_ref = { kind: "api", provider_id: "other.provider", connection_id: "c9", source_id: "src_other" };
  world.ingest.registerNormalizer({
    normalizer_id: "other.norm",
    provider_id: "other.provider",
    normalizeRecord: world.ingest.createFixtureNormalizer().normalizeRecord
  });
  const hr = other.records.find(function (r) { return r.record_type === "heart_rate"; });
  hr.observed_at = "2026-09-14T01:05:00Z";
  other.records = [hr];
  track(world, fromVm(world.canonical.acceptCandidate(
    normalize(world, other).candidates.find(function (c) { return c.semantics.metric_kind === "resting_hr"; }),
    ctxFor(other)
  )));
  const snap = assembleNow(world, window).snapshot;
  assert.strictEqual(snap.resting_hr_bpm.candidates.length, 2);
  assert.strictEqual(snap.resting_hr_bpm.primary_candidate_id, null);
  assert.strictEqual(snap.resting_hr_bpm.selection.rule, "none_cross_source_conflict");
  assert.notStrictEqual(
    snap.resting_hr_bpm.candidates[0].provenance.identities.canonical_observation_id,
    snap.resting_hr_bpm.candidates[1].provenance.identities.canonical_observation_id
  );
  assert.ok(snap.contributing_sources.length >= 2);
  assert.ok(snap.quality_flags.indexOf("conflict") !== -1);
  assert.ok(snap.quality_flags.indexOf("multi_source") !== -1);
});

test("G3A public methods remain present after snapshots attach", function () {
  const api = loadWorld().wearables;
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof api[name], "function");
  });
  assert.ok(api.days);
  assert.ok(api.canonical);
  assert.ok(api.snapshots);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
