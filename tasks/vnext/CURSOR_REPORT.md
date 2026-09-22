# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`TRAIN COMPLETION + DEEP POLISH`

Implementing model: **Grok 4.7** (this session). The pinned Opus model was not used.

## Status

`READY FOR REVIEW` — two gaps only. Log Set docks above the keyboard while `weightInput` or `repsInput` is focused, and returns to the form on blur. Date inputs get one shared shrink rule, and date-containing grids stack at 375px. The working loop, input contract, receding nav, queue, previous/target, rest timer, completion and anatomy were not rebuilt. Cursor-owned checks are green. Keyboard geometry, iOS date paint, the native picker, greyscale rendering, and 390/393/402/430/375/320 plus reduced heights are Claude's. No browser was used. `RELEASE` and `CACHE_NAME` stay `109`.

---

## A. Keyboard dock

The same `#nxp-log-button` leaves document flow only while a numeric field is focused and the button would sit under the keyboard or below the visual viewport. It is not a second button. `NXP.logSet()` is unchanged and still calls `base.logSet()`, which still reads `val('weightInput')`, `val('repsInput')`, `val('n99-set-type')` and `val('n99-rir')`. A value edited while the button is docked is the value that is stored.

`keyboardBottom(layout, view, offset, safe, nav)` treats an overlap greater than 40px as the keyboard. The button then sits `overlap + 8` above the layout bottom. That gap is not added to the safe area or the nav, because the keyboard already covers the home indicator. With no keyboard the offset is `max(8, safe-area) + nav clearance`. A receded nav (`.tabs.vn-recede`) contributes 0. `z-index` is 70, under the tabs (80) and under sheets.

`visualViewport` supplies height, `offsetTop` and `offsetLeft`. The button's `left` and `width` follow the form, plus `offsetLeft`. If `visualViewport` is missing, overlap is 0 and a button whose rectangle is outside the layout viewport still docks, using the safe area and any nav that is actually on screen. The no-viewport case was run with `innerHeight` 420, a receded nav, and the button rectangle below the fold: `--nxp-kb-bottom` was `8px`.

Focus on `weightInput` or `repsInput` docks. Focus elsewhere does not. Blur waits 320ms, then undocks, unless the pointer is still on the docked button or focus has returned to a numeric field. `mousedown` on the docked button calls `preventDefault` so iOS does not blur the field before the click. The form keeps `padding-bottom: calc(50px + var(--vn-s3))` while docked so the history does not jump. If the focused field or an active `.vn-rest` would sit under the dock, the page scrolls. Stepper height stays 52px. Segment buttons stay 44px. The CTA stays 50px. Nothing in the hierarchy was reordered, and set type and RIR stay in the form.

The dock rule is `transition: none` in every motion setting. `prefers-reduced-motion: reduce` and `data-nxp-motion="reduced"` also clear the press scale. The class is `.is-kb` on the existing button and on `#nxp-set-form`. `nxp-log-action` and `--nxt-cta-keyboard` were not reintroduced. The fixed positioning is in `vnext.css`, not in the V107 block of `premium-ui.css` that the release gate scans.

A docked log and an inline log of 82.5 kg × 8, working, RIR 2, produced the same `date`, `dayType`, `gym`, `exercise`, `setNum`, `weight`, `reps`, `setType`, `rir` and `volume`. Changing the field to 90 while docked stored 90.

---

## B. Date inputs

The overlap does not come from the grid. `cut-support.css` already uses `minmax(0, 1fr)` and `min-width: 0`, and that file was not edited. The native iOS date widget keeps an intrinsic minimum width that `width: 100%` does not defeat. `vnext.css` loads last and the sheets live in `#modalRoot`, outside any page id, so the rule is unscoped and written once:

`appearance: none` and `-webkit-appearance: none`, `box-sizing: border-box`, `display: block`, `width` and `max-width` 100%, `min-width: 0`, `min-inline-size: 0`, `min-height: 44px`, `overflow: hidden`. The WebKit date inner parts also get `min-width: 0`. The rule sets no `font-size`. It does not hide `::-webkit-calendar-picker-indicator`. The inputs stay `type="date"`, so the native picker is still the control that opens.

At `max-width: 375px`, only a grid that contains a date stacks to one column: `.n99-form-grid`, `.grid2` and `.bw-safe-row`, using `:has(input[type="date"])` and `!important` so it beats the existing `!important` columns. Other two-column sheets are left as they are. `.n99-form-grid.four` has no date and is not stacked by this rule.

`premium-ui.css` was not the right layer. It does not cover every sheet, and `vnext.css` would override it anyway.

All eight ids are still `type="date"` in `cut-support.js` or `index.html`: `apx95WeightDate`, `apx95EditDate`, `n99-waist-date`, `n99-edit-weight-date`, `n99-move-date`, `editSetDate`, `bwDate`, `scanDate`. The live Log bodyweight field is the `cut-support.js` `apx95WeightDate` inside `.n99-form-grid`, beside Weight · kg. This environment cannot paint the iOS widget. Claude needs to confirm the overlap is gone and that the picker still opens, at 375 and below as well as at the wider widths.

---

## C. Left as it was

Section 3 was checked, not rebuilt.

`verify-train.mjs` drives the live `NXP.logSet()` and `NXP.training()` with a three-exercise plan (Flat Dumbbell Press, Lat Pulldown, Mystery Lift), Gym A and Gym B, and yesterday's history. Evidence from that run:

| Check | Result |
|---|---|
| Working sets | set numbers 1, 2, 3 on Flat Dumbbell Press, then the exercise becomes Lat Pulldown |
| Extra set | a fourth working set on the press asks `confirm` and, when declined, writes nothing |
| Warm-up | two warm-ups are set numbers 1 and 2; the following working set is still set number 1 |
| RIR | absent stores `null`; `2`, `3` and `4` store those numbers; volume of 62.5 × 9 is 563 |
| History | yesterday at Gym A is 30.5 kg; Gym B's history is separate; Mystery Lift has none and the screen says *First session* |
| Gyms | a working set at Gym A does not count as `N.done` at Gym B; the Gym B record keeps `gym: "Gym B"` |
| Timer | a future `apx96RestEnd` paints `is-active`, `+30s` and Skip |
| Queue | `NXP.queue()` lists Lat Pulldown and Mystery Lift; the working screen's control says Queue |
| Several sets | two `nxp-set-row` buttons, including a `W` / *Warm-up* row |
| Anatomy on screen | Flat Dumbbell Press includes `nxp-ex-anat` and Chest; Mystery Lift includes neither |

The input ids in the rendered form are still `weightInput`, `repsInput`, `n99-set-type`, `n99-rir` and `nxp-log-button`. The submit class string is still `n99-button nxp-train-cta`.

---

## D. Add-on day type

`ADDON_DAYS` is Rest, Zone2 and Cardio. Floorball is not eligible.

For Rest, Zone2 and Cardio the script set `settings.dayOverrides` to that type, called `NXP.addOnAdd('Flat Dumbbell Press')`, logged a working set, then set `state.dayType` back through `resolveDayType(date)`. After the add, after the log, and after that refresh, `state.dayType` was still the planned type. The stored set's `dayType` was that same type. The add-on remained under `` `${date}__Gym A__${type}` ``. Nothing wrote `dayOverrides`, `weeklyPlan` or `sessionPlans`.

`NXP.addOnAdd` on Floorball returned without writing. `state.dayType` stayed Floorball and `state.addOns` stayed empty.

---

## E. Greyscale

No colour-only encoding was added. The existing distinctions, still in the source:

| State | Encoding |
|---|---|
| Upcoming rail segment | track at `rgba(255,255,255,.09)` |
| Completed rail segment | solid `--vn-violet` |
| Current rail segment | lighter track, plus a `::after` whose width is `--p` |
| Warm-up row | badge `W` and the word *Warm-up* |
| Working row | the set number, and RIR copy when RIR was stored |
| Selected segment | `aria-pressed="true"` and an inset 1px ring |
| Disabled nav control | the `disabled` attribute and `opacity: .35` |

One residual, left in place because the rail was not part of the two gaps: a current segment at `--p: 100%` is filled with the same violet as a completed segment. Position in the rail still differs, and the exercise head names the current movement. Claude's `filter: grayscale(1)` pass should look at that pair specifically.

---

## F. Files and constraints

| File | What changed |
|---|---|
| `premium-ui.js` | Keyboard-dock helpers, `bindKeyboardDock()`, and `keyboardBottom` on the NXP export. `logSet()`, the form order, the input ids, anatomy and add-ons were not changed. |
| `vnext.css` | Dock rules on `.is-kb` inside the Train block. Shared `input[type="date"]` rules at the end of the file. |
| `tasks/vnext/verify-train.mjs` | New. Realistic fixtures, no browser. |

Not edited: `premium-ui.css`, `cut-support.js`, `index.html`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*`, `train-anatomy.js`. `RELEASE` is `109`. `CACHE_NAME` is `nxtfrm-v109-premium-cache`. No new page script or stylesheet, so the offline shell did not need a new URL.

Anatomy CSS is untouched: `#trainPage .vn-train-active .nxp-ex-anat` is still `max-width: 72px`, and `.nxa` is still `height: 64px`. That block has no animation, pulse or glow. `NXTLIB.musclesFor('Flat Dumbbell Press')` includes `chest`. `musclesFor('Mystery Lift')` returns empty primary and secondary, and `has('Mystery Lift')` is false.

The dock CSS sits above the Phase 2G marker. The date rules sit inside the slice `verify-2g` reads from `Phase 2G — Progress` to the end of `vnext.css`. That slice still has no `linear-gradient`. `verify-2g` passed.

---

## G. Verification

Cursor did not open a browser and did not run Playwright. `verify-2a`, `verify-2b`, `verify-2b-fold`, `verify-2c`, `verify-2d` and `verify-2e` import Playwright and launch Chromium. They were not executed. They were not edited. Claude owns that pass, including keyboard geometry at reduced heights and the six widths.

```
node --check premium-ui.js                 OK (silent, exit 0)
node --check tasks/vnext/verify-train.mjs  OK (silent, exit 0)
vnext.css braces                           666/666 (comments and strings skipped)
node tasks/vnext/verify-train.mjs          OK  15 passed
node tasks/vnext/verify-2f.mjs             OK  23 passed
node tasks/vnext/verify-2g.mjs             OK  11 passed
node tasks/vnext/verify-2h.mjs             OK  10 passed
```

Sixteen suites, enumerated as `wearables*.test.js` (no dot). Each printed `0 failed`. The pass counts were 32, 24, 16, 32, 3, 32, 28, 53, 19, 26, 34, 47, 18, 34, 29, 31. That is 16 suites, 458 tests, 0 failing. The release-gate suite (53) is in that run, including the in-flow Train assertion, the hidden-input contract, and the weigh-in grid assertion in `cut-support.css`.

Not verified here: the real iOS date widget and whether the picker still opens; a physical keyboard's `visualViewport` at 520, 480 and 420; collision of the dock with the rest strip and the home indicator on a device; `filter: grayscale(1)`; reduced motion on screen; 390 / 393 / 402 / 430 / 375 / 320. Those are Claude's.

---

## H. Architecture cleanup candidates

Documented, not done.

- `NXT.training()` in `cut-support.js` still builds its own log form. The live screen is `renderTrain = NXP.training`. Deleting the legacy renderer is D5 and was not in scope.
- `index.html` still contains a second `apx95OpenQuickWeight`, a `bwDate` row, and `apx95EditDate`. The live Log bodyweight path is the one in `cut-support.js`. The legacy markup is why the shared date rule has to cover `.bw-safe-row` and `.grid2` as well as `.n99-form-grid`.
- `body.apex-keyboard-open` in `index.html` adds a large page padding and fades the tabs. It does not put Log Set above the keyboard. The dock does not use that class. Removing the old lock is an `index.html` change and was left alone.
- A permanent `position: fixed` Log Set used to live in `premium-ui.css` and was removed in an earlier slice. The new dock is keyboard-only, in `vnext.css`, and should not be merged back into a permanent float.
- `window.addEventListener` in the dock binder is guarded because the 2G and 2H vm sandboxes set `window` to an object that has `document.addEventListener` and no `window.addEventListener`. That guard is what keeps those suites loading `premium-ui.js`.

Not committed. Not pushed.
