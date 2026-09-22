# CURRENT TASK — VNEXT PHASE 2D: HISTORY

**Owner:** Cursor (implementation) · **Reviewer:** Claude (design/UX acceptance)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (binding) · `design-vnext/`
**Previous slices:** 2A `9fd3772` · design-vnext `a0c9203` · 2B `761f339` · 2C `6563be6`

---

## 1. Objective

History stays **calendar-first**. The calendar is the protagonist; the selected day's record resolves beneath it.

History is **not** a feed, and must not become one.

Much of the current implementation is already sound — the calendar has real marks, month navigation, a Today jump, correct `aria-label`s naming each record kind, and **shape-based marks that do not rely on colour**. **Preserve all of that.** This slice is about three specific defects plus the VNext visual language.

### The three defects

1. **Selecting a date rebuilds the entire page.** `historySelect()` → `history()` → full `innerHTML` replace of `#historyPage`. Month shift and filter change do the same. The calendar, header and filters are all destroyed and recreated to change the day beneath them. This is the harsh rerender to remove.
2. **The filters dominate.** Four equal pills (`All / Lifting / Cardio / Weight`) sit directly under the header, competing with the calendar for primacy. Filters are secondary.
3. **Floorball is not distinguishable in the calendar.** `historyMarks()` folds cardio and floorball into one `cond` mark, so a match and a Zone 2 walk are indistinguishable at month level. The day view already separates them; the calendar must too.

---

## 2. Files / areas likely affected

| File | Expected change |
|---|---|
| `premium-ui.js` | `history()` and its helpers (`historyCalendar`, `historyMarks`, `historyDayView`, `historySelect`, `setHistoryFilter`, `historyShiftMonth`, `historyThisMonth`, `historyScope`, `historyMonthSummary`, `historyRecords`) |
| `vnext.css` | New `#historyPage` / `vn-*` section. Keep the existing scoping contract. |

**Do not edit:** `cut-support.js`, any `wearables.*`, `train-anatomy.js`, `seed.*`, `index.html`, `manifest.webmanifest`. **Never bump `RELEASE`/`CACHE_NAME`** — the owner is holding that as a deployment checkpoint.

Tests may be adapted only where they assert on History markup this slice legitimately changed; preserve every assertion's intent and declare it.

---

## 3. Required behaviours

### 3.1 Calendar is the protagonist
- The calendar sits **native to the page** — not wrapped in a giant card. Tonal zoning, spacing and hairlines, per INSTRUMENT (D1).
- Month title, previous/next and the **Today** jump all survive.
- Weekday header row, outside-month days, today marker and selected-day treatment all survive. Selected day uses the restrained violet treatment (I1).

### 3.2 Selecting a date updates smoothly
- Selecting a day **must not rebuild the calendar, the header or the filters.** Update the day-detail region, and move the selection state on the affected cells only.
- No scroll jump, no flash, no full-page repaint.
- Month navigation may rebuild the grid — that is a genuine content change — but must not feel harsh.
- The detail region may transition in (state tier, 200ms) with a reduced-motion path.

### 3.3 Filters are secondary
Keep all four scopes and their behaviour, but they must not read as the screen's primary control. A compact secondary control — not four equal pills under the header. The month summary line should still reflect the active scope.

### 3.4 Record kinds stay distinguishable — and not by colour
Lifting · cardio · **floorball** · weigh-in must each be identifiable in the calendar.

- **Floorball gets its own mark**, separate from cardio.
- Marks are differentiated by **shape** as well as colour — the current set already does this (filled dot / hollow ring / bar). Extend that principle; do not regress it.
- Keep every cell's `aria-label` naming the kinds present, and keep a legend.
- At 320px four marks in a cell is tight. Solve it honestly — a compact arrangement is fine, dropping a kind silently is not.

### 3.5 No silent loss
Everything History can do today must still be reachable: the day-detail modal (`historyDay`), per-set editing (`editHistorySet` → `openEditSet`), `otherDayDetails`, the lifting / conditioning / weight blocks, the month summary, and the logging-span note. Anything demoted must be listed under *Known deviations*.

### 3.6 Forward design — EVENT / INTERVENTION / ANNOTATION
Structure the day view so these three future record kinds have an obvious home:
- **EVENT** — something happened
- **INTERVENTION** — the user deliberately changed the system
- **ANNOTATION** — additional context

**Do not invent persistence semantics in this slice.** No new storage keys, no new record shapes, no writes. Layout and structure only; if you want to show the shape of it, drive it from data that already exists.

---

## 4. Must remain unchanged

- `state.logs`, `state.cardio`, `state.floorball`, `state.bws` — read only. **History never writes training data.**
- All `apm_*` keys, `persist()`, backup/restore.
- `state.historyDate` / `historyMonth` / `historyFilter` remain in-memory UI state; **do not start persisting them.**
- Every existing stored record must remain visible. A record that renders today must render after this slice.
- The V86 render input lock.
- Today, Train, Progress, More.

## 5. Responsive acceptance

390 / 375 / 320, all usable, zero horizontal overflow. Calendar cells keep a sensible touch target at every width — do not shrink them below usability to fit four marks. 320 is a real design state.

## 6. Test requirements

Add `verify-2d.mjs`. Cover: a month with dense records · a sparse month · an empty month · a day with all four kinds · a day with none · each filter · month boundaries (first/last day, leading/trailing outside days).

1. **Partial update** — selecting a date must **not** replace the calendar node. Mark a DOM node inside the calendar, select another date, assert the marked node survived. Same for the header and filters.
2. **No scroll jump** — scroll position is preserved across a date selection.
3. **Record kinds** — a day with lifting, cardio, floorball and a weigh-in shows four distinguishable marks; floorball is distinct from cardio.
4. **Not colour alone** — marks differ in shape/geometry, not just fill.
5. **Data integrity** — for a sample of dates, the records rendered match `state` exactly; nothing is dropped. No writes to `state.logs`/`cardio`/`floorball`/`bws` during navigation.
6. **Month navigation** — prev/next/Today work; outside-month days render correctly at boundaries.
7. **Capability reachability** — day modal, per-set edit and other-day details all still reachable.
8. Contrast ≥4.5:1, targets ≥44pt, no overflow, at 390/375/320.
9. Reduced motion — selection and month change work with no positional animation.
10. Non-regression: Today, Train, Progress, More; `node wearables.release-gate.test.js` and `node wearables.weight-contract.test.js` stay green.

Screenshots of dense month, empty month and a fully-populated selected day at 390 and 320 into `tasks/vnext/shots/`.

## 7. Explicitly out of scope

Progress → Performance (2F) · Body Intelligence / OCR (2G) · Settings (2E) · AI (2H) · Supabase/schema/RLS · `readiness()` removal (D4/X1) · legacy renderer removal (D5/X2) · **any new persistence for events/interventions/annotations** · `RELEASE`/`CACHE_NAME` bump · any change to stored data or training semantics.

---

## 8. Definition of done

- [ ] Calendar is the protagonist, native to the page, not in a giant card
- [ ] Selecting a date updates the detail region only — proven by a surviving DOM node
- [ ] No scroll jump on selection
- [ ] Filters present and functional but visually secondary
- [ ] Lifting, cardio, floorball and weigh-in each distinguishable, by shape as well as colour
- [ ] Month navigation and Today preserved
- [ ] Every existing record still renders; no writes to training data
- [ ] EVENT / INTERVENTION / ANNOTATION have a structural home, with no new persistence
- [ ] 390/375/320 clean; contrast, targets, overflow all pass
- [ ] Other tabs unchanged; both suites green
- [ ] `CURSOR_REPORT.md` completed (A–H)
- [ ] **Do not commit.** Claude reviews the working tree first.
