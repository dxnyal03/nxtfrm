# NXTFRM 2.0 — milestone record

**Branch:** `nxtfrm-2.0` · **Base:** `origin/main` `3cd4de5` (release 159) · **Date:** 2026-10-11
**Status:** implemented and verified on the working tree. **Not committed, not pushed, not deployed.** `RELEASE` / `CACHE_NAME` stay at `159` (owner gate).
**Trial link:** https://claude.ai/artifact/NQyvwpDR8jUgihtfTQimz4 (private review copy on test data; see §7).

---

## 1. What this pass found

The local checkout was at release 109 (`aa5af65`), 62 commits behind the deployed build. Every change here is made on top of release 159, the Strata build the owner actually uses (D19–D58). The baseline on that build:

- 17 deterministic suites · 473 passed · **3 failed** in `wearables.train-enrichment.test.js` — the Strata Train markup (`.st-ex`, `.st-ex-title`, `.st-ex-mus`) had moved out from under three class-name assertions. Pre-existing on `origin/main`.
- Zero page errors, zero horizontal overflow at 320 / 375 / 390 / 768 / 1280 / 1600 on every tab.
- The older browser verify scripts (`verify-2a`…`2h`, `verify-train`) were written for release 109 and **fail identically on pristine `origin/main`** (one even asserts "release stays at 109"). They were run on both checkouts to prove no regression; they are not a signal for release 159. `verify-train-browser` is 6/6 on both.
- Product gaps against the brief: no training-activity analytics anywhere (frequency, sets, tonnage, cardio minutes, consistency); the app floated as a 470px phone strip on desktop; the calendar had no keyboard navigation; with four Progress tabs "Performance" would not fit at 320.

## 2. What changed

| File | Change |
|---|---|
| `cut-support.js` | **Engine:** `NXT.activityWeeks(weeks, end)` and `NXT.activitySummary(items)`. A Mon–Sun ledger of lifting days, working sets, tonnage (load × reps, working sets only), exercises, cardio minutes/sessions and floorball sessions, through the same `workRows()` filter the rest of the engine uses. Weeks that end before the first stored record are absent, never zero. Summary counts weeks at the *current* plan and cardio target, totals and full-week averages, and the longest run. No percentage, no score, nothing stored. Exported on `NXT`. |
| `premium-ui.js` | **Progress › Training** tab (`activityView` + chart builder): stable readout strip, three bar charts (lifting days with plan line, working sets, cardio minutes with target line), "weeks at plan" capsules, an honest "How to read this" fold, and an empty state. One selected week drives all three charts and the readout; drag/tap to scrub, arrow keys / Home / End / Escape on any chart (`NXP.actScrub`, `actKey`, `actSelect`, `actRange`). Bars grow only on arrival or a range change, never on the repaint after logging. Every SVG has a title and a text equivalent. **History calendar:** roving tabindex and `NXP.historyKey` — arrows move a day or a week, PageUp/PageDown a month, Home/End to the week's ends; focus follows the selection across a month repaint. **Progress tabs:** "Performance" shows "Lifts" under 360px (accessible name unchanged). |
| `strata.css` | Training view in the lit-glass recipe (violet lifting, apricot cardio per D54; dashed reference lines; reduced-motion paths). **Wide layouts:** ≥768px the column widens to 600px and sheets to 560px; ≥1024px the column is 680px (720px ≥1440px) and the dock becomes a side rail with a vertical sliding highlight, still receding in an active workout (D6). Nothing under 768px changes. Short tab label rule. |
| `wearables.train-enrichment.test.js` | The three failing assertions now accept the Strata class names (`st-ex-mus`, `st-ex-title`, `st-ex${exMove}`) while keeping their intent: muscles named in text, title opens the detail sheet, direction class reaches the markup. |
| `wearables.activity.test.js` | **New**, 13 tests: Mon–Sun weeks, absence-before-first-record, warm-up exclusion, bodyweight sets add no tonnage, real zero weeks, future rows excluded, malformed rows dropped, window clamp, empty ledger, summary counts against plan and target, best run, read-only (no persistence path). |
| `tasks/vnext/devserver.py` · `.claude/launch.json` | No-store, dual-stack static dev server for the desktop-app preview (the Chrome pane resolves `localhost` to `::1`; the CommandLineTools Python cannot read the Documents folder). Dev tooling only. |
| `tasks/vnext/shots/nxtfrm2-*.png` | Review screenshots: Training at 390 and 320, Training empty state, Today and active Train at 1280. |

Unchanged by design: `index.html`, `sw.js`, `manifest.webmanifest`, `train-anatomy.js`, `wearables.*`, `seed.*`, every storage key, record shape and calculation. The calendar, Train loop, weight chart and all D-decisions are untouched.

## 3. Data integrity

- Weeks use the engine's own `weekStart()` / `dateMs()` (UTC noon anchoring), so a week boundary cannot differ from Today's rail.
- Rows after `state.date`, warm-ups, non-integer reps, non-finite loads and bad dates are excluded by `workRows()`; a cardio row with no minutes is not a session; a floorball row with no duration counts as a session with 0 minutes.
- Tonnage is a sum of load × reps; sets at 0 kg contribute 0 and the view says so.
- The plan line is the current `settings.weeklyPlan` and the cardio target is `settings.zone2WeeklyTarget`; the view states that the app keeps no plan history.
- The ledger writes nothing (asserted in the suite: no `persist`, `save` or `localStorage` in either function).

## 4. Verification

```
for f in wearables*.test.js; do node "$f"; done     →  18 suites · 489 passed · 0 failed
node --check cut-support.js premium-ui.js            →  clean
strata.css braces                                    →  balanced
NXTFRM_BASE=http://localhost:8763 node tasks/vnext/verify-train-browser.mjs  →  6 passed, 0 failed
node tasks/vnext/verify-151.mjs (system Chrome)             →  34 passed, 0 failed  (base: 34/0)
node tasks/vnext/verify-152.mjs (system Chrome)             →  33 passed, 0 failed  (base: 33/0)
```
Browser (Chromium via Playwright and the desktop-app pane), seed data unless stated:
- 320 / 375 / 390 / 768 / 1280 / 1600 × Today (rest and lift), Train idle and active, Progress (Weight, Training, Performance, Body), History, Settings, Data, and the weigh-in / cardio / check-in sheets: **0 page errors, 0 horizontal overflow**.
- Training view: scrub updates the readout and highlights the same week on all three charts; ArrowRight/ArrowLeft/Escape work with focus on any chart; `NXT.activityWeeks(12)` on seed = 12 weeks from 20 Jul, totals 7 lifting days / 123 sets / 55,593 kg / 425 min, which the readout reproduces.
- Four Progress tabs at 320: each 69×44px, no overflow, "Lifts" label swapped in, aria-label still "Performance".
- Empty data (no logs, no weigh-ins): Today, Train, all four Progress views and History render their empty states with no errors.
- Desktop 1280: column 680px, rail 84×354px at x=188, rail receded (`vn-recede`) in an active workout, no overflow.
- Calendar keyboard: ArrowLeft 11 → 10 Oct, ArrowUp → 3 Oct, PageUp → 3 Sep with the month repainted and focus on the new cell; exactly one tab stop at every step.
- Reduced motion: the new animations sit under `prefers-reduced-motion: no-preference` and are also disabled by `data-nxp-motion="reduced"`.

Not verified: a real iPhone / installed PWA; the trial artifact rendered in the claude.ai viewer (the desktop-app browser pane is not allowed to open claude.ai links from this session).

## 5. Remaining limitations

- The 109-era verify scripts should be retired or rewritten for Strata; they fail on `origin/main` today and overwrite tracked screenshots when run.
- `NXT.features.classic` points at `/classic/`, which is not in this checkout; untouched.
- The viewport meta still disables pinch zoom (PRD "known compliance gap"); not changed here because the legacy forms have sub-16px inputs that iOS would auto-zoom.
- `D5` legacy renderers and `D4` `readiness()` remain, by decision.

## 6. Preview locally

```
python3 tasks/vnext/devserver.py 8763 .
```
then open `http://localhost:8763/?reseed=1` (the seed only runs on the hostname `localhost`). Progress › Training is the new tab; widen the window past 1024px for the rail.

## 7. Trial copy

The artifact is a byte-for-byte copy of the branch except: `seed.dev.js` treats any non-localhost host as a deploy preview (fixture data on, cloud login/save/load disabled, banner dismissed), the service worker is not registered, the title reads "NXTFRM 2.0 trial", and a small "Trial · test data" ribbon sits above the dock. In the claude.ai viewer, OCR (Tesseract runtime fetch), backup downloads and `confirm()`-guarded actions such as Undo last set do not work; everything else does.

## 8. Needs owner approval

- Commit on `nxtfrm-2.0` (nothing committed yet) and, when deploying, the `RELEASE` bump to 160 with `sw.js` (no new files are requested by the page, so the shell list is unchanged).
- A DECISIONS entry (proposed D59: Progress › Training ledger and wide layouts, presentation plus two read-only engine functions).

---

## 9. Train v2 (same day, same branch)

Owner asked for a better Train page and anatomy after reviewing the trial. Built on the ideas list; whole-figure head was tried and reverted on owner feedback for a muscle-crop lens.

**Active workout (`premium-ui.js` `training()`, `strata.css` "Train v2"):**
- **Head:** title and muscle line as before; the anatomy is now a *lens* — the engine's own `cropFor()` region of the worked muscle, widened 1.35× and set in a round vignette, out of flow (0px head cost), tapping it opens Exercise Details. Figure rendering everywhere (head, idle map, plan rows, details pair) gets graphite body tokens, a lit primary with bloom and a dimmer secondary.
- **Reference line:** `Aim · Best · Rest` as typography on a hairline above the entry; Aim fills the fields on tap (`NXP.useAim`), Best and Rest are the engine's values. The coach is one line with a folded "Why" note; its per-set targets moved into the ledger.
- **Set ledger:** one row per planned working set. Logged rows show `kg × reps` and the D20 comparison word (Beat last time / Matched / Logged, short form under 360px) and open the existing edit sheet; the current row *is* the entry (numerals and steppers, ids unchanged); rows still to come show the D25 target and fill on tap, or the rep range when there is no target; warm-ups sit above the plan; an extra-set row appears once the plan is logged.
- **Card and Log:** the card is sized to its content (no more viewport-height card with dead space); Log sits in flow at the card foot and docks above the keyboard only while a field is focused (`.is-kb`, CSS now present for the Strata form, previously only the 109-era form had it).
- Removed from the card: the dots row and the chips row (both duplicated the ledger).

**Verified:** release gate 53/0, train-enrichment 34/0, all 18 suites 489/0; `verify-151` 34/0, `verify-152` 33/0, `verify-train-browser` 6/0 (vacuous on Strata markup, as on release 159). Browser at 320 / 375 / 390 / 430: no overflow, no clipped control, no target under 44pt, title never overlaps the lens, 0 page errors. Flows: log set → row appears with Beat/Matched; warm-up entry sits above the plan; auto-advance to the next exercise still happens after the planned sets; going back to a finished exercise shows three logged rows and an extra-set row; exercise change animates the lens in the queue's direction; keyboard dock simulated (`is-kb` → fixed, bottom from `--nxp-kb-bottom`). Reduced-motion paths added for every new animation.

Screenshots: `tasks/vnext/shots/nxtfrm2-train-v2-390.png`, `-logged-390.png`, `-320.png`, `nxtfrm2-train-idle-390.png`.
