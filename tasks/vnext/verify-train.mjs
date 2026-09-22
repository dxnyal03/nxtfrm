/* TRAIN COMPLETION — deterministic checks. No browser.
   Realistic fixtures: first/middle/last set, warm-up and working, RIR present
   and absent, history and none, several completed sets, an active timer,
   a queue, an add-on workout, Gym A and Gym B, mapped and unmapped anatomy.
   A set logged from the keyboard dock must match one logged in normal flow. */
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
