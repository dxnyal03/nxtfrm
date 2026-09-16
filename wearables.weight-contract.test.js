/* NXTFRM weight/progress calculation contract. Run: node wearables.weight-contract.test.js

   These are CHARACTERIZATION tests. They execute the real shipped functions in
   cut-support.js against fixed fixtures and pin the exact numbers this build
   produces. They do not independently prove the maths is correct — they prove it
   has not CHANGED. That is precisely what a presentation-only overhaul needs.

   Why this file exists: the release gate asserts weight behaviour by grepping
   source text. A refactor can keep the source shape and still alter a number, so
   source assertions cannot discharge "trend output unchanged". This runs the
   pipeline and compares values.

   Nothing here touches storage, and nothing here is a test double for the maths:
   every number below comes out of the shipped cut-support.js. */
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
function baseState(bws, date) {
  return {
    state: { date, bws, logs: [], sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A" },
    /* targetConfirmed gates the forecast cone in chartModel(); without it the
       chart draws no projection at all. Pinned true so the full path runs. */
    settings: { cutSupport: { targetConfirmed: true } }, targetLow: 80, targetHigh: 82
  };
}

/* The main fixture. "today" is pinned so every calendar window is stable, and
   the tail dates cover each clause of the frozen selection rules once. */
function mainFixture() {
  const bws = [];
  let ts = 1000;
  const push = (date, weight, timeOfDay) => {
    const row = { id: "r" + bws.length, date, weight, ts: ts += 10 };
    if (timeOfDay !== undefined) row.timeOfDay = timeOfDay;
    bws.push(row);
  };
  // 2026-08-10 .. 2026-09-13: dense morning series on a downward trend.
  for (let i = 0; i < 35; i++) {
    const date = new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10);
    const weight = 88 - i * 0.06 + ((i % 3) - 1) * 0.25; // deterministic sawtooth, no RNG
    push(date, Math.round(weight * 10) / 10, "Morning");
  }
  push("2026-09-14", 85.4, "Morning");        // both timings, same date
  push("2026-09-14", 84.8, "Post-workout");
  push("2026-09-15", 85.2, "Post-workout");   // post-workout-only day
  push("2026-09-16", 85.1, "Morning");        // today
  push("2026-09-16", 85.9, "Morning");        // later duplicate morning, same date
  push("2026-09-17", 84.0, "Morning");        // FUTURE — must be dropped
  push("2026-07-01", 91.0);                   // legacy row, no timeOfDay at all
  return baseState(bws, "2026-09-16");
}

const N = loadNXT(mainFixture());
const W = N.weights();

const r2 = v => (v === null || v === undefined ? v : Math.round(v * 100) / 100);
const r4 = v => (v === null || v === undefined ? v : Math.round(v * 10000) / 10000);
const at = date => W.find(r => r.date === date);

/* =========================================================================
   SECTION 26 CONTRACT — items 1..14
   ========================================================================= */

// 1. Morning-only day plots Morning.
test("1 · a morning-only day is represented by its morning reading", function () {
  const row = at("2026-09-13");
  assert.ok(row, "2026-09-13 must be present");
  assert.strictEqual(row.timeOfDay, "Morning");
  assert.strictEqual(at("2026-09-14").weight, 85.4);
  assert.strictEqual(at("2026-09-14").timeOfDay, "Morning");
});

// 2. Post-workout-only day plots a contextual point.
test("2 · a post-workout-only day still yields a canonical point", function () {
  const row = at("2026-09-15");
  assert.ok(row, "a day with no morning reading must not vanish from the trend");
  assert.strictEqual(row.weight, 85.2);
  assert.strictEqual(row.timeOfDay, "Post-workout");
});

// 3. Both timings on the same date plot both.
test("3 · both timings on one date: morning is canonical, post-workout is its own series", function () {
  assert.strictEqual(at("2026-09-14").weight, 85.4, "canonical row takes the morning value");
  const post = N.timingRows("Post-workout");
  assert.strictEqual(JSON.stringify(post.map(r => [r.date, r.weight])),
    JSON.stringify([["2026-09-14", 84.8], ["2026-09-15", 85.2]]));
});

// 4. A missing value is absent, never zero.
test("4 · a missing timing is absent, never coerced to zero or copied", function () {
  const post = N.timingRows("Post-workout");
  assert.ok(!post.some(r => r.date === "2026-09-16"), "today has no post-workout reading");
  assert.ok(!post.some(r => r.weight === 0), "no zero-filled point");
  assert.ok(!post.some(r => r.date === "2026-07-01"), "a row with no timeOfDay joins no timing series");
  const legacy = at("2026-07-01");
  assert.ok(legacy, "the legacy row still reaches the canonical set");
  assert.strictEqual(legacy.timeOfDay, undefined, "and is not back-filled with a timing");
});

// 5. Latest same-timing reading per date, per the shipped ts rule.
test("5 · the latest same-timing reading for a date wins", function () {
  assert.strictEqual(at("2026-09-16").weight, 85.9,
    "the later of two morning rows on 2026-09-16 is canonical");
  assert.strictEqual(W.filter(r => r.date === "2026-09-16").length, 1, "one row per date");
});

// 6. Raw entries remain untouched.
test("6 · reading the pipeline never mutates the raw weigh-in store", function () {
  const fx = mainFixture();
  const local = loadNXT(fx);
  const before = JSON.stringify(fx.state.bws);
  local.weights(); local.timingRows("Post-workout"); local.ewmaTrend();
  local.trend(); local.trendConfidence(); local.forecastGoal();
  local.detectPlateau(); local.trendStats(); local.chartModel();
  assert.strictEqual(JSON.stringify(fx.state.bws), before, "state.bws must be byte-identical after a full read");
  assert.strictEqual(fx.state.bws.length, 42, "including the future row and the legacy row");
});

// 7 + 8. One kg Y-axis, and no second Y-axis.
test("7,8 · the chart exposes exactly one shared kg scale and no second axis", function () {
  const m = N.chartModel();
  assert.strictEqual(typeof m.y, "function", "one y scale");
  assert.strictEqual(typeof m.x, "function", "one x scale");
  // Both series must land through the SAME scale object.
  const viaScale = m.y(85.0);
  assert.ok(Number.isFinite(viaScale));
  for (const p of m.points) assert.strictEqual(p.y, m.y(p.weight), "morning points use the shared y");
  for (const p of m.post) assert.strictEqual(p.y, m.y(p.weight), "post-workout points use the same shared y");
  // The y domain must cover the post-workout extremes, which is the whole point
  // of feeding them into the domain rather than giving them their own axis.
  const all = m.points.map(p => p.weight).concat(m.post.map(p => p.weight));
  assert.ok(m.low <= Math.min.apply(null, all), "domain floor covers both series");
  assert.ok(m.high >= Math.max.apply(null, all), "domain ceiling covers both series");
  assert.strictEqual(m.low, r4(m.low));
});

// 9. Morning trend output unchanged.
test("9 · EWMA trend output is unchanged", function () {
  const e = N.ewmaTrend(W);
  assert.strictEqual(e.length, 39);
  assert.strictEqual(r4(e[e.length - 1].avg), 86.253);
  assert.strictEqual(e[e.length - 1].trendReady, true);
  const t = N.trend(W);
  assert.strictEqual(t.length, 39);
  assert.strictEqual(r4(t[t.length - 1].avg), 86.253);
  assert.strictEqual(t[t.length - 1].coverage, 7);
  // The gap reset: the legacy 2026-07-01 row is >3 days before the series, so
  // the EWMA restarts at 2026-08-10 rather than carrying 91.0 forward.
  assert.strictEqual(r4(e[0].avg), 91, "first reading seeds its own average");
  assert.strictEqual(e[0].trendReady, false);
  assert.strictEqual(r4(e[1].avg), 87.8, "a >3 day gap restarts from the new reading");
});

// 10. 7-day average output unchanged.
test("10 · the 7-day window average is unchanged", function () {
  const w = N.windowStats(W);
  assert.strictEqual(w.n, 7, "inclusive calendar window [today-6, today]");
  assert.strictEqual(r4(w.avg), 85.8143);
  const prev = N.windowStats(W, N.dateAdd("2026-09-16", -7));
  assert.strictEqual(prev.n, 7);
  assert.strictEqual(r4(prev.avg), 86.3429);
  const empty = N.windowStats(W, "2026-01-01");
  assert.strictEqual(empty.n, 0);
  assert.strictEqual(empty.avg, null, "an empty window is null, not zero");
});

// 11. Rate of loss unchanged.
test("11 · rate of loss is unchanged", function () {
  const s = N.trendStats(W);
  assert.strictEqual(r4(s.change), -0.5286);
  assert.strictEqual(r4(s.percent), -0.6122);
  assert.strictEqual(r4(s.current.avg), 85.8143);
  assert.strictEqual(r4(s.previous.avg), 86.3429);
  assert.strictEqual(r4(N.detectPlateau(W).weeklyRate), -0.4732);
});

// 12. Projection unchanged.
test("12 · the forecast is unchanged", function () {
  const f = N.forecastGoal(W);
  assert.strictEqual(f.ok, true);
  assert.strictEqual(f.weeks, 7);
  assert.strictEqual(f.lowWeeks, 6);
  assert.strictEqual(f.highWeeks, 8);
  assert.strictEqual(f.confidence, "high");
  assert.strictEqual(r4(f.slope), -0.0739);
  const band = N.trendConfidence(W);
  assert.strictEqual(band.length, 32);
  assert.strictEqual(r4(band[band.length - 1].sigma), 0.2548);
});

// 13. Target trajectory unchanged.
test("13 · the target trajectory is unchanged", function () {
  const m = N.chartModel();
  assert.strictEqual(m.forecast.target, 82, "target is goalHigh()");
  assert.strictEqual(m.forecast.cone.length, 4, "a four-vertex cone polygon is produced");
  // chartModel turns forecastGeometry's [[t,w],[t,w]] centre line into pixels.
  const mid = m.forecast.mid;
  for (const k of ["x1", "y1", "x2", "y2"]) assert.ok(Number.isFinite(mid[k]), "mid." + k);
  assert.ok(mid.x2 > mid.x1, "the dashed centre line runs forward in time");
  assert.ok(mid.y2 > mid.y1, "and downward on screen, because weight is falling");
  assert.strictEqual(m.futureDays, 12,
    "future span is FUTURE_SHARE of the visible history, not the 42-day cap");
  assert.strictEqual(r4(m.forecast.level), 85.5991, "cone anchors on the FITTED level");
  assert.strictEqual(r4(m.forecast.days), 48.7053);
  assert.strictEqual(m.forecast.arrives, false, "goal is beyond the drawn window");
  assert.ok(Number.isFinite(m.goalRef), "a dashed goal reference line is placed");
  // The cone walls are forecastGoal's own bounds drawn — not a new statistic.
  const f = N.forecastGoal(W);
  assert.strictEqual(f.lowWeeks, 6);
  assert.strictEqual(f.highWeeks, 8);
});

// 14. Historical fallback unchanged.
test("14 · rows predating the timing field keep their shipped treatment", function () {
  const legacy = at("2026-07-01");
  assert.strictEqual(legacy.weight, 91);
  assert.strictEqual(legacy.timeOfDay, undefined, "never defaulted to Morning");
  assert.strictEqual(W[0].date, "2026-07-01", "it still sorts into the series by date");
  // A timing-less row is eligible to be canonical but never outranks a morning row.
  const both = loadNXT(baseState([
    { id: "a", date: "2026-05-01", weight: 90, ts: 1 },
    { id: "b", date: "2026-05-01", weight: 89, ts: 2, timeOfDay: "Morning" }
  ], "2026-05-02"));
  assert.strictEqual(both.weights()[0].weight, 89, "morning outranks a timing-less row");
  const reverse = loadNXT(baseState([
    { id: "b", date: "2026-05-01", weight: 89, ts: 1, timeOfDay: "Morning" },
    { id: "a", date: "2026-05-01", weight: 90, ts: 2 }
  ], "2026-05-02"));
  assert.strictEqual(reverse.weights()[0].weight, 89, "even when the morning row comes first");
});

/* =========================================================================
   Post-workout is contextual only — executed, not grepped.
   ========================================================================= */
test("post-workout readings change no statistic", function () {
  const withPost = mainFixture();
  const withoutPost = mainFixture();
  withoutPost.state.bws = withoutPost.state.bws.filter(
    r => String(r.timeOfDay || "").toLowerCase() !== "post-workout");

  const a = loadNXT(withPost);
  const b = loadNXT(withoutPost);
  // 2026-09-15 is post-workout-only, so dropping post rows removes that day
  // from the canonical set. Compare the statistics on the shared dates.
  const same = (fn, label) => assert.strictEqual(
    JSON.stringify(fn(a)), JSON.stringify(fn(b)), label + " must ignore post-workout rows");

  const upTo14 = n => n.weights().filter(r => r.date <= "2026-09-14");
  same(n => upTo14(n).map(r => [r.date, r.weight]), "the canonical set up to 2026-09-14");
  same(n => n.ewmaTrend(upTo14(n)).map(r => r4(r.avg)), "ewmaTrend");
  same(n => r4(n.windowStats(upTo14(n), "2026-09-14").avg), "windowStats");
  same(n => r4(n.forecastGoal(upTo14(n)).slope), "forecastGoal");
  same(n => r4(n.detectPlateau(upTo14(n)).weeklyRate), "detectPlateau");
  same(n => r4(n.trendStats(upTo14(n)).change), "trendStats");
});

/* =========================================================================
   Empty and partial states — the degradations a redesign must preserve.
   ========================================================================= */
test("empty state: no readings produces no scales and no points", function () {
  const n = loadNXT(baseState([], "2026-09-16"));
  assert.strictEqual(n.weights().length, 0);
  const m = n.chartModel();
  assert.strictEqual(m.visible.length, 0);
  assert.strictEqual(m.x, undefined, "no scales are built for an empty chart");
  assert.strictEqual(m.y, undefined);
  assert.strictEqual(n.windowStats([]).avg, null);
  assert.strictEqual(n.trendStats([]).change, null);
  assert.strictEqual(n.trendConfidence([]), null);
  assert.strictEqual(n.forecastGoal([]).ok, false);
});

test("one reading: a point but no trend line, no band, no forecast", function () {
  const n = loadNXT(baseState([{ id: "a", date: "2026-09-16", weight: 85, ts: 1, timeOfDay: "Morning" }], "2026-09-16"));
  const e = n.ewmaTrend();
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].trendReady, false, "one reading is never trend-ready");
  assert.strictEqual(n.trend()[0].avg, null, "the average is masked until ready");
  assert.strictEqual(n.trendConfidence(), null, "no confidence band");
  assert.strictEqual(n.forecastGoal().ok, false, "no forecast");
  const m = n.chartModel();
  assert.strictEqual(m.points.length, 1);
  assert.strictEqual(m.segments.length, 0, "no trend polyline");
});

test("partial: under seven readings gives a trend but still no band", function () {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push({ id: "r" + i, date: new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10),
      weight: 85 - i * 0.1, ts: i + 1, timeOfDay: "Morning" });
  }
  const n = loadNXT(baseState(rows, "2026-09-16"));
  const t = n.trend();
  assert.strictEqual(t.length, 5);
  assert.strictEqual(t[0].avg, null, "not ready at reading 1");
  assert.strictEqual(t[1].avg, null, "not ready at reading 2");
  assert.ok(t[2].avg !== null, "trend-ready at reading 3");
  assert.strictEqual(n.trendConfidence(), null, "band needs seven readings");
});

/* =========================================================================
   Guard: the calculation surface itself
   ========================================================================= */
test("every frozen statistic still defaults to the canonical weights() set", function () {
  const src = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  for (const fn of ["ewmaTrend", "trend", "trendConfidence", "forecastGoal", "detectPlateau", "trendStats"]) {
    assert.ok(src.indexOf("function " + fn + "(rows=weights())") !== -1,
      fn + " must keep its rows=weights() default");
  }
  assert.ok(src.indexOf("function timingRows(timing,input=state.bws)") !== -1,
    "timingRows keeps its signature");
});

/* =========================================================================
   RENDERED CHART — asserted against the shipped chartHTML(), not a mock.
   The main fixture confirms a goal, so the projection and target states that
   the dev seed never reaches are actually exercised here.
   ========================================================================= */
const SVG = N.chartHTML();

test("chart: post-workout is drawn as hollow squares with no connecting line", function () {
  // Squares, not circles: shape separates the series without relying on hue.
  const rects = SVG.match(/<rect[^>]*stroke="#7f74a8"[^>]*>/g) || [];
  assert.ok(rects.length >= 1, "at least one post-workout square is drawn");
  for (const r of rects) assert.ok(/fill="none"/.test(r), "post-workout markers stay hollow");
  // The old build smoothed a path through the post readings. That line invited a
  // slope reading the maths never makes, so it must not come back.
  assert.strictEqual(/<path[^>]*stroke="#7f74a8"/.test(SVG), false,
    "post-workout must never be joined into a line");
});

test("chart: morning is the primary series and sits above the contextual one", function () {
  // Compare the marker markup itself. CHART.ink also appears earlier in the
  // gradient <defs>, so a naive first-index comparison measures the wrong thing.
  const morningAt = SVG.indexOf('fill="#b49aff" fill-opacity=".58"');
  const postAt = SVG.indexOf('<rect');
  assert.ok(morningAt !== -1, "morning readings carry the primary ink");
  assert.ok(postAt !== -1, "post-workout squares are present");
  assert.ok(postAt < morningAt,
    "post-workout is painted first in document order, so morning renders on top");
});

test("chart: the projection is dashed, future-only, and claims no certainty", function () {
  assert.ok(/stroke-dasharray="7 6"/.test(SVG), "the forecast centre line is dashed");
  // A cone may exist only because forecastGeometry produced one.
  const f = N.forecastGoal(W);
  if (f.ok && f.weeks) assert.ok(SVG.indexOf("n99-chart-cone") !== -1, "the frozen cone is drawn");
  /* No invented certainty language in the CHART itself. Scope matters:
     chartHTML() appends N.diagnosisCard() after the chart's </section>, and that
     card legitimately surfaces forecastGoal().confidence — existing frozen
     coaching output, not something this redesign fabricated. The chart proper
     must not add any of its own. */
  // First </section>, not last: diagnosisCard() brings its own <section>, so
  // lastIndexOf would sweep the coaching card back into scope.
  const chartOnly = SVG.slice(0, SVG.indexOf("</section>")).toLowerCase();
  for (const bad of ["% confident", "confidence:", "probability", "likelihood", "accuracy", "certainty"]) {
    assert.strictEqual(chartOnly.indexOf(bad), -1, "no fabricated certainty in the chart: " + bad);
  }
});

test("chart: the target is a labelled hairline, not a shaded region", function () {
  // goalRef is placed whenever a forecast is drawn and the band is off.
  const m = N.chartModel();
  assert.ok(Number.isFinite(m.goalRef), "a goal reference line is positioned");
  assert.ok(/stroke-dasharray="5 5"/.test(SVG), "the target reads as a dashed reference rule");
  assert.strictEqual(m.forecast.target, 82, "the target is goalHigh(), unchanged");
});

test("chart: one calibrated y-axis, with ticks and no second scale", function () {
  assert.ok(/stroke-opacity="\.5"/.test(SVG) || /stroke-opacity="0?\.5"/.test(SVG),
    "tick marks are drawn against the axis");
  assert.strictEqual(/yRight|secondAxis|rightAxis/.test(SVG), false, "no second y-axis");
});

test("chart: the legend names every series and carries no instructions", function () {
  assert.ok(SVG.indexOf('<i class="raw"></i>Morning') !== -1);
  assert.ok(SVG.indexOf('<i class="post"></i>Post-workout') !== -1);
  assert.ok(SVG.indexOf("Projection") !== -1, "the forecast is named Projection");
  assert.strictEqual(SVG.indexOf('<span>Drag to inspect</span>'), -1,
    "instructional copy does not belong in the key");
  assert.ok(SVG.indexOf("n99-chart-hint") !== -1, "the hint moved to its own line");
});

/* =========================================================================
   TREND DIAGNOSIS — the redesign is presentation only, so every value the
   frozen diagnose() produces must still reach the screen, unaltered.
   ========================================================================= */
const DIAG = N.diagnose();
const CARD = N.diagnosisCard();
const stripTags = h => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const CARD_TEXT = stripTags(CARD);

test("diagnosis: every evidence label and value still reaches the screen", function () {
  const shown = (DIAG.evidence || []).filter(e => N.cfg().targetConfirmed || e.label !== "Forecast");
  assert.ok(shown.length > 0, "the fixture produces evidence to render");
  for (const e of shown) {
    assert.ok(CARD_TEXT.indexOf(e.label) !== -1, "label rendered: " + e.label);
    // Values are split across two lines for scanning, so assert each clause survives.
    for (const clause of String(e.value).split(" · ").map(x => x.trim()).filter(Boolean)) {
      assert.ok(CARD_TEXT.indexOf(clause) !== -1, "value clause rendered: " + clause);
    }
  }
});

test("diagnosis: the headline is re-laid out, never reworded", function () {
  // The card splits the shipped sentence at its em dash. Both halves must be
  // present, and no word may be invented.
  const halves = DIAG.headline.split(" — ").map(h => h.replace(/[.\u2014\s]+$/, "").trim()).filter(Boolean);
  for (const half of halves) {
    const core = half.replace(/^\s*(.)/, (m, c) => c.toUpperCase());
    assert.ok(CARD_TEXT.toLowerCase().indexOf(core.toLowerCase()) !== -1,
      "headline half preserved: " + core.slice(0, 40));
  }
});

test("diagnosis: confidence is shown as-is, with no invented score", function () {
  assert.ok(CARD_TEXT.indexOf("Confidence") !== -1, "confidence is labelled");
  assert.ok(CARD_TEXT.toLowerCase().indexOf(String(DIAG.confidence).toLowerCase()) !== -1,
    "the real confidence state is printed");
  for (const bad of ["%", "score", "meter", "probability"]) {
    const foot = CARD.slice(CARD.indexOf("n99-diag-foot"));
    assert.strictEqual(stripTags(foot).toLowerCase().indexOf(bad), -1,
      "confidence must not gain a fabricated " + bad);
  }
});

test("diagnosis: a repeated action sentence is shown once, not twice", function () {
  const norm = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const a of (DIAG.actions || [])) {
    const dup = norm(DIAG.headline).indexOf(norm(a.text)) !== -1;
    const occurrences = CARD_TEXT.split(a.text.replace(/\.$/, "")).length - 1;
    if (dup) {
      assert.ok(occurrences <= 1, "a sentence already in the headline is not repeated: " + a.text);
    } else {
      assert.ok(CARD_TEXT.indexOf(a.text) !== -1, "a non-duplicate action is still shown: " + a.text);
    }
  }
});

test("diagnosis: the insufficient-context case says it once, not twice", function () {
  /* This is the state in the reported screenshot: too few readings for a
     plateau call, so diagnose() puts the SAME sentence in both headline and
     actions. Six morning readings keeps p.ok false (PLATEAU_MIN_READINGS is 10). */
  const rows = [];
  for (let i = 0; i < 6; i++) {
    // Flat, not falling: a downward slope lets forecastGoal succeed and the
    // no_issue branch claims the verdict before the fallback is ever reached.
    rows.push({ id: "s" + i, ts: i + 1, timeOfDay: "Morning", weight: 86,
      date: new Date(Date.UTC(2026, 8, 5 + i)).toISOString().slice(0, 10) });
  }
  const n = loadNXT(baseState(rows, "2026-09-16"));
  const d = n.diagnose();
  assert.strictEqual(d.verdict, "insufficient_context", "fixture reaches the reported state");
  const text = stripTags(n.diagnosisCard());

  // The actionable sentence must survive exactly once.
  const sentence = (d.actions || [])[0] && d.actions[0].text.replace(/\.$/, "");
  assert.ok(sentence, "the shipped state carries an action sentence");
  const count = text.split(sentence).length - 1;
  assert.strictEqual(count, 1, "the 'keep logging' sentence appears exactly once, not twice");

  // Both halves of the headline are still present, and the count is intact.
  assert.ok(text.indexOf("Not enough context") !== -1, "the headline lead survives");
  const days = /(\d+) more day/.exec(d.headline);
  assert.ok(days, "the shipped headline names a day count");
  assert.ok(text.indexOf(days[1]) !== -1, "that exact day count is shown, unmodified");

  // The "Needed" row leads with the number, and both clauses survive.
  assert.ok(text.indexOf("weigh-ins") !== -1, "what is needed is still named");
  assert.strictEqual(n.diagnosisCard().indexOf('class="n99-status'), -1, "no capsules");
});

test("diagnosis: the Needed row is derived from diagnose(), never from a fixture", function () {
  /* gap() can return five different descriptors — weigh-ins, adherence, waist,
     TDEE snapshots, recovery check-ins — so the row must print whichever one the
     shipped logic actually chose, with its own number, and invent nothing. */
  const build = (rows, adherence, waist) => {
    const fx = baseState(rows, "2026-09-16");
    if (adherence) fx.settings.cutSupport.adherence = adherence;
    if (waist) fx.settings.cutSupport.waist = waist;
    return loadNXT(fx);
  };
  const flat = n => {
    const r = [];
    for (let i = 0; i < n; i++) {
      r.push({ id: "f" + i, ts: i + 1, timeOfDay: "Morning", weight: 86,
        date: new Date(Date.UTC(2026, 7, 20 + i)).toISOString().slice(0, 10) });
    }
    return r;
  };

  // Branch 1: too few readings -> "weigh-ins"
  const a = build(flat(6));
  const da = a.diagnose();
  assert.strictEqual(da.verdict, "insufficient_context");
  const needA = (da.evidence || []).find(e => e.label === "Needed");
  assert.ok(needA, "the shipped state carries a Needed row");
  assert.ok(needA.value.indexOf("weigh-ins") !== -1,
    "with too few readings the descriptor is weigh-ins, got: " + needA.value);

  // Branch 2: enough readings + logged adherence, but no waist -> "waist"
  const adh = {};
  for (let i = 0; i < 28; i++) {
    adh[new Date(Date.UTC(2026, 7, 20 + i)).toISOString().slice(0, 10)] = { status: "on" };
  }
  const b = build(flat(20), adh);
  const db = b.diagnose();
  const needB = (db.evidence || []).find(e => e.label === "Needed");

  // Whatever branch each fixture lands in, the rendered row must match it exactly.
  for (const [n, d, need] of [[a, da, needA], [b, db, needB]]) {
    if (!need) continue;
    const card = n.diagnosisCard();
    const text = stripTags(card);
    for (const clause of need.value.split(" · ").map(x => x.trim()).filter(Boolean)) {
      assert.ok(text.indexOf(clause) !== -1, "Needed clause rendered verbatim: " + clause);
    }
    // The number shown must be the number diagnose() produced — no rounding,
    // no substitution, no fixture constant.
    const fromLogic = /(\d+)/.exec(need.value);
    assert.ok(fromLogic, "the shipped Needed value carries a number");
    const row = card.slice(card.indexOf(">Needed<"));
    assert.ok(stripTags(row).indexOf(fromLogic[1]) !== -1,
      "the Needed row prints diagnose()'s own number: " + fromLogic[1]);
    // And no OTHER descriptor may appear in that row.
    const others = ["weigh-ins", "adherence", "waist", "TDEE snapshots", "recovery check-ins"]
      .filter(w => need.value.indexOf(w) === -1);
    const rowText = stripTags(row.slice(0, row.indexOf("</div></div>") + 12)).toLowerCase();
    for (const w of others) {
      assert.strictEqual(rowText.indexOf(w.toLowerCase()), -1,
        "no unrelated descriptor leaked into the Needed row: " + w);
    }
  }
});

test("diagnosis: no value is wrapped in the old status capsule", function () {
  assert.strictEqual(/class="n99-status/.test(CARD), false,
    "values are typography now, not filled pills");
  assert.ok(CARD.indexOf("n99-diag-row") !== -1, "the row structure is in place");
});

console.log("");
console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
