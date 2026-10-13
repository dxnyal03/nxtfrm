# Ascension · Workstream B (charts) — Exercise history in Exercise Details

Branch `ascension`, baseline `029eb51`. Presentation only: no calculation, storage key, record shape or engine file changed. Nothing committed, pushed or deployed.

## 1. What shipped

1. **A History section in Exercise Details.** It answers one question: *how has my best working set for this exercise moved across sessions?* It sits between the Target / Rest / Increment / Equipment row and the cue and Recent sessions blocks.
   - A stable readout above the plot: date, the D20 comparison with the previous session (word + shape), `load kg × reps` in Geist numerals, and, only while the e1RM toggle is on, the session's e1RM named as an estimate.
   - A plot: best-set load per session as a solid violet gradient line with dots and a soft area, reps as small numerals under each dot, and the all-time best marked with a ring and the word "Best". The kg scale follows the measured loads only.
   - **An `e1RM` glass toggle, OFF by default** (revision 1, section 9): switched on, it adds the engine's e1RM as a faint **dashed** line with no dots labelled "e1RM · estimate", stretches the kg scale to hold it, and adds the estimate to the readout. Remembered for the page session in `NXT.ui`; nothing is stored.
   - Drag / touch scrub, arrow keys, Home / End, Escape. Default selection is the latest session.
   - "Last 12 | All" glass pill, only when more than 12 sessions exist; the e1RM toggle sits next to it.
2. **Progress › Performance rows open the same sheet** for that lift **and that row's gym** (tap, touch, Enter / Space).
3. `exerciseDetails()` accepts an optional name and gym. The Train call sites are untouched (`class="st-ex-title" onclick="NXP.exerciseDetails()"`, the anatomy crop, the "Exercise details" row).

## 2. Where

| File | Change |
|---|---|
| `premium-ui.js` `exerciseDetails()` (line 1530 at the time of writing; it moves as other workstreams edit the file) | Optional `(name, gym)` read from `arguments`; mode flags; History section hook; `exhOpen()` after `N.modal(...)`. About 25 lines touched in place. |
| `premium-ui.js` helper block (lines 1581–1831, `exh*`) | `exhSeries`, `exhBestIdx`, `exhCmp`, `exhParts`, `exhSectionHTML`, `exhOpen`, `exhResize`, `exhE1`, `exhRange`, `exhSelect`, `exhMark`, `exhScrub`, `exhKey`, `exhPaint`. All inside the NXP closure; **no new export** (handlers are bound with `addEventListener` after the sheet is built), so the large `return {…}` line is not touched. |
| `premium-ui.js` `performanceRow()` (line 2037) | A chevron after the name and one transparent `<button class="st-perf-open" data-ex data-gym>` over the row. |
| `strata.css` | One delimited block `/* ===== Ascension · exercise history ===== */` appended at the end (118 lines: sheet section, e1RM toggle, readout, plot marks, motion, Performance row hit layer). |
| Not touched | `strata.js`, `cut-support.js`, `index.html`, `sw.js`, `premium-ui.css`, `vnext.css`, `tasks/vnext/DECISIONS.md`. No new `.js` / `.css` file is requested by the page, so the `sw.js` offline shell is unchanged. `RELEASE` is not bumped; that stays the owner's per-deploy step. |

In `git diff -U0 premium-ui.js` my hunks are the one at `exerciseDetails()`, the helper block right after it, and the one at `performanceRow()` (about 270 inserted lines in all); the other hunks are other workstreams' (coach UI). Other agents' blocks in `strata.css` (the launch reveal block) sit above mine; mine is last.

## 3. Data source and calculation (nothing new)

- **Series** — `NXT.sessionRows(ex, gym, tomorrow, 100)`: the engine groups stored **working** sets (`workRows()` already drops warm-ups) by date for the **exact** exercise name at the **exact** gym. One point per session date. Names and gyms are compared strictly: no alias merging, no gym merging. (`strengthItems()` is the Performance tab's source, but it is capped to 24 lift/gym pairs, so the sheet calls the same `sessionRows` it calls.)
- **Primary point** — `NXT.bestSet(session.sets)` (D20: heaviest load, then most reps at that load), exactly the rule Train's "Best last time" uses (so the rep cap is the engine's 100, not 15).
- **e1RM (opt-in)** — drawn and read out only while the toggle is on. It is the engine's own per-session `value` from `sessionRows(ex, gym, tomorrow)` with the default 15-rep cap, i.e. the figure Progress › Performance plots (Epley: `max(weight × (1 + reps / 30))` over the session's working sets of up to 15 reps). A session whose sets are all above 15 reps has a best-set point but **no estimate**; the readout says "No e1RM estimate for this session" and the dashed line skips it. The estimate can come from a different set than the D20 best set (for example 38 × 10 estimates higher than 40 × 4); that is how Performance already behaves.
- **Comparison** — the D20 rule against the previous session in the full history (not just the visible window): heavier load, or the same load with more reps → "Beat last time"; identical → "Matched last time"; otherwise "Below last time" (the same word the finish summary uses for its Below count); the first session → "First session".
- **Best** — the all-time best by D20 order across **all** sessions, not just the visible range. A tie keeps the session that first set it (strict improvement, the same rule as the D27 "New best"). If it is older than the "Last 12" window no ring is drawn; the hidden text summary then says "(before this range)".
- **Today** — a session logged today is included (as in the Performance tab) and labelled "Today".
- **Geometry only** — the kg axis follows the plotted data only (D2): the measured best-set loads when e1RM is off, loads plus estimates when it is on, never a hidden series. Headroom is .6 of a step above and below (D51: `room = data ± .6 × step`), 3–4 ticks inside the domain from a `.5 … 1000` step ladder (the smallest step with at most four ticks; a narrow domain is widened by one step to reach three), gutter width from the longest tick label (34 px up to three characters), x evenly spaced per session. Dates carry the year only when it differs from today's.

## 4. Behaviour

| State | What shows |
|---|---|
| 0 sessions | "No sessions yet" card with one line on how the line gets built. No chart. |
| 1 session | The single reading as text (`60 kg × 8`, the date) and "A line appears after the second session." No chart. The e1RM toggle is there when the session has an estimate; its "e1RM 76 kg · estimate" line appears only when the toggle is on. |
| 2 sessions | The chart; a line between two points. |
| 3–12 | The chart; no range control. |
| More than 12 | `Last 12 \| All` (44 px targets, strata.js's sliding pill). A range change redraws, replays the draw-in and returns the selection to the latest. |
| Long ranges | Dots shrink (r 4 → 3 → 2.2 → 1.6); reps numerals appear under every point while the slot is at least 18 px, otherwise only under the selected one. |
| Lift with no estimate at all (every set above 15 reps) | No e1RM toggle (nothing to switch on); the readout row stays empty. A session without an estimate inside an otherwise estimated lift reads "No e1RM estimate for this session" while the toggle is on. |
| Chart cannot be built (defensive `try/catch`) | "Chart unavailable" card; the sessions are still listed under Recent sessions. |

**Interaction.** Pointer down / drag over the plot selects the nearest session. `pointerdown` stops propagation so the sheet's own drag-to-close cannot take a scrub. `touch-action: pan-y` keeps vertical sheet scrolling. A hover without a pressed button does nothing (same as the weight chart). On the focused plot, Left / Right move, Home / End jump, and **Escape clears a moved selection back to the latest and keeps the sheet open; with nothing to clear it is left alone, so it closes the sheet as before** (the sheet's global Escape handler). The selection moves marks and text only; the plot is not redrawn.

**Motion.** Draw-in on open, on a range change and on an e1RM toggle only (never on a scrub or a resize): line draws, area, dashed estimate, dots and numerals, ring, label and stem fade in; every animation ends within 460 ms (budget 480), keyframe easing `cubic-bezier(.32,.72,0,1)`. It is held (`is-wait`) until at least 30 % of the plot is on screen, with a 3 s ceiling, so a chart below the fold of the sheet is seen drawing and can never stay blank. Under reduced motion (`prefers-reduced-motion` or `data-nxp-motion="reduced"`) the class is never added and the CSS declares animations only inside `no-preference` and `:not([data-nxp-motion="reduced"])`, so the final state is the state.

**Accessibility.** `<svg role="img" aria-label="…" aria-describedby="exh-eq">` with a matching `<title>`; a visually hidden summary that describes what is drawn, for example *"3 sessions from 16 Jul to 3 Aug, best 30.5 kg × 12 on 3 Aug. Best set per session: 16 Jul 28 kg × 12; …"* (with the toggle on it also says *", e1RM 42.7 kg (estimate)"* and the svg label adds *"with the estimated 1RM as a dashed line"*); a visually hidden `aria-live="polite"` line carrying the readout exactly (*"3 Aug · 30.5 kg × 12 · Beat last time"*; the visible readout is `aria-hidden` to avoid reading it twice); the plot is `tabindex="0"` `role="application"` with an instruction label (the weight chart's idiom) and a 2 px focus ring. No colour-only meaning: comparison is word + arrow / bar / dot shape, the estimate is dashed with no dots and named, the best is a ring and a word. All text styles measured ≥ 5.15:1 (I4); chart text is 10.5–11.5 px at 320.

**e1RM toggle.** A glass capsule (D56 tier 2) with a check box and the dashed-line key, so the state and the series are shapes as well as colour (the weight chart's Projection idiom); `aria-pressed`, `aria-label="Estimated one-rep max, e1RM"`, 44 px tall, keyboard operable (Space / Enter), focus stays on it across the redraw. On the heading row it sits at the right; with the range control present the heading takes its own row and the control row is `Last 12 | All` at the left and the toggle at the right. Toggling redraws the plot (the scale changes) and replays the draw-in; the selection and the range are kept. The choice is `NXT.ui.showE1rm`, in memory for the page session like the weight chart's toggles, never in storage.

**Performance row.** Each row now has a transparent full-row button (at least 90 px tall here, 44 px minimum), a small chevron after the name for affordance, hover / pressed / focus states, and `aria-label="Exercise details: <name> at <gym>"`. Closing the sheet returns focus to the row's button.

## 5. Decisions and where I extended the brief

1. **The signature stays `function exerciseDetails()`.** `wearables.release-gate.test.js` (lines 463 and 472) slices `premium-ui.js` on that exact text, so a named parameter would break the gate. The optional arguments are read from `arguments`, and a comment says why. If the owner relaxes that marker, switch to `(name, gym)`.
2. **Performance rows pass the gym as well as the name.** Rows are per (exercise, gym), and the brief says never to merge gyms, so the History and Recent sessions use the row's gym.
3. **"Record" mode (opened with arguments) is read-only for today's session.** It shows no Swap and no equipment-note button (both act on `state.exercise` / today's queue). It shows the cue and a saved equipment note only when the gym is the current gym (`NXT.cue()` and the notes read `state.gym`, so for another gym they would describe the wrong history). It shows Target / Rest / Increment only when the lift is in today's live plan at this gym (`template()`); otherwise `targetFor()` would fall back to factory or default 3 × 8–12 numbers that are not the lifter's plan. The Equipment fact (library data) still shows.
4. **Train mode is unchanged** apart from the new section: same facts, same cue, same note, same buttons (verified).
5. **e1RM is opt-in (coordinator revision 1).** I11 and the weight chart's Projection control say estimates are off by default, and an always-on estimate stretched the kg scale so that a 2.5 kg rise filled about 15% of the plot. See section 9.
6. **No D-row was added.** This is presentation only and the owner owns `DECISIONS.md`. If wanted, suggested wording: *"D60 — Exercise Details › History: one chart of each session's best working set (D20) for the same exercise at the same gym on a data-only kg scale (D2, D51 headroom); an e1RM toggle, off by default and remembered for the session only, adds the engine's estimated 1RM as a dashed, named line (I11); scrub / keys / range, a text summary, and Progress › Performance rows open it. Presentation only; no calculation, storage or record change."*

## 6. Verification (real output)

Environment: dev server `http://localhost:8763` (`?reseed=1`), Playwright 1.49.1 with system Chrome (`channel: 'chrome'`), 2× DPR, mobile + touch contexts, `sessionStorage.nxSplash=1`, lifting-day setup as in `tasks/vnext/verify-train-browser.mjs` lines 36–50, then Start workout and `NXP.exerciseDetails()`. Synthetic lifts (zero, one, two, mixed, 15, 60 sessions, high-rep, two gyms, an alias, a hostile name) are added **in memory only**, never persisted.

```
$ node --check premium-ui.js
(no output, exit 0)

$ grep -o "{" strata.css | wc -l ; grep -o "}" strata.css | wc -l
2104
2104

$ for f in wearables*.test.js; do node "$f" || echo FAIL $f; done   (last result line of each suite)
wearables.activity.test.js: OK  13 passed, 0 failed
wearables.adapters.test.js: OK  32 passed, 0 failed
wearables.canonical.test.js: OK  24 passed, 0 failed
wearables.coach.test.js: OK  48 passed, 0 failed
wearables.days.test.js: OK  16 passed, 0 failed
wearables.ingest.test.js: OK  32 passed, 0 failed
wearables.plan-persistence.test.js: OK  25 passed, 0 failed
wearables.progression.test.js: OK  18 passed, 0 failed
wearables.provider-garmin.test.js: OK  3 passed, 0 failed
wearables.recovery-integration.test.js: OK  32 passed, 0 failed
wearables.recovery.test.js: OK  28 passed, 0 failed
wearables.release-gate.test.js: OK  54 passed, 0 failed
wearables.resolution.test.js: OK  19 passed, 0 failed
wearables.snapshots.test.js: OK  26 passed, 0 failed
wearables.store.test.js: OK  34 passed, 0 failed
wearables.sw-strategy.test.js: OK  23 passed, 0 failed
wearables.sync.test.js: OK  47 passed, 0 failed
wearables.test.js: OK  18 passed, 0 failed
wearables.train-enrichment.test.js: OK  34 passed, 0 failed
wearables.training-readiness.test.js: OK  29 passed, 0 failed
wearables.weight-contract.test.js: OK  31 passed, 0 failed
```

21 suites, 586 tests, 0 failures. (The brief's baseline was 18 suites / 490; `wearables.coach.test.js`, `wearables.plan-persistence.test.js` and `wearables.sw-strategy.test.js` arrived from other workstreams while this slice was in progress. `wearables.release-gate.test.js` and `wearables.train-enrichment.test.js`, which assert the Train markup and the `exerciseDetails()` marker, are green.)

```
$ NXTFRM_BASE=http://localhost:8763 node tasks/vnext/verify-train-browser.mjs      (D18 anatomy budget, Train regression)
390px  budget 16px
393px  budget 16px
402px  budget 16px
430px  budget 16px
375px  budget 16px
320px  budget 10px
OK  6 passed, 0 failed
```

```
$ node ~/Library/Caches/DanDev/nxtfrm/ascension/charts-verify.mjs http://localhost:8763
272 passed, 0 failed          (full log in Appendix A)
```

What the 272 assertions cover (390×844 and 320×568 unless noted):

- **Train sheet, e1RM off (the default)**: opened from the real title button; History sits between the facts row and Recent sessions; facts row, Swap and equipment-note button unchanged; svg `role=img` + `aria-label` + matching `<title>`; hidden summary (without any estimate); 3 dots for Incline Dumbbell Press (16 Jul 28 × 12, 25 Jul 28 × 12, 3 Aug 30.5 × 12); **no dashed line, no "e1RM · estimate" label, empty e1RM row in the readout**; **the kg scale follows the measured loads only: ticks 28 29 30 31 and the 28 → 30.5 kg rise fills 68% of the plot height**; one ring and "Best"; reps under each point; the left gutter, kg unit, first and last date labels; plot drawn at its measured width (368 / 298); caption says "per session"; readout `3 Aug · 30.5 kg × 12 · Beat last time`; contrast; chart text 10.5–11.5 px; no horizontal overflow.
- **e1RM toggle**: present as a 44 px glass capsule on the heading row, `aria-pressed="false"`, text "e1RM", text contrast 12.21:1 off and 11.92:1 on; reopened sheets start off; a real click switches it on: `NXT.ui.showE1rm` becomes true, the dashed line (dasharray `2px, 5px`) draws with the label "e1RM · estimate", **the domain expands (ticks 28 29 30 31 → 30 40 50, the measured rise falls from 68% to 9% of the plot)**, the readout row reads "e1RM 42.7 kg · estimate", the text summary names the estimate, **localStorage and sessionStorage are byte-identical before and after**, the draw-in replays (13 animations, longest ends within 480 ms); Space and Enter operate it from the keyboard, focus stays on it across the redraw, switching off restores the ticks 28 29 30 31; the choice is remembered for the next sheet in the page session and can be switched off again; Escape on the toggle closes the sheet.
- **Scrub and keys unaffected**: with the toggle on, synthetic `pointerdown` / `pointermove` still give `16 Jul · 28 kg × 12 · First session`, `25 Jul · … · Matched last time`, `3 Aug · … · Beat last time`; the e1RM row follows the selection (42.7 kg, 39.2 kg for the first session); End / ArrowLeft / Escape unchanged. With it off: the same readouts, the selection marker on the selected dot, a hover without a button does not scrub, a real mouse drag and a real CDP touch drag scrub (and do not scroll or drag the sheet), a second Escape closes the sheet.
- **Motion**: longest animation ends at 460 ms, keyframe easing `cubic-bezier(0.32, 0.72, 0, 1)`; held while below the fold and released on scroll or after 3 s. **Reduced motion** (media query at both widths and the app setting `data-nxp-motion="reduced"`): no `is-draw`, no running animation, line dasharray `none`, offset `0px`, opacities 1, screenshot taken straight after open; switching e1RM on under reduced motion also shows the final state at once (0 animations, estimate dashed and labelled).
- **States / record mode**: 0, 1, 2, 15 (Last 12 → All → Last 12, pressed state, redraw, selection reset) and 60 sessions; 1 session: the estimate line stays hidden until the toggle is on, then reads "e1RM 76 kg · estimate"; high-rep-only lifts have no toggle and nothing to read; a mixed lift shows "No e1RM estimate for this session" for its >15-rep session and "e1RM 63 kg · estimate" for the next; with 15 sessions the toggle shares a row with `Last 12 | All` (107 × 44 px) and the two are independent (All stays selected when e1RM goes on); Last 12 off → on: ticks 35 40 45 50 → 40 50 60 70, the measured line from 68% to 28% of the plot; Gym B record (3 own sessions, no cue for the wrong gym, no Swap, no plan facts for a lift not in today's plan); Gym A record shows only its single session; "Incline DB Press" is not merged into "Incline Dumbbell Press"; a lift in today's plan opened from elsewhere keeps its plan facts but no session actions; a name with quotes, `&` and tags is rendered as text only.
- **Performance**: every visible row has the button; Enter on the first row opens its sheet; Escape returns focus to the row; touch taps open `Fixture Two` (2 points) and the right gym for a lift logged at two gyms.
- **Other widths**: live resize 390 → 320 redraws at the new width and keeps the selection; 375, 393, 430, 768 and 1280 px (the sheet caps at 560): no overflow, plot at its measured width, the toggle on the range row (gap 94 / 112 / 149 / 279 px), 44 px tall, inside the sheet.
- **Fuzz** (not part of the 272): 400 random series, opened through the real sheet at 390 and again at 320, each with the toggle off, on and off again. Every run had 3 or 4 ticks in both states, no `NaN` / `undefined` in any svg, no mark outside the viewBox or the plot frame, ticks ascending, no estimate drawn and an empty e1RM readout while off, and switching back off restored the ticks exactly. The measured series always filled more of the plot with the toggle off than on (399 of 399 runs with a toggle). The smallest share for a series that is not flat was 24% (a near-flat series); typical shares are 60–70%. The single run without a toggle was a series whose random dates collided into one session (the one-session text state, as designed).

## 7. Screenshots

Folder: `/Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/shots/charts/`

| Subject | Files |
|---|---|
| Before (baseline sheet) | `baseline-390.png` |
| Sheet on open | `train-sheet-top-390.png`, `train-sheet-top-320.png` |
| History, Incline Dumbbell Press, e1RM off (default) | `train-sheet-chart-390.png`, `train-sheet-chart-320.png` |
| Same, e1RM on | `train-sheet-chart-e1rm-on-390.png`, `train-sheet-chart-e1rm-on-320.png` |
| Keyboard focus, selection moved (re-taken for revision 1) | `focus-selection-430.png` (off), `focus-selection-e1rm-on-430.png` |
| 15-session sheet, Last 12, off and on (the range row with the toggle) | `state-many-390.png`, `state-many-e1rm-on-390.png`, `state-many-320.png`, `state-many-e1rm-on-320.png` |
| 15-session sheet, All, off and on | `state-many-all-{390,320}.png`, `state-many-all-e1rm-on-{390,320}.png` |
| Other states | `state-zero-{390,320}.png`, `state-one-{390,320}.png`, `state-two-{390,320}.png`, `state-dense-all-{390,320}.png` |
| Record mode | `record-gym-b-{390,320}.png`, `performance-rows-{390,320}.png`, `performance-row-focus-390.png`, `performance-sheet-{390,320}.png` |
| Reduced motion | `reduced-media-{390,320}.png`, `reduced-setting-390.png`, and with the toggle on `reduced-e1rm-on-media-{390,320}.png`, `reduced-e1rm-on-setting-390.png` |
| Draw-in frames at 0, 120, 240, 360, 480 ms (320, e1RM on is not part of this set) | `draw-frame-000ms-320.png` … `draw-frame-480ms-320.png`, `draw-frames-contact-320.png` |
| Other widths | `width-375.png`, `width-393.png`, `width-430.png`, `width-768.png`, `width-1280.png` |

Re-run script and its last log: `~/Library/Caches/DanDev/nxtfrm/ascension/charts-verify.mjs`, `charts-verify-output.txt` (kept outside the repo; add `--inject=file.css` to try CSS before it is in `strata.css`). The pre-revision script is next to it as `charts-verify.before-e1-toggle.mjs`.

## 8. Limitations and follow-ups

- **With e1RM on, the scale includes the estimate**, which sits about 30–40 % above the load it comes from for 8–12 rep sets, so the measured line is flatter there (9% of the plot height for the seed's 28 → 30.5 kg). With the D51 headroom and at most four ticks the on-scale for that seed is 22–50 (ticks 30 / 40 / 50); allowing five ticks would tighten it to about 25–46. That is the cost of opting in, and it is why the default is off.
- **Chrome only.** There is no WebKit build in this environment (and installing one is a download) and no `simctl`, so iOS Safari was not run. Everything used is already in the app elsewhere (SVG filter with `userSpaceOnUse`, `paint-order`, `color-mix`, `:has`, `transform-box`, `IntersectionObserver`, pointer events). Worth one pass on a real iPhone before release.
- **Hover does not scrub** with a mouse (a click or drag does), matching the weight chart. There is no "Latest" button after a touch scrub; tapping the right-hand end selects the latest, and a range change resets it.
- **Best ring** only appears when the all-time best session is inside the plotted range. The hidden summary and the range pill cover the other case.
- **`NXT.strengthItems()` caps at 24 lift/gym pairs** (existing behaviour), so a lift beyond that cannot be opened from Performance because it is not listed there.
- **Seed data** is older than 28 days, so the Train sheet's cue reads "Re-establish your baseline" in screenshots; that is the existing engine copy, not part of this slice.
- **Release**: `premium-ui.js` and `strata.css` changed; the next `RELEASE` / `sw.js` bump carries them. No new file to precache.

## 9. Revision 1 — e1RM is an opt-in toggle (coordinator request)

**Why.** The first version drew the e1RM line by default on the same kg axis as the measured loads. The estimate sits 10–30 kg above the best sets, so the Y domain stretched and the measured series flattened into the bottom of the plot (the seed's 28 → 30.5 kg rise filled about 15% of the plot height). I11 and the weight chart's Projection control keep estimates off by default.

**What changed.**
1. An `e1RM` glass toggle pill next to `Last 12 | All`, **off by default**, remembered for the page session in `NXT.ui.showE1rm` (the weight chart keeps its toggles there too), **nothing written to storage** (verified: localStorage and sessionStorage are identical before and after switching it on).
2. **Off**: the kg domain follows the measured best-set loads only (D2), with the D51 headroom rule (`.6` of a step each side); no dashed line, no label. **On**: the domain expands to include the estimates, and the dashed line draws with its "e1RM · estimate" label and the stem from each estimate to its best set.
3. **Readout**: the third row ("e1RM N kg · estimate", or "No e1RM estimate for this session") is shown only while the toggle is on; its space is reserved so nothing moves. The hidden text summary and the svg label mention the estimate only while it is drawn.
4. A lift with no estimate at all (every set above 15 reps) has no toggle. The one-session text state gets the toggle too and shows its estimate line only when on.
5. Layout: the heading is `HISTORY · GYM A`; with the range control present the controls sit on the next row (`Last 12 | All` left, toggle right), otherwise the toggle is on the heading row.

**Measured effect (Chrome, 390 × 844).**

| Sheet | e1RM off (default) | e1RM on |
|---|---|---|
| Incline Dumbbell Press, 3 sessions (28 / 28 / 30.5 kg) | ticks 28 29 30 31; the rise fills 68% of the plot (was about 15%) | ticks 30 40 50; the rise fills 9% |
| 15-session lift, Last 12 | ticks 35 40 45 50; 68% | ticks 40 50 60 70; 28% |

**Checks updated.** The default-off assertions replace the old always-on ones; new assertions cover the domain change with the toggle (default off, on, and back off restores the exact ticks), the readout row, the text summary, `NXT.ui` memory and storage immutability, keyboard operation and focus, scrub / keys / Escape with the toggle on and off, the one-session, mixed (a >15-rep session) and high-rep-only states, the toggle beside the range control at 390, 375, 393, 430, 768, 1280 and 320, reduced motion with the toggle switched on, and contrast for both toggle states. Everything is in the log below (272 assertions, up from 197), and the full suites are green (586 tests).

**Re-shot.** `focus-selection-430.png`, `train-sheet-chart-390.png` (and 320), `state-many-390.png` with `state-many-e1rm-on-390.png`, plus `focus-selection-e1rm-on-430.png` and `train-sheet-chart-e1rm-on-390.png`.

## Appendix A — full browser verification log (272 assertions, after revision 1)

```

TRAIN · Exercise Details · 390x844
  ok    Train is on Incline Dumbbell Press at Gym A
  ok    the Train title button opens the sheet with a History section
  ok    History sits between the Target/Rest/Increment row and Recent sessions
  ok    Train mode keeps Swap exercise and the equipment-note button
  ok    facts row unchanged in Train: Target · Rest · Increment · Equipment
  ok    svg is role=img with aria-label and a matching <title>: "Best working set per session, Incline Dumbbell Press at Gym A: 3 sessions from 16 Jul to 3…"
  ok    hidden text summary (e1RM off, so no estimate in it): "3 sessions from 16 Jul to 3 Aug, best 30.5 kg × 12 on 3 Aug. Best set per session: 16 Jul 28 kg × 12; 25 Jul 28 kg × 12; 3 Aug 30.5 kg × 12.…"
  ok    the summary is visually hidden (1×1 box)
  ok    3 sessions drawn: 3 dots, a line and an area
  ok    e1RM is OFF by default: no dashed line and no label on the plot
  ok    with e1RM off the kg scale follows the measured loads only: ticks 28 29 30 31, the 28 → 30.5 kg rise fills 68% of the plot height
  ok    all-time best marked with one ring and the word "Best"
  ok    reps shown under every point: 12 12 12
  ok    y axis: 4 ticks (28 29 30 31) with a separate kg unit, all inside the left gutter
  ok    x axis labels first and last session: 16 Jul … 3 Aug
  ok    plot drawn at its measured width (368 = 368)
  ok    caption says "per session": "Evenly spaced per session · numbers are reps"
  ok    default selection is the latest session, and the readout carries no e1RM while it is off: {"d":"3 Aug","v":"30.5kg×12","c":"Beat last time","e":""}
  ok    live readout line: "3 Aug · 30.5 kg × 12 · Beat last time"
  ok    3 sessions: no range pill
  ok    e1RM glass toggle: present, off (aria-pressed=false), text "e1RM", name "Estimated one-rep max, e1RM"
  ok    toggle is a 44px glass capsule on the heading row, inside the sheet
  ok    toggle text contrast (off) 12.21:1
  ok    text contrast ≥ 4.5:1 on all 13 text styles (min 5.15)
  ok    chart text stays ≥ 10.5px at 390px (ytick:11px yunit:10.5px ax:11px reps:11.5px best:11px)
  ok    no horizontal overflow (document true, sheet true)
  ok    draw-in ran (11 animations, none held back once visible)
  ok    draw-in finishes within 480 ms (longest ends at 460 ms)
  ok    keyframe easing is cubic-bezier(.32,.72,0,1): cubic-bezier(0.32, 0.72, 0, 1)
  ok    pointerdown on the first dot → "16 Jul · 28 kg × 12 · First session"
  ok    pointermove to the second dot → "25 Jul · 28 kg × 12 · Matched last time"
  ok    pointermove to the third dot → "3 Aug · 30.5 kg × 12 · Beat last time"
  ok    the visible readout follows the selection
  ok    the selection marker sits on the selected dot
  ok    a hover without a drag leaves the selection alone
  ok    a mouse drag right-to-left ends on the first session: "16 Jul · 28 kg × 12 · First session"
  ok    scrubbing does not drag the sheet closed
  ok    End selects the latest session
  ok    ArrowLeft moves back one session
  ok    ArrowLeft stops at the first session
  ok    ArrowRight moves forward
  ok    Escape clears the selection back to the latest and keeps the sheet open
  ok    a second Escape (nothing to clear) closes the sheet as before
  ok    reopened: still off by default (aria-pressed=false, NXT.ui.showE1rm=undefined)
  ok    a real click switches it on and NXT.ui remembers it (aria-pressed=true, NXT.ui.showE1rm=true)
  ok    on: the e1RM dashed line (dasharray 2px, 5px) draws with its label "e1RM · estimate"
  ok    on: the domain expands (ticks 28 29 30 31 → 30 40 50; the measured rise falls from 68% to 9% of the plot)
  ok    on: the readout row reads "e1RM 42.7 kg · estimate" and the text summary names the estimate
  ok    switching it on writes nothing to localStorage or sessionStorage
  ok    toggle text contrast (on) 11.92:1, 44px tall
  ok    switching it on replays the draw-in (13 animations, longest ends at 460 ms)
  ok    on: scrub gives the same readouts ("16 Jul · 28 kg × 12 · First session" | "25 Jul · 28 kg × 12 · Matched last time" | "3 Aug · 30.5 kg × 12 · Beat last time")
  ok    on: the e1RM row follows the selection
  ok    on: selecting the first session shows its own estimate (39.2 kg)
  ok    on: End then ArrowLeft still move the selection
  ok    on: Escape clears the selection and keeps the sheet open
  ok    Space on the focused toggle switches it off again and the scale returns to 28 29 30 31
  ok    focus stays on the toggle across the redraw
  ok    Enter switches it on
  ok    Escape on the toggle closes the sheet as before
  ok    the choice is remembered for the page session (reopened sheet starts with e1RM on)
  ok    and it can be switched off for the rest of the session
  ok    no page errors or console errors

TRAIN · Exercise Details · 320x568
  ok    Train is on Incline Dumbbell Press at Gym A
  ok    the Train title button opens the sheet with a History section
  ok    History sits between the Target/Rest/Increment row and Recent sessions
  ok    Train mode keeps Swap exercise and the equipment-note button
  ok    facts row unchanged in Train: Target · Rest · Increment · Equipment
  ok    svg is role=img with aria-label and a matching <title>: "Best working set per session, Incline Dumbbell Press at Gym A: 3 sessions from 16 Jul to 3…"
  ok    hidden text summary (e1RM off, so no estimate in it): "3 sessions from 16 Jul to 3 Aug, best 30.5 kg × 12 on 3 Aug. Best set per session: 16 Jul 28 kg × 12; 25 Jul 28 kg × 12; 3 Aug 30.5 kg × 12.…"
  ok    the summary is visually hidden (1×1 box)
  ok    3 sessions drawn: 3 dots, a line and an area
  ok    e1RM is OFF by default: no dashed line and no label on the plot
  ok    with e1RM off the kg scale follows the measured loads only: ticks 28 29 30 31, the 28 → 30.5 kg rise fills 68% of the plot height
  ok    all-time best marked with one ring and the word "Best"
  ok    reps shown under every point: 12 12 12
  ok    y axis: 4 ticks (28 29 30 31) with a separate kg unit, all inside the left gutter
  ok    x axis labels first and last session: 16 Jul … 3 Aug
  ok    plot drawn at its measured width (298 = 298)
  ok    caption says "per session": "Evenly spaced per session · numbers are reps"
  ok    default selection is the latest session, and the readout carries no e1RM while it is off: {"d":"3 Aug","v":"30.5kg×12","c":"Beat last time","e":""}
  ok    live readout line: "3 Aug · 30.5 kg × 12 · Beat last time"
  ok    3 sessions: no range pill
  ok    e1RM glass toggle: present, off (aria-pressed=false), text "e1RM", name "Estimated one-rep max, e1RM"
  ok    toggle is a 44px glass capsule on the heading row, inside the sheet
  ok    toggle text contrast (off) 12.21:1
  ok    text contrast ≥ 4.5:1 on all 13 text styles (min 5.15)
  ok    chart text stays ≥ 10.5px at 320px (ytick:11px yunit:10.5px ax:11px reps:11.5px best:11px)
  ok    no horizontal overflow (document true, sheet true)
  ok    draw-in ran (11 animations, none held back once visible)
  ok    draw-in finishes within 480 ms (longest ends at 460 ms)
  ok    keyframe easing is cubic-bezier(.32,.72,0,1): cubic-bezier(0.32, 0.72, 0, 1)
  ok    pointerdown on the first dot → "16 Jul · 28 kg × 12 · First session"
  ok    pointermove to the second dot → "25 Jul · 28 kg × 12 · Matched last time"
  ok    pointermove to the third dot → "3 Aug · 30.5 kg × 12 · Beat last time"
  ok    the visible readout follows the selection
  ok    the selection marker sits on the selected dot
  ok    a hover without a drag leaves the selection alone
  ok    a mouse drag right-to-left ends on the first session: "16 Jul · 28 kg × 12 · First session"
  ok    scrubbing does not drag the sheet closed
  ok    End selects the latest session
  ok    ArrowLeft moves back one session
  ok    ArrowLeft stops at the first session
  ok    ArrowRight moves forward
  ok    Escape clears the selection back to the latest and keeps the sheet open
  ok    a second Escape (nothing to clear) closes the sheet as before
  ok    reopened: still off by default (aria-pressed=false, NXT.ui.showE1rm=undefined)
  ok    a real click switches it on and NXT.ui remembers it (aria-pressed=true, NXT.ui.showE1rm=true)
  ok    on: the e1RM dashed line (dasharray 2px, 5px) draws with its label "e1RM · estimate"
  ok    on: the domain expands (ticks 28 29 30 31 → 30 40 50; the measured rise falls from 68% to 9% of the plot)
  ok    on: the readout row reads "e1RM 42.7 kg · estimate" and the text summary names the estimate
  ok    switching it on writes nothing to localStorage or sessionStorage
  ok    toggle text contrast (on) 11.92:1, 44px tall
  ok    switching it on replays the draw-in (13 animations, longest ends at 460 ms)
  ok    on: scrub gives the same readouts ("16 Jul · 28 kg × 12 · First session" | "25 Jul · 28 kg × 12 · Matched last time" | "3 Aug · 30.5 kg × 12 · Beat last time")
  ok    on: the e1RM row follows the selection
  ok    on: selecting the first session shows its own estimate (39.2 kg)
  ok    on: End then ArrowLeft still move the selection
  ok    on: Escape clears the selection and keeps the sheet open
  ok    Space on the focused toggle switches it off again and the scale returns to 28 29 30 31
  ok    focus stays on the toggle across the redraw
  ok    Enter switches it on
  ok    Escape on the toggle closes the sheet as before
  ok    the choice is remembered for the page session (reopened sheet starts with e1RM on)
  ok    and it can be switched off for the rest of the session
  ok    no page errors or console errors

STATES + RECORD MODE · 390x844
  ok    0 sessions: "No sessions yetLog a working set of Fixture Zero at Gym A an…", no chart
  ok    1 session: the single reading as text, no line — "60kg×8 10 Oct · the only session so far"
  ok    1 session: the estimate line is hidden until the e1RM toggle is on
  ok    1 session: switched on it reads "e1RM 76 kg · estimate"
  ok    2 sessions: a line between two points (2 dots), no range pill
  ok    2 sessions readout: "7 Oct · 82.5 kg × 5 · Beat last time"
  ok    sets over 15 reps carry no estimate (Performance rule), so there is no e1RM toggle to switch on and nothing to read
  ok    and the text summary does not invent one
  ok    mixed lift (one session with only >15-rep sets): the toggle is there and the dashed line is drawn over the sessions that have an estimate
  ok    selecting the >15-rep session says so: "No e1RM estimate for this session"
  ok    and the next session reads its own estimate (63 kg)
  ok    15 sessions: segmented range "Last 12 | All", Last 12 pressed
  ok    range pills are ≥ 44px targets (76×64 wide, 44/44 tall)
  ok    the e1RM toggle sits next to "Last 12 | All" on one row under the heading (107×44), off by default
  ok    default range draws the last 12 sessions (12 dots)
  ok    reps under each point at 390px: 12 shown
  ok    summary counts the visible range: "12 sessions from 12 Jun to 19 Sept, best 50 kg × 12 on 1 Sept. Best se…"
  ok    15 sessions, Last 12: off ticks 35 40 45 50 (measured line fills 68% of the plot) → on ticks 40 50 60 70 (28%)
  ok    and back off
  ok    All draws all 15 sessions and flips the pressed state
  ok    a range change replays the draw-in
  ok    a range change resets the selection to the latest: "19 Sept · 45 kg × 11 · Below last time"
  ok    back to Last 12
  ok    at most one ring for the all-time best (1; visible in range)
  ok    the toggle and the range are independent: All stays selected when e1RM is switched on
  ok    switched on in one sheet, the next lift opens with e1RM on (page-session memory)
  ok    60 sessions on All: small dots (r=2.2) and only the selected numeral (1)
  ok    dates carry the year only when it differs from today's: 8 Sept 2025 … 28 Aug
  ok    Gym B record: 3 sessions of its own, "History · Gym B", "29 Sept · 110 kg × 8 · Beat last time"
  ok    record from another gym: no Swap button, no coaching cue computed for the wrong gym (blocks: History · Gym B / Recent sessions)
  ok    record mode shows no plan facts for a lift that is not in today's plan (0 fact tile)
  ok    Gym A record: only its single session ("70kg×108 Oct · the only session so fare1RM 93.3 kg"), Gym B sessions not merged in
  ok    an alias name ("Incline DB Press") is not merged into Incline Dumbbell Press
  ok    no page errors or console errors

STATES + RECORD MODE · 320x568
  ok    0 sessions: "No sessions yetLog a working set of Fixture Zero at Gym A an…", no chart
  ok    1 session: the single reading as text, no line — "60kg×8 10 Oct · the only session so far"
  ok    1 session: the estimate line is hidden until the e1RM toggle is on
  ok    1 session: switched on it reads "e1RM 76 kg · estimate"
  ok    2 sessions: a line between two points (2 dots), no range pill
  ok    2 sessions readout: "7 Oct · 82.5 kg × 5 · Beat last time"
  ok    sets over 15 reps carry no estimate (Performance rule), so there is no e1RM toggle to switch on and nothing to read
  ok    and the text summary does not invent one
  ok    mixed lift (one session with only >15-rep sets): the toggle is there and the dashed line is drawn over the sessions that have an estimate
  ok    selecting the >15-rep session says so: "No e1RM estimate for this session"
  ok    and the next session reads its own estimate (63 kg)
  ok    15 sessions: segmented range "Last 12 | All", Last 12 pressed
  ok    range pills are ≥ 44px targets (76×64 wide, 44/44 tall)
  ok    the e1RM toggle sits next to "Last 12 | All" on one row under the heading (107×44), off by default
  ok    default range draws the last 12 sessions (12 dots)
  ok    reps under each point at 320px: 12 shown
  ok    summary counts the visible range: "12 sessions from 12 Jun to 19 Sept, best 50 kg × 12 on 1 Sept. Best se…"
  ok    15 sessions, Last 12: off ticks 35 40 45 50 (measured line fills 68% of the plot) → on ticks 40 50 60 70 (28%)
  ok    and back off
  ok    All draws all 15 sessions and flips the pressed state
  ok    a range change replays the draw-in
  ok    a range change resets the selection to the latest: "19 Sept · 45 kg × 11 · Below last time"
  ok    back to Last 12
  ok    at most one ring for the all-time best (1; visible in range)
  ok    the toggle and the range are independent: All stays selected when e1RM is switched on
  ok    switched on in one sheet, the next lift opens with e1RM on (page-session memory)
  ok    60 sessions on All: small dots (r=1.6) and only the selected numeral (1)
  ok    dates carry the year only when it differs from today's: 8 Sept 2025 … 28 Aug
  ok    Gym B record: 3 sessions of its own, "History · Gym B", "29 Sept · 110 kg × 8 · Beat last time"
  ok    record from another gym: no Swap button, no coaching cue computed for the wrong gym (blocks: History · Gym B / Recent sessions)
  ok    record mode shows no plan facts for a lift that is not in today's plan (0 fact tile)
  ok    Gym A record: only its single session ("70kg×108 Oct · the only session so fare1RM 93.3 kg"), Gym B sessions not merged in
  ok    an alias name ("Incline DB Press") is not merged into Incline Dumbbell Press
  ok    no page errors or console errors

PROGRESS › PERFORMANCE → Exercise Details · 390x844
  ok    every visible Performance row (5) carries an open-details button
  ok    row targets are ≥ 44px tall (smallest 93px)
  ok    Enter on the first row opens its sheet: "Fixture One"
  ok    it shows that row's gym: "History · Gym A"
  ok    opened from Performance, the sheet offers no Swap or equipment-note action (they act on today's session)
  ok    sheet content present: single-session text
  ok    Escape closes the sheet and focus returns to the row button on the Performance tab
  ok    Fixture Two (2 sessions) is listed in Performance
  ok    touch tap on a Performance row opens its chart: "Fixture Two", 2 points, "7 Oct · 82.5 kg × 5 · Beat last time"
  ok    Fixture Gym appears as two rows (one per gym): Gym A, Gym B
  ok    touch tap on the Gym A row → History · Gym A (single session text)
  ok    touch tap on the Gym B row → History · Gym B (3 points)
  ok    no page errors or console errors

PROGRESS › PERFORMANCE → Exercise Details · 320x568
  ok    every visible Performance row (5) carries an open-details button
  ok    row targets are ≥ 44px tall (smallest 90px)
  ok    Enter on the first row opens its sheet: "Fixture One"
  ok    it shows that row's gym: "History · Gym A"
  ok    opened from Performance, the sheet offers no Swap or equipment-note action (they act on today's session)
  ok    sheet content present: single-session text
  ok    Escape closes the sheet and focus returns to the row button on the Performance tab
  ok    Fixture Two (2 sessions) is listed in Performance
  ok    touch tap on a Performance row opens its chart: "Fixture Two", 2 points, "7 Oct · 82.5 kg × 5 · Beat last time"
  ok    Fixture Gym appears as two rows (one per gym): Gym A, Gym B
  ok    touch tap on the Gym A row → History · Gym A (single session text)
  ok    touch tap on the Gym B row → History · Gym B (3 points)
  ok    no page errors or console errors

REDUCED MOTION (media query) · 390x844
  ok    no draw class and no running animation (0)
  ok    final state is shown at once: line dasharray none, offset 0px, opacities 1/1/1
  ok    e1RM is off by default under reduced motion too (no dashed line yet)
  ok    screenshot taken straight after open, no waiting for motion
  ok    switching e1RM on under reduced motion shows the final state at once: no animation (0), the estimate dashed (2px, 5px) and labelled
  ok    no page errors or console errors

REDUCED MOTION (app setting) · 390x844
  ok    no draw class and no running animation (0)
  ok    final state is shown at once: line dasharray none, offset 0px, opacities 1/1/1
  ok    e1RM is off by default under reduced motion too (no dashed line yet)
  ok    screenshot taken straight after open, no waiting for motion
  ok    switching e1RM on under reduced motion shows the final state at once: no animation (0), the estimate dashed (2px, 5px) and labelled
  ok    no page errors or console errors

REDUCED MOTION (media query) · 320x568
  ok    no draw class and no running animation (0)
  ok    final state is shown at once: line dasharray none, offset 0px, opacities 1/1/1
  ok    e1RM is off by default under reduced motion too (no dashed line yet)
  ok    screenshot taken straight after open, no waiting for motion
  ok    switching e1RM on under reduced motion shows the final state at once: no animation (0), the estimate dashed (2px, 5px) and labelled
  ok    no page errors or console errors

RESIZE while the sheet is open
  ok    the plot is redrawn at the new width (368 → 298)
  ok    the selection survives the redraw
  ok    no horizontal overflow after the resize

EXTRAS · draw-in frames, sheet-drag conflict, touch scrub, hold-until-visible, escaping, planned lift
  ok    chart below the fold at open: draw-in is held (is-wait) and nothing runs yet ({"draw":true,"wait":true,"running":0})
  ok    scrolling the plot into view releases the held draw-in
  ok    no page errors
  ok    a plot that stays off screen is released after 3 s (held true → false), so it can never stay blank
  ok    tall phone: the plot is on screen with the sheet at scrollTop 0 ({"top":0,"plotTop":790,"plotBottom":1026,"vh":1500})
  ok    a downward-drifting scrub does not move the sheet (transform "")
  ok    and the sheet stays open
  ok    a real touch drag across the plot scrubs it: "16 Jul · 28 kg × 12 · First session"
  ok    and the horizontal drag does not scroll the sheet
  ok    the focused plot shows a 2px solid focus ring
  ok    a programmatic toggle keeps focus on the plot, selection kept, e1RM drawn
  ok    no page errors
  ok    a lift whose name has quotes, an ampersand and tags is listed intact
   debug {"title":"Cable 'Fly' <i>3</i> & \"Press\"","inject":false,"dots":2,"label":"Best working set per session, Cable 'Fly' <i>3</i> & \"Press\" at Gym A: 2 sessions from 8 Oct to 11 Oct"}
  ok    the sheet, the chart label and the history use the name as text, never as markup
  ok    a lift in today's plan, opened from elsewhere, keeps its plan facts (Target · Rest · Increment · Equipment) but no session actions
  ok    no page errors

OTHER WIDTHS · 375, 393, 430, 768, 1280 (sheet, plot at its measured width, no overflow)
  ok    375px: the e1RM toggle shares a row with the range control (gap 94px), inside the sheet, 44px tall
  ok    375px: sheet 375px, plot drawn at 353px (host 353), 12 dots, 12 rep numerals, inside the sheet, no overflow
  ok    375px: no page errors
  ok    393px: the e1RM toggle shares a row with the range control (gap 112px), inside the sheet, 44px tall
  ok    393px: sheet 393px, plot drawn at 371px (host 371), 12 dots, 12 rep numerals, inside the sheet, no overflow
  ok    393px: no page errors
  ok    430px: the e1RM toggle shares a row with the range control (gap 149px), inside the sheet, 44px tall
  ok    430px: sheet 430px, plot drawn at 408px (host 408), 12 dots, 12 rep numerals, inside the sheet, no overflow
  ok    430px: no page errors
  ok    768px: the e1RM toggle shares a row with the range control (gap 279px), inside the sheet, 44px tall
  ok    768px: sheet 560px, plot drawn at 538px (host 538), 12 dots, 12 rep numerals, inside the sheet, no overflow
  ok    768px: no page errors
  ok    1280px: the e1RM toggle shares a row with the range control (gap 279px), inside the sheet, 44px tall
  ok    1280px: sheet 560px, plot drawn at 538px (host 538), 12 dots, 12 rep numerals, inside the sheet, no overflow
  ok    1280px: no page errors

272 passed, 0 failed
```
