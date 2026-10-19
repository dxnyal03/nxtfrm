/* NXTFRM visible consistency (proposed D106, D107). Run: node wearables.consistency.test.js

   Executes the shipped cut-support.js and coach.js against small fixed fixtures and reads the markup the engine
   renders. What these tests pin: a switched-off feature (waist, D55) never feeds a visible conclusion while its
   records and maths stay intact (D106); each weight quantity carries its own name and the precision policy
   (D107: "Latest morning · date", "Smoothed trend" at 1 dp, "Estimated level · date" with its fallback note, a
   rate named for the span it was fitted over, two different confidence words named for what they measure, no
   signed zero); the Why fold no longer asks for "7 more days" once the weigh-ins cover the window; a person who
   only weighs in at other times is told where those readings are; the chart's first-reading pill is not called
   "Start" when the Journey's start differs; and two presentation defects stay fixed (Journey Share, the
   selectPoint wrapper). Nothing here touches storage. */
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


/* ---- Fixtures ---------------------------------------------------------------------------------------- */
const TODAY = "2026-10-19";
const dayBefore = (d, n) => new Date(Date.parse(d + "T12:00:00Z") - n * 864e5).toISOString().slice(0, 10);
/* n mornings ending today; value(i) with i = 0 for the oldest. */
function mornings(n, value, timing = "Morning") {
  const out = [];
  for (let i = 0; i < n; i++) {
    const date = dayBefore(TODAY, n - 1 - i);
    out.push({ id: "m" + i, date, weight: Math.round(value(i) * 100) / 100, timeOfDay: timing, ts: Date.parse(date + "T07:00:00Z") });
  }
  return out;
}
function world(bws, o = {}) {
  const N = load({
    state: { date: TODAY, bws, logs: [], cardio: [], floorball: [], scans: [], rest: [], sessionPlans: {}, read: {},
      gyms: ["Gym A"], dayType: "Rest", gym: "Gym A", addOns: {} },
    settings: { cutSupport: { version: 99, recovery: {}, targetConfirmed: o.confirmed !== false, waist: o.waist || [] },
      cutStart: o.cutStart || null, startWeight: o.startWeight },
    targetLow: 78, targetHigh: 80, startWeight: o.startWeight
  });
  N.ui.range = o.range || 30;
  return N;
}
const strip = h => String(h).replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
/* A flat month: 35 mornings at 86.0 ± 0.1, every day weighed. */
const FLAT = () => mornings(35, i => 86 + (i % 2 ? 0.1 : -0.1));
/* A steady cut: 40 mornings from 87.0 at about 0.5 kg a week. */
const STEADY = () => mornings(40, i => 87 - i * 0.07 + (i % 3 - 1) * 0.15);
const WAIST = [{ id: "w1", date: dayBefore(TODAY, 20), cm: 92 }, { id: "w2", date: dayBefore(TODAY, 2), cm: 90.8 }];

/* =========================================================================
   D106 · a switched-off feature never feeds a visible conclusion
   ========================================================================= */
test("waist off: a flat scale with a shrinking waist draws no waist verdict anywhere", () => {
  const N = world(FLAT(), { waist: WAIST });
  assert.strictEqual(N.features.waist, false, "the waist feature is off in this build (D55)");
  assert.strictEqual(N.detectPlateau().plateau, true, "fixture reaches a plateau");
  const d = N.diagnose(), r = N.review();
  assert.notStrictEqual(d.verdict, "water_masking");
  const text = [d.headline, d.evidence.map(e => e.label + " " + e.value).join(" "), d.actions.map(a => a.text).join(" "), r.title, r.message,
    strip(N.diagnosisCard()), strip(N.reviewCard(true))].join(" ");
  assert.strictEqual(/waist/i.test(text), false, text.slice(0, 240));
  assert.strictEqual(N.cfg().waist.length, 2, "the stored waist rows are untouched");
});

test("waist on: the same records still produce the water-masking read (maths intact, only gated)", () => {
  const N = world(FLAT(), { waist: WAIST });
  N.features.waist = true;
  try {
    const d = N.diagnose();
    assert.strictEqual(d.verdict, "water_masking");
    assert.ok(/waist is shrinking/.test(d.headline));
    assert.strictEqual(N.review().title, d.headline);
  } finally { N.features.waist = false; }
});

/* =========================================================================
   D107 · the Why fold does not ask for days it already has
   ========================================================================= */
test("every day weighed: the Why fold names no missing weigh-ins and no day count", () => {
  const N = world(FLAT());
  const d = N.diagnose(), card = strip(N.diagnosisCard());
  assert.strictEqual(d.verdict, "insufficient_context");
  assert.strictEqual(/more day/.test(d.headline + card), false, card);
  assert.strictEqual(d.evidence.some(e => e.label === "Needed"), false);
  const readings = d.evidence.find(e => e.label === "Readings");
  assert.ok(readings && /^28 over 27 days$/.test(readings.value), readings && readings.value);
  assert.ok(card.indexOf("Keep weighing in each morning") !== -1);
});

test("too few readings still names the weigh-ins it needs (the gap rule is unchanged there)", () => {
  const N = world(mornings(6, () => 86));
  const d = N.diagnose();
  assert.strictEqual(d.verdict, "insufficient_context");
  assert.ok(/keep logging weigh-ins for 4 more days/.test(d.headline), d.headline);
});

/* =========================================================================
   D107 · signs, spans and names
   ========================================================================= */
test("signedFixed rounds before it signs: no signed zero", () => {
  const N = world(FLAT());
  assert.deepStrictEqual([N.signedFixed(-0.001), N.signedFixed(0.004), N.signedFixed(-0.04, 1), N.signedFixed(-0.43), N.signedFixed(0.5, 1),
    N.signedFixed(-1.25, 1, "−"), N.signedFixed(null)], ["0.00", "0.00", "0.0", "-0.43", "+0.5", "−1.3", "—"]);
  assert.strictEqual(N.signed(-0.0001), "0.00");
});

test("a rate is named for the span it was fitted over", () => {
  const full = world(STEADY()), p = full.detectPlateau();
  assert.ok(p.ok && p.spanDays >= 25, "fixture spans the whole window: " + p.spanDays);
  assert.strictEqual(full.rateSpan(p).label, "4-week rate");
  assert.ok(/kg\/wk over four weeks/.test(full.review().reason), full.review().reason);
  const short = world(mornings(16, i => 87 - i * 0.08)), q = short.detectPlateau();
  assert.ok(q.ok && q.spanDays === 15, "fixture spans 15 days: " + q.spanDays);
  assert.strictEqual(short.rateSpan(q).label, "15-day rate");
  assert.ok(/kg\/wk over 15 days/.test(short.review().reason), short.review().reason);
  const ev = strip(short.chartHTML()); // the Evidence tile renders inside the Weight chart section
  assert.ok(ev.indexOf("15-day rate") !== -1 && ev.indexOf("4-week rate") === -1, ev.slice(0, 200));
});

test("two confidence words, two names: Rate precision (Evidence) and Confidence in this read (Why fold)", () => {
  const N = world(STEADY()), p = N.detectPlateau();
  const ev = strip(N.chartHTML()), fold = strip(N.diagnosisCard());
  assert.ok(ev.indexOf("Rate precision") !== -1, ev.slice(0, 300));
  assert.strictEqual(/\bConfidence\b/.test(ev.split("Confidence in this read").join("")), false, "the Weight section (which also holds the Why fold) has no bare Confidence");
  assert.ok(fold.indexOf("Confidence in this read") !== -1, fold);
  assert.strictEqual(fold.indexOf("Rate precision"), -1);
});

test("the chart header names the reading and the smoothed trend, 1 dp", () => {
  const N = world(STEADY()), html = N.chartHTML(), t = strip(html);
  const last = N.weights().at(-1), tr = N.trend(N.weights()).at(-1);
  assert.ok(/Latest morning .*? kg 19 Oct · Morning/.test(t), t.slice(0, 300));
  assert.ok(t.indexOf("Smoothed trend " + tr.avg.toFixed(1) + " kg") !== -1, "1 dp: " + tr.avg.toFixed(1));
  assert.strictEqual(t.indexOf(tr.avg.toFixed(2) + " kg"), -1, "no 2 dp kilogram headline");
  assert.ok(t.indexOf(last.weight.toFixed(1)) !== -1);
});

test("the Journey's Now is the Estimated level with its date; the trend fallback says so", () => {
  const N = world(STEADY()), nl = N.nowLevel(), j = strip(N.journeyHTML());
  assert.strictEqual(nl.source, "line");
  assert.ok(j.indexOf(nl.value.toFixed(1) + " Est. level 19 Oct") !== -1, j); // legend row shows "Est. level" (verification: the full name wrapped)
  assert.ok(j.indexOf("estimated level " + nl.value.toFixed(1) + " on 19 Oct") !== -1, "the summary keeps the full name");
  assert.strictEqual(/\bNow\b/.test(j), false, "no bare Now label");
  assert.strictEqual(j.indexOf("smoothed trend for now"), -1, "no fallback note while the line holds");
  /* Five mornings: the level is the smoothed trend (fewer than ten in three weeks). */
  const F = world(mornings(5, i => 86 - i * 0.1)), fl = F.nowLevel(), fj = strip(F.journeyHTML());
  assert.strictEqual(fl.source, "trend");
  assert.ok(fj.indexOf("Estimated level is your smoothed trend for now") !== -1, fj);
});

test("the Journey's Share button calls NXP directly (a top-level const is not on window)", () => {
  const html = world(STEADY()).journeyHTML();
  assert.strictEqual(html.indexOf("window.NXP"), -1);
  assert.ok(/aria-label="Share your cut" onclick="typeof NXP!==&#39;undefined&#39;&amp;&amp;NXP\.shareProgress|aria-label="Share your cut" onclick="typeof NXP!=='undefined'&&NXP\.shareProgress/.test(html), html.slice(html.indexOf("Share your cut") - 10, html.indexOf("Share your cut") + 140));
});

test("the Cut-range pill calls the first reading Start only when the Journey's start agrees", () => {
  const rows = STEADY();
  const differs = world(rows, { startWeight: 87.4, range: "cut" }), same = world(rows, { startWeight: rows[0].weight, range: "cut" });
  const a = strip(differs.chartHTML()), b = strip(same.chartHTML());
  assert.ok(a.indexOf("First reading " + rows[0].weight.toFixed(1) + " kg") !== -1, a.slice(0, 400));
  assert.strictEqual(/\bStart \d+\.\d kg/.test(a), false, "the pill does not call the first reading Start");
  assert.ok(b.indexOf("Start " + rows[0].weight.toFixed(1) + " kg") !== -1);
  assert.ok(strip(differs.journeyHTML()).indexOf("87.4 Start") !== -1, "the Journey keeps the saved start weight");
});

test("contextual-only weigh-ins are named, not denied (missing mornings stay missing)", () => {
  const N = world(mornings(12, () => 82.1, "Evening"));
  assert.strictEqual(N.weights().length, 0, "no canonical rows (D14)");
  assert.strictEqual(N.otherTimingCount(), 12);
  const t = strip(N.chartHTML());
  assert.ok(t.indexOf("No morning readings yet") !== -1, t);
  assert.ok(t.indexOf("12 readings logged at other times of day are in History") !== -1, t);
  assert.strictEqual(t.indexOf("Your first weigh-in starts here"), -1);
  assert.strictEqual(world(STEADY()).otherTimingCount(), 0);
  /* Same validity test as cleanRows(): a 0 kg or 500 kg evening row is not a reading (verification of D107). */
  const bad = mornings(12, () => 82.1, "Evening");
  bad[0] = Object.assign({}, bad[0], { weight: 0 }); bad[1] = Object.assign({}, bad[1], { weight: 500 });
  assert.strictEqual(world(bad).otherTimingCount(), 10);
});

test("coach evidence uses the same names: Rate precision and the rate's own span", () => {
  const N = world(FLAT());
  const ins = N.coach.insights(TODAY).find(i => i.id === "weight.review");
  assert.ok(ins, "the plateau raises the weight insight");
  assert.ok(ins.evidence.some(e => e.label === "Rate precision"));
  assert.strictEqual(ins.evidence.some(e => e.label === "Confidence"), false);
  assert.ok(/^4-week rate (-|\+)?0\.0\d kg\/wk from 28 morning weigh-ins over 27 days/.test(ins.why.evidence), ins.why.evidence);
  assert.strictEqual(/-0\.00/.test(ins.why.evidence), false);
});

/* =========================================================================
   Presentation wiring that runs only in the page (checked in the browser too)
   ========================================================================= */
const UI = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
test("the selectPoint wrapper passes opts through, so {clear:true} clears the selection", () => {
  assert.ok(/NXT\.selectPoint=function\(index,opts\)\{\s*orig\(index,opts\);/.test(UI));
});
test("Settings › Body & scans counts scans (the scan screens' list) and shows waist only with the feature on", () => {
  const hub = UI.slice(UI.indexOf("const scanList=bodyScanSource()"), UI.indexOf("setGroup('Data'"));
  assert.ok(hub.length > 0 && /scanList\.length\+\(scanList\.length===1\?' scan':' scans'\)/.test(hub));
  assert.ok(/waist=N\.features\.waist\?/.test(hub), "waist counted only while the feature is on");
  assert.ok(/const waist=N\.features\.waist\?N\.cleanRows\(N\.cfg\(\)\.waist,'cm'\):\[\],scans=bodyScanSource\(\);/.test(UI), "Progress › Body gates waist the same way");
});

console.log("");
console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
