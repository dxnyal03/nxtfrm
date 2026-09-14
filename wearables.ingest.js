/* NXTFRM G3C: delivery normalization to unaccepted canonical candidates.
 * No revision persistence, pointers, snapshots, recovery, or UI.
 */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var BOUNDARY = "g3c.candidate_batch";
  var FIXTURE_NORMALIZER_ID = "nxtfrm.g3c.fixture.v1";
  var FIXTURE_PROVIDER_ID = "nxtfrm.synthetic";
  var ADAPTER_VERSION = "1";
  var LB_TO_KG = 0.45359237;

  var ERROR = Object.freeze({
    invalid_request: "invalid_request",
    invalid_delivery: "invalid_delivery",
    invalid_source_instance: "invalid_source_instance",
    unknown_normalizer: "unknown_normalizer",
    malformed_candidate: "malformed_candidate",
    fixture_forbidden_in_production: "fixture_forbidden_in_production",
    duplicate_normalizer: "duplicate_normalizer"
  });

  var DIAGNOSTIC = Object.freeze({
    unsupported_record_type: "unsupported_record_type",
    unsupported_metric_semantic: "unsupported_metric_semantic",
    invalid_unit: "invalid_unit",
    invalid_timestamp: "invalid_timestamp",
    invalid_interval: "invalid_interval",
    missing_required_field: "missing_required_field",
    malformed_payload: "malformed_payload",
    unsupported_field: "unsupported_field",
    incompatible_score_semantic: "incompatible_score_semantic"
  });

  var KIND_CANON = {
    api: "api_connection",
    api_connection: "api_connection",
    import: "import_batch",
    import_batch: "import_batch",
    fixture: "fixture_dataset",
    fixture_dataset: "fixture_dataset"
  };
  var KIND_SHORT = {
    api_connection: "api",
    import_batch: "import",
    fixture_dataset: "fixture"
  };
  var KIND_FIELD = {
    api_connection: "connection_id",
    import_batch: "import_batch_id",
    fixture_dataset: "fixture_dataset_id"
  };
  var METRIC_UNITS = Object.freeze({
    sleep_duration: "s",
    hrv: "ms",
    resting_hr: "bpm",
    steps: "count",
    moderate_intensity: "min",
    vigorous_intensity: "min",
    body_mass: "kg",
    body_fat_percent: "%",
    activity_duration: "s",
    activity_avg_hr: "bpm",
    activity_max_hr: "bpm"
  });
  var AVAILABILITY = Object.freeze(["present", "missing", "unknown", "unavailable", "unsupported"]);
  var QUALITY = Object.freeze(["high", "medium", "low", "unknown"]);
  var REASONS = Object.freeze([
    "not_collected", "provider_omitted", "unsupported_by_source", "unsupported_by_contract",
    "out_of_range", "malformed", "duplicate_delivery", "fixture_forbidden_in_production", "disconnected"
  ]);
  var ACTIVITY_KINDS = Object.freeze(["team_sport", "endurance", "strength", "mobility", "mixed", "unknown"]);
  var CANONICAL_DOC_TYPES = Object.freeze({
    user_day_window: true,
    wearable_daily_snapshot: true,
    wearable_activity_revision: true,
    observation_revision: true,
    current_snapshot_pointer: true,
    current_observation_pointer: true,
    current_activity_pointer: true,
    current_day_window_pointer: true,
    ingest_diagnostic: true
  });
  var FORBIDDEN_CANDIDATE = Object.freeze({
    accepted_delivery_id: true,
    revision_id: true,
    activity_revision_id: true,
    supersedes_revision_id: true,
    supersedes_activity_revision_id: true,
    day_window_id: true,
    snapshot_id: true,
    snapshot_version: true,
    freshness_aggregate: true,
    primary_candidate_id: true,
    overlapping_activities: true
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function ingestError(code, message, details) {
    var err = new Error(message);
    err.code = code;
    err.details = details == null ? null : details;
    return err;
  }

  function runtimeMode(explicit) {
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
        if (host === "localhost" || host === "127.0.0.1") return "development";
        if (location.protocol === "file:") return "development";
        return "production";
      }
    } catch (e) {}
    return "test";
  }

  function isProduction(mode) {
    return runtimeMode(mode) === "production";
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function ownKeys(obj) {
    return obj && typeof obj === "object" ? Object.keys(obj) : [];
  }

  function parseUtc(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return NaN;
    var ms = Date.parse(value);
    if (!Number.isFinite(ms)) return NaN;
    var d = new Date(ms);
    var expect = value.slice(0, 19);
    var actual = [
      String(d.getUTCFullYear()).padStart(4, "0"),
      String(d.getUTCMonth() + 1).padStart(2, "0"),
      String(d.getUTCDate()).padStart(2, "0")
    ].join("-") + "T" + [
      String(d.getUTCHours()).padStart(2, "0"),
      String(d.getUTCMinutes()).padStart(2, "0"),
      String(d.getUTCSeconds()).padStart(2, "0")
    ].join(":");
    return actual === expect ? ms : NaN;
  }

  function isoDateOk(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false;
    var ms = Date.parse(date + "T12:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date;
  }

  function isIana(tz) {
    if (!isNonEmptyString(tz)) return false;
    try {
      Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch (e) {
      return false;
    }
  }

  function localDateInZone(utc, tz) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(utc));
    var y = "";
    var m = "";
    var d = "";
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "year") y = parts[i].value;
      if (parts[i].type === "month") m = parts[i].value;
      if (parts[i].type === "day") d = parts[i].value;
    }
    return y + "-" + m + "-" + d;
  }

  function canon(value) {
    if (value === null) return "null";
    var t = typeof value;
    if (t === "boolean") return value ? "true" : "false";
    if (t === "number") {
      if (!Number.isFinite(value)) throw ingestError(ERROR.malformed_candidate, "Non-finite number in canonical JSON.");
      return JSON.stringify(value);
    }
    if (t === "string") return JSON.stringify(value);
    if (Array.isArray(value)) {
      var items = [];
      for (var i = 0; i < value.length; i++) items.push(canon(value[i]));
      return "[" + items.join(",") + "]";
    }
    if (t === "object") {
      var keys = Object.keys(value).sort();
      var parts = [];
      for (var j = 0; j < keys.length; j++) parts.push(JSON.stringify(keys[j]) + ":" + canon(value[keys[j]]));
      return "{" + parts.join(",") + "}";
    }
    throw ingestError(ERROR.malformed_candidate, "Unsupported canonical JSON value.");
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
    for (var i = 0; i < padded.length; i += 64) {
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

  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var u = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        out.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function observationHash(fields) {
    return sha256Hex(canon({
      availability: fields.availability,
      reason: fields.reason,
      value: fields.value,
      semantics: fields.semantics,
      measurement_quality: fields.measurement_quality,
      observed_at_utc: fields.observed_at_utc,
      recorded_at_utc: fields.recorded_at_utc
    }));
  }

  function activityHash(payload) {
    return sha256Hex(canon(payload));
  }

  function originOf(kind) {
    var canonKind = KIND_CANON[kind];
    return canonKind ? KIND_SHORT[canonKind] : null;
  }

  function normalizeSourceInstance(raw, opts) {
    opts = opts || {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw ingestError(ERROR.invalid_source_instance, "SourceInstanceRef must be an object.");
    }
    var kind = KIND_CANON[raw.kind];
    if (!kind) throw ingestError(ERROR.invalid_source_instance, "Unknown source kind.");
    var short = KIND_SHORT[kind];
    var idField = KIND_FIELD[kind];
    var provider = raw.provider_id != null ? raw.provider_id : raw.provider;
    if (!isNonEmptyString(provider)) {
      throw ingestError(ERROR.invalid_source_instance, "provider is required.");
    }
    if (raw.provider_id != null && raw.provider != null && raw.provider_id !== raw.provider) {
      throw ingestError(ERROR.invalid_source_instance, "provider and provider_id must match.");
    }
    var allowed = { kind: true, provider: true, provider_id: true, source_id: true, origin: true };
    allowed[idField] = true;
    var keys = ownKeys(raw);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (!allowed[keys[i]]) {
        throw ingestError(ERROR.invalid_source_instance, "Foreign field not allowed on this source kind: " + keys[i]);
      }
    }
    if (kind !== "api_connection" && raw.connection_id != null) {
      throw ingestError(ERROR.invalid_source_instance, "connection_id is forbidden on this source kind.");
    }
    if (kind !== "import_batch" && raw.import_batch_id != null) {
      throw ingestError(ERROR.invalid_source_instance, "import_batch_id is forbidden on this source kind.");
    }
    if (kind !== "fixture_dataset" && raw.fixture_dataset_id != null) {
      throw ingestError(ERROR.invalid_source_instance, "fixture_dataset_id is forbidden on this source kind.");
    }
    if (!isNonEmptyString(raw[idField])) {
      throw ingestError(ERROR.invalid_source_instance, idField + " is required.");
    }
    if (raw.origin != null && raw.origin !== short) {
      throw ingestError(ERROR.invalid_source_instance, "origin must equal the derived source kind.");
    }
    if (kind === "fixture_dataset" && isProduction(opts.mode)) {
      throw ingestError(ERROR.fixture_forbidden_in_production, "Fixture source is forbidden in production.");
    }
    var sourceId = isNonEmptyString(raw.source_id) ? raw.source_id : ("src:" + short + ":" + provider + ":" + raw[idField]);
    var out = { kind: kind, source_id: sourceId, provider: provider };
    out[idField] = raw[idField];
    return out;
  }

  function validateRecordEnvelope(record, index) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw ingestError(ERROR.invalid_delivery, "Record " + index + " is not an object.");
    }
    if (CANONICAL_DOC_TYPES[record.document_type]) {
      throw ingestError(ERROR.invalid_delivery, "Delivery must not contain canonical G1.2.1 documents.");
    }
    if (!isNonEmptyString(record.record_type)) {
      throw ingestError(ERROR.invalid_delivery, "record_type is required.");
    }
    if (!record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) {
      throw ingestError(ERROR.invalid_delivery, "payload must be an object.");
    }
    if (record.provider_record_id != null && !isNonEmptyString(record.provider_record_id)) {
      throw ingestError(ERROR.invalid_delivery, "provider_record_id must be a non-empty string when supplied.");
    }
    if (record.observed_at != null && !Number.isFinite(parseUtc(record.observed_at))) {
      throw ingestError(ERROR.invalid_delivery, "observed_at must be a valid UTC timestamp when supplied.");
    }
    if (record.updated_at != null && !Number.isFinite(parseUtc(record.updated_at))) {
      throw ingestError(ERROR.invalid_delivery, "updated_at must be a valid UTC timestamp when supplied.");
    }
    return {
      provider_record_id: record.provider_record_id == null ? null : record.provider_record_id,
      record_type: record.record_type,
      observed_at: record.observed_at == null ? null : record.observed_at,
      updated_at: record.updated_at == null ? null : record.updated_at,
      payload: clone(record.payload)
    };
  }

  function validateDelivery(delivery, opts) {
    opts = opts || {};
    if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
      throw ingestError(ERROR.invalid_delivery, "Delivery must be an object.");
    }
    if (CANONICAL_DOC_TYPES[delivery.document_type]) {
      throw ingestError(ERROR.invalid_delivery, "Delivery must not be a canonical G1.2.1 document.");
    }
    if (!isNonEmptyString(delivery.delivery_id)) {
      throw ingestError(ERROR.invalid_delivery, "delivery_id is required.");
    }
    if (!isNonEmptyString(delivery.adapter_id)) {
      throw ingestError(ERROR.invalid_delivery, "adapter_id is required.");
    }
    if (!isNonEmptyString(delivery.provider_id)) {
      throw ingestError(ERROR.invalid_delivery, "provider_id is required.");
    }
    if (!Number.isFinite(parseUtc(delivery.collected_at))) {
      throw ingestError(ERROR.invalid_delivery, "collected_at must be a valid UTC timestamp.");
    }
    if (!delivery.requested_range || !Number.isFinite(parseUtc(delivery.requested_range.start_utc)) || !Number.isFinite(parseUtc(delivery.requested_range.end_utc))) {
      throw ingestError(ERROR.invalid_delivery, "requested_range must be a valid UTC interval.");
    }
    if (!(parseUtc(delivery.requested_range.start_utc) < parseUtc(delivery.requested_range.end_utc))) {
      throw ingestError(ERROR.invalid_delivery, "requested_range.start_utc must be earlier than end_utc.");
    }
    if (!Array.isArray(delivery.records)) {
      throw ingestError(ERROR.invalid_delivery, "records must be an array.");
    }
    var source = normalizeSourceInstance(delivery.source_instance_ref, { mode: opts.mode });
    if (source.provider !== delivery.provider_id) {
      throw ingestError(ERROR.invalid_delivery, "delivery provider_id must match source.provider.");
    }
    var records = [];
    for (var i = 0; i < delivery.records.length; i++) records.push(validateRecordEnvelope(delivery.records[i], i));
    return {
      delivery_id: delivery.delivery_id,
      adapter_id: delivery.adapter_id,
      provider_id: delivery.provider_id,
      source_instance_ref: source,
      collected_at: delivery.collected_at,
      requested_range: {
        start_utc: delivery.requested_range.start_utc,
        end_utc: delivery.requested_range.end_utc
      },
      provider_cursor: delivery.provider_cursor == null ? null : delivery.provider_cursor,
      next_cursor: delivery.next_cursor == null ? null : delivery.next_cursor,
      records: records
    };
  }

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function convertMassKg(value, unit) {
    if (unit == null || unit === "kg") return value;
    if (unit === "lb" || unit === "lbs") return value * LB_TO_KG;
    return null;
  }

  function convertSeconds(value, unit) {
    if (unit == null || unit === "s" || unit === "sec" || unit === "seconds") return value;
    if (unit === "min" || unit === "mins" || unit === "minutes") return value * 60;
    return null;
  }

  function convertMs(value, unit) {
    if (unit == null || unit === "ms") return value;
    return null;
  }

  function convertBpm(value, unit) {
    if (unit == null || unit === "bpm") return value;
    return null;
  }

  function rawId(source, providerRecordId, recordType) {
    return "raw:" + source.source_id + ":" + (providerRecordId || recordType);
  }

  function lineageObservationId(userId, source, providerRecordId, metricKind) {
    return "obs:" + sha256Hex(canon({
      user_id: userId,
      source_id: source.source_id,
      provider_record_id: providerRecordId,
      metric_kind: metricKind
    })).slice(0, 32);
  }

  function lineageActivityId(userId, source, providerRecordId) {
    return "act:" + sha256Hex(canon({
      user_id: userId,
      source_id: source.source_id,
      provider_record_id: providerRecordId
    })).slice(0, 32);
  }

  function assertNoForbidden(obj, path) {
    if (!obj || typeof obj !== "object") return;
    var keys = ownKeys(obj);
    for (var i = 0; i < keys.length; i++) {
      if (FORBIDDEN_CANDIDATE[keys[i]]) {
        throw ingestError(ERROR.malformed_candidate, path + " must not include " + keys[i] + ".");
      }
    }
  }

  function validateAvailability(availability, reason, value, provenanceRequired) {
    if (AVAILABILITY.indexOf(availability) === -1) {
      throw ingestError(ERROR.malformed_candidate, "Unknown availability.");
    }
    if (availability === "present") {
      if (!finiteNumber(value)) throw ingestError(ERROR.malformed_candidate, "present value must be a finite number.");
      if (reason != null) throw ingestError(ERROR.malformed_candidate, "present reason must be null.");
    } else {
      if (value != null) throw ingestError(ERROR.malformed_candidate, availability + " value must be null.");
      if (REASONS.indexOf(reason) === -1) {
        throw ingestError(ERROR.malformed_candidate, availability + " requires a frozen reason.");
      }
    }
  }

  function validateSemantics(semantics) {
    if (!semantics || typeof semantics !== "object") {
      throw ingestError(ERROR.malformed_candidate, "semantics are required.");
    }
    var kind = semantics.metric_kind;
    if (kind === "proprietary_score") {
      if (!isNonEmptyString(semantics.score_id)) throw ingestError(ERROR.malformed_candidate, "score_id is required.");
      if (!semantics.score_range || !finiteNumber(semantics.score_range.min) || !finiteNumber(semantics.score_range.max)) {
        throw ingestError(ERROR.malformed_candidate, "score_range is required.");
      }
      if (["higher_better", "lower_better", "neutral"].indexOf(semantics.direction) === -1) {
        throw ingestError(ERROR.malformed_candidate, "score direction is required.");
      }
      if (semantics.unit != null) throw ingestError(ERROR.malformed_candidate, "proprietary scores must not use unit strings.");
      return;
    }
    var unit = METRIC_UNITS[kind];
    if (!unit) throw ingestError(ERROR.malformed_candidate, "Unknown metric_kind.");
    if (semantics.unit !== unit) throw ingestError(ERROR.malformed_candidate, "Canonical unit mismatch for " + kind + ".");
    if (kind === "hrv" && semantics.hrv_metric !== "rmssd_ms" && semantics.hrv_metric !== "sdnn_ms") {
      throw ingestError(ERROR.malformed_candidate, "hrv_metric must be rmssd_ms or sdnn_ms.");
    }
    if (kind === "sleep_duration") {
      if (!semantics.sleep || typeof semantics.sleep !== "object") {
        throw ingestError(ERROR.malformed_candidate, "sleep assignment metadata is required.");
      }
      if (semantics.sleep.rule_id !== "wake_date.g1.2" || semantics.sleep.rule_version !== "1") {
        throw ingestError(ERROR.malformed_candidate, "sleep assignment must use wake_date.g1.2 v1.");
      }
      if (!isoDateOk(semantics.sleep.normalized_wake_date)) {
        throw ingestError(ERROR.malformed_candidate, "normalized_wake_date must be a valid date.");
      }
      if (!isIana(semantics.sleep.assignment_timezone)) {
        throw ingestError(ERROR.malformed_candidate, "assignment_timezone must be a valid IANA timezone.");
      }
      if (semantics.sleep.provider_native_sleep_date != null && !isoDateOk(semantics.sleep.provider_native_sleep_date)) {
        throw ingestError(ERROR.malformed_candidate, "provider_native_sleep_date is invalid.");
      }
      if (semantics.sleep.provider_native_sleep_timezone != null && !isIana(semantics.sleep.provider_native_sleep_timezone)) {
        throw ingestError(ERROR.malformed_candidate, "provider_native_sleep_timezone is invalid.");
      }
    }
  }

  function validateCandidate(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw ingestError(ERROR.malformed_candidate, "Candidate must be an object.");
    }
    if (CANONICAL_DOC_TYPES[candidate.document_type]) {
      throw ingestError(ERROR.malformed_candidate, "Candidate must not be a persisted G1.2.1 document.");
    }
    assertNoForbidden(candidate, "candidate");
    if (candidate.acceptance !== "unaccepted") {
      throw ingestError(ERROR.malformed_candidate, "Candidate must be unaccepted.");
    }
    if (!isNonEmptyString(candidate.user_id)) {
      throw ingestError(ERROR.malformed_candidate, "user_id is required.");
    }
    if (!candidate.provenance || typeof candidate.provenance !== "object") {
      throw ingestError(ERROR.malformed_candidate, "provenance is required.");
    }
    assertNoForbidden(candidate.provenance, "provenance");
    assertNoForbidden(candidate.provenance.identities || {}, "identities");
    if (candidate.provenance.accepted_delivery_id != null) {
      throw ingestError(ERROR.malformed_candidate, "Unaccepted candidates must not claim accepted_delivery_id.");
    }
    if (candidate.provenance.ingested_at_utc != null) {
      throw ingestError(ERROR.malformed_candidate, "ingested_at_utc is reserved for acceptance.");
    }
    if (candidate.provenance.raw && candidate.provenance.raw.ingested_at_utc != null) {
      throw ingestError(ERROR.malformed_candidate, "raw.ingested_at_utc is reserved for acceptance.");
    }
    var source = normalizeSourceInstance(candidate.provenance.source, { mode: "test" });
    if (candidate.candidate_kind === "metric_observation") {
      validateAvailability(candidate.availability, candidate.reason, candidate.value, true);
      if (QUALITY.indexOf(candidate.measurement_quality) === -1) {
        throw ingestError(ERROR.malformed_candidate, "measurement_quality must be a frozen band.");
      }
      if (candidate.quality && candidate.quality.band) {
        throw ingestError(ERROR.malformed_candidate, "Unversioned quality.band is forbidden.");
      }
      validateSemantics(candidate.semantics);
      if (!isNonEmptyString(candidate.provenance.identities.canonical_observation_id)) {
        throw ingestError(ERROR.malformed_candidate, "canonical_observation_id is required.");
      }
      if (!/^[0-9a-f]{64}$/.test(candidate.provenance.identities.content_hash)) {
        throw ingestError(ERROR.malformed_candidate, "content_hash must be SHA-256 hex.");
      }
      var exp = observationHash({
        availability: candidate.availability,
        reason: candidate.reason,
        value: candidate.value,
        semantics: candidate.semantics,
        measurement_quality: candidate.measurement_quality,
        observed_at_utc: candidate.provenance.observed_at_utc,
        recorded_at_utc: candidate.provenance.recorded_at_utc
      });
      if (candidate.provenance.identities.content_hash !== exp) {
        throw ingestError(ERROR.malformed_candidate, "content_hash does not match G1.2.1 observation recipe.");
      }
      return clone(candidate);
    }
    if (candidate.candidate_kind === "activity") {
      if (!Number.isFinite(parseUtc(candidate.start_utc)) || !Number.isFinite(parseUtc(candidate.end_utc))) {
        throw ingestError(ERROR.malformed_candidate, "Activity UTC interval is required.");
      }
      if (!(parseUtc(candidate.start_utc) < parseUtc(candidate.end_utc))) {
        throw ingestError(ERROR.malformed_candidate, "Activity end_utc must be after start_utc.");
      }
      if (candidate.day_window_id || candidate.snapshot_id || candidate.local_date || candidate.belongs_to_local_date) {
        throw ingestError(ERROR.malformed_candidate, "Activity candidate must not assign a local day or snapshot.");
      }
      if (ACTIVITY_KINDS.indexOf(candidate.kind) === -1) {
        throw ingestError(ERROR.malformed_candidate, "Activity kind is not a frozen value.");
      }
      if (!Array.isArray(candidate.field_overrides)) {
        throw ingestError(ERROR.malformed_candidate, "field_overrides must be an array.");
      }
      var i;
      for (i = 0; i < candidate.field_overrides.length; i++) {
        var ov = candidate.field_overrides[i];
        if (!ov || !isNonEmptyString(ov.field_path) || !ov.provenance || !ov.provenance.source || !ov.provenance.raw) {
          throw ingestError(ERROR.malformed_candidate, "field override requires field_path and fragment provenance.");
        }
        if (ov.provenance.identities) {
          throw ingestError(ERROR.malformed_candidate, "field override must not include identities.");
        }
        assertNoForbidden(ov.provenance, "field_overrides.provenance");
      }
      ["duration_s", "avg_hr_bpm", "max_hr_bpm"].forEach(function (name) {
        var q = candidate[name];
        if (!q) throw ingestError(ERROR.malformed_candidate, name + " is required.");
        validateAvailability(q.availability, q.reason, q.value, false);
        validateSemantics(q.semantics);
      });
      if (!isNonEmptyString(candidate.provenance.identities.canonical_activity_id)) {
        throw ingestError(ERROR.malformed_candidate, "canonical_activity_id is required.");
      }
      if (candidate.provenance.identities.content_hash !== activityHash(activityHashPayload(candidate))) {
        throw ingestError(ERROR.malformed_candidate, "content_hash does not match G1.2.1 activity recipe.");
      }
      return clone(candidate);
    }
    throw ingestError(ERROR.malformed_candidate, "Unknown candidate_kind.");
  }

  function activityHashPayload(candidate) {
    return {
      start_utc: candidate.start_utc,
      end_utc: candidate.end_utc,
      kind: candidate.kind,
      sport_label: candidate.sport_label,
      kind_confidence: candidate.kind_confidence,
      duration_s: candidate.duration_s,
      avg_hr_bpm: candidate.avg_hr_bpm,
      max_hr_bpm: candidate.max_hr_bpm
    };
  }

  function scoresCompatible(a, b) {
    if (!a || !b || a.metric_kind !== "proprietary_score" || b.metric_kind !== "proprietary_score") return false;
    return a.score_id === b.score_id &&
      a.score_range.min === b.score_range.min &&
      a.score_range.max === b.score_range.max &&
      a.direction === b.direction;
  }

  function diagnostic(code, rec, delivery, fieldPath, details) {
    return {
      diagnostic_code: code,
      severity: "error",
      delivery_id: delivery.delivery_id,
      provider_record_id: rec && rec.provider_record_id ? rec.provider_record_id : null,
      source_instance_ref: clone(delivery.source_instance_ref),
      field_path: fieldPath || null,
      details: details || null
    };
  }

  function metricProvenance(userId, delivery, rec, metricKind, observed, recorded, extraIdent) {
    var prid = rec.provider_record_id;
    var identities = {
      canonical_observation_id: lineageObservationId(userId, delivery.source_instance_ref, prid, metricKind),
      provider_record_id: prid,
      content_hash: extraIdent.content_hash
    };
    return {
      source: clone(delivery.source_instance_ref),
      raw: {
        raw_id: rawId(delivery.source_instance_ref, prid, rec.record_type),
        payload_sha256: sha256Hex(canon(rec.payload)),
        adapter_id: delivery.adapter_id,
        adapter_version: ADAPTER_VERSION
      },
      observed_at_utc: observed,
      recorded_at_utc: recorded,
      identities: identities
    };
  }

  function presentMetric(userId, delivery, rec, spec) {
    var observed = spec.observed_at_utc;
    var recorded = spec.recorded_at_utc;
    var content = observationHash({
      availability: "present",
      reason: null,
      value: spec.value,
      semantics: spec.semantics,
      measurement_quality: spec.measurement_quality,
      observed_at_utc: observed,
      recorded_at_utc: recorded
    });
    return {
      candidate_kind: "metric_observation",
      acceptance: "unaccepted",
      user_id: userId,
      availability: "present",
      reason: null,
      value: spec.value,
      semantics: spec.semantics,
      measurement_quality: spec.measurement_quality,
      provenance: metricProvenance(userId, delivery, rec, spec.semantics.metric_kind, observed, recorded, { content_hash: content })
    };
  }

  function missingQuantity(availability, reason, semantics) {
    return {
      availability: availability,
      reason: reason,
      value: null,
      semantics: semantics,
      measurement_quality: "unknown"
    };
  }

  function fixtureSportKind(sport) {
    var s = String(sport || "").toLowerCase();
    if (s === "strength") return "strength";
    if (s === "endurance" || s === "cardio" || s === "run") return "endurance";
    if (s === "floorball" || s === "team" || s === "team_sport") return "team_sport";
    if (s === "mobility" || s === "yoga") return "mobility";
    if (s === "mixed") return "mixed";
    if (!s) return "unknown";
    return "unknown";
  }

  function fixtureNormalizeRecord(rec, ctx) {
    var delivery = ctx.delivery;
    var userId = ctx.user_id;
    var payload = rec.payload;
    var observed = rec.observed_at;
    var recorded = rec.updated_at == null ? rec.observed_at : rec.updated_at;
    var type = rec.record_type;

    if (type === "heart_rate" || type === "resting_heart_rate") {
      var resting = type === "resting_heart_rate" || payload.context === "resting_sample" || payload.vendor_field === "RestingHeartRate";
      if (!resting) {
        return { diagnostic: diagnostic(DIAGNOSTIC.unsupported_metric_semantic, rec, delivery, "record_type", "G1.2.1 has no generic heart_rate metric.") };
      }
      if (!Object.prototype.hasOwnProperty.call(payload, "bpm")) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.bpm", "Missing numeric value is not zero.") };
      }
      if (payload.bpm == null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.bpm", "Missing numeric value is not zero.") };
      }
      if (!finiteNumber(payload.bpm)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.bpm", "bpm must be a finite number.") };
      }
      var bpm = convertBpm(payload.bpm, payload.unit);
      if (bpm == null) return { diagnostic: diagnostic(DIAGNOSTIC.invalid_unit, rec, delivery, "payload.unit", "Unsupported heart-rate unit.") };
      if (!observed) return { diagnostic: diagnostic(DIAGNOSTIC.invalid_timestamp, rec, delivery, "observed_at", "observed_at is required.") };
      return { candidate: presentMetric(userId, delivery, rec, {
        value: bpm,
        measurement_quality: "unknown",
        observed_at_utc: observed,
        recorded_at_utc: recorded,
        semantics: {
          metric_kind: "resting_hr",
          unit: "bpm",
          aggregation: "instant",
          interval_start_utc: observed,
          interval_end_utc: observed
        }
      }) };
    }

    if (type === "body_mass") {
      if (!Object.prototype.hasOwnProperty.call(payload, "mass")) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.mass", "Missing numeric value is not zero.") };
      }
      if (payload.mass == null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.mass", "Missing numeric value is not zero.") };
      }
      if (!finiteNumber(payload.mass)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.mass", "mass must be a finite number.") };
      }
      var kg = convertMassKg(payload.mass, payload.unit);
      if (kg == null) return { diagnostic: diagnostic(DIAGNOSTIC.invalid_unit, rec, delivery, "payload.unit", "Unsupported mass unit.") };
      if (!observed) return { diagnostic: diagnostic(DIAGNOSTIC.invalid_timestamp, rec, delivery, "observed_at", "observed_at is required.") };
      return { candidate: presentMetric(userId, delivery, rec, {
        value: kg,
        measurement_quality: "unknown",
        observed_at_utc: observed,
        recorded_at_utc: recorded,
        semantics: {
          metric_kind: "body_mass",
          unit: "kg",
          aggregation: "instant",
          interval_start_utc: observed,
          interval_end_utc: observed
        }
      }) };
    }

    if (type === "sleep") {
      var start = payload.start || payload.start_utc;
      var end = payload.end || payload.end_utc;
      if (!Number.isFinite(parseUtc(start)) || !Number.isFinite(parseUtc(end))) {
        return { diagnostic: diagnostic(DIAGNOSTIC.invalid_timestamp, rec, delivery, "payload.start/end", "Sleep interval timestamps are required.") };
      }
      if (!(parseUtc(start) < parseUtc(end))) {
        return { diagnostic: diagnostic(DIAGNOSTIC.invalid_interval, rec, delivery, "payload.start/end", "Sleep end must be after start.") };
      }
      var duration;
      if (Object.prototype.hasOwnProperty.call(payload, "duration_min") && payload.duration_min == null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.duration_min", "Missing numeric value is not zero.") };
      }
      if (finiteNumber(payload.duration_s)) duration = convertSeconds(payload.duration_s, "s");
      else if (finiteNumber(payload.duration_min)) duration = convertSeconds(payload.duration_min, "min");
      else return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.duration_min", "Sleep duration is required.") };
      if (duration == null) return { diagnostic: diagnostic(DIAGNOSTIC.invalid_unit, rec, delivery, "payload.duration", "Unsupported duration unit.") };
      var tz = payload.provider_native_sleep_timezone || payload.timezone || payload.assignment_timezone;
      if (!isIana(tz)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.timezone", "Sleep assignment timezone is required; it is not invented.") };
      }
      var nativeDate = payload.vendor_sleep_date || payload.provider_native_sleep_date || null;
      if (nativeDate != null && !isoDateOk(nativeDate)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.vendor_sleep_date", "Native sleep date is invalid.") };
      }
      var wakeDate = localDateInZone(end, tz);
      return { candidate: presentMetric(userId, delivery, rec, {
        value: duration,
        measurement_quality: "unknown",
        observed_at_utc: observed || end,
        recorded_at_utc: recorded || end,
        semantics: {
          metric_kind: "sleep_duration",
          unit: "s",
          aggregation: payload.aggregation === "bout" ? "bout" : "nightly",
          interval_start_utc: start,
          interval_end_utc: end,
          sleep: {
            provider_native_sleep_date: nativeDate,
            provider_native_sleep_timezone: tz,
            normalized_wake_date: wakeDate,
            rule_id: "wake_date.g1.2",
            rule_version: "1",
            assignment_timezone: tz
          }
        }
      }) };
    }

    if (type === "activity") {
      var startA = payload.start_utc || payload.start || rec.observed_at;
      var endA = payload.end_utc || payload.end;
      if (!endA && finiteNumber(payload.elapsed_s) && Number.isFinite(parseUtc(startA))) {
        endA = new Date(parseUtc(startA) + payload.elapsed_s * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
      }
      if (!Number.isFinite(parseUtc(startA)) || !Number.isFinite(parseUtc(endA))) {
        return { diagnostic: diagnostic(DIAGNOSTIC.invalid_timestamp, rec, delivery, "start_utc/end_utc", "Activity UTC interval is required.") };
      }
      if (!(parseUtc(startA) < parseUtc(endA))) {
        return { diagnostic: diagnostic(DIAGNOSTIC.invalid_interval, rec, delivery, "start_utc/end_utc", "Activity end_utc must be after start_utc.") };
      }
      var dur = null;
      if (finiteNumber(payload.elapsed_s)) dur = convertSeconds(payload.elapsed_s, "s");
      else if (finiteNumber(payload.duration_min)) dur = convertSeconds(payload.duration_min, "min");
      else if (finiteNumber(payload.duration_s)) dur = convertSeconds(payload.duration_s, payload.duration_unit || "s");
      if (payload.elapsed_s == null && payload.duration_s == null && payload.duration_min == null) {
        /* duration can still be derived from the interval */
        dur = (parseUtc(endA) - parseUtc(startA)) / 1000;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "elapsed_s") && payload.elapsed_s == null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.elapsed_s", "Missing numeric value is not zero.") };
      }
      if (payload.elapsed_s != null && !finiteNumber(payload.elapsed_s)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.elapsed_s", "elapsed_s must be a finite number.") };
      }
      if (payload.duration_unit && convertSeconds(1, payload.duration_unit) == null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.invalid_unit, rec, delivery, "payload.duration_unit", "Unsupported duration unit.") };
      }
      var interval = { start_utc: startA, end_utc: endA };
      var durationQ = dur == null ? missingQuantity("missing", "provider_omitted", {
        metric_kind: "activity_duration", unit: "s", aggregation: "bout", duration_basis: "elapsed",
        interval_start_utc: startA, interval_end_utc: endA
      }) : {
        availability: "present", reason: null, value: dur,
        semantics: {
          metric_kind: "activity_duration", unit: "s", aggregation: "bout", duration_basis: "elapsed",
          interval_start_utc: startA, interval_end_utc: endA
        },
        measurement_quality: "unknown"
      };
      var avg = payload.avg_hr_bpm == null ? missingQuantity("missing", "provider_omitted", {
        metric_kind: "activity_avg_hr", unit: "bpm", aggregation: "bout",
        interval_start_utc: startA, interval_end_utc: endA
      }) : {
        availability: "present", reason: null, value: payload.avg_hr_bpm,
        semantics: { metric_kind: "activity_avg_hr", unit: "bpm", aggregation: "bout", interval_start_utc: startA, interval_end_utc: endA },
        measurement_quality: "unknown"
      };
      var max = payload.max_hr_bpm == null ? missingQuantity("missing", "provider_omitted", {
        metric_kind: "activity_max_hr", unit: "bpm", aggregation: "bout",
        interval_start_utc: startA, interval_end_utc: endA
      }) : {
        availability: "present", reason: null, value: payload.max_hr_bpm,
        semantics: { metric_kind: "activity_max_hr", unit: "bpm", aggregation: "bout", interval_start_utc: startA, interval_end_utc: endA },
        measurement_quality: "unknown"
      };
      if (payload.avg_hr_bpm != null && !finiteNumber(payload.avg_hr_bpm)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.avg_hr_bpm", "avg_hr_bpm must be a finite number.") };
      }
      var prid = rec.provider_record_id || payload.vendor_activity_id || null;
      var hashPayload = {
        start_utc: startA,
        end_utc: endA,
        kind: fixtureSportKind(payload.sport || payload.kind),
        sport_label: payload.sport_label != null ? payload.sport_label : (payload.sport || null),
        kind_confidence: "unknown",
        duration_s: durationQ,
        avg_hr_bpm: avg,
        max_hr_bpm: max
      };
      var overrides = [];
      if (Array.isArray(payload.field_overrides)) {
        for (var oi = 0; oi < payload.field_overrides.length; oi++) {
          var rawOv = payload.field_overrides[oi];
          if (!rawOv || !isNonEmptyString(rawOv.field_path) || !rawOv.raw_id) {
            return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.field_overrides", "Override requires field_path and raw_id.") };
          }
          overrides.push({
            field_path: rawOv.field_path,
            provenance: {
              source: clone(delivery.source_instance_ref),
              raw: {
                raw_id: rawOv.raw_id,
                payload_sha256: sha256Hex(canon(rawOv.payload || {})),
                adapter_id: delivery.adapter_id,
                adapter_version: ADAPTER_VERSION
              },
              observed_at_utc: rawOv.observed_at || observed,
              recorded_at_utc: rawOv.updated_at || recorded
            }
          });
        }
      }
      var candidate = {
        candidate_kind: "activity",
        acceptance: "unaccepted",
        user_id: userId,
        start_utc: interval.start_utc,
        end_utc: interval.end_utc,
        kind: hashPayload.kind,
        sport_label: hashPayload.sport_label,
        kind_confidence: hashPayload.kind_confidence,
        duration_s: durationQ,
        avg_hr_bpm: avg,
        max_hr_bpm: max,
        field_overrides: overrides,
        provenance: {
          source: clone(delivery.source_instance_ref),
          raw: {
            raw_id: rawId(delivery.source_instance_ref, prid, rec.record_type),
            payload_sha256: sha256Hex(canon(rec.payload)),
            adapter_id: delivery.adapter_id,
            adapter_version: ADAPTER_VERSION,
            provider_native_id: payload.vendor_activity_id || undefined
          },
          observed_at_utc: observed || startA,
          recorded_at_utc: recorded || endA,
          identities: {
            canonical_activity_id: lineageActivityId(userId, delivery.source_instance_ref, prid),
            provider_record_id: prid,
            content_hash: activityHash(hashPayload)
          }
        }
      };
      if (candidate.provenance.raw.provider_native_id == null) delete candidate.provenance.raw.provider_native_id;
      return { candidate: candidate };
    }

    if (type === "proprietary_score" || type === "score") {
      if (!isNonEmptyString(payload.score_id)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.incompatible_score_semantic, rec, delivery, "payload.score_id", "Namespaced score_id is required.") };
      }
      if (!payload.score_range || !finiteNumber(payload.score_range.min) || !finiteNumber(payload.score_range.max)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.incompatible_score_semantic, rec, delivery, "payload.score_range", "Frozen score range is required.") };
      }
      if (["higher_better", "lower_better", "neutral"].indexOf(payload.direction) === -1) {
        return { diagnostic: diagnostic(DIAGNOSTIC.incompatible_score_semantic, rec, delivery, "payload.direction", "Frozen score direction is required.") };
      }
      if (payload.unit != null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.unsupported_metric_semantic, rec, delivery, "payload.unit", "Proprietary scores must not use unit strings.") };
      }
      if (!Object.prototype.hasOwnProperty.call(payload, "value") || payload.value == null) {
        return { diagnostic: diagnostic(DIAGNOSTIC.missing_required_field, rec, delivery, "payload.value", "Missing numeric value is not zero.") };
      }
      if (!finiteNumber(payload.value)) {
        return { diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, "payload.value", "Score value must be a finite number.") };
      }
      if (!observed) return { diagnostic: diagnostic(DIAGNOSTIC.invalid_timestamp, rec, delivery, "observed_at", "observed_at is required.") };
      return { candidate: presentMetric(userId, delivery, rec, {
        value: payload.value,
        measurement_quality: "unknown",
        observed_at_utc: observed,
        recorded_at_utc: recorded,
        semantics: {
          metric_kind: "proprietary_score",
          score_id: payload.score_id,
          score_range: { min: payload.score_range.min, max: payload.score_range.max },
          direction: payload.direction,
          aggregation: payload.aggregation || "instant",
          interval_start_utc: payload.interval_start_utc || observed,
          interval_end_utc: payload.interval_end_utc || observed
        }
      }) };
    }

    if (payload && payload.fabricate != null) {
      return { diagnostic: diagnostic(DIAGNOSTIC.unsupported_field, rec, delivery, "payload.fabricate", "Unsupported field is not fabricated into a candidate.") };
    }
    return { diagnostic: diagnostic(DIAGNOSTIC.unsupported_record_type, rec, delivery, "record_type", "No fixture mapping for " + type + ".") };
  }

  function sourceFreshness(delivery) {
    var newestObs = null;
    var newestUpd = null;
    var i;
    for (i = 0; i < delivery.records.length; i++) {
      var rec = delivery.records[i];
      if (rec.observed_at && (!newestObs || rec.observed_at > newestObs)) newestObs = rec.observed_at;
      if (rec.updated_at && (!newestUpd || rec.updated_at > newestUpd)) newestUpd = rec.updated_at;
    }
    return [{
      source_id: delivery.source_instance_ref.source_id,
      last_successful_sync_at_utc: delivery.collected_at,
      source_updated_at_utc: newestUpd,
      newest_observation_at_utc: newestObs,
      expected_update_window: null
    }];
  }

  function createFixtureNormalizer() {
    return {
      normalizer_id: FIXTURE_NORMALIZER_ID,
      provider_id: FIXTURE_PROVIDER_ID,
      normalizeRecord: fixtureNormalizeRecord
    };
  }

  function createIngest(opts) {
    opts = opts || {};
    var mode = runtimeMode(opts.mode);
    var byId = new Map();
    var byProvider = new Map();

    function registerNormalizer(candidate) {
      if (!candidate || typeof candidate !== "object") {
        throw ingestError(ERROR.invalid_request, "Normalizer is required.");
      }
      if (!isNonEmptyString(candidate.normalizer_id)) {
        throw ingestError(ERROR.invalid_request, "normalizer_id is required.");
      }
      if (!isNonEmptyString(candidate.provider_id)) {
        throw ingestError(ERROR.invalid_request, "provider_id is required.");
      }
      if (typeof candidate.normalizeRecord !== "function") {
        throw ingestError(ERROR.invalid_request, "normalizeRecord is required.");
      }
      if (byId.has(candidate.normalizer_id) || byProvider.has(candidate.provider_id)) {
        throw ingestError(ERROR.duplicate_normalizer, "Normalizer already registered.");
      }
      if (candidate.provider_id === FIXTURE_PROVIDER_ID && isProduction(mode)) {
        throw ingestError(ERROR.fixture_forbidden_in_production, "Fixture normalizer is forbidden in production.");
      }
      var entry = {
        normalizer_id: candidate.normalizer_id,
        provider_id: candidate.provider_id,
        normalizeRecord: candidate.normalizeRecord
      };
      byId.set(entry.normalizer_id, entry);
      byProvider.set(entry.provider_id, entry);
      return { normalizer_id: entry.normalizer_id, provider_id: entry.provider_id };
    }

    function getNormalizer(id) {
      if (id == null) return null;
      return byId.get(id) || byProvider.get(id) || null;
    }

    function listNormalizers() {
      var out = [];
      byId.forEach(function (n) {
        out.push({ normalizer_id: n.normalizer_id, provider_id: n.provider_id });
      });
      return out;
    }

    function requireNormalizer(providerId) {
      var found = getNormalizer(providerId);
      if (!found) throw ingestError(ERROR.unknown_normalizer, "Unknown provider/normalizer: " + providerId);
      return found;
    }

    function normalizeRecord(record, context) {
      context = context || {};
      if (!context.delivery) throw ingestError(ERROR.invalid_request, "normalizeRecord requires a validated delivery context.");
      if (!isNonEmptyString(context.user_id)) throw ingestError(ERROR.invalid_request, "user_id is required.");
      var delivery = context.delivery;
      var normalizer = requireNormalizer(delivery.provider_id);
      var rec = validateRecordEnvelope(record, 0);
      var result = normalizer.normalizeRecord(rec, { delivery: delivery, user_id: context.user_id });
      if (result && result.candidate) {
        return { candidate: validateCandidate(result.candidate), diagnostic: null };
      }
      if (result && result.diagnostic) return { candidate: null, diagnostic: result.diagnostic };
      return {
        candidate: null,
        diagnostic: diagnostic(DIAGNOSTIC.malformed_payload, rec, delivery, null, "Normalizer returned no candidate or diagnostic.")
      };
    }

    function normalizeDelivery(delivery, context) {
      context = context || {};
      if (!isNonEmptyString(context.user_id)) {
        throw ingestError(ERROR.invalid_request, "user_id is required.");
      }
      var validated = validateDelivery(clone(delivery), { mode: mode });
      if (validated.source_instance_ref.kind === "fixture_dataset" && isProduction(mode)) {
        throw ingestError(ERROR.fixture_forbidden_in_production, "Fixture source is forbidden in production.");
      }
      var normalizer = requireNormalizer(validated.provider_id);
      var candidates = [];
      var diagnostics = [];
      var i;
      for (i = 0; i < validated.records.length; i++) {
        var rec = validated.records[i];
        var result;
        try {
          result = normalizer.normalizeRecord(rec, { delivery: validated, user_id: context.user_id });
        } catch (err) {
          diagnostics.push(diagnostic(DIAGNOSTIC.malformed_payload, rec, validated, null, err && err.message ? err.message : "normalizeRecord failed"));
          continue;
        }
        if (result && result.candidate) {
          try {
            candidates.push(validateCandidate(result.candidate));
          } catch (err2) {
            diagnostics.push(diagnostic(DIAGNOSTIC.malformed_payload, rec, validated, null, err2 && err2.message ? err2.message : "invalid candidate"));
          }
        } else if (result && result.diagnostic) {
          diagnostics.push(result.diagnostic);
        } else {
          diagnostics.push(diagnostic(DIAGNOSTIC.malformed_payload, rec, validated, null, "Normalizer returned no candidate or diagnostic."));
        }
      }
      return clone({
        schema_version: SCHEMA,
        boundary: BOUNDARY,
        normalizer_id: normalizer.normalizer_id,
        normalizer_version: ADAPTER_VERSION,
        source_instance_ref: validated.source_instance_ref,
        delivery_context: {
          delivery_id: validated.delivery_id,
          adapter_id: validated.adapter_id,
          provider_id: validated.provider_id,
          collected_at: validated.collected_at,
          requested_range: validated.requested_range
        },
        candidates: candidates,
        diagnostics: diagnostics,
        source_freshness: sourceFreshness(validated)
      });
    }

    function status() {
      var prod = isProduction(mode);
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.ingest",
        boundary: BOUNDARY,
        mode: mode,
        persists: false,
        network: false,
        interprets_recovery: false,
        fixture_allowed: !prod,
        production_guard: prod ? ERROR.fixture_forbidden_in_production : null
      };
    }

    return {
      validateDelivery: function (delivery) { return validateDelivery(clone(delivery), { mode: mode }); },
      validateSourceInstance: function (ref, extra) {
        return normalizeSourceInstance(ref, { mode: extra && extra.mode != null ? extra.mode : mode });
      },
      validateCandidate: function (candidate) { return validateCandidate(clone(candidate)); },
      normalizeDelivery: normalizeDelivery,
      normalizeRecord: normalizeRecord,
      registerNormalizer: registerNormalizer,
      getNormalizer: getNormalizer,
      requireNormalizer: requireNormalizer,
      listNormalizers: listNormalizers,
      scoresCompatible: scoresCompatible,
      originOf: originOf,
      status: status,
      createIngest: createIngest,
      createFixtureNormalizer: createFixtureNormalizer,
      observationHash: observationHash,
      ERROR: ERROR,
      DIAGNOSTIC: DIAGNOSTIC,
      mode: function () { return mode; }
    };
  }

  var page = createIngest();
  if (!isProduction()) {
    try { page.registerNormalizer(createFixtureNormalizer()); } catch (e) {}
  }
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.ingest = page;
  root.NXTFRMWearableIngest = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
