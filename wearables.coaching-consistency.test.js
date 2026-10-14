/* NXTFRM coaching consistency (Stage 1). Run: node wearables.coaching-consistency.test.js

   Loads the SHIPPED cut-support.js and coach.js into one vm context (the same
   host double as wearables.coach.test.js) and pins three things:

   1. The three surfaces agree when the shared weight/recovery decision
      (NXT.review()) warrants caution: Today's decision card, the Progress
      diagnosis card (NXT.diagnose()) and Train's coach line
      (NXT.coach.trainAdvice()). Before Stage 1 the Progress card's no_issue
      branch said "Keep the current plan." for any negative slope, including
      the state Today called "Losing quickly".
   2. The one live cause assertion ("This looks like load, not metabolism")
      reads as an observation plus a hypothesis.
   3. Exercise advice says when it lacks effort (reps-in-reserve) data, and
      keeps interpreting historical effort values exactly as before.

   The rate calculation, reference weight, 1 % threshold and the preference
   for the longer-term trend are not touched: every fixture below asks the
   shipped review() what it thinks and only checks that the other surfaces
   say the same. Fixtures are synthetic; weigh-ins are Morning. */
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

/* ---- Host double (index.html's own helpers, instrumented) ------------------- */
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
const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8") + "\n;globalThis.__NXT__ = NXT;\n";
const COACH = fs.readFileSync(path.join(ROOT, "coach.js"), "utf8");

function makeElement() {
  return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 420, height: 290, right: 420, bottom: 290 }; } };
}
function load(fx) {
  const discovered = {};
  const io = { persist: 0, save: 0, render: 0, uid: 0, toasts: [], warns: [] };
  const build = () => {
    const sandbox = {
      console: { log() {}, info() {}, error() {}, warn(...a) { io.warns.push(a.map(String).join(" ")); } },
      document: { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
        createElement() { return makeElement(); }, addEventListener() {}, activeElement: null, readyState: "complete", title: "" },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_k, fb) { return fb; },
      esc(v) { return String(v === null || v === undefined ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
      state: fx.state, settings: fx.settings, __io: io,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "", cloudUser: null, lastCloudSyncAt: null, cloudSyncAgo() { return ""; },
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
    try { vm.runInContext(PRELUDE, ctx, { filename: "index-helpers.js" }); vm.runInContext(CUT, ctx, { filename: "cut-support.js" }); }
    catch (err) { const miss = /(\w+) is not defined/.exec(String(err && err.message)); if (!miss) throw err; discovered[miss[1]] = function () { return null; }; continue; }
    vm.runInContext(COACH, ctx, { filename: "coach.js" });
    const N = ctx.__NXT__;
    return { N, C: N.coach, io, fx, ctx };
  }
  throw new Error("cut-support.js did not load within the stub budget");
}
const plain = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const strip = h => String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* ---- Fixtures --------------------------------------------------------------- */
const SPLIT = { 0: "Rest", 1: "FullA", 2: "Zone2", 3: "FullB", 4: "Zone2", 5: "FullC", 6: "Zone2" };
function add(d, n) { return new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
let serial = 0;
function sets(date, exercise, list, extra) {
  return list.map(([weight, reps, rir], i) => Object.assign({ id: "s" + (++serial), date, exercise, gym: "Gym A", setType: "working",
    setNum: i + 1, weight, reps, rir: rir === undefined ? "" : rir }, extra || {}));
}
function morning(from, to, startKg, perDay) {
  const out = []; let i = 0;
  for (let d = from; d <= to; d = add(d, 1), i++) {
    const noise = (((i * 37) % 11) - 5) / 50;
    out.push({ id: "w" + (++serial), date: d, weight: Math.round((startKg + perDay * i + noise) * 10) / 10, timeOfDay: "Morning", ts: Date.parse(d + "T07:30:00Z") });
  }
  return out;
}
/* Two slopes: `perDay` for the first part of the window, `lastWeekPerDay` for the final 7 days. */
function twoSlopes(from, to, startKg, perDay, lastWeekPerDay, tailDays) {
  const out = []; let i = 0, kg = startKg;
  for (let d = from; d <= to; d = add(d, 1), i++) {
    const inLastWeek = d > add(to, -(tailDays || 7));
    if (i) kg += inLastWeek ? lastWeekPerDay : perDay;
    const noise = (((i * 37) % 11) - 5) / 50;
    out.push({ id: "w" + (++serial), date: d, weight: Math.round((kg + noise) * 10) / 10, timeOfDay: "Morning", ts: Date.parse(d + "T07:30:00Z") });
  }
  return out;
}
function world(o) {
  o = o || {};
  return {
    state: { date: o.today, dayType: "", exercise: "", gym: "Gym A", logs: o.logs || [], bws: o.bws || [], cardio: [], floorball: [], scans: [], rest: [], read: {},
      gyms: ["Gym A", "Gym B"], sessionPlans: {}, addOns: {} },
    settings: { weeklyPlan: Object.assign({}, SPLIT), dayOverrides: {}, zone2WeeklyTarget: 90, startWeight: 92,
      cutSupport: Object.assign({ version: 99, recovery: {}, targetConfirmed: false }, o.cutSupport || {}) },
    targetLow: 78, targetHigh: 80
  };
}
/* Monday 19 Oct 2026 is a Full A day. Incline Dumbbell Press went 30 × 13 on 12 Oct
   (past the top of 8–12), so the engine steps the load (D24). `rirs` sets the
   reps-in-reserve recorded on 12 Oct's three sets ("" = not recorded). */
function liftWorld(perDay, rirs, lastWeekPerDay, tailDays) {
  const today = "2026-10-19", r = rirs || ["", "", ""];
  const logs = [...sets("2026-10-05", "Incline Dumbbell Press", [[30, 12], [30, 11], [30, 10]], { dayType: "FullA" }),
    ...sets("2026-10-12", "Incline Dumbbell Press", [[30, 13, r[0]], [30, 12, r[1]], [30, 11, r[2]]], { dayType: "FullA" })];
  const bws = lastWeekPerDay === undefined ? morning("2026-09-01", today, 92, perDay) : twoSlopes("2026-09-01", today, 92, perDay, lastWeekPerDay, tailDays);
  return world({ today, logs, bws });
}
const DEFAULT = -0.05, FAST = -0.18;

/* ---- 1. Today, Progress and Train agree on caution ------------------------- */
test("fast loss under the shipped calculation: Today reads 'Losing quickly' (fixture precondition)", () => {
  const { N } = load(liftWorld(FAST));
  const r = N.review(), p = N.detectPlateau();
  assert.deepStrictEqual([r.tone, r.title, r.action], ["watch", "Losing quickly", "Review your target"]);
  assert.ok(p.ok && r.change === p.weeklyRate, "the four-week rate is the one the decision uses");
  assert.ok(/four weeks/.test(r.reason), r.reason);
});

test("the Progress diagnosis follows the shared decision when it warrants caution (was 'Keep the current plan')", () => {
  const { N } = load(liftWorld(FAST));
  const r = N.review(), d = N.diagnose();
  assert.strictEqual(d.verdict, "caution");
  assert.strictEqual(d.headline.split(" — ")[0], r.title, "same headline as Today");
  assert.deepStrictEqual(plain(d.actions.map(a => a.text)), [r.action + "."]);
  assert.strictEqual(d.reason, r.reason, "same rate sentence, not a second interpretation");
  assert.ok(!d.actions.some(a => /keep the current plan/i.test(a.text)));
  const labels = d.evidence.map(e => e.label);
  assert.ok(labels.indexOf("Decision") !== -1 && labels.indexOf("Readings") !== -1, labels.join(","));
  const readings = d.evidence.find(e => e.label === "Readings").value;
  assert.ok(/^\d+ over \d+ days$/.test(readings), readings);
  const card = strip(N.diagnosisCard());
  assert.ok(card.indexOf("Losing quickly") !== -1 && card.indexOf("Keep the current plan") === -1, card.slice(0, 200));
});

test("normal loss: Today 'Cutting steadily', Progress 'Cut is progressing' with 'Keep the current plan' — unchanged", () => {
  const { N } = load(liftWorld(DEFAULT));
  const r = N.review(), d = N.diagnose();
  assert.ok(/^Cutting steadily/.test(r.title), r.title);
  assert.strictEqual(r.tone, "good", "the shipped tone for a steady cut");
  assert.deepStrictEqual(plain([d.verdict, d.headline, d.actions[0].text]), ["no_issue", "Cut is progressing.", "Keep the current plan."]);
  assert.strictEqual(N.caution().cautious, false);
});

test("insufficient evidence: both surfaces say so, neither is cautious", () => {
  /* Six flat readings: too few for a plateau call, no downward slope for the forecast.
     (Six FALLING readings already reach no_issue on shipped code via forecastGoal — a
     pre-existing threshold question, out of Stage 1's scope and noted in the report.) */
  const { N } = load(world({ today: "2026-10-19", bws: morning("2026-10-14", "2026-10-19", 92, 0) }));
  const r = N.review(), d = N.diagnose();
  assert.strictEqual(r.title, "Building your baseline");
  assert.strictEqual(d.verdict, "insufficient_context");
  assert.strictEqual(N.caution().cautious, false);
});

test("conflicting trends A: a steep last week over a gentle month does not make the decision cautious, and Progress agrees", () => {
  const { N } = load(liftWorld(DEFAULT, undefined, -0.25));
  const r = N.review(), p = N.detectPlateau(), s = N.trendStats(), d = N.diagnose();
  assert.ok(s.change < -1.0, "the seven-day change is steep: " + s.change);
  assert.ok(p.ok && Math.abs(p.weeklyRate) < Math.abs(s.change), "the four-week rate is gentler: " + p.weeklyRate + " vs " + s.change);
  assert.strictEqual(r.change, p.weeklyRate, "the shipped decision prefers the longer-term rate");
  /* Whatever the shipped rule concludes from that rate, every surface says the same. */
  const careful = N.caution().cautious;
  assert.strictEqual(careful, N.cautionOf(r));
  assert.strictEqual(d.verdict, careful ? "caution" : "no_issue");
  if (!careful) assert.ok(!/Losing/.test(d.headline));
});

test("conflicting trends B: a flattening tail after a steep month stays cautious on the four-week rate, and Progress agrees", () => {
  /* Three weeks at -0.3 kg/day, then ten flat days. The seven-day window compares consecutive
     weekly averages, so it reads a fraction of the four-week rate; the decision still uses the
     four-week rate (D37) and the other surfaces follow it. */
  const { N } = load(liftWorld(-0.3, undefined, 0, 10));
  const r = N.review(), p = N.detectPlateau(), s = N.trendStats(), d = N.diagnose();
  assert.ok(p.ok && p.weeklyRate < -0.9, "the four-week rate is steep: " + p.weeklyRate);
  assert.ok(Math.abs(s.change) < Math.abs(p.weeklyRate) * 0.6, "the recent change is clearly smaller: " + s.change + " vs " + p.weeklyRate);
  assert.strictEqual(r.change, p.weeklyRate, "the shipped decision prefers the longer-term rate");
  assert.strictEqual(r.title, "Losing quickly");
  assert.strictEqual(d.verdict, "caution");
  assert.strictEqual(d.headline.split(" — ")[0], "Losing quickly");
});

test("coordinator hold (existing) and the new predicate are one rule, applied on all three surfaces", () => {
  const { N, C } = load(liftWorld(FAST));
  const r = N.review();
  assert.strictEqual(N.cautionOf(r), true);
  const t = C.trainAdvice("Incline Dumbbell Press");
  assert.deepStrictEqual([t.kind, t.coordinated.hold, t.coordinated.reason], ["hold", true, "Weight decision reads “Losing quickly”"]);
  assert.strictEqual(N.diagnose().headline.split(" — ")[0], r.title);
  const insight = C.insights().all.find(x => x.id === "strength.hold");
  assert.ok(insight && insight.body.indexOf("“Losing quickly”") !== -1);
  /* Not cautious: Train steps up as the engine says, Progress keeps the plan. */
  const calm = load(liftWorld(DEFAULT));
  assert.deepStrictEqual([calm.N.cautionOf(calm.N.review()), calm.C.trainAdvice("Incline Dumbbell Press").kind, calm.N.diagnose().verdict], [false, "load", "no_issue"]);
});

/* ---- 2. The live cause assertion reads as observation + hypothesis ---------- */
function plateauWithLiftsDown() {
  const today = "2026-10-19";
  const flat = morning("2026-08-20", today, 88, 0);
  const logs = [];
  /* Lat Pulldown and Leg Press weekly; the last two sessions are ~12 % lighter. */
  const weeks = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];
  weeks.forEach((d, i) => {
    const drop = i >= 4 ? 0.88 : 1;
    logs.push(...sets(d, "Lat Pulldown", [[50 * drop, 10], [50 * drop, 9], [50 * drop, 8]], { dayType: "FullB" }));
    logs.push(...sets(d, "Leg Press", [[120 * drop, 10], [120 * drop, 9], [120 * drop, 8]], { dayType: "FullA" }));
  });
  return world({ today, logs, bws: flat });
}
test("recovery_deficit: observation and hypothesis, no assertion about what the cause is not", () => {
  const { N } = load(plateauWithLiftsDown());
  const p = N.detectPlateau(), down = N.strengthItems().filter(x => x.delta !== null && x.delta <= -8);
  assert.ok(p.plateau === true, "fixture reaches a plateau: " + JSON.stringify({ ok: p.ok, status: p.status, rate: p.weeklyRate }));
  assert.ok(down.length >= 2, "fixture has two lifts down ≥ 8 %: " + down.map(x => x.name + " " + x.delta).join(", "));
  const d = N.diagnose();
  assert.strictEqual(d.verdict, "recovery_deficit");
  assert.ok(!/not metabolism|looks like/i.test(d.headline), d.headline);
  assert.ok(/hypothesis/i.test(d.headline), d.headline);
  assert.ok(/lifts? (are|is) down|down/i.test(d.headline), d.headline);
  assert.ok(d.evidence.some(e => e.label === "Strength"), "the evidence row survives");
  assert.strictEqual(d.reason, "Two or more lifts dropped at least 8%.");
  assert.ok(!/deload/i.test(d.actions[0].text), d.actions[0].text);
});

/* ---- 3. Missing, present and mixed effort ----------------------------------- */
test("missing effort: the increase is still suggested, and the advice says it rests on reps alone", () => {
  const { N, C } = load(liftWorld(DEFAULT, ["", "", ""]));
  const c = N.cue("Incline Dumbbell Press"), k = N.coachFor("Incline Dumbbell Press"), a = N.aimFor("Incline Dumbbell Press");
  assert.deepStrictEqual(plain(c.effort), { known: 0, sets: 3, state: "none" });
  assert.deepStrictEqual([c.label, c.weight, a.kind, a.weight, k.kind, k.headline, k.weight], ["Ready to consider an increase", 32.5, "load", 32.5, "load", "Add 2.5 kg", 32.5], "D24/D25 unchanged");
  assert.ok(/not recorded/.test(k.note) && /reps alone/.test(k.note), k.note);
  assert.deepStrictEqual(plain(k.effort), { known: 0, sets: 3, state: "none" });
  const t = C.trainAdvice("Incline Dumbbell Press");
  assert.deepStrictEqual(plain(t.effort), { known: 0, sets: 3, state: "none" });
  const ready = C.insights().all.find(x => x.id === "strength.ready");
  assert.ok(ready && ready.evidence.some(e => e.label === "Effort" && /not recorded/.test(e.value)), JSON.stringify(ready && ready.evidence));
});

test("present historical effort: a logged reserve of 1 still holds the load (D24), and a logged 3 carries no caveat", () => {
  const low = load(liftWorld(DEFAULT, [1, 3, 3]));
  assert.strictEqual(low.N.aimFor("Incline Dumbbell Press").why, "Low reserve · hold");
  assert.deepStrictEqual([low.N.coachFor("Incline Dumbbell Press").kind, low.N.coachFor("Incline Dumbbell Press").headline], ["hold", "Keep a rep in hand"]);
  assert.deepStrictEqual(plain(low.N.cue("Incline Dumbbell Press").effort), { known: 3, sets: 3, state: "full" });
  const full = load(liftWorld(DEFAULT, [3, 3, 2]));
  const k = full.N.coachFor("Incline Dumbbell Press");
  assert.deepStrictEqual([k.kind, k.headline], ["load", "Add 2.5 kg"]);
  assert.ok(!/not recorded|reps alone/.test(k.note), k.note);
  assert.deepStrictEqual(plain(k.effort), { known: 3, sets: 3, state: "full" });
  const ready = full.C.insights().all.find(x => x.id === "strength.ready");
  assert.ok(ready && !ready.evidence.some(e => e.label === "Effort"), "no caveat row when effort is complete");
});

test("mixed effort: one recorded set of three is named, the rest rests on reps alone", () => {
  const { N } = load(liftWorld(DEFAULT, [3, "", ""]));
  const c = N.cue("Incline Dumbbell Press"), k = N.coachFor("Incline Dumbbell Press");
  assert.deepStrictEqual(plain(c.effort), { known: 1, sets: 3, state: "partial" });
  assert.ok(/1 of 3 sets/.test(k.note) && /reps alone/.test(k.note), k.note);
  assert.strictEqual(k.kind, "load");
});

test("effort is reported only for the session being compared; warm-ups never count", () => {
  const w = liftWorld(DEFAULT, ["", "", ""]);
  w.state.logs.push(...sets("2026-10-12", "Incline Dumbbell Press", [[20, 10, 4]], { dayType: "FullA", setType: "warmup" }));
  const { N } = load(w);
  assert.deepStrictEqual(plain(N.cue("Incline Dumbbell Press").effort), { known: 0, sets: 3, state: "none" });
});

/* ---- 4. Read-only and deterministic ------------------------------------------ */
test("caution(), diagnose() and coachFor() write nothing and are deterministic", () => {
  const { N, io } = load(liftWorld(FAST));
  io.persist = 0; io.save = 0;
  const a = plain([N.caution(), N.diagnose(), N.coachFor("Incline Dumbbell Press").effort]);
  const b = plain([N.caution(), N.diagnose(), N.coachFor("Incline Dumbbell Press").effort]);
  assert.deepStrictEqual(a, b);
  /* cue() keeps its pre-existing suggestion log write (persist); caution() and diagnose() add none. */
  const before = io.persist; N.caution(); N.diagnose(); assert.strictEqual(io.persist, before);
});

console.log(`\n${failed ? "FAILED" : "OK"}  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
