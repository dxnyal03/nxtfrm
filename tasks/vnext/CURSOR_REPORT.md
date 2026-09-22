# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`VNEXT PHASE 2F — EVOSCAN FLAGSHIP EXPERIENCE`

Implementing model: **Grok 4.7** (this session). The pinned Opus model was not used.

## Status

`READY FOR REVIEW` — OCR extraction and the phone-first scan workspace are both in. Cursor-owned checks are green. Rendered contrast, responsive, interaction, reduced-motion and visual fidelity are Claude's (AGENTS.md §6). No browser was used.

---

## A. OCR audit

The live pipeline was read before any edit. These are the failure modes, what was done with each, and what was left.

| Failure | What it did | Outcome |
|---|---|---|
| `.replace(/O/g,"0")` on the whole OCR string before matching | `BODY FAT` became `B0DY FAT`, `TOTAL DAILY ENERGY` became `T0TAL DAILY ENERGY`. Uppercase printouts never matched. | **Fixed at the owning layer.** There is no global mutation and no special case for those two labels. Alphabetic tokens are repaired only for the label search (`0`→`O`, `1`→`I`), and that view is the same length as the raw text. `8O.4` becomes `80.4` only inside a token that is already number-shaped. The raw OCR string is kept. |
| Tesseract confidence discarded | Only `result.data.text` was read. | **Fixed.** `result.data.words[].confidence` is kept per candidate. Product status is not that number alone (see B). |
| No image preparation | The camera file went straight to Tesseract. | **Fixed, on a copy.** JPEG EXIF orientation 1–8 is read in pure code. The canvas is oriented once, scaled so the long edge sits between about 900 and 1800 px, then greyscale, 2nd–98th percentile contrast, and a mild unsharp. A median-threshold second pass runs only when the first read finds fewer than two fields or fewer than 12 characters, and it is kept only if it finds more fields. `state.currentScanImage` stays the original data URL. The `<img>` is loaded with `image-orientation: none` so the browser does not rotate from EXIF and the canvas does not rotate a second time. |
| Raw OCR rendered to the user | `pre#ocrOutput` was in the normal flow. | **Removed from the normal flow.** The text is kept on the draft and, after an explicit save, as optional `ocrText`. It is shown only inside “What the reader saw”. |
| `Number(x)\|\|""` | A legitimate `0` was stored as empty. | **Fixed.** Empty stays empty. `0` is a number. A weight of `0` is stored on the scan if the user enters it, and it does not create a weigh-in (`> 0` is still required for that row). |
| Greedy first-kilogram fallback | A nearby kg could be assigned to the wrong field. `818` could be rewritten as `81.8`. | **Fixed.** A value is taken only from the window after its own label, ending at the next label or the following line. `818` kg is outside 25–300 and is **NOT FOUND**, not rewritten. Fat mass and muscle mass are not stolen as body weight. |
| Body fat confused with fat mass; BMR with TDEE | Overlapping labels. | **Fixed by label priority.** `BODY FAT MASS` is fat mass. `BODY FAT` / `PBF` is body fat. `BMR` and `TDEE` are separate. Bare `WEIGHT` and bare `TEE` are loose and can only be **CHECK**. |
| Competing values | First match won. | **CHECK**, both candidates kept. A preferred value is shown so the field can be edited. It is not treated as a decision. |
| Pounds, European commas | Not handled, or handled by stripping every comma. | `lb` → kg (`× 0.45359237`, one decimal) and the field is **CHECK**. `81,8` → `81.8`. `1,820` → `1820`. A comma that is neither a decimal nor a thousands group is rejected, not stripped into `818`. |
| Value printed before its label | Common on some device layouts. | **Left.** The window is after the label. Guessing backwards would invent associations. Those fields stay **NOT FOUND** and the user types them. |
| Second OCR pass on a merely mediocre first read | — | **Left.** The second pass runs only when the first read is nearly empty. A first read that finds two plausible-but-wrong fields is not retried. Retrying every scan would double the wait on the common path. |
| HEIC / PNG orientation | — | **Left.** The orientation reader understands JPEG APP1. A PNG returns orientation 1. iPhone camera JPEGs are the path that carries EXIF. |

### Metrics the parser will fill

Weight (kg, measured), body fat (%, estimated), muscle mass (kg, estimated), fat mass (kg, estimated), BMR (kcal, estimated), TDEE (kcal, estimated).

Nothing else is extracted. Remainder on the composition bar is `weight − fat mass` drawn as estimated arithmetic. It is not stored, not called lean mass, and it is omitted when fat mass is missing or larger than weight. No body score. No radar. No carry-over from the previous scan. A second extract that does not contain body fat leaves body fat **NOT FOUND**.

### How a field becomes one of the three statuses

No percentage is shown.

**NOT FOUND** — no plausible candidate in that field’s window. The input is empty. The user may type a value; that save is `MANUAL_ENTRY`.

**CHECK** — at least one plausible candidate, and any of these is true: two different plausible values; the unit was converted (lb); the label was loose (`WEIGHT`, `TEE`); the number had no unit; a matching Tesseract word confidence is present and below 80. The minimum matching word confidence is used, so one weak token pulls the field down.

**HIGH CONFIDENCE** — one plausible value, a specific label, a unit that already matches the field, and either no word confidence was returned or that confidence is 80 or above. Missing Tesseract confidence does not by itself force CHECK when the label, unit and range already agree.

Ranges used before a candidate is even plausible: weight 25–300 kg, body fat 2–70%, muscle 10–120 kg, fat mass 1–200 kg, BMR 700–4500 kcal, TDEE 900–7000 kcal. A wrong unit for the kind is rejected, not moved onto another field.

---

## B. Staged pipeline

`readEvoScanOCR` is the only reader. Stages written to `#scanStatus`, in order, with no `m.progress` and no fake percent:

1. Preparing scan — original file kept; EXIF read; canvas built.
2. Reading report — Tesseract, words and text.
3. Finding metrics — label view, local windows, numeric repair, units.
4. Checking values — plausibility and the three statuses, then the review form.

If the library has not loaded, the status says the numbers can still be typed. Closing the form increments a job token so a late result cannot paint a form the user already left.

Nothing in this path calls `persist` or `state.scans.push`. The only write is `saveEvoScan`, and it reads the inputs the user is looking at.

---

## C. D14 — canonical weight

`cleanRows()` in `cut-support.js` is the only engine edit. `ewmaTrend`, `trend`, `trendConfidence`, `forecastGoal`, `plateauWindow`, `detectPlateau`, `trendStats` and `review` are untouched. Waist (`key === "cm"`) is not filtered.

For `key === "weight"`, a row whose `timeOfDay` is a non-empty string other than `morning` is skipped before the two existing morning-preference lines. Those two lines are byte-identical, and the string `Post-workout` does not appear inside `cleanRows` (the release-gate greps). Morning still outranks an untimed row on the same date.

**Untimed rows stay eligible.** A missing `timeOfDay` is treated as the historical weigh-in from before timings existed, not as a Post-workout or EvoScan fallback. Dropping those rows would rewrite pre-timing history. The characterization fixture’s untimed `2026-07-01` at 91.0 kg is still the EWMA seed (`e[0] = 91`, `e[1] = 87.8`). D14’s “no fallback” is applied to named non-morning timings: Post-workout, Evo Scan, Pre-workout and Night. If an untimed row should also be ineligible, that is a further decision — say so and it is a one-condition change.

The dev seed was not replayed here (it is a browser seed, and it is 100% Morning, so the rule is a no-op on it). What was executed:

- `verify-2f.mjs` injects Morning 80.2 on 2026-09-01 beside an Evo Scan 99.9, a Post-workout-only 99.1 on 09-02, an Evo Scan-only 99.9 on 09-03, and an untimed 81.0 on 09-04. Canonical rows are the morning 80.2 and the untimed 81.0. The two contextual dates are absent. The Post-workout 99.1 is still returned by `timingRows("Post-workout")`. Waist selection is unchanged.
- `wearables.weight-contract.test.js` is a characterization suite, not the all-Morning seed. Its 2026-09-15 Post-workout-only 85.2 kg used to be canonical. Under D14 that day is absent and the series length is 38 rather than 39. The golden EWMA, window, trend, plateau, forecast and band figures were recomputed from the unchanged maths and the assertions were updated in place. Test 2 now asserts absence and that 85.2 kg remains in the Post-workout series. The suite was not weakened: the old pin was the fallback D14 revoked. `wearables.release-gate.test.js` was not edited and passed (53 / 0).

Scan weight is still stored in full on the scan, in history, in detail, in What changed, and on the EvoScan series. The dual-write of a contextual `bws` row with `timeOfDay: "Evo Scan"` remains, so the reading is not deleted from the log. It cannot become the EWMA, plateau, forecast, cut-progress or confidence point.

The board labels that weight as the EvoScan reading, not as the morning body-weight trend. The chart caption says the same.

---

## D. Review, provenance, delete, storage

Save is the primary control (`--vn-action-fill` / `--vn-action-ink` / `--vn-action-shadow`). Read scan is quiet. Enter numbers manually opens the same form as New scan; it is not an error state. Use this TDEE snapshots the open inputs first, then writes `settings.tdee` only. It prefers the typed field, then the open scan, then the latest scan, and it refuses a missing or non-positive value.

Provenance is decided at save by comparing the input with the OCR draft:

- no OCR value → `MANUAL_ENTRY`
- input differs from the OCR value, or the field was cleared → `USER_CORRECTED`, and the original OCR number and raw token are kept
- input matches the OCR value → `OCR_EXTRACTED`

Core record, unchanged: `{id, date, image, weight, bodyFat, muscleMass, fatMass, tdee, bmr, notes}` under `apm_evo_scans`. Additive and optional: `context: "EVOSCAN"`, `provenance`, `ocrText` (only if a read happened), `weighInId` (only if a contextual weigh-in was created). An older scan with none of those still renders. Zero is preserved. Empty stays empty.

Delete always confirms, and the message says what goes and what stays. A linked `weighInId` whose row is `Evo Scan` is removed with the scan. A linked Morning row is not. With no id, a unique date + weight + `Evo Scan` match is removed; zero matches remove nothing; two or more matches remove nothing and the message says the weigh-ins stay because the link is not unique. The filter also refuses to drop a row whose timing is morning. A hand-entered weigh-in is not inferred.

---

## E. The scan workspace

Settings → Body is no longer the old OCR page inside settings chrome. `NXP.more('body')` paints `renderEvoScanPage()` in a `vn-evo` shell.

Board, in order: EVOSCAN · Body composition, latest scan date, weight with its EvoScan context, body fat, muscle, fat mass, the composition bar, one trend, what changed, history, New scan. Detail is one scan, with the image, provenance, and delete. Form is the photo plus one row per metric: value, unit, measured or estimated, and HIGH CONFIDENCE / CHECK / NOT FOUND. Each row is editable.

Measured is a filled dot. Estimated is a hollow diamond. HIGH is a violet circle plus the words. CHECK is an amber diamond plus the words. NOT FOUND is a hollow concern ring plus the words. Deltas are ink, not green or red. Body-fat deltas are percentage points. A 0.6 point move is written as `0.6 percentage points`, not as a percent of the previous value.

The trend switcher is Weight / Body fat / Muscle / Fat mass. One SVG at a time, its own min and max, captioned as the scan-to-scan series. The composition bar draws fat and muscle as shares of that scan’s weight and does not stack muscle on top of fat.

Primary actions use the shared D12 tokens. Disabled primary stays opacity 1 and solid `--vn-action`. At 320 px the title and the hero number step down and the metric rows stack. Reduced motion cuts the status pulse.

---

## F. Files and constraints

| File | What changed |
|---|---|
| `index.html` | EvoScan parser, reader, review, dashboard, detail, delete. Region from `latestEvoScan` through the scan page. |
| `vnext.css` | `#morePage .vn-evo` section. Disabled primary extended to `.vn-evo-act`. |
| `premium-ui.js` | `evoScanView()`; `more('body')` uses it. |
| `cut-support.js` | `cleanRows()` weight eligibility only. |
| `wearables.weight-contract.test.js` | Characterization pins recomputed after D14. See C. |
| `tasks/vnext/verify-2f.mjs` | New. Synthetic fixtures only, generated in memory. No image file is written. |

Not edited: `sw.js`, `manifest.webmanifest`, `wearables.release-gate.test.js`, the other wearables suites, `seed.*`, `train-anatomy.js`. `RELEASE` and `CACHE_NAME` stay at 109. No new page script or stylesheet. The scratch snippet used to splice the parser was deleted.

Handlers still present: `apx96SetMoreView('hub')`, `handleScanFile`, `readEvoScanOCR`, `saveEvoScan`, `useLatestScanTDEE`, and confirmed delete. Field ids still present on the form: `scanFile`, `scanDate`, `scanWeight`, `scanBodyFat`, `scanMuscleMass`, `scanFatMass`, `scanTDEE`, `scanBMR`, `scanNotes`. They are not in the DOM until New scan or Enter numbers manually.

---

## G. Verification

Cursor did not open a browser and did not run Playwright.

```
node --check premium-ui.js          OK
node --check cut-support.js         OK
node --check (index.html inline script, lines 2664–7444)   OK
vnext.css braces                    raw 602/602, comment-stripped 600/600
node tasks/vnext/verify-2f.mjs      OK  23 passed
```

Sixteen suites, run after the D14 characterization update and before the one-line `image-orientation: none` fix. That line is inside `evoLoadImage` and is not executed by these suites. `node --check` on the inline script was repeated after it.

```
for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done
```

16 files, 0 failing. Per-suite `OK` lines, in glob order: 32, 24, 16, 32, 3, 32, 28, 53, 19, 26, 34, 47, 18, 34, 29, 31. **Total 458 passed, 0 failed.**

---

## H. For Claude, and one recommendation

Please verify at 390 / 393 / 402 / 430 / 375 / 320: the board, the review form (including a NOT FOUND row and a CHECK row), detail, delete confirmation copy, the single-metric chart, the composition bar when fat mass is missing, reduced motion, and that the primary control is the shared violet rather than a local fill. A real camera JPEG is the only way to see EXIF and Tesseract together; the fixtures here are synthetic and never a personal scan.

**Recommendation.** Keep untimed weigh-ins eligible, as implemented. The rows D14 names — Post-workout and EvoScan — are excluded, and a skipped morning stays a gap. Treating a blank `timeOfDay` as ineligible would move every pre-timing weigh-in out of EWMA, plateau and forecast, including the 91.0 kg seed point the characterization suite still depends on. If that stricter reading is what you want, it should be a separate decision.

Do not commit. Do not push.
