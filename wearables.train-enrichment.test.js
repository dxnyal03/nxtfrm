/* NXTFRM Train enrichment contract. Run: node wearables.train-enrichment.test.js

   Covers the exercise library, the anatomy adapter, and the source-level
   invariants that keep optional add-ons from touching day classification.

   The library and anatomy modules are pure data + pure string building, so they
   execute directly here. The Train wiring lives inside premium-ui.js, which
   needs a browser; those parts are asserted against the source with the same
   discipline the release gate uses. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = __dirname;
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log("PASS  " + name); }
  catch (err) { failed += 1; console.log("FAIL  " + name); console.log("      " + (err && err.stack ? err.stack : err)); }
}

const { NXTANAT, NXTLIB } = require("./train-anatomy.js");
const ui = fs.readFileSync(path.join(ROOT, "premium-ui.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const anat = fs.readFileSync(path.join(ROOT, "train-anatomy.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "premium-ui.css"), "utf8");

/* ===================== EXERCISE LIBRARY ===================== */

test("library: names are unique and non-empty", function () {
  const names = NXTLIB.names();
  assert.ok(names.length >= 100, "the researched set is present, got " + names.length);
  assert.strictEqual(new Set(names).size, names.length, "duplicate exercise name");
  for (const n of names) assert.ok(n.trim().length, "empty name");
});

test("library: every exercise has at least one primary muscle", function () {
  for (const n of NXTLIB.names()) {
    assert.ok(NXTLIB.get(n).primaryMuscles.length > 0, n + " has no primary muscle");
  }
});

test("library: every muscle id is in the canonical taxonomy", function () {
  for (const n of NXTLIB.names()) {
    const e = NXTLIB.get(n);
    for (const id of e.primaryMuscles.concat(e.secondaryMuscles)) {
      assert.ok(NXTANAT.valid(id), n + " references unknown muscle " + id);
    }
    // A muscle cannot be both the prime mover and a synergist for one exercise.
    for (const id of e.secondaryMuscles) {
      assert.strictEqual(e.primaryMuscles.indexOf(id), -1, n + " lists " + id + " twice");
    }
  }
});

test("library: equipment is from the controlled list", function () {
  for (const n of NXTLIB.names()) {
    assert.ok(NXTLIB.EQUIPMENT.indexOf(NXTLIB.get(n).equipment) !== -1,
      n + " has unknown equipment " + NXTLIB.get(n).equipment);
  }
});

test("library: shipped exercise names are present with their exact spelling", function () {
  /* These are storage keys. History, session targets and notes are all keyed on
     them, so "Tricep Pushdown" must not quietly become "Triceps Pushdown". */
  for (const n of ["Incline Dumbbell Press", "Smith Machine Bench Press", "Machine Shoulder Press",
                   "Cable Lateral Raise", "Tricep Pushdown", "Lat Pulldown", "Leg Press",
                   "Leg Extension", "Standing Calf Raise", "Ab Crunch", "Romanian Deadlift",
                   "Chest Supported T-Bar Row", "Hamstring Curl", "Reverse Fly",
                   "DB Preacher Curl", "Unilateral Seated Row"]) {
    assert.ok(NXTLIB.has(n), "shipped name missing from library: " + n);
  }
});

test("library: an unknown exercise yields no muscles rather than a guess", function () {
  const m = NXTLIB.musclesFor("Totally Made Up Movement");
  assert.deepStrictEqual(m.primary, []);
  assert.deepStrictEqual(m.secondary, []);
  assert.strictEqual(NXTLIB.equipmentFor("Totally Made Up Movement"), "");
});

test("library: the preset programme is untouched by the library", function () {
  /* The curated split is a product decision. The library is a lookup and must
     never have been merged into it. */
  const tpl = html.slice(html.indexOf("const TEMPLATES={"), html.indexOf("const TEMPLATES={") + 2600);
  for (const n of ["Bayesian Cable Curl", "Nordic Curl", "Pallof Press", "Hack Squat"]) {
    assert.strictEqual(tpl.indexOf(n), -1, "a library-only exercise leaked into TEMPLATES: " + n);
  }
  assert.ok(tpl.indexOf("Incline Dumbbell Press") !== -1, "the preset still holds its own exercises");
});

/* ===================== ANATOMY ===================== */

test("anatomy: all 19 canonical ids resolve to source art", function () {
  const ids = NXTANAT.ids();
  assert.strictEqual(ids.length, 19);
  for (const id of ids) {
    const m = NXTANAT.SLUG[id];
    assert.ok(m, id + " has no source mapping");
    assert.ok(NXTANAT.boxFor(id, m.side), id + " has no measured bounds");
  }
});

test("anatomy: the three split regions are distinct, not aliases", function () {
  /* If a split resolved to the same box as its partner, a pulldown would light
     the whole back and the split would be decorative. */
  const pairs = [["upper_chest", "chest", "front"], ["front_delts", "side_delts", "front"],
                 ["lats", "upper_back", "back"]];
  for (const [a, b, side] of pairs) {
    const ba = NXTANAT.boxFor(a, side), bb = NXTANAT.boxFor(b, side);
    assert.notDeepStrictEqual(ba, bb, a + " and " + b + " resolve to the same region");
  }
});

test("anatomy: a crop contains the muscles it was asked to frame", function () {
  for (const [ids, side] of [[["upper_chest"], "front"], [["lats"], "back"],
                             [["side_delts"], "front"], [["hamstrings", "glutes"], "back"],
                             [["quads"], "front"], [["calves"], "front"]]) {
    const [cx, cy, cw, ch] = NXTANAT.cropFor(ids, side);
    for (const id of ids) {
      const [bx, by, bw, bh] = NXTANAT.boxFor(id, side);
      assert.ok(bx >= cx - 1 && by >= cy - 1 && bx + bw <= cx + cw + 1 && by + bh <= cy + ch + 1,
        id + " falls outside its own crop");
    }
  }
});

test("anatomy: two figures on one page cannot collide", function () {
  const a = NXTANAT.figure({ primary: ["lats"], secondary: ["biceps"] });
  const b = NXTANAT.figure({ primary: ["quads"], secondary: ["glutes"] });
  const idsA = [...a.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const idsB = [...b.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(idsA.length, "the figure defines gradients");
  assert.strictEqual(idsA.filter(x => idsB.indexOf(x) !== -1).length, 0, "duplicate SVG id across figures");
});

test("anatomy: primary and secondary render differently", function () {
  /* Both must be on the same view: a front-view secondary is deliberately
     skipped on a back-view figure rather than drawn on the wrong side. */
  const svg = NXTANAT.figure({ primary: ["lats"], secondary: ["triceps"] });
  assert.ok(/class="nxa-hi is-primary" data-m="lats"/.test(svg));
  assert.ok(/class="nxa-hi is-secondary" data-m="triceps"/.test(svg));
  // And the cross-view case is genuinely skipped, not mis-drawn.
  const cross = NXTANAT.figure({ primary: ["lats"], secondary: ["biceps"] });
  assert.strictEqual(/data-m="biceps"/.test(cross), false,
    "a front muscle must not be painted onto the back figure");
  assert.notStrictEqual(svg.indexOf("-p)"), -1, "primary uses the primary gradient");
  assert.notStrictEqual(svg.indexOf("-s)"), -1, "secondary uses the secondary gradient");
});

test("anatomy: the graphic is decorative and not focusable", function () {
  const svg = NXTANAT.figure({ primary: ["chest"], secondary: [] });
  assert.ok(svg.indexOf('aria-hidden="true"') !== -1);
  assert.ok(svg.indexOf('focusable="false"') !== -1);
  assert.strictEqual(/tabindex/.test(svg), false, "no muscle path may take focus");
});

test("anatomy: no runtime measurement and no network", function () {
  const code = anat.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.strictEqual(/getBBox\s*\(/.test(code), false, "bounds are baked, not measured at runtime");
  assert.strictEqual(/fetch\s*\(|XMLHttpRequest|import\s*\(/.test(code), false, "no runtime network");
  assert.ok(anat.indexOf("MIT License") !== -1, "the upstream licence notice is retained");
  assert.ok(anat.indexOf("ELABBASSI Hicham") !== -1, "the upstream copyright is retained");
});

/* ===================== TRAIN WIRING ===================== */

test("train: muscle text and anatomy come from the library, together", function () {
  assert.ok(ui.indexOf("NXTLIB.musclesFor(ex)") !== -1);
  assert.ok(ui.indexOf("nxp-ex-muscles") !== -1, "muscles are named in text");
  assert.ok(ui.indexOf("anatomyStrip(ex)") !== -1, "the crop is rendered from the same exercise");
  /* Both read the same `ex`, so a Prev/Next change cannot update one and not
     the other. */
  const head = ui.slice(ui.indexOf('<section class="nxp-ex-head">'), ui.indexOf("nxp-ex-actions"));
  assert.ok(head.indexOf("muscleLine(ex)") !== -1 && head.indexOf("anatomyStrip(ex)") !== -1);
});

test("train: the title and the anatomy open the existing detail sheet", function () {
  assert.ok(ui.indexOf('class="nxp-ex-title" onclick="NXP.exerciseDetails()"') !== -1);
  assert.ok(ui.indexOf('class="nxp-ex-anat" onclick="NXP.exerciseDetails()"') !== -1);
  /* One destination, not a competing modal. */
  const strip = ui.slice(ui.indexOf("function anatomyStrip("), ui.indexOf("function addOnEligible("));
  assert.strictEqual(/N\.modal\(/.test(strip), false, "the anatomy must not open its own modal");
});

test("train: today's focus is derived from the session, not the day label", function () {
  /* Scope to the function body only. The next block's comment legitimately
     explains dayType safety, and sweeping it in would fail on prose. */
  const fnStart = ui.indexOf("function sessionFocus(");
  const fn = ui.slice(fnStart, ui.indexOf("\n  }", fnStart) + 4);
  assert.ok(fn.indexOf("NXTLIB.focusFor") !== -1, "focus comes from stored metadata");
  for (const word of ["Push", "Pull", "Legs", "dayType"]) {
    assert.strictEqual(fn.indexOf(word), -1, "focus must not hard-code " + word);
  }
  // Membership follows the plan's exercises, so reordering alone cannot change it.
  assert.ok(fn.indexOf("list || []") !== -1 || fn.indexOf("(list || [])") !== -1);
});

test("focus: primary outranks secondary and the set is deduplicated", function () {
  const f = NXTLIB.focusFor(["Incline Dumbbell Press", "Flat Dumbbell Press", "Cable Pushdown"]);
  assert.ok(f.primary.indexOf("upper_chest") !== -1 && f.primary.indexOf("chest") !== -1);
  assert.ok(f.primary.indexOf("triceps") !== -1, "triceps is primary for the pushdown");
  assert.strictEqual(f.secondary.indexOf("triceps"), -1,
    "a muscle that is primary anywhere must not also be listed as secondary");
  assert.strictEqual(new Set(f.primary).size, f.primary.length, "focus must be deduplicated");
});

test("focus: reordering the same exercises does not change membership", function () {
  const a = NXTLIB.focusFor(["Lat Pulldown", "Leg Press", "Cable Curl"]);
  const b = NXTLIB.focusFor(["Cable Curl", "Lat Pulldown", "Leg Press"]);
  assert.deepStrictEqual(a.primary.slice().sort(), b.primary.slice().sort());
  assert.deepStrictEqual(a.secondary.slice().sort(), b.secondary.slice().sort());
});

/* ===================== ADD-ONS ===================== */

test("addons: stored in their own map, never in sessionPlans", function () {
  assert.ok(html.indexOf('addOns:load("apm_addons",{})') !== -1, "add-ons have their own storage key");
  assert.ok(html.indexOf('save("apm_addons",state.addOns)') !== -1, "and are persisted");
  const add = ui.slice(ui.indexOf("function addOnAdd("), ui.indexOf("function addOnPick("));
  assert.strictEqual(add.indexOf("sessionPlans"), -1,
    "an add-on must never be written into the session plan — Zone 2's scheduled activity lives there");
});

test("addons: nothing in the add-on path can write dayType", function () {
  /* This is the load-bearing guarantee. dayType is resolved from
     settings.dayOverrides / settings.weeklyPlan; if no add-on function writes
     either, a Rest day cannot become a training day by adding a lift. */
  const start = ui.indexOf("const ADDON_MAX");
  const end = ui.indexOf("/* ---- Muscle context ---");
  const block = ui.slice(start, end);
  assert.ok(block.length > 500, "the add-on block was located");
  for (const f of ["state.dayType=", "dayOverrides", "weeklyPlan", "resolveDayType", "chooseSession"]) {
    assert.strictEqual(block.indexOf(f), -1, "add-on code must never touch " + f);
  }
});

test("addons: the limit is two", function () {
  assert.ok(/const ADDON_MAX = 2/.test(ui), "product intent is two optional exercises");
  const add = ui.slice(ui.indexOf("function addOnAdd("), ui.indexOf("function addOnRemove("));
  assert.ok(add.indexOf("list.length >= ADDON_MAX") !== -1, "the limit is enforced on add");
  const pick = ui.slice(ui.indexOf("function addOnPick("), ui.indexOf("function addOnFilter("));
  assert.ok(pick.indexOf("list.length >= ADDON_MAX") !== -1, "and the picker refuses a third");
});

test("addons: logging is guarded so no unowned set can be written", function () {
  /* NXT.logSet() has no dayType check of its own and reads state.exercise,
     which can hold a stale name from a previous strength day. */
  const log = ui.slice(ui.indexOf("function logSet() {"), ui.indexOf("function logSet() {") + 900);
  assert.ok(log.indexOf("addOnEligible() && !addOnActive()") !== -1,
    "logging on a non-strength day requires an active add-on");
  const active = ui.slice(ui.indexOf("function addOnActive()"), ui.indexOf("function addOnSelect("));
  assert.ok(active.indexOf("list.indexOf(state.exercise) !== -1") !== -1,
    "active means the current exercise is genuinely one of the add-ons");
});

test("addons: removing the last one leaves no stale state", function () {
  const rm = ui.slice(ui.indexOf("function addOnRemove("), ui.indexOf("function addOnPick("));
  assert.ok(rm.indexOf("state.exercise = list[0]") !== -1, "the current exercise cannot point at a removed add-on");
  assert.ok(rm.indexOf("apx96StopRest") !== -1, "a rest timer must not outlive the last add-on");
});

test("addons: eligibility is limited to non-strength days", function () {
  assert.ok(/ADDON_DAYS = \{ Rest: 1, Zone2: 1, Cardio: 1 \}/.test(ui),
    "only Rest, Zone 2 and Cardio take optional add-ons");
});

/* The programme's own preset days are the exercises this user actually sees.
   A preset the library does not know renders with no muscle line and no
   drawing, which is exactly the hole this enrichment was meant to close. */
test("library: every preset exercise carries metadata", function () {
  const block = html.match(/const TEMPLATES\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(block, "the templates are still declared where this test expects");
  const names = [...new Set([...block[0].matchAll(/name:\s*"([^"]+)"/g)].map(m => m[1]))];
  assert.ok(names.length > 15, "the presets were found, not an empty match");
  /* Zone 2 is a cardio placeholder, not a lift: it has no anatomy by design. */
  const missing = names.filter(n => n !== "Zone 2 Cardio" && !NXTLIB.has(n));
  assert.strictEqual(missing.join(", "), "", "presets with no library entry");
  assert.strictEqual(NXTLIB.has("Zone 2 Cardio"), false, "the cardio placeholder stays out of the library");
});

/* adductors is a canonical muscle, so at least one exercise has to reach it or
   the taxonomy carries a region nothing can ever light up. */
test("library: every canonical muscle is reachable from some exercise", function () {
  const reached = new Set();
  for (const n of NXTLIB.names()) {
    const m = NXTLIB.musclesFor(n);
    m.primary.forEach(x => reached.add(x));
    m.secondary.forEach(x => reached.add(x));
  }
  const orphans = Object.keys(NXTANAT.MUSCLES).filter(id => !reached.has(id));
  assert.strictEqual(orphans.join(", "), "", "canonical muscles no exercise trains");
});

/* ===================== TRAIN MOTION ===================== */

/* Train repaints on every logged set. If the entrance animation were declared
   in CSS alone it would replay on each one, which reads as a glitch rather
   than as movement through the queue. */
test("motion: the exercise change animates only on a genuine change", function () {
  assert.ok(ui.indexOf("const exMove=ui.lastExercise&&ui.lastExercise!==ex") !== -1,
    "the direction class is gated on the exercise actually changing");
  assert.ok(ui.indexOf("index>ui.lastIndex?' is-forward':' is-back'") !== -1,
    "direction follows the queue order");
  assert.ok(ui.indexOf("ui.lastExercise=ex; ui.lastIndex=index;") !== -1,
    "the comparison point is updated every paint");
  assert.ok(/class="nxp-ex-top\$\{exMove\}"/.test(ui), "the class reaches the markup");
  for (const name of ["nxp-ex-enter-forward", "nxp-ex-enter-back", "nxp-ex-anat-enter"]) {
    assert.ok(css.indexOf("@keyframes " + name) !== -1, name + " is defined");
  }
  assert.strictEqual(/@keyframes nxp-ex-enter-(forward|back)[^}]*}[^}]*(width|height|top|left):/.test(css), false,
    "the exercise transition animates compositor properties only");
});

test("motion: the add-on reveal plays once", function () {
  assert.ok(ui.indexOf("ui.addOnFlash = name;") !== -1, "adding marks the new row");
  assert.ok(ui.indexOf("if (fresh) ui.addOnFlash = null;") !== -1, "the mark is consumed as it is read");
  assert.ok(css.indexOf("@keyframes nxp-addon-reveal") !== -1, "the reveal is defined");
});

/* Reduced motion is a preference the app already owns; the new animations must
   fall under the same switch rather than needing their own opt-out. */
test("motion: reduced motion still covers the new animations", function () {
  assert.ok(/html\[data-nxp-motion=reduced\] \*[^{]*\{[^}]*animation:\s*none\s*!important/.test(css),
    "the app-level switch kills animation globally");
  assert.ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css),
    "the device setting is honoured too");
});

/* The exercise nav is rendered from the list training() resolved. On a
   non-strength day that list is the add-ons, so walking template() there left
   both controls enabled and inert — reproduced in the browser before the fix. */
test("addons: the exercise nav walks the list actually on screen", function () {
  const go = ui.slice(ui.indexOf("function goExercise(delta)"), ui.indexOf("/* The queue sheet presents"));
  assert.ok(go.indexOf("addOnActive()") !== -1, "the nav knows when the list is add-ons");
  assert.ok(go.indexOf("addOnSelect(names[next])") !== -1, "add-on days move by name");
  assert.ok(go.indexOf("N.selectExercise(next)") !== -1, "strength days still go through the engine");
  assert.ok(go.indexOf("template()") !== -1, "the strength path still reads the session template");
});

/* A Cardio day carries no lifting template, so it reaches trainEmpty(). That
   branch has to keep offering the optional block or Cardio is eligible in name
   only — the state was reachable in the browser before this assertion existed. */
test("addons: every eligible day keeps an entry point", function () {
  const empty = ui.slice(ui.indexOf("function trainEmpty()"), ui.indexOf("/* ---- Train: shared presentation helpers"));
  assert.ok(empty.indexOf("addOnSection()") !== -1,
    "an emptied session on an eligible day still offers the add-on block");
  for (const fn of ["function trainRest()", "function trainZone2()"]) {
    const body = ui.slice(ui.indexOf(fn), ui.indexOf(fn) + 1400);
    assert.ok(body.indexOf("addOnSection()") !== -1, fn + " renders the add-on block");
  }
});

/* The session builder and the add-on picker must offer the same dictionary, or
   an exercise is loggable in one place and invisible in the other. */
test("library: the session builder offers the whole dictionary", function () {
  const fn = html.slice(html.indexOf("function v88AllExerciseNames()"), html.indexOf("function v88NoteKey("));
  assert.ok(fn.indexOf("NXTLIB.names()") !== -1, "the shipped library feeds the Add/Replace picker");
  assert.ok(fn.indexOf("!names.includes(n)") !== -1, "names are unioned, never duplicated");
  assert.ok(/\["Incline Dumbbell Press"/.test(fn), "the existing hard-coded names are still offered");
  assert.ok(fn.indexOf("names.sort(") !== -1, "the picker stays alphabetical at library scale");
});

test("addons: the engine is reused, not forked", function () {
  const block = ui.slice(ui.indexOf("const ADDON_MAX"), ui.indexOf("/* ---- Muscle context ---"));
  assert.strictEqual(/state\.logs\.push/.test(block), false, "add-ons must not write history themselves");
  assert.ok(ui.indexOf("addOnActive()\n      ? addOns().map(n=>(typeof exerciseDefByName==='function'") !== -1
    || ui.indexOf("exerciseDefByName(n,state.dayType)") !== -1,
    "add-on targets resolve through the existing exercise lookup");
});

console.log("");
console.log((failed ? "FAILED  " : "OK  ") + passed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
