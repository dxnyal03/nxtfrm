# CLAUDE REVIEW

## Slice

`VNEXT PHASE 2D: HISTORY` — final (rounds 1–2)

## Verdict

**APPROVED — ready for the owner's commit decision.**

Round 1 found one semantic regression; round 2 fixed it. Round 1's findings are kept below for the record.

### Round 2 — re-verified by Claude
- **Conditioning label restored.** Block labels are now `Lifting / Conditioning / Weight`, and the heading above the Floorball row reads **Conditioning**, not Cardio. The floorball row itself is unchanged (`Floorball · 90 min`), and its calendar mark, `data-kind` and `aria-label` are untouched.
- **All 2D contracts re-verified after the fix:** partial update still real (calendar, header, filters and all 30 cells survived a date change; scroll preserved) · month navigation intact · **86/86 days, zero data mismatches** · training data byte-identical to baseline (174/15/8/83) · 4 marks with 4 distinct geometries at 390/375/320 · contrast 0 failures · no overflow · reduced motion clean · other four tabs unchanged · release gate **53/0** · weight contract **31/0**.

## Process note

Cursor completed the slice at ~14:12 but its CLI **hung without exiting** (0% CPU, 26 min, no writes), so its summary was never flushed. The work product was complete and intact on disk — `premium-ui.js` passes `node --check`, `verify-2d.mjs` is valid ESM, `vnext.css` braces balance 388/388, report has all sections A–H. I verified completeness before terminating the stuck process. Nothing was lost.

## Scope check

Clean: `premium-ui.js`, `vnext.css`, `CURSOR_REPORT.md` + test artefacts. No `cut-support.js`, no `index.html`, no `wearables.*`, no `RELEASE`/`CACHE_NAME` change. Nothing committed.

## APPROVED — verified by me

**All three named defects are fixed:**

| Defect | Evidence |
|---|---|
| Full-page rebuild on date select | **Proven partial.** Marked real DOM nodes, changed date: calendar node, header and filters **all survived**, and **all 30 calendar cells survived** — selection state moves in place rather than the grid being recreated. Only the day region's contents were replaced. Scroll preserved (0 → 0). |
| Filters dominated | Now a quiet underlined text row (All / Lifting / Cardio / Weight), clearly subordinate to the calendar. All four scopes still work, with correctly scoped summaries: 6 lifting days · 12 cardio days · 29 weigh-ins · 31 active days. |
| Floorball indistinguishable | Floorball now has its **own calendar mark**. Four marks, **four genuinely distinct geometries**: filled disc (5×5 round), hollow ring (5×5 bordered), **rotated diamond** (4.5×4.5, rotated), bar (7×2.5). Not colour-dependent. Legend shows all four. `aria-label` reads *"15 September, lifting, cardio, floorball, weigh-in"*. |

**Also verified:**
- **Data integrity: 86/86 dated days, zero mismatches** against my pre-delegation baseline — every day's record kinds match `state` exactly, floorball included.
- **History is read-only.** After navigating every month and selecting every dated day: logs 174, cardio 15, floorball 8, bws 83 — identical to baseline. No `persist()`, no writes.
- History UI state stayed in-memory; nothing new is persisted.
- Calendar is native to the page, not in a card. Month nav, Today jump, weekday header, outside-month days, today marker and selected treatment all intact.
- Capabilities all reachable: day modal (opens with working sets, exercises, logging-span note), per-set editing, other-day details, legend, month nav.
- A four-kind day renders all four blocks correctly.
- Contrast: **0 failures** at 390/375/320. No horizontal overflow at any width.
- Reduced motion: renders, `animationName: none`, no errors.
- Today, Train, Progress, More unchanged, no console errors. Release gate **53/0**, weight contract **31/0**.
- `EVENT / INTERVENTION / ANNOTATION` have a structural home (`historyAuditLanes`), layout-only, **no persistence added** — confirmed by reading the diff.

## REQUIRED FIXES

| # | File | Issue | Required outcome |
|---|---|---|---|
| 1 | `premium-ui.js` → `historyConditioningBlock` | **Semantic regression.** The block label was changed from **"Conditioning"** to **"Cardio"**, but the block still contains the Floorball rows. A floorball match now renders under a heading that says *Cardio*, which asserts something untrue about the activity. `nxtfrm-fitness-ux` is explicit that Floorball keeps its own meaning, and this slice's whole third defect was making floorball distinguishable — the calendar now does, while the day view re-merges it under the wrong word. The `data-kind="conditioning"` attribute kept the right semantic; only the visible label regressed. | Restore a label that does not claim floorball is cardio. Simplest correct fix is the previous **"Conditioning"**. Splitting floorball into its own labelled block is also acceptable. Do not change the rows, the marks, or `data-kind`. |

## ACCEPTED — not a defect

**Calendar cell width at 320px is 38px** (height 46px), below the 44pt guide. This is the geometry of a seven-column month grid: 320 − 32px gutter = 288 ÷ 7 = 41px maximum. 44px-wide cells are physically impossible without horizontal scroll, which is a worse outcome. Height clears 44, the effective target is 38×46, and this constraint predates the slice. Not caused by fitting four marks.

## POLISH — non-blocking, carried forward

Alongside the three existing items (save toast covering session identity; stacked disclosures in active workout; selected chart point flush to the right plot edge):
- At 320 the month title wraps to two lines. Acceptable, but a slightly smaller title would keep it on one.

## REGRESSION RISKS

Each checked, each clear: training data untouched and byte-identical · no new persistence · every stored record still renders (86/86) · engine untouched · other four tabs unchanged · both suites green · `RELEASE` still 109.

## VERIFICATION RUN BY CLAUDE

Own scripts, own Chromium, independent of `verify-2d.mjs`: partial-update proof via marked DOM nodes (calendar, header, filters, all cells) · scroll-position preservation · month navigation and Today · 86-day data-integrity diff against a pre-delegation baseline · training-data mutation check · four-kind day with computed mark geometry · contrast/targets/overflow at 390/375/320 · filter scoping on a month with real lifting data · day modal and per-set edit reachability · reduced motion · other-tab non-regression · both test suites · truncation check on all changed files.

## NEXT ACTION

Cursor: fix required fix 1 only — restore the conditioning block label. Re-run the 390/375/320 checks and both suites. Do not commit.

---

## History

| Date | Slice | Verdict | Rounds |
|---|---|---|---|
| 2026-09-22 | 2A Foundation + Today | **APPROVED** | 3 |
| 2026-09-22 | 2B Train active workout | **APPROVED** | 2 |
| 2026-09-22 | 2C Progress / Weight | **APPROVED** | 2 |
| 2026-09-22 | 2D History | **APPROVED** | 2 |
