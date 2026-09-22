/* TRAIN COMPLETION — deterministic checks. No browser.
   Realistic fixtures: first/middle/last set, warm-up and working, RIR present
   and absent, history and none, several completed sets, an active timer,
   a queue, an add-on workout, Gym A and Gym B, mapped and unmapped anatomy.
   A set logged from the keyboard dock must match one logged in normal flow.
   Anatomy contract (D18): vertical-cost budget, at most one extra title line,
   aim clearance, title at 320, reduced motion, both size caps with crop
   aspect, and no figure for an unmapped name.
   Fixtures stay inside the session queue — Train ignores any other name. */
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
const YDAY = "2026-09-15";
const PLAN = [
  { name: "Flat Dumbbell Press", sets: 3, reps: [8, 12], inc: 2.5 },
  { name: "Lat Pulldown", sets: 3, reps: [8, 12], inc: 2.5 },
  { name: "Mystery Lift", sets: 3, reps: [8, 12], inc: 2.5 }
];

const uiSrc = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "vnext.css"), "utf8");
const premCss = fs.readFileSync(path.join(ROOT, "premium-ui.css"), "utf8");
const cutSrc = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

function classListFor(node) {
  const set = new Set();
  const api = {
    add(...names) { names.forEach(n => set.add(n)); },
    remove(...names) { names.forEach(n => set.delete(n)); },
    toggle(n, force) {
      const on = force === undefined ? !set.has(n) : !!force;
      if (on) set.add(n); else set.delete(n);
      return on;
    },
    contains(n) { return set.has(n); }
  };
  node.classList = api;
  return api;
}
function styleFor() {
  const map = {};
  return {
    setProperty(k, v) { map[k] = String(v); },
    removeProperty(k) { delete map[k]; },
    getPropertyValue(k) { return map[k] || ""; },
    get cssText() { return ""; },
    set cssText(_v) {}
  };
}
function makeEl(id) {
  const node = {
    id: id || "",
    value: "",
    hidden: false,
    dataset: {},
    textContent: "",
    innerHTML: "",
    style: styleFor(),
    children: [],
    parent: null,
    offsetHeight: 0,
    rect: { top: 120, bottom: 170, left: 20, right: 370, width: 350, height: 50 },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    hasAttribute(name) { return name === "hidden" ? !!this.hidden : false; },
    appendChild(child) { this.children.push(child); if (child) child.parent = this; return child; },
    remove() {},
    focus() {},
    blur() {},
    getBoundingClientRect() { return this.rect; },
    closest(sel) {
      let n = this;
      while (n) {
        if (sel === "#nxp-log-button" && n.id === "nxp-log-button") return n;
        if (sel === "#nxp-set-form" && n.id === "nxp-set-form") return n;
        if (sel === "form" && n.id === "nxp-set-form") return n;
        n = n.parent;
      }
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  classListFor(node);
  return node;
}

const listeners = {};
const vvListeners = {};
const els = {};
const page = makeEl("trainPage");
const tabs = makeEl("tabs");
tabs.classList.add("tabs");
const body = makeEl("body");
let active = null;
let restEnd = 0;

function track(id, node) { els[id] = node; return node; }

const HOST = ["renderHistory", "renderFloorball", "apx96MoreSectionHTML", "getT", "readiness",
  "getFullBackup", "applyCloudPayload", "apx96OpenQueueManager", "openEditSet", "closeModal",
  "renderHome", "renderTrain", "renderWeight", "renderMore", "ensureSessionPlan",
  "setsDone", "safeSetsDone", "safeSuggestedWeight", "safeLastSet", "logSet", "apx96UndoLastSet",
  "completeDay", "cycleDayType", "renderRest", "apx96SaveReadiness",
  "weeklyLossRate", "weekStartString", "zone2MinutesThisWeek", "zone2MinutesThisWeekSafe",
  "projectedGoalDate", "estimatedTotalBurnToday", "apx95StrengthItems", "apx95Verdict",
  "apx95SetView", "enhancedRecoveryWarningHTML", "weeklyPlanHTML", "workoutTemplateSettingsHTML",
  "apx96SetMoreView", "restoreBackup", "v88OpenNoteModal", "apx95OpenQuickWeight",
  "apx95SaveQuickWeight", "saveEditedSet", "showHistoryDay", "exportJSON", "hasStoredSbAuthToken",
  "switchTab", "jss", "updateCloudLocalBanner", "updateCloudSyncStatus", "saveCloudNow",
  "initCloudFromStorage"];

function loadApp() {
  const discovered = {};
  const build = () => {
    const sandbox = {
      console,
      setTimeout, clearTimeout, setInterval, clearInterval,
      Date, Math, JSON, Number, String, Object, Array, Map, Set, Promise, Error,
      document: {
        getElementById(id) { return id === "trainPage" ? page : (els[id] || null); },
        querySelector(sel) {
          if (sel === ".tabs") return tabs;
          if (sel === "#trainPage .vn-rest.is-active") return els.restActive || null;
          if (sel === ".nxp-rest") return els.restNode || null;
          return null;
        },
        querySelectorAll() { return []; },
        createElement() { return makeEl(""); },
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        removeEventListener() {},
        documentElement: makeEl("html"),
        get activeElement() { return active; },
        set activeElement(v) { active = v; },
        readyState: "loading",
        title: "",
        body
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_key, fallback) { return fallback; },
      esc(v) {
        return String(v == null ? "" : v)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      },
      state: {
        date: TODAY, logs: [], bws: [], scans: [], cardio: [], floorball: [],
        sessionPlans: {}, addOns: {}, read: [], gyms: ["Gym A", "Gym B"],
        dayType: "FullA", gym: "Gym A", tab: "train",
        exercise: "Flat Dumbbell Press", setNum: 1
      },
      settings: {
        cutSupport: { version: 99, targetConfirmed: true },
        weeklyPlan: {}, dayOverrides: {}, zone2WeeklyTarget: 90
      },
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "",
      cloudUser: null, lastCloudSyncAt: null,
      cloudSyncAgo() { return ""; },
      TARGET_LOW: 78, TARGET_HIGH: 80,
      goalLow() { return 78; }, goalHigh() { return 80; },
      innerHeight: 844,
      innerWidth: 390,
      visualViewport: {
        height: 844, width: 390, offsetTop: 0, offsetLeft: 0,
        addEventListener(type, fn) { (vvListeners[type] = vvListeners[type] || []).push(fn); },
        removeEventListener() {}
      },
      scrollBy() {},
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      removeEventListener() {},
      template() { return PLAN; },
      sessionKey(type, date, gym) {
        const s = sandbox.state;
        return `${date || s.date}__${gym || s.gym || "Gym"}__${type || s.dayType}`;
      },
      exerciseDefByName(name) {
        return PLAN.find(e => e.name === name) || { name, sets: 3, reps: [8, 12], inc: 2.5 };
      },
      resolveDayType(d) {
        return (sandbox.settings.dayOverrides && sandbox.settings.dayOverrides[d]) || "Rest";
      },
      suggestedRestSeconds() { return 150; },
      apx96StartRest(seconds) { sandbox.__restStarted.push(seconds); },
      apx96RestRemaining() { return Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)); },
      apx96FormatTimer(seconds) {
        const s = Math.max(0, Number(seconds) || 0);
        return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      },
      apx96TickTimer() {},
      apx96SkipRest() { restEnd = 0; },
      uid() { return "id" + (++sandbox.__seq); },
      persist() { sandbox.__persists++; },
      toast(msg) { sandbox.__toasts.push(String(msg)); },
      render() { sandbox.__renders++; },
      confirm() { sandbox.__confirms++; return false; },
      closeModal() {},
      TEMPLATES: {},
      __seq: 0, __persists: 0, __renders: 0, __confirms: 0, __toasts: [], __restStarted: [],
      __page: page
    };
    sandbox.val = function (id) {
      const el = sandbox.document.getElementById(id);
      return el && el.value != null ? String(el.value) : "";
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.document.scrollingElement = sandbox.document.documentElement;
    sandbox.document.documentElement.scrollTop = 0;
    for (const n of HOST) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in sandbox)) sandbox[n] = discovered[n];
    return sandbox;
  };
  let ctx;
  const CUT = cutSrc + "\n;globalThis.__NXT__ = NXT;\n";
  const ANAT = fs.readFileSync(path.join(ROOT, "train-anatomy.js"), "utf8")
    + "\n;globalThis.NXTLIB = NXTLIB; globalThis.NXTANAT = NXTANAT;\n";
  const PREM = uiSrc + "\n;globalThis.__NXP__ = NXP;\n";
  for (let attempt = 0; attempt < 160; attempt++) {
    ctx = vm.createContext(build());
    try { vm.runInContext(CUT, ctx, { filename: "cut-support.js" }); break; }
    catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss || attempt === 159) throw err;
      discovered[miss[1]] = function () { return null; };
      ctx = null;
    }
  }
  if (!ctx || !ctx.__NXT__) throw new Error("cut-support.js did not load");
  vm.runInContext(ANAT, ctx, { filename: "train-anatomy.js" });
  vm.runInContext(PREM, ctx, { filename: "premium-ui.js" });
  if (!ctx.__NXP__) throw new Error("premium-ui.js did not load");
  return ctx;
}

const app = loadApp();
const N = app.__NXT__;
const NXP = app.__NXP__;
const state = app.state;
const settings = app.settings;

track("weightInput", makeEl("weightInput"));
track("repsInput", makeEl("repsInput"));
track("n99-set-type", makeEl("n99-set-type"));
track("n99-rir", makeEl("n99-rir"));
const form = track("nxp-set-form", makeEl("nxp-set-form"));
const logBtn = track("nxp-log-button", makeEl("nxp-log-button"));
const modalRoot = track("modalRoot", makeEl("modalRoot"));
logBtn.parent = form;
form.rect = { top: 400, bottom: 700, left: 20, right: 370, width: 350, height: 300 };
logBtn.rect = { top: 740, bottom: 790, left: 20, right: 370, width: 350, height: 50 };
els.weightInput.rect = { top: 180, bottom: 250, left: 20, right: 370, width: 350, height: 70 };
els.repsInput.rect = { top: 260, bottom: 330, left: 20, right: 370, width: 350, height: 70 };

function fire(type, target) {
  if (type === "focusin") app.document.activeElement = target;
  if (type === "focusout") app.document.activeElement = null;
  const e = { target, relatedTarget: null, prevented: false, preventDefault() { e.prevented = true; } };
  for (const fn of listeners[type] || []) fn(e);
  return e;
}
function setFields(weight, reps, type, rir) {
  els.weightInput.value = String(weight);
  els.repsInput.value = String(reps);
  els["n99-set-type"].value = type || "working";
  els["n99-rir"].value = rir == null ? "" : String(rir);
}
function resetSession(exercise) {
  state.logs = [];
  state.gym = "Gym A";
  state.dayType = "FullA";
  state.date = TODAY;
  state.exercise = exercise || "Flat Dumbbell Press";
  state.setNum = 1;
  NXP.ui.trainActive = true;
  NXP.ui.drafts.clear();
  logBtn.classList.remove("is-kb");
  form.classList.remove("is-kb");
  app.document.activeElement = null;
}
function core(e) {
  return {
    date: e.date, dayType: e.dayType, gym: e.gym, exercise: e.exercise,
    setNum: e.setNum, weight: e.weight, reps: e.reps, setType: e.setType,
    rir: e.rir, volume: e.volume
  };
}
function openKeyboard() {
  app.innerHeight = 844;
  app.visualViewport.height = 420;
  app.visualViewport.offsetTop = 0;
  app.visualViewport.offsetLeft = 0;
  app.document.activeElement = els.weightInput;
  fire("focusin", els.weightInput);
}
function closeKeyboard() {
  app.visualViewport.height = 844;
  app.visualViewport.offsetTop = 0;
}

test("keyboard offset clears the keyboard and, without one, the safe area and nav", () => {
  assert.strictEqual(NXP.keyboardBottom(844, 420, 0, 34, 80), 432);
  assert.strictEqual(NXP.keyboardBottom(844, 500, 50, 34, 80), 302);
  assert.strictEqual(NXP.keyboardBottom(844, 844, 0, 34, 0), 34);
  assert.strictEqual(NXP.keyboardBottom(844, 844, 0, 0, 0), 8);
  assert.strictEqual(NXP.keyboardBottom(420, 420, 0, 0, 72), 80);
  assert.strictEqual(NXP.keyboardBottom(844, 844, 0, 34, 80), 114);
});

test("focusing weight or reps docks Log Set above a short visual viewport", () => {
  resetSession();
  openKeyboard();
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  assert.strictEqual(form.classList.contains("is-kb"), true);
  assert.strictEqual(logBtn.style.getPropertyValue("--nxp-kb-bottom"), "432px");
  assert.strictEqual(logBtn.style.getPropertyValue("width"), "350px");
  const onReps = fire("focusin", els.repsInput);
  assert.strictEqual(onReps.prevented, false);
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  closeKeyboard();
});

test("a docked Log Set writes the same record as the inline control", () => {
  resetSession();
  setFields(82.5, 8, "working", "2");
  NXP.logSet();
  const inline = core(state.logs[0]);

  resetSession();
  openKeyboard();
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  setFields(82.5, 8, "working", "2");
  els.weightInput.value = "90";
  NXP.logSet();
  const changed = state.logs[0];
  assert.strictEqual(changed.weight, 90);
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);

  resetSession();
  openKeyboard();
  setFields(82.5, 8, "working", "2");
  NXP.logSet();
  assert.deepStrictEqual(core(state.logs[0]), inline);
  closeKeyboard();
});

test("without visualViewport the button still docks to the short viewport", () => {
  resetSession();
  tabs.classList.add("vn-recede");
  const saved = app.visualViewport;
  app.visualViewport = null;
  app.innerHeight = 420;
  app.document.activeElement = els.weightInput;
  fire("focusin", els.weightInput);
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  assert.strictEqual(logBtn.style.getPropertyValue("--nxp-kb-bottom"), "8px");
  app.visualViewport = saved;
  app.innerHeight = 844;
  tabs.classList.remove("vn-recede");
  fire("focusout", els.weightInput);
});

test("mousedown on the docked control does not drop it before submit", () => {
  resetSession();
  openKeyboard();
  const e = fire("mousedown", logBtn);
  assert.strictEqual(e.prevented, true);
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  assert.strictEqual(app.document.activeElement, els.weightInput);
  closeKeyboard();
});

test("first, middle and last working sets, then the queue advances", () => {
  resetSession();
  setFields(60, 8, "working", "3");
  NXP.logSet();
  setFields(60, 8, "working", "2");
  NXP.logSet();
  setFields(62.5, 9, "working", "");
  NXP.logSet();
  const rows = state.logs.filter(r => r.exercise === "Flat Dumbbell Press" && r.setType === "working");
  assert.deepStrictEqual(rows.map(r => r.setNum), [1, 2, 3]);
  assert.strictEqual(rows[2].rir, null);
  assert.strictEqual(rows[0].rir, 3);
  assert.strictEqual(rows[2].volume, 563);
  assert.strictEqual(state.exercise, "Lat Pulldown");
  state.exercise = "Flat Dumbbell Press";
  const before = state.logs.length;
  const confirms = app.__confirms;
  setFields(40, 10, "working", "1");
  NXP.logSet();
  assert.strictEqual(state.logs.length, before);
  assert.strictEqual(app.__confirms, confirms + 1);
  assert.strictEqual(state.exercise, "Flat Dumbbell Press");
});

test("warm-up does not consume a working set, and RIR 4 is stored", () => {
  resetSession();
  setFields(40, 8, "warmup", "");
  NXP.logSet();
  setFields(40, 8, "warmup", "4");
  NXP.logSet();
  setFields(80, 8, "working", "1");
  NXP.logSet();
  const warm = state.logs.filter(r => r.setType === "warmup");
  const work = state.logs.filter(r => r.setType === "working");
  assert.deepStrictEqual(warm.map(r => r.setNum), [1, 2]);
  assert.strictEqual(warm[0].rir, null);
  assert.strictEqual(warm[1].rir, 4);
  assert.strictEqual(work.length, 1);
  assert.strictEqual(work[0].setNum, 1);
  assert.strictEqual(state.exercise, "Flat Dumbbell Press");
});

test("history is per exercise and per gym", () => {
  resetSession();
  state.logs.push({
    id: "hist", date: YDAY, dayType: "FullA", gym: "Gym A",
    exercise: "Flat Dumbbell Press", setNum: 1, weight: 30.5, reps: 8,
    setType: "working", rir: 2, volume: 244, ts: 1
  });
  state.logs.push({
    id: "othergym", date: YDAY, dayType: "FullA", gym: "Gym B",
    exercise: "Flat Dumbbell Press", setNum: 1, weight: 99, reps: 5,
    setType: "working", rir: 0, volume: 495, ts: 2
  });
  const atA = N.sessionRows("Flat Dumbbell Press", "Gym A", TODAY, 100);
  const atB = N.sessionRows("Flat Dumbbell Press", "Gym B", TODAY, 100);
  const none = N.sessionRows("Mystery Lift", "Gym A", TODAY, 100);
  assert.strictEqual(atA.length, 1);
  assert.strictEqual(atA[0].sets[0].weight, 30.5);
  assert.strictEqual(atB[0].sets[0].weight, 99);
  assert.strictEqual(none.length, 0);

  setFields(70, 8, "working", "2");
  NXP.logSet();
  assert.strictEqual(N.done("Flat Dumbbell Press"), 1);
  state.gym = "Gym B";
  assert.strictEqual(N.done("Flat Dumbbell Press"), 0);
  setFields(50, 10, "working", "");
  NXP.logSet();
  const bToday = state.logs.filter(r => r.date === TODAY && r.gym === "Gym B");
  const aToday = state.logs.filter(r => r.date === TODAY && r.gym === "Gym A" && r.setType === "working");
  assert.strictEqual(bToday.length, 1);
  assert.strictEqual(bToday[0].gym, "Gym B");
  assert.strictEqual(aToday.length, 1);
  assert.strictEqual(aToday[0].weight, 70);
});

test("the working screen shows history, an empty exercise, the queue and a running timer", () => {
  resetSession();
  state.logs = [{
    id: "hist2", date: YDAY, dayType: "FullA", gym: "Gym A",
    exercise: "Flat Dumbbell Press", setNum: 1, weight: 30.5, reps: 8,
    setType: "working", rir: 2, volume: 244, ts: 1
  }, {
    id: "t1", date: TODAY, dayType: "FullA", gym: "Gym A",
    exercise: "Flat Dumbbell Press", setNum: 1, weight: 70, reps: 8,
    setType: "working", rir: 2, volume: 560, ts: 3
  }, {
    id: "t2", date: TODAY, dayType: "FullA", gym: "Gym A",
    exercise: "Flat Dumbbell Press", setNum: 2, weight: 70, reps: 8,
    setType: "warmup", rir: null, volume: 560, ts: 4
  }];
  restEnd = Date.now() + 90 * 1000;
  NXP.training();
  const view = page.innerHTML;
  assert.ok(view.includes("id=\"weightInput\""));
  assert.ok(view.includes("id=\"repsInput\""));
  assert.ok(view.includes("id=\"n99-set-type\""));
  assert.ok(view.includes("id=\"n99-rir\""));
  assert.ok(view.includes("id=\"nxp-log-button\""));
  assert.ok(view.includes("Queue"));
  NXP.queue();
  assert.ok(modalRoot.innerHTML.includes("Lat Pulldown"));
  assert.ok(modalRoot.innerHTML.includes("Mystery Lift"));
  assert.ok(view.includes("30.5"));
  assert.ok(!view.includes("First session"));
  assert.ok(view.includes("Warm-up"));
  assert.ok(view.includes(">W<"));
  assert.ok((view.split("nxp-set-row").length - 1) >= 2);
  assert.ok(view.includes("is-active"));
  assert.ok(view.includes("+30s"));
  assert.ok(view.includes("Skip"));
  assert.ok(view.includes("nxp-ex-anat"));
  assert.ok(view.includes("Chest"));

  state.exercise = "Mystery Lift";
  restEnd = 0;
  NXP.training();
  const bare = page.innerHTML;
  assert.ok(bare.includes("First session"));
  assert.strictEqual(bare.includes("nxp-ex-anat"), false);
  assert.strictEqual(bare.includes("is-active"), false);
});

test("an add-on on Rest, Zone 2 or Cardio does not change the planned day", () => {
  function run(type) {
    state.logs = [];
    state.gym = "Gym A";
    state.dayType = type;
    state.date = TODAY;
    state.addOns = {};
    settings.dayOverrides = { [TODAY]: type };
    NXP.ui.trainActive = false;
    NXP.addOnAdd("Flat Dumbbell Press");
    assert.strictEqual(state.dayType, type);
    assert.strictEqual(NXP.ui.trainActive, true);
    setFields(55, 8, "working", "2");
    NXP.logSet();
    assert.strictEqual(state.dayType, type);
    assert.strictEqual(state.logs.at(-1).dayType, type);
    assert.strictEqual(state.logs.at(-1).exercise, "Flat Dumbbell Press");
    state.dayType = app.resolveDayType(TODAY);
    assert.strictEqual(state.dayType, type, "refresh still resolves " + type);
    const key = `${TODAY}__Gym A__${type}`;
    assert.ok(state.addOns[key].includes("Flat Dumbbell Press"));
  }
  run("Rest");
  run("Zone2");
  run("Cardio");

  state.dayType = "Floorball";
  state.addOns = {};
  settings.dayOverrides = { [TODAY]: "Floorball" };
  NXP.addOnAdd("Flat Dumbbell Press");
  assert.strictEqual(state.dayType, "Floorball");
  assert.deepStrictEqual(state.addOns, {});
});

test("mapped anatomy is drawn and an unknown name stays empty", () => {
  const known = app.NXTLIB.musclesFor("Flat Dumbbell Press");
  const unknown = app.NXTLIB.musclesFor("Mystery Lift");
  assert.ok(known.primary.includes("chest"));
  assert.strictEqual(unknown.primary.length, 0);
  assert.strictEqual(unknown.secondary.length, 0);
  assert.strictEqual(app.NXTLIB.has("Mystery Lift"), false);
  const head = css.slice(css.indexOf("Anatomy sits inline"), css.indexOf("Aim strip"));
  assert.ok(head.includes("max-width:72px"));
  assert.ok(head.includes("height:64px"));
  assert.strictEqual(/animation|pulse|glow/.test(head), false);
});

test("greyscale encodings are shape, copy or opacity, not hue alone", () => {
  assert.ok(uiSrc.includes("r.setType==='warmup'?'W':r.setNum"));
  assert.ok(uiSrc.includes("r.setType==='warmup'?'Warm-up':rirLabel"));
  assert.ok(uiSrc.includes("aria-pressed"));
  assert.ok(css.includes("#trainPage .vn-train-active .nxp-ex-nav > button:disabled{opacity:.35}"));
  const on = css.slice(css.indexOf("#trainPage .vn-train-active .nxp-seg button.is-on{"), css.indexOf("}", css.indexOf("#trainPage .vn-train-active .nxp-seg button.is-on{")));
  assert.ok(on.includes("box-shadow:inset"));
});

test("date inputs shrink once, in the shared layer, and stack at 375", () => {
  const block = css.slice(css.indexOf("Shared date controls"));
  assert.ok(block.includes("appearance:none"));
  assert.ok(block.includes("-webkit-appearance:none"));
  assert.ok(block.includes("box-sizing:border-box"));
  assert.ok(block.includes("min-width:0"));
  assert.ok(block.includes("min-height:44px"));
  assert.strictEqual(/font-size/.test(block), false);
  assert.strictEqual(/calendar-picker-indicator/.test(block), false);
  assert.ok(/@media \(max-width:375px\)[\s\S]*input\[type="date"\][\s\S]*grid-template-columns:1fr !important/.test(block));
  const ids = ["apx95WeightDate", "apx95EditDate", "n99-waist-date", "n99-edit-weight-date", "n99-move-date", "editSetDate", "bwDate", "scanDate"];
  const hay = cutSrc + "\n" + html;
  for (const id of ids) {
    assert.ok(hay.includes('id="' + id + '"'), id + " missing");
    assert.ok(new RegExp('id="' + id + '"[^>]*type="date"|type="date"[^>]*id="' + id + '"').test(hay), id + " is not type=date");
  }
});

test("the logging contract and control sizes are unchanged", () => {
  assert.ok(uiSrc.includes('type="submit" class="n99-button nxp-train-cta"'));
  assert.strictEqual(uiSrc.includes("nxp-train-cta is-kb"), false);
  const log = uiSrc.slice(uiSrc.indexOf("function logSet() {"), uiSrc.indexOf("function sessionMenu"));
  assert.ok(log.includes("base.logSet()"));
  assert.strictEqual(log.includes("is-kb"), false);
  assert.ok(cutSrc.includes("val('weightInput')"));
  assert.ok(cutSrc.includes("val('repsInput')"));
  assert.ok(cutSrc.includes("val('n99-set-type')"));
  assert.ok(cutSrc.includes("val('n99-rir')"));
  assert.ok(css.includes("min-height:52px"));
  assert.ok(css.includes("#trainPage .vn-train-active .nxp-seg button{\n  min-height:44px"));
  const dock = css.slice(css.indexOf("Keyboard:"), css.indexOf("Prev / Queue"));
  assert.ok(dock.includes("position:fixed"));
  assert.ok(dock.includes(".is-kb"));
  assert.ok(dock.includes("transition:none"));
  assert.ok(dock.includes("prefers-reduced-motion"));
  assert.strictEqual(sw.includes("const RELEASE = '109'"), true);
  assert.strictEqual(sw.includes("nxtfrm-v109-premium-cache"), true);
});

/* Anatomy contract, D18. No browser: the used box is the CSS cascade
   (premium-ui.css then vnext.css) applied to the figure Train actually
   renders. The in-flow head is the measured text row, 64px — title min-height
   44 plus the muscle line — plus one line-height for each extra wrap this
   model can see. Log Set sits a fixed distance under that row, so it moves
   only when the head moves.
   The Node layout model cannot reproduce real text wrapping, so it is not the
   authority for the wrap case and this file does not simulate that wrap.
   Chromium is. The approved measurement for "Chest Supported T-Bar Row" is
   about 13px of head and about 14px of Log Set at 390, 393 and 375, about
   7px at 320, and 0px at 402 and 430. Those sit inside the hard budget:
   16px at 360px and above, 10px at 359px and below, and at most one extra
   title line. This file asserts that budget on the cost it can compute
   (figure present versus absent). A strict 0px match would fail a layout
   the owner has already approved.
   Full A is the queue, because Train discards a name that is not in it.
   Title advances are the system UI font at the Train title's size, weight 650
   and letter-spacing -0.028em. Muscle advances are the same font at 12.5px.
   "Chest Supported T-Bar Row" is the name that wraps beside a full figure. */
const FULL_A = [
  { name: "Incline Dumbbell Press", sets: 3, reps: [8, 12], inc: 2.5 },
  { name: "Chest Supported T-Bar Row", sets: 3, reps: [8, 12], inc: 2.5 },
  { name: "Leg Press", sets: 3, reps: [8, 12], inc: 5 },
  { name: "Hamstring Curl", sets: 2, reps: [10, 15], inc: 2.5 },
  { name: "Cable Lateral Raise", sets: 2, reps: [12, 20], inc: 1 },
  { name: "Ab Crunch", sets: 2, reps: [12, 20], inc: 2.5 }
];
const ANAT_NAMES = FULL_A.map(e => e.name);
const ANAT_WIDTHS = [390, 393, 402, 430, 375, 320];
const TEXT_ROW = 64;
const TITLE_24 = {
  "Incline Dumbbell Press": 235.7,
  "Chest Supported T-Bar Row": 291.3,
  "Leg Press": 101.5,
  "Hamstring Curl": 157.2,
  "Cable Lateral Raise": 197.8,
  "Ab Crunch": 111.3
};
const TITLE_22 = {
  "Incline Dumbbell Press": 216.6,
  "Chest Supported T-Bar Row": 267.3,
  "Leg Press": 93.2,
  "Hamstring Curl": 144.5,
  "Cable Lateral Raise": 181.5,
  "Ab Crunch": 102.0
};
const MUSCLE_PX = {
  "Incline Dumbbell Press": 203.5,
  "Chest Supported T-Bar Row": 155.6,
  "Leg Press": 166.6,
  "Hamstring Curl": 119.0,
  "Cable Lateral Raise": 179.0,
  "Ab Crunch": 23.0
};
const CSS_VARS = {
  "--nxt-touch-min": 44,
  "--nxt-space-1": 4, "--nxt-space-2": 8, "--nxt-space-3": 12, "--nxt-space-4": 16
};

function splitCommas(s) {
  const out = [];
  let depth = 0, quote = "", start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  out.push(s.slice(start).trim());
  return out.filter(Boolean);
}
function parseSheet(cssText) {
  const src = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let i = 0;
  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }
  function matchingBrace() {
    let depth = 1, quote = "";
    const start = i;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (quote) { if (ch === quote && src[i - 1] !== "\\") quote = ""; i++; continue; }
      if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    return src.slice(start, i - 1);
  }
  function parseList(media) {
    while (i < src.length) {
      skipWs();
      if (i >= src.length) return;
      if (src[i] === "}") { i++; return; }
      if (src[i] === "@") {
        const brace = src.indexOf("{", i);
        const header = src.slice(i, brace).trim();
        i = brace + 1;
        if (/^@media\b/i.test(header)) parseList(header);
        else matchingBrace();
        continue;
      }
      const brace = src.indexOf("{", i);
      if (brace < 0) return;
      const selectors = src.slice(i, brace).trim();
      i = brace + 1;
      const body = matchingBrace();
      if (selectors) rules.push({ media, selectors, body });
    }
  }
  parseList(null);
  return rules;
}
function declsOf(body) {
  const out = [];
  let cur = "", depth = 0, quote = "";
  function push(raw) {
    const t = raw.trim();
    if (!t) return;
    const c = t.indexOf(":");
    if (c < 0) return;
    let value = t.slice(c + 1).trim();
    const important = /!important\s*$/i.test(value);
    value = value.replace(/\s*!important\s*$/i, "").trim();
    out.push({ prop: t.slice(0, c).trim().toLowerCase(), value, important });
  }
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) { push(cur); cur = ""; continue; }
    cur += ch;
  }
  push(cur);
  return out;
}
function specOf(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const cls = (selector.match(/\.[\w-]+/g) || []).length;
  const attrs = (selector.match(/\[[^\]]+\]/g) || []).length;
  const pseudos = (selector.match(/:(?!:)[\w-]+/g) || []).length;
  const rest = selector
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/#[\w-]+/g, " ")
    .replace(/\.[\w-]+/g, " ")
    .replace(/::[\w-]+/g, " ")
    .replace(/:[\w-]+(\([^)]*\))?/g, " ")
    .replace(/[>+~]/g, " ");
  const els = rest.split(/\s+/).filter(t => t && t !== "*").length;
  return [ids, cls + attrs + pseudos, els];
}
function mediaApplies(header, width, flags) {
  if (!header) return true;
  const h = header.replace(/\s+/g, "").toLowerCase();
  const flagsOn = flags || {};
  if (h.includes("prefers-reduced-motion")) return !!flagsOn.reduced;
  let saw = false, ok = true;
  const max = /max-width:(\d+)px/.exec(h);
  const min = /min-width:(\d+)px/.exec(h);
  if (max) { saw = true; ok = ok && width <= Number(max[1]); }
  if (min) { saw = true; ok = ok && width >= Number(min[1]); }
  return saw ? ok : false;
}
function evalLen(value, ctx) {
  if (value == null || value === "") return null;
  const v = String(value).replace(/\s+/g, "");
  if (v === "auto" || v === "none") return null;
  if (v === "0") return 0;
  return evalExpr(v, ctx);
  function evalExpr(expr, c) {
    if (expr.startsWith("min(") && expr.endsWith(")")) {
      return Math.min(...splitCommas(expr.slice(4, -1)).map(p => evalExpr(p, c)));
    }
    if (expr.startsWith("max(") && expr.endsWith(")")) {
      return Math.max(...splitCommas(expr.slice(4, -1)).map(p => evalExpr(p, c)));
    }
    if (expr.startsWith("var(") && expr.endsWith(")")) {
      const bits = splitCommas(expr.slice(4, -1));
      if (bits[0] === "--nxa-ar") return c.ar;
      if (bits[0] in CSS_VARS) return CSS_VARS[bits[0]];
      if (bits[1] != null) return evalExpr(bits[1], c);
      throw new Error("unresolved " + expr);
    }
    if (expr.startsWith("calc(") && expr.endsWith(")")) {
      let s = expr.slice(5, -1).replace(/var\([^)]*\)/g, m => String(evalExpr(m, c)));
      s = s.replace(/(\d*\.?\d+)px/g, "$1");
      s = s.replace(/(\d*\.?\d+)%/g, (_, n) => String((c.pct || 0) * parseFloat(n) / 100));
      if (!/^[\d.+\-*/()]+$/.test(s)) throw new Error("bad calc " + expr + " => " + s);
      return Function(`"use strict";return(${s})`)();
    }
    if (expr.endsWith("%")) return (c.pct || 0) * parseFloat(expr) / 100;
    if (expr.endsWith("px")) return parseFloat(expr);
    const n = Number(expr);
    if (Number.isFinite(n)) return n;
    throw new Error("bad length " + expr);
  }
}
const STYLE_RULES = parseSheet(premCss).concat(parseSheet(css));
function winning(pred, width, flags) {
  let order = 0;
  const map = new Map();
  for (const rule of STYLE_RULES) {
    if (!mediaApplies(rule.media, width, flags)) { order += declsOf(rule.body).length || 1; continue; }
    for (const sel of splitCommas(rule.selectors)) {
      const spec = pred(normSel(sel));
      if (!spec) continue;
      for (const decl of declsOf(rule.body)) {
        order++;
        const cand = { spec, order, value: decl.value, important: decl.important };
        const prev = map.get(decl.prop);
        if (!prev || wins(cand, prev)) map.set(decl.prop, cand);
      }
    }
  }
  const out = {};
  for (const [k, v] of map) out[k] = v.value;
  return out;
}
function normSel(s) { return s.replace(/\s+/g, " ").trim(); }
function wins(a, b) {
  if (!!a.important !== !!b.important) return !!a.important;
  for (let i = 0; i < 3; i++) if (a.spec[i] !== b.spec[i]) return a.spec[i] > b.spec[i];
  return a.order > b.order;
}
function sizePred(kind) {
  return function (sel) {
    if (/:active|:focus|::/.test(sel)) return null;
    if (kind === "button" && (sel === ".nxp-train-lift .nxp-ex-anat" || sel === "#trainPage .vn-train-active .nxp-ex-anat")) return specOf(sel);
    if (kind === "svg" && (sel === ".nxp-train-lift .nxp-ex-anat .nxa" || sel === "#trainPage .vn-train-active .nxp-ex-anat .nxa")) return specOf(sel);
    if (kind === "top" && (sel === ".nxp-train-lift .nxp-ex-top" || sel === "#trainPage .vn-train-active .nxp-ex-top")) return specOf(sel);
    if (kind === "textcol" && (sel === ".nxp-train-lift .nxp-ex-text" || sel === "#trainPage .vn-train-active .nxp-ex-text")) return specOf(sel);
    if (kind === "title" && sel === "#trainPage .vn-train-active .nxp-ex-title") return specOf(sel);
    return null;
  };
}
function buttonBox(width, ar) {
  const d = winning(sizePred("button"), width, {});
  const ctx = { ar, pct: TEXT_ROW };
  const maxW = evalLen(d["max-width"], { ar, pct: width });
  const maxH = evalLen(d["max-height"], ctx);
  const minH = evalLen(d["min-height"], ctx);
  let w = evalLen(d.width, { ar, pct: width });
  let h = evalLen(d.height, ctx);
  if (w == null) w = maxW == null ? TEXT_ROW : maxW;
  if (h == null) h = d["align-self"] === "stretch" ? TEXT_ROW : (minH || 0);
  if (maxW != null) w = Math.min(w, maxW);
  if (minH != null) h = Math.max(h, minH);
  if (maxH != null) h = Math.min(h, maxH);
  return { w, h, d };
}
function svgBox(width, ar, buttonW, buttonH) {
  const d = winning(sizePred("svg"), width, {});
  const wCtx = { ar, pct: buttonW };
  const hCtx = { ar, pct: buttonH };
  const maxW = evalLen(d["max-width"], wCtx);
  const maxH = evalLen(d["max-height"], hCtx);
  let w = evalLen(d.width, wCtx);
  let h = evalLen(d.height, hCtx);
  const ratio = d["aspect-ratio"] && d["aspect-ratio"].replace(/\s+/g, "").includes("--nxa-ar") ? ar : null;
  if (w == null && h != null && ratio) w = h * ratio;
  if (h == null && w != null && ratio) h = w / ratio;
  if (maxW != null && w > maxW) { w = maxW; if (ratio) h = w / ratio; }
  if (maxH != null && h > maxH) { h = maxH; if (ratio) w = Math.min(h * ratio, maxW == null ? Infinity : maxW); }
  return { w, h, d };
}
function columnGap(width) {
  const d = winning(sizePred("top"), width, {});
  const g = evalLen(d.gap, { ar: 1, pct: 0 });
  return g == null ? 12 : g;
}
function overlaps(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
    && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
}
function measuredTitle(name, fontSize) {
  const table = fontSize <= 22 ? TITLE_22 : TITLE_24;
  const w = table[name];
  if (w == null) throw new Error("no title width for " + name);
  return w;
}
function measuredMuscle(name) {
  const w = MUSCLE_PX[name];
  if (w == null) throw new Error("no muscle width for " + name);
  return w;
}
function contentWidth(width) {
  const gutter = width <= 390 ? 11 : 14;
  return { gutter, contentW: width - gutter * 2 };
}
function figureYields(width) {
  const top = winning(sizePred("top"), width, {});
  const text = winning(sizePred("textcol"), width, {});
  const min = (text["min-width"] || "").replace(/\s+/g, "");
  return top.display === "flex" && min.includes("max-content");
}
function titleLineCount(titlePx, columnW) {
  const col = Math.max(columnW, 1);
  return titlePx <= col + 0.01 ? 1 : Math.ceil(titlePx / col);
}
function anatomyBudget(width) {
  return width <= 359 ? 10 : 16;
}
function rowHeight(titlePx, musclePx, columnW, fontSize) {
  const col = Math.max(columnW, 1);
  const titleLines = titleLineCount(titlePx, col);
  const muscleLines = musclePx <= col + 0.01 ? 1 : Math.ceil(musclePx / col);
  return TEXT_ROW
    + Math.max(0, titleLines - 1) * fontSize * 1.1
    + Math.max(0, muscleLines - 1) * 12.5 * 1.4;
}
function layoutAt(width, ar, show, name) {
  const { gutter, contentW } = contentWidth(width);
  const fontSize = width <= 359 ? 22 : 24;
  const titlePx = measuredTitle(name, fontSize);
  const musclePx = measuredMuscle(name);
  const gap = columnGap(width);
  if (!show) {
    const head = rowHeight(titlePx, musclePx, contentW, fontSize);
    return {
      head, log: logBottom(width, head), gutter, contentW, gap,
      titleLines: titleLineCount(titlePx, contentW),
      title: { left: gutter, right: gutter + contentW, top: 0, bottom: head }
    };
  }
  const btnNom = buttonBox(width, ar);
  const need = Math.max(titlePx, musclePx);
  let textW;
  let btnW;
  if (figureYields(width)) {
    const floor = Math.min(contentW, need);
    const room = contentW - floor - gap;
    if (room >= btnNom.w) {
      btnW = btnNom.w;
      textW = contentW - gap - btnW;
    } else if (room >= 0) {
      btnW = room;
      textW = floor;
    } else {
      btnW = 0;
      textW = Math.min(contentW, floor);
    }
  } else {
    btnW = btnNom.w;
    textW = contentW - gap - btnW;
  }
  const btn = { w: btnW, h: btnNom.h, d: btnNom.d };
  const svgNom = svgBox(width, ar, btnNom.w, btnNom.h);
  let svg = svgNom;
  if (btnW < btnNom.w - 0.01) {
    let w = btnW;
    let h = ar > 0 ? w / ar : 0;
    if (h > btn.h) { h = btn.h; w = Math.min(btnW, h * ar); }
    svg = { w, h, d: svgNom.d };
  }
  const inFlow = svg.d.position !== "absolute";
  const textH = rowHeight(titlePx, musclePx, textW, fontSize);
  const titleLines = titleLineCount(titlePx, textW);
  const head = Math.max(textH, inFlow ? Math.max(btn.h, svg.h) : btn.h);
  const anat = {
    left: gutter + textW + (btnW > 0 ? gap : 0),
    right: gutter + textW + (btnW > 0 ? gap : 0) + btnW,
    top: 0,
    bottom: inFlow ? Math.max(btn.h, svg.h) : btn.h,
    w: btnW, h: btn.h
  };
  const aim = {
    left: gutter, right: gutter + contentW,
    top: head, bottom: head + (width <= 359 ? 96 : 48)
  };
  const title = { left: gutter, right: gutter + textW, top: 0, bottom: textH };
  return { head, log: logBottom(width, head), gutter, contentW, gap, btn, svg, anat, aim, title, titleLines };
}
function logBottom(width, head) {
  const aim = width <= 359 ? 96 : 48;
  const form = 52 + 12 + 52 + 12 + 44 + 12 + 50;
  return 120 + head + 12 + aim + form;
}
function cropInfo(name) {
  const m = app.NXTLIB.musclesFor(name);
  const view = app.NXTANAT.viewFor(m.primary, []);
  const crop = app.NXTANAT.cropFor(m.primary, view);
  const front = app.NXTANAT.cropFor(m.primary, "front");
  const back = app.NXTANAT.cropFor(m.primary, "back");
  return { m, view, crop, front, back, ar: Number((crop[2] / crop[3]).toFixed(3)), raw: crop[2] / crop[3] };
}
function withQueue(list, fn) {
  const prev = app.template;
  const prevEx = state.exercise;
  const snap = { active: NXP.ui.trainActive, last: NXP.ui.lastExercise, idx: NXP.ui.lastIndex };
  app.template = () => list.slice();
  try { fn(); }
  finally {
    app.template = prev;
    state.exercise = prevEx;
    NXP.ui.trainActive = snap.active;
    NXP.ui.lastExercise = snap.last;
    NXP.ui.lastIndex = snap.idx;
  }
}
function renderQueued(name) {
  assert.ok(app.template().some(e => e.name === name), name + " is outside the session queue");
  state.dayType = "FullA";
  state.gym = "Gym A";
  state.logs = [];
  state.exercise = name;
  state.setNum = 1;
  NXP.ui.trainActive = true;
  NXP.training();
  assert.strictEqual(state.exercise, name, "Train did not keep " + name);
  return page.innerHTML;
}
function viewBoxOf(html) {
  const boxes = [...html.matchAll(/<svg class="nxa"[^>]*viewBox="([^"]+)"/g)];
  return boxes.map(m => m[1].trim().split(/\s+/).map(Number));
}
function motionPred(which, flags) {
  return function (sel) {
    if (/:active|:focus|::/.test(sel)) return null;
    if (sel.includes(".is-back")) return null;
    if (sel.includes(".is-forward") && !flags.forward) return null;
    if (/data-nxp-motion/.test(sel) && !flags.attr) return null;
    if (which === "text") {
      if (sel.endsWith(".nxp-ex-text")) return specOf(sel);
    } else if (sel.endsWith(".nxp-ex-anat")) return specOf(sel);
    if (sel === ".nxp *") return specOf(sel);
    if (flags.attr && /\*\s*$/.test(sel) && /data-nxp-motion/.test(sel)) return specOf(sel);
    return null;
  };
}
function quiet(value) {
  if (value == null) return true;
  const s = value.replace(/\s+/g, "").toLowerCase();
  return s === "none" || s === "0s" || s === "0ms";
}

test("anatomy stays inside the D18 budget at 390, 393, 402, 430, 375 and 320", () => {
  const long = "Chest Supported T-Bar Row";
  assert.ok(FULL_A.some(e => e.name === long), long + " is not in the Full A queue");
  assert.ok(figureYields(390), "the text column does not keep its max-content width");
  for (const width of [390, 393, 375]) {
    const beside = contentWidth(width).contentW - columnGap(width) - buttonBox(width, cropInfo(long).ar).w;
    assert.ok(measuredTitle(long, 24) > beside,
      long + " still fits beside a full figure at " + width + " (" + beside.toFixed(1) + "px)");
  }
  withQueue(FULL_A, () => {
    for (const name of FULL_A.map(e => e.name)) {
      const info = cropInfo(name);
      const html = renderQueued(name);
      assert.strictEqual(viewBoxOf(html).length, 1, name + " should be one view");
      const rendered = (html.match(/class="nxp-ex-title"[^>]*>([^<]*)</) || [])[1];
      assert.strictEqual(rendered, name, name + " title is missing or truncated in the markup");
      for (const width of ANAT_WIDTHS) {
        const on = layoutAt(width, info.ar, true, name);
        const off = layoutAt(width, info.ar, false, name);
        /* Budget, not a simulated wrap. This model cannot reproduce the
           browser's text wrap, so head and Log Set costs are the differences
           it does compute, checked against D18: <=16px at >=360, <=10px at
           <=359. One extra title line is the most the contract allows. */
        const budget = anatomyBudget(width);
        const headCost = on.head - off.head;
        const logCost = on.log - off.log;
        const extraLines = on.titleLines - off.titleLines;
        assert.strictEqual(on.svg.d.position, "absolute", name + " figure is in flow at " + width);
        assert.ok(headCost <= budget,
          name + " head cost " + headCost + "px exceeds " + budget + "px at " + width
          + " (on " + on.head + ", off " + off.head + ")");
        assert.ok(logCost <= budget,
          name + " Log Set cost " + logCost + "px exceeds " + budget + "px at " + width
          + " (on " + on.log + ", off " + off.log + ")");
        assert.ok(extraLines <= 1,
          name + " adds " + extraLines + " title lines at " + width
          + " (on " + on.titleLines + ", off " + off.titleLines + ")");
        assert.ok(on.btn.h <= TEXT_ROW + 0.01, name + " button grows the row at " + width);
        const fontSize = width <= 359 ? 22 : 24;
        assert.ok(on.title.right - on.title.left + 0.01 >= Math.min(contentWidth(width).contentW, measuredTitle(name, fontSize)),
          name + " title column lost a line's width at " + width);
        const style = winning(sizePred("title"), width, {});
        assert.strictEqual(style["white-space"], "normal", name + " title cannot wrap at " + width);
        assert.strictEqual(style.overflow, "visible", name + " title is clipped at " + width);
        assert.ok(!style["text-overflow"] || style["text-overflow"] === "clip",
          name + " title is ellipsised at " + width + " (" + style["text-overflow"] + ")");
        assert.ok(!style["line-clamp"] && !style["-webkit-line-clamp"],
          name + " title is line-clamped at " + width);
      }
    }
  });
});

test("anatomy never intersects the Last, Target and Rest strip", () => {
  for (const name of ANAT_NAMES) {
    const info = cropInfo(name);
    for (const width of ANAT_WIDTHS) {
      const box = layoutAt(width, info.ar, true, name);
      assert.strictEqual(box.btn.d.overflow, "hidden", "figure can paint outside the button");
      assert.ok(!overlaps(box.anat, box.aim), name + " crosses the aim strip at " + width
        + " anat " + box.anat.bottom + " aim " + box.aim.top);
      assert.ok(box.svg.h <= box.btn.h + 0.05, name + " svg taller than its button at " + width);
    }
  }
});

test("the exercise title stays whole at 320", () => {
  withQueue(FULL_A, () => {
    const name = "Chest Supported T-Bar Row";
    const html = renderQueued(name);
    const title = (html.match(/class="nxp-ex-title"[^>]*>([^<]*)</) || [])[1];
    assert.strictEqual(title, name);
    const style = winning(sizePred("title"), 320, {});
    assert.strictEqual(style["white-space"], "normal");
    assert.strictEqual(style.overflow, "visible");
    assert.ok(!style["text-overflow"] || style["text-overflow"] === "clip");
    const info = cropInfo(name);
    const box = layoutAt(320, info.ar, true, name);
    const titleW = box.title.right - box.title.left;
    assert.ok(titleW >= 160, "title column is " + titleW + "px");
    assert.ok(!overlaps(box.title, box.anat), "figure covers the title");
    for (const other of ANAT_NAMES) {
      const view = renderQueued(other);
      const text = (view.match(/class="nxp-ex-title"[^>]*>([^<]*)</) || [])[1];
      assert.strictEqual(text, other);
    }
  });
});

test("reduced motion swaps the exercise with no transition or animation", () => {
  withQueue(FULL_A, () => {
    NXP.ui.lastExercise = "Incline Dumbbell Press";
    NXP.ui.lastIndex = 0;
    const html = renderQueued("Chest Supported T-Bar Row");
    assert.ok(html.includes("is-forward"), "exercise change did not mark the head");
  });
  const live = winning(motionPred("anat", { forward: true, attr: false }), 390, {});
  assert.ok(/nxp-ex-anat-enter/.test(live.animation || ""), "change animation missing: " + live.animation);
  assert.ok(/200ms/.test(live.animation || ""));
  const reduced = winning(motionPred("anat", { forward: true, attr: false }), 390, { reduced: true });
  const reducedText = winning(motionPred("text", { forward: true, attr: false }), 390, { reduced: true });
  assert.ok(quiet(reduced.animation), "anatomy animation " + reduced.animation);
  assert.ok(quiet(reduced.transition), "anatomy transition " + reduced.transition);
  assert.ok(quiet(reducedText.animation), "title animation " + reducedText.animation);
  assert.ok(quiet(reducedText.transition), "title transition " + reducedText.transition);
  const attr = winning(motionPred("anat", { forward: true, attr: true }), 390, { attr: true });
  assert.ok(quiet(attr.animation) && quiet(attr.transition), "data-nxp-motion still animates");
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*\.nxp-ex-anat[\s\S]*?animation:none;[\s\S]*?transition:none/.test(css));
  assert.ok(/data-nxp-motion="reduced"[\s\S]*\.nxp-ex-anat[\s\S]*?animation:none/.test(css));
  const kfAt = premCss.indexOf("@keyframes nxp-ex-anat-enter");
  const kf = premCss.slice(kfAt, premCss.indexOf("}", premCss.indexOf("}", kfAt) + 1) + 1);
  assert.ok(/opacity:\s*0/.test(kf) && /opacity:\s*1/.test(kf));
  assert.strictEqual(/transform|scale|rotate/.test(kf), false);
});

test("size clamps hold at both breakpoints and the svg keeps the crop aspect", () => {
  const wideCap = { w: 72, h: 64 };
  const narrowCap = { w: 64, h: 56 };
  withQueue(FULL_A, () => {
    for (const name of ANAT_NAMES) {
      const info = cropInfo(name);
      const html = renderQueued(name);
      const boxes = viewBoxOf(html);
      assert.ok(boxes[0].length === info.crop.length && boxes[0].every((n, i) => n === info.crop[i]),
        name + " viewBox " + boxes[0].join(" ") + " vs " + info.crop.join(" "));
      const attr = Number((html.match(/--nxa-ar:([0-9.]+)/) || [])[1]);
      assert.strictEqual(attr, info.ar, name + " --nxa-ar");
      const expectBack = name === "Chest Supported T-Bar Row" || name === "Hamstring Curl";
      assert.strictEqual(info.view, expectBack ? "back" : "front", name + " view " + info.view);
      if (expectBack) {
        const sameFront = info.crop.length === info.front.length && info.crop.every((n, i) => n === info.front[i]);
        assert.strictEqual(sameFront, false, name + " used the front crop");
      }
      for (const [width, cap, tall] of [[390, wideCap, true], [360, wideCap, true], [359, narrowCap, false], [320, narrowCap, false]]) {
        const btn = buttonBox(width, info.ar);
        const svg = svgBox(width, info.ar, btn.w, btn.h);
        assert.ok(btn.w <= cap.w + 0.05 && btn.h <= cap.h + 0.05,
          name + " button " + btn.w.toFixed(2) + "x" + btn.h.toFixed(2) + " at " + width + " over " + cap.w + "x" + cap.h);
        assert.ok(svg.w <= cap.w + 0.05 && svg.h <= cap.h + 0.05,
          name + " svg " + svg.w.toFixed(2) + "x" + svg.h.toFixed(2) + " at " + width);
        if (tall) assert.ok(btn.h > 60, name + " wide button collapsed to " + btn.h + " at " + width);
        else assert.ok(Math.abs(btn.h - 56) < 0.05, name + " narrow height " + btn.h + " at " + width);
        const aspect = svg.w / svg.h;
        assert.ok(Math.abs(aspect - info.raw) < 0.02, name + " aspect " + aspect.toFixed(3) + " vs crop " + info.raw.toFixed(3) + " at " + width);
        assert.ok(Math.abs(aspect - info.ar) < 0.01, name + " aspect drifted from --nxa-ar");
      }
    }
  });
});

test("an unmapped exercise renders no figure", () => {
  withQueue(FULL_A, () => {
    state.dayType = "FullA";
    state.exercise = "Mystery Lift";
    state.logs = [];
    NXP.ui.trainActive = true;
    NXP.training();
    assert.strictEqual(state.exercise, FULL_A[0].name, "a name outside the queue was kept");
  });
  const queued = FULL_A.concat([{ name: "Mystery Lift", sets: 3, reps: [8, 12], inc: 2.5 }]);
  withQueue(queued, () => {
    const known = renderQueued("Incline Dumbbell Press");
    assert.ok(known.includes("nxp-ex-anat"));
    const bare = renderQueued("Mystery Lift");
    const muscles = app.NXTLIB.musclesFor("Mystery Lift");
    assert.strictEqual(muscles.primary.length, 0);
    assert.strictEqual(app.NXTLIB.has("Mystery Lift"), false);
    assert.strictEqual(bare.includes("nxp-ex-anat"), false);
    assert.strictEqual(bare.includes('class="nxa"'), false);
    assert.ok(bare.includes("Mystery Lift"));
  });
});

await testAsync("blur returns Log Set to the form", async () => {
  resetSession();
  openKeyboard();
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  fire("focusout", els.weightInput);
  assert.strictEqual(logBtn.classList.contains("is-kb"), true);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.strictEqual(logBtn.classList.contains("is-kb"), false);
  assert.strictEqual(form.classList.contains("is-kb"), false);
  assert.strictEqual(logBtn.style.getPropertyValue("--nxp-kb-bottom"), "");
});

function testAsync(name, fn) {
  return fn().then(() => { passed++; console.log("PASS  " + name); }, err => {
    failed++;
    console.log("FAIL  " + name);
    console.log("      " + (err && err.stack ? err.stack : err));
  });
}

console.log(failed ? "FAILED  " + passed + " passed, " + failed + " failed" : "OK  " + passed + " passed");
process.exit(failed ? 1 : 0);
