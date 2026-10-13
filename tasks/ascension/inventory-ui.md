# NXTFRM presentation layer inventory (branch `ascension`)

Read-only inventory. No project file was edited, no git state changed, and the app was not run. Static reading of the working tree on 2026-10-13.

**Scope.** `premium-ui.js` (2,880 lines; the `NXP` object, L3-L2827) and `strata.js` (1,043 lines; the `STRATA` motion layer, L6-L1041). Engine and legacy references are prefixed: `cs:` = `cut-support.js`, `idx:` = `index.html`. Unprefixed line numbers are `premium-ui.js`; `strata:` is `strata.js`.

**Load order** (`idx:7950-7967`): cut-support, wearables.*, train-anatomy, premium-ui, strata, seed.dev. strata installs after premium-ui has set the render slots (L2829-2831).

**Feature flags in force** (`cs:327`, `cs:331`): `CALORIES_ENABLED = false`; `FEATURES = { calories:false, floorball:false, wearable:false, waist:false, classic:false, reminders:false, checkin:false }`. Every branch gated on these is dormant today (see section 7, B).

**Method.** Both files were read top to bottom in chunks. Every named function and every export was checked with a repo-wide grep for call sites. "Unreferenced" means only its own definition matches. "Test-only" means it appears only in source-string assertions in a `*.test.js` file.

**Corrections to the brief.**
1. `animatedKeys` is declared (`strata:8`) and never read or written. The tab-entrance gate is `state0.lastTab !== tab` (`strata:962`).
2. premium-ui never calls `STRATA.*`. The only call is `STRATA.install()` (`strata:1040`). The two files connect by wrapping the render globals (`strata:1001-1005`), wrapping `NXT.selectPoint` (`strata:1011-1013`), and document-level event delegation.
3. The Weight chart is rendered by the engine (`cs:1164-1312`). premium-ui wraps it (L1387) and strata adds marks to it (`strata:208-311`).

**Headline findings** (details in sections 1-7).
- Three Today tiles are built but never rendered: the hero weight chart (L244), the weekly average bars (L338), and the "Last 5 weeks" calendar (L358). A fourth helper, `linkSignal` (L398), is also unused.
- Every feature-gated branch is off, so check-in, "More for today", the energy estimate, the waist list, three Settings rows (Reminders, Wearable, Classic app), and two Settings labels never appear (section 7, B).
- The live "vs best last time" line in strata (`syncVs`, `strata:609`) and the Train count tick never run: their selectors match no markup.
- The Today recap tile is never placed before the decision card, because its anchor text "NXTFRM decision" (`strata:471`) appears in no markup.
- Stepper hold-to-repeat is bound twice (premium L2575 and `strata:633`). Both loops may run during one long press. This is inferred from the code and was not tested in a browser.
- `home()` appends to `cfg().suggestions` on Today renders unless the last row is identical (L132, `cs:587-600`).
- The presentation layer makes direct network calls (`testConnection`, L2222-2262) and writes stored settings in several places.

---

## 1. Screen map

### 1.1 Today (`home()` L70-238; renders into `#homePage` at L169)

Root `div.vn-today.st-today > div.vn-pad`. Header `header.st-head`: eyebrow `p.st-eyebrow` (weekday and date), `h1.st-h1` from `greeting()` (L59). On lifting days a gym chip `button.st-chip` calls `cycleGym()` (idx:6430).

Engine reads: `N.sessionLogs`, `N.planDone`, `N.trendStats` (cs:241), `N.review` (cs:276), `N.cfg`, `N.cardioWeek` (cs:505), `N.strengthItems` (cs:259), `N.workRows` (cs:247), `N.detectPlateau` (cs:211), `N.timingRows` (cs:90), `N.completedWeek` (cs:506), `N.weekStart`, `N.typeFor`, `N.dateAdd`, `N.label`, `N.shortDate`, `N.signed`, `N.finite`, `N.done`, `N.logSuggestion` (cs:587).

Ordered content:

1. **Train tile** (`article.st-tile.st-t-train`, L134-164). Colour set by `--c` per day type.
   - Lifting day (L135-146): eyebrow `.st-cat` reads "Workout saved" (finished) or "Today's training". `Change` text button calls `showSessionSheet()` (`cs:1533`). Title `h2.st-h2` = day label; meta `p.st-meta` = "N exercises · N working sets · gym". `ringHTML` (L240) when any set is logged. Week block (see 2). CTA `button.st-cta` calls `switchTab('train')` if finished, else `action` (`startWorkoutNow()`, `showCardioSheet()`, or `apx96OpenReadiness()`). Footer `p.st-meta` = `lastLiftLine`.
   - Rest, walk, or floorball day (L147-163): eyebrow "Today"; `Change`; one copy line; CTA unless Rest; `div.vn-rows` with two rows: **Morning weight** `button.vn-row` (`apx95OpenQuickWeight()`, shows "Logged · X kg" or "Not logged yet") and **Add optional lifting** `button.vn-row` (`NXP.addOnPick()`, only when `addOnEligible()`). Then `p.st-meta` = `nextLine` and the week block.
   - Empty state: none needed; the tile always renders.
2. **Week rail** (`div.vn-week[data-rail=capsule][role=list]`, L116-128, built inside `home()`). Seven `button.vn-week-c` (role listitem), each calling `NXT.openDay('YYYY-MM-DD')`. Classes: `is-today`, `is-lift`, `is-done` (check mark), `is-missed` (planned past day with nothing recorded), `is-future`, and `is-k-{full|push|pull|legs|walk|fb|rest}`. Sub-labels `vn-week-d` (weekday letter) and `vn-week-t` (short plan name from `weekShort`, L107). Source: `N.typeFor`, `workRows`, and `state.cardio` / `state.floorball`. Rule per D48.
3. **Weight mini** `weightTileHTML()` (L310-323). `button.st-tile.st-mini` labelled "Trend", with `b.st-odo.st-odo-sm[data-st-odo]` (rolling digits) and a meta line: "Flat", "+/-N.N/wk", or "7-day trend". Tap sets `NXT.ui.view='overview'` and switches to weight. Empty state: "-" with "Log a weigh-in" → `apx95OpenQuickWeight()`. Engine: `N.trend` (cs:122), `N.detectPlateau`.
4. **Cardio mini** (L182-186). `button.st-tile.st-mini` → `showCardioSheet()`. Value `b.vn-num` = `cardioMins` with `small` "/target" (target `settings.zone2WeeklyTarget`, default 90); bar `.st-mini-bar i` width%; meta "min/wk". Engine: `N.cardioWeek`.
5. **Lifts mini** (IIFE L187-205). If the last lifting day is 7 days old or less and `liftOutcome()` (L324) has comparisons: `button.st-tile.st-mini.st-mini-lifts` with value "N / M beat" and a meta line naming the session and when. Otherwise (L201) `button.st-tile.st-mini` showing `perfLabel` (L83). Both tap to `NXT.ui.view='strength'` and switch to weight.
6. **Decision card** `section.st-tile.st-t-dec[data-st-view][aria-labelledby=vn-dec-h]` (L208-212; tone class `vn-tone-watch` when `review.tone==='watch'`).
   - `.st-cat` "Decision". "Why" `button.st-link.st-why` calls `NXT.openReview()` (`cs:899`).
   - `h2.st-h3#vn-dec-h` = `review().title` (`cs:276`). `p.st-body` = `review().message || review().reason`.
   - Evidence from `decEvidenceHTML()` (L277-308): trend chip `button.st-dec-chip.st-dec-trend.is-{up|down|flat}` opens Progress › Weight, and contains the 28-day mini chart (section 2.6). Confidence chip `button.st-dec-chip.st-dec-conf` calls `NXT.openReview()`, with 1 to 3 `.st-dec-bars`.
   - Strata rolls the trend value on first scroll-in (`strata:906`).
7. **Body tile** `bodyTileHTML()` (L379-397). `button.st-tile.st-t-body` → `NXT.ui.view='body'`. Eyebrow "Latest Evo scan"; four cells (Fat %, Fat mass, Muscle, Weight) each with a `.wx-chip` change marker against the prior scan. Returns an empty string when there are no scans, so the tile is absent. Source: `bodyScanSource()` (L1689) → `evoOrdered()` (`idx:4408`).
8. **Quick actions** `nav.vn-pad.st-quick` (L215-222): `button.st-qa` "+ Weight" → `apx95OpenQuickWeight()`; "+ Cardio" → `showCardioSheet()` (hidden on walk days); "+ Check-in" → `apx96OpenReadiness()` only when `N.features.checkin` (L221, **off**).
9. **More for today** `details.vn-more.vn-pad.st-more` (L224-231). Rendered only when `wearable || checkin || calories` (L224, **all off**). It would contain `recoveryHomeCard()` (L458) and the calorie guide `button.nxp-home-kcal` → `NXT.openCalories()` (`cs:872`), plus `N.adherenceHTML()` (`cs:610`).

Empty, loading, and error states: no loading state. With no readings, the Trend mini shows "-" and the engine headline reads "Building your baseline" (`cs:276` base object). The hero `article.st-hero.is-empty` (L246) is dead (see 1.1 dead list).

Duplicated figures on Today:
- The trend appears in the Weight mini ("Trend kg"), in the decision chip (kg/wk and the range label), and in the 28-day chart's range text.
- Weekly lifts appear in the train-tile header ("This week · 2 of 3 lifts done", L130), the Lifts mini, and the Settings "lifting days" row.
- Cardio minutes appear in the Cardio mini and again on the Train idle screens (1.2).

**Dead on Today** (defined, never rendered by `home()`; section 7, A):
- `heroTileHTML()` (L244-276): hero weight chart with odometer, plus the strata path `drawHero` (`strata:94-207`) with replay and scrub. The whole hero path is unreachable.
- `weeklyTileHTML()` (L338-357): "Weekly average" bars.
- `calendarTileHTML()` (L358-378): "Last 5 weeks" calendar. This is the only Today "Last 5 weeks" tile, and it is unreachable.
- `linkSignal()` (L398).

Side effect in render: L132 calls `N.logSuggestion({kind:"review",...})` on each Today render. It appends to `cfg().suggestions` unless the last row is identical (section 7, D).

### 1.2 Train: idle vs active (`training()` L715-926)

Branch order inside `training()`:
- Floorball day: `trainFloorball()` (L717, L546).
- Rest or walk day, unless an add-on is focused: `trainRest()` (L538) or `trainZone2()` (L542), set at L724-727.
- Empty session list: `trainEmpty()` (L554).
- Not focused, not finished, no add-on: `trainLiftIdle(list)` (L583). **This is the idle screen.**
- Finished (`N.planDone()`): finished card (L772-789).
- Otherwise: the focused active view (L861-925).

Shared chrome `trainChrome()` (L499): `header.nxp-train-chrome.st-head` with eyebrow gym and date, `h1.st-h1` day label, and a `button.st-chip` "Change" → `showSessionSheet()`. Idle screens also get the recovery aside `trainGuidanceHTML()` (L467).

**Idle screens** (all render into `#trainPage`, container `div.n99.nxp.nxp-train.nxp-train-idle`, via `trainIdle()` L500-503):
- `trainRest()` (L538-541): copy "No lifting session due". `cardioMeterHTML()` (L535, `div.st-cmeter`, role img). Actions: when `N.features.checkin` (**off**), "Quick recovery check-in" plus "Log cardio"; otherwise only "Log cardio" → `showCardioSheet()`. Then `upNextHTML()` (L512) and `addOnSection()` (L1173).
- `trainZone2()` (L542-545): copy "Zone 2 - a conversational effort". The weekly pace is drawn differently from the Rest meter (`div.nxp-train-pace` with `n99-session-rail`, the duplicate figure in section 7, C). "Log cardio" button; check-in link (checkin only); `upNextHTML()`; `addOnSection()`.
- `trainFloorball()` (L546-553): copy "Hard conditioning day. Log duration and effort." Form `section.nxp-train-floorball-log` with `#apx96FbDuration` (min), `#apx96FbIntensity` (1-10), and `textarea#apx96FbNotes`; "Save session" → `apx96SaveFloorball()` (`idx:7860`). Recent three entries (`div.nxp-train-recent`) read "N min · RPE N". Empty copy "No Floorball sessions logged yet." (L553).
- `trainEmpty()` (L554-557): "No exercises in this session"; "Add exercise" → `v88OpenAddModal()` (`idx:3636`); "Restore programme" → `NXT.fullSession()` (`cs:1527`); `addOnSection()`.
- `trainLiftIdle(list)` (L583-621, innerHTML at L602):
  - `section.st-tile.st-ready`: eyebrow "Ready when you are" or "In progress"; `h2.st-h2` "N exercises"; meta "N working sets · N logged"; `ringHTML` when logged; `muscleMapHTML()` titled "Today’s focus" (L576-582); CTA `button.st-cta` → `NXP.enterTrain()` ("Start workout" or "Resume workout").
  - `section.st-plan`: heading "Session plan"; `button.st-link` "Options" → `NXP.sessionMenu()`; plan rows `button.st-plan-row` (L597-600) → `NXP.chooseExercise(i);NXP.enterTrain()`, each with an anatomy figure `.st-plan-fig`, name, "sets x lo-hi reps · best W kg x R" (or "no history"), and a tick or done/sets count.
  - Engine: `N.sessionLogs`, `N.done`, `N.sessionRows` (`cs:250`; cutoff `state.date`), `N.bestSet` (`cs:620`), and `NXTLIB` / `NXTANAT` (`train-anatomy.js`).

**Active focused view** (`div.n99.nxp.nxp-train.st-train.st-train-active`, L861-905, classes `is-just-logged`, `is-mode`, `is-all-done` as applicable):
- Top bar `header.st-tbar`: `button.st-icon` "Leave workout" → `NXP.leaveTrain()`; `p.st-tbar-t` day label; `p.st-tbar-s` "count of total sets"; `button.st-icon` "Workout options" → `NXP.trainMenu()`; `button.st-tfinish` "Finish" (`is-ready` when all sets are logged) → `NXT.finish()` (`cs:1512`).
- Segment bar `div.st-segbar[aria-hidden]`: one span per exercise with an `i` width%.
- `trainAlertHTML()` (L984): `aside.nxp-train-alert` with recovery guidance, shown only when the training state is neither "no_recovery_signal" nor "proceed".
- All-done `section.st-complete[aria-live=polite]`: "All N sets logged" and `button.st-complete-b` → `NXT.finish()`.
- Exercise `section.st-ex` (class `is-forward` or `is-back` only when the exercise changed, L754-758):
  - `p.st-ex-pos` "Exercise i of n"; title `button.st-ex-title` → `NXP.exerciseDetails()` (L1238).
  - `p.st-ex-mus` (muscle names from `NXTANAT.label`, or `muscleLine()` L1213), reps range, optional `p.st-ex-note` from `v88NoteFor()` (`idx:3618`).
  - Anatomy lens `bleedHTML(ex)` (L564) → `NXP.exerciseDetails()`.
- Reference line `div.st-refline[role=group]`:
  - **Aim** `button.st-ref.is-aim` → `NXP.useAim()`, from `N.aimFor` (`cs:641`). With no aim: static "Set a baseline".
  - **Best** `div.st-ref` (`data-w`, `data-r`): previous best weight x reps and its date, or "No history yet".
  - **Rest** `div.st-ref`: planned rest via `apx96FormatTimer(restPlan)`.
- Coach line `details.st-coachline.is-{kind}` (L806-810): summary with headline (`coach.headline`), a pill from `pillTxt` (L803-805), and "Why"; body `p.st-coach-n` = `coach.note`. Source `N.coachFor(ex)` (`cs:654`).
- `button.st-diff` "Changed for today only" → `NXP.saveTodayToRoutine()` (L2019). Shown when `sessionDiffers()` (L2015) is true and no add-on is active.
- Rest timer `aside.nxp-rest.st-rest` (`hidden` when idle; `role=timer` when active): `b#apx96TimerValue`, `restRail()` (L649), and "+30s" → `apx96AdjustRest(30)` and "Skip" → `apx96SkipRest()` (`idx:7817`, `idx:7821`). Repainted by `paintRest()` (L2786).
- Set form `form#nxp-set-form.st-card` (L848-865, `onsubmit NXP.logSet()`):
  - Card head: `p.st-card-t` "Set N of M" / "Warm-up" / "Extra set".
  - Set-type segmented control `fieldset.nxp-seg-block.nxp-seg-type` (Working | Warm-up) → `NXP.setSetType(v)` (L993).
  - Ledger `ol.st-ledger` (L847). Rows: warm-up "W" rows; logged rows `li.st-lrow.is-done` (button → `NXP.editCurrentSet(i)`, which opens the edit sheet) with a verdict word "Beat last time" / "Matched" / "Logged" from `cmpBest` (L791-797); the entry row `li.st-lrow.is-now` with two `stepper()`s (L638) for `#weightInput` and `#repsInput` (`oninput NXP.rememberInput`); next rows `li.st-lrow.is-next` (button → `NXP.useTarget(k)` when `coach.sets[k]`, else "lo-hi reps").
  - Hidden inputs `#n99-set-type` and `#n99-rir` (L858).
  - Submit `button#nxp-log-button.st-log` with idle label "Log set N" or "Log warm-up", or confirmation "Set N logged" with a tick (L859).
  - When all sets are done, the form sits inside `details.st-extra` "Log an extra set".
- Exercise nav `nav.st-exnav`: previous → `NXP.goExercise(-1)` (disabled at index 0); middle `button.st-exnav-mid.nxp-queue-open` → `NXP.queue()`; next → `NXP.goExercise(1)` (disabled at last).
- Horizontal swipe on `.st-ex` → `NXP.goExercise(±1)` (strata `bindTrain`, `strata:653`).

**Finished card** (L772-789, `div.st-train-finished`): `section.st-tile.st-done` with a badge SVG, eyebrow "Workout saved", `h2.st-h2` "day · gym", `momentsHTML()` (L687), `sessionOutcomeHTML()` (L691), `muscleMapHTML()` titled "What you trained" (L781). Buttons: `button.st-cta` "View session" → `NXP.sessionSummary()` (L2538, the day sheet); `button.st-ghost` "Resume workout" → `NXT.resume()` (`cs:1522`, wrapped at L2859); row `button.st-row-btn` "Workout queue" → `NXP.queue()`.

**Train sheets** opened from Train are listed in section 3.

### 1.3 Progress (`progress()` L1354-1388; renders into `#weightPage`)

Shared header: period label from `settings.cutStart` / `N.ui.range` (L1355: 2 weeks, last month, 3 months, "Since your cut started", or "All recorded weigh-ins"). Sub-tab strip `div.n99-progress-tabs.nxp-progress-tabs.vn-progress-tabs[role=group aria-label="Progress view"]` (L1356-1358): one button per view calling `NXT.setView(key)` (`cs:1361`). Views: Weight (`overview`), Training (`training`), Performance (`strength`, short label "Lifts"), Body (`body`). Each has `aria-pressed` and `.active`. Each branch also repeats its own header `h1` "Progress" and a "+ Weight" button → `apx95OpenQuickWeight()` (L1359 and in each branch).

**Weight** (default branch, L1387, `div.n99.nxp.nxp-progress.nxp-progress-weight.vn-progress`):
- The engine chart `N.chartHTML()` (`cs:1164-1312`, section 2.1), passed through `withGoalDate()` (L1344-1348, a regex that appends "around DATE" after "~N weeks to goal").
- premium then string-inserts three blocks before `<div class="vn-mhead"` (L1387): `downSoFarHTML()` (L1315-1325, `p.st-down` "X kg down · Y kg to your goal range", only when `targetConfirmed`), `weightHighlightsHTML()` (L1350-1352, `ul.st-wchips[aria-label=Highlights]`, from `weightHighlights()` L1297-1313: "Lowest weigh-in yet · X kg" and "N weeks of falling averages in a row"), and `slowWeekHTML()` (L1334-1342, `p.st-slow`, one sentence about a flat or up week). If the chart is in its empty state the anchor is absent and these three blocks silently disappear.
- `details.nxp-progress-tdee` "Energy estimate" → `N.tdeeCardHTML()` (`cs:489`): rendered only if `N.features.calories` (L1387, **off**).
- `button.vn-row.vn-weighins` "All weigh-ins" → `NXT.openWeightHistory()` (`cs:1390`), sub-line `N.weights().length` readings.
- Empty state: the chart's own empty block (`cs:1177-1185`): "Your first weigh-in starts here", with "+ Log weight" → `apx95OpenQuickWeight()`.

**Training** (L1374-1378, `div.n99.nxp.nxp-progress.nxp-progress-training.vn-progress`): header subtitle `activitySubtitle()` (L1580); body `activityView(items,sum)` (L1592-1649, section 2.5). Data `N.activityWeeks(actWeeks())` (`cs:517`) and `N.activitySummary` (`cs:551`). Range segmented control `div.vn-seg.n99-segments.st-act-seg[aria-label="Weeks shown"]` (L1593) → `NXP.actRange(w)` for 12 weeks, 26 weeks, or 1 year (`ACT_RANGES` L1537). Headline `activityHeadline()` (L1585-1591). Plan line. Three bar blocks (section 2.5). "Weeks at plan" list `ol.st-act-cons` (L1609) inside `div.st-act-blk.st-act-consblk`. Read-out `div.st-act-read#st-act-read[aria-live=polite]` (L1615) for the selected week: lift days, sets, kg lifted, cardio minutes. `details.st-csum-d` "How to read this" (L1645-1648). Empty state: `section.st-act.is-empty` "Nothing logged yet" with "Open Train" → `switchTab('train')` (L1599).

**Performance** (L1382-1386, `div.n99.nxp.nxp-progress.nxp-progress-strength.vn-progress`): subtitle `performanceSubtitle()` (L1497); body `performanceView(items)` (L1523-1529), the only data source being `N.strengthItems()` (`cs:259`):
- Intro `header.vn-perf-lead` → `performanceIntro()` (L1504-1518). Copy is fixed text, including "21-day window" and "Four sessions" (L1507-1512).
- `ol.vn-perf-rows` of `li.vn-perf-row.st-perf` from `performanceRow()` (L1479-1496): name `h3.vn-perf-name`; best set `p.st-perf-best` ("X kg x R"); status pill `span.vn-perf-flag.st-perf-pill` (its `title` is `statusRead()`); meta line `performanceMeta()` (L1472); read sentence `p.vn-perf-read` only for Review, Watch, and Improving; e1RM sparkline (section 2.4).
- Fold button "Show N older lifts" added by strata `foldPerf` (`strata:474`).
- Note `p.vn-perf-note` = `PERF_NOTE` (L1402): "Estimated 1RM is a comparison aid, not a tested maximum..."

**Body** (L1363-1366, `div.n99.nxp.nxp-progress.nxp-progress-body`):
- Header `bodyTitle()` (L1693). Summary `bodySummary(waist, scans)` (L1699-1722; takes one parameter): `section.nxp-progress-body-summary` with the latest waist value, delta versus prior, and "A second reading is needed..."; or "Nothing measured yet" with scale-weight copy.
- Composition map `compMapHTML(scans)` (L1739-1751, needs at least 2 scans; section 2.8).
- `bodyView(waist, scans)` (L1753-1759):
  - Waist list: `button.n99-list-row.nxp-progress-body-row` per reading → `NXT.openWaist(date)` (`cs:1378`); "Log waist" → `NXT.openWaist()`. Gated by `N.features.waist` (L1757, **off**).
  - "Evo scans" section: `bodyScanAnalysis(scans)` (L1724-1737) renders `evoDetailHTML` (`idx:4890`) or `evoAnalysisHTML` (`idx:4914`), or an empty-state paragraph ("No scans saved. A scan is a reading from that moment...").
  - "New scan / Add" row → `NXP.openBodyCapture()` (L1761-1770), which opens the capture form on the Settings body page. "Import from Strata / Paste" row → `NXT.importScans()` (`cs:1424`).
  - Footnote `p.n99-small.nxp-progress-body-note`.

### 1.4 History (`history()` L2446-2452; renders into `#historyPage`)

Root `div.n99.nxp.nxp-history.vn-history`:
- Header `header.nxp-heading.nxp-history-chrome.vn-hist-chrome#vn-hist-chrome`: h1 "History" and `p#vn-hist-summary` from `historyMonthSummary()` (L2292-2299).
- Filter `div.nxp-history-filters.vn-hist-filters#vn-hist-filters[role=group aria-label="Activity type"]` (L2311-2313; tabs All, Lifting, Cardio, Weight from `HISTORY_TABS` L2264) → `NXP.setHistoryFilter(k)` (L2453).
- Calendar `section.nxp-history-calendar.vn-hist-calendar#vn-hist-calendar` (`historyCalendar()` L2314-2342, section 2.11):
  - Header `h2.nxp-cal-month` (month and year). Nav: "previous" → `historyShiftMonth(-1)`, "Today" → `historyThisMonth()`, "next" → `historyShiftMonth(1)`.
  - Weekday letters (aria-hidden). Grid `div.nxp-cal-grid#vn-hist-grid[role=grid]` with `onkeydown=NXP.historyKey` (L2483). 35 to 42 `button.nxp-cal-day` cells, each `onclick=NXP.historySelect(date)` (L2458).
  - Legend `p.nxp-cal-legend.st-cal-stats[aria-label="This month"]`: counts for Lifting, Cardio, and Weigh-in.
- Day view `div#vn-hist-dayhost` → `historyDayView()` (L2396-2421):
  - `header.nxp-history-selected-head` with `h2.st-dayhead` (full date in aria-label) and `p.nxp-history-selected-summary` (sets, exercises, activities or minutes, kg). Legend `p.st-day-k`.
  - `historyLiftingBlock()` (L2344-2360, `data-kind=lifting`): sets grouped by exercise, with "Edit sets" → `NXP.historyDay(date)`.
  - `historyConditioningBlock()` (L2361-2375, `data-kind=conditioning`): cardio and floorball rows. The block label reads "Conditioning" (L2361).
  - `historyWeightBlock()` (L2376-2388, `data-kind=weight`): morning weigh-in with change versus the prior morning and the trend value to two decimals (L2383).
  - Per-filter empty copy (L2407-2409) and `historyAuditLanes()` (L2389-2395): three hidden placeholder `section`s.
- Day sheet `historyDay(date)` (L2530-2535; section 3).
- Swipe between months on the grid (`strata:854-896`) → `NXP.historyShiftMonth(±1)`.

Engine and legacy reads: `logsForDate` (`idx:7235`), `cardioForDate` (`idx:7238`), `bwForDate` (`idx:7241`), `dayTypeLabel` (`idx:7219`), `localToday` (`idx:6618`), `calendarMonthState` (`idx:7356`), `dateKeyFromParts` (`idx:7370`), `N.timingRows`, `N.trend`, `N.weights`.

### 1.5 Settings (`more()` L2034-2071; renders into `#morePage`)

**Hub** (`view==='hub'`, L2056-2068): `h1.vn-set-title` "Settings". Then `moreAccount()` (L2072-2085): `section.vn-set-account.st-id` with a monogram, the name (default "Dan" via `userName()`), the cloud state, and "Stored on this device" or the signed-in email. Groups from `setGroup()` / `setRow()` (L1813-1821):
- **Plan**: "Goals" → `NXT.more('goals')` (`cs:1597` view), with the kg range or "Set up" (L2053; the "Goals & calories" branch is gated by `N.features.calories`, **off**). "Training" → `NXT.more('training')` with the lifting day count (L2054). "Cardio" → `NXT.more('coach')` with the weekly target (L2055; "Cardio & recovery" branch gated by `N.features.checkin`, **off**).
- **Preferences**: "Your name" → `NXP.nameSheet()` (L63), with `userName()`. "Appearance" → `NXT.more('appearance')` with a summary of text size and motion. "Reminders" only if `N.features.reminders` (L2059, **off**).
- **Body**: "Body & scans" → `NXT.more('body')`, with the waist entry count.
- **Data**: "Cloud & sync" → `NXT.more('data')`, word and tone from `cloudSignal()` (L1832-1852). "Storage" → `NXT.more('data')`, from `storageStatus()` (L1778-1807). "Wearable" → `NXP.openWearableConnection()` only if `N.features.wearable` (L2065, **off**).
- **About**: "App & install" → `NXT.more('app')`. "Classic app" only if `N.features.classic` (L2068, **off**).
- Sign out `button.vn-set-text` → `cloudSignOut()` (`idx:5486`), only when signed in (L2069).
- Footer `p.vn-set-foot` "NXTFRM · your next form" (L2070).

**Premium-rendered sub-pages**:
- **Appearance** `appearanceView()` (L2123-2131): `form.vn-set-form` with two `setField()` segmented fields: `#nxp-text` (Standard | Larger) and `#nxp-motion` (Follow device | Reduce motion), both driven by `NXP.pickOption()` (L2113). Submit "Save appearance" → `NXP.saveAppearance()` (L2132), which writes `cfg().appearance = {text, motion}`.
- **Data & sync** `dataView()` (L2166-2193):
  - "Cloud" block: state flag and `cloudLabel()` (L48), `#nxp-connection-result[aria-live]` (`connectionHTML()`, L2195), `button#nxp-connection-test` → `NXP.testConnection()` (L2222-2262, section 7, I). `details` "Account & connection settings" wraps the legacy `cloudCardHTML()` (`idx:5496`) after string rewrites (L2167).
  - "Backup & restore": two export buttons, "Export app backup" → `exportJSON()` (= `NXP.exportBackup`, L2194) and "Export workout CSV" → `exportCSV()` (`idx:7490`). `details` "Restore a backup" → `backupRestoreHTML()` (`idx:5291`). `details` "Local safety copy" → `NXT.exportSafety()` (`cs:1684`) and `NXT.restoreSafety()` (`cs:1689`).
  - "Scan photos" block, only when photos exist: "Remove scan photos" → `NXP.removeScanPhotos()` (L2154, native `confirm()`).
  - "Advanced": `details` "Advanced cloud setup" → `supabaseSQLHelpHTML()` (`idx:5538`).
- **Training** `trainingView()` (L1858-1874): "Your week" with seven `button.st-wd` → `NXP.pickDay(d)` (L1876); "Routines" with the gym segmented control `div.st-gymseg` → `NXP.setRoutineGym(g)` (L1875); routine cards `button.st-rt` → `NXP.editRoutine(type)` (L1888); `details.st-more-rt` "Other routines".
- **Routine editor** `routineView()` (L1893-1911, a page): back → `NXP.routineBack()` (L1912, native confirm when dirty). Rows `div.st-rx`: name button → `NXP.routineEdit(i)` (L1927, steppers sheet); move up and down → `NXP.routineMove` (L1918). "Add exercise" → `NXP.routinePick(-1)` (L1960). "Also save to {other gym}" checkbox → `NXP.routineBoth` (L1919). "Restore default exercises" → `NXP.routineDefault()` (L1920, native confirm). Save bar "Unsaved changes" / "All changes saved" with "Save routine" → `NXP.routineSave()` (L2003).
- **Body** → `evoScanView()` (L2027-2033) renders the legacy `renderEvoScanPage()` (`idx:4936`) into `.vn-evo`.

**Legacy sub-pages** reached through `base.more()` and `subviewChrome()` (L2041-2045, L2086-2104): `goals` (`cs:1597-1610`), `coach` (`cs:1597`), `notifications`, `app`. Only `goals` and `coach` were read; `notifications` and `app` are outside this inventory.

**Empty and error states in Settings**: cloud "Not configured", "Sign-in needed", "Sync error" (L1832-1843); "No waist measurements yet" (L1755); "Nothing measured yet" (L1718); connection states `ui.connection` (L6) with validation messages from `validConfig()` (L2213-2220).

---

## 2. Chart inventory

Summary of charts and chart-like strips:

| # | Chart | Where rendered | Type |
|---|---|---|---|
| 2.1 | Weight trend chart | `cs:1164` via premium L1387; strata `dressProgress` | Scatter plus smoothed line, readout, range and replay |
| 2.2 | "Vs trend" strip | strata `dressProgress` (`strata:229-242`) | Deviation bars, aria-hidden |
| 2.3 | Week-by-week ledger | strata `dressWeeks` (`strata:313-391`) | Row list with change chips |
| 2.4 | Performance e1RM sparks | premium L1438-1496 | Per-exercise line, own scale |
| 2.5 | Training activity bar charts | premium L1543-1576 (`actBars`) | Three weekly bar charts with scrub |
| 2.6 | Today 28-day decision mini chart | premium L277-308 | Area plus line, no interaction |
| 2.7 | Today week rail | premium L116-128 | Seven capsules |
| 2.8 | Body composition map | premium L1739-1751; strata `drawCompMap` (`strata:550-579`) | Scatter with arrow path |
| 2.9 | Body "Latest Evo scan" tile | premium L379-397 | Number cells with change chips |
| 2.10 | Meters and rails | premium L240, L535, L649, L1608 region | Progress bars |
| 2.11 | History calendar | premium L2314-2342 | Month grid with marks |
| dead | Today hero chart, weekly average bars, "Last 5 weeks" tile | premium L244, L338, L358 | Not rendered (section 7, A) |

### 2.1 Weight trend chart (Progress › Weight)

- **Where.** Engine markup `cs:1164-1312` (`chartHTML`), inserted by premium `progress()` at L1387. Decorated by strata `dressProgress` (`strata:208-311`), `dressWeeks` (`strata:313-391`), `progressTip` (`strata:494-516`), and `bindProgressReplay` (`strata:525-548`).
- **Question.** What is my morning weight trending toward, and how did a given day read against its trend?
- **Data.** `chartModel()` (`cs:982`) over `N.weights()` and `N.trend` (`cs:122`). Forecast from `forecastGoal` (`cs:153`). Plateau from `detectPlateau` (`cs:211`). Post-workout readings from the post series.
- **Type.** SVG. Smoothed trend line `path.vn-trend-line` with a glow filter and `smoothPath` (`cs:907`). Morning readings `circle.vn-raw-dot`. Post-workout diamonds `path.vn-post-mark`. Projection cone `polygon` and dashed `line.vn-proj-line`. Week bands. Today rule. "Start N kg" reference line and pill in All and Cut ranges (`.vn-start-ref`, `.st-pillg.is-start-ref`).
- **Axes and labels.** Y ticks `text.vn-ytick`, thinned to every other tick when there are more than five (`cs:1198`, D58). X labels show 1 to 3 dates (`cs:1210-1219`). Units are kg. Legend `div.vn-legend#vn-legend` (`cs:1298`): Trend, Morning, Post-workout (when shown), Projection (when shown). Strata appends "Above trend" and "Below trend" items to the legend (`strata:277`).
- **Strata additions.** Trend stroke gradient `st-tg` (`strata:213`); end-value pill with two decimals (`strata:216-222`); weekly step lines `line.st-wstep` for each Mon-Sun week with at least three readings (`strata:244-256`); goal-range pill "Goal range · ~date" (`strata:258-263`); bridge line `.st-bridge` (`strata:265-270`); "Low X.X" tag when there are at least seven points (`strata:294-299`); stem `#st-stem`; scan column `#st-scan`; the Vs-trend strip (2.2).
- **Interactions.**
  - Scrub: `onpointerdown` / `onpointermove` → `NXT.scrub(event)` on `#vn-chart-wrap` (`cs:1273-1276`, `cs:1334-1343`).
  - Keyboard: `onkeydown` → `NXT.chartKey(event)` (`cs:1344-1356`). Left and right arrows move; Escape returns to latest. The wrapper's aria-label states this (`cs:1274`).
  - Selection: `NXT.selectPoint(index, opts)` (`cs:1313-1333`) rewrites the readout. Strata's `progressTip` (`strata:494-516`) shows a tooltip with "Reading", "Trend" (two decimals), and "N kg below/above trend" (`st-tip-gap`, shown only when the gap is 0.05 kg or more). premium's `hookProgressSelect` (L2811-2827) rewrites `#n99-chart-weight` again after selection.
  - Replay: `button.st-replay[data-st-chart-replay]` "Replay this range" (`cs:1272`) → strata `bindProgressReplay` (`strata:525-548`): 6,500 ms, rAF, in-out easing, reveals through `#vn-chart-clip-r` width, drives `NXT.selectPoint`. The button toggles to "Stop" while running. Its labels are hard-coded English (`strata:529-544`).
  - Range: `NXT.setRange(r)` (`cs:1357`) for 2W, 1M, 3M, and Cut (`cs:1174-1176`). Toggles: Post-workout → `NXT.setPostVisible` (`cs:1359`); Projection → `NXT.setForecastVisible` (`cs:1360`), shown only when `canForecast`.
  - Week ledger: clicking or pressing Enter on a week row selects that week's last reading and scrolls the chart into view (`strata:371-386`).
- **Reduced motion.** Engine draw-in classes `is-range-change` and `is-new-point` are set at `cs:1170`; the CSS behind them was not inspected. Strata replay checks `reduced()` and jumps to the last reading (`strata:533`).
- **Accessible summary.** `svg#n99-chart-svg[role=img][aria-labelledby="n99-chart-title n99-chart-desc"]` with `title` (`cs:1278`) and `desc` (`cs:1279`). Wrapper `div#vn-chart-wrap[role=application]` with an aria-label (`cs:1274`). Readout `#vn-mhead[aria-live=polite]` (`cs:1253`). Text equivalent in `details.st-csum-d` "How to read this chart" (`#vn-csum`, `cs:1305`).
- **Other engine blocks on the same page.** `div.st-rread[role=group aria-label="This range"]` with trend change, lowest reading, and share of days weighed (`cs:1240-1246`). "Cut journey" `journeyHTML()` (`cs:1089-1105`, `cs:1307`). `evidenceHTML()` (`cs:1128`, `cs:1308`). "Why NXTFRM says this" `details` containing `diagnosisCard()` (`cs:782`) and `reviewCard()` (`cs:777`) (`cs:1309`). A hidden `input#n99-chart-slider` (`cs:1310`).

### 2.2 "Vs trend" strip (Progress › Weight)

- **Where.** Strata `dressProgress`, strip build at `strata:229-242`; label at `strata:237`.
- **Question.** Did each morning reading sit above or below its own trend value, so daily noise reads apart from the trend?
- **Data.** Per reading: `weight - avg` from the engine model (`strata:232`). Strata does this subtraction itself; the value is not stored.
- **Type.** Bars `rect.st-dev.is-up` and `rect.st-dev.is-dn` (5.2 px wide, rx 2.6) on their own zero line `line.st-dev-axis`, in a panel under the plot. Shown only with at least four deviations.
- **Axes.** No axis of its own. Half-height is scaled to the largest absolute deviation, rounded up to 0.5 kg (`strata:235-236`).
- **Interactions.** No independent scrub. Scrubbing the main chart adds `.is-sel` to the bar at the selected index (`strata:501-504`).
- **Accessibility.** The group is `aria-hidden="true"` (`strata:241`). The only text equivalent is the tooltip gap line shown on selection (`strata:505`).
- **Reduced motion.** No JS animation.

### 2.3 Week-by-week ledger (Progress › Weight)

- **Where.** Strata `dressWeeks` (`strata:313-391`), mounted after `.vn-togs` or `#vn-chart-wrap`.
- **Question.** How did each Monday-to-Sunday average move week to week?
- **Data.** `N.windowStats` (`cs:104`) over `N.weights()` for the last five weeks (`strata:316-321`). Per-week min and max are taken from the rows (`strata:326-329`). The current week is labelled "This week" with "N days to go".
- **Type.** A list, not a bar chart: `ol.st-wk-l` of `li.st-wk.wx-it`, each with the week label, an average `b.wx-v`, a change chip `.wx-chip.is-up|is-down|is-flat|is-none` (the same chip class used by the body tile), and seven day marks `span.wx-dots`.
- **Dead variant.** The first implementation, a polyline with range bars (`strata:346-351`), is overwritten. `const style = "ledger"` (`strata:353`) is always true, so the ledger markup replaces it (`strata:368`).
- **Interactions.** Each row is `role=button` with tabindex 0 and handles click, Enter, and Space (`strata:371-386`): it selects the week's last reading on the chart and scrolls the chart into view.
- **Accessible summary.** Each row has an aria-label sentence (`strata:357-365`): average, mornings weighed, and change against the week before.
- **Reduced motion.** `is-draw` only when `entering && !reduced()` (`strata:348`, `strata:367-368`).

### 2.4 Performance e1RM sparklines (Progress › Performance)

- **Where.** Premium `performanceRow()` (L1479-1496). Helpers: `sparkModel()` (L1438-1445, last eight sessions, own scale with one unit of padding), `sparkText()` (L1446-1449), `endMark()` (L1450-1465).
- **Question.** Is this exercise's estimated 1RM up, flat, or down over its last sessions?
- **Data.** `item.history` from `N.strengthItems()` (`cs:259`), with `latestE1rm`, `status`, and `tone`.
- **Type.** SVG 110 x 40 (`svg.n99-spark.vn-perf-spark`): area `path.vn-perf-area`, line `path.vn-perf-line` (tone and status classes), dots `circle.vn-perf-dot`, and a status mark on the latest point. Marks: rect for Holding, hollow diamond for Watch, filled diamond for Review, line for Older history, hollow circle for Building, filled circle for Improving (`endMark`, L1450-1465).
- **Axes and labels.** No axis. `span.vn-perf-e1rm` "e1RM X" and a visible description `p.vn-perf-eq` from `sparkText()`, which says "own scale MIN to MAX" so rows are not compared by eye.
- **Interactions.** None.
- **Accessible summary.** `svg[role=img][aria-labelledby=vn-perf-t-i][aria-describedby=vn-perf-eq-i]` with a `title` (L1492-1493).
- **Reduced motion.** None in JS.

### 2.5 Training activity bar charts (Progress › Training)

- **Where.** Premium `actBars()` (L1550-1576, 420 x 150 SVG). The three blocks come from the `block()` helper (L1624-1629) inside `activityView()` (L1592-1649).
- **Questions.** Lifting days, working sets, and cardio minutes per week, against the current plan or target.
- **Data.** `N.activityWeeks(n)` (`cs:517`) and `N.activitySummary()` (`cs:551`). The selected week is `N.ui.actSel`.
- **Type.** Vertical bars `rect.st-act-bar` (rx up to 6). Value labels `text.st-act-val` when there are 13 weeks or fewer (L1554). Reference line `line.st-act-ref` labelled "Plan · N/wk" or "Target · N min" (L1564-1566). X labels show 2 or 3 dates, or "Now" for the current week (L1567-1573).
- **Axes.** Y gridlines with at most two ticks from `actTick()` (L1543-1549), labels `text.st-act-gl`, base line.
- **Interactions.**
  - Pointer drag or tap → `NXP.actScrub` (L1663-1670) → `actSelect()` (L1653-1662), which writes `#st-act-rl`, `#st-act-rs`, and `#st-act-v0` to `#st-act-v3` as text and toggles `.is-sel` without repainting.
  - Keyboard on `div.st-act-wrap[role=application][tabindex=0]` (L1626-1628): arrows move, Home goes to the first week, End or Escape returns to the latest week (`actKey`, L1671-1678).
  - Range: `NXP.actRange(w)` (L1651-1652) for 12W, 26W, 1Y.
- **Animation.** `is-draw` is added once, when the view is entered or the range changes (L1603-1604). CSS does the drawing.
- **Accessible summary.** `svg[role=img][aria-labelledby]` with `title`, plus `p.st-sr` text listing every week (`actEq`, L1577-1579, in the block helper at L1624-1629). Readout `#st-act-read[aria-live=polite]` (L1615).
- **Reduced motion.** No JS check; relies on CSS.
- **Duplicated constants.** Layout constants `W=420`, `L=26`, `R=8` appear in `actBars` (L1551) and again in `actScrub` (L1667-1668).

### 2.6 Today 28-day decision mini chart

- **Where.** Premium `decEvidenceHTML()` L277-308 (plot built at L293-299, range label at L300).
- **Question.** Where has the trend been over 28 days, and what are its first and last values?
- **Data.** `N.trend(N.weights())` filtered to 28 days (`from = dateAdd(state.date, -27)`, L282-283). Drawn only when there are at least four trend points.
- **Type.** SVG 300 x 64 (`svg.st-dec-plot`): area `path.st-dec-area` with gradient, line `path.st-dec-line` (`pathLength=1`), raw readings as faint dots `circle.st-dec-raw` (r 1.9), end dot `circle.st-dec-dot` (r 3.6).
- **Axes and labels.** None on the plot. Text range `span.st-dec-range` "first to last kg".
- **Interactions.** The whole trend chip is a button that opens Progress › Weight. No scrub.
- **Accessible summary.** The chip has an aria-label describing the trend and the 28-day range (L302). The SVG is `aria-hidden="true"`.
- **Motion.** The decision value rolls up on scroll-in (strata `rollDec`, `strata:906-921`). The plot itself does not animate.

### 2.7 Today week rail

- **Where.** Premium L116-128, inside `home()`. A capsule strip, not a chart.
- **Question.** Which days this week are done, missed, or planned?
- **Data.** `N.workRows()`, `state.cardio`, `state.floorball`, and `N.typeFor` (D48).
- **Type.** Seven capsule buttons. A check mark for done. A hollow ring for a planned past day with nothing recorded. Today is lit. Walk days with only an add-on lift are neither done nor missed.
- **Interactions.** Each capsule → `NXT.openDay(date)`.
- **Accessible summary.** Each capsule's aria-label names the date, the plan, and the state word. The container is `role=list`; today has `aria-current="date"`.

### 2.8 Body composition map (Progress › Body)

- **Where.** Premium `compMapHTML()` (L1739-1751) renders `div.st-cm[data-st-cmap]`. Strata `drawCompMap()` (`strata:550-579`) draws the SVG.
- **Question.** How did fat mass and muscle mass move across scans? It is not a score.
- **Data.** Scans with `fatMass` and `muscleMass` (`N.finite`), from `bodyScanSource()` (L1689).
- **Type.** SVG scatter, X = fat mass kg, Y = muscle mass kg, each with its own nice domain (`niceDomain`, `strata:84-92`). Connecting path `path.st-cm-path` with an arrow marker; points `circle.st-cm-pt` (first and last emphasised); reference lines through the first scan; zone rect `rect.st-cm-zone` labelled "Less fat · more muscle" when there is room (`strata:563-566`).
- **Interactions.** None.
- **Accessible summary.** The container has `role=img` and an aria-label listing every point (L1748). The SVG is `aria-hidden`. The read line `p.st-cm-read` (L1746-1747) gives the first-to-last change, coloured inline (see section 7, E).
- **Reduced motion.** `is-draw` only when `animate && !reduced()` (`strata:561`).

### 2.9 Body: "Latest Evo scan" tile

- **Where.** Premium `bodyTileHTML()` (L379-397). Not a chart: four number cells with `.wx-chip` change markers. Arrow SVGs `ARW` (L381-382) and tone rules (L383).

### 2.10 Meters and rails

- Today cardio mini bar `.st-mini-bar i` (L185).
- `ringHTML()` (L240-243): `span.st-count[role=img]` with a bar. Used on the Train tile (L140) and the Train idle screen (L609-610).
- Cardio meter `div.st-cmeter[role=img]` (L535-537), Zone 2 pace rail `div.n99-session-rail[aria-hidden]` (L544).
- Rest rail `restRail()` (L649-651) and `paintRest()` (L2786-2805).
- Exercise segment bar `div.st-segbar[aria-hidden]` (L874-877).
- Sets progress `.st-count-bar` (inside `ringHTML`).

### 2.11 History calendar

- **Where.** Premium `historyCalendar()` (L2314-2342); marks from `historyMarks()` (L2275-2284); legend counts in the same function.
- **Question.** Which days this month had lifting, cardio, or a weigh-in?
- **Data.** `state.logs`, `state.cardio`, `state.bws` through `historyMarks` and `historyMonthDates` (L2285-2291).
- **Type.** Seven-column month grid of 35 to 42 `button.nxp-cal-day` cells. Marks: `i.lift` (lifting) and `i.cond` (cardio). Weigh-ins use `i.body`. Floorball has a branch (`i.floor`, L2334-2338) that never runs, because `historyMarks` hard-codes `floorball:false` (L2281). Out-of-month days are faded. The selected day has `is-selected` and `aria-pressed`. Today has `is-today` and `aria-current`.
- **Interactions.** Click → `NXP.historySelect(date)` (L2458-2482). Keys in `historyKey` (L2483-2504): arrows move one day or one week, PageUp and PageDown move a month, Home and End move to the week's ends. Nav buttons `historyShiftMonth` and `historyThisMonth` (L2505-2529). Horizontal swipe on the grid (`strata:854-896`).
- **Motion.** The grid gets `st-slide-n` or `st-slide-p` after a month change (L2510). The swipe checks `reduce()` (`strata:~860`).
- **Accessible summary.** Each cell aria-label gives the date and marks (L2326). The container is `role=grid` with `button` children and `aria-pressed` (L2339); this is not the grid pattern (section 7, G).

---

## 3. Sheets and modals

Every `N.modal()` call and every global sheet opener that the presentation layer uses. "Engine-owned" means the body is outside premium-ui.js and was not read in depth.

| # | Sheet / dialog | Opener (line) | Form ids and controls | What it saves |
|---|---|---|---|---|
| 1 | Your name | `NXP.nameSheet()` L63; reached from Today greeting and Settings "Your name" | Form, no id; `input#nxp-name` (maxlength 24); submit → `NXP.saveName()` (L66) | `settings.name`, then `N.commit('Name saved')` |
| 2 | Recovery | `NXP.openRecovery()` L473; from `recoveryHomeCard()` L458 (dead, see 7-B) | "Update check-in" → `apx96OpenReadiness()` | Nothing; read-only, dead behind `checkin` and `wearable` flags |
| 3 | Connect wearable | `NXP.openWearableConnection()` L452; from Settings "Wearable" row (flag off) | "Close" only | Nothing. On open it calls `sync.connectLive({provider_id:'garmin.connect'})` (L453-455) |
| 4 | Workout options | `NXP.trainMenu()` L928; Train header ⋯ | Rows: Exercise details (`NXP.exerciseDetails()`), Swap exercise (`closeModal();showSubstituteSheet()`, `idx:3864`), All exercises (`NXP.queue()`), Save to routine (`NXP.saveTodayToRoutine()` L2019), Edit day routine (`NXP.editRoutine`), Undo last set (`apx96UndoLastSet()`, `idx:7831`), Session options (`NXP.sessionMenu()`); add-on section | Save to routine writes `cfg().templates[gym__dayType]`. Undo calls `apx96UndoLastSet()` with no confirmation in the premium-ui call path |
| 5 | Exercise details | `NXP.exerciseDetails()` L1238; from the title, the anatomy lens, and plan rows | "Edit equipment note" / "Add equipment note" → `NXP.equipmentNote()` L1293 → `v88OpenNoteModal` (`cs:1849`, `idx:3644`); "Swap exercise" → `showSubstituteSheet()` | Equipment note via `v88OpenNoteModal` (not read in detail) |
| 6 | Workout queue | `NXP.queue(managing)` L1064; Train "All exercises" and the nav middle button | Rows `button.nxp-queue-row` → `NXP.chooseExercise(i)` (L1274); move ↑ and ↓ → `NXP.queueMove` (L1077); tools "Reorder" / "Done" (`NXP.queue(true)`), "Manage exercises" (`apx96OpenQueueManager()`, `cs:1848` → `idx:7843`); empty state: "Add exercise" (`v88OpenAddModal()`), "Restore programme" (`NXT.fullSession()`) | Order via `moveSessionExercise` (`idx:3577`) → `state.sessionPlans`. Selecting a row only changes `state.exercise` |
| 7 | Add exercise (add-on) | `NXP.addOnPick()` L1145 | Search `input.input.nxp-addon-search` (no id) → `NXP.addOnFilter` L1162; options `button.n99-list-row.nxp-addon-option` → `NXP.addOnAdd(name)` L1119 | `state.addOns[sessionKey]` (max two, L1106), `state.exercise`, `ui.trainActive`; then `persist()` and `render()` |
| 8 | Session options | `NXP.sessionMenu()` L1292; Train "Session options" | Rows: Session → `showSessionSheet()`; Gym → `closeModal();cycleGym()` (`idx:6430`); Equipment note → `NXP.equipmentNote()`; Recovery check-in (flag off); Shorter session → `NXT.shorter()` (`cs:1523`); Full session "Restore queue" → `NXT.fullSession()`; Finish workout → `NXT.finish()` | Via the engine calls listed |
| 9 | Session picker (today's session) | `showSessionSheet()` = `NXT.sessionPicker` (`cs:1798`, `cs:1533`) | Engine-owned | Engine-owned (not read) |
| 10 | Cardio log | `showCardioSheet()` = `NXT.cardioModal` (`cs:1800`, `cs:1538`) | Engine-owned | Engine-owned (cardio rows) |
| 11 | Recovery check-in | `apx96OpenReadiness()` = `NXT.recoveryModal` (`cs:1802`, `cs:1555`) | Engine-owned | Engine-owned |
| 12 | Quick weight (weigh-in) | `apx95OpenQuickWeight()` (`cs:1854` override of `idx:7702`) | Engine-owned; strata styles `st-qw-seg` and `st-qw-field` (`strata:772`, `strata:839`) | Engine-owned (weigh-in rows) |
| 13 | Set edit | `openEditSet(id)` (`idx:5578`), called from `NXP.editCurrentSet` L1275 and `NXP.editHistorySet` L2536 | Engine-owned | Engine-owned (`state.logs`) |
| 14 | Substitute | `showSubstituteSheet()` (`idx:3864`) | Engine-owned | Engine-owned (today's plan only, per the comment at L1238-1241) |
| 15 | Calorie guide | `NXT.openCalories()` (`cs:872`), from the gated Today block (L228) | Engine-owned | Engine-owned; dormant (`CALORIES_ENABLED` off) |
| 16 | Weight history | `NXT.openWeightHistory()` (`cs:1390`), from Progress "All weigh-ins" (L1387) | Engine-owned | Read-only list |
| 17 | Waist entry | `NXT.openWaist(date)` (`cs:1378`), from the Body waist list (gated) | Engine-owned | Engine-owned; effectively dormant |
| 18 | Import scans | `NXT.importScans()` (`cs:1424`), from Progress Body "Import from Strata" (L1757) | Engine-owned | Engine-owned |
| 19 | Weekly review | `NXT.openReview()` (`cs:899`); from Today "Why" (L209) and the confidence chip (L307) | "Your weekly review": `reviewCard()` (`cs:777`) and metrics | Read-only |
| 20 | Day sheet (History) | `NXP.historyDay(date)` L2530; from Train finished "View session" (`NXP.sessionSummary` L2538) and History "Edit sets" (L2344-2360) | Buttons `button.nxp-history-set` → `NXP.editHistorySet(i)` (L2536); "All day details & activities" → `NXP.otherDayDetails` (L2537) → legacy `base.historyDay` | Via `openEditSet`. Otherwise read-only |
| 21 | Routine exercise editor (steppers) | `NXP.routineEdit(i)` L1927 | Steppers (`output#st-es-sets`, `#st-es-lo`, `#st-es-hi`, `#st-es-inc`) → `NXP.routineStep(i,k,±1)` L1945; "Change exercise" → `NXP.routinePick(i)`; "Remove from routine" → `NXP.routineRemove(i)` L1955; "Done" → `closeModal()` | Draft in `ui.routine.rows` only. Saved only by `NXP.routineSave()` (L2003) |
| 22 | Routine exercise picker | `NXP.routinePick(i)` L1960 (add when `i<0`, change otherwise) | `input#st-pick-q` (`oninput NXP.routineFilter`) → `#st-pick-list`; `pickList()` L1964-1970 uses `v88AllExerciseNames()` (`idx:3606`), capped at 80; custom entry "Use '...'" → `NXP.routineChoose(name)` L1972 | Draft `ui.routine.rows` (max 15, L1980) |
| 23 | Day picker | `NXP.pickDay(d)` L1876; from Settings › Training day buttons (L1863) | Options `button.st-mrow.st-pick` → `NXP.setDay(d,ty)` L1880 | `settings.weeklyPlan` after `N.snapshot('Before weekly plan change')`; `cfg().previousWeeklyPlan`; `state.dayType` re-derived; `N.commit` |
| 24 | Native confirm dialogs (not sheets) | `routineBack` L1914; `routineDefault` L1923; `confirmNoSafetyCopy` L1999-2001; `removeScanPhotos` L2158 | Browser `confirm()` | Gates the discard, default, safety-copy, and scan-photo actions |
| 25 | Sheet drag-to-dismiss | strata `bindSheets` (`strata:706-745`) | Gesture on `#modalRoot .sheet` | Closes the sheet with `closeModal()` after 200 ms; no dirty check |

Pages that behave like forms (not sheets): Appearance (L2123-2132), Data & sync (L2166-2193), Routine editor (L1893-1911), and the inline set form on Train (L848-865). The Train set form has no id beyond `#nxp-set-form`, and writes through `NXT.logSet()` (`cs:1498`) via `NXP.logSet()` (L1279-1290). Floorball form ids `#apx96FbDuration`, `#apx96FbIntensity`, and `#apx96FbNotes` (L548) save through `apx96SaveFloorball()` (`idx:7860`).

---

## 4. Motion inventory (`strata.js`)

**Entry points from premium-ui.** None called directly (see Corrections). The integration points are:
- Render-global wrappers that call `hydrate(page)` after each paint: `renderHome`, `renderTrain`, `renderWeight`, `renderHistory`, `renderMore` (`strata:1001-1005`). premium assigns these at L2829-2831.
- `NXT.selectPoint` wrapper calling `progressTip()` and `weeksSync()` (`strata:1011-1013`).
- `NXT.repaint` on load (`strata:1041-1043`), which calls `render()`.
- Document-level listeners: pointer, click, input, and focus delegation (see the table).

**Entrance gate.** `hydrate()` (`strata:959-985`) computes `entering = state0.lastTab !== tab` (`strata:962`). It sets `data-st-tab` on the root (`strata:964`) and adds `.st-enter` to the page for 1,400 ms when entering (`strata:966-967`). `animatedKeys` (`strata:8`) is declared and unused.
- Repaints on the same tab keep `entering` false. Logging a set on Train, or saving a weigh-in on Progress, therefore does not replay count-ups, odometer draws, chart draws, or ledger draws.
- Switching tabs, or returning to a tab, replays them.
- Progress sub-tab switches keep `state.tab` as `weight`, so strata's entrance does not replay for them. The Training bars use premium's own flag `N.ui.actAnim` (L1603-1604).

**Reduced-motion gate.** `reduced()` (`strata:9-14`) is true when `data-nxp-motion="reduced"` (set by `applyAppearance()`, L44-47, from `cfg().appearance.motion`) or when the OS asks for reduced motion. The Appearance copy says reduce motion "removes page and set-logging animation" (L2127-2128). CSS-only animations were not inspected, so whether all of them honour the attribute is not verified.

| # | Pattern | Trigger | Timing and easing | Reduced-motion path | Owner (line) |
|---|---|---|---|---|---|
| 1 | Rolling digits (odometer) | `odoSet()` on `[data-st-odo]` (weight mini, L~317) and the hydrate loop | 70 ms stagger per digit, CSS transition | `textContent` only, no strips (`strata:30-31`) | `strata:22-57` |
| 2 | Count-up | `[data-st-count]`, only when entering (Finish card Beat/Matched/Below, L697-701) | 700 ms, cubic ease-out, rAF | Immediate value (`strata:59-60`) | `strata:58-70` |
| 3 | Hero trend draw-in | `drawHero()` (dead; see 7-A) | CSS `.st-hc.is-draw` | Not drawn | `strata:94-207` |
| 4 | Hero replay and scrub (dead) | Dead with the hero | 6,500 ms, quadratic in-out | Jumps to last point, clears after 600 ms (`strata:~196`) | `strata:186-207` |
| 5 | Progress chart replay | `button.st-replay[data-st-chart-replay]` | 6,500 ms, in-out, rAF; reveal via `#vn-chart-clip-r` width | Jumps to last point with `clear` (`strata:533`) | `strata:525-548` |
| 6 | Chart tooltip and scan column | Each `NXT.selectPoint` | Position only; tooltip hides 1,400 ms after pointerup on `#vn-chart-wrap` | n/a | `strata:494-516`, `strata:1023-1026` |
| 7 | Weekly ledger draw-in | `dressWeeks()` when entering | CSS `is-draw` | `!reduced()` required (`strata:348`) | `strata:313-391` |
| 8 | Week row to chart jump | Click or Enter on a week row | `scrollIntoView` smooth, or auto when reduced | `behavior: reduced() ? "auto" : "smooth"` (`strata:386`) | `strata:371-386` |
| 9 | Composition map draw-in | `drawCompMap()` when entering | CSS `is-draw` on `svg.st-cmap` | `!reduced()` required (`strata:561`) | `strata:550-579` |
| 10 | Decision value roll-up | Scroll-in of `[data-st-view]` (decision tile) | 900 ms, quartic ease-out, from 0 | Skipped (`strata:908`) | `strata:906-921` |
| 11 | Scroll-in reveal | IntersectionObserver, threshold 0.28, rootMargin -6%. `[data-st-view]` gets `is-in st-play`; below-fold `.st-bento>*` get `.st-rv` then `.st-rv-in` | Observer-driven, CSS transition | No observer; everything marked `is-in` at once (`strata:925-926`) | `strata:897-938` |
| 12 | Page entrance | Entering a tab | `.st-enter` for 1,400 ms | Not added when reduced (`strata:966`) | `strata:966-967` |
| 13 | Tap ripple | `pointerdown` on `.st-tile, .st-qa, .st-cta, .st-chip, .st-plan-row, .st-dec-chip` | Span appended, removed after 650 ms | Skipped when reduced (`strata:946`) | `strata:944-958` |
| 14 | Press feedback (D44) | `pointerdown` on `PRESS` selector (buttons, `[role=button]`, `summary`, `a[href]`, `.st-tile[onclick]`, `.st-wk`) | Down: WAAPI `scale` 110 ms to depth (0.92 to 0.985, `pressDepth` L828). Up: 440 ms with `SPRING_BACK` `linear()` curve | Off when reduced; excluded: stepper rows, chart wrap, quick-weight field (`strata:834-846`) | `strata:825-846` |
| 15 | Sliding segmented pill (D44) | `pointerdown` capture on `SEGS` controls; repaint resumes mid-slide | 340 ms, cubic ease-out; `i.st-seg-pill` | Jumps to target when reduced; resize clears memory | `strata:772-824` |
| 16 | Stepper hold-to-repeat (strata) | `pointerdown` on `#trainPage .nxp-step` | 450 ms delay, 160 ms interval, 90 ms after 10 ticks; repeats via `btn.click()` | Not reduced-aware | `strata:633-652` |
| 17 | Stepper hold-to-repeat (premium) | `pointerdown` on `.nxp-step` | 420 ms delay, 110 ms interval (`HOLD_DELAY`, `HOLD_EVERY`), L2550 | Not reduced-aware | premium L2575-2586. Duplicate of 16 (section 7, C) |
| 18 | Stepper bump | Input change from a stepper | `st-bump-up` or `st-bump-dn` for 260 ms | Skipped when reduced (`strata:695`) | `strata:690-705` |
| 19 | Train exercise swipe | Horizontal drag on `.st-ex` | Live `translateX(dx * .35)`; over 60 px calls `NXP.goExercise(±1)`; over 30 px vertical cancels | No live translate when reduced (`strata:666`) | `strata:653-683` |
| 20 | Train count tick | `.st-tr-count b` | `st-tick` class | n/a | Dead selector (`strata:676-682`) |
| 21 | Sheet drag-to-dismiss | Drag from the grip or from the sheet's top | Over 120 px, or over 40 px with a fast flick, slides to `translateY(110%)`, then `closeModal()` after 200 ms | Not reduced-aware | `strata:706-745` |
| 22 | History calendar swipe | Horizontal drag on `.nxp-cal-grid` | `translateX(±70 px)` while dragging; commits at 56 px via `NXP.historyShiftMonth`; `is-settling` snap-back 260 ms | No transform when reduced (`strata:870`) | `strata:854-896` |
| 23 | Spotlight | Mouse `pointermove` over `.st-tile` | Sets `--mx` and `--my` (no transition) | No reduced check | `strata:587-598` |
| 24 | Parallax | Scroll | Sets `--st-sy` via rAF | Off when reduced (`strata:~941`) | `strata:939-943` |
| 25 | Tab dock indicator | `hydrate()` and init | `--tab-i`, `--tab-n` on `.tabs-inner`; class `st-dock` | n/a | `strata:580-586` |
| 26 | Glyph to icon rewrite | Install and every DOM insertion (body-wide MutationObserver) | Replaces single-glyph `›‹+−×tick↑↓` with SVG strokes | n/a | `strata:747-771`, `strata:847-853` |
| 27 | Fold toggles | "Show N older lifts" (`foldPerf`); Body sections (`foldBody`, `bodyOpen` memory) | Class toggle, `aria-expanded` | n/a | `strata:404-420`, `strata:474-493` |
| 28 | Train fit | Train render and resize | Min-height on `.st-train-active` | n/a | `strata:599-608` |
| 29 | Resize repaint | Debounced 150 ms `window` resize | Redraws `[data-st-cmap]`, `fitTrain`; redraws `[data-st-hero]` (dead) | n/a | `strata:1027-1034` |

Motion hooks that stay in premium-ui: `is-forward` and `is-back` on `.st-ex` only when the exercise changes (L754-758); `is-just-logged` and the 1,200 ms confirmation reset (`scheduleConfirmReset` L971-982, called at L918); `st-flash` on inputs for 600 ms (L960-961); `vn-enter` retrigger on the history day (L2422-2432); `st-slide-n` and `st-slide-p` on the grid (L2510); `apx96TickTimer` wrapper repainting the rest strip each tick (L2833-2841).

---

## 5. Coaching surfaces

Every place where coaching or interpretive text is rendered. "Act" is what the user can do with it. None of these surfaces can be dismissed, except where a `details` element can be collapsed.

| # | Surface | Where (line) | Engine source | Dismiss or act |
|---|---|---|---|---|
| 1 | Today decision headline and support | Title L208-212 (`h2#vn-dec-h`), support line | `review()` (`cs:276`): `title`, `message`, `reason`, `tone` | "Why" → `NXT.openReview()` (`cs:899`); chips open Progress or the weekly review. No dismiss |
| 2 | Today decision evidence | `decEvidenceHTML()` L277-308: trend kg/wk, confidence level | `N.detectPlateau` (`cs:211`); `N.trend` (`cs:122`) | Trend chip → Progress; confidence chip → weekly review |
| 3 | Today suggestion log | L132 `N.logSuggestion(...)` on each Today render, deduplicated | `logSuggestion` (`cs:587`) | No UI. Writes state (section 7, D) |
| 4 | Train coach line | `details.st-coachline` L806-812: headline, pill, note | `N.coachFor(ex)` (`cs:654-686`): e.g. "First session on this lift", "Back after N days" | Expand "Why" only. Pill text map L803-805 (rep, ease in, stall, easy day, rebuild, hold, baseline) |
| 5 | Train target rows | `li.st-lrow.is-next` L833-838 | `N.coachFor(ex).sets` | Tap → `NXP.useTarget(k)` fills the fields. Nothing is logged |
| 6 | Train aim | `button.st-ref.is-aim` L895 | `N.aimFor(ex)` (`cs:641`) | Tap → `NXP.useAim()` fills the fields |
| 7 | Set verdicts | `loggedRow` L838-847; `cmpBest` L791-797 ("Beat last time", "Matched", "Logged") | Rule D20 in premium, not an engine call | Tap a row → `NXP.editCurrentSet(i)` |
| 8 | Recovery guidance (idle) | `trainGuidanceHTML()` L467-471, `aside.nxp-train-rec` | `currentTraining(currentIntegrated())` (L411-441) → `wearables.trainingReadiness.advise` | Shown only for a non-trivial state. No dismiss |
| 9 | Recovery guidance (active) | `trainAlertHTML()` L984-991, `aside.nxp-train-alert` | Same as 8 | Same as 8 |
| 10 | Upcoming session "best last time" | `upNextHTML()` L512-533 | `N.templateFor`, `N.sessionRows`, `N.bestSet` | Read-only |
| 11 | Live "vs best last time" line | strata `syncVs()` (`strata:609-632`): "+X kg on your best last time", "Below your best last time" | Read from DOM only | **Dead**: selectors `.st-refs` and `.st-refc` match no markup |
| 12 | Finish highlights | `sessionMoments()` L657-685: "New best · X kg × N", "Workout N logged", "N weeks in a row hitting your lifting days" | Presentation-derived from `N.workRows`, `settings.weeklyPlan` (section 7, D) | Read-only |
| 13 | Finish outcome | `sessionOutcomeHTML()` L691-713: Beat, Matched, Below counts and "Best set vs last session" | `N.sessionRows`, `N.bestSet` | Read-only |
| 14 | Finish actions | L782-783 | `NXP.sessionSummary` (L2538), `NXT.resume` (`cs:1522`) | "View session", "Resume workout", "Workout queue" |
| 15 | Weight highlights | `weightHighlights()` L1297-1313 → `weightHighlightsHTML()` L1350-1352: "Lowest weigh-in yet · X kg", "N weeks of falling averages in a row" | Presentation-derived from `N.weights`, `N.weekStart` | Read-only |
| 16 | Down so far | `downSoFarHTML()` L1315-1325: "X kg down · Y kg to your goal range" | `N.detectPlateau` lastAvg, `goalHigh()` (`idx:6083`) | Read-only; only when goal confirmed |
| 17 | Slow-week sentence | `slowWeekHTML()` L1334-1342 | `N.detectPlateau`, `weeklyAvgs()` | Read-only |
| 18 | Chart headline and read line | `h2#vn-traj-headline` and `p#vn-traj-read` (`cs:1247-1251`); `trajectoryHeadline()` (`cs:1080`), `trendReadText()` (`cs:961`) | Engine | Read-only. Strata hides the read line if it says "no plateau detected." (`strata:302-303`) |
| 19 | Progress diagnosis card | `diagnosisCard()` (`cs:782-834`), `section.n99-card.n99-review.n99-diagnosis`, in "Why NXTFRM says this" (`cs:1309`) | `diagnose()` (`cs:376`) | Collapsible `details` only |
| 20 | Weekly review sheet | `reviewCard()` (`cs:777`) inside `NXT.openReview()` (`cs:899`) | Engine | Opened by Today "Why" and confidence chip |
| 21 | Cut journey | `journeyHTML()` (`cs:1089-1105`): "Down X kg", "To goal range", rail | Engine | Read-only |
| 22 | Evidence card | `evidenceHTML()` (`cs:1128`) | Engine | Not read in detail |
| 23 | Range read | `div.st-rread` (`cs:1240-1246`): trend change, lowest, weighed share | Engine | Read-only |
| 24 | Performance pills and read sentences | `statusRead()` L1419-1429: "Down on both of the latest two sessions", "Down on this comparison, not repeated yet", "Up across the last four sessions", "Within the steady band"; pill `title` | `strengthItems()` (`cs:259`) | Read-only |
| 25 | Performance intro | `performanceIntro()` L1504-1518: fixed text with "21-day window" and "Four sessions" | Fixed copy (section 7, F) | Read-only |
| 26 | Performance caution note | `PERF_NOTE` L1402: "Estimated 1RM is a comparison aid, not a tested maximum..." | Fixed copy | Read-only |
| 27 | Training headline and consistency | `activityHeadline()` L1585-1591; `consHead` L1606-1608 ("N of N full weeks reached the plan"); "How to read this" L1645-1648 | `N.activityWeeks`, `N.activitySummary` | Read-only |
| 28 | Body summary and delta | `bodySummary()` L1699-1722; compMap read L1746-1747; explanatory note L1748 ("Scan estimates move with hydration...") | Scan data | Read-only |
| 29 | Week recap | strata `dressRecap()` (`strata:420-456`): "Your week", lifting count, cardio minutes, weight average and change, "New best" flags | Presentation-derived (section 7, D) | Read-only |
| 30 | Week ledger sentences | strata `dressWeeks()` aria-labels (`strata:357-365`) | `N.windowStats` | Read-only |
| 31 | Cloud state | `cloudSignal()` L1832-1843: "Not backed up", "Sign-in needed", "Sync error" | `lastCloudError`, `cloudUser`, `localStorage` | Row tap → Data page. Banner dismissal stored in `localStorage` key `nxtfrm_cloud_banner_dismissed` (L1837) |
| 32 | Storage state | `storageStatus()` L1778-1807: "Getting full · export a backup", "over a month ago" | `localStorage` size, `N.cfg().backupExportRequestedAt` | Row tap → Data page |
| 33 | Empty-state coaching | "Building your baseline" (`cs:276` base), chart empty block (`cs:1177-1185`) | Engine | Read-only |

---

## 6. Component reuse

### 6.1 Shared helpers (JavaScript)

- Shell and rows: `shell()` (L41, `div.n99.nxp`); `row()` (L42, `button.nxp-setting`, used in the body and Progress branches); `setRow()` (L1813, `button.vn-set-row`); `setGroup()` (L1819); `settingsHead()` (L1822, `header.vn-set-head`); `setField()` (L2106, `div.vn-set-field` with `div.vn-seg`); `setIcon()` (L1809).
- Buttons: `textAct()` (L131, `button.vn-text`); `idleSecondary()` (L504, `button.n99-text`); `button()` = `N.button` (`cs:773`), used across sheets and idle actions.
- Chips and pills: `decEvidenceHTML()` (L277, `div.st-dec-ev`); `statusFlag()` (L1409), `statusRead()` (L1419), `deltaText()` (L1431); `wx-chip` in `bodyTileHTML` (L~386) and strata ledger (`strata:364`).
- Meters: `ringHTML()` (L240, `span.st-count`); `cardioMeterHTML()` (L535, `div.st-cmeter`); `restRail()` (L649, `div.nxp-rest-rail`); `muscleMapHTML()` (L576, `section.st-mm`, `.st-mchip`); `bleedHTML()` (L564, `button.st-ex-fig.is-lens`).
- Inputs: `stepper()` (L638, `div.nxp-stepper`, `button.nxp-step`).
- Headers: `trainChrome()` (L499, `header.nxp-train-chrome.st-head`).
- Lists: `momentsHTML()` (L687, `ul.st-moments`); `weightHighlightsHTML()` (L1350, `ul.st-wchips`).
- Sparks: `sparkModel()` (L1438), `sparkText()` (L1446), `endMark()` (L1450).
- Calendar: `historyCalendar()` (L2314).
- Icons: `SET_ICONS` (L1793-1809) with `setIcon()`; the `ico` dictionary in `trainMenu()` (L929-938); the strata `ICONS` table (`strata:747-751`) and `iconify()` (`strata:753-771`).
- Engine-emitted: `N.button` (`cs:773`), `N.metric` (`cs:776`, `div.n99-metric`), `N.modal` (`cs:768`), `N.chartHTML` (`cs:1164`), `N.diagnosisCard` (`cs:782`), `N.reviewCard` (`cs:777`).

### 6.2 Shared CSS class families (as used by the JS)

- **Tiles.** `.st-tile` with modifiers `.st-mini`, `.st-t-train`, `.st-t-dec`, `.st-t-body`, `.st-compmap`, `.st-ready`, `.st-next`, `.st-done`, `.st-recap`, `.st-cmeter`. Dead modifiers: `.st-hero`, `.st-t-avg`, `.st-t-cal`. Headings: `.st-tile-head`, `.st-cat` (eyebrow), `.st-h2`, `.st-h3`, `.st-meta`, `.st-body`.
- **Pills and chips.** `.st-pill` (+ `.is-up`), `.st-perf-pill` / `.vn-perf-flag`, `.st-chip` (gym switch), `.st-dec-chip`, `.wx-chip` (`is-up`, `is-dn`, `is-down`, `is-watch`, `is-none`), `.st-coach-pill`, `.st-mchip`, `.st-pillg` (SVG pills in strata and the engine chart), `.vn-set-flag`.
- **Capsule buttons (D56).** Primary `.st-cta`; glass `.st-ghost`, `.st-link`, `.st-replay`, `.st-qa`; round `.st-icon`; `.st-tfinish`, `.st-complete-b`, `.st-save`, `.st-diff`, `.st-row-btn`; `.nxp-addon-add`, `.st-rx-add`, `.st-rx-reset`; `.vn-set-act`, `.vn-set-text`, `.vn-text`; engine `.n99-button` and `.n99-text`.
- **Segmented controls.** Five variants: `.vn-seg` (engine chart range, activity range, `setField`), `.n99-segments`, `.n99-progress-tabs` (Progress tabs), `.nxp-seg` (set type), `.vn-hist-filters` / `.nxp-history-filters` (History filter), and `.st-gymseg` (Settings gym, not in the strata sliding-pill list). `.vn-seg-opt` is the option class.
- **Strips and rails.** `.st-segbar` (Train), `.st-range-row`, `.n99-session-rail` (Zone 2 pace), `.nxp-rest-rail`, `.st-cmeter-bar`, `.st-count-bar`, `.st-mini-bar`.
- **Day strips.** `.vn-week` / `.vn-week-c` (Today rail), `.st-week7` / `.st-wd` (Settings week), `.nxp-cal-grid` (History). `.st-cal` is the dead Today calendar.
- **Numerals.** `.vn-num` (tabular figures, everywhere); `.st-odo` / `.st-odo-sm` / `.st-od` (rolling digits); `.st-big` (dead hero); `.st-mini-v`, `.st-count-v`, `.st-scan-c b`, `.vn-metric-v` / `.vn-metric-l` (chart readout), `.st-wk-v`, `.wx-v`, `.nxp-aim-cell b`. Unit markup varies: `<em>kg</em>` (chart readout, `wx-v`), `<small> kg</small>` (ring, hero), and plain text (History). See section 7, F.
- **Rows.** `.vn-row` (Today and Progress), `.nxp-setting` (`row()`), `.vn-set-row` (`setRow()`), `.n99-list-row` (add-on, body), `.st-mrow` (sheet rows), `.st-rt` (routine card), `.st-rx` (routine exercise), `.st-plan-row` (Train plan), `.st-lrow` (set ledger), `.nxp-queue-row`, `.nxp-addon-row`, `.nxp-history-set`, `.nxp-history-ex`.
- **Headers.** `.st-head` (Today and Train chrome), `.nxp-heading` with `.vn-progress-chrome` / `.nxp-progress-chrome` (Progress), `.nxp-history-chrome` (History), `.vn-set-head` (Settings).

### 6.3 Where screens hand-roll markup instead of reusing a helper

- **Today header** (L170-177) is built inline, not through `trainChrome()`.
- **Today tiles** are all hand-built; there is no tile helper. The Lifts mini is written twice (L195, L201).
- **Progress header** is repeated in four branches (L1359, and each branch at L1363, L1374, L1382, L1387) rather than shared. The weight branch uses a `chrome` variable; the others inline it.
- **Train idle screens** each rebuild `section.nxp-train-idle-copy` (L540, L544, L548, L555). The Zone 2 pace markup (L544) differs from `cardioMeterHTML()` (L535) for the same figure.
- **Routine editor steppers** (L1936-1941) are hand-built `.st-es` rows rather than `stepper()`. The set-type control (L862-865) is hand-built rather than `setField()`.
- **Icons** are inline SVG at each use: `check` (L115), `ico` (L929-938), `SET_ICONS` (L1793-1809), `ARW` (L381-383), and the back chevron in `subviewChrome()` (L2094).
- **Settings rows** use two helpers: `row()` (L42) and `setRow()` (L1813). The hub uses `setRow()`; Body and Progress use `row()`.
- **Sheet rows** shadow `row()`: trainMenu (L934) and queueRows (L1055) each define a local `row` with a different signature.
- **Text links** use `textAct()` (L131), `idleSecondary()` (L504), and `button.st-link`.

---

## 7. Smells (facts, with line numbers)

### A. Dead or unreachable code

- Unreferenced in `premium-ui.js` (only the definition matches): `heroTileHTML` L244-276; `weeklyTileHTML` L338-357; `calendarTileHTML` L358-378; `linkSignal` L398-399; `loadLine` L623; `aimCell` L627-636; `syncLatestControl` L1389-1395; `arrangeWeightView` L1397-1400 (no-op); `arrangeStrengthView` L1679-1681 (no-op).
- `setRir` L1001-1007 is exported (L2809) but has no caller. Its target, the hidden `#n99-rir` input (L858), is still rendered.
- Test-only: `anatomyStrip` L1222-1236 and `sessionFocus` L1090-1107 are referenced only by source-string assertions in `wearables.train-enrichment.test.js` (lines 171-199).
- Unused local: `const dots` at L814 in `training()` is never interpolated.
- `strata.js`: `state0.animatedKeys` (`strata:8`) is never used. `wrap()` (`strata:986-996`) is never called; `install()` writes the wrappers inline (`strata:1001-1005`). The first `dressWeeks` variant (`strata:346-351`) is overwritten (`strata:353`, `strata:368`). The whole hero path `drawHero()` (`strata:94-207`) and `[data-st-hero]` handling are unreachable because `heroTileHTML` is never rendered. `syncVs()` (`strata:609-632`) and its listeners (`strata:692`, `strata:1022`) match no markup.
- Missing-selector code in premium-ui: `.nxp-set-row.is-fresh` and `.st-chip2.is-fresh` (L978) match nothing. `#trainPage .vn-rest.is-active` in `keepRestClear()` (L2690-2692) never matches because the rest strip has classes `nxp-rest st-rest` (L904), so the function returns at once. `#nxp-progress-latest` (L1390 and the hook at L2822) is never rendered.
- Swallowed undefined call: `apx96StopRest()` (L1142) is not defined anywhere in the repo. The `try {} catch (e) {}` hides the ReferenceError when the last add-on is removed.
- The recap anchor: strata `dressRecap()` looks for the text "NXTFRM decision" (`strata:471`), which no markup contains. The recap therefore always appends to the end of the grid instead of before the decision card.

### B. Dormant feature gates (all flags off: `cs:327`, `cs:331`)

- Today: check-in quick action L221; the whole "More for today" block L224-231 (`recoveryHomeCard`, calorie guide, `N.adherenceHTML`).
- Train idle: check-in buttons L540 and L544.
- Train options copy L953 (checkin branch); Session options "Recovery" row L1292.
- Progress: energy estimate L1387 (`N.features && N.features.calories`).
- Progress Body: waist list and "Log waist" gated by `N.features.waist` (L1757). But `bodySummary()` (L1699-1722) still shows any saved waist reading, so the flag is applied inconsistently.
- Settings hub: "Goals & calories" branch L2053; "Cardio & recovery" label L2055; "Reminders" L2059; "Wearable" L2065; "Classic app" L2068.
- Dormant by proxy: `openRecovery()` L473, `recoveryHomeCard()` L458, `openWearableConnection()` L452 (and its `connectLive` call on open, L453-455).
- Floorball: `pickTypes` drops Floorball unless the flag is on (`cs:43`), so Floorball days come only from existing schedules. The Floorball UI stays live for existing data (`trainFloorball` L546-553; History floorball rows L2361-2375). The calendar's floorball marks are dead (`historyMarks` L2281 hard-codes `floorball:false`; branches L2334-2338 never run).
- Redundant checks: `N.features && N.features.calories` (L228, L1387, L2053) repeats the object check.

### C. Duplicated logic and markup

- The "best set vs last session" comparison appears in at least five places: `liftOutcome()` L324-336, `sessionMoments()` best loop L659-670, `sessionOutcomeHTML()` L693-704, the best lookup in `trainLiftIdle()` L588-589, and strata `dressRecap()` (`strata:434-446`). `cmpBest()` (L791-797) and `performanceBest()` (L1466-1470) are two more copies. All use the same D20 rule.
- Recovery guidance has two renderers: `trainGuidanceHTML()` L467-471 (`aside.nxp-train-rec`) and `trainAlertHTML()` L984-991 (`aside.nxp-train-alert`), nearly identical.
- Cardio this week is drawn four ways: Today mini (L182-186), Train rest meter (L535-537), Zone 2 pace (L544), and the Settings cardio row (L2055).
- Lifting days this week appear in the train-tile header (L130), the Lifts mini (L187-205), the dead calendar tile (L358), and the Settings training row (L2054).
- Trend precision differs by surface: Today mini and odometer at one decimal (L~317, `strata:150`); History weigh-in at two decimals (L2383); chart readout at two decimals (`cs:1258`); chart tooltip at two decimals (`strata:500`).
- Weekly averages are computed three ways: `weeklyAvgs()` (L1326-1332, Mon-Sun with at least three readings), `dressWeeks()` (`strata:317-327`), and `dressRecap()` (`strata:441-446`). `weeklyTileHTML()` (L338, dead) is a fourth.
- Week bands are drawn three ways: `drawHero()` (`strata:115-118`, dead), `dressProgress()` (`strata:282-292`), and the engine's `bandFill` (`cs:1198-1208`).
- Week day strips: `.vn-week` (Today), `.st-wd` / `.st-week7` (Settings), `.st-cal` (dead).
- Hard-coded gym names: `gyms()` L1854 (`'Gym A'`, `'Gym B'`); `routineGym()` default L1855; `r.gym || 'Gym A'` in the day sheet (L2534) and `liftOutcome` (L325).
- Month-name arrays are hard-coded in strata `dressWeeks()` (`strata:336` and `strata:355`) and in premium `historyCalendar()` (L2339).
- Layout constants are duplicated: `actBars` W=420, L=26, R=8 (L1551) and `actScrub` (L1667-1668).
- Hold-to-repeat is bound twice. premium `holdStart()` (L2575-2586, constants L2550) and strata `bindHold()` (`strata:633-652`) both listen for `pointerdown` on `.nxp-step`. Strata's tick calls `btn.click()`, and premium's click handler (L2768-2779) steps again when `event.detail === 0`. A long press may therefore run two repeat loops. This is inferred from the code and was not tested in a browser.
- `NXT.selectPoint` is wrapped twice: premium `hookProgressSelect()` (L2811-2827) and strata (`strata:1011-1013`). Engine functions `apx96TickTimer`, `apx96StartRest`, `startWorkoutNow`, `NXT.resume`, and `updateCloudLocalBanner` are monkey-patched at load (L2833-2880).
- Two functions named `syncDock`: premium L2706 (keyboard dock) and strata L580 (tab dock). They sit in separate IIFEs but read alike.
- Three `row` helpers: L42 `row(title, value, action, sub)`, trainMenu local `row` (L934), and queueRows local `row` (L1055).
- Two icon systems: `SET_ICONS` (L1793-1809) and the trainMenu `ico` dictionary (L929-938), plus strata's glyph rewrite (`strata:747-771`).
- `SET_ICONS` has two keys per icon: 'Goals' and 'Goals & calories' (L1794-1795), 'Cardio & recovery' and 'Cardio' (L1799-1800).

### D. Side effects inside render and in presentation code

- `home()` calls `N.logSuggestion({kind:"review",...})` (L132) on every Today render. `logSuggestion` (`cs:587-600`) pushes a row onto `cfg().suggestions` unless it duplicates the last row. This writes state during render.
- `currentIntegrated()` (L411-430) calls `sync.integrateToday` (L415-417) on every Today and Train render.
- `openWearableConnection()` (L452-457) calls `sync.connectLive(...)` when the sheet opens.
- `testConnection()` (L2222-2262) makes direct `fetch` calls to the Supabase project from presentation code (L2228-2236) and creates a Supabase client through `initSupabaseClient()` (`idx:5362`, called around L2255).
- Presentation code writes stored settings directly: `saveName` (L66-69 → `settings.name`); `saveAppearance` (L2132 → `cfg().appearance`); `setDay` (L1880-1887 → `settings.weeklyPlan`, `cfg().previousWeeklyPlan`); `routineSave` (L2003-2014 → `cfg().templates`); `saveTodayToRoutine` (L2019-2025 → `cfg().templates`); `addOnAdd` (L1119-1133 → `state.addOns`); `removeScanPhotos` (L2154-2164 → `state.scans[].image`); `exportBackup` (L2194 → `cfg().backupExportRequestedAt`).
- `removeScanPhotos()` runs `N.snapshot` after `N.commit` (L2160-2161); the comment says it replaces the old recovery copy.
- `dataView()` rewrites legacy HTML string output at render time (L2167).

### E. Inline styles and hard-coded colours

- premium-ui.js has 50 `style="` attributes. Examples: L135, L148, L182, L185 (inline `width:%`), L195, L201, L208, L219-221 (per-hue `--c` values), L242 (`--rc` and `width`), and L1750-1751 (`style="color:var(--st-fat)"` and `var(--st-lean)`).
- Hard-coded hex in premium-ui.js: `SET_ICONS` L1793-1809 holds at least 14 hex literals. `#8B5CF6` is used for three different rows (L1794, L1795, L1809).
- strata.js hard-codes gradient and stroke colours outside CSS tokens: `#9B7BFF`, `#7C5CFF`, `#B49AFF`, `#F3EEFF` (`strata:125-126`), the same set again (`strata:213`), `#B49AFF` (`strata:274`), and `#CDBBFF` (`strata:277`).
- strata.js has six `style="` attributes built as SVG and HTML strings.

### F. Copy inconsistencies

- Cardio naming: History filter "Cardio" (L2264); History block label "Conditioning" (L2361, L2371, L2399); Settings "Cardio & recovery" / "Cardio" (L2055); Today "Cardio" (L183).
- Floorball: the input is labelled "Intensity 1-10" and the history line says "RPE" on the same line (L548).
- Restore wording: "Restore programme" (L555, L1069), "Restore queue" (L1292), "Restore default exercises" (L1909). "Programme" also appears in other copy.
- Add-exercise wording: "Add optional lifting" (L161, Today row), "+ Add exercise" (L1192), "Add a lift if you feel like doing a little more." (L1181).
- Zone 2 copy: "An easy, conversational effort." (L151) and "Zone 2 — a conversational effort." (L544).
- Trend chart labels: "Vs trend" (D41 vocabulary); "Each day vs its trend" (`strata:237`); "Above trend" and "Below trend" (`strata:277`).
- "Estimated 1RM" (L1402, L1448) and "e1RM" (L1492) are both visible.
- "Import from Strata" (L1757): "Strata" is also this redesign's name (D19, `strata.js`), which is ambiguous in user copy.
- Footer "NXTFRM · your next form" (L2070) is unclear.
- Mixed apostrophes: "Today's focus" (L1096, dead) and "Today’s focus" (L612); "This week’s average" (L1336).
- The Supabase table name `apexcut_profiles` (L2254) is a legacy product name in a live query path.
- Thresholds in fixed copy: "21-day window" and "Four sessions" (L1507-1512) must be kept in step with `strengthItems()` (`cs:259`) by hand.

### G. Accessibility

- `role="application"` on the engine chart wrapper (`cs:1273`) and on the activity bar wrappers (L1626-1628). It is needed for the keyboard handlers, but it overrides browse mode for the whole region.
- `role="grid"` on the History calendar (L2339), with `button` children and `aria-pressed` (L2326-2327), not the grid or gridcell pattern.
- `role="img"` on `[data-st-chart]` wraps a focusable SVG (`strata:123`). Children of an img role should be presentational. The hero path is dead, so this is latent.
- Odometer: `aria-label` on a generic span (`strata:30`), and the digit strips have no `aria-hidden` (`strata:22-26`). Screen readers may not announce the label reliably.
- `h2` given `role=button` and `tabIndex` in `foldBody()` (`strata:408-409`). Works, but loses heading semantics.
- Sheet drag-to-dismiss (`strata:706-745`) closes without a check for unsaved input. The Name sheet's field (L63-65) is one example.
- Four native `confirm()` dialogs (L1914, L1923, L1999-2001, L2158) sit beside in-app sheets for other confirmations.
- Live regions: `#vn-mhead` (`cs:1253`), `#st-act-read` (L1615), `section.st-complete` (L~874, polite), `p#st-vs` role=status (`strata:~606`, dead).

### H. Structure and maintenance

- `premium-ui.js` is one 2,880-line IIFE with about 240 `function` declarations. Five ID and class prefix generations are in use: `apx95`, `apx96`, `v88`, `vn-`, `st-`, `nxp-`, `n99-`.
- Live IDs with legacy prefixes: `#apx96FbDuration`, `#apx96FbIntensity`, `#apx96FbNotes` (L548), `#apx96TimerValue` (L905).
- String-level HTML patching: `withGoalDate()` regex (L1344-1348); `.replace('<div class="vn-mhead"', ...)` (L1387); `cloudCardHTML()` replacements (L2168); strata's match on "no plateau detected." (`strata:302-303`); `hookProgressSelect()` rewriting the readout after selection (L2813-2822).
- Presentation code computes new figures, despite the file headers. `sessionMoments()` (L657-685: streak, workout count, best sets); `weightHighlights()` (L1297-1313); `downSoFarHTML()` (L1315-1325); `slowWeekHTML()` (L1334-1342); `activityHeadline()` (L1585-1591); strata `dressRecap()` (`strata:420-456`: weekly totals, planned count, beat flags, weight delta); strata `dressWeeks()` (`strata:313-391`: min and max, change chips). `strata.js` says it "computes no statistic" (`strata:1-4`). premium says "Numbers are rendered, never re-derived" (L~635).
- `bodySummary()` is called with two arguments (L1366 and L1368) and takes one (L1699).
- Inline `onclick` strings set view state (`NXT.ui.view='overview'`, `NXT.ui.view='strength'`, `NXT.ui.view='body'`) at L179, L214, L~305, L~338, L~350, L~438. Duplicated and fragile.
- Non-deterministic IDs: `Math.random()` in `uid` (`strata:107`), the gradient id in `decEvidenceHTML` (L~298), and `linkFieldLabels()` (L2137-2148). They change on every render.

### I. Other

- `previewAllowed()` (L399-406) enables a recovery preview on localhost or `file:` and feeds `NXT.recoveryPreview` (L407-410, set by `setRecoveryPreview` L487). This is a development hook inside shipped code.
- `index.html` loads `seed.dev.js` unconditionally (`idx:7967`). Whether the file gates itself was not checked.
- `openBodyCapture()` (L1761-1770) navigates to the Settings body page. The comment says the form is not painted there; this is intended.
- The `routineEdit` steppers call `routineView()` on every step (L1950), rewriting `#morePage` while the sheet is open.

