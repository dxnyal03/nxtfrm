/* NXTFRM G3A: provider-neutral wearable reads. No recovery, ingest, or UI. */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var ERR_PROD = "fixture_forbidden_in_production";

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isoDateOk(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false;
    var ms = Date.parse(date + "T12:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date;
  }

  function loopbackHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  }

  function productionHost() {
    try {
      if (typeof location !== "object" || !location) return false;
      var host = String(location.hostname || "");
      if (loopbackHost(host)) return false;
      if (location.protocol === "file:") return false;
      return !!host;
    } catch (e) {
      return false;
    }
  }

  function runtimeMode(explicit) {
    if (productionHost()) return "production";
    if (explicit === "production" || explicit === "development" || explicit === "test") return explicit;
    try {
      if (typeof process === "object" && process && process.env) {
        if (process.env.NXTFRM_MODE === "production") return "production";
        if (process.env.NXTFRM_MODE === "test" || process.env.NODE_ENV === "test") return "test";
      }
    } catch (e) {}
    try {
      if (typeof location === "object" && location) {
        var host = String(location.hostname || "");
        if (loopbackHost(host)) return "development";
        if (location.protocol === "file:") return "development";
        return "production";
      }
    } catch (e) {}
    return "test";
  }

  function isProduction(mode) {
    return runtimeMode(mode) === "production";
  }

  function productionError() {
    var err = new Error("Fixture wearable provider is forbidden in production.");
    err.code = ERR_PROD;
    return err;
  }

  function activityRevisionId(doc) {
    return doc && doc.provenance && doc.provenance.identities
      ? doc.provenance.identities.activity_revision_id
      : null;
  }

  function rejectAcceptedFixtureDiagnostics(documents) {
    (documents || []).forEach(function (doc) {
      if (!doc || doc.document_type !== "ingest_diagnostic") return;
      var kind = doc.source && doc.source.kind;
      var outcome = String(doc.outcome || "");
      if (kind === "fixture_dataset" && (outcome === "accepted_new" || outcome === "accepted_revision")) {
        throw productionError();
      }
    });
  }

  function indexDocuments(documents) {
    var windows = new Map();
    var snaps = new Map();
    var acts = new Map();
    var dwPtr = new Map();
    var snapPtr = new Map();
    var actPtr = new Map();
    (documents || []).forEach(function (doc) {
      if (!doc || typeof doc !== "object") return;
      switch (doc.document_type) {
        case "user_day_window":
          windows.set(doc.day_window_id, doc);
          break;
        case "wearable_daily_snapshot":
          snaps.set(doc.snapshot_id, doc);
          break;
        case "wearable_activity_revision":
          var rev = activityRevisionId(doc);
          if (rev) acts.set(rev, doc);
          break;
        case "current_day_window_pointer":
          dwPtr.set(doc.user_id + "|" + doc.local_date, doc);
          break;
        case "current_snapshot_pointer":
          snapPtr.set(doc.user_id + "|" + doc.day_window_id, doc);
          break;
        case "current_activity_pointer":
          actPtr.set(doc.user_id + "|" + doc.canonical_activity_id, doc);
          break;
        default:
          break;
      }
    });
    return {
      documents: documents || [],
      windows: windows,
      snaps: snaps,
      acts: acts,
      dwPtr: dwPtr,
      snapPtr: snapPtr,
      actPtr: actPtr
    };
  }

  function createWearables(createOpts) {
    createOpts = createOpts || {};
    var lockedMode = createOpts.mode;
    var provider = null;

    function modeNow() {
      return runtimeMode(lockedMode || (provider && provider.mode));
    }

    function inactive() {
      return !provider || isProduction(modeNow());
    }

    function useFixtureProvider(documents, opts) {
      opts = opts || {};
      var mode = runtimeMode(opts.mode || lockedMode);
      if (mode === "production") throw productionError();
      rejectAcceptedFixtureDiagnostics(documents);
      provider = {
        kind: "fixture",
        mode: mode,
        origin: "g2.expected.subset",
        store: indexDocuments(documents)
      };
      return status();
    }

    function resolveWindow(date, options) {
      if (inactive() || !isoDateOk(date)) return null;
      var store = provider.store;
      var userId = options && options.userId;
      if (!userId) {
        var matches = [];
        store.dwPtr.forEach(function (ptr) {
          if (ptr.local_date === date) matches.push(ptr);
        });
        if (matches.length !== 1) return null;
        userId = matches[0].user_id;
      }
      var pointer = store.dwPtr.get(userId + "|" + date);
      if (!pointer) return null;
      var window = store.windows.get(pointer.day_window_id);
      if (!window) return null;
      if (window.user_id !== pointer.user_id || window.local_date !== pointer.local_date || window.day_window_id !== pointer.day_window_id) {
        return null;
      }
      return { userId: userId, pointer: pointer, window: window };
    }

    function getDayWindow(date, options) {
      var resolved = resolveWindow(date, options);
      return resolved ? clone(resolved.window) : null;
    }

    function getDaily(date, options) {
      var resolved = resolveWindow(date, options);
      if (!resolved) return null;
      var store = provider.store;
      var pointer = store.snapPtr.get(resolved.userId + "|" + resolved.window.day_window_id);
      if (!pointer) return null;
      var snap = store.snaps.get(pointer.snapshot_id);
      if (!snap) return null;
      if (
        snap.user_id !== pointer.user_id ||
        snap.day_window_id !== pointer.day_window_id ||
        snap.snapshot_id !== pointer.snapshot_id ||
        snap.snapshot_version !== pointer.snapshot_version
      ) {
        return null;
      }
      return clone(snap);
    }

    function getSnapshot(snapshotId) {
      if (inactive() || snapshotId == null) return null;
      var snap = provider.store.snaps.get(snapshotId);
      return snap ? clone(snap) : null;
    }

    function getActivityRevision(activityRevisionId) {
      if (inactive() || activityRevisionId == null) return null;
      var act = provider.store.acts.get(activityRevisionId);
      return act ? clone(act) : null;
    }

    function resolvePinnedActivities(snapshot) {
      if (inactive() || !snapshot || typeof snapshot !== "object") return [];
      var pins = Array.isArray(snapshot.overlapping_activities) ? snapshot.overlapping_activities : [];
      var out = [];
      for (var i = 0; i < pins.length; i++) {
        var pin = pins[i];
        if (!pin || !pin.activity_revision_id) continue;
        var revision = provider.store.acts.get(pin.activity_revision_id);
        if (!revision) continue;
        if (pin.canonical_activity_id && revision.provenance && revision.provenance.identities) {
          if (revision.provenance.identities.canonical_activity_id !== pin.canonical_activity_id) continue;
        }
        out.push(clone(revision));
      }
      return out;
    }

    function status() {
      var mode = modeNow();
      var prod = isProduction(mode);
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables",
        provider: provider ? provider.kind : "none",
        mode: mode,
        ready: !!(provider && !prod),
        fixture_allowed: !prod,
        interprets_recovery: false,
        persists: false,
        network: false,
        production_guard: prod ? ERR_PROD : null
      };
    }

    return {
      getDaily: getDaily,
      getDayWindow: getDayWindow,
      getSnapshot: getSnapshot,
      getActivityRevision: getActivityRevision,
      resolvePinnedActivities: resolvePinnedActivities,
      status: status,
      useFixtureProvider: useFixtureProvider
    };
  }

  var pageApi = createWearables();
  if (typeof NXT === "object" && NXT) NXT.wearables = pageApi;
  root.NXTFRMWearables = {
    create: createWearables,
    api: pageApi,
    schemaVersion: SCHEMA,
    errorCodes: { fixture_forbidden_in_production: ERR_PROD }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
