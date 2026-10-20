/* NXTFRM Today briefing (stage 5, SPEC-today §6.1, §3.2, §4.3, §14 T1–T12). Run: node wearables.today-brief.test.js

   Loads the SHIPPED cut-support.js, coach.js and premium-ui.js into one vm context (the day-state suite's harness)
   and reads the three pure presentation reads Today is laid out from: NXP.pickToday() (which coach insight the
   focus card carries, which one leads, what folds into "More insights · N"), NXP.todayLine() (the masthead's
   fixed fragments) and NXP.cueFor() (the card's one engine cue). Pins: every pool insight appears exactly once;
   a concern can lead, a celebration never does; the cue is coachAdvice() (the coordinator's hold, never aimFor()'s
   step); the context line never states a weight, a rate or a future date; nothing is written. */
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


/* ---- Insights shaped as NXT.coach.insights() returns them (coach.js §insight) ------------------- */
function ins(id, domain, severity, title, lifts, extra) {
  return Object.assign({
    id, domain, severity, title, body: title + " body",
    evidence: (lifts || []).map(n => ({ label: n, value: "100 × 10", date: "2026-10-16" })),
    why: { noticed: "n", evidence: "e", matters: "m", canDo: "can do " + id },
    dismissible: true, fingerprint: id + "fp"
  }, extra || {});
}
const READY = ins("strength.ready", "strength", "act", "Ready to move up: Leg Press", ["Leg Press"], { action: { label: "Open Train", kind: "open", payload: { tab: "train" } } });
const STALL = ins("strength.stall", "strength", "watch", "Lat Pulldown: same best set three times", ["Lat Pulldown"], { action: { label: "See the lift", kind: "open", payload: { tab: "weight", view: "strength" } } });
const STREAK = ins("schedule.streak", "schedule", "info", "4 weeks at plan", []);
const BEHIND = ins("schedule.behind:2026-10-19", "schedule", "act", "1 lifting day behind", [], { action: { label: "Plan the week", kind: "open", payload: { sheet: "day", date: "2026-10-21" } } });
const CARDIO = Object.assign(ins("cardio.week:2026-10-19", "cardio", "act", "60 min of cardio left this week", []), { evidence: [{ label: "Cardio this week", value: "30 of 90 min", date: "2026-10-18" }] });
const WREVIEW = ins("weight.review", "weight", "watch", "Losing quickly", []);
const RETURNING = ins("strength.returning", "strength", "info", "Leg Press: back after 20 days", ["Leg Press"]);
const CALM = { tone: "", title: "Cutting steadily, strength holding", message: "m", reason: "r", action: "Stay consistent" };
const WATCH = { tone: "watch", title: "Losing quickly", message: "m", reason: "r", action: "Ease the deficit" };
const FULLA = ROUTINES.FullA.map(([n]) => n);
const list = (...a) => { const x = a.slice(0, 3); x.all = a; return x; };
const WEEK = { weekStart: "2026-10-12", weekEnd: "2026-10-18", seen: false, headline: "Last week" };
const ids = p => ({
  carried: p.carried ? [p.carried.id] : [],
  lead: p.lead.kind === "insight" ? [p.lead.item.id] : [],
  digest: p.digest.filter(d => d.kind === "insight").map(d => d.item.id)
});

const SHARED = load(world({ today: "2026-10-19" }));
const P0 = SHARED.P;

/* =========================================================================
   Lead selection (T1–T3)
   ========================================================================= */
test("T1 a watch Decision leads, placed after the focus card, and the context line becomes the concern", () => {
  const p = P0.pickToday({ review: WATCH, insights: list(READY, STREAK), mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" });
  assert.deepStrictEqual(plain([p.lead.kind, p.lead.variant, p.lead.place]), ["decision", "watch", "afterFocus"]);
  const line = P0.todayLine({ date: "2026-10-19", k: "today", dayType: "FullA", lift: true, gym: "Gym A", week: [], lead: { variant: p.lead.variant, title: WATCH.title } });
  assert.deepStrictEqual([line.variant, line.watchTitle], ["watch", "Losing quickly"]);
  const calm = P0.todayLine({ date: "2026-10-19", k: "today", dayType: "FullA", lift: true, gym: "Gym A", week: [], lead: { variant: "calm", title: CALM.title } });
  assert.deepStrictEqual([calm.variant, calm.watchTitle], ["plain", null]);
});

test("T2 an act insight leads over a calm Decision, after the log strip", () => {
  const p = P0.pickToday({ review: CALM, insights: list(BEHIND, STREAK), mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" });
  assert.deepStrictEqual(plain([p.lead.kind, p.lead.variant, p.lead.place, p.lead.item.id]), ["insight", "act", "afterLog", BEHIND.id]);
  /* A watch insight is a concern: it leads ahead of an act, after the focus card. */
  const w = P0.pickToday({ review: CALM, insights: list(BEHIND, STALL), mode: "rest", dayType: "Rest", template: [], button: "" });
  assert.deepStrictEqual(plain([w.lead.variant, w.lead.place, w.lead.item.id]), ["watch", "afterFocus", STALL.id]);
});

test("T3 info items and celebrations never lead; with nothing else the calm Decision does", () => {
  const p = P0.pickToday({ review: CALM, insights: list(STREAK, RETURNING), mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" });
  assert.deepStrictEqual(plain([p.lead.kind, p.lead.variant, p.lead.place]), ["decision", "calm", "afterLog"]);
  assert.deepStrictEqual(ids(p).digest, [STREAK.id, RETURNING.id]);
  /* An engine failure (no insights) still leads with the Decision, and nothing else is invented. */
  const none = P0.pickToday({ review: CALM, insights: null, mode: "today", dayType: "FullA", template: FULLA });
  assert.deepStrictEqual(plain([none.lead.kind, none.count, none.pool.length]), ["decision", 0, 0]);
});

/* =========================================================================
   Carry and the exactly-once invariant (T4–T7)
   ========================================================================= */
test("T4 before the session, a strength insight on today's lifts is carried and supplies the cue exercise", () => {
  const p = P0.pickToday({ review: CALM, insights: list(READY, STREAK), mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" });
  assert.strictEqual(p.carried && p.carried.id, READY.id);
  assert.strictEqual(p.carriedIndex, 0, "the index space is ui.coachList's (coachAct/coachDismiss unchanged)");
  const tpl = ROUTINES.FullA.map(([name, sets]) => ({ name, sets }));
  const cue = P0.cueFor({ mode: "today", dayType: "FullA", template: tpl, done: {}, carried: p.carried, advice: n => ({ headline: "Advice for " + n, note: "note", sets: [{ n: 1, weight: 125, reps: 12 }] }) });
  assert.deepStrictEqual(plain([cue.kind, cue.ex, cue.index, cue.headline, cue.insight && cue.insight.id]), ["cue", "Leg Press", 2, "Advice for Leg Press", READY.id]);
  /* Lifts outside today's session are not carried: the cue falls back to the first planned exercise. */
  const off = P0.pickToday({ review: CALM, insights: list(STALL), mode: "today", dayType: "FullA", template: FULLA });
  assert.strictEqual(off.carried, null);
  const cue2 = P0.cueFor({ mode: "today", dayType: "FullA", template: tpl, done: {}, carried: null, advice: n => ({ headline: n }) });
  assert.deepStrictEqual(plain([cue2.ex, cue2.insight]), ["Incline Dumbbell Press", null]);
});

test("T5 exactly once: every pool insight appears once across carried, lead and digest, in every state", () => {
  const pool = list(READY, STALL, CARDIO, STREAK, BEHIND);
  const fixtures = {
    before: { review: CALM, mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" },
    progressMatch: { review: CALM, mode: "progress", dayType: "FullA", template: FULLA, current: "Leg Press", button: "Resume workout" },
    progressOther: { review: CALM, mode: "progress", dayType: "FullA", template: FULLA, current: "Hamstring Curl", button: "Resume workout" },
    cardio: { review: CALM, mode: "today", dayType: "Zone2", template: [], button: "Log cardio" },
    rest: { review: CALM, mode: "rest", dayType: "Rest", template: [], button: "" },
    watch: { review: WATCH, mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" }
  };
  for (const [name, fx] of Object.entries(fixtures)) {
    const p = P0.pickToday(Object.assign({ insights: pool, week: WEEK }, fx));
    const seen = [].concat(ids(p).carried, ids(p).lead, ids(p).digest).sort();
    assert.deepStrictEqual(seen, p.pool.map(x => x.id).sort(), name + ": each pool item exactly once");
    assert.ok(p.pool.length <= 3, name + ": at most three coach insights on Today");
  }
  /* The carry rule in the progress state applies only when the cue names that insight's lift. */
  assert.strictEqual(P0.pickToday(Object.assign({ insights: pool }, fixtures.progressMatch)).carried.id, READY.id);
  assert.strictEqual(P0.pickToday(Object.assign({ insights: pool }, fixtures.progressOther)).carried, null);
  const other = P0.pickToday(Object.assign({ insights: pool }, fixtures.progressOther));
  assert.strictEqual(other.lead.item.id, STALL.id, "the uncarried act/watch insight leads instead (watch first)");
  assert.strictEqual(P0.pickToday(Object.assign({ insights: list(CARDIO, STREAK) }, fixtures.cardio)).carried.id, CARDIO.id, "a walk day carries the cardio insight");
});

test("T6 the digest count equals its rows; last week counts only while unseen; at most three coach insights", () => {
  const five = list(READY, STALL, CARDIO, STREAK, BEHIND);
  const p = P0.pickToday({ review: CALM, insights: five, week: WEEK, mode: "progress", dayType: "FullA", template: FULLA, current: "Hamstring Curl", button: "Resume workout" });
  assert.strictEqual(p.count, p.digest.length);
  assert.deepStrictEqual(plain(p.digest.map(d => d.kind)), ["insight", "insight", "decision", "week"]);
  assert.deepStrictEqual(p.pool.map(x => x.id), [READY.id, STALL.id, CARDIO.id], "the engine's first three, in its order");
  const seen = P0.pickToday({ review: CALM, insights: five, week: Object.assign({}, WEEK, { seen: true }), mode: "progress", dayType: "FullA", template: FULLA, current: "Hamstring Curl" });
  assert.strictEqual(seen.count, p.count - 1);
  assert.ok(!seen.digest.some(d => d.kind === "week"));
  const empty = P0.pickToday({ review: CALM, insights: list(), mode: "today", dayType: "FullA", template: FULLA });
  assert.strictEqual(empty.count, 0, "header omitted at 0");
});

test("T7 a Decision displaced by an insight is in the digest; weight.review and the Decision never both show", () => {
  const p = P0.pickToday({ review: WATCH, insights: list(WREVIEW, BEHIND, STREAK), mode: "today", dayType: "FullA", template: FULLA });
  assert.ok(!p.pool.some(x => x.id === "weight.review"), "weight.review is the Decision's own headline");
  assert.strictEqual(p.lead.kind, "decision");
  assert.ok(!p.digest.some(d => d.kind === "decision"));
  const q = P0.pickToday({ review: CALM, insights: list(BEHIND, STREAK), mode: "today", dayType: "FullA", template: FULLA });
  assert.strictEqual(q.lead.kind, "insight");
  assert.strictEqual(q.digest.filter(d => d.kind === "decision").length, 1, "the Decision moves to the digest, not away");
  assert.strictEqual(q.digest.findIndex(d => d.kind === "decision"), q.digest.length - 1, "after the insight rows (no unseen week here)");
});

/* =========================================================================
   The cue, de-duplication, the context line (T8–T10)
   ========================================================================= */
let wserial = 0;
function setsOf(date, exercise, list, extra) {
  return list.map(([weight, reps], i) => Object.assign({ id: "t" + (++wserial), date, exercise, gym: "Gym A", setType: "working", setNum: i + 1, weight, reps, rir: "", ts: Date.parse(date + "T10:00:00Z") + i * 60000 }, extra || {}));
}
function mornings(from, to, startKg, perDay) {
  const out = []; let i = 0;
  for (let d = from; d <= to; d = add(d, 1), i++) {
    const noise = (((i * 37) % 11) - 5) / 50;
    out.push({ id: "w" + (++wserial), date: d, weight: Math.round((startKg + perDay * i + noise) * 10) / 10, timeOfDay: "Morning", ts: Date.parse(d + "T07:30:00Z") });
  }
  return out;
}
/* Monday 19 Oct (Full A). Incline Dumbbell Press went 30 × 13 on 12 Oct, past the top of 8–12, so coachFor()
   steps the load (the coach suite's trainWorld). A fast loss makes the weight decision "Losing quickly". */
function holdWorld(perDay) {
  const fx = world({ today: "2026-10-19", logs: [
    ...setsOf("2026-10-05", "Incline Dumbbell Press", [[30, 12], [30, 11], [30, 10]], { dayType: "FullA" }),
    ...setsOf("2026-10-12", "Incline Dumbbell Press", [[30, 13], [30, 12], [30, 11]], { dayType: "FullA" })] });
  fx.state.bws = mornings("2026-09-01", "2026-10-19", perDay === undefined ? 86 : 92, perDay === undefined ? -0.05 : perDay);
  return fx;
}

test("T8 the cue is coachAdvice(ex): under a cautious decision it shows the coordinator's hold, never aimFor()'s step", () => {
  const { N, P } = load(holdWorld(-0.18));
  assert.deepStrictEqual([N.review().tone, N.review().title, N.coachFor("Incline Dumbbell Press").kind], ["watch", "Losing quickly", "load"]);
  const tpl = N.templateFor("FullA", "Gym A");
  const cue = P.cueFor({ mode: "today", dayType: "FullA", template: tpl, done: {}, carried: null, advice: ex => N.coach.trainAdvice(ex) });
  assert.strictEqual(cue.ex, "Incline Dumbbell Press");
  assert.strictEqual(cue.headline, "Hold 30 kg — weight decision reads “Losing quickly”");
  assert.strictEqual(cue.hold, true);
  assert.notStrictEqual(cue.headline, N.coachFor("Incline Dumbbell Press").headline, "never the engine's step");
  assert.ok(cue.headline.indexOf(String(N.aimFor("Incline Dumbbell Press").weight)) === -1, "aimFor()'s 32.5 kg is not the cue");
  assert.deepStrictEqual(plain(cue.target), { weight: 30, reps: 13 }, "the first set's target, from the same advice");
  /* Steady weight: the cue is the engine's own step, word for word. */
  const steady = load(holdWorld());
  const c2 = steady.P.cueFor({ mode: "today", dayType: "FullA", template: tpl, done: {}, advice: ex => steady.N.coach.trainAdvice(ex) });
  assert.strictEqual(c2.headline, steady.N.coachFor("Incline Dumbbell Press").headline);
  /* Today's card passes coachAdvice (trainAdvice + the plain coach fallback) and nothing else. */
  assert.ok(UI_SRC.indexOf("carried:pick.carried,advice:coachAdvice})") !== -1);
  assert.ok(UI_SRC.indexOf("const a=N.coach&&typeof N.coach.trainAdvice==='function'?N.coach.trainAdvice(ex):null;") !== -1);
  /* During: the selected exercise while it has sets left, else the first with sets left; target = sets[done]. */
  const during = P.cueFor({ mode: "progress", dayType: "FullA", template: tpl, done: { "Incline Dumbbell Press": 3, "Chest Supported T-Bar Row": 1 }, selected: "Incline Dumbbell Press", advice: ex => ({ headline: "h " + ex, sets: [{ weight: 40, reps: 10 }, { weight: 42.5, reps: 9 }] }) });
  assert.deepStrictEqual(plain([during.kind, during.ex, during.setNo, during.target]), ["now", "Chest Supported T-Bar Row", 2, { weight: 42.5, reps: 9 }]);
  /* Nothing to say: no cue (no filler). */
  assert.strictEqual(P.cueFor({ mode: "today", dayType: "FullA", template: tpl, done: {}, advice: () => null }), null);
  assert.strictEqual(P.cueFor({ mode: "complete", dayType: "FullA", template: tpl, done: {}, advice: () => ({ headline: "x" }) }), null);
  assert.strictEqual(P.cueFor({ mode: "today", dayType: "Zone2", template: [], done: {}, carried: null }), null);
  const cardio = P.cueFor({ mode: "today", dayType: "Zone2", template: [], done: {}, carried: CARDIO });
  assert.deepStrictEqual(plain([cardio.kind, cardio.headline, cardio.note]), ["cardio", CARDIO.title, CARDIO.why.canDo], "the carried insight's own words, verbatim");
});

test("T9 de-dupe: a lead action that opens Train is hidden while the focus button is Start, Resume or Finish", () => {
  const lead = btn => P0.pickToday({ review: CALM, insights: list(READY), mode: "progress", dayType: "FullA", template: FULLA, current: "Hamstring Curl", button: btn }).lead;
  assert.strictEqual(lead("Start workout").item.id, READY.id);
  for (const b of ["Start workout", "Resume workout", "Finish workout"]) assert.strictEqual(lead(b).hideAction, true, b);
  for (const b of ["View session", "Log cardio", "", undefined]) assert.strictEqual(lead(b).hideAction, false, String(b));
  const other = P0.pickToday({ review: CALM, insights: list(BEHIND), mode: "today", dayType: "FullA", template: FULLA, button: "Start workout" }).lead;
  assert.strictEqual(other.hideAction, false, "an action elsewhere stays");
});

test("T10 the context line: fixed fragments, no kg, no /wk, no date after today; the cut week only with a finite cutStart", () => {
  const T = "2026-10-21";
  const week = [["2026-10-19", "FullA", "finished"], ["2026-10-20", "Zone2", "done"], ["2026-10-21", "FullB", "today"], ["2026-10-22", "Zone2", "planned"],
    ["2026-10-23", "FullC", "planned"], ["2026-10-24", "Zone2", "planned"], ["2026-10-25", "Rest", "planned"]].map(([date, type, k]) => ({ date, type, k, lift: /^Full/.test(type) }));
  const base = { date: T, week, gym: "Gym A", cardioMin: 30, cardioTarget: 90 };
  const lines = {
    lift: P0.todayLine(Object.assign({}, base, { k: "today", dayType: "FullB", lift: true })),
    finished: P0.todayLine(Object.assign({}, base, { k: "finished", dayType: "FullB", lift: true, finishedAt: "10:00" })),
    moved: P0.todayLine(Object.assign({}, base, { k: "today", dayType: "FullB", lift: true, movedFrom: "2026-10-19" })),
    walk: P0.todayLine(Object.assign({}, base, { date: "2026-10-22", k: "today", dayType: "Zone2", lift: false })),
    rest: P0.todayLine(Object.assign({}, base, { date: "2026-10-25", k: "today", dayType: "Rest", lift: false, next: { label: "Full Body A", date: "2026-10-26" } })),
    excused: P0.todayLine(Object.assign({}, base, { k: "excused", dayType: "FullB", lift: true, reason: "sick" }))
  };
  const text = l => l.map(f => f.t).join(" · ");
  assert.deepStrictEqual(Object.fromEntries(Object.entries(lines).map(([k, l]) => [k, text(l)])), {
    lift: "Lifting day 2 of 3 · Gym A",
    finished: "Lifting day 2 of 3 · finished 10:00",
    moved: "Moved from Mon 19 Oct · Lifting day 2 of 3",
    walk: "Walk day 2 of 3 · 30/90 cardio min this week",
    rest: "Rest day · Next: Full Body A Mon",
    excused: "Excused · sick"
  });
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  for (const [k, l] of Object.entries(lines)) {
    const t = text(l);
    assert.ok(!/kg|\/wk/.test(t), k + ": no weight or rate");
    for (const m of t.matchAll(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g)) {
      const d = new Date(Date.UTC(2026, MON[m[2]], Number(m[1]))).toISOString().slice(0, 10);
      assert.ok(d <= (k === "walk" ? "2026-10-22" : k === "rest" ? "2026-10-25" : T), k + ": no future date (" + d + ")");
    }
    assert.strictEqual(l.cutWeek, null, k + ": no cut week without cutStart (seed)");
  }
  /* An excused or moved day does not count as a lifting position. */
  const ex = week.map(x => x.date === "2026-10-19" ? Object.assign({}, x, { k: "excused" }) : x);
  assert.strictEqual(text(P0.todayLine(Object.assign({}, base, { week: ex, k: "today", dayType: "FullB", lift: true }))), "Lifting day 1 of 2 · Gym A");
  /* A future "moved from" is not a fragment (it would be a future date). */
  assert.strictEqual(text(P0.todayLine(Object.assign({}, base, { k: "today", dayType: "FullB", lift: true, movedFrom: "2026-10-23" }))), "Lifting day 2 of 3 · Gym A");
  /* Cut week: only with a finite cutStart; display only (D31). */
  assert.strictEqual(P0.todayLine(Object.assign({}, base, { k: "today", dayType: "FullB", lift: true, cutStart: "2026-07-20" })).cutWeek, 14);
  for (const bad of [null, undefined, "", "not a date", 0]) assert.strictEqual(P0.todayLine(Object.assign({}, base, { k: "today", lift: true, cutStart: bad })).cutWeek, null, String(bad));
  assert.strictEqual(P0.todayLine(Object.assign({}, base, { k: "today", lift: true, cutStart: "2026-11-01" })).cutWeek, null, "a cut that has not started has no week");
});

/* =========================================================================
   Lifts evidence and the read itself (T11–T12)
   ========================================================================= */
test("T11 the Lifts summary reads the last completed session, never today's open one", () => {
  const dates = ["2026-10-12", "2026-10-16", "2026-10-19"];
  assert.strictEqual(P0.lastLiftSession(dates, "2026-10-19", false), "2026-10-16", "today in progress is not a result yet");
  assert.strictEqual(P0.lastLiftSession(dates, "2026-10-19", true), "2026-10-19", "once finished, today is the last session");
  assert.strictEqual(P0.lastLiftSession(["2026-10-19"], "2026-10-19", false), null);
  assert.strictEqual(P0.lastLiftSession(["2026-10-21", "2026-10-16"], "2026-10-19", false), "2026-10-16", "never a future day");
  const home = UI_SRC.slice(UI_SRC.indexOf("function home() {"), UI_SRC.indexOf("function coachDeck()"));
  assert.ok(home.indexOf("lastLiftSession([...new Set(work.map(row=>row.date))],state.date,!!N.planDone())") !== -1, "Today's Lifts reads it");
});

test("T12 the picker, the line and the cue write nothing", () => {
  const { N, P, io, ctx } = load(holdWorld(-0.18));
  const before = JSON.stringify([ctx.state, ctx.settings]);
  const tpl = N.templateFor("FullA", "Gym A");
  const insights = N.coach.insights();
  const p = P.pickToday({ review: N.review(), insights, week: N.coach.weekReview(), mode: "today", dayType: "FullA", template: tpl.map(e => e.name), button: "Start workout" });
  P.cueFor({ mode: "today", dayType: "FullA", template: tpl, done: {}, carried: p.carried, advice: ex => N.coach.trainAdvice(ex) });
  P.todayLine({ date: "2026-10-19", k: "today", dayType: "FullA", lift: true, gym: "Gym A", week: N.coach.context().week.days.map(x => ({ date: x.date, type: x.type, lift: /^Full/.test(x.type), k: P.dayState(x.date, null, x).k })), lead: p.lead });
  P.lastLiftSession(["2026-10-12"], "2026-10-19", false);
  assert.strictEqual(JSON.stringify([ctx.state, ctx.settings]), before);
  assert.deepStrictEqual([io.persist, io.save, io.render], [0, 0, 0]);
  for (const f of ["pickToday", "todayLine", "cueFor", "lastLiftSession"]) {
    assert.ok(!/\bpersist\s*\(|\bsave\s*\(|commit\s*\(|localStorage|document\.|innerHTML/.test(P[f].toString()), f + " is pure");
  }
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
