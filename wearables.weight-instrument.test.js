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
    try { vm.runInContext(SRC, ctx, { filename: "cut-support.js" }); return ctx.__NXT__; }
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
  assert.strictEqual(withViewport(1280, 800, n => n.chartGeo("wide")).plotH, 330, "wide: svh − 470");
  assert.strictEqual(withViewport(1440, 900, n => n.chartGeo("wide")).plotH, 430);
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
    "st-chart-halo", "n99-chart-slider", "wx-gap", "wx-lab-a", "wx-lab-c", "nxp-progress-latest", "wx-slot", "wx-sel-sr"];
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
  assert.strictEqual(key("f").prevented, undefined, "F waits for Expand");
  let expanded = 0; N.expandChart = () => { expanded += 1; };
  assert.ok(key("F").prevented); assert.strictEqual(expanded, 1);
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
  assert.strictEqual(els["wx-lab-c"].textContent, "Smoothed trend · on " + N.shortDate(p.date));
  assert.strictEqual(els["nxp-progress-latest"].getAttribute("data-wx-state"), "historical");
  assert.strictEqual(els["wx-slot"].getAttribute("data-wx-slot"), "select");
  assert.strictEqual(els["vn-chart-wrap"].getAttribute("aria-valuenow"), String(i));
  assert.ok(/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day \d{1,2} [A-Z][a-z]+: morning \d+\.\d kilograms, smoothed trend \d+\.\d, \d\.\d (below|above) trend\.$/.test(els["vn-chart-wrap"].getAttribute("aria-valuetext")));
  assert.strictEqual(els["wx-sel-sr"].textContent, "", "no announcement unless asked");
  N.selectPoint(n - 1, { clear: true });
  assert.strictEqual(N.ui.selected, null);
  assert.strictEqual(els["wx-lab-a"].textContent, "Latest morning");
  assert.strictEqual(els["wx-lab-c"].textContent, "Smoothed trend");
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
console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
