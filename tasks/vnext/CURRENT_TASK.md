# CURRENT TASK — VNEXT PHASE 2A: FOUNDATION + TODAY

**Owner:** Cursor (implementation) · **Reviewer:** Claude (design/UX acceptance)
**Status:** READY TO START
**Read first:** `tasks/vnext/DECISIONS.md` (binding) · `design-vnext/` (visual source of truth)

---

## 1. Objective

Land the VNext visual foundation and migrate **Today** — both the lifting state and the rest state — onto it, together with the shared navigation and page-transition foundation that later slices will reuse.

**This slice is presentational.** Today must read exactly the same engine values, through exactly the same functions, as it does now. Nothing about what a number means may change.

---

## 2. Approved design reference

| What | Where |
|---|---|
| Visual system (tokens, type, spacing, surfaces, motion) | `design-vnext/vnext.css` |
| Today · lifting + Today · rest | `design-vnext/vnext.js` → `screenToday()` |
| Nav + transition | `design-vnext/vnext.css` §11, §18 · `vnext.js` → `renderNav()`, `render()` |
| Rationale and acceptance intent | `design-vnext/DESIGN-BRIEF.md` §H–N, §O, §Y, §AA, §AB |

Preview: `python3 -m http.server` from the repo root → `/design-vnext/`.
Desktop gives a phone frame with 390/375/320 toggles. Use the `Today · lift` and `Today · rest` buttons.

`design-vnext/` is a **reference, not a library.** Do not import its files into production, and do not copy its prototype-only harness (`.devbar`, `body.harness`, the `NXD` fixture). Port the *system*, not the prototype.

---

## 3. Files / areas likely affected

| File | Expected change |
|---|---|
| `premium-ui.js` | Replace the body of `NXP.home()` with the VNext Today. Leave every other `NXP` function alone. |
| **new** `vnext.css` (production copy) | The VNext foundation layer, loaded last in `<head>` |
| `index.html` | One `<link>` for the new stylesheet (cache-busted like its siblings). Possibly the `<nav class="tabs">` markup if nav structure demands it. |
| `premium-ui.css` / `cut-support.css` | Only to neutralise rules that fight the new layer. Prefer overriding in `vnext.css`. |

**Do not edit:** `cut-support.js`, any `wearables.*` engine file, `train-anatomy.js`, `seed.*`, `manifest.webmanifest`.

**Amended after review round 1:**
- `sw.js` — **authorised for one specific change only**: registering `vnext.css` in the `VERSIONED` array at the existing `RELEASE`. Bumping `RELEASE` or `CACHE_NAME` is a release action and remains out of scope. Any new `.js`/`.css` the page requests must be in the offline shell or the release gate fails and the PWA breaks offline.
- `wearables.release-gate.test.js` — may be adapted **only** where it asserts on markup this slice legitimately changed. Preserve the original intent of every assertion and declare the change in the report. Weakening a gate to make it pass is a defect.

### 3.1 Provided asset — `vnext.css` (already in the working tree, untracked)

A **foundation draft of `vnext.css` is already present at the repo root.** It was authored by the design director as the design-system layer (tokens, type scale, spacing, surfaces, status, actions, week strip, 320 rules, reduced motion) and is scoped so it cannot reach screens this slice does not own.

- **Use it.** Do not start a competing stylesheet, and do not duplicate its tokens elsewhere.
- **You may modify it** where implementation reality requires — specificity fights with `premium-ui.css`, missing rules, wrong assumptions about existing markup. Say so in *Known deviations*.
- It is **not yet linked** from `index.html`. Wiring it in is part of this task.
- Its scoping contract is load-bearing: Today rules stay under `#homePage`, nav rules under `.tabs`, and component classes stay `vn-*`. Keep that contract.

You still own the Today renderer itself (`NXP.home()`), the wiring, and all verification.

---

## 4. Required behaviours

### 4.1 Foundation
- Port the VNext token set, type scale, spacing scale, surface/depth tiers, differentiated radii, and motion tiers into a production `vnext.css`.
- Load it **after** `cut-support.css` and `premium-ui.css` so it wins, with the same `?v=` cache-busting convention.
- Scope it so it cannot restyle screens this slice does not own. Today, the nav and the page shell are in scope; Train, Progress, History and More must look **exactly as they do now**.
- Honour `env(safe-area-inset-*)` top and bottom.

### 4.2 Navigation
- Five tabs unchanged in identity, order, labels and `data-tab` values (`home`, `train`, `weight`, `history`, `more`).
- Active tab is the one persistent violet in the product: violet glyph + label and a short top rule.
- `aria-current="page"` on the active tab (already done in `render()` — keep it).
- Nav is safe-area padded and does not overlap page content at any supported width.
- Build in the ability for nav to recede (D6) but **do not wire it to anything** — Train is 2B.

### 4.3 Page transition
- Entering a tab plays a ~280ms position-preserving rise + fade (6px), easing `cubic-bezier(.32,.72,0,1)`.
- No hard screen replacement, no horizontal slide, no theatrical movement.
- **The render input lock at `index.html:2919` is load-bearing** — it prevents rebuilds while the iOS keyboard is up. The transition must not defeat it, delay `render()`, or introduce a path that repaints during input focus.

### 4.4 Today — lifting state
Order, top to bottom:
1. Context: weekday eyebrow + date, with the gym control on the right.
2. **The decision — the single protagonist surface on this screen.** Focal treatment. Contains: `NXTFRM DECISION` eyebrow, verdict, supporting line, an inline evidence pair, and a text action into the review.
3. Today's training: day label, `N exercises · N working sets · Gym`, primary action, last-session line.
4. **Current state — data rows, not cards:** Weight (7-day mean + weekly change), Performance (engine status word), Cardio (week total / target).
5. Your week strip.
6. Quick actions as text actions.

Rules:
- **Exactly one surface.** Everything else sits on the canvas separated by hairlines and spacing.
- **No chart on Today** (I9).
- **The cloud/sync banner must not appear in normal operation** (I10). Keep the real-problem path working.
- Performance uses engine vocabulary only (I12).
- The primary action keeps its current behaviour for every day type, including the finished-session case.

**Decision copy — important.** Render the verdict and supporting line from the existing `N.review()` fields (`title`, `message`/`reason`, `tone`). The prototype's *"Hold the plan" / "Nothing needs changing"* verdict vocabulary is **out of scope (Q2)** — it is a decision-layer change, not presentation. Use `tone` to select the status treatment. Evidence pair may use `NXT.detectPlateau()` rate + confidence, which Today already reaches for.

### 4.5 Today — rest state
Must **adapt**, not relabel:
- No lifting CTA, no session-plan summary, no stale lifting figures.
- No gym control (gym is meaningless when nothing is scheduled).
- Morning-weight row reflects **the displayed day**: shows the value if logged, otherwise reads as an unlogged prompt.
- An **"Add optional lifting"** affordance that states in words that the day stays a rest day.
- Next-session line.
- Current state, week strip and quick actions still present.

**Add-on semantics are load-bearing.** `state.addOns` is deliberately a separate map from `state.sessionPlans` (`index.html:2815-2819`) precisely so an add-on cannot reclassify the day. This slice only surfaces the affordance; it may reuse the existing add-on entry point but must not alter `resolveDayType()`, `sessionPlans`, or the addOns/sessionPlans separation.

---

## 5. Must remain unchanged

- All `cut-support.js` calculations and the `NXT` API surface.
- `state` shape, all `apm_*` localStorage keys, `persist()`, Safe Sync, backup/restore.
- `resolveDayType()`, day overrides, `sessionPlans` vs `addOns` separation, Gym A/B.
- `template()` vs `templateFor()` — **different stores** (session plan vs programme template). Confusing them silently corrupts sessions.
- Morning canonical / post-workout contextual (D7, D8). Do not touch the skipped-morning selection rule (Q1).
- The render input lock and `state.typingWeight` / `window.__apexTyping` handling.
- Train, Progress, History, More — visually and behaviourally untouched this slice.
- Every existing Today entry point must still work: `startWorkoutNow`, `showCardioSheet`, `apx96OpenReadiness`, `showSessionSheet`, `cycleGym`, `apx95OpenQuickWeight`, `NXT.openReview`, `NXT.openCalories`, `NXT.more('training')`, `switchTab`.

If something on today's Today has no home in the VNext layout — e.g. the calorie-guide row, the adherence block, the recovery card — **do not delete it. Demote it** below the fold or into a disclosure, and list it under *Known deviations* for review. Silent feature loss is a required-fix.

---

## 6. Responsive acceptance

| Width | Requirement |
|---|---|
| 390 | Reference layout. Decision surface **and** the primary action both above the fold at 844 height. |
| 375 | No reflow damage, no clipped labels. |
| 320 | **A real design state, not a shrink.** 16px gutter, stepped-down type where specified, wrapping instead of crushing. |

- **Zero horizontal overflow at all three widths** on both Today states (`scrollWidth === clientWidth`).
- No nav overlap; safe areas respected.
- Text must not be shrunk below the scale to make something fit.

## 7. Visual acceptance

- Exactly one surface on Today; the rest on canvas.
- Violet confined to I1's permitted uses. No purple wash, no glow on every control, no neon outlines.
- Differentiated radii (I7) — Today must not read as a stack of identical cards.
- Tabular numerals on every value that can change.
- Status carries word + shape, never colour alone (I2, I6).
- Rest state is visibly a *different screen*, not the lifting screen with swapped strings.

## 8. Test requirements

Automated, committed under the repo's existing test conventions where one fits; otherwise a Playwright script under `tasks/vnext/`:

1. **Contrast** — computed audit of rendered text on both Today states against actual backgrounds. **All text ≥4.5:1.** (The prototype's first ink ramp failed at 4.41 and 2.46 — expect to have to tune.)
2. **Touch targets** — every interactive element on both Today states **≥44pt effective**. (The prototype's first pass failed at 33px and 36px.)
3. **Overflow** — `scrollWidth === clientWidth` at 390/375/320 on both states.
4. **Reduced motion** — with `prefers-reduced-motion: reduce`, Today renders and tab switching works with no positional animation.
5. **Non-regression** — Train, Progress, History and More still render without console or page errors after the CSS layer lands; existing suites still pass.
6. **Entry points** — each Today control still invokes its existing function.

Screenshots of both states at 390 and 320 saved under `tasks/vnext/shots/`.

## 9. Explicitly out of scope

Train redesign · Progress implementation · **chart-domain change (D2 — 2C)** · History redesign · Body Intelligence · OCR · Settings redesign · AI integration · Supabase/schema/RLS · **`readiness()` removal (D4/X1)** · **legacy renderer removal (D5/X2)** · decision verdict vocabulary (Q2) · any calculation, storage or training-semantics change · dependency additions or a build step.

---

## 10. Definition of done

- [ ] Both Today states match the approved direction at 390/375/320
- [ ] All §8 tests pass, results in `CURSOR_REPORT.md`
- [ ] Nothing in §5 changed; anything demoted is listed under *Known deviations*
- [ ] Other four tabs visually and behaviourally unchanged
- [ ] `CURSOR_REPORT.md` completed (sections A–H)
- [ ] **Do not commit.** Claude reviews the working tree, then approves the commit.
