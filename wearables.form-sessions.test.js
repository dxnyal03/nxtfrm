/* NXTFRM "Focusing on form" (D152). Run: node wearables.form-sessions.test.js

   Loads the shipped cut-support.js, coach.js and premium-ui.js into one vm context and pins the engine writer
   (NXT.markForm), the readers (isFormSession, realSessionRows, aimFor, strengthItems), the form verdict
   (liftOutcome, week review) and the finish sheet prompt. Nothing is inferred by the app: only an explicit
   markForm call flags a session. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const plain = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

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
  const io = { persist: 0, save: 0, render: 0, uid: 0, sheet: null };
  const build = () => {
    const sandbox = {
      console: { log() {}, info() {}, error() {}, warn() {} },
      document: {
        getElementById() { return null; }, querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement() { const e = makeElement(); e.querySelector = () => makeElement(); return e; },
        documentElement: { getAttribute() { return null; }, setAttribute() {}, removeAttribute() {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
        body: { appendChild(e) { io.sheet = e; } },
        addEventListener() {}, removeEventListener() {}, activeElement: null, readyState: "complete", title: ""
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      matchMedia() { return { matches: true, addEventListener() {}, removeEventListener() {} }; },
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


/* ---- Fixture ----------------------------------------------------------------
   Today (Mon 19 Oct 2026, Gym A) against the session a week earlier:
   Bench below (57.5 x 8 against 60 x 8), Row beat, Press matched, Curl new (nothing to compare). */
const TODAY = "2026-10-19", PREV = "2026-10-12";
let serial = 0;
function sets(date, exercise, n, weight, reps, extra) {
  return Array.from({ length: n }, (_, i) => Object.assign({ id: "s" + (++serial), date, exercise, gym: "Gym A", setType: "working", dayType: "FullA",
    setNum: i + 1, weight, reps, rir: "", ts: Date.parse(date + "T10:00:00Z") + i * 60000 }, extra || {}));
}
function world(todayRows, extraLogs) {
  const logs = [].concat(
    sets(PREV, "Bench", 3, 60, 8), sets(PREV, "Row", 3, 40, 10), sets(PREV, "Press", 3, 30, 10),
    extraLogs || [],
    todayRows || [].concat(sets(TODAY, "Bench", 3, 57.5, 8), sets(TODAY, "Row", 3, 42.5, 10), sets(TODAY, "Press", 3, 30, 10), sets(TODAY, "Curl", 3, 15, 12)));
  return { state: { date: TODAY, dayType: "FullA", exercise: "", gym: "Gym A", logs, bws: [], cardio: [], floorball: [], scans: [], rest: [], read: {},
    gyms: ["Gym A", "Gym B"], sessionPlans: {}, addOns: {} },
    settings: { weeklyPlan: { 0: "Rest", 1: "FullA", 2: "Zone2", 3: "FullB", 4: "Zone2", 5: "FullC", 6: "Zone2" }, dayOverrides: {}, zone2WeeklyTarget: 90, startWeight: 88,
      cutSupport: { version: 99, recovery: {}, targetConfirmed: false, sessions: {} } } };
}
const rowsOf = (L, date, ex) => L.state.logs.filter(r => r.date === date && r.exercise === ex);

test("markForm writes only the flag, on that exercise's working rows for that date and gym", () => {
  const L = load(world());
  const before = JSON.stringify(L.fx.state.logs);
  // A warm-up on the same lift must never carry the flag.
  L.fx.state.logs.push(Object.assign(sets(TODAY, "Bench", 1, 20, 12)[0], { setType: "warmup" }));
  const snap = JSON.parse(JSON.stringify(L.fx.state.logs));
  assert.strictEqual(L.N.isFormSession(TODAY, "Gym A", "Bench"), false);
  L.N.markForm(TODAY, "Gym A", "Bench", true);
  assert.strictEqual(L.N.isFormSession(TODAY, "Gym A", "Bench"), true);
  const now = L.fx.state.logs;
  now.forEach((r, i) => {
    const hit = r.date === TODAY && r.exercise === "Bench" && r.setType !== "warmup";
    const expect = Object.assign({}, snap[i]); if (hit) expect.form = true;
    assert.deepStrictEqual(plain(r), expect, "row " + i);
  });
  assert.ok(before.length > 0 && L.io.persist >= 1, "saved through the existing persist path");
  L.N.markForm(TODAY, "Gym A", "Bench", false);
  assert.deepStrictEqual(plain(L.fx.state.logs), snap, "unticking restores the rows exactly");
  assert.strictEqual(L.N.markForm(TODAY, "Gym A", "Nothing", true), false, "no rows, no write");
});

test("bestSet/aimFor reference ignores a form session; the next Aim targets the last real best", () => {
  // Real session 12 Oct (60 x 8), form session 19 Oct (57.5 x 8). Planning 26 Oct.
  const L = load(world()); L.fx.state.date = "2026-10-26";
  const aim0 = plain(L.N.aimFor("Bench"));
  assert.strictEqual(aim0.best.weight, 57.5, "unflagged: the most recent session is the reference");
  L.N.markForm(TODAY, "Gym A", "Bench", true);
  const aim1 = plain(L.N.aimFor("Bench"));
  assert.strictEqual(aim1.best.weight, 60);
  assert.strictEqual(aim1.date, PREV);
  assert.deepStrictEqual(plain(L.N.realSessionRows("Bench", "Gym A", "2026-10-26", 100).map(s => s.date)), [PREV]);
  assert.deepStrictEqual(plain(L.N.sessionRows("Bench", "Gym A", "2026-10-26", 100).map(s => [s.date, s.form])), [[PREV, false], [TODAY, true]]);
  assert.strictEqual(L.N.coachFor("Bench").sets[0].weight >= 60, true, "the coach also builds from the real best");
});

test("strengthItems does not read a form session as Review/decline, and the status matches a log without it", () => {
  const dates = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].filter(d => d >= "2026-09-01");
  const mk = formOn => {
    const real = [["2026-09-21", 60], ["2026-09-28", 60], ["2026-10-05", 60], ["2026-10-12", 60]].flatMap(([d, w]) => sets(d, "Squat", 3, w, 8));
    // Two lighter sessions after the real ones: a decline if counted, a deliberate choice when marked.
    const light = ["2026-10-14", "2026-10-17"].flatMap(d => sets(d, "Squat", 3, 40, 8, formOn ? { form: true } : {}));
    return load(world([], real.concat(light)));
  };
  const counted = mk(false).N.strengthItems().find(x => x.name === "Squat");
  const marked = mk(true).N.strengthItems().find(x => x.name === "Squat");
  const without = load(world([], [["2026-09-21", 60], ["2026-09-28", 60], ["2026-10-05", 60], ["2026-10-12", 60]].flatMap(([d, w]) => sets(d, "Squat", 3, w, 8)))).N.strengthItems().find(x => x.name === "Squat");
  assert.ok(["Review", "Watch"].includes(counted.status), "unflagged, the lighter sessions read as a decline (" + counted.status + ")");
  assert.strictEqual(marked.status, without.status, "flagged sessions leave the status as if they were not logged");
  assert.strictEqual(marked.delta, without.delta);
  assert.strictEqual(marked.formSessions, 2);
  assert.strictEqual(marked.latestForm, true);
  assert.ok(dates.length);
});

test("liftOutcome counts a marked below as form, not below; nothing else changes", () => {
  const L = load(world());
  assert.deepStrictEqual(plain(L.P.liftOutcome(TODAY, "Gym A")), { up: 1, same: 1, down: 1, form: 0, compared: 3, exercises: 4 });
  L.N.markForm(TODAY, "Gym A", "Bench", true);
  assert.deepStrictEqual(plain(L.P.liftOutcome(TODAY, "Gym A")), { up: 1, same: 1, down: 0, form: 1, compared: 3, exercises: 4 });
  // A flagged lift that beat last time stays a beat.
  L.N.markForm(TODAY, "Gym A", "Row", true);
  assert.strictEqual(plain(L.P.liftOutcome(TODAY, "Gym A")).up, 1);
});

test("the coach week review counts it as form and keeps below for the rest", () => {
  const L = load(world()); L.fx.state.date = "2026-10-26";
  const wk = () => L.N.coach.weekReview("2026-10-19").outcomes || null;
  const a = wk(); assert.ok(a, "outcomes present");
  assert.deepStrictEqual([a.beat, a.matched, a.below, a.form], [1, 1, 1, undefined]);
  L.N.markForm(TODAY, "Gym A", "Bench", true);
  const b = wk(); assert.deepStrictEqual([b.beat, b.matched, b.below, b.form], [1, 1, 0, 1]);
});

test("the finish sheet lists exactly the below-last-time exercises with their numbers, and nothing when none", () => {
  const L = load(world());
  L.P.finishScene();
  const html = L.io.sheet.innerHTML;
  const names = [...html.matchAll(/class="st-fin-ft"[^>]*data-ex="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(names, ["Bench"]);
  assert.ok(/57\.5 × 8/.test(html) && /60 × 8/.test(html), "numbers now and last time");
  assert.ok(/aria-checked="false"/.test(html));
  // Marked: still listed (so it can be unticked), switch on, receipt tagged.
  L.N.markForm(TODAY, "Gym A", "Bench", true);
  L.io.sheet = null; L.P.finishScene();
  assert.ok(/class="st-fin-ft"[^>]*aria-checked="true"/.test(L.io.sheet.innerHTML));
  assert.ok(/<li data-ex="Bench"><span>Bench<i class="st-fin-tag">Form<\/i>/.test(L.io.sheet.innerHTML));
  // Nothing below: no prompt at all.
  const none = load(world([].concat(sets(TODAY, "Bench", 3, 60, 8), sets(TODAY, "Row", 3, 42.5, 10))));
  none.P.finishScene();
  assert.ok(!/st-fin-form/.test(none.io.sheet.innerHTML.replace(/class="st-fin-form-s"/g, "")), "no section when nothing came in below");
  assert.ok(!/st-fin-ft/.test(none.io.sheet.innerHTML));
});

test("moments: a form session earns no 'New best'", () => {
  const rows = [].concat(sets(TODAY, "Bench", 3, 65, 8, { form: true }), sets(TODAY, "Row", 3, 42.5, 10));
  const L = load(world(rows));
  L.fx.state.logs.forEach(r => { r.ts = r.ts; });
  const names = (L.P.finishScene(), L.io.sheet.innerHTML);
  assert.ok(/New best · Row/.test(names), "an unflagged best still shows");
  assert.ok(!/New best · Bench/.test(names), "a flagged one does not");
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
