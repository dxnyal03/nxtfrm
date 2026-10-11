/* NXTFRM training-activity contract. Run: node wearables.activity.test.js

   Characterization tests for NXT.activityWeeks() and NXT.activitySummary()
   (Progress › Training). They run the shipped cut-support.js against fixed
   rows and pin what it produces. The ledger must be a plain count or sum over
   stored records: no estimate, no score, and no zero invented for a week before
   tracking began. The host double below is the same one the weight contract
   uses; none of it participates in the figures. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("PASS  " + name);
  } catch (err) {
    failed += 1;
    console.log("FAIL  " + name);
    console.log("      " + (err && err.stack ? err.stack : err));
  }
}

/* ---- Minimal host double -------------------------------------------------
   cut-support.js is a browser script closing over globals defined in
   index.html. Supply just enough for the module to load; none of it
   participates in the statistics. */
function makeElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 420, height: 290, right: 420, bottom: 290 }; }
  };
}

const HOST_FNS = ["renderHistory", "renderFloorball", "apx96MoreSectionHTML", "getT", "readiness",
  "getFullBackup", "applyCloudPayload", "apx96OpenQueueManager", "openEditSet", "closeModal",
  "renderHome", "renderTrain", "renderWeight", "renderMore", "exerciseDefByName", "ensureSessionPlan",
  "setsDone", "safeSetsDone", "safeSuggestedWeight", "safeLastSet", "logSet", "apx96UndoLastSet",
  "completeDay", "cycleDayType", "renderRest", "apx96SaveReadiness", "suggestedRestSeconds",
  "weeklyLossRate", "weekStartString", "zone2MinutesThisWeek", "zone2MinutesThisWeekSafe",
  "projectedGoalDate", "estimatedTotalBurnToday", "apx95StrengthItems", "apx95Verdict",
  "apx95SetView", "enhancedRecoveryWarningHTML", "weeklyPlanHTML", "workoutTemplateSettingsHTML",
  "apx96SetMoreView", "restoreBackup", "v88OpenNoteModal", "apx95OpenQuickWeight",
  "apx95SaveQuickWeight", "saveEditedSet", "persist", "toast", "render", "uid", "save"];

const SRC = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8")
  /* `const NXT = ...` is a lexical binding and never lands on the vm global. */
  + "\n;globalThis.__NXT__ = NXT;\n";

function loadNXT(fx) {
  const discovered = {};
  const build = () => {
    const sandbox = {
      console,
      document: {
        getElementById() { return null; }, querySelector() { return null; },
        querySelectorAll() { return []; }, createElement() { return makeElement(); },
        addEventListener() {}, activeElement: null, readyState: "complete", title: ""
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_key, fallback) { return fallback; },
      /* Real, not a stub: chartHTML() pipes user copy through esc(), and a stub
         returning null would silently poison the markup we are asserting on. */
      esc(v) { return String(v === null || v === undefined ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
      state: fx.state,
      settings: fx.settings,
      /* initCloudFromStorage() runs at module load and reads this cluster of
         cloud globals. Seeded with real falsy values (not auto-stubs) so
         updateCloudSyncStatus takes its "not checked yet" branch and returns
         without touching the network or the DOM. None of it reaches the maths. */
      cloudSessionChecked: false,
      lastCloudError: null,
      cloudStatusText: "",
      cloudStatusTone: "",
      cloudUser: null,
      lastCloudSyncAt: null,
      cloudSyncAgo() { return ""; },
      TARGET_LOW: fx.targetLow,
      TARGET_HIGH: fx.targetHigh,
      goalLow() { return Math.min(Number(fx.targetLow) || 80, Number(fx.targetHigh) || 82); },
      goalHigh() { return Math.max(Number(fx.targetLow) || 80, Number(fx.targetHigh) || 82); }
    };
    sandbox.window = sandbox;
    for (const n of HOST_FNS) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox)) sandbox[n] = discovered[n];
    return sandbox;
  };

  /* install() and initCloudFromStorage() reach for more page globals than the
     statistics do. Stub each name the module asks for and retry, rather than
     hand-maintaining the list. Anything resolved this way is inert: it is an
     empty object, and no frozen calculation reads it. */
  for (let attempt = 0; attempt < 120; attempt++) {
    const ctx = vm.createContext(build());
    try {
      vm.runInContext(SRC, ctx, { filename: "cut-support.js" });
      return ctx.__NXT__;
    } catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss) throw err;
      discovered[miss[1]] = function () { return null; };
    }
  }
  throw new Error("cut-support.js did not load within the stub budget");
}

/* ---- Fixtures ------------------------------------------------------------ */
function fx(today, extra) {
  const logs = [
    /* week of 28 Sep: two lifting days, five working sets, one warm-up */
    { id: "a1", date: "2026-09-28", exercise: "Leg Press", gym: "Gym A", weight: 100, reps: 10, setNum: 1 },
    { id: "a2", date: "2026-09-28", exercise: "Leg Press", gym: "Gym A", weight: 100, reps: 10, setNum: 2 },
    { id: "a3", date: "2026-09-28", exercise: "Leg Press", gym: "Gym A", weight: 100, reps: 10, setNum: 3 },
    { id: "a4", date: "2026-09-30", exercise: "Lat Pulldown", gym: "Gym A", weight: 50, reps: 8, setNum: 1 },
    { id: "a5", date: "2026-09-30", exercise: "Lat Pulldown", gym: "Gym A", weight: 50, reps: 8, setNum: 2 },
    { id: "a6", date: "2026-10-01", exercise: "Lat Pulldown", gym: "Gym A", weight: 20, reps: 10, setNum: 1, setType: "warmup" },
    /* week of 21 Sep: one bodyweight set — a set, no tonnage */
    { id: "b1", date: "2026-09-22", exercise: "Ab Crunch", gym: "Gym A", weight: 0, reps: 12, setNum: 1 },
    /* current week */
    { id: "c1", date: "2026-10-06", exercise: "Leg Press", gym: "Gym A", weight: 60, reps: 5, setNum: 1 },
    /* a later day, only inside the window when today is past it */
    { id: "c2", date: "2026-10-09", exercise: "Leg Press", gym: "Gym A", weight: 60, reps: 5, setNum: 1 },
    /* malformed rows the engine already rejects */
    { id: "x1", date: "2026-10-06", exercise: "Leg Press", gym: "Gym A", weight: 60, reps: 0, setNum: 2 },
    { id: "x2", date: "not-a-date", exercise: "Leg Press", gym: "Gym A", weight: 60, reps: 5, setNum: 3 }
  ];
  const cardio = [
    { id: "k1", date: "2026-09-16", type: "Incline Walk", duration: 30 },
    { id: "k2", date: "2026-10-07", type: "Bike", duration: 20 },
    { id: "k3", date: "2026-10-07", type: "Bike", duration: "" }       /* no minutes: not a session */
  ];
  const floorball = [{ id: "f1", date: "2026-09-18", duration: 45 }];
  return Object.assign({
    state: { date: today, bws: [], logs, cardio, floorball, sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A" },
    settings: { cutSupport: {}, weeklyPlan: { 0: "Rest", 1: "FullA", 2: "Zone2", 3: "FullB", 4: "Zone2", 5: "FullC", 6: "Zone2" }, zone2WeeklyTarget: 30 },
    targetLow: 78, targetHigh: 80
  }, extra || {});
}

/* ---- activityWeeks ------------------------------------------------------- */
test("weeks before the first record are absent, not zero", function () {
  const N = loadNXT(fx("2026-10-11"));
  const w = N.activityWeeks(12);
  assert.strictEqual(w.length, 4, "12 asked, 4 returned: tracking started 16 Sep");
  assert.strictEqual(w[0].start, "2026-09-14");
  assert.strictEqual(w[0].end, "2026-09-20");
  assert.strictEqual(w[w.length - 1].start, "2026-10-05");
  assert.strictEqual(w[w.length - 1].current, true);
  assert.ok(w.slice(0, -1).every(x => x.current === false));
});

test("weeks are Mon–Sun and the current week is the last item", function () {
  const N = loadNXT(fx("2026-10-11"));
  const w = N.activityWeeks(12);
  for (const x of w) {
    assert.strictEqual(new Date(x.start + "T12:00:00Z").getUTCDay(), 1, "starts Monday");
    assert.strictEqual(new Date(x.end + "T12:00:00Z").getUTCDay(), 0, "ends Sunday");
  }
  assert.strictEqual(w[w.length - 1].daysElapsed, 7, "Sunday: the whole week has elapsed");
});

test("lifting days, working sets, tonnage and exercises are counts over working sets only", function () {
  const N = loadNXT(fx("2026-10-11"));
  const w = N.activityWeeks(12), sep28 = w.find(x => x.start === "2026-09-28");
  assert.deepStrictEqual(
    { liftDays: sep28.liftDays, sets: sep28.sets, tonnage: sep28.tonnage, exercises: sep28.exercises },
    { liftDays: 2, sets: 5, tonnage: 3800, exercises: 2 },
    "warm-up excluded; 3×100×10 + 2×50×8"
  );
});

test("a bodyweight set counts as a set and adds no tonnage", function () {
  const N = loadNXT(fx("2026-10-11"));
  const sep21 = N.activityWeeks(12).find(x => x.start === "2026-09-21");
  assert.strictEqual(sep21.sets, 1);
  assert.strictEqual(sep21.liftDays, 1);
  assert.strictEqual(sep21.tonnage, 0);
});

test("a week after tracking began with nothing lifted is a real zero", function () {
  const N = loadNXT(fx("2026-10-11"));
  const sep14 = N.activityWeeks(12).find(x => x.start === "2026-09-14");
  assert.strictEqual(sep14.liftDays, 0);
  assert.strictEqual(sep14.sets, 0);
  assert.strictEqual(sep14.tonnage, 0);
});

test("cardio minutes and sessions, floorball sessions, are summed per week", function () {
  const N = loadNXT(fx("2026-10-11"));
  const w = N.activityWeeks(12), sep14 = w.find(x => x.start === "2026-09-14"), cur = w[w.length - 1];
  assert.deepStrictEqual({ m: sep14.cardioMin, s: sep14.cardioSessions, f: sep14.floorSessions, fm: sep14.floorMin }, { m: 30, s: 1, f: 1, fm: 45 });
  assert.deepStrictEqual({ m: cur.cardioMin, s: cur.cardioSessions }, { m: 20, s: 1 }, "a cardio row with no minutes is not a session");
});

test("rows after today are excluded and the current week reports elapsed days", function () {
  const N = loadNXT(fx("2026-10-08"));
  const w = N.activityWeeks(12), cur = w[w.length - 1];
  assert.strictEqual(cur.start, "2026-10-05");
  assert.strictEqual(cur.daysElapsed, 4, "Mon–Thu");
  assert.strictEqual(cur.sets, 1, "the 9 Oct set is in the future");
  assert.strictEqual(cur.liftDays, 1);
  assert.strictEqual(cur.tonnage, 300);
});

test("malformed rows never reach the ledger", function () {
  const N = loadNXT(fx("2026-10-11"));
  const cur = N.activityWeeks(12).find(x => x.current);
  assert.strictEqual(cur.sets, 2, "6 Oct and 9 Oct; reps 0 and a bad date are dropped");
});

test("the window is honoured and clamped", function () {
  const N = loadNXT(fx("2026-10-11"));
  assert.strictEqual(N.activityWeeks(2).length, 2);
  assert.strictEqual(N.activityWeeks(2)[0].start, "2026-09-28");
  assert.strictEqual(N.activityWeeks(0).length, 4, "a nonsense window falls back to the 12-week default");
  assert.strictEqual(N.activityWeeks(999).length, 4, "capped at 104, then trimmed to tracked weeks");
});

test("with nothing recorded the ledger is empty", function () {
  const N = loadNXT(fx("2026-10-11", { state: { date: "2026-10-11", bws: [], logs: [], cardio: [], floorball: [], sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A" } }));
  assert.strictEqual(N.activityWeeks(12).length, 0);
  const s = N.activitySummary(N.activityWeeks(12));
  assert.strictEqual(s.weeks, 0);
  assert.strictEqual(s.avgSets, null, "no average without a full week");
});

/* ---- activitySummary ----------------------------------------------------- */
test("summary reads the current plan and cardio target, and counts weeks (never a percentage)", function () {
  const N = loadNXT(fx("2026-10-11"));
  const s = N.activitySummary(N.activityWeeks(12));
  assert.strictEqual(s.planLifts, 3, "FullA / FullB / FullC");
  assert.strictEqual(s.cardioTarget, 30);
  assert.strictEqual(s.fullWeeks, 3);
  assert.strictEqual(s.weeksAtPlan, 0, "no full week reached 3 lifting days");
  assert.strictEqual(s.weeksAtCardio, 1, "week of 14 Sep: 30 ≥ 30");
  assert.strictEqual(s.bestRun, 0);
  assert.deepStrictEqual(
    { d: s.totalLiftDays, sets: s.totalSets, t: s.totalTonnage, c: s.totalCardioMin, cs: s.totalCardioSessions },
    { d: 5, sets: 8, t: 4400, c: 50, cs: 2 },
    "totals include the current week"
  );
  assert.strictEqual(s.avgSets, 2, "full weeks only: (0 + 1 + 5) / 3");
  assert.strictEqual(s.avgLiftDays, 1);
  assert.strictEqual(s.avgCardioMin, 10);
  assert.ok(s.current && s.current.start === "2026-10-05");
  for (const k of Object.keys(s)) assert.ok(!/pct|percent|score/i.test(k), "no score or percentage field: " + k);
});

test("weeks at plan and the best run follow the plan's lifting-day count", function () {
  const one = loadNXT(fx("2026-10-11", { settings: { cutSupport: {}, weeklyPlan: { 0: "Rest", 1: "FullA", 2: "Rest", 3: "Rest", 4: "Rest", 5: "Rest", 6: "Rest" }, zone2WeeklyTarget: 30 } }));
  const s1 = one.activitySummary(one.activityWeeks(12));
  assert.strictEqual(s1.planLifts, 1);
  assert.strictEqual(s1.weeksAtPlan, 2, "21 Sep (1 day) and 28 Sep (2 days)");
  assert.strictEqual(s1.bestRun, 2, "consecutive");
  const none = loadNXT(fx("2026-10-11", { settings: { cutSupport: {}, weeklyPlan: { 0: "Rest", 1: "Rest", 2: "Rest", 3: "Rest", 4: "Rest", 5: "Rest", 6: "Rest" }, zone2WeeklyTarget: 30 } }));
  const s0 = none.activitySummary(none.activityWeeks(12));
  assert.strictEqual(s0.planLifts, 0);
  assert.strictEqual(s0.weeksAtPlan, null, "no plan, no verdict");
});

test("the ledger is read-only: nothing is persisted or mutated", function () {
  const f = fx("2026-10-11");
  const N = loadNXT(f);
  /* Snapshot after load: module install touches state.typingWeight, the ledger must not touch anything. */
  const before = JSON.stringify(f.state);
  N.activitySummary(N.activityWeeks(26));
  assert.strictEqual(JSON.stringify(f.state), before);
  const src = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const fn = src.slice(src.indexOf("function activityWeeks("), src.indexOf("function typeFor("));
  assert.ok(fn.indexOf("function activitySummary(") !== -1, "both functions sit inside the slice");
  assert.strictEqual(/persist\(|localStorage|save\(/.test(fn), false, "no write path");
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
