# CURRENT TASK — VNEXT PHASE 2G: PROGRESS → PERFORMANCE

**Owner:** Cursor (implementation) · **Reviewer:** Claude (audit, measurement, browser QA)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (binding) · `design-vnext/DESIGN-BRIEF.md` · `.claude/skills/nxtfrm-data-viz/SKILL.md` · `.claude/skills/nxtfrm-fitness-ux/SKILL.md`
**Previous:** 2E `1499653` · D12 `0f54aa6` · 2F `ba33fa8`

---

## 1. Objective

Progress has three tabs: **Weight** (migrated in 2C), **Performance**, **Body**.
This slice migrates **Performance** only.

Performance answers: *is my strength holding while I cut?* It is the evidence screen for
the claim Today makes. It must be **analytical and honest**, never motivational.

**Out of scope:** the Weight tab (2C, done) · the Body tab · EvoScan (2F, done) · Today ·
Train · History · Settings · wearables · D13 · `readiness()` (D4) · legacy renderer removal
(D5) · `RELEASE`/`CACHE_NAME`.

---

## 2. The engine is truth — do not touch it

`strengthItems()` and `sessionRows()` in `cut-support.js` are **frozen**. Do not change the
e1RM formula, the windows, the thresholds, the cap or the vocabulary.

For reference, so you render it correctly rather than reinventing it:

- e1RM per session = `max(weight × (1 + reps/30))` across that day's working sets.
- Warm-ups excluded; sets over **15 reps** excluded; zero/negative loads excluded.
- An exercise is compared **only against itself, at the same gym**. Never mix gyms.
- A comparison needs **4 recent sessions**, the latest within **21 days** (`fresh`), the
  first of those four within **56 days**.
- baseline = mean of sessions 1–2; delta = mean of sessions 3–4 vs baseline, as a percent.
- `sustained` = both of sessions 3–4 below `baseline × 0.95`.

**The six statuses, all of which must be representable in the UI:**

| Status | Condition | tone |
|---|---|---|
| `Review` | `sustained` | watch |
| `Improving` | delta ≥ 2 | good |
| `Holding steady` | delta ≥ −5 | good |
| `Watch` | delta < −5 | neutral |
| `Older history` | not fresh, but has history | neutral |
| `Building data` | fewer than 4 comparable sessions | neutral |

Items are capped at **24** and sorted by latest date descending.

**I12 is binding:** performance language is engine vocabulary only. Never "muscle preserved",
never a strength score, never an invented composite (D9). The existing disclaimer — *"Estimated
1RM is a comparison aid, not a tested maximum or proof of muscle retention"* — **must survive**.

---

## 3. The seed cannot test this — read carefully

Measured today: the dev seed yields **20 exercises, all `Older history`**, because seeded
lifting data ends `2026-07-14` and `state.date` is `2026-09-22` — 70 days, far outside the
21-day freshness window.

```
{"count":20,"byStatus":{"Older history":20}}
```

**So the seed exercises exactly one of the six states, and it is the least interesting one.**
If you build and check against the seed alone you will ship a screen whose main states have
never been rendered.

Your `verify-2g.mjs` **must inject synthetic lifting history** that produces every status:
`Improving` · `Holding steady` · `Watch` · `Review` · `Building data` · `Older history`, plus
the empty case (no lifting history at all) and the single-gym-vs-two-gyms case.

This is the same class of gap that 2F hit. Do not repeat it.

---

## 4. Current state — the baseline nothing may lose

Measured at 390px on the Performance tab:

**Handlers (4):** `NXT.setView('overview')` · `NXT.setView('strength')` · `NXT.setView('body')`
· `apx95OpenQuickWeight()`
**Structure:** 2 surfaces (`.n99-card`), **20 rows**, **20 sparklines** (`svg.n99-spark`),
no horizontal overflow, 0 page errors.

**Renderers:** `NXP.progress()` (`premium-ui.js:941`) supplies V100 chrome —
header, `performanceSubtitle()`, the three tabs, `performanceSummary()` — and then injects
**V99 content** from `N.strengthHTML()` (`cut-support.js:1100`). `arrangeStrengthView()`
reorders the resulting DOM after render.

So Performance is currently a V99 body inside V100 chrome. **That seam is the work.**

Everything reachable today must remain reachable: all three tabs, the quick-weight entry,
every tracked exercise, its gym, its session count, its latest date and load, its status, its
delta, and its per-exercise history sparkline.

---

## 5. Required design

### 5.1 Analytical, not decorative
Per INSTRUMENT (D1): one protagonist surface. Performance is a **list of comparisons**, not a
grid of cards. Rows built from typography, spacing and hairlines, consistent with the Settings
row language established in 2E.

### 5.2 Status must not be colour-alone (I2 / I6)
Status is a **word first**, then colour, then shape. Six statuses need six legible treatments
that survive greyscale. The current `.n99-status` chip carries tone colour; keep the word
primary.

### 5.3 Charts — the data-viz skill governs
Twenty sparklines on one screen is the existing shape. Per the skill: **one axis per chart**,
never a dual scale; each exercise's spark is its **own scale** (loads differ by an order of
magnitude between a Lat Pulldown and a Reverse Fly — do not put them on a shared scale);
recessive grid; the mark carries meaning, not just colour.

Give the spark an accessible name and a textual equivalent — a sparkline with no text
alternative is a chart only sighted users can read.

### 5.4 Honesty
`Older history` must read as *"too old to compare"*, not as a failure or a gap to be filled.
`Building data` must read as *"not enough yet"*, never as zero progress. A null delta is never
rendered as `0%`.

### 5.5 Empty and edge states
No lifting history · one exercise · an exercise with 1–3 sessions · the same exercise at two
gyms (must appear as two separate comparisons) · all-older-history (the seed case) · the
24-item cap.

---

## 6. Files

| File | Permitted |
|---|---|
| `premium-ui.js` | yes — `progress()`, `performanceSubtitle()`, `performanceSummary()`, `arrangeStrengthView()` and new helpers |
| `vnext.css` | yes — a `#weightPage` Performance section, following the scoping contract |

**Do not edit:** `cut-support.js` · `index.html` · `sw.js` · `manifest.webmanifest` ·
`wearables.*` · `seed.*` · `train-anatomy.js`. **`RELEASE`/`CACHE_NAME` stay at `109`.**

If Performance genuinely cannot be rendered without replacing `N.strengthHTML()`, build the
replacement **in `premium-ui.js`** and leave the engine function in place — the same seam used
by every prior slice. Say so in the report.

Use the shared `--vn-action` token (D12). Do not reintroduce a local button fill.

## 7. Responsive

**390 · 393 · 402 · 430 · 375 · 320.** Zero horizontal overflow, targets ≥44pt, sparklines
still legible at 320, long exercise names handled honestly (wrap or truncate, never shrink
below usability), tab row usable at every width.

## 8. Tests

Add `tasks/vnext/verify-2g.mjs`, with **injected synthetic lifting history** per §3.

Cover: all six statuses render with the correct word · delta sign and precision are correct ·
a null delta never renders as `0%` · the same exercise at two gyms yields two comparisons ·
warm-ups and >15-rep sets stay excluded from the displayed e1RM · the 24-item cap · the
disclaimer is present · status is not colour-alone · each spark has its own scale and an
accessible name · empty state · no writes to `state.logs` while viewing · all three tabs still
switch · Weight and Body tabs unchanged.

Run **all sixteen** suites: `for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done`
Baseline **16 / 458 / 0 failing**.

## 9. Definition of done

- [ ] Performance reads as analytical evidence, not a card grid
- [ ] Engine untouched; e1RM, windows, thresholds and vocabulary unchanged
- [ ] All six statuses representable and correctly worded (I12)
- [ ] Status never colour-alone; survives greyscale
- [ ] Per-exercise sparks on their own scales, with accessible names and text equivalents
- [ ] Null delta never shown as `0%`; `Older history` and `Building data` read honestly
- [ ] The e1RM disclaimer survives verbatim in substance
- [ ] All 4 baseline handlers reachable; all three tabs work; every tracked exercise still shown
- [ ] 390/393/402/430/375/320 clean; ≥44pt; no overflow
- [ ] `verify-2g.mjs` injects fixtures covering all six statuses
- [ ] 16 suites / 458 tests green; `RELEASE`/`CACHE_NAME` at 109
- [ ] `CURSOR_REPORT.md` updated (A–H)
- [ ] **Do not commit. Do not push.**

## 10. Noted, not in scope

The **Progress → Body** tab still links out to the old scan entry via `NXT.more('body')`,
which 2F replaced with the new EvoScan workspace. The design brief §S says Body should gain
*analytical presence under Progress → Body while capture stays under Settings*. That is a real
follow-up, and it is **not** part of 2G. Raise it in the report; do not act on it.
