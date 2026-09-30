/* NXTFRM P1: wearable sync orchestrator. Coordinates G3B–R4. Does not reimplement them.
 * Live Garmin collect is refused. Externally supplied authenticated deliveries may be ingested.
 */
"use strict";
(function (root) {
  var BOUNDARY = "p1.wearable_sync";
  var SCHEMA = 1;
  var STATES = Object.freeze([
    "disconnected", "connecting", "connected", "sync_pending", "syncing",
    "degraded", "auth_expired", "error"
  ]);
  var RUN = Object.freeze({
    running: "running",
    success: "success",
    partial: "partial",
    failed: "failed",
    interrupted: "interrupted"
  });
  var ERROR = Object.freeze({
    auth_expired: "auth_expired",
    network_error: "network_error",
    provider_rate_limited: "provider_rate_limited",
    invalid_delivery: "invalid_delivery",
    normalization_failed: "normalization_failed",
    persistence_failed: "persistence_failed",
    canonical_conflict: "canonical_conflict",
    sync_interrupted: "sync_interrupted",
    concurrent_sync: "concurrent_sync",
    fixture_forbidden_in_production: "fixture_forbidden_in_production",
    authentication_required: "authentication_required"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function utf8Bytes(str) {
    var out = [];
    var i;
    for (i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function sha256Hex(message) {
    var bytes = utf8Bytes(String(message));
    var bitLen = bytes.length * 8;
    var padded = bytes.slice();
    padded.push(0x80);
    while ((padded.length % 64) !== 56) padded.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    padded.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    padded.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var i;
    for (i = 0; i < padded.length; i += 64) {
      var w = new Array(64);
      var t;
      for (t = 0; t < 16; t++) {
        var o = i + t * 4;
        w[t] = ((padded[o] << 24) | (padded[o + 1] << 16) | (padded[o + 2] << 8) | padded[o + 3]) >>> 0;
      }
      for (t = 16; t < 64; t++) {
        var s0 = (rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3)) >>> 0;
        var s1 = (rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var hex = "";
    for (i = 0; i < H.length; i++) hex += ("00000000" + H[i].toString(16)).slice(-8);
    return hex;
  }

  function utcToLocalDate(utc, timezone) {
    if (!isNonEmptyString(utc) || !isNonEmptyString(timezone)) return null;
    var ms = Date.parse(utc);
    if (!Number.isFinite(ms)) return null;
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(ms));
    var y, m, d;
    parts.forEach(function (p) {
      if (p.type === "year") y = p.value;
      if (p.type === "month") m = p.value;
      if (p.type === "day") d = p.value;
    });
    if (!y || !m || !d) return null;
    return y + "-" + m + "-" + d;
  }

  function previewAllowed() {
    try {
      if (typeof location !== "object" || !location) return false;
      var host = String(location.hostname || "");
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || location.protocol === "file:";
    } catch (e) {
      return false;
    }
  }

  function pick(rootObj, path) {
    var cur = rootObj;
    var i;
    for (i = 0; i < path.length; i++) {
      if (!cur) return null;
      cur = cur[path[i]];
    }
    return cur || null;
  }

  function createSync(opts) {
    opts = opts || {};
    var store = opts.store || pick(root, ["NXTFRMWearableStore"]) || (typeof NXT === "object" && NXT.wearables && NXT.wearables.store);
    var ingest = opts.ingest || (typeof NXT === "object" && NXT.wearables && NXT.wearables.ingest);
    var adapters = opts.adapters || (typeof NXT === "object" && NXT.wearables && NXT.wearables.adapters);
    var canonical = opts.canonical || (typeof NXT === "object" && NXT.wearables && NXT.wearables.canonical);
    var days = opts.days || (typeof NXT === "object" && NXT.wearables && NXT.wearables.days);
    var snapshots = opts.snapshots || (typeof NXT === "object" && NXT.wearables && NXT.wearables.snapshots);
    var resolution = opts.resolution || (typeof NXT === "object" && NXT.wearables && NXT.wearables.resolution);
    var recovery = opts.recovery || (typeof NXT === "object" && NXT.wearables && NXT.wearables.recovery);
    var integration = opts.integration || (typeof NXT === "object" && NXT.wearables && NXT.wearables.recoveryIntegration);
    var training = opts.training || (typeof NXT === "object" && NXT.wearables && NXT.wearables.trainingReadiness);
    var connections = new Map();
    var checkpoints = new Map();
    var locks = {};
    var runtime = {
      ready: false,
      degraded: false,
      diagnostics: [],
      integratedByDate: {},
      wearableByDate: {},
      trainingByDate: {},
      lastHydration: null
    };

    function snapshotModules() {
      return {
        canonical: canonical.exportState(),
        days: days.exportState(),
        snapshots: snapshots.exportState()
      };
    }

    function restoreModules(snap) {
      canonical.hydrateState(snap.canonical);
      days.hydrateState(snap.days);
      snapshots.hydrateState(snap.snapshots);
    }

    function persistCanonical(tx) {
      var c = canonical.exportState();
      var d = days.exportState();
      var s = snapshots.exportState();
      (c.observation_revisions || []).forEach(function (doc) { tx.put("observation_revisions", doc); });
      (c.activity_revisions || []).forEach(function (doc) { tx.put("activity_revisions", doc); });
      (c.observation_pointers || []).forEach(function (doc) { tx.put("observation_current_pointers", doc); });
      (c.activity_pointers || []).forEach(function (doc) { tx.put("activity_current_pointers", doc); });
      (d.day_windows || []).forEach(function (doc) { tx.put("day_windows", doc); });
      (d.pointers || []).forEach(function (doc) { tx.put("day_window_current_pointers", doc); });
      (s.snapshots || []).forEach(function (doc) { tx.put("snapshots", doc); });
      (s.pointers || []).forEach(function (doc) { tx.put("snapshot_current_pointers", doc); });
    }

    function saveConnectionRecord(rec) {
      connections.set(rec.connection_id, clone(rec));
      return rec;
    }

    function connect(input) {
      input = input || {};
      if (!isNonEmptyString(input.user_id) || !isNonEmptyString(input.provider_id) || !isNonEmptyString(input.connection_id)) {
        return { outcome: "invalid_input", reason: "user_id, provider_id and connection_id are required.", result: null };
      }
      var rec = {
        document_type: "wearable_connection",
        schema_version: SCHEMA,
        provider_id: input.provider_id,
        connection_id: input.connection_id,
        user_id: input.user_id,
        state: input.state || "connected",
        connected_at_utc: input.connected_at_utc || null,
        last_successful_sync_at_utc: null,
        last_attempt_at_utc: null,
        cursor: null,
        error_code: null,
        error_at_utc: null,
        provider_account_ref: input.provider_account_ref || null,
        representative_timezone: input.timezone || input.representative_timezone || "Asia/Singapore",
        sync_enabled: input.sync_enabled !== false
      };
      saveConnectionRecord(rec);
      return { outcome: "ok", result: clone(rec) };
    }

    function connectLive(input) {
      input = input || {};
      var garmin = typeof NXT === "object" && NXT.wearables && NXT.wearables.providers && NXT.wearables.providers.garmin;
      var decision = garmin && garmin.describeLiveAuth ? garmin.describeLiveAuth() : {
        decision: "LIVE PROVIDER AUTH DEFERRED — SECURE BACKEND / PROVIDER ACCESS REQUIRED"
      };
      return {
        outcome: "auth_deferred",
        state: "disconnected",
        error_code: ERROR.authentication_required,
        live_auth: decision,
        result: null
      };
    }

    function disconnect(connectionId) {
      var rec = connections.get(connectionId);
      if (!rec) return { outcome: "missing", result: null };
      rec.state = "disconnected";
      rec.sync_enabled = false;
      rec.cursor = rec.cursor;
      saveConnectionRecord(rec);
      return { outcome: "ok", result: clone(rec), erased_history: false };
    }

    function lockKey(connectionId, delivery) {
      if (isNonEmptyString(connectionId)) return "conn:" + connectionId;
      var src = delivery && delivery.source_instance_ref;
      if (src && src.kind === "import" && src.import_batch_id) return "import:" + src.import_batch_id;
      if (src && src.kind === "import_batch" && src.import_batch_id) return "import:" + src.import_batch_id;
      return "delivery:" + ((delivery && delivery.delivery_id) || "anon");
    }

    function ensureWindow(userId, localDate, timezone, atUtc) {
      var created = days.createWindow({
        user_id: userId,
        local_date: localDate,
        representative_timezone: timezone,
        assignment_source: "profile"
      });
      if (created.outcome !== "created" && created.outcome !== "reused") return created;
      var set = days.setCurrent(userId, localDate, created.day_window_id, atUtc);
      return { outcome: set.outcome === "invalid_pointer" ? set.outcome : "ok", window: created.window, pointer: set.pointer || days.getCurrentPointer(userId, localDate) };
    }

    function affectedDates(batch, timezone, extraDates) {
      var dates = {};
      (extraDates || []).forEach(function (d) { if (d) dates[d] = true; });
      (batch.candidates || []).forEach(function (c) {
        var times = [];
        if (c.candidate_kind === "activity") {
          times.push(c.start_utc, c.end_utc);
        } else {
          times.push(c.provenance && (c.provenance.observed_at_utc || c.provenance.recorded_at_utc));
          if (c.semantics) {
            times.push(c.semantics.interval_start_utc, c.semantics.interval_end_utc);
            if (c.semantics.sleep && c.semantics.sleep.normalized_wake_date) {
              dates[c.semantics.sleep.normalized_wake_date] = true;
            }
          }
        }
        times.forEach(function (stamp) {
          var local = utcToLocalDate(stamp, timezone);
          if (local) dates[local] = true;
        });
      });
      return Object.keys(dates).sort();
    }

    function rebuildDay(userId, localDate, timezone, atUtc, deliveryId) {
      var ensured = ensureWindow(userId, localDate, timezone, atUtc);
      if (!ensured.window) return { outcome: "missing_day_window" };
      var window = ensured.window;
      var obs = canonical.listAllObservationRevisions(userId);
      var acts = canonical.listAllActivityRevisions(userId);
      var assembled = snapshots.assemble({
        user_id: userId,
        day_window_id: window.day_window_id,
        built_at_utc: atUtc,
        accepted_delivery_id: deliveryId || null,
        observations: obs,
        activities: acts
      });
      if (assembled.outcome !== "assembled" && assembled.outcome !== "assembled_version" && assembled.outcome !== "reused") {
        return assembled;
      }
      var resolved = resolution.resolveCurrent(userId, window.day_window_id, {
        built_at_utc: atUtc,
        accepted_delivery_id: deliveryId || null
      });
      return {
        outcome: "ok",
        window: window,
        assembled: assembled,
        resolved: resolved
      };
    }

    function recoveryInputs(userId) {
      return {
        history: snapshots.listAllSnapshots ? snapshots.listAllSnapshots(userId) : [],
        windows: days.listAllWindows ? days.listAllWindows(userId) : [],
        dayWindowPointers: days.listAllPointers ? days.listAllPointers(userId) : [],
        snapshotPointers: snapshots.listAllPointers ? snapshots.listAllPointers(userId) : []
      };
    }

    function evaluateDay(userId, localDate, window) {
      var extra = recoveryInputs(userId);
      var snap = snapshots.getCurrent(userId, window.day_window_id);
      if (!snap) return { wearable: null, integrated: null, training: null };
      var r1 = recovery.evaluate(Object.assign({ snapshot: snap }, extra));
      var wearable = r1 && r1.result ? r1.result : null;
      var r2 = integration.integrate({
        local_date: localDate,
        wearableRecovery: wearable,
        wearableLocalDate: localDate
      });
      var integrated = r2 && r2.result ? r2.result : null;
      var r4 = integrated && training && typeof training.advise === "function"
        ? training.advise({ integratedRecovery: integrated })
        : null;
      return {
        wearable: wearable,
        integrated: integrated,
        training: r4 && r4.result ? r4.result : null
      };
    }

    function publishRuntime(userId, localDate, evaluated) {
      if (!evaluated) return;
      runtime.wearableByDate[localDate] = evaluated.wearable;
      runtime.integratedByDate[localDate] = evaluated.integrated;
      runtime.trainingByDate[localDate] = evaluated.training;
    }

    function ingestDelivery(input) {
      input = input || {};
      var deliveryIn = clone(input.delivery || input);
      var userId = input.user_id;
      var timezone = input.timezone || input.representative_timezone || "Asia/Singapore";
      var persist = !!input.persist;
      var failPersist = !!input._failPersist;
      if (!isNonEmptyString(userId)) {
        return { status: RUN.failed, error_code: ERROR.invalid_delivery, reason: "user_id is required." };
      }
      var validated;
      try {
        validated = ingest.validateDelivery(deliveryIn);
      } catch (err) {
        return {
          status: RUN.failed,
          error_code: err && err.code === "fixture_forbidden_in_production" ? ERROR.fixture_forbidden_in_production : ERROR.invalid_delivery,
          reason: err && err.message ? err.message : "invalid delivery",
          diagnostics: [{ code: "invalid_delivery" }]
        };
      }
      var src = validated.source_instance_ref || {};
      var connectionId = input.connection_id || src.connection_id || null;
      var key = lockKey(connectionId, validated);
      if (locks[key]) {
        return { status: RUN.failed, error_code: ERROR.concurrent_sync, reason: "connection already syncing." };
      }
      if (connectionId) {
        var conn = connections.get(connectionId);
        if (conn && conn.sync_enabled === false) {
          return { status: RUN.failed, error_code: ERROR.auth_expired, reason: "connection is disconnected.", mutated: false };
        }
      }
      locks[key] = true;
      var moduleSnap = snapshotModules();
      var atUtc = validated.collected_at;
      var syncId = "sync:" + sha256Hex(JSON.stringify({
        delivery_id: validated.delivery_id,
        connection_id: connectionId,
        collected_at: atUtc
      })).slice(0, 32);
      var run = {
        document_type: "wearable_sync_run",
        schema_version: SCHEMA,
        sync_id: syncId,
        provider_id: validated.provider_id,
        connection_id: connectionId,
        status: RUN.running,
        started_at_utc: atUtc,
        completed_at_utc: null,
        error_code: null
      };

      function fail(code, reason, extra) {
        restoreModules(moduleSnap);
        locks[key] = false;
        var out = Object.assign({
          sync_id: syncId,
          status: RUN.failed,
          error_code: code,
          reason: reason,
          delivery_ids: [validated.delivery_id],
          mutated: false
        }, extra || {});
        return out;
      }

      try {
        var batch = ingest.normalizeDelivery(validated, { user_id: userId });
        var accepted = canonical.acceptBatch(batch, {
          delivery_id: validated.delivery_id,
          accepted_at_utc: atUtc
        });
        var dates = affectedDates(batch, timezone, input.local_dates || []);
        if (!dates.length && (batch.candidates || []).length === 0) {
          dates = (input.local_dates || []).slice();
        }
        var rebuilt = [];
        var windows = [];
        var recoveryIds = [];
        var i;
        for (i = 0; i < dates.length; i++) {
          var day = rebuildDay(userId, dates[i], timezone, atUtc, validated.delivery_id);
          if (day.outcome !== "ok") {
            return fail(ERROR.canonical_conflict, day.reason || day.outcome, { diagnostics: batch.diagnostics || [] });
          }
          windows.push(day.window.day_window_id);
          rebuilt.push(day.assembled.snapshot_id);
          var evaluated = evaluateDay(userId, dates[i], day.window);
          if (evaluated.wearable && evaluated.wearable.result_id) recoveryIds.push(evaluated.wearable.result_id);
          publishRuntime(userId, dates[i], evaluated);
        }
        var results = accepted.results || [];
        var newRevs = [];
        var replayed = [];
        var corrections = [];
        results.forEach(function (r) {
          if (r.outcome === "accepted_new") newRevs.push(r.revision_id);
          if (r.outcome === "replay_current" || r.outcome === "replay_historical") replayed.push(r.revision_id);
          if (r.outcome === "accepted_correction") corrections.push(r.revision_id);
        });
        var status = RUN.success;
        if ((batch.diagnostics || []).length && !results.length) status = RUN.partial;
        run.status = status;
        run.completed_at_utc = atUtc;
        var checkpointAdvanced = false;
        if (status === RUN.success && connectionId) {
          var cursor = validated.next_cursor || validated.provider_cursor || input.cursor || null;
          checkpoints.set(connectionId, {
            document_type: "wearable_sync_checkpoint",
            schema_version: SCHEMA,
            connection_id: connectionId,
            cursor: cursor,
            updated_at_utc: atUtc
          });
          checkpointAdvanced = true;
          var rec = connections.get(connectionId);
          if (rec) {
            rec.last_successful_sync_at_utc = atUtc;
            rec.last_attempt_at_utc = atUtc;
            rec.state = "connected";
            rec.error_code = null;
            saveConnectionRecord(rec);
          }
        } else if (connectionId) {
          var rec2 = connections.get(connectionId);
          if (rec2) {
            rec2.last_attempt_at_utc = atUtc;
            saveConnectionRecord(rec2);
          }
        }
        if (persist && store && typeof store.transaction === "function") {
          var persistErr = null;
          try {
            store.transaction(null, "readwrite", function (tx) {
              try {
                if (failPersist) throw new Error("forced persistence failure");
                persistCanonical(tx);
                tx.put("deliveries", {
                  delivery_id: validated.delivery_id,
                  provider_id: validated.provider_id,
                  connection_id: connectionId,
                  collected_at: validated.collected_at,
                  source_instance_ref: validated.source_instance_ref,
                  record_count: (validated.records || []).length
                });
                tx.put("sync_runs", run);
                if (connectionId && connections.get(connectionId)) tx.put("connections", connections.get(connectionId));
                if (checkpointAdvanced) tx.put("sync_checkpoints", checkpoints.get(connectionId));
              } catch (err) {
                persistErr = err;
                throw err;
              }
            });
          } catch (perr) {
            persistErr = persistErr || perr;
          }
          if (persistErr) {
            restoreModules(moduleSnap);
            locks[key] = false;
            return {
              sync_id: syncId,
              status: RUN.failed,
              error_code: ERROR.persistence_failed,
              reason: persistErr && persistErr.message ? persistErr.message : "persistence failed",
              mutated: false
            };
          }
        }
        locks[key] = false;
        return {
          sync_id: syncId,
          provider_id: validated.provider_id,
          connection_id: connectionId,
          delivery_ids: [validated.delivery_id],
          accepted_candidates: results.length,
          replayed_candidates: replayed.length,
          new_revisions: newRevs,
          corrections: corrections,
          affected_day_window_ids: windows,
          rebuilt_snapshot_ids: rebuilt,
          recovery_result_ids: recoveryIds,
          diagnostics: clone(batch.diagnostics || []),
          started_at_utc: atUtc,
          completed_at_utc: atUtc,
          status: status,
          checkpoint_advanced: checkpointAdvanced,
          mutates_workout: false
        };
      } catch (err) {
        locks[key] = false;
        restoreModules(moduleSnap);
        var code = ERROR.normalization_failed;
        if (err && err.code === "fixture_forbidden_in_production") code = ERROR.fixture_forbidden_in_production;
        if (err && err.code === "authentication_required") code = ERROR.authentication_required;
        if (err && err.code === "rate_limited") code = ERROR.provider_rate_limited;
        return fail(code, err && err.message ? err.message : "sync failed", { diagnostics: [] });
      }
    }

    function collectAndIngest(input) {
      input = input || {};
      var adapterId = input.adapter_id;
      if (!adapters || typeof adapters.get !== "function") {
        return { status: RUN.failed, error_code: ERROR.network_error, reason: "adapter registry missing." };
      }
      try {
        var adapter = adapters.get(adapterId);
        var delivery = adapter.collect(input.request);
        return ingestDelivery(Object.assign({}, input, { delivery: delivery }));
      } catch (err) {
        return {
          status: RUN.failed,
          error_code: err && err.code === "authentication_required" ? ERROR.authentication_required : (err && err.code === "fixture_forbidden_in_production" ? ERROR.fixture_forbidden_in_production : ERROR.network_error),
          reason: err && err.message ? err.message : "collect failed",
          mutated: false
        };
      }
    }

    function applyHydration(bundle) {
      var c = canonical.hydrateState({
        observation_revisions: bundle.observation_revisions,
        activity_revisions: bundle.activity_revisions,
        observation_pointers: bundle.observation_pointers,
        activity_pointers: bundle.activity_pointers
      });
      var d = days.hydrateState({
        day_windows: bundle.day_windows,
        pointers: bundle.day_window_pointers
      });
      var s = snapshots.hydrateState({
        snapshots: bundle.snapshots,
        pointers: bundle.snapshot_pointers
      });
      (bundle.connections || []).forEach(function (rec) { connections.set(rec.connection_id, clone(rec)); });
      (bundle.sync_checkpoints || []).forEach(function (rec) { checkpoints.set(rec.connection_id, clone(rec)); });
      var interrupted = [];
      (bundle.sync_runs || []).forEach(function (run) {
        if (run && run.status === RUN.running) {
          run.status = RUN.interrupted;
          run.error_code = ERROR.sync_interrupted;
          interrupted.push(run.sync_id);
          if (store && typeof store.put === "function") store.put("sync_runs", run);
        }
      });
      var degraded = !!(c.degraded || d.degraded || s.degraded || bundle.degraded);
      runtime.degraded = degraded;
      runtime.diagnostics = [].concat(c.skipped || [], d.skipped || [], s.skipped || [], bundle.skipped || []);
      runtime.ready = true;
      runtime.lastHydration = { interrupted: interrupted, degraded: degraded };
      (bundle.day_window_pointers || []).forEach(function (ptr) {
        var window = days.getCurrent(ptr.user_id, ptr.local_date);
        if (window) publishRuntime(ptr.user_id, ptr.local_date, evaluateDay(ptr.user_id, ptr.local_date, window));
      });
      return { outcome: degraded ? "degraded" : "ok", degraded: degraded, interrupted: interrupted, skipped: runtime.diagnostics };
    }

    function hydrateFromStore() {
      if (!store || typeof store.hydrate !== "function") {
        runtime.ready = true;
        return { outcome: "ok", degraded: false };
      }
      var opened = store.open();
      function cont() {
        var bundle = store.hydrate();
        if (bundle && typeof bundle.then === "function") return bundle.then(applyHydration);
        return applyHydration(bundle);
      }
      if (opened && typeof opened.then === "function") return opened.then(cont);
      return cont();
    }

    function integrateToday(input) {
      input = input || {};
      var localDate = input.local_date;
      var manual = input.manualRecovery || null;
      var wearable = runtime.wearableByDate[localDate] || input.wearableRecovery || null;
      if (!wearable && previewAllowed() && typeof NXT === "object" && NXT.recoveryPreview && NXT.recoveryPreview.wearableRecovery) {
        wearable = NXT.recoveryPreview.wearableRecovery;
      }
      if (integration && typeof integration.integrate === "function" && isNonEmptyString(localDate)) {
        var out = integration.integrate({
          local_date: localDate,
          manualRecovery: manual,
          wearableRecovery: wearable,
          wearableLocalDate: wearable ? localDate : (input.wearableLocalDate || null)
        });
        if (out && out.result) return out.result;
      }
      if (!wearable && previewAllowed() && typeof NXT === "object" && NXT.recoveryPreview && NXT.recoveryPreview.integrated) {
        return NXT.recoveryPreview.integrated;
      }
      return runtime.integratedByDate[localDate] || null;
    }

    function status() {
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.sync",
        boundary: BOUNDARY,
        persists: true,
        network: false,
        live_auth: false,
        states: STATES.slice(),
        runtime_ready: runtime.ready,
        degraded: runtime.degraded
      };
    }

    return {
      STATES: STATES,
      ERROR: ERROR,
      connect: connect,
      connectLive: connectLive,
      disconnect: disconnect,
      getConnection: function (id) { return connections.get(id) ? clone(connections.get(id)) : null; },
      listConnections: function () { return Array.from(connections.values()).map(clone); },
      getCheckpoint: function (id) { return checkpoints.get(id) ? clone(checkpoints.get(id)) : null; },
      ingestDelivery: ingestDelivery,
      collectAndIngest: collectAndIngest,
      hydrateFromStore: hydrateFromStore,
      integrateToday: integrateToday,
      evaluateDay: function (userId, localDate) {
        var window = days.getCurrent(userId, localDate);
        if (!window) return { wearable: null, integrated: null, training: null };
        return evaluateDay(userId, localDate, window);
      },
      runtime: runtime,
      previewAllowed: previewAllowed,
      status: status,
      createSync: createSync
    };
  }

  var page = createSync();
  if (typeof NXT === "object" && NXT && NXT.wearables) {
    NXT.wearables.sync = page;
    NXT.wearables.runtime = page.runtime;
  }
  root.NXTFRMWearableSync = page;

  if (typeof document !== "undefined" && typeof indexedDB !== "undefined") {
    Promise.resolve(page.hydrateFromStore()).then(function () {
      if (typeof NXT === "object" && NXT && typeof NXT.repaint === "function") NXT.repaint();
    }).catch(function () {});
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
