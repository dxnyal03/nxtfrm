# Coaching UI — presentation report (`NXT.coach`, workstream C-UI)

Branch `ascension`, 2026-10-13. Nothing committed or pushed. Presentation only: no calculation, storage key, record shape or engine file changed. `coach.js` is untouched; the engine contract is `tasks/ascension/coaching-engine-report.md` §3, §8, §10.

## 1. What changed

| File | Where | What |
|---|---|---|
| `premium-ui.js` | new block after `home()` (`const CO_DOM` ~L251 → `coachDayLine` ~L513) | all coach rendering helpers, sheets and handlers |
| `premium-ui.js` | `home()` ~L105–L192 | rail reads `coach.context().week`; Coach stack and Week in review inserted between the training tile and the minis |
| `premium-ui.js` | `trainRest` / `trainZone2` / `trainFloorball` (~L835–843) | `${catchUpRowHTML()}` under the day copy |
| `premium-ui.js` | `training()` coach line (~L1099) and `useTarget()` (~L1265) | `coachAdvice(ex)` = `NXT.coach.trainAdvice(ex)`, falling back to `N.coachFor(ex)` |
| `premium-ui.js` | `historyCalendar()` (~L2877) and `historyDayView()` (~L2965) | one `dayStatuses` read per paint, status marks, legend, day-card status line |
| `premium-ui.js` | export line (~L3378) | `coachAct, coachDismiss, catchUpSheet, catchUpApply, excuseSheet, reviewSheet, reviewSeen` |
| `cut-support.js` | `openDay()` (~L1592) only | "Didn't happen?" block; picker and its rules untouched |
| `strata.css` | one block, `/* ===== Ascension · coaching UI ===== */`, appended once at the end (~L2956, ~230 lines) | all styles; plus one `letter-spacing` rule inside that block |

No new `.js`/`.css` file, so `sw.js` is untouched. Every coach read goes through `coachCall()` (or its own try/catch), which swallows an engine error, so an engine failure can never break a screen. With `NXT.coach` absent every screen renders as before (tested).

## 2. Surfaces

### 2.1 Today › Coach stack
- **Reads:** `NXT.coach.insights()` (≤3). Tiles are direct children of `.st-bento`, so the existing strata scroll-reveal covers them; reduced-motion path is the existing one (tested).
- **Tile:** lit-glass `.st-tile`; eyebrow = small domain shape + word (Schedule violet, Strength lavender, Cardio apricot, Weight violet, Data mauve) then severity word with a 6px shape (`act` violet circle "Action", `watch` `#B8842A` diamond "Watch", `info` none); Geist title; body; evidence as glass chips `label · value`; primary capsule for `action`; folded **Why** with four labelled lines (Noticed, Evidence, Why it matters, What you can do); text **Dismiss** top right.
- **Severity:** `act` gets a lit edge and bloom in its domain hue, `watch` the default quiet edge, `info` a plainer tile.
- **Actions** (`NXP.coachAct`): `catchUp` → confirmation sheet; `excuse` → excuse sheet; `{sheet:'review'}` → `NXT.openReview()`; `cardio` → `showCardioSheet()`; `weight` → `apx95OpenQuickWeight()`; `day` → `NXT.openDay(date)`; `{tab:'train'}` → `switchTab('train')`; `{tab:'weight',view:'strength'}` → `NXT.ui.view='strength';switchTab('weight')`. Dismiss → `NXT.coach.dismiss(id, fingerprint)`.
- **No insights → nothing rendered** (tested: no empty card).

### 2.2 Today › Week in review
- **Reads:** `NXT.coach.weekReview()`; shown when non-null and `!seen`.
- Eyebrow "Last week · 5–11 Oct", headline, four figures (Lifting `done/planned`, Sets with `vsPrev` arrow + word, Cardio `min/target`, Weight avg with change arrow + word; `vn-num`, "—" when null; 4 columns ≥360px, 2×2 below), the outcomes line (beat / matched / below, only when something was compared), the engine's own "Excused: …" / "Moved: …" lines when it wrote them, **Got it** → `markReviewSeen(weekStart)`.
- The whole tile is a button (transparent overlay under **Got it**) that opens a sheet: 7 days (weekday, date, label, status word + shape, sets / cardio minutes logged), the engine's `lines`, a **Next week** strip from `nextWeek`, and a sticky **Done** that also calls `markReviewSeen`.

### 2.3 Excuse flow
- `NXT.openDay(date)` gains a "Didn't happen?" block (Sick / Travel / Rest / Other → `NXT.coach.excuse`) for a past `missed` or `partial` day with no log rows; for an `excused` day it shows the reason and **Remove excuse** → `NXT.coach.unexcuse`; a `moved` day says where it went.
- `NXP.excuseSheet(date)`: the same choices as a sheet, with the current reason marked and **Remove excuse** when the day is already excused. Opened from History's day card, from the coach action and from the catch-up sheet's secondary "Mark Mon excused".

### 2.4 History
- **Reads:** `dayStatuses(gridStart, gridEnd)` once per calendar paint; `dayContext(date)` per day card.
- Marks follow the filter and never draw floorball (D40): faint session letter on a planned lifting day, hollow ring "Not logged", short slash "Excused", arrow "Moved". Legend entries (shape + word + count) appear only for marks the month has. Cell `aria-label` carries the status.
- Day card: status chip (shape + word + plan, "Excused · sick", "Moved to 13 Oct", "Plan not done", "Planned"), "moved here from" note, and a text action **Excuse this day** / **Remove excuse** → `NXP.excuseSheet(date)`.

### 2.5 Today week rail
- **Reads:** `NXT.coach.context().week.days` / `.liftsDone` / `.liftsPlanned`. Excused day: slash mark, aria "excused · sick", no "not logged" ring. Moved day: arrow mark, label "Moved", aria "moved to 13 Oct". A day before the first record is no longer "not logged". Header "This week · N of M lifts done" uses the engine's counts. Markup contract (`class="vn-week"`, `data-rail`) kept.

### 2.6 Train
- A row under the day copy on Rest / Zone 2 / Floorball idle days when `NXT.coach.catchUp()` is non-null: "Full Body A didn’t happen Mon (30 min of cardio instead) — do it today?" → the same confirmation sheet. The parenthesis appears only when `logged.cardioMin > 0` ("other activity" for floorball, never named: D55).
- Coach line and target rows read `NXT.coach.trainAdvice(ex)`. On a hold the headline reads "Hold 30 kg — weight decision reads “Losing quickly”" (up to three lines, the pill that would repeat "Hold" steps aside) with the engine's note under **Why**. `useTarget()` reads the same advice, so tapping a target fills the hold load, not the aim (tested: fills 30, not 32.5).

### 2.7 Catch-up confirmation sheet
Title "Move Full Body A to today?", one lead sentence, **What changes** (the engine's `consequences`, verbatim), primary **Move to today** → `applyCatchUp(proposal)`; secondary **Mark Mon excused**. Nothing is written before confirm (tested). A refused (stale) proposal closes the sheet and repaints.

## 3. Decisions and deviations (please review)
1. **`weight.review` is not stacked on Today.** It repeats the Decision card's headline directly below (engine report §8.3); the next-ranked insight from `.all` takes its place.
2. **Only `act` tiles get the primary capsule.** `watch` and `info` actions use the glass capsule, so a stack never shows several competing primaries (premium-ui.css: one primary per view). One-line change if the owner wants primary everywhere.
3. **Chips are capped at three** (the "14 lifts back after a break" insight carries 15); the Why fold carries the full evidence sentence.
4. **Calendar letters** use A / B / C for Full Body A/B/C (the legacy week strip already did) and Pu / Pl / Lg for Push / Pull / Legs, not a single "F".
5. **"Excuse this day" is hidden when the engine would refuse** (any log row that day), instead of offering a button that only toasts.
6. **"Cardio", not "walked":** logged cardio can be a bike or elliptical; the engine's own copy says cardio.
7. **Monday's old recap** (`strata.js` `dressRecap`, outside my files) says the same as the review tile; it is hidden by `.co-rv-on .st-recap` only while the review tile shows. Retiring it is a `strata.js` decision.
8. **`DECISIONS.md` not edited** (not in my file list). Suggested entry: *"Coaching UI. Today gains a Coach stack of up to three engine insights (lit-glass tiles, Why fold, Dismiss; act = lit edge and primary capsule) and a Week in review tile + sheet; excused and moved days read distinctly on the rail, History calendar and day card; the catch-up shows its consequences and needs confirmation; Train's coach line reads the coordinated advice. Presentation only."*
9. **Dismiss** has a 450 ms debounce, so a double tap cannot dismiss the tile that moves up into its place.

## 4. Verification (real output)

**Static**
```
node --check premium-ui.js: OK      node --check cut-support.js: OK      node --check coach.js: OK
strata.css braces: open 2261 close 2261 -> balanced   (one "Ascension · coaching UI" block)
```
**Suites** — `for f in wearables*.test.js; do node "$f" || echo FAIL $f; done`: 21 suites, 586 passed, 0 failed (release gate 54/54, plan-persistence 25/25, coach 48/48, train-enrichment 34/34, sw-strategy 23/23 — the last is another agent's new suite).

**Playwright** (Chrome, dev server :8763, `sessionStorage.nxSplash=1`, project `strata.css`; scripts in `~/Library/Caches/DanDev/nxtfrm/ascension/coach-ui/`)
```
verify-coach-ui   [320] 58/58  [375] 58/58  [390] 58/58  [430] 58/58
verify-actions    [320] 22/22  [375] 22/22  [390] 22/22  [430] 22/22
verify-extra      [320] 13/13  [390] 13/13
```
- (a) seed catch-up: tile with evidence chips, Why opens with four labelled lines, primary action opens the sheet listing exactly `proposal.consequences`, nothing written before confirm, confirm sets `settings.dayOverrides[state.date]='FullA'` and `dayNotes['2026-10-12']={status:'moved',to}`, Today becomes "Full Body A / Start workout", rail Monday reads "Moved" ("moved to 13 Oct"), header "0 of 3 lifts done", all persists after reload.
- (b) dismiss `strength.returning`: tile gone, engine stops returning it, gone after reload, act tile untouched.
- (c) excuse Mon 12 Oct from History: calendar shows the Excused mark and legend word, day card "Excused · sick", Today rail "excused · sick" and "0 of 2 lifts done", day sheet shows reason and Remove excuse, History "Remove excuse" opens the sheet with the reason marked, removal restores "Not logged".
- (d) review tile: eyebrow range, headline, four figures; "Got it" hides it and stores `reviewSeen='2026-10-05'`; hidden after reload; the sheet's Done does the same.
- (e) no page errors; no horizontal overflow (Today, Train, History, sheets); every new control ≥44px (`offsetHeight/Width`); text ≥11px on every new surface; tiles are bento children and reveal on scroll; reduced motion: every tile in its final state, 0 running animations, Why chevron has no transition.
- Every action in §2.1 mapped and exercised (cardio sheet, weigh-in sheet, day sheet, excuse sheet, Train tab, Progress › Performance), plus the "lifting day with only a walk" copy, the new-user state (no tiles, no false rings) and `NXT.coach` absent.
- Coordinated hold (`s-hold.mjs`): headline, "Hold" state, note, hold targets, `useTarget` fills 30.
- Regression: `tasks/vnext/verify-train-browser.mjs` (D18) 6 passed, 0 failed. `verify-152` (run from a scratch copy so tracked result files are untouched) 33/33. `verify-151` 33/34: the one failure, "header: plan vs actual … 1 of 3", is date-dependent (its fixture puts a lift "two days ago", which is last week on a Tuesday) and fails identically with `coach.js` blocked.

**Cost** (Today repaint, median, seed-shaped data): 445 logs 14.3 → 32.2 ms; 1,735 logs 54.1 → 87.0 ms. Parts at 1,735 logs: `insights` 14.6, `context` 12.5, `weekReview` 8.8 ms. If that matters, defer the stack until after first paint (engine report §9.12).

**Screenshots** — `/Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/shots/coach/` (…-390.png and …-320.png): `today-walk-full`, `today-lift-full` (after the catch-up), `rail-moved`, `rail-excused`, `tile-act-why`, `review-tile`, `sheet-catchup`, `sheet-excuse`, `sheet-review`, `train-catchup-row`, `history-marks`, `history-marks-full`, `history-day-missed`, `history-excused`. Extra: `scenarios/` (every domain and severity), `hold/`, `wide/` (375, 430, 768, 1280), `dev/`. I viewed them and fixed: Dismiss/Got it width (44px), sticky Done, Train row wrap, "Moved" label tracking at 320, hold headline truncation.

## 5. Limitations and follow-ups
- Verified in Chrome at 320 / 375 / 390 / 430 (smoke at 768 and 1280); not on a physical iPhone or Safari.
- **Entry prefill on a hold:** the weight field still opens at the aim (32.5) via `N.cue(ex)` while the headline says Hold 30; targets and `useTarget` follow the hold. Feeding the prefill from `trainAdvice` is one line, left out because the brief says nothing else in Train changes.
- On a Rest day the catch-up row sits under "Nothing needs to be made up today." The row says "Optional".
- The rail's own labels are 10–11px (pre-existing); the new "Moved" label is 11px.
- A second device can bring back an unexcused note from the cloud (engine report §9.9).
