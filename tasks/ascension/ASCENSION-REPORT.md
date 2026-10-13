# NXTFRM ASCENSION — Trial build report

## 1. Trial build

| | |
|---|---|
| Preview URL | https://deploy-preview-34--thecutdanyal.netlify.app (draft PR dxnyal03/nxtfrm#34, unmerged) |
| Branch | `ascension` (from `origin/main` `029eb51`, release 161) |
| Commit | `754a567` on `ascension` (report follow-up commit on top) |
| Environment | Netlify deploy preview of the `ascension` PR (site `thecutdanyal`); runs on seed data with cloud login, save and load disabled (D23) |
| Production | untouched: `main` and `thecutdanyal.netlify.app` are unchanged; the PR stays open and unmerged |
| `RELEASE` / `CACHE_NAME` | still 161 — the owner bumps per production deploy (AGENTS.md); `sw.js` lists `coach.js` and no longer lists the wearable modules |

## 2. Product transformation

Release 161 already had the Strata look. This release changes what the app *does*: it coordinates its coaches instead of running them in isolation, it understands a week that did not go to plan, it reviews the week that just ended, it shows a lift's history in one chart, it no longer loses a customised split, it launches like a native app, and it starts faster on less code. Every screen still reads as the same product; nothing was restyled for its own sake.

## 3. New features

| Feature | Purpose | Where | How it works | Tests |
|---|---|---|---|---|
| **Coach stack on Today** | one place for what the coach noticed, ranked and deduplicated | Today, between the training tile and the Decision card | `NXT.coach.insights()`: schedule, strength, cardio, weight and data evaluators → coordinator (staleness, conflict demotion, one per domain, dismissal memory) → ≤3 tiles with evidence chips, a four-part Why and an action | `wearables.coach.test.js` 48; Playwright 58 flow checks × 4 widths |
| **Catch-up** | a missed lifting session can move to today with every consequence shown first | Today coach tile, Train idle on a non-lifting day | `NXT.coach.catchUp()` → confirmation sheet listing consequences → `applyCatchUp` writes through the existing `setDayType` path and records the missed day as Moved | same suite; flow checks (confirm → overrides written → persists across reload) |
| **Excused days** | sick, travel, rest or other, so a planned day is not "missed" and adherence is honest | day sheet, History day card, coach action | `NXT.coach.excuse/unexcuse` → `cutSupport.dayNotes[date]`; `liftsPlanned` excludes excused and moved days | same suite; flow checks |
| **Calendar day context** | planned, not-logged, excused and moved days with words | History calendar and day card; Today week rail | `NXT.coach.dayStatuses()` per month; letters for planned sessions, hollow ring Not logged, slash Excused, arrow Moved; legend words | flow checks; `verify-152` 33/33 |
| **Week in review** | a factual review of the last completed Mon–Sun week | Today tile (until *Got it*) and a sheet | `NXT.coach.weekReview()`: lifting days done of planned, sets and tonnage vs the week before, D20 outcomes, cardio vs target, morning average vs the week before, excused/moved days, next week | same suite (totals equal `activityWeeks`) |
| **Train coordination** | Train's coach line no longer contradicts the weight decision | active Train coach line and target rows | `NXT.coach.trainAdvice(ex)` applies the hold rule when the weight decision is cautious; `coachFor`/`aimFor` untouched (D25) | same suite |
| **Exercise history chart** | how a lift's best working set moved across sessions | Exercise Details (from Train and from Progress › Performance rows) | best set per session, reps under dots, Best ringed, gutter axis, Last 12 / All, scrub + keys, e1RM behind an off-by-default toggle (data-only domain when off) | 272 Playwright assertions at 390 and 320 |

## 4. Visual redesign

Not a restyle: the approved Strata/Dusk identity is unchanged. The design-system slice consolidated the five CSS layers: 16 canonical tokens added to Strata and 58 legacy names aliased to them (the 19 cross-file conflicts and the 8 canvas names now resolve to one value); the D44 field recipe (52 px, 14 px radius, 16 px text, violet focus halo) wins inside every sheet and Settings form; the nine legacy `.modal > .sheet` builders (edit set, substitute, add exercise, queue manager, cloud login, restore, …) now render the Strata sheet recipe with sentence-case capsules; the last 57 sky/cyan literals are gone (D54); Today's aurora has an explicit set; the measured small targets (banner buttons, Why, confidence chip, History filters, calendar cells, month arrows) are 44 px; the 11 px text floor holds. 321 proven-dead rules (43 KB) were removed from the older layers under a pixel-diff guard (0 computed-style differences over 43 states). Pinch zoom is re-enabled in the viewport meta now that every field is ≥16 px.

## 5. Screen-by-screen

- **Today**: coach stack and week review added; the week rail reads coach statuses (Excused, Moved) and the header counts only plannable lifts; the recap that duplicated the review is gone; the render no longer writes to storage.
- **Train**: catch-up row on non-lifting days; coach line and target rows coordinated with the weight decision; hold prefill matches the hold headline; the doubled hold-to-repeat on steppers is fixed; a rest timer left running after removing the last add-on is stopped.
- **Progress › Performance**: rows open Exercise Details for that lift and gym; Exercise Details gains the history chart.
- **History**: planned, not-logged, excused and moved marks with a legend; day card shows status and reason with Excuse / Remove excuse; the calendar container uses a correct ARIA role; keyboard navigation kept.
- **Settings**: Data & sync copy made true; Goals advice copy no longer mentions check-ins; legacy sheets on the Strata recipe.
- **Launch**: see §9.

## 6. Cards and components

Coaching tiles, the review tile and the catch-up/excuse sheets reuse the lit-glass tile, glass chip, D56 capsule tiers and D44 fields. Legacy sheets were brought onto the same recipe. Legacy tokens now resolve to Strata values, so components built in different eras read the same.

## 7. Charts and analytics

- **Exercise history** (new): per-session best working set for the same exercise at the same gym (`sessionRows` + `bestSet`), warm-ups excluded; e1RM is the engine's Epley estimate behind a toggle, dashed and labelled "estimate"; data-only Y domain when off (D2), D51 headroom; accessible title and hidden summary; reduced-motion path.
- **Calendar**: planned/missed/excused/moved from `dayStatuses`.
- **Week review figures**: `activityWeeks()` totals, D20 outcomes, the Week-by-week morning-average rule.
- Weight chart, Training ledger, Performance sparks, Body map: unchanged (copy fixes only: "Dashed steps…", "Choose Cut…").

## 8. Coaching Intelligence — before and after

**Original architecture.** Five independent surfaces: the Today decision (`review()`, which uses only `diagnose().headline` and discards its evidence), the Train coach (`coachFor()`/`aimFor()`), the Progress diagnosis card, Performance status words, and the finish summary. No shared context, no memory of dismissed advice, no notion of a missed, excused or moved session, no weekly review beyond the decision card, and Train could say "Add 2.5 kg" while Today said "Losing quickly".

**Weaknesses found** (engine inventory): render-time storage writes; `cfg().suggestions` written and never read; check-in and waist data still read by `review()`/`diagnose()` although switched off; two shorter-workout definitions; two rep caps on the same e1RM data; stale copy.

**What changed.** `coach.js` (`NXT.coach`) adds a validated shared context (plan, week, lifts with aims and hold reasons, weight trend/review/confidence, cardio, cut, freshness, features), day contexts, the insight evaluators and the coordinator, catch-up, the week review and `trainAdvice`. Existing calculations are called, not edited. Everything is deterministic; same inputs give deep-equal output (tested). Reads never persist (tested: 0 storage writes).

**Coordinator rules.** Staleness (>14 days dropped); conflict (a cautious weight decision demotes "move up" to a hold); catch-up outranks "week behind"; dismissal by id + evidence fingerprint (returns only on new evidence); one per domain; rank by severity then schedule > strength > cardio > weight > data; top 3.

**Explanations.** Each insight carries evidence rows and `why.noticed / evidence / matters / canDo`, in that order, as plain sentences; observation, interpretation and optional action are kept apart; no causation claims.

**Personalisation and feedback.** Dismissals are stored (`cutSupport.coach.dismissed`), pruned after 60 days; the week review remembers it was seen; excused and moved days are stored and respected by every evaluator; the user can override every proposal (nothing is written without confirmation).

**Representative examples (from the engine report, real fixtures):**

| Scenario | Before | After |
|---|---|---|
| 10 weeks at plan; Wed Full B not logged; today Thu (walk) | "Cutting steadily, strength holding" | `schedule.catchup` [act] "Full Body B missed yesterday" → Move to today, with five consequences listed |
| Incline DB Press 30 × 13 on 8–12; loss −1.26 kg/wk | Today "Losing quickly" / Train "Add 2.5 kg" (contradiction) | `weight.review` [watch] + `strength.hold` [info] "Hold Incline Dumbbell Press for now"; Train reads "Hold 30 kg — weight decision reads Losing quickly" |
| Lat Pulldown 50 × 10 three Wednesdays running | stall only visible inside Train | `strength.stall` [watch] on Today |
| Last morning weigh-in 3 days ago | decision card still reads last week | `data.morning` [act] "Weigh in today to keep the trend continuous" (the EWMA restarts after a 3-day gap) |
| Sat: 20 of 90 cardio min | nothing | `cardio.week` [act] "70 min left · 2 days · about 35 min a day"; on Sunday the same reads [info] "out of reach" |
| New user, no rows | "Building your baseline" | nothing (no invented advice) |

**Tests.** 48 scenario tests: empty, sparse, 10-week fixtures, missed/excused/moved days, dismissal and reappearance, conflicting signals, cardio reachable/unreachable, review totals vs the ledger, determinism, no-persist reads, boundary thresholds (3/7/14 days), a day with logged sets cannot be excused, stale proposals refused.

**Outstanding limitations.** No plan history (streaks judge past weeks by today's plan, and say so); recovery check-ins and wearables are off by owner decision, so the recovery coach is the strength coach's return-after-break rule plus the weight decision's recovery verdicts; `review()` still discards `diagnose()` evidence on the decision card itself (Progress shows it); Today's repaint costs about +18 ms at 445 logs.

## 9. Launch experience

One launch colour everywhere (`#07060B`: html style, `color-scheme`, `theme-color`, manifest, overlay). The overlay is the first painted frame, stays opaque until the hold (1.55 s from the first visible frame) is met **and** the app has rendered, then one reveal (mark out 140 ms, backdrop 360 ms, shell settles 6 px over 420 ms, transform-only, no layout shift). The dimmed veil over the dashboard is gone. Fallback 2.2 s, tap to skip, visibility/pagehide safety, reduced motion (OS and in-app) shows a still frame. 83 harness checks pass (10 failed on the old implementation). The launch no longer has to hide a mid-parse re-render: the wearable module that repainted Home after opening IndexedDB is no longer loaded.

## 10. Reliability fixes

**Training split reversion — root causes (all reproduced against shipped code):** (1) a fresh, wiped or reset device holds the factory A/B/C split (from `install()`'s V99 step) and the cloud merge was local-wins at the top level, so Login + Load replaced the account's split and wrote it back; the boot auto-load repeated this on every launch; (2) routines merged "this device wins" per key; (3) today's queue was seeded from the factory list before the load and never re-seeded; (4) dated overrides were dropped wholesale; (5) no edit timestamps, so the last device to load won; (6) saves could fire before the account was read, which could also wipe workouts; (7) on a full phone `persist()` threw inside `install()` and stopped `cut-support.js` before the Safe Sync merge was installed, leaving the old replace-semantics path live; plus the "Saved online" toast claimed a cloud save before it happened.

**Fix.** Edit stamps taken in `commit()` (`settings.planUpdatedAt`, `cutSupport.overrideMeta[date]`, `cutSupport.templateMeta[gym__type]`); the merge keeps the newer stamp; unstamped factory values yield to the account (goal range + confirmation and start weight + cut start resolved as units); two customised unstamped copies keep this device's; saves read the account first; today's untouched queue is re-seeded; waist rows union by id; add-ons reach the cloud, backups, restore and reset; the session picker refuses a day with logged sets; install is fail-safe; honest toast. No new storage key, no record shape changed. 25 tests (20 fail on shipped code).

**Other fixes.** Doubled stepper hold-to-repeat; undefined `apx96StopRest`; render-time storage writes; raw error text injected by `window.onerror`; duplicate GoTrue client; History grid ARIA role; stale copy.

## 11. Testing

**Deployed preview verified** (Chrome via Playwright against the Netlify URL): the branded splash is the first painted surface (opaque, before any app content, 765 ms after navigation commit on a real network), the splash exits, Home renders on seed data with cloud disabled (D23), every tab is visible, the weight chart draws, the exercise history chart opens from a Performance row, the coach computes insights and renders the catch-up tile and the Train catch-up row, the service worker installs with the release cache, an offline reload renders Home from the cache, and there are no page or console errors (10/10 checks, plus the first run's service-worker, offline and console checks). Browser verification scripts on the final tree: launch 83/83, exercise chart 272/272, legacy sheets 0 failures, coaching UI 58/58 and 22/22 action mappings, `verify-train-browser` 6/6.


Deterministic: 21 suites, 592 tests, 0 failures (`for f in wearables*.test.js; do node "$f"; done`). Browser (Chrome via Playwright): screenshot sweeps at 320/375/390/430/768/1280 on every tab with zero page errors and zero horizontal overflow; computational QA sweep (targets, text floor, contrast, inputs, reduced-motion animations); flow checks for coaching, charts, launch, legacy sheets, persistence; `verify-train-browser` 6/6, `verify-152` 33/33. **Not tested:** a real iPhone / installed PWA, Safari/WebKit, Supabase against a real account (the vm harness drives the shipped cloud functions with a fake one-row client), two real devices.

## 12. Before-and-after screenshots

Baseline: `~/Library/Caches/DanDev/nxtfrm/ascension/shots/base/` and `base-flows/`. After: `shots/final/` (six widths, zero errors, zero overflow), `shots/preview/` (the deployed preview), plus `shots/coach/`, `shots/charts/`, `shots/launch/`, `shots/ds-sheets/`.

## 13. Future opportunities (deferred, not done)

- Done in this release: `supabase-js` loads without blocking the parser (Home visible at ~320 ms with the CDN stalled, versus 10 s before). Still open: an offline boot with an expired access token signs the user out (pre-existing).
- Plan history, so streaks and the review judge past weeks by the plan of that week.
- Memoise `dateMs` and the coach context per render; skip `maybeSnapshotTDEE` while adherence is never logged.
- Move the splash script into `<head>` (blocked by a permission check this session; the head veil covers the gap).
- Swipe-to-close and a close button on the legacy sheets; the 21 dead rules in `cut-support.css`; the 13 deliberately unaliased tokens.
- Retire the 109-era verify scripts; IndexedDB durability; `apple-touch-startup-image` assets for iOS.
