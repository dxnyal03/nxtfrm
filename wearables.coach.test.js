/* NXTFRM coaching engine contract (coach.js). Run: node wearables.coach.test.js

   Loads the SHIPPED cut-support.js and then coach.js into one vm context, the
   way the page does, with the index.html helpers they lean on (resolveDayType,
   sessionKey, getT, TEMPLATES, persist, toast) copied in and instrumented.
   Pins NXT.coach: day statuses, catch-up proposals and their single write
   path, coordinated insights, dismissal memory, the week review, determinism
   and read-only-ness. Every fixture is built inline; weigh-ins are Morning
   unless a test says otherwise. The calendar is fixed: "today" is Thursday
   15 Oct 2026 unless a test moves it, and the plan is the engine's A/B/C split
   (Mon Full A, Wed Full B, Fri Full C, Tue/Thu/Sat Easy cardio, Sun Rest). */
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
   The helpers below are index.html's own (resolveDayType and friends, sessionKey,
   getT), so the engine resolves days and keys exactly as on the page. persist,
   save, toast and render only count, so a test can prove what was written. */
const PRELUDE = `
const PLAN={1:{type:"Push"},2:{type:"Pull"},3:{type:"Floorball"},4:{type:"Pump"},5:{type:"Floorball"},6:{type:"Legs"},0:{type:"Rest"}};
const TEMPLATES={};
function dayOfWeekFor(date){const ms=Date.parse(String(date)+"T12:00:00");return Number.isFinite(ms)?new Date(ms).getDay():new Date().getDay();}
function planTypeForDow(dow){return (settings.weeklyPlan&&settings.weeklyPlan[dow])||(PLAN[dow]&&PLAN[dow].type)||"Rest";}
function resolveDayType(date){const key=date||(typeof state==="object"&&state?state.date:null);if(!key)return "Rest";const override=settings.dayOverrides&&settings.dayOverrides[key];if(override)return override;return planTypeForDow(dayOfWeekFor(key));}
function sessionKey(type=state.dayType,date=state.date,gym=state.gym){return \`\${date}__\${gym||"Gym"}__\${type}\`;}
function getT(n){return Object.values(TEMPLATES).flat().find(e=>e.name===n)}
function persist(){__io.persist++;}
function save(k,v){__io.save++;}
function toast(m){__io.toasts.push(String(m));}
function render(){__io.render++;}
function closeModal(){}
function uid(){return "u"+(++__io.uid);}
`;
const HOST_FNS = ["renderHistory", "renderFloorball", "apx96MoreSectionHTML", "readiness",
  "getFullBackup", "applyCloudPayload", "apx96OpenQueueManager", "openEditSet",
  "renderHome", "renderTrain", "renderWeight", "renderMore", "exerciseDefByName", "ensureSessionPlan",
  "setsDone", "safeSetsDone", "safeSuggestedWeight", "safeLastSet", "logSet", "apx96UndoLastSet",
  "completeDay", "cycleDayType", "renderRest", "apx96SaveReadiness", "suggestedRestSeconds",
  "weeklyLossRate", "weekStartString", "zone2MinutesThisWeek", "zone2MinutesThisWeekSafe",
  "projectedGoalDate", "estimatedTotalBurnToday", "apx95StrengthItems", "apx95Verdict",
  "apx95SetView", "enhancedRecoveryWarningHTML", "weeklyPlanHTML", "workoutTemplateSettingsHTML",
  "apx96SetMoreView", "restoreBackup", "v88OpenNoteModal", "apx95OpenQuickWeight",
  "apx95SaveQuickWeight", "saveEditedSet"];
const PRELUDE_NAMES = new Set(["PLAN", "TEMPLATES", "dayOfWeekFor", "planTypeForDow", "resolveDayType", "sessionKey",
  "getT", "persist", "save", "toast", "render", "closeModal", "uid"]);

const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8")
  /* `const NXT = ...` is a lexical binding and never lands on the vm global. */
  + "\n;globalThis.__NXT__ = NXT;\n";
const COACH = fs.readFileSync(path.join(ROOT, "coach.js"), "utf8");

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

const ALL_IO = [];
function load(fx, opts) {
  const discovered = {};
  const io = { persist: 0, save: 0, setItem: 0, removeItem: 0, render: 0, uid: 0, toasts: [], warns: [] };
  ALL_IO.push(io);
  const elements = (opts && opts.elements) || {};
  const build = () => {
    const sandbox = {
      console: { log() {}, info() {}, error() {}, warn(...a) { io.warns.push(a.map(String).join(" ")); } },
      document: {
        getElementById(id) { return elements[id] || null; }, querySelector() { return null; },
        querySelectorAll() { return []; }, createElement() { return makeElement(); },
        addEventListener() {}, activeElement: null, readyState: "complete", title: ""
      },
      localStorage: { getItem() { return null; }, setItem() { io.setItem += 1; }, removeItem() { io.removeItem += 1; }, clear() {} },
      load(_key, fallback) { return fallback; },
      esc(v) { return String(v === null || v === undefined ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
      state: fx.state,
      settings: fx.settings,
      __io: io,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null, cloudSyncAgo() { return ""; },
      TARGET_LOW: fx.targetLow, TARGET_HIGH: fx.targetHigh,
      goalLow() { return Math.min(Number(fx.targetLow) || 80, Number(fx.targetHigh) || 82); },
      goalHigh() { return Math.max(Number(fx.targetLow) || 80, Number(fx.targetHigh) || 82); }
    };
    sandbox.window = sandbox;
    for (const n of HOST_FNS) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox) && !PRELUDE_NAMES.has(n)) sandbox[n] = discovered[n];
    return sandbox;
  };
  for (let attempt = 0; attempt < 120; attempt++) {
    const ctx = vm.createContext(build());
    try {
      vm.runInContext(PRELUDE, ctx, { filename: "index-helpers.js" });
      vm.runInContext(CUT, ctx, { filename: "cut-support.js" });
    } catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss) throw err;
      discovered[miss[1]] = function () { return null; };
      continue;
    }
    vm.runInContext(COACH, ctx, { filename: "coach.js" });
    /* install() persists once at load; that write is cut-support's, not coach's. */
    io.persist = 0; io.save = 0; io.setItem = 0; io.removeItem = 0; io.render = 0; io.toasts.length = 0;
    const N = ctx.__NXT__;
    return { N, C: N.coach, io, fx, ctx };
  }
  throw new Error("cut-support.js did not load within the stub budget");
}

/* ---- Fixtures --------------------------------------------------------------- */
const TODAY = "2026-10-15"; // Thursday
const SPLIT = { 0: "Rest", 1: "FullA", 2: "Zone2", 3: "FullB", 4: "Zone2", 5: "FullC", 6: "Zone2" };
/* The engine's built-in routines (N.defaults), copied so fixtures can be built
   before the engine loads; a test below proves the copy has not drifted. */
const ROUTINES = {
  FullA: [["Incline Dumbbell Press", 3, 8, 12, 2.5], ["Chest Supported T-Bar Row", 3, 8, 12, 2.5], ["Leg Press", 3, 8, 12, 5], ["Hamstring Curl", 2, 10, 15, 2.5], ["Cable Lateral Raise", 2, 12, 20, 1], ["Ab Crunch", 2, 12, 20, 2.5]],
  FullB: [["Romanian Deadlift", 3, 8, 10, 5], ["Lat Pulldown", 3, 8, 12, 2.5], ["Smith Machine Bench Press", 3, 8, 12, 2.5], ["Leg Extension", 2, 10, 15, 2.5], ["Reverse Fly", 2, 12, 20, 1], ["DB Preacher Curl", 2, 10, 15, 1]],
  FullC: [["Leg Press", 2, 10, 15, 5], ["Machine Shoulder Press", 2, 8, 12, 2.5], ["Unilateral Seated Row", 3, 8, 12, 2.5], ["Hamstring Curl", 2, 10, 15, 2.5], ["Tricep Pushdown", 2, 10, 15, 2.5], ["Ab Crunch", 2, 12, 20, 2.5]]
};
const BASE = { "Incline Dumbbell Press": 24, "Chest Supported T-Bar Row": 40, "Leg Press": 120, "Hamstring Curl": 40, "Cable Lateral Raise": 8, "Ab Crunch": 20,
  "Romanian Deadlift": 70, "Lat Pulldown": 50, "Smith Machine Bench Press": 50, "Leg Extension": 40, "Reverse Fly": 10, "DB Preacher Curl": 12,
  "Machine Shoulder Press": 40, "Unilateral Seated Row": 32.5, "Tricep Pushdown": 25 };

function add(d, n) { return new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
let serial = 0;
function sets(date, exercise, list, extra) {
  return list.map(([weight, reps], i) => Object.assign({ id: "s" + (++serial), date, exercise, gym: "Gym A", setType: "working",
    setNum: i + 1, weight, reps, rir: "" }, extra || {}));
}
/* A whole routine on one date. k advances the double progression gently: the load
   steps every second session and reps never reach the top of the range, so no
   lift is "ready" and none stalls unless a test says so. */
function session(date, type, k, extra) {
  const out = [];
  for (const [name, n, lo, hi, inc] of ROUTINES[type]) {
    const w = BASE[name] + inc * Math.floor((k || 0) / 2), reps = Math.min(hi, lo + 1 + ((k || 0) % 2));
    out.push(...sets(date, name, Array.from({ length: n }, () => [w, reps]), Object.assign({ dayType: type }, extra || {})));
  }
  return out;
}
function morning(from, to, startKg, perDay, skip) {
  const out = [];
  let i = 0;
  for (let d = from; d <= to; d = add(d, 1), i++) {
    if (skip && skip(d)) continue;
    const noise = (((i * 37) % 11) - 5) / 50;
    out.push({ id: "w" + (++serial), date: d, weight: Math.round((startKg + perDay * i + noise) * 10) / 10, timeOfDay: "Morning", ts: Date.parse(d + "T07:30:00Z") });
  }
  return out;
}
function weighIn(date, weight, timing) { return { id: "w" + (++serial), date, weight, timeOfDay: timing, ts: Date.parse(date + "T18:00:00Z") }; }
function cardio(date, minutes) { return { id: "c" + (++serial), date, gym: "Gym A", type: "Incline Walk", duration: minutes, ts: Date.parse(date + "T17:00:00Z") }; }
function world(o) {
  o = o || {};
  return {
    state: { date: o.today || TODAY, dayType: "", exercise: "", gym: "Gym A", logs: o.logs || [], bws: o.bws || [], cardio: o.cardio || [],
      floorball: o.floorball || [], scans: [], rest: [], read: {}, gyms: ["Gym A", "Gym B"], sessionPlans: o.sessionPlans || {}, addOns: {} },
    settings: {
      weeklyPlan: Object.assign({}, SPLIT, o.plan || {}), dayOverrides: Object.assign({}, o.overrides || {}),
      zone2WeeklyTarget: o.cardioTarget === undefined ? 90 : o.cardioTarget, startWeight: 88,
      cutSupport: Object.assign({ version: 99, recovery: {}, targetConfirmed: false }, o.cutSupport || {})
    },
    targetLow: 78, targetHigh: 80
  };
}
/* Ten full weeks at plan (Mon/Wed/Fri lifting, Tue/Thu/Sat 30-min walks) from
   3 Aug, daily morning weigh-ins drifting down ~0.4 kg a week, then this week:
   Monday logged, Tuesday's walk logged, Wednesday's Full Body B NOT logged,
   today (Thursday, a walk day) nothing yet. */
function tenWeeks(o) {
  o = o || {};
  const logs = [], walks = [];
  for (let w = 0; w < 10; w++) {
    const mon = add("2026-08-03", 7 * w);
    logs.push(...session(mon, "FullA", w), ...session(add(mon, 2), "FullB", w), ...session(add(mon, 4), "FullC", w));
    walks.push(cardio(add(mon, 1), 30), cardio(add(mon, 3), 30), cardio(add(mon, 5), 30));
  }
  logs.push(...session("2026-10-12", "FullA", 10));
  if (o.wednesday) logs.push(...session("2026-10-14", "FullB", 10));
  walks.push(cardio("2026-10-13", 30));
  return world(Object.assign({ logs: logs.concat(o.logs || []), cardio: walks.concat(o.cardio || []),
    bws: morning("2026-08-03", o.today || TODAY, 88, -0.06).concat(o.bws || []) }, o.world || {}, o.today ? { today: o.today } : {}));
}
const ids = list => list.map(x => x.id);
const byDomain = (list, d) => list.filter(x => x.domain === d);
const noCoachWarnings = io => assert.deepStrictEqual(io.warns.filter(w => w.indexOf("[coach]") !== -1), []);

/* Cross-realm values (arrays and objects made inside the vm) are compared as JSON. */
const plain = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const plainList = l => ({ top: plain(l), all: plain(l.all) });

/* ---- More fixtures ------------------------------------------------------------ */
/* Incline Dumbbell Press (Full A only, 8–12, 2.5 kg step) went past the top of its
   range on Monday (30 × 13): D24 unlocks the next load. Wednesday is logged, so
   the schedule stays quiet; next Full A is Monday 19 Oct. */
function readyWorld(perDay) {
  const logs = [...sets("2026-10-05", "Incline Dumbbell Press", [[30, 12], [30, 11], [30, 10]], { dayType: "FullA" }),
    ...sets("2026-10-12", "Incline Dumbbell Press", [[30, 13], [30, 12], [30, 11]], { dayType: "FullA" }),
    ...session("2026-10-14", "FullB", 0)];
  return world({ logs, bws: morning("2026-09-01", TODAY, perDay === undefined ? 86 : 92, perDay === undefined ? -0.05 : perDay) });
}
/* Lat Pulldown: the same best set (50 × 10) on three Wednesdays in a row. */
function stallWorld() {
  const flat = d => sets(d, "Lat Pulldown", [[50, 10], [50, 9], [50, 8]], { dayType: "FullB" });
  const logs = [...flat("2026-09-23"), ...flat("2026-09-30"), ...flat("2026-10-07"), ...session("2026-10-12", "FullA", 0),
    ...session("2026-10-14", "FullB", 0).filter(r => r.exercise !== "Lat Pulldown")];
  return world({ logs, bws: morning("2026-09-01", TODAY, 86, -0.05) });
}
/* Romanian Deadlift last done 18 days ago; Full B (which holds it) is next Wednesday. */
function returningWorld() {
  const logs = [...sets("2026-09-27", "Romanian Deadlift", [[70, 10], [70, 9], [70, 8]], { dayType: "FullB" }),
    ...session("2026-10-12", "FullA", 0), ...session("2026-10-14", "FullB", 0).filter(r => r.exercise !== "Romanian Deadlift")];
  return world({ logs, bws: morning("2026-09-01", TODAY, 86, -0.05) });
}
/* Flat morning weights for six weeks: a plateau with a neutral decision. */
function plateauWorld() {
  return world({ logs: [...session("2026-10-12", "FullA", 0), ...session("2026-10-14", "FullB", 0)], bws: morning("2026-09-01", TODAY, 84, 0) });
}
/* This week's lifting logged up to `today`; cardio rows as given. */
function cardioWorld(today, rows, target) {
  const logs = [...session("2026-10-12", "FullA", 0), ...session("2026-10-14", "FullB", 0), ...session("2026-10-16", "FullC", 0)].filter(r => r.date <= today);
  return world({ today, logs, cardio: rows, cardioTarget: target, bws: morning("2026-09-01", today, 85, -0.05) });
}
/* Morning weigh-ins stop k days before today. */
function dataWorld(k, extra) {
  return world({ logs: [...session("2026-10-12", "FullA", 0), ...session("2026-10-14", "FullB", 0)],
    bws: morning("2026-09-01", add(TODAY, -k), 85, -0.05).concat(extra || []) });
}
/* Every string a user can read in an insight (not data keys such as logged.floorball). */
function copyOf(list) {
  const out = [];
  for (const x of list) {
    out.push(x.title, x.body, x.why.noticed, x.why.evidence, x.why.matters, x.why.canDo);
    for (const e of x.evidence) out.push(e.label, e.value);
    if (x.action) { out.push(x.action.label); if (x.action.payload && x.action.payload.consequences) out.push(...x.action.payload.consequences); }
  }
  return out.join(" | ");
}
function rankOf(x) { return { act: 0, watch: 1, info: 2 }[x.severity] * 10 + { schedule: 0, strength: 1, cardio: 2, weight: 3, data: 4 }[x.domain]; }

/* ---- Load and contract -------------------------------------------------------- */
test("coach.js loads after cut-support.js and adds NXT.coach with the documented API", () => {
  const { C, io } = load(world());
  for (const fn of ["context", "dayContext", "dayStatuses", "catchUp", "insights", "weekReview",
    "excuse", "unexcuse", "dismiss", "markReviewSeen", "applyCatchUp"]) assert.strictEqual(typeof C[fn], "function", fn);
  assert.ok(Object.isFrozen(C.thresholds));
  assert.deepStrictEqual(
    [C.thresholds.CATCHUP_WINDOW_DAYS, C.thresholds.STALE_DAYS, C.thresholds.MORNING_GAP_DAYS, C.thresholds.CARDIO_MAX_PER_DAY, C.thresholds.STREAK_MIN_WEEKS, C.thresholds.TOP],
    [7, 14, 3, 45, 3, 3]);
  noCoachWarnings(io);
});

test("the fixtures use the engine's own default routines", () => {
  const { N } = load(world());
  for (const type of ["FullA", "FullB", "FullC"]) {
    assert.deepStrictEqual(plain(N.defaults[type].map(e => [e.name, e.sets, e.reps[0], e.reps[1], e.inc])), ROUTINES[type], type);
  }
});

/* ---- New user, sparse rows ----------------------------------------------------- */
test("new user with no rows: no insights, no review, no catch-up, honest statuses, no errors", () => {
  const { C, io } = load(world());
  const list = C.insights();
  assert.strictEqual(list.length, 0);
  assert.strictEqual(list.all.length, 0);
  assert.strictEqual(C.catchUp(), null);
  assert.strictEqual(C.weekReview(), null);
  const ctx = C.context();
  assert.ok(ctx);
  assert.ok(ctx.lifts.length > 0, "planned lifts are listed even without history");
  assert.ok(ctx.lifts.every(l => l.lastDate === null && l.aim === null && l.best === null && !l.readyToIncrement && !l.stall && !l.returning));
  assert.deepStrictEqual([ctx.week.liftsPlanned, ctx.week.liftsDone, ctx.week.liftsMissed, ctx.week.liftsRemaining], [1, 0, 0, 1]);
  assert.strictEqual(ctx.weight.review.title, "Building your baseline");
  assert.deepStrictEqual([ctx.weight.confidence, ctx.weight.lastMorningDate, ctx.weight.daysSinceMorning, ctx.cardio.lastDate], [null, null, null, null]);
  assert.deepStrictEqual(["2026-10-12", "2026-10-13", TODAY, "2026-10-16", "2026-10-18"].map(d => C.dayContext(d).status),
    ["untracked", "untracked", "today", "upcoming", "rest"]);
  assert.strictEqual(io.persist, 0);
  noCoachWarnings(io);
});

test("sparse rows: an old session, three weigh-ins and one walk read sensibly", () => {
  const fx = world({ logs: session("2026-08-10", "FullA", 0), cardio: [cardio("2026-09-02", 25)],
    bws: [weighIn("2026-09-01", 86.2, "Morning"), weighIn("2026-09-20", 85.4, "Morning"), weighIn("2026-10-14", 84.9, "Morning")] });
  const { C, io } = load(fx);
  const p = C.catchUp();
  assert.strictEqual(p.missedDate, "2026-10-14");
  const all = C.insights().all;
  /* Every Full A lift is back after 66 days: one quiet insight for all six, listed
     soonest first (Ab Crunch, Hamstring Curl and Leg Press are in Friday's Full C). */
  assert.deepStrictEqual(plain(ids(all)), ["schedule.catchup:2026-10-14", "strength.returning"]);
  assert.deepStrictEqual([all[1].severity, all[1].title, all[1].body],
    ["info", "6 lifts back after a break", "Ab Crunch, Hamstring Curl, Leg Press +3 more: last logged 66 days ago."]);
  assert.strictEqual(all[1].evidence.length, 7, "six lifts and the next planned session");
  assert.strictEqual(byDomain(all, "cardio").length, 0, "no cardio nudge without cardio in the last 28 days");
  const wr = C.weekReview();
  assert.strictEqual(wr.headline, "Nothing logged this week");
  assert.deepStrictEqual(plain(wr.lifts), { planned: 3, done: 0, missed: 3, excused: 0, moved: 0 });
  assert.deepStrictEqual(plain(wr.lines), ["Missed: Mon Full Body A, Wed Full Body B, Fri Full Body C", "Cardio: 0 of 90 min · 0 sessions", "No morning weigh-ins"]);
  noCoachWarnings(io);
});

/* ---- Day statuses -------------------------------------------------------------- */
test("a lifting day is done at half its planned working sets or more, partial below", () => {
  const before = sets("2026-10-05", "Leg Press", [[100, 10]]);
  for (const [n, want] of [[8, "done"], [7, "partial"]]) {
    const { C } = load(world({ logs: before.concat(sets("2026-10-12", "Leg Press", Array.from({ length: n }, () => [100, 10]))) }));
    const d = C.dayContext("2026-10-12");
    assert.deepStrictEqual([d.status, d.logged.sets], [want, n], "Full A plans 15 working sets; " + n + " logged");
  }
  /* A shortened session (queue of three exercises = 9 sets) is judged against its own plan. */
  const short = { "2026-10-12__Gym A__FullA": ["Incline Dumbbell Press", "Chest Supported T-Bar Row", "Leg Press"] };
  const five = before.concat(sets("2026-10-12", "Leg Press", Array.from({ length: 5 }, () => [100, 10])));
  assert.strictEqual(load(world({ logs: five, sessionPlans: short })).C.dayContext("2026-10-12").status, "done");
  assert.strictEqual(load(world({ logs: five })).C.dayContext("2026-10-12").status, "partial");
});

test("statuses: missed, rest, today, upcoming, and D48's 'neither' days read partial", () => {
  const fx = world({ logs: [...session("2026-10-05", "FullA", 0), ...sets("2026-10-13", "Leg Press", [[100, 10], [100, 10]], { dayType: "Zone2" })],
    cardio: [cardio("2026-10-14", 30)] });
  const { C } = load(fx);
  const s = d => C.dayContext(d).status;
  assert.strictEqual(s("2026-10-05"), "done");
  assert.strictEqual(s("2026-10-07"), "missed");
  assert.strictEqual(s("2026-10-11"), "rest");
  assert.strictEqual(s("2026-10-12"), "missed");
  const tue = C.dayContext("2026-10-13"), wed = C.dayContext("2026-10-14");
  assert.deepStrictEqual([tue.status, tue.logged.sets, tue.logged.cardioMin], ["partial", 2, 0], "walk day with only an add-on lift");
  assert.deepStrictEqual([wed.status, wed.logged.sets, wed.logged.cardioMin], ["partial", 0, 30], "lifting day with only a walk");
  assert.strictEqual(s(TODAY), "today");
  assert.strictEqual(s("2026-10-16"), "upcoming");
  assert.deepStrictEqual(plain(C.dayContext("2026-10-16")), { date: "2026-10-16", type: "FullC", label: "Full Body C", status: "upcoming",
    reason: null, note: null, movedTo: null, movedFrom: null, logged: { sets: 0, cardioMin: 0, floorball: 0 } });
});

test("untracked: days before the first record, and Floorball days while floorball is switched off", () => {
  const a = load(world({ logs: session("2026-10-07", "FullB", 0) }));
  assert.strictEqual(a.C.dayContext("2026-10-05").status, "untracked");
  assert.strictEqual(a.C.dayContext("2026-10-09").status, "missed");
  const b = load(world({ plan: { 3: "Floorball" }, logs: [...session("2026-10-05", "FullA", 0), ...session("2026-10-12", "FullA", 0)],
    floorball: [{ id: "f1", date: "2026-10-07", duration: 90 }] }));
  assert.strictEqual(b.N.features.floorball, false);
  assert.deepStrictEqual([b.C.dayContext("2026-10-07").status, b.C.dayContext("2026-10-07").logged.floorball], ["done", 1]);
  assert.strictEqual(b.C.dayContext("2026-10-14").status, "untracked");
  assert.strictEqual(b.C.catchUp(), null, "a Floorball day is never caught up");
});

test("dayStatuses covers a range in one pass, clamps to 92 days and rejects bad input", () => {
  const { C } = load(tenWeeks());
  const month = C.dayStatuses("2026-09-28", "2026-11-08");
  assert.strictEqual(month.length, 42);
  month.forEach((d, i) => assert.strictEqual(d.date, add("2026-09-28", i)));
  for (const d of month.slice(10, 24)) assert.deepStrictEqual(plain(d), plain(C.dayContext(d.date)));
  assert.strictEqual(C.dayStatuses("2026-01-01", "2026-12-31").length, 92);
  assert.strictEqual(C.dayStatuses("2026-10-10", "2026-10-01").length, 0);
  assert.strictEqual(C.dayStatuses("nope", "2026-10-01").length, 0);
  assert.strictEqual(C.dayContext("2026-02-30"), null);
  assert.strictEqual(C.context("13/10/2026"), null);
});

/* ---- Catch-up ------------------------------------------------------------------- */
test("a missed lifting day yields a catch-up that states exactly what changes", () => {
  const { C, io } = load(tenWeeks());
  const p = C.catchUp();
  assert.deepStrictEqual(plain(p), {
    missedDate: "2026-10-14", missedType: "FullB", missedLabel: "Full Body B", todayType: "Zone2",
    logged: { sets: 0, cardioMin: 0, floorball: 0 },
    consequences: [
      "Full Body B moves to today (Thu 15 Oct).",
      "Today’s Easy cardio is dropped for this week.",
      "Wednesday reads Moved.",
      "Tomorrow is still Full Body C, so lifting falls on two days in a row.",
      "The weekly plan itself does not change."
    ],
    apply: { setDayType: { date: "2026-10-15", type: "FullB" }, dayNote: { date: "2026-10-14", status: "moved", to: "2026-10-15" } }
  });
  const top = C.insights();
  assert.strictEqual(top[0].id, "schedule.catchup:2026-10-14");
  assert.deepStrictEqual([top[0].severity, top[0].title, top[0].action.kind, top[0].action.label], ["act", "Full Body B missed yesterday", "catchUp", "Move to today"]);
  assert.deepStrictEqual(plain(top[0].action.payload), plain(p));
  assert.strictEqual(io.persist, 0);
});

test("applyCatchUp writes today's override through setDayType, records Moved, and leaves the weekly plan alone", () => {
  const h = load(tenWeeks());
  const { N, C, io, fx } = h;
  const planBefore = JSON.stringify(fx.settings.weeklyPlan), calls = [], orig = N.setDayType;
  N.setDayType = function (d, t) { calls.push([d, t]); return orig.apply(this, arguments); };
  assert.strictEqual(C.applyCatchUp(C.catchUp()), true);
  assert.deepStrictEqual(calls, [["2026-10-15", "FullB"]]);
  assert.strictEqual(fx.settings.dayOverrides["2026-10-15"], "FullB");
  assert.strictEqual(JSON.stringify(fx.settings.weeklyPlan), planBefore);
  const note = fx.settings.cutSupport.dayNotes["2026-10-14"];
  assert.deepStrictEqual([note.status, note.to, Number.isFinite(note.ts)], ["moved", "2026-10-15", true]);
  assert.strictEqual(io.persist, 1, "one commit carries the override and the note");
  assert.strictEqual(io.toasts[io.toasts.length - 1], "Full Body B moved to today");
  assert.strictEqual(fx.state.dayType, "FullB");
  const wed = C.dayContext("2026-10-14"), thu = C.dayContext("2026-10-15");
  assert.deepStrictEqual([wed.status, wed.movedTo], ["moved", "2026-10-15"]);
  assert.deepStrictEqual([thu.type, thu.status, thu.movedFrom], ["FullB", "today", "2026-10-14"]);
  assert.strictEqual(C.catchUp(), null);
  assert.ok(!ids(C.insights().all).some(id => id.indexOf("schedule.catchup") === 0));
  assert.strictEqual(C.context().week.liftsPlanned, 3, "the moved day leaves the plan, today joins it");
});

test("a stale or tampered proposal is refused and nothing is written", () => {
  const h = load(tenWeeks());
  const p = h.C.catchUp(), tampered = plain(p);
  tampered.apply.setDayType.type = "FullC";
  assert.strictEqual(h.C.applyCatchUp(tampered), false);
  assert.strictEqual(h.C.applyCatchUp(null), false);
  assert.strictEqual(h.io.persist, 0);
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "This catch-up no longer applies.");
  assert.strictEqual(h.fx.settings.cutSupport.dayNotes, undefined, "no notes object created");
  assert.strictEqual(h.C.applyCatchUp(p), true);
  assert.strictEqual(h.C.applyCatchUp(p), false, "applying twice is refused");
  assert.strictEqual(h.io.persist, 1);
});

test("a ticked 'Make every <weekday> this' box cannot turn a catch-up into a weekly-plan change", () => {
  const box = { checked: true };
  const h = load(tenWeeks(), { elements: { "n99-day-every": box } });
  const before = JSON.stringify(h.fx.settings.weeklyPlan);
  assert.strictEqual(h.C.applyCatchUp(h.C.catchUp()), true);
  assert.strictEqual(box.checked, false);
  assert.strictEqual(JSON.stringify(h.fx.settings.weeklyPlan), before);
  assert.strictEqual(h.fx.settings.dayOverrides["2026-10-15"], "FullB");
});

test("no catch-up on a lifting day, when anything is logged today, when today is excused, or when a later day covers it", () => {
  const cases = {
    "today is a lifting day": tenWeeks({ today: "2026-10-16" }),
    "a walk logged today": tenWeeks({ cardio: [cardio(TODAY, 20)] }),
    "a warm-up logged today": tenWeeks({ logs: sets(TODAY, "Leg Press", [[60, 10]], { setType: "warmup" }) }),
    "today is excused": tenWeeks({ world: { cutSupport: { dayNotes: { [TODAY]: { status: "excused", reason: "sick", note: "", ts: 1 } } } } }),
    "Full B is already scheduled on Saturday": tenWeeks({ world: { overrides: { "2026-10-17": "FullB" } } })
  };
  for (const [why, fx] of Object.entries(cases)) {
    const { C } = load(fx);
    assert.strictEqual(C.catchUp(), null, why);
    assert.ok(!ids(C.insights().all).some(id => id.indexOf("schedule.catchup") === 0), why);
  }
});

test("the catch-up window is 7 days: a miss 7 days back qualifies, 8 days back does not", () => {
  const plan = [["2026-09-28", "FullA"], ["2026-09-30", "FullB"], ["2026-10-02", "FullC"], ["2026-10-05", "FullA"], ["2026-10-07", "FullB"],
    ["2026-10-09", "FullC"], ["2026-10-12", "FullA"], ["2026-10-14", "FullB"]];
  const windowWorld = missed => {
    const logs = [];
    for (const [d, t] of plan) if (d !== missed) logs.push(...session(d, t, 0));
    return world({ logs, overrides: { [missed]: "Push" } });
  };
  const seven = load(windowWorld("2026-10-08"));
  const p = seven.C.catchUp();
  assert.deepStrictEqual([p.missedDate, p.missedType, p.missedLabel, p.consequences[2]], ["2026-10-08", "Push", "Push", "Thu 8 Oct reads Moved."]);
  assert.strictEqual(seven.C.insights()[0].title, "Push missed last Thursday");
  const eight = load(windowWorld("2026-10-07"));
  assert.strictEqual(eight.C.dayContext("2026-10-07").status, "missed");
  assert.strictEqual(eight.C.catchUp(), null);
});

/* ---- Excused and moved days ------------------------------------------------------ */
test("an excused day reads Excused, needs no catch-up, leaves the plan, and can be undone", () => {
  const h = load(tenWeeks());
  assert.strictEqual(h.C.excuse("2026-10-14", "sick", "  flu   day "), true);
  assert.strictEqual(h.io.persist, 1);
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "Wed 14 Oct excused · sick");
  const n = h.fx.settings.cutSupport.dayNotes["2026-10-14"];
  assert.deepStrictEqual([n.status, n.reason, n.note, Number.isFinite(n.ts)], ["excused", "sick", "flu day", true]);
  const d = h.C.dayContext("2026-10-14");
  assert.deepStrictEqual([d.status, d.reason, d.note], ["excused", "sick", "flu day"]);
  assert.strictEqual(h.C.catchUp(), null);
  assert.strictEqual(h.C.context().week.liftsPlanned, 2);
  const all = ids(h.C.insights().all);
  assert.ok(!all.some(id => /^schedule\.(catchup|behind)/.test(id)), all.join());
  assert.ok(all.indexOf("schedule.streak") !== -1, "with the week back on plan, the quiet streak shows");
  assert.strictEqual(h.C.unexcuse("2026-10-14"), true);
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "Excuse removed");
  assert.strictEqual(h.C.dayContext("2026-10-14").status, "missed");
  assert.ok(h.C.catchUp());
  assert.strictEqual(h.C.unexcuse("2026-10-14"), false);
  assert.strictEqual(h.C.excuse("2026-10-16", "bored"), true, "a future day can be excused ahead of time");
  assert.strictEqual(h.fx.settings.cutSupport.dayNotes["2026-10-16"].reason, "other");
  assert.strictEqual(h.C.dayContext("2026-10-16").status, "excused");
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "Fri 16 Oct excused");
  assert.strictEqual(h.io.persist, 3);
});

test("a day with logged sets cannot be excused (and neither can rest days or a walk already walked)", () => {
  const h = load(tenWeeks());
  assert.strictEqual(h.C.excuse("2026-10-12", "sick"), false);
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "This day already has logged sets.");
  assert.strictEqual(h.C.excuse("2026-10-11", "sick"), false);
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "A rest day has nothing to excuse.");
  assert.strictEqual(h.C.excuse("2026-10-13", "sick"), false);
  assert.strictEqual(h.io.toasts[h.io.toasts.length - 1], "This day is already logged.");
  assert.strictEqual(h.C.excuse("not-a-date", "sick"), false);
  assert.strictEqual(h.io.persist, 0);
  assert.strictEqual(h.fx.settings.cutSupport.dayNotes, undefined);
});

test("moved notes read Moved with both ends linked; malformed notes are ignored", () => {
  const notes = { "2026-10-14": { status: "moved", to: "2026-10-17", ts: 1 } };
  const { C } = load(tenWeeks({ world: { cutSupport: { dayNotes: notes } } }));
  const wed = C.dayContext("2026-10-14"), sat = C.dayContext("2026-10-17");
  assert.deepStrictEqual([wed.status, wed.movedTo, wed.reason], ["moved", "2026-10-17", null]);
  assert.deepStrictEqual([sat.status, sat.movedFrom], ["upcoming", "2026-10-14"]);
  assert.strictEqual(C.catchUp(), null);
  const bad = load(tenWeeks({ world: { cutSupport: { dayNotes: { "2026-10-14": { status: "bogus" }, "2026-10-12": "nope" } } } }));
  assert.strictEqual(bad.C.dayContext("2026-10-14").status, "missed");
  assert.strictEqual(bad.C.dayContext("2026-10-12").status, "done");
});

/* ---- Insights: shape and coordination -------------------------------------------- */
test("every insight follows the contract: fields, enums, plain-sentence why, one per domain, ranked, top 3", () => {
  const worlds = [tenWeeks(), tenWeeks({ today: "2026-10-16" }), tenWeeks({ wednesday: true }), readyWorld(), readyWorld(-0.18), stallWorld(), returningWorld(),
    plateauWorld(), dataWorld(3), dataWorld(5, [weighIn(add(TODAY, -1), 84.1, "Post-workout")]), cardioWorld("2026-10-17", [cardio("2026-10-13", 20)])];
  let seen = 0;
  for (const fx of worlds) {
    const list = load(fx).C.insights();
    assert.strictEqual(list.length, Math.min(3, list.all.length));
    list.forEach((x, i) => assert.strictEqual(x, list.all[i]));
    assert.strictEqual(new Set(list.all.map(x => x.domain)).size, list.all.length, "one per domain");
    for (let i = 1; i < list.all.length; i++) assert.ok(rankOf(list.all[i - 1]) <= rankOf(list.all[i]), "ranked");
    for (const x of list.all) {
      seen++;
      const keys = Object.keys(x).sort();
      assert.deepStrictEqual(keys, ["dismissible", "domain", "evidence", "fingerprint", "id", "severity", "title", "body", "why"].concat(x.action ? ["action"] : []).sort());
      assert.ok(["schedule", "strength", "weight", "cardio", "data"].indexOf(x.domain) !== -1);
      assert.ok(["act", "watch", "info"].indexOf(x.severity) !== -1);
      assert.ok(typeof x.title === "string" && x.title.length > 0 && typeof x.body === "string" && x.body.length > 0, x.id);
      assert.ok(Array.isArray(x.evidence) && x.evidence.length > 0, x.id);
      for (const e of x.evidence) {
        assert.ok(typeof e.label === "string" && typeof e.value === "string");
        if ("date" in e) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(e.date));
      }
      for (const k of ["noticed", "evidence", "matters", "canDo"]) assert.ok(/^[A-Z0-9].*[.]$/.test(x.why[k]), x.id + " why." + k + ": " + x.why[k]);
      if (x.action) assert.ok(["catchUp", "open", "excuse"].indexOf(x.action.kind) !== -1 && x.action.label && x.action.payload);
      assert.strictEqual(x.dismissible, true);
      assert.ok(/^[0-9a-f]{8}$/.test(x.fingerprint));
    }
  }
  assert.ok(seen >= 12, "the fixtures exercise every evaluator (" + seen + ")");
});

test("strength: a lift past the top of its range reads 'ready to move up' with the engine's load", () => {
  const { C } = load(readyWorld());
  const lift = C.context().lifts.find(l => l.name === "Incline Dumbbell Press");
  assert.deepStrictEqual(plain({ aim: lift.aim, ready: lift.readyToIncrement, hold: lift.holdReason, next: lift.nextDate, type: lift.nextType, days: lift.daysSince }),
    { aim: { weight: 32.5, reps: 10, kind: "load", why: null }, ready: true, hold: null, next: "2026-10-19", type: "FullA", days: 3 });
  const s = byDomain(C.insights().all, "strength");
  assert.strictEqual(s.length, 1);
  assert.deepStrictEqual([s[0].id, s[0].severity, s[0].title, s[0].body], ["strength.ready", "act", "Ready to move up: Incline Dumbbell Press", "Incline Dumbbell Press 30 × 13 → 32.5 kg"]);
  assert.deepStrictEqual(plain(s[0].evidence), [{ label: "Incline Dumbbell Press", value: "30 × 13 → 32.5 × 10", date: "2026-10-12" }]);
});

test("conflicting signals: a 'watch' weight decision demotes 'move up' to an info 'hold'", () => {
  const { N, C } = load(readyWorld(-0.18));
  assert.strictEqual(N.review().tone, "watch");
  assert.strictEqual(N.review().title, "Losing quickly");
  const all = C.insights().all;
  assert.ok(ids(all).indexOf("strength.ready") === -1);
  const hold = all.find(x => x.id === "strength.hold");
  assert.deepStrictEqual([hold.severity, hold.title, hold.action], ["info", "Hold Incline Dumbbell Press for now", undefined]);
  assert.ok(hold.body.indexOf("“Losing quickly”") !== -1, hold.body);
  assert.ok(/conservative/.test(hold.why.matters) && /Your call\.$/.test(hold.why.canDo));
  const w = all.find(x => x.id === "weight.review");
  assert.deepStrictEqual([w.severity, w.title], ["watch", "Losing quickly"]);
  assert.ok(ids(all).indexOf("weight.review") < ids(all).indexOf("strength.hold"), "watch outranks info");
});

test("strength: a stall names the lift with coachFor's note; a lift back after 15+ days is info", () => {
  const stall = byDomain(load(stallWorld()).C.insights().all, "strength");
  assert.deepStrictEqual([stall[0].id, stall[0].severity, stall[0].title], ["strength.stall", "watch", "Lat Pulldown: same best set three times"]);
  assert.deepStrictEqual(plain(stall[0].evidence), [{ label: "Lat Pulldown", value: "50 × 10 · flat 3 sessions to Wed 7 Oct", date: "2026-10-07" }]);
  assert.strictEqual(stall[0].body, "Best set flat for three sessions. Repeat 50 × 10, or drop to 45 and rebuild.");
  assert.deepStrictEqual(plain(stall[0].action), { label: "See the lift", kind: "open", payload: { tab: "weight", view: "strength", exercise: "Lat Pulldown" } });
  const back = byDomain(load(returningWorld()).C.insights().all, "strength");
  assert.deepStrictEqual([back[0].id, back[0].severity, back[0].title], ["strength.returning", "info", "Romanian Deadlift: back after 18 days"]);
  assert.strictEqual(back[0].body, "18 days off. Re-enter at 65 (about 90% of 70) for 10 reps.");
  assert.strictEqual(back[0].evidence[1].date, "2026-10-21", "the next planned session keeps it current");
});

test("schedule: 'week behind' is act while recoverable and info once it cannot fit; a catch-up outranks it", () => {
  const fri = byDomain(load(tenWeeks({ today: "2026-10-16" })).C.insights().all, "schedule")[0];
  assert.deepStrictEqual([fri.id, fri.severity, fri.title], ["schedule.behind:2026-10-12", "act", "1 lifting session behind this week"]);
  assert.strictEqual(fri.body, "1 of 3 planned lifting days logged, 1 still scheduled, 3 days left.");
  assert.deepStrictEqual(plain(fri.action), { label: "Plan Saturday", kind: "open", payload: { sheet: "day", date: "2026-10-17" } });
  const sun = byDomain(load(tenWeeks({ today: "2026-10-18", cardio: [cardio("2026-10-18", 20)] })).C.insights().all, "schedule")[0];
  assert.deepStrictEqual([sun.severity, sun.title], ["info", "1 of 3 lifting days, 1 day left"]);
  assert.deepStrictEqual(plain(sun.action), { label: "Excuse Friday", kind: "excuse", payload: { date: "2026-10-16" } });
  const thu = byDomain(load(tenWeeks()).C.insights().all, "schedule");
  assert.deepStrictEqual(plain(ids(thu)), ["schedule.catchup:2026-10-14"]);
});

test("schedule: three or more full weeks at plan is a quiet info streak", () => {
  const all = load(tenWeeks({ wednesday: true })).C.insights().all;
  const s = all.find(x => x.id === "schedule.streak");
  assert.deepStrictEqual([s.severity, s.title, s.body], ["info", "10 weeks in a row at plan", "Every full week since Mon 3 Aug had at least 3 lifting days."]);
  assert.strictEqual(s.why.matters, "The count uses today's weekly plan (3 lifting days); the app does not keep plan history.");
});

test("weight: the insight mirrors review() — only on a 'watch' tone or a plateau, with the same headline", () => {
  assert.strictEqual(byDomain(load(tenWeeks()).C.insights().all, "weight").length, 0, "steady loss: the decision card is enough");
  const fast = load(readyWorld(-0.18));
  const w = byDomain(fast.C.insights().all, "weight")[0];
  assert.deepStrictEqual([w.title, w.body, w.severity], [fast.N.review().title, fast.N.review().reason, "watch"]);
  assert.deepStrictEqual(plain(w.action), { label: "Why", kind: "open", payload: { sheet: "review" } });
  const flat = load(plateauWorld());
  assert.strictEqual(flat.N.detectPlateau().plateau, true);
  const p = byDomain(flat.C.insights().all, "weight")[0];
  assert.deepStrictEqual([p.title, p.severity], [flat.N.review().title, "info"]);
  assert.strictEqual(p.body, flat.N.detectPlateau().reason);
  assert.ok(p.evidence.some(e => e.label === "Plateau"));
});

test("cardio: act when the rest of the target fits at ≤ 45 min a day, info when it does not", () => {
  const sat = byDomain(load(cardioWorld("2026-10-17", [cardio("2026-10-13", 20)])).C.insights().all, "cardio")[0];
  assert.deepStrictEqual([sat.severity, sat.title, sat.body], ["act", "70 min of cardio left this week", "20 of 90 min logged · 2 days left, about 35 min a day."]);
  assert.deepStrictEqual(plain(sat.action), { label: "Log cardio", kind: "open", payload: { sheet: "cardio" } });
  const sun = byDomain(load(cardioWorld("2026-10-18", [cardio("2026-10-13", 20)])).C.insights().all, "cardio")[0];
  assert.deepStrictEqual([sun.severity, sun.title, sun.body, sun.action], ["info", "Cardio target out of reach this week", "70 min left with 1 day to go: more than 45 min a day.", undefined]);
  const edge = byDomain(load(cardioWorld("2026-10-17", [cardio("2026-10-08", 30)])).C.insights().all, "cardio")[0];
  assert.deepStrictEqual([edge.severity, edge.body], ["act", "0 of 90 min logged · 2 days left, about 45 min a day."]);
  const over = byDomain(load(cardioWorld("2026-10-17", [cardio("2026-10-08", 30)], 91)).C.insights().all, "cardio")[0];
  assert.strictEqual(over.severity, "info");
});

test("cardio stays quiet without recent cardio, before the plan's first walk day, and once the target is met", () => {
  const q = fx => byDomain(load(fx).C.insights().all, "cardio").length;
  assert.strictEqual(q(cardioWorld("2026-10-17", [cardio("2026-09-01", 30)])), 0, "nothing logged in 28 days");
  assert.strictEqual(q(cardioWorld("2026-10-13", [cardio("2026-10-08", 30)])), 0, "Tuesday is the first walk day");
  assert.strictEqual(q(cardioWorld("2026-10-17", [cardio("2026-10-13", 60), cardio("2026-10-15", 30)])), 0, "target met");
});

test("data: 3 days without a morning weigh-in is act, 4+ is watch, 2 is nothing", () => {
  const d = k => byDomain(load(dataWorld(k)).C.insights().all, "data");
  assert.strictEqual(d(2).length, 0);
  const three = d(3)[0];
  assert.deepStrictEqual([three.severity, three.title], ["act", "Weigh in today to keep the trend continuous"]);
  assert.ok(three.body.indexOf("Last morning weigh-in: Mon 12 Oct, 3 days ago.") === 0, three.body);
  const four = d(4)[0];
  assert.deepStrictEqual([four.severity, four.title], ["watch", "No morning weigh-in for 4 days"]);
  assert.deepStrictEqual(plain(four.action), { label: "Log weight", kind: "open", payload: { sheet: "weight" } });
});

test("data: contextual-only weigh-ins are counted and never treated as morning readings", () => {
  const h = load(dataWorld(4, [weighIn(add(TODAY, -1), 84.1, "Post-workout")]));
  assert.strictEqual(h.C.context().weight.contextualOnlyDays, 1);
  assert.strictEqual(h.C.context().weight.lastMorningDate, add(TODAY, -4));
  const x = byDomain(h.C.insights().all, "data")[0];
  assert.ok(x.body.indexOf("1 day since had only post-workout or scan readings") !== -1, x.body);
  assert.ok(x.evidence.some(e => e.label === "Other timings since" && e.value === "1 day"));
  const none = load(world({ bws: [weighIn("2026-10-10", 85, "Post-workout"), weighIn("2026-10-13", 84.8, "Evo Scan")] }));
  const y = byDomain(none.C.insights().all, "data")[0];
  assert.deepStrictEqual([y.severity, y.title], ["watch", "No morning weigh-ins yet"]);
  assert.strictEqual(none.C.context().weight.contextualOnlyDays, 2);
  assert.strictEqual(none.C.context().weight.trend.current.n, 0, "D14: contextual readings never enter the trend");
});

test("staleness: an insight whose newest evidence is 14 days old shows; 15 days old is dropped", () => {
  const fourteen = byDomain(load(dataWorld(14)).C.insights().all, "data");
  assert.strictEqual(fourteen.length, 1);
  assert.strictEqual(fourteen[0].evidence[0].date, add(TODAY, -14));
  assert.strictEqual(byDomain(load(dataWorld(15)).C.insights().all, "data").length, 0);
});

test("dismissal hides an insight until its evidence changes, and is remembered under id|fingerprint", () => {
  const fx = dataWorld(4);
  fx.settings.cutSupport.coach = { dismissed: { "old|deadbeef": Date.now() - 61 * 864e5, "recent|cafebabe": Date.now() - 864e5 } };
  const h = load(fx);
  const first = byDomain(h.C.insights().all, "data")[0];
  assert.strictEqual(h.C.dismiss("data.morning"), true);
  assert.strictEqual(h.io.persist, 1);
  const store = h.fx.settings.cutSupport.coach.dismissed;
  assert.ok(Number.isFinite(store["data.morning|" + first.fingerprint]));
  assert.ok(!("old|deadbeef" in store), "entries older than 60 days are pruned on write");
  assert.ok("recent|cafebabe" in store);
  assert.strictEqual(byDomain(h.C.insights().all, "data").length, 0);
  h.fx.state.bws.push(weighIn(add(TODAY, -1), 84.1, "Post-workout"));
  const again = byDomain(h.C.insights().all, "data")[0];
  assert.ok(again, "new evidence brings it back");
  assert.notStrictEqual(again.fingerprint, first.fingerprint);
  assert.strictEqual(h.C.dismiss("data.morning", again.fingerprint), true);
  assert.strictEqual(byDomain(h.C.insights().all, "data").length, 0);
  const p = h.io.persist;
  assert.strictEqual(h.C.dismiss("nope.nothing"), false);
  assert.strictEqual(h.C.dismiss(""), false);
  assert.strictEqual(h.io.persist, p);
});

test("switched-off features stay silent: no calories, floorball, check-ins, waist or wearables in any insight", () => {
  const worlds = [tenWeeks(), readyWorld(-0.18), plateauWorld(), dataWorld(5), world({ plan: { 3: "Floorball", 5: "Floorball" }, logs: session("2026-10-05", "FullA", 0) })];
  for (const fx of worlds) {
    const text = copyOf(load(fx).C.insights().all);
    assert.ok(!/calorie|kcal|floorball|check-in|checkin|waist|wearable|readiness score/i.test(text), text.slice(0, 200));
  }
});

/* ---- Week review ------------------------------------------------------------------- */
test("weekReview totals equal activityWeeks for the same week", () => {
  const h = load(tenWeeks());
  const wr = h.C.weekReview(), weeks = plain(h.N.activityWeeks(12));
  const cur = weeks.find(w => w.start === wr.weekStart), prev = weeks.find(w => w.start === add(wr.weekStart, -7));
  assert.deepStrictEqual([wr.weekStart, wr.weekEnd], ["2026-10-05", "2026-10-11"]);
  assert.deepStrictEqual([wr.sets, wr.tonnage, wr.lifts.done, wr.cardio.min, wr.cardio.sessions], [cur.sets, cur.tonnage, cur.liftDays, cur.cardioMin, cur.cardioSessions]);
  assert.deepStrictEqual(plain(wr.vsPrev), { sets: cur.sets - prev.sets, tonnage: cur.tonnage - prev.tonnage });
  assert.deepStrictEqual(plain(wr.lifts), { planned: 3, done: 3, missed: 0, excused: 0, moved: 0 });
  assert.strictEqual(wr.headline, "Plan met · 3 of 3 lifting days");
  assert.strictEqual(wr.days.length, 7);
  assert.deepStrictEqual(plain(wr.nextWeek.map(x => x.type)), ["FullA", "Zone2", "FullB", "Zone2", "FullC", "Zone2", "Rest"]);
  const mid = h.C.weekReview("2026-09-02"), w2 = weeks.find(w => w.start === "2026-08-31");
  assert.strictEqual(mid.weekStart, "2026-08-31");
  assert.deepStrictEqual([mid.sets, mid.tonnage, mid.lifts.done, mid.cardio.min], [w2.sets, w2.tonnage, w2.liftDays, w2.cardioMin]);
});

test("weekReview outcomes use the finish summary's best-set rule per exercise, per gym", () => {
  const logs = [
    ...sets("2026-09-28", "Leg Press", [[100, 9], [100, 8]]), ...sets("2026-10-05", "Leg Press", [[100, 10], [95, 12]]),
    ...sets("2026-09-28", "Incline Dumbbell Press", [[30, 10]]), ...sets("2026-10-05", "Incline Dumbbell Press", [[30, 10], [27.5, 12]]),
    ...sets("2026-09-30", "Lat Pulldown", [[50, 10]]), ...sets("2026-10-07", "Lat Pulldown", [[47.5, 12]]),
    ...sets("2026-10-05", "Hamstring Curl", [[40, 12]]),
    ...sets("2026-09-28", "Ab Crunch", [[0, 15]]), ...sets("2026-10-05", "Ab Crunch", [[0, 20]]),
    ...sets("2026-09-30", "Leg Extension", [[40, 12]], { gym: "Gym B" }), ...sets("2026-10-07", "Leg Extension", [[40, 10]]),
    ...sets("2026-10-05", "Leg Press", [[140, 10]], { setType: "warmup" })
  ];
  const wr = load(world({ logs })).C.weekReview();
  assert.deepStrictEqual(plain(wr.outcomes), { beat: 1, matched: 1, below: 1, exercises: 6 });
  assert.ok(wr.lines.indexOf("Best set vs last time: 1 beat · 1 matched · 1 below") !== -1, wr.lines.join(" | "));
});

test("weekReview weight: Mon–Sun morning average from 3 readings, contextual readings ignored", () => {
  const prevWeek = [weighIn("2026-09-29", 85.0, "Morning"), weighIn("2026-10-01", 84.8, "Morning"), weighIn("2026-10-03", 84.6, "Morning")];
  const two = [weighIn("2026-10-05", 84.4, "Morning"), weighIn("2026-10-07", 84.2, "Morning"), weighIn("2026-10-09", 83.0, "Post-workout")];
  let wr = load(world({ bws: prevWeek.concat(two) })).C.weekReview();
  assert.deepStrictEqual(plain(wr.weight), { avg: null, prevAvg: 84.8, change: null, readings: 2 });
  assert.strictEqual(wr.lines[wr.lines.length - 1], "Morning average needs 3 readings (2 logged)");
  wr = load(world({ bws: prevWeek.concat(two, [weighIn("2026-10-10", 84.0, "Morning")]) })).C.weekReview();
  assert.deepStrictEqual(plain(wr.weight), { avg: 84.2, prevAvg: 84.8, change: -0.6, readings: 3 });
  assert.strictEqual(wr.lines[wr.lines.length - 1], "Morning average 84.2 kg · −0.6 kg vs the week before · 3 readings");
});

test("weekReview: seen follows markReviewSeen (monotonic); a week not over, or bad input, is null", () => {
  const h = load(tenWeeks());
  assert.strictEqual(h.C.weekReview().seen, false);
  assert.strictEqual(h.C.markReviewSeen(), true);
  assert.strictEqual(h.io.persist, 1);
  assert.strictEqual(h.fx.settings.cutSupport.coach.reviewSeen, "2026-10-05");
  assert.strictEqual(h.C.weekReview().seen, true);
  assert.strictEqual(h.C.weekReview("2026-09-28").seen, true);
  assert.strictEqual(h.C.markReviewSeen("2026-09-30"), true);
  assert.strictEqual(h.io.persist, 1, "an earlier week is already covered: no write");
  assert.strictEqual(h.C.weekReview(TODAY), null);
  assert.strictEqual(h.C.weekReview("garbage"), null);
  assert.strictEqual(h.C.markReviewSeen("garbage"), false);
});

test("copy is factual: no exclamation, cheerleading, causation or 'muscle preserved'", () => {
  const banned = /!|great|awesome|amazing|crush|smash|keep it up|well done|proud|you got this|muscle preserved|because|due to|nailed/i;
  const worlds = [tenWeeks(), tenWeeks({ today: "2026-10-16" }), tenWeeks({ wednesday: true }), readyWorld(), readyWorld(-0.18), stallWorld(), returningWorld(),
    plateauWorld(), dataWorld(3), cardioWorld("2026-10-17", [cardio("2026-10-13", 20)])];
  for (const fx of worlds) {
    const { C } = load(fx);
    const text = JSON.stringify([plain(C.insights().all), plain(C.weekReview()), plain(C.catchUp())]);
    const hit = banned.exec(text);
    assert.ok(!hit, "found '" + (hit && hit[0]) + "' in " + text.slice(Math.max(0, (hit && hit.index) - 80), (hit && hit.index) + 40));
  }
});

/* ---- Determinism, as-of reads, purity ------------------------------------------------- */
test("determinism: the same stored data and date give deep-equal output", () => {
  for (const fx of [tenWeeks(), readyWorld(-0.18), stallWorld(), cardioWorld("2026-10-17", [cardio("2026-10-13", 20)]), dataWorld(5)]) {
    const { C } = load(fx);
    const run = () => ({ ins: plainList(C.insights()), ctx: plain(C.context()), wr: plain(C.weekReview()), cu: plain(C.catchUp()), ds: plain(C.dayStatuses("2026-09-28", "2026-10-25")) });
    assert.deepStrictEqual(run(), run());
  }
  const a = load(tenWeeks()), b = load(tenWeeks());
  assert.deepStrictEqual(plainList(a.C.insights()), plainList(b.C.insights()), "two loads of the same data agree");
});

test("as-of reads: a later state asked about an earlier date answers exactly as that date did, and is restored", () => {
  const a = load(tenWeeks());
  const b = load(tenWeeks({ today: "2026-10-18", logs: session("2026-10-16", "FullC", 10), cardio: [cardio("2026-10-17", 40)] }));
  const logs = b.fx.state.logs, rows = logs.length;
  const A = { ins: plainList(a.C.insights()), ctx: plain(a.C.context()), cu: plain(a.C.catchUp()) };
  const B = { ins: plainList(b.C.insights(TODAY)), ctx: plain(b.C.context(TODAY)), cu: plain(b.C.catchUp(TODAY)) };
  assert.deepStrictEqual(B, A);
  assert.deepStrictEqual([b.fx.state.date, b.fx.state.dayType, b.fx.state.gym], ["2026-10-18", "Rest", "Gym A"]);
  assert.ok(b.fx.state.logs === logs && logs.length === rows, "the narrowed log views are put back");
});

test("read functions touch no storage: no persist, save, localStorage, toast or repaint, and nothing mutates", () => {
  for (const fx of [tenWeeks(), readyWorld(), stallWorld(), dataWorld(4), world()]) {
    const h = load(fx);
    h.N.cfg();
    const before = JSON.stringify({ s: h.fx.state, t: h.fx.settings });
    for (let i = 0; i < 2; i++) {
      h.C.context(); h.C.context("2026-10-01"); h.C.dayContext(); h.C.dayStatuses("2026-09-01", "2026-10-31");
      h.C.catchUp(); h.C.insights(); h.C.insights("2026-10-10"); h.C.weekReview(); h.C.weekReview("2026-09-14");
    }
    assert.strictEqual(JSON.stringify({ s: h.fx.state, t: h.fx.settings }), before);
    assert.deepStrictEqual([h.io.persist, h.io.save, h.io.setItem, h.io.removeItem, h.io.render, h.io.toasts.length], [0, 0, 0, 0, 0, 0]);
  }
  /* Why the guard exists: aimFor() reaches cue(), which logs a suggestion and persists. */
  const h = load(readyWorld());
  const n0 = h.fx.settings.cutSupport.suggestions.length;
  h.N.aimFor("Incline Dumbbell Press");
  assert.deepStrictEqual([h.fx.settings.cutSupport.suggestions.length, h.io.persist], [n0 + 1, 1]);
  /* Source: the six read functions name no writer; in the whole module persist is
     named only inside the read guard, and localStorage nowhere. */
  for (const name of ["context", "dayContext", "dayStatuses", "catchUp", "insights", "weekReview"]) {
    assert.ok(!/\bpersist\b|localStorage|\bsave\s*\(|commit\s*\(|toast\s*\(/.test(h.C[name].toString()), name);
  }
  const code = COACH.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const guard = code.slice(code.indexOf("function silenceable()"), code.indexOf("function asOf("));
  assert.ok(/globalThis\.persist/.test(guard));
  assert.ok(!/\bpersist\b/.test(code.replace(guard, "")), "persist named outside the read guard");
  assert.ok(!/localStorage/.test(code));
});

test("review() over the 56-day window equals the full call, including strengthItems' 24-lift cap", () => {
  const names = Array.from({ length: 30 }, (_, i) => "Lift " + String(i + 1).padStart(2, "0"));
  const logs = [];
  /* Old history, far outside the window, logged L01 → L30: that is strengthItems' key order. */
  for (const d of ["2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25"]) names.forEach(n => logs.push(...sets(d, n, [[50, 10]])));
  /* The last eight Mondays logged L30 → L01; L01 and L02 slide (Review), the rest climb. */
  ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].forEach((d, k) => {
    for (let i = names.length - 1; i >= 0; i--) logs.push(...sets(d, names[i], [[i < 2 ? 60 - 3 * k : 50 + 2.5 * k, 10]]));
  });
  /* And a lift whose fourth-last session is older than 56 days. */
  for (const d of ["2026-07-20", "2026-08-31", "2026-09-28", "2026-10-12"]) logs.push(...sets(d, "Sparse Lift", [[40, 10]]));
  const h = load(world({ logs, bws: morning("2026-08-01", TODAY, 90, -0.05) }));
  const full = h.N.review();
  assert.strictEqual(full.title, "Review your training load", "the cap decides this verdict");
  assert.deepStrictEqual(plain(h.C.context().weight.review), plain({ tone: full.tone, title: full.title, message: full.message, action: full.action,
    reason: full.reason, change: full.change === null || full.change === undefined ? null : Math.round(full.change * 100) / 100 }));
  /* weekReview's status words (as of Sunday) equal the full strengthItems() as of Sunday. */
  const saved = [h.fx.state.date, h.fx.state.dayType];
  h.fx.state.date = "2026-10-11";
  const items = h.N.strengthItems();
  h.fx.state.date = saved[0];
  const words = {};
  for (const s of items) if (["Improving", "Holding steady", "Watch", "Review"].indexOf(s.status) !== -1) words[s.status] = (words[s.status] || 0) + 1;
  const line = "Tracked lifts on Sunday: " + ["Improving", "Holding steady", "Watch", "Review"].filter(s => words[s]).map(s => words[s] + " " + s).join(" · ");
  assert.ok(h.C.weekReview().lines.indexOf(line) !== -1, line + " | " + h.C.weekReview().lines.join(" | "));
});

test("lift aims equal aimFor()/coachFor() called directly for that lift's gym and next routine", () => {
  const extra = [...sets("2026-09-21", "Cable Lateral Raise", [[8, 15]], { dayType: "FullA" }), ...sets("2026-09-28", "Cable Lateral Raise", [[8, 16]], { dayType: "FullA" }),
    ...sets("2026-10-05", "Cable Lateral Raise", [[8, 120]], { dayType: "FullA" }), ...sets("2026-10-12", "Cable Lateral Raise", [[0, 20]], { dayType: "FullA" })];
  for (const fx of [tenWeeks({ logs: extra }), stallWorld(), returningWorld(), readyWorld()]) {
    const h = load(fx);
    const lifts = h.C.context().lifts.filter(l => l.lastDate);
    assert.ok(lifts.length > 0);
    for (const l of lifts) {
      const saved = [h.fx.state.gym, h.fx.state.dayType];
      h.fx.state.gym = l.gym;
      h.fx.state.dayType = l.nextType || h.N.typeFor(TODAY);
      const a = h.N.aimFor(l.name), c = h.N.coachFor(l.name);
      [h.fx.state.gym, h.fx.state.dayType] = saved;
      assert.deepStrictEqual(plain(l.aim), a ? { weight: a.weight, reps: a.reps, kind: a.kind, why: a.why || null } : null, l.name);
      /* Stage 1: the context also carries coachFor()'s effort state, so the trim includes it. */
      assert.deepStrictEqual(plain(l.coach), plain(c ? { kind: c.kind, headline: c.headline, note: c.note, effort: c.effort || null } : null), l.name);
    }
  }
});

test("context: validated shape, no NaN or undefined anywhere, cut and goal only when stored", () => {
  const fx = tenWeeks({ world: { cutSupport: { targetConfirmed: true }, overrides: { "2026-10-17": "FullB", "2026-01-01": "FullA" } } });
  fx.settings.cutStart = "2026-08-03";
  const { N, C } = load(fx);
  const ctx = C.context();
  assert.deepStrictEqual(Object.keys(ctx).sort(), ["cardio", "cut", "date", "dayType", "features", "freshness", "lifts", "plan", "week", "weight"]);
  const walk = (v, at) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), at);
    assert.notStrictEqual(v, undefined, at);
    if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], at + "." + k);
  };
  walk(ctx, "ctx");
  assert.deepStrictEqual(plain(ctx.cut), { start: "2026-08-03", goal: { low: 78, high: 80 }, elapsedDays: 73 });
  assert.deepStrictEqual(plain(ctx.plan.overrides), { "2026-10-17": "FullB" }, "only last, this and next week");
  assert.deepStrictEqual(plain(ctx.features), plain(N.features));
  assert.deepStrictEqual([ctx.date, ctx.dayType, ctx.week.start, ctx.week.end, ctx.week.daysLeft], [TODAY, "Zone2", "2026-10-12", "2026-10-18", 4]);
  assert.ok(ctx.lifts.length <= 40);
  for (const l of ctx.lifts) assert.deepStrictEqual(Object.keys(l).sort(), ["aim", "best", "coach", "daysSince", "gym", "holdReason", "lastDate", "name", "nextDate", "nextType", "readyToIncrement", "returning", "stall"]);
  const plainCtx = load(tenWeeks()).C.context();
  assert.deepStrictEqual(plain(plainCtx.cut), { start: null, goal: null, elapsedDays: null });
});

/* ---- Owner decisions, 2026-10-13 ---------------------------------------------------- */
test("catch-up: a lifting day with no working sets qualifies even when a walk was logged; it still reads partial", () => {
  const h = load(tenWeeks({ cardio: [cardio("2026-10-14", 30)] }));
  const wed = h.C.dayContext("2026-10-14");
  assert.deepStrictEqual([wed.status, wed.logged.sets, wed.logged.cardioMin], ["partial", 0, 30], "D48's status word is kept");
  const p = h.C.catchUp();
  assert.deepStrictEqual(plain([p.missedDate, p.missedType, p.logged]), ["2026-10-14", "FullB", { sets: 0, cardioMin: 30, floorball: 0 }]);
  const x = h.C.insights()[0];
  assert.strictEqual(x.id, "schedule.catchup:2026-10-14");
  assert.strictEqual(x.why.noticed, "Full Body B on Wed 14 Oct has no logged sets (30 min of cardio was logged instead) and is not marked excused or moved.");
  assert.strictEqual(h.C.applyCatchUp(p), true);
  assert.strictEqual(h.C.dayContext("2026-10-14").status, "moved");
  assert.strictEqual(h.C.dayContext("2026-10-14").logged.cardioMin, 30, "the walk stays recorded");
  /* Other activity is reported generically, so a switched-off feature is never named. */
  const fb = load(tenWeeks({ world: { floorball: [{ id: "f9", date: "2026-10-14", duration: 60 }] } }));
  assert.deepStrictEqual(plain(fb.C.catchUp().logged), { sets: 0, cardioMin: 0, floorball: 1 });
  assert.ok(fb.C.insights()[0].why.noticed.indexOf("(other activity was logged instead)") !== -1);
  assert.ok(!/floorball/i.test(copyOf(fb.C.insights().all)));
});

test("catch-up: a started session (some working sets) never qualifies, and the target day stays strict", () => {
  const started = load(tenWeeks({ logs: sets("2026-10-14", "Lat Pulldown", [[50, 10], [50, 10]], { dayType: "FullB" }) }));
  assert.deepStrictEqual([started.C.dayContext("2026-10-14").status, started.C.dayContext("2026-10-14").logged.sets], ["partial", 2]);
  assert.strictEqual(started.C.catchUp(), null);
  const walkedToday = load(tenWeeks({ cardio: [cardio("2026-10-14", 30), cardio(TODAY, 20)] }));
  assert.strictEqual(walkedToday.C.catchUp(), null, "nothing may be logged on the target day");
});

/* Monday 19 Oct is a Full A day. Incline Dumbbell Press went 30 × 13 on 12 Oct
   (past the top of 8–12), so coachFor() steps the load to 32.5 kg; Chest Supported
   T-Bar Row went 40 × 9, a one-more-rep day. */
function trainWorld(perDay) {
  const today = "2026-10-19";
  const logs = [...sets("2026-10-05", "Incline Dumbbell Press", [[30, 12], [30, 11], [30, 10]], { dayType: "FullA" }),
    ...sets("2026-10-12", "Incline Dumbbell Press", [[30, 13], [30, 12], [30, 11]], { dayType: "FullA" }),
    ...sets("2026-10-12", "Chest Supported T-Bar Row", [[40, 9], [40, 9], [40, 8]], { dayType: "FullA" })];
  return world({ today, logs, bws: morning("2026-09-01", today, perDay === undefined ? 86 : 92, perDay === undefined ? -0.05 : perDay) });
}

test("trainAdvice: holds the load when the weight decision is 'watch' and the coach would step up", () => {
  const { N, C, io } = load(trainWorld(-0.18));
  assert.deepStrictEqual([N.review().tone, N.review().title, N.coachFor("Incline Dumbbell Press").kind], ["watch", "Losing quickly", "load"]);
  assert.deepStrictEqual(plain(C.trainAdvice("Incline Dumbbell Press")), {
    kind: "hold",
    headline: "Hold 30 kg — weight decision reads “Losing quickly”",
    note: "The Aim still shows the engine's next step (32.5 kg); repeating 30 kg is the conservative choice until the decision settles.",
    sets: [{ n: 1, weight: 30, reps: 13 }, { n: 2, weight: 30, reps: 12 }, { n: 3, weight: 30, reps: 11 }],
    weight: 30, reps: 13, gap: 7,
    effort: { known: 0, sets: 3, state: "none" }, // Stage 1: coachFor() now reports the effort data it rested on
    coordinated: { hold: true, reason: "Weight decision reads “Losing quickly”", source: "weight" }
  });
  /* D25 untouched: coachFor() and the Aim still state the engine's step. */
  const engine = N.coachFor("Incline Dumbbell Press"), aim = N.aimFor("Incline Dumbbell Press");
  assert.deepStrictEqual(plain([engine.kind, engine.headline, engine.weight, engine.sets.map(s => s.weight)]), ["load", "Add 2.5 kg", 32.5, [32.5, 32.5, 32.5]]);
  assert.deepStrictEqual(plain([aim.kind, aim.weight, aim.reps]), ["load", 32.5, 10]);
  noCoachWarnings(io);
});

test("trainAdvice: identical to coachFor otherwise (steady weight, a non-load day, an unknown lift)", () => {
  const steady = load(trainWorld());
  const fast = load(trainWorld(-0.18));
  const same = (h, ex) => {
    const advice = plain(h.C.trainAdvice(ex)), coached = plain(h.N.coachFor(ex));
    assert.deepStrictEqual(advice.coordinated, { hold: false, reason: null, source: null }, ex);
    delete advice.coordinated;
    assert.deepStrictEqual(advice, coached, ex);
  };
  same(steady, "Incline Dumbbell Press");
  assert.strictEqual(steady.C.trainAdvice("Incline Dumbbell Press").kind, "load");
  same(steady, "Chest Supported T-Bar Row");
  same(fast, "Chest Supported T-Bar Row");
  assert.strictEqual(fast.C.trainAdvice("Chest Supported T-Bar Row").kind, "rep", "nothing to hold on a one-more-rep day");
  same(fast, "Leg Press");
  assert.strictEqual(fast.C.trainAdvice(""), null);
  assert.strictEqual(fast.C.trainAdvice(null), null);
});

test("trainAdvice: deterministic and read-only", () => {
  const h = load(trainWorld(-0.18));
  h.N.cfg();
  const before = JSON.stringify({ s: h.fx.state, t: h.fx.settings });
  const a = plain(h.C.trainAdvice("Incline Dumbbell Press")), b = plain(h.C.trainAdvice("Incline Dumbbell Press"));
  h.C.trainAdvice("Chest Supported T-Bar Row");
  assert.deepStrictEqual(a, b);
  assert.strictEqual(JSON.stringify({ s: h.fx.state, t: h.fx.settings }), before);
  assert.deepStrictEqual([h.io.persist, h.io.save, h.io.setItem, h.io.removeItem, h.io.render, h.io.toasts.length], [0, 0, 0, 0, 0, 0]);
  assert.ok(!/\bpersist\b|localStorage|\bsave\s*\(|commit\s*\(|toast\s*\(/.test(h.C.trainAdvice.toString()));
});

test("no coach warnings were logged in any scenario", () => {
  for (const io of ALL_IO) noCoachWarnings(io);
});

console.log("\n" + (failed ? "FAILED " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
