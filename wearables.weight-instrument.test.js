/* NXTFRM Weight "Instrument" engine (spec SPEC-weight.md §7.1, §7.2, §8, §11; proposed D109–D111).
   Run: node wearables.weight-instrument.test.js

   Executes the shipped cut-support.js against fixed fixtures:
   - chartGeo(): with no measured kind (and always in node) it is the geometry the chart has today, and
     chartModel() with no geometry argument is byte-identical to the build before chartGeo existed (pinned digest).
   - comparePeriods() / compareWindows(): matched and labelled windows, counts and coverage, partial status, the
     unrounded difference and its rounding footnote flag, reasons when a window is too thin, and that only the
     canonical morning set is read.
   - Selection plumbing: N.ui layer flags and setLayer (memory only), the scrub intent machine (a vertical touch
     never selects; a horizontal drag or tap selects a real reading), chartKey's keys, and selectPoint's new hooks.
   Nothing here touches storage. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const assert = require("assert");

const ROOT = __dirname;
let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log("PASS  " + name); }
  catch (err) { failed += 1; console.log("FAIL  " + name); console.log("      " + (err && err.stack ? err.stack : err)); }
}

/* ---- Host double (as in wearables.weight-contract.test.js) --------------------------------------------- */
function makeElement(id) {
  const attrs = {};
  return {
    id, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, focus() {}, blur() {},
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; }, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    setPointerCapture() { this.captured = true; }, releasePointerCapture() { this.captured = false; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 420, height: 460, right: 420, bottom: 460 }; },
    attrs
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
const SRC = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8") + "\n;globalThis.__NXT__ = NXT;\n";

function loadNXT(fx, els) {
  const discovered = {};
  const build = () => {
    const sandbox = {
      console,
      document: {
        getElementById(id) { return els && els[id] || null; }, querySelector() { return null; },
        querySelectorAll() { return []; }, createElement() { return makeElement(); },
        addEventListener() {}, activeElement: null, readyState: "complete", title: ""
      },
      localStorage: { getItem() { return null; }, setItem() { throw new Error("no storage write expected"); }, removeItem() {}, clear() {} },
      load(_key, fallback) { return fallback; },
      esc(v) { return String(v === null || v === undefined ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
      state: fx.state, settings: fx.settings,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null, cloudSyncAgo() { return ""; },
      TARGET_LOW: fx.targetLow, TARGET_HIGH: fx.targetHigh,
      goalLow() { return Math.min(Number(fx.targetLow) || 80, Number(fx.targetHigh) || 82); },
      goalHigh() { return Math.max(Number(fx.targetLow) || 80, Number(fx.targetHigh) || 82); }
    };
    sandbox.window = sandbox;
    for (const n of HOST_FNS) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox)) sandbox[n] = discovered[n];
    return sandbox;
  };
  for (let attempt = 0; attempt < 120; attempt++) {
    const ctx = vm.createContext(build());
    try { vm.runInContext(SRC, ctx, { filename: "cut-support.js" }); const N = ctx.__NXT__; Object.defineProperty(N, "__sandbox", { value: ctx, enumerable: false }); return N; }
    catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss) throw err;
      discovered[miss[1]] = function () { return null; };
    }
  }
  throw new Error("cut-support.js did not load within the stub budget");
}

/* ---- Fixtures ------------------------------------------------------------------------------------------ */
function baseState(bws, date, extra) {
  return { state: { date, bws, logs: [], sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A" },
    settings: Object.assign({ cutSupport: { targetConfirmed: true } }, extra || {}), targetLow: 80, targetHigh: 82 };
}
/* The weight-contract main fixture, verbatim: dense mornings, a both-timings day, a post-workout-only day, a
   duplicate morning, a future row and a legacy row with no timing. */
function mainFixture() {
  const bws = []; let ts = 1000;
  const push = (date, weight, timeOfDay) => { const row = { id: "r" + bws.length, date, weight, ts: ts += 10 }; if (timeOfDay !== undefined) row.timeOfDay = timeOfDay; bws.push(row); };
  for (let i = 0; i < 35; i++) {
    const date = new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10);
    push(date, Math.round((88 - i * 0.06 + ((i % 3) - 1) * 0.25) * 10) / 10, "Morning");
  }
  push("2026-09-14", 85.4, "Morning"); push("2026-09-14", 84.8, "Post-workout"); push("2026-09-15", 85.2, "Post-workout");
  push("2026-09-16", 85.1, "Morning"); push("2026-09-16", 85.9, "Morning"); push("2026-09-17", 84.0, "Morning");
  push("2026-07-01", 91.0);
  return baseState(bws, "2026-09-16");
}
/* A longer cut with gaps: 22 Jul – 19 Oct 2026, one skipped morning in nine and a 10-day gap in August. */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function cutFixture(extra) {
  const rnd = mulberry32(11), bws = []; let ts = 5000;
  const d0 = Date.parse("2026-07-22T12:00:00Z"), d1 = Date.parse("2026-10-19T12:00:00Z");
  for (let t = d0, i = 0; t <= d1; t += 864e5, i++) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (i % 9 === 4 || (date >= "2026-08-12" && date <= "2026-08-21")) continue;
    bws.push({ id: "c" + i, date, weight: Math.round((86.7 - i * 0.062 + (rnd() - 0.5) * 0.8) * 10) / 10, timeOfDay: "Morning", ts: ts += 10 });
  }
  return baseState(bws, "2026-10-19", Object.assign({ cutStart: "2026-07-22" }, extra || {}));
}

/* chartModel() with no geometry argument, across ranges and layers, serialised. geo and win are the two keys
   this build adds; everything the model returned before is compared byte for byte, and the scales are sampled. */
function modelDigest(N, today) {
  const out = [];
  const keep = { range: N.ui.range, showPost: N.ui.showPost, showForecast: N.ui.showForecast };
  for (const range of [30, 14, 90, "cut", 0]) for (const showPost of [false, true]) for (const showForecast of [false, true]) {
    Object.assign(N.ui, { range, showPost, showForecast });
    const m = N.chartModel();
    const json = JSON.stringify(m, (k, v) => (k === "geo" || k === "win") ? undefined : v);
    const xs = m.x ? [today, N.dateAdd(today, -10), N.dateAdd(today, -45)].map(d => m.x(d).toFixed(6)) : [];
    const ys = m.y ? [80, 83.3, 86.1, 90].map(v => m.y(v).toFixed(6)) : [];
    out.push(json, xs.join(","), ys.join(","));
  }
  Object.assign(N.ui, keep);
  return crypto.createHash("sha256").update(out.join("\n")).digest("hex");
}

/* Pinned from the build before chartGeo existed (HEAD 4a3096c), by running modelDigest() against it. */
const PRE_CHANGE = {
  main: "5d86e518ac5219f2ba22e7db78ec979f3251bcd09e11c4a87b3a8e50d5cece92",
  cut: "ed2a0233449ac50b35e3c002747f8b5eb7fcd9247bba14a86ee10621f5960bbf",
  empty: "957847e3701341f28987e5689086a7e584e7e9e940e3878f2ca0f482e153f553"
};
if (process.env.NXT_PRINT_DIGEST) {
  console.log("main", modelDigest(loadNXT(mainFixture()), "2026-09-16"));
  console.log("cut ", modelDigest(loadNXT(cutFixture()), "2026-10-19"));
  console.log("empty", modelDigest(loadNXT(baseState([], "2026-10-19")), "2026-10-19"));
  process.exit(0);
}

/* =========================================================================
   Commit 1 · chartGeo and the chartModel signature
   ========================================================================= */
const LEGACY = { W: 420, H: 460, left: 34, right: 8, top: 28, bottom: 110, padX: 12, plotH: 322, gutter: "left", kind: "legacy" };

test("chartGeo() with no window size is today's geometry (420 × 460, 34 / 8 / 28 / 110, padX 12)", () => {
  const N = loadNXT(mainFixture());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(N.chartGeo())), LEGACY);
  /* Even a measured kind falls back to it where nothing can be measured (node). */
  assert.deepStrictEqual(JSON.parse(JSON.stringify(N.chartGeo("page"))), LEGACY);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(N.chartGeo("legacy"))), LEGACY);
  /* A fresh object each call: a caller cannot mutate the default. */
  const g = N.chartGeo(); g.W = 1; assert.strictEqual(N.chartGeo().W, 420);
});

test("chartModel() with no geometry argument is byte-identical to the pre-chartGeo build", () => {
  assert.strictEqual(modelDigest(loadNXT(mainFixture()), "2026-09-16"), PRE_CHANGE.main, "contract fixture");
  assert.strictEqual(modelDigest(loadNXT(cutFixture()), "2026-10-19"), PRE_CHANGE.cut, "long cut with gaps");
  assert.strictEqual(modelDigest(loadNXT(baseState([], "2026-10-19")), "2026-10-19"), PRE_CHANGE.empty, "no readings");
  const m = loadNXT(mainFixture()).chartModel();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(m.geo)), LEGACY, "the model carries the geometry it used");
  assert.strictEqual(m.win, null);
});

test("chartGeo('page') in a measured window: 1 unit = 1 px, right gutter, plotH from svh (clamp 232–320)", () => {
  /* The same function, in a sandbox that has a viewport. */
  const g = withViewport(390, 844, n => n.chartGeo("page"));
  assert.strictEqual(g.gutter, "right"); assert.strictEqual(g.left, 6); assert.strictEqual(g.right, 42);
  assert.strictEqual(g.top, 11); assert.strictEqual(g.bottom, 26); assert.strictEqual(g.padX, 9);
  assert.strictEqual(g.plotH, 300, "round(844 × .355) = 300");
  assert.strictEqual(g.H, 11 + 300 + 26);
  assert.strictEqual(g.W, 390 - 32 - 28, "estimate: viewport − page gutters − plate padding");
  assert.strictEqual(withViewport(375, 667, n => n.chartGeo("page")).plotH, 237);
  assert.strictEqual(withViewport(320, 568, n => n.chartGeo("page")).plotH, 232, "floor");
  assert.strictEqual(withViewport(1024, 1366, n => n.chartGeo("page")).plotH, 320, "ceiling");
  assert.strictEqual(withViewport(1280, 800, n => n.chartGeo("page")).plotH, 284, "a wide viewport keeps the phone plot (D144): round(800 × .355)");
  assert.strictEqual(withViewport(390, 844, n => { n.ui.chartW.page = 362; return n.chartGeo("page"); }).W, 362, "a measured width wins");
});

test("chartGeoChanged: width > 2 px, a 24 px svh bucket or orientation; nothing else", () => {
  const N = loadNXT(mainFixture());
  const g = { kind: "page", W: 362, svh: 844 };
  assert.strictEqual(N.chartGeoChanged(g, { ...g, W: 364 }), false);
  assert.strictEqual(N.chartGeoChanged(g, { ...g, W: 365 }), true);
  assert.strictEqual(N.chartGeoChanged(g, { ...g, svh: 850 }), false, "Safari toolbar wobble inside one bucket");
  assert.strictEqual(N.chartGeoChanged(g, { ...g, svh: 820 }), true);
  assert.strictEqual(N.chartGeoChanged(g, { ...g, W: 844, svh: 362 }), true);
});

test("a measured geometry changes only the frame: the y-domain (D2) and the points' dates are the same", () => {
  const N = loadNXT(cutFixture());
  const a = N.chartModel(), b = N.chartModel(undefined, undefined, undefined,
    { W: 362, H: 337, left: 6, right: 42, top: 11, bottom: 26, padX: 9, plotH: 300, gutter: "right", kind: "page" });
  assert.strictEqual(b.low, a.low); assert.strictEqual(b.high, a.high); assert.strictEqual(b.step, a.step);
  assert.deepStrictEqual(b.points.map(p => p.date), a.points.map(p => p.date));
  const xs = b.points.map(p => p.x), ys = b.points.map(p => p.y);
  assert.ok(Math.min(...xs) >= 6 + 9 - 1e-9 && Math.max(...xs) <= 362 - 42 - 9 + 1e-9, "readings sit padX inside the plot");
  assert.ok(Math.min(...ys) >= 11 && Math.max(...ys) <= 11 + 300, "inside the plot rect");
  assert.strictEqual(b.W, 362); assert.strictEqual(b.H, 337);
});

test("win {from, to} widens the x-window; the domain stays data-only over what is drawn", () => {
  const N = loadNXT(cutFixture());
  const m = N.chartModel(undefined, 30, false, undefined, { from: "2026-08-21", to: "2026-10-19" });
  assert.strictEqual(m.start, "2026-08-21");
  assert.strictEqual(m.points[0].date >= "2026-08-21", true);
  assert.strictEqual(m.points.at(-1).date, "2026-10-19");
  const vals = m.visible.flatMap(r => r.avg === null ? [r.weight] : [r.weight, r.avg]);
  assert.ok(m.low <= Math.min(...vals) && m.high >= Math.max(...vals));
  const n = N.chartModel(undefined, 30, false, undefined, { from: "2026-08-21", to: "2026-09-19" });
  assert.strictEqual(n.points.at(-1).date <= "2026-09-19", true, "nothing after win.to is drawn");
});

/* A sandbox with a viewport: window.innerWidth / innerHeight set, no body (so svh falls back to innerHeight). */
function withViewport(w, h, fn) {
  const fx = mainFixture();
  const src = SRC.replace("\n;globalThis.__NXT__ = NXT;\n", `\n;globalThis.innerWidth=${w};globalThis.innerHeight=${h};globalThis.__NXT__ = NXT;\n`);
  const N = loadWith(fx, src);
  return fn(N);
}
function loadWith(fx, src) {
  const discovered = {};
  for (let attempt = 0; attempt < 120; attempt++) {
    const sandbox = {
      console, document: { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
        createElement() { return makeElement(); }, addEventListener() {}, activeElement: null, readyState: "complete", title: "" },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_k, f) { return f; }, esc(v) { return String(v == null ? "" : v); }, state: fx.state, settings: fx.settings,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "", cloudUser: null, lastCloudSyncAt: null,
      cloudSyncAgo() { return ""; }, TARGET_LOW: 80, TARGET_HIGH: 82, goalLow() { return 80; }, goalHigh() { return 82; }
    };
    sandbox.window = sandbox;
    for (const n of HOST_FNS) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox)) sandbox[n] = discovered[n];
    const ctx = vm.createContext(sandbox);
    try { vm.runInContext(src, ctx, { filename: "cut-support.js" }); return ctx.__NXT__; }
    catch (err) { const miss = /(\w+) is not defined/.exec(String(err && err.message)); if (!miss) throw err; discovered[miss[1]] = function () { return null; }; }
  }
  throw new Error("did not load");
}

/* =========================================================================
   Commit 2 · comparePeriods / compareWindows
   ========================================================================= */
test("compareWindows 'previous': the matched window immediately before (1M on 19 Oct: 21 Aug–19 Sept vs 20 Sept–19 Oct)", () => {
  const N = loadNXT(cutFixture());
  const w = N.compareWindows(30, "previous", "2026-10-19");
  assert.strictEqual(w.ok, true);
  assert.deepStrictEqual([w.before.from, w.before.to, w.before.days], ["2026-08-21", "2026-09-19", 30]);
  assert.deepStrictEqual([w.current.from, w.current.to, w.current.days], ["2026-09-20", "2026-10-19", 30]);
  assert.strictEqual(w.before.label, "21 Aug–19 Sept");
  assert.strictEqual(w.current.label, "20 Sept–19 Oct");
  const w2 = N.compareWindows(14, "previous", "2026-10-19");
  assert.deepStrictEqual([w2.before.from, w2.before.to, w2.current.from], ["2026-09-22", "2026-10-05", "2026-10-06"]);
});

test("compareWindows 'sameDays': matched elapsed days of last month, the current one marked in progress", () => {
  const N = loadNXT(cutFixture());
  const w = N.compareWindows(30, "sameDays", "2026-10-19");
  assert.deepStrictEqual([w.before.from, w.before.to, w.before.days], ["2026-09-01", "2026-09-19", 19]);
  assert.deepStrictEqual([w.current.from, w.current.to, w.current.days], ["2026-10-01", "2026-10-19", 19]);
  assert.strictEqual(w.current.partial, true);
  assert.strictEqual(w.current.elapsed, 19); assert.strictEqual(w.current.total, 31);
  assert.strictEqual(w.before.label, "1–19 Sept"); assert.strictEqual(w.current.label, "1–19 Oct");
  /* 31 March: February has 28 days, so the matched window stops at its end. */
  const m = N.compareWindows(30, "sameDays", "2027-03-31");
  assert.deepStrictEqual([m.before.from, m.before.to], ["2027-02-01", "2027-02-28"]);
  assert.strictEqual(m.current.partial, false, "the last day of the month is a complete month");
});

test("compareWindows 'completed': whole Mon–Sun weeks or calendar months before the current one, labelled completed", () => {
  const N = loadNXT(cutFixture());
  const wk = N.compareWindows(14, "completed", "2026-10-19"); // Monday 19 Oct
  assert.deepStrictEqual([wk.before.from, wk.before.to, wk.current.from, wk.current.to], ["2026-09-21", "2026-10-04", "2026-10-05", "2026-10-18"]);
  assert.strictEqual(wk.current.completed, true); assert.strictEqual(wk.before.completed, true);
  const mo = N.compareWindows(30, "completed", "2026-10-19");
  assert.deepStrictEqual([mo.before.from, mo.before.to, mo.current.from, mo.current.to], ["2026-08-01", "2026-08-31", "2026-09-01", "2026-09-30"]);
  const q = N.compareWindows(90, "completed", "2026-10-19");
  assert.deepStrictEqual([q.before.from, q.before.to, q.current.from, q.current.to], ["2026-04-01", "2026-06-30", "2026-07-01", "2026-09-30"]);
});

test("compareWindows 'firstLast': Cut range only, needs 8 weeks; other kinds name their reason", () => {
  const N = loadNXT(cutFixture());
  const fl = N.compareWindows("cut", "firstLast", "2026-10-19");
  assert.strictEqual(fl.ok, true);
  assert.deepStrictEqual([fl.before.from, fl.before.to, fl.current.from, fl.current.to], ["2026-07-22", "2026-08-18", "2026-09-22", "2026-10-19"]);
  assert.strictEqual(N.compareWindows(30, "firstLast", "2026-10-19").reason, "Only for the Cut range");
  assert.strictEqual(N.compareWindows("cut", "firstLast", "2026-08-30").reason, "Needs 8 weeks of cut");
  const nocut = loadNXT(cutFixture({ cutStart: undefined }));
  assert.strictEqual(nocut.compareWindows("cut", "previous", "2026-10-19").ok, false);
});

test("comparePeriods: counts, coverage, averages, lowest and the unrounded difference", () => {
  const N = loadNXT(cutFixture());
  const w = N.compareWindows(30, "previous", "2026-10-19");
  const c = N.comparePeriods(N.weights(), w.before, w.current);
  const inWin = (f, t) => N.weights().filter(r => r.date >= f && r.date <= t);
  const A = inWin("2026-08-21", "2026-09-19"), B = inWin("2026-09-20", "2026-10-19");
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.a.n, A.length); assert.strictEqual(c.b.n, B.length);
  assert.strictEqual(c.a.days, 30); assert.strictEqual(c.b.coverage, B.length / 30);
  const mean = rs => rs.reduce((s, r) => s + r.weight, 0) / rs.length;
  assert.ok(Math.abs(c.a.avg - mean(A)) < 1e-12 && Math.abs(c.b.avg - mean(B)) < 1e-12);
  assert.strictEqual(c.diff, c.b.avg - c.a.avg, "current − before, unrounded");
  const low = B.reduce((m, r) => (!m || r.weight < m.weight ? r : m), null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.b.low)), { weight: low.weight, date: low.date });
  /* The before window opens straight after the fixture's 10-day gap, where the trend restarts: not ready. */
  assert.strictEqual(c.a.trendFirst, null); assert.strictEqual(c.a.trendChange, null);
  assert.ok(c.b.trendFirst !== null && c.b.trendLast !== null);
  assert.strictEqual(c.b.trendChange, c.b.trendLast - c.b.trendFirst);
});

test("comparePeriods: the change uses unrounded averages, and roundingNote flags when printed values don't subtract (84.4 / 82.8 → −1.7)", () => {
  const bws = []; let ts = 1;
  const put = (from, n, values) => { for (let i = 0; i < n; i++) bws.push({ id: "x" + ts, date: new Date(Date.parse(from + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10), weight: values[i % values.length], timeOfDay: "Morning", ts: ts++ }); };
  put("2026-08-21", 30, [84.44, 84.44]);   // before: average 84.44 → prints 84.4
  put("2026-09-20", 30, [82.76, 82.76]);   // this range: average 82.76 → prints 82.8
  const N = loadNXT(baseState(bws, "2026-10-19"));
  const w = N.compareWindows(30, "previous", "2026-10-19"), c = N.comparePeriods(N.weights(), w.before, w.current);
  assert.strictEqual(c.a.avg.toFixed(1), "84.4"); assert.strictEqual(c.b.avg.toFixed(1), "82.8");
  assert.strictEqual(N.signedFixed(c.diff, 1, "−"), "−1.7", "−1.68 rounds to −1.7");
  assert.strictEqual(c.roundingNote, true, "82.8 − 84.4 would print −1.6, so the footnote is needed");
  /* Values that reconcile need no footnote. */
  const bws2 = []; ts = 1;
  const put2 = (from, n, v) => { for (let i = 0; i < n; i++) bws2.push({ id: "y" + ts, date: new Date(Date.parse(from + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10), weight: v, timeOfDay: "Morning", ts: ts++ }); };
  put2("2026-08-21", 30, 84.4); put2("2026-09-20", 30, 82.8);
  const M = loadNXT(baseState(bws2, "2026-10-19")), w2 = M.compareWindows(30, "previous", "2026-10-19");
  assert.strictEqual(M.comparePeriods(M.weights(), w2.before, w2.current).roundingNote, false);
});

test("comparePeriods: a window with fewer than 3 mornings or under 30% coverage is not compared, with its reason", () => {
  const N = loadNXT(cutFixture());
  /* 12–21 Aug is the fixture's gap: a window inside it holds no mornings. */
  const c = N.comparePeriods(N.weights(), { from: "2026-08-12", to: "2026-08-21" }, { from: "2026-10-10", to: "2026-10-19" });
  assert.strictEqual(c.ok, false); assert.strictEqual(c.diff, null);
  assert.strictEqual(c.a.ok, false);
  assert.strictEqual(c.reason, "0 mornings in 12–21 Aug — too few to compare");
  /* 2 mornings in 30 days (and so 7% coverage). */
  const two = loadNXT(baseState([
    { id: "a", date: "2026-08-25", weight: 84, timeOfDay: "Morning", ts: 1 }, { id: "b", date: "2026-09-02", weight: 84.2, timeOfDay: "Morning", ts: 2 },
    ...Array.from({ length: 30 }, (_, i) => ({ id: "c" + i, date: new Date(Date.parse("2026-09-20T12:00:00Z") + i * 864e5).toISOString().slice(0, 10), weight: 83, timeOfDay: "Morning", ts: 10 + i }))
  ], "2026-10-19"));
  const w = two.compareWindows(30, "previous", "2026-10-19"), r = two.comparePeriods(two.weights(), w.before, w.current);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, "2 mornings in 21 Aug–19 Sept — too few to compare");
  assert.strictEqual(r.b.ok, true, "the other window keeps its own status");
  /* 9 mornings in 30 days: enough mornings, but 30% coverage is the floor. */
  assert.strictEqual(two.comparePeriods(two.weights(), { from: "2026-10-11", to: "2026-10-19" }, w.current).ok, true);
});

test("comparePeriods never reads a post-workout (or other-time) reading", () => {
  const fx = cutFixture(), N = loadNXT(fx), w = N.compareWindows(30, "previous", "2026-10-19");
  const before = JSON.stringify(N.comparePeriods(N.weights(), w.before, w.current));
  /* Post-workout and Night readings inside both windows, well below every morning, and passed in raw. */
  for (const d of ["2026-09-01", "2026-09-10", "2026-10-02", "2026-10-15"]) {
    fx.state.bws.push({ id: "p" + d, date: d, weight: 70, timeOfDay: "Post-workout", ts: 99999 });
    fx.state.bws.push({ id: "n" + d, date: d, weight: 71, timeOfDay: "Night", ts: 99999 });
  }
  assert.strictEqual(JSON.stringify(N.comparePeriods(N.weights(), w.before, w.current)), before, "canonical rows");
  assert.strictEqual(JSON.stringify(N.comparePeriods(fx.state.bws, w.before, w.current)), before, "even when handed the raw store");
  const src = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const body = src.slice(src.indexOf("function compareWindows("), src.indexOf("function workRows()"));
  assert.strictEqual(/timingRows|Post-workout/.test(body), false, "no timing series is consulted");
});

test("comparePeriods 'trendChange' needs a ready trend at both ends; otherwise no difference and the reason", () => {
  const N = loadNXT(cutFixture());
  /* The first window of the cut starts on its first reading, before the trend has 3 mornings. */
  const c = N.comparePeriods(N.weights(), { from: "2026-07-22", to: "2026-08-04" }, { from: "2026-10-06", to: "2026-10-19" }, "trendChange");
  assert.strictEqual(c.ok, false); assert.strictEqual(c.diff, null);
  assert.strictEqual(c.a.trendFirst, null); assert.strictEqual(c.a.trendChange, null);
  assert.strictEqual(c.reason, "Smoothed trend not ready at the start of 22 Jul–4 Aug");
  assert.ok(c.b.trendChange !== null);
  const ok = N.comparePeriods(N.weights(), { from: "2026-09-22", to: "2026-10-05" }, { from: "2026-10-06", to: "2026-10-19" }, "trendChange");
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.diff, ok.b.trendChange - ok.a.trendChange);
  const lo = N.comparePeriods(N.weights(), { from: "2026-09-22", to: "2026-10-05" }, { from: "2026-10-06", to: "2026-10-19" }, "low");
  assert.strictEqual(lo.diff, lo.b.low.weight - lo.a.low.weight);
});

test("compare helpers write nothing and use no significance language", () => {
  const fx = cutFixture(), N = loadNXT(fx), snap = JSON.stringify(fx);
  const w = N.compareWindows(30, "previous", "2026-10-19"); N.comparePeriods(N.weights(), w.before, w.current);
  assert.strictEqual(JSON.stringify(fx), snap);
  const src = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  const body = src.slice(src.indexOf("const COMPARE_MIN_MORNINGS"), src.indexOf("function workRows()"));
  assert.strictEqual(/significan|p-value|real change|confidence/i.test(body.replace(/\/\*[\s\S]*?\*\//g, "")), false);
});

/* =========================================================================
   Commit 3 · selection plumbing
   ========================================================================= */
function chartPage(fx) {
  const ids = ["vn-chart-wrap", "n99-chart-svg", "n99-chart-date", "n99-chart-weight", "n99-chart-average", "n99-chart-coverage",
    "n99-chart-timing", "n99-chart-post", "n99-chart-post-weight", "n99-chart-post-delta", "n99-chart-cursor", "n99-chart-active",
    "st-chart-halo", "n99-chart-slider", "wx-gap", "wx-lab-a", "wx-lab-c", "wx-on", "nxp-progress-latest", "wx-slot", "wx-sel-sr"];
  const els = {}; for (const id of ids) els[id] = makeElement(id);
  const N = loadNXT(fx || cutFixture(), els);
  let repaints = 0; N.repaint = () => { repaints += 1; };
  N.ui.chart = N.chartModel();
  els["vn-chart-wrap"].setAttribute("role", "slider");
  /* The svg is drawn at 1 CSS px per unit, from x = 0. */
  els["n99-chart-svg"].getBoundingClientRect = () => ({ left: 0, top: 0, width: N.ui.chart.W, height: N.ui.chart.H });
  return { N, els, repaints: () => repaints };
}
const ev = (type, o) => Object.assign({ type, pointerId: 7, pointerType: "touch", button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: 0, clientY: 200, preventDefault() { this.prevented = true; } }, o || {});

test("N.ui layer flags default (Weekly and Spread off, Notes on, Projection and Post-workout off), memory only", () => {
  const { N, repaints } = chartPage();
  assert.deepStrictEqual([N.ui.showWeekly, N.ui.showSpread, N.ui.showNotes, N.ui.showPost, N.ui.showForecast, N.ui.layersOpen, N.ui.expanded],
    [false, false, true, false, false, false, false]);
  assert.strictEqual(N.setLayer("weekly", true), true); assert.strictEqual(N.ui.showWeekly, true);
  assert.strictEqual(N.setLayer("notes"), false, "no value toggles"); assert.strictEqual(N.ui.showNotes, false);
  N.setPostVisible(true); assert.strictEqual(N.ui.showPost, true);
  N.setForecastVisible(true); assert.strictEqual(N.ui.showForecast, true);
  assert.strictEqual(repaints(), 4);
  assert.strictEqual(N.setLayer("bogus", true), false); assert.strictEqual(repaints(), 4);
  /* loadNXT's localStorage.setItem throws: reaching here means no layer write touched storage. */
});

test("scrub: a vertical touch swipe never selects; pointercancel (the page scrolled) leaves the selection alone", () => {
  const { N } = chartPage(); const pts = N.ui.chart.points, x = pts[5].x;
  N.scrub(ev("pointerdown", { clientX: x, clientY: 200 }));
  assert.strictEqual(N.ui.selected, null, "a touch pointerdown records only");
  N.scrub(ev("pointermove", { clientX: x + 3, clientY: 212 }));
  N.scrub(ev("pointermove", { clientX: x + 9, clientY: 240 }));
  N.scrubCancel(ev("pointercancel"));
  N.scrubUp(ev("pointerup", { clientX: x + 9, clientY: 240 }));
  assert.strictEqual(N.ui.selected, null);
  /* A diagonal that is not clearly horizontal (|dx| ≤ 1.2·|dy|) is vertical intent too. */
  N.scrub(ev("pointerdown", { clientX: x, clientY: 200 }));
  N.scrub(ev("pointermove", { clientX: x + 10, clientY: 210 }));
  N.scrub(ev("pointermove", { clientX: x + 60, clientY: 212 }));
  N.scrubUp(ev("pointerup", { clientX: x + 60, clientY: 212 }));
  assert.strictEqual(N.ui.selected, null);
});

test("scrub: a horizontal drag locks, captures the pointer and selects only real reading dates", () => {
  const { N, els } = chartPage(); const pts = N.ui.chart.points, dates = new Set(pts.map(p => p.date));
  N.scrub(ev("pointerdown", { clientX: pts[3].x, clientY: 200 }));
  N.scrub(ev("pointermove", { clientX: pts[3].x + 10, clientY: 202 }));
  assert.strictEqual(els["vn-chart-wrap"].captured, true);
  assert.ok(dates.has(N.ui.selected));
  for (let x = pts[3].x; x < pts[20].x; x += 1.7) { N.scrub(ev("pointermove", { clientX: x, clientY: 205 })); assert.ok(dates.has(N.ui.selected)); }
  N.scrubUp(ev("pointerup", { clientX: pts[20].x, clientY: 205 }));
  assert.strictEqual(N.ui.selected, pts[20].date);
  assert.strictEqual(els["vn-chart-wrap"].captured, false);
  assert.ok(/kilograms/.test(els["wx-sel-sr"].textContent), "one polite announcement after pointerup");
});

test("scrub: a tap selects on pointerup; a mouse selects on pointerdown; hover alone does nothing", () => {
  const { N, els } = chartPage(); const pts = N.ui.chart.points;
  N.scrub(ev("pointerdown", { clientX: pts[8].x, clientY: 200 }));
  assert.strictEqual(N.ui.selected, null);
  N.scrubUp(ev("pointerup", { clientX: pts[8].x + 2, clientY: 201 }));
  assert.strictEqual(N.ui.selected, pts[8].date);
  assert.strictEqual(els["wx-sel-sr"].textContent, N.pointWords(pts[8]));
  N.scrub(ev("pointermove", { pointerType: "mouse", pointerId: 1, buttons: 0, clientX: pts[2].x }));
  assert.strictEqual(N.ui.selected, pts[8].date, "hover does not select");
  N.scrub(ev("pointerdown", { pointerType: "mouse", pointerId: 1, clientX: pts[2].x }));
  assert.strictEqual(N.ui.selected, pts[2].date);
  N.scrub(ev("pointermove", { pointerType: "mouse", pointerId: 1, clientX: pts[4].x }));
  assert.strictEqual(N.ui.selected, pts[4].date, "drag scrubs");
  N.scrub(ev("pointerdown", { pointerType: "mouse", pointerId: 1, button: 2, clientX: pts[1].x }));
  assert.strictEqual(N.ui.selected, pts[4].date, "secondary button ignored");
  const src = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.ok(src.indexOf('onpointerup="NXT.scrubUp(event)" onpointercancel="NXT.scrubCancel(event)"') !== -1, "the wrap wires up and cancel");
  const css = fs.readFileSync(path.join(ROOT, "vnext.css"), "utf8");
  assert.ok(/#weightPage \.vn-chart-wrap\{[^}]*touch-action:pan-y/.test(css), "vertical scroll passes through the plot");
});

test("chartKey: ← → Home End PageUp PageDown Esc (back to latest clears, F8) and Enter opens the day", () => {
  const { N, els } = chartPage(); const pts = N.ui.chart.points, n = pts.length;
  const key = k => { const e = { key: k, preventDefault() { e.prevented = true; } }; N.chartKey(e); return e; };
  assert.ok(key("ArrowLeft").prevented); assert.strictEqual(N.ui.selected, pts[n - 2].date);
  key("Home"); assert.strictEqual(N.ui.selected, pts[0].date);
  key("ArrowRight"); assert.strictEqual(N.ui.selected, pts[1].date);
  key("End"); assert.strictEqual(N.ui.selected, null);
  key("PageUp");
  const back = (N.dateMs(pts[n - 1].date) - N.dateMs(N.ui.selected)) / 864e5;
  assert.ok(back >= 6 && back <= 8, "about a week back: " + back);
  const at = N.ui.selected; key("PageDown");
  assert.ok(N.ui.selected > at);
  key("Home"); key("PageUp"); assert.strictEqual(N.ui.selected, pts[0].date, "nothing earlier: stays");
  key("ArrowLeft"); assert.strictEqual(N.ui.selected, pts[0].date);
  key("Escape"); assert.strictEqual(N.ui.selected, null);
  assert.strictEqual(els["n99-chart-date"].textContent, "Latest morning");
  assert.strictEqual(els["n99-chart-weight"].innerHTML, pts[n - 1].weight.toFixed(1) + "<em>kg</em>");
  assert.strictEqual(key("x").prevented, undefined, "other keys pass through");
  /* Adapted for w4: Expand exists now (NXT.expandChart), so F opens it in either case; same intent (F is the
     Expand key, other keys pass through). */
  let expanded = 0; N.expandChart = () => { expanded += 1; };
  assert.ok(key("f").prevented); assert.strictEqual(expanded, 1, "f opens Expand");
  assert.ok(key("F").prevented); assert.strictEqual(expanded, 2);
  key("ArrowLeft"); key("Enter");
  assert.deepStrictEqual(Object.keys(N.ui.returnTo).sort(), ["compare", "expanded", "layers", "range", "scrollY", "selected", "view"]);
  assert.strictEqual(N.ui.returnTo.selected, pts[n - 2].date);
});

test("selectPoint: vs-trend cell (U+2212, kg), label switch, transport state, slot and slider value text", () => {
  const { N, els } = chartPage(); const pts = N.ui.chart.points, n = pts.length;
  const i = pts.findIndex((p, k) => k < n - 1 && p.avg !== null && p.weight < p.avg - 0.06);
  N.selectPoint(i);
  const p = pts[i];
  assert.strictEqual(els["wx-gap"].textContent, "−" + Math.abs(p.weight - p.avg).toFixed(1) + " kg");
  assert.strictEqual(els["wx-lab-a"].textContent, "Morning reading");
  /* D118 (amends D111): the trend cell keeps its name and its sub line names the day, so the time stays explicit
     without the label overflowing the vs cell on a phone. */
  assert.strictEqual(els["wx-lab-c"].textContent, "Smoothed trend");
  assert.strictEqual(els["wx-on"].textContent, "on " + N.shortDate(p.date));
  assert.strictEqual(els["wx-on"].hidden, false, "the day is shown while historical");
  assert.strictEqual(els["nxp-progress-latest"].getAttribute("data-wx-state"), "historical");
  assert.strictEqual(els["wx-slot"].getAttribute("data-wx-slot"), "select");
  assert.strictEqual(els["vn-chart-wrap"].getAttribute("aria-valuenow"), String(i));
  assert.ok(/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day \d{1,2} [A-Z][a-z]+: morning \d+\.\d kilograms, smoothed trend \d+\.\d, \d\.\d (below|above) trend\.$/.test(els["vn-chart-wrap"].getAttribute("aria-valuetext")));
  assert.strictEqual(els["wx-sel-sr"].textContent, "", "no announcement unless asked");
  N.selectPoint(n - 1, { clear: true });
  assert.strictEqual(N.ui.selected, null);
  assert.strictEqual(els["wx-lab-a"].textContent, "Latest morning");
  assert.strictEqual(els["wx-lab-c"].textContent, "Smoothed trend");
  assert.strictEqual(els["wx-on"].hidden, true, "no day on the latest reading");
  assert.strictEqual(els["nxp-progress-latest"].getAttribute("data-wx-state"), "idle");
  assert.strictEqual(els["wx-slot"].getAttribute("data-wx-slot"), "summary");
  els["nxp-progress-latest"].setAttribute("data-wx-state", "playing");
  N.selectPoint(3); assert.strictEqual(els["nxp-progress-latest"].getAttribute("data-wx-state"), "playing", "replay owns the transport");
});

test("pointWords: long date and the point's own figures", () => {
  const N = loadNXT(cutFixture());
  assert.strictEqual(N.pointWords({ date: "2026-09-28", weight: 83.1, avg: 83.72, timeOfDay: "Morning" }),
    "Monday 28 September: morning 83.1 kilograms, smoothed trend 83.7, 0.6 below trend.");
  assert.strictEqual(N.pointWords({ date: "2026-10-19", weight: 81.7, avg: null, timeOfDay: "Morning" }),
    "Monday 19 October: morning 81.7 kilograms, smoothed trend not ready yet.");
  assert.strictEqual(N.pointWords({ date: "2026-10-18", weight: 82.0, avg: 82.02 }),
    "Sunday 18 October: reading 82.0 kilograms, smoothed trend 82.0, on trend.");
});

test("premium-ui's selectPoint wrapper still passes opts (stage 2 F8, verified here too)", () => {
  const UI = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
  assert.ok(/NXT\.selectPoint=function\(index,opts\)\{\s*orig\(index,opts\);/.test(UI));
  const ST = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8");
  assert.ok(ST.indexOf("const o = sp.apply(this, arguments)") !== -1, "strata's wrapper forwards every argument");
});

console.log("");
/* =========================================================================
   Commits 4 and 5 · the plate and the plot (D118, D119)
   ========================================================================= */
test("the plate is the first section, holds no nested <section>, and the banned words are absent (spec §2, §9)", () => {
  const N = loadNXT(cutFixture()); N.ui.range = 30;
  const html = N.chartHTML(), plate = html.slice(0, html.indexOf("</section>"));
  assert.ok(/^\s*<section class="wx-plate/.test(html), "the plate opens the chart HTML");
  assert.strictEqual((plate.match(/<section/g) || []).length, 1, "no nested section inside the plate");
  for (const w of ["certainty", "confidence", "probability", "likelihood", "accuracy"]) assert.strictEqual(plate.toLowerCase().indexOf(w), -1, w);
  assert.strictEqual(plate.indexOf("Estimated level"), -1, "the Estimated level belongs to the Journey");
  for (const w of ["Latest morning", "vs trend", "Smoothed trend", "Morning readings", "Post-workout", "Projection", "Day-to-day spread", "Weekly averages"]) assert.ok(plate.indexOf(w) !== -1, w);
  assert.ok(/data-wx-state="idle"/.test(plate) && /id="nxp-progress-latest"/.test(plate), "the transport slot renders idle on the latest reading");
  assert.ok(/id="wx-layers"[^>]*hidden/.test(plate), "the Layers drawer is in the DOM and hidden");
  assert.ok(html.indexOf('<section class="wx-an"') !== -1 && /Each day vs its trend/.test(html) && /How these numbers are made/.test(html), "Analysis rows follow the plate");
  assert.ok(/First reading|Trend change/.test(plate) && /Lowest/.test(plate) && /Weighed/.test(plate), "the range summary is in the plate's slot");
});

test("plot: every negative is U+2212, kg at 1 dp, rates at 2 dp; no hyphen-minus before a figure in the plate", () => {
  const N = loadNXT(cutFixture()); N.ui.range = 30;
  const html = N.chartHTML(), plate = html.slice(0, html.indexOf("</section>")).replace(/<[^>]+>/g, " ");
  assert.strictEqual(/(^|[\s>(])-\d/.test(plate), false, "hyphen-minus before a number");
  assert.ok(/Losing \d\.\d\d kg a week|Building your baseline|Trend is/.test(plate));
});

test("plot (legacy frame): no <text> inside the plot rect; the pills (end, Low, Start) are gone; the dots carry no fill attribute", () => {
  const N = loadNXT(cutFixture()); N.ui.range = 30;
  const m = N.chartModel(), svg = N.plotHTML(m), base = m.H - m.bottom, plotR = m.W - m.right;
  const texts = [...svg.matchAll(/<text[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"/g)].map(t => ({ x: Number(t[1]), y: Number(t[2]) }));
  assert.ok(texts.length > 0);
  for (const t of texts) assert.ok(!(t.x > m.left && t.x < plotR && t.y > m.top && t.y < base), "text inside the plot at " + JSON.stringify(t));
  assert.strictEqual(/st-pillg is-(end|low|start-ref)/.test(svg), false);
  assert.strictEqual(/vn-start-ref|st-hc-start|Low \d/.test(svg), false);
  const lowIsLast = m.points.reduce((a, q) => q.weight < a.weight ? q : a, m.points[0]) === m.points.at(-1);
  assert.strictEqual(/class="wx-low"/.test(svg), !lowIsLast, "the lowest reading is a hollow ring, unless it is the latest one");
  assert.strictEqual(/<circle class="vn-raw-dot"[^>]*fill=/.test(svg), false, "dot colour comes from the stylesheet (keyline)");
  assert.strictEqual(/st-glow|feGaussianBlur/.test(svg), false, "the blur is retired for an underlay");
  assert.ok(/class="wx-under"/.test(svg));
});

test("plot: a 30-week synthetic cut draws a weekly step for every eligible week (the guard<20 bug), gated by the Weekly layer", () => {
  const N0 = loadNXT(baseState([], "2026-10-19")), start = "2026-03-23", rows = [];
  for (let i = 0; i < 210; i++) { const d = N0.dateAdd(start, i); if (i % 7 === 3) continue; rows.push({ id: "r" + i, date: d, weight: Math.round((90 - i * 0.03 + (i % 5) * 0.1) * 10) / 10, ts: i + 1, timeOfDay: "Morning" }); }
  const fx = baseState(rows, N0.dateAdd(start, 209)); fx.settings.cutStart = start;
  const N = loadNXT(fx); N.ui.range = "cut";
  const m = N.chartModel(); assert.ok(m.points.length > 150);
  const steps = N.weeklySteps(m);
  assert.strictEqual(steps.length, 30, "one step per week with 3+ mornings across all 30 weeks");
  N.ui.showWeekly = false; assert.strictEqual((N.plotHTML(m).match(/class="st-wstep"/g) || []).length, 0, "off by default");
  N.ui.showWeekly = true; assert.strictEqual((N.plotHTML(m).match(/class="st-wstep"/g) || []).length, 30, "every week when on");
  N.ui.showWeekly = false;
});

test("D2: turning on Projection, Post-workout or Spread leaves the y-domain unchanged", () => {
  const N = loadNXT(cutFixture()); N.ui.range = 30;
  const a = N.chartModel(); const dom = [a.low, a.high];
  N.ui.showPost = true; N.ui.showSpread = true; N.ui.showForecast = true; N.ui.showWeekly = true;
  const b = N.chartModel();
  assert.deepStrictEqual([b.low, b.high], dom);
  N.ui.showPost = false; N.ui.showSpread = false; N.ui.showForecast = false; N.ui.showWeekly = false;
});

test("the deleted markup is gone from the chart HTML and from the stylesheets (delete, not override)", () => {
  const N = loadNXT(cutFixture()); N.ui.range = 30; const html = N.chartHTML();
  for (const c of ["vn-mhead", "vn-metric-v", "vn-trend-val", "st-range-row", "st-wchips", "st-csum-d", "vn-togs", "vn-legend", "n99-legend", "st-rread", "vn-weighins", "aria-live=\"polite\" class=\"vn-mhead"]) assert.strictEqual(html.indexOf(c), -1, c);
  const css = fs.readFileSync(path.join(ROOT, "strata.css"), "utf8") + fs.readFileSync(path.join(ROOT, "vnext.css"), "utf8");
  for (const c of [".vn-mhead", ".vn-metric-v", ".vn-trend-val", ".st-wchips", ".vn-togs", ".vn-legend", "#weightPage .vn-weight", ".st-rread", ".st-comet", ".st-hc-start", ".is-start-ref", "#vn-chart-wrap{margin-inline"]) assert.strictEqual(css.indexOf(c), -1, c);
});


/* =========================================================================
   Commits 6–7 · inspector and layers (w3)
   ========================================================================= */
function inspectorPage(fx) {
  const page = chartPage(fx);
  for (const id of ["wx-sel", "wx-sel-d", "wx-sel-l", "wx-sel-ctx", "wx-sel-ctxt", "wx-sel-note-h", "wx-sel-open", "wx-sel-x"]) page.els[id] = makeElement(id);
  page.els["wx-sel-x"].querySelector = () => null; /* the phone bar's × (no text span): never hidden */
  return page;
}

test("lanePlace: the lane sits in the top lane, flips to the bottom lane over a mark, and hides when both collide (spec §8.3)", () => {
  const { N } = chartPage(); const m = N.ui.chart, base = m.H - m.bottom, plotR = m.W - m.right;
  const w = 78, h = 26;
  let top = 0, bottom = 0, hidden = 0;
  for (let i = 0; i < m.points.length; i++) {
    const L = N.lanePlace(m, i, w, h);
    if (!L.lane) { hidden += 1; continue; }
    if (L.lane === "top") { top += 1; assert.strictEqual(L.y, m.top + 6); } else { bottom += 1; assert.strictEqual(L.y, base - 6 - h); }
    assert.ok(L.x - w / 2 >= m.left + 10 - 1e-9 && L.x + w / 2 <= plotR - 10 + 1e-9, "clamped 10 px from the edges");
    /* No reading's dot (with its keyline) sits inside the lane's rect. */
    const r = { x: L.x - w / 2, y: L.y, w, h };
    for (const q of m.points) assert.ok(!(q.x + 4.4 > r.x && q.x - 4.4 < r.x + r.w && q.y + 4.4 > r.y && q.y - 4.4 < r.y + r.h), `reading ${q.date} under the lane at ${i}`);
  }
  assert.ok(top > 0, "some readings use the top lane");
  /* A lane as tall as the plot can fit nowhere: hidden, never placed over the marks. */
  assert.strictEqual(N.lanePlace(m, 3, w, base - m.top).lane, null);
  /* A point whose dot is high in the plot pushes the lane down; the bottom lane is the answer, not a collision. */
  const hi = m.points.reduce((a, q, i) => q.y < m.points[a].y ? i : a, 0);
  const Lhi = N.lanePlace(m, hi, w, Math.max(h, m.points[hi].y - m.top));
  assert.notStrictEqual(Lhi.lane, "top");
});

test("weekBand: the band spans that Monday to Sunday on the model's x scale (clamped) and carries the week's step with the layer off", () => {
  const { N } = chartPage(); N.ui.range = 30; N.ui.chart = N.chartModel(); const m = N.ui.chart;
  assert.strictEqual(N.ui.showWeekly, false);
  const st = N.weekStart(N.dateAdd(m.points.at(-1).date, -10)), b = N.weekBand(m, st);
  assert.ok(b, "a week inside the range");
  assert.strictEqual(b.st, st); assert.strictEqual(b.en, N.dateAdd(st, 6));
  assert.strictEqual(b.x1, Math.max(m.left, m.x(st))); assert.strictEqual(b.x2, Math.min(m.W - m.right, m.x(b.en)));
  assert.ok(b.step && b.step.st === st && Number.isFinite(b.step.y), "the step is found while the Weekly layer is off");
  assert.strictEqual(m.points[b.last].date <= b.en && m.points[b.last].date >= st, true, "selects the week's last reading");
  /* The first (clipped) week starts at the plot's left edge; a week entirely outside the range is null. */
  const first = N.weekBand(m, N.weekStart(m.points[0].date));
  assert.ok(first && first.x1 === m.left);
  assert.strictEqual(N.weekBand(m, N.dateAdd(st, -140)), null);
});

test("layerState: every chip carries its name, default and (when unavailable) the engine's reason (W5 / D115)", () => {
  const { N } = chartPage(); N.ui.range = 30; N.ui.chart = N.chartModel();
  const ls = N.layerState(N.ui.chart), by = Object.fromEntries(ls.map(l => [l.k, l]));
  assert.strictEqual(ls.map(l => l.k).join(), "weekly,spread,post,notes,forecast");
  assert.strictEqual(by.weekly.name, "Weekly averages"); assert.strictEqual(by.spread.name, "Day-to-day spread"); assert.strictEqual(by.post.name, "Post-workout");
  assert.ok(/^Notes · \d+$/.test(by.notes.name)); assert.strictEqual(by.forecast.name, "Projection");
  assert.strictEqual(by.post.why, "No post-workout readings in this range", "the cut fixture has no post-workout rows");
  assert.strictEqual(by.weekly.why, ""); assert.strictEqual(by.spread.why, "");
  /* Two weeks of mornings: the spread's 14-day rule holds, no projection without a confirmed goal. */
  const thin = cutFixture(); thin.state.bws = thin.state.bws.filter(r => r.date >= "2026-10-15"); thin.settings.cutSupport.targetConfirmed = false;
  const { N: T } = chartPage(thin); T.ui.range = 14; T.ui.chart = T.chartModel();
  const tb = Object.fromEntries(T.layerState(T.ui.chart).map(l => [l.k, l]));
  assert.strictEqual(tb.spread.why, "Needs 7 mornings in 14 days");
  assert.strictEqual(tb.weekly.why, "Needs 2 weeks with 3 mornings");
  assert.strictEqual(tb.forecast.why, "Needs a confirmed goal");
  /* The chip markup: aria-pressed on every chip; a disabled one says why, aria-disabled and described by it. */
  const html = N.chartHTML();
  for (const k of ["weekly", "spread", "post", "notes", "forecast"]) assert.ok(new RegExp(`data-wx-layer="${k}" aria-pressed="(true|false)"`).test(html), k);
  assert.ok(/data-wx-layer="post" aria-pressed="false" aria-disabled="true" aria-describedby="wx-why-post"[^>]*>[\s\S]*?<small id="wx-why-post">No post-workout readings in this range<\/small>/.test(html));
});

test("the selection bar is the only inspector, in the slot, at every width; × is named Back to latest", () => {
  const { N } = chartPage(); N.ui.range = 30;
  const html = N.chartHTML();
  assert.ok(html.indexOf('class="wx-sel" id="wx-sel"') !== -1 && html.indexOf("wx-insp") === -1 && html.indexOf("wx-plate n99-chart is-wide") === -1, "the bar, no strip");
  assert.strictEqual((html.match(/id="wx-sel"/g) || []).length, 1, "one inspector");
  assert.ok(html.indexOf('<div class="wx-slot" id="wx-slot" data-wx-slot="summary">') !== -1);
  assert.ok(html.indexOf('aria-label="Back to latest" onclick="NXT.backToLatest()"') !== -1);
  assert.ok(html.indexOf('id="wx-sel-open" data-date="') !== -1 && html.indexOf('onclick="NXT.openChartDay(this.dataset.date)"') !== -1);
  assert.ok(html.indexOf('id="wx-sel-note"') !== -1 && html.indexOf('id="st-note-chip"') !== -1, "both note chips, two ids");
  assert.ok(html.indexOf('<span id="wx-sel-l" hidden>Latest · </span>') === -1 || html.indexOf("Selected · ") !== -1);
  /* The plate still holds no nested section and none of the banned words. */
  const plate = html.slice(0, html.indexOf("</section>"));
  assert.strictEqual((plate.match(/<section/g) || []).length, 1);
  assert.strictEqual(/certainty|confidence|probability|likelihood|accuracy/i.test(plate), false);
});

test("dayContext: NXP.dayState words (D105) with the records as the fallback; selectPoint writes the bar", () => {
  const page = inspectorPage(); const { N, els } = page; const pts = N.ui.chart.points, n = pts.length;
  const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); /* values cross the vm realm */
  same(N.dayContext(pts[3].date), { text: "No training logged", quiet: true, k: "none" });
  const sandboxNXP = { dayState(d) { return d === pts[5].date ? { k: "progress", w: "In progress", label: "Full Body A", lift: true, recorded: { workingSets: 6, cardioMin: 0, floorball: 0, any: true }, detail: "6 of 15 sets" }
    : d === pts[6].date ? { k: "rest", w: "Rest", label: "Rest", lift: false, recorded: { workingSets: 0, cardioMin: 0, floorball: 0, any: false } }
    : d === pts[7].date ? { k: "finished", w: "Workout finished", label: "Full Body B", lift: true, recorded: { workingSets: 15, cardioMin: 0, floorball: 0, any: true }, finished: { at: 1 }, detail: "15 of 15 sets" }
    : d === pts[8].date ? { k: "done", w: "Done", label: "Zone 2", lift: false, recorded: { workingSets: 0, cardioMin: 40, floorball: 0, any: true } }
    : { k: "missed", w: "Not logged", label: "Full Body C", lift: true, recorded: { workingSets: 0, cardioMin: 0, floorball: 0, any: false } }; } };
  /* The engine reads NXP from its own global scope: the loader's sandbox is that scope. */
  const sb = N.__sandbox; if (sb) sb.NXP = sandboxNXP;
  if (sb) {
    assert.strictEqual(N.dayContext(pts[5].date).text, "Full Body A · In progress · 6 of 15 sets");
    assert.strictEqual(N.dayContext(pts[6].date).text, "Rest day");
    assert.strictEqual(N.dayContext(pts[7].date).text, "Full Body B · Finished · 15 of 15 sets");
    assert.strictEqual(N.dayContext(pts[8].date).text, "Zone 2 · Done");
    same(N.dayContext(pts[9].date), { text: "No training logged", quiet: true, k: "missed" });
    N.selectPoint(5);
    assert.strictEqual(els["wx-sel-ctxt"].textContent, "Full Body A · In progress · 6 of 15 sets");
    assert.strictEqual(els["wx-sel-ctx"].dataset.date, pts[5].date);
    assert.strictEqual(els["wx-sel-ctx"].getAttribute("aria-label"), "Full Body A · In progress · 6 of 15 sets. Open in History");
  }
  N.selectPoint(5);
  assert.ok(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]+$/.test(els["wx-sel-d"].textContent), els["wx-sel-d"].textContent);
  assert.strictEqual(els["wx-sel-l"].hidden, true);
  assert.strictEqual(els["wx-sel-open"].dataset.date, pts[5].date);
  assert.ok(els["wx-sel-note-h"].innerHTML.indexOf('id="wx-sel-note"') !== -1 && els["wx-sel-note-h"].innerHTML.indexOf(`data-date="${pts[5].date}"`) !== -1);
  assert.strictEqual(els["wx-slot"].getAttribute("data-wx-slot"), "select");
  N.backToLatest();
  assert.strictEqual(N.ui.selected, null);
  assert.strictEqual(els["wx-sel-l"].hidden, false, "Selected · Latest at the latest reading");
  assert.ok(els["wx-sel-d"].textContent.endsWith(N.shortDate(pts[n - 1].date)), "the latest reading's date");
  assert.strictEqual(els["wx-slot"].getAttribute("data-wx-slot"), "summary");
  assert.strictEqual(els["nxp-progress-latest"].getAttribute("data-wx-state"), "idle");
});

test("returnTo round trip: Open day stores range, selection, layers and scrollY; ‹ Weight restores them and clears the memory", () => {
  const page = inspectorPage(); const { N, els } = page;
  const sb = N.__sandbox; const tabs = []; let scrolled = null; const timers = [];
  /* The settle step waits for the restore render through setTimeout: queued here and run by hand. */
  if (sb) { sb.switchTab = t => { tabs.push(t); }; sb.window.scrollY = 310; sb.window.scrollTo = (x, y) => { scrolled = y; }; sb.setTimeout = f => { timers.push(f); }; }
  const flush = () => { while (timers.length) timers.shift()(); };
  N.ui.range = 90; N.ui.chart = N.chartModel(); N.ui.showSpread = true; N.ui.showNotes = false;
  const pts = N.ui.chart.points;
  N.selectPoint(4);
  N.openChartDay(pts[4].date);
  const r = N.ui.returnTo;
  assert.strictEqual(JSON.stringify(r), JSON.stringify({ view: "overview", range: 90, selected: pts[4].date, layers: { showWeekly: false, showSpread: true, showNotes: false, showPost: false, showForecast: false }, compare: null, expanded: false, scrollY: sb ? 310 : 0 }));
  if (sb) assert.strictEqual(tabs.join(), "history");
  /* Something else moves the UI while in History. */
  N.ui.range = 14; N.ui.showSpread = false; N.ui.showNotes = true; N.ui.selected = null; N.ui.chart = N.chartModel();
  assert.strictEqual(N.returnToWeight(), true);
  assert.strictEqual(N.ui.returnTo, null, "the memory is cleared once used");
  assert.strictEqual(N.ui.range, 90); assert.strictEqual(N.ui.showSpread, true); assert.strictEqual(N.ui.showNotes, false); assert.strictEqual(N.ui.view, "overview");
  if (sb) assert.strictEqual(tabs.join(), "history,weight");
  /* The restore render (progress()) clears N.ui.restoring; here it is done by hand and the selection settles. */
  assert.strictEqual(N.ui.restoring && N.ui.restoring.selected, pts[4].date, "restoring until the render lands");
  N.ui.chart = N.chartModel(); N.ui.restoring = null; flush();
  assert.strictEqual(N.ui.selected, pts[4].date);
  if (sb) assert.strictEqual(scrolled, 310);
  assert.strictEqual(els["wx-slot"].getAttribute("data-wx-slot"), "select");
  assert.strictEqual(N.returnToWeight(), false, "nothing to return to twice");
});

test("toggleLayers: the drawer is always in the DOM, hidden when closed, aria-expanded on the button; setLayer marks a layer change for the plot", () => {
  const { N, els, repaints } = chartPage();
  els["wx-layers"] = makeElement("wx-layers"); els["wx-lyb"] = makeElement("wx-lyb"); els["wx-layers"].closest = () => null;
  assert.strictEqual(N.toggleLayers(), true); assert.strictEqual(els["wx-layers"].hidden, false); assert.strictEqual(els["wx-lyb"].getAttribute("aria-expanded"), "true");
  assert.strictEqual(N.toggleLayers(), false); assert.strictEqual(els["wx-layers"].hidden, true); assert.strictEqual(els["wx-lyb"].getAttribute("aria-expanded"), "false");
  let after = 0; N.setLayer("spread", true, () => { after += 1; });
  assert.strictEqual(N.ui.chartAnim, "layer"); assert.strictEqual(repaints(), 1); assert.strictEqual(after, 1, "focus restore runs after the repaint");
  const html = N.chartHTML();
  assert.ok(html.indexOf("wx-svg is-layer-change") !== -1, "the plot's layer marks fade in"); assert.strictEqual(N.ui.chartAnim, null, "consumed once");
  assert.ok(html.indexOf('id="wx-layers" role="group" aria-label="Chart layers" hidden>') !== -1, "closed: hidden, still in the DOM");
  for (const w of ["Morning readings", "Smoothed trend", "Projection", "Post-workout"]) assert.ok(html.indexOf(w) !== -1, w);
  N.ui.showSpread = false;
});

test("the lane and the week band are wired in strata.js: no touch auto-hide, lanePlace drives the st-tip, Show on chart uses weekBand", () => {
  const st = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8");
  assert.strictEqual(st.indexOf('const t = w.querySelector(".st-tip"); if (t) t.hidden = true; }, 1400)'), -1, "the 1.4 s auto-hide is gone");
  assert.ok(st.indexOf("NXT.lanePlace(m, index, w, h)") !== -1);
  assert.ok(st.indexOf('tip.setAttribute("data-lane", place.lane)') !== -1);
  assert.ok(st.indexOf("NXT.weekBand(mm, li.dataset.a)") !== -1);
  assert.ok(st.indexOf('st-weeksel-step') !== -1 && st.indexOf("!NXT.ui.showWeekly") !== -1, "the week's step draws with the layer off");
  assert.ok(st.indexOf('r.setAttribute("aria-current", "true")') !== -1, "reverse row highlight");
  assert.ok(st.indexOf('document.getElementById("wx-dev")') !== -1, "the deviation bars are found in Analysis");
  const pu = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
  assert.ok(pu.indexOf('class="wx-ret" onclick="NXT.returnToWeight()"') !== -1, "History's ‹ Weight capsule");
  assert.ok(pu.indexOf("if(N.ui.restoring)N.ui.restoring=null;else N.ui.returnTo=null;") !== -1, "a stale memory is dropped on an ordinary visit");
});


/* =========================================================================
   Commits 8–10 · Expand, Compare UI, Journey summary, Rate copy, Simulation (w4)
   ========================================================================= */
const BANNED_CMP = ["significant", "p-value", "real change", "confidence"];
/* The cut fixture lifted 2.5 kg: still above the goal range on 19 Oct, so a projection and a next-kilogram estimate exist. */
function aboveGoalFixture() { const fx = cutFixture(); fx.state.bws.forEach(r => { r.weight = Math.round((r.weight + 2.5) * 10) / 10; }); return fx; }
function roundingFixture() {
  const bws = []; let ts = 1;
  const put = (from, n, values) => { for (let i = 0; i < n; i++) bws.push({ id: "x" + ts, date: new Date(Date.parse(from + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10), weight: values[i % values.length], timeOfDay: "Morning", ts: ts++ }); };
  put("2026-08-21", 30, [84.44, 84.44]); put("2026-09-20", 30, [82.76, 82.76]);
  return baseState(bws, "2026-10-19");
}
function slotOf(html) { const i = html.indexOf('id="wx-slot"'); return html.slice(i, html.indexOf("</section>", i)); }

test("Compare: the capsule sits in the summary head; on it the slot is the table (caption, scope), the x-window spans both windows, the plot marks Before / This range", () => {
  const { N, repaints } = chartPage(); N.ui.range = 30;
  const off = N.chartHTML();
  assert.ok(/<p class="wx-sum-h"><span>Last month · [^<]+<\/span><button type="button" class="wx-cmp-b" id="wx-cmp-b" aria-pressed="false"/.test(off), "Compare capsule in the head row");
  assert.strictEqual(off.indexOf("wx-cmp-t"), -1, "no table while off");
  N.setCompare({}); assert.strictEqual(JSON.stringify(N.ui.compare), '{"kind":"previous","quantity":"avg"}'); assert.strictEqual(N.ui.chartAnim, "compare"); assert.strictEqual(repaints(), 1);
  const html = N.chartHTML(), slot = slotOf(html), m = N.ui.chart, cv = m.compare;
  assert.ok(cv && cv.ok && cv.cp.ok, "the seed compares on 1M");
  assert.strictEqual(m.start, cv.cw.before.from, "the x-window opens on the Before window");
  assert.ok(html.indexOf("wx-svg is-compare-change") !== -1, "the x rescale crossfade class, consumed once"); assert.strictEqual(N.ui.chartAnim, null);
  assert.ok(/<table class="wx-cmp-t"><caption class="st-sr">Average morning in two windows/.test(slot), "caption");
  assert.ok((slot.match(/scope="col"/g) || []).length === 3 && (slot.match(/scope="row"/g) || []).length === 3, "scoped headers: 3 columns, Before / This range / Change rows");
  const a = cv.cp.a, b = cv.cp.b;
  assert.ok(slot.indexOf(`${a.n} of ${a.days}<small> · ${Math.round(a.coverage * 100)}%</small>`) !== -1, "mornings n of N · % for Before, from comparePeriods");
  assert.ok(slot.indexOf(`${b.n} of ${b.days}<small>`) !== -1, "mornings for This range");
  assert.ok(slot.indexOf(`${a.avg.toFixed(1)} kg`) !== -1 && slot.indexOf(`${b.avg.toFixed(1)} kg`) !== -1, "averages at 1 dp");
  assert.ok(slot.indexOf(`<b>${N.signedFixed(cv.cp.diff, 1, "−")} kg</b>`) !== -1, "the change from the unrounded averages, 1 dp, U+2212");
  assert.ok(slot.indexOf("A difference between two averages of your mornings, not a test.") !== -1, "base footnote");
  assert.strictEqual(slot.indexOf("Averages are rounded to 0.1 kg") !== -1, cv.cp.roundingNote, "the rounding footnote only when the printed values do not reconcile");
  assert.ok(/aria-pressed="true"[^>]*onclick="NXT.setCompare\({kind:'previous'}/.test(slot.replace(/data-wx-cmp-kind="previous" /, "")) || /data-wx-cmp-kind="previous" aria-pressed="true"/.test(slot), "the kind capsule is pressed");
  assert.ok(/data-wx-cmp-q="avg" aria-pressed="true"/.test(slot) && /data-wx-cmp-q="trendChange" aria-pressed="false"/.test(slot), "quantity capsules");
  assert.ok(slot.indexOf('id="wx-cmp-done"') !== -1 && slot.indexOf("event.key==='Escape'") !== -1 && slot.indexOf("NXT.setCompare(null)") !== -1, "Done and Esc exit");
  assert.strictEqual(slot.indexOf('data-wx-cmp-kind="firstLast"'), -1, "First vs last 4 weeks is Cut only");
  const svg = html.slice(html.indexOf('<svg id="n99-chart-svg"'), html.indexOf("</svg>", html.indexOf('<svg id="n99-chart-svg"')));
  for (const c of ["wx-cmp-before", "wx-cmp-cur", "wx-cmp-veil"]) assert.ok(svg.indexOf(`class="${c}"`) !== -1, c);
  assert.ok(/wx-cmp-l[^>]*>Before/.test(svg) && /wx-cmp-l[^>]*>This range/.test(svg), "window labels in the bottom lane");
  assert.strictEqual(svg.indexOf("vn-raw-dot") === -1, false, "the same morning dots are drawn in both windows");
  assert.ok(/<p class="wx-leg"[^>]*>.*Before.*This range/.test(html), "legend entries for the two windows");
  for (const w of BANNED_CMP) assert.strictEqual((slot + svg).toLowerCase().indexOf(w), -1, w);
  /* D2 while comparing: the domain is data-only over what is drawn, and layers do not move it. */
  const dom = [m.low, m.high]; N.ui.showSpread = true; N.ui.showForecast = true; N.ui.showPost = true;
  const m2 = N.chartModel(undefined, undefined, undefined, N.chartGeo(), cv.win); assert.deepStrictEqual([m2.low, m2.high], dom);
  N.ui.showSpread = false; N.ui.showForecast = false; N.ui.showPost = false;
  N.setCompare(null); assert.strictEqual(N.ui.compare, null); assert.strictEqual(repaints(), 2);
  assert.strictEqual(slotOf(N.chartHTML()).indexOf("wx-cmp-t"), -1, "exit returns the summary");
});

test("Compare: 84.4 / 82.8 → −1.7 kg with the rounding footnote; 30 of 30 mornings for both windows", () => {
  const N = loadNXT(roundingFixture()); N.ui.range = 30; N.repaint = () => {};
  N.setCompare({ kind: "previous", quantity: "avg" });
  const slot = slotOf(N.chartHTML());
  assert.ok(slot.indexOf("84.4 kg") !== -1 && slot.indexOf("82.8 kg") !== -1 && slot.indexOf("<b>−1.7 kg</b>") !== -1, slot.slice(0, 600));
  assert.ok(slot.indexOf("Averages are rounded to 0.1 kg; the change uses the unrounded averages.") !== -1, "footnote");
  assert.ok((slot.match(/30 of 30<small> · 100%<\/small>/g) || []).length === 2, "mornings 30 of 30 twice");
  assert.strictEqual(/(^|[\s>(])-\d/.test(slot.replace(/<[^>]+>/g, " ")), false, "no hyphen-minus before a figure");
  N.setCompare({ quantity: "low" }); assert.strictEqual(JSON.stringify(N.ui.compare), '{"kind":"previous","quantity":"low"}');
  assert.ok(slotOf(N.chartHTML()).indexOf("A difference between your lowest mornings in two windows, not a test.") !== -1);
});

test("Compare: an insufficient window is disabled with its reason (W5), never hidden; nothing is interpolated", () => {
  /* Mornings only in the last 20 days: every kind's Before window is empty. */
  const bws = []; let ts = 1;
  for (let i = 0; i < 20; i++) bws.push({ id: "s" + i, date: new Date(Date.parse("2026-09-30T12:00:00Z") + i * 864e5).toISOString().slice(0, 10), weight: 83 - i * 0.05, timeOfDay: "Morning", ts: ts++ });
  const N = loadNXT(baseState(bws, "2026-10-19")); N.ui.range = 30; N.repaint = () => {};
  const a = N.compareAvail(); assert.strictEqual(a.ok, false); assert.ok(/too few to compare/.test(a.why), a.why);
  const off = N.chartHTML();
  assert.ok(/class="wx-cmp-b is-off" id="wx-cmp-b" aria-pressed="false" aria-disabled="true" aria-describedby="wx-cmp-why"/.test(off), "disabled capsule");
  assert.ok(/<small id="wx-cmp-why">0 mornings in [^<]+ — too few to compare<\/small>/.test(off), "its reason");
  N.setCompare({});
  const html = N.chartHTML(), slot = slotOf(html);
  assert.ok(/data-wx-cmp-kind="previous" aria-pressed="true" aria-disabled="true" aria-describedby="wx-cmp-why-previous"/.test(slot), "the kind stays visible, disabled with its reason");
  assert.ok(slot.indexOf("<b>—</b>") !== -1 || slot.indexOf("<td class=\"vn-num\"><b>—</b>") !== -1, "no change printed");
  assert.ok(/wx-cmp-f is-why[^>]*><i aria-hidden="true">◆<\/i>0 mornings in/.test(slot), "the reason under the table");
  assert.strictEqual(N.ui.chart.compare.ok && N.ui.chart.compare.cp.ok, false);
  assert.ok(html.indexOf("wx-cmp-before") !== -1 && html.indexOf("vn-raw-dot") !== -1, "the empty Before window is still shown on the hatch, with the real readings only (nothing interpolated)");
  for (const w of BANNED_CMP) assert.strictEqual(slot.toLowerCase().indexOf(w), -1, w);
  N.setCompare(null);
});

/* A small tree DOM for Expand: parentNode, insertBefore, appendChild, remove, querySelector by #id / .class. */
function treeDom() {
  const all = [];
  const find = (root, sel) => { const byId = sel[0] === "#", key = sel.slice(1); const walk = n => { for (const c of n.children) { if (byId ? c.id === key : c.classList.contains(key)) return c; const r = walk(c); if (r) return r; } return null; }; return walk(root); };
  const mk = (tag, id, cls, top, h) => {
    const n = { tag, id: id || "", className: cls || "", children: [], parentNode: null, hidden: false, style: {}, attrs: {}, top: top || 0, h: h || 0, innerHTML: "", textContent: "", offsetHeight: h || 0, clientHeight: 800, clientWidth: 390, open: false, isConnected: true, focused: 0, shown: 0, closed: 0, type: "",
      classList: { contains(c) { return n.className.split(" ").includes(c); }, add(c) { if (!n.classList.contains(c)) n.className += " " + c; }, remove(c) { n.className = n.className.split(" ").filter(x => x !== c).join(" "); }, toggle(c, on) { on ? n.classList.add(c) : n.classList.remove(c); } },
      setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return k in n.attrs ? n.attrs[k] : null; }, removeAttribute(k) { delete n.attrs[k]; },
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = n; n.children.push(c); return c; },
      insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
      removeChild(c) { const i = n.children.indexOf(c); if (i >= 0) n.children.splice(i, 1); c.parentNode = null; return c; },
      remove() { if (n.parentNode) n.parentNode.removeChild(n); },
      querySelector(sel) { return find(n, sel); }, querySelectorAll() { return []; }, addEventListener() {}, closest() { return null; },
      focus() { n.focused += 1; }, getBoundingClientRect() { return { top: n.top, bottom: n.top + n.h, left: 0, right: 390, width: 390, height: n.h }; },
      showModal() { n.open = true; n.shown += 1; }, close() { n.open = false; n.closed += 1; }, setPointerCapture() {}, releasePointerCapture() {} };
    all.push(n); return n;
  };
  return { mk, find, all };
}
function expandPage() {
  const D = treeDom(), page = D.mk("div", "weightPage"), plate = D.mk("section", "vn-weight", "wx-plate");
  page.appendChild(plate);
  const parts = [["div", "", "wx-int", 0, 42], ["button", "", "wx-xbtn", 0, 44], ["div", "", "wx-ro", 52, 69], ["div", "", "wx-rr", 131, 44], ["div", "wx-layers", "wx-layers", 175, 0], ["div", "vn-chart-wrap", "vn-chart-wrap wx-wrap", 183, 337], ["p", "wx-sr-sum", "st-sr", 520, 0], ["p", "wx-sel-sr", "st-sr", 520, 0], ["div", "wx-slot", "wx-slot", 520, 118]];
  const els = {}; for (const [t, id, cls, top, h] of parts) { const n = D.mk(t, id, cls, top, h); plate.appendChild(n); if (id) els[id] = n; }
  els["n99-chart-svg"] = makeElement("n99-chart-svg");
  const N = loadNXT(cutFixture(), els);
  const doc = N.__sandbox.document;
  doc.getElementById = id => (id === "weightPage" ? page : D.find(page, "#" + id)) || els[id] || null;
  doc.createElement = tag => D.mk(tag);
  doc.querySelector = sel => (sel[0] === "#" || sel[0] === ".") && sel.indexOf(" ") === -1 ? D.find(page, sel) : null;
  const scrolls = []; N.__sandbox.scrollTo = (x, y) => scrolls.push(y); N.__sandbox.scrollY = 140;
  N.repaint = () => {};
  N.ui.range = 30; N.ui.chart = N.chartModel();
  return { N, D, page, plate, els, scrolls, wrap: els["vn-chart-wrap"], xbtn: D.find(plate, ".wx-xbtn") };
}

test("Expand: the SAME wrap node moves into a <dialog> (showModal), a placeholder of the block's height stays behind, range / selection / layers / compare carry over (spec §10)", () => {
  const { N, page, plate, wrap, xbtn, D } = expandPage();
  const before = plate.children.slice();
  N.ui.showWeekly = true; N.ui.selected = N.ui.chart.points[4].date; N.selectPoint(4);
  assert.strictEqual(N.expandChart(), true);
  const d = D.find(page, "#wx-xv");
  assert.ok(d && d.tag === "dialog" && d.open && d.shown === 1 && d.getAttribute("aria-labelledby") === "wx-xv-h", "a modal dialog inside #weightPage");
  assert.strictEqual(wrap.parentNode, D.find(d, "#wx-xv-body"), "the same node, re-hosted (identity)");
  assert.strictEqual(D.find(d, "#wx-slot").id, "wx-slot"); assert.strictEqual(D.find(d, "#wx-xv-foot").children.map(c => c.className.split(" ")[0]).join(","), "wx-rr,wx-layers", "range row and Layers at the bottom");
  const ph = D.find(plate, "#wx-ph"); assert.ok(ph, "placeholder"); assert.strictEqual(plate.children.indexOf(ph), 2, "where the readouts were");
  assert.strictEqual(ph.style.height, (520 + 118 - 52) + "px", "the moved block's height");
  assert.strictEqual(plate.children.filter(c => c.id === "vn-chart-wrap").length, 0, "not cloned");
  assert.deepStrictEqual([N.ui.expanded, N.ui.chartKind, N.ui.range, N.ui.selected, N.ui.showWeekly, N.ui.compare], [true, "expand", 30, N.ui.chart.points[4].date, true, null], "state preserved");
  assert.ok(wrap.innerHTML.indexOf("<svg") !== -1 && wrap.getAttribute("aria-valuenow") === "4", "re-rendered in place with the selection");
  assert.strictEqual(D.find(d, "#wx-xv-x").focused, 1, "× takes first focus");
  assert.ok(/Last month · /.test(D.find(d, "#wx-xv-r").textContent), "the range in words");
  /* Show as table: the plot swaps for a plain table with a caption and scoped headers. */
  assert.strictEqual(N.xvToggleTable(), true); assert.strictEqual(wrap.hidden, true);
  const tbl = D.find(d, "#wx-xv-table"); assert.strictEqual(tbl.hidden, false);
  assert.ok(/<table class="wx-tbl"><caption>Morning readings and smoothed trend, kg · Last month/.test(tbl.innerHTML) && (tbl.innerHTML.match(/scope="col"/g) || []).length === 4, tbl.innerHTML.slice(0, 200));
  assert.strictEqual((tbl.innerHTML.match(/scope="row"/g) || []).length, N.ui.chart.points.length, "one row per morning");
  assert.ok(tbl.innerHTML.indexOf("−") !== -1 && !/(^|[\s>(])-\d/.test(tbl.innerHTML.replace(/<[^>]+>/g, " ")), "U+2212");
  assert.strictEqual(D.find(d, "#wx-xv-tb").getAttribute("aria-pressed"), "true");
  /* The restore list, on × : nodes back in order, placeholder gone, page geometry, scroll, focus on Expand, flag. */
  assert.strictEqual(N.collapseChart(), true);
  assert.deepStrictEqual(plate.children, before, "every node back in its place; the placeholder removed");
  assert.strictEqual(wrap.parentNode, plate); assert.strictEqual(wrap.hidden, false, "the table alternative is undone");
  assert.deepStrictEqual([N.ui.expanded, N.ui.chartKind, N.ui.xvTable, d.open, d.closed, xbtn.focused, N.ui.xvRestores], [false, "page", false, false, 1, 1, 1]);
  assert.ok(wrap.innerHTML.indexOf("<svg") !== -1, "re-rendered for the page");
  N.ui.showWeekly = false; N.selectPoint(N.ui.chart.points.length - 1, { clear: true });
});

test("Expand: the restore list runs on every exit path — Open day (no focus return), a tab switch, a re-render rehost — and never twice", () => {
  const { N, plate, wrap, xbtn, scrolls, D, page } = expandPage();
  assert.strictEqual(N.collapseChart(), false, "nothing to restore while closed");
  N.expandChart(); assert.strictEqual(scrolls.length, 0);
  N.openChartDay(N.ui.chart.points[3].date);
  assert.deepStrictEqual([N.ui.expanded, wrap.parentNode === plate, xbtn.focused, N.ui.returnTo.expanded, N.ui.returnTo.selected], [false, true, 0, false, null], "Open day restores without returning focus");
  N.ui.returnTo = null;
  /* The tab-switch path (strata.js navigate) and the re-render path (premium-ui progress) are called with the same options. */
  N.expandChart(); const d = D.find(page, "#wx-xv");
  assert.strictEqual(N.collapseChart({ focus: false, rerender: false, scroll: false, silent: true }), true);
  assert.deepStrictEqual([N.ui.expanded, wrap.parentNode === plate, D.find(plate, "#wx-ph"), scrolls.length, xbtn.focused], [false, true, null, 0, 0]);
  /* × restores the scroll the page had when Expand opened. */
  N.__sandbox.scrollY = 260; N.expandChart(); N.__sandbox.scrollY = 0; N.collapseChart();
  assert.deepStrictEqual(scrolls, [260]); assert.strictEqual(xbtn.focused, 1);
  /* A rehost re-uses the one dialog (closed and shown again) and moves the fresh nodes in. */
  N.expandChart(); assert.strictEqual(d.shown, 4); N.expandChart({ rehost: true }); assert.strictEqual(d.shown, 5); assert.strictEqual(d.closed, 4);
  assert.strictEqual(N.expandChart(), true, "already open: a no-op"); assert.strictEqual(d.shown, 5);
  N.collapseChart();
  const st = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8"), pu = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
  assert.ok(st.indexOf('NXT.collapseChart({ focus: false, rerender: false, scroll: false, silent: true })') !== -1, "strata.js navigate runs the restore list before a tab switch");
  assert.ok(st.indexOf("dressChart") !== -1, "the re-drawn plot is dressed (lane host, width watch)");
  assert.ok(pu.indexOf("N.expandChart({rehost:true})") !== -1 && pu.indexOf("xv.parentNode.removeChild(xv)") !== -1, "premium-ui keeps the dialog across a Weight re-render and re-hosts the fresh nodes");
  assert.strictEqual(/history\.(pushState|back|go)\(/.test(fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8")), false, "no history entry is pushed");
});

test("Journey summary: Start weight / Estimated level (estimate tag) / Goal range, ▶ Play · ⌄ Details, the recorded vs estimated-level milestone split, the rewind capsule; the default mode is unchanged", () => {
  const N = loadNXT(aboveGoalFixture()); N.ui.range = 30; N.repaint = () => {};
  const j = N.journeyHTML(undefined, undefined, { mode: "summary" }), fv = N.forecastView();
  assert.ok(fv.showArrival, "the fixture carries a current projection");
  assert.ok(/^<section class="vn-journey st-jr is-sum" aria-label="Cut journey" data-st-jr=/.test(j), j.slice(0, 120));
  assert.ok(/<em>Start weight<\/em><i>22 Jul<\/i>/.test(j), "Start weight, the saved setting, dated");
  assert.ok(/<em data-st-jr-noww>Estimated level<i>\d+ \w+<\/i><\/em><u class="st-jr-est">estimate<\/u>/.test(j), "Estimated level, marked as an estimate");
  assert.ok(/<em>Goal range<\/em><i>~\d+ \w+ · \d+(–\d+)? wk<\/i>/.test(j) === fv.showArrival, "the goal is dated from forecastView while current");
  const nl = N.nowLevel(); assert.ok(nl.value > 82 ? j.indexOf("to go to the top of 80–82") !== -1 : j.indexOf("<b>In range</b>") !== -1, "to go to the top of the goal range, or In range");
  assert.ok(/<button type="button" class="st-jr-act st-jr-play" data-st-story>.*Play your cut/.test(j) && /class="st-jr-act st-jr-det" id="st-jr-det" aria-expanded="false" aria-controls="st-jr-more"/.test(j), "actions");
  assert.ok(/<div class="st-jr-more" id="st-jr-more" hidden>/.test(j), "closed by default");
  assert.ok(/<p class="st-jr-mh">Recorded<\/p><ul><li><button type="button" class="st-jr-mc is-rec" data-st-jr-go="[\d-]+"><i aria-hidden="true">✓<\/i>Lowest weigh-in \d+\.\d/.test(j), "a recorded weigh-in: solid chip, ✓");
  assert.ok(/<p class="st-jr-mh">Milestones · on your estimated level<\/p><ul>(<li><button type="button" class="st-jr-mc is-lvl"[^>]*><i aria-hidden="true">◌<\/i>(First kg down|Halfway|5% of your start) <em>[^<]+<\/em><\/button><\/li>)+/.test(j), "computed milestones: dashed chips under their own heading");
  assert.ok(j.indexOf('class="st-jr-mc is-est"') !== -1 && /\d+ kg <em>~[^<]+ · estimate<\/em>/.test(j), "the next-kilogram estimate, dashed and named an estimate");
  assert.ok(/<div class="st-jr-rw" hidden><span class="st-jr-rwc"><i aria-hidden="true">◷<\/i><span class="st-jr-rww">Rewound · <\/span><b data-st-jr-rwd><\/b><span class="st-sr"> · <span data-st-jr-rwk><\/span><\/span><\/span><button type="button" class="st-jr-back" hidden>Back to today<\/button><\/div>/.test(j), "the rewind capsule with Back to today, hidden until a rewind");
  assert.strictEqual(j.indexOf("First reading"), -1, "the Journey never calls the saved start the first reading (W6)");
  assert.strictEqual(j.indexOf("as of"), -1, '"as of" is the aging forecast\'s word (D104)');
  const full = N.journeyHTML();
  assert.ok(full.indexOf("is-sum") === -1 && /<b class="vn-num">\d+\.\d<\/b>Start<i>/.test(full) && /80–82<\/b>Goal/.test(full), "the default mode is unchanged (weight-contract reads it)");
  const page = N.chartHTML();
  assert.ok(page.indexOf('class="vn-journey st-jr is-sum"') !== -1, "the Weight page shows the summary");
  assert.ok(page.indexOf("Start weight") !== -1 && page.indexOf("First reading") === -1, "on 1M: Start weight in the Journey, no First reading cell");
  N.ui.range = "cut"; const cut = N.chartHTML(), plate = cut.slice(0, cut.indexOf("</section>"));
  assert.ok(plate.indexOf("First reading") !== -1 && plate.indexOf("Start weight") === -1 && cut.indexOf("Start weight") !== -1, "Cut: First reading in the plate, Start weight in the Journey, never one name");
  N.ui.range = 30;
  assert.strictEqual(N.jrToggle(), true); assert.ok(/st-jr is-sum is-open/.test(N.chartHTML()) && /id="st-jr-more">/.test(N.chartHTML()), "Details opens in place, memory only");
  N.jrToggle(false);
  const st = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8");
  assert.ok(st.indexOf('const rw = q(".st-jr-rw"), cur = document.querySelector("#weightPage [data-wx-current]")') !== -1 && st.indexOf("Current analysis · as of") !== -1, "a rewind shows the capsule and the Rate card's Current analysis line");
});

test("Journey summary and Rate while paused: no dated projection anywhere; Compare still reads the mornings that exist", () => {
  const fx = cutFixture(); fx.state.bws = fx.state.bws.filter(r => r.date <= "2026-09-29");
  const N = loadNXT(fx); N.ui.range = 30; N.repaint = () => {};
  const fv = N.forecastView(); assert.ok(fv.freshness === "stale" || fv.freshness === "expired", fv.freshness);
  const j = N.journeyHTML(undefined, undefined, { mode: "summary" });
  assert.ok(/<em>Goal range<\/em><\/span>/.test(j), "no date on the goal label");
  assert.strictEqual(j.indexOf("~"), -1, "no ~date anywhere in the summary");
  assert.strictEqual(j.indexOf("is-est"), -1, "no next-kilogram estimate while paused");
  const html = N.chartHTML(), rate = html.slice(html.indexOf('data-wx-row="rate"'), html.indexOf('data-wx-row="rax"') > 0 ? html.indexOf('data-wx-row="rax"') : html.indexOf('data-wx-row="dev"'));
  assert.ok(/<p>Projection<\/p><b>Paused<\/b>/.test(rate), "Projection paused");
  assert.strictEqual(rate.indexOf("Projection range"), -1, "no Projection range while paused");
  assert.strictEqual(/around \d+ \w+/.test(rate), false, "no arrival date");
  assert.strictEqual(html.indexOf("wx-sim"), -1, "no Simulation box in a default render");
  N.setCompare({}); const slot = slotOf(N.chartHTML());
  assert.ok(slot.indexOf("wx-cmp-t") !== -1 && /\d+ of \d+<small>/.test(slot), "Compare reads the mornings in each window");
  N.setCompare(null);
});

test("Rate and Projection copy (CONTRACTS §3, §4): Rate range, Rate precision, Projection range; the retired words are gone; the Simulation box is absent from a default render", () => {
  const N = loadNXT(aboveGoalFixture()); N.ui.range = 30;
  const html = N.chartHTML(), i = html.indexOf('data-wx-row="rate"'), rate = html.slice(i, html.indexOf('data-wx-row="', i + 20));
  const pl = N.detectPlateau(), rs = N.rateSpan(pl), fv = N.forecastView();
  assert.ok(pl.ok && rs.full, "the fixture carries a 4-week rate");
  assert.ok(/<b>Rate range<\/b> · Likely between [−+]?\d\.\d\d and [−+]?\d\.\d\d kg\/wk over the last four weeks\./.test(rate), "Rate range copy");
  assert.ok(/The 4-week rate is likely within ±\d\.\d\d kg a week\./.test(rate), "Rate precision copy");
  assert.ok(/<p>Rate precision<\/p><b>(High|Medium|Low)<\/b>/.test(rate), "Rate precision, the categorical value kept (W6)");
  assert.ok(/Rate precision (High|Medium|Low)/.test(rate), "the row summary names it");
  assert.ok(fv.showArrival && /<b>Projection range<\/b> · Likely between \d+ \w+ and \d+ \w+\. /.test(rate), "Projection range as two dates: " + rate.slice(rate.indexOf("Projection"), rate.indexOf("Projection") + 400));
  assert.ok(rate.indexOf("An estimate, not a promise.") !== -1, "an estimate, not a promise");
  assert.ok(/<p class="wx-current" data-wx-current="\d+ \w+" hidden><\/p>/.test(rate), "the Current analysis hook, empty until a rewind");
  for (const w of ["known to within", "95%", "9 in 10", "not a measurement", "confidence", "certainty", "accuracy", "probability", "likelihood", "SIMULATION", "wx-sim", "st-ev-wi"]) assert.strictEqual(rate.toLowerCase().indexOf(w.toLowerCase()), -1, w);
  assert.ok(/data-st-ev="[^"]*nowName/.test(rate), "the gauge names what the what-if starts from");
  assert.ok(/[−]\d\.\d\d kg\/wk/.test(rate.replace(/<[^>]+>/g, "")) && !/(^|[\s>(])-\d/.test(rate.replace(/<[^>]+>/g, " ")), "rates at 2 dp with U+2212");
  const st = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8");
  assert.ok(st.indexOf('after.insertAdjacentHTML("afterend", `<div class="wx-sim"') !== -1 && st.indexOf('<i aria-hidden="true">◌</i>Simulation · What if') !== -1 && st.indexOf('class="wx-sim-reset">Reset<') !== -1, "the box is built on the first drag, with Reset");
  assert.strictEqual(st.indexOf("reset(1800)"), -1, "no spring-back: it persists (W8 / D117)");
  assert.ok(st.indexOf('e.key === "Escape" && cur !== null') !== -1, "Esc resets");
  assert.ok(st.indexOf("A what-if, not a forecast or a target.") !== -1 && st.indexOf("faster than the 1% line") !== -1);
  const css = fs.readFileSync(path.join(ROOT, "strata.css"), "utf8");
  assert.strictEqual(css.indexOf(".st-ev-wi"), -1, "the retired what-if box CSS is deleted, not overridden");
  assert.ok(css.indexOf("#weightPage .wx-sim{") !== -1 && /\.wx-sim\{[^}]*var\(--wx-hatch\)[^}]*dashed/.test(css), "hatched, dashed, neutral");
  /* Day-to-day spread: its own legend entry wherever the band is drawn. */
  N.ui.showSpread = true; const on = N.chartHTML();
  assert.ok(/<p class="wx-leg" id="wx-leg" aria-label="Chart legend"><span><i class="wx-key-band" aria-hidden="true"><\/i>Day-to-day spread<\/span><\/p>/.test(on) && on.indexOf('class="wx-spread"') !== -1, "legend row with the band");
  N.ui.showSpread = false; assert.strictEqual(N.chartHTML().indexOf('id="wx-leg"'), -1, "no legend row without a band");
});

test("w5 · phone-first: no wide path, Layers trims the page plot 12 px, the rewound level is the contract name, Larger text and reduced transparency are in the CSS", () => {
  const cs = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8"), st = fs.readFileSync(path.join(ROOT, "strata.js"), "utf8"), css = fs.readFileSync(path.join(ROOT, "strata.css"), "utf8");
  assert.ok(!/wxWide|wx-insp|is-wide\$\{/.test(cs + st) && !/wx-insp|\.wx-plate\.is-wide/.test(css), "the wide-width paths are gone");
  assert.strictEqual(withViewport(390, 844, n => n.chartGeo("page")).plotH, 300);
  assert.strictEqual(withViewport(390, 844, n => { n.ui.layersOpen = true; return n.chartGeo("page"); }).plotH, 288, "Layers open: 12 px off the page plot (spec §19.6)");
  assert.strictEqual(withViewport(390, 844, n => { n.ui.layersOpen = true; return n.chartGeo("expand"); }).plotH, withViewport(390, 844, n => n.chartGeo("expand")).plotH, "Expand fits itself instead");
  assert.ok(st.indexOf('jrWord("Estimated level", ds)') !== -1 && st.indexOf('jrWord("Then"') === -1, "a rewound level carries the contract name");
  assert.ok(/:root\[data-nxp-size="large"\] #weightPage\{--wx-s:1\.12;--wx-sn:1\.06\}/.test(css), "Larger text scales the Weight tokens ×1.12, numerals ×1.06");
  assert.ok(/prefers-reduced-transparency:reduce\)\{\s*#weightPage\{--btn-glass[\s\S]*?\.wx-plate\{background:#12111B/.test(css) && /prefers-reduced-transparency:reduce\)\{#weightPage \.wx-xv,#weightPage \.wx-xv::backdrop\{background:#07070C/.test(css), "plate glass and the Expand dialog fall back to solid");
});

console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
