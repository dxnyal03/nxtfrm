/* NXTFRM R2: recovery source integration contract.
 * In-memory only. Preserves manual check-in and R1 wearable recovery independently.
 * Does not score, coach, persist, pick snapshots, or render UI.
 */
"use strict";
(function (root) {
  var BOUNDARY = "r2.recovery_integration";
  var R1_POLICY_ID = "nxtfrm.recovery.personal_baseline";
  var R1_POLICY_VERSION = "1";
  var R1_DOCUMENT = "recovery_result";

  var POLICY = Object.freeze({
    policy_id: "nxtfrm.recovery.integration",
    policy_version: "1",
    document_type: "integrated_recovery",
    schema_version: "r2.1",
    integrated_score: null,
    blend: "none",
    date_alignment: "exact_local_date",
    availability: Object.freeze(["none", "manual_only", "wearable_only", "both"]),
    integrated_status: Object.freeze([
      "no_data",
      "manual_only",
      "wearable_only",
      "both_available",
      "wearable_partial",
      "wearable_unresolved",
      "wearable_insufficient",
      "date_mismatch",
      "invalid_wearable"
    ]),
    agreement: Object.freeze(["not_comparable", "broadly_consistent", "mixed", "conflicting"]),
    agreement_rules: Object.freeze({
      wearable_comparable_status: "ready",
      wearable_high_min: 70,
      wearable_low_max: 45,
      manual_low_energy_max: 2,
      manual_low_soreness_min: 4,
      manual_high_energy_min: 4,
      manual_high_soreness_max: 2,
      uses_manual_sleep: false,
      uses_soreness_as_wearable: false,
      note: "Energy and soreness are subjective manual evidence and are not equated to HRV or wearable readiness. Sleep hours are not used for agreement polarity."
    }),
    manual_readiness: Object.freeze({
      source: "index.html readiness() heuristic",
      rewritten: false
    })
  });

  var OUTCOME = Object.freeze({
    integrated: "integrated",
    date_mismatch: "date_mismatch",
    invalid_input: "invalid_input"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
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

  function recordedNumber(value) {
    if (value === "" || value === undefined || value === null) return null;
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function fieldPresent(value) {
    return recordedNumber(value) !== null;
  }

  function existingManualReadiness(record) {
    var s = Number(record.sleep);
    var e = Number(record.energy || 3);
    var sore = Number(record.soreness || 2);
    var score = 78;
    if (s) score += Math.min(10, Math.max(-18, (s - 6.5) * 7));
    score += (e - 3) * 6;
    score -= Math.max(0, sore - 2) * 8;
    score = Math.max(35, Math.min(96, Math.round(score)));
    var msg = score >= 80 ? "Ready" : score >= 65 ? "Manage fatigue" : "Go light";
    return { score: score, msg: msg, known: true };
  }

  function homeLabel(sleepHours, energy, soreness, present) {
    if (!present) return "Not logged";
    if ((energy !== null && energy <= 2) || (soreness !== null && soreness >= 4)) return "Review";
    if (energy !== null && energy >= 4) return "Good";
    return "Okay";
  }

  function adaptManual(record, localDate) {
    var src = record && typeof record === "object" ? record : {};
    var sleepHours = fieldPresent(src.sleep) ? recordedNumber(src.sleep) : null;
    var energy = fieldPresent(src.energy) ? recordedNumber(src.energy) : null;
    var soreness = fieldPresent(src.soreness) ? recordedNumber(src.soreness) : null;
    var date = isNonEmptyString(src.date) ? src.date : (localDate || null);
    var present = sleepHours !== null || energy !== null || soreness !== null;
    var readiness = present ? existingManualReadiness({
      sleep: sleepHours === null ? "" : sleepHours,
      energy: energy === null ? "" : energy,
      soreness: soreness === null ? "" : soreness
    }) : null;
    var identity = present
      ? "man:" + sha256Hex(JSON.stringify({ date: date, sleep: sleepHours, energy: energy, soreness: soreness })).slice(0, 32)
      : null;
    return {
      present: present,
      date: date,
      sleep_hours: sleepHours,
      energy: energy,
      soreness: soreness,
      readiness: readiness,
      home_label: homeLabel(sleepHours, energy, soreness, present),
      kind: "manual_check_in",
      record_ref: { date: date, record_id: identity }
    };
  }

  function unwrapWearable(input) {
    if (!input) return null;
    if (input.document_type === R1_DOCUMENT) return clone(input);
    if (input.result && input.result.document_type === R1_DOCUMENT) return clone(input.result);
    if (input.outcome === "invalid_snapshot") {
      return clone(input.result || { status: "invalid_snapshot", score: null });
    }
    return null;
  }

  function wearableEnvelope(doc) {
    if (!doc) {
      return {
        present: false,
        usable_score: false,
        status: null,
        score: null,
        result: null,
        invalid: false
      };
    }
    var invalid = doc.status === "invalid_snapshot" || doc.document_type && doc.document_type !== R1_DOCUMENT;
    if (doc.document_type && doc.document_type !== R1_DOCUMENT && doc.status !== "invalid_snapshot") {
      invalid = true;
    }
    var status = doc.status || null;
    var score = doc.score === undefined ? null : doc.score;
    if (score !== null && !Number.isFinite(score)) score = null;
    var usable = (status === "ready" || status === "partial") && score !== null;
    return {
      present: true,
      usable_score: usable,
      status: status,
      score: score,
      result: doc,
      invalid: invalid || status === "invalid_snapshot"
    };
  }

  function availabilityOf(manualPresent, wearablePresent) {
    if (manualPresent && wearablePresent) return "both";
    if (manualPresent) return "manual_only";
    if (wearablePresent) return "wearable_only";
    return "none";
  }

  function wearableStatusCode(wear) {
    if (!wear.present) return null;
    if (wear.invalid) return "invalid_wearable";
    if (wear.status === "partial") return "wearable_partial";
    if (wear.status === "unresolved_evidence") return "wearable_unresolved";
    if (wear.status === "insufficient_data") return "wearable_insufficient";
    if (wear.status === "invalid_snapshot") return "invalid_wearable";
    return null;
  }

  function integratedStatus(avail, wear, aligned) {
    if (!aligned) return "date_mismatch";
    if (avail === "none") return "no_data";
    var wearCode = wearableStatusCode(wear);
    if (wear.present && wearCode && wearCode !== "invalid_wearable") return wearCode;
    if (wear.present && wearCode === "invalid_wearable") return "invalid_wearable";
    if (avail === "both") return "both_available";
    if (avail === "manual_only") return "manual_only";
    return "wearable_only";
  }

  function manualPolarity(manual) {
    var rules = POLICY.agreement_rules;
    if (!manual.present) return null;
    if (manual.energy === null && manual.soreness === null) return null;
    var low = (manual.energy !== null && manual.energy <= rules.manual_low_energy_max)
      || (manual.soreness !== null && manual.soreness >= rules.manual_low_soreness_min);
    var high = manual.energy !== null
      && manual.energy >= rules.manual_high_energy_min
      && (manual.soreness === null || manual.soreness <= rules.manual_high_soreness_max);
    if (low && !high) return "low";
    if (high && !low) return "high";
    return null;
  }

  function wearablePolarity(wear) {
    var rules = POLICY.agreement_rules;
    if (!wear.present || wear.status !== rules.wearable_comparable_status || wear.score === null) return null;
    if (wear.score >= rules.wearable_high_min) return "high";
    if (wear.score <= rules.wearable_low_max) return "low";
    return "mid";
  }

  function classifyAgreement(manual, wear, aligned) {
    if (!aligned || !manual.present || !wear.present) return "not_comparable";
    var m = manualPolarity(manual);
    var w = wearablePolarity(wear);
    if (!m || !w) return "not_comparable";
    if (m === "high" && w === "high") return "broadly_consistent";
    if (m === "low" && w === "low") return "broadly_consistent";
    if ((m === "low" && w === "high") || (m === "high" && w === "low")) return "conflicting";
    return "mixed";
  }

  function semanticPayload(result) {
    return JSON.stringify({
      policy_id: result.policy_id,
      policy_version: result.policy_version,
      local_date: result.local_date,
      availability: result.availability,
      agreement: result.agreement,
      integrated_status: result.integrated_status,
      integrated_score: result.integrated_score,
      aligned: result.aligned,
      reasons: result.reasons,
      manual: {
        present: result.manual.present,
        date: result.manual.date,
        sleep_hours: result.manual.sleep_hours,
        energy: result.manual.energy,
        soreness: result.manual.soreness,
        readiness: result.manual.readiness,
        record_id: result.manual.record_ref ? result.manual.record_ref.record_id : null
      },
      wearable: result.wearable.present ? {
        result_id: result.wearable.result ? result.wearable.result.result_id : null,
        status: result.wearable.status,
        score: result.wearable.score,
        snapshot_id: result.wearable.result ? result.wearable.result.snapshot_id : null,
        snapshot_version: result.wearable.result ? result.wearable.result.snapshot_version : null,
        policy_id: result.wearable.result ? result.wearable.result.policy_id : null,
        policy_version: result.wearable.result ? result.wearable.result.policy_version : null
      } : null
    });
  }

  function createIntegration() {
    function integrate(input) {
      input = input || {};
      var localDate = input.local_date || input.localDate || null;
      if (!isNonEmptyString(localDate)) {
        return { outcome: OUTCOME.invalid_input, reason: "local_date is required.", result: null };
      }
      var manualIn = clone(input.manualRecovery || input.manual_recovery || null);
      var wearableIn = clone(input.wearableRecovery || input.wearable_recovery || null);
      var suppliedWearableDate = input.wearableLocalDate || input.wearable_local_date || null;
      var manual = adaptManual(manualIn, localDate);
      var wearableDoc = unwrapWearable(wearableIn);
      var wear = wearableEnvelope(wearableDoc);
      var reasons = [];
      if (!manual.present) reasons.push("manual_missing");
      if (!wear.present) reasons.push("wearable_missing");
      var wearableDate = suppliedWearableDate;
      if (wear.present && !isNonEmptyString(wearableDate)) {
        reasons.push("missing_wearable_local_date");
      }
      var manualDateMismatch = manual.present && isNonEmptyString(manual.date) && manual.date !== localDate;
      var wearableDateMismatch = wear.present && isNonEmptyString(wearableDate) && wearableDate !== localDate;
      var aligned = !manualDateMismatch && !wearableDateMismatch && !(wear.present && !isNonEmptyString(wearableDate));
      if (manualDateMismatch || wearableDateMismatch || (wear.present && !isNonEmptyString(wearableDate))) {
        reasons.push("date_mismatch");
      }
      if (wear.present && wear.status === "partial") reasons.push("wearable_partial");
      if (wear.present && wear.status === "unresolved_evidence") reasons.push("wearable_unresolved");
      if (wear.present && wear.status === "insufficient_data") reasons.push("wearable_insufficient");
      if (wear.present && wear.invalid) reasons.push("invalid_wearable");
      reasons.push("sources_preserved");
      reasons.push("no_integrated_score");
      var avail = availabilityOf(manual.present, wear.present);
      var agreement = classifyAgreement(manual, wear, aligned);
      if (agreement === "conflicting") reasons.push("agreement_conflicting");
      if (agreement === "broadly_consistent") reasons.push("agreement_broadly_consistent");
      if (agreement === "mixed") reasons.push("agreement_mixed");
      if (agreement === "not_comparable") reasons.push("agreement_not_comparable");
      var status = integratedStatus(avail, wear, aligned);
      var result = {
        document_type: POLICY.document_type,
        schema_version: POLICY.schema_version,
        policy_id: POLICY.policy_id,
        policy_version: POLICY.policy_version,
        user_id: input.user_id || input.userId || (wear.result && wear.result.user_id) || null,
        local_date: localDate,
        manual: manual,
        wearable: {
          present: wear.present,
          status: wear.status,
          score: wear.score,
          usable_score: wear.usable_score,
          partial: wear.status === "partial",
          unresolved: wear.status === "unresolved_evidence",
          insufficient: wear.status === "insufficient_data",
          invalid: wear.invalid,
          result: wear.result,
          local_date: wearableDate,
          day_window_id: wear.result ? wear.result.day_window_id || null : null,
          snapshot_id: wear.result ? wear.result.snapshot_id || null : null,
          snapshot_version: wear.result ? (wear.result.snapshot_version == null ? null : wear.result.snapshot_version) : null,
          result_id: wear.result ? wear.result.result_id || null : null,
          policy_id: wear.result ? wear.result.policy_id || null : null,
          policy_version: wear.result ? wear.result.policy_version || null : null
        },
        availability: avail,
        agreement: agreement,
        aligned: aligned,
        integrated_status: status,
        integrated_score: null,
        provenance: {
          integration_policy_id: POLICY.policy_id,
          integration_policy_version: POLICY.policy_version,
          manual_record_id: manual.record_ref.record_id,
          wearable_result_id: wear.result ? wear.result.result_id || null : null,
          wearable_snapshot_id: wear.result ? wear.result.snapshot_id || null : null,
          wearable_snapshot_version: wear.result ? (wear.result.snapshot_version == null ? null : wear.result.snapshot_version) : null,
          wearable_policy_id: wear.result ? wear.result.policy_id || null : null,
          wearable_policy_version: wear.result ? wear.result.policy_version || null : null
        },
        reasons: sortIds(reasons),
        source_snapshot: wear.result ? {
          snapshot_id: wear.result.snapshot_id || null,
          snapshot_version: wear.result.snapshot_version == null ? null : wear.result.snapshot_version,
          day_window_id: wear.result.day_window_id || null
        } : null,
        manual_record_ref: manual.record_ref,
        computed_at_utc: input.computed_at_utc || input.computedAtUtc || null
      };
      result.result_id = "int:" + sha256Hex(semanticPayload(result)).slice(0, 32);
      var outcome = aligned || !wear.present ? OUTCOME.integrated : OUTCOME.date_mismatch;
      if (manualDateMismatch && !wear.present) outcome = OUTCOME.date_mismatch;
      return { outcome: outcome, result: result };
    }

    function integrateForDate(localDate, extra) {
      extra = extra || {};
      extra.local_date = localDate;
      return integrate(extra);
    }

    function validateResult(doc) {
      if (!doc || doc.document_type !== POLICY.document_type || doc.schema_version !== POLICY.schema_version) {
        return { outcome: OUTCOME.invalid_input, reason: "integrated_recovery envelope is invalid." };
      }
      if (doc.policy_id !== POLICY.policy_id || doc.policy_version !== POLICY.policy_version) {
        return { outcome: OUTCOME.invalid_input, reason: "integration policy does not match this engine." };
      }
      if (doc.integrated_score !== null) {
        return { outcome: OUTCOME.invalid_input, reason: "v1 integrated_score must remain null." };
      }
      return { outcome: "ok", result: clone(doc) };
    }

    function status() {
      return {
        schema_version: POLICY.schema_version,
        api: "NXT.wearables.recoveryIntegration",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        interprets_recovery: false,
        writes_app_recovery: false,
        renders_ui: false,
        recomputes_r1: false,
        selects_snapshot: false,
        selects_day_window: false,
        blend: POLICY.blend
      };
    }

    return {
      integrate: integrate,
      integrateForDate: integrateForDate,
      validateResult: validateResult,
      describePolicy: function () { return clone(POLICY); },
      adaptManual: adaptManual,
      status: status,
      createIntegration: createIntegration,
      POLICY: POLICY,
      OUTCOME: OUTCOME,
      R1_POLICY_ID: R1_POLICY_ID,
      R1_POLICY_VERSION: R1_POLICY_VERSION
    };
  }

  var page = createIntegration();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.recoveryIntegration = page;
  root.NXTFRMWearableRecoveryIntegration = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
