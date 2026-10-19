/* NXTFRM day-state contract (proposed D105). Run: node wearables.day-state.test.js

   Loads the SHIPPED cut-support.js, coach.js and premium-ui.js into one vm context, the way the page does, and
   reads NXP.dayState(): the one presentation read every day surface uses (the Today rail and tile, Train's idle
   card, the live dock, the History day card and calendar, the week sheet). Pins the contract: activity recorded,
   in progress, planned sets complete and workout finished are four different facts; warm-ups never count; the
   planned-set count is the Today ring's (capped per exercise); the Finish record is optional evidence that may
   lift the word, never what counted; the coach's status (its half-plan threshold) passes through unchanged; and
   the read writes nothing. The calendar is fixed: "today" is Wednesday 21 Oct 2026 unless a test moves it, and
   the plan is the engine's A/B/C split (Mon Full A, Wed Full B, Fri Full C, Tue/Thu/Sat Easy cardio, Sun Rest). */
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

/* ---- Host double ------------------------------------------------------------
   index.html's own day-plan helpers (as in the coach suite); persist and render only count, so a test can
   prove the read wrote nothing. */
const PRELUDE = `
const PLAN={1:{type:"FullA"},2:{type:"Zone2"},3:{type:"FullB"},4:{type:"Zone2"},5:{type:"FullC"},6:{type:"Zone2"},0:{type:"Rest"}};
const TEMPLATES={};
function dayOfWeekFor(date){const ms=Date.parse(String(date)+"T12:00:00");return Number.isFinite(ms)?new Date(ms).getDay():new Date().getDay();}
function planTypeForDow(dow){return (settings.weeklyPlan&&settings.weeklyPlan[dow])||(PLAN[dow]&&PLAN[dow].type)||"Rest";}
function resolveDayType(date){const key=date||(typeof state==="object"&&state?state.date:null);if(!key)return "Rest";const override=settings.dayOverrides&&settings.dayOverrides[key];if(override)return override;return planTypeForDow(dayOfWeekFor(key));}
function sessionKey(type=state.dayType,date=state.date,gym=state.gym){return \`\${date}__\${gym||"Gym"}__\${type}\`;}
function getT(n){return Object.values(TEMPLATES).flat().find(e=>e.name===n)}
function persist(){__io.persist++;}
function save(k,v){__io.save++;}
function toast(m){}
function render(){__io.render++;}
function closeModal(){}
function uid(){return "u"+(++__io.uid);}
`;
const PRELUDE_NAMES = new Set(["PLAN", "TEMPLATES", "dayOfWeekFor", "planTypeForDow", "resolveDayType", "sessionKey",
  "getT", "persist", "save", "toast", "render", "closeModal", "uid"]);
const HOST_FNS = ["renderHistory", "renderFloorball", "apx96MoreSectionHTML", "readiness",
  "getFullBackup", "applyCloudPayload", "apx96OpenQueueManager", "openEditSet",
  "renderHome", "renderTrain", "renderWeight", "renderMore", "exerciseDefByName", "ensureSessionPlan",
  "setsDone", "safeSetsDone", "safeSuggestedWeight", "safeLastSet", "logSet", "apx96UndoLastSet",
  "completeDay", "cycleDayType", "renderRest", "apx96SaveReadiness", "suggestedRestSeconds",
  "weeklyLossRate", "weekStartString", "zone2MinutesThisWeek", "zone2MinutesThisWeekSafe",
  "projectedGoalDate", "estimatedTotalBurnToday", "apx95StrengthItems", "apx95Verdict",
  "apx95SetView", "enhancedRecoveryWarningHTML", "weeklyPlanHTML", "workoutTemplateSettingsHTML",
  "apx96SetMoreView", "restoreBackup", "v88OpenNoteModal", "apx95OpenQuickWeight",
  "apx95SaveQuickWeight", "saveEditedSet", "showHistoryDay", "exportJSON", "template"];

const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8") + "\n;globalThis.__NXT__ = NXT;\n";
const COACH = fs.readFileSync(path.join(ROOT, "coach.js"), "utf8");
const UI_SRC = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
const UI = UI_SRC + "\n;globalThis.__NXP__ = NXP;\n";
const STRATA_SRC = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8");

function makeElement() {
  return {
    style: { setProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 420, height: 290, right: 420, bottom: 290 }; }
  };
}

function load(fx) {
  const discovered = {};
  const io = { persist: 0, save: 0, render: 0, uid: 0 };
  const build = () => {
    const sandbox = {
      console: { log() {}, info() {}, error() {}, warn() {} },
      document: {
        getElementById() { return null; }, querySelector() { return null; },
        querySelectorAll() { return []; }, createElement() { return makeElement(); },
        addEventListener() {}, removeEventListener() {}, activeElement: null, readyState: "complete", title: ""
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
      addEventListener() {}, removeEventListener() {}, requestAnimationFrame() { return 0; }, setTimeout() { return 0; }, clearTimeout() {},
      load(_key, fallback) { return fallback; },
      esc(v) { return String(v === null || v === undefined ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
      state: fx.state,
      settings: fx.settings,
      __io: io,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null, cloudSyncAgo() { return ""; },
      TARGET_LOW: 78, TARGET_HIGH: 80, goalLow() { return 78; }, goalHigh() { return 80; }
    };
    sandbox.window = sandbox;
    for (const n of HOST_FNS) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox) && !PRELUDE_NAMES.has(n)) sandbox[n] = discovered[n];
    return sandbox;
  };
  for (let attempt = 0; attempt < 160; attempt++) {
    const ctx = vm.createContext(build());
    try {
      vm.runInContext(PRELUDE, ctx, { filename: "index-helpers.js" });
      vm.runInContext(CUT, ctx, { filename: "cut-support.js" });
      vm.runInContext(COACH, ctx, { filename: "coach.js" });
      vm.runInContext(UI, ctx, { filename: "premium-ui.js" });
    } catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss) throw err;
      discovered[miss[1]] = function () { return null; };
      continue;
    }
    io.persist = 0; io.save = 0; io.render = 0;
    return { N: ctx.__NXT__, P: ctx.__NXP__, io, fx, ctx };
  }
  throw new Error("the page scripts did not load within the stub budget");
}

/* ---- Fixtures --------------------------------------------------------------- */
const TODAY = "2026-10-21"; // Wednesday, Full Body B
const SPLIT = { 0: "Rest", 1: "FullA", 2: "Zone2", 3: "FullB", 4: "Zone2", 5: "FullC", 6: "Zone2" };
/* The engine's built-in routines: Full A and Full B plan 15 working sets each. */
const ROUTINES = {
  FullA: [["Incline Dumbbell Press", 3], ["Chest Supported T-Bar Row", 3], ["Leg Press", 3], ["Hamstring Curl", 2], ["Cable Lateral Raise", 2], ["Ab Crunch", 2]],
  FullB: [["Romanian Deadlift", 3], ["Lat Pulldown", 3], ["Smith Machine Bench Press", 3], ["Leg Extension", 2], ["Reverse Fly", 2], ["DB Preacher Curl", 2]]
};
let serial = 0;
function add(d, n) { return new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
function sets(date, exercise, n, extra) {
  return Array.from({ length: n }, (_, i) => Object.assign({ id: "s" + (++serial), date, exercise, gym: "Gym A", setType: "working",
    setNum: i + 1, weight: 40, reps: 10, rir: "", ts: Date.parse(date + "T10:00:00Z") + i * 60000 }, extra || {}));
}
/* The first `count` planned working sets of a routine, in routine order. */
function partOf(date, type, count, extra) {
  const out = [];
  for (const [name, n] of ROUTINES[type]) {
    const k = Math.min(n, count - out.length);
    if (k <= 0) break;
    out.push(...sets(date, name, k, Object.assign({ dayType: type }, extra || {})));
  }
  return out;
}
function cardio(date, minutes) { return { id: "c" + (++serial), date, gym: "Gym A", type: "Incline Walk", duration: minutes, ts: Date.parse(date + "T17:00:00Z") }; }
function world(o) {
  o = o || {};
  const today = o.today || TODAY;
  /* A full Full A a month back makes every day after it "tracked" for the coach. */
  const history = partOf("2026-09-21", "FullA", 15);
  return {
    state: { date: today, dayType: o.dayType || resolve(today, o), exercise: "", gym: "Gym A", logs: history.concat(o.logs || []), bws: [],
      cardio: o.cardio || [], floorball: [], scans: [], rest: [], read: {}, gyms: ["Gym A", "Gym B"], sessionPlans: o.sessionPlans || {}, addOns: {} },
    settings: {
      weeklyPlan: Object.assign({}, SPLIT), dayOverrides: Object.assign({}, o.overrides || {}),
      zone2WeeklyTarget: 90, startWeight: 88,
      cutSupport: Object.assign({ version: 99, recovery: {}, targetConfirmed: false }, o.cutSupport || {})
    }
  };
}
function resolve(d, o) { return (o && o.overrides && o.overrides[d]) || SPLIT[new Date(Date.parse(d + "T12:00:00Z")).getUTCDay()]; }
function finishRecord(date, type, setsN, at) {
  return { [`${date}__Gym A__${type}`]: { date, gym: "Gym A", type, finished: true, finishedAt: at || Date.parse(date + "T11:30:00Z"), sets: setsN } };
}
const plain = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const pick = (ds, keys) => Object.fromEntries(keys.map(k => [k, plain(ds[k])]));

/* =========================================================================
   1 · Today: in progress, planned sets complete and finished are different facts.
   ========================================================================= */
test("6 of 15 working sets today, not finished: In progress (the coach's own status passes through as partial)", () => {
  const { P } = load(world({ logs: partOf(TODAY, "FullB", 6) }));
  const ds = P.dayState(TODAY);
  assert.deepStrictEqual(pick(ds, ["k", "w", "inProgress", "setsComplete", "finished", "addOn", "loggedSets", "outcome", "detail"]),
    { k: "progress", w: "In progress", inProgress: true, setsComplete: false, finished: null, addOn: false, loggedSets: 6, outcome: "partial", detail: "6 of 15 sets" });
  assert.deepStrictEqual(plain(ds.plan), { type: "FullB", lift: true, plannedSets: 15, gym: "Gym A" });
  assert.deepStrictEqual(plain(ds.recorded), { workingSets: 6, cardioMin: 0, floorball: 0, any: true });
});

test("counting is not finishing: 8 of 15 sets is the coach's 'done' and still In progress", () => {
  const { P } = load(world({ logs: partOf(TODAY, "FullB", 8) }));
  const ds = P.dayState(TODAY);
  assert.deepStrictEqual([ds.outcome, ds.k, ds.w, ds.inProgress], ["done", "progress", "In progress", true]);
});

test("15 of 15 sets, not finished: Planned sets complete, and the session is still live", () => {
  const { P } = load(world({ logs: partOf(TODAY, "FullB", 15) }));
  const ds = P.dayState(TODAY);
  assert.deepStrictEqual(pick(ds, ["k", "w", "inProgress", "setsComplete", "finished", "outcome", "detail"]),
    { k: "complete", w: "Planned sets complete", inProgress: true, setsComplete: true, finished: null, outcome: "done", detail: "15 of 15 sets" });
});

test("an explicit Finish at 6 of 15: Workout finished, nothing live, and what counted is unchanged", () => {
  const at = Date.parse("2026-10-21T11:30:00Z");
  const { P, N } = load(world({ logs: partOf(TODAY, "FullB", 6), cutSupport: { sessions: finishRecord(TODAY, "FullB", 6, at) } }));
  assert.strictEqual(N.planDone(), true, "the fixture's record is planDone()'s own key");
  const ds = P.dayState(TODAY);
  assert.deepStrictEqual(pick(ds, ["k", "w", "inProgress", "setsComplete", "finished", "outcome", "loggedSets"]),
    { k: "finished", w: "Workout finished", inProgress: false, setsComplete: false, finished: { at }, outcome: "partial", loggedSets: 6 });
  assert.strictEqual(N.coach.dayContext(TODAY).status, "partial", "Finish never turns partial into done");
});

test("today's Finish record is read at planDone()'s key only: another gym's record does not finish this session", () => {
  const other = { [`${TODAY}__Gym B__FullB`]: { date: TODAY, gym: "Gym B", type: "FullB", finished: true, finishedAt: 1, sets: 6 } };
  const { P, N } = load(world({ logs: partOf(TODAY, "FullB", 6), cutSupport: { sessions: other } }));
  assert.strictEqual(N.planDone(), false);
  assert.deepStrictEqual([P.dayState(TODAY).k, P.dayState(TODAY).finished], ["progress", null]);
});

test("warm-ups never count: a warm-up-only morning is still Today, not in progress", () => {
  const { P, N } = load(world({ logs: sets(TODAY, "Romanian Deadlift", 2, { dayType: "FullB", setType: "warmup" }) }));
  assert.strictEqual(N.sessionLogs().length, 2, "the rows are there");
  const ds = P.dayState(TODAY);
  assert.deepStrictEqual(pick(ds, ["k", "w", "inProgress", "loggedSets"]), { k: "today", w: "Today", inProgress: false, loggedSets: 0 });
  assert.strictEqual(ds.recorded.workingSets, 0);
});

test("the planned-set count is the Today ring's: capped per exercise, so extra sets never complete the plan", () => {
  /* Six Romanian Deadlift sets (3 planned) and nothing else: 3 of 15, not 6. */
  const { P, N } = load(world({ logs: sets(TODAY, "Romanian Deadlift", 6, { dayType: "FullB" }) }));
  const ds = P.dayState(TODAY);
  assert.deepStrictEqual([ds.loggedSets, ds.plan.plannedSets, ds.recorded.workingSets, ds.setsComplete, ds.k], [3, 15, 6, false, "progress"]);
  /* The same number the ring draws from (template() and done()), for the same queue. */
  const list = N.templateFor("FullB", "Gym A");
  assert.strictEqual(list.reduce((a, e) => a + Math.min(N.done(e.name), Number(e.sets)), 0), ds.loggedSets);
  assert.strictEqual(list.reduce((a, e) => a + Number(e.sets), 0), ds.plan.plannedSets);
});

/* =========================================================================
   2 · Past days.
   ========================================================================= */
test("a past lifting day short of its plan reads Partly logged; with every planned set, Planned sets complete", () => {
  const { P } = load(world({ logs: partOf("2026-10-19", "FullA", 5).concat(partOf("2026-10-14", "FullB", 15)) }));
  const mon = P.dayState("2026-10-19"), wed = P.dayState("2026-10-14");
  assert.deepStrictEqual(pick(mon, ["k", "w", "inProgress", "outcome", "detail"]),
    { k: "partial", w: "Partly logged", inProgress: false, outcome: "partial", detail: "5 of 15 sets" });
  assert.deepStrictEqual(pick(wed, ["k", "w", "inProgress", "finished", "outcome", "detail"]),
    { k: "complete", w: "Planned sets complete", inProgress: false, finished: null, outcome: "done", detail: "15 of 15 sets" });
});

test("a past day's Finish record is read by its date and type, whichever gym it was trained at", () => {
  const logs = partOf("2026-10-19", "FullA", 15, { gym: "Gym B" });
  const recs = Object.assign({}, { "2026-10-19__Gym B__FullA": { date: "2026-10-19", gym: "Gym B", type: "FullA", finished: true, finishedAt: 5, sets: 15 } },
    { "2026-10-19__Gym A__Zone2": { date: "2026-10-19", gym: "Gym A", type: "Zone2", finished: true, finishedAt: 9, sets: 0 } });
  const { P } = load(world({ logs, cutSupport: { sessions: recs } }));
  const ds = P.dayState("2026-10-19");
  assert.deepStrictEqual(pick(ds, ["k", "w", "finished", "setsComplete", "detail"]),
    { k: "finished", w: "Workout finished", finished: { at: 5 }, setsComplete: true, detail: "15 of 15 sets" });
  assert.strictEqual(ds.plan.gym, "Gym B", "the day's gym: where its working sets were logged");
  /* Without the record the same day is complete, not finished. */
  assert.strictEqual(load(world({ logs })).P.dayState("2026-10-19").k, "complete");
});

test("a past day's stored queue is its plan: a shortened session is complete at its own nine sets", () => {
  const short = { "2026-10-19__Gym A__FullA": ["Incline Dumbbell Press", "Chest Supported T-Bar Row", "Leg Press"] };
  const { P } = load(world({ logs: partOf("2026-10-19", "FullA", 9), sessionPlans: short }));
  const ds = P.dayState("2026-10-19");
  assert.deepStrictEqual([ds.plan.plannedSets, ds.loggedSets, ds.k], [9, 9, "complete"]);
});

test("walk and rest days: an add-on lift is Add-on logged, never done; the walk itself is Done", () => {
  const fx = world({ logs: sets("2026-10-20", "Lat Pulldown", 3, { dayType: "Zone2" }).concat(sets("2026-10-18", "Lat Pulldown", 2, { dayType: "Rest" })),
    cardio: [cardio("2026-10-17", 30)] });
  fx.state.logs.push(...sets("2026-10-17", "Lat Pulldown", 2, { dayType: "Zone2" }));
  const { P, N } = load(fx);
  const tue = P.dayState("2026-10-20"), sun = P.dayState("2026-10-18"), sat = P.dayState("2026-10-17");
  assert.deepStrictEqual(pick(tue, ["k", "w", "addOn", "outcome", "detail"]), { k: "addon", w: "Add-on logged", addOn: true, outcome: "partial", detail: "" });
  assert.deepStrictEqual(pick(sun, ["k", "w", "addOn"]), { k: "addon", w: "Add-on logged", addOn: true });
  assert.deepStrictEqual(pick(sat, ["k", "w", "addOn", "outcome"]), { k: "done", w: "Done", addOn: true, outcome: "done" });
  assert.strictEqual(N.coach.dayContext("2026-10-20").status, "partial", "the coach's status for the walk day is unchanged");
});

test("excused, moved, not logged, other activity and planned days keep the coach's words", () => {
  const notes = { "2026-10-19": { status: "excused", reason: "sick" }, "2026-10-16": { status: "moved", to: "2026-10-17" } };
  const fx = world({ cardio: [cardio("2026-10-14", 30)], cutSupport: { dayNotes: notes } });
  const { P } = load(fx);
  const w = d => P.dayState(d).w, k = d => P.dayState(d).k;
  assert.deepStrictEqual([k("2026-10-19"), w("2026-10-19")], ["excused", "Excused · sick"]);
  assert.deepStrictEqual([k("2026-10-16"), w("2026-10-16")], ["moved", "Moved to 17 Oct"]);
  assert.deepStrictEqual([k("2026-10-12"), w("2026-10-12")], ["missed", "Not logged"]);
  assert.deepStrictEqual([k("2026-10-14"), w("2026-10-14")], ["other", "Plan not done"], "a lifting day with only a walk");
  assert.deepStrictEqual([k("2026-10-23"), w("2026-10-23")], ["planned", "Planned"]);
  assert.deepStrictEqual([k("2026-09-14"), w("2026-09-14")], ["untracked", ""], "before the first record");
  assert.strictEqual(k("2026-10-18"), "rest");
});

/* =========================================================================
   3 · The week header and the read itself.
   ========================================================================= */
test("the rail header splits the engine's liftsDone into planned lifting days and add-on days, without changing it", () => {
  const fx = world({ today: "2026-10-22", logs: partOf("2026-10-19", "FullA", 15).concat(sets("2026-10-20", "Lat Pulldown", 3, { dayType: "Zone2" }), partOf("2026-10-21", "FullB", 5)) });
  const { P, N } = load(fx);
  const week = N.coach.context().week;
  const days = week.days.map(x => P.dayState(x.date, null, x));
  const planned = days.filter(x => x.plan.lift && x.date <= "2026-10-22" && x.recorded.workingSets > 0).length;
  const addOns = days.filter(x => x.addOn && x.date <= "2026-10-22").length;
  assert.deepStrictEqual([week.liftsDone, planned, addOns], [3, 2, 1], "3 lifting days counted = 2 planned + 1 add-on");
  assert.deepStrictEqual(plain(days.map(x => x.k)), ["complete", "addon", "partial", "today", "planned", "planned", "planned"]);
  /* premium-ui's header is built from exactly these two numbers. */
  assert.ok(UI_SRC.indexOf("planLogged=Math.max(0,weekLogged-addOnDays)") !== -1);
  assert.ok(UI_SRC.indexOf("planned ${N.plural(planLift,\"lift\")}") !== -1);
});

test("the read writes nothing: no queue is seeded, no record or setting changes, nothing persists", () => {
  const fx = world({ logs: partOf(TODAY, "FullB", 6) });
  const { P, io, ctx } = load(fx);
  const before = JSON.stringify([ctx.state, ctx.settings]);
  for (let i = -10; i <= 3; i++) P.dayState(add(TODAY, i));
  assert.strictEqual(JSON.stringify([ctx.state, ctx.settings]), before);
  assert.deepStrictEqual([io.persist, io.save, io.render], [0, 0, 0]);
  assert.strictEqual(ctx.state.sessionPlans[`${TODAY}__Gym A__FullB`], undefined, "template()'s queue write is not repeated here");
});

test("every day surface reads the shared helper (rail, tile, Train idle, History card and calendar, week sheet, dock)", () => {
  const between = (src, a, b) => { const i = src.indexOf(a); assert.ok(i !== -1, a); return src.slice(i, src.indexOf(b, i)); };
  const home = between(UI_SRC, "function home() {", "function coachDeck()");
  assert.ok(home.indexOf("dayState(d,dsx,") !== -1, "the rail");
  assert.ok(home.indexOf("dsToday&&dsToday.inProgress?'Resume workout'") !== -1, "the tile's action");
  assert.ok(home.indexOf("class=\"vn-week\"") !== -1, "the release gate's rail markup is kept");
  assert.ok(between(UI_SRC, "function trainLiftIdle(", "/* ---- Train: shared presentation helpers").indexOf("dayState(state.date,null,null)") !== -1, "Train idle");
  assert.ok(between(UI_SRC, "function coachDayLine(", "/* ---- Today tiles").indexOf("dayState(date,null,dc)") !== -1, "History day card");
  assert.ok(between(UI_SRC, "function historyCalendar(", "function historyLiftingBlock(").indexOf("dayState(key,dsx,cdc)") !== -1, "History calendar");
  assert.ok(UI_SRC.indexOf("return dc?dsStatus(dayState(dc.date,null,dc)):null;") !== -1, "coStatus (week sheet)");
  assert.ok(between(STRATA_SRC, "function liveSession()", "function fmt(").indexOf("NXP.dayState(state.date, null, null)") !== -1, "the live dock");
  assert.strictEqual(between(STRATA_SRC, "function liveSession()", "function fmt(").indexOf("NXT.sessionLogs().length"), -1, "warm-ups no longer start the dock");
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
