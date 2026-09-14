/* NXTFRM G3B adapter-boundary tests. Run: node wearables.adapters.test.js */
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
    indexedDB: {
      open: function () { idbWrites += 1; throw new Error("indexedDB blocked"); }
    },
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
  return {
    ctx: ctx,
    storage: storage,
    sessionWrites: function () { return sessionWrites; },
    idbWrites: function () { return idbWrites; },
    wearables: ctx.NXT.wearables,
    adapters: ctx.NXT.wearables && ctx.NXT.wearables.adapters,
    factory: ctx.NXTFRMWearables,
    host: ctx.NXTFRMWearableAdapters
  };
}

function request(extra) {
  return Object.assign({
    user_id: "u_g3b",
    range: { start_utc: "2026-09-13T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" },
    requested_at: "2026-09-14T08:00:00Z"
  }, extra || {});
}

function codeOf(fn) {
  try { fn(); } catch (err) { return err && err.code; }
  return null;
}

function registry(mode) {
  const world = loadWorld({ loadFixtures: false });
  return world.host.createRegistry({ mode: mode || "test" });
}

function fixtureHost(mode) {
  const host = registry(mode || "test");
  host.register(host.createFixtureAdapter({ mode: mode || "test" }));
  return host;
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

test("syntax: G3A and G3B scripts parse", function () {
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
    "wearables.adapters.test.js"
  ].forEach(syntaxCheck);
});

test("1. Valid API SourceInstanceRef accepted", function () {
  const ref = registry().validateSourceInstance({
    kind: "api",
    provider_id: "nxtfrm.test.api",
    connection_id: "conn_1"
  });
  const out = fromVm(ref);
  assert.strictEqual(out.kind, "api_connection");
  assert.strictEqual(out.provider, "nxtfrm.test.api");
  assert.strictEqual(out.connection_id, "conn_1");
  assert.ok(!("import_batch_id" in out));
  assert.ok(!("fixture_dataset_id" in out));
  assert.strictEqual(registry().originOf(out.kind), "api");
});

test("2. API source without connection_id rejected", function () {
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({ kind: "api", provider_id: "p" });
  }), "invalid_source_instance");
});

test("3. API source containing import_batch_id rejected", function () {
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({
      kind: "api",
      provider_id: "p",
      connection_id: "c",
      import_batch_id: "batch"
    });
  }), "invalid_source_instance");
});

test("4. API source containing fixture_dataset_id rejected", function () {
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({
      kind: "api",
      provider_id: "p",
      connection_id: "c",
      fixture_dataset_id: "fix"
    });
  }), "invalid_source_instance");
});

test("5. Valid import SourceInstanceRef accepted", function () {
  const out = fromVm(registry().validateSourceInstance({
    kind: "import",
    provider_id: "nxtfrm.test.import",
    import_batch_id: "batch_1"
  }));
  assert.strictEqual(out.kind, "import_batch");
  assert.strictEqual(out.import_batch_id, "batch_1");
  assert.ok(!("connection_id" in out));
  assert.strictEqual(registry().originOf(out.kind), "import");
});

test("6. Import source without import_batch_id rejected", function () {
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({ kind: "import", provider_id: "p" });
  }), "invalid_source_instance");
});

test("7. Import source containing connection_id rejected", function () {
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({
      kind: "import",
      provider_id: "p",
      import_batch_id: "b",
      connection_id: "c"
    });
  }), "invalid_source_instance");
});

test("8. Valid fixture SourceInstanceRef accepted in local/test mode", function () {
  const out = fromVm(registry("test").validateSourceInstance({
    kind: "fixture",
    provider_id: "nxtfrm.synthetic",
    fixture_dataset_id: "nxtfrm.g3b.fixture.v1"
  }, { mode: "test" }));
  assert.strictEqual(out.kind, "fixture_dataset");
  assert.strictEqual(out.fixture_dataset_id, "nxtfrm.g3b.fixture.v1");
  assert.strictEqual(registry().originOf(out.kind), "fixture");
});

test("9. Fixture source rejected in production mode", function () {
  assert.strictEqual(codeOf(function () {
    registry("production").validateSourceInstance({
      kind: "fixture",
      provider_id: "nxtfrm.synthetic",
      fixture_dataset_id: "nxtfrm.g3b.fixture.v1"
    });
  }), "fixture_forbidden_in_production");
});

test("10. Invalid collection range where start >= end rejected", function () {
  const host = fixtureHost();
  assert.strictEqual(codeOf(function () {
    host.get("nxtfrm.g3b.fixture.v1").collect(request({
      range: { start_utc: "2026-09-15T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" }
    }));
  }), "invalid_request");
  assert.strictEqual(codeOf(function () {
    host.get("nxtfrm.g3b.fixture.v1").collect(request({
      range: { start_utc: "2026-09-16T00:00:00Z", end_utc: "2026-09-15T00:00:00Z" }
    }));
  }), "invalid_request");
});

test("11. Missing user_id rejected", function () {
  const req = request();
  delete req.user_id;
  assert.strictEqual(codeOf(function () {
    fixtureHost().get("nxtfrm.g3b.fixture.v1").collect(req);
  }), "invalid_request");
});

test("12-17. collect() returns a valid delivery envelope", function () {
  const host = fixtureHost();
  const adapter = host.get("nxtfrm.g3b.fixture.v1");
  const req = request();
  const delivery = fromVm(adapter.collect(req));
  assert.ok(delivery.delivery_id && delivery.delivery_id.length > 0);
  assert.strictEqual(delivery.adapter_id, "nxtfrm.g3b.fixture.v1");
  assert.strictEqual(delivery.provider_id, "nxtfrm.synthetic");
  assert.strictEqual(delivery.source_instance_ref.kind, "fixture_dataset");
  assert.strictEqual(delivery.source_instance_ref.provider, "nxtfrm.synthetic");
  assert.strictEqual(delivery.source_instance_ref.fixture_dataset_id, "nxtfrm.g3b.fixture.v1");
  assert.strictEqual(delivery.source_instance_ref.source_id, "src_g3b_fix_v1");
  assert.deepStrictEqual(delivery.requested_range, req.range);
  assert.ok(Array.isArray(delivery.records));
  assert.strictEqual(delivery.records.length, 4);
  const types = delivery.records.map(function (r) { return r.record_type; }).sort();
  assert.deepStrictEqual(types, ["activity", "body_mass", "heart_rate", "sleep"]);
});

test("18. adapter capability list is finite/validated", function () {
  const desc = fromVm(fixtureHost().get("nxtfrm.g3b.fixture.v1").describe());
  desc.capabilities.forEach(function (cap) {
    assert.ok(registry().CAPABILITIES.indexOf(cap) !== -1);
  });
  assert.strictEqual(codeOf(function () {
    registry().register({
      adapter_id: "bad.caps",
      provider_id: "p",
      capabilities: ["metrics", "garmin_only"],
      source_instance_ref: { kind: "api", provider_id: "p", connection_id: "c" },
      collect: function () { return {}; }
    });
  }), "invalid_request");
});

test("19. unsupported capability fails explicitly", function () {
  assert.strictEqual(codeOf(function () {
    fixtureHost().get("nxtfrm.g3b.fixture.v1").collect(request({ capability: "pagination" }));
  }), "unsupported_capability");
});

test("20. duplicate adapter registration rejected", function () {
  const host = fixtureHost();
  assert.strictEqual(codeOf(function () {
    host.register(host.createFixtureAdapter({ mode: "test" }));
  }), "duplicate_adapter");
});

test("21. unknown adapter lookup fails closed", function () {
  const host = registry();
  assert.strictEqual(host.get("missing.adapter"), null);
  assert.strictEqual(codeOf(function () { host.require("missing.adapter"); }), "unknown_adapter");
});

test("22. registry does not implicitly select a provider", function () {
  const host = fixtureHost();
  host.register({
    adapter_id: "second.api",
    provider_id: "other",
    capabilities: ["metrics"],
    source_instance_ref: { kind: "api", provider_id: "other", connection_id: "c2" },
    collect: function (req) {
      return {
        delivery_id: "del_other_1",
        adapter_id: "second.api",
        provider_id: "other",
        source_instance_ref: { kind: "api", provider_id: "other", connection_id: "c2" },
        collected_at: req.requested_at,
        requested_range: req.range,
        records: [{ record_type: "heart_rate", payload: { bpm: 1 } }]
      };
    }
  });
  assert.strictEqual(host.list().length, 2);
  assert.ok(!host.get());
  assert.ok(host.get("nxtfrm.g3b.fixture.v1"));
  assert.ok(host.get("second.api"));
});

test("23. caller request object is not mutated", function () {
  const req = request();
  const snapshot = JSON.stringify(req);
  fixtureHost().get("nxtfrm.g3b.fixture.v1").collect(req);
  assert.strictEqual(JSON.stringify(req), snapshot);
});

test("24-25. returned delivery/payload mutation cannot mutate fixture state", function () {
  const adapter = fixtureHost().get("nxtfrm.g3b.fixture.v1");
  const first = adapter.collect(request());
  first.delivery_id = "mutated";
  first.records[0].payload.bpm = 999;
  first.records[0].record_type = "forged";
  const second = fromVm(adapter.collect(request()));
  assert.notStrictEqual(second.delivery_id, "mutated");
  const hr = second.records.find(function (r) { return r.record_type === "heart_rate"; });
  assert.strictEqual(hr.payload.bpm, 58);
  assert.strictEqual(hr.record_type, "heart_rate");
});

test("26. two collections may have different delivery IDs and identical records", function () {
  const adapter = fixtureHost().get("nxtfrm.g3b.fixture.v1");
  const a = fromVm(adapter.collect(request()));
  const b = fromVm(adapter.collect(request()));
  assert.notStrictEqual(a.delivery_id, b.delivery_id);
  assert.deepStrictEqual(a.records, b.records);
  assert.deepStrictEqual(a.source_instance_ref, b.source_instance_ref);
});

test("27-31. replay creates no canonical G1.2.1 evidence", function () {
  const world = loadWorld();
  const beforeDaily = fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }));
  const beforeHist = fromVm(world.wearables.getSnapshot("snap_syn_i_v1"));
  const beforeAct = fromVm(world.wearables.getActivityRevision("arev_syn_str_1"));
  const adapter = world.adapters.get("nxtfrm.g3b.fixture.v1");
  const d1 = fromVm(adapter.collect(request()));
  const d2 = fromVm(adapter.collect(request()));
  assert.notStrictEqual(d1.delivery_id, d2.delivery_id);
  [d1, d2].forEach(function (delivery) {
    assert.ok(!delivery.document_type);
    assert.ok(!delivery.schema_version);
    delivery.records.forEach(function (rec) {
      assert.ok(!rec.document_type);
      assert.ok(!rec.schema_version);
      assert.ok(!rec.snapshot_id);
      assert.ok(!rec.revision_id);
    });
  });
  const afterDaily = fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }));
  const afterHist = fromVm(world.wearables.getSnapshot("snap_syn_i_v1"));
  const afterAct = fromVm(world.wearables.getActivityRevision("arev_syn_str_1"));
  assert.deepStrictEqual(afterDaily, beforeDaily);
  assert.deepStrictEqual(afterHist, beforeHist);
  assert.deepStrictEqual(afterAct, beforeAct);
  assert.ok(!JSON.stringify(afterDaily).includes(d1.delivery_id));
  assert.ok(!JSON.stringify(afterAct).includes(d1.delivery_id));
  assert.ok(!JSON.stringify(afterHist).includes(d2.delivery_id));
});

test("32-37. fixture adapter performs zero storage or network I/O", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  world.adapters.get("nxtfrm.g3b.fixture.v1").collect(request());
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.sessionWrites(), 0);
  assert.strictEqual(world.idbWrites(), 0);
  assert.strictEqual(world.ctx.__networkCalls.fetch, 0);
  assert.strictEqual(world.ctx.__networkCalls.xhr, 0);
  assert.strictEqual(world.ctx.__networkCalls.ws, 0);
  assert.deepStrictEqual(fingerprint(world.storage.store), before);
});

test("38. existing wearables.test.js still passes unchanged", function () {
  const result = spawnSync(process.execPath, [path.join(ROOT, "wearables.test.js")], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.indexOf("OK  18 passed") !== -1);
});

test("39. existing getDaily behavior is unchanged", function () {
  const world = loadWorld();
  const snap = fromVm(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }));
  assert.strictEqual(snap.snapshot_id, "snap_syn_a");
  assert.strictEqual(snap.sleep_duration_s.primary_candidate_id, "cand_sleep_u_syn_a_1");
  assert.strictEqual(snap.sleep_duration_s.candidates[0].value, 27000);
  assert.strictEqual(world.wearables.getDaily("2020-01-01", { userId: "u_syn_a" }), null);
  assert.strictEqual(world.wearables.getDaily("2026-09-14"), null);
});

test("40. existing historical pinned-activity resolution is unchanged", function () {
  const world = loadWorld();
  const snap = world.wearables.getDaily("2026-09-14", { userId: "u_syn_f" });
  const pin = fromVm(snap.overlapping_activities).find(function (p) { return p.canonical_activity_id === "act_syn_strength"; });
  assert.strictEqual(pin.activity_revision_id, "arev_syn_str_1");
  const rev = fromVm(world.wearables.getActivityRevision(pin.activity_revision_id));
  assert.strictEqual(rev.provenance.identities.activity_revision_id, "arev_syn_str_1");
  const hist = fromVm(world.wearables.getSnapshot("snap_syn_i_v1"));
  assert.strictEqual(hist.snapshot_id, "snap_syn_i_v1");
  const current = fromVm(world.wearables.getDaily("2026-09-13", { userId: "u_syn_i" }));
  assert.strictEqual(current.snapshot_id, "snap_syn_i_v2");
});

test("41. production mode with no real provider still returns no canonical wearable data", function () {
  const world = loadWorld({
    loadFixtures: false,
    loadAdapters: true,
    location: { hostname: "nxtfrm.app", protocol: "https:" }
  });
  const prod = world.factory.create({ mode: "production" });
  assert.strictEqual(prod.getDaily("2026-09-14", { userId: "u_syn_a" }), null);
  assert.strictEqual(world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }), null);
  assert.strictEqual(world.wearables.status().ready, false);
});

test("42. production cannot use the fixture adapter", function () {
  const prod = registry("production");
  assert.strictEqual(codeOf(function () {
    prod.createFixtureAdapter({ mode: "production" });
  }), "fixture_forbidden_in_production");
  assert.strictEqual(codeOf(function () {
    prod.register({
      adapter_id: "nxtfrm.g3b.fixture.v1",
      provider_id: "nxtfrm.synthetic",
      capabilities: ["metrics"],
      source_instance_ref: { kind: "fixture", provider_id: "nxtfrm.synthetic", fixture_dataset_id: "x" },
      collect: function () { return {}; }
    });
  }), "fixture_forbidden_in_production");
  const hosted = loadWorld({ location: { hostname: "nxtfrm.app", protocol: "https:" }, loadFixtures: false });
  assert.strictEqual(hosted.adapters.get("nxtfrm.g3b.fixture.v1"), null);
  assert.strictEqual(hosted.adapters.list().length, 0);
});

test("43. malformed delivery from a bad test adapter is rejected", function () {
  const host = registry();
  host.register({
    adapter_id: "bad.delivery",
    provider_id: "p",
    capabilities: ["metrics"],
    source_instance_ref: { kind: "api", provider_id: "p", connection_id: "c" },
    collect: function () { return { delivery_id: "x" }; }
  });
  assert.strictEqual(codeOf(function () {
    host.get("bad.delivery").collect(request());
  }), "malformed_provider_response");
});

test("44. unknown capability value is rejected", function () {
  assert.strictEqual(codeOf(function () {
    fixtureHost().get("nxtfrm.g3b.fixture.v1").collect(request({ capability: "garmin_only" }));
  }), "invalid_request");
});

test("45. source-kind foreign fields are rejected rather than ignored", function () {
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({
      kind: "import",
      provider_id: "p",
      import_batch_id: "b",
      fixture_dataset_id: "sneaky"
    });
  }), "invalid_source_instance");
  assert.strictEqual(codeOf(function () {
    registry().validateSourceInstance({
      kind: "api",
      provider_id: "p",
      connection_id: "c",
      extra: "no"
    });
  }), "invalid_source_instance");
});

test("G3A public methods remain present after adapters attach", function () {
  const api = loadWorld().wearables;
  ["getDaily", "getDayWindow", "getSnapshot", "getActivityRevision", "resolvePinnedActivities", "status"].forEach(function (name) {
    assert.strictEqual(typeof api[name], "function");
  });
  assert.ok(api.adapters);
  assert.strictEqual(typeof api.adapters.list, "function");
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
