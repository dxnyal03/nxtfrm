/* NXTFRM R1: recovery input contract + personal-baseline readiness heuristic.
 * In-memory only. Consumes resolved DailySnapshot evidence. Does not write storage or UI.
 *
 * Policy nxtfrm.recovery.personal_baseline v1 is a product heuristic, not a clinical score.
 */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var BOUNDARY = "r1.recovery_consumer";
  var CORE = ["hrv", "resting_hr", "sleep"];
  var FIELD_OF = { hrv: "hrv", resting_hr: "resting_hr_bpm", sleep: "sleep_duration_s" };
  var UNIT_OF = { hrv: "ms", resting_hr: "bpm", sleep: "s" };
  var CONFLICT_RULES = {
    none_incompatible_semantics: true,
    none_cross_source_conflict: true,
    none_unresolved_lineages: true,
    none_revision_fork: true,
    none_revision_cycle: true,
    none_missing_parent: true,
    none_multiple_leaves: true
  };
  var FLAG_CODES = {
    conflict: "snapshot_conflict",
    partial_day: "snapshot_partial_day",
    timezone_change: "snapshot_timezone_change",
    late_arrival: "snapshot_late_arrival",
    corrected: "snapshot_corrected",
    multi_source: "snapshot_multi_source"
  };

  var POLICY = Object.freeze({
    policy_id: "nxtfrm.recovery.personal_baseline",
    policy_version: "1",
    document_type: "recovery_result",
    schema_version: SCHEMA,
    components: CORE.slice(),
    weights: Object.freeze({ hrv: 1, resting_hr: 1, sleep: 1 }),
    baseline_days: 14,
    baseline_min_samples: 5,
    min_components: 2,
    near_baseline: 0.03,
    score_min: 0,
    score_max: 100,
    missing_component: "renormalize",
    supported_score_ids: Object.freeze([]),
    formulas: Object.freeze({
      hrv: "contribution = clamp(50 + 100 * (raw - baseline) / baseline, 0, 100)",
      resting_hr: "contribution = clamp(50 + 100 * (baseline - raw) / baseline, 0, 100)",
      sleep: "contribution = clamp(100 - 100 * abs(raw - baseline) / baseline, 0, 100)",
      aggregate: "round(sum(contribution * weight) / sum(usable weights)); missing components are omitted, not zero"
    })
  });

  var OUTCOME = Object.freeze({
    evaluated: "evaluated",
    invalid_snapshot: "invalid_snapshot",
    missing_snapshot: "missing_snapshot"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function recErr(code, message, details) {
    var err = new Error(message);
    err.code = code;
    err.details = details == null ? null : details;
    return err;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
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

  function clamp(n, lo, hi) {
    if (!Number.isFinite(n)) return null;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function median(nums) {
    var a = (nums || []).filter(function (n) { return Number.isFinite(n); }).slice().sort(function (x, y) {
      if (x < y) return -1;
      if (x > y) return 1;
      return 0;
    });
    if (!a.length) return null;
    var mid = Math.floor(a.length / 2);
    if (a.length % 2) return a[mid];
    return (a[mid - 1] + a[mid]) / 2;
  }

  function sortIds(list) {
    return (list || []).slice().sort();
  }

  function candidateDiagnostics(field) {
    return ((field && field.candidates) || []).map(function (c) {
      var ident = c.provenance && c.provenance.identities;
      var src = c.provenance && c.provenance.source;
      return {
        candidate_id: c.candidate_id || null,
        revision_id: ident ? ident.revision_id : null,
        source_id: src ? src.source_id : null,
        value: c.value == null ? null : c.value,
        availability: c.availability || null
      };
    }).sort(function (a, b) {
      var ar = a.revision_id || "";
      var br = b.revision_id || "";
      if (ar < br) return -1;
      if (ar > br) return 1;
      return 0;
    });
  }

  function scoreIdentity(sem) {
    if (!sem) return null;
    return {
      score_id: sem.score_id || null,
      min: sem.score_range ? sem.score_range.min : null,
      max: sem.score_range ? sem.score_range.max : null,
      direction: sem.direction || null
    };
  }

  function semanticSupported(sem) {
    var id = scoreIdentity(sem);
    if (!id || !id.score_id) return false;
    return POLICY.supported_score_ids.some(function (allowed) {
      return allowed.score_id === id.score_id
        && allowed.min === id.min
        && allowed.max === id.max
        && allowed.direction === id.direction;
    });
  }

  function extractResolved(field) {
    var empty = {
      usable: false,
      reason: "missing",
      value: null,
      candidate_id: null,
      selection_rule: field && field.selection ? field.selection.rule : "none_empty",
      candidate: null,
      diagnostics: candidateDiagnostics(field)
    };
    if (!field || !Array.isArray(field.candidates)) return empty;
    var rule = field.selection && field.selection.rule;
    empty.selection_rule = rule || "none_empty";
    if (!field.candidates.length || rule === "none_empty") return empty;
    if (rule === "none_all_non_present") {
      var unsupported = field.candidates.some(function (c) { return c.availability === "unsupported"; });
      empty.reason = unsupported ? "unsupported" : "missing";
      return empty;
    }
    if (CONFLICT_RULES[rule] || (rule && rule.indexOf("none_") === 0 && rule !== "none_empty" && rule !== "none_all_non_present")) {
      empty.reason = "unresolved";
      return empty;
    }
    if (rule !== "unique_unsuperseded_leaf" || !isNonEmptyString(field.primary_candidate_id)) {
      empty.reason = "unresolved";
      return empty;
    }
    var found = null;
    field.candidates.forEach(function (c) {
      if (c.candidate_id === field.primary_candidate_id) found = c;
    });
    if (!found || found.availability !== "present" || !Number.isFinite(found.value)) {
      empty.reason = found && found.availability === "unsupported" ? "unsupported" : "missing";
      return empty;
    }
    return {
      usable: true,
      reason: "resolved",
      value: found.value,
      candidate_id: found.candidate_id,
      selection_rule: rule,
      candidate: found,
      diagnostics: candidateDiagnostics(field)
    };
  }

  function windowIndex(windows) {
    var map = {};
    (windows || []).forEach(function (w) {
      if (w && w.day_window_id) map[w.day_window_id] = w;
    });
    return map;
  }

  function pointerKey(userId, localDate) {
    return userId + "|" + localDate;
  }

  function snapPointerKey(userId, dayWindowId) {
    return userId + "|" + dayWindowId;
  }

  function indexDayWindowPointers(list) {
    var map = {};
    var conflicted = {};
    (list || []).forEach(function (p) {
      if (!p || !isNonEmptyString(p.user_id) || !isNonEmptyString(p.local_date) || !isNonEmptyString(p.day_window_id)) return;
      var key = pointerKey(p.user_id, p.local_date);
      if (map[key] && map[key].day_window_id !== p.day_window_id) conflicted[key] = true;
      map[key] = p;
    });
    Object.keys(conflicted).forEach(function (key) { delete map[key]; });
    return { map: map, conflicted: conflicted };
  }

  function indexSnapshotPointers(list) {
    var map = {};
    var conflicted = {};
    (list || []).forEach(function (p) {
      if (!p || !isNonEmptyString(p.user_id) || !isNonEmptyString(p.day_window_id) || !isNonEmptyString(p.snapshot_id)) return;
      if (!Number.isInteger(p.snapshot_version)) return;
      var key = snapPointerKey(p.user_id, p.day_window_id);
      if (map[key] && (map[key].snapshot_id !== p.snapshot_id || map[key].snapshot_version !== p.snapshot_version)) {
        conflicted[key] = true;
      }
      map[key] = p;
    });
    Object.keys(conflicted).forEach(function (key) { delete map[key]; });
    return { map: map, conflicted: conflicted };
  }

  function uniqueLineageIds(set) {
    return Object.keys(set);
  }

  function validateDayWindowPointer(pointer, userId, localDate, windowsById, history) {
    if (!pointer) return { ok: false, reason: "invalid_day_window_pointer" };
    if (pointer.user_id !== userId) return { ok: false, reason: "invalid_day_window_pointer" };
    if (pointer.local_date !== localDate) return { ok: false, reason: "invalid_day_window_pointer" };
    var win = windowsById[pointer.day_window_id];
    if (!win) return { ok: false, reason: "invalid_day_window_pointer" };
    if (win.user_id !== userId) return { ok: false, reason: "invalid_day_window_pointer" };
    if (win.local_date !== localDate) return { ok: false, reason: "invalid_day_window_pointer" };
    var hasSnap = (history || []).some(function (s) {
      return s && s.user_id === userId && s.day_window_id === pointer.day_window_id;
    });
    if (!hasSnap) return { ok: false, reason: "invalid_day_window_pointer" };
    return { ok: true, window: win };
  }

  function resolveHistoricalSnapshot(snaps, pointer, userId, dayWindowId) {
    var list = (snaps || []).filter(function (s) {
      return s && s.user_id === userId && s.day_window_id === dayWindowId && s.snapshot_id !== undefined;
    });
    if (pointer) {
      if (pointer.user_id !== userId || pointer.day_window_id !== dayWindowId) {
        return { snap: null, reason: "invalid_snapshot_pointer" };
      }
      var found = null;
      list.forEach(function (s) {
        if (s.snapshot_id === pointer.snapshot_id && s.snapshot_version === pointer.snapshot_version) found = s;
      });
      if (!found) return { snap: null, reason: "invalid_snapshot_pointer" };
      if (found.user_id !== userId || found.day_window_id !== dayWindowId) {
        return { snap: null, reason: "invalid_snapshot_pointer" };
      }
      return { snap: found, reason: null };
    }
    var uniq = {};
    list.forEach(function (s) {
      uniq[String(s.snapshot_id) + "#" + String(s.snapshot_version)] = s;
    });
    var keys = Object.keys(uniq);
    if (keys.length === 1) return { snap: uniq[keys[0]], reason: null };
    if (!keys.length) return { snap: null, reason: "invalid_snapshot_pointer" };
    return { snap: null, reason: "ambiguous_snapshot" };
  }

  function selectHistory(current, history, windows, dayWindowPointers, snapshotPointers) {
    var windowsById = windowIndex(windows);
    var dwPtr = indexDayWindowPointers(dayWindowPointers);
    var snapPtr = indexSnapshotPointers(snapshotPointers);
    var currentWin = windowsById[current.day_window_id] || null;
    var currentDate = currentWin ? currentWin.local_date : null;
    var byDate = {};
    (windows || []).forEach(function (win) {
      if (!win || win.user_id !== current.user_id || !win.local_date || !win.day_window_id) return;
      if (!byDate[win.local_date]) byDate[win.local_date] = {};
      byDate[win.local_date][win.day_window_id] = win;
    });
    var excluded = [];
    var rows = [];
    Object.keys(byDate).sort().forEach(function (localDate) {
      if (currentDate && localDate === currentDate) return;
      var lineageSet = byDate[localDate];
      var lineageIds = uniqueLineageIds(lineageSet).filter(function (dw) {
        if (dw === current.day_window_id) return false;
        var win = lineageSet[dw];
        if (currentWin && !(win.start_utc < currentWin.start_utc)) return false;
        return (history || []).some(function (s) {
          return s && s.user_id === current.user_id && s.day_window_id === dw && s.snapshot_id !== current.snapshot_id;
        });
      });
      if (!lineageIds.length) return;
      var key = pointerKey(current.user_id, localDate);
      var pointer = dwPtr.map[key];
      var selectedDw = null;
      var foreign = (dayWindowPointers || []).some(function (p) {
        return p && p.local_date === localDate && p.user_id !== current.user_id;
      });
      var mismatched = (dayWindowPointers || []).some(function (p) {
        return p && lineageSet[p.day_window_id] && p.local_date !== localDate;
      });
      if (dwPtr.conflicted[key] || (foreign && !pointer) || mismatched) {
        excluded.push({ local_date: localDate, reason: "invalid_day_window_pointer" });
        return;
      }
      if (pointer) {
        var checked = validateDayWindowPointer(pointer, current.user_id, localDate, windowsById, history);
        if (!checked.ok) {
          excluded.push({ local_date: localDate, reason: checked.reason });
          return;
        }
        if (lineageIds.indexOf(pointer.day_window_id) === -1) {
          excluded.push({ local_date: localDate, reason: "invalid_day_window_pointer" });
          return;
        }
        selectedDw = pointer.day_window_id;
      } else if (lineageIds.length > 1) {
        excluded.push({ local_date: localDate, reason: "ambiguous_day_window_lineage" });
        return;
      } else {
        selectedDw = lineageIds[0];
      }
      var spKey = snapPointerKey(current.user_id, selectedDw);
      if (snapPtr.conflicted[spKey]) {
        excluded.push({ local_date: localDate, reason: "invalid_snapshot_pointer" });
        return;
      }
      var resolved = resolveHistoricalSnapshot(history, snapPtr.map[spKey], current.user_id, selectedDw);
      if (!resolved.snap || resolved.snap.snapshot_id === current.snapshot_id) {
        excluded.push({ local_date: localDate, reason: resolved.reason || "invalid_snapshot_pointer" });
        return;
      }
      rows.push({ snap: resolved.snap, window: lineageSet[selectedDw], local_date: localDate });
    });
    rows.sort(function (a, b) {
      if (a.window.start_utc > b.window.start_utc) return -1;
      if (a.window.start_utc < b.window.start_utc) return 1;
      if (a.local_date > b.local_date) return -1;
      if (a.local_date < b.local_date) return 1;
      return 0;
    });
    return {
      rows: rows.slice(0, POLICY.baseline_days),
      excluded: excluded
    };
  }

  function baselineFor(name, current, history, windows, dayWindowPointers, snapshotPointers) {
    var fieldName = FIELD_OF[name];
    var selected = selectHistory(current, history, windows, dayWindowPointers, snapshotPointers);
    var values = [];
    var ids = [];
    selected.rows.forEach(function (row) {
      var extracted = extractResolved(row.snap[fieldName]);
      if (!extracted.usable) return;
      values.push(extracted.value);
      ids.push(row.snap.snapshot_id);
    });
    var med = median(values);
    return {
      count: values.length,
      values: values,
      median: med,
      sufficient: values.length >= POLICY.baseline_min_samples && med != null && med !== 0,
      snapshot_ids: ids,
      excluded: selected.excluded,
      reasons: sortIds(selected.excluded.map(function (e) { return e.reason; }).filter(function (r, i, all) {
        return all.indexOf(r) === i;
      }))
    };
  }

  function normalizeComponent(name, raw, baseline) {
    if (!Number.isFinite(raw) || !Number.isFinite(baseline) || baseline === 0) return null;
    var rel;
    var contribution;
    if (name === "resting_hr") {
      rel = (baseline - raw) / baseline;
      contribution = clamp(50 + 100 * rel, POLICY.score_min, POLICY.score_max);
    } else if (name === "sleep") {
      rel = (raw - baseline) / baseline;
      contribution = clamp(100 - 100 * Math.abs(rel), POLICY.score_min, POLICY.score_max);
    } else {
      rel = (raw - baseline) / baseline;
      contribution = clamp(50 + 100 * rel, POLICY.score_min, POLICY.score_max);
    }
    if (!Number.isFinite(contribution)) return null;
    return { relative: rel, contribution: contribution };
  }

  function emptyComponent(name, status, extracted) {
    return {
      status: status,
      raw: null,
      baseline: null,
      normalized: null,
      contribution: null,
      weight: POLICY.weights[name],
      unit: UNIT_OF[name],
      selection_rule: extracted ? extracted.selection_rule : null,
      candidate_id: extracted ? extracted.candidate_id : null
    };
  }

  function explanationFor(name, extracted, component) {
    if (extracted.reason === "missing") return name + "_missing";
    if (extracted.reason === "unsupported") return name + "_unsupported";
    if (extracted.reason === "unresolved") return name + "_unresolved";
    if (component.status === "insufficient_baseline") return name + "_insufficient_baseline";
    if (!Number.isFinite(component.normalized)) return name + "_near_baseline";
    var abs = Math.abs(component.normalized);
    if (abs <= POLICY.near_baseline) return name + "_near_baseline";
    if (name === "resting_hr") return component.normalized > 0 ? name + "_below_baseline" : name + "_above_baseline";
    if (name === "sleep") return component.normalized >= 0 ? name + "_above_baseline" : name + "_below_baseline";
    return component.normalized > 0 ? name + "_above_baseline" : name + "_below_baseline";
  }

  function proprietaryNote(snap) {
    var names = ["sleep_score", "stress", "energy_reserve"];
    var notes = [];
    names.forEach(function (name) {
      var field = snap[name];
      var extracted = extractResolved(field);
      if (!extracted.usable) return;
      var sem = extracted.candidate && extracted.candidate.semantics;
      if (!semanticSupported(sem)) notes.push(name + "_unsupported_semantic");
    });
    return notes;
  }

  function semanticPayload(result) {
    return JSON.stringify({
      policy_id: result.policy_id,
      policy_version: result.policy_version,
      snapshot_id: result.snapshot_id,
      snapshot_version: result.snapshot_version,
      status: result.status,
      score: result.score,
      components: CORE.map(function (name) {
        var c = result.components[name];
        return {
          name: name,
          status: c.status,
          raw: c.raw,
          baseline: c.baseline,
          normalized: c.normalized,
          contribution: c.contribution,
          weight: c.weight
        };
      }),
      missing: result.missing,
      unresolved: result.unresolved,
      unsupported: result.unsupported,
      explanation: result.explanation,
      quality_flags: result.quality_flags
    });
  }

  function validateSnapshot(doc) {
    if (!doc || doc.document_type !== "wearable_daily_snapshot" || doc.schema_version !== SCHEMA) {
      throw recErr(OUTCOME.invalid_snapshot, "DailySnapshot envelope is invalid.");
    }
    if (doc.recovery || doc.readiness || (doc.quality && doc.quality.band)) {
      throw recErr(OUTCOME.invalid_snapshot, "Snapshot must not invent recovery/readiness/quality.band.");
    }
    if (!isNonEmptyString(doc.snapshot_id) || !isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.day_window_id)) {
      throw recErr(OUTCOME.invalid_snapshot, "Snapshot identity is incomplete.");
    }
    if (!Number.isInteger(doc.snapshot_version) || doc.snapshot_version < 1) {
      throw recErr(OUTCOME.invalid_snapshot, "snapshot_version must be an integer >= 1.");
    }
    return doc;
  }

  function snapshotsApi() {
    if (typeof NXT === "object" && NXT && NXT.wearables && NXT.wearables.snapshots) return NXT.wearables.snapshots;
    if (root.NXTFRMWearableSnapshots) return root.NXTFRMWearableSnapshots;
    return null;
  }

  function daysApi() {
    if (typeof NXT === "object" && NXT && NXT.wearables && NXT.wearables.days) return NXT.wearables.days;
    if (root.NXTFRMWearableDays) return root.NXTFRMWearableDays;
    return null;
  }

  function createRecovery(opts) {
    opts = opts || {};
    var snapshots = opts.snapshots || snapshotsApi();
    var days = opts.days || daysApi();

    function evaluate(input) {
      input = input || {};
      try {
        var base = input.snapshot ? clone(input.snapshot) : null;
        if (!base && input.snapshot_id && snapshots && typeof snapshots.getSnapshot === "function") {
          base = snapshots.getSnapshot(input.snapshot_id);
        }
        if (!base) throw recErr(OUTCOME.missing_snapshot, "snapshot does not exist.");
        validateSnapshot(base);
        var history = clone(input.history || []);
        var windows = clone(input.windows || []);
        var dayWindowPointers = clone(input.dayWindowPointers || input.day_window_pointers || []);
        var snapshotPointers = clone(input.snapshotPointers || input.snapshot_pointers || []);
        var selected = selectHistory(base, history, windows, dayWindowPointers, snapshotPointers);
        var components = {};
        var inputs = {};
        var missing = [];
        var unresolved = [];
        var unsupported = [];
        var usable = [];
        var explanations = [];
        selected.excluded.forEach(function (item) {
          if (item.reason) explanations.push(item.reason);
        });
        CORE.forEach(function (name) {
          var extracted = extractResolved(base[FIELD_OF[name]]);
          inputs[name] = {
            usable: extracted.usable,
            reason: extracted.reason,
            value: extracted.usable ? extracted.value : null,
            candidate_id: extracted.candidate_id,
            selection_rule: extracted.selection_rule,
            candidates: extracted.reason === "unresolved" ? extracted.diagnostics : undefined
          };
          if (extracted.reason === "missing") missing.push(name);
          if (extracted.reason === "unresolved") unresolved.push(name);
          if (extracted.reason === "unsupported") unsupported.push(name);
          if (!extracted.usable) {
            components[name] = emptyComponent(name, extracted.reason, extracted);
            explanations.push(explanationFor(name, extracted, components[name]));
            return;
          }
          var baseLine = baselineFor(name, base, history, windows, dayWindowPointers, snapshotPointers);
          if (!baseLine.sufficient) {
            components[name] = emptyComponent(name, "insufficient_baseline", extracted);
            components[name].raw = extracted.value;
            components[name].candidate_id = extracted.candidate_id;
            explanations.push(explanationFor(name, extracted, components[name]));
            return;
          }
          var norm = normalizeComponent(name, extracted.value, baseLine.median);
          if (!norm) {
            components[name] = emptyComponent(name, "insufficient_baseline", extracted);
            components[name].raw = extracted.value;
            explanations.push(explanationFor(name, extracted, components[name]));
            return;
          }
          components[name] = {
            status: "usable",
            raw: extracted.value,
            baseline: baseLine.median,
            normalized: norm.relative,
            contribution: norm.contribution,
            weight: POLICY.weights[name],
            unit: UNIT_OF[name],
            selection_rule: extracted.selection_rule,
            candidate_id: extracted.candidate_id
          };
          usable.push(name);
          explanations.push(explanationFor(name, extracted, components[name]));
        });
        proprietaryNote(base).forEach(function (code) { explanations.push(code); });
        (base.quality_flags || []).forEach(function (flag) {
          if (FLAG_CODES[flag]) explanations.push(FLAG_CODES[flag]);
        });
        var score = null;
        var status;
        if (usable.length >= POLICY.min_components) {
          var num = 0;
          var den = 0;
          usable.forEach(function (name) {
            num += components[name].contribution * components[name].weight;
            den += components[name].weight;
          });
          score = den ? clamp(Math.round(num / den), POLICY.score_min, POLICY.score_max) : null;
          if (!Number.isFinite(score)) score = null;
          status = usable.length === CORE.length ? "ready" : "partial";
        } else if (unresolved.length) {
          status = "unresolved_evidence";
        } else {
          status = "insufficient_data";
        }
        var result = {
          document_type: POLICY.document_type,
          schema_version: POLICY.schema_version,
          policy_id: POLICY.policy_id,
          policy_version: POLICY.policy_version,
          user_id: base.user_id,
          day_window_id: base.day_window_id,
          snapshot_id: base.snapshot_id,
          snapshot_version: base.snapshot_version,
          computed_at_utc: input.computed_at_utc || null,
          status: status,
          score: score,
          components: components,
          inputs: inputs,
          missing: sortIds(missing),
          unresolved: sortIds(unresolved),
          unsupported: sortIds(unsupported),
          quality_flags: sortIds(base.quality_flags || []),
          explanation: sortIds(explanations),
          baseline_exclusions: selected.excluded
        };
        result.result_id = "rec:" + sha256Hex(semanticPayload(result)).slice(0, 32);
        return resultBase(OUTCOME.evaluated, { result: result });
      } catch (err) {
        if (err && OUTCOME[err.code]) {
          return resultBase(err.code, { reason: err.message, result: err.code === OUTCOME.invalid_snapshot ? { status: "invalid_snapshot", score: null } : null });
        }
        throw err;
      }
    }

    function evaluateCurrent(userId, dayWindowId, extra) {
      extra = extra || {};
      if (!snapshots || typeof snapshots.getCurrent !== "function") {
        return resultBase(OUTCOME.missing_snapshot, { result: null, reason: "G4B snapshot store is required." });
      }
      var snap = snapshots.getCurrent(userId, dayWindowId);
      if (!snap) return resultBase(OUTCOME.missing_snapshot, { result: null, pointer: snapshots.getCurrentPointer ? snapshots.getCurrentPointer(userId, dayWindowId) : null });
      extra.snapshot = snap;
      return evaluate(extra);
    }

    function validateResult(doc) {
      try {
        if (!doc || doc.document_type !== POLICY.document_type || doc.schema_version !== SCHEMA) {
          throw recErr(OUTCOME.invalid_snapshot, "recovery_result envelope is invalid.");
        }
        if (doc.policy_id !== POLICY.policy_id || doc.policy_version !== POLICY.policy_version) {
          throw recErr(OUTCOME.invalid_snapshot, "recovery_result policy does not match this engine.");
        }
        if (doc.score != null && (!Number.isFinite(doc.score) || doc.score < 0 || doc.score > 100)) {
          throw recErr(OUTCOME.invalid_snapshot, "score is out of bounds.");
        }
        return resultBase("ok", { result: clone(doc) });
      } catch (err) {
        return resultBase(err.code || OUTCOME.invalid_snapshot, { reason: err.message });
      }
    }

    function status() {
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.recovery",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        interprets_recovery: true,
        writes_app_recovery: false,
        snapshots: 0,
        snapshot_pointers: 0,
        observation_revisions: 0,
        activity_revisions: 0,
        day_windows: 0
      };
    }

    return {
      evaluate: evaluate,
      evaluateCurrent: evaluateCurrent,
      validateResult: validateResult,
      describePolicy: function () { return clone(POLICY); },
      buildBaseline: function (name, current, history, windows, extra) {
        extra = extra || {};
        return baselineFor(
          name,
          current,
          history || [],
          windows || [],
          extra.dayWindowPointers || extra.day_window_pointers || [],
          extra.snapshotPointers || extra.snapshot_pointers || []
        );
      },
      extractResolved: extractResolved,
      semanticSupported: semanticSupported,
      median: median,
      status: status,
      createRecovery: createRecovery,
      POLICY: POLICY,
      OUTCOME: OUTCOME
    };
  }

  var page = createRecovery();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.recovery = page;
  root.NXTFRMWearableRecovery = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
