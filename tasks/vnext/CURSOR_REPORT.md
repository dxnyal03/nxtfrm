# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`VNEXT PHASE 2H — PROGRESS → BODY ANALYTICAL INTEGRATION`

Implementing model: **Grok 4.7** (this session). The pinned Opus model was not used.

## Status

`READY FOR REVIEW` — Progress → Body renders the shared EvoScan analysis. The *Open scans* hop is gone. Capture still opens the Settings form. Cursor-owned checks are green. Rendered contrast, responsive, interaction, reduced-motion and visual fidelity are Claude's (AGENTS.md §6). No browser was used. `RELEASE` and `CACHE_NAME` stay `109`.

---

## A. Shared analysis

Progress → Body no longer keeps its own scan list. The latest reading, measured/estimated rows, composition bar, per-metric trend, What Changed, history and detail are `evoAnalysisHTML` and `evoDetailHTML`.

`evoAnalysisHTML` was extracted from `evoBoardHTML` in `index.html`. The Settings board now calls that function and still wraps it with the Settings back control and the capture actions (New scan, Enter numbers manually, Use latest TDEE). The empty Settings board string is unchanged. `class="vn-evo-hero"` exists once, inside the helper. `premium-ui.js` does not rebuild the hero, the composition bar, or the trend buttons.

Progress reads scans through `evoOrdered()`, the same list Settings uses. `bodyScans()` remains only as the fallback when that function is absent (the Performance vm does not load `index.html`). On the live page the two surfaces cannot disagree about which scan is latest. A future-dated or undated scan that `bodyScans()` used to hide is now visible here, because Settings already showed it. No record is rewritten.

`state.evoUi` is still the one mode object. A trend switch or an opened scan re-renders through `evoSetTrend` / `evoOpenScan` / `evoCloseDetail`. While the tab is Progress, `render()` paints Progress again. The capture form is the exception: if Settings left `mode` on `form`, Progress still paints the analysis, not the form.

---

## B. The stale path

`NXT.more('body')` labelled *Open scans* is gone from this screen. `premium-ui.js` still contains that call once, on the Settings hub row *Body & scans*.

Capture from Progress is `NXP.openBodyCapture()`. It sets the existing form mode, then `NXT.more('body')`, so the next paint is the Settings review form (`scanFile`, date, the six metrics, notes, Read scan, Save). It does not paint that form on Progress, and it does not drop the user on the analysis board to go looking.

The six baseline handlers are still in the Body markup: `NXT.setView('overview')`, `NXT.setView('strength')`, `NXT.setView('body')`, `NXT.openWaist()`, `apx95OpenQuickWeight()`, and `NXP.openBodyCapture()` in place of the dead-end.

History and detail are the shared helpers, so their existing Delete control and, on detail, *Use this TDEE as maintenance* come with them. `evoDeleteScan` was not edited. Delete semantics are the ones 2F shipped.

The legacy `bodyHTML()` in `cut-support.js` still has an *Open scans* button. The live screen is `renderWeight = NXP.progress`. That function was not edited (D5).

---

## C. Waist

`NXT.openWaist`, `saveWaist` and `deleteWaist` are untouched. The reading list is still one button per row, newest first, with the date, the centimetres, and *Edit ›*. *Log waist* is the same row as before. Waist still goes through `N.cleanRows(..., 'cm')`. A future date and a 10 cm row stay out. The waist-to-waist delta is still display arithmetic over those two rows. It is not stored.

The old line *Latest Evo scan …* under the waist figure was removed. The scan is on this page now, rendered by the shared analysis, so that line was a second mention rather than a way to reach it.

---

## D. Honesty

Weight on a scan is `Measured` (filled dot, `is-measured`). Body fat, muscle mass, fat mass, BMR and TDEE stay `Estimated` (diamond, `is-estimated`). Those classes come from `evoKindHTML` / `EVO_SPEC`. Nothing new was classified.

The trend is one metric at a time, from `evoTrendHTML`. Weight and body fat do not share an SVG or an axis. The note under the switch is the 2F sentence: each metric has its own scale, and this is the EvoScan series, not the morning body-weight trend. The hero says the scan weight is not the morning weigh-in and is not part of the body-weight trend. A morning `81.2 kg` sitting in `state.bws` is not painted on this page.

There is no radar, no Body Score, and no other composite. Remainder is still scale weight minus fat mass, labelled as not a measured compartment. Muscle mass is still a separate bar, not stacked onto fat mass. A scan missing fat mass still refuses the composition bar.

The OCR contract was not edited. `NOT FOUND` and `CHECK` still come from `evoExtractReport`. Provenance words on detail (*Read from the scan* / *Corrected* / *Entered manually*) are `evoProvenanceHTML`. `apm_evo_scans`, the scan shape, `weighInId`, and `cleanRows` / D14 were not touched.

---

## E. Empty states

| State | What the page says |
|---|---|
| No scans, no waist | *Nothing measured yet.* Waist empty copy. Scan empty copy, including that a scan never becomes the body-weight trend. *Log waist* and *New scan*. |
| Scans, no waist | Shared analysis. *No waist measurements yet.* No *Nothing measured yet* headline over a scan that exists. |
| Waist, no scans | Waist figure, list, per-row edit. *No scans saved*, with the same morning-weight sentence. No hero. |
| One scan | Hero and composition when both scale weight and fat mass exist. *No earlier scan to compare.* The trend summary says the scan-to-scan line starts with the next scan. No *vs previous scan* delta. A weight with no fat mass keeps the missing-bar sentence and *Not in this scan* on the empty metrics. |

Viewing any of these does not write `state.scans`, `state.bws`, or the waist store, and does not call `persist`. Opening the capture form does not either. `evoUi()` may create `state.evoUi` the first time a trend or detail is read. That is the existing UI mode object, not a scan or a weigh-in.

---

## F. Files and constraints

| File | What changed |
|---|---|
| `index.html` | Extracted `evoAnalysisHTML` from `evoBoardHTML`. The board calls it. Capture chrome and the empty board are the same strings. No OCR, record, or delete change. |
| `premium-ui.js` | Progress Body calls the shared analysis and detail. *Open scans* replaced by `openBodyCapture`. Waist list unchanged. |
| `vnext.css` | EvoScan rules now match `#morePage` and `#weightPage` via `:is()`. Progress zeroes the Settings gutter so the block is not indented twice. No new action fill. |
| `tasks/vnext/verify-2h.mjs` | New. Synthetic scans and waist rows only. No image file. |

Not edited: `cut-support.js`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*`, `train-anatomy.js`. `RELEASE` and `CACHE_NAME` stay at 109. No new page script or stylesheet.

`--vn-action` is still `#6D28D9`. `--vn-ink-4` is still `#7E8593`. The 2H block adds no `linear-gradient`. *New scan* is the same text row as *Log waist*, not a second primary button. The filled *New scan* on the Settings form is the existing `.vn-evo-act`, which already uses `--vn-action-fill`.

The `:is()` rewrite is the same declarations with a second page in the selector. Settings is not restyled. `#morePage .vn-evo-act:disabled` is still the D12 disabled primary and was not widened.

---

## G. Verification

Cursor did not open a browser and did not run Playwright. `verify-2a` through `verify-2e` and `verify-2b-fold` launch Playwright, which this slice forbids. They were not executed. They were not edited. `verify-2f`, `verify-2g` and `verify-2h` do not.

```
node --check premium-ui.js              OK (silent, exit 0)
node --check tasks/vnext/verify-2h.mjs  OK (silent, exit 0)
vnext.css braces                        raw 657/657, comment-stripped 655/655
node tasks/vnext/verify-2h.mjs          OK  10 passed
node tasks/vnext/verify-2f.mjs          OK  23 passed
node tasks/vnext/verify-2g.mjs          OK  11 passed
```

Sixteen suites, enumerated as `wearables*.test.js` (no dot). Each printed `0 failed`. The pass counts were 32, 24, 16, 32, 3, 32, 28, 53, 19, 26, 34, 47, 18, 34, 29, 31. That is 16 suites, 458 tests, 0 failing. The release-gate suite (53) is in that run, so the 109 cache check still holds.

Not verified here, and owned by Claude: contrast; 390 / 393 / 402 / 430 / 375 / 320; overflow; chart legibility at 320; targets; reduced motion; visual comparison with `design-vnext/`. The seed still has zero scans and no waist readings, so the populated screen has to be driven with injected scans. The empty seed screen should read *Nothing measured yet*, with *Log waist* and *New scan*, and without *Open scans*.

---

## H. Out of scope

Left alone: the OCR pipeline and every D16 stage, `NOT FOUND` versus `CHECK`, confidence, validation, provenance assignment, `apm_evo_scans`, the scan record shape, `weighInId`, delete resolution, `cleanRows` and D14. Weight, Performance, Today, Train, History, the Settings hub structure, wearables, `readiness()` (D4), and legacy renderer removal (D5).

The shared detail back control still says *Body composition* and calls `evoCloseDetail()`. On Progress that returns to the analysis. The label was not forked, because a second detail renderer is what this slice was told not to build.

Not committed. Not pushed.
