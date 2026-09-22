# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

Overwrite this file each slice. Keep it factual: Claude reviews the actual git diff regardless, and a report that overstates completeness costs a review round.

---

## Slice

`VNext Phase 2D — History` (review round 2 — required fix 1)

## Status

`READY FOR REVIEW`

---

## A. Files changed

| File | Added / Modified | What changed |
|---|---|---|
| `premium-ui.js` | Modified | History partial selection update; floorball as its own calendar mark; secondary filter chrome IDs; day-detail host; EVENT/INTERVENTION/ANNOTATION structural lanes (empty, no persistence). **Round 2:** restored visible `Conditioning` label on `historyConditioningBlock` (was incorrectly `Cardio`). |
| `vnext.css` | Modified | New `#historyPage` / `vn-*` History surface: canvas, native calendar (no raised card), secondary filters, four shape marks, day-enter motion + reduced-motion paths. *(unchanged this round)* |
| `tasks/vnext/verify-2d.mjs` | Added | Playwright acceptance for §6 *(unchanged this round)* |
| `tasks/vnext/verify-2d-results.json` | Added | Evidence dump (re-run after label fix) |
| `tasks/vnext/shots/history-*.png` | Added | dense / empty / four-kind at 390 and 320 |
| `tasks/vnext/CURSOR_REPORT.md` | Modified | This report |

No edits to `cut-support.js`, `wearables.*`, `index.html`, `sw.js` RELEASE/CACHE, `premium-ui.css`, Supabase, or unrelated untracked trees (`design-v102/`, `design-v103/`, `.claude/`, root PNG).

**This round only:** one-line label restore in `historyConditioningBlock`. Rows, calendar marks, `aria-label`s, and `data-kind="conditioning"` untouched.

---

## B. Behaviour implemented

### Defect 1 — Selection no longer rebuilds the page

- `historySelect()` (same month): moves `is-selected` / `aria-pressed` on the affected cells and replaces `#vn-hist-dayhost` only.
- Calendar (`#vn-hist-calendar`), chrome (`#vn-hist-chrome`) and filters (`#vn-hist-filters`) stay in the DOM.
- Proven: marker nodes appended inside calendar / chrome / filters survive a date change (`partialUpdate` in results).
- Scroll position preserved across selection (`delta ≤ 2`).
- Month shift / filter change still call full `history()` (real content change). `historyThisMonth()` is partial when already on the current month.

### Defect 2 — Filters secondary

- Same four scopes (`All / Lifting / Cardio / Weight`) and handlers (`NXP.setHistoryFilter`).
- Visual: no bordered segment track; quiet text row with an underline on the active scope.
- Month summary (`#vn-hist-summary`) still reflects the active filter.

### Defect 3 — Floorball distinct in the calendar

- `historyMarks()` returns `{lift, cardio, floorball, body}` — cardio and floorball are never folded together.
- Shapes (I6): filled disc · hollow ring · diamond (rotated square) · horizontal bar.
- `aria-label` names each kind present, including `floorball`.
- Legend lists all four.
- At 320px all four marks measure with positive geometry in-cell (no silent drop).

### Review fix 1 — Conditioning block label

- Visible label restored to **Conditioning** (was `Cardio`).
- Block still holds cardio + floorball rows under one heading that does not claim floorball is cardio.
- `data-kind="conditioning"` unchanged; row `data-kind` values unchanged.

### Forward structure — EVENT / INTERVENTION / ANNOTATION

- Day view includes `.vn-hist-lane[data-lane=event|intervention|annotation]` inside `.vn-hist-audit`, `hidden`, empty.
- No new storage keys, record shapes, or writes.

### VNext visual language

- Calendar native to the canvas (no raised card / giant panel).
- Selected day: restrained violet (I1).
- Day detail enter: state tier 200ms; reduced-motion path clears animation.

---

## C. Architecture / state wiring

- Presentation only in `NXP.history*` helpers inside `premium-ui.js`.
- Stable region IDs: `vn-hist-chrome`, `vn-hist-filters`, `vn-hist-calhost` / `vn-hist-calendar`, `vn-hist-dayhost`.
- Cells carry `data-date` for selection patching.
- `state.historyDate` / `historyMonth` / `historyFilter` remain in-memory UI state — not persisted.
- History remains read-only on `state.logs` / `cardio` / `floorball` / `bws` (navigation proven same-array reference).
- Migration seam untouched: `renderHistory=NXP.history`.

---

## D. Tests performed

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Partial update — calendar/chrome/filters nodes survive selection | PASS | `partialUpdate` |
| 2 | No scroll jump on selection | PASS | `scrollJump` |
| 3 | Four distinguishable marks; floorball ≠ cardio | PASS | `fourKinds` (seed + in-memory four-kind day) |
| 4 | Shape/geometry not colour alone | PASS | `shapes` |
| 5 | Sample dates match `state`; no writes during nav | PASS | `integrity` |
| 6 | Month prev/next/Today; outside days; Aug 1–31 | PASS | `monthNav` |
| 7 | Day modal / edit / otherDayDetails / audit lanes | PASS | `capabilities` |
| 8 | Contrast / targets / overflow @390/375/320 | PASS | `widths` — 0 text fails, 0 target fails, no overflow at each width |
| 9 | Reduced motion selection + month change | PASS | `reducedMotion` |
| 10 | Today / Train / Progress / More; both suites | PASS | `otherTabs`; release-gate **53/0**; weight-contract **31/0** |

Screenshots: `tasks/vnext/shots/history-{dense,empty,fourkind}-{390,320}.png` (from round 1; label-only change this round).

Seed used for dense/sparse: `?reseed=1` on `localhost` → 174 logs / 15 cardio / 8 floorball / 83 bws. Four-kind day constructed in-memory on `2026-08-12` (no seeded day has all four).

**Re-run after label fix:** `verify-2d.mjs` → `ALL PASS`; `node wearables.release-gate.test.js` → **53/0**; `node wearables.weight-contract.test.js` → **31/0**.

---

## E. Responsive verification

| Width | dense | empty | four-kind | a11y |
|---|---|---|---|---|
| 390 | PASS | PASS | PASS | PASS |
| 375 | — | — | — | PASS |
| 320 | PASS | PASS | PASS | PASS |

---

## F. Known deviations

| Item | Note |
|---|---|
| Calendar cell width @320 | 7-column math cannot guarantee ≥44px width; height ≥44 enforced. Declared in verify audit (same honest constraint as any month grid). Accepted by Claude review — not a defect. |
| Filter placement | Still under the header (production behaviour); demoted visually (no track), not relocated under the calendar. |
| design-vnext filters | Prototype has no filters; production four scopes kept (functional truth). |
| design-vnext “+ Add note” | Not shipped — would invent persistence / write UI. Structural lanes only. |
| Conditioning day block | One **Conditioning** block still groups cardio + floorball rows (production day-view structure); calendar separates the marks. Label no longer claims floorball is cardio. |
| Cloud/local banner | Appears under local-only seed (actionable D11 condition); not suppressed in this slice. |

---

## G. Open questions / risks

1. Whether filters should eventually move beside the month title (design-vnext has none) is a polish call — behaviour is intact.
2. Shipping still needs the normal cache-bust / RELEASE path (out of scope; owner checkpoint).
3. Populating EVENT / INTERVENTION / ANNOTATION is gated on Q5 / State Engine — structure only here.

---

## H. Stop

Working tree ready for Claude design/UX review of **Phase 2D History** (required fix 1 addressed). **No commit. No push.**
