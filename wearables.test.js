/* NXTFRM G3A focused tests. Run: node wearables.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = __dirname;
const APM_KEYS = [
  "apm_logs", "apm_cardio", "apm_floorball", "apm_bws", "apm_evo_scans", "apm_rest",
  "apm_current_read", "apm_current_gym", "apm_gyms", "apm_notifications",
  "apm_coach_insights", "apm_session_plans", "apm_exercise_notes", "apm_settings",
  "apm_last_open_date"
];

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("PASS  " + name);
  } catch (err) {
    failed += 1;
    console.error("FAIL  " + name);
    console.error("      " + (err && err.stack ? err.stack : String(err)));
  }
}

function fingerprint(store) {
  const keys = Object.keys(store).sort();
  const sig = {};
  keys.forEach(function (key) {
    const value = String(store[key] ?? "");
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    sig[key] = value.length + ":" + hash;
  });
  return { keys: keys, sig: sig };
}

function sameFingerprint(a, b) {
  assert.deepStrictEqual(a.keys, b.keys);
  assert.deepStrictEqual(a.sig, b.sig);
}

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStorage(seed) {
  const store = Object.assign({
    apm_bws: JSON.stringify([{ id: "w1", date: "2026-09-14", weight: 81.4, timeOfDay: "Morning" }]),
    apm_logs: "[]",
    apm_settings: "{}"
  }, seed || {});
  let writes = 0;
  const localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { writes += 1; store[key] = String(value); },
    removeItem: function (key) { writes += 1; delete store[key]; },
    clear: function () { writes += 1; Object.keys(store).forEach(function (key) { delete store[key]; }); },
    key: function (i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; }
  };
  return { store: store, writes: function () { return writes; }, localStorage: localStorage };
}

function denyNetwork(ctx) {
  function blocked(name) {
    return function () {
      ctx.__networkCalls = (ctx.__networkCalls || 0) + 1;
      throw new Error("network blocked: " + name);
    };
  }
  ctx.fetch = blocked("fetch");
  ctx.XMLHttpRequest = function () { blocked("xhr")(); };
  ctx.WebSocket = function () { blocked("ws")(); };
}

function loadWorld(options) {
  options = options || {};
  const storage = createStorage(options.storage);
  const ctx = {
    console: console,
    NXT: {},
    location: options.location || { hostname: "localhost", protocol: "http:" },
    localStorage: storage.localStorage,
    process: { env: options.env || {} },
    __networkCalls: 0
  };
  denyNetwork(ctx);
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.js"), "utf8"), ctx, { filename: "wearables.js" });
  if (options.loadFixtures !== false) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.fixtures.js"), "utf8"), ctx, { filename: "wearables.fixtures.js" });
  }
  return {
    ctx: ctx,
    storage: storage,
    wearables: ctx.NXT.wearables,
    factory: ctx.NXTFRMWearables,
    docs: (ctx.NXTFRM_G3A_FIXTURE_DOCS || []).slice()
  };
}

function field(snap, name) {
  return snap && snap[name] ? snap[name] : { candidates: [], primary_candidate_id: null, selection: {} };
}

function primaryOf(snap, name) {
  const sel = field(snap, name);
  return (sel.candidates || []).find(function (c) { return c.candidate_id === sel.primary_candidate_id; }) || null;
}

function syntaxCheck(rel) {
  new Function(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

test("syntax: existing and G3A scripts parse", function () {
  [
    "cut-support.js",
    "premium-ui.js",
    "seed.dev.js",
    "seed.scenarios.js",
    "sw.js",
    "wearables.js",
    "wearables.fixtures.js",
    "wearables.test.js"
  ].forEach(syntaxCheck);
});

test("1. valid date resolves through day-window and snapshot pointers", function () {
  const api = loadWorld().wearables;
  const window = api.getDayWindow("2026-09-14", { userId: "u_syn_a" });
  const snap = api.getDaily("2026-09-14", { userId: "u_syn_a" });
  assert.ok(window, "current UserDayWindow");
  assert.strictEqual(window.day_window_id, "dw_u_syn_a_2026-09-14");
  assert.strictEqual(window.local_date, "2026-09-14");
  assert.ok(snap, "current snapshot");
  assert.strictEqual(snap.document_type, "wearable_daily_snapshot");
  assert.strictEqual(snap.schema_version, "g1.2.1");
  assert.strictEqual(snap.snapshot_id, "snap_syn_a");
  assert.strictEqual(snap.day_window_id, window.day_window_id);
  assert.strictEqual(primaryOf(snap, "sleep_duration_s").value, 27000);
  assert.strictEqual(primaryOf(snap, "hrv").value, 48);
});

test("2. unknown date returns null", function () {
  const api = loadWorld().wearables;
  assert.strictEqual(api.getDaily("2020-01-01", { userId: "u_syn_a" }), null);
  assert.strictEqual(api.getDayWindow("2020-01-01", { userId: "u_syn_a" }), null);
  assert.strictEqual(api.getDaily("not-a-date", { userId: "u_syn_a" }), null);
  assert.strictEqual(api.getDaily("2026-09-31", { userId: "u_syn_a" }), null);
});

test("3. corrected snapshot resolves to the current leaf", function () {
  const api = loadWorld().wearables;
  const current = api.getDaily("2026-09-13", { userId: "u_syn_i" });
  const historical = api.getSnapshot("snap_syn_i_v1");
  assert.ok(current);
  assert.strictEqual(current.snapshot_id, "snap_syn_i_v2");
  assert.strictEqual(current.snapshot_version, 2);
  assert.strictEqual(current.supersedes_snapshot_id, "snap_syn_i_v1");
  assert.strictEqual(current.build_reason, "observation_correction");
  assert.ok(current.quality_flags.includes("corrected"));
  assert.strictEqual(primaryOf(current, "sleep_duration_s").candidate_id, "cand_sleep_u_syn_i_b");
  assert.strictEqual(primaryOf(current, "sleep_duration_s").value, 27600);
  assert.ok(historical);
  assert.strictEqual(historical.snapshot_id, "snap_syn_i_v1");
  assert.strictEqual(primaryOf(historical, "sleep_duration_s").value, 25000);
});

test("4. historical snapshot retains its pinned historical activity revision", function () {
  const world = loadWorld();
  const poisoned = world.factory.create({ mode: "test" });
  poisoned.useFixtureProvider(world.docs.concat([{
    document_type: "current_activity_pointer",
    schema_version: "g1.2.1",
    user_id: "u_syn_f",
    canonical_activity_id: "act_syn_strength",
    activity_revision_id: "arev_syn_str_NEWER_LIVE",
    advanced_at_utc: "2026-09-14T23:00:00Z",
    accepted_delivery_id: null
  }]), { mode: "test" });
  const snap = poisoned.getDaily("2026-09-14", { userId: "u_syn_f" });
  assert.ok(snap);
  const pin = (snap.overlapping_activities || []).find(function (p) { return p.canonical_activity_id === "act_syn_strength"; });
  assert.ok(pin);
  assert.strictEqual(pin.activity_revision_id, "arev_syn_str_1");
  const pinned = poisoned.getActivityRevision(pin.activity_revision_id);
  assert.ok(pinned);
  assert.strictEqual(pinned.provenance.identities.activity_revision_id, "arev_syn_str_1");
  assert.strictEqual(poisoned.getActivityRevision("arev_syn_str_NEWER_LIVE"), null);
  const resolved = poisoned.resolvePinnedActivities(snap);
  assert.strictEqual(resolved.length, 3);
  assert.deepStrictEqual(fromVm(resolved.map(function (r) { return r.provenance.identities.activity_revision_id; })).sort(), [
    "arev_syn_car_1", "arev_syn_fb_1", "arev_syn_str_1"
  ]);
});

test("5. travel dates resolve through explicit contiguous day windows", function () {
  const api = loadWorld().wearables;
  const d12 = api.getDayWindow("2026-09-12", { userId: "u_syn_h" });
  const d13 = api.getDayWindow("2026-09-13", { userId: "u_syn_h" });
  const d14 = api.getDayWindow("2026-09-14", { userId: "u_syn_h" });
  assert.ok(d12 && d13 && d14);
  assert.strictEqual(d12.end_utc, d13.start_utc);
  assert.strictEqual(d13.end_utc, d14.start_utc);
  assert.strictEqual(d13.assignment_source, "travel_override");
  assert.strictEqual(d14.representative_timezone, "Europe/Stockholm");
  const s13 = api.getDaily("2026-09-13", { userId: "u_syn_h" });
  const s14 = api.getDaily("2026-09-14", { userId: "u_syn_h" });
  assert.strictEqual(s13.snapshot_id, "snap_syn_h13");
  assert.strictEqual(s14.snapshot_id, "snap_syn_h14");
  assert.ok(s13.quality_flags.includes("timezone_change"));
  assert.ok(s14.quality_flags.includes("timezone_change"));
  assert.strictEqual(api.getDaily("2026-09-12", { userId: "u_syn_h" }), null);
});

test("6. missing and unsupported fields remain non-negative states", function () {
  const api = loadWorld().wearables;
  const noHrv = api.getDaily("2026-09-14", { userId: "u_syn_b" });
  const hrv = field(noHrv, "hrv");
  assert.strictEqual(hrv.primary_candidate_id, null);
  assert.strictEqual(hrv.selection.rule, "none_all_non_present");
  assert.strictEqual(hrv.candidates[0].availability, "unavailable");
  assert.strictEqual(hrv.candidates[0].value, null);
  assert.strictEqual(hrv.candidates[0].reason, "not_collected");
  assert.notStrictEqual(hrv.candidates[0].value, 0);

  const unsupported = api.getDaily("2026-09-14", { userId: "u_syn_d" });
  const energy = field(unsupported, "energy_reserve");
  assert.strictEqual(energy.primary_candidate_id, null);
  assert.strictEqual(energy.selection.rule, "none_all_non_present");
  assert.strictEqual(energy.candidates[0].availability, "unsupported");
  assert.strictEqual(energy.candidates[0].value, null);
  assert.strictEqual(energy.candidates[0].reason, "unsupported_by_source");

  const empty = api.getDaily("2026-09-14", { userId: "u_syn_l" });
  assert.strictEqual(field(empty, "sleep_duration_s").selection.rule, "none_empty");
  assert.strictEqual(field(empty, "sleep_duration_s").primary_candidate_id, null);
  assert.deepStrictEqual(fromVm(empty.quality_flags), []);
});

test("7. no cross-provider or cross-lineage primary is invented", function () {
  const world = loadWorld();
  const users = [
    ["2026-09-14", "u_syn_a"],
    ["2026-09-14", "u_syn_b"],
    ["2026-09-14", "u_syn_d"],
    ["2026-09-14", "u_syn_f"],
    ["2026-09-13", "u_syn_h"],
    ["2026-09-14", "u_syn_h"],
    ["2026-09-13", "u_syn_i"],
    ["2026-09-14", "u_syn_j"],
    ["2026-09-14", "u_syn_l"]
  ];
  const names = [
    "sleep_duration_s", "hrv", "resting_hr_bpm", "steps", "body_mass_kg",
    "body_fat_percent", "sleep_score", "stress", "energy_reserve"
  ];
  users.forEach(function (pair) {
    const snap = world.wearables.getDaily(pair[0], { userId: pair[1] });
    assert.ok(snap, pair.join(" "));
    names.forEach(function (name) {
      const sel = field(snap, name);
      const ids = (sel.candidates || []).map(function (c) { return c.candidate_id; });
      if (sel.primary_candidate_id != null) {
        assert.ok(ids.includes(sel.primary_candidate_id), name + " primary must already exist");
        const cand = primaryOf(snap, name);
        assert.ok(cand);
        if (String(sel.selection.rule || "").startsWith("none_")) {
          throw new Error(name + " invented a primary under " + sel.selection.rule);
        }
      } else {
        assert.ok(String(sel.selection.rule || "").startsWith("none_"), name + " empty primary needs a none_* rule");
      }
    });
  });
});

test("8. body mass stays a wearable candidate and does not alter weigh-ins", function () {
  const world = loadWorld();
  const before = world.storage.localStorage.getItem("apm_bws");
  const snap = world.wearables.getDaily("2026-09-14", { userId: "u_syn_j" });
  const mass = primaryOf(snap, "body_mass_kg");
  assert.ok(mass);
  assert.strictEqual(mass.availability, "present");
  assert.strictEqual(mass.value, 74.2);
  assert.strictEqual(mass.semantics.metric_kind, "body_mass");
  assert.strictEqual(world.storage.localStorage.getItem("apm_bws"), before);
  assert.strictEqual(world.storage.writes(), 0);
  const weighIns = JSON.parse(before);
  assert.strictEqual(weighIns[0].weight, 81.4);
  assert.notStrictEqual(weighIns[0].weight, mass.value);
});

test("9. fixture provider refuses production mode", function () {
  const world = loadWorld({ loadFixtures: false });
  const prod = world.factory.create({ mode: "production" });
  assert.strictEqual(prod.getDaily("2026-09-14", { userId: "u_syn_a" }), null);
  assert.strictEqual(prod.status().production_guard, "fixture_forbidden_in_production");
  assert.strictEqual(prod.status().ready, false);
  assert.throws(function () {
    prod.useFixtureProvider(world.docs, { mode: "production" });
  }, function (err) {
    return err && err.code === "fixture_forbidden_in_production";
  });
  const fresh = world.factory.create({ mode: "test" });
  assert.throws(function () {
    fresh.useFixtureProvider(world.docs, { mode: "production" });
  }, function (err) {
    return err && err.code === "fixture_forbidden_in_production";
  });
  const hosted = loadWorld({ loadFixtures: true, location: { hostname: "nxtfrm.app", protocol: "https:" } });
  assert.strictEqual(hosted.wearables.status().mode, "production");
  assert.strictEqual(hosted.wearables.getDaily("2026-09-14", { userId: "u_syn_a" }), null);
});

test("10. no network or real persistence occurs", function () {
  const world = loadWorld();
  world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" });
  world.wearables.getDaily("2026-09-13", { userId: "u_syn_i" });
  world.wearables.getActivityRevision("arev_syn_str_1");
  assert.strictEqual(world.ctx.__networkCalls, 0);
  assert.strictEqual(world.storage.writes(), 0);
  assert.strictEqual(world.wearables.status().network, false);
  assert.strictEqual(world.wearables.status().persists, false);
});

test("11. existing storage fingerprint remains unchanged", function () {
  const world = loadWorld();
  const before = fingerprint(world.storage.store);
  ["u_syn_a", "u_syn_b", "u_syn_d", "u_syn_f", "u_syn_j", "u_syn_l"].forEach(function (userId) {
    world.wearables.getDaily("2026-09-14", { userId: userId });
  });
  world.wearables.getDaily("2026-09-13", { userId: "u_syn_h" });
  world.wearables.getDaily("2026-09-13", { userId: "u_syn_i" });
  sameFingerprint(before, fingerprint(world.storage.store));
  APM_KEYS.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(world.storage.store, key)) {
      assert.ok(before.sig[key] === fingerprint(world.storage.store).sig[key]);
    }
  });
});

test("13. repeated reads are deterministic and do not mutate source documents", function () {
  const world = loadWorld();
  const source = world.docs.find(function (d) { return d.snapshot_id === "snap_syn_a"; });
  const sourceJson = JSON.stringify(source);
  const a = world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" });
  const b = world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" });
  assert.deepStrictEqual(fromVm(a), fromVm(b));
  a.sleep_duration_s.primary_candidate_id = "invented";
  a.sleep_duration_s.candidates[0].value = 1;
  a.quality_flags.push("conflict");
  const c = world.wearables.getDaily("2026-09-14", { userId: "u_syn_a" });
  assert.strictEqual(c.sleep_duration_s.primary_candidate_id, "cand_sleep_u_syn_a_1");
  assert.strictEqual(c.sleep_duration_s.candidates[0].value, 27000);
  assert.deepStrictEqual(fromVm(c.quality_flags), []);
  assert.strictEqual(JSON.stringify(source), sourceJson);
});

test("fixture subset covers the required G3A scenarios", function () {
  const world = loadWorld();
  const files = world.ctx.NXTFRM_G3A_FIXTURE_FILES;
  assert.ok(files.includes("expected/corpus/snap_complete_sleep.json"));
  assert.ok(files.includes("expected/corpus/snap_sleep_no_hrv.json"));
  assert.ok(files.includes("expected/corpus/snap_no_wearable.json"));
  assert.ok(files.includes("expected/corpus/snap_corr_v1.json"));
  assert.ok(files.includes("expected/corpus/snap_corr_v2.json"));
  assert.ok(files.includes("expected/corpus/snap_multi_activity.json"));
  assert.ok(files.includes("expected/corpus/snap_travel_13.json"));
  assert.ok(files.includes("expected/corpus/snap_body_mass.json"));
  assert.ok(files.includes("expected/corpus/snap_unsupported.json"));
  assert.ok(!world.docs.some(function (d) { return d.document_type === "ingest_diagnostic"; }));
  assert.ok(world.docs.every(function (d) {
    return !d.accepted_delivery_id;
  }));
});

test("ambiguous date without userId does not guess a cross-user primary", function () {
  const api = loadWorld().wearables;
  assert.strictEqual(api.getDaily("2026-09-14"), null);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
