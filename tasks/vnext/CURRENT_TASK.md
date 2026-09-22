# CURRENT TASK — VNEXT PHASE 2F: EVOSCAN FLAGSHIP EXPERIENCE

**Owner:** Cursor (implementation) · **Reviewer:** Claude (audit, measurement, browser QA)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (binding) · `design-vnext/DESIGN-BRIEF.md` §S, §T · `.claude/skills/nxtfrm-ai-systems/SKILL.md` (OCR) · `.claude/skills/nxtfrm-data-viz/SKILL.md` (trends) · `.claude/skills/nxtfrm-fitness-ux/SKILL.md` (scans)
**Previous:** 2E `1499653` · D12 `0f54aa6`

---

## 0. Two equal goals

1. **Materially improve OCR / scan extraction reliability.**
2. **Redesign EvoScan into a premium, phone-first body-composition intelligence experience.**

Neither is the junior partner. A beautiful screen over a parser that misreads is a failure;
a good parser behind the current screen is also a failure.

**Out of scope, do not touch:** Train muscle-map implementation (audit/design only, separately
gated) · Settings · History · wearables · Garmin · D13 cleanup · broad architecture
modernisation · `readiness()` (D4) · legacy renderer removal (D5) · `RELEASE`/`CACHE_NAME`.

---

## 1. Audit findings — already measured, start here

I audited the live pipeline before writing this. These are facts, not guesses.

### 1.1 The parser corrupts its own labels — flagship OCR defect

`extractEvoValues()` (`index.html:4061`) pre-processes with:

```js
.replace(/O/g,"0")
```

Intended to repair OCR reading `0` as `O` **inside numbers**. It runs across the **entire
text**, including labels, before any pattern matches. So on the uppercase printouts most
body-composition machines produce:

| On the scan | After the replace | Pattern | Result |
|---|---|---|---|
| `BODY FAT` | `B0DY FAT` | `/body\s*fat/i` | **no match** |
| `BODY WEIGHT` | `B0DY WEIGHT` | `/body\s*weight/i` | **no match** |
| `TOTAL DAILY ENERGY` | `T0TAL DAILY ENERGY` | `/total\s*daily\s*energy/i` | **no match** |

Any label containing a capital `O` is destroyed. Fix the substitution so it can only apply
to numeric contexts, never to label text.

### 1.2 Other parser weaknesses

- **Greedy fallback.** `/(\d{2,3}\.\d)\s*kg/i` matches *any* number before `kg`, so a muscle-
  mass or fat-mass line can be captured as weight.
- **Optional decimal.** `\d{2,3}\.?\d?` matches `818` as readily as `81.8`. A dropped decimal
  point becomes a plausible-looking wrong value with no sanity check.
- **Comma handling.** `numFromText` strips commas, so a European decimal `81,8` becomes `818`.
- **No units.** `lb` vs `kg` is never considered; the value is taken as-is.
- **No validation.** No plausible range is enforced on any field.
- **Confidence is discarded.** `Tesseract.recognize()` returns per-word and overall confidence;
  only `result.data.text` is read. Nothing downstream can know what was uncertain.
- **No image preparation.** `readEvoScanOCR()` hands Tesseract the raw camera file — no
  orientation (EXIF), scaling, greyscale, contrast or thresholding.

### 1.3 Raw OCR text is shown to the user

`renderEvoScanPage()` renders an "OCR text" block containing `result.data.text`. Acceptance B
forbids exposing raw OCR output. Keep it for diagnostics only if it is behind an explicit
developer affordance, otherwise remove it from the user-facing flow.

### 1.4 Data integrity — an Evo Scan can silently become the weight trend

**Measured, not inferred.** `saveEvoScan()` (`index.html:4140`) dual-writes:

```js
state.scans.push(scan);
if(scan.weight) state.bws.push({id:uid(),date:scan.date,weight:scan.weight,timeOfDay:"Evo Scan"});
```

`NXT.cleanRows()` (`cut-support.js:66-67`) picks one row per date: morning always wins; with no
morning row, **the last non-morning row wins.** I injected a 99.9 kg Evo Scan weight:

| Date | Canonical row after injection |
|---|---|
| has a morning weigh-in | `86.7 · Morning` — unchanged, correct |
| **no morning weigh-in** | **`99.9 · Evo Scan`** — the scan became the trend point |

`cleanRows` feeds EWMA trend, plateau detection and forecast.

**The owner has confirmed EvoScan readings are usually taken post-workout.** That makes this
sharper than a generic "clinic reading" concern:

> **D8 is binding: post-workout weight remains contextual — never enters trend, plateau,
> forecast or confidence maths.**

An EvoScan weight is, in substance, a post-workout reading. But it is stored as
`timeOfDay:"Evo Scan"`, not `"Post-workout"`, so it escapes the intent of D8 and can still
become the canonical row for a skipped-morning date. A post-workout reading is dehydrated and
not comparable to a morning fasted one.

Note the same gap exists for rows actually labelled `Post-workout` — `cleanRows` gives morning
priority but falls back to *any* non-morning row. That is deferred question **Q1**, and this is
the same defect reaching the trend through a second door.

**RESOLVED BY OWNER DECISION D14 — the freeze is lifted and this must now be fixed.**

> **Only a Morning weigh-in is eligible for the canonical body-weight trend.**
> Post-workout and EvoScan weights are contextual only. **When a date has no morning
> weigh-in, the canonical trend point is absent. There is no fallback to either.**

This is a **truth-layer change** and the one place this slice may touch `cut-support.js`.
Change `cleanRows()` selection only. Do not redesign the weight model beyond enforcing this.

I verified the target behaviour before writing this:

| Date | Current rule | Under D14 |
|---|---|---|
| no morning, has Post-workout 99.1 | 99.1 becomes canonical | **absent** |
| no morning, has EvoScan 99.9 | 99.9 becomes canonical | **absent** |

Canonical count on the dev seed went 83 → 81 with two injected gaps.

**The dev seed is 100% Morning (83/83), so this change is a no-op on seed data and the
trend output is byte-identical.** It therefore *cannot* be proven with the seed alone —
your fixtures must inject Post-workout and EvoScan rows or the change is untested.

The weights stay fully preserved in the EvoScan record, scan detail, scan history,
scan-to-scan comparison and body-composition analysis. Nothing is deleted; only canonical
*eligibility* changes.

Document ownership clearly in the report: which surface owns each metric.

### 1.5 Deleting a scan orphans its weigh-in

The inline delete in `renderEvoScanPage()` filters `state.scans` and persists. It does **not**
remove the `bws` row the save created, and it has **no confirmation**. Deleting a scan leaves a
stray `Evo Scan` weigh-in which — per 1.4 — may still be acting as a canonical trend point.

Fix the orphan and add a confirm. **Deleting the scan must not delete a weigh-in the user
entered by hand** — only the row that scan created. If you cannot identify that row with
certainty from the existing record shape, say so and leave it, rather than guessing.

### 1.6 `Number(x) || ""` discards legitimate zeros

`saveEvoScan()` coerces every metric with `Number(val(...)) || ""`. A true `0` becomes empty.
Low impact for weight, real for a metric that can legitimately read zero.

---

## 2. Current capability baseline — nothing here may be lost

Measured at 390px in the `body` view.

**Handlers (5):** `apx96SetMoreView('hub')` · `handleScanFile(this)` · `readEvoScanOCR()` ·
`saveEvoScan()` · `useLatestScanTDEE()`, plus the inline per-scan delete.

**Fields (9):** `scanFile` `scanDate` `scanWeight` `scanBodyFat` `scanMuscleMass` `scanFatMass`
`scanTDEE` `scanBMR` `scanNotes`.

**Metrics supported today:** weight · body fat % · muscle mass · fat mass · TDEE · BMR · notes ·
date · image. Plus scan-to-scan deltas (`scanDelta`), a coach-insight block, scan history with
delete, and `useLatestScanTDEE()` writing `settings.tdee` / `USER_TDEE`.

**Storage:** `apm_evo_scans` holds `state.scans`. Record shape:
`{id, date, image, weight, bodyFat, muscleMass, fatMass, tdee, bmr, notes}`.
17 localStorage keys total. **Do not change the record shape or the key.** Additive optional
fields are acceptable only if every existing scan still renders unchanged when the field is
absent.

---

## 3. Required work

### 3.1 OCR pipeline

Audit before changing — §1 is the start, not the whole. Then improve where justified:
image preparation (EXIF orientation, scaling, greyscale, contrast/threshold) · robust
label-aware parsing · units · decimal handling · **per-field confidence** · validation against
plausible ranges · partial extraction · failure recovery · manual correction.

**Never fabricate a metric absent from the scan.** A field not found is `NOT FOUND` — never a
guess, never carried over from a previous scan, never inferred from another field.

**Preserve the original scan image.** It is evidence.

**Never save silently.** The user reviews before anything is written (§T of the brief).

### 3.2 Review experience — phone-first

Show **ORIGINAL SCAN** against **EXTRACTED METRICS**, with each field exposing value, unit,
status and an edit control. Three statuses, in plain language:

`HIGH CONFIDENCE` · `CHECK` · `NOT FOUND`

Status must not be colour-alone (I2/I6) — word first, then colour, then shape. No raw OCR JSON
or text in the user-facing flow.

### 3.3 Dashboard — a body-composition workspace, not an OCR tool

Prioritise: latest scan · weight · body fat · muscle mass · fat mass · other supported metrics ·
**change vs previous scan** · trends · **what changed** · scan history · individual scan detail.

Per §S of the brief: **MEASURED and ESTIMATED must be visually distinct**, per-metric trends on
**separate scales** (never one multi-scale chart), direct earlier↔current comparison, **no radar
charts, no Body Score** (D9 — no invented composite metric).

Visual language: dark charcoal not pure black · refined violet accents · premium typography ·
strong spacing · excellent mobile hierarchy · interesting but not cluttered · **no generic card
explosion** · no green-dominant UI · no cheap glassmorphism. INSTRUMENT (D1) still governs: one
protagonist surface.

Use the shared `--vn-action` primary token from D12. Do not reintroduce a local button fill.

### 3.4 States

Design all of them, not just the happy path: empty · loading · partial OCR · error · no previous
scan to compare against · a scan with only some metrics present.

---

## 4. Files

| File | Permitted |
|---|---|
| `index.html` | yes — the EvoScan pipeline and `renderEvoScanPage()` region |
| `vnext.css` | yes — a new `#morePage` EvoScan section, following the scoping contract |
| `premium-ui.js` | yes, only if the scan surface needs an `NXP`-side renderer |

| `cut-support.js` | **narrowly** — `cleanRows()` canonical selection only, to enforce D14. Nothing else in the engine. |

**Do not edit:** `sw.js` · `manifest.webmanifest` · any `wearables.*` · `seed.*` ·
`train-anatomy.js`. **`RELEASE`/`CACHE_NAME` stay at `109`.** No other engine function may
change — not `ewmaTrend`, `trend`, `trendConfidence`, `forecastGoal`, `plateauWindow`,
`detectPlateau`, `trendStats` or `review`.

If the page requests a new `.js`/`.css`, `sw.js` must list it at the current `RELEASE` — which
means introducing a new file requires owner approval first. Prefer not to.

## 5. Responsive

Phone is the product. Verify **390 · 393 · 402 · 430**, plus **375 and 320** as fallback.
Touch targets ≥44pt · keyboard-safe editing · safe areas · no hidden CTA · no horizontal
overflow · scan preview usable · charts readable · **OCR correction comfortable one-handed**.

## 6. Tests

Add `tasks/vnext/verify-2f.mjs`. **Synthetic fixtures only — never commit a personal scan image.**
Generate scan-like images programmatically (canvas/SVG → PNG) covering: a clean uppercase
printout · a lowercase one · a rotated one · a low-contrast one · one with a missing metric ·
one with a decimal-point loss · one with `lb` units · pure garbage.

Cover: label-aware parsing survives the O/0 repair · no fabricated metric ever appears ·
confidence maps to the three statuses · validation rejects implausible values · partial
extraction · manual correction · existing scans still render · storage shape unchanged ·
delete removes the scan without orphaning · no writes before explicit save.

Run **all sixteen** suites: `for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done`
Baseline **16 / 458 / 0 failing**.

## 7. Definition of done

- [ ] OCR audit reported, with failure modes found and which were fixed
- [ ] Label corruption (§1.1) fixed; labels survive the numeric repair
- [ ] Units, decimals, validation and per-field confidence implemented
- [ ] No fabricated metric, ever; `NOT FOUND` is a real state
- [ ] Original scan preserved; nothing saved without explicit review
- [ ] Review flow shows scan vs metrics, with value/unit/status/edit per field
- [ ] No raw OCR text or JSON in the user-facing flow
- [ ] Dashboard reads as a body-composition workspace; measured vs estimated distinct;
      per-metric separate scales; no radar, no Body Score
- [ ] Delete no longer orphans a weigh-in, and confirms
- [ ] §1.4 documented and surfaced honestly; **selection rule unchanged**
- [ ] Empty / loading / partial / error / no-previous states all designed
- [ ] 390 / 393 / 402 / 430 / 375 / 320 clean; one-handed correction verified
- [ ] All 5 baseline handlers and 9 fields still reachable; storage shape and key unchanged
- [ ] 16 suites / 458 tests green; `RELEASE`/`CACHE_NAME` at 109
- [ ] `CURSOR_REPORT.md` updated (A–H), including the OCR audit
- [ ] **Do not commit. Do not push.**

---

# ADDENDUM — product & data semantics (owner, folded in)

Binding. Where this addendum and §1–§7 differ, the addendum wins.

## A1. OCR bug must be fixed at the owning layer

Do **not** special-case `BODY FAT` and `TOTAL DAILY ENERGY`. Separate the two concerns:

- **Label normalisation** — `BODY FAT` stays searchable as `BODY FAT`.
- **Numeric normalisation** — `8O.4` may become `80.4` **only inside an expected numeric
  context**.

**Never globally mutate the OCR text.**

## A2. Staged extraction architecture

```
image → preprocessing → OCR → line/token representation → label detection
      → nearby-value extraction → numeric/unit normalisation → plausibility validation
      → confidence assessment → human review
```

Prefer local label→value association over a bag of greedy regexes run across destructively
normalised text. Keep the original OCR text internally for provenance and debugging; do not
render it prominently in the normal flow.

## A3. Confidence — OCR confidence is not product confidence

Retaining Tesseract confidence/token/line data is required; treating it *alone* as the answer
is wrong. Derive the user-facing status from a combination of: OCR confidence · expected label
found · unit consistency · plausible range · ambiguity · competing values · parser confidence.

User-facing states stay exactly three: `HIGH CONFIDENCE` · `CHECK` · `NOT FOUND`.
**Avoid fake numerical certainty** — do not print a percentage that implies precision you
do not have.

## A4. Field-aware validation

| Field | Rules |
|---|---|
| Weight | kg where applicable · reject implausible values · **no greedy fallback to the first arbitrary `kg`** · `818` must not be read as `81.8` without evidence |
| Body fat | percentage semantics · plausible range · **never confused with fat mass** |
| Muscle mass | mass semantics · distinguish from percentages |
| Fat mass | mass semantics · **generic kg fallback must not steal it as body weight** |
| BMR / TDEE | calorie-scale · **BMR distinguished from total daily energy** |

When several candidate values compete, mark **CHECK** — never guess.

## A5. Image preparation

Implement what genuinely helps: EXIF/orientation correction · sensible resizing · greyscale ·
contrast normalisation · mild sharpening · thresholding where useful · safe crop/margin
handling.

**Never permanently alter the original upload.** If you try multiple preprocessing variants,
select by extraction quality rather than always applying the strongest. Do not build an
unnecessarily complex CV pipeline.

## A6. Review before save — the shape

```
EVOSCAN REVIEW
[ scan preview ]
Weight        82.4 kg     HIGH CONFIDENCE
Body fat      23.1 %      HIGH CONFIDENCE
Muscle mass   36.9 kg     CHECK
Fat mass      19.0 kg     HIGH CONFIDENCE
BMR           1,820 kcal
TDEE          2,460 kcal
```

Every value editable. `NOT FOUND` fields stay **visibly absent**, never silently synthesised.

## A7. Provenance — the scan is evidence

Preserve the original scan where the storage model permits. A record should distinguish
`OCR_EXTRACTED` · `USER_CORRECTED` · `MANUAL_ENTRY`. For a corrected value, **retain the
original OCR interpretation internally** rather than overwriting provenance.

Additive optional fields only — every existing scan must still render when they are absent.

## A8. Delete semantics

Audit the real relationship between the scan record, weight/body observations and Body
history, then choose coherent behaviour. At minimum: explain what will be deleted · explain
what will remain · require explicit confirmation.

**Never silently cascade-delete a canonical Morning record.** Never silently orphan
scan-derived contextual values without explanation.

## A9. Visual north star

EvoScan becomes a flagship mobile surface: **body-composition intelligence**, not an OCR
upload tool. Charcoal not pure black · premium violet accents · strong typography · controlled
depth · subtle borders and highlights · excellent spacing · minimal green · no generic SaaS
card grid · no cheap glassmorphism · no giant marketing hero.

**EvoScan should read as more visually analytical than Train.**

## A10. Dashboard hierarchy (phone)

```
EVOSCAN · Body composition
Latest scan · 22 Sep

WEIGHT       82.4 kg   context: EvoScan / post-workout
BODY FAT     23.1 %    ↓ 0.8 pp vs previous scan
MUSCLE MASS  36.9 kg   ↑ 0.3 kg
FAT MASS     19.0 kg   ↓ 1.1 kg

[ BODY COMPOSITION VISUAL ]
[ TREND ]
WHAT CHANGED
SCAN HISTORY
[ + NEW SCAN ]
```

**Never imply the EvoScan weight is the canonical morning weight.** Label the context.

## A11. Composition visualisation

Better than generic metric cards, driven by actually supported data: a composition bar, a
layered breakdown, a clean lean-vs-fat representation, or another compact high-quality visual.
Avoid decorative donuts unless they genuinely aid understanding. **Never infer a metric the
scan does not provide.**

## A12. Trending

EvoScan has its **own scan-to-scan series** — scan weight, body fat %, muscle mass, fat mass.
This is **not** the Morning body-weight trend; keep the two concepts distinct and clearly
labelled. Per-metric separate scales (§S), never one multi-scale chart.

## A13. What changed

Compare latest against the immediately previous EvoScan:

```
SINCE 12 SEP
Weight       82.4 → 81.8 kg   −0.6 kg
Body fat     23.1 → 22.5 %    −0.6 percentage points
Muscle mass  36.9 → 37.1 kg   +0.2 kg
Fat mass     19.0 → 18.4 kg   −0.6 kg
```

Correct units and **percentage-point semantics** (pp, not %). **Do not turn tiny fluctuations
into dramatic coaching statements** (D9, and the fitness-ux copy rules).

## A14. History and detail

History rows carry a compact snapshot — date, weight, body fat %, muscle mass — plus a
meaningful delta against the prior scan where appropriate. Tap opens scan detail.

Detail may include the original report · all extracted metrics · OCR/corrected state · notes ·
comparison to previous · measurement context · provenance. Keep the default clean; use
progressive disclosure for depth.

## A15. Processing experience

Real stages, not a dead spinner: `Preparing scan` → `Reading report` → `Finding metrics` →
`Checking values`. **No fake percentages.** The UI stays responsive throughout.

## A16. Manual entry is not a failure state

It is part of a robust OCR workflow. If a field cannot be identified, allow clean manual
entry. **Never force the user to restart the scan unnecessarily.**

## A17. Mobile

Primary device is iPhone. Optimise **390 · 393 · 402 · 430**; also verify **375 · 320**.
Attend specifically to: scan-image zoom · editing numeric values · keyboard opening · save CTA
visibility · safe-area bottom inset · chart labels · history rows · touch targets · long
values · landscape only if the app already supports it.

**Do not design around a desktop screenshot.**

## A18. Acceptance — both must be true

**A.** OCR is materially safer and more reliable.
**B.** EvoScan stands beside the new Train experience as a flagship NXTFRM feature.

Neither may be sacrificed for the other.
