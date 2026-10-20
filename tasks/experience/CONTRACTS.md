# NXTFRM — shared analytical contracts (frozen 2026-10-20)

These contracts bind every surface that shows a weight quantity, a date, a rate, a range or a workout state: Progress ›
Weight (plate, inspector, Layers, Expand, Compare, Journey, Evidence, Analysis rows), Today, the Why sheet, the story,
the share card, the goal moment, History and the dock. **Labels, date anchors, smoothing descriptions, rate ranges and
projections on screen must match this file.** If a contract changes later (for example when a Stage 7 proposal is
approved), the engine, the UI copy, the tests and this file change together in one commit with a decision row.

Decision rows: D104–D108 (stage 2, `DECISIONS-PROPOSED.md`), D109–D117 (Weight Instrument), D120–D127 (Today).
Pending calculation proposals: `ANALYTICS-STUDY.md` (nothing in it is applied).

## 1. Quantity identities and precision (D107)

| Name on screen | What it is | Source | Where |
|---|---|---|---|
| **Latest morning · <date>** | the recorded morning reading, as entered | newest canonical morning row (`weights()`) | chart header readout, Today Weight cell, History |
| **Smoothed trend** | the EWMA series (§2) | `trend()` last ready value | chart header readout and legend, Today sparkline label, share-card line, History weigh-in day |
| **Estimated level · as of <date>** | the 21-day least-squares level at the model origin (D97); a fitted estimate, never a measurement | `nowLevel()` / `levelSeries()` | Cut journey, share card, story, goal moment only — never in the Weight plate |
| fallback | with fewer than ten mornings in the window the level *is* the smoothed trend: "Estimated level is your smoothed trend for now"; with no trend at all it is labelled **Latest morning** | | |

These three are never forced to agree. Precision: kilograms **1 dp** in headlines, readouts and chips; rates **2 dp
kg/wk**; deltas **1 dp kg**; the chart tooltip may keep 2 dp (labelled "Smoothed"); calculations keep full precision.
Every negative uses U+2212; `signedFixed()` rounds before it signs so "−0.0" never prints. "Start weight" (the saved
`settings.startWeight`) and "First reading" (the first plotted morning) are never shown under one name.

## 2. Smoothing (as implemented; description text must say this)

`ewmaTrend()`: alpha = 1 − 2^(−1/7) **per reading** (a half-life of seven *readings*: seven days only under daily
logging), restart after a gap of more than three days, trend-ready after three readings since the restart. The
"How these numbers are made" row and the coach's weigh-in note describe exactly that: *a weighted average that leans
most on your last week or so of mornings; after a break of more than three days it restarts and needs three mornings
before it shows again.* It must not be called a seven-day half-life.

Pending proposal (ANALYTICS-STUDY §1, needs owner approval — a calculation change): elapsed-time EWMA, no restart,
"rebuilding" label while the 7-day coverage is under three, forecast span guard. If adopted, the description above,
`forecastWords().restart`, the coach copy and the pinned tests (weight-contract 9 and 12, forecast-time gap case)
change in the same commit.

## 3. Forecast time contract (D104)

`NXT.forecastView(rows, calculationDate)` is the **only** place weeks become dates. `forecastGoal()` is unchanged.

| Field | Meaning |
|---|---|
| `lastObservationDate` | newest morning reading |
| `modelOriginDate` | last trend-ready morning: x = 0 of the 21-day fit; **every arrival is counted from here** |
| `calculationDate` | the day the screen is drawn (`state.date`) |
| `originLevel`, `slopeKgWk` | the fit's level at the origin and its slope |
| `weeks / lowWeeks / highWeeks` | from the origin (engine values); `arrivalDate / arrivalLow / arrivalHigh` = origin + weeks × 7 |
| `weeksRemaining` | from the calculation date; never 0 while the date is ahead |
| `freshness` | days since the origin: **fresh** ≤ 3 · **aging** 4–14 · **stale** 15–21 · **expired** > 21 or the earliest arrival has come |
| `modelConfidence` | the engine's spanRatio word, unchanged; freshness and confidence are separate dimensions |
| `showArrival` | false without a confirmed goal, or when not current |

Rendering: **fresh** — the anchored date; **aging** — the same date with "as of <origin>" and "From X kg on <origin>";
**stale / expired** — "Paused · Last morning weigh-in <date>, N days ago. Weigh in to refresh it." and **no future
date anywhere** (no cone, no pill, no milestone, no story date, no what-if). No surface prints an arrival on or before
the calculation date. With no confirmed goal, no surface prints a goal ETA. The next-kilogram estimate is anchored at
the origin and dropped once its day has passed or while paused. Durations ("about N weeks away") count from today and
name the origin when aging. "Cut is progressing" (Why fold) requires a fresh or aging forecast **and** the rate
`review()` reads (D108). Elapsed copy (down in N weeks, share-card range, story) ends where the level is measured once
the forecast is not fresh.

**Projection range** (the name for the arrival window): today `arrivalLow`–`arrivalHigh`, the engine's ±1 σ window in
whole weeks; shown as "Likely between <low> and <high>" style copy, **never with a percentage**, and labelled "an
estimate, not a promise". The dashed cone (D19/I11) is drawn from the origin to that window and is hidden while paused.

Pending proposal (ANALYTICS-STUDY §3): the range carried from the 4-week rate band with a slowdown allowance and
dated / open (stall or far) / thin states. If adopted, `showArrival` is gated on *dated*, expiry keys off `rangeLow`,
the cone and every surface switch to the range fields, and the forecast-time tests are adapted with their intent kept.

## 4. Rate contract

**4-week rate** = the least-squares slope of the morning readings in the 28 days ending today (`detectPlateau` /
`plateauWindow`: at least 10 readings spanning at least 14 days). It is named "4-week rate" only when the readings
reach across the window (span ≥ 25 days), otherwise "N-day rate" (`rateSpan()`). Its window is view-date anchored,
while the forecast is origin anchored; when they disagree, D108's agreement rules apply and the "Rate across your cut"
series ends at `forecastView().asOfDate` once the forecast is not fresh.

**Rate range** = the slope ± 2 standard errors (ordinary least squares, independent residuals). Copy: *"Likely between
A and B kg/wk over the last four weeks."* and *"The 4-week rate is likely within ±X kg a week."* — **no frequency is
printed** ("known to within" is retired; "95%" and "9 in 10" never appear). The status rule (losing / flat /
gaining / undetermined) compares the range with ±0.15 kg/wk and is unchanged.

**Rate precision** (was "Confidence") = the half-width bucket: high < 0.075, medium < 0.15, else low. The Why fold's
`diagnose().confidence` is a different quantity and is labelled "Confidence in this read"; the two never share a word.

Pending proposal (ANALYTICS-STUDY §2): an AR(1)-aware standard error. Same names and copy; wider ranges under
persistent noise and more "undetermined" statuses; tests and the code comment change together.

## 5. Day-to-day spread

The chart band = smoothed trend ± 1 residual standard deviation over the last 14 days (at least 7 readings). It is the
observed scatter of readings around the trend, **not** an interval for the level or the rate (it covers the true level
rarely during a cut because the trend lags). It is an opt-in layer named "Day-to-day spread" with its own legend entry
whenever drawn; it must never be called a confidence band.

## 6. Day state contract (D105)

`NXP.dayState(date)` is the only classifier a screen reads. Words, each with a shape: **Planned** · **Today** (lit) ·
**In progress** (arc of planned sets; today, working sets logged, no Finish record) · **Planned sets complete** (check
ring: logged ≥ planned, not finished) · **Workout finished** (filled check: the explicit Finish record) · **Partly
logged** (half-disc: a past lifting day short of plan) · **Done** (walk or floorball day with its own record) ·
**Add-on logged** (plus: a lift on a walk or rest day only) · **Plan not done** (dot: lifting day with other activity
only) · **Moved** · **Excused** · **Not logged**. Warm-ups never count. Counting a lifting day is not finishing a
workout. Read by the Today rail and focus card, Train's idle card, the live dock (shown only while *In progress*), the
History day card and calendar, the day summary and the week sheet. Coach thresholds, `liftsDone`, streaks, progression
rules and the Finish record's shape are unchanged; the rail header presents "N of M planned lifts · +K add-ons".

## 7. Switched-off features (D106, extends D55)

A feature behind an off `FEATURES` flag keeps its records, backups, sync and maths, but nothing visible is drawn from
them: no verdict, no summary, no count. Settings and Progress › Body count scans through the scan screens' own list.

## 8. Date bases, in one place

| Quantity | Window ends at |
|---|---|
| 4-week rate, plateau ladder, 7/14/21-day trend stats, week-on-week change, "Rate across your cut" (while fresh) | the calculation date (today) |
| Forecast, Projection range, next-kilogram estimate, Estimated level, what-if pace, "Rate across your cut" end marker once not fresh | the model origin (last trend-ready morning) |
| Latest morning | the newest reading |

Any new surface must say which base it uses in its own caption ("22 Sept–19 Oct", "to 20 Oct", "as of 18 Oct").
