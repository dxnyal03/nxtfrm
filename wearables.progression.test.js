/* NXTFRM progression rule (D24). Run: node wearables.progression.test.js

   Executes the real cue()/aimFor() from cut-support.js against fixed Leg Press
   histories (range 8-12, step 5 kg). D24 supersedes D20's "two consecutive
   sessions": going PAST the top of the range once is enough; exactly reaching
   it still needs a second session. Nothing is stored and no number changes
   meaning. The host double below is the one wearables.weight-contract.test.js uses. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed += 1; console.log("PASS  " + name); }
  catch (err) { failed += 1; console.log("FAIL  " + name); console.log("      " + (err && err.stack ? err.stack : err)); }
}

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
      /* Host helper from index.html, copied verbatim (it only builds a key). */
      sessionKey(type = fx.state.dayType, date = fx.state.date, gym = fx.state.gym) { return `${date}__${gym || "Gym"}__${type}`; },
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
const TODAY = "2026-09-30";
function sets(date, list) {
  return list.map(([weight, reps, rir], i) => ({
    id: date + "-" + i, date, exercise: "Leg Press", name: "Leg Press", gym: "Gym A", setType: "working",
    setNum: i + 1, weight, reps, rir: rir === undefined ? "" : rir
  }));
}
function engine(logs, recovery) {
  return loadNXT({ state: { date: TODAY, bws: [], logs, sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A" },
    settings: { cutSupport: { targetConfirmed: true, recovery: recovery || {} } }, targetLow: 80, targetHigh: 82 });
}

test("one session PAST the top of the range unlocks the next increment (130 x 13, range 8-12)", () => {
  const N = engine([...sets("2026-09-18", [[130, 11]]), ...sets("2026-09-25", [[130, 13]])]);
  const c = N.cue("Leg Press"), a = N.aimFor("Leg Press");
  assert.strictEqual(c.label, "Ready to consider an increase");
  assert.strictEqual(c.weight, 135);
  assert.strictEqual(a.kind, "load");
  assert.strictEqual(a.weight, 135);
});

test("exactly reaching the top once still holds, and says why", () => {
  const N = engine([...sets("2026-09-18", [[130, 11]]), ...sets("2026-09-25", [[130, 12]])]);
  const c = N.cue("Leg Press"), a = N.aimFor("Leg Press");
  assert.strictEqual(c.label, "Hold load · build clean reps");
  assert.strictEqual(c.weight, 130);
  assert.strictEqual(a.kind, "match");
  assert.strictEqual(a.why, "Top once · repeat to add");
});

test("two sessions exactly at the top still unlock (D20 behaviour kept)", () => {
  const N = engine([...sets("2026-09-18", [[130, 12]]), ...sets("2026-09-25", [[130, 12]])]);
  assert.strictEqual(N.cue("Leg Press").label, "Ready to consider an increase");
  assert.strictEqual(N.cue("Leg Press").weight, 135);
});

test("a tired check-in holds the load even after an overshoot", () => {
  const N = engine(sets("2026-09-25", [[130, 14]]), { [TODAY]: { energy: 2, soreness: 1 } });
  assert.strictEqual(N.cue("Leg Press").label, "Keep today manageable");
  assert.strictEqual(N.cue("Leg Press").weight, 130);
  assert.strictEqual(N.aimFor("Leg Press").why, "Tired today · hold");
});

test("logged reps in reserve under 2 still blocks the increase; unlogged never does", () => {
  const low = engine(sets("2026-09-25", [[130, 13, 1]]));
  assert.strictEqual(low.cue("Leg Press").weight, 130);
  assert.strictEqual(low.aimFor("Leg Press").why, "Low reserve · hold");
  const none = engine(sets("2026-09-25", [[130, 13]]));
  assert.strictEqual(none.cue("Leg Press").weight, 135);
});

test("a best set under the bottom of the range says to rebuild; the aim is one more rep", () => {
  const a = engine(sets("2026-09-25", [[130, 6]])).aimFor("Leg Press");
  assert.strictEqual(a.kind, "rep");
  assert.strictEqual(a.reps, 7);
  assert.strictEqual(a.why, "Under 8 · rebuild");
});

test("the session is judged by its heaviest set: a lighter overshoot does not unlock anything", () => {
  const N = engine(sets("2026-09-25", [[130, 14], [135, 8]]));
  assert.strictEqual(N.cue("Leg Press").weight, 135);
  assert.strictEqual(N.cue("Leg Press").label, "Hold load · build clean reps");
});

test("history over four weeks old still re-establishes the baseline", () => {
  assert.strictEqual(engine(sets("2026-08-01", [[130, 14]])).cue("Leg Press").label, "Re-establish your baseline");
});

console.log("\n" + (failed ? "FAILED " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
