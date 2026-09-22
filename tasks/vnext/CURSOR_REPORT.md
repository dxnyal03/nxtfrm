# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

Overwrite this file each slice. Keep it factual: Claude reviews the actual git diff regardless, and a report that overstates completeness costs a review round.

---

## Slice

`INT-1 polish P4` — History calendar month title one line at 320px

## Status

`READY FOR REVIEW`

---

## A. Files changed

| File | Added / Modified | What changed |
|---|---|---|
| `premium-ui.js` | Modified | `historyCalendar` uses `month:'short'` when `matchMedia('(max-width:359px)')` matches (en-SG → `Sept 2026`) |
| `vnext.css` | Modified | `#historyPage .nxp-cal-month`: `white-space:nowrap; overflow-wrap:normal` (overrides premium-ui `overflow-wrap:anywhere`); kept 15px at ≤359px |
| `tasks/vnext/CURSOR_REPORT.md` | Modified | This report |

No other files. Calendar grid, marks, day view, other screens untouched. No RELEASE / CACHE bump. Not committed.

---

## B. Behaviour implemented

P4 was not achieved by the prior 15px step-down alone: nav (prev / Today / next at 44pt) left too little room, and premium-ui’s `overflow-wrap:anywhere` + `min-width:0` let the title wrap.

Fix (both of the allowed options):
1. Abbreviate month at ≤359px via locale `short`.
2. Force single-line title CSS so wrap-anywhere cannot reintroduce two lines.

Nav control sizes unchanged (still `min-width/min-height: 44px`).

---

## C. Architecture / state wiring

Presentation only. No calculation, storage, or record-shape changes. `historyMonth` / filters / partial update path untouched.

---

## D. Verification (Cursor §6)

### Syntax / static
- `node --check premium-ui.js` — exit 0
- `vnext.css` brace balance: `{` 416 / `}` 416

### Measured at 320px (live `#historyPage`, September 2026)

| Metric | Value |
|---|---|
| Viewport | 320 |
| Title text | `Sept 2026` |
| `font-size` | 15px |
| `line-height` | 18.75px |
| Element height | 18.75px |
| height / line-height | **1.000** (one line) |
| Prev / Today / Next | 44×44 / 61.41×44 / 44×44 (≥44pt) |

(Prior failure: `September 2026` at 15px, height 38px ≈ 2 lines.)

### All 15 wearables suites (real final lines)

| Suite | Result |
|---|---|
| `wearables.adapters.test.js` | OK  32 passed, 0 failed |
| `wearables.canonical.test.js` | OK  24 passed, 0 failed |
| `wearables.days.test.js` | OK  16 passed, 0 failed |
| `wearables.ingest.test.js` | OK  32 passed, 0 failed |
| `wearables.provider-garmin.test.js` | OK  3 passed, 0 failed |
| `wearables.recovery-integration.test.js` | OK  32 passed, 0 failed |
| `wearables.recovery.test.js` | OK  28 passed, 0 failed |
| `wearables.release-gate.test.js` | OK  53 passed, 0 failed |
| `wearables.resolution.test.js` | OK  19 passed, 0 failed |
| `wearables.snapshots.test.js` | OK  26 passed, 0 failed |
| `wearables.store.test.js` | OK  34 passed, 0 failed |
| `wearables.sync.test.js` | OK  47 passed, 0 failed |
| `wearables.train-enrichment.test.js` | OK  34 passed, 0 failed |
| `wearables.training-readiness.test.js` | OK  29 passed, 0 failed |
| `wearables.weight-contract.test.js` | OK  31 passed, 0 failed |

Browser / responsive / interaction / reduced-motion / design-vnext fidelity beyond this title measure: **owner (Claude)**.

---

## E. Fold budget note

N/A — title-only polish.

---

## F. Known deviations / out of scope

- en-SG short month is `Sept` (not `Sep`). Still one line with margin.
- Title abbreviation applies only when History (re)renders while viewport ≤359px; a pure resize without remount keeps the form chosen at last render. CSS nowrap still prevents wrap if long form is present.
- No commit / push.

---

## G. Risks for review

- Confirm `Sept 2026` reads acceptably vs full month at 390+.
- Confirm month nav still feels ≥44pt on device.

---

## H. Stop

Working tree ready for design-director review. No commit / push.
