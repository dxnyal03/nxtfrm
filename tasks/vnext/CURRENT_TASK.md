# CURRENT TASK — VNEXT PHASE 2B: TRAIN — ACTIVE WORKOUT MODE

**Owner:** Cursor (implementation) · **Reviewer:** Claude (design/UX acceptance)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (binding) · `design-vnext/` (visual source of truth)
**Previous slice:** 2A committed as `9fd3772`.

> **This slice carries the highest scrutiny of the migration so far.** Train is where NXTFRM is used under fatigue, one-handed, mid-set. A regression here is worse than an ugly screen: it costs a logged set. Expect more review rounds than 2A, and expect me to reject anything that trades training correctness for visual fidelity.

---

## 1. Objective

Turn Train into a **focused mode**. Three things must become true:

1. **The current set is the protagonist.** Not one region among eight.
2. **Entering a workout feels like entering a mode** — global chrome recedes, the session takes over.
3. **Every existing training semantic survives, exactly.**

Today the whole logging loop is **~2,200px tall at 390px wide**, so *"Log set" sits below the fold during a set*, and the global tab bar overlaps the weight stepper. The `design-vnext` prototype fits the same loop in **~900px**. That gap is the slice.

**This slice is presentational.** Train must read the same engine values through the same functions. No calculation, storage key, record shape or training semantic changes.

---

## 2. Approved design reference

| What | Where |
|---|---|
| Active workout screen | `design-vnext/vnext.js` → `screenActive()` |
| Set logging + rest + settle motion | same → `logSet()`, `restStrip()`, `setHistory()`; `vnext.css` §15 |
| Queue sheet, exercise detail | same → `sheet('queue')`, `sheet('exdetail')` |
| Completion recap | same → `finishWorkout()` |
| Rationale and acceptance intent | `design-vnext/DESIGN-BRIEF.md` §P, §12, §42–44, §53 |

Preview: `python3 -m http.server` → `/design-vnext/` → **Train**.

`design-vnext/` is a **reference, not a library.** Its fixture data, its own state object and its prototype-only harness must not enter production. Port the *system and the layout*, not the prototype's logic.

---

## 3. Files / areas likely affected

| File | Expected change |
|---|---|
| `premium-ui.js` | `training()` and its Train helpers (`trainChrome`, `aimCell`, `stepper`, `restRail`, `logLabel`, `queue`, `exerciseDetails`, `sessionSummary`) |
| `vnext.css` | New `#trainPage` / `vn-*` Train section. Keep the existing scoping contract. |
| `index.html` | Only if the shell genuinely requires it for mode entry. Prefer not to. |

**Do not edit:** `cut-support.js`, any `wearables.*` engine file, `train-anatomy.js`, `seed.*`, `manifest.webmanifest`.
**`sw.js`:** only if this slice adds a new `.js`/`.css` the page requests — then register it in `VERSIONED` at the existing `RELEASE`. Never bump `RELEASE`/`CACHE_NAME`.
**Tests:** `wearables.release-gate.test.js` may be adapted only where it asserts on Train markup this slice legitimately changed. Preserve every assertion's original intent and declare it. Weakening a gate is a defect.

---

## 4. Required behaviours

### 4.1 Mode entry and exit (D6)
- Starting or resuming a workout **recedes the global tab bar**. `vnext.css` already ships `.tabs.vn-recede` unwired from 2A — wire it here.
- Provide an unmistakable way out that is **not** the tab bar: a leave/close control that returns to normal chrome without ending the session, and a finish control.
- Leaving must **not** discard the session. Re-entering resumes exactly where the user was, including drafts.
- Nav returns on exit and on completion.
- Mode entry/exit is a **subtle** transition (spatial tier, 280ms). No cinematic effect.

### 4.2 The current set is the protagonist
Order, top to bottom — thumb-ordered, with load/effort/Log Set together:

1. Mode bar: leave · session identity + working-set count · finish
2. Session progress across the whole session (per-exercise resolution)
3. Current exercise: name, muscles, tap target into details
4. **Aim strip: Last · Target · Rest** — one line of instruments, no boxes
5. Logged sets for this exercise
6. Rest strip, when resting
7. Weight stepper → reps stepper → set type → RIR → **Log set**
8. Prev · queue · next

**Acceptance: on a 390×844 viewport, at the start of an exercise, the Log Set control must be reachable without scrolling past the current set's own controls.** I will measure this.

### 4.3 Set logging
- Tap → immediate tactile feedback → the logged set resolves into the set-history list → session progress advances → next set is ready → rest timer appears for working sets.
- The **in-place confirmation** mechanism (`ui.confirmFrom` → `confirmLabel`) is existing, deliberate behaviour that replaced a success modal. **Keep it.** No success modal, no confetti, no full-screen state, no score.
- A freshly logged set may resolve with a brief violet settle, then return to calm. It must not stay highlighted.
- Auto-advance to the next exercise when planned sets complete — existing behaviour.

### 4.4 Rest
- Rest strip shows remaining time, progress, **+30s** and **Skip**.
- The engine owns the countdown. `NXP.paintRest()` updates it **without repainting the screen** — preserve that; a full repaint every second during a set is a defect.
- `suggestedRestSeconds(ex)` remains the source of the planned duration.

### 4.5 Queue, details, navigation
- Queue in a sheet: current exercise marked, per-exercise completion, jump, reorder via `NXP.queueMove` (buttons, not drag — reachable and accessible).
- Exercise details: real primary/secondary muscles, equipment, progression rule, previous session's sets. Anatomy only via the existing `train-anatomy.js` assets — **if accurate consistent art cannot be produced, omit it and use the muscle names.**
- Prev / next / jump keep the existing directional entrance (`ui.lastExercise` / `ui.lastIndex` → `is-forward` / `is-back`).

### 4.6 Completion
Real outcomes only, from real logs: working sets, exercises, and the next planned day. Progressed/maintained/below **only if** derived from actual comparison against each exercise's own previous session — otherwise omit it. **No fake workout score, no celebration theatre.** Keep `View session` and `Resume workout`.

### 4.7 Non-lifting days
`Rest`, `Zone2` and `Floorball` keep their own screens and their current behaviour. They may adopt VNext styling, but **must not** be turned into the lifting screen.

---

## 5. Must remain unchanged — read this twice

**The input contract.** `NXT.logSet()` reads the DOM by id: `weightInput`, `repsInput`, `n99-set-type`, `n99-rir`. These ids, their types and their value semantics **must survive exactly**. The existing code comments this explicitly ("The field stays a real `<input id="weightInput">` so the engine reads it exactly as before"). Rename or restructure them and set logging breaks.

**Add-on semantics (D6 adjacent, and the most dangerous thing in this file).**
- `training()` returns the Rest/Zone2 screens unless `addOnActive()`.
- On a non-strength day the add-ons **are** the list, resolved through `exerciseDefByName()`.
- `state.dayType` is resolved from `settings.dayOverrides`/`weeklyPlan` and **is never written by anything downstream of an add-on**. An add-on must never reclassify the day.
- `state.addOns` stays a separate map from `state.sessionPlans`.

**Everything else:**
- `template()` vs `templateFor()` — different stores. Do not conflate.
- Engine reads stay as-is: `N.targetFor`, `N.done`, `N.cue`, `N.sessionRows`, `N.sessionLogs`, `N.planDone`, `N.commit`.
- Draft state: `ui.drafts` keyed by `draftKey()`, written by `rememberInput(el)` on `oninput`. Drafts must survive a repaint and an exercise switch.
- Warm-up vs working set distinction, RIR (including "not recorded"), set numbering, extra-working-set confirmation.
- `NXT.undo`, `NXT.finish`, `NXT.resume`, `NXT.shorter`, `NXT.fullSession`, `NXT.sessionPicker`, `NXP.editCurrentSet`, `NXP.sessionMenu`, `NXP.sessionSummary`, `NXP.equipmentNote`, `v88OpenAddModal`, `v88NoteFor`.
- The **V86 render input lock** (`index.html:2919`): `render()` returns early while an input is focused. Train repaints on every logged set — nothing added here may fight this or repaint during focus.
- Today, Progress, History and More — untouched this slice.

If a current Train capability has no home in the new layout, **demote it, do not delete it**, and list it under *Known deviations*. Silent feature loss is a required-fix.

---

## 6. Responsive acceptance

| Width | Requirement |
|---|---|
| 390 | Reference. Log Set reachable per §4.2. |
| 375 | No reflow damage, no clipped labels. |
| 320 | A real design state. Aim strip **wraps rather than crushing its numbers**. Steppers stay thumb-sized. |

Zero horizontal overflow at all three widths, in every Train state below.

## 7. Visual acceptance

- The current set unmistakably dominates. No competing regions.
- Violet confined to I1: current set, focused input, active elements. Not every control.
- Steppers are large and tactile without being toy-like; the numeric keyboard stays optional.
- Completed sets read as settled, upcoming work reads as muted.
- Differentiated radii (I7). Status word + shape, never colour alone (I2, I6).

## 8. Test requirements

Extend `tasks/vnext/verify-2a.mjs` or add `verify-2b.mjs`. Cover **every Train state**: lifting active · mid-session with sets logged · resting · plan complete/finished · Rest · Zone2 · Floorball · add-on active on a Rest day · empty plan.

1. **Contrast** — all text ≥4.5:1, every state, 390/375/320
2. **Touch targets** — every interactive element ≥44pt, every state
3. **Overflow** — `scrollWidth === clientWidth`, every state, all three widths
4. **Log Set reachability** at 390×844 per §4.2
5. **Input contract** — `weightInput`, `repsInput`, `n99-set-type`, `n99-rir` all present with correct types; a simulated log writes a correct record (weight, reps, setType, rir, setNum) to `state.logs`
6. **Draft survival** — type a value, switch exercise, switch back: the draft is still there
7. **Rest timer** — ticks without a full screen repaint; +30s and Skip work
8. **Add-on safety** — activating an add-on on a Rest day does **not** change `state.dayType`, does not write `sessionPlans`, and Rest still resolves as Rest after a reload
9. **Nav recede/restore** — hidden in active mode, restored on exit and on finish
10. **Reduced motion** — every Train state renders; no positional animation
11. **Non-regression** — Today/Progress/History/More unchanged, no console errors; `node wearables.release-gate.test.js` stays green

Screenshots of each major Train state at 390 and 320 into `tasks/vnext/shots/`.

## 9. Explicitly out of scope

Progress implementation · **chart-domain change (D2 — slice 2C)** · History · Body Intelligence · OCR · Settings · AI surfaces · Supabase/schema/RLS · **`readiness()` removal (D4/X1)** · **legacy renderer removal (D5/X2)** · decision verdict vocabulary (Q2) · any calculation, storage or training-semantics change · dependency additions or a build step · `RELEASE`/`CACHE_NAME` bump.

---

## 10. Definition of done

- [ ] Active workout is a focused mode; the current set dominates; nav recedes and restores
- [ ] Log Set reachable per §4.2 at 390×844
- [ ] Every state in §8 passes contrast, targets and overflow at 390/375/320
- [ ] Input contract intact; a simulated log writes a correct record
- [ ] Drafts survive repaint and exercise switch
- [ ] Add-on cannot reclassify the day — proven by test
- [ ] Rest timer ticks without full repaint
- [ ] Nothing in §5 changed; anything demoted is listed under *Known deviations*
- [ ] Other four tabs unchanged; release gate green
- [ ] `CURSOR_REPORT.md` completed (A–H)
- [ ] **Do not commit.** Claude reviews the working tree first.
