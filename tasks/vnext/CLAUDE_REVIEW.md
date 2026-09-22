# CLAUDE REVIEW — INTEGRATION CHECKPOINT INT-1

**Covers:** Today · Train · Progress/Weight · History, reviewed **together** at 390 / 375 / 320
**Commits under review:** `9fd3772` (2A) · `761f339` (2B) · `6563be6` (2C) · `eb713de` (2D)
**No features implemented during this checkpoint.**

---

> **ROUND 2 — CHECKPOINT PASSED.** C1, C2 and C3 are all fixed and re-verified by me; all four polish items landed. Round 1's findings are kept below for the record. Summary of the re-verification is at the end under **ROUND 2 RESULT**.

## A. COHERENCE VERDICT

*(Round 1 assessment — superseded by ROUND 2 RESULT below.)*

**Not yet one product — but close, and the gaps are narrow and specific.**

The four screens share a genuine common language: identical canvas (`rgb(14,16,20)`) on every screen at every width, one nav of consistent height (71px) that recedes only in active workout, consistent status/action/row idioms, and zero horizontal overflow anywhere. Data flows between them coherently.

Two things break the illusion, and one of them is very visible:

1. **The route transition is not the same animation on all screens.** Today plays the VNext spatial tier; the other three play the *old* one.
2. **Train's idle screen was never migrated.** It is a surviving V102 island sitting directly next to fully-migrated screens.

Both are fixable without touching product semantics.

## B. CROSS-SCREEN ISSUES

### B1 — Route transition splits the app in two *(required)*

Measured `animation` on `.content.active`:

| Screen | Animation | Duration | Easing |
|---|---|---|---|
| **Today** | `vn-route-enter` | **0.28s** | `cubic-bezier(.32,.72,0,1)` |
| Train | `v94-enter` | 0.42s | `cubic-bezier(.2,.8,.2,1)` |
| Progress | `v94-enter` | 0.42s | `cubic-bezier(.2,.8,.2,1)` |
| History | `v94-enter` | 0.42s | `cubic-bezier(.2,.8,.2,1)` |

**Root cause:** `render()` (`index.html:2919`) toggles `display` and the `active` class but **never removes `hide`**. The non-home sections keep `class="content hide"` permanently, so `vnext.css`'s `.content:not(.hide)` rule matches **only `#homePage`**. Everything else falls through to the legacy `.content{animation:v94-enter .42s}` in `index.html`.

Three of four screens move 50% slower, on a different curve, than the screen the direction was designed on. This is the single clearest "not one product" signal.

### B2 — Train idle is an un-migrated V102 island *(required)*

2B's scope was *active workout mode*; the pre-workout screen kept its V100 presentation. Against migrated screens it reads as a different app:

| Signal | Train idle | Rest of VNext |
|---|---|---|
| Surfaces | **two stacked rounded cards** | one protagonist surface, content on canvas |
| Primary action radius | **999px lozenge** | 12px control |
| Section heading | **20px uppercase** ("SESSION PLAN", "READY") | 13px sentence case |
| Radii present | 999px, 24px, 20px, 14px | 20 / 12 / 10 |

Card soup and pill soup are exactly what D1 and I7 reject. It is also the screen users pass through *every single lifting session*, immediately before the best-executed screen in the product.

### B3 — Type and radius scales have drifted *(polish)*

Across the four screens I counted 16 distinct rendered font sizes (10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14.5, 15, 16, 17, 18, 19, 20, 28) against a defined scale of ~7, and radii beyond the defined 20/12/10 (999, 24, 18, 14, 13, 5, 2, 1). Much of the excess is concentrated in B2. Worth a consolidation pass once B2 lands — not worth blocking on now.

## C. REQUIRED INTEGRATION FIXES

| # | Issue | Required outcome |
|---|---|---|
| **C1** | Route transition inconsistent (B1) | All five destinations use the VNext spatial tier: `vn-route-enter`, 280ms, `cubic-bezier(.32,.72,0,1)`. Fix in `vnext.css` by covering both `.content` and `.content:not(.hide)` — **do not** modify `render()` in `index.html`; the `.hide` class is load-bearing elsewhere and the render input lock must not be disturbed. |
| **C2** | Train idle un-migrated (B2) | Bring Train idle into the VNext language: at most one protagonity surface, VNext radii, 13px sentence-case section titles, the standard primary action. Preserve every existing control and entry point (Change/session picker, recovery guidance, Start workout, session plan list, add-on section, Rest/Zone2/Floorball idle variants, empty-plan state). Presentation only. |
| **C3** | 3 of 15 deterministic suites failing | See D below. All 15 suites green. |

## D. FUNCTIONAL REGRESSION RESULT

I had been running only the release gate and weight contract. Running **all 15 suites** surfaced three failures — **all from slices I already approved.** That is my process gap, now closed: every future slice review runs the full suite set.

| Suite | Result | Cause |
|---|---|---|
| 12 suites | **OK** | — |
| `wearables.recovery-integration` | 31/1 | **2A.** Asserts the literal string `recLabel=!recLogged?'Not logged'` in `premium-ui.js`. 2A removed it — it was provably dead (`void recLabel;`). |
| `wearables.training-readiness` | 28/1 | **Cascade only.** Spawns the suite above and asserts exit 0 plus `"OK  32 passed"`. Goes green when the root is fixed. |
| `wearables.train-enrichment` | 33/1 | **2B.** Asserts `muscleLine(ex)` and `anatomyStrip(ex)` appear **together** in the exercise head. 2B demoted the anatomy strip into a disclosure. |

**D4 gate verified intact:** `readiness()` is still present in `index.html`. Nothing gated was removed.

**Fix guidance:**
- **recovery-integration** — the test's stated intent is that *readiness and check-in persistence are unchanged*, not that a specific dead local survives. Re-point the assertion at the real intent: `readiness()` still present, and the recovery check-in still reachable and persisting. Keep the test count at **32** — the cascade test hardcodes `"OK  32 passed"`.
- **train-enrichment** — this one is a genuine fidelity gap, not a test-fit problem. `design-vnext` places the anatomy **inline beside the exercise name**, with muscle names beneath — together, in the head, costing no extra vertical height. Restore that pairing. If it cannot be done within the fold budget, report the measured numbers instead of guessing; Log Set must stay ≤844 at 390×844 for 0/1/2 sets.

## E. RESPONSIVE RESULT

**PASS at 390 / 375 / 320** across all four screens.

- Zero horizontal overflow, every screen, every width.
- Canvas identical (`rgb(14,16,20)`) everywhere — no screen has its own background.
- Nav height constant at 71px; recedes only in active workout; no collisions.
- Contrast: 0 failures (audited per screen in each slice review).
- Touch targets: 0 failures except the accepted 320px calendar-cell width (38×46), which is seven-column grid geometry, not a shrunk target.
- 320 behaves as a real design state — Train's aim strip wraps, History's four marks fit, type steps down.
- Known minor wrap: History's month title goes to two lines at 320.

## F. CROSS-SCREEN DATA CONTINUITY — PASS

Realistic flows, all clean:

| Flow | Result |
|---|---|
| Today → Train → log a set → Today | logs 174 → **175** → 175; session sets visible; `dayType` stable `FullB/FullB` |
| Today → Progress | weekly rate `−0.44459` |
| Progress → History → Progress | `−0.44459` → **identical**, no drift |
| Train → History | the set logged in Train **appears on today's date in History** |
| Full tour | logs 175, bws 83, cardio 15, floorball 8 — no stray mutation |

No page errors on any transition.

**Reduced motion:** consistent in effect — all four screens render with effectively zero duration (`1e-06s`). Today reports `animationName: none` while the others report a zeroed `v94-enter`; that difference disappears with C1.

## G. POLISH FIXED / DEFERRED

Batched with the required fixes this checkpoint (small, isolated, no feature work):

| Item | Disposition |
|---|---|
| Train save toast covering session identity | **Fix now** |
| Stacked disclosures at foot of active workout | **Fix now** — fold budget already proven, reachable from the mode bar |
| Selected Progress point flush to right plot edge | **Fix now** |
| History month title wraps at 320 | **Fix now** |
| Type/radius scale consolidation (B3) | **Defer** — reassess after C2 removes most of the excess |

## H. READY FOR NEXT PRODUCT SLICE

**NO** — pending C1, C2 and C3.

Nothing here is architectural; all three are contained presentation or test-intent fixes. No product semantics, storage or training meaning is implicated. Settings (2E) stays closed until this checkpoint passes.

---

## ROUND 2 RESULT — CHECKPOINT PASSED

### C1 — route transition · FIXED
All five destinations now play `vn-route-enter 0.28s cubic-bezier(.32,.72,0,1)` at 390, 375 and 320. Previously Today alone used it while Train, Progress and History ran the legacy `v94-enter 0.42s`. Fixed in `vnext.css` by covering both `.content` and `.content:not(.hide)`; `render()` untouched, so the `.hide` class and the V86 input lock are undisturbed.

**Side effect worth noting:** reduced motion is now uniformly `animationName: none` on all four screens. Before, only Today reported `none` while the rest reported a zeroed legacy animation.

### C2 — Train idle · FIXED
Measured radii on Train idle are now **12px and 20px only** — the VNext set. The 999px, 24px and 14px values are gone. Recovery guidance sits on canvas instead of a pill card; one protagonist surface remains; section titles are 13px sentence case.

I initially read the "Start workout" button as a surviving 999px lozenge. Measurement corrected that: it is **12px radius, 50px height on Today, Train idle and Train active alike**. The impression came from the button's width-to-height ratio.

Every entry point preserved — session picker, recovery guidance, Start workout, the session plan list with last-load lines, add-on section, Rest/Zone2/Floorball idle variants, empty-plan state.

### C3 — failing suites · FIXED
**All 15 suites green, 410 tests.** `recovery-integration` 32 (matching the count the cascade test hardcodes), `train-enrichment` 34, `training-readiness` 29.

Both test edits reviewed assertion by assertion:
- `recovery-integration` — the dead-local assertion is replaced by one on the real intent (check-in entry point reachable). The `readiness()` and persistence assertions are untouched. This is what I asked for.
- `train-enrichment` — the core assertion (`muscleLine(ex)` **and** `anatomyStrip(ex)` in the exercise head) is **unchanged**. Only the slice delimiter moved, from `nxp-ex-actions` to `</section>` from the head start, because Session tools moved to the mode bar. The new delimiter is **tighter**, and a guard was added that the head exists at all. Stronger, not weaker.

**The anatomy restoration cost nothing.** Log Set bottom edge is unchanged at **678 / 750 / 750 / 750** (390px) and **753 / 825 / 825 / 825** (320px) for 0/1/2/3 logged sets — all ≤844. Restoring it inline beside the exercise name added no vertical height, exactly as the approved design intended. Cursor flagged it could not measure this; I did.

### Polish — all four landed
| Item | Verified |
|---|---|
| Train save toast covering session identity | No overlap (toast top 58, mode bar bottom 56) |
| Stacked disclosures at foot of active workout | Session tools now in the mode bar: Leave, Exercise details, Swap, Undo last set, Session options, Finish. **Undo confirmed functional** — session sets 1 → 0 |
| Selected Progress point flush to plot edge | 6px wrap inset, 5px gap to the right edge |
| History month title wraps at 320 | **Single line** at all widths — "Sept 2026" at 320, "September 2026" at 375/390, nav buttons all 44pt |

### Re-verified across the board
- **Responsive:** 0 contrast failures, 0 overflow, all five surfaces × 390/375/320. Only target flags are the accepted 320/375 calendar cells (grid geometry).
- **Data continuity:** Today → Train → log → Today gives logs 174 → **175** → stable; the set appears in History on today's date; Progress' weekly rate is byte-identical after touring screens (`−0.44459`); no stray mutation; no page errors.
- **Reduced motion:** consistent across all four.

### Deferred
Type/radius scale consolidation (B3). C2 removed most of the excess; what remains is minor variance in primary-action type (Today 16px/580, Train idle 15px/600, Train active 17px/600). Not worth blocking on; revisit during a later system pass.

## G. READY FOR NEXT PRODUCT SLICE — **YES**

Today, Train, Progress/Weight and History now read as one product at 390, 375 and 320. Phase 2E (Settings) is unblocked.

## History

| Date | Slice | Verdict | Rounds |
|---|---|---|---|
| 2026-09-22 | 2A Foundation + Today | **APPROVED** | 3 |
| 2026-09-22 | 2B Train active workout | **APPROVED** | 2 |
| 2026-09-22 | 2C Progress / Weight | **APPROVED** | 2 |
| 2026-09-22 | 2D History | **APPROVED** | 2 |
| 2026-09-22 | **INT-1 integration checkpoint** | **PASSED** | 2 |
