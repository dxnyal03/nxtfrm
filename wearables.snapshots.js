/* NXTFRM G4B: immutable DailySnapshot assembly + current snapshot pointer.
 * In-memory only. No provider/sleep winners, recovery, or UI.
 */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var BOUNDARY = "g4b.daily_snapshots";
  var NORM = "g1.2.1+g4b.snapshots.1";
  var UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  var FIELD_NAMES = [
    "sleep_duration_s", "sleep_score", "hrv", "resting_hr_bpm", "stress", "energy_reserve",
    "steps", "moderate_intensity_min", "vigorous_intensity_min", "body_mass_kg", "body_fat_percent"
  ];
  var FIELD_KIND = {
    sleep_duration_s: "sleep_duration",
    sleep_score: "proprietary_score",
    hrv: "hrv",
    resting_hr_bpm: "resting_hr",
    stress: "proprietary_score",
    energy_reserve: "proprietary_score",
    steps: "steps",
    moderate_intensity_min: "moderate_intensity",
    vigorous_intensity_min: "vigorous_intensity",
    body_mass_kg: "body_mass",
    body_fat_percent: "body_fat_percent"
  };
  var CONFLICT_RULES = {
    none_incompatible_semantics: true,
    none_cross_source_conflict: true,
    none_unresolved_lineages: true,
    none_revision_fork: true,
    none_revision_cycle: true,
    none_missing_parent: true,
    none_multiple_leaves: true
  };
  var CORE_FIELDS = { sleep_duration_s: true, hrv: true, resting_hr_bpm: true, steps: true };
  var ABSENT = { missing: true, unknown: true, unavailable: true };

  var OUTCOME = Object.freeze({
    assembled: "assembled",
    reused: "reused",
    assembled_version: "assembled_version",
    pointer_set: "pointer_set",
    pointer_unchanged: "pointer_unchanged",
    missing_pointer: "missing_pointer",
    missing_day_window: "missing_day_window",
    invalid_day_window: "invalid_day_window",
    invalid_snapshot: "invalid_snapshot",
    invalid_pointer: "invalid_pointer",
    unresolved_evidence: "unresolved_evidence"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function snapErr(code, message, details) {
    var err = new Error(message);
    err.code = code;
    err.details = details == null ? null : details;
    return err;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function parseUtc(value) {
    if (typeof value !== "string" || !UTC_RE.test(value)) return NaN;
    var ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : NaN;
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

  function utf8Bytes(str) {
    var out = [];
    var i;
    for (i = 0; i < str.length; i++) {
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

  function resultBase(outcome, extra) {
    var out = { outcome: outcome };
    var k;
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  function intervalsOverlap(a0, a1, b0, b1) {
    var s0 = typeof a0 === "number" ? a0 : parseUtc(a0);
    var s1 = typeof a1 === "number" ? a1 : parseUtc(a1);
    var t0 = typeof b0 === "number" ? b0 : parseUtc(b0);
    var t1 = typeof b1 === "number" ? b1 : parseUtc(b1);
    if (![s0, s1, t0, t1].every(Number.isFinite)) return false;
    return s0 < t1 && s1 > t0;
  }

  function inWindow(ts, window) {
    var t = parseUtc(ts);
    var a = parseUtc(window.start_utc);
    var b = parseUtc(window.end_utc);
    return Number.isFinite(t) && Number.isFinite(a) && Number.isFinite(b) && a <= t && t < b;
  }

  function membershipTime(rev) {
    var sem = rev.semantics || {};
    if (typeof sem.interval_end_utc === "string" && UTC_RE.test(sem.interval_end_utc)) return sem.interval_end_utc;
    return rev.provenance && rev.provenance.observed_at_utc;
  }

  function emptyField() {
    return {
      candidates: [],
      primary_candidate_id: null,
      selection: { rule: "none_empty", policy_id: null, policy_version: null }
    };
  }

  function fieldForKind(kind) {
    if (kind === "sleep_duration") return "sleep_duration_s";
    if (kind === "hrv") return "hrv";
    if (kind === "resting_hr") return "resting_hr_bpm";
    if (kind === "steps") return "steps";
    if (kind === "moderate_intensity") return "moderate_intensity_min";
    if (kind === "vigorous_intensity") return "vigorous_intensity_min";
    if (kind === "body_mass") return "body_mass_kg";
    if (kind === "body_fat_percent") return "body_fat_percent";
    return null;
  }

  function semanticIdentity(sem) {
    var k = sem.metric_kind;
    if (k === "hrv") return [k, sem.unit, sem.hrv_metric, sem.aggregation].join("|");
    if (k === "proprietary_score") {
      return [k, sem.score_id, sem.score_range && sem.score_range.min, sem.score_range && sem.score_range.max, sem.direction].join("|");
    }
    if (k === "activity_duration") return [k, sem.unit, sem.aggregation, sem.duration_basis].join("|");
    if (k === "sleep_duration") return [k, sem.unit, sem.aggregation].join("|");
    return [k, sem.unit, sem.aggregation].join("|");
  }

  function expectedSelection(field) {
    var cands = field.candidates;
    var present = cands.filter(function (c) {
      return c.availability === "present" && c.value != null && c.provenance;
    });
    if (!cands.length) return { rule: "none_empty", primary: null };
    if (!present.length) return { rule: "none_all_non_present", primary: null };
    var classes = {};
    present.forEach(function (c) { classes[semanticIdentity(c.semantics)] = true; });
    if (Object.keys(classes).length > 1) return { rule: "none_incompatible_semantics", primary: null };
    var byCanon = {};
    present.forEach(function (c) {
      var id = c.provenance.identities.canonical_observation_id;
      byCanon[id] = byCanon[id] || [];
      byCanon[id].push(c);
    });
    var canonIds = Object.keys(byCanon);
    if (canonIds.length > 1) {
      var sources = {};
      present.forEach(function (c) { sources[c.provenance.source.source_id] = true; });
      return {
        rule: Object.keys(sources).length > 1 ? "none_cross_source_conflict" : "none_unresolved_lineages",
        primary: null
      };
    }
    var canonId = canonIds[0];
    var nodes = {};
    cands.forEach(function (c) {
      var ident = c.provenance && c.provenance.identities;
      if (ident && ident.canonical_observation_id === canonId) nodes[ident.revision_id] = ident;
    });
    function hasCycle() {
      var visiting = {};
      var seen = {};
      function dfs(n) {
        if (visiting[n]) return true;
        if (seen[n] || !nodes[n]) return false;
        visiting[n] = true;
        var parent = nodes[n].supersedes_revision_id;
        if (parent && dfs(parent)) return true;
        delete visiting[n];
        seen[n] = true;
        return false;
      }
      return Object.keys(nodes).some(dfs);
    }
    var missing = false;
    var children = {};
    Object.keys(nodes).forEach(function (n) {
      var p = nodes[n].supersedes_revision_id;
      if (!p) return;
      if (!nodes[p]) missing = true;
      else {
        children[p] = children[p] || [];
        children[p].push(n);
      }
    });
    if (hasCycle()) return { rule: "none_revision_cycle", primary: null };
    if (missing) return { rule: "none_missing_parent", primary: null };
    if (Object.keys(children).some(function (p) { return children[p].length > 1; })) {
      return { rule: "none_revision_fork", primary: null };
    }
    var superseded = {};
    Object.keys(nodes).forEach(function (n) {
      if (nodes[n].supersedes_revision_id) superseded[nodes[n].supersedes_revision_id] = true;
    });
    var leaves = Object.keys(nodes).filter(function (n) { return !superseded[n]; });
    if (leaves.length !== 1) return { rule: "none_multiple_leaves", primary: null };
    var leafCands = present.filter(function (c) {
      return c.provenance.identities.revision_id === leaves[0];
    });
    if (leafCands.length !== 1) return { rule: "none_multiple_leaves", primary: null };
    return { rule: "unique_unsuperseded_leaf", primary: leafCands[0].candidate_id };
  }

  function applySelection(field) {
    var exp = expectedSelection(field);
    field.selection = { rule: exp.rule, policy_id: null, policy_version: null };
    field.primary_candidate_id = exp.primary;
    return field;
  }

  function derivedFlags(snap, window) {
    var flags = [];
    var seen = {};
    function add(name) {
      if (!seen[name]) { seen[name] = true; flags.push(name); }
    }
    function visit(c) {
      var ing = c.provenance && c.provenance.ingested_at_utc;
      if (ing && ing >= window.end_utc) add("late_arrival");
    }
    FIELD_NAMES.forEach(function (name) {
      snap[name].candidates.forEach(visit);
      if (CONFLICT_RULES[snap[name].selection.rule]) add("conflict");
    });
    snap.sleep_bouts.forEach(visit);
    if (snap.build_reason === "observation_correction" || snap.build_reason === "activity_correction") add("corrected");
    if (snap.contributing_sources.length > 1) add("multi_source");
    if (snap.contributing_sources.length) {
      var incomplete = CORE_FIELDS && FIELD_NAMES.some(function (name) {
        if (!CORE_FIELDS[name]) return false;
        if (snap[name].selection.rule === "none_empty") return true;
        if (snap[name].selection.rule === "none_all_non_present") {
          return snap[name].candidates.some(function (c) { return ABSENT[c.availability]; });
        }
        return false;
      });
      if (incomplete) add("partial_day");
    }
    if (window.assignment_source === "travel_override") add("timezone_change");
    flags.sort();
    return flags;
  }

  function toCandidate(rev) {
    return {
      candidate_id: "cand:" + rev.provenance.identities.revision_id,
      availability: rev.availability,
      reason: rev.reason,
      value: rev.value,
      semantics: clone(rev.semantics),
      measurement_quality: rev.measurement_quality,
      provenance: clone(rev.provenance)
    };
  }

  function toBout(rev) {
    return {
      candidate_id: "cand:" + rev.provenance.identities.revision_id,
      duration_s: rev.value,
      semantics: clone(rev.semantics),
      measurement_quality: rev.measurement_quality,
      provenance: clone(rev.provenance)
    };
  }

  function evidenceSignature(snap) {
    return JSON.stringify({
      fields: FIELD_NAMES.map(function (name) {
        return {
          name: name,
          rule: snap[name].selection.rule,
          primary: snap[name].primary_candidate_id,
          revs: snap[name].candidates.map(function (c) {
            return c.provenance && c.provenance.identities ? c.provenance.identities.revision_id : null;
          })
        };
      }),
      bouts: snap.sleep_bouts.map(function (b) { return b.provenance.identities.revision_id; }),
      acts: snap.overlapping_activities,
      sources: snap.contributing_sources.map(function (s) { return s.source_id; }),
      freshness: snap.source_freshness,
      coverage: snap.activity_coverage
    });
  }

  function daysApi() {
    if (typeof NXT === "object" && NXT && NXT.wearables && NXT.wearables.days) return NXT.wearables.days;
    if (root.NXTFRMWearableDays) return root.NXTFRMWearableDays;
    return null;
  }

  function canonicalApi() {
    if (typeof NXT === "object" && NXT && NXT.wearables && NXT.wearables.canonical) return NXT.wearables.canonical;
    if (root.NXTFRMWearableCanonical) return root.NXTFRMWearableCanonical;
    return null;
  }

  function ptrKey(userId, dayWindowId) {
    return userId + "|" + dayWindowId;
  }

  function createSnapshots(opts) {
    opts = opts || {};
    var days = opts.days || daysApi();
    var canonical = opts.canonical || canonicalApi();
    var snaps = new Map();
    var pointers = new Map();
    var byLineage = new Map();
    var byContent = new Map();
    var hooks = { failPointer: false, failBeforeCommit: false };

    function snapshotState() {
      return {
        snaps: Array.from(snaps.entries()),
        pointers: Array.from(pointers.entries()),
        byLineage: Array.from(byLineage.entries()),
        byContent: Array.from(byContent.entries())
      };
    }

    function restoreState(s) {
      snaps = new Map(s.snaps);
      pointers = new Map(s.pointers);
      byLineage = new Map(s.byLineage);
      byContent = new Map(s.byContent);
    }

    function lineageSnaps(userId, dayWindowId) {
      return (byLineage.get(ptrKey(userId, dayWindowId)) || []).map(function (id) { return snaps.get(id); }).filter(Boolean);
    }

    function uniqueLeaf(userId, dayWindowId) {
      var chain = lineageSnaps(userId, dayWindowId);
      if (!chain.length) return null;
      var superseded = {};
      chain.forEach(function (s) {
        if (s.supersedes_snapshot_id) superseded[s.supersedes_snapshot_id] = true;
      });
      var leaves = chain.filter(function (s) { return !superseded[s.snapshot_id]; });
      return leaves.length === 1 ? leaves[0] : null;
    }

    function lookupObs(id, provided) {
      if (provided[id]) return provided[id];
      if (canonical && typeof canonical.getObservationRevision === "function") {
        var doc = canonical.getObservationRevision(id);
        if (doc) {
          provided[id] = doc;
          return doc;
        }
      }
      return null;
    }

    function lookupAct(id, provided) {
      if (provided[id]) return provided[id];
      if (canonical && typeof canonical.getActivityRevision === "function") {
        var doc = canonical.getActivityRevision(id);
        if (doc) {
          provided[id] = doc;
          return doc;
        }
      }
      return null;
    }

    function currentObsLeaf(userId, lineageId) {
      if (!canonical) return { status: "no_store", rev: null };
      var chain = canonical.validateObservationChain(userId, lineageId);
      if (!chain || chain.status !== "ok") return { status: chain ? chain.status : "unresolved", rev: null };
      var ptr = canonical.getCurrentObservationPointer(userId, lineageId);
      if (!ptr) return { status: "pointer_missing", rev: null };
      var rev = canonical.getObservationRevision(ptr.revision_id);
      if (!rev) return { status: "pointer_missing_revision", rev: null };
      return { status: "ok", rev: rev };
    }

    function currentActLeaf(userId, lineageId) {
      if (!canonical) return { status: "no_store", rev: null };
      var chain = canonical.validateActivityChain(userId, lineageId);
      if (!chain || chain.status !== "ok") return { status: chain ? chain.status : "unresolved", rev: null };
      var ptr = canonical.getCurrentActivityPointer(userId, lineageId);
      if (!ptr) return { status: "pointer_missing", rev: null };
      var rev = canonical.getActivityRevision(ptr.activity_revision_id);
      if (!rev) return { status: "pointer_missing_revision", rev: null };
      return { status: "ok", rev: rev };
    }

    function ancestorChain(leaf, provided) {
      var out = [];
      var seen = {};
      var cur = leaf;
      while (cur && !seen[cur.provenance.identities.revision_id]) {
        seen[cur.provenance.identities.revision_id] = true;
        out.push(cur);
        var parentId = cur.provenance.identities.supersedes_revision_id;
        if (!parentId) break;
        cur = lookupObs(parentId, provided);
      }
      return out;
    }

    function buildBody(userId, window, builtAt, observations, activities) {
      var obsById = {};
      (observations || []).forEach(function (rev) {
        if (rev && rev.user_id === userId) obsById[rev.provenance.identities.revision_id] = rev;
      });
      var actById = {};
      (activities || []).forEach(function (rev) {
        if (rev && rev.user_id === userId) actById[rev.provenance.identities.activity_revision_id] = rev;
      });

      var obsLineages = {};
      Object.keys(obsById).forEach(function (id) {
        obsLineages[obsById[id].provenance.identities.canonical_observation_id] = true;
      });
      var actLineages = {};
      Object.keys(actById).forEach(function (id) {
        actLineages[actById[id].provenance.identities.canonical_activity_id] = true;
      });

      var fields = {};
      FIELD_NAMES.forEach(function (name) { fields[name] = emptyField(); });
      var bouts = [];
      var unresolved = [];

      Object.keys(obsLineages).forEach(function (lineageId) {
        var cur = currentObsLeaf(userId, lineageId);
        if (cur.status !== "ok") {
          unresolved.push({ lineage_id: lineageId, reason: cur.status });
          return;
        }
        var rev = cur.rev;
        var kind = rev.semantics && rev.semantics.metric_kind;
        var t = membershipTime(rev);
        if (!inWindow(t, window)) return;
        if (kind === "sleep_duration" && rev.semantics.aggregation === "bout") {
          if (rev.availability === "present" && typeof rev.value === "number") bouts.push(toBout(rev));
          return;
        }
        var fieldName = fieldForKind(kind);
        if (!fieldName) return;
        ancestorChain(rev, obsById).forEach(function (node) {
          fields[fieldName].candidates.push(toCandidate(node));
        });
      });

      FIELD_NAMES.forEach(function (name) {
        fields[name].candidates.sort(function (a, b) {
          var ar = a.provenance.identities.revision_id;
          var br = b.provenance.identities.revision_id;
          if (ar < br) return -1;
          if (ar > br) return 1;
          return 0;
        });
        applySelection(fields[name]);
      });
      bouts.sort(function (a, b) {
        var as = a.semantics.interval_start_utc || "";
        var bs = b.semantics.interval_start_utc || "";
        if (as < bs) return -1;
        if (as > bs) return 1;
        var ar = a.provenance.identities.revision_id;
        var br = b.provenance.identities.revision_id;
        if (ar < br) return -1;
        if (ar > br) return 1;
        return 0;
      });

      var pins = [];
      var builtMs = parseUtc(builtAt);
      Object.keys(actLineages).forEach(function (lineageId) {
        var cur = currentActLeaf(userId, lineageId);
        if (cur.status !== "ok") {
          unresolved.push({ lineage_id: lineageId, reason: cur.status, kind: "activity" });
          return;
        }
        var rev = cur.rev;
        var ing = parseUtc(rev.provenance.ingested_at_utc);
        if (Number.isFinite(ing) && Number.isFinite(builtMs) && ing > builtMs) return;
        if (!intervalsOverlap(rev.start_utc, rev.end_utc, window.start_utc, window.end_utc)) return;
        pins.push({
          canonical_activity_id: rev.provenance.identities.canonical_activity_id,
          activity_revision_id: rev.provenance.identities.activity_revision_id,
          _start: rev.start_utc
        });
      });
      pins.sort(function (a, b) {
        if (a._start < b._start) return -1;
        if (a._start > b._start) return 1;
        if (a.canonical_activity_id < b.canonical_activity_id) return -1;
        if (a.canonical_activity_id > b.canonical_activity_id) return 1;
        if (a.activity_revision_id < b.activity_revision_id) return -1;
        if (a.activity_revision_id > b.activity_revision_id) return 1;
        return 0;
      });
      var cleanPins = pins.map(function (p) {
        return { canonical_activity_id: p.canonical_activity_id, activity_revision_id: p.activity_revision_id };
      });

      var sources = {};
      function noteSource(prov, observed) {
        if (!prov || !prov.source || !prov.source.source_id) return;
        var sid = prov.source.source_id;
        if (!sources[sid]) sources[sid] = { source: clone(prov.source), newest: null };
        if (observed && (!sources[sid].newest || observed > sources[sid].newest)) sources[sid].newest = observed;
      }
      FIELD_NAMES.forEach(function (name) {
        fields[name].candidates.forEach(function (c) {
          noteSource(c.provenance, c.provenance && c.provenance.observed_at_utc);
        });
      });
      bouts.forEach(function (b) { noteSource(b.provenance, b.provenance.observed_at_utc); });
      cleanPins.forEach(function (pin) {
        var act = lookupAct(pin.activity_revision_id, actById);
        if (act) noteSource(act.provenance, act.provenance.observed_at_utc);
      });
      var contributing = Object.keys(sources).sort().map(function (sid) { return sources[sid].source; });
      var freshness = contributing.map(function (src) {
        return {
          source_id: src.source_id,
          last_successful_sync_at_utc: null,
          source_updated_at_utc: null,
          newest_observation_at_utc: sources[src.source_id].newest,
          expected_update_window: null
        };
      });
      var syncs = freshness.map(function (s) { return s.last_successful_sync_at_utc; }).filter(Boolean);
      var news = freshness.map(function (s) { return s.newest_observation_at_utc; }).filter(Boolean);
      var aggregate = {
        derivation_id: "freshness.aggregate.g1.2",
        derivation_version: "1",
        last_successful_sync_at_utc: syncs.length ? syncs.reduce(function (a, b) { return a > b ? a : b; }) : null,
        newest_observation_at_utc: news.length ? news.reduce(function (a, b) { return a > b ? a : b; }) : null
      };

      var snap = {
        document_type: "wearable_daily_snapshot",
        schema_version: SCHEMA,
        normalization_version: NORM,
        snapshot_id: "",
        snapshot_version: 1,
        supersedes_snapshot_id: null,
        build_reason: "initial",
        activity_coverage: "complete",
        built_at_utc: builtAt,
        user_id: userId,
        day_window_id: window.day_window_id
      };
      FIELD_NAMES.forEach(function (name) { snap[name] = fields[name]; });
      snap.sleep_bouts = bouts;
      snap.overlapping_activities = cleanPins;
      snap.activity_links = [];
      snap.contributing_sources = contributing;
      snap.source_freshness = freshness;
      snap.freshness_aggregate = aggregate;
      snap.quality_flags = [];
      return { snap: snap, unresolved: unresolved };
    }

    function validateSnapshot(doc, window) {
      if (!doc || doc.document_type !== "wearable_daily_snapshot" || doc.schema_version !== SCHEMA) {
        throw snapErr(OUTCOME.invalid_snapshot, "DailySnapshot envelope is invalid.");
      }
      if (Object.prototype.hasOwnProperty.call(doc, "is_current")) {
        throw snapErr(OUTCOME.invalid_snapshot, "DailySnapshot must not persist is_current.");
      }
      if (doc.local_date || doc.utc_range || doc.day_timezone) {
        throw snapErr(OUTCOME.invalid_snapshot, "Snapshot must not store independent day range fields.");
      }
      if (doc.recovery || doc.readiness || doc.quality && doc.quality.band) {
        throw snapErr(OUTCOME.invalid_snapshot, "Snapshot must not invent recovery/readiness/quality.band.");
      }
      if (!isNonEmptyString(doc.snapshot_id) || !isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.day_window_id)) {
        throw snapErr(OUTCOME.invalid_snapshot, "Snapshot identity is incomplete.");
      }
      if (!Number.isInteger(doc.snapshot_version) || doc.snapshot_version < 1) {
        throw snapErr(OUTCOME.invalid_snapshot, "snapshot_version must be an integer >= 1.");
      }
      if (!Number.isFinite(parseUtc(doc.built_at_utc))) {
        throw snapErr(OUTCOME.invalid_snapshot, "built_at_utc must be canonical UTC.");
      }
      if (!window || window.user_id !== doc.user_id || window.day_window_id !== doc.day_window_id) {
        throw snapErr(OUTCOME.invalid_snapshot, "Snapshot window does not match UserDayWindow.");
      }
      FIELD_NAMES.forEach(function (name) {
        var field = doc[name];
        if (!field || !Array.isArray(field.candidates) || !field.selection) {
          throw snapErr(OUTCOME.invalid_snapshot, name + " field selection is required.");
        }
        if (field.selection.policy_id != null || field.selection.policy_version != null) {
          throw snapErr(OUTCOME.invalid_snapshot, name + " policy must be null.");
        }
        if (field.selection.rule === "named_priority_policy") {
          throw snapErr(OUTCOME.invalid_snapshot, "named_priority_policy is forbidden.");
        }
        var exp = expectedSelection(field);
        if (field.selection.rule !== exp.rule || field.primary_candidate_id !== exp.primary) {
          throw snapErr(OUTCOME.invalid_snapshot, name + " selection does not match frozen algorithm.");
        }
        field.candidates.forEach(function (c) {
          if (c.semantics.metric_kind !== FIELD_KIND[name]) {
            throw snapErr(OUTCOME.invalid_snapshot, name + " candidate has wrong metric_kind.");
          }
        });
      });
      var srcIds = doc.contributing_sources.map(function (s) { return s.source_id; });
      if (srcIds.length !== new Set(srcIds).size) throw snapErr(OUTCOME.invalid_snapshot, "duplicate contributing source.");
      var frIds = doc.source_freshness.map(function (s) { return s.source_id; });
      if (srcIds.join("|") !== frIds.join("|") && (srcIds.slice().sort().join("|") !== frIds.slice().sort().join("|") || srcIds.length !== frIds.length)) {
        /* require exact set equality */
      }
      if (srcIds.length !== frIds.length || srcIds.some(function (id) { return frIds.indexOf(id) === -1; })) {
        throw snapErr(OUTCOME.invalid_snapshot, "source_freshness must match contributing_sources.");
      }
      var expected = derivedFlags(doc, window);
      if (JSON.stringify(doc.quality_flags.slice().sort()) !== JSON.stringify(expected)) {
        throw snapErr(OUTCOME.invalid_snapshot, "quality_flags do not match frozen predicates.");
      }
      return doc;
    }

    function assemble(input) {
      input = input || {};
      var before = snapshotState();
      try {
        if (hooks.failBeforeCommit) {
          hooks.failBeforeCommit = false;
          throw snapErr(OUTCOME.invalid_snapshot, "Forced pre-commit failure.");
        }
        if (!isNonEmptyString(input.user_id) || !isNonEmptyString(input.day_window_id)) {
          throw snapErr(OUTCOME.invalid_day_window, "user_id and day_window_id are required.");
        }
        if (!Number.isFinite(parseUtc(input.built_at_utc))) {
          throw snapErr(OUTCOME.invalid_snapshot, "built_at_utc must be a canonical UTC instant.");
        }
        if (!days || typeof days.getWindow !== "function") {
          throw snapErr(OUTCOME.invalid_day_window, "G4A day-window store is required.");
        }
        var window = days.getWindow(input.day_window_id);
        if (!window) throw snapErr(OUTCOME.invalid_day_window, "day window does not exist.");
        if (window.user_id !== input.user_id) throw snapErr(OUTCOME.invalid_day_window, "day window user mismatch.");
        var dwPtr = days.getCurrentPointer(window.user_id, window.local_date);
        if (!dwPtr) throw snapErr(OUTCOME.missing_day_window, "current day-window pointer is missing.");
        if (dwPtr.day_window_id !== window.day_window_id) {
          throw snapErr(OUTCOME.invalid_day_window, "requested window is not the current UserDayWindow.");
        }
        var built = buildBody(input.user_id, window, input.built_at_utc, input.observations || [], input.activities || []);
        var snap = built.snap;
        var prior = uniqueLeaf(input.user_id, input.day_window_id);
        var signature = evidenceSignature(snap);
        var contentKey = ptrKey(input.user_id, input.day_window_id) + "\n" + signature;
        var existingId = byContent.get(contentKey);
        if (existingId && snaps.get(existingId)) {
          var existing = snaps.get(existingId);
          var ptrNow = pointers.get(ptrKey(input.user_id, input.day_window_id));
          return resultBase(OUTCOME.reused, {
            snapshot_id: existing.snapshot_id,
            snapshot_version: existing.snapshot_version,
            snapshot: clone(existing),
            pointer: ptrNow ? clone(ptrNow) : null,
            unresolved: built.unresolved
          });
        }
        if (prior) {
          snap.snapshot_version = prior.snapshot_version + 1;
          snap.supersedes_snapshot_id = prior.snapshot_id;
          var priorObs = JSON.stringify(FIELD_NAMES.map(function (n) {
            return (prior[n].candidates || []).map(function (c) { return c.provenance.identities.revision_id; });
          }).concat([prior.sleep_bouts.map(function (b) { return b.provenance.identities.revision_id; })]));
          var nextObs = JSON.stringify(FIELD_NAMES.map(function (n) {
            return (snap[n].candidates || []).map(function (c) { return c.provenance.identities.revision_id; });
          }).concat([snap.sleep_bouts.map(function (b) { return b.provenance.identities.revision_id; })]));
          var priorActs = JSON.stringify(prior.overlapping_activities);
          var nextActs = JSON.stringify(snap.overlapping_activities);
          snap.build_reason = priorObs === nextObs && priorActs !== nextActs ? "activity_correction" : "observation_correction";
        }
        snap.quality_flags = derivedFlags(snap, window);
        snap.snapshot_id = "snap:" + sha256Hex(contentKey + "\n" + String(snap.snapshot_version)).slice(0, 32);
        validateSnapshot(snap, window);
        var pointer = {
          document_type: "current_snapshot_pointer",
          schema_version: SCHEMA,
          user_id: input.user_id,
          day_window_id: input.day_window_id,
          snapshot_id: snap.snapshot_id,
          snapshot_version: snap.snapshot_version,
          advanced_at_utc: input.advanced_at_utc || input.built_at_utc,
          accepted_delivery_id: input.accepted_delivery_id == null ? null : input.accepted_delivery_id
        };
        if (hooks.failPointer) {
          hooks.failPointer = false;
          throw snapErr(OUTCOME.invalid_pointer, "Forced pointer failure.");
        }
        snaps.set(snap.snapshot_id, clone(snap));
        var list = byLineage.get(ptrKey(input.user_id, input.day_window_id)) || [];
        list.push(snap.snapshot_id);
        byLineage.set(ptrKey(input.user_id, input.day_window_id), list);
        byContent.set(contentKey, snap.snapshot_id);
        pointers.set(ptrKey(input.user_id, input.day_window_id), clone(pointer));
        return resultBase(prior ? OUTCOME.assembled_version : OUTCOME.assembled, {
          snapshot_id: snap.snapshot_id,
          snapshot_version: snap.snapshot_version,
          snapshot: clone(snap),
          pointer: clone(pointer),
          unresolved: built.unresolved
        });
      } catch (err) {
        restoreState(before);
        if (err && OUTCOME[err.code]) {
          return resultBase(err.code, { reason: err.message });
        }
        throw err;
      }
    }

    function setCurrent(userId, dayWindowId, snapshotId, snapshotVersion, advancedAtUtc) {
      var before = snapshotState();
      try {
        var snap = snaps.get(snapshotId);
        if (!snap) throw snapErr(OUTCOME.invalid_pointer, "pointer targets a missing snapshot.");
        if (snap.user_id !== userId) throw snapErr(OUTCOME.invalid_pointer, "pointer user_id does not match snapshot.");
        if (snap.day_window_id !== dayWindowId) throw snapErr(OUTCOME.invalid_pointer, "pointer day_window_id does not match snapshot.");
        if (snap.snapshot_version !== snapshotVersion) throw snapErr(OUTCOME.invalid_pointer, "pointer snapshot_version does not match snapshot.");
        var leaf = uniqueLeaf(userId, dayWindowId);
        if (!leaf || leaf.snapshot_id !== snapshotId) {
          throw snapErr(OUTCOME.invalid_pointer, "current snapshot pointer must target the unique leaf.");
        }
        var existing = pointers.get(ptrKey(userId, dayWindowId));
        if (existing && existing.snapshot_id === snapshotId && existing.snapshot_version === snapshotVersion) {
          return resultBase(OUTCOME.pointer_unchanged, { pointer: clone(existing) });
        }
        var pointer = {
          document_type: "current_snapshot_pointer",
          schema_version: SCHEMA,
          user_id: userId,
          day_window_id: dayWindowId,
          snapshot_id: snapshotId,
          snapshot_version: snapshotVersion,
          advanced_at_utc: advancedAtUtc,
          accepted_delivery_id: existing ? existing.accepted_delivery_id : null
        };
        if (!Number.isFinite(parseUtc(pointer.advanced_at_utc))) {
          throw snapErr(OUTCOME.invalid_pointer, "advanced_at_utc must be canonical UTC.");
        }
        if (hooks.failPointer) {
          hooks.failPointer = false;
          throw snapErr(OUTCOME.invalid_pointer, "Forced pointer failure.");
        }
        pointers.set(ptrKey(userId, dayWindowId), clone(pointer));
        return resultBase(OUTCOME.pointer_set, { pointer: clone(pointer) });
      } catch (err) {
        restoreState(before);
        if (err && OUTCOME[err.code]) return resultBase(err.code, { reason: err.message });
        throw err;
      }
    }

    function status() {
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.snapshots",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        interprets_recovery: false,
        snapshots: snaps.size,
        snapshot_pointers: pointers.size,
        observation_revisions: 0,
        activity_revisions: 0,
        day_windows: 0
      };
    }

    return {
      assemble: assemble,
      getSnapshot: function (id) {
        var doc = snaps.get(id);
        return doc ? clone(doc) : null;
      },
      listSnapshots: function (userId, dayWindowId) {
        return clone(lineageSnaps(userId, dayWindowId));
      },
      getCurrent: function (userId, dayWindowId) {
        var ptr = pointers.get(ptrKey(userId, dayWindowId));
        if (!ptr) return null;
        var snap = snaps.get(ptr.snapshot_id);
        return snap ? clone(snap) : null;
      },
      getCurrentPointer: function (userId, dayWindowId) {
        var doc = pointers.get(ptrKey(userId, dayWindowId));
        return doc ? clone(doc) : null;
      },
      setCurrent: setCurrent,
      resolveCurrent: function (userId, dayWindowId) {
        var ptr = pointers.get(ptrKey(userId, dayWindowId));
        if (!ptr) return resultBase(OUTCOME.missing_pointer, { snapshot: null, pointer: null });
        var snap = snaps.get(ptr.snapshot_id);
        if (!snap) return resultBase(OUTCOME.invalid_pointer, { snapshot: null, pointer: clone(ptr) });
        return resultBase("ok", { snapshot: clone(snap), pointer: clone(ptr) });
      },
      validateSnapshot: function (doc, window) {
        try {
          return resultBase("ok", { snapshot: clone(validateSnapshot(clone(doc), window)) });
        } catch (err) {
          return resultBase(err.code || OUTCOME.invalid_snapshot, { reason: err.message });
        }
      },
      intervalsOverlap: intervalsOverlap,
      inWindow: inWindow,
      membershipTime: membershipTime,
      status: status,
      createSnapshots: createSnapshots,
      OUTCOME: OUTCOME,
      _test: {
        failNextPointer: function () { hooks.failPointer = true; },
        failBeforeCommit: function () { hooks.failBeforeCommit = true; },
        clearHooks: function () { hooks.failPointer = false; hooks.failBeforeCommit = false; }
      }
    };
  }

  var page = createSnapshots();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.snapshots = page;
  root.NXTFRMWearableSnapshots = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
