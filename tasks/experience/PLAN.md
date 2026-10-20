# NXTFRM — Complete Experience Upgrade · plan

Owner brief: "NXTFRM — Complete Experience Upgrade" (2026-10-19). Worktree `~/Developer/Worktrees/nxtfrm/experience-upgrade`,
branch `experience-upgrade`, based on `b7d8d71` (PR #39 head = release 163 + D101–D103, unmerged). Canonical checkout
`~/Developer/Projects/nxtfrm` (release 144, dirty) is untouched apart from `git fetch` and the worktree registration.
No push, merge or deploy. `RELEASE` stays 163.

Baseline evidence: `~/Library/Caches/DanDev/nxtfrm/experience/baseline/` (307 screenshots at 7 viewports, fixed clock
2026-10-19 10:00 SGT, seed data; probe scripts; `stage1.json`).

## Baseline findings (reproduced)
| # | Finding | Evidence |
|---|---|---|
| F1 | Arrival dates drift with the view date: same forecast (8 wk from 18 Oct) shows 13 Dec / 20 Dec / 10 Jan / 7 Feb when viewed 18 Oct / 25 Oct / 15 Nov / 13 Dec. Engine anchors at the last trend-ready reading; five consumers add weeks to `state.date`. Next-kg milestone always lands tomorrow. | cut-support.js:1232,1259,1343; strata.js:132,2155; premium-ui.js:2095 |
| F2 | EWMA alpha is per reading (7-reading half-life), reset after >3-day gaps; lag 9.6 d daily → 18.6 d alternate-day → 21.3 d Mon/Wed/Fri; after a gap the first two readings have no trend and every "now" falls back to pre-gap values. | cut-support.js:125-141 |
| F3 | "Known to within ±X" = ±2 OLS SE (independent-noise assumption); coverage 94% iid, 72–85% with AR(1) noise. Arrival range is ±1σ (~68%), 39–48% on curving cuts. Chart band (EWMA ± 1 residual SD) unlabelled. | cut-support.js:160-226,1354,1362,142-158 |
| F4 | Today rail says "done" at 6 of 15 sets; coach/History say "Partly logged"; Finish is the only explicit finished record and is read only for today. | premium-ui.js:121; coach.js:432; cut-support.js:661,1823 |
| F5 | Settings › Body & scans "None yet" with 5 scans: it counts waist rows (feature off). Waist also leaks into Progress › Body and a Today decision while switched off. | premium-ui.js:2811,2825 |
| F6 | Weight chart top at 649 px (390×844); bottom never in the first viewport; 320×568 entirely below the fold; live dock hides 140 px. | screens probe R3–R6 |
| F7 | Four "where am I" figures with mixed labels/precision: Latest morning 81.7, Trend 82.56 / 82.6, Journey Now 81.8, share card "Trend now" = level. Mislabels: "Trend · 28 days" over a week-on-week change; "7-day trend" over one reading; "4-week rate" over 14 days; two different "Confidence" words. | uncertainty probe |
| F8 | Defects: selectPoint wrapper drops opts (selection never clears); Journey Share no-op (`window.NXP`); "Back to latest" wired but never rendered; weekly steps stop after 20 weeks; two Start figures (86.7 vs 87.1); signed zero "−0.0"; Why fold asks for 7 more days after 30/30; no-goal Today still gives a goal ETA; live pill over Progress tabs at 1280; Larger text ignored on Today/Weight. | inventory + critic probes |

## Stages and acceptance criteria
Each stage is its own commit(s); calculation changes are separate commits.

**2 · Time semantics and visible consistency**
- `NXT.forecastView()` adapter: lastObservationDate, modelOriginDate, calculationDate, arrival{Date,Low,High} anchored to
  the model origin, freshness fresh ≤3 d / aging 4–14 d / stale 15–21 d / expired (>21 d or arrival passed), reusing
  EWMA gap 3, coach STALE_DAYS 14 and the 21-day forecast window. forecastGoal maths unchanged.
- Every consumer (Evidence, Journey label + SR text + next-kg milestone, chart pill, story, what-if, review()/diagnose
  durations, Why fold) uses it; stale/expired never prints a future date; aging says "as of <date>".
- Acceptance: the fixture viewed 18 Oct / 25 Oct / 15 Nov shows arrival 13 Dec, 13 Dec (as of 18 Oct), paused.
- Shared day-state contract (activity recorded / in progress / planned sets complete / finished / moved / excused /
  not logged) used by the Today rail, Today tile, History card and calendar; coach thresholds, liftsDone, streaks and
  progression unchanged. Acceptance: 6/15 today reads "In progress" on every surface.
- Settings scan summary counts scans; waist stays hidden while the feature is off.
- Quantity identities: "Latest morning · date", "Smoothed trend", "Estimated level · as of date" (+ fallback note);
  kg headlines 1 dp, rates 2 dp kg/wk, full precision kept in calculations. Mislabels in F7 fixed.
- F8 defects fixed except the chart/visual ones (stage 3/6).

**3 · Weight layout and chart hierarchy**
- Order: masthead → segmented nav → one interpretation with its window → compact labelled readouts → range/Layers/
  Expand row → chart → range summary + achievement chips → compact Journey → weekly, rate, model notes, readings.
- Acceptance: chart plot ≥ 280 px visible and unobscured in the first viewport at 390×844 and 393×852 with no banner
  and the live dock; chart top in the first viewport at 375×667; no plot shrink at 390.
- ≥ 1100 px: two columns (chart + inspector | interpretation, Journey, evidence); breakpoint by measured fit.
- Plot: trend clearest stroke, readings distinct, sparse subordinate grid, readable axes/units, labels never collide,
  stable plot background, no overshooting smoothing, D2 data-only domain, out-of-domain context indicated. Weekly steps
  cover the whole range.

**4 · Inspector, Expand, Layers, Compare periods, Journey**
- Tap/horizontal drag selects; vertical scroll passes through; stable selected header; tooltip clear of finger and
  edges; keyboard intact; visible "Back to latest"; weekly row highlights its interval; notes/activity open History day
  and return keeps range + selection.
- Expand chart dialog preserving range/selection/layers, Esc/close, focus return, reduced motion, no history trap.
- Layers: weekly averages, day-to-day spread, post-workout readings, notes, projection (off by default); deviation
  strip inside Analysis. Distinct names for observed spread, rate uncertainty and forecast uncertainty.
- Compare periods (deterministic engine helper + tests): matched elapsed windows or completed periods, both windows,
  quantity, absolute change, counts/coverage, partial status, no significance claims.
- Journey: compact summary near the chart; recorded milestones vs current estimate vs historical snapshot vs
  simulation; what-if labelled Simulation with assumption and reset; rewound evidence labelled "Current analysis".

**5 · Today briefing**
- Greeting + one context line; adaptive focus card (before / during / after / cardio / rest) from real state; week
  timeline with the stage-2 states (words or shapes); one prioritised interpretation (engine order, concern can lead,
  celebration cannot displace the task) with observation / evidence / action / uncertainty; "More insights · N";
  quick Weight and Cardio actions showing today's logged state; labelled weight sparkline (period + quantity) that
  opens Progress. No new large chart; no muscle map (D73 withdrawn).

**6 · Shared system across the app**
- Material hierarchy (atmosphere → quiet content → lit chrome → few focal elements), fewer equal glowing edges, one
  type/numeral/radius/field/button/sheet system, Larger text honoured.
- Train: recommendation vs progression target distinguished. Training: honest current-plan references, partial
  weeks. Performance: search/filter + focused exercise detail, best set vs e1RM named. Body: dated latest scan +
  comparison first. History: optional list view, chart drill-down and return. Settings: correct summaries. Live pill
  placement at desktop widths.

**7 · Evidence-supported analytics (separate commits)**
- Elapsed-time-aware EWMA (no hard reset) if the study holds; tests adapted with intent kept; documented effects.
- Rate interval: honest wording with its level; autocorrelation-aware SE if backtest supports; arrival range labelled
  or propagated consistently; falling-averages streak and "N more days" counters fixed.

**8 · QA** — identical data/viewports before/after (320/375/390/393/430/768/1280 + 1440), data states, larger text,
keyboard, reduced motion (OS + in-app), contrast, targets, overflow, occlusion, screen-reader summaries, interaction
paths; full deterministic gate (`node --test *.test.js` and each suite); report.

## Status · 2026-10-20 11:20 SGT

- Integration branch: `experience-upgrade` (this worktree). Inherited from PR #39 (`b7d8d71` and earlier): D101
  week by week, D102 whole-app pass, D103 Today distilled. Everything from `e48faab` on is this upgrade.
- Stage 2 committed: `e48faab` D104 forecast time, `363ee05` D105 day state, `5e7a63d` D106–D107 names/sources,
  `8ae6eee` D108 verification fixes. 27 suites / 703 tests green with the Weight w2 edits in the tree.
- Weight stream: w1 `85cf367` committed; w2 (plate + plot) resuming from an interrupted diff; w3–w5 queued.
- Today stream (worktree `experience-today`, branch `experience-today`): t1 `fa4aa01` committed; t2 resuming;
  t3 queued; then merged into `experience-upgrade`.
- Contracts frozen: `CONTRACTS.md`. Specs: `SPEC-weight.md`, `SPEC-today.md`. Study: `ANALYTICS-STUDY.md`
  (nothing applied). Disposable probe output stays in `~/Library/Caches/DanDev/nxtfrm/experience/`.
- Next deliverable: a runnable visual checkpoint of Today and Weight (`?scenario=` fixtures, local preview on
  port 8766 via `.claude/launch.json` → `nxtfrm-experience`), one cross-review, owner fixes, then Stage 6.

## Owner ruling · 2026-10-20 14:45 SGT — phone first

"Remove the desktop, I'm using this mainly on phone." Withdrawn: the Weight two-column layout (W4 / D114), the desktop
inspector strip, the desktop live-pill item, and every 768 / 1280 / 1440 acceptance criterion in stages 3–8. The
checkpoint and QA viewports are 320×568, 375×667, 390×844, 393×852 and 430×932; wider viewports keep the existing
single column and only need to not break. Stage 6 keeps the same rule for the remaining pages.
