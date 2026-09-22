# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`ANATOMY CONTRACT + EXERCISE DETAILS`

Implementing model for this repair: **Grok 4.7**. The first run of the slice landed the contract, the motion audit, and Swap Exercise, then stopped before the narrow height cap, the six checks, and this report. This run finished those three and did not reopen the parts already measured.

## Status

`READY FOR REVIEW`. The latest pass is verification only, against D18. Layout CSS and JS were not edited. `RELEASE` and `CACHE_NAME` stay `109`. AI stayed paused. No browser was used. Claude still owns the live measurement.

## D18 — the 0px equality is now a numeric budget

Implementing model: **Grok 4.7**. File touched: `tasks/vnext/verify-train.mjs` only.

The Node layout model cannot reproduce real text wrapping. It was reporting a pass on `assert.strictEqual(on.head, off.head)` while Chromium measures about 13px for *Chest Supported T-Bar Row*. Those strict head and Log Set equalities are gone. For every Full A exercise at 390, 393, 402, 430, 375 and 320 the file now computes the head cost and the Log Set cost with the figure present versus absent, and fails if either cost exceeds **16px at ≥360px** or **10px at ≤359px**. It also fails if the figure adds more than one title line, if the rendered title is not the full name, or if the title is ellipsised, clipped, or line-clamped (`white-space: normal`, `overflow: visible`, `text-overflow` absent or `clip`).

Left in place, still required to pass: one view, the figure `position: absolute`, the button no taller than the 64px row, the title column keeping a full line's width, the long name still wider than the column a full figure would leave at 390, 393 and 375, aim-strip clearance, the 320 title test, reduced motion, both size caps, crop aspect against `NXTANAT.cropFor`, and no figure for an unmapped name.

The approved browser case — about 13px head and about 14px Log Set at 390/393/375, about 7px at 320, 0px at 402/430 — is recorded in the file as Chromium's measurement. This file asserts the budget. It does not pretend to simulate that wrap.

`vnext.css` still says "0px of vertical height" in the anatomy comment. That sentence was left as it stands. This task did not change layout behaviour.

Round 2, below, is the layout work that was already in the tree. This pass did not reopen it.

## Round 2 — the figure was narrowing the title

"Chest Supported T-Bar Row" at 390 wrapped to a second line only because the figure held ~72px of horizontal space. The head went from 64px to 77px and Log Set moved down. Hiding the figure with `visibility: hidden` changed nothing; `display: none` let the title fit on one line again. The figure's own height was not the cost.

The text column's floor is now `min(100%, max-content)`, and the row is a flex line. The title lays out as wide as it would with the figure gone. The figure is `flex: 0 1 auto` with `min-width: 0`, so it takes only the remainder and can shrink to zero. The title is `width: auto` and `max-width: 100%` — it wraps, it is not ellipsised. The svg is `width: 100%` of that button with `aspect-ratio: var(--nxa-ar)`, so a yielded figure scales instead of being clipped.

The base button rule now has `height: 64px` and `max-height: 64px`, the same kind of cap the 359px block already had at 56px. `align-self` is `flex-start`, so a taller text row cannot stretch the control.

Short names still leave the figure at its cap, on the right. The 320 height cap is unchanged. A long name at a narrow width may draw a smaller figure than the cap; the cap is the maximum, and the title outranks it.

The 0px check now walks every Full A exercise, including Leg Press, at all six widths, and it prices an extra title line. The advances for those names are the system UI font at weight 650. The check also asserts that "Chest Supported T-Bar Row" does not fit beside a full figure at 390, 393 and 375, so a short-name-only measurement cannot pass it.

---

## A. Narrow height cap

The figure is `position: absolute`, which is why the head stays 64px with the figure shown or hidden. That also means the svg no longer gives `.nxp-ex-anat` a height. The button is `align-self: stretch`, so it was taking the text row. At 320px that row is the 64px head, and the measured button was 64 × 63.5. The `max-height: 56px` on `.nxa` never applied to the button.

The fix is only inside the existing `@media (max-width: 359px)` rule, on `#trainPage .vn-train-active .nxp-ex-anat`:

- `height: 56px` and `max-height: 56px`
- `width` stays `min(64px, calc(56px * var(--nxa-ar, 1)))`
- `max-width` stays `64px`

The svg stays `position: absolute` and keeps `aspect-ratio: var(--nxa-ar)`. A wide crop such as Incline Dumbbell Press (1.700) still draws at about 64 × 38 when the title does not need the column. The button around it is 64 × 56. A tall crop such as Ab Crunch (0.690) is about 39 × 56. Round 2 added the matching 64px height cap at 360px and above; see the status section.

The head does not grow. 56px is shorter than the 64px text row, and the figure is still out of flow.

---

## B. Anatomy contract already in place

`vnext.css` states the contract above the active-Train rules. Unboxed: no background, border, radius, or shadow. One view, from `viewFor(primary)`, cropped by `cropFor`. `--nxa-ar` is `crop width / crop height`, written to three decimals on the button. The figure still sits in the existing exercise-head row, now as a flex line rather than a `min-content` track.

The row is a flex line. The text column floors at `min(100%, max-content)`. The button's width cap is still `min(72px, calc(64px * var(--nxa-ar)))` from 360px up and `min(64px, calc(56px * var(--nxa-ar)))` below, and its height is 64px or 56px. The svg fills that used box at the crop's aspect. An unmapped name still returns an empty string from `anatomyStrip`, because `musclesFor` has no primary.

---

## C. Motion

`nxp-ex-anat-enter` is opacity only. Exercise change uses `200ms cubic-bezier(.32, .72, 0, 1)` in both `premium-ui.css` and `vnext.css`. `prefers-reduced-motion: reduce` and `[data-nxp-motion="reduced"]` set `animation: none` and `transition: none` on the figure, in both files. The heading's horizontal entrance is unchanged and is already cleared under reduced motion. This run did not edit `premium-ui.css`.

---

## D. Exercise Details

`exerciseDetails()` ends with Swap exercise. The button calls `showSubstituteSheet()`, the same sheet as the mode bar. The note in `premium-ui.js` records the existing behaviour: the sheet writes today's session plan, `closeModal` returns to Train, cancel stays on the same exercise, and history is not rewritten.

The dead band above Primary is the bottom margin `premium-ui.css` puts on `.nxp-detail-anat`. `vnext.css` sets that margin to 0 inside `.n99-modal`. The pair stays `height: 190px`. This run did not edit `premium-ui.js`.

---

## E. The six checks

Added to `tasks/vnext/verify-train.mjs`. No browser. The queue is the Full A list from the programme: Incline Dumbbell Press, Chest Supported T-Bar Row, Leg Press, Hamstring Curl, Cable Lateral Raise, Ab Crunch. Chest Supported T-Bar Row and Hamstring Curl resolve to the back view; the other four resolve to the front. Setting `state.exercise` to a name that is not in that list is reset to Incline Dumbbell Press, which the unmapped check asserts before it puts Mystery Lift into the queue.

The used box is the cascade of `premium-ui.css` then `vnext.css`, with `--nxa-ar` taken from the rendered button. The in-flow head is the 64px text row, plus a line when the title or the muscle line wraps. Log Set is a fixed stack under that row, so it moves only when the head moves. The figure's used width is whatever the title does not need.

| Check | What it asserts |
|---|---|
| Vertical budget (D18) | At 390, 393, 402, 430, 375, and 320, for every Full A exercise, head cost and Log Set cost (figure present versus absent) are ≤16px at ≥360px and ≤10px at ≤359px. At most one extra title line. The rendered title is the full name and is not ellipsised, clipped, or line-clamped. "Chest Supported T-Bar Row" is still wider than the column a full figure would leave at 390, 393 and 375. The svg is `position: absolute`. The button is no taller than 64px. The Node model does not simulate the browser wrap; Chromium remains the authority for that case. |
| Aim strip | The button is `overflow: hidden`. Its box does not intersect Last / Target / Rest at those widths. The svg is not taller than the button. |
| Title at 320 | Chest Supported T-Bar Row is the full string. The title is `white-space: normal`, `overflow: visible`, not ellipsised. The title column is at least 160px and does not meet the figure. The other five names are whole as well. |
| Reduced motion | A real queue step emits `is-forward`. Under `prefers-reduced-motion` the figure and the title resolve to no animation and no transition. The same is true for `data-nxp-motion="reduced"`. With motion allowed, the figure animation is still `nxp-ex-anat-enter` at 200ms. The keyframe is opacity only. |
| Clamps and aspect | At 390 and 360 the button is within 72 × 64 and taller than 60, so the 56px cap has not leaked upward. At 359 and 320 the button is 56px high and at most 64px wide. The svg stays inside the same cap. Its width/height matches `cropFor` within 0.02, and the rendered `viewBox` is that crop. |
| Unmapped | Mystery Lift, once it is actually in the queue, renders no `.nxp-ex-anat` and no `.nxa`. Incline Dumbbell Press in the same queue still renders a figure. |

`verify-train.mjs` is now 21 passed. It was 15 before these six.

---

## F. Files and constraints

| File | What changed |
|---|---|
| `vnext.css` | Anatomy contract. This run: the text column yields to the title, the figure shrinks, the wide button is `height`/`max-height: 64px`, and the svg tracks the used button. The 56px cap at 359px is unchanged. |
| `premium-ui.css` | Opacity-only `nxp-ex-anat-enter`, 200ms ease, reduced-motion blocks. Not edited this run. |
| `premium-ui.js` | `--nxa-ar` and the single `view` passed into `figure()`. Swap exercise in Details. Not edited this run. |
| `tasks/vnext/verify-train.mjs` | The six checks above. |

Not edited: `cut-support.js`, `index.html`, `train-anatomy.js`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*`. `RELEASE` is `109`. `CACHE_NAME` is `nxtfrm-v109-premium-cache`. No new page script or stylesheet.

---

## G. Verification

No browser. No Playwright. `verify-2a.mjs`, `verify-2b.mjs`, `verify-2b-fold.mjs`, `verify-2c.mjs`, `verify-2d.mjs`, and `verify-2e.mjs` launch Chromium, so they were not executed. Claude owns that pass, and the live remeasure of the 56px cap.

```
node --check premium-ui.js                 OK (silent, exit 0)
node --check tasks/vnext/verify-train.mjs  OK (silent, exit 0)
vnext.css braces                           677/677 (comments and strings skipped)
premium-ui.css braces                      818/818
node tasks/vnext/verify-train.mjs          OK  21 passed
node tasks/vnext/verify-2f.mjs             OK  23 passed
node tasks/vnext/verify-2g.mjs             OK  11 passed
node tasks/vnext/verify-2h.mjs             OK  10 passed
```

Sixteen suites, `for f in wearables*.test.js`. Each printed `0 failed`:

| Suite | Passed |
|---|---|
| wearables.adapters.test.js | 32 |
| wearables.canonical.test.js | 24 |
| wearables.days.test.js | 16 |
| wearables.ingest.test.js | 32 |
| wearables.provider-garmin.test.js | 3 |
| wearables.recovery-integration.test.js | 32 |
| wearables.recovery.test.js | 28 |
| wearables.release-gate.test.js | 53 |
| wearables.resolution.test.js | 19 |
| wearables.snapshots.test.js | 26 |
| wearables.store.test.js | 34 |
| wearables.sync.test.js | 47 |
| wearables.test.js | 18 |
| wearables.train-enrichment.test.js | 34 |
| wearables.training-readiness.test.js | 29 |
| wearables.weight-contract.test.js | 31 |

That is 16 suites, 458 tests, 0 failing.

Re-run after the D18 assertion change. Same totals: `verify-train.mjs` 21 passed; sixteen suites, 458 tests, 0 failed. `node --check tasks/vnext/verify-train.mjs` was silent, exit 0.

Not verified here: the live boxes. Chromium's measurement of the long-title wrap is the authoritative check, and the approved case is already inside the budget. At 320 a width-capped crop is still at most 64 × 56. At 360px and above the button is at most 72 × 64. Aim-strip clearance, title legibility, and reduced motion on screen are Claude's.

---

## H. Left for review

Documented, not done.

- `premium-ui.css` still sets `.nxp-ex-anat .nxa` to `height: 84px` and, at 359px, `height: 68px`. `vnext.css` wins on specificity (`#trainPage .vn-train-active …`). The leftovers are what the contract has to override. Removing them was not part of this repair.
- At 359px and below the button is 56px tall even when the svg is shorter. From 360px up it is 64px tall on the same terms. The svg keeps its aspect and sits at the top of the button. The button has no background, so the extra hit area is empty. Claude should measure `.nxp-ex-anat` for the cap and `.nxa` for the aspect. A long name may use less than the width cap; that is the yield, not a broken cap.
- `NXT.training()` in `cut-support.js` still builds its own log form. The live screen is `renderTrain = NXP.training`. Deleting the legacy renderer is D5 and was not in scope.

Not committed. Not pushed.
