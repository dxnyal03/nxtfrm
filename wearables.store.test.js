/* NXTFRM P2 wearable persistence tests. Run: node wearables.store.test.js */
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

function loadWorld(options) {
  options = options || {};
  const storage = createStorage(options.storage);
  const ctx = {
    console: console,
    NXT: {},
    location: options.location || { hostname: "localhost", protocol: "http:" },
    localStorage: storage.localStorage,
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    process: { env: options.env || {} },
    __networkCalls: { fetch: 0, xhr: 0, ws: 0 }
  };
  ctx.fetch = function () { ctx.__networkCalls.fetch += 1; throw new Error("network blocked: fetch"); };
  ctx.XMLHttpRequest = function () { ctx.__networkCalls.xhr += 1; throw new Error("network blocked: xhr"); };
  ctx.WebSocket = function () { ctx.__networkCalls.ws += 1; throw new Error("network blocked: ws"); };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.js"), "utf8"), ctx, { filename: "wearables.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.store.js"), "utf8"), ctx, { filename: "wearables.store.js" });
  return { ctx: ctx, storage: storage, storeApi: ctx.NXTFRMWearableStore };
}

function openStore(world) {
  const store = world.storeApi.createMemoryStore();
  store.open();
  return store;
}

function codeOf(fn) {
  try { fn(); } catch (err) { return err && err.code; }
  return null;
}

function obsRev(id, lineage, user, at) {
  return {
    document_type: "observation_revision",
    user_id: user || "u1",
    provenance: {
      identities: { revision_id: id, canonical_observation_id: lineage || "obs_a" },
      observed_at_utc: at || "2026-09-14T02:00:00Z"
    }
  };
}

function actRev(id, lineage, user) {
  return {
    document_type: "wearable_activity_revision",
    user_id: user || "u1",
    provenance: {
      identities: { activity_revision_id: id, canonical_activity_id: lineage || "act_a" }
    }
  };
}

function obsPtr(revId, lineage, user) {
  return {
    document_type: "current_observation_pointer",
    user_id: user || "u1",
    canonical_observation_id: lineage || "obs_a",
    revision_id: revId
  };
}

function actPtr(revId, lineage, user) {
  return {
    document_type: "current_activity_pointer",
    user_id: user || "u1",
    canonical_activity_id: lineage || "act_a",
    activity_revision_id: revId
  };
}

function windowDoc(id, date, user) {
  return {
    document_type: "user_day_window",
    day_window_id: id,
    user_id: user || "u1",
    local_date: date || "2026-09-14"
  };
}

function windowPtr(windowId, date, user) {
  return {
    document_type: "current_day_window_pointer",
    user_id: user || "u1",
    local_date: date || "2026-09-14",
    day_window_id: windowId
  };
}

function snapDoc(id, version, windowId, user) {
  return {
    document_type: "wearable_daily_snapshot",
    snapshot_id: id,
    snapshot_version: version,
    user_id: user || "u1",
    day_window_id: windowId || "dw_1"
  };
}

function snapPtr(snapId, version, windowId, user) {
  return {
    document_type: "current_snapshot_pointer",
    user_id: user || "u1",
    day_window_id: windowId || "dw_1",
    snapshot_id: snapId,
    snapshot_version: version
  };
}

function connDoc(id) {
  return {
    document_type: "wearable_connection",
    schema_version: 1,
    connection_id: id || "conn_1",
    provider_id: "garmin.connect",
    user_id: "u1",
    state: "connected",
    sync_enabled: true
  };
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

test("syntax: wearable store parses", function () {
  syntaxCheck("wearables.store.js");
});

test("1. DB opens", function () {
  const store = openStore(loadWorld());
  const opened = store.open();
  assert.strictEqual(opened.schema_version, 1);
  assert.strictEqual(opened.backend, "memory");
  store.close();
});

test("2. Schema version explicit", function () {
  const world = loadWorld();
  assert.strictEqual(world.storeApi.SCHEMA_VERSION, 1);
  assert.strictEqual(world.storeApi.DB_NAME, "nxtfrm_wearables_db");
  const store = openStore(world);
  const meta = store.get("meta", "schema");
  assert.strictEqual(meta.schema_version, 1);
  assert.ok(world.storeApi.STORES.indexOf("observation_revisions") !== -1);
  assert.ok(world.storeApi.STORES.indexOf("snapshot_current_pointers") !== -1);
});

test("3. Empty hydrate works", function () {
  const store = openStore(loadWorld());
  const bundle = store.hydrate();
  assert.strictEqual(bundle.degraded, false);
  assert.strictEqual(bundle.observation_revisions.length, 0);
  assert.strictEqual(bundle.snapshots.length, 0);
  assert.strictEqual(bundle.connections.length, 0);
});

test("4. Observation revision round-trip", function () {
  const store = openStore(loadWorld());
  const doc = obsRev("rev_obs_1");
  store.put("observation_revisions", doc);
  const got = store.get("observation_revisions", "rev_obs_1");
  assert.deepStrictEqual(fromVm(got), doc);
});

test("5. Activity revision round-trip", function () {
  const store = openStore(loadWorld());
  const doc = actRev("rev_act_1");
  store.put("activity_revisions", doc);
  assert.deepStrictEqual(fromVm(store.get("activity_revisions", "rev_act_1")), doc);
});

test("6. Observation pointer round-trip", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_obs_1"));
  const ptr = obsPtr("rev_obs_1");
  store.put("observation_current_pointers", ptr);
  assert.deepStrictEqual(fromVm(store.get("observation_current_pointers", "u1|obs_a")), ptr);
});

test("7. Activity pointer round-trip", function () {
  const store = openStore(loadWorld());
  store.put("activity_revisions", actRev("rev_act_1"));
  const ptr = actPtr("rev_act_1");
  store.put("activity_current_pointers", ptr);
  assert.deepStrictEqual(fromVm(store.get("activity_current_pointers", "u1|act_a")), ptr);
});

test("8. Day window round-trip", function () {
  const store = openStore(loadWorld());
  const doc = windowDoc("dw_1");
  store.put("day_windows", doc);
  assert.deepStrictEqual(fromVm(store.get("day_windows", "dw_1")), doc);
});

test("9. Day-window pointer round-trip", function () {
  const store = openStore(loadWorld());
  store.put("day_windows", windowDoc("dw_1"));
  const ptr = windowPtr("dw_1");
  store.put("day_window_current_pointers", ptr);
  assert.deepStrictEqual(fromVm(store.get("day_window_current_pointers", "u1|2026-09-14")), ptr);
});

test("10. Snapshot round-trip", function () {
  const store = openStore(loadWorld());
  const doc = snapDoc("snap_1", 1);
  store.put("snapshots", doc);
  assert.deepStrictEqual(fromVm(store.get("snapshots", "snap_1")), doc);
});

test("11. Snapshot pointer round-trip", function () {
  const store = openStore(loadWorld());
  store.put("snapshots", snapDoc("snap_1", 1));
  const ptr = snapPtr("snap_1", 1);
  store.put("snapshot_current_pointers", ptr);
  assert.deepStrictEqual(fromVm(store.get("snapshot_current_pointers", "u1|dw_1")), ptr);
});

test("12. Connection round-trip", function () {
  const store = openStore(loadWorld());
  const doc = connDoc("conn_live");
  store.put("connections", doc);
  assert.deepStrictEqual(fromVm(store.get("connections", "conn_live")), doc);
});

test("13. Checkpoint round-trip", function () {
  const store = openStore(loadWorld());
  const doc = {
    document_type: "wearable_sync_checkpoint",
    schema_version: 1,
    connection_id: "conn_1",
    cursor: "page:2",
    updated_at_utc: "2026-09-14T08:00:00Z"
  };
  store.put("sync_checkpoints", doc);
  assert.deepStrictEqual(fromVm(store.get("sync_checkpoints", "conn_1")), doc);
});

test("14. Sync run round-trip", function () {
  const store = openStore(loadWorld());
  const doc = {
    document_type: "wearable_sync_run",
    schema_version: 1,
    sync_id: "sync_1",
    status: "success",
    provider_id: "nxtfrm.synthetic"
  };
  store.put("sync_runs", doc);
  assert.deepStrictEqual(fromVm(store.get("sync_runs", "sync_1")), doc);
});

test("15. No is_current introduced", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_obs_1"));
  store.put("snapshots", snapDoc("snap_1", 1));
  store.put("day_windows", windowDoc("dw_1"));
  assert.strictEqual(codeOf(function () {
    store.put("observation_revisions", Object.assign(obsRev("rev_bad"), { is_current: true }));
  }), "malformed_record");
  const src = fs.readFileSync(path.join(ROOT, "wearables.store.js"), "utf8");
  assert.ok(src.indexOf("is_current: true") === -1);
  const bundle = store.hydrate();
  JSON.stringify(bundle).indexOf("is_current");
  assert.ok(!bundle.observation_revisions.some(function (d) { return Object.prototype.hasOwnProperty.call(d, "is_current"); }));
});

test("16. Immutable records not mutated on read", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_obs_1"));
  const got = store.get("observation_revisions", "rev_obs_1");
  got.user_id = "mutated";
  got.provenance.identities.revision_id = "mutated";
  const again = store.get("observation_revisions", "rev_obs_1");
  assert.strictEqual(again.user_id, "u1");
  assert.strictEqual(again.provenance.identities.revision_id, "rev_obs_1");
});

test("17. Pointer validation exact", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_obs_1"));
  store.put("observation_current_pointers", obsPtr("rev_obs_1"));
  const ptr = store.get("observation_current_pointers", "u1|obs_a");
  assert.strictEqual(ptr.revision_id, "rev_obs_1");
});

test("18. Missing pointer target detected", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.put("observation_current_pointers", obsPtr("missing_rev"));
  }), "invalid_pointer");
  store._test.inject("observation_current_pointers", "u1|obs_a", obsPtr("missing_rev"));
  const bundle = store.hydrate();
  assert.strictEqual(bundle.degraded, true);
  assert.strictEqual(bundle.observation_pointers.length, 0);
  assert.ok(bundle.skipped.some(function (s) { return s.store === "observation_current_pointers"; }));
});

test("19. Wrong-user pointer detected", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_obs_1", "obs_a", "u1"));
  assert.strictEqual(codeOf(function () {
    store.put("observation_current_pointers", obsPtr("rev_obs_1", "obs_a", "u2"));
  }), "invalid_pointer");
});

test("20. Wrong-lineage pointer detected", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_obs_1", "obs_a"));
  store.put("observation_revisions", obsRev("rev_obs_b", "obs_b"));
  assert.strictEqual(codeOf(function () {
    store.put("observation_current_pointers", obsPtr("rev_obs_1", "obs_b"));
  }), "invalid_pointer");
});

test("21. Snapshot pointer does not use max version", function () {
  const store = openStore(loadWorld());
  store.put("snapshots", snapDoc("snap_v2", 2));
  store.put("snapshots", snapDoc("snap_v1", 1));
  store.put("snapshot_current_pointers", snapPtr("snap_v1", 1));
  const ptr = store.get("snapshot_current_pointers", "u1|dw_1");
  assert.strictEqual(ptr.snapshot_id, "snap_v1");
  assert.strictEqual(ptr.snapshot_version, 1);
  const bundle = store.hydrate();
  assert.strictEqual(bundle.snapshot_pointers[0].snapshot_version, 1);
});

test("22. Day-window pointer does not use lexical ID", function () {
  const store = openStore(loadWorld());
  store.put("day_windows", windowDoc("dw_zzz"));
  store.put("day_windows", windowDoc("dw_aaa"));
  store.put("day_window_current_pointers", windowPtr("dw_zzz"));
  const ptr = store.get("day_window_current_pointers", "u1|2026-09-14");
  assert.strictEqual(ptr.day_window_id, "dw_zzz");
});

test("23. Revision pointer does not use newest timestamp", function () {
  const store = openStore(loadWorld());
  store.put("observation_revisions", obsRev("rev_new", "obs_a", "u1", "2026-09-14T09:00:00Z"));
  store.put("observation_revisions", obsRev("rev_old", "obs_a", "u1", "2026-09-14T01:00:00Z"));
  store.put("observation_current_pointers", obsPtr("rev_old"));
  const ptr = store.get("observation_current_pointers", "u1|obs_a");
  assert.strictEqual(ptr.revision_id, "rev_old");
});

test("24. Transaction rollback on failure", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.transaction(["observation_revisions"], "readwrite", function (tx) {
      tx.put("observation_revisions", obsRev("rev_obs_1"));
      throw new Error("crash after revision");
    });
  }), undefined);
  assert.strictEqual(store.get("observation_revisions", "rev_obs_1"), null);
});

test("25. Revision + pointer atomic", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.transaction(null, "readwrite", function (tx) {
      tx.put("observation_revisions", obsRev("rev_obs_1"));
      throw new Error("crash before pointer");
    });
  }), undefined);
  assert.strictEqual(store.get("observation_revisions", "rev_obs_1"), null);
  store.transaction(null, "readwrite", function (tx) {
    tx.put("observation_revisions", obsRev("rev_obs_1"));
    tx.put("observation_current_pointers", obsPtr("rev_obs_1"));
  });
  assert.ok(store.get("observation_revisions", "rev_obs_1"));
  assert.ok(store.get("observation_current_pointers", "u1|obs_a"));
});

test("26. Snapshot + pointer atomic", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.transaction(null, "readwrite", function (tx) {
      tx.put("snapshots", snapDoc("snap_1", 1));
      throw new Error("crash before snapshot pointer");
    });
  }), undefined);
  assert.strictEqual(store.get("snapshots", "snap_1"), null);
  store.transaction(null, "readwrite", function (tx) {
    tx.put("snapshots", snapDoc("snap_1", 1));
    tx.put("snapshot_current_pointers", snapPtr("snap_1", 1));
  });
  assert.ok(store.get("snapshots", "snap_1"));
  assert.ok(store.get("snapshot_current_pointers", "u1|dw_1"));
});

test("27. malformed record fail-closed", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.put("observation_revisions", { document_type: "observation_revision" });
  }), "malformed_record");
  store._test.inject("observation_revisions", "bad", { foo: 1 });
  const bundle = store.hydrate();
  assert.strictEqual(bundle.degraded, true);
  assert.ok(bundle.observation_revisions.every(function (d) { return d.document_type === "observation_revision"; }));
  assert.ok(bundle.skipped.length >= 1);
});

test("28. DB restart preserves exact canonical state", function () {
  const world = loadWorld();
  const store = openStore(world);
  store.put("observation_revisions", obsRev("rev_obs_1"));
  store.put("observation_current_pointers", obsPtr("rev_obs_1"));
  store.put("snapshots", snapDoc("snap_1", 1));
  store.put("snapshot_current_pointers", snapPtr("snap_1", 1));
  const bundle = store.exportBundle();
  store.close();
  const store2 = world.storeApi.createMemoryStore();
  store2.open();
  store2.importBundle(bundle);
  assert.strictEqual(store2.get("observation_current_pointers", "u1|obs_a").revision_id, "rev_obs_1");
  assert.strictEqual(store2.get("snapshot_current_pointers", "u1|dw_1").snapshot_id, "snap_1");
});

test("29. Hydration ordering deterministic", function () {
  const store = openStore(loadWorld());
  store.put("snapshots", snapDoc("snap_z", 2));
  store.put("snapshots", snapDoc("snap_a", 1));
  store.put("snapshot_current_pointers", snapPtr("snap_a", 1));
  const first = JSON.stringify(store.hydrate().snapshot_pointers);
  const second = JSON.stringify(store.hydrate().snapshot_pointers);
  assert.strictEqual(first, second);
  assert.strictEqual(store.hydrate().snapshot_pointers[0].snapshot_id, "snap_a");
});

test("30. Storage independent of insertion order", function () {
  const a = openStore(loadWorld());
  a.put("observation_revisions", obsRev("rev_b", "obs_a", "u1", "2026-09-14T09:00:00Z"));
  a.put("observation_revisions", obsRev("rev_a", "obs_a", "u1", "2026-09-14T01:00:00Z"));
  a.put("observation_current_pointers", obsPtr("rev_a"));
  const b = openStore(loadWorld());
  b.put("observation_revisions", obsRev("rev_a", "obs_a", "u1", "2026-09-14T01:00:00Z"));
  b.put("observation_revisions", obsRev("rev_b", "obs_a", "u1", "2026-09-14T09:00:00Z"));
  b.put("observation_current_pointers", obsPtr("rev_a"));
  assert.strictEqual(a.hydrate().observation_pointers[0].revision_id, "rev_a");
  assert.strictEqual(b.hydrate().observation_pointers[0].revision_id, "rev_a");
});

test("70. No provider secret in localStorage", function () {
  const world = loadWorld();
  const store = openStore(world);
  store.put("connections", connDoc("conn_1"));
  const keys = Object.keys(world.storage.store);
  keys.forEach(function (key) {
    assert.ok(String(world.storage.store[key]).indexOf("client_secret") === -1);
    assert.ok(String(world.storage.store[key]).indexOf("refresh_token") === -1);
  });
});

test("71. No provider secret in IndexedDB/memory store", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.put("connections", Object.assign(connDoc("conn_secret"), { refresh_token: "secret-value" }));
  }), "persistence_failed");
  assert.strictEqual(codeOf(function () {
    store.put("connections", Object.assign(connDoc("conn_secret2"), { access_token: "tok" }));
  }), "persistence_failed");
  assert.strictEqual(store.get("connections", "conn_secret"), null);
});

test("store refuses private key material", function () {
  const store = openStore(loadWorld());
  assert.strictEqual(codeOf(function () {
    store.put("sync_runs", {
      sync_id: "s1",
      note: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
    });
  }), "persistence_failed");
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
