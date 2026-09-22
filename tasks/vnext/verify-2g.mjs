/* VNext 2G — Progress / Performance.
   Synthetic lifting history only. No browser. Cursor does not run Playwright;
   this loads the shipped engine and the presentation layer in a vm and paints
   the Performance tab the same way the page does. */
import fs from "fs";
import path from "path";
import vm from "vm";
import assert from "assert";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (err) { failed++; console.log("FAIL  " + name); console.log("      " + (err && err.stack ? err.stack : err)); }
}

const TODAY = "2026-09-22";
const HOST = ["renderHistory", "renderFloorball", "apx96MoreSectionHTML", "getT", "readiness",
  "getFullBackup", "applyCloudPayload", "apx96OpenQueueManager", "openEditSet", "closeModal",
  "renderHome", "renderTrain", "renderWeight", "renderMore", "exerciseDefByName", "ensureSessionPlan",
  "setsDone", "safeSetsDone", "safeSuggestedWeight", "safeLastSet", "logSet", "apx96UndoLastSet",
  "completeDay", "cycleDayType", "renderRest", "apx96SaveReadiness", "suggestedRestSeconds",
  "weeklyLossRate", "weekStartString", "zone2MinutesThisWeek", "zone2MinutesThisWeekSafe",
  "projectedGoalDate", "estimatedTotalBurnToday", "apx95StrengthItems", "apx95Verdict",
  "apx95SetView", "enhancedRecoveryWarningHTML", "weeklyPlanHTML", "workoutTemplateSettingsHTML",
  "apx96SetMoreView", "restoreBackup", "v88OpenNoteModal", "apx95OpenQuickWeight",
  "apx95SaveQuickWeight", "saveEditedSet", "persist", "toast", "render", "uid", "save",
  "showHistoryDay", "exportJSON", "hasStoredSbAuthToken", "switchTab", "template"];

function makeElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }
  };
}

const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8") + "\n;globalThis.__NXT__ = NXT;\n";
const PREM = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8") + "\n;globalThis.__NXP__ = NXP;\n";

function loadApp() {
  const discovered = {};
  const build = () => {
    const page = makeElement();
    const sandbox = {
      console,
      document: {
        getElementById(id) { return id === "weightPage" ? page : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement() { return makeElement(); },
        addEventListener() {},
        removeEventListener() {},
        documentElement: makeElement(),
        activeElement: null,
        readyState: "loading",
        title: "",
        body: makeElement()
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_key, fallback) { return fallback; },
      esc(v) {
        return String(v == null ? "" : v)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      },
      state: {
        date: TODAY, logs: [], bws: [], scans: [], sessionPlans: {}, read: [],
        gyms: [], dayType: "Rest", gym: "Gym A", tab: "weight"
      },
      settings: { cutSupport: { version: 99, targetConfirmed: true }, weeklyPlan: {} },
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null,
      cloudSyncAgo() { return ""; },
      TARGET_LOW: 78, TARGET_HIGH: 80,
      goalLow() { return 78; }, goalHigh() { return 80; },
      __page: page
    };
    sandbox.window = sandbox;
    for (const n of HOST) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox)) sandbox[n] = discovered[n];
    return sandbox;
  };
  let ctx;
  for (let attempt = 0; attempt < 140; attempt++) {
    ctx = vm.createContext(build());
    try { vm.runInContext(CUT, ctx, { filename: "cut-support.js" }); break; }
    catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss || attempt === 139) throw err;
      discovered[miss[1]] = function () { return null; };
      ctx = null;
    }
  }
  if (!ctx || !ctx.__NXT__) throw new Error("cut-support.js did not load");
  vm.runInContext(PREM, ctx, { filename: "premium-ui.js" });
  if (!ctx.__NXP__) throw new Error("premium-ui.js did not load");
  return ctx;
}

const app = loadApp();
const N = app.__NXT__;
const NXP = app.__NXP__;
const state = app.state;
const page = app.__page;

function fmtLoad(v) {
  const r = Math.round(Number(v) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
function lift(logs, exercise, gym, date, weight, reps, extra) {
  logs.push(Object.assign({
    id: "g" + logs.length, date, gym, exercise, setNum: 1, weight, reps,
    setType: "working", ts: logs.length + 1
  }, extra || {}));
}
function quad(logs, exercise, gym, weights, reps, dates) {
  dates.forEach((date, i) => lift(logs, exercise, gym, date, weights[i], reps));
}
function splitRows(html) {
  return html.split('<li class="vn-perf-row"').slice(1).map(part => part.slice(0, part.indexOf("</li>")));
}
function rowMatching(html, name, gym) {
  return splitRows(html).find(row => row.includes(">" + name + "<") && row.includes('data-gym="' + gym + '"'));
}
function paint(logs, view) {
  state.logs = logs;
  state.date = TODAY;
  N.ui.view = view;
  const logBefore = JSON.stringify(state.logs);
  const itemsBefore = view === "strength" ? N.strengthItems() : null;
  NXP.progress();
  const logAfter = JSON.stringify(state.logs);
  return { html: page.innerHTML, logBefore, logAfter, items: itemsBefore };
}
function ownScale(item) {
  const values = item.history.slice(-8).map(x => x.value);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const span = max - min || 1;
  const points = values.map((v, i) => ({ x: 4 + i / Math.max(1, values.length - 1) * 102, y: 35 - (v - min) / span * 28 }));
  return { min, max, d: N.smoothPath(points) };
}

const qDates = [N.dateAdd(TODAY, -42), N.dateAdd(TODAY, -28), N.dateAdd(TODAY, -14), N.dateAdd(TODAY, -1)];
const qDatesB = [N.dateAdd(TODAY, -40), N.dateAdd(TODAY, -27), N.dateAdd(TODAY, -13), N.dateAdd(TODAY, -4)];

function mainLogs() {
  const logs = [];
  quad(logs, "Smith Bench", "Gym A", [100, 100, 110, 110], 6, qDates);
  lift(logs, "Smith Bench", "Gym A", qDates[3], 200, 5, { setType: "warmup", setNum: 0 });
  lift(logs, "Smith Bench", "Gym A", qDates[3], 150, 20, { setNum: 2 });
  quad(logs, "Leg Press", "Gym A", [80, 80, 80, 80], 6, qDates);
  quad(logs, "Hamstring Curl", "Gym A", [100, 100, 80, 96], 6, qDates);
  quad(logs, "Shoulder Press", "Gym A", [100, 100, 80, 80], 6, qDates);
  lift(logs, "Face Pull", "Gym A", N.dateAdd(TODAY, -12), 20, 12);
  lift(logs, "Face Pull", "Gym A", N.dateAdd(TODAY, -4), 22, 12);
  lift(logs, "Cable Crunch", "Gym A", N.dateAdd(TODAY, -70), 40, 10);
  quad(logs, "Lat Pulldown", "Gym A", [80, 82, 84, 86], 8, qDates);
  quad(logs, "Lat Pulldown", "Gym B", [40, 40, 42, 42], 8, qDatesB);
  quad(logs, "Reverse Fly", "Gym A", [6, 6, 7, 7], 12, qDates);
  lift(logs, "Single-Arm Cable Lateral Raise with Slow Eccentric", "Gym A", N.dateAdd(TODAY, -7), 8, 12);
  [N.dateAdd(TODAY, -16), N.dateAdd(TODAY, -9), N.dateAdd(TODAY, -3)].forEach((date, i) => {
    lift(logs, "Tricep Pushdown", "Gym A", date, 25 + i, 10);
  });
  return logs;
}

const STATUSES = ["Improving", "Holding steady", "Watch", "Review", "Building data", "Older history"];
const FLAGS = ["is-improving", "is-holding", "is-watch", "is-review", "is-older", "is-building"];

test("the engine still classifies the six statuses from the frozen rules", () => {
  const painted = paint(mainLogs(), "strength");
  const by = {};
  for (const item of painted.items) by[item.name + "@" + item.gym] = item;
  const expect = {
    "Smith Bench@Gym A": "Improving",
    "Leg Press@Gym A": "Holding steady",
    "Hamstring Curl@Gym A": "Watch",
    "Shoulder Press@Gym A": "Review",
    "Face Pull@Gym A": "Building data",
    "Cable Crunch@Gym A": "Older history",
    "Tricep Pushdown@Gym A": "Building data",
    "Single-Arm Cable Lateral Raise with Slow Eccentric@Gym A": "Building data"
  };
  for (const [key, status] of Object.entries(expect)) {
    assert.ok(by[key], "missing " + key);
    assert.strictEqual(by[key].status, status, key + " was " + by[key].status + " delta " + by[key].delta);
  }
  assert.strictEqual(by["Leg Press@Gym A"].delta, 0);
  assert.strictEqual(by["Face Pull@Gym A"].delta, null);
  assert.strictEqual(by["Cable Crunch@Gym A"].delta, null);
  assert.ok(by["Smith Bench@Gym A"].delta >= 2);
  assert.ok(by["Hamstring Curl@Gym A"].delta < -5);
  assert.strictEqual(by["Shoulder Press@Gym A"].tone, "watch");
});

test("every status is the engine word, with its shape, and a null delta is not 0%", () => {
  const { html, items } = paint(mainLogs(), "strength");
  const rows = splitRows(html);
  assert.strictEqual(rows.length, items.length);
  const seen = new Set();
  rows.forEach((row, i) => {
    const item = items[i];
    seen.add(item.status);
    assert.ok(row.includes('data-status="' + item.status + '"'), item.name);
    assert.ok(row.includes(">" + item.name + "<"), item.name);
    assert.ok(row.includes(item.status + "<i aria-hidden"), item.name + " status word");
    const flag = { "Improving":"is-improving", "Holding steady":"is-holding", "Watch":"is-watch", "Review":"is-review", "Older history":"is-older", "Building data":"is-building" }[item.status];
    assert.ok(row.includes("vn-perf-flag " + flag), item.name + " shape");
    const delta = item.delta === null || item.delta === undefined ? "" : N.signed(item.delta, 1) + "%";
    if (delta) {
      assert.ok(row.includes('class="vn-perf-delta">' + delta + "<"), item.name + " delta " + delta + " vs row");
      assert.match(delta, /^[+-]?\d+\.\d%$/);
    } else {
      assert.strictEqual(row.includes("vn-perf-delta"), false, item.name + " printed a delta");
      assert.strictEqual(/\d+(?:\.\d+)?%/.test(row), false, item.name + " printed a percent");
    }
  });
  for (const status of STATUSES) assert.ok(seen.has(status), "fixture never produced " + status);
  assert.ok(html.includes("0.0%"), "a real zero delta is shown as 0.0%, not hidden");
  const holding = rowMatching(html, "Leg Press", "Gym A");
  assert.ok(holding.includes(">0.0%<"));
  const older = rowMatching(html, "Cable Crunch", "Gym A");
  assert.ok(older.includes("Too old to compare"));
  assert.ok(!older.includes("0%"));
  const building = rowMatching(html, "Face Pull", "Gym A");
  assert.ok(building.includes("Not enough yet"));
  assert.ok(!building.includes("0%"));
  assert.strictEqual(html.includes("muscle preserved"), false);
  assert.strictEqual(/strength score/i.test(html), false);
});

test("warm-ups and sets over 15 reps stay out of the displayed e1RM", () => {
  const { html, items } = paint(mainLogs(), "strength");
  const item = items.find(x => x.name === "Smith Bench");
  const kept = 110 * (1 + 6 / 30);
  const warmup = 200 * (1 + 5 / 30);
  const high = 150 * (1 + 20 / 30);
  assert.ok(Math.abs(item.latestE1rm - kept) < 1e-9, "engine e1RM " + item.latestE1rm);
  assert.ok(warmup > kept && high > kept);
  const row = rowMatching(html, "Smith Bench", "Gym A");
  assert.ok(row.includes("Est. 1RM " + fmtLoad(item.latestE1rm)));
  assert.ok(row.includes("110 kg × 6"));
  assert.ok(Math.abs(Number(row.match(/data-e1rm="([^"]+)"/)[1]) - kept) < 1e-9);
  assert.strictEqual(row.includes(String(Math.round(warmup))), false);
  assert.strictEqual(row.includes(String(Math.round(high))), false);
  assert.strictEqual(row.includes("200 kg"), false);
  assert.strictEqual(row.includes("150 kg"), false);
});

test("the same exercise at two gyms is two comparisons, each on its own scale", () => {
  const { html, items } = paint(mainLogs(), "strength");
  const pulls = items.filter(x => x.name === "Lat Pulldown");
  assert.strictEqual(pulls.length, 2);
  assert.strictEqual(pulls.map(x => x.gym).sort().join("|"), "Gym A|Gym B");
  assert.notStrictEqual(pulls[0].latestE1rm, pulls[1].latestE1rm);
  const a = pulls.find(x => x.gym === "Gym A");
  const b = pulls.find(x => x.gym === "Gym B");
  assert.ok(Math.abs(a.latestE1rm - 86 * (1 + 8 / 30)) < 1e-6);
  assert.ok(Math.abs(b.latestE1rm - 42 * (1 + 8 / 30)) < 1e-6);
  const rowA = rowMatching(html, "Lat Pulldown", "Gym A");
  const rowB = rowMatching(html, "Lat Pulldown", "Gym B");
  assert.ok(rowA && rowB);
  assert.notStrictEqual(rowA.match(/data-e1rm="([^"]+)"/)[1], rowB.match(/data-e1rm="([^"]+)"/)[1]);
  const fly = items.find(x => x.name === "Reverse Fly");
  const flyRow = rowMatching(html, "Reverse Fly", "Gym A");
  for (const [item, row] of [[a, rowA], [b, rowB], [fly, flyRow]]) {
    const scale = ownScale(item);
    assert.ok(Math.abs(Number(row.match(/data-min="([^"]+)"/)[1]) - scale.min) < 1e-6, item.gym + " " + item.name);
    assert.ok(Math.abs(Number(row.match(/data-max="([^"]+)"/)[1]) - scale.max) < 1e-6, item.name);
    const d = row.match(/<path class="vn-perf-line[^"]*" d="([^"]*)"/)[1];
    assert.strictEqual(d, scale.d, item.name + " spark is not on its own scale");
    assert.ok(row.includes('aria-label="' + item.name + " at " + item.gym + ', estimated 1RM"'), item.name);
    assert.ok(row.includes("own scale " + fmtLoad(scale.min) + " to " + fmtLoad(scale.max)), item.name);
    assert.ok(row.includes('class="vn-perf-eq"'), item.name);
  }
  const flyScale = ownScale(fly);
  const pullScale = ownScale(a);
  assert.ok(pullScale.min > flyScale.max * 3, "a shared axis would put the fly and the pulldown on one domain");
});

test("the disclaimer survives and the list is not the old card grid", () => {
  const { html } = paint(mainLogs(), "strength");
  assert.ok(html.includes("Estimated 1RM is a comparison aid, not a tested maximum or proof of muscle retention."));
  assert.ok(html.includes("Technique, effort and equipment setup affect it."));
  assert.strictEqual(html.includes("n99-card"), false);
  assert.strictEqual(html.includes("n99-strength-row"), false);
  assert.ok(html.includes("vn-perf-row"));
  assert.strictEqual((html.match(/class="n99-spark vn-perf-spark"/g) || []).length, splitRows(html).length);
});

test("viewing Performance does not write logs, and the four handlers stay", () => {
  const painted = paint(mainLogs(), "strength");
  assert.strictEqual(painted.logBefore, painted.logAfter);
  for (const handler of ["NXT.setView('overview')", "NXT.setView('strength')", "NXT.setView('body')", "apx95OpenQuickWeight()"]) {
    assert.ok(painted.html.includes(handler), handler);
  }
});

test("empty history, one exercise, and an all-older list read honestly", () => {
  const empty = paint([], "strength");
  assert.strictEqual(splitRows(empty.html).length, 0);
  assert.ok(empty.html.includes("No lifting history yet"));
  assert.ok(empty.html.includes("Estimated 1RM is a comparison aid"));
  assert.strictEqual(/\d+(?:\.\d+)?%/.test(empty.html), false);
  assert.strictEqual(empty.logBefore, empty.logAfter);
  for (const handler of ["NXT.setView('overview')", "NXT.setView('strength')", "NXT.setView('body')", "apx95OpenQuickWeight()"]) {
    assert.ok(empty.html.includes(handler), handler);
  }

  const one = [];
  lift(one, "Preacher Curl", "Gym A", N.dateAdd(TODAY, -2), 18, 10);
  const single = paint(one, "strength");
  assert.strictEqual(single.items.length, 1);
  assert.strictEqual(single.items[0].status, "Building data");
  assert.strictEqual(single.items[0].delta, null);
  assert.strictEqual(splitRows(single.html).length, 1);
  assert.ok(single.html.includes("Not enough yet"));
  assert.strictEqual(/\d+(?:\.\d+)?%/.test(splitRows(single.html)[0]), false);

  const oldLogs = [];
  lift(oldLogs, "Incline Press", "Gym A", N.dateAdd(TODAY, -70), 50, 8);
  lift(oldLogs, "Seated Row", "Gym A", N.dateAdd(TODAY, -80), 60, 8);
  lift(oldLogs, "Leg Extension", "Gym A", N.dateAdd(TODAY, -90), 70, 10);
  const older = paint(oldLogs, "strength");
  assert.ok(older.items.length === 3 && older.items.every(x => x.status === "Older history" && x.delta === null));
  assert.ok(older.html.includes("Too old to compare"));
  for (const row of splitRows(older.html)) {
    assert.ok(row.includes("Too old to compare"));
    assert.strictEqual(/\d+(?:\.\d+)?%/.test(row), false);
  }
});

test("the 24-item cap is the engine cap, and the UI renders exactly that list", () => {
  const logs = [];
  for (let i = 0; i < 25; i++) {
    const name = "CapLift-" + String(i + 1).padStart(2, "0");
    lift(logs, name, "Gym A", N.dateAdd(TODAY, -40 - i), 30 + i, 8);
  }
  const painted = paint(logs, "strength");
  assert.strictEqual(painted.items.length, 24);
  assert.strictEqual(splitRows(painted.html).length, 24);
  assert.ok(painted.html.includes("CapLift-01"));
  assert.ok(painted.html.includes("CapLift-24"));
  assert.strictEqual(painted.html.includes("CapLift-25"), false);
  assert.ok(painted.items.every(x => x.status === "Older history"));
  painted.items.forEach((item, i) => {
    const row = splitRows(painted.html)[i];
    assert.ok(row.includes(">" + item.name + "<"));
    assert.ok(row.includes("Too old to compare"));
  });
});

test("Weight and Body tabs still switch and are not the Performance list", () => {
  const logs = mainLogs();
  const weight = paint(logs, "overview");
  assert.ok(weight.html.includes("vn-weight") || weight.html.includes("Recent trajectory"));
  assert.strictEqual(weight.html.includes("vn-perf-row"), false);
  assert.ok(weight.html.includes("NXT.setView('strength')"));
  assert.ok(weight.html.includes("apx95OpenQuickWeight()"));
  assert.ok(weight.html.includes("NXT.openWeightHistory()") || weight.html.includes("All weigh-ins"));
  assert.strictEqual(weight.logBefore, weight.logAfter);

  const body = paint(logs, "body");
  assert.ok(body.html.includes("nxp-progress-body"));
  assert.strictEqual(body.html.includes("vn-perf-row"), false);
  assert.ok(body.html.includes("NXT.setView('overview')"));
  assert.ok(body.html.includes("NXT.openWaist()") || body.html.includes("Log waist"));
  assert.strictEqual(body.logBefore, body.logAfter);
});

test("the presentation replaced strengthHTML; the engine function is still there", () => {
  const ui = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
  const engine = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
  assert.strictEqual(ui.includes("N.strengthHTML()"), false);
  assert.ok(engine.includes("function strengthHTML()"));
  assert.ok(engine.includes("Number(r.weight)*(1+Number(r.reps)/30)"));
  assert.ok(engine.includes('status=sustained?"Review":delta>=2?"Improving":delta>=-5?"Holding steady":"Watch"'));
  assert.ok(engine.includes('else if(!fresh&&all.length)status="Older history"'));
  assert.ok(engine.includes(".slice(0,24)"));
  assert.strictEqual(ui.includes("muscle preserved"), false);
});

test("six status shapes are distinct and no local button fill was added", () => {
  const css = fs.readFileSync(path.join(ROOT, "vnext.css"), "utf8");
  const block = css.slice(css.indexOf("Phase 2G — Progress"));
  assert.ok(block.length > 100);
  const bodies = FLAGS.map(flag => {
    const sel = "#weightPage .vn-perf-flag." + flag + " i";
    const at = block.indexOf(sel);
    assert.ok(at > 0, sel);
    return block.slice(at, block.indexOf("}", at));
  });
  assert.strictEqual(new Set(bodies).size, 6);
  assert.strictEqual(block.includes("linear-gradient"), false);
  assert.ok(block.includes("Too old") === false);
});

console.log(failed ? "FAILED  " + passed + " passed, " + failed + " failed" : "OK  " + passed + " passed");
process.exit(failed ? 1 : 0);
