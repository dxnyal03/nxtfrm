# CLAUDE REVIEW

## Slice

`VNEXT PHASE 2C: PROGRESS / WEIGHT` — final (rounds 1–2)

## Verdict

**APPROVED — ready for the owner's commit decision.**

D2 and D3 are now production behaviour, and I measured the result rather than reading it from the report.

---

## The headline: D2, measured before and after

I captured the truth-function outputs and the chart domain **before** delegating, so this is a real before/after on identical data:

| Goal state | Before | After |
|---|---|---|
| off | 81–85 (4 kg) | 81–85 (4 kg) |
| **confirmed** | **76–86 (10 kg)** | **81–85 (4 kg)** |

**The domain is now identical whether the goal band is toggled on or off** — which is only possible if the goal genuinely no longer touches the scale. The bottom ~40% of dead plot is gone.

Also proven:
- **Post-workout no longer stretches the domain.** I injected post rows at 95–100 kg against an 81–85 morning domain: the domain did not move.
- **…but post is still drawn on the shared `m.y()` scale**, so no second axis was introduced. Both properties hold — they are separate guarantees and both were checked.
- **Forecast does not stretch the domain either**, and when off, `chartModel.forecast` is `null` and `futureDays` is `0` — no future strip is reserved. The `2 5` projection dash appears only when enabled.
- `goalRef` on the recent chart is `null` (D3).

## Truth untouched — proven, not asserted

All eleven TRUTH functions are **textually unmodified**, and every changed line in `cut-support.js` falls in the geometry region (≥ line 703). The one edit outside it (line 40) is additive UI flags (`showPost`, `showForecast`).

Runtime diff against my pre-delegation baseline: `trend` (83 points), `trendConfidence` (77 bands), `trendStats`, `detectPlateau`, `forecastGoal`, `review`, `weights`, `timingRows` — **all byte-identical**. The only apparent difference was `trendStats`, which is the dev seed minting fresh row `id`s per page load; identical once ids are stripped.

## APPROVED — the rest

- **Journey exists as a separate non-time-series treatment** (D3): start 87.1 → now 82.5 → goal band 78–80, reading left-to-right, with total change, remaining distance and elapsed days. It is the only place the distant goal appears.
- **Interpretation readable without interacting**: *"Recent trajectory · Losing 0.44 kg per week · ~4 weeks to goal (range 3–5) · No plateau detected"* is present on load.
- **Scrub**: drag anywhere on the plot selects the nearest observation; the stable header updates **without reflowing** (measured — identical position before and after). Touch tap works. Keyboard works with a sensible `aria-label`.
- **Ranges re-domain honestly**: 2W 81.5–84 · 1M 81–85 · 3M 80–90 · All 80–90.
- **Series distinguishable without colour**: trend line, morning dot, post-workout diamond, dashed projection.
- **Forecast** off by default and labelled *"Model estimate, not a measurement."*
- **Edge states degrade honestly**: empty shows first-weigh-in copy; 2 rows renders without throwing.
- Contrast, targets and overflow: **0 failures** at 390/375/320.
- Reduced motion clean. Strength and Body views still render, not restructured. Today, Train, History, More unchanged, no console errors.
- Suites: release gate **53/0**, weight contract **31/0**.

## Test-file changes — reviewed, not rubber-stamped

Both modified test files were checked assertion by assertion.

`wearables.release-gate.test.js` — the old gate asserted post-workout **must** widen the domain. That assertion encoded the very defect D2 removes, so inverting it is correct, and it **kept** the no-second-axis guarantee plus a new domain-contract check. Net stronger.

`wearables.weight-contract.test.js` — mostly D2/D3-mandated. But round 1 dropped the runtime assertion that post-workout points project through the shared `m.y()`. Domain exclusion and shared scale are **different guarantees**; only the first was still guarded. I required it restored — round 2 did so, with an `m.post.length > 0` check so it cannot silently pass on an empty array, and with the flag restored afterwards. Implementation was untouched in that round; the behaviour had been correct all along.

## POLISH — non-blocking, carried forward

- Alongside 2B's two open items (save toast covering session identity; two stacked disclosures in active workout).
- The selected-point marker sits flush against the right plot edge at the latest reading; a hair of inset would read more deliberately.

## REGRESSION RISKS

Each checked, each clear: truth functions byte-identical · no second Y-axis · `state.bws` and `timeOfDay` semantics untouched · Q1 canonical rule unchanged · Strength/Body not restructured · other four tabs unchanged · both suites green · `RELEASE`/`CACHE_NAME` untouched at 109 per the owner's deployment checkpoint.

## VERIFICATION RUN BY CLAUDE

Own scripts, own Chromium, independent of `verify-2c.mjs`: pre-delegation truth + domain baseline · post-change truth diff across 9 surfaces · domain with goal on/off · post-workout injected at 95–100 kg vs domain · post-on-shared-scale · forecast domain and `futureDays` when off · scrub by mouse drag, by touch, and by keyboard · header reflow measurement · range re-domaining · state matrix at 390/375/320 · empty and sparse data · reduced motion · Strength/Body views · other-tab non-regression · both test suites.

---

## History

| Date | Slice | Verdict | Rounds |
|---|---|---|---|
| 2026-09-22 | 2A Foundation + Today | **APPROVED** | 3 |
| 2026-09-22 | 2B Train active workout | **APPROVED** | 2 |
| 2026-09-22 | 2C Progress / Weight | **APPROVED** | 2 |
