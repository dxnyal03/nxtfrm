# NXTFRM — analytics study (Stage 7 research, 2026-10-19/20)

Three deterministic backtest studies on the weight engine, each challenged by an independent reviewer. **Nothing here
is applied.** Each proposal changes a calculation or what a number means, so it needs the owner's approval
(AGENTS.md §5) and a decision row before it ships. Patches, scripts, fixtures and result tables live in the cache:
`~/Library/Caches/DanDev/nxtfrm/experience/analytics/` (disposable; regenerate from the scripts). No real owner data
was available: every coverage figure rests on simulated noise models (iid, AR(1) φ 0.3–0.9, day-of-week, water
spikes, regime shifts), so real-world calibration is unknown.

## 1. Smoothing — the EWMA half-life is seven readings, not seven days

**Current (`ewmaTrend`):** alpha 1 − 2^(−1/7) applied once per reading; hard restart after a gap > 3 days; ready
after 3 readings. Lag behind a steady 0.5 kg/wk loss: 9.6 days (daily logging), 13.4 (5 of 7), 18.8 (alternate days),
21.7 (Mon/Wed/Fri). After any break over three days the first two readings show no trend and Today's tile, the
Estimated level and the forecast fall back to the pre-break value (up to 2.7 kg off after 28 days).

**Proposal (study + review agree):** elapsed-time EWMA, alpha_i = 1 − 2^(−dt_i / 7), no hard restart, ready after
three readings; a forecast span guard (the 21-day window must span ≥ 7 days) with its own reason string; a
"rebuilding" label on the trend tile and the Estimated level while the 7-day coverage is under three readings (a
presentation change that ships with it); the same change in `classic/cut-support.js`; coach copy updated ("the
readings must span at least a week").

| | current | proposal |
|---|---|---|
| lag, steady loss, all cadences | 9.6–21.7 d | 8.9–9.6 d |
| MAE, alternate-day / MWF loss | 1.35 / 1.55 kg | 0.65 / 0.64 kg |
| flat weight, sparse logging (SD of shown trend) | 0.10 kg | 0.14–0.15 kg (noisier — the honest cost) |
| daily logging | identical values | identical values |
| seed data (19 Oct) | trend 82.556 | 82.484 (mean shift 0.043, max 0.142; forecast, level, rate unchanged) |
| first forecast for a new daily user | day ≈ 5 | day ≈ 9.5 (span guard) |

Reviewer's required changes before approval: the span-guard reason string; disclose the later first forecast; add the
"rebuilding" label (so insufficient-data states are kept); disclose that after a break a water spike reaches the tile
(flat weight + 1.2 kg for two days: the new trend reads ≈ +1 kg high where the old stale value read 0); patch
`classic/`. Tests: weight-contract 9 (86.3557 → 86.3143) and 12 (band σ 0.2166 → 0.219) adapted with intent kept,
plus new pins (daily identity, 2-day step, 10-day gap, onboarding, span reason, rebuilding label).

## 2. Rate range — ±2 standard errors assumes independent noise

**Current:** `plateauWindow` prints the OLS slope ± 2·SE; copy "known to within ±X". Coverage of the true four-week
rate: 94–95% with independent noise, 72–85% with AR(1) φ 0.5, 59% at worst.

**Proposal ("B4z"):** estimate the residuals' lag-1 persistence φ by maximum likelihood on the days actually logged
(works for alternate-day and three-a-week logging), pooled over up to three 28-day blocks, bias-corrected, clamped to
[0, 0.8]; exact AR design variance for the slope; the status rule (range vs ±0.15 kg/wk) unchanged. Coverage 90–97%
in-family; 76–88% under noise outside the model (φ ≥ 0.85, AR plus scale noise, regime shifts, random walk) — still
never below plain OLS. Seed data: no status changes; "high" precision on 2 instead of 12 of 63 cutoffs.

**Cost the owner must accept:** with persistent noise a real steady loss is confirmed "losing" far less often (89 →
57% of cutoffs at φ 0.7 daily; 80 → 54% alternate-day) and shows "undetermined" instead; false "losing" on a true
plateau falls 2.7 → 0.3%. Both reviewers: adopt the engine change, **print no frequency** ("about 9 in 10" and "95%"
rejected as unsupportable out of family); copy "Likely between A and B kg/wk over the last four weeks." and "likely
within ±X kg a week" (the copy part is presentation-only and is already in CONTRACTS §4). `rateSeries` cost ×5 unless
φ is memoised or passed as 0 (its ranges are not drawn). Tests: six new weight-contract cases (two are API guards);
test 5's seed was found by search.

## 3. Arrival range — the ±1 σ window covers the true arrival about half the time

**Current:** `forecastGoal` dates the goal from the 21-day fit with ±1 σ in whole weeks and a spanRatio "confidence"
word. Coverage of the realised arrival: 82% steady daily iid, 57% with realistic noise, 31–48% on decelerating cuts,
35–45% on the seed; a truly flat weight still gets a date at 13–27% of cutoffs; the "high" word covered 40%.

**Proposal:** carry the 4-week rate band to the goal together with ±2 SE of the 21-day level (Fieller inversion), add
a fixed slowdown allowance on the far end (pace decays with a 180-day half-life — an in-sample assumption that also
caps constant-pace far ends near 37 weeks; sensitivity 120 / 180 / 365 reported), round weeks outward, three states:
**dated** ("Likely between 29 Nov and 3 Jan"), **open** with a reason — *stall* ("four weeks of readings can't yet
separate a slow loss from a stall") or *far* ("at the last four weeks' pace the goal is too far off to date
honestly") — and **thin** ("a goal date needs 10 weigh-ins across two of the last four weeks"). Never print a
percentage; retire the confidence word for arrivals. Dated ranges cover 85–96% on steady loss, 46–66% when loss slows
(no straight-line method fixes that); false dates on a flat weight fall from 22–27% to 1–2%. Median shown range
widens 4 → 9 weeks; fewer cutoffs get a date (steady daily 96 → 90%; slow sparse loggers 53 → 24%; 25 kg cuts ≈ 35%
dated). Reviewer's required changes: gate `showArrival` on *dated* (or stop emitting the open note while a date
shows), key expiry off `rangeLow`, the *far* reason (addendum patch), report coverage as selective, regenerate the
stale width-word evidence, note that the level and rate errors are positively correlated (the stated width is a little
optimistic). `forecastGoal`'s existing outputs stay byte-identical; nothing is stored.

## 4. Status and order of adoption

1. **Copy that needs no approval** (presentation only): the rate-range wording and the "no frequency" rule — in the
   Weight stream now (CONTRACTS §4). The "Day-to-day spread" legend entry (CONTRACTS §5).
2. **Needs the owner's yes, in this order:** smoothing (§1, largest everyday effect, daily loggers unaffected) →
   rate range (§2, honest widening) → arrival range (§3, depends on §2's band if both ship, so the two ranges share one
   level). Each lands as its own commit with engine + copy + tests + CONTRACTS.md + a decision row.
