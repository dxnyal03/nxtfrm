/* NXTFRM R4: training recovery-guard contract.
 * In-memory only. Consumes R2 integrated recovery. Does not score, persist, or mutate workouts.
 */
"use strict";
(function (root) {
  var BOUNDARY = "r4.training_recovery_guard";

  var POLICY = Object.freeze({
    policy_id: "nxtfrm.training.recovery_guard",
    policy_version: "1",
    document_type: "training_recovery_guidance",
    schema_version: "r4.1",
    states: Object.freeze([
      "no_recovery_signal",
      "proceed",
      "proceed_with_caution",
      "reduce_intensity",
      "recovery_focus",
      "manual_review_required"
    ]),
    wearable_high_min: 70,
    wearable_low_max: 44,
    manual_soreness_severe: 5,
    manual_soreness_high: 4,
    manual_energy_low_max: 2,
    manual_energy_supportive_min: 4,
    first_match: Object.freeze([
      "manual_soreness >= 5 → recovery_focus",
      "manual_soreness >= 4 → reduce_intensity",
      "aligned wearable unresolved → manual_review_required",
      "aligned wearable score < 45 → reduce_intensity",
      "manual energy <= 2 → proceed_with_caution",
      "aligned wearable 45–69 → proceed_with_caution",
      "aligned wearable >= 70 and partial → proceed_with_caution",
      "aligned wearable >= 70 and ready → proceed",
      "manual energy >= 4 → proceed",
      "other manual present → proceed_with_caution",
      "else → no_recovery_signal"
    ]),
    date_mismatch_excludes_wearable: true,
    mutates_workout: false,
    blend: "none"
  });

  var OUTCOME = Object.freeze({
    advised: "advised",
    invalid_input: "invalid_input"
  });

  var GUIDE = Object.freeze({
    no_recovery_signal: { message: "Limited recovery data", detail: null },
    proceed: { message: "Proceed as planned", detail: null },
    proceed_with_caution: { message: "Proceed with caution", detail: null },
    reduce_intensity: { message: "Reduce intensity today", detail: null },
    recovery_focus: { message: "Recovery-focused day", detail: "High soreness reported" },
    manual_review_required: { message: "Wearable data needs review", detail: null }
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function sortIds(list) {
    return (list || []).slice().sort();
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

  function wearableUsableForTraining(r2) {
    if (!r2 || r2.aligned === false || r2.integrated_status === "date_mismatch") return false;
    var w = r2.wearable;
    if (!w || !w.present || w.invalid) return false;
    return true;
  }

  function wearableNumeric(r2) {
    if (!wearableUsableForTraining(r2)) return null;
    var w = r2.wearable;
    if (w.status !== "ready" && w.status !== "partial") return null;
    if (w.score === null || !Number.isFinite(w.score)) return null;
    return w.score;
  }

  function decide(r2) {
    var manual = r2 && r2.manual && r2.manual.present ? r2.manual : null;
    var wearOk = wearableUsableForTraining(r2);
    var wear = wearOk ? r2.wearable : null;
    var score = wearableNumeric(r2);
    var reasons = [];
    var coverage = "none";
    var state;

    if (manual && manual.soreness !== null && manual.soreness >= POLICY.manual_soreness_severe) {
      state = "recovery_focus";
      reasons.push("manual_soreness_severe");
      coverage = "manual";
    } else if (manual && manual.soreness !== null && manual.soreness >= POLICY.manual_soreness_high) {
      state = "reduce_intensity";
      reasons.push("manual_soreness_high");
      coverage = "manual";
    } else if (wear && wear.status === "unresolved_evidence") {
      state = "manual_review_required";
      reasons.push("wearable_unresolved");
      coverage = "limited";
    } else if (score !== null && score < 45) {
      state = "reduce_intensity";
      reasons.push("wearable_low");
      coverage = wear.status === "partial" ? "partial" : "wearable";
    } else if (manual && manual.energy !== null && manual.energy <= POLICY.manual_energy_low_max) {
      state = "proceed_with_caution";
      reasons.push("manual_energy_low");
      coverage = score !== null ? (wear.status === "partial" ? "partial" : "both") : "manual";
    } else if (score !== null && score < POLICY.wearable_high_min) {
      state = "proceed_with_caution";
      reasons.push("wearable_mid");
      coverage = wear.status === "partial" ? "partial" : "wearable";
    } else if (score !== null && score >= POLICY.wearable_high_min && wear.status === "partial") {
      state = "proceed_with_caution";
      reasons.push("wearable_high_partial");
      coverage = "partial";
    } else if (score !== null && score >= POLICY.wearable_high_min && wear.status === "ready") {
      state = "proceed";
      reasons.push("wearable_high");
      coverage = manual ? "both" : "wearable";
    } else if (manual && manual.energy !== null && manual.energy >= POLICY.manual_energy_supportive_min) {
      state = "proceed";
      reasons.push("manual_supportive");
      coverage = "manual";
    } else if (manual) {
      state = "proceed_with_caution";
      reasons.push("manual_present");
      coverage = "manual";
    } else {
      state = "no_recovery_signal";
      reasons.push("no_sources");
      coverage = "none";
    }

    if (wear && wear.status === "partial" && score !== null) reasons.push("wearable_partial_coverage");
    if (r2 && r2.integrated_status === "date_mismatch") reasons.push("date_mismatch_excludes_wearable");
    if (r2 && r2.wearable && r2.wearable.status === "insufficient_data") reasons.push("wearable_insufficient_fallback");

    var guide = GUIDE[state];
    var detail = guide.detail;
    if (state === "reduce_intensity" && reasons.indexOf("manual_soreness_high") !== -1) detail = "High soreness reported";
    if (state === "reduce_intensity" && reasons.indexOf("wearable_low") !== -1) detail = "Wearable recovery is below usual";
    if (state === "proceed_with_caution" && reasons.indexOf("manual_energy_low") !== -1) detail = "Low energy reported";
    if (state === "proceed_with_caution" && reasons.indexOf("wearable_high_partial") !== -1) detail = "Partial wearable data";

    return {
      state: state,
      reasons: sortIds(reasons),
      coverage: coverage,
      guidance: {
        title: "Recovery guidance",
        message: guide.message,
        detail: detail
      }
    };
  }

  function presentWearable(r2) {
    var empty = {
      has_score: false,
      score: null,
      headline: null,
      caption: "No wearable data",
      status_note: null
    };
    if (!r2 || !r2.wearable || !r2.wearable.present) return empty;
    if (r2.aligned === false || r2.integrated_status === "date_mismatch") {
      return {
        has_score: false,
        score: null,
        headline: null,
        caption: "Wearable data is for another day",
        status_note: null
      };
    }
    var w = r2.wearable;
    if (w.status === "unresolved_evidence") {
      return {
        has_score: false,
        score: null,
        headline: null,
        caption: "Wearable data needs review",
        status_note: null
      };
    }
    if (w.status === "insufficient_data" || w.score === null || !Number.isFinite(w.score)) {
      return {
        has_score: false,
        score: null,
        headline: null,
        caption: "Not enough wearable history",
        status_note: null
      };
    }
    if (w.status === "ready" || w.status === "partial") {
      return {
        has_score: true,
        score: w.score,
        headline: String(Math.round(w.score)),
        caption: "Based on HRV, resting HR and sleep",
        status_note: w.status === "partial" ? "Partial data" : null
      };
    }
    return empty;
  }

  function presentCheckin(r2) {
    var manual = r2 && r2.manual ? r2.manual : { present: false };
    var parts = [];
    if (manual.energy !== null && manual.energy !== undefined) parts.push("Energy " + manual.energy);
    if (manual.soreness !== null && manual.soreness !== undefined) parts.push("Soreness " + manual.soreness);
    return {
      present: !!manual.present,
      label: manual.home_label || (manual.present ? "Okay" : "Not logged"),
      detail: parts.length ? parts.join(" · ") : (manual.present ? "Check-in recorded" : "No check-in today")
    };
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return null;
    var total = Math.round(seconds / 60);
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    return m + "m";
  }

  function describeSignals(r2) {
    var out = [];
    var wear = r2 && r2.wearable && r2.wearable.result;
    if (!wear || !r2.aligned || r2.integrated_status === "date_mismatch") return out;
    var map = [
      { key: "hrv", label: "HRV", unit: "ms" },
      { key: "resting_hr", label: "Resting HR", unit: "bpm" },
      { key: "sleep", label: "Sleep", unit: "s" }
    ];
    map.forEach(function (item) {
      var c = wear.components && wear.components[item.key];
      if (!c) return;
      if (c.status === "unresolved") {
        out.push({
          name: item.label,
          value: null,
          trend: "unavailable due to conflicting wearable data",
          selected: false
        });
        return;
      }
      if (c.status !== "usable" || !Number.isFinite(c.raw) || !Number.isFinite(c.baseline) || c.baseline === 0) return;
      var value;
      var trend;
      if (item.key === "sleep") {
        value = formatDuration(c.raw);
        var deltaMin = Math.round((c.raw - c.baseline) / 60);
        if (deltaMin > 0) trend = deltaMin + "m above baseline";
        else if (deltaMin < 0) trend = Math.abs(deltaMin) + "m below baseline";
        else trend = "On personal baseline";
      } else if (item.key === "resting_hr") {
        value = String(c.raw) + " " + item.unit;
        var bpm = Math.round(c.baseline - c.raw);
        if (bpm > 0) trend = bpm + " bpm below baseline";
        else if (bpm < 0) trend = Math.abs(bpm) + " bpm above baseline";
        else trend = "On baseline";
      } else {
        value = String(c.raw) + " " + item.unit;
        var pct = Math.round(((c.raw - c.baseline) / c.baseline) * 100);
        if (pct > 0) trend = "+" + pct + "% vs baseline";
        else if (pct < 0) trend = pct + "% vs baseline";
        else trend = "On baseline";
      }
      out.push({ name: item.label, value: value, trend: trend, selected: true });
    });
    return out;
  }

  function semanticPayload(result) {
    return JSON.stringify({
      policy_id: result.policy_id,
      policy_version: result.policy_version,
      state: result.state,
      reasons: result.reasons,
      coverage: result.coverage,
      local_date: result.local_date,
      source_summary: result.source_summary,
      integrated_result_id: result.integrated_result_id
    });
  }

  function createGuard() {
    function advise(input) {
      input = input || {};
      var r2 = clone(input.integratedRecovery || input.integrated_recovery || input.result || null);
      if (r2 && r2.result && r2.result.document_type === "integrated_recovery") r2 = r2.result;
      if (!r2 || r2.document_type !== "integrated_recovery") {
        return { outcome: OUTCOME.invalid_input, reason: "integrated_recovery result is required.", result: null };
      }
      var decided = decide(r2);
      var wearableView = presentWearable(r2);
      var checkinView = presentCheckin(r2);
      var result = {
        document_type: POLICY.document_type,
        schema_version: POLICY.schema_version,
        policy_id: POLICY.policy_id,
        policy_version: POLICY.policy_version,
        local_date: r2.local_date || null,
        state: decided.state,
        reasons: decided.reasons,
        coverage: decided.coverage,
        confidence: decided.coverage === "none" ? "none" : (decided.coverage === "partial" || decided.coverage === "limited" ? "limited" : "high"),
        guidance: decided.guidance,
        source_summary: {
          wearable: wearableView,
          checkin: checkinView,
          availability: r2.availability,
          agreement: r2.agreement,
          integrated_status: r2.integrated_status,
          integrated_score: null
        },
        signals: describeSignals(r2),
        integrated_result_id: r2.result_id || null,
        mutates_workout: false,
        computed_at_utc: input.computed_at_utc || input.computedAtUtc || null
      };
      result.guidance_id = "trg:" + sha256Hex(semanticPayload(result)).slice(0, 32);
      return { outcome: OUTCOME.advised, result: result };
    }

    function status() {
      return {
        schema_version: POLICY.schema_version,
        api: "NXT.wearables.trainingReadiness",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        writes_app_recovery: false,
        mutates_workout: false,
        reads_raw_wearable: false,
        selects_snapshot: false,
        blend: "none"
      };
    }

    return {
      advise: advise,
      presentWearable: presentWearable,
      presentCheckin: presentCheckin,
      describeSignals: describeSignals,
      describePolicy: function () { return clone(POLICY); },
      validateResult: function (doc) {
        if (!doc || doc.document_type !== POLICY.document_type || doc.policy_id !== POLICY.policy_id) {
          return { outcome: OUTCOME.invalid_input, reason: "training guidance envelope is invalid." };
        }
        return { outcome: "ok", result: clone(doc) };
      },
      status: status,
      createGuard: createGuard,
      POLICY: POLICY,
      OUTCOME: OUTCOME
    };
  }

  var page = createGuard();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.trainingReadiness = page;
  root.NXTFRMWearableTrainingReadiness = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
