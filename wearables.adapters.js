/* NXTFRM G3B: provider delivery boundary. No ingest, snapshots, recovery, or UI. */
"use strict";
(function (root) {
  var CAPABILITIES = Object.freeze(["metrics", "sleep", "activities", "body", "pagination", "incremental_sync"]);
  var ERROR = Object.freeze({
    invalid_request: "invalid_request",
    invalid_source_instance: "invalid_source_instance",
    unsupported_capability: "unsupported_capability",
    authentication_required: "authentication_required",
    permission_denied: "permission_denied",
    rate_limited: "rate_limited",
    provider_unavailable: "provider_unavailable",
    malformed_provider_response: "malformed_provider_response",
    aborted: "aborted",
    fixture_forbidden_in_production: "fixture_forbidden_in_production",
    duplicate_adapter: "duplicate_adapter",
    unknown_adapter: "unknown_adapter"
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
  var FORBIDDEN_REQUEST = {
    snapshot_id: true,
    day_window_id: true,
    local_date: true,
    recovery: true,
    readiness: true,
    recovery_score: true,
    readiness_score: true,
    primary_candidate_id: true,
    selected_sleep_candidate: true,
    current_snapshot_pointer: true
  };
  var REQUEST_KEYS = {
    user_id: true,
    range: true,
    cursor: true,
    requested_at: true,
    signal: true,
    capability: true,
    capabilities: true
  };
  var RANGE_KEYS = { start_utc: true, end_utc: true };
  var CANONICAL_DOC_TYPES = {
    user_day_window: true,
    wearable_daily_snapshot: true,
    wearable_activity_revision: true,
    observation_revision: true,
    current_snapshot_pointer: true,
    current_observation_pointer: true,
    current_activity_pointer: true,
    current_day_window_pointer: true,
    ingest_diagnostic: true
  };
  var FIXTURE_ADAPTER_ID = "nxtfrm.g3b.fixture.v1";
  var FIXTURE_PROVIDER_ID = "nxtfrm.synthetic";
  var FIXTURE_DATASET_ID = "nxtfrm.g3b.fixture.v1";
  var FIXTURE_SOURCE_ID = "src_g3b_fix_v1";

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function adapterError(code, message, details) {
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

  function originOf(kind) {
    var canon = KIND_CANON[kind];
    return canon ? KIND_SHORT[canon] : null;
  }

  function ownKeys(obj) {
    return obj && typeof obj === "object" ? Object.keys(obj) : [];
  }

  function normalizeSourceInstance(raw, opts) {
    opts = opts || {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw adapterError(ERROR.invalid_source_instance, "SourceInstanceRef must be an object.");
    }
    var kind = KIND_CANON[raw.kind];
    if (!kind) throw adapterError(ERROR.invalid_source_instance, "Unknown source kind.");
    var short = KIND_SHORT[kind];
    var idField = KIND_FIELD[kind];
    var provider = raw.provider_id != null ? raw.provider_id : raw.provider;
    if (!isNonEmptyString(provider)) {
      throw adapterError(ERROR.invalid_source_instance, "provider_id is required.");
    }
    if (raw.provider_id != null && raw.provider != null && raw.provider_id !== raw.provider) {
      throw adapterError(ERROR.invalid_source_instance, "provider and provider_id must match.");
    }
    var allowed = { kind: true, provider: true, provider_id: true, source_id: true, origin: true };
    allowed[idField] = true;
    var keys = ownKeys(raw);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (!allowed[keys[i]]) {
        throw adapterError(ERROR.invalid_source_instance, "Foreign field not allowed on this source kind: " + keys[i]);
      }
    }
    if (kind !== "api_connection" && raw.connection_id != null) {
      throw adapterError(ERROR.invalid_source_instance, "connection_id is forbidden on this source kind.");
    }
    if (kind !== "import_batch" && raw.import_batch_id != null) {
      throw adapterError(ERROR.invalid_source_instance, "import_batch_id is forbidden on this source kind.");
    }
    if (kind !== "fixture_dataset" && raw.fixture_dataset_id != null) {
      throw adapterError(ERROR.invalid_source_instance, "fixture_dataset_id is forbidden on this source kind.");
    }
    if (raw[idField] == null || raw[idField] === "") {
      throw adapterError(ERROR.invalid_source_instance, idField + " is required.");
    }
    if (!isNonEmptyString(raw[idField])) {
      throw adapterError(ERROR.invalid_source_instance, idField + " must be a non-empty string.");
    }
    if (raw.origin != null && raw.origin !== short) {
      throw adapterError(ERROR.invalid_source_instance, "origin must equal the derived source kind.");
    }
    if (kind === "fixture_dataset" && isProduction(opts.mode)) {
      throw adapterError(ERROR.fixture_forbidden_in_production, "Fixture source is forbidden in production.");
    }
    var sourceId = isNonEmptyString(raw.source_id) ? raw.source_id : ("src:" + short + ":" + provider + ":" + raw[idField]);
    var out = { kind: kind, source_id: sourceId, provider: provider };
    out[idField] = raw[idField];
    return out;
  }

  function validateCollectRequest(request) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw adapterError(ERROR.invalid_request, "collect request must be an object.");
    }
    var keys = ownKeys(request);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (FORBIDDEN_REQUEST[keys[i]]) {
        throw adapterError(ERROR.invalid_request, "Collection request must not include " + keys[i] + ".");
      }
      if (!REQUEST_KEYS[keys[i]]) {
        throw adapterError(ERROR.invalid_request, "Unknown collection request field: " + keys[i]);
      }
    }
    if (!isNonEmptyString(request.user_id)) {
      throw adapterError(ERROR.invalid_request, "user_id is required.");
    }
    if (!request.range || typeof request.range !== "object" || Array.isArray(request.range)) {
      throw adapterError(ERROR.invalid_request, "range is required.");
    }
    var rangeKeys = ownKeys(request.range);
    for (i = 0; i < rangeKeys.length; i++) {
      if (!RANGE_KEYS[rangeKeys[i]]) {
        throw adapterError(ERROR.invalid_request, "Unknown range field: " + rangeKeys[i]);
      }
    }
    var start = parseUtc(request.range.start_utc);
    var end = parseUtc(request.range.end_utc);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw adapterError(ERROR.invalid_request, "range.start_utc and range.end_utc must be valid UTC timestamps.");
    }
    if (!(start < end)) {
      throw adapterError(ERROR.invalid_request, "range.start_utc must be earlier than range.end_utc.");
    }
    if (parseUtc(request.requested_at) !== parseUtc(request.requested_at) || !Number.isFinite(parseUtc(request.requested_at))) {
      throw adapterError(ERROR.invalid_request, "requested_at must be a valid UTC timestamp.");
    }
    if (request.cursor != null && typeof request.cursor !== "string") {
      throw adapterError(ERROR.invalid_request, "cursor must be a string when provided.");
    }
    var caps = [];
    if (request.capability != null) caps.push(request.capability);
    if (request.capabilities != null) {
      if (!Array.isArray(request.capabilities)) {
        throw adapterError(ERROR.invalid_request, "capabilities must be an array.");
      }
      caps = caps.concat(request.capabilities);
    }
    for (i = 0; i < caps.length; i++) {
      if (CAPABILITIES.indexOf(caps[i]) === -1) {
        throw adapterError(ERROR.invalid_request, "Unknown capability: " + caps[i]);
      }
    }
    if (request.signal && request.signal.aborted) {
      throw adapterError(ERROR.aborted, "Collection was aborted.");
    }
    return {
      user_id: request.user_id,
      range: { start_utc: request.range.start_utc, end_utc: request.range.end_utc },
      cursor: request.cursor == null ? null : request.cursor,
      requested_at: request.requested_at,
      capabilities: caps
    };
  }

  function assertCapabilityList(list) {
    if (!Array.isArray(list) || !list.length) {
      throw adapterError(ERROR.invalid_request, "capabilities must be a non-empty finite list.");
    }
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      if (CAPABILITIES.indexOf(list[i]) === -1) {
        throw adapterError(ERROR.invalid_request, "Unknown capability: " + list[i]);
      }
      if (seen[list[i]]) throw adapterError(ERROR.invalid_request, "Duplicate capability.");
      seen[list[i]] = true;
    }
    return list.slice();
  }

  function validateRecord(record, index) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw adapterError(ERROR.malformed_provider_response, "Record " + index + " is not an object.");
    }
    if (CANONICAL_DOC_TYPES[record.document_type]) {
      throw adapterError(ERROR.malformed_provider_response, "Adapter must not emit canonical G1.2.1 documents.");
    }
    if (!isNonEmptyString(record.record_type)) {
      throw adapterError(ERROR.malformed_provider_response, "record_type is required.");
    }
    if (!record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) {
      throw adapterError(ERROR.malformed_provider_response, "payload must be an object.");
    }
    if (record.provider_record_id != null && !isNonEmptyString(record.provider_record_id)) {
      throw adapterError(ERROR.malformed_provider_response, "provider_record_id must be a non-empty string when supplied.");
    }
    if (record.observed_at != null && !Number.isFinite(parseUtc(record.observed_at))) {
      throw adapterError(ERROR.malformed_provider_response, "observed_at must be a valid UTC timestamp when supplied.");
    }
    if (record.updated_at != null && !Number.isFinite(parseUtc(record.updated_at))) {
      throw adapterError(ERROR.malformed_provider_response, "updated_at must be a valid UTC timestamp when supplied.");
    }
    return {
      provider_record_id: record.provider_record_id == null ? null : record.provider_record_id,
      record_type: record.record_type,
      observed_at: record.observed_at == null ? null : record.observed_at,
      updated_at: record.updated_at == null ? null : record.updated_at,
      payload: clone(record.payload)
    };
  }

  function validateDelivery(delivery, identity, request) {
    if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
      throw adapterError(ERROR.malformed_provider_response, "collect() must return a delivery object.");
    }
    if (CANONICAL_DOC_TYPES[delivery.document_type]) {
      throw adapterError(ERROR.malformed_provider_response, "Adapter must not emit canonical G1.2.1 documents.");
    }
    if (!isNonEmptyString(delivery.delivery_id)) {
      throw adapterError(ERROR.malformed_provider_response, "delivery_id is required.");
    }
    if (delivery.adapter_id !== identity.adapter_id) {
      throw adapterError(ERROR.malformed_provider_response, "delivery adapter_id must match the adapter.");
    }
    if (delivery.provider_id !== identity.provider_id) {
      throw adapterError(ERROR.malformed_provider_response, "delivery provider_id must match the adapter.");
    }
    if (!Number.isFinite(parseUtc(delivery.collected_at))) {
      throw adapterError(ERROR.malformed_provider_response, "collected_at must be a valid UTC timestamp.");
    }
    if (!delivery.requested_range || delivery.requested_range.start_utc !== request.range.start_utc || delivery.requested_range.end_utc !== request.range.end_utc) {
      throw adapterError(ERROR.malformed_provider_response, "requested_range must echo the validated request range.");
    }
    if (!Array.isArray(delivery.records)) {
      throw adapterError(ERROR.malformed_provider_response, "records must be an array.");
    }
    var source = normalizeSourceInstance(delivery.source_instance_ref, { mode: "test" });
    var expected = identity.source_instance_ref;
    if (source.kind !== expected.kind || source.provider !== expected.provider || source.source_id !== expected.source_id) {
      throw adapterError(ERROR.malformed_provider_response, "source_instance_ref must identify the adapter source instance.");
    }
    var idField = KIND_FIELD[expected.kind];
    if (source[idField] !== expected[idField]) {
      throw adapterError(ERROR.malformed_provider_response, "source_instance_ref must identify the adapter source instance.");
    }
    var records = [];
    for (var i = 0; i < delivery.records.length; i++) records.push(validateRecord(delivery.records[i], i));
    return {
      delivery_id: delivery.delivery_id,
      adapter_id: delivery.adapter_id,
      provider_id: delivery.provider_id,
      source_instance_ref: clone(expected),
      collected_at: delivery.collected_at,
      requested_range: { start_utc: request.range.start_utc, end_utc: request.range.end_utc },
      provider_cursor: delivery.provider_cursor == null ? null : delivery.provider_cursor,
      next_cursor: delivery.next_cursor == null ? null : delivery.next_cursor,
      records: records
    };
  }

  function describeAdapter(raw) {
    return {
      adapter_id: raw.adapter_id,
      provider_id: raw.provider_id,
      source_kind: KIND_SHORT[raw.source_instance_ref.kind],
      capabilities: raw.capabilities.slice(),
      source_instance_ref: clone(raw.source_instance_ref)
    };
  }

  var FIXTURE_RECORDS = Object.freeze([
    Object.freeze({
      provider_record_id: "g3b.fix.hr.1",
      record_type: "heart_rate",
      observed_at: "2026-09-14T02:00:00Z",
      updated_at: "2026-09-14T02:00:00Z",
      payload: Object.freeze({ bpm: 58, context: "resting_sample", vendor_field: "RestingHeartRate" })
    }),
    Object.freeze({
      provider_record_id: "g3b.fix.sleep.1",
      record_type: "sleep",
      observed_at: "2026-09-13T23:50:00Z",
      updated_at: "2026-09-14T02:00:00Z",
      payload: Object.freeze({ start: "2026-09-13T16:20:00Z", end: "2026-09-13T23:50:00Z", duration_min: 450, vendor_sleep_date: "2026-09-14" })
    }),
    Object.freeze({
      provider_record_id: "g3b.fix.act.1",
      record_type: "activity",
      observed_at: "2026-09-14T01:00:00Z",
      updated_at: "2026-09-14T01:40:00Z",
      payload: Object.freeze({ sport: "strength", elapsed_s: 2400, vendor_activity_id: "act-local-1" })
    }),
    Object.freeze({
      provider_record_id: "g3b.fix.mass.1",
      record_type: "body_mass",
      observed_at: "2026-09-14T00:30:00Z",
      updated_at: "2026-09-14T00:30:00Z",
      payload: Object.freeze({ mass: 74.2, unit: "kg", vendor_field: "Weight" })
    })
  ]);

  function createFixtureAdapter(opts) {
    opts = opts || {};
    var mode = runtimeMode(opts.mode);
    if (isProduction(mode)) {
      throw adapterError(ERROR.fixture_forbidden_in_production, "Fixture adapter is forbidden in production.");
    }
    var source = normalizeSourceInstance({
      kind: "fixture",
      provider_id: FIXTURE_PROVIDER_ID,
      fixture_dataset_id: FIXTURE_DATASET_ID,
      source_id: FIXTURE_SOURCE_ID
    }, { mode: mode });
    var seq = 0;
    var records = clone(FIXTURE_RECORDS);
    return {
      adapter_id: FIXTURE_ADAPTER_ID,
      provider_id: FIXTURE_PROVIDER_ID,
      source_kind: "fixture",
      capabilities: ["metrics", "sleep", "activities", "body"],
      source_instance_ref: source,
      collect: function (request) {
        var start = parseUtc(request.range.start_utc);
        var end = parseUtc(request.range.end_utc);
        seq += 1;
        var selected = [];
        for (var i = 0; i < records.length; i++) {
          var rec = records[i];
          var at = parseUtc(rec.observed_at);
          if (Number.isFinite(at) && at >= start && at < end) selected.push(clone(rec));
        }
        return {
          delivery_id: "del_g3b_fix_" + seq,
          adapter_id: FIXTURE_ADAPTER_ID,
          provider_id: FIXTURE_PROVIDER_ID,
          source_instance_ref: clone(source),
          collected_at: request.requested_at,
          requested_range: { start_utc: request.range.start_utc, end_utc: request.range.end_utc },
          provider_cursor: request.cursor,
          next_cursor: null,
          records: selected
        };
      }
    };
  }

  function wrapAdapter(raw, mode) {
    var identity = describeAdapter(raw);
    function failIfAborted(request) {
      if (request && request.signal && request.signal.aborted) {
        throw adapterError(ERROR.aborted, "Collection was aborted.");
      }
    }
    return {
      describe: function () { return clone(identity); },
      getSourceInstanceRef: function () { return clone(identity.source_instance_ref); },
      collect: function (request) {
        failIfAborted(request);
        if (identity.source_kind === "fixture" && isProduction(mode)) {
          throw adapterError(ERROR.fixture_forbidden_in_production, "Fixture adapter is forbidden in production.");
        }
        var validated = validateCollectRequest(request);
        var i;
        for (i = 0; i < validated.capabilities.length; i++) {
          if (identity.capabilities.indexOf(validated.capabilities[i]) === -1) {
            throw adapterError(ERROR.unsupported_capability, "Adapter does not advertise capability: " + validated.capabilities[i]);
          }
        }
        if (validated.cursor && identity.capabilities.indexOf("pagination") === -1 && identity.capabilities.indexOf("incremental_sync") === -1) {
          throw adapterError(ERROR.unsupported_capability, "Adapter does not advertise pagination or incremental_sync.");
        }
        var emitted;
        try {
          emitted = raw.collect(clone(validated));
        } catch (err) {
          if (err && err.code && ERROR[err.code]) throw err;
          throw adapterError(ERROR.provider_unavailable, "Adapter collect failed.", err && err.message ? err.message : null);
        }
        return clone(validateDelivery(emitted, identity, validated));
      }
    };
  }

  function createRegistry(opts) {
    opts = opts || {};
    var mode = runtimeMode(opts.mode);
    var adapters = new Map();

    function register(candidate) {
      if (!candidate || typeof candidate !== "object") {
        throw adapterError(ERROR.invalid_request, "Adapter is required.");
      }
      if (!isNonEmptyString(candidate.adapter_id)) {
        throw adapterError(ERROR.invalid_request, "adapter_id is required.");
      }
      if (!isNonEmptyString(candidate.provider_id)) {
        throw adapterError(ERROR.invalid_request, "provider_id is required.");
      }
      if (adapters.has(candidate.adapter_id)) {
        throw adapterError(ERROR.duplicate_adapter, "Adapter already registered: " + candidate.adapter_id);
      }
      var source = normalizeSourceInstance(candidate.source_instance_ref || candidate.getSourceInstanceRef && candidate.getSourceInstanceRef(), { mode: mode });
      var caps = assertCapabilityList(candidate.capabilities);
      if (source.kind === "fixture_dataset" && isProduction(mode)) {
        throw adapterError(ERROR.fixture_forbidden_in_production, "Fixture adapter is forbidden in production.");
      }
      if (typeof candidate.collect !== "function") {
        throw adapterError(ERROR.invalid_request, "Adapter collect() is required.");
      }
      var raw = {
        adapter_id: candidate.adapter_id,
        provider_id: candidate.provider_id,
        capabilities: caps,
        source_instance_ref: source,
        collect: candidate.collect
      };
      var wrapped = wrapAdapter(raw, mode);
      adapters.set(candidate.adapter_id, wrapped);
      return wrapped.describe();
    }

    function get(adapterId) {
      if (!adapters.has(adapterId)) return null;
      return adapters.get(adapterId);
    }

    function requireAdapter(adapterId) {
      var found = get(adapterId);
      if (!found) throw adapterError(ERROR.unknown_adapter, "Unknown adapter: " + adapterId);
      return found;
    }

    function list() {
      var out = [];
      adapters.forEach(function (adapter) { out.push(adapter.describe()); });
      return out;
    }

    var api = {
      register: register,
      get: get,
      require: requireAdapter,
      list: list,
      validateSourceInstance: function (ref, extra) {
        return normalizeSourceInstance(ref, { mode: extra && extra.mode != null ? extra.mode : mode });
      },
      validateCollectRequest: validateCollectRequest,
      originOf: originOf,
      createRegistry: createRegistry,
      createFixtureAdapter: createFixtureAdapter,
      CAPABILITIES: CAPABILITIES,
      ERROR: ERROR,
      mode: function () { return mode; }
    };
    return api;
  }

  var pageRegistry = createRegistry();
  if (!isProduction()) {
    try { pageRegistry.register(createFixtureAdapter({ mode: runtimeMode() })); } catch (e) {}
  }
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.adapters = pageRegistry;
  root.NXTFRMWearableAdapters = pageRegistry;
})(typeof globalThis !== "undefined" ? globalThis : this);
