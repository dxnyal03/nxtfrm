/* NXTFRM forecast time semantics (proposed D104). Run: node wearables.forecast-time.test.js

   Executes the shipped cut-support.js (and coach.js for the weigh-in nudge) against one fixed cut and reads it
   on different calendar days, with no new weigh-in in between. The forecast itself must not move: forecastGoal()
   never reads the calendar. What these tests pin is how its weeks become dates: one arrival, anchored at the
   model origin (the last trend-ready morning), printed the same everywhere; weeks "away" counted from today;
   a freshness state (fresh / aging / stale / expired) kept apart from the model's confidence; and no surface
   printing an arrival on or before the day it is read, or a goal ETA without a confirmed goal. Nothing here
   touches storage. The fixture is the stage-1 forecast probe's own (seed 7, sd 0.22, 0.45 kg a week). */
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
   cut-support.js and coach.js are browser scripts closing over globals defined in index.html. Supply just
   enough for them to load (the day-plan helpers are index.html's own, as in the coach suite); none of it
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
const PRELUDE = `
const PLAN={1:{type:"FullA"},2:{type:"Zone2"},3:{type:"FullB"},4:{type:"Zone2"},5:{type:"FullC"},6:{type:"Zone2"},0:{type:"Rest"}};
const TEMPLATES={};
function dayOfWeekFor(date){const ms=Date.parse(String(date)+"T12:00:00");return Number.isFinite(ms)?new Date(ms).getDay():new Date().getDay();}
function planTypeForDow(dow){return (settings.weeklyPlan&&settings.weeklyPlan[dow])||(PLAN[dow]&&PLAN[dow].type)||"Rest";}
function resolveDayType(date){const key=date||(typeof state==="object"&&state?state.date:null);if(!key)return "Rest";const override=settings.dayOverrides&&settings.dayOverrides[key];if(override)return override;return planTypeForDow(dayOfWeekFor(key));}
function sessionKey(type=state.dayType,date=state.date,gym=state.gym){return \`\${date}__\${gym||"Gym"}__\${type}\`;}
function getT(n){return Object.values(TEMPLATES).flat().find(e=>e.name===n)}
function persist(){} function save(){} function toast(){} function render(){} function closeModal(){}
let __uid=0; function uid(){return "u"+(++__uid);}
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
  "apx95SaveQuickWeight", "saveEditedSet"];

const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8")
  /* `const NXT = ...` is a lexical binding and never lands on the vm global. */
  + "\n;globalThis.__NXT__ = NXT;\n";
const COACH = fs.readFileSync(path.join(ROOT, "coach.js"), "utf8");

function load(fx) {
  const discovered = {};
  const build = () => {
    const sandbox = {
      console: { log() {}, info() {}, error() {}, warn() {} },
      document: {
        getElementById() { return null; }, querySelector() { return null; },
        querySelectorAll() { return []; }, createElement() { return makeElement(); },
        addEventListener() {}, activeElement: null, readyState: "complete", title: ""
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_key, fallback) { return fallback; },
      /* Real, not a stub: the views pipe copy through esc(), and these tests read that markup. */
      esc(v) { return String(v === null || v === undefined ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
      state: fx.state,
      settings: fx.settings,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null, cloudSyncAgo() { return ""; },
      TARGET_LOW: fx.targetLow, TARGET_HIGH: fx.targetHigh, START_WEIGHT: fx.startWeight,
      goalLow() { return Math.min(fx.targetLow, fx.targetHigh); },
      goalHigh() { return Math.max(fx.targetLow, fx.targetHigh); }
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
    return ctx.__NXT__;
  }
  throw new Error("cut-support.js did not load within the stub budget");
}

/* ---- Fixture -------------------------------------------------------------------------------------------
   69 synthetic morning readings, 3 Aug to 18 Oct 2026: a steady 0.45 kg a week from 87.0 with seeded gaussian
   noise (sd 0.22, mulberry32 seed 7) and a skipped morning every ninth day. Goal 76.5–78.4. The last weigh-in is
   18 Oct on every view date; only the calendar moves. */
const FIRST = "2026-08-03", LAST = "2026-10-18";
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function buildRows() {
  const rnd = mulberry32(7);
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const rows = [], d0 = Date.parse(FIRST + "T12:00:00Z"), d1 = Date.parse(LAST + "T12:00:00Z");
  for (let t = d0, i = 0; t <= d1; t += 864e5, i++) {
    const date = new Date(t).toISOString().slice(0, 10), noise = gauss() * 0.22;
    if (i % 9 === 5 && date !== LAST) continue;
    rows.push({ id: "fx" + i, date, weight: Math.round((87.0 - (0.45 / 7) * i + noise) * 10) / 10, timeOfDay: "Morning", ts: t });
  }
  return rows;
}
/* The gap-restart variant: back after an 11-day break with two mornings, 29 and 30 Oct. The trend restarts after
   more than three days and needs three readings, so the model origin stays at 18 Oct. */
const RESTART = [
  { id: "r1", date: "2026-10-29", weight: 81.3, timeOfDay: "Morning", ts: Date.parse("2026-10-29T07:30:00Z") },
  { id: "r2", date: "2026-10-30", weight: 81.2, timeOfDay: "Morning", ts: Date.parse("2026-10-30T07:30:00Z") }
];
function view(date, o = {}) {
  const N = load({
    state: { date, bws: buildRows().concat(o.extra || []), logs: [], cardio: [], floorball: [], scans: [], rest: [], sessionPlans: {}, read: {},
      gyms: ["Gym A"], dayType: "Rest", gym: "Gym A", addOns: {} },
    settings: { cutSupport: { version: 99, recovery: {}, targetConfirmed: o.confirmed !== false }, cutStart: FIRST, startWeight: 87 },
    targetLow: 76.5, targetHigh: o.targetHigh || 78.4, startWeight: 87
  });
  N.ui.range = o.range || 30;
  return N;
}
const plain = v => JSON.parse(JSON.stringify(v));
const r4 = v => (v === null || v === undefined ? v : Math.round(v * 10000) / 10000);
const strip = h => String(h).replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
/* Every user-facing string the engine renders for the weight forecast on a given day. The chart pill, the what-if
   and the story are drawn by strata.js in the page and are checked in the browser. */
function surfaces(N) {
  N.ui.showForecast = true;
  const out = { review: N.review().message, reviewCard: strip(N.reviewCard(true)), diagnosis: strip(N.diagnosisCard()),
    diagnose: N.diagnose().evidence.map(e => e.label + ": " + e.value).join(" | "), chart: strip(N.chartHTML()), journey: strip(N.journeyHTML()) };
  N.ui.range = "cut";
  out.cut = strip(N.chartHTML());
  N.ui.range = 30; N.ui.showForecast = false;
  return out;
}
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };
/* "13 Dec" → 2026-12-13; this cut runs Aug 2026 to early 2027, so Jan–Jun belong to 2027. */
function iso(dm) {
  const m = /^(\d{1,2}) ([A-Z][a-z]{2,3})$/.exec(dm);
  if (!m) return null;
  const mo = MONTHS[m[2]], y = mo < 7 ? 2027 : 2026;
  return `${y}-${String(mo).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}
/* Arrival-like dates: "around 13 Dec", "~13 Dec" (goal label and the next-kilogram estimate). */
function arrivals(text) {
  const out = [];
  for (const m of String(text).matchAll(/(?:around|~)\s*(\d{1,2} [A-Z][a-z]{2,3})\b/g)) out.push(iso(m[1]));
  return out;
}

const VIEWS = ["2026-10-18", "2026-10-25", "2026-11-15", "2026-12-13"];

/* =========================================================================
   1 · The forecast does not move; its date does not either.
   ========================================================================= */
test("the engine is unchanged: forecastGoal reads the same on every view date", () => {
  for (const d of VIEWS) {
    const f = plain(view(d).forecastGoal());
    assert.deepStrictEqual([f.ok, f.weeks, f.lowWeeks, f.highWeeks, f.confidence, f.lastDate, r4(f.slope * 7), r4(f.fittedLevel)],
      [true, 8, 7, 10, "high", "2026-10-18", -0.4415, 82.0543], d);
  }
});

test("arrival is anchored at the model origin: 13 Dec (6–27 Dec) viewed 18 Oct, 25 Oct, 15 Nov and 13 Dec", () => {
  for (const d of VIEWS) {
    const v = plain(view(d).forecastView());
    assert.deepStrictEqual([v.modelOriginDate, v.lastObservationDate, v.calculationDate], ["2026-10-18", "2026-10-18", d], d);
    assert.deepStrictEqual([v.arrivalDate, v.arrivalLow, v.arrivalHigh], ["2026-12-13", "2026-12-06", "2026-12-27"], d);
    /* Weeks still count from the origin, exactly as forecastGoal returns them. */
    assert.deepStrictEqual([v.weeks, v.lowWeeks, v.highWeeks, v.modelConfidence], [8, 7, 10, "high"], d);
    assert.strictEqual(r4(v.slopeKgWk), -0.4415);
    assert.strictEqual(r4(v.originLevel), 82.0543);
  }
});

test("freshness: fresh on 18 Oct, aging on 25 Oct, expired on 15 Nov and 13 Dec; confidence stays the model's", () => {
  const got = VIEWS.map(d => { const v = view(d).forecastView(); return [d, v.freshness, v.daysSinceOrigin, v.modelConfidence]; });
  assert.deepStrictEqual(plain(got), [["2026-10-18", "fresh", 0, "high"], ["2026-10-25", "aging", 7, "high"],
    ["2026-11-15", "expired", 28, "high"], ["2026-12-13", "expired", 56, "high"]]);
});

test("freshness thresholds reuse the app's own: 3 days (EWMA gap), 14 (coach STALE_DAYS), 21 (forecast window)", () => {
  const at = { "2026-10-21": "fresh", "2026-10-22": "aging", "2026-11-01": "aging", "2026-11-02": "stale", "2026-11-08": "stale", "2026-11-09": "expired" };
  for (const d of Object.keys(at)) assert.strictEqual(view(d).forecastView().freshness, at[d], d);
});

test("a forecast whose earliest arrival has come is expired, even inside 14 days", () => {
  /* Goal 81.6: about a week out from 82.05 at −0.44 kg a week, so the earliest arrival is 25 Oct. */
  const v = plain(view("2026-10-25", { targetHigh: 81.6 }).forecastView());
  assert.strictEqual(v.arrivalLow, "2026-10-25");
  assert.strictEqual(v.daysSinceOrigin, 7);
  assert.deepStrictEqual([v.freshness, v.current, v.showArrival], ["expired", false, false]);
  assert.strictEqual(view("2026-10-24", { targetHigh: 81.6 }).forecastView().freshness, "aging");
});

test("weeks away count from today to the anchored date, and are never 0 while it is still ahead", () => {
  const got = ["2026-10-18", "2026-10-25", "2026-11-01"].map(d => { const v = view(d).forecastView(); return [v.weeksRemaining, v.lowWeeksRemaining, v.highWeeksRemaining]; });
  assert.deepStrictEqual(plain(got), [[8, 7, 10], [7, 6, 9], [6, 5, 8]]);
  const near = view("2026-10-24", { targetHigh: 81.6 }).forecastView();
  assert.ok(near.arrivalDate > "2026-10-24" && near.weeksRemaining === 1, JSON.stringify(plain(near)));
});

test("gap restart: the last observation (30 Oct) and the model origin (18 Oct) are different dates", () => {
  const N = view("2026-10-30", { extra: RESTART }), v = plain(N.forecastView());
  assert.deepStrictEqual([v.lastObservationDate, v.modelOriginDate, v.daysSinceObservation, v.daysSinceOrigin, v.freshness],
    ["2026-10-30", "2026-10-18", 0, 12, "aging"]);
  assert.strictEqual(v.arrivalDate, "2026-12-13", "anchored at the origin, not at the new reading or today");
  assert.strictEqual(N.forecastWords(N.forecastView()).restart.indexOf("three mornings") !== -1, true);
  const ev = strip(N.chartHTML());
  assert.ok(/around 13 Dec · as of 18 Oct/.test(ev), ev.slice(0, 300));
  assert.ok(ev.indexOf("needs three mornings") !== -1, "the restart rule is explained where the projection is");
});

/* =========================================================================
   2 · What every surface prints.
   ========================================================================= */
test("no surface prints an arrival on or before the day it is read", () => {
  const days = ["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-02", "2026-11-08", "2026-11-09", "2026-11-15", "2026-12-13"];
  for (const d of days) {
    const s = surfaces(view(d));
    for (const k of Object.keys(s)) for (const a of arrivals(s[k])) assert.ok(a && a > d, `${d} ${k} prints ${a}: ${s[k].slice(0, 240)}`);
  }
  const g = surfaces(view("2026-10-30", { extra: RESTART }));
  for (const k of Object.keys(g)) for (const a of arrivals(g[k])) assert.ok(a && a > "2026-10-30", `gap ${k} prints ${a}`);
});

test("fresh and aging print the same anchored date everywhere; aging says \"as of\" the origin", () => {
  const fresh = surfaces(view("2026-10-18")), aging = surfaces(view("2026-10-25"));
  for (const s of [fresh, aging]) {
    assert.ok(/~ ?\d+ wk \(\d+–\d+\) around 13 Dec/.test(s.chart), "Evidence: " + s.chart.slice(0, 300));
    assert.ok(/76\.5–78\.4 Goal ~13 Dec/.test(s.journey), "Cut journey goal label: " + s.journey.slice(0, 400));
    assert.ok(s.journey.indexOf("projected around 13 Dec") !== -1, "Cut journey screen-reader summary");
    assert.ok(/to goal · around 13 Dec/.test(s.diagnose), "Why fold forecast row: " + s.diagnose);
  }
  assert.ok(/~ ?8 wk \(7–10\) around 13 Dec/.test(fresh.chart) && fresh.chart.indexOf("From 82.1 kg now") !== -1);
  assert.ok(/At this pace your goal range is about 8 weeks away\.$/.test(fresh.review), fresh.review);
  assert.strictEqual(/as of/.test(fresh.chart + fresh.review + fresh.diagnose + fresh.journey), false, "nothing is \"as of\" while fresh");
  assert.ok(/~ ?7 wk \(6–9\) around 13 Dec · as of 18 Oct/.test(aging.chart), aging.chart.slice(0, 300));
  assert.ok(aging.chart.indexOf("From 82.1 kg on 18 Oct") !== -1, "the start is named by its date, not \"now\"");
  assert.ok(/At your pace as of 18 Oct, your goal range is about 7 weeks away\.$/.test(aging.review), aging.review);
  assert.ok(/~7 weeks to goal · around 13 Dec · as of 18 Oct/.test(aging.diagnose), aging.diagnose);
  assert.ok(aging.journey.indexOf("projected around 13 Dec as of 18 Oct") !== -1, aging.journey);
});

test("stale and expired pause: \"Last morning weigh-in 18 Oct, N days ago\", and no arrival at all", () => {
  for (const [d, n] of [["2026-11-02", 15], ["2026-11-15", 28]]) {
    const N = view(d), s = surfaces(N);
    assert.ok(s.chart.indexOf(`Projection Paused Last morning weigh-in 18 Oct, ${n} days ago.`) !== -1, s.chart.slice(0, 400));
    assert.ok(s.diagnose.indexOf(`Forecast: Paused · Last morning weigh-in 18 Oct, ${n} days ago`) !== -1, s.diagnose);
    for (const k of Object.keys(s)) assert.strictEqual(arrivals(s[k]).length, 0, `${d} ${k}: ${s[k].slice(0, 200)}`);
    assert.strictEqual(/goal range is about/.test(s.review), false);
    const dg = N.diagnose();
    assert.notStrictEqual(dg.verdict, "no_issue", "a paused forecast does not say the cut is progressing");
    assert.strictEqual(/Keep the current plan/.test(s.diagnosis), false);
  }
});

test("the chart draws no cone while paused; while aging the cone still reaches past the today line", () => {
  const paused = view("2026-11-02");
  paused.ui.showForecast = true;
  const pm = paused.chartModel();
  assert.deepStrictEqual([pm.canForecast, pm.forecast], [false, null]);
  for (const d of ["2026-10-25", "2026-11-01"]) {
    const N = view(d);
    N.ui.showForecast = true;
    const m = N.chartModel();
    assert.ok(m.forecast, d);
    assert.ok(m.forecast.mid.x1 < m.todayX && m.forecast.mid.x2 > m.todayX, `${d}: the cone starts at the origin and runs past today`);
    assert.ok(Math.abs(m.forecast.mid.x2 - (m.W - m.right - 12)) < 0.01, `${d}: it reaches the plot's right edge`);
    assert.strictEqual(m.forecastView.arrivalDate, "2026-12-13", "the pill reads this date");
  }
});

test("the next whole kilogram is anchored at the origin and dropped once its day has passed", () => {
  const fresh = strip(view("2026-10-18").journeyHTML());
  assert.ok(fresh.indexOf("82 kg ~19 Oct · estimate") !== -1, fresh);
  for (const d of ["2026-10-25", "2026-11-15"]) assert.strictEqual(/estimate/.test(strip(view(d).journeyHTML())), false, d);
});

test("elapsed copy ends where Now is measured once the forecast is not fresh", () => {
  for (const d of VIEWS) {
    const j = strip(view(d).journeyHTML());
    assert.ok(j.indexOf("4.9 kg down in 11 weeks") !== -1, d + ": " + j.slice(0, 120));
    assert.ok(j.indexOf("82.1 Now 18 Oct") !== -1, d);
  }
});

test("no confirmed goal: no surface prints a goal ETA", () => {
  const N = view("2026-10-18", { confirmed: false }), v = N.forecastView(), s = surfaces(N);
  assert.deepStrictEqual([v.ok, v.goalConfirmed, v.showArrival], [true, false, false]);
  assert.strictEqual(/goal range is about|weeks? away/.test(s.review + s.reviewCard), false, s.review);
  assert.strictEqual(N.diagnose().evidence.some(e => e.label === "Forecast"), false);
  assert.strictEqual(s.journey, "", "the Cut journey needs a confirmed goal");
  assert.ok(s.chart.indexOf("Set a goal") !== -1);
  for (const k of Object.keys(s)) assert.strictEqual(arrivals(s[k]).length, 0, k);
  N.ui.showForecast = true;
  assert.strictEqual(N.chartModel().canForecast, false);
});

/* =========================================================================
   3 · The nudge that says why.
   ========================================================================= */
test("the coach's morning weigh-in nudge is there on 2 Nov and 15 Nov, when the forecast is paused", () => {
  for (const [d, n] of [["2026-10-25", 7], ["2026-11-02", 15], ["2026-11-15", 28]]) {
    const N = view(d), x = (N.coach.insights(d).all || []).find(i => i.id === "data.morning");
    assert.ok(x, d + ": data.morning present");
    assert.strictEqual(x.title, `No morning weigh-in for ${n} days`);
    assert.strictEqual(x.evidence[0].date, LAST, "its evidence is still the last morning reading");
  }
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
