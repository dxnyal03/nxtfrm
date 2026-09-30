/* NXTFRM P2: durable wearable persistence. Canonical evidence + operational metadata only.
 * No provider secrets. Currentness is pointers, never is_current.
 */
"use strict";
(function (root) {
  var BOUNDARY = "p2.wearable_store";
  var DB_NAME = "nxtfrm_wearables_db";
  var SCHEMA_VERSION = 1;
  var STORES = Object.freeze([
    "meta",
    "connections",
    "deliveries",
    "observation_revisions",
    "activity_revisions",
    "observation_current_pointers",
    "activity_current_pointers",
    "day_windows",
    "day_window_current_pointers",
    "snapshots",
    "snapshot_current_pointers",
    "sync_checkpoints",
    "sync_runs"
  ]);
  var SECRET_KEY = /(^|_)(secret|refresh_token|client_secret|webhook_secret|private_key|access_token|id_token)$/i;
  var SECRET_KEY_FULL = /client_secret|refresh_secret|webhook_signing|private_oauth|api_secret/i;

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function storeError(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function assertNoSecrets(doc) {
    function walk(node) {
      if (!node || typeof node !== "object") return;
      Object.keys(node).forEach(function (key) {
        if (SECRET_KEY.test(key) || SECRET_KEY_FULL.test(key)) {
          throw storeError("persistence_failed", "Refusing to persist secret-bearing field: " + key);
        }
        var val = node[key];
        if (typeof val === "string" && /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(val)) {
          throw storeError("persistence_failed", "Refusing to persist private key material.");
        }
        walk(val);
      });
    }
    walk(doc);
  }

  function assertNoCurrent(doc, label) {
    if (doc && Object.prototype.hasOwnProperty.call(doc, "is_current")) {
      throw storeError("malformed_record", (label || "record") + " must not persist is_current.");
    }
  }

  function keyFor(store, doc) {
    if (!doc || typeof doc !== "object") throw storeError("malformed_record", store + " record is required.");
    switch (store) {
      case "meta":
        return doc.id || "schema";
      case "connections":
        if (!isNonEmptyString(doc.connection_id)) throw storeError("malformed_record", "connection_id is required.");
        return doc.connection_id;
      case "deliveries":
        if (!isNonEmptyString(doc.delivery_id)) throw storeError("malformed_record", "delivery_id is required.");
        return doc.delivery_id;
      case "observation_revisions":
        if (!doc.provenance || !doc.provenance.identities || !isNonEmptyString(doc.provenance.identities.revision_id)) {
          throw storeError("malformed_record", "observation revision_id is required.");
        }
        return doc.provenance.identities.revision_id;
      case "activity_revisions":
        if (!doc.provenance || !doc.provenance.identities || !isNonEmptyString(doc.provenance.identities.activity_revision_id)) {
          throw storeError("malformed_record", "activity_revision_id is required.");
        }
        return doc.provenance.identities.activity_revision_id;
      case "observation_current_pointers":
        if (!isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.canonical_observation_id)) {
          throw storeError("malformed_record", "observation pointer identity is incomplete.");
        }
        return doc.user_id + "|" + doc.canonical_observation_id;
      case "activity_current_pointers":
        if (!isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.canonical_activity_id)) {
          throw storeError("malformed_record", "activity pointer identity is incomplete.");
        }
        return doc.user_id + "|" + doc.canonical_activity_id;
      case "day_windows":
        if (!isNonEmptyString(doc.day_window_id)) throw storeError("malformed_record", "day_window_id is required.");
        return doc.day_window_id;
      case "day_window_current_pointers":
        if (!isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.local_date)) {
          throw storeError("malformed_record", "day-window pointer identity is incomplete.");
        }
        return doc.user_id + "|" + doc.local_date;
      case "snapshots":
        if (!isNonEmptyString(doc.snapshot_id)) throw storeError("malformed_record", "snapshot_id is required.");
        return doc.snapshot_id;
      case "snapshot_current_pointers":
        if (!isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.day_window_id)) {
          throw storeError("malformed_record", "snapshot pointer identity is incomplete.");
        }
        return doc.user_id + "|" + doc.day_window_id;
      case "sync_checkpoints":
        if (!isNonEmptyString(doc.connection_id)) throw storeError("malformed_record", "checkpoint connection_id is required.");
        return doc.connection_id;
      case "sync_runs":
        if (!isNonEmptyString(doc.sync_id)) throw storeError("malformed_record", "sync_id is required.");
        return doc.sync_id;
      default:
        throw storeError("malformed_record", "unknown store: " + store);
    }
  }

  function validatePut(store, doc) {
    if (STORES.indexOf(store) === -1) throw storeError("malformed_record", "unknown store: " + store);
    assertNoSecrets(doc);
    if (store !== "meta" && store !== "connections" && store !== "sync_checkpoints" && store !== "sync_runs" && store !== "deliveries") {
      assertNoCurrent(doc, store);
    }
    if (store === "observation_revisions" && doc.document_type !== "observation_revision") {
      throw storeError("malformed_record", "observation_revision envelope is invalid.");
    }
    if (store === "activity_revisions" && doc.document_type !== "wearable_activity_revision") {
      throw storeError("malformed_record", "activity revision envelope is invalid.");
    }
    if (store === "day_windows" && doc.document_type !== "user_day_window") {
      throw storeError("malformed_record", "user_day_window envelope is invalid.");
    }
    if (store === "snapshots" && doc.document_type !== "wearable_daily_snapshot") {
      throw storeError("malformed_record", "wearable_daily_snapshot envelope is invalid.");
    }
    if (store === "observation_current_pointers" && doc.document_type !== "current_observation_pointer") {
      throw storeError("malformed_record", "observation pointer envelope is invalid.");
    }
    if (store === "activity_current_pointers" && doc.document_type !== "current_activity_pointer") {
      throw storeError("malformed_record", "activity pointer envelope is invalid.");
    }
    if (store === "day_window_current_pointers" && doc.document_type !== "current_day_window_pointer") {
      throw storeError("malformed_record", "day-window pointer envelope is invalid.");
    }
    if (store === "snapshot_current_pointers" && doc.document_type !== "current_snapshot_pointer") {
      throw storeError("malformed_record", "snapshot pointer envelope is invalid.");
    }
    if (store === "connections") {
      if (doc.document_type !== "wearable_connection") throw storeError("malformed_record", "connection envelope is invalid.");
      if (doc.schema_version !== SCHEMA_VERSION) throw storeError("malformed_record", "connection schema_version must be 1.");
    }
    return keyFor(store, doc);
  }

  function emptyMaps() {
    var maps = {};
    STORES.forEach(function (name) { maps[name] = new Map(); });
    maps.meta.set("schema", { id: "schema", schema_version: SCHEMA_VERSION, db_name: DB_NAME });
    return maps;
  }

  function cloneMaps(maps) {
    var out = {};
    STORES.forEach(function (name) {
      out[name] = new Map();
      maps[name].forEach(function (value, key) {
        out[name].set(key, clone(value));
      });
    });
    return out;
  }

  function validatePointerExact(store, maps, doc) {
    if (store === "observation_current_pointers") {
      var obs = maps.observation_revisions.get(doc.revision_id);
      if (!obs) throw storeError("invalid_pointer", "observation pointer target is missing.");
      if (obs.user_id !== doc.user_id) throw storeError("invalid_pointer", "observation pointer user_id does not match revision.");
      if (obs.provenance.identities.canonical_observation_id !== doc.canonical_observation_id) {
        throw storeError("invalid_pointer", "observation pointer lineage does not match revision.");
      }
    }
    if (store === "activity_current_pointers") {
      var act = maps.activity_revisions.get(doc.activity_revision_id);
      if (!act) throw storeError("invalid_pointer", "activity pointer target is missing.");
      if (act.user_id !== doc.user_id) throw storeError("invalid_pointer", "activity pointer user_id does not match revision.");
      if (act.provenance.identities.canonical_activity_id !== doc.canonical_activity_id) {
        throw storeError("invalid_pointer", "activity pointer lineage does not match revision.");
      }
    }
    if (store === "day_window_current_pointers") {
      var win = maps.day_windows.get(doc.day_window_id);
      if (!win) throw storeError("invalid_pointer", "day-window pointer target is missing.");
      if (win.user_id !== doc.user_id) throw storeError("invalid_pointer", "day-window pointer user_id does not match window.");
      if (win.local_date !== doc.local_date) throw storeError("invalid_pointer", "day-window pointer local_date does not match window.");
    }
    if (store === "snapshot_current_pointers") {
      var snap = maps.snapshots.get(doc.snapshot_id);
      if (!snap) throw storeError("invalid_pointer", "snapshot pointer target is missing.");
      if (snap.user_id !== doc.user_id) throw storeError("invalid_pointer", "snapshot pointer user_id does not match snapshot.");
      if (snap.day_window_id !== doc.day_window_id) throw storeError("invalid_pointer", "snapshot pointer day_window_id does not match snapshot.");
      if (snap.snapshot_version !== doc.snapshot_version) {
        throw storeError("invalid_pointer", "snapshot pointer version does not match snapshot.");
      }
    }
  }

  function createMemoryStore() {
    var maps = emptyMaps();
    var opened = false;

    function requireOpen() {
      if (!opened) throw storeError("persistence_failed", "store is not open.");
    }

    function txPut(working, store, doc) {
      var key = validatePut(store, doc);
      validatePointerExact(store, working, doc);
      working[store].set(key, clone(doc));
      return key;
    }

    function api() {
      return {
        backend: "memory",
        dbName: DB_NAME,
        schemaVersion: SCHEMA_VERSION,
        open: function () {
          opened = true;
          if (!maps.meta.get("schema")) {
            maps.meta.set("schema", { id: "schema", schema_version: SCHEMA_VERSION, db_name: DB_NAME });
          }
          return { schema_version: SCHEMA_VERSION, backend: "memory" };
        },
        close: function () {
          opened = false;
        },
        deleteDatabase: function () {
          maps = emptyMaps();
          opened = false;
        },
        clearAll: function () {
          requireOpen();
          maps = emptyMaps();
        },
        transaction: function (storeNames, mode, fn) {
          requireOpen();
          var names = storeNames && storeNames.length ? storeNames.slice() : STORES.slice();
          names.forEach(function (name) {
            if (STORES.indexOf(name) === -1) throw storeError("malformed_record", "unknown store: " + name);
          });
          if (mode === "readonly") {
            var ro = {
              get: function (store, key) {
                var row = maps[store].get(key);
                return row ? clone(row) : null;
              },
              getAll: function (store) {
                return Array.from(maps[store].values()).map(clone);
              },
              put: function () { throw storeError("persistence_failed", "readonly transaction cannot put."); }
            };
            return fn(ro);
          }
          var working = cloneMaps(maps);
          var rw = {
            get: function (store, key) {
              var row = working[store].get(key);
              return row ? clone(row) : null;
            },
            getAll: function (store) {
              return Array.from(working[store].values()).map(clone);
            },
            put: function (store, doc) { return txPut(working, store, doc); }
          };
          var result = fn(rw);
          maps = working;
          return result;
        },
        put: function (store, doc) {
          return this.transaction([store], "readwrite", function (tx) { return tx.put(store, doc); });
        },
        get: function (store, key) {
          requireOpen();
          var row = maps[store] && maps[store].get(key);
          return row ? clone(row) : null;
        },
        getAll: function (store) {
          requireOpen();
          return Array.from(maps[store].values()).map(clone);
        },
        exportBundle: function () {
          requireOpen();
          var bundle = { schema_version: SCHEMA_VERSION, db_name: DB_NAME };
          STORES.forEach(function (name) {
            bundle[name] = Array.from(maps[name].values()).map(clone);
          });
          return bundle;
        },
        importBundle: function (bundle) {
          requireOpen();
          if (!bundle || bundle.schema_version !== SCHEMA_VERSION) {
            throw storeError("malformed_record", "bundle schema_version must be 1.");
          }
          var working = emptyMaps();
          STORES.forEach(function (name) {
            (bundle[name] || []).forEach(function (doc) {
              txPut(working, name, doc);
            });
          });
          maps = working;
          return { outcome: "ok" };
        },
        hydrate: function () {
          requireOpen();
          var skipped = [];
          var degraded = false;
          function take(store) {
            var out = [];
            maps[store].forEach(function (doc, key) {
              try {
                validatePut(store, doc);
                validatePointerExact(store, maps, doc);
                out.push(clone(doc));
              } catch (err) {
                degraded = true;
                skipped.push({
                  store: store,
                  key: key,
                  reason: err && err.message ? err.message : "malformed"
                });
              }
            });
            return out;
          }
          var meta = take("meta");
          var connections = take("connections");
          var deliveries = take("deliveries");
          var observation_revisions = take("observation_revisions");
          var activity_revisions = take("activity_revisions");
          var observation_pointers = take("observation_current_pointers");
          var activity_pointers = take("activity_current_pointers");
          var day_windows = take("day_windows");
          var day_window_pointers = take("day_window_current_pointers");
          var snapshots = take("snapshots");
          var snapshot_pointers = take("snapshot_current_pointers");
          var sync_checkpoints = take("sync_checkpoints");
          var sync_runs = take("sync_runs");
          return {
            schema_version: SCHEMA_VERSION,
            degraded: degraded,
            skipped: skipped,
            meta: meta,
            connections: connections,
            deliveries: deliveries,
            observation_revisions: observation_revisions,
            activity_revisions: activity_revisions,
            observation_pointers: observation_pointers,
            activity_pointers: activity_pointers,
            day_windows: day_windows,
            day_window_pointers: day_window_pointers,
            snapshots: snapshots,
            snapshot_pointers: snapshot_pointers,
            sync_checkpoints: sync_checkpoints,
            sync_runs: sync_runs
          };
        },
        _test: {
          inject: function (store, key, doc) {
            requireOpen();
            if (!maps[store]) throw storeError("malformed_record", "unknown store: " + store);
            maps[store].set(key, clone(doc));
          }
        }
      };
    }

    return api();
  }

  function idbReq(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function createIndexedDBStore() {
    var db = null;
    var memory = createMemoryStore();

    function ensureStores(raw) {
      STORES.forEach(function (name) {
        if (!raw.objectStoreNames.contains(name)) raw.createObjectStore(name);
      });
    }

    return {
      backend: "indexeddb",
      dbName: DB_NAME,
      schemaVersion: SCHEMA_VERSION,
      open: function () {
        if (typeof indexedDB === "undefined") return memory.open();
        return new Promise(function (resolve, reject) {
          var req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
          req.onupgradeneeded = function () { ensureStores(req.result); };
          req.onsuccess = function () {
            db = req.result;
            resolve({ schema_version: SCHEMA_VERSION, backend: "indexeddb" });
          };
          req.onerror = function () { reject(req.error); };
        });
      },
      close: function () {
        if (db) { db.close(); db = null; }
        return Promise.resolve();
      },
      deleteDatabase: function () {
        var self = this;
        return this.close().then(function () {
          if (typeof indexedDB === "undefined") return memory.deleteDatabase();
          return idbReq(indexedDB.deleteDatabase(DB_NAME));
        });
      },
      clearAll: function () {
        if (!db) return Promise.reject(storeError("persistence_failed", "store is not open."));
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORES.slice(), "readwrite");
          STORES.forEach(function (name) { tx.objectStore(name).clear(); });
          tx.objectStore("meta").put({ id: "schema", schema_version: SCHEMA_VERSION, db_name: DB_NAME }, "schema");
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      },
      transaction: function (storeNames, mode, fn) {
        if (!db) return Promise.reject(storeError("persistence_failed", "store is not open."));
        var names = storeNames && storeNames.length ? storeNames.slice() : STORES.slice();
        var idbMode = mode === "readonly" ? "readonly" : "readwrite";
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(names, idbMode);
          var settled = false;
          var saved;
          function succeed(result) {
            if (settled) return;
            settled = true;
            resolve(result);
          }
          function fail(err) {
            if (settled) return;
            settled = true;
            try { tx.abort(); } catch (e) {}
            reject(err || storeError("persistence_failed", "indexedDB transaction failed"));
          }
          tx.oncomplete = function () { succeed(saved); };
          tx.onerror = function () { fail(tx.error); };
          tx.onabort = function () {
            if (!settled) fail(tx.error || storeError("persistence_failed", "indexedDB transaction aborted"));
          };
          var wrapper = {
            get: function (store, key) {
              return idbReq(tx.objectStore(store).get(key)).then(function (row) { return row ? clone(row) : null; });
            },
            getAll: function (store) {
              return idbReq(tx.objectStore(store).getAll()).then(function (rows) { return (rows || []).map(clone); });
            },
            put: function (store, doc) {
              var key = validatePut(store, doc);
              tx.objectStore(store).put(clone(doc), key);
              return key;
            }
          };
          try {
            saved = fn(wrapper);
          } catch (err) {
            fail(err);
            return;
          }
          Promise.resolve(saved).then(function (value) {
            saved = value;
            if (idbMode === "readonly") succeed(value);
          }).catch(fail);
        });
      },
      put: function (store, doc) {
        return this.transaction([store], "readwrite", function (tx) { return tx.put(store, doc); });
      },
      get: function (store, key) {
        var self = this;
        return this.transaction([store], "readonly", function (tx) { return tx.get(store, key); });
      },
      getAll: function (store) {
        return this.transaction([store], "readonly", function (tx) { return tx.getAll(store); });
      },
      exportBundle: function () {
        var self = this;
        return this.transaction(STORES.slice(), "readonly", function (tx) {
          var bundle = { schema_version: SCHEMA_VERSION, db_name: DB_NAME };
          return Promise.all(STORES.map(function (name) {
            return tx.getAll(name).then(function (rows) { bundle[name] = rows; });
          })).then(function () { return bundle; });
        });
      },
      importBundle: function (bundle) {
        var self = this;
        if (!bundle || bundle.schema_version !== SCHEMA_VERSION) {
          return Promise.reject(storeError("malformed_record", "bundle schema_version must be 1."));
        }
        return this.transaction(STORES.slice(), "readwrite", function (tx) {
          STORES.forEach(function (name) {
            (bundle[name] || []).forEach(function (doc) { tx.put(name, doc); });
          });
        });
      },
      hydrate: function () {
        return this.exportBundle().then(function (bundle) {
          var skipped = [];
          var degraded = false;
          var maps = emptyMaps();
          function take(name) {
            var out = [];
            (bundle[name] || []).forEach(function (doc) {
              try {
                var key = validatePut(name, doc);
                maps[name].set(key, clone(doc));
                validatePointerExact(name, maps, doc);
                out.push(clone(doc));
              } catch (err) {
                degraded = true;
                skipped.push({
                  store: name,
                  reason: err && err.message ? err.message : "malformed"
                });
              }
            });
            return out;
          }
          var meta = take("meta");
          var connections = take("connections");
          var deliveries = take("deliveries");
          var observation_revisions = take("observation_revisions");
          var activity_revisions = take("activity_revisions");
          var observation_pointers = take("observation_current_pointers");
          var activity_pointers = take("activity_current_pointers");
          var day_windows = take("day_windows");
          var day_window_pointers = take("day_window_current_pointers");
          var snapshots = take("snapshots");
          var snapshot_pointers = take("snapshot_current_pointers");
          var sync_checkpoints = take("sync_checkpoints");
          var sync_runs = take("sync_runs");
          return {
            schema_version: SCHEMA_VERSION,
            degraded: degraded,
            skipped: skipped,
            meta: meta,
            connections: connections,
            deliveries: deliveries,
            observation_revisions: observation_revisions,
            activity_revisions: activity_revisions,
            observation_pointers: observation_pointers,
            activity_pointers: activity_pointers,
            day_windows: day_windows,
            day_window_pointers: day_window_pointers,
            snapshots: snapshots,
            snapshot_pointers: snapshot_pointers,
            sync_checkpoints: sync_checkpoints,
            sync_runs: sync_runs
          };
        });
      }
    };
  }

  function createStore(opts) {
    opts = opts || {};
    if (opts.backend === "indexeddb") return createIndexedDBStore();
    if (opts.backend === "memory") return createMemoryStore();
    if (typeof indexedDB === "undefined") return createMemoryStore();
    if (typeof location === "object" && location && (location.hostname === "localhost" || location.hostname === "127.0.0.1") && opts.preferMemory) {
      return createMemoryStore();
    }
    return createIndexedDBStore();
  }

  var page = createStore({ backend: typeof indexedDB === "undefined" ? "memory" : "indexeddb" });
  page.createStore = createStore;
  page.createMemoryStore = createMemoryStore;
  page.DB_NAME = DB_NAME;
  page.SCHEMA_VERSION = SCHEMA_VERSION;
  page.STORES = STORES;
  page.status = function () {
    return {
      schema_version: SCHEMA_VERSION,
      api: "NXT.wearables.store",
      boundary: BOUNDARY,
      db_name: DB_NAME,
      persists: true,
      network: false,
      secrets: false
    };
  };

  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.store = page;
  root.NXTFRMWearableStore = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
