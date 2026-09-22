# CURRENT TASK — VNEXT PHASE 2C: PROGRESS / WEIGHT

**Owner:** Cursor (implementation) · **Reviewer:** Claude (design/UX acceptance)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (binding) · `.claude/skills/nxtfrm-data-viz/SKILL.md` (binding) · `design-vnext/`
**Previous slices:** 2A `9fd3772` · design-vnext `a0c9203` · 2B `761f339`

> **Next highest-scrutiny slice.** This is where **D2 and D3 move from approved design decisions into production behaviour**. The weight chart is NXTFRM's flagship analytical surface and currently its weakest. Expect the same review standard as 2B.

---

## 1. Objective

Rebuild Progress → Weight around one rule: **one chart answers one analytical question.**

Today a single plot carries seven layers at near-equal weight — raw morning, trend, confidence band, forecast line, forecast cone, goal band, target reference — and the goal is allowed to set the Y-domain. Measured on live data:

| State | Y-domain | Consequence |
|---|---|---|
| goal off | 81–85 (**4 kg**) | readable |
| goal confirmed | 76–86 (**10 kg**) | the bottom ~40% of the plot holds **no data at all** |

A month of morning readings spanning ~2.5 kg gets compressed into the top third to reserve space for a goal weeks away. **That is the defect this slice exists to fix.**

---

## 2. The scoping line — read before touching `cut-support.js`

Progress lives in `cut-support.js`, so this slice **must** edit that file. The line is not the file, it is the function:

### ❌ TRUTH — must not change (lines ~71–263)
`weights` · `timingRows` · `windowStats` · `ewmaTrend` · `trend` · `trendConfidence` · `forecastGoal` · `plateauWindow` · `detectPlateau` · `trendStats` · `review`

These compute what the numbers **mean**. No edits, no "small improvements", no changed thresholds, constants, windows or return shapes. If one looks wrong, report it — do not fix it.

### ✅ GEOMETRY / PRESENTATION — this slice may change (lines ~686–960)
`smoothPath` · `forecastGeometry` · `trendReadText` · `chartModel` · `chartHTML` · `selectPoint` · `scrub` · `setRange` · `setGoalVisible` · `setView` · `progress`

These decide how truth is **drawn**. The domain fix lives in `chartModel()` (the offending pushes are at ~`:763-764`, `:766`, `:773`).

Also in scope: `vnext.css` (new `#weightPage` / `vn-*` section, same scoping contract), and `premium-ui.js` only if Progress is reached through it.

**Do not edit:** any `wearables.*`, `train-anatomy.js`, `seed.*`, `manifest.webmanifest`, `index.html` (unless a new asset is genuinely required). `sw.js` only to register a new asset at the existing `RELEASE` — **never bump `RELEASE`/`CACHE_NAME`** (owner is holding that as a deployment checkpoint).

---

## 3. Required behaviours

### 3.1 Recent trajectory — the primary chart
**Question: "Which way is my weight actually going, right now?"**

| Contract | Requirement |
|---|---|
| Primary | Smoothed trend — the most prominent mark |
| Context | Raw morning readings — visibly recessive |
| Y-domain | **Visible morning readings + trend only.** The goal band, goal reference line, forecast cone and forecast endpoint must **never** stretch it (D2) |
| Hidden by default | Post-workout, forecast/projection |
| Range change | Each range takes its own honest domain, re-domained correctly |
| Without colour | Trend, morning, post-workout and projection must each be distinguishable by **mark** — line vs dot vs distinct shape vs dash — not hue alone |
| Textual conclusion | A plain-language read stays visible **without scrubbing** |

### 3.2 Morning canonical, post-workout contextual (D7, D8)
- Morning weight is the canonical series.
- Post-workout is **contextual and visually secondary**: off by default, a distinct mark, never competing with morning values, and it must **never** enter the trend, plateau, forecast or confidence maths. It is currently excluded from those — keep it excluded, and **also remove it from the Y-domain** it is currently pushed into (`:763-764`).
- Do **not** change which reading is canonical on a skipped-morning day (Q1, deferred).

### 3.3 Journey — the long-term goal, separately (D3)
The distant target gets its **own representation**, not a layer on the recent chart. Start → current → target range, reading left-to-right to match its labels, showing total change and remaining distance. **Not a time-series.** This is the only place the distant goal appears — which is precisely what lets the chart above keep an honest domain.

### 3.4 Forecast — visually distinct, no false precision
- Measured history and projected future must be **unmistakably different marks** (dashed/faded projection).
- Off by default, explicitly labelled as a model estimate rather than a measurement.
- Show the engine's existing confidence/range; invent nothing. If `forecastGoal()` reports insufficient evidence, **omit the forecast entirely** rather than drawing a weak one.
- Never imply a precision the engine did not produce.

### 3.5 Scrub — touch-friendly
- Dragging **anywhere across the plot** activates the nearest valid observation. No 5px tap target.
- The selected point is obvious; a **stable metric header outside the plot** updates without moving or reflowing.
- Preserve orientation while scrubbing; keep `touch-action` correct so a horizontal scrub does not fight vertical page scroll.
- Keyboard equivalent (arrows to move, Escape to clear) and a sensible `aria-label`.
- **Critical interpretation must be readable without interacting at all.**

### 3.6 Ranges
Keep the existing range set unless there is a reason to change it, and report the reasoning. A range with insufficient history should say so rather than drawing a misleading near-empty plot. Range changes must re-domain and transition coherently — axes must not jump distractingly.

### 3.7 Chart quality
Thin marks, hairline recessive grid, no heavy gridlines, no giant gradients, no neon glow, no decorative trace animation, no dual Y-axis ever. The confidence band must not outweigh the data it describes.

---

## 4. Must remain unchanged

- Every TRUTH function in §2, and the meaning of every number they return.
- `state.bws` shape, `timeOfDay` semantics, all `apm_*` keys, `persist()`, backup/restore.
- Weight editing, weigh-in history, waist, scans, and the Strength/Body views — this slice owns **Weight**. Strength and Body may inherit foundation styling but must not be restructured.
- The V86 render input lock.
- Today, Train, History, More.

Anything on Progress → Weight with no home in the new layout: **demote, do not delete**, and list it under *Known deviations*.

---

## 5. Responsive acceptance

390 / 375 / 320, all readable, zero horizontal overflow. At 320 the chart is a **real design state** — fewer axis labels is correct; shrinking type or touch targets to fit is not. The scrub target stays full-plot at every width.

## 6. Test requirements

Add `verify-2c.mjs`. Cover: goal off · goal confirmed · each range · post-workout on/off · forecast on/off · insufficient-data/empty · a range with sparse history.

1. **D2 — the domain fix, measured.** Assert the Y-domain with the goal **confirmed** is materially tighter than today's, and that it is **identical** whether the goal band is toggled on or off. Report the numbers. This is the headline test.
2. **D8 — post-workout excluded from the domain**, and toggling it does not alter the trend line's geometry.
3. **Truth untouched** — `trend()`, `trendStats()`, `detectPlateau()`, `forecastGoal()`, `trendConfidence()` return identical values before and after this slice on the same data.
4. **Scrub** — a drag across the plot selects the nearest observation and updates the header without layout shift; works via touch; keyboard equivalent works.
5. **Interpretation without interaction** — the textual read is present on load.
6. **Ranges** — each re-domains; an insufficient range degrades honestly.
7. **Forecast** — distinct mark, off by default, omitted when evidence is insufficient.
8. Contrast ≥4.5:1, targets ≥44pt, no overflow, at 390/375/320 across all states.
9. Reduced motion.
10. Non-regression: Today, Train, History, More; `node wearables.release-gate.test.js` green.

Screenshots of each major state at 390 and 320 into `tasks/vnext/shots/`.

## 7. Explicitly out of scope

Progress → Performance (2F) · Body Intelligence / OCR (2G) · History (2D) · Settings (2E) · AI (2H) · Supabase/schema/RLS · `readiness()` removal (D4/X1) · legacy renderer removal (D5/X2) · Q1 canonical-weight rule · `RELEASE`/`CACHE_NAME` bump · any change to a TRUTH function.

---

## 8. Definition of done

- [ ] Recent-trajectory domain excludes goal, target line, forecast cone and post-workout — proven by measurement
- [ ] Domain is identical with the goal toggled on and off
- [ ] Journey exists as a separate non-time-series treatment
- [ ] Forecast visually distinct, off by default, omitted on weak evidence
- [ ] Scrub works anywhere on the plot, by touch, with a stable header and a keyboard path
- [ ] Interpretation readable without interacting
- [ ] Series distinguishable without colour
- [ ] All TRUTH functions return identical values — proven by test
- [ ] 390/375/320 clean; contrast, targets, overflow all pass
- [ ] Other tabs unchanged; release gate green
- [ ] `CURSOR_REPORT.md` completed (A–H)
- [ ] **Do not commit.** Claude reviews the working tree first.
