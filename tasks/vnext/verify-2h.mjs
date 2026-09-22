/* VNext 2H — Progress → Body analytical integration.
   Synthetic fixtures only. No scan image is read or written. No browser.
   The dev seed has zero scans and no waist readings, so every populated
   state below is injected. */
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
  "apx95SaveQuickWeight", "saveEditedSet", "toast", "uid", "save",
  "showHistoryDay", "exportJSON", "hasStoredSbAuthToken", "switchTab", "template", "val", "confirm"];

function makeElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }
  };
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const uiSrc = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "vnext.css"), "utf8");
const evoStart = html.indexOf("/* EVO_PARSE_START");
const evoEnd = html.indexOf("let tempSubstituteContext");
assert.ok(evoStart > 0 && evoEnd > evoStart, "evo source bounds");
const EVO = html.slice(evoStart, evoEnd);

const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8") + "\n;globalThis.__NXT__ = NXT;\n";
const PREM = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8") + "\n;globalThis.__NXP__ = NXP;\n";

function loadApp() {
  const discovered = {};
  const build = () => {
    const weightPage = makeElement();
    const morePage = makeElement();
    const sandbox = {
      console,
      document: {
        getElementById(id) {
          if (id === "weightPage") return weightPage;
          if (id === "morePage") return morePage;
          return null;
        },
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
      jss(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " "); },
      persistCalls: 0,
      persist() { sandbox.persistCalls++; },
      state: {
        date: TODAY, logs: [], bws: [], scans: [], sessionPlans: {}, read: [],
        gyms: [], dayType: "Rest", gym: "Gym A", tab: "weight", moreView: "hub",
        currentScanImage: ""
      },
      settings: { cutSupport: { version: 99, targetConfirmed: true, waist: [] }, weeklyPlan: {} },
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null,
      cloudSyncAgo() { return ""; },
      TARGET_LOW: 78, TARGET_HIGH: 80,
      goalLow() { return 78; }, goalHigh() { return 80; },
      __weight: weightPage,
      __more: morePage
    };
    sandbox.window = sandbox;
    sandbox.render = function () {
      const nxp = sandbox.__NXP__;
      if (!nxp) return;
      const tab = sandbox.state.tab || "home";
      if (tab === "weight") nxp.progress();
      else if (tab === "more") nxp.more();
    };
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
  vm.runInContext(EVO, ctx, { filename: "index.html#evo" });
  vm.runInContext(PREM, ctx, { filename: "premium-ui.js" });
  if (!ctx.__NXP__) throw new Error("premium-ui.js did not load");
  if (typeof ctx.evoAnalysisHTML !== "function") throw new Error("evoAnalysisHTML was not shared");
  return ctx;
}

const app = loadApp();
const N = app.__NXT__;
const NXP = app.__NXP__;
const state = app.state;
const settings = app.settings;

function scan(partial) {
  return Object.assign({
    id: partial.id, date: partial.date, image: "", notes: "", context: "EVOSCAN",
    weight: "", bodyFat: "", muscleMass: "", fatMass: "", bmr: "", tdee: "",
    provenance: partial.provenance || null
  }, partial);
}
function stores() {
  return JSON.stringify({ scans: state.scans, bws: state.bws, waist: settings.cutSupport.waist });
}
function paint() {
  state.tab = "weight";
  N.ui.view = "body";
  const before = stores();
  const writes = app.persistCalls;
  NXP.progress();
  assert.strictEqual(stores(), before, "viewing Progress → Body wrote a record");
  assert.strictEqual(app.persistCalls, writes, "viewing called persist");
  return app.__weight.innerHTML;
}
function reset(scans, waist, bws) {
  state.scans = scans || [];
  state.bws = bws || [];
  settings.cutSupport.waist = waist || [];
  state.evoUi = { mode: "board", trend: "weight", detail: "" };
  state.currentScanImage = "";
  state.date = TODAY;
  state.tab = "weight";
  state.moreView = "hub";
}
function chartOf(html) {
  const i = html.indexOf('class="vn-evo-chart"');
  assert.ok(i > 0, "trend chart");
  const j = html.indexOf("</section>", i);
  return html.slice(i, j);
}
function assertHandlers(html) {
  for (const call of ["NXT.setView('overview')", "NXT.setView('strength')", "NXT.setView('body')", "NXT.openWaist()", "apx95OpenQuickWeight()", "NXP.openBodyCapture()"]) {
    assert.ok(html.includes(call), "missing " + call);
  }
  assert.strictEqual(html.includes("NXT.more('body')"), false);
  assert.strictEqual(html.includes("NXT.more(&#039;body&#039;)"), false);
  assert.strictEqual(html.includes("Open scans"), false);
  assert.strictEqual(/body score/i.test(html), false);
  assert.strictEqual(/radar/i.test(html), false);
}

const pair = [
  scan({ id: "s1", date: "2026-08-01", weight: 80, bodyFat: 20, muscleMass: 36, fatMass: 16, bmr: 1700, tdee: 2400,
    provenance: { weight: { source: "OCR_EXTRACTED", ocr: 80, raw: "80.0 kg" } } }),
  scan({ id: "s2", date: "2026-09-01", weight: 82.4, bodyFat: 18.5, muscleMass: 37.2, fatMass: 15.2, bmr: 1720, tdee: 2380,
    provenance: { weight: { source: "USER_CORRECTED", ocr: 82, raw: "82 kg" } } })
];
const morning = [{ id: "m1", date: "2026-09-20", weight: 81.2, timeOfDay: "Morning" }];

test("the analysis helper is the only hero, and Settings still wraps it", () => {
  assert.strictEqual(html.split('class="vn-evo-hero"').length - 1, 1);
  assert.ok(html.includes("function evoAnalysisHTML("));
  const board = html.slice(html.indexOf("function evoBoardHTML"), html.indexOf("function renderEvoScanPage"));
  assert.ok(board.includes("evoAnalysisHTML(ordered)"));
  assert.strictEqual(board.includes('class="vn-evo-hero"'), false);
  assert.strictEqual(uiSrc.includes('class="vn-evo-hero"'), false);
  assert.strictEqual(uiSrc.includes("evoSetTrend"), false);
  assert.strictEqual(uiSrc.includes("evoCompHTML"), false);
  assert.ok(uiSrc.includes("evoAnalysisHTML("));
  assert.ok(uiSrc.includes("evoDetailHTML("));
  assert.strictEqual(uiSrc.split("NXT.more('body')").length - 1, 1);
  assert.strictEqual(uiSrc.includes("Open scans"), false);
  const block = css.slice(css.indexOf("Phase 2H — Progress / Body"));
  const end = block.indexOf("Phase 2G — Progress / Performance");
  assert.strictEqual(block.slice(0, end).includes("linear-gradient"), false);
  assert.strictEqual(css.includes("#787F8D"), false);
  assert.ok(css.includes("--vn-ink-4:#7E8593"));
  assert.ok(css.includes("--vn-action:#6D28D9"));
});

test("two scans: Progress and Settings render the same analysis", () => {
  reset(pair, [], morning);
  const htmlBody = paint();
  const ordered = app.evoOrdered();
  const analysis = app.evoAnalysisHTML(ordered);
  assert.ok(analysis.includes("vn-evo-hero"));
  assert.ok(htmlBody.includes(analysis), "Progress did not embed the shared analysis");
  const board = app.evoBoardHTML(ordered);
  assert.ok(board.includes(analysis), "Settings board did not embed the same analysis");
  assert.ok(board.includes("evoOpenForm()"));
  assert.ok(htmlBody.includes("is-measured"));
  assert.ok(htmlBody.includes(">Measured<"));
  assert.ok(htmlBody.includes("is-estimated"));
  assert.ok(htmlBody.includes(">Estimated<"));
  assert.ok(htmlBody.includes("Not your morning weigh-in, and not part of the body-weight trend."));
  assert.strictEqual(htmlBody.includes("81.2"), false, "the morning weigh-in was painted as a body figure");
  assert.ok(htmlBody.includes("82.4"));
  assert.ok(htmlBody.includes("Each metric has its own scale"));
  assert.ok(htmlBody.includes("not the morning body-weight trend"));
  assert.strictEqual(htmlBody.split("<svg").length - 1, 1);
  assert.ok(htmlBody.includes("Remainder"));
  assert.ok(htmlBody.includes("not a measured compartment"));
  assert.ok(htmlBody.includes("not stacked"));
  assert.ok(htmlBody.includes("What changed"));
  assert.ok(htmlBody.includes("percentage points"));
  assert.ok(htmlBody.includes("evoOpenScan('s2')"));
  assert.ok(htmlBody.includes("evoDeleteScan('s2')"));
  assert.ok(htmlBody.includes("No waist measurements yet"));
  assertHandlers(htmlBody);
  assert.strictEqual(htmlBody.includes("vn-weight"), false);
  assert.strictEqual(htmlBody.includes("Recent trajectory"), false);
});

test("per-metric trends stay on separate scales", () => {
  reset(pair, [], morning);
  const weightChart = chartOf(paint());
  assert.ok(weightChart.includes("80.0"));
  assert.ok(weightChart.includes("82.4"));
  assert.ok(weightChart.includes("kg"));
  assert.strictEqual(weightChart.includes("18.5"), false);
  const before = stores();
  app.evoSetTrend("bodyFat");
  assert.strictEqual(stores(), before);
  const fatChart = chartOf(app.__weight.innerHTML);
  assert.ok(fatChart.includes("20.0"));
  assert.ok(fatChart.includes("18.5"));
  assert.ok(fatChart.includes("%"));
  assert.strictEqual(fatChart.includes("82.4"), false);
  assert.notStrictEqual(weightChart, fatChart);
  assert.strictEqual(app.__weight.innerHTML.split("<svg").length - 1, 1);
});

test("scan detail is the shared detail, and capture is not painted here", () => {
  reset(pair, [], morning);
  paint();
  const before = stores();
  app.evoOpenScan("s2");
  assert.strictEqual(stores(), before);
  const detail = app.evoDetailHTML(pair[1], app.evoOrdered());
  const shown = app.__weight.innerHTML;
  assert.ok(shown.includes(detail));
  assert.ok(shown.includes("This weight is not your morning weigh-in and does not enter the body-weight trend."));
  assert.ok(shown.includes("How these numbers were recorded"));
  assert.ok(shown.includes("Corrected"));
  assert.ok(shown.includes("NXP.openBodyCapture()"));
  assert.strictEqual(shown.includes('id="scanWeight"'), false);
  app.evoCloseDetail();
  assert.ok(app.__weight.innerHTML.includes("vn-evo-hero"));
  assert.strictEqual(stores(), before);
});

test("New scan opens the Settings capture form and does not write records", () => {
  reset(pair, [], morning);
  paint();
  const before = stores();
  const writes = app.persistCalls;
  NXP.openBodyCapture();
  assert.strictEqual(stores(), before);
  assert.strictEqual(app.persistCalls, writes);
  assert.strictEqual(state.tab, "more");
  assert.strictEqual(state.moreView, "body");
  assert.strictEqual(app.evoUi().mode, "form");
  const form = app.__more.innerHTML;
  for (const id of ["scanFile", "scanDate", "scanWeight", "scanBodyFat", "scanMuscleMass", "scanFatMass", "scanTDEE", "scanBMR", "scanNotes"]) {
    assert.ok(form.includes('id="' + id + '"'), id);
  }
  assert.ok(form.includes("readEvoScanOCR"));
  assert.ok(form.includes("saveEvoScan"));
  assert.ok(form.includes("handleScanFile"));
  assert.strictEqual(app.__weight.innerHTML.includes('id="scanWeight"'), false);
  state.tab = "weight";
  N.ui.view = "body";
  NXP.progress();
  assert.strictEqual(app.__weight.innerHTML.includes('id="scanWeight"'), false, "the capture form was painted on Progress");
  assert.ok(app.__weight.innerHTML.includes("vn-evo-hero"));
  assert.strictEqual(stores(), before);
});

test("no scans and no waist", () => {
  reset([], [], morning);
  const htmlBody = paint();
  assert.ok(htmlBody.includes("Nothing measured yet"));
  assert.ok(htmlBody.includes("No waist measurements yet"));
  assert.ok(htmlBody.includes("No scans saved"));
  assert.ok(htmlBody.includes("never becomes the body-weight trend"));
  assert.strictEqual(htmlBody.includes("vn-evo-hero"), false);
  assert.strictEqual(htmlBody.includes("81.2"), false);
  assertHandlers(htmlBody);
  assert.ok(htmlBody.includes("NXT.openWaist()"));
});

test("scans but no waist", () => {
  reset(pair, [], []);
  const htmlBody = paint();
  assert.ok(htmlBody.includes("vn-evo-hero"));
  assert.ok(htmlBody.includes("No waist measurements yet"));
  assert.strictEqual(htmlBody.includes("Nothing measured yet"), false);
  assert.ok(htmlBody.includes("NXT.openWaist()"));
  assert.ok(htmlBody.includes("NXP.openBodyCapture()"));
  assert.strictEqual(htmlBody.includes("NXT.more('body')"), false);
});

test("waist but no scans, including per-row edit", () => {
  const waist = [
    { id: "w1", date: "2026-08-15", cm: 86.4, ts: 1 },
    { id: "w2", date: "2026-09-12", cm: 84, ts: 2 },
    { id: "bad", date: "2026-09-30", cm: 80, ts: 3 },
    { id: "low", date: "2026-09-01", cm: 10, ts: 4 }
  ];
  reset([], waist, morning);
  const htmlBody = paint();
  assert.ok(htmlBody.includes("84.0"));
  assert.ok(htmlBody.includes("86.4"));
  assert.ok(htmlBody.includes("NXT.openWaist('2026-09-12')"));
  assert.ok(htmlBody.includes("NXT.openWaist('2026-08-15')"));
  assert.ok(htmlBody.includes("Edit ›"));
  assert.strictEqual(htmlBody.includes("2026-09-30"), false);
  assert.strictEqual(htmlBody.includes(">10.0<") || htmlBody.includes(">10 cm<"), false);
  assert.ok(htmlBody.includes("No scans saved"));
  assert.strictEqual(htmlBody.includes("vn-evo-hero"), false);
  assert.ok(htmlBody.includes("-2.4 cm") || htmlBody.includes("−2.4 cm") || htmlBody.includes("-2.4"));
  assertHandlers(htmlBody);
});

test("exactly one scan has nothing to compare, and a missing figure stays missing", () => {
  reset([scan({ id: "only", date: "2026-09-10", weight: 90.2, bodyFat: 21.4, muscleMass: 40, fatMass: 19.3 })], [], morning);
  let htmlBody = paint();
  assert.ok(htmlBody.includes("No earlier scan to compare."));
  assert.ok(htmlBody.includes("The scan-to-scan line starts with the next scan."));
  assert.strictEqual(htmlBody.includes("vs previous scan"), false);
  assert.ok(htmlBody.includes("vn-evo-hero"));
  assert.ok(htmlBody.includes("90.2"));
  assert.strictEqual(htmlBody.includes("81.2"), false);
  assert.ok(htmlBody.includes("Body composition"));
  assert.strictEqual(htmlBody.split("<svg").length - 1, 1);

  reset([scan({ id: "bare", date: "2026-09-10", weight: 90.2 })], [], []);
  htmlBody = paint();
  assert.ok(htmlBody.includes("A composition bar needs both scale weight and fat mass"));
  assert.ok(htmlBody.includes("No earlier scan to compare."));
  assert.ok(htmlBody.includes("Not in this scan"));
  assert.strictEqual(stores().includes("90.2"), true);
});

test("Settings hub still reaches Body, and the OCR contract is the one 2F shipped", () => {
  reset([], [], []);
  state.moreView = "hub";
  state.tab = "more";
  NXP.more();
  const hub = app.__more.innerHTML;
  assert.ok(hub.includes("NXT.more(&#039;body&#039;)") || hub.includes("NXT.more('body')"));
  assert.ok(hub.includes("Body &amp; scans") || hub.includes("Body & scans"));
  const report = app.evoExtractReport("BODY WEIGHT 82.4 kg\nMUSCLE MASS 36.9 kg");
  assert.strictEqual(report.fields.weight.status, "HIGH CONFIDENCE");
  assert.strictEqual(report.fields.bodyFat.status, "NOT FOUND");
  assert.strictEqual(report.fields.bodyFat.value, "");
  const check = app.evoExtractReport("BODY WEIGHT 82.4 kg\nBODY WEIGHT 99.1 kg");
  assert.strictEqual(check.fields.weight.status, "CHECK");
});

console.log(failed ? "FAILED  " + passed + " passed, " + failed + " failed" : "OK  " + passed + " passed");
process.exit(failed ? 1 : 0);
