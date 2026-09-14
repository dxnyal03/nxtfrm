/* NXTFRM G3D: candidate acceptance and immutable revision store.
 * In-memory only. No snapshots, day windows, recovery, or UI.
 */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var BOUNDARY = "g3d.canonical_revisions";

  var OUTCOME = Object.freeze({
    accepted_new: "accepted_new",
    accepted_correction: "accepted_correction",
    replay_current: "replay_current",
    replay_historical: "replay_historical",
    unresolved_chain: "unresolved_chain",
    invalid_candidate: "invalid_candidate",
    integrity_conflict: "integrity_conflict",
    malformed_revision: "malformed_revision"
  });

  var CHAIN = Object.freeze({
    ok: "ok",
    cycle: "cycle",
    missing_parent: "missing_parent",
    fork: "fork",
    multiple_leaves: "multiple_leaves",
    pointer_missing: "pointer_missing",
    pointer_missing_revision: "pointer_missing_revision",
    pointer_wrong_lineage: "pointer_wrong_lineage",
    pointer_non_leaf: "pointer_non_leaf",
    empty: "empty"
  });

  var ERROR = Object.freeze({
    invalid_request: "invalid_request",
    invalid_candidate: "invalid_candidate",
    malformed_revision: "malformed_revision",
    unresolved_chain: "unresolved_chain",
    integrity_conflict: "integrity_conflict"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function canonErr(code, message, details) {
    var err = new Error(message);
    err.code = code;
    err.details = details == null ? null : details;
    return err;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function canon(value) {
    if (value === null) return "null";
    var t = typeof value;
    if (t === "boolean") return value ? "true" : "false";
    if (t === "number") {
      if (!Number.isFinite(value)) throw canonErr(ERROR.malformed_revision, "Non-finite number.");
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
    throw canonErr(ERROR.malformed_revision, "Unsupported canonical JSON value.");
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

  function ingestApi() {
    if (typeof NXT === "object" && NXT && NXT.wearables && NXT.wearables.ingest) return NXT.wearables.ingest;
    if (root.NXTFRMWearableIngest) return root.NXTFRMWearableIngest;
    return null;
  }

  function validateCandidate(candidate) {
    var api = ingestApi();
    if (!api || typeof api.validateCandidate !== "function") {
      throw canonErr(ERROR.invalid_candidate, "G3C validateCandidate is required to accept candidates.");
    }
    return api.validateCandidate(clone(candidate));
  }

  function parseUtc(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return NaN;
    var ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : NaN;
  }

  function ptrKey(userId, lineageId) {
    return userId + "|" + lineageId;
  }

  function resultBase(outcome, extra) {
    var out = { outcome: outcome };
    var k;
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  function assertNoCurrentFlag(doc, path) {
    if (doc && Object.prototype.hasOwnProperty.call(doc, "is_current")) {
      throw canonErr(ERROR.malformed_revision, path + " must not persist is_current.");
    }
  }

  function validateObservationRevision(doc) {
    if (!doc || doc.document_type !== "observation_revision" || doc.schema_version !== SCHEMA) {
      throw canonErr(ERROR.malformed_revision, "Observation revision envelope is invalid.");
    }
    assertNoCurrentFlag(doc, "observation_revision");
    if (!isNonEmptyString(doc.user_id)) throw canonErr(ERROR.malformed_revision, "user_id is required.");
    var ident = doc.provenance && doc.provenance.identities;
    if (!ident || !isNonEmptyString(ident.revision_id) || !isNonEmptyString(ident.canonical_observation_id)) {
      throw canonErr(ERROR.malformed_revision, "Observation identities are incomplete.");
    }
    if (!/^[0-9a-f]{64}$/.test(ident.content_hash)) throw canonErr(ERROR.malformed_revision, "content_hash must be SHA-256 hex.");
    var exp = observationHash({
      availability: doc.availability,
      reason: doc.reason,
      value: doc.value,
      semantics: doc.semantics,
      measurement_quality: doc.measurement_quality,
      observed_at_utc: doc.provenance.observed_at_utc,
      recorded_at_utc: doc.provenance.recorded_at_utc
    });
    if (ident.content_hash !== exp) throw canonErr(ERROR.malformed_revision, "Observation content_hash mismatch.");
    if (ident.revision_id.indexOf(ident.content_hash) !== -1) {
      /* revision id may include hash; not required */
    }
    if (!isNonEmptyString(doc.provenance.accepted_delivery_id)) {
      throw canonErr(ERROR.malformed_revision, "accepted_delivery_id is required on accepted revisions.");
    }
    if (!isNonEmptyString(doc.provenance.ingested_at_utc) || !Number.isFinite(parseUtc(doc.provenance.ingested_at_utc))) {
      throw canonErr(ERROR.malformed_revision, "ingested_at_utc is required on accepted revisions.");
    }
    if (!doc.provenance.source || !doc.provenance.raw) {
      throw canonErr(ERROR.malformed_revision, "source/raw provenance is required.");
    }
    return doc;
  }

  function validateActivityRevision(doc) {
    if (!doc || doc.document_type !== "wearable_activity_revision" || doc.schema_version !== SCHEMA) {
      throw canonErr(ERROR.malformed_revision, "Activity revision envelope is invalid.");
    }
    assertNoCurrentFlag(doc, "wearable_activity_revision");
    if (!isNonEmptyString(doc.user_id)) throw canonErr(ERROR.malformed_revision, "user_id is required.");
    var ident = doc.provenance && doc.provenance.identities;
    if (!ident || !isNonEmptyString(ident.activity_revision_id) || !isNonEmptyString(ident.canonical_activity_id)) {
      throw canonErr(ERROR.malformed_revision, "Activity identities are incomplete.");
    }
    if (!Number.isFinite(parseUtc(doc.start_utc)) || !Number.isFinite(parseUtc(doc.end_utc)) || !(parseUtc(doc.start_utc) < parseUtc(doc.end_utc))) {
      throw canonErr(ERROR.malformed_revision, "Activity UTC interval is invalid.");
    }
    if (doc.day_window_id || doc.snapshot_id) {
      throw canonErr(ERROR.malformed_revision, "Activity revision must not assign snapshot membership.");
    }
    var exp = sha256Hex(canon(activityHashPayload(doc)));
    if (ident.content_hash !== exp) throw canonErr(ERROR.malformed_revision, "Activity content_hash mismatch.");
    if (!isNonEmptyString(doc.provenance.accepted_delivery_id)) {
      throw canonErr(ERROR.malformed_revision, "accepted_delivery_id is required on accepted revisions.");
    }
    if (!Array.isArray(doc.field_overrides)) throw canonErr(ERROR.malformed_revision, "field_overrides must be an array.");
    var i;
    for (i = 0; i < doc.field_overrides.length; i++) {
      if (doc.field_overrides[i].provenance && doc.field_overrides[i].provenance.identities) {
        throw canonErr(ERROR.malformed_revision, "field override must not include identities.");
      }
    }
    return doc;
  }

  function buildObservationRevision(candidate, context, supersedes) {
    var identIn = candidate.provenance.identities;
    var contentHash = observationHash({
      availability: candidate.availability,
      reason: candidate.reason,
      value: candidate.value,
      semantics: candidate.semantics,
      measurement_quality: candidate.measurement_quality,
      observed_at_utc: candidate.provenance.observed_at_utc,
      recorded_at_utc: candidate.provenance.recorded_at_utc
    });
    if (identIn.content_hash !== contentHash) {
      throw canonErr(ERROR.invalid_candidate, "Candidate content_hash does not match G1.2.1 recipe.");
    }
    var revisionId = "rev:" + sha256Hex(canon({
      canonical_observation_id: identIn.canonical_observation_id,
      content_hash: contentHash
    })).slice(0, 32);
    var raw = clone(candidate.provenance.raw);
    raw.ingested_at_utc = context.accepted_at_utc;
    return {
      document_type: "observation_revision",
      schema_version: SCHEMA,
      user_id: candidate.user_id,
      availability: candidate.availability,
      reason: candidate.reason,
      value: candidate.value,
      semantics: clone(candidate.semantics),
      measurement_quality: candidate.measurement_quality,
      provenance: {
        source: clone(candidate.provenance.source),
        raw: raw,
        accepted_delivery_id: context.delivery_id,
        observed_at_utc: candidate.provenance.observed_at_utc,
        recorded_at_utc: candidate.provenance.recorded_at_utc,
        ingested_at_utc: context.accepted_at_utc,
        identities: {
          canonical_observation_id: identIn.canonical_observation_id,
          provider_record_id: identIn.provider_record_id == null ? null : identIn.provider_record_id,
          revision_id: revisionId,
          content_hash: contentHash,
          supersedes_revision_id: supersedes
        }
      }
    };
  }

  function buildActivityRevision(candidate, context, supersedes) {
    var identIn = candidate.provenance.identities;
    var contentHash = sha256Hex(canon(activityHashPayload(candidate)));
    if (identIn.content_hash !== contentHash) {
      throw canonErr(ERROR.invalid_candidate, "Candidate content_hash does not match G1.2.1 activity recipe.");
    }
    var revisionId = "arev:" + sha256Hex(canon({
      canonical_activity_id: identIn.canonical_activity_id,
      content_hash: contentHash
    })).slice(0, 32);
    var raw = clone(candidate.provenance.raw);
    raw.ingested_at_utc = context.accepted_at_utc;
    var overrides = clone(candidate.field_overrides || []);
    var i;
    for (i = 0; i < overrides.length; i++) {
      if (!overrides[i].provenance) continue;
      overrides[i].provenance.accepted_delivery_id = context.delivery_id;
      overrides[i].provenance.ingested_at_utc = context.accepted_at_utc;
      if (overrides[i].provenance.raw) overrides[i].provenance.raw.ingested_at_utc = context.accepted_at_utc;
    }
    return {
      document_type: "wearable_activity_revision",
      schema_version: SCHEMA,
      user_id: candidate.user_id,
      start_utc: candidate.start_utc,
      end_utc: candidate.end_utc,
      kind: candidate.kind,
      sport_label: candidate.sport_label,
      kind_confidence: candidate.kind_confidence,
      duration_s: clone(candidate.duration_s),
      avg_hr_bpm: clone(candidate.avg_hr_bpm),
      max_hr_bpm: clone(candidate.max_hr_bpm),
      field_overrides: overrides,
      provenance: {
        source: clone(candidate.provenance.source),
        raw: raw,
        accepted_delivery_id: context.delivery_id,
        observed_at_utc: candidate.provenance.observed_at_utc,
        recorded_at_utc: candidate.provenance.recorded_at_utc,
        ingested_at_utc: context.accepted_at_utc,
        identities: {
          canonical_activity_id: identIn.canonical_activity_id,
          provider_record_id: identIn.provider_record_id == null ? null : identIn.provider_record_id,
          activity_revision_id: revisionId,
          content_hash: contentHash,
          supersedes_activity_revision_id: supersedes
        }
      }
    };
  }

  function analyzeChain(revs, getId, getParent, getLineage, getUser, pointer, expectedLineage, expectedUser) {
    if (!revs.length) return { status: CHAIN.empty, leaves: [], reasons: [] };
    var byId = {};
    var i;
    var reasons = [];
    for (i = 0; i < revs.length; i++) {
      var id = getId(revs[i]);
      if (byId[id] && JSON.stringify(byId[id]) !== JSON.stringify(revs[i])) {
        return { status: CHAIN.fork, leaves: [], reasons: ["duplicate_revision_conflict"] };
      }
      byId[id] = revs[i];
    }
    var children = {};
    var superseded = {};
    for (i = 0; i < revs.length; i++) {
      var parent = getParent(revs[i]);
      var rid = getId(revs[i]);
      if (getUser(revs[i]) !== expectedUser || getLineage(revs[i]) !== expectedLineage) {
        reasons.push("cross_lineage");
      }
      if (parent) {
        if (!byId[parent]) {
          return { status: CHAIN.missing_parent, leaves: [], reasons: ["missing_parent"] };
        }
        if (getUser(byId[parent]) !== expectedUser || getLineage(byId[parent]) !== expectedLineage) {
          return { status: CHAIN.pointer_wrong_lineage, leaves: [], reasons: ["cross_user_or_lineage_parent"] };
        }
        children[parent] = children[parent] || [];
        children[parent].push(rid);
        superseded[parent] = true;
      }
    }
    for (var p in children) {
      if (children[p].length > 1) {
        return { status: CHAIN.fork, leaves: [], reasons: ["fork"] };
      }
    }
    var seen = {};
    var stack = {};
    function visit(node) {
      if (stack[node]) return "cycle";
      if (seen[node]) return null;
      stack[node] = true;
      var par = getParent(byId[node]);
      if (par) {
        var hit = visit(par);
        if (hit) return hit;
      }
      delete stack[node];
      seen[node] = true;
      return null;
    }
    for (i = 0; i < revs.length; i++) {
      if (visit(getId(revs[i])) === "cycle") {
        return { status: CHAIN.cycle, leaves: [], reasons: ["cycle"] };
      }
    }
    var leaves = [];
    for (i = 0; i < revs.length; i++) {
      if (!superseded[getId(revs[i])]) leaves.push(revs[i]);
    }
    if (leaves.length === 0) return { status: CHAIN.cycle, leaves: [], reasons: ["cycle"] };
    if (leaves.length > 1) return { status: CHAIN.multiple_leaves, leaves: leaves, reasons: ["multiple_leaves"] };
    if (!pointer) {
      return { status: CHAIN.pointer_missing, leaves: leaves, reasons: ["pointer_missing"] };
    }
    var pointerRevId = pointer.revision_id || pointer.activity_revision_id;
    if (!byId[pointerRevId]) {
      return { status: CHAIN.pointer_missing_revision, leaves: leaves, reasons: ["pointer_missing_revision"] };
    }
    if (getLineage(byId[pointerRevId]) !== expectedLineage || getUser(byId[pointerRevId]) !== expectedUser) {
      return { status: CHAIN.pointer_wrong_lineage, leaves: leaves, reasons: ["pointer_wrong_lineage"] };
    }
    if (getId(leaves[0]) !== pointerRevId) {
      return { status: CHAIN.pointer_non_leaf, leaves: leaves, reasons: ["pointer_non_leaf"] };
    }
    return { status: CHAIN.ok, leaves: leaves, reasons: [] };
  }

  function createCanonical(opts) {
    opts = opts || {};
    var obsRevs = new Map();
    var actRevs = new Map();
    var obsPtrs = new Map();
    var actPtrs = new Map();
    var diagnostics = [];
    var hooks = { failPointer: false, failBeforeCommit: false, corruptRevision: false };

    function snapshotState() {
      return {
        obsRevs: Array.from(obsRevs.entries()),
        actRevs: Array.from(actRevs.entries()),
        obsPtrs: Array.from(obsPtrs.entries()),
        actPtrs: Array.from(actPtrs.entries()),
        diagnostics: clone(diagnostics)
      };
    }

    function restoreState(s) {
      obsRevs = new Map(s.obsRevs);
      actRevs = new Map(s.actRevs);
      obsPtrs = new Map(s.obsPtrs);
      actPtrs = new Map(s.actPtrs);
      diagnostics = s.diagnostics;
    }

    function listObs(userId, lineageId) {
      var out = [];
      obsRevs.forEach(function (doc) {
        if (doc.user_id === userId && doc.provenance.identities.canonical_observation_id === lineageId) out.push(doc);
      });
      return out;
    }

    function listAct(userId, lineageId) {
      var out = [];
      actRevs.forEach(function (doc) {
        if (doc.user_id === userId && doc.provenance.identities.canonical_activity_id === lineageId) out.push(doc);
      });
      return out;
    }

    function validateObservationChain(userId, lineageId) {
      return analyzeChain(
        listObs(userId, lineageId),
        function (d) { return d.provenance.identities.revision_id; },
        function (d) { return d.provenance.identities.supersedes_revision_id; },
        function (d) { return d.provenance.identities.canonical_observation_id; },
        function (d) { return d.user_id; },
        obsPtrs.get(ptrKey(userId, lineageId)) || null,
        lineageId,
        userId
      );
    }

    function validateActivityChain(userId, lineageId) {
      return analyzeChain(
        listAct(userId, lineageId),
        function (d) { return d.provenance.identities.activity_revision_id; },
        function (d) { return d.provenance.identities.supersedes_activity_revision_id; },
        function (d) { return d.provenance.identities.canonical_activity_id; },
        function (d) { return d.user_id; },
        actPtrs.get(ptrKey(userId, lineageId)) || null,
        lineageId,
        userId
      );
    }

    function pushDiagnostic(doc) {
      diagnostics.push(doc);
    }

    function makeDiagnostic(context, candidate, outcome, createdIds, matchedId, reason) {
      var raw = clone(candidate.provenance.raw);
      raw.ingested_at_utc = context.accepted_at_utc;
      return {
        document_type: "ingest_diagnostic",
        schema_version: SCHEMA,
        delivery_id: context.delivery_id,
        user_id: candidate.user_id,
        source: clone(candidate.provenance.source),
        received_at_utc: context.accepted_at_utc,
        raw: raw,
        outcome: outcome,
        reason: reason || null,
        created_revision_ids: createdIds || [],
        matched_revision_id: matchedId || null
      };
    }

    function commitObservation(revision, pointer, diagnostic) {
      if (hooks.failBeforeCommit) {
        hooks.failBeforeCommit = false;
        throw canonErr(ERROR.malformed_revision, "Forced pre-commit failure.");
      }
      var prev = snapshotState();
      try {
        if (hooks.corruptRevision) {
          hooks.corruptRevision = false;
          revision = Object.assign({}, revision, { value: "bad" });
        }
        validateObservationRevision(revision);
        if (pointer.revision_id !== revision.provenance.identities.revision_id) {
          throw canonErr(ERROR.malformed_revision, "Pointer does not target the accepted revision.");
        }
        if (pointer.canonical_observation_id !== revision.provenance.identities.canonical_observation_id) {
          throw canonErr(ERROR.malformed_revision, "Pointer lineage mismatch.");
        }
        obsRevs.set(revision.provenance.identities.revision_id, clone(revision));
        if (hooks.failPointer) {
          hooks.failPointer = false;
          throw canonErr(ERROR.malformed_revision, "Forced pointer failure.");
        }
        obsPtrs.set(ptrKey(pointer.user_id, pointer.canonical_observation_id), clone(pointer));
        pushDiagnostic(diagnostic);
      } catch (err) {
        restoreState(prev);
        throw err;
      }
    }

    function commitActivity(revision, pointer, diagnostic) {
      if (hooks.failBeforeCommit) {
        hooks.failBeforeCommit = false;
        throw canonErr(ERROR.malformed_revision, "Forced pre-commit failure.");
      }
      var prev = snapshotState();
      try {
        if (hooks.corruptRevision) {
          hooks.corruptRevision = false;
          revision = Object.assign({}, revision, { start_utc: "bad" });
        }
        validateActivityRevision(revision);
        if (pointer.activity_revision_id !== revision.provenance.identities.activity_revision_id) {
          throw canonErr(ERROR.malformed_revision, "Pointer does not target the accepted revision.");
        }
        actRevs.set(revision.provenance.identities.activity_revision_id, clone(revision));
        if (hooks.failPointer) {
          hooks.failPointer = false;
          throw canonErr(ERROR.malformed_revision, "Forced pointer failure.");
        }
        actPtrs.set(ptrKey(pointer.user_id, pointer.canonical_activity_id), clone(pointer));
        pushDiagnostic(diagnostic);
      } catch (err) {
        restoreState(prev);
        throw err;
      }
    }

    function acceptObservation(candidate, context) {
      var ident = candidate.provenance.identities;
      var lineageId = ident.canonical_observation_id;
      var userId = candidate.user_id;
      var built = buildObservationRevision(candidate, context, null);
      var existing = obsRevs.get(built.provenance.identities.revision_id);
      if (existing) {
        var existClone = clone(existing);
        if (existClone.provenance.identities.content_hash !== built.provenance.identities.content_hash ||
            existClone.availability !== built.availability ||
            existClone.value !== built.value) {
          return resultBase(OUTCOME.integrity_conflict, {
            lineage_id: lineageId,
            revision_id: existing.provenance.identities.revision_id,
            reason: "duplicate_revision_conflict"
          });
        }
        var chainExisting = validateObservationChain(userId, lineageId);
        var ptr = obsPtrs.get(ptrKey(userId, lineageId));
        var outcome = (ptr && ptr.revision_id === existing.provenance.identities.revision_id)
          ? OUTCOME.replay_current
          : OUTCOME.replay_historical;
        pushDiagnostic(makeDiagnostic(context, candidate, "replay_idempotent", [], existing.provenance.identities.revision_id, "duplicate_delivery"));
        return resultBase(outcome, {
          lineage_id: lineageId,
          revision_id: existing.provenance.identities.revision_id,
          pointer_revision_id: ptr ? ptr.revision_id : null,
          chain: chainExisting.status,
          accepted_delivery_id: existing.provenance.accepted_delivery_id
        });
      }
      var known = listObs(userId, lineageId);
      if (!known.length) {
        var pointer = {
          document_type: "current_observation_pointer",
          schema_version: SCHEMA,
          user_id: userId,
          canonical_observation_id: lineageId,
          revision_id: built.provenance.identities.revision_id,
          advanced_at_utc: context.accepted_at_utc,
          accepted_delivery_id: context.delivery_id
        };
        commitObservation(built, pointer, makeDiagnostic(context, candidate, "accepted_new", [built.provenance.identities.revision_id], null, null));
        return resultBase(OUTCOME.accepted_new, {
          lineage_id: lineageId,
          revision_id: built.provenance.identities.revision_id,
          pointer_revision_id: pointer.revision_id,
          accepted_delivery_id: context.delivery_id
        });
      }
      var chain = validateObservationChain(userId, lineageId);
      if (chain.status !== CHAIN.ok) {
        return resultBase(OUTCOME.unresolved_chain, {
          lineage_id: lineageId,
          reason: chain.status,
          details: chain.reasons
        });
      }
      var leaf = chain.leaves[0];
      var sameHash = known.filter(function (d) { return d.provenance.identities.content_hash === built.provenance.identities.content_hash; });
      if (sameHash.length) {
        var hit = sameHash[0];
        var ptrNow = obsPtrs.get(ptrKey(userId, lineageId));
        var hist = hit.provenance.identities.revision_id !== leaf.provenance.identities.revision_id;
        pushDiagnostic(makeDiagnostic(context, candidate, "replay_idempotent", [], hit.provenance.identities.revision_id, "duplicate_delivery"));
        return resultBase(hist ? OUTCOME.replay_historical : OUTCOME.replay_current, {
          lineage_id: lineageId,
          revision_id: hit.provenance.identities.revision_id,
          pointer_revision_id: ptrNow ? ptrNow.revision_id : null,
          accepted_delivery_id: hit.provenance.accepted_delivery_id
        });
      }
      var corrected = buildObservationRevision(candidate, context, leaf.provenance.identities.revision_id);
      var newPtr = {
        document_type: "current_observation_pointer",
        schema_version: SCHEMA,
        user_id: userId,
        canonical_observation_id: lineageId,
        revision_id: corrected.provenance.identities.revision_id,
        advanced_at_utc: context.accepted_at_utc,
        accepted_delivery_id: context.delivery_id
      };
      commitObservation(corrected, newPtr, makeDiagnostic(context, candidate, "accepted_revision", [corrected.provenance.identities.revision_id], leaf.provenance.identities.revision_id, null));
      return resultBase(OUTCOME.accepted_correction, {
        lineage_id: lineageId,
        revision_id: corrected.provenance.identities.revision_id,
        supersedes_revision_id: leaf.provenance.identities.revision_id,
        pointer_revision_id: newPtr.revision_id,
        accepted_delivery_id: context.delivery_id
      });
    }

    function acceptActivity(candidate, context) {
      var ident = candidate.provenance.identities;
      var lineageId = ident.canonical_activity_id;
      var userId = candidate.user_id;
      var built = buildActivityRevision(candidate, context, null);
      var existing = actRevs.get(built.provenance.identities.activity_revision_id);
      if (existing) {
        if (existing.provenance.identities.content_hash !== built.provenance.identities.content_hash) {
          return resultBase(OUTCOME.integrity_conflict, {
            lineage_id: lineageId,
            revision_id: existing.provenance.identities.activity_revision_id,
            reason: "duplicate_revision_conflict"
          });
        }
        var ptr = actPtrs.get(ptrKey(userId, lineageId));
        var outcome = (ptr && ptr.activity_revision_id === existing.provenance.identities.activity_revision_id)
          ? OUTCOME.replay_current
          : OUTCOME.replay_historical;
        pushDiagnostic(makeDiagnostic(context, candidate, "replay_idempotent", [], existing.provenance.identities.activity_revision_id, "duplicate_delivery"));
        return resultBase(outcome, {
          lineage_id: lineageId,
          revision_id: existing.provenance.identities.activity_revision_id,
          pointer_revision_id: ptr ? ptr.activity_revision_id : null,
          accepted_delivery_id: existing.provenance.accepted_delivery_id
        });
      }
      var known = listAct(userId, lineageId);
      if (!known.length) {
        var pointer = {
          document_type: "current_activity_pointer",
          schema_version: SCHEMA,
          user_id: userId,
          canonical_activity_id: lineageId,
          activity_revision_id: built.provenance.identities.activity_revision_id,
          advanced_at_utc: context.accepted_at_utc,
          accepted_delivery_id: context.delivery_id
        };
        commitActivity(built, pointer, makeDiagnostic(context, candidate, "accepted_new", [built.provenance.identities.activity_revision_id], null, null));
        return resultBase(OUTCOME.accepted_new, {
          lineage_id: lineageId,
          revision_id: built.provenance.identities.activity_revision_id,
          pointer_revision_id: pointer.activity_revision_id,
          accepted_delivery_id: context.delivery_id
        });
      }
      var chain = validateActivityChain(userId, lineageId);
      if (chain.status !== CHAIN.ok) {
        return resultBase(OUTCOME.unresolved_chain, {
          lineage_id: lineageId,
          reason: chain.status,
          details: chain.reasons
        });
      }
      var leaf = chain.leaves[0];
      var sameHash = known.filter(function (d) { return d.provenance.identities.content_hash === built.provenance.identities.content_hash; });
      if (sameHash.length) {
        var hit = sameHash[0];
        var ptrNow = actPtrs.get(ptrKey(userId, lineageId));
        var hist = hit.provenance.identities.activity_revision_id !== leaf.provenance.identities.activity_revision_id;
        pushDiagnostic(makeDiagnostic(context, candidate, "replay_idempotent", [], hit.provenance.identities.activity_revision_id, "duplicate_delivery"));
        return resultBase(hist ? OUTCOME.replay_historical : OUTCOME.replay_current, {
          lineage_id: lineageId,
          revision_id: hit.provenance.identities.activity_revision_id,
          pointer_revision_id: ptrNow ? ptrNow.activity_revision_id : null,
          accepted_delivery_id: hit.provenance.accepted_delivery_id
        });
      }
      var corrected = buildActivityRevision(candidate, context, leaf.provenance.identities.activity_revision_id);
      var newPtr = {
        document_type: "current_activity_pointer",
        schema_version: SCHEMA,
        user_id: userId,
        canonical_activity_id: lineageId,
        activity_revision_id: corrected.provenance.identities.activity_revision_id,
        advanced_at_utc: context.accepted_at_utc,
        accepted_delivery_id: context.delivery_id
      };
      commitActivity(corrected, newPtr, makeDiagnostic(context, candidate, "accepted_revision", [corrected.provenance.identities.activity_revision_id], leaf.provenance.identities.activity_revision_id, null));
      return resultBase(OUTCOME.accepted_correction, {
        lineage_id: lineageId,
        revision_id: corrected.provenance.identities.activity_revision_id,
        supersedes_revision_id: leaf.provenance.identities.activity_revision_id,
        pointer_revision_id: newPtr.activity_revision_id,
        accepted_delivery_id: context.delivery_id
      });
    }

    function acceptCandidate(candidate, context) {
      context = context || {};
      var before = snapshotState();
      try {
        if (!isNonEmptyString(context.delivery_id)) throw canonErr(ERROR.invalid_request, "delivery_id is required.");
        if (!Number.isFinite(parseUtc(context.accepted_at_utc))) throw canonErr(ERROR.invalid_request, "accepted_at_utc is required.");
        var validated = validateCandidate(candidate);
        if (validated.candidate_kind === "metric_observation") return acceptObservation(validated, context);
        if (validated.candidate_kind === "activity") return acceptActivity(validated, context);
        throw canonErr(ERROR.invalid_candidate, "Unknown candidate_kind.");
      } catch (err) {
        restoreState(before);
        if (err && (err.code === ERROR.invalid_candidate || err.code === "malformed_candidate" || err.code === "invalid_source_instance")) {
          return resultBase(OUTCOME.invalid_candidate, { reason: err.code, details: err.message });
        }
        if (err && err.code === ERROR.malformed_revision) {
          return resultBase(OUTCOME.malformed_revision, { reason: err.code, details: err.message });
        }
        throw err;
      }
    }

    function acceptBatch(batch, context) {
      context = context || {};
      if (!batch || !Array.isArray(batch.candidates)) throw canonErr(ERROR.invalid_request, "candidate batch is required.");
      var deliveryId = context.delivery_id || (batch.delivery_context && batch.delivery_context.delivery_id);
      var acceptedAt = context.accepted_at_utc || (batch.delivery_context && batch.delivery_context.collected_at);
      var results = [];
      var i;
      for (i = 0; i < batch.candidates.length; i++) {
        results.push(acceptCandidate(batch.candidates[i], {
          delivery_id: deliveryId,
          accepted_at_utc: acceptedAt
        }));
      }
      return { results: results };
    }

    function status() {
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.canonical",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        interprets_recovery: false,
        observation_revisions: obsRevs.size,
        activity_revisions: actRevs.size,
        observation_pointers: obsPtrs.size,
        activity_pointers: actPtrs.size,
        snapshots: 0,
        day_windows: 0
      };
    }

    return {
      acceptCandidate: acceptCandidate,
      acceptBatch: acceptBatch,
      getObservationRevision: function (id) {
        var doc = obsRevs.get(id);
        return doc ? clone(doc) : null;
      },
      getActivityRevision: function (id) {
        var doc = actRevs.get(id);
        return doc ? clone(doc) : null;
      },
      getCurrentObservationPointer: function (userId, lineageId) {
        var doc = obsPtrs.get(ptrKey(userId, lineageId));
        return doc ? clone(doc) : null;
      },
      getCurrentActivityPointer: function (userId, lineageId) {
        var doc = actPtrs.get(ptrKey(userId, lineageId));
        return doc ? clone(doc) : null;
      },
      validateObservationChain: validateObservationChain,
      validateActivityChain: validateActivityChain,
      listObservationRevisions: function (userId, lineageId) {
        return clone(listObs(userId, lineageId));
      },
      listActivityRevisions: function (userId, lineageId) {
        return clone(listAct(userId, lineageId));
      },
      listDiagnostics: function () { return clone(diagnostics); },
      status: status,
      createCanonical: createCanonical,
      OUTCOME: OUTCOME,
      CHAIN: CHAIN,
      ERROR: ERROR,
      _test: {
        installObservationRevision: function (doc) { obsRevs.set(doc.provenance.identities.revision_id, clone(doc)); },
        installActivityRevision: function (doc) { actRevs.set(doc.provenance.identities.activity_revision_id, clone(doc)); },
        installObservationPointer: function (doc) { obsPtrs.set(ptrKey(doc.user_id, doc.canonical_observation_id), clone(doc)); },
        installActivityPointer: function (doc) { actPtrs.set(ptrKey(doc.user_id, doc.canonical_activity_id), clone(doc)); },
        failNextPointer: function () { hooks.failPointer = true; },
        failBeforeCommit: function () { hooks.failBeforeCommit = true; },
        corruptNextRevision: function () { hooks.corruptRevision = true; },
        clearHooks: function () { hooks.failPointer = false; hooks.failBeforeCommit = false; hooks.corruptRevision = false; }
      }
    };
  }

  var page = createCanonical();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.canonical = page;
  root.NXTFRMWearableCanonical = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
