/* NXTFRM plan persistence contract. Run: node wearables.plan-persistence.test.js

   Owner report: "a customised weekly split sometimes reverts to the original
   programme after being saved." Commit 3bf1862 fixed one cause (leaving
   minimum mode re-seeded from the factory list). These tests pin the rest.

   They run the SHIPPED code, not a model of it: index.html's boot region,
   load/save/persist() and its cloud functions are cut out of the page by their
   source text and evaluated in a vm in page order, followed by the whole of
   cut-support.js and, where a save path lives there, premium-ui.js. Around
   them sit a fake localStorage (one that can refuse writes, like a full
   phone), fake timers and a fake Supabase client holding one apexcut_profiles
   row. Nothing else is stubbed that takes part in a merge or a save.

   The account row in most tests is what another device actually uploads:
   getCloudPayload() from a second booted page. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = __dirname;
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8")
  /* `const NXT = ...` is a lexical binding and never lands on the vm global. */
  + "\n;globalThis.__NXT__ = NXT;\n";
const UI = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8") + "\n;globalThis.__NXP__ = NXP;\n";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ---- Shipped index.html, cut out by source text ------------------------- */
function region(start, end) {
  const s = HTML.indexOf(start);
  assert.ok(s !== -1, "index.html no longer contains " + start);
  const e = HTML.indexOf(end, s + start.length);
  assert.ok(e !== -1, "index.html no longer contains " + end + " after " + start);
  return HTML.slice(s, e);
}
function fnSource(name) {
  let s = HTML.indexOf("\nfunction " + name + "(");
  if (s === -1) s = HTML.indexOf("\nasync function " + name + "(");
  assert.ok(s !== -1, "index.html no longer defines " + name + "()");
  const ends = ["\nfunction ", "\nasync function ", "\n</script>"]
    .map(m => HTML.indexOf(m, s + 1)).filter(i => i !== -1);
  return HTML.slice(s, Math.min.apply(null, ends));
}
/* One script, so function declarations hoist the way they do in the page:
   the settings boot (defaults, weekly plan, TEMPLATES), state and persist(),
   then the helpers and the original cloud functions cut-support overrides. */
const PAGE = [
  region("const SETTINGS_DEFAULTS=", "\nconst EXERCISE_ALIASES"),
  region("let state={", "\nfunction today(){"),
  ["today", "uid", "sessionKey", "template", "getFullBackup", "getCloudPayload", "applyCloudPayload",
    "loadSupabase", "awaitCloudLibrary", "initSupabaseClient", "scheduleCloudSave", "saveCloudNow", "loadCloudNow", "cloudLogin",
    "cloudSignup", "cloudSignOut"].map(fnSource).join("\n")
].join("\n");

/* ---- Host doubles -------------------------------------------------------- */
function quota() { const e = new Error("The quota has been exceeded."); e.name = "QuotaExceededError"; return e; }
/* Items are own enumerable properties, as on a real Storage, so getFullBackup's
   Object.keys(localStorage) sees exactly the stored keys. */
function makeStorage(seed, refuse) {
  const data = new Map(Object.entries(seed || {}));
  const store = {};
  const sync = () => {
    for (const k of Object.keys(store)) delete store[k];
    for (const [k, v] of data) Object.defineProperty(store, k, { value: v, enumerable: true, configurable: true });
  };
  Object.defineProperties(store, {
    getItem: { value(k) { return data.has(String(k)) ? data.get(String(k)) : null; } },
    setItem: { value(k, v) { if (refuse && refuse(String(k))) throw quota(); data.set(String(k), String(v)); sync(); } },
    removeItem: { value(k) { data.delete(String(k)); sync(); } },
    clear: { value() { data.clear(); sync(); } },
    key: { value(i) { return Array.from(data.keys())[i] ?? null; } },
    length: { get() { return data.size; } },
    json: { value(k) { return data.has(k) ? JSON.parse(data.get(k)) : undefined; } },
    raw: { value: data }
  });
  sync();
  return store;
}
function makeElement(extra) {
  return Object.assign({
    style: { setProperty() {} }, dataset: {}, hidden: false, value: "", checked: false, textContent: "", innerHTML: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    insertAdjacentHTML() {}, querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }
  }, extra || {});
}
const clone = v => JSON.parse(JSON.stringify(v));
const USER = { id: "user-1", email: "owner@nxtfrm.test" };
/* One apexcut_profiles row. Data is cloned in and out, as JSON over the wire. */
function fakeCloud(opts) {
  opts = opts || {};
  const db = { row: opts.row ? clone(opts.row) : null, upserts: [], selects: 0, failSelects: opts.failSelects || 0 };
  const client = {
    auth: {
      async getSession() { return { data: { session: opts.session ? { user: USER, expires_at: Math.floor(Date.now() / 1000) + 3600 } : null }, error: null }; },
      async signInWithPassword() { return { data: { user: USER }, error: null }; },
      async signUp() { return { data: { user: USER }, error: null }; },
      async signOut() { return { error: null }; }
    },
    from() {
      return {
        async upsert(row) { if (opts.failUpserts) { db.refused = (db.refused || 0) + 1; return { error: new Error("row-level security violation") }; } db.upserts.push(clone(row.data)); db.row = clone(row.data); return { error: null }; },
        select() {
          return { eq() { return { async maybeSingle() {
            db.selects += 1;
            if (db.gate) await db.gate; // a read held in flight by the test
            if (db.failSelects > 0) { db.failSelects -= 1; return { data: null, error: new Error("Network request failed") }; }
            return { data: db.row ? { data: clone(db.row) } : null, error: null };
          } }; } };
        }
      };
    }
  };
  return { client, db };
}
const CLOUD_KEYS = { apm_sb_url: "https://project.supabase.test", apm_sb_key: "anon-test-key" };
const flush = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };

/* Names the page defines elsewhere (renderers, sheets). Learned once by
   retrying on "X is not defined" with a fresh context, then reused. */
const learned = new Set();

/* Boot one page. seed: localStorage contents (strings). opts: date, cloud,
   refuse (storage refusal predicate), ui (also load premium-ui.js),
   library: "absent" boots with no window.supabase, as the real page does: supabase-js
   is fetched after parse (loadSupabase), and arrive()/fail() play the script's outcome. */
function boot(seed, opts) {
  opts = opts || {};
  for (let attempt = 0; attempt < 200; attempt++) {
    const toasts = [], errors = [], timers = [], elements = {}, scripts = [];
    let timerId = 0;
    for (const id of ["homePage", "trainPage", "weightPage", "historyPage", "morePage", "modalRoot"]) elements[id] = makeElement();
    const storage = makeStorage(seed, opts.refuse);
    const sandbox = {
      console: { log() {}, info() {}, warn() {}, error() { errors.push(Array.from(arguments).map(String).join(" ")); } },
      document: {
        getElementById(id) { return elements[id] || null; }, querySelector() { return null; },
        querySelectorAll() { return []; }, createElement() { return makeElement(); }, contains() { return false; },
        head: { appendChild(el) { scripts.push(el); } },
        addEventListener() {}, removeEventListener() {}, activeElement: null, readyState: "complete", title: "", hidden: false
      },
      localStorage: storage,
      location: { hostname: "app.nxtfrm.test", search: "", reload() { sandbox.__reloaded = true; } },
      navigator: {},
      supabase: opts.library === "absent" ? undefined : { createClient() { return opts.cloud ? opts.cloud.client : null; } },
      setTimeout(f, ms) { timerId += 1; timers.push({ id: timerId, f, ms }); return timerId; },
      clearTimeout(id) { const i = timers.findIndex(t => t.id === id); if (i !== -1) timers.splice(i, 1); },
      toast(m) { toasts.push(String(m)); },
      render() {}, closeModal() {}, confirm() { return true; },
      val(id) { return (elements[id] && elements[id].value) || ""; },
      esc(v) { return String(v === null || v === undefined ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
    };
    sandbox.window = sandbox;
    for (const n of learned) if (!(n in sandbox)) sandbox[n] = function () { return null; };
    const ctx = vm.createContext(sandbox);
    try {
      vm.runInContext(PAGE, ctx, { filename: "index.html" });
      /* A pinned "today", set the way the boot sets it, before cut-support installs. */
      vm.runInContext("state.date=" + JSON.stringify(opts.date || "2026-10-13") + ";state.dayType=resolveDayType(state.date);", ctx);
      vm.runInContext(CUT, ctx, { filename: "cut-support.js" });
      if (opts.ui) vm.runInContext(UI, ctx, { filename: "premium-ui.js" });
    } catch (err) {
      const miss = /^(\w+) is not defined$/.exec(String(err && err.message));
      if (!miss || learned.has(miss[1])) throw err;
      learned.add(miss[1]);
      continue;
    }
    const run = code => vm.runInContext(code, ctx);
    return {
      ctx, run, storage, toasts, errors, timers, elements, scripts,
      NXT: ctx.__NXT__, NXP: ctx.__NXP__,
      /* The library script the page inserted finishing: it defines window.supabase, then fires load. */
      arrive(client) { sandbox.supabase = { createClient() { return client; } }; scripts[scripts.length - 1].onload(); },
      /* Or failing (blocked, offline): its error event fires and nothing is defined. */
      fail() { scripts[scripts.length - 1].onerror(); },
      /* Read through JSON so values compare as plain objects of this realm. */
      get settings() { return clone(run("settings")); },
      get state() { return clone(run("state")); },
      /* What this page would send in a cloud save. */
      payload() { return clone(run("getCloudPayload()")); },
      async runTimers() { while (timers.length) { const t = timers.shift(); t.f(); await flush(); } },
      field(id, value) { elements[id] = makeElement(typeof value === "boolean" ? { checked: value } : { value }); }
    };
  }
  throw new Error("the page did not load within the stub budget");
}

/* ---- Fixtures ------------------------------------------------------------ */
const FACTORY_SPLIT = { 0: "Rest", 1: "FullA", 2: "Zone2", 3: "FullB", 4: "Zone2", 5: "FullC", 6: "Zone2" };
const CUSTOM_PLAN = { 0: "Rest", 1: "Push", 2: "Pull", 3: "Zone2", 4: "Pump", 5: "Push", 6: "Pull" };
const OTHER_PLAN = { 0: "Rest", 1: "Pull", 2: "Push", 3: "Pump", 4: "Zone2", 5: "Pull", 6: "Rest" };
const PREVIOUS_PLAN = { 0: "Rest", 1: "Push", 2: "Pull", 3: "Floorball", 4: "Pump", 5: "Floorball", 6: "Rest" };
const PULL_A = [{ name: "Chin-up", sets: 3, reps: [5, 8], inc: 2.5 }, { name: "Cable Row", sets: 3, reps: [8, 12], inc: 2.5 }, { name: "Face Pull", sets: 2, reps: [12, 15], inc: 1 }];
const PULL_B = [{ name: "Lat Pulldown", sets: 4, reps: [6, 10], inc: 2.5 }, { name: "Seated Row", sets: 3, reps: [8, 12], inc: 2.5 }];
const PUSH_A = [{ name: "Incline Dumbbell Press", sets: 4, reps: [6, 10], inc: 2 }, { name: "Dips", sets: 3, reps: [8, 12], inc: 0 }];
const FULLA_CUSTOM = [{ name: "Hack Squat", sets: 3, reps: [6, 10], inc: 5 }, { name: "Chin-up", sets: 3, reps: [5, 8], inc: 2.5 }, { name: "Machine Shoulder Press", sets: 3, reps: [8, 12], inc: 2.5 }];
const T_OLD = "2026-02-01T08:00:00.000Z", T_MID = "2026-03-01T08:00:00.000Z", T_NEW = "2026-04-01T08:00:00.000Z";

/* localStorage of an established phone: a customised split and routines. */
function phone(over) {
  over = over || {};
  const settings = Object.assign({
    startWeight: 90, targetLow: 75, targetHigh: 77, zone2WeeklyTarget: 120,
    weeklyPlan: CUSTOM_PLAN,
    cutSupport: Object.assign({ version: 99, previousWeeklyPlan: PREVIOUS_PLAN, templates: { "Gym A__Pull": PULL_A, "Gym A__Push": PUSH_A } }, over.cutSupport || {})
  }, over.settings || {});
  const seed = {
    apm_settings: JSON.stringify(settings),
    apm_logs: JSON.stringify(over.logs || [{ id: "log-a1", date: "2026-10-06", exercise: "Chin-up", weight: 10, reps: 8, setNum: 1, gym: "Gym A", dayType: "Pull", ts: 1000 }]),
    apm_bws: JSON.stringify(over.bws || [{ id: "bw-a1", date: "2026-10-12", weight: 84.2, timeOfDay: "Morning", ts: 1000 }]),
    apm_current_gym: JSON.stringify("Gym A")
  };
  if (over.sessionPlans) seed.apm_session_plans = JSON.stringify(over.sessionPlans);
  if (over.addOns) seed.apm_addons = JSON.stringify(over.addOns);
  return Object.assign(seed, over.extra || {});
}
/* The row another device uploads: boot it, take its cloud payload. */
function accountFrom(seed, opts) { return boot(seed, opts).payload(); }
/* A hand-built row for merge-rule tests. */
function row(settings, records) {
  return Object.assign({ logs: [], cardio: [], floorball: [], bws: [], scans: [], rest: [], gyms: ["Gym A", "Gym B"], gym: "Gym A",
    settings: Object.assign({ cutSupport: { version: 99 } }, settings || {}) }, records || {});
}
function signIn(device) { return device.run("(function(){cloudUser={id:'user-1',email:'owner@nxtfrm.test'};return cloudUser;})()"); }
const names = rows => Array.from(rows || [], e => e.name);

/* ===========================================================================
   1. A fresh or reset device must not overwrite the account's programme.
   =========================================================================== */

test("fresh device: Login + Load keeps the account's split and writes it back", async function () {
  const account = accountFrom(phone());
  const cloud = fakeCloud({ row: account });
  const B = boot({}, { cloud });
  /* What a fresh phone holds before it loads anything: the factory A/B/C split
     that install() writes on first run. This is the copy that used to win. */
  assert.deepStrictEqual(B.settings.weeklyPlan, FACTORY_SPLIT);
  B.run("template()"); // Today draws first and seeds its queue
  B.field("sbUrl", CLOUD_KEYS.apm_sb_url); B.field("sbKey", CLOUD_KEYS.apm_sb_key);
  B.field("sbEmail", USER.email); B.field("sbPass", "pw");
  await B.run("cloudLogin()"); await flush();
  assert.deepStrictEqual(B.settings.weeklyPlan, CUSTOM_PLAN, "the account's split is what this device now runs");
  assert.strictEqual(B.state.dayType, CUSTOM_PLAN[2], "Tuesday resolves from the account's split");
  assert.ok(cloud.db.upserts.length >= 1, "Login + Load still saves the merged result");
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN, "the write-back carries the account's split, not the factory one");
  assert.deepStrictEqual(clone(B.run("getFullBackup()")).settings.weeklyPlan, CUSTOM_PLAN, "and so does a backup");
  assert.deepStrictEqual(B.settings.cutSupport.previousWeeklyPlan, PREVIOUS_PLAN, "'Use my previous weekly plan' still means the account's previous plan");
  assert.deepStrictEqual(cloud.db.row.logs.map(r => r.id), ["log-a1"], "workouts are untouched by the plan rule");
});

test("fresh device: the split install() writes before any load is unstamped and yields", function () {
  /* With no cutSupport.version, install()'s V99 step replaces the boot's default plan
     with the A/B/C split before any cloud load. That is a migration, not an edit: it is
     not stamped, and the account's plan wins over it. The same holds for an install()
     that stopped at the V99 safety copy and left the boot default (Legs not yet folded). */
  const account = accountFrom(phone());
  const fresh = boot({});
  const stored = fresh.storage.json("apm_settings");
  assert.deepStrictEqual(stored.weeklyPlan, FACTORY_SPLIT, "install() wrote the A/B/C split");
  assert.strictEqual(stored.cutSupport.version, 99);
  assert.strictEqual(stored.planUpdatedAt, undefined, "the migration is not stamped");
  fresh.run("applyCloudPayload")(account);
  assert.deepStrictEqual(fresh.settings.weeklyPlan, CUSTOM_PLAN, "the account's split replaces it");
  let noCopy = true;
  const halfway = boot({}, { refuse: k => noCopy && k === "nxtfrm_recovery_snapshot" });
  assert.strictEqual(halfway.settings.cutSupport.version, undefined, "install() stopped at the V99 safety copy");
  assert.strictEqual(halfway.settings.weeklyPlan[6], "Legs", "leaving the boot default");
  noCopy = false;
  halfway.run("applyCloudPayload")(account);
  assert.deepStrictEqual(halfway.settings.weeklyPlan, CUSTOM_PLAN, "the boot default yields too");
  /* Stopped half-way, then an edit was stamped; once the copy fits, a later boot's V99
     step writes the split. The old stamp must not travel with it. */
  let full = true;
  const late = boot({}, { refuse: k => full && k === "nxtfrm_recovery_snapshot" });
  late.field("n99-day-every", true);
  late.NXT.setDayType("2026-10-14", "Pull"); // D35 day sheet, "every Wednesday"; makes no safety copy
  assert.ok(late.storage.json("apm_settings").planUpdatedAt, "the edit was stamped");
  full = false;
  const next = boot(Object.fromEntries(late.storage.raw));
  const migrated = next.storage.json("apm_settings");
  assert.deepStrictEqual(migrated.weeklyPlan, FACTORY_SPLIT, "the V99 step ran on this boot");
  assert.strictEqual(migrated.planUpdatedAt, undefined, "and dropped the stamp of the plan it replaced");
  next.run("applyCloudPayload")(account);
  assert.deepStrictEqual(next.settings.weeklyPlan, CUSTOM_PLAN);
});

test("after a local reset, the boot-time auto-load keeps the account's split", async function () {
  /* "Reset NXTFRM records" removes the apm_* keys but leaves the Supabase
     session, so the reload auto-loads into a factory device. */
  const account = accountFrom(phone());
  const cloud = fakeCloud({ row: account, session: true });
  const B = boot(Object.assign({ "sb-project-auth-token": "{\"access_token\":\"t\"}" }, CLOUD_KEYS), { cloud });
  await flush();
  assert.ok(cloud.db.selects >= 1, "the stored session auto-loads on boot");
  assert.deepStrictEqual(B.settings.weeklyPlan, CUSTOM_PLAN);
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN, "the account is not rewritten with the factory split");
});

test("fresh device: today's queue seeded before the load follows the account's routine", async function () {
  /* Monday is FullA on both copies, so only the routine differs. Today's
     queue is seeded when Today first draws, from the factory list on a fresh
     phone, and session plans are not part of the cloud row. */
  const DATE = "2026-10-12", KEY = DATE + "__Gym A__FullA";
  const A = boot(phone({ settings: { weeklyPlan: FACTORY_SPLIT }, cutSupport: { templates: { "Gym A__FullA": FULLA_CUSTOM } } }), { date: DATE });
  A.run("template()"); // the other device opened today's session
  const cloud = fakeCloud({ row: A.payload() });
  const B = boot(Object.assign({}, CLOUD_KEYS), { date: DATE, cloud });
  await flush();
  assert.notDeepStrictEqual(names(B.run("template()")), names(FULLA_CUSTOM), "before the load the queue is the factory list");
  signIn(B);
  await B.run("loadCloudNow()"); await flush();
  assert.deepStrictEqual(names(B.run("template()")), names(FULLA_CUSTOM), "today's untouched queue is re-seeded from the account's routine");
  assert.deepStrictEqual(names(B.payload().settings.cutSupport.sessionTargets[KEY]), names(FULLA_CUSTOM), "and today's targets with it");
  assert.deepStrictEqual(names(cloud.db.row.settings.cutSupport.sessionTargets[KEY]), names(FULLA_CUSTOM), "the write-back does not put factory targets in the account");
});

test("a started or edited queue for today is never re-seeded by a load", async function () {
  const DATE = "2026-10-12", KEY = DATE + "__Gym A__FullA";
  const account = boot(phone({ settings: { weeklyPlan: FACTORY_SPLIT }, cutSupport: { templates: { "Gym A__FullA": FULLA_CUSTOM } } }), { date: DATE }).payload();
  /* Started: a set was logged in the factory queue on this device. */
  const started = boot({}, { date: DATE });
  const factory = names(started.run("template()"));
  started.run("state.logs.push({id:'b1',date:'" + DATE + "',exercise:" + JSON.stringify(factory[0]) + ",weight:40,reps:10,setNum:1,gym:'Gym A',dayType:'FullA',ts:5})");
  started.run("applyCloudPayload")(account);
  assert.deepStrictEqual(started.state.sessionPlans[KEY], factory, "a workout in progress keeps its queue (D22)");
  /* Edited: today's order was changed on this device. */
  const edited = boot({}, { date: DATE });
  const swapped = names(edited.run("template()")).reverse();
  edited.run("state.sessionPlans[" + JSON.stringify(KEY) + "]=" + JSON.stringify(swapped));
  edited.run("applyCloudPayload")(account);
  assert.deepStrictEqual(edited.state.sessionPlans[KEY], swapped, "a today-only edit is kept");
});

test("fresh device: the account's goal range, cut start, TDEE, cardio target and name survive and are written back", async function () {
  /* Boot fills SETTINGS_DEFAULTS (start 87.1 kg, range 78–80, TDEE 2644, cardio 180,
     which install() turns into 90) before anything loads; these used to win the merge. */
  const MINE = { startWeight: 90, cutStart: "2026-08-03", targetLow: 75, targetHigh: 77, goalLow: 75, goalHigh: 77, tdee: 2480, zone2WeeklyTarget: 120, name: "Ali" };
  const cloud = fakeCloud({ row: accountFrom(phone({ settings: MINE, cutSupport: { targetConfirmed: true } })) });
  const B = boot({}, { cloud });
  assert.strictEqual(B.settings.zone2WeeklyTarget, 90, "a fresh phone holds the migrated factory cardio target");
  B.field("sbUrl", CLOUD_KEYS.apm_sb_url); B.field("sbKey", CLOUD_KEYS.apm_sb_key);
  B.field("sbEmail", USER.email); B.field("sbPass", "pw");
  await B.run("cloudLogin()"); await flush();
  for (const [k, v] of Object.entries(MINE)) assert.strictEqual(B.settings[k], v, k + " comes from the account");
  assert.strictEqual(B.settings.cutSupport.targetConfirmed, true, "with the range's confirmation");
  assert.deepStrictEqual(clone(B.run("[START_WEIGHT,TARGET_LOW,TARGET_HIGH,USER_TDEE,ZONE2_WEEKLY_TARGET]")), [90, 75, 77, 2480, 120], "the globals follow");
  for (const [k, v] of Object.entries(MINE)) assert.strictEqual(cloud.db.row.settings[k], v, k + " is written back");
});

test("a device with its own values keeps them; a confirmed range is a choice even at the factory numbers", function () {
  const account = row({ startWeight: 95, cutStart: "2026-06-01", targetLow: 70, targetHigh: 72, goalLow: 70, goalHigh: 72, tdee: 2300, zone2WeeklyTarget: 200, name: "Account",
    cutSupport: { version: 99, targetConfirmed: true } });
  /* 87.1 kg and 78–80 are the factory numbers, but they were saved with a start date and
     a confirmation; an empty name was chosen ("Leave it empty for no name"). */
  const OWN = { startWeight: 87.1, cutStart: "2026-09-01", targetLow: 78, targetHigh: 80, goalLow: 78, goalHigh: 80, tdee: 2700, zone2WeeklyTarget: 150, name: "" };
  const B = boot(phone({ settings: OWN, cutSupport: { targetConfirmed: true } }));
  B.run("applyCloudPayload")(account);
  for (const [k, v] of Object.entries(OWN)) assert.strictEqual(B.settings[k], v, k + " stays this device's");
  assert.deepStrictEqual(clone(B.run("[START_WEIGHT,TARGET_LOW,TARGET_HIGH,USER_TDEE,ZONE2_WEEKLY_TARGET]")), [87.1, 78, 80, 2700, 150]);
  const C = boot(phone({ settings: Object.assign({}, OWN, { name: "Dan" }), cutSupport: { targetConfirmed: true } }));
  C.run("applyCloudPayload")(account);
  assert.strictEqual(C.settings.name, "Account", "the default greeting name is not a choice");
  assert.strictEqual(C.settings.targetLow, 78, "and the rest of that device's values stay");
});

/* ===========================================================================
   2. Conflict rules: the newer stamp wins; unstamped factory data is unset.
   =========================================================================== */

test("routines: the account's newer routine replaces a stale one on this device", function () {
  const B = boot(phone()); // Gym A__Pull = PULL_A, no stamp (saved before stamping)
  B.run("applyCloudPayload")(row({ cutSupport: { version: 99, templates: { "Gym A__Pull": PULL_B }, templateMeta: { "Gym A__Pull": T_MID } } }));
  assert.deepStrictEqual(B.settings.cutSupport.templates["Gym A__Pull"], PULL_B, "a stamped account routine beats an unstamped local one");
  assert.strictEqual(B.settings.cutSupport.templateMeta["Gym A__Pull"], T_MID, "and keeps its stamp");
  assert.deepStrictEqual(B.settings.cutSupport.templates["Gym A__Push"], PUSH_A, "a routine only this device has survives");
  const C = boot(phone({ cutSupport: { templateMeta: { "Gym A__Pull": T_NEW } } }));
  C.run("applyCloudPayload")(row({ cutSupport: { version: 99, templates: { "Gym A__Pull": PULL_B }, templateMeta: { "Gym A__Pull": T_MID } } }));
  assert.deepStrictEqual(C.settings.cutSupport.templates["Gym A__Pull"], PULL_A, "a newer local routine is kept");
  assert.strictEqual(C.settings.cutSupport.templateMeta["Gym A__Pull"], T_NEW);
});

test("routines: an unstamped factory routine on this device counts as unset", function () {
  const factoryPull = boot({}).run("JSON.parse(JSON.stringify(TEMPLATES.Pull))");
  const B = boot(phone({ cutSupport: { templates: { "Gym A__Pull": factoryPull } } }));
  B.run("applyCloudPayload")(row({ cutSupport: { version: 99, templates: { "Gym A__Pull": PULL_B } } }));
  assert.deepStrictEqual(B.settings.cutSupport.templates["Gym A__Pull"], PULL_B, "the account's own routine wins over the factory list");
  const C = boot(phone()); // both unstamped and both customised
  C.run("applyCloudPayload")(row({ cutSupport: { version: 99, templates: { "Gym A__Pull": PULL_B } } }));
  assert.deepStrictEqual(C.settings.cutSupport.templates["Gym A__Pull"], PULL_A, "two unstamped customised routines: this device's is kept, as before");
});

test("weekly plan: with stamps on both copies the newer wins, either way", function () {
  const B = boot(phone({ settings: { planUpdatedAt: T_OLD } }));
  B.run("applyCloudPayload")(row({ weeklyPlan: OTHER_PLAN, planUpdatedAt: T_MID, cutSupport: { version: 99, previousWeeklyPlan: CUSTOM_PLAN } }));
  assert.deepStrictEqual(B.settings.weeklyPlan, OTHER_PLAN, "the account's newer plan wins");
  assert.strictEqual(B.settings.planUpdatedAt, T_MID);
  assert.deepStrictEqual(B.settings.cutSupport.previousWeeklyPlan, CUSTOM_PLAN, "the previous plan travels with the plan it belongs to");
  const C = boot(phone({ settings: { planUpdatedAt: T_NEW } }));
  C.run("applyCloudPayload")(row({ weeklyPlan: OTHER_PLAN, planUpdatedAt: T_MID }));
  assert.deepStrictEqual(C.settings.weeklyPlan, CUSTOM_PLAN, "this device's newer plan wins");
  assert.strictEqual(C.settings.planUpdatedAt, T_NEW);
  assert.deepStrictEqual(C.settings.cutSupport.previousWeeklyPlan, PREVIOUS_PLAN);
});

test("weekly plan: unstamped on both sides, a factory plan yields and a customised one is kept", function () {
  /* Legacy data, saved before stamping. A plan equal to DEFAULT_WEEKLY_PLAN
     (after the D33 Legs->Pump mapping) or to the A/B/C split install() writes
     on a new device carries nothing of the user's. */
  for (const factory of [FACTORY_SPLIT, { 0: "Rest", 1: "Push", 2: "Pull", 3: "Floorball", 4: "Pump", 5: "Floorball", 6: "Legs" }]) {
    const B = boot(phone({ settings: { weeklyPlan: factory } }));
    B.run("applyCloudPayload")(row({ weeklyPlan: OTHER_PLAN }));
    assert.deepStrictEqual(B.settings.weeklyPlan, OTHER_PLAN, "factory " + JSON.stringify(factory) + " yields to the account");
  }
  const C = boot(phone());
  C.run("applyCloudPayload")(row({ weeklyPlan: OTHER_PLAN }));
  assert.deepStrictEqual(C.settings.weeklyPlan, CUSTOM_PLAN, "two unstamped customised plans: this device's is kept, as before");
  const D = boot(phone({ settings: { weeklyPlan: FACTORY_SPLIT, planUpdatedAt: T_OLD } }));
  D.run("applyCloudPayload")(row({ weeklyPlan: OTHER_PLAN }));
  assert.deepStrictEqual(D.settings.weeklyPlan, FACTORY_SPLIT, "a factory plan the user chose (stamped) is a real choice and wins over an unstamped one");
});

test("dated overrides merge by date; the newer stamp wins, including a cleared day", function () {
  const B = boot(phone({
    settings: { dayOverrides: { "2026-10-20": "Pull", "2026-10-21": "Push", "2026-10-23": "Pull", "2026-10-24": "Push" } },
    cutSupport: { overrideMeta: { "2026-10-21": T_NEW, "2026-10-22": T_NEW, "2026-10-23": T_OLD } }
  }));
  B.run("applyCloudPayload")(row({
    dayOverrides: { "2026-10-20": "Zone2", "2026-10-21": "Rest", "2026-10-22": "Pull", "2026-10-23": "Rest", "2026-10-25": "Pump" },
    cutSupport: { version: 99, overrideMeta: { "2026-10-21": T_MID, "2026-10-22": T_MID, "2026-10-23": T_MID, "2026-10-24": T_MID } }
  }));
  assert.deepStrictEqual(B.settings.dayOverrides, {
    "2026-10-20": "Pull",   // unstamped on both sides: this device's, as before
    "2026-10-21": "Push",   // this device's newer value
    "2026-10-23": "Rest",   // the account's newer value
    "2026-10-25": "Pump"    // only the account had it: union
    // 2026-10-22: cleared on this device after the account set it
    // 2026-10-24: cleared in the account after this device set it (unstamped)
  });
  assert.strictEqual(B.settings.cutSupport.overrideMeta["2026-10-22"], T_NEW, "a cleared day keeps its stamp so the clear survives the next merge");
});

/* ===========================================================================
   3. Records keep their union-by-id semantics.
   =========================================================================== */

test("workouts and weigh-ins still union by id, the later ts winning (unchanged)", function () {
  const B = boot(phone({
    logs: [{ id: "s1", date: "2026-10-06", exercise: "Chin-up", weight: 10, reps: 8, setNum: 1, gym: "Gym A", ts: 5 },
      { id: "s2", date: "2026-10-06", exercise: "Chin-up", weight: 10, reps: 7, setNum: 2, gym: "Gym A", ts: 9 },
      { id: "local", date: "2026-10-07", exercise: "Dips", weight: 0, reps: 10, setNum: 1, gym: "Gym A", ts: 5 }],
    bws: [{ id: "w1", date: "2026-10-12", weight: 84.2, timeOfDay: "Morning", ts: 5 }]
  }));
  B.run("applyCloudPayload")(row({ weeklyPlan: CUSTOM_PLAN }, {
    logs: [{ id: "s1", date: "2026-10-06", exercise: "Chin-up", weight: 12.5, reps: 8, setNum: 1, gym: "Gym A", ts: 7 },
      { id: "s2", date: "2026-10-06", exercise: "Chin-up", weight: 99, reps: 7, setNum: 2, gym: "Gym A", ts: 9 },
      { id: "cloud", date: "2026-10-08", exercise: "Cable Row", weight: 50, reps: 10, setNum: 1, gym: "Gym A", ts: 1 }],
    bws: [{ id: "w1", date: "2026-10-12", weight: 84.0, timeOfDay: "Morning", ts: 4 }, { id: "w2", date: "2026-10-11", weight: 84.6, timeOfDay: "Morning", ts: 1 }]
  }));
  const byId = Object.fromEntries(B.state.logs.map(r => [r.id, r]));
  assert.deepStrictEqual(Object.keys(byId).sort(), ["cloud", "local", "s1", "s2"]);
  assert.strictEqual(byId.s1.weight, 12.5, "the later ts wins");
  assert.strictEqual(byId.s2.weight, 99, "an equal ts keeps the account's row, as before");
  const bw = Object.fromEntries(B.state.bws.map(r => [r.id, r]));
  assert.strictEqual(bw.w1.weight, 84.2, "this device's later weigh-in wins");
  assert.ok(bw.w2, "a weigh-in only the account had arrives");
});

test("waist measurements union by id like the other records", function () {
  const B = boot(phone({ cutSupport: { waist: [{ id: "wa1", date: "2026-10-01", cm: 88, ts: 5 }] } }));
  B.run("applyCloudPayload")(row({ cutSupport: { version: 99, waist: [{ id: "wa1", date: "2026-10-01", cm: 87.5, ts: 9 }, { id: "wa2", date: "2026-09-24", cm: 89, ts: 1 }] } }));
  const byId = Object.fromEntries(B.settings.cutSupport.waist.map(r => [r.id, r]));
  assert.deepStrictEqual(Object.keys(byId).sort(), ["wa1", "wa2"], "a measurement only the account had is kept");
  assert.strictEqual(byId.wa1.cm, 87.5, "the later ts wins");
});

/* ===========================================================================
   4. Edits are stamped where they are saved, and nowhere else.
   =========================================================================== */

test("a plan edit stamps planUpdatedAt and persist() writes it to apm_settings", function () {
  const B = boot(phone(), { ui: true });
  const before = Date.now();
  B.NXP.setDay(3, "Pull"); // Settings › Training: Wednesday becomes Pull
  const stored = B.storage.json("apm_settings");
  assert.strictEqual(stored.weeklyPlan[3], "Pull");
  assert.ok(stored.planUpdatedAt && Date.parse(stored.planUpdatedAt) >= before - 1000, "the edit is stamped in storage");
  assert.deepStrictEqual(stored.cutSupport.previousWeeklyPlan, CUSTOM_PLAN, "setDay still records the plan it replaced");
  assert.strictEqual(stored.cutSupport.previousPlanUpdatedAt, undefined, "the previous plan has no stamp of its own");
  /* D35 day sheet: one date only. */
  B.field("n99-day-every", false);
  B.NXT.setDayType("2026-10-15", "Pump");
  const day = B.storage.json("apm_settings");
  assert.strictEqual(day.dayOverrides["2026-10-15"], "Pump");
  assert.ok(day.cutSupport.overrideMeta && day.cutSupport.overrideMeta["2026-10-15"], "a dated override is stamped");
  assert.strictEqual(day.planUpdatedAt, stored.planUpdatedAt, "a one-day change leaves the plan stamp alone");
  /* D22 routine editor. */
  B.NXP.editRoutine("Pull");
  B.NXP.ui.routine.rows = clone(PULL_B); B.NXP.ui.routine.dirty = true;
  B.NXP.routineSave();
  const saved = B.storage.json("apm_settings");
  assert.deepStrictEqual(saved.cutSupport.templates["Gym A__Pull"], PULL_B);
  assert.ok(saved.cutSupport.templateMeta && saved.cutSupport.templateMeta["Gym A__Pull"], "a saved routine is stamped");
  assert.strictEqual(saved.cutSupport.templateMeta["Gym A__Push"], undefined, "an untouched routine is not");
  /* "Use my previous weekly plan" is a user choice too. */
  B.NXT.restoreWeek(true);
  assert.deepStrictEqual(B.settings.weeklyPlan, CUSTOM_PLAN);
  assert.ok(Date.parse(B.storage.json("apm_settings").planUpdatedAt) >= Date.parse(stored.planUpdatedAt));
});

test("D29: one refused key does not skip the others, and the cloud save is still requested", function () {
  let full = null; // the key the phone refuses, from now on
  const B = boot(phone(), { ui: true, refuse: k => k === full });
  signIn(B);
  full = "apm_settings";
  B.run("state.logs.push({id:'after-full',date:'2026-10-13',exercise:'Chin-up',weight:10,reps:8,setNum:1,gym:'Gym A',ts:7})");
  B.NXP.setDay(3, "Pull");
  assert.strictEqual(B.storage.json("apm_settings").weeklyPlan[3], CUSTOM_PLAN[3], "the refused record is not written");
  assert.ok(B.storage.json("apm_logs").some(r => r.id === "after-full"), "the records after it still are");
  assert.ok(B.timers.some(t => t.ms === 900), "and the cloud save is scheduled anyway");
  full = "apm_evo_scans";
  B.NXP.setDay(5, "Pull");
  assert.strictEqual(B.storage.json("apm_settings").weeklyPlan[5], "Pull", "settings (plan and routines) are written before the large scan record");
});

test("a full phone that is signed in is told the change is on its way, not that it is saved", function () {
  let full = false;
  const B = boot(phone(), { ui: true, refuse: k => full && k === "apm_settings" });
  signIn(B);
  full = true;
  B.NXP.setDay(3, "Pull");
  const said = B.toasts[B.toasts.length - 1] || "";
  assert.ok(!/saved online|saved to/i.test(said), "the cloud save has not happened yet: " + said);
  assert.ok(/full/i.test(said) && /account/i.test(said), "it still says the device is full and the change goes to the account: " + said);
});

test("today's session picker refuses a day with logged sets and stamps an allowed change", function () {
  const B = boot(phone({ logs: [{ id: "t1", date: "2026-10-13", exercise: "Chin-up", weight: 10, reps: 8, setNum: 1, gym: "Gym A", dayType: "Pull", ts: 5 }] }));
  B.NXT.chooseSession("Push");
  assert.strictEqual((B.settings.dayOverrides || {})["2026-10-13"], undefined, "a started day is not re-typed");
  assert.strictEqual(B.toasts[B.toasts.length - 1], "This day already has logged sets.");
  const C = boot(phone());
  C.NXT.chooseSession("Push");
  assert.strictEqual(C.settings.dayOverrides["2026-10-13"], "Push");
  assert.ok(C.settings.cutSupport.overrideMeta && C.settings.cutSupport.overrideMeta["2026-10-13"], "the change is stamped like any override");
});

test("D33 stays idempotent across two boots and a merge, and none of it is stamped", function () {
  const LEGS_A = [{ name: "Hack Squat", sets: 3, reps: [6, 10], inc: 5 }];
  const PUMP_B = [{ name: "Leg Press", sets: 3, reps: [8, 12], inc: 5 }];
  const LEGS_B = [{ name: "Squat", sets: 3, reps: [5, 8], inc: 2.5 }];
  const seed = phone({
    settings: { weeklyPlan: Object.assign({}, CUSTOM_PLAN, { 6: "Legs" }), dayOverrides: { "2026-10-20": "Legs" } },
    cutSupport: { previousWeeklyPlan: Object.assign({}, PREVIOUS_PLAN, { 6: "Legs" }), templates: { "Gym A__Legs": LEGS_A, "Gym B__Pump": PUMP_B, "Gym B__Legs": LEGS_B } },
    sessionPlans: { "2026-10-10__Gym A__Legs": ["Hack Squat"] }
  });
  const one = boot(seed);
  const s1 = one.storage.json("apm_settings");
  assert.strictEqual(s1.weeklyPlan[6], "Pump");
  assert.strictEqual(s1.dayOverrides["2026-10-20"], "Pump");
  assert.strictEqual(s1.cutSupport.previousWeeklyPlan[6], "Pump");
  assert.deepStrictEqual(s1.cutSupport.templates["Gym A__Pump"], LEGS_A, "a Legs routine moves to Pump");
  assert.deepStrictEqual(s1.cutSupport.templates["Gym B__Pump"], PUMP_B, "an existing Pump routine is never overwritten");
  assert.deepStrictEqual(one.storage.json("apm_session_plans")["2026-10-10__Gym A__Pump"], ["Hack Squat"]);
  const two = boot(Object.fromEntries(one.storage.raw));
  assert.strictEqual(two.storage.raw.get("apm_settings"), one.storage.raw.get("apm_settings"), "a second boot changes nothing");
  /* An older device's row still says Legs. */
  two.run("applyCloudPayload")(row({ weeklyPlan: Object.assign({}, OTHER_PLAN, { 6: "Legs" }),
    cutSupport: { version: 99, templates: { "Gym A__Legs": LEGS_B, "Gym C__Legs": LEGS_B } } }));
  const s2 = two.storage.json("apm_settings");
  assert.ok(!Object.values(s2.weeklyPlan).includes("Legs") && !Object.values(s2.dayOverrides).includes("Legs"), "nothing merged in keeps the old type");
  assert.deepStrictEqual(s2.cutSupport.templates["Gym C__Pump"], LEGS_B, "a Legs routine that arrives by merge is moved too");
  assert.deepStrictEqual(s2.cutSupport.templates["Gym A__Pump"], LEGS_A, "the merge does not let an old Legs routine replace Pump");
  assert.strictEqual(s2.planUpdatedAt, undefined, "a migration or a merge is not an edit");
  assert.strictEqual(s2.cutSupport.overrideMeta, undefined);
  assert.strictEqual(s2.cutSupport.templateMeta, undefined);
  two.run("NXT.install(false)");
  assert.strictEqual(two.storage.raw.get("apm_settings"), JSON.stringify(two.settings), "install after the merge is a no-op");
  assert.strictEqual(JSON.stringify(two.storage.json("apm_settings")), JSON.stringify(s2), "and stores the same record");
});

/* ===========================================================================
   5. Read before write: nothing replaces the account before it has been read.
   =========================================================================== */

test("an autosave that fires before the first load cannot replace the account", async function () {
  /* The page's own initCloudFromStorage() can set cloudUser before
     cut-support's auto-load has read the row; any persist() then schedules a
     whole-row save of what this device holds. */
  const account = accountFrom(phone());
  const cloud = fakeCloud({ row: account });
  const B = boot(Object.assign({}, CLOUD_KEYS), { cloud });
  await flush();
  signIn(B);
  B.run("persist()");
  await B.runTimers();
  await B.run("loadCloudNow()"); await flush();
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN, "the account's split survives");
  assert.deepStrictEqual(cloud.db.row.logs.map(r => r.id), ["log-a1"], "and so do its workouts");
  assert.ok(cloud.db.upserts.every(p => (p.logs || []).some(r => r.id === "log-a1")), "no save ever sent a copy without the account's workouts");
});

test("after a failed load, Retry reads the account before it writes", async function () {
  const account = accountFrom(phone());
  const cloud = fakeCloud({ row: account, failSelects: 2 });
  const B = boot({}, { cloud });
  B.field("sbUrl", CLOUD_KEYS.apm_sb_url); B.field("sbKey", CLOUD_KEYS.apm_sb_key);
  B.field("sbEmail", USER.email); B.field("sbPass", "pw");
  await B.run("cloudLogin()"); await flush(); // the load fails
  await B.run("saveCloudNow(true)"); await flush(); // Retry: the read fails again
  assert.strictEqual(cloud.db.upserts.length, 0, "nothing is written while the account cannot be read");
  await B.run("saveCloudNow(true)"); await flush(); // Retry once the network is back
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN);
  assert.deepStrictEqual(cloud.db.row.logs.map(r => r.id), ["log-a1"]);
  assert.deepStrictEqual(B.settings.weeklyPlan, CUSTOM_PLAN, "the device now runs the account's split");
});

test("a sign-in that lands while the boot load is in flight neither hangs nor writes blind", async function () {
  /* cloudLogin() swaps cloudUser for a new object and asks for a load while the
     auto-load is still reading. The two must not wait on each other. */
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true });
  let release;
  cloud.db.gate = new Promise(r => { release = r; });
  const B = boot(Object.assign({ "sb-project-auth-token": "{\"access_token\":\"t\"}" }, CLOUD_KEYS), { cloud });
  await flush();
  assert.strictEqual(cloud.db.selects, 1, "the boot load is reading");
  signIn(B);
  let settled = 0;
  B.run("loadCloudNow()").then(() => { settled += 1; });
  B.run("saveCloudNow(false)").then(() => { settled += 1; });
  release(); cloud.db.gate = null;
  await flush(); await flush();
  assert.strictEqual(settled, 2, "the load and the save both finish");
  assert.ok(cloud.db.upserts.length >= 1, "the new sign-in's save went through after its own read");
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN);
  assert.ok(cloud.db.upserts.every(p => (p.logs || []).some(r => r.id === "log-a1")), "nothing was written without the account's workouts");
});

test("sign-up still writes the first copy of a new account", async function () {
  const cloud = fakeCloud({});
  const B = boot(phone(), { cloud });
  B.field("sbUrl", CLOUD_KEYS.apm_sb_url); B.field("sbKey", CLOUD_KEYS.apm_sb_key);
  B.field("sbEmail", USER.email); B.field("sbPass", "pw");
  await B.run("cloudSignup()"); await flush();
  assert.ok(cloud.db.row, "the row is created");
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN);
  assert.deepStrictEqual(cloud.db.row.logs.map(r => r.id), ["log-a1"]);
});

/* ===========================================================================
   6. A full phone cannot stop the Safe Sync merge from installing.
   =========================================================================== */

test("cut-support installs its merge and cloud overrides even when persist() throws at boot", async function () {
  /* persist() rethrows its first refused write (D29). install() calls it at
     load; an exception there used to end cut-support.js before the Safe Sync
     merge, leaving index.html's original applyCloudPayload, which replaces
     local records with the cloud's, and its original saveCloudNow. */
  const cloud = fakeCloud({ row: row({ weeklyPlan: OTHER_PLAN }, { logs: [{ id: "cloud-only", date: "2026-10-08", exercise: "Cable Row", weight: 50, reps: 10, setNum: 1, gym: "Gym A", ts: 1 }] }) });
  const B = boot(phone({ extra: CLOUD_KEYS }), { cloud, refuse: () => true });
  await flush();
  assert.ok(B.errors.length >= 1, "the refused write is reported on the console");
  B.NXT.old.applyCloudPayload(row({}, { logs: [{ id: "merged-in", date: "2026-10-09", exercise: "Dips", weight: 0, reps: 10, setNum: 1, gym: "Gym A", ts: 1 }] }));
  assert.deepStrictEqual(B.state.logs.map(r => r.id).sort(), ["log-a1", "merged-in"], "records are merged, not replaced");
  signIn(B);
  await B.run("saveCloudNow(false)"); await flush();
  assert.strictEqual(cloud.db.selects, 1, "the Safe Sync save reads the account before it writes");
  /* No safety copy fits on this phone, so the load could not merge; the change
     still reaches the account (D29), as it did before. */
  assert.strictEqual(cloud.db.upserts.length, 1);
  assert.ok(cloud.db.row.logs.some(r => r.id === "merged-in"));
});

/* ===========================================================================
   7. Add-on lifts travel with the account and the backup.
   =========================================================================== */

test("add-on lists reach the account, return on a fresh device, reset and restore", async function () {
  const ADD = { "2026-10-13__Gym A__Zone2": ["Lat Pulldown"] };
  const A = boot(phone({ addOns: ADD }));
  const account = A.payload();
  assert.deepStrictEqual(account.addOns, ADD, "the cloud payload carries add-ons");
  const B = boot({});
  B.run("applyCloudPayload")(account);
  assert.deepStrictEqual(B.state.addOns, ADD, "a fresh device gets them back");
  const backup = clone(A.run("getFullBackup()"));
  const C = boot({});
  C.NXT.restoreData(backup);
  assert.deepStrictEqual(C.state.addOns, ADD, "a backup restores them");
  delete backup.localStorageDump.apm_addons;
  const D = boot(phone({ addOns: ADD }));
  D.NXT.restoreData(backup);
  assert.deepStrictEqual(D.state.addOns, {}, "a backup without them restores cleanly");
  A.NXT.resetData();
  assert.strictEqual(A.storage.getItem("apm_addons"), null, "reset clears them with the other records");
});

/* ===========================================================================
   8. supabase-js arrives after the page, or not at all.
   It used to be a parser-blocking CDN tag, so one stalled request stopped the
   whole app booting. loadSupabase() now fetches it after parse: the page does
   not wait for it, the session restore does. boot(..., {library: "absent"})
   starts a page with no window.supabase; arrive()/fail() play the outcome of
   the script tag the page inserted.
   =========================================================================== */
const LIBRARY_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const STORED_SESSION = { "sb-project-auth-token": "{\"access_token\":\"t\"}" };

test("supabase-js is no longer a tag: the pinned URL appears once, inside loadSupabase(), and both restores wait for it", function () {
  assert.strictEqual(/<script[^>]+supabase-js/i.test(HTML), false, "a parser-blocking tag stops the app booting when the CDN stalls");
  assert.strictEqual(HTML.split(LIBRARY_URL).length - 1, 1, "the URL is named once");
  assert.ok(fnSource("loadSupabase").indexOf(LIBRARY_URL) !== -1, "and it is in loadSupabase()");
  assert.ok(/if\(!window\.supabase\)await loadSupabase\(\);\s*const client=initSupabaseClient\(\)/.test(fnSource("initCloudFromStorage")), "the page's own restore waits for a library that has not landed");
  assert.ok(/if\(typeof loadSupabase==='function'&&!window\.supabase\)await loadSupabase\(\);\s*const client=initSupabaseClient\(\);/.test(CUT), "so does cut-support's");
});

test("a present library (the normal path) inserts no tag and restores the session as before", async function () {
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud });
  await flush();
  assert.strictEqual(B.scripts.length, 0, "nothing to fetch when the library is already there");
  assert.ok(cloud.db.selects >= 1, "the stored session auto-loads");
  assert.strictEqual(clone(B.run("cloudUser")).id, USER.id);
  assert.strictEqual(B.errors.length, 0);
});

test("late library: the page boots with no cloud call, then the stored session is restored and the boot auto-load runs", async function () {
  const account = accountFrom(phone());
  const cloud = fakeCloud({ row: account, session: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud, library: "absent" });
  await flush();
  assert.strictEqual(B.errors.length, 0, "no error while the library is on its way");
  assert.strictEqual(B.scripts.length, 1, "one script was inserted");
  assert.strictEqual(B.scripts[0].src, LIBRARY_URL, "from the pinned URL");
  assert.strictEqual(B.scripts[0].async, true, "without blocking anything");
  assert.strictEqual(cloud.db.selects, 0, "the account has not been touched");
  assert.strictEqual(B.run("cloudUser"), null);
  assert.strictEqual(B.run("cloudSessionChecked"), false, "the session is not known yet, so nothing flashes");
  assert.ok(B.storage.raw.has("sb-project-auth-token"), "the stored session is untouched");
  assert.deepStrictEqual(B.settings.weeklyPlan, FACTORY_SPLIT, "this fresh device still runs its own plan, as it must before the read");
  B.arrive(cloud.client);
  await flush();
  assert.strictEqual(clone(B.run("cloudUser")).id, USER.id, "the session is restored once it lands");
  assert.strictEqual(B.run("cloudSessionChecked"), true);
  assert.ok(cloud.db.selects >= 1, "and the boot auto-load reads the account");
  assert.deepStrictEqual(B.settings.weeklyPlan, CUSTOM_PLAN, "D29 / Safe Sync: the merge keeps the account's split");
  assert.deepStrictEqual(cloud.db.row.settings.weeklyPlan, CUSTOM_PLAN, "read before write: the account is not rewritten with the factory split");
  assert.ok(cloud.db.upserts.every(p => (p.logs || []).some(r => r.id === "log-a1")), "no save ever went out without the account's workouts");
  assert.strictEqual(B.errors.length, 0);
});

test("late library: sign-in, save and load work once it has landed", async function () {
  const account = accountFrom(phone());
  const cloud = fakeCloud({ row: account });
  const B = boot({}, { cloud, library: "absent" });
  await flush();
  B.arrive(cloud.client);
  await flush();
  B.field("sbUrl", CLOUD_KEYS.apm_sb_url); B.field("sbKey", CLOUD_KEYS.apm_sb_key);
  B.field("sbEmail", USER.email); B.field("sbPass", "pw");
  await B.run("cloudLogin()"); await flush();
  assert.strictEqual(clone(B.run("cloudUser")).id, USER.id, "sign-in works");
  assert.deepStrictEqual(B.settings.weeklyPlan, CUSTOM_PLAN, "and loads the account");
  await B.run("saveCloudNow(true)"); await flush();
  assert.ok(cloud.db.upserts.length >= 1, "save works");
  await B.run("cloudSignup()"); await flush();
  assert.strictEqual(clone(B.run("cloudUser")).id, USER.id, "sign-up works");
});

test("blocked library: the stored session is kept, nothing is written, and the cloud actions answer honestly", async function () {
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud, library: "absent" });
  await flush();
  B.fail();
  await flush();
  assert.ok(B.storage.raw.has("sb-project-auth-token"), "a library that could not load says nothing about the account: the session stays for the next launch");
  assert.strictEqual(B.run("cloudUser"), null);
  assert.strictEqual(B.run("cloudSessionChecked"), true);
  assert.strictEqual(B.run("cloudStatusText"), "Not connected");
  assert.strictEqual(cloud.db.selects, 0, "the account is not read");
  assert.strictEqual(cloud.db.upserts.length, 0, "and nothing is written to it");
  assert.strictEqual(B.errors.length, 0);
  /* The failed attempt is forgotten. The boot restore's own initSupabaseClient() call already
     started one background retry, so a tap finds that request in flight and waits for its
     outcome (the earlier simulation never fired that outcome, which is what left the runner
     hanging). */
  assert.strictEqual(B.scripts.length, 2, "the restore started one background retry after the failure");
  const save = B.run("saveCloudNow(true)");
  await flush();
  assert.ok(B.toasts.indexOf("Connecting to the cloud…") !== -1, "the tap says what it is doing");
  B.run("initSupabaseClient()");
  assert.strictEqual(B.scripts.length, 2, "while one is in flight, nobody starts a second");
  B.fail();
  await save;
  assert.ok(B.toasts.indexOf("Cloud library unavailable. Check your connection and try again.") !== -1, "an honest answer, not an error");
  assert.ok(!B.toasts.some(t => /Saved/.test(t)), "no success is reported");
  assert.ok(!B.toasts.some(t => /Cannot read properties/.test(t)) && B.errors.length === 0, "no raw null-client error");
  assert.strictEqual(cloud.db.upserts.length, 0);
  B.run("initSupabaseClient()");
  assert.strictEqual(B.scripts.length, 3, "the next ask tries again");
  B.arrive(cloud.client);
  assert.ok(B.run("initSupabaseClient()"), "once it lands there is a client");
});

/* ---- The cloud-library gate (separate repair): loading, failed, stalled, retry, repeated taps ---- */
test("gate: a tap while the library is loading waits for the one request, extra taps do not stack, one client", async function () {
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud, library: "absent" });
  await flush();
  assert.strictEqual(B.scripts.length, 1, "the boot restore started the one request");
  const first = B.run("saveCloudNow(true)"); await flush();
  assert.ok(B.toasts.indexOf("Connecting to the cloud…") !== -1, "the first tap says it is waiting");
  const second = B.run("saveCloudNow(true)"); await flush();
  assert.ok(B.toasts.indexOf("Still connecting to the cloud…") !== -1, "a second tap is told to wait, nothing stacks");
  assert.strictEqual(B.scripts.length, 1, "still one library request");
  B.arrive(cloud.client);
  await first; await second; await flush();
  assert.strictEqual(clone(B.run("cloudUser")).id, USER.id, "the stored session was restored when the library landed");
  assert.ok(cloud.db.selects >= 1, "the account was read before anything was written");
  assert.ok(B.run("initSupabaseClient()===initSupabaseClient()"), "one client, reused");
  assert.strictEqual(B.errors.length, 0);
});

test("gate: a stalled request answers within the wait limit, the background load still recovers, then a save succeeds", async function () {
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud, library: "absent" });
  await flush();
  const save = B.run("saveCloudNow(true)"); await flush();
  assert.ok(B.timers.some(t => t.ms === 8000), "the wait is bounded by an 8 s timer");
  await B.runTimers(); // nothing arrives: the limit fires
  await save;
  assert.ok(B.toasts.indexOf("The cloud library is still loading. Try again shortly.") !== -1);
  assert.strictEqual(cloud.db.upserts.length, 0, "nothing written, nothing claimed");
  assert.ok(!B.toasts.some(t => /Saved/.test(t)));
  assert.strictEqual(B.errors.length, 0);
  B.arrive(cloud.client); await flush();
  assert.strictEqual(clone(B.run("cloudUser")).id, USER.id, "the late arrival restored the session in the background");
  await B.run("saveCloudNow(true)"); await flush();
  assert.ok(cloud.db.upserts.length >= 1, "the next tap saves");
  assert.ok(B.toasts.indexOf("Saved to Supabase") !== -1, "and reports it only now");
});

test("gate: sign-in and sign-up answer an unavailable library honestly, keep no half state, and work on retry", async function () {
  for (const action of ["cloudLogin", "cloudSignup"]) {
    const cloud = fakeCloud({ row: accountFrom(phone()) });
    const B = boot({}, { cloud, library: "absent" });
    await flush();
    B.field("sbUrl", CLOUD_KEYS.apm_sb_url); B.field("sbKey", CLOUD_KEYS.apm_sb_key); B.field("sbEmail", USER.email); B.field("sbPass", "pw");
    const attempt = B.run(action + "()"); await flush();
    B.fail(); await attempt; await flush();
    assert.ok(B.toasts.indexOf("Cloud library unavailable. Check your connection and try again.") !== -1, action + ": honest answer");
    assert.ok(!B.toasts.some(t => /Cannot read properties|null/.test(t)), action + ": no raw null-client error");
    assert.strictEqual(B.run("cloudUser"), null, action + ": no half-signed-in state");
    assert.strictEqual(cloud.db.upserts.length, 0, action + ": nothing written");
    const retry = B.run(action + "()"); await flush();
    assert.strictEqual(B.scripts.length, 2, action + ": the retry started a new request");
    B.arrive(cloud.client); await retry; await flush();
    assert.strictEqual(clone(B.run("cloudUser")).id, USER.id, action + ": works once the library lands");
    if (action === "cloudLogin") assert.ok(cloud.db.selects >= 1 && B.settings.weeklyPlan && clone(B.run("settings")).weeklyPlan[1] === CUSTOM_PLAN[1], "sign-in read the account before writing");
    assert.ok(cloud.db.upserts.length >= 1, action + ": then wrote");
    assert.strictEqual(B.errors.length, 0, action);
  }
});

test("gate: Load answers unavailable / still loading without touching the account", async function () {
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud, library: "absent" });
  await flush();
  const load = B.run("loadCloudNow()"); await flush();
  B.fail(); assert.strictEqual(await load, "offline");
  assert.ok(B.toasts.indexOf("Cloud library unavailable. Check your connection and try again.") !== -1);
  assert.strictEqual(cloud.db.selects, 0);
  assert.strictEqual(cloud.db.upserts.length, 0);
  assert.ok(B.storage.raw.has("sb-project-auth-token"), "the stored session is kept");
  assert.strictEqual(B.errors.length, 0);
});

test("gate: Test connection reports the library state in its panel and never reaches the network without it", async function () {
  for (const outcome of ["fails", "stalls"]) {
    const B = boot(Object.assign({}, CLOUD_KEYS), { cloud: fakeCloud({}), library: "absent", ui: true });
    B.field("nxp-connection-result", "");
    await flush();
    const run = B.run("NXP.testConnection()"); await flush();
    if (outcome === "fails") B.fail(); else await B.runTimers();
    await run; await flush();
    const html = B.elements["nxp-connection-result"].innerHTML;
    assert.ok(/Cloud library unavailable|still loading/.test(html), outcome + ": " + html.slice(0, 160));
    assert.ok(!/Supabase library loaded/.test(html), outcome + ": no network step ran");
    assert.strictEqual(B.errors.length, 0, outcome);
  }
});

test("a save that the account refuses is reported as a failure, never as saved", async function () {
  const cloud = fakeCloud({ row: accountFrom(phone()), session: true, failUpserts: true });
  const B = boot(Object.assign({}, STORED_SESSION, CLOUD_KEYS), { cloud });
  await flush(); // boot restore: read, merge, write-back (refused)
  await B.run("saveCloudNow(true)"); await flush();
  assert.ok(cloud.db.refused >= 1, "the write was attempted");
  assert.ok(!B.toasts.some(t => /Saved to Supabase/.test(t)), "no success reported");
  assert.ok(B.toasts.some(t => /row-level security|Cloud save failed/.test(t)), "the refusal is surfaced");
  assert.strictEqual(B.run("cloudStatusText"), "Sync error");
});

test("a device with no project URL or key still clears a stale stored session, with the library or without it", async function () {
  for (const library of ["present", "absent-fails", "absent-lands"]) {
    const cloud = fakeCloud({ session: true });
    const B = boot(Object.assign({}, STORED_SESSION), { cloud, library: library === "present" ? undefined : "absent" });
    await flush();
    if (library === "absent-fails") B.fail();
    if (library === "absent-lands") B.arrive(cloud.client);
    await flush();
    assert.strictEqual(B.storage.raw.has("sb-project-auth-token"), false, library + ": a session nothing can use is cleared, as before");
    assert.strictEqual(B.errors.length, 0, library);
  }
});

test("loadSupabase(): one load is shared, a failure is forgotten, and it never rejects", async function () {
  const B = boot({}, { library: "absent" });
  await flush();
  const first = B.run("loadSupabase()"), second = B.run("loadSupabase()");
  assert.strictEqual(B.scripts.length, 1, "callers share one script");
  B.fail();
  assert.strictEqual(await first, false);
  assert.strictEqual(await second, false);
  const third = B.run("loadSupabase()");
  assert.strictEqual(B.scripts.length, 2, "after a failure the next call tries again");
  B.arrive({});
  assert.strictEqual(await third, true);
  assert.strictEqual(await B.run("loadSupabase()"), true, "and once it is there it resolves at once");
  assert.strictEqual(B.scripts.length, 2);
  /* A page that cannot even insert the tag resolves false rather than throwing, and is not stuck. */
  const sandbox = { document: { createElement() { return makeElement(); }, addEventListener() {}, readyState: "complete" } };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fnSource("loadSupabase"), ctx);
  assert.strictEqual(await vm.runInContext("loadSupabase()", ctx), false);
  assert.strictEqual(await vm.runInContext("loadSupabase()", ctx), false, "a synchronous failure is not remembered either");
});

test("a script that loads without defining window.supabase (an error page served as 200) is a failure, not a success", async function () {
  const B = boot({}, { library: "absent" });
  await flush();
  const first = B.run("loadSupabase()");
  B.scripts[0].onload();                       // fired, but nothing was defined
  assert.strictEqual(await first, false);
  B.run("loadSupabase()");
  assert.strictEqual(B.scripts.length, 2, "and the next call tries again");
});

test("the page's own restore (index.html's initCloudFromStorage) waits for the library too, and renders once the session is known", async function () {
  const scripts = [], calls = [];
  let renders = 0;
  const sandbox = {
    document: { head: { appendChild(el) { scripts.push(el); } }, createElement() { return makeElement(); }, addEventListener() {}, readyState: "complete" },
    localStorage: makeStorage(CLOUD_KEYS), render() { renders += 1; }
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext("let sbClient=null,cloudUser=null,cloudStatusText='Not connected';\n"
    + [fnSource("loadSupabase"), fnSource("initSupabaseClient"), fnSource("initCloudFromStorage")].join("\n"), ctx);
  const restore = vm.runInContext("initCloudFromStorage()", ctx);
  await flush();
  assert.strictEqual(scripts.length, 1);
  assert.strictEqual(calls.length, 0, "no client is built before the library lands");
  sandbox.supabase = { createClient(url, key) { calls.push(["createClient", url, key]); return { auth: { async getSession() { calls.push(["getSession"]); return { data: { session: { user: USER } } }; } } }; } };
  scripts[0].onload();
  await restore;
  assert.deepStrictEqual(calls.map(c => c[0]), ["createClient", "getSession"]);
  assert.strictEqual(vm.runInContext("cloudUser.id", ctx), USER.id);
  assert.strictEqual(renders, 1);
  /* And when the library never lands the same function ends quietly. */
  const dead = [];
  const sb2 = { document: { head: { appendChild(el) { dead.push(el); } }, createElement() { return makeElement(); }, addEventListener() {}, readyState: "complete" }, localStorage: makeStorage(CLOUD_KEYS), render() { renders += 1; } };
  sb2.window = sb2;
  const ctx2 = vm.createContext(sb2);
  vm.runInContext("let sbClient=null,cloudUser=null,cloudStatusText='Not connected';\n"
    + [fnSource("loadSupabase"), fnSource("initSupabaseClient"), fnSource("initCloudFromStorage")].join("\n"), ctx2);
  const quiet = vm.runInContext("initCloudFromStorage()", ctx2);
  dead[0].onerror();
  await quiet;
  assert.strictEqual(vm.runInContext("cloudUser", ctx2), null);
  assert.strictEqual(renders, 1, "no render for a session that was never found");
});

/* ---- Runner -------------------------------------------------------------- */
/* An async test that awaits a promise nothing will ever settle leaves Node with an
   empty event loop: the process exits 0 before this runner prints its summary and
   the remaining tests never run (seen on Node v26.8.2: 29 of 34 printed, exit 0).
   Two guards make that explicit. Each test races a host timer (the sandbox's fake
   setTimeout never reaches here), so a hung await is a FAIL with the test's name.
   And if the loop drains before the summary, beforeExit reports the run as
   INCOMPLETE and exits 1 instead of looking green. Both only change what is
   reported; no test is skipped and no assertion is weakened. */
const HOST_SET_TIMEOUT = setTimeout, HOST_CLEAR_TIMEOUT = clearTimeout, TEST_TIMEOUT_MS = 20000;
let summaryPrinted = false, started = 0, finished = 0;
process.on("beforeExit", function () {
  if (summaryPrinted) return;
  summaryPrinted = true;
  const current = tests[started - 1] ? tests[started - 1].name : "(none)";
  console.log("INCOMPLETE  the event loop drained while test " + started + " of " + tests.length + " was still awaiting: " + current);
  console.log("FAILED  " + finished + " of " + tests.length + " tests finished (summary never reached)");
  process.exitCode = 1;
});
function withTimeout(promise, name) {
  let timer;
  const guard = new Promise((_, reject) => { timer = HOST_SET_TIMEOUT(() => reject(new Error("did not complete within " + (TEST_TIMEOUT_MS / 1000) + " s: an await never settled")), TEST_TIMEOUT_MS); });
  return Promise.race([promise, guard]).finally(() => HOST_CLEAR_TIMEOUT(timer));
}
(async function () {
  /* Learn the page's other global names once, with no cloud attached, so no
     test boot has to retry while a fake account is listening. */
  boot({}, { ui: true });
  let passed = 0, failed = 0;
  for (const t of tests) {
    started += 1;
    try {
      await withTimeout(Promise.resolve().then(() => t.fn()), t.name);
      passed += 1;
      console.log("PASS  " + t.name);
    } catch (err) {
      failed += 1;
      console.log("FAIL  " + t.name);
      const lines = String(err && err.message || err).split("\n").filter(l => l.trim()).slice(0, 12);
      const at = String(err && err.stack || "").split("\n").find(l => /^\s+at /.test(l));
      console.log("      " + lines.concat(at ? [at.trim()] : []).join("\n      "));
    }
    finished += 1;
  }
  summaryPrinted = true;
  console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed, " + tests.length + " registered");
  process.exitCode = failed ? 1 : 0;
})();
