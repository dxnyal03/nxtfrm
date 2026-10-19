/* NXTFRM Progress upgrades (proposed D96–D98). Run: node wearables.progress-plus.test.js

   Executes the shipped cut-support.js against fixed fixtures, like the weight contract suite, and checks
   the new read-only helpers against the engine functions they reuse: the level "Now" reads (D97) must equal
   forecastGoal's fitted level, the smoothed trend must stay exactly as it was, and the rate across the cut
   (D96) must agree with today's detectPlateau on today. Nothing here touches storage. */
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
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
/* 49 mornings from 2026-08-31 to 2026-10-18, falling 1.1 kg a week with a deterministic sawtooth. */
function cutFixture(opts = {}) {
  const bws = [];
  for (let i = 0; i < 49; i++) {
    if (opts.skip && opts.skip(i)) continue;
    const date = iso(2026, 8, 31 + i);
    const weight = 88 - i * (1.1 / 7) + ((i % 4) - 1.5) * 0.22;
    bws.push({ id: "c" + i, date, weight: Math.round(weight * 10) / 10, timeOfDay: "Morning", ts: 1000 + i });
  }
  return {
    state: { date: "2026-10-18", bws, logs: [], sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A" },
    settings: { cutSupport: { targetConfirmed: true }, cutStart: "2026-08-31" }, targetLow: 70, targetHigh: 72
  };
}

const N = loadNXT(cutFixture());
const r4 = v => (v === null || v === undefined ? v : Math.round(v * 10000) / 10000);

/* =========================================================================
   D97 · where your weight is now
   ========================================================================= */
test("D97 · now equals forecastGoal's fitted level when the window holds ten readings", function () {
  const f = N.forecastGoal(), now = N.nowLevel();
  assert.ok(f.ok && f.fittedLevel !== null, "the fixture forecasts");
  assert.strictEqual(now.source, "line");
  assert.strictEqual(r4(now.value), r4(f.fittedLevel));
  assert.strictEqual(now.date, "2026-10-18");
});

test("D97 · the smoothed trend is unchanged by reading the level series", function () {
  const before = N.ewmaTrend().map(r => r4(r.avg)).join(",");
  N.levelSeries(); N.nowLevel();
  const after = N.ewmaTrend().map(r => r4(r.avg)).join(",");
  assert.strictEqual(after, before);
  const t = N.ewmaTrend().filter(r => r.trendReady);
  assert.strictEqual(N.levelSeries().length, t.length, "one level point per trend-ready reading");
});

test("D97 · until ten readings fill the 21-day window, the level is the smoothed trend", function () {
  const s = N.levelSeries(), t = N.ewmaTrend().filter(r => r.trendReady);
  const early = s.filter(p => p.source === "trend");
  assert.ok(early.length >= 1, "the first points fall back");
  for (const p of early) assert.strictEqual(r4(p.value), r4(t.find(r => r.date === p.date).avg));
  const firstLine = s.findIndex(p => p.source === "line");
  assert.ok(firstLine > 0 && s.slice(firstLine).every(p => p.source === "line"), "once the window fills, it stays a line");
});

test("D97 · a falling weight: the level leads the smoothed trend, which lags", function () {
  const now = N.nowLevel(), pl = N.detectPlateau();
  assert.ok(now.value < pl.lastAvg, `now ${now.value} should sit below the lagging trend ${pl.lastAvg}`);
});

test("D97 · a thin window falls back to the trend at the end too", function () {
  const thin = loadNXT(cutFixture({ skip: i => i >= 30 && i % 3 !== 0 }));
  const now = thin.nowLevel(), last = thin.ewmaTrend().filter(r => r.trendReady).at(-1);
  assert.strictEqual(now.source, "trend");
  assert.strictEqual(r4(now.value), r4(last.avg));
});

/* =========================================================================
   D96 · the four-week rate across the cut
   ========================================================================= */
test("D96 · the rate on today is detectPlateau's rate, range and status", function () {
  const rs = N.rateSeries(N.weights(), "2026-08-31"), pl = N.detectPlateau(), last = rs.at(-1);
  assert.strictEqual(last.date, "2026-10-18");
  assert.strictEqual(r4(last.weeklyRate), r4(pl.weeklyRate));
  assert.strictEqual(r4(last.lower), r4(pl.lower));
  assert.strictEqual(r4(last.upper), r4(pl.upper));
  assert.strictEqual(last.status, pl.status);
});

test("D96 · the 1% reference is the smoothed trend on that day (D37)", function () {
  const rs = N.rateSeries(N.weights(), "2026-08-31"), t = N.ewmaTrend().filter(r => r.trendReady);
  for (const p of rs) {
    const ref = t.filter(r => r.date <= p.date).at(-1);
    assert.strictEqual(r4(p.ref), r4(ref.avg), p.date);
  }
});

test("D96 · days without a four-week window are skipped, not zero", function () {
  const rs = N.rateSeries(N.weights(), "2026-08-31");
  assert.ok(rs.length > 0 && rs[0].date > "2026-08-31", "the first days have no window");
  assert.ok(rs.every(p => Number.isFinite(p.weeklyRate)));
});

/* =========================================================================
   Markup reads the same numbers
   ========================================================================= */
test("D96/D97 · the Cut journey's Now and payload use the level", function () {
  const html = N.journeyHTML(), now = N.nowLevel();
  assert.ok(html.indexOf(now.value.toFixed(1)) !== -1, "Now shows the level");
  const m = /data-st-jr="([^"]+)"/.exec(html);
  assert.ok(m, "rewind payload present");
  const d = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  assert.strictEqual(d.now, +now.value.toFixed(2));
  assert.strictEqual(d.pts.length, N.levelSeries().filter(p => p.date >= "2026-08-31").length);
});

test("D96 · milestones are the first day at or below each mark", function () {
  const html = N.journeyHTML(), s = N.levelSeries().filter(p => p.date >= "2026-08-31");
  const seed = N.weights()[0].weight;   // no START_WEIGHT in this host: the journey starts from the first reading
  const firstKg = s.find(p => p.value <= seed - 1);
  assert.ok(firstKg, "the fixture loses more than a kilogram");
  assert.ok(html.indexOf("First kg down") !== -1);
  assert.ok(html.indexOf(`data-st-jr-go="${firstKg.date}"`) !== -1, "First kg down points at its day");
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
