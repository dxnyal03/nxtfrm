/* NXTFRM G4C: frozen evidence selection / snapshot resolution policy.
 * In-memory only. Appends resolved versions to the G4B snapshot lineage.
 * Does not create revisions, compute recovery, or own a second current pointer.
 */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var BOUNDARY = "g4c.evidence_resolution";
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
    resolved: "resolved",
    reused: "reused",
    resolved_version: "resolved_version",
    pointer_set: "pointer_set",
    pointer_unchanged: "pointer_unchanged",
    missing_pointer: "missing_pointer",
    missing_snapshot: "missing_snapshot",
    invalid_snapshot: "invalid_snapshot",
    invalid_pointer: "invalid_pointer",
    invalid_day_window: "invalid_day_window"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function resErr(code, message, details) {
    var err = new Error(message);
    err.code = code;
    err.details = details == null ? null : details;
    return err;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function resultBase(outcome, extra) {
    var out = { outcome: outcome };
    var k;
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
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
    var cands = field.candidates || [];
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

  function sortCandidates(cands) {
    return (cands || []).slice().sort(function (a, b) {
      var ar = a.provenance && a.provenance.identities ? a.provenance.identities.revision_id : "";
      var br = b.provenance && b.provenance.identities ? b.provenance.identities.revision_id : "";
      if (ar < br) return -1;
      if (ar > br) return 1;
      var ac = a.candidate_id || "";
      var bc = b.candidate_id || "";
      if (ac < bc) return -1;
      if (ac > bc) return 1;
      return 0;
    });
  }

  function sortBouts(bouts) {
    return (bouts || []).slice().sort(function (a, b) {
      var as = a.semantics && a.semantics.interval_start_utc || "";
      var bs = b.semantics && b.semantics.interval_start_utc || "";
      if (as < bs) return -1;
      if (as > bs) return 1;
      var ar = a.provenance && a.provenance.identities ? a.provenance.identities.revision_id : "";
      var br = b.provenance && b.provenance.identities ? b.provenance.identities.revision_id : "";
      if (ar < br) return -1;
      if (ar > br) return 1;
      return 0;
    });
  }

  function freshnessAggregate(rows) {
    var syncs = (rows || []).map(function (s) { return s.last_successful_sync_at_utc; }).filter(Boolean);
    var news = (rows || []).map(function (s) { return s.newest_observation_at_utc; }).filter(Boolean);
    function maxIso(list) {
      return list.length ? list.reduce(function (a, b) { return a > b ? a : b; }) : null;
    }
    return {
      derivation_id: "freshness.aggregate.g1.2",
      derivation_version: "1",
      last_successful_sync_at_utc: maxIso(syncs),
      newest_observation_at_utc: maxIso(news)
    };
  }

  function derivedFlags(snap, window) {
    var flags = [];
    var seen = {};
    function add(name) {
      if (!seen[name]) { seen[name] = true; flags.push(name); }
    }
    function visit(c) {
      var ing = c.provenance && c.provenance.ingested_at_utc;
      if (ing && window && ing >= window.end_utc) add("late_arrival");
    }
    FIELD_NAMES.forEach(function (name) {
      (snap[name].candidates || []).forEach(visit);
      if (CONFLICT_RULES[snap[name].selection.rule]) add("conflict");
    });
    (snap.sleep_bouts || []).forEach(visit);
    if (snap.build_reason === "observation_correction" || snap.build_reason === "activity_correction") add("corrected");
    if ((snap.contributing_sources || []).length > 1) add("multi_source");
    if ((snap.contributing_sources || []).length) {
      var incomplete = FIELD_NAMES.some(function (name) {
        if (!CORE_FIELDS[name]) return false;
        if (snap[name].selection.rule === "none_empty") return true;
        if (snap[name].selection.rule === "none_all_non_present") {
          return snap[name].candidates.some(function (c) { return ABSENT[c.availability]; });
        }
        return false;
      });
      if (incomplete) add("partial_day");
    }
    if (window && window.assignment_source === "travel_override") add("timezone_change");
    flags.sort();
    return flags;
  }

  function resolutionSignature(snap) {
    return JSON.stringify({
      fields: FIELD_NAMES.map(function (name) {
        return {
          name: name,
          rule: snap[name].selection.rule,
          primary: snap[name].primary_candidate_id,
          policy: snap[name].selection.policy_id,
          policy_version: snap[name].selection.policy_version,
          revs: (snap[name].candidates || []).map(function (c) {
            return c.provenance && c.provenance.identities ? c.provenance.identities.revision_id : null;
          })
        };
      }),
      bouts: (snap.sleep_bouts || []).map(function (b) {
        return b.provenance && b.provenance.identities ? b.provenance.identities.revision_id : null;
      }),
      flags: (snap.quality_flags || []).slice().sort(),
      aggregate: snap.freshness_aggregate,
      freshness: snap.source_freshness,
      sources: (snap.contributing_sources || []).map(function (s) { return s.source_id; }),
      acts: snap.overlapping_activities,
      coverage: snap.activity_coverage
    });
  }

  function applyPolicy(input, window) {
    var snap = clone(input);
    if (Object.prototype.hasOwnProperty.call(snap, "sleep_assignment")) delete snap.sleep_assignment;
    if (Object.prototype.hasOwnProperty.call(snap, "primary_sleep")) delete snap.primary_sleep;
    if (Object.prototype.hasOwnProperty.call(snap, "is_current")) delete snap.is_current;
    if (snap.quality && Object.prototype.hasOwnProperty.call(snap.quality, "band")) delete snap.quality.band;
    FIELD_NAMES.forEach(function (name) {
      if (!snap[name] || !Array.isArray(snap[name].candidates)) {
        throw resErr(OUTCOME.invalid_snapshot, name + " field selection is required.");
      }
      snap[name].candidates = sortCandidates(snap[name].candidates);
      snap[name].candidates.forEach(function (c) {
        if (c.semantics && c.semantics.metric_kind !== FIELD_KIND[name]) {
          throw resErr(OUTCOME.invalid_snapshot, name + " candidate has wrong metric_kind.");
        }
      });
      applySelection(snap[name]);
    });
    snap.sleep_bouts = sortBouts(snap.sleep_bouts);
    snap.source_freshness = (snap.source_freshness || []).slice().sort(function (a, b) {
      if (a.source_id < b.source_id) return -1;
      if (a.source_id > b.source_id) return 1;
      return 0;
    });
    snap.freshness_aggregate = freshnessAggregate(snap.source_freshness);
    snap.quality_flags = derivedFlags(snap, window);
    return snap;
  }

  function validateEnvelope(doc) {
    if (!doc || doc.document_type !== "wearable_daily_snapshot" || doc.schema_version !== SCHEMA) {
      throw resErr(OUTCOME.invalid_snapshot, "DailySnapshot envelope is invalid.");
    }
    if (Object.prototype.hasOwnProperty.call(doc, "is_current")) {
      throw resErr(OUTCOME.invalid_snapshot, "DailySnapshot must not persist is_current.");
    }
    if (doc.sleep_assignment || doc.primary_sleep) {
      throw resErr(OUTCOME.invalid_snapshot, "Snapshot-wide sleep assignment is forbidden.");
    }
    if (doc.recovery || doc.readiness || (doc.quality && doc.quality.band)) {
      throw resErr(OUTCOME.invalid_snapshot, "Snapshot must not invent recovery/readiness/quality.band.");
    }
    if (!isNonEmptyString(doc.snapshot_id) || !isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.day_window_id)) {
      throw resErr(OUTCOME.invalid_snapshot, "Snapshot identity is incomplete.");
    }
    FIELD_NAMES.forEach(function (name) {
      var field = doc[name];
      if (!field || !Array.isArray(field.candidates) || !field.selection) {
        throw resErr(OUTCOME.invalid_snapshot, name + " field selection is required.");
      }
      if (field.selection.policy_id != null || field.selection.policy_version != null) {
        throw resErr(OUTCOME.invalid_snapshot, name + " policy must be null.");
      }
      if (field.selection.rule === "named_priority_policy") {
        throw resErr(OUTCOME.invalid_snapshot, "named_priority_policy is forbidden.");
      }
      var exp = expectedSelection(field);
      if (field.selection.rule !== exp.rule || field.primary_candidate_id !== exp.primary) {
        throw resErr(OUTCOME.invalid_snapshot, name + " selection does not match frozen algorithm.");
      }
    });
    if (doc.freshness_aggregate) {
      var expAgg = freshnessAggregate(doc.source_freshness || []);
      if (JSON.stringify(doc.freshness_aggregate) !== JSON.stringify(expAgg)) {
        throw resErr(OUTCOME.invalid_snapshot, "freshness_aggregate does not match frozen derivation.");
      }
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

  function createResolution(opts) {
    opts = opts || {};
    var snapshots = opts.snapshots || snapshotsApi();
    var days = opts.days || daysApi();
    var hooks = { failPointer: false, failBeforeCommit: false };

    function getSnap(id) {
      if (!snapshots || typeof snapshots.getSnapshot !== "function") return null;
      var doc = snapshots.getSnapshot(id);
      return doc ? clone(doc) : null;
    }

    function canonicalCurrent(userId, dayWindowId) {
      if (!snapshots || typeof snapshots.getCurrent !== "function") return null;
      var doc = snapshots.getCurrent(userId, dayWindowId);
      return doc ? clone(doc) : null;
    }

    function canonicalPointer(userId, dayWindowId) {
      if (!snapshots || typeof snapshots.getCurrentPointer !== "function") return null;
      var doc = snapshots.getCurrentPointer(userId, dayWindowId);
      return doc ? clone(doc) : null;
    }

    function loadWindow(snap) {
      if (!days || typeof days.getWindow !== "function") {
        throw resErr(OUTCOME.invalid_day_window, "G4A day-window store is required.");
      }
      var window = days.getWindow(snap.day_window_id);
      if (!window) throw resErr(OUTCOME.invalid_day_window, "day window does not exist.");
      if (window.user_id !== snap.user_id) throw resErr(OUTCOME.invalid_day_window, "day window user mismatch.");
      return window;
    }

    function resolve(input) {
      input = input || {};
      try {
        if (hooks.failBeforeCommit) {
          hooks.failBeforeCommit = false;
          throw resErr(OUTCOME.invalid_snapshot, "Forced pre-commit failure.");
        }
        if (!snapshots || typeof snapshots.appendVersion !== "function") {
          throw resErr(OUTCOME.invalid_snapshot, "G4B snapshot store with appendVersion is required.");
        }
        var proposed = !!input.snapshot;
        var base = proposed ? clone(input.snapshot) : getSnap(input.snapshot_id);
        if (!base) throw resErr(OUTCOME.missing_snapshot, "snapshot does not exist.");
        if (base.document_type !== "wearable_daily_snapshot") {
          throw resErr(OUTCOME.invalid_snapshot, "DailySnapshot envelope is invalid.");
        }
        var window = loadWindow(base);
        var current = canonicalCurrent(base.user_id, base.day_window_id);
        if (!proposed && current && current.snapshot_id !== base.snapshot_id) {
          base = current;
        }
        var resolved = applyPolicy(base, window);
        resolved.build_reason = base.build_reason;
        resolved.quality_flags = derivedFlags(resolved, window);
        var sig = resolutionSignature(resolved);
        var prior = current;
        if (prior && resolutionSignature(prior) === sig) {
          return resultBase(OUTCOME.reused, {
            snapshot_id: prior.snapshot_id,
            snapshot_version: prior.snapshot_version,
            snapshot: clone(prior),
            pointer: canonicalPointer(prior.user_id, prior.day_window_id)
          });
        }
        if (!prior) {
          throw resErr(OUTCOME.missing_pointer, "canonical current snapshot pointer is missing.");
        }
        resolved.build_reason = "rebuild";
        resolved.quality_flags = derivedFlags(resolved, window);
        resolved.built_at_utc = input.built_at_utc || base.built_at_utc;
        validateEnvelope(resolved);
        if (hooks.failPointer) {
          hooks.failPointer = false;
          if (snapshots._test && typeof snapshots._test.failNextPointer === "function") {
            snapshots._test.failNextPointer();
          }
        }
        var appended = snapshots.appendVersion({
          snapshot: resolved,
          built_at_utc: resolved.built_at_utc,
          advanced_at_utc: input.advanced_at_utc || resolved.built_at_utc,
          accepted_delivery_id: input.accepted_delivery_id
        });
        if (appended.outcome !== "appended_version") {
          return resultBase(appended.outcome, {
            reason: appended.reason,
            snapshot: null,
            pointer: canonicalPointer(prior.user_id, prior.day_window_id)
          });
        }
        return resultBase(OUTCOME.resolved_version, {
          snapshot_id: appended.snapshot_id,
          snapshot_version: appended.snapshot_version,
          snapshot: appended.snapshot,
          pointer: appended.pointer
        });
      } catch (err) {
        if (err && OUTCOME[err.code]) return resultBase(err.code, { reason: err.message });
        throw err;
      }
    }

    function resolveSnapshot(snapshotId, extra) {
      extra = extra || {};
      extra.snapshot_id = snapshotId;
      delete extra.snapshot;
      return resolve(extra);
    }

    function resolveCurrent(userId, dayWindowId, extra) {
      extra = extra || {};
      var cur = canonicalCurrent(userId, dayWindowId);
      if (!cur) return resultBase(OUTCOME.missing_pointer, { snapshot: null, pointer: null });
      extra.snapshot_id = cur.snapshot_id;
      delete extra.snapshot;
      return resolve(extra);
    }

    function setCurrent(userId, dayWindowId, snapshotId, snapshotVersion, advancedAtUtc) {
      if (!snapshots || typeof snapshots.setCurrent !== "function") {
        return resultBase(OUTCOME.invalid_pointer, { reason: "G4B snapshot store is required." });
      }
      return snapshots.setCurrent(userId, dayWindowId, snapshotId, snapshotVersion, advancedAtUtc);
    }

    function status() {
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.resolution",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        interprets_recovery: false,
        snapshots: 0,
        snapshot_pointers: 0,
        observation_revisions: 0,
        activity_revisions: 0,
        day_windows: 0
      };
    }

    return {
      resolve: resolve,
      resolveSnapshot: resolveSnapshot,
      resolveCurrent: resolveCurrent,
      getSnapshot: getSnap,
      listSnapshots: function (userId, dayWindowId) {
        if (!snapshots || typeof snapshots.listSnapshots !== "function") return [];
        return clone(snapshots.listSnapshots(userId, dayWindowId));
      },
      getCurrent: function (userId, dayWindowId) {
        return canonicalCurrent(userId, dayWindowId);
      },
      getCurrentPointer: function (userId, dayWindowId) {
        return canonicalPointer(userId, dayWindowId);
      },
      setCurrent: setCurrent,
      validateResolution: function (doc, window) {
        try {
          var applied = applyPolicy(clone(doc), window);
          applied.build_reason = doc.build_reason;
          applied.quality_flags = derivedFlags(applied, window);
          validateEnvelope(applied);
          return resultBase("ok", { snapshot: clone(applied) });
        } catch (err) {
          return resultBase(err.code || OUTCOME.invalid_snapshot, { reason: err.message });
        }
      },
      expectedSelection: expectedSelection,
      freshnessAggregate: freshnessAggregate,
      semanticIdentity: semanticIdentity,
      status: status,
      createResolution: createResolution,
      OUTCOME: OUTCOME,
      _test: {
        failNextPointer: function () { hooks.failPointer = true; },
        failBeforeCommit: function () { hooks.failBeforeCommit = true; },
        clearHooks: function () { hooks.failPointer = false; hooks.failBeforeCommit = false; }
      }
    };
  }

  var page = createResolution();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.resolution = page;
  root.NXTFRMWearableResolution = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
