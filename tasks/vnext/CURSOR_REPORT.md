# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

Overwrite this file each slice. Keep it factual: Claude reviews the actual git diff regardless, and a report that overstates completeness costs a review round.

---

## Slice

`VNext Phase 2C — Progress / Weight`

## Status

`READY FOR REVIEW`

---

## A. Files changed

| File | Added / Modified | What changed |
|---|---|---|
| `cut-support.js` | Modified | Presentation only (`chartModel`→`progress`): D2 domain (morning+trend only); D3 Journey rail; forecast/post toggles off by default; full-plot scrub + keyboard; textual trajectory read. UI flags `showPost`/`showForecast`. **No edits to truth functions** (`weights`…`review`). |
| `premium-ui.js` | Modified | Weight view renders `chartHTML()` as the protagonist surface; retired `arrangeWeightView` hero rearrange; demoted TDEE + weigh-ins below. |
| `vnext.css` | Modified | `#weightPage .vn-*` Weight surface (header, segments, chart wrap, legend, toggles, Journey, evidence, motion). |
| `wearables.release-gate.test.js` | Modified | Adapted domain/legend assertions to D2/D8 (post no longer widens Y-domain); `selectPoint` signature slice. |
| `wearables.weight-contract.test.js` | Modified | Domain = morning+trend; goalRef null (D3); projection/post enabled for render asserts; Journey asserted. Truth numeric pins unchanged. Restored shared-`m.y()` post-workout projection assert (with `showPost` on + non-empty `m.post` guard) alongside D2 domain asserts. |
| `tasks/vnext/verify-2c.mjs` | Added | Playwright acceptance for §6 |
| `tasks/vnext/verify-2c-results.json` | Added | Evidence dump |
| `tasks/vnext/shots/weight-*.png` | Added | 390 + 320 for goal-off/on, post-on, forecast-on |
| `tasks/vnext/CURSOR_REPORT.md` | Modified | This report |

No edits to truth block ~71–263, wearables engines, `train-anatomy.js`, `sw.js` RELEASE/CACHE, Supabase, or unrelated untracked trees.

---

## B. Behaviour implemented

### D2 — Recent-trajectory Y-domain

- Domain values = visible morning readings + trend averages only.
- **Excluded from domain:** goal band, goal reference, forecast cone/endpoint, confidence-band extremes, post-workout.
- Measured (seeded fixture, goal confirmed, 30-day range): **83–88 kg (span 5)** with goal band toggled **off and on** — identical.
- Materially tighter than the live defect (76–86 / 10 kg).

### D3 — Cut journey (separate)

- Non-time-series rail: start → current → goal range (left-to-right), with Down / To goal range metrics.
- Only place the distant goal appears; chart no longer draws goal band or `goalRef` hairline.

### Forecast (I11)

- Off by default; dashed/faded mark (`stroke-dasharray="2 5"`).
- Omitted entirely (no toggle, no geometry) when `forecastGoal` lacks evidence / target unconfirmed.
- Projected Y clamped into the plot so a distant target cannot invent vertical space.

### Post-workout (D8)

- Off by default; hollow **diamond** marks (shape, not hue).
- Never enters trend/plateau/forecast maths (unchanged) **and** never enters Y-domain.
- Toggling post does not change trend-line geometry (verified).

### Scrub

- Drag anywhere on `#vn-chart-wrap` (`touch-action: pan-y`); pointer capture.
- Stable metric header outside the plot (fixed min-heights; no reflow on scrub).
- Keyboard: ←/→ move, Escape → latest (“Latest morning”).

### Interpretation without interaction

- “Recent trajectory” headline from `detectPlateau` weekly rate / status + `trendReadText` on load.
- Evidence rows (rate, plateau, projection, confidence) below Journey.

### Ranges

- Kept existing **2W / 1M / 3M / All** (14 / 30 / 90 / 0). No change — production functional truth; design-vnext’s 4W/12W/… not adopted. Each range re-domains.

---

## C. Architecture / state wiring

- Presentation layer only inside the existing Progress IIFE.
- New UI flags: `N.ui.showPost`, `N.ui.showForecast` (default false). `showGoal` retained for API/tests; does not affect domain or chart goal drawing.
- New exports: `journeyHTML`, `chartKey`, `setPostVisible`, `setForecastVisible`.
- `premium-ui` Weight path no longer moves selected metrics into a hero; Strength/Body views untouched structurally.
- No calculation, storage key, record shape, or morning-canonical rule changes (Q1 untouched).

---

## D. Tests performed

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | D2 domain identical goal on/off; span &lt; 8 kg | PASS | `verify-2c-results.json` → `domain` (83–88, span 5, identical) |
| 2 | D8 post excluded from domain; trend geometry stable | PASS | `postToggle` |
| 3 | Truth byte-identical across toggles | PASS | `truthUntouched` |
| 4 | Scrub + header stable + keyboard | PASS | `scrub` |
| 5 | Interpretation on load | PASS | `interpretation` |
| 6 | Ranges re-domain | PASS | `ranges` |
| 7 | Forecast distinct, off by default, omitted when weak | PASS | `forecast` |
| 8 | Contrast / targets / overflow @390/375/320 | PASS | `a11y` |
| 9 | Reduced motion | PASS | `reducedMotion` |
| 10 | Other tabs + `wearables.release-gate.test.js` | PASS | `otherTabs`; **53 passed, 0 failed** |
| 11 | `wearables.weight-contract.test.js` | PASS | **31 passed, 0 failed** (re-run after restoring post shared-`y` assert) |

Screenshots: `tasks/vnext/shots/weight-{goal-off,goal-on,post-on,forecast-on}-{390,320}.png`

---

## E. Responsive verification

| Width | goal-off | goal-on | post-on | forecast-on | range-14 | range-all |
|---|---|---|---|---|---|---|
| 390 | PASS | PASS | PASS | PASS | PASS | PASS |
| 375 | PASS | PASS | PASS | PASS | PASS | PASS |
| 320 | PASS | PASS | PASS | PASS | PASS | PASS |

---

## F. Known deviations

| Item | Note |
|---|---|
| Range set | Kept 2W/1M/3M/All vs design-vnext 4W/12W/6M/1Y — functional truth / task §3.6 |
| Goal band checkbox | Removed from chart controls; Journey owns the goal. `setGoalVisible` still exists (no domain effect) |
| Post mark | Diamonds (design-vnext) vs prior hollow squares — still shape-not-hue |
| Diagnosis / weekly review | Demoted into “Why NXTFRM says this” details — not deleted |
| TDEE | Demoted under Weight as disclosure (premium-ui) |
| design-vnext post-in-domain | Prototype pushed post into vals; this slice follows CURRENT_TASK / D2 and excludes it |
| Q2 verdict language | Not used; headlines stay observation-based from plateau/trendReadText |

---

## G. Open questions / risks

1. Live-data domain numbers will differ from the verify seed (83–88); the invariant to re-measure on device is **identical on/off + materially tighter than 76–86**.
2. Shipping still needs the normal cache-bust / RELEASE path (out of scope).
3. Contract/release-gate tests were adapted for legitimate D2/D3/D8 presentation changes — intent preserved; called out above.
4. Follow-up (test-only): test `7,8` now guards both D2 (domain = morning+trend) **and** shared-scale projection of post points via `m.y()` when `showPost` is on — those are separate guarantees.

---

## H. Stop

Working tree ready for Claude design/UX review of **Phase 2C Progress / Weight**. Latest delta is test-coverage only (`wearables.weight-contract.test.js`). **No commit. No push.**
