# cut-support.js: read-only engine inventory

Branch `ascension`. Generated 2026-10-13. Read-only: no source file was edited, no git state was changed, the app was not run. This file is the only thing written.

Target: `/Users/alidanial/Documents/NXTFRM/cut-support.js`, 2,237 lines, 182,714 bytes, `"use strict"` at line 2. `node --check cut-support.js` passes (syntax only; the file was not executed).

Line numbers below are the file's own (`nl -ba`). Where a name is used by another file, the table says so.

---

## 0. Scope, method, load order

### 0.1 Method and limits

- Read the whole file in 200-line chunks, top to bottom.
- `index.html` was touched only as the brief allowed: `grep -n` for `dayOverrides`, `weeklyPlan`, `persist`, `setMinimumWorkoutMode`, `ensureSessionPlan`, `applyCloudPayload`, `resolveDayType`, `dayTypeFor`, `planFor`, and ±40-line windows around each named function. `dayTypeFor` and `planFor` do not exist in `index.html` (no match). `resolveDayType` (index.html 2750) is the function the engine delegates to in `typeFor()` (L572), so it was read too; that goes beyond the list in the brief.
- Other `index.html` names (`sessionKey`, `goalLow`, `goalHigh`, `TEMPLATES`, `START_WEIGHT`, `template`, the override target definitions) were located by one-line `grep -n` only, to establish storage keys and what gets overridden.
- `premium-ui.js`, `strata.js`, `wearables*.js` were grepped for consumers, overrides and writers. The `classic/` folder was excluded from consumer analysis. It holds an older copy, `classic/cut-support.js` (1,829 lines, differs from the root file), and is not loaded by root `index.html`.
- Usage counts: `ext` = `NXT.x` in other root `.js`/`.html` files, plus `N.x` in `premium-ui.js` and `strata.js` (both alias `N`). `int` = occurrences inside `cut-support.js` beyond the definition and the export list (includes string occurrences in generated HTML, so treat it as approximate).
- Nothing here was executed at runtime. Behaviour claims come from reading the code.

### 0.2 Load order (verified in root `index.html`)

1. Inline app script opens at `index.html:2713` and defines the globals (`settings`, `state`, `TEMPLATES`, `persist`, `resolveDayType`, `readiness`, `render`, ...).
2. `cut-support.js?v=161` at `index.html:7950`.
3. `wearables.js` … `wearables.sync.js` at 7951–7963; `train-anatomy.js` at 7964.
4. `premium-ui.js?v=161` at `index.html:7965`.
5. `strata.js` at 7966; `seed.dev.js`, `seed.scenarios.js` at 7967–7968.

Consequences:

- Because of `"use strict"` (L2), every bare assignment such as `renderHome=NXT.home` needs an existing global binding. The targets checked are declared in `index.html`, e.g. `renderHome` 7039, `getT` 2919, `readiness` 2928, `applyCloudPayload` 5334, `render` 2982, `saveCloudNow` 5386, `loadCloudNow` 5424.
- `premium-ui.js:2829` runs after the engine and reassigns `renderHome`, `renderTrain`, `renderWeight`, `renderMore`, `renderHistory` to NXP renderers. `strata.js:1001–1005` then wraps those. The engine's seam assignments at L1783–1787 are therefore overwritten at load.

### 0.3 Headline findings

1. **Cloud merge drops cloud-only waist rows.** The six record fields are unioned by id in `applyCloudPayload` (L1985–1990, via `unionById` at L1947). `waist` is an array inside `cutSupport`, and `mergeCutSupport` (L1966–1980) has no special case for it, so it falls to "local array wins" (L1976). `cfg()` always creates `waist: []` (L49), so local always wins and cloud waist rows never merge in.
2. **Cloud merge also replaces whole objects.** `adherence`, `suggestions` and `tdeeHistory` take the local value whenever local is non-empty (L1971–1973). Top-level settings use `{...d.settings, ...localSettings}` (L1995), so any local key (`weeklyPlan`, `dayOverrides`, `zone2WeeklyTarget`, ...) wins whole.
3. **The override replaces the original `applyCloudPayload` with different semantics.** `index.html:5334` applies cloud `read`, `notifs` and `current`, and gives cloud precedence for settings. The engine version (L1981) ignores `read`, `notifs` and `current`, and gives local precedence (L1995).
4. **`loadCloudNow` pulls, merges, then pushes the merged state back** (L2211, then `saveCloudNow(false)` at L2219).
5. **Two built-in weekly splits.** `N.split` (A/B/C, L37) is applied by the V99 migration (L1761) and by `restoreWeek(false)` (L1637). `index.html` `PLAN` (2727) and `DEFAULT_WEEKLY_PLAN` (2718) are the Push/Pull/Floorball/Pump/Floorball/Legs table. The resolver uses `PLAN` only when a `weeklyPlan` day is falsy, which `index.html:2719` prevents.
6. **`previousWeeklyPlan` has a second writer.** `premium-ui.js:1884` (`setDay`) overwrites it on every single-day edit. "Use my previous weekly plan" (L1637) therefore restores the plan from before the last single-day edit, not the pre-V99 plan.
7. **`state.minimumWorkout` is not persisted.** It is set at L1525, L1527 and `index.html:6961`, but `persist()` (index.html 2891–2907) and the state initialiser (2850–2875) never store it. The shortened queue (`apm_session_plans`) survives a reload; the flag does not.
8. **Two "shorter / minimum" workouts.** `NXT.shorter` takes the first three queue entries (L1525). `index.html` `setMinimumWorkoutMode(true)` / `minimumPlanNames()` (6952–6966) picks three by regex per day type. Both write `state.sessionPlans`.
9. **Two rep caps for the same e1RM data.** Progression code uses `sessionRows(..., 100)` (L642, L655, L689, L1476, L1794), so reps up to 100 count. The strength tracker uses the default 15 (L263 via L250). Copy at L1364 says "sets over 15 reps are excluded", which is true only for the tracker.
10. **`review()` uses only `diagnose().headline`** (L284). Evidence, actions, reason and confidence from `diagnose()` are discarded, and the message is a fixed string (L283).
11. **Feature flags hide entry points only.** `FEATURES.waist` and `FEATURES.checkin` are `false` (L331), but `review()` (L277, L287), `diagnose()` (L387–401) and `cue()` (L708) still read waist and check-in data.
12. **`readiness()` override returns `score:78` with `known:false`** when there is no check-in (L1822). The header shows "—" (L1818). Callers must read `known`.
13. **Dead exports and seams.** `moveDay` (L1579) and `setGoalVisible` (L1358) have no callers anywhere. `NXT.progress` (L1374) and `NXT.history` (L1679) are reachable only through seams that `premium-ui.js:2829` overwrites.
14. **Config written but unread.** `settings.goalLow` / `goalHigh` are written at L1624 and read only in index.html fallbacks that never run (5915, 5919, 7594, 7595), because `goalLow()` / `goalHigh()` always exist (6082–6083). `cfg().suggestions` is written and never read; `followed` is always `null` (L595); `calorieUpdated` is never read (L894).
15. **Render writes.** `reviewCard()` (L777–780) calls `logSuggestion` (L779), which calls `persist()` (L602) on each new suggestion. `cue()` (L718) does the same from the Train page. Rendering therefore writes to storage.
16. **Missing guard.** `chooseSession` (L1534–1537) has no "day already has logged sets" guard. `setDayType` (L1571) and `moveDay` (L1581) do.
17. **`apm_addons` is in no reset or cloud list.** `index.html` `persist()` writes it (2900), but `resetData` (L1722), the snapshot field map (L744) and `getCloudPayload` (index.html 5311–5333) omit it.
18. **`install()` can stop half-way.** If the V99 safety snapshot fails (L1760), `install()` returns before `state.dayType` / `exercise` are set (L1774) and before `persist()` (L1775). `cfg().version` stays unset, so the next load retries.
19. **Stale copy.** The chart summary says "Dotted steps mark each week's morning average" (L1246), but no such drawing exists in the chart code (L982–1312). The empty chart says "Choose All to see older entries" (L1179), but the All range became Cut (L1172).
20. **A second copy of the engine exists.** `classic/cut-support.js` is 1,829 lines and differs from the root file (`cmp`).

---

## 1. Public API

### 1.1 How `N` is assembled

| Block | Lines | Members | Notes |
|---|---|---|---|
| A (IIFE, `const NXT = (() => {…})()`) | 26–902, return at **901** | 70 | Core engine, forecast, plateau, strength, sessions, coaching, calorie guide, activity ledger, backup. |
| B (`Object.assign(NXT, …)`) | 904–1466, return at **1465** | 30 | Charts, progress, waist, weigh-ins, Strata scans. |
| C (`Object.assign`) | 1468–1586, return at **1585** | 22 | Training, session queue, cardio, check-in, day types. |
| D (`Object.assign`) | 1588–1780, return at **1779** | 27 | More pages, programme editor, backup/restore, `install()`. |
| Direct assignments | 1850, 1871, 1872, 1981 | 3 + `old.applyCloudPayload` | `NXT.saveEquipmentNote`, `NXT.qwStep`, `NXT.qwTime`; `NXT.old.applyCloudPayload` (replaces the captured original, see 3.6). |
| Extended by other files | — | `NXT.wearables` (wearables*.js); `NXT.recoveryPreview` (set by `premium-ui.js:487`, read by `wearables.sync.js:648–661`) | Neither is defined in this file. |
| Module-private (not on `N`) | — | `CHART` (L6, top-level const, not on NXT), `NXT` (L26), `DAY` (27), `EWMA_*` (108), `BAND_*` (125, 923), `FORECAST_*` (152), `PLATEAU_*` (193–194), `CALORIES_ENABLED` (327), `ADHERENCE_FACTORS` (332), `CONE_SIGMA_FALLBACK`, `FUTURE_MAX_DAYS`, `FUTURE_SHARE` (923) | `FEATURES` is exported as `N.features` (1.11). |

Columns: **Inputs** = parameters. **Reads** = state, settings, cfg() fields or globals read. **Writes** = what it mutates. **ext/int** = usage counts from 0.1. `—` = none.

### 1.2 Dates, utilities, config, UI state

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `copy` | 28 | JSON deep clone | value | — | — | 7/35 |
| `old` | 29–30 | Captured index.html functions at load: renderHistory, renderFloorball, apx96MoreSectionHTML, getT, readiness, getFullBackup, applyCloudPayload, apx96OpenQueueManager, openEditSet, closeModal | — | globals (at load) | — | 0/18 |
| `ui` | 44 | UI state: `{view:'overview', range:30, showGoal:false, showPost:false, showForecast:false, selected:null, draft:null, lastFocus:null}` | — | — | runtime fields added: `chart`, `lastPlotted`, `chartAnim` (1165–1171), `noteExercise` (1849), `scanImport` (1425–1451), `editWeightId`/`editWeightDate` (1455–1456), `draft` (1643–1657) | 41/65 |
| `defaults` | 32–36 (const) | Built-in FullA/FullB/FullC lists: sets, rep range, kg step | — | — | copied into global `TEMPLATES` by `install()` (L1757) | 1/4 |
| `split` | 37 (const) | Weekday (0=Sun) → type, A/B/C rhythm: `{0:Rest,1:FullA,2:Zone2,3:FullB,4:Zone2,5:FullC,6:Zone2}` | — | — | — | 0/9 |
| `names` | 38 (const) | Type → label. `Pump:"Legs"` and `Legs:"Legs"` both map to "Legs" | — | — | — | 0/8 |
| `typeNames` | 40 | Validation list: `names` keys minus `Legs` (D33) | — | names | — | 2/5 |
| `pickTypes` | 43 | Picker list: typeNames minus Floorball unless enabled or it is the current type | keep | FEATURES.floorball | — | 1/3 |
| `cfg` | 45–53 | Normalises and returns `settings.cutSupport`, creating it if missing | — | settings.cutSupport | creates and normalises `settings.cutSupport` on every call (L46–51) | 21/55 |
| `finite` | 54 | Number, or null for "", null, undefined, non-finite | v | — | — | 16/61 |
| `dateMs` | 55–59 | Strict `YYYY-MM-DD` to UTC-noon ms. NaN if invalid or not a round trip | d | — | — | 42/57 |
| `dateAdd` | 60 | ISO date plus n days | d, n | — | — | 29/23 |
| `weekStart` | 61 | Monday (UTC) of the week containing d | d=state.date | state.date | — | 15/6 |
| `shortDate` | 62 | "9 Oct" (en-SG, UTC) | d | — | — | 41/23 |
| `label` | 63 | `names[t] \|\| t \|\| "Workout"` | t | names | — | 28/148 |
| `features` | 331 | Alias of FEATURES (1.11) | — | — | — | 22/5 |

### 1.3 Weight trend, plateau, forecast

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `cleanRows` | 64–83 | One canonical row per date. Weight rows must be untimed or Morning (D14). Weight 20–400 kg, waist 30–250 cm. Same-date rule: a later row replaces an earlier one unless the earlier one is Morning. Insertion order, not `ts` | input, key="weight" | state.date | — | 2/5 |
| `weights` | 84 | `cleanRows(state.bws)` | — | state.bws | — | 17/23 |
| `timingRows` | 90–103 | Chart-only. One row per date for one timeOfDay (exact lower-case match). Latest by `ts` when both carry one, else insertion. Weight 20–400 | timing, input=state.bws | state.bws, state.date | — | 2/1 |
| `windowStats` | 104–107 | Rows in a trailing window: `{items, n, avg}` | rows, end=state.date, days=7, key | — | — | 9/6 |
| `ewmaTrend` | 109–121 | EWMA per reading, half-life 7 d (alpha ≈ 0.094). Restarts when the gap exceeds 3 days. `trendReady` after 3 readings in a run | rows=weights() | — | — | 0/4 |
| `trend` | 122–124 | `ewmaTrend` with `avg` null until ready. `coverage` = readings in trailing 7 days | rows | — | — | 6/42 |
| `trendConfidence` | 126–140 | ±1σ band over 14-day windows (min 7 readings). σ = sample SD of residuals. Input series is NOT filtered by `trendReady` | rows | — | — | 0/2 |
| `forecastGoal` | 153–192 | Days to reach `goalHigh()` from a 21-day fit on raw readings. Returns `{ok, weeks, lowWeeks, highWeeks, confidence, reason, slope, lastDate, lastAvg, fittedLevel}` | rows | goalHigh() (global, index.html 6083), ewmaTrend, trendConfidence | — | 1/10 |
| `detectPlateau` | 211–240 | 28-day equivalence test on raw readings, ladder up to 90 days. Returns `{ok, plateau, status, weeklyRate, lower, upper, n, windowDays, spanDays, plateauDays, confidence, reason, lastAvg, lastDate}` | rows=weights() | state.date | — | 5/5 |
| `trendStats` | 241–246 | 7-day windows ending today, today−7, today−14. `change`, `priorChange`, `percent` | rows | state.date | — | 1/6 |

### 1.4 Strength and progression

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `workRows` | 247–249 | Working sets: not warm-up, date ≤ today, weight ≥ 0, integer reps ≥ 1 | — | state.logs, state.date | — | 6/7 |
| `sessionRows` | 250–258 | Per-date best e1RM for one exercise and gym, Epley `w·(1+r/30)`. Excludes reps > maxReps and weight ≤ 0. Returns `[{date, sets, value}]` ascending | ex, gym=state.gym, before=state.date, maxReps=15 | workRows() | — | 7/6 |
| `strengthItems` | 259–275 | Per-lift status words (see 2.6). Sessions up to and including today, maxReps 15. Top 24 by latest date | — | state.logs, state.date | — | 2/4 |
| `bestSet` | 620–628 | Heaviest set; ties go to more reps (D20) | sets | — | — | 13/9 |
| `aimFor` | 641–650 | Next target `{kind: reentry\|load\|rep\|match, weight, reps, why}` from last session (before today, maxReps 100) and `cue()` | ex | targetFor, sessionRows(…,100), cue, state.gym/date | — | 2/1 |
| `cue` | 688–720 | Progression label, weight, why, text for the next session. Logs one `progression` suggestion | ex | targetFor, sessionRows(…,100), cfg().recovery[today], state.date | cfg().suggestions via logSuggestion (L718) | 3/11 |
| `coachFor` | 654–687 | Structured coach: `{kind, headline, note, sets[], weight, reps, gap}`; per-set targets from last session's drop-off | ex | targetFor, sessionRows(…,100), cue, aimFor | — | 2/0 |
| `logSuggestion` | 587–603 | Appends `{id, date, kind, subject, payload, followed:null, ts}`. Dedupes against the last entry only. Cap 1000 | entry | cfg().suggestions, state.date | cfg().suggestions (L600–601); persist (L602) | 1/3 |

### 1.5 Sessions, templates, plans, day types

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `typeFor` | 571–574 | Day type for a date: `resolveDayType` if present, else a local fallback that skips the built-in PLAN table | d | settings.dayOverrides, settings.weeklyPlan (fallback only) | — | 7/10 |
| `templateFor` | 575–578 | Saved routine for `gym__type` if `validTemplate`, else `TEMPLATES[type]`, else [] | type=state.dayType, gym=state.gym | cfg().templates, TEMPLATES (global) | — | 18/15 |
| `targetFor` | 579 | Per-exercise target: sessionTargets[sessionKey()] → templateFor() → old.getT → `{sets:3, reps:[8,12], inc:2.5}` | ex | cfg().sessionTargets, templateFor, old.getT | — | 2/8 |
| `done` | 580 | Working sets logged today for this exercise and gym, across all day types | ex | state.logs, state.date, state.gym | — | 10/21 |
| `planDone` | 581 | Session finished flag | — | cfg().sessions[sessionKey()] | — | 2/4 |
| `validTemplate` | 1658 | 1–15 rows, unique names, sets 1–8, rep pair 1–30 with lo ≤ hi, inc 0–25 | rows | — | — | 3/3 |
| `sessionLogs` | 1470 | Today's logs for gym and dayType | — | state.logs, state.date, state.gym, state.dayType | — | 7/4 |
| `training` | 1471–1492 | Renders Train. Floorball goes to old.renderFloorball; Rest/Zone2 to recoveryDay. Calls `cue()` (logs a suggestion) | — | template() (index.html), targetFor, done, cue, sessionRows(…,100), planDone | `#trainPage`; state.exercise (L1474) | 1/8 |
| `selectExercise` | 1493 | Selects a queue item | index | template() | state.exercise, state.setNum | 3/1 |
| `nextExercise` | 1494–1497 | Moves to the next queue item, or calls `finish()` | — | template(), state.exercise | state.exercise, state.setNum; commit | 0/1 |
| `logSet` | 1498–1511 | Validates a set (weight 0–1000, reps 1–100 integer), appends it, auto-advances after planned working sets, starts rest timer | — | DOM, targetFor, done, template() | state.logs (push), state.exercise; commit | 4/3 |
| `finish` | 1512–1517 | Writes the finished record (needs ≥1 set, confirm) | — | sessionLogs, sessionKey() | cfg().sessions[key] = `{date, gym, type, finished:true, finishedAt, sets}`; commit | 3/2 |
| `openFinishSummary` | 1518–1521 | Session-saved modal | — | sessionLogs | DOM | 0/2 |
| `resume` | 1522 | Deletes the finished record for this session | — | — | delete cfg().sessions[key]; commit | 4/2 |
| `shorter` | 1523–1526 | Keeps the first three queue entries (confirm). Sets the minimum flag | — | ensureSessionPlan() (override, L1790) | state.sessionPlans[key], state.exercise, state.minimumWorkout (**not persisted**); commit | 1/5 |
| `fullSession` | 1527 | Restores the saved routine for this session | — | templateFor() | state.sessionPlans[key] (names); cfg().sessionTargets[key] (full objects); state.minimumWorkout=false; commit | 3/2 |
| `undo` | 1528–1532 | Removes the most recent set of this session and deletes the finished record (confirm). Aliased as `apx96UndoLastSet` (L1796) | — | sessionLogs | state.logs (filter); delete cfg().sessions[key]; state.exercise; commit | 0/2 |
| `sessionPicker` | 1533 | Day-type picker. Aliased as `showSessionSheet` (L1798) and `cycleDayType` (L1799) | — | pickTypes(state.dayType) | DOM | 0/2 |
| `chooseSession` | 1534–1537 | Sets today's override. **No logged-sets guard** (see 5.4) | type | typeNames() | settings.dayOverrides[state.date]; state.dayType, state.exercise, state.setNum; commit | 0/1 |
| `openDay` | 1564–1568 | Modal to choose a day's type, with "Make every <weekday> this" | date | typeFor, state.logs | DOM | 1/1 |
| `setDayType` | 1569–1578 | Dated override, or with "every" sets `weeklyPlan[dow]` and deletes only that date's override. Refuses if the day has logs | date, type | state.logs, DOM checkbox | settings.dayOverrides or settings.weeklyPlan; state.dayType, state.exercise; commit | 0/1 |
| `moveDay` | 1579–1584 | Swaps the types of two dates as overrides. Refuses if either has logs. **No callers anywhere in the repo** | from | state.logs, typeFor | settings.dayOverrides[from] and [to]; state.dayType; commit | 0/0 |

Not in this file, but part of the sessions domain: `resetSessionOrder` (index.html 3590–3603), `moveSessionExercise` (index 3577–3589), `setMinimumWorkoutMode` (index 6960–6980), `minimumPlanNames` (index 6952–6959), and the original `ensureSessionPlan` (index 3565–3575, overridden at L1790). The engine's `shorter` (L1523) and `fullSession` (L1527) are the only engine minimum-workout paths.

### 1.6 Coaching and calorie guide

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `review` | 276–310 | Today and weekly verdict `{tone, title, message, action, reason, change}`. Precedence in 2.2 | — | weights(), trendStats(), strengthItems(), cfg().waist, cfg().recovery[today], detectPlateau(), diagnose() (only if plateau), forecastGoal() (ETA text), cfg().targetConfirmed, goalLow()/goalHigh() (globals) | — | 1/22 |
| `diagnose` | 376–477 | Plateau-cause verdict `{ok, verdict, headline, evidence[≤4], actions, confidence, reason}`. Precedence in 2.3 | — | detectPlateau, forecastGoal, adaptiveTDEE, strengthItems, cfg().waist/recovery/tdeeHistory/adherence, FEATURES.waist/checkin, CALORIES_ENABLED | — | 0/5 |
| `estimate` | 311–321 | Mifflin–St Jeor maintenance and 15%-reduced target, with validation errors | p (profile) | — | — | 0/18 |
| `formulaTDEE` | 343–350 | Display TDEE: settings.tdee → cfg().maintenanceEstimate → USER_TDEE | — | settings.tdee, cfg().maintenanceEstimate, USER_TDEE | — | 0/1 |
| `adaptiveTDEE` | 351–375 | Intake-plus-trend TDEE over 14 days (21 if fewer than 10 days logged) | windowDays=14 | cfg().adherence, cfg().calories, weights(), trend() | — | 0/3 |
| `maybeSnapshotTDEE` | 478–488 | Adds or replaces today's `tdeeHistory` row (cap 180), then persist. **Not gated by CALORIES_ENABLED**; called from `install()` on every load | replaceToday=false | adaptiveTDEE | cfg().tdeeHistory; persist (L486) | 0/2 |
| `tdeeCardHTML` | 489–504 | "Your real TDEE" card. Returns "" while CALORIES_ENABLED is false. Called by premium-ui.js:1387 | — | adaptiveTDEE, formulaTDEE | — | 1/0 |
| `reviewCard` | 777–781 | Renders review() and logs a `review` suggestion | — | review() | cfg().suggestions (L779) | 0/6 |
| `diagnosisCard` | 782–842 | Renders diagnose(). Splits the headline at " — ", drops actions already in the headline, filters Forecast rows when no goal is confirmed | — | diagnose(), cfg().targetConfirmed | — | 0/2 |
| `logAdherence` | 604–609 | Writes today's adherence (yes/close/no/over). **Not gated by CALORIES_ENABLED** | status | — | cfg().adherence[date] = `{status, ts}`; persist | 0/4 |
| `adherenceHTML` | 610–616 | Adherence buttons. Returns "" when CALORIES_ENABLED is false | — | cfg().adherence[date] | — | 1/1 |
| `calorieCard` | 843–847 | Calorie card. Returns "" when CALORIES_ENABLED is false | — | cfg().calories | — | 0/3 |
| `openCalories` | 872–882 | Calorie-guide modal | — | cfg().profile, cfg().calories, weights() | DOM | 1/2 |
| `profileInputs` | 883 | Reads the calorie form | — | DOM | — | 0/2 |
| `previewCalories` | 884–888 | Shows the estimate in the form | — | profileInputs(), estimate() | DOM; calorie input value | 0/1 |
| `saveCalories` | 889–898 | Validates and saves profile, calories, maintenance estimate and date; snapshots TDEE | — | DOM, estimate() | cfg().profile, cfg().calories, cfg().calorieUpdated, cfg().maintenanceEstimate; maybeSnapshotTDEE(true); commit | 0/1 |
| `openReview` | 899 | Weekly review modal | — | review(), trendStats() | DOM | 2/3 |

No `insights` member exists in this file. `coachInsights` (the stored insight records) is read only by `restoreData` (L1712) and cleared by `resetData` (L1722). Insight generation and display are in index.html (`saveWorkoutInsight`, `latestCoachInsight`, `coachInsightObservation`).

### 1.7 Activity ledger, cardio, floorball

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `cardioWeek` | 505 | Minutes of cardio this week (Mon to today) | — | state.cardio, weekStart() | — | 2/5 |
| `completedWeek` | 506 | Distinct lifting days this week | — | workRows() | — | 1/2 |
| `activityWeeks` | 517–545 | Weekly ledger from the first stored record: liftDays, sets, tonnage (Σ w×r), exercises, cardioMin, cardioSessions, floorSessions, floorMin. Mon–Sun. Default 12 weeks, cap 104 | weeks=12, end=state.date | workRows() (bounded by state.date, not `end`), state.cardio, state.floorball | — | 5/1 |
| `activitySummary` | 551–567 | Totals (include the partial current week), averages and counts over full weeks, streak against the weekly plan | items=activityWeeks() | settings.weeklyPlan, settings.zone2WeeklyTarget (default 90) | — | 4/0 |
| `cardioModal` | 1538–1541 | Log-cardio modal | date | state.date | DOM | 0/1 |
| `saveCardio` | 1542–1547 | Validates and appends one cardio row | — | DOM, state.gym | state.cardio (push); commit | 0/1 |
| `cardioCard` | 1548–1551 | Weekly cardio card against target | — | cardioWeek(), settings.zone2WeeklyTarget | — | 0/1 |
| `saveCardioGoal` | 1678 | Saves the weekly cardio target (30–600 min) | — | DOM | settings.zone2WeeklyTarget, ZONE2_WEEKLY_TARGET (global); commit | 0/1 |
| `coachHTML` | 1674–1677 | "Cardio & recovery" page: target form, check-in list (only if FEATURES.checkin), review card | — | settings.zone2WeeklyTarget, cfg().recovery, FEATURES.checkin | — | 0/1 |

### 1.8 Recovery check-in

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `recoveryDay` | 1552–1554 | Rest and Zone2 page: copy, cardio card, review card | — | state.dayType, cardioWeek(), reviewCard() | `#trainPage`; reviewCard logs a suggestion | 0/2 |
| `recoveryModal` | 1555–1558 | Check-in form | — | cfg().recovery[date] | DOM | 0/1 |
| `saveRecovery` | 1559–1563 | Validates sleep 0–24, energy 1–5, soreness 1–5 and saves | — | DOM | cfg().recovery[date] = `{sleep, energy, soreness, date}` (blank as ""); state.read; commit | 0/2 |
| `readiness` (global override, L1804–1823) | — | Replaces index.html `readiness()`. With a check-in: calls `NXT.old.readiness()` and returns `{…, known:true}`. Without: returns `{score:78, msg:'Check-in not logged', known:false}` | — | cfg().recovery[today], state.read | state.read; header DOM `#headScore` (L1811–1820). Also called by `render()` wrapper (L2158) | — |

### 1.9 Backup, safety copy, restore, reset

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `snapshot` | 733–758 | Safety copy to `localStorage.nxtfrm_recovery_snapshot` (single slot). On quota failure drops the previous copy and retries. Returns boolean. Failure detail in `snapshot.issue` | reason, opts | old.getFullBackup() (index.html), localStorage size | localStorage `nxtfrm_recovery_snapshot`; `snapshot.issue` | 5/10 |
| `snapshotFail` | 726–732 (not exported) | Records `{stage, name, full, usedKB}`; toasts unless quiet | stage, e, opts | localStorage | `snapshot.issue`; toast | — |
| `commit` | 760–767 | `persist()` then close modal, repaint, toast. Handles local-full with a cloud user | message | cloudUser | persist() | 6/29 |
| `repaint` | 759 | Blur, clear typing flags, `render()` | — | — | state.typingWeight; window.__apexTyping | 9/12 |
| `history` | 1679–1683 | Calls old.renderHistory, then prepends a "This week, together" card. Global `renderHistory` is overwritten by premium-ui (see 0.2 and 5.2) | — | review(), trendStats(), completedWeek(), cardioWeek() | `#historyPage` (prepend) | 0/14 |
| `exportSafety` | 1684–1688 | Downloads the safety copy as JSON | — | localStorage `nxtfrm_recovery_snapshot` | Blob download | 1/1 |
| `restoreSafety` | 1689–1693 | Restores the safety copy | — | localStorage | restoreData() | 1/1 |
| `validateBackup` | 1694–1706 | Checks and normalises a backup: logs, cardio, floorball, bws, scans (apm_evo_scans), rest, settings (object; weeklyPlan values strings), current (gyms array) | data | data, data.localStorageDump | — | 0/2 |
| `restoreData` | 1707–1718 | Validates, confirms, snapshots, then replaces records; `settings = {...SETTINGS_DEFAULTS, ...d.settings}`; reassigns START_WEIGHT, TARGET_LOW/HIGH, USER_TDEE, ZONE2_WEEKLY_TARGET; then `install(false)` | data, message | validateBackup(), SETTINGS_DEFAULTS (index.html) | state.{logs, cardio, floorball, bws, scans, rest, sessionPlans, coachInsights, exerciseNotes, gym, gyms, read, notifs, date, dayType, exercise}; global `settings`; commit | 0/2 |
| `resetData` | 1719–1735 | Snapshot, removes 15 `apm_*` keys, clears cloud user and timer, deletes wearables DB if present, reloads | — | NXT.wearables.store (if present) | localStorage (remove); cloudUser=null; clearTimeout(cloudTimer) | 4/1 |

### 1.10 Weigh-ins, waist, Strata scans, charts, progress

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `signed` | 906 | Signed number string, or "—" for null | v, digits=2 | — | — | 6/9 |
| `smoothPath` | 907–919 | Monotone-cubic SVG path | points | — | — | 1/3 |
| `trendReadText` | 961–974 | One-line reading under the chart: horizon plus plateau or trend status | forecast, plateau | — | — | 0/1 |
| `cutRangeDays` | 977–981 | Days from settings.cutStart to today, or null | — | settings.cutStart, state.date | — | — |
| `chartModel` | 982–1058 | Chart geometry: window, Y-domain from data only (D2), segments, bands, forecast, plateau | rows, range, showGoal | N.ui.range/showGoal/showPost/showForecast, cfg().targetConfirmed, settings.cutStart, state.date | — | 0/1 |
| `gapLine` | 1064–1069 | "On trend", or "X kg above/below trend" | p | — | — | 0/1 |
| `pointTiming` | 1070–1074 | Timing label for a point ("Timing not recorded" if blank) | p | — | — | 0/1 |
| `postDelta` | 1075–1079 | Post-workout delta text | p, postRow | — | — | 0/1 |
| `trajectoryHeadline` | 1080–1087 | Headline from plateau status | plateau | — | — | 0/1 |
| `journeyHTML` | 1089–1127 | "Cut journey" rail. Only when a goal is confirmed | — | cfg().targetConfirmed, START_WEIGHT (global), settings.cutStart, goalLow(), goalHigh(), detectPlateau() | — | 0/2 |
| `evidenceHTML` | 1128–1163 | Evidence rows: weekly rate, plateau, projection, confidence | plateau, forecastRead | cfg().targetConfirmed | — | 0/1 |
| `chartHTML` | 1164–1312 | Whole weight chart: tabs, legend, range read, journey, evidence, diagnosis, review | — | chartModel(), N.ui.* | N.ui.chart, N.ui.lastPlotted, N.ui.chartAnim (1165–1171) | 1/2 |
| `selectPoint` | 1313–1333 | Updates the readout for one point, moves cursor and halo | index, opts | N.ui.chart | N.ui.selected; DOM text | 13/4 |
| `scrub` | 1334–1343 | Pointer to nearest point | event | N.ui.chart | selectPoint() | 0/2 |
| `chartKey` | 1344–1352 | Arrow keys move, Escape returns to latest | event | N.ui.chart | selectPoint() | 0/1 |
| `setRange` | 1357 | Range 14, 30, 90 or 'cut'; flags range animation; repaint | range | — | N.ui.range, N.ui.selected=null, N.ui.chartAnim='range' | 0/1 |
| `setGoalVisible` | 1358 | Sets `N.ui.showGoal`. **No callers anywhere** | on | — | N.ui.showGoal | 0/0 |
| `setPostVisible` | 1359 | Toggles post-workout series | on | — | N.ui.showPost | 0/1 |
| `setForecastVisible` | 1360 | Toggles projection | on | — | N.ui.showForecast | 0/1 |
| `setView` | 1361 | Progress tab: overview, strength or body | view | — | N.ui.view | 1/2 |
| `strengthHTML` | 1362–1369 | Performance tab: lift cards and sparklines of the last 8 sessions | — | strengthItems() | — | 0/1 |
| `bodyHTML` | 1370–1373 | Body tab: waist card, latest and previous change, Evo scans link | — | cfg().waist, cleanRows() | — | 0/1 |
| `progress` | 1374–1377 | Progress page. Global `renderWeight` is overwritten by premium-ui (see 0.2 and 5.2) | — | weights(), N.ui.view | `#weightPage` | 0/8 |
| `openWaist` | 1378–1381 | Waist modal, new or edit | date | cfg().waist | DOM | 2/2 |
| `saveWaist` | 1382–1388 | Validates; replaces the row for the target date (confirm if moved onto an existing date) | original | cfg().waist, DOM | cfg().waist = filter + concat `{id, date, cm, ts}`; commit | 0/1 |
| `deleteWaist` | 1389 | Deletes the row for a date (confirm) | date | cfg().waist | cfg().waist (filter); commit | 0/1 |
| `openWeightHistory` | 1390–1392 | Weigh-in history modal with copy and edit buttons | — | weights(), state.bws | DOM | 1/1 |
| `copyWeighIns` | 1394–1400 | Copies every weigh-in as TSV (date, kg, timing) | — | state.bws | clipboard | 0/1 |
| `parseStrataScans` | 1405–1418 | Parses Strata CSV or JSON into `{date, time, weight, bodyFat, muscleMass, fatMass, bmr, tdee}`. Drops dates after today | text | state.date | — | 0/1 |
| `importScans` | 1424–1431 | Opens the Strata import modal | — | — | N.ui.scanImport = null; DOM | 1/0 |
| `readScanFile` | 1432 | Reads a file into the textarea and previews | input | — | DOM | 0/1 |
| `previewScanImport` | 1433–1440 | Preview with duplicate check (date plus weight to one decimal) | — | state.scans via scanPlan() | N.ui.scanImport; DOM | 0/2 |
| `commitScanImport` | 1441–1452 | Appends new scans; when weight > 0 also a weigh-in with timeOfDay "Evo Scan" (not in the trend) | — | N.ui.scanImport | state.scans (push), state.bws (push); commit | 0/1 |
| `editWeight` | 1453–1457 | Edit weigh-in modal | date | weights() | N.ui.editWeightId, N.ui.editWeightDate; DOM | 0/1 |
| `saveWeightEdit` | 1459–1463 | Edits date, weight and ts of the found row | — | findEditWeight() | state.bws row mutated (`r.date`, `r.weight`, `r.ts`); commit | 0/1 |
| `deleteWeight` | 1464 | Deletes the found row (confirm) | — | findEditWeight() | state.bws (filter); commit | 0/1 |

### 1.11 Feature flags and UI state

| Name | Line | Value | Readers (file:line) |
|---|---|---|---|
| `CALORIES_ENABLED` (module-private) | 327 | `false` (D49) | Gates: diagnose() L419, L430, L432, L441, L446, L450, L461; adherenceHTML L611; calorieCard L844; tdeeCardHTML L490; openReview L899; the `moreView` title (L1597) uses `N.features.calories`; `FEATURES.calories` copies it |
| `FEATURES` / `N.features` | 331 | `{calories:false, floorball:false, wearable:false, waist:false, classic:false, reminders:false, checkin:false}` | pickTypes L43 (floorball); diagnose gap() L431 (waist), L433 (checkin); openReview L899 (checkin); moreView L1597 (calories, checkin); goalsHTML L1610 (waist); coachHTML L1676 (checkin). premium-ui.js 221, 224, 227, 228, 953, 1757 (waist), 2053, 2055, 2059, 2065, 2068 (classic → `location.href='classic/'`) |
| `ui` / `N.ui` | 44 | see 1.2 | Readers in chart and progress code (L982–1361) and premium-ui (9 uses) |

Note: FEATURES only hides entry points. The engine still reads waist (review L277, diagnose L387) and recovery check-ins (review L287, cue L708, diagnose L399).

### 1.12 Boot and install (block C/D members used at load)

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `install` | 1756–1778 | Boot routine. Copies `N.defaults` into global `TEMPLATES` (L1757). V99 migration when `cfg().version` is unset (L1759–1769). `mergeLegsIntoPump()`. Fills weeklyPlan from N.split (L1773). Sets state.dayType and state.exercise. persist(). `maybeSnapshotTDEE()` | migrate=true | cfg().version, settings.weeklyPlan, settings.zone2WeeklyTarget, state.logs, state.read, cfg().recovery | TEMPLATES; cfg().{previousWeeklyPlan, previousCardioTarget, version, recovery}; settings.{weeklyPlan, zone2WeeklyTarget, dayOverrides}; ZONE2_WEEKLY_TARGET (global); state.{dayType, exercise}; persist(); tdeeHistory via maybeSnapshotTDEE | 0/5 (called at L1920, restoreData L1717, applyCloudPayload override L1845) |
| `mergeLegsIntoPump` | 1739–1755 (not exported) | D33: `'Legs'` to `'Pump'` in settings.weeklyPlan, settings.dayOverrides, cfg().previousWeeklyPlan and state.dayType. `__Legs` keys to `__Pump` in templates, sessionTargets, sessions and state.sessionPlans, but never overwriting an existing `__Pump` key | — | same | same; persist if changed | — |
| `saveEquipmentNote` (direct, L1850) | — | Saves a per-exercise equipment note | — | DOM, NXT.ui.noteExercise | state.exerciseNotes[`gym__ex`]; commit | — |
| `qwStep`, `qwTime` (direct, L1871–1872) | — | Quick weigh-in stepper (±0.1 kg) and timing segmented control | — | DOM, NXT.finite | DOM | — |

### 1.2b HTML helpers, Home and week strip (block A)

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `modal` | 768–772 | Writes `#modalRoot`, remembers the focused element, focuses the close control | title, body | document.activeElement | `#modalRoot` innerHTML; `N.ui.lastFocus` | 12/35 |
| `button` | 773 | Button HTML with `onclick` (action escaped). `secondary` adds a class | text, action, secondary=false | — | — | 1/163 |
| `heading` | 774 | Page heading HTML (`header.n99-heading`). Arguments are not escaped | eyebrow, title, action | — | — | 0/8 |
| `card` | 775 | Card HTML (`section.n99-card`). Title and body not escaped | title, body, extra | — | — | 0/43 |
| `metric` | 776 | Metric HTML (`div.n99-metric`). Label and value not escaped | label, value, detail | — | — | 2/24 |
| `weekHTML` | 848–854 | Home 7-day strip: short type label, done tick, today marker. Each day opens `NXT.openDay` | — | weekStart(), dateAdd(), typeFor(), workRows(), state.date | — | 0/2 |
| `home` | 855–871 | Renders Home: session card, calorie card, latest weight and weekly change, weekly rhythm, quick actions, review card | — | template(), review(), planDone(), cardioWeek(), weights(), trendStats(), done(), completedWeek(), state.* | `#homePage` innerHTML | 1/1 |

### 1.2c More pages (block D, navigation)

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `more` | 1590 | Opens a More sub-view and repaints | view='hub' | — | state.moreView, state.tab='more'; repaint | 17/30 |
| `moreView` | 1592–1607 | Renders the More hub or a sub-view. Replaces the legacy clear-data string (L1602) with `NXT.resetData()`. Adds the safety-copy card to the data view (L1603) | — | state.moreView, calorieCard(), N.features, N.old.apx96MoreSectionHTML | `#morePage` innerHTML | 1/3 |

### 1.12b Goals, programme and routine editor (block D)

| Member | Line | Purpose | Inputs | Reads | Writes | ext/int |
|---|---|---|---|---|---|---|
| `goalsHTML` | 1608–1611 | Goal range, cut start and advice cards | — | calorieCard(), cfg().targetConfirmed, settings.startWeight, goalLow(), goalHigh(), FEATURES.waist | — | 0/1 |
| `saveCutStart` | 1614–1619 | Saves cut start date and weight | — | DOM | settings.cutStart, settings.startWeight, START_WEIGHT (global); commit | 0/1 |
| `saveGoal` | 1620–1625 | Saves the goal range. BMI floor applies to the low goal; height defaults to 176 | — | DOM, cfg().profile.height | TARGET_LOW / TARGET_HIGH (globals); settings.targetLow, targetHigh, goalLow, goalHigh; cfg().targetConfirmed = true; commit | 0/1 |
| `programmeHTML` | 1626–1628 | Programme page: weekly-plan form, saved-routine buttons (FullA/B/C, then Push/Pull/Pump/Legs), gym names, defaults | — | settings.weeklyPlan, pickTypes(), templateFor(), N.label, state.gym | — | 0/2 |
| `saveWeek` | 1629–1635 | Saves the weekly plan. Validates each day, confirms more than 3 lift days, snapshots first | — | DOM, typeNames() | settings.weeklyPlan; state.dayType, state.exercise; commit | 0/1 |
| `restoreWeek` | 1636–1642 | Replaces the weekly plan with `N.split` or `cfg().previousWeeklyPlan`. Confirms and snapshots first | previous | cfg().previousWeeklyPlan, N.split | settings.weeklyPlan; state.dayType, state.exercise; commit | 0/2 |
| `editTemplate` | 1643 | Opens the routine editor for a type | type | templateFor(type), state.gym | N.ui.draft; drawTemplate() | 0/2 |
| `captureDraft` | 1644–1650 | Copies the editor's DOM inputs into the draft rows | — | DOM | N.ui.draft.rows | 0/4 |
| `drawTemplate` | 1651–1654 | Routine editor modal. Datalist from `v88AllExerciseNames()` | — | N.ui.draft, v88AllExerciseNames() | DOM | 0/5 |
| `draftMove` | 1655 | Moves a draft row up or down (captures inputs first) | i, dir | — | N.ui.draft.rows | 0/2 |
| `draftRemove` | 1656 | Removes a draft row, keeps at least one | i | — | N.ui.draft.rows | 0/1 |
| `draftAdd` | 1657 | Adds a draft row (max 15; new row: 2 sets, 8–12 reps, 2.5 kg) | — | — | N.ui.draft.rows | 0/1 |
| `saveTemplate` | 1659–1663 | Validates and saves the routine (snapshots first) | — | captureDraft(), validTemplate() | cfg().templates[gym__type]; N.ui.draft = null; commit | 0/1 |
| `defaultTemplate` | 1664–1667 | Resets the draft to `N.defaults` or the global `TEMPLATES` (confirm) | — | N.defaults, TEMPLATES | N.ui.draft.rows | 0/1 |
| `saveQueueAsTemplate` | 1668–1673 | Saves the current queue as the gym's routine (confirm, validate, snapshot) | — | template(), validTemplate() | cfg().templates[gym__dayType]; commit | 0/1 |

### 1.13 Global overrides this file installs (not `N` members)

These replace index.html globals. "idx" is the definition line in `index.html`. The full list with replacement effects is in 3.5.

| Global | Engine line | idx | Replaced by |
|---|---|---|---|
| `renderHome`, `renderTrain`, `renderWeight`, `renderHistory`, `renderMore` | 1783–1787 | 7039, 7088, 7169, 7431, 7464 | `NXT.home`, `NXT.training`, `NXT.progress`, `NXT.history`, `NXT.moreView`. **Overwritten by premium-ui.js:2829** |
| `getT`, `exerciseDefByName`, `ensureSessionPlan` | 1788–1790 | 2919, 3557, 3565 | Saved-programme-first versions (see 3.5) |
| `readiness` | 1804–1823 | 2928 | Check-in aware wrapper around `NXT.old.readiness` |
| `applyCloudPayload` | 1839–1847 | 5334 | Snapshot, type checks, `NXT.old.applyCloudPayload` (merge, L1981), `NXT.install(false)` |
| `closeModal` | 1851 | 7167 | Wraps `NXT.old.closeModal`, clears typing flag and focus |
| `saveCloudNow`, `loadCloudNow`, `initCloudFromStorage` | 2161, 2193, 2043 | 5386, 5424, 5369 | Cloud save and load, with pull-merge-push |
| `render` | 2157–2158 | 2982 | Wraps render, calls `updateCloudSyncStatus()` and `readiness()` |

---

### 1.14 Functions and state in the file that are not on `N`

These are closures or top-level bindings. Several are reached through globals; see 1.13 and 3.5.

| Name | Line | Purpose |
|---|---|---|
| `exercise` | 31 | Builds a default exercise object `{name, sets, reps:[lo,hi], inc}` |
| `DAY` | 27 | 86,400,000 ms |
| `lsFit` | 143–151 | Ordinary least squares on `{x,y}` points; `se_slope` clamped at 0 |
| `plateauWindow` | 197–210 | Equivalence test over a trailing window (used by `detectPlateau`) |
| `repsAt` | 635–640 | Epley-based target reps for a heavier load, clamped to the rep range |
| `suggestionAction` | 582–586 | Maps a label to `increase`, `baseline` or `hold` |
| `snapshotFail` | 726–732 | Records a failed safety copy in `snapshot.issue` and toasts |
| `adherenceIn` | 333–342 | Adherence rows within a date range |
| `forecastGeometry` | 926–957 | Forecast cone and mid-line in data space (chart only) |
| `cutRangeDays` | 977–981 | Days since `settings.cutStart` (used by `chartModel`) |
| `gapLine`, `pointTiming`, `postDelta`, `trajectoryHeadline`, `evidenceHTML` | 1064–1163 | Chart readout and evidence helpers |
| `findEditWeight` | 1458 | Finds the weigh-in row being edited (by `ui.editWeightId`, else by date) |
| `scanPlan` | 1419–1423 | Flags Strata scans that duplicate an existing scan (date plus weight to one decimal) |
| `menuRow` | 1591 | One More-page menu row |
| `mergeLegsIntoPump` | 1739–1755 | D33 migration (see 4.4) |
| `isPlain`, `hasId`, `recTs`, `nonEmpty` | 1928–1931 | Cloud merge helpers |
| `mergeObjectsLocalWins`, `unionById`, `mergeCutSupport` | 1936–1980 | Cloud merge (see 3.6) |
| `lastCloudMergeOk`, `lastCloudError`, `lastCloudSyncAt` | 1924–1926 | Module-level cloud status (`let`) |
| `cloudSessionChecked`, `cloudErrDismissed`, `cloudSaveQuiet` | 2010, 2112, 2160 | Cloud flags (`let`) |
| `hasStoredSbAuthToken`, `clearStoredSbAuthTokens`, `sessionIsExpired`, `cloudSignOutSilent` | 2011–2041 | Supabase session helpers. `cloudSignOutSilent` swaps `toast` to a no-op |
| `cloudSyncAgo`, `updateCloudSyncStatus`, `updateCloudLocalBanner` | 2085–2140 | Sync-status text and the local-only banner |
| `retryCloudSave`, `dismissCloudLocalBanner`, `openCloudLoginFromBanner` | 2142–2156 | Banner actions. Also set on `window` (L2154–2156) |
| `_render` | 2157 | Saved reference to the `render` before the wrapper |
| Dialog focus IIFE | 1887–1912 | MutationObserver on `#modalRoot`: role, focus trap, focus restore for every `.modal` |
| Keydown handler | 1913–1919 | Escape closes the modal; Tab is trapped inside it |

Note: `nxtfrm_cloud_banner_dismissed` (L2119, L2150) and `apm_sb_url` / `apm_sb_key` (L2120) are listed in 3.4.

---


## 2. Coaching logic map

Every threshold below is from the source as read. Units: body weight kg, "per week" = kg/week unless marked. Percent rules use `rate / ref × 100` where `ref` is the EWMA `lastAvg` (review L293).

### 2.1 Trend, band, forecast, plateau (engine maths)

| Rule | Value | Line | Effect |
|---|---|---|---|
| EWMA half-life | 7 days, alpha = 1 − 2^(−1/7) ≈ 0.094 | 108 | Smoothing of morning readings |
| EWMA restart gap | > 3 days between readings | 108, 115 | Average restarts from the new reading |
| Trend ready | 3 readings in the current run | 118 | `trendReady`; `trend()` hides `avg` until then (123) |
| Coverage | readings in trailing 7 days | 123 | `trend().coverage` |
| Confidence band | 14-day window, min 7 readings, ±1σ (K=1); σ = sample SD of residuals | 125–137 | Band for chart and forecast σ. Series not filtered by trendReady (127) |
| Forecast fit window | last 21 days of trend-ready rows, raw readings | 152, 161, 166 | `forecastGoal` |
| Forecast minimum | 3 points in window; fit needs sxx > 0 | 152, 163, 167 | Else "Not enough weigh-ins in the last three weeks to read a direction." (162) |
| Forecast target | `goalHigh()` (global, index.html 6083) | 158 | Arrival at the upper goal bound |
| Already at goal | EWMA `lastAvg ≤ target` → weeks 0, high (160); fitted gap ≤ 0 → weeks 0, high (181) | 160, 181 | "Already at goal range" |
| Slope floor | slope must be < −0.02 kg/day | 152, 169 | Else "Trend isn't moving toward goal yet." (169) |
| Forecast σ fallback | 0.5 kg when no band | 152, 174 | `sigmaLevel` |
| Forecast horizon | days = gap / −slope; σ_days = √((σ/slope)² + gap²·se²/slope⁴) | 177–182 | Mid, low and high weeks |
| Weeks rounding and cap | `cap(v)=min(104, max(0, round(v)))`; low ≥ 1; weeks ≥ low; high ≥ weeks | 152, 185–187 | Reported `weeks`, `lowWeeks`, `highWeeks` |
| Forecast confidence | `low` if n < 10 or span ratio > 2; `medium` if span ratio > 0.5; else `high`. Span ratio = (rawHigh − rawLow)/rawWeeks | 152, 189–190 | `confidence` |
| Plateau window | 28 days, raw readings, min 10 readings, span ≥ 14 days | 193, 199, 201 | `plateauWindow` returns null if thin |
| Plateau test | weeklyRate = slope×7; half = 2·SE·7; equivalence to ±0.15 kg/wk | 193, 204, 207–208 | `losing` if upper < −0.15; `gaining` if lower > 0.15; `flat` if both bounds inside ±0.15; else `undetermined` |
| Plateau flag | `plateau = status === "flat"` on the 28-day window | 238 | Only the 28-day window decides the flag |
| Plateau duration ladder | 35, 42, 49, 56, 63, 70, 77, 84, 90 days; each rung must be flat and span ≥ days − 7 | 194, 224–230 | `plateauDays` (last passing rung; else 28) |
| Plateau confidence | half < 0.075 → high; < 0.15 → medium; else low | 232 | `confidence` |
| Trend stats | 7-day windows ending today, −7, −14; need n ≥ 3 in both for change | 242–244 | `change`, `priorChange`, `percent` |

Plateau reason strings (`detectPlateau().reason`): L218 "Four weeks with at least 10 weigh-ins are needed before a plateau can be identified."; L234 "Your weight trend has been level for about N week(s). Food intake is not logged, so the app cannot identify the cause."; L235 "Your weight is still trending down, so this is not a plateau."; L236 "Your weight trend is moving up rather than levelling off."; L237 "Your readings vary too much over four weeks to separate a plateau from normal fluctuation. Keep logging."

Forecast reason strings (`forecastGoal().reason`): L156 "Log a few more weigh-ins before a forecast can be made."; L159 "Set your goal range to see a forecast."; L162 "Not enough weigh-ins in the last three weeks to read a direction."; L169 "Trend isn't moving toward goal yet."; L160/L181 "Already at goal range".

### 2.2 `review()`: verdict precedence (L276–310)

Evaluated top to bottom; the first match returns. `base` supplies the defaults (title "Building your baseline").

| # | Condition | Line | Title | Action | Tone |
|---|---|---|---|---|---|
| 1 | `detectPlateau().plateau === true` AND `diagnose().ok` AND verdict ≠ `insufficient_context`. Title = `diagnose().headline`. Message = fixed stall text: waist branch if `waistDown` (last two `cleanRows(cfg().waist,'cm')` rows, latest within 14 days, drop > 0.5 cm), else the generic text | 279–285 | `diagnose().headline` | none | neutral |
| 2 | Today's check-in: `energy ≤ 2` (and not blank) OR `soreness ≥ 4` | 287 | "Give recovery some attention" | "Review recovery" | watch |
| 3 | ≥ 2 lifts with status "Review" | 288 | "Review your training load" | "Review recovery" | watch |
| 4 | `rate === null`, where `rate = pl.ok ? pl.weeklyRate : s.change` | 291–292 | base: "Building your baseline" | "Keep logging" | neutral |
| 5 | `pct < −1` (% of body weight per week) | 300 | "Losing fast, and lifts are slipping" if `slipping`, else "Losing quickly" | "Review your target" | watch |
| 6 | `targetConfirmed` AND both 7-day averages within [goalLow(), goalHigh()] | 301–302 | "Your trend is in your goal range" | "Review your goal" | good |
| 7 | `rate < −0.15` | 303 | "Losing steadily, watch your lifts" (slipping); "Cutting steadily, strength holding" (all fresh lifts holding); else "Cutting steadily" | "Review recovery" (slipping) / "Stay consistent" | watch / good |
| 8 | `rate > 0.15` AND (`pl.status === "gaining"` OR (`change > 0.15` AND `priorChange > 0`)) | 304 | "Your weight is trending up" | "Review consistency" | watch |
| 9 | `\|change\| < 0.2` AND `\|priorChange\| < 0.2` | 305–308 | "Look beyond the scale" if `waistDown`, else "Time for a small review" | "Keep observing" / "Review your plan" | neutral |
| 10 | fallback | 309 | "Let the trend settle" | "Hold steady" | neutral |

Verdict text in rules 5 and 7 appends `strengthLine` (L297) and, for rule 7, `eta` (L298). `strengthLine` = "N of M tracked lift(s) is/are holding or improving." or "Strength history is still building, so muscle retention is not yet assessable."

Other review strings: rule 2 message "Your check-in suggests low energy or high soreness. Consider a shorter session or rest, and review how you feel before adding work."; rule 3 message "Several comparable lifts are down across repeated sessions. Check recovery and technique before changing calories or adding cardio."; rule 5 message (slipping) "Weight is dropping faster than usual while some lifts are down. Consider easing the deficit before strength suffers; this is a review prompt, not a diagnosis." (not slipping) "Check energy, hunger and strength before pushing further. " + strengthLine + " Early water changes can contribute; this is a review prompt, not a diagnosis."; rule 6 message "Two weekly averages are within your chosen range. Consider maintaining if you are happy with your progress; nothing changes automatically."; rule 8 message "The recent trend is rising, not flat. Check measurement conditions and consistency before changing anything; food intake is not logged, so the app cannot name the cause."; rule 10 message "One week is not enough to identify a plateau or explain a gain. Keep the plan consistent and reassess with more readings."

`why` (L299) = `${kg(rate)} over four weeks|the last week · ${|pct|.toFixed(1)}% of body weight`. `kg(v)` = signed, 2 decimals, "kg/wk".

Note: rule 7 uses the constant `PLATEAU_FLAT_KG_WEEK` (0.15), the same constant that defines plateau flatness. Rules 8 and 9 use literal 0.15 and 0.2.

### 2.3 `diagnose()`: verdict precedence (L376–477)

Computed inputs: `days = plateauDays || windowDays || 28` (378); window `[today−days+1, today]`; `adhMean` = Σ factors / days, with unlogged days counting as 0 (386); `waistDrop` = first − last `cleanRows(cfg().waist,'cm')` in window, when ≥2 rows (388); `lifts` = `strengthItems` with `delta ≤ −8` (389); `lowReady` = days with readiness score < 60 (401); `tdeeDrop` = first − last `tdeeHistory` in window (403–407).

Readiness score `recScore` (390–396): base 78; sleep term `min(10, max(−18, (s−6.5)·7))` when sleep is truthy (393); energy `(e−3)·6` with `e = energy || 3` (394); soreness `−max(0, sore−2)·8` with `sore = soreness || 2` (394); clamp to [35, 96] (395).

Verdicts, first match wins:

| # | Verdict | Condition | Line | Headline (exact) | Actions (kind) | Confidence |
|---|---|---|---|---|---|---|
| 1 | `no_issue` | `!plateau && f.ok && f.slope < 0` | 436–440 | "Cut is progressing." | "Keep the current plan." (hold) | high if f.confidence high AND p.ok AND p.confidence high; low if f.confidence low or !p.ok; else medium |
| 2 | `dietary_drift` | **CALORIES only.** `plateau && adhMean < .85` | 441–445 | `No weight change, but adherence is ${pct}%. This looks like compliance, not metabolism.` | "Tighten adherence before changing calories." (adjust) | rank(adhDays ≥ 14) |
| 3 | `water_masking` | `plateau && waistDrop > 0.5 && (!CALORIES \|\| adhMean ≥ .85)` | 446–451 | "Scale is flat, but waist is shrinking. This may not be a real plateau." | "Keep measuring waist; don’t cut calories yet." (hold) | rank(waist rows ≥ 2) |
| 4 | `recovery_deficit` | `plateau && (lifts ≥ 2 OR lowReady ≥ 5)` | 452–460 | "Strength or recovery is slipping. This looks like load, not metabolism." | "Deload or sleep more before cutting further." (hold) | rank(lifts ≥ 2 OR lowReady ≥ 5) |
| 5 | `metabolic_adaptation` | **CALORIES only.** `plateau && adhMean ≥ .85 && tdeeDrop ≥ 150` | 461–467 | "Likely metabolic adaptation, not a real plateau." | "A small calorie adjustment may be warranted." (adjust) | rank(hist ≥ 2 …) |
| 6 | `insufficient_context` | fallback | 468–476 | plateau: "Plateau confirmed. Not enough context to name the cause — keep logging {what} for {n} more day(s)." else "Not enough context to name the cause — keep logging {what} for {n} more day(s)." | "Keep logging {what} for {n} more day(s)." (diagnose_more) | medium if plateau AND p.confidence high, else low |

Extra evidence rows: `Forecast` (rule 1 only): "At goal range" or "~N week(s) to goal". `Waist` (rule 3): "−X.Y cm over N days". `Strength` (rule 4): first two lifts as "name x.x%" joined by " · ". `Readiness` (rule 4): "Below 60 on N day(s)". `TDEE` (rule 5): "X → Y kcal". `Needed` (rule 6): "{what} · N more day(s)".

Reasons: rule 1 "Weight is still trending down."; rule 2 "Adherence is below 85% over the plateau window."; rule 3 "Waist dropped while adherence held." (CALORIES) / "Waist dropped while the scale stayed flat." (calories off); rule 4 "Two or more lifts dropped at least 8%." when lifts ≥ 2, else "Readiness stayed below 60 for at least five days."; rule 5 "Adaptive TDEE fell N kcal over the plateau window."; rule 6 "Plateau confirmed, but no cause matched strictly." when plateau, else `p.reason || "Not enough data to diagnose."`.

`gap()` (428–435) decides `{what, need}` for rule 6, in this order: `!p.ok` → weigh-ins, `max(1, 10 − p.n)`; CALORIES and `adhLogged < 10` → adherence, `10 − adhLogged`; FEATURES.waist and waist rows < 2 → waist, `max(1, 2 − rows)`; CALORIES and TDEE snapshots short → "TDEE snapshots"; FEATURES.checkin and `lifts < 2 && lowReady < 5` → "recovery check-ins", `max(1, 5 − lowReady)`; default → **weigh-ins, 7** (fixed, not computed).

`rank(complete)` (420–424): `!p.ok` or confidence low/none → (complete ? medium : low); `p.confidence === high && complete` → high; else medium.

Base evidence (415–418): "Weight trend" value `±x.xx kg / week · N days` (409), tone neutral when undetermined or !ok, good when losing, else watch; "Plateau" value `N days` / "Undetermined" / "No plateau detected" (413), tone watch if plateau, good if losing, else neutral. Evidence is cut to 4 rows (426).

### 2.4 `review()` and `diagnose()` relationship

`review()` reads only `diagnose().ok`, `.verdict` and `.headline` (L280–284). It ignores `evidence`, `actions`, `reason` and `confidence`. Consequences: (a) the water_masking and recovery_deficit headlines can appear as review titles with generic body text; (b) `no_issue` can never reach review, because it requires `!plateau`; (c) with CALORIES off, only `water_masking` and `recovery_deficit` can reach review.

`bestSet` (L620–628) is the shared primitive: the heaviest set wins, and on equal weight the set with more reps wins (D20). `cue`, `aimFor`, `coachFor`, `safeLastSet` and the Train page all derive their numbers from it.

### 2.5 `cue()`: progression rules (L688–720)

Inputs: `t = targetFor(ex)`; `all = sessionRows(ex, gym, today, 100)`; `last = all.at(-1)`; `prev = all.at(-2)`; `weight` = best-set weight of last session; `gapDays` = days since last.

| Step | Condition | Line | Label | Weight | Why | Text |
|---|---|---|---|---|---|---|
| a | no history | 691 | "Set your baseline" | 0 | — | "Choose a manageable load and leave around two reps in reserve. Your first session establishes the baseline." |
| b | last session older than 28 days | 693, 695 | "Re-establish your baseline" | 0 | — | "This exercise history is over four weeks old. Choose a manageable starting load for today." |
| c | `gapDays > 14` (15–28 days) | 696–699 | "Ease back in" | `max(step, round(0.9·weight/step)·step)` | "Ease back in" | "It has been N days. Re-enter lighter, then build back up." |
| d | `!tired && earned && effortOkay && step` | 709–710 | "Ready to consider an increase" | `weight + inc × (reps ≥ hi+3 ? 2 : 1)` | — | two text variants (went past top; reached top in two sessions) |
| e | otherwise | 711–714 | "Keep today manageable" if tired, else "Hold load · build clean reps" | `weight` | see below | "Your check-in suggests fatigue…" / "Match your recent load within the rep range…" |

Definitions: `top(s)` = best set at this weight with reps ≥ hi (704). `over(s)` = reps > hi (706, D24). `effortOkay` = every set's RIR is null, blank, or ≥ 2 (707). `tired` = check-in `energy ≤ 2` (non-blank) or `soreness ≥ 4` (708). `earned = top(last) && (top(prev) || over(last))` (709). `step = inc > 0`.

Why strings for step e (713): "Tired today · hold"; "Low reserve · hold" (earned && !effortOkay); "No kg step set" (earned && !step); "Top once · repeat to add" (top(last)); `Under ${lo} · rebuild` (lowReps); else "".

Logs one `progression` suggestion per call (718).

### 2.6 `strengthItems()`: lift status words (L259–275)

Inputs per lift: `all` = sessions up to and including today, maxReps 15; `recent` = last 4; `fresh` = last session ≥ today − 21 days (265); the 4th-most-recent session ≥ today − 56 days (266).

| Status | Condition | Line | Tone |
|---|---|---|---|
| "Review" | `recent.length ≥ 4 && fresh && span ok` AND `value[2] < 0.95·baseline` AND `value[3] < 0.95·baseline` (sustained) | 269–270 | watch |
| "Improving" | not sustained AND `delta ≥ 2` | 270 | good |
| "Holding steady" | not sustained AND `−5 ≤ delta < 2` | 270 | good |
| "Watch" | not sustained AND `delta < −5` | 270 | neutral |
| "Older history" | not fresh AND has sessions | 272 | neutral |
| "Building data" | default | 264 | neutral |

`baseline = mean(value[0], value[1])`; `delta = (mean(value[2], value[3]) / baseline − 1) · 100` (267–268). `value` = Epley e1RM per session (`sessionRows`, L257).

### 2.7 `coachFor()` and `aimFor()`: next-target rules

`aimFor` (641–650): `kind` in this order: "reentry" when `cue().label === "Ease back in"` (reps `min(n, hi)`); "load" when `cue().weight > best weight` (reps from `repsAt`, L635–640, which uses `round(30·(w·(1+n/30)/newWeight − 1))` clamped to the rep range); "rep" when `n < hi` (reps `n+1`); else "match".

`coachFor` (654–687), in order: no history → kind "new" (headline "First session on this lift"); `gap > 28` days → kind "baseline" (`Back after N days`); `a.kind === "load"` → kind "load" (`Add X kg`, copy varies with whether `n > hi` and `steps > 1`); `a.kind === "reentry"` → "reentry" (`Ease back in`); `cue().label === "Keep today manageable"` → "tired" (`Keep it manageable`); `stalled && inc > 0` → "stall" (`Same best set three times`); `a.why === "No kg step set"` → "hold" (`Add a weight step`); `a.why === "Low reserve · hold"` → "hold" (`Keep a rep in hand`); `a.why === "Top once · repeat to add"` → "hold" (`Confirm the top`); `a.kind === "rep" && n < lo` → "rebuild" (`Rebuild the reps`); `a.kind === "rep"` → "rep" (`One more rep`); else "hold" (`Match your best`).

Constants: backoff = `max(step, round(0.9·w/step)·step)` (662); `stalled` = last three best sets with no improvement and oldest of the three within 28 days (670); `lighter = imp(best, prev)` (671). Per-set targets (664–667): drop-offs from last session's sets at the best weight; padded with the last known drop, or the set index.

`coachFor` returns `null` when the last session has no best set (658) or when `aimFor` returns null (661).

### 2.8 Calorie guide (gated, D49). Calculator rules

| Rule | Value | Line |
|---|---|---|
| Inputs | age 18–80, height 130–220 cm, weight 40–250 kg, activity ∈ {1.2, 1.375, 1.55, 1.725}, sex male/female | 313–314 |
| Eligibility | `p.eligible === true` | 315 |
| BMI floor | weight / (height/100)² < 18.5 → no cut | 316 |
| Resting energy | Mifflin–St Jeor: `10·w + 6.25·h − 5·age + (male ? 5 : −161)` | 317 |
| Maintenance | `round(resting × activity / 50) × 50` | 317 |
| Starting target | `round(maintenance × 0.85 / 50) × 50` (15% reduction) | 318 |
| Floor | target < 1500 (male) / 1200 (female) → error | 319, 892 |
| Save guard | target < 0.75 × maintenance → refused ("over 25% below") | 893 |
| Adherence factors | yes 1.0, close 0.95, no 0.85, over 1.1 | 332 |
| Adaptive TDEE window | 14 days; widened to 21 if < 10 days logged | 351, 357 |
| Adaptive TDEE preconditions | target set (361); ≥ 10 logged days (362); ≥ 5 weigh-ins (363); trend span ≥ 7 days (368) | 361–368 |
| Adaptive TDEE formula | `intake − (Δweight × 7700 / span)`, rounded to 10 kcal; plausibility 1000–5000 | 370–372 |
| Adaptive confidence | high if logged ≥ 12, weigh-ins ≥ 8, coverage ≥ 0.9; medium if logged ≥ 10 and weigh-ins ≥ 6; else low | 373 |
| TDEE snapshot | once per day, cap 180 rows | 478–485 |

Adaptive TDEE uses only logged adherence days for intake (370) but `diagnose()` averages adherence over every day in the window (386).

### 2.9 Cross-read map: who reads whose output

| Consumer | Reads from | Lines | Notes |
|---|---|---|---|
| `review()` | `detectPlateau()`, `diagnose()` (plateau only), `trendStats()`, `strengthItems()`, `forecastGoal()` (ETA only), `cfg().waist`, `cfg().recovery[today]`, `cfg().targetConfirmed`, `goalLow()/goalHigh()` | 277–305 | Uses diagnose only as headline |
| `diagnose()` | `detectPlateau()`, `forecastGoal()`, `adaptiveTDEE()` (always, even with CALORIES off), `strengthItems()`, `cfg().waist`, `cfg().recovery`, `cfg().tdeeHistory`, `cfg().adherence` | 377–403 | Does not read review() |
| `forecastGoal()` | `ewmaTrend()`, `lsFit()`, `trendConfidence()`, `goalHigh()` | 155–172 | |
| `trendConfidence()` | `ewmaTrend()` (unfiltered) | 127 | Band includes readings not yet trend-ready |
| `detectPlateau()` | `ewmaTrend()` (`lastAvg`), `plateauWindow()` → `windowStats()` | 198, 214 | |
| `cue()` | `targetFor()`, `sessionRows(…,100)`, `bestSet()`, `cfg().recovery[today]`, `logSuggestion()` | 689–718 | Does not call review() or diagnose(). Repeats the check-in "tired" rule of review() L287 |
| `aimFor()` | `targetFor()`, `sessionRows(…,100)`, `cue()`, `repsAt()` | 642–648 | |
| `coachFor()` | `targetFor()`, `sessionRows(…,100)`, `cue()`, `aimFor()`, `bestSet()` | 655–661 | |
| `strengthItems()` | `sessionRows(…)` (maxReps 15) | 263 | Consumed by review (277, 288), diagnose (389), strengthHTML (1363), `apx95StrengthItems` override (L1831) |

Output consumers outside the engine: `cue` (`training` 1476; `safeSuggestedWeight` override L1793; premium-ui 3 uses); `coachFor` (premium-ui 2 uses); `review` (`history` 1681; `apx95Verdict` override L1832; premium-ui 1 use); `diagnose` via `diagnosisCard` (chartHTML 1309). `reviewCard` renders at home (869), recoveryDay (1553), coachHTML (1677), openReview (899), chartHTML (1309), and the `enhancedRecoveryWarningHTML` override (L1834) when `review().tone === 'watch'`.

Suggestion log: `logSuggestion` is called by `cue` (L718, kind `progression`), `reviewCard` (L779, kind `review`) and `saveCalories` (L895, kind `calorie`). No code in this repository reads `cfg().suggestions`.

### 2.10 Strings the user will see most (verbatim, for copy review)

- Chart empty state: "Building your baseline"; body "Your actual readings will appear as dots. A trend line starts when a seven-day window has three readings." (L1181, 1179)
- Chart empty state alt: "No weigh-ins in this period" with "Choose All to see older entries, or log a current weight." (L1178–1179). **Stale**: the All range is gone (L1172).
- Trajectory headline (1083–1086): "Losing X.XX kg per week", "Trend is flat · N days" / "Trend is flat", "Trend is gaining", "Direction still settling".
- Range read (1243): "Weighed N/spanDays · P% of days".
- Chart summary (1246): "…Dotted steps mark each week’s morning average…". **No drawing of weekly steps exists in cut-support.js** (the step code at 1012–1033 is the Y-axis tick step).
- Readout (1080–1087) and summary (1246–1247): "Projection is a model estimate, shown dashed — not a measurement."

---

## 3. Storage map

### 3.1 `cfg()` keys: `settings.cutSupport`

`cfg()` (L45–53) creates `settings.cutSupport` if missing and forces these keys to the right container type on **every** call: objects `profile, templates, sessions, sessionTargets, recovery, adherence` (L48); arrays `waist, suggestions, tdeeHistory` (L49–51). Other keys are not normalised.

| Key | Shape | Written by (file:line) | Read by (file:line) | Notes |
|---|---|---|---|---|
| `profile` | `{age, height, weight, sex, activity, eligible}` | `saveCalories` L894 | `openCalories` L873; `saveGoal` L1621 (`profile.height`, default 176) | Calorie UI only |
| `templates` | `{"<gym>__<type>": [{name, sets, reps:[lo,hi], inc}]}` | `saveTemplate` L1662; `saveQueueAsTemplate` L1672; `mergeLegsIntoPump` L1752 (`__Legs`→`__Pump`) | `templateFor` L576 | Key has **no date** |
| `sessions` | `{"<date>__<gym>__<type>": {date, gym, type, finished:true, finishedAt, sets}}` | `finish` L1515; `resume` L1522 (delete); `undo` L1531 (delete); `mergeLegsIntoPump` L1752 | `planDone` L581 | Key from index.html `sessionKey()` (3562–3564) |
| `sessionTargets` | `{"<date>__<gym>__<type>": [exercise objects]}` | `ensureSessionPlan` override L1790 (if not array); `fullSession` L1527; index `setMinimumWorkoutMode(false)` L6973; `mergeLegsIntoPump` L1752 | `targetFor` L579; `exerciseDefByName` L1789 | **Written from a read path** (`ensureSessionPlan`, called for display from index.html) |
| `recovery` | `{"<date>": {sleep, energy, soreness, date}}`, blanks as "" | `saveRecovery` L1562; `install` L1768 (copies `state.read`) | `review` L277, L287; `cue` L708; `diagnose` L399–401; `coachHTML` L1677; `readiness` override L1805 | energy and soreness 1–5, sleep 0–24 |
| `adherence` | `{"<date>": {status: yes\|close\|no\|over, ts}}` | `logAdherence` L606 (not gated by CALORIES) | `adherenceIn` L334; `adaptiveTDEE` L355; `diagnose` L380–386 | |
| `waist` | `[{id, date, cm, ts}]` (unsorted) | `saveWaist` L1387; `deleteWaist` L1389 | `cleanRows(…,'cm')` L1371, L277, L387, L1379 | |
| `suggestions` | `[{id, date, kind, subject, payload, followed:null, ts}]`, cap 1000 | `logSuggestion` L600–601 (from `cue` L718, `reviewCard` L779, `saveCalories` L895) | **none in this repository** | Write-only. `followed` never set |
| `tdeeHistory` | `[{date, tdee, intake, weightChange, windowDays, confidence}]`, cap 180 | `maybeSnapshotTDEE` L484–485 (from `install` L1777 every load; `saveCalories` L896) | `diagnose` L403 | Written even with CALORIES off, when a calorie target exists |
| `calories` | number, kcal/day | `saveCalories` L894 | `adaptiveTDEE` L360; `calorieCard` L845; `openCalories` L879 | |
| `calorieUpdated` | date string | `saveCalories` L894 | none | Write-only |
| `maintenanceEstimate` | number, kcal | `saveCalories` L894 | `formulaTDEE` L347; `estimatedTotalBurnToday` L1830 | |
| `targetConfirmed` | boolean | `saveGoal` L1624 | `review` L301; `chartModel` L1008; `evidenceHTML` L1141; `diagnosisCard` L785; `journeyHTML` L1090 | Gate for goal-based output |
| `version` | number, 99 | `install` L1767, L1771 | `install` L1759, L1771 | V99 migration gate |
| `previousWeeklyPlan` | `{dow: type}` | `install` L1761 (copy of weeklyPlan before migration); **premium-ui.js:1884** (every single-day edit) | `restoreWeek` L1637; `mergeLegsIntoPump` L1742 | **Two writers with different meanings** |
| `previousCardioTarget` | number | `install` L1762 | none | Write-only |
| `prevPlan` | — | **No such key anywhere** (checked cut-support.js, index.html, premium-ui.js). The plan backup key is `previousWeeklyPlan` | — | — |
| `appearance` | object | premium-ui.js:2132 | premium-ui.js:43 | Not an engine key |
| `backupExportRequestedAt` | epoch ms | premium-ui.js:2194 | premium-ui.js:53, 1783 | Not an engine key |

### 3.2 Top-level `settings` keys touched by this file

Defaults from index.html `SETTINGS_DEFAULTS` (2714): `{startWeight:87.1, targetHigh:80, targetLow:78, tdee:2644, zone2WeeklyTarget:180}`. `settings` itself is loaded at 2715 and merged at 2716.

| Key | Type | Written by (file:line) | Read by (file:line) | Notes |
|---|---|---|---|---|
| `weeklyPlan` | `{0..6: type}`, keyed by JS `getDay()` (0 = Sunday) | `setDayType` L1574 ("every"); `saveWeek` L1634; `restoreWeek` L1641; `install` L1761, L1773; `mergeLegsIntoPump` L1742; **premium-ui.js:1885** (`setDay`); index 2719 (boot fills from `DEFAULT_WEEKLY_PLAN`); index 6043–6044 (legacy select); index 7335–7338 (`cycleWeeklyDay`, unreachable); index 6769–6771 and 7027–7031 (uncalled) | `typeFor` L573 (fallback only); `activitySummary` L552; `programmeHTML` L1627; index `planTypeForDow` 2748 | Always fully populated after boot (2719) |
| `dayOverrides` | `{date: type}` | `chooseSession` L1536; `setDayType` L1575; `moveDay` L1582; `install` L1766 (migration); `mergeLegsIntoPump` L1742. Index: `cycleDayType` 6464–6465 (overridden, unreachable); `applyDayOverrideForDate` 6472; `clearTodayOverride` 6478–6479; `setDateToToday` 6628; uncalled migrations 6765–6767, 7021–7025 | `typeFor` L573 (fallback); index `resolveDayType` 2753 | |
| `zone2WeeklyTarget` | minutes | `saveCardioGoal` L1678; `install` L1762–1763 (once: 180 → 90) | `activitySummary` L553; `home` L856; `cardioCard` L1549; `coachHTML` L1675; premium-ui.js:2055 | Index default 180 (2714); engine fallback 90 (`\|\| 90`) |
| `tdee` | kcal | `restoreData` (global `USER_TDEE` only) | `formulaTDEE` L345 (outranks the estimate); index `USER_TDEE` 2724 | Saved by the user, outranks the profile estimate |
| `cutStart` | date string | `saveCutStart` L1618 | `cutRangeDays` L978; `journeyHTML` L1101; `chartHTML` L1175; `goalsHTML` L1611 | |
| `startWeight` | kg | `saveCutStart` L1618 | index `START_WEIGHT` 2721; `goalsHTML` L1611; `restoreData` L1716; cloud merge L1998 | default 87.1 |
| `targetLow`, `targetHigh` | kg | `saveGoal` L1624; `restoreData` (via TARGET_*); cloud merge L1999–2000 | index `TARGET_LOW`/`TARGET_HIGH` 2722–2723 → `goalLow()`/`goalHigh()` (6082–6083) | Defaults 78 / 80 |
| `name` | string | premium-ui.js:68 (`settings.name = v`, then commit). Not written by this file | premium-ui.js:58 (`userName()`). Not read by this file | Owner display name; outside the engine |
| `goalLow`, `goalHigh` | kg | `saveGoal` L1624 | index 5915, 5919, 7594, 7595 — **fallback branches that never run** because `goalLow()`/`goalHigh()` always exist | **Effectively write-only** |

### 3.3 `state` fields and what index `persist()` saves

`persist()` (index 2891–2907) writes these keys and then calls `scheduleCloudSave()` (2905). `state` is initialised at index 2850–2875.

| State field | Written by this file (file:line) | Persisted to | Notes |
|---|---|---|---|
| `logs` | `logSet` L1505; `undo` L1531; `saveEditedSet` override L1877 | `apm_logs` | |
| `cardio` | `saveCardio` L1546 | `apm_cardio` | |
| `floorball` | read only (L522) | `apm_floorball` | |
| `bws` | `commitScanImport` L1448; `apx95SaveQuickWeight` L1873; `saveWeightEdit` L1462; `deleteWeight` L1464 | `apm_bws` | Weigh-ins; `Evo Scan` and `Post-workout` rows exist here |
| `scans` | `commitScanImport` L1449 | `apm_evo_scans` | |
| `rest` | restore only | `apm_rest` | |
| `read` | `saveRecovery` L1562; `readiness` override L1808 | `apm_current_read` | Current check-in |
| `gym`, `gyms` | `restoreData` L1715; cloud `applyCloudPayload` L1991–1992 (**cloud overwrites**) | `apm_current_gym`, `apm_gyms` | |
| `notifs` | `restoreData` L1715 | `apm_notifications` | Override ignores cloud `notifs` |
| `coachInsights` | `restoreData` L1712 (read from dump) | `apm_coach_insights` | Engine never writes insights |
| `sessionPlans` | `shorter` L1525; `fullSession` L1527; `ensureSessionPlan` override L1790; `mergeLegsIntoPump` L1752 | `apm_session_plans` | The live session queue (premium-ui.js:1036) |
| `exerciseNotes` | `saveEquipmentNote` L1850 | `apm_exercise_notes` | |
| `minimumWorkout` | `shorter` L1525; `fullSession` L1527; index `setMinimumWorkoutMode` L6961 | **not persisted** | Lost on reload while `sessionPlans` survives |
| `addOns` | none in this file | `apm_addons` | Absent from reset list (L1722), snapshot field map (L744) and cloud payload |
| `date`, `dayType`, `exercise`, `setNum` | many | not in `persist()`. `apm_last_open_date` is written separately (index 6632, 6653) | |
| `moreView`, `tab` | `more` L1590 | not persisted | |

### 3.4 localStorage and remote keys referenced by this file

| Key | Owner | Used at (file:line) |
|---|---|---|
| `apm_logs`, `apm_cardio`, `apm_floorball`, `apm_bws`, `apm_evo_scans`, `apm_rest` | index `persist` | snapshot field map L744; `validateBackup` L1698; `resetData` L1722 |
| `apm_settings` | index `persist` | snapshot L744; `validateBackup` L1697, L1701; `resetData` L1722 |
| `apm_notifications` | index `persist` | snapshot L744; `resetData` L1722 |
| `apm_session_plans`, `apm_coach_insights`, `apm_exercise_notes` | index `persist` | `restoreData` L1712; `resetData` L1722 |
| `apm_current_read`, `apm_current_gym`, `apm_gyms`, `apm_last_open_date` | index | `resetData` L1722 |
| `apm_addons` | index `persist` (2900) | **Not referenced by this file** |
| `apm_recovery_backup` | legacy | deleted from the dump inside `snapshot` (L739) |
| `nxtfrm_recovery_snapshot` | this file | `snapshot` L735; `exportSafety` L1685; `restoreSafety` L1690 |
| `nxtfrm_cloud_banner_dismissed` | this file | L2119, L2150 |
| `apm_sb_url`, `apm_sb_key` | user config | index `initSupabaseClient` 5363–5364; L2120 |
| `sb-…auth-token…` (Supabase) | Supabase client | L2015, L2028 |
| Supabase table `apexcut_profiles` | remote | save `upsert({user_id, data, updated_at}, onConflict user_id)` L2172 (retry without `updated_at` L2174–2175); load `select('data') … maybeSingle()` L2202 |

### 3.5 What the override block replaces (L1782–2237)

Each row is a global assignment in the override block. The index.html definition line is given where it exists. Rows marked "overwritten" are replaced again by premium-ui.js or others after this file loads.

| Global | Engine line | index.html line | Replacement and effect |
|---|---|---|---|
| `renderHome` | 1783 | 7039 | `NXT.home`. **Overwritten by premium-ui.js:2829** (`NXP.home`). premium-ui uses `NXT.home` as `base.home` (premium-ui.js:5) |
| `renderTrain` | 1784 | 7088 | `NXT.training`. **Overwritten** by premium-ui.js:2829. Used as `base.training` |
| `renderWeight` | 1785 | 7169 | `NXT.progress`. **Overwritten** by premium-ui.js:2829 |
| `renderHistory` | 1786 | 7431 | `NXT.history`. **Overwritten** by premium-ui.js:2829 |
| `renderMore` | 1787 | 7464 | `NXT.moreView`. **Overwritten** by premium-ui.js:2829 (`NXP.more`). Used as `base.more` |
| `getT` | 1788 | 2919 | `NXT.targetFor` (saved routine first). Original kept as `old.getT` (L29) |
| `exerciseDefByName` | 1789 | 3557 | sessionTargets, then templateFor, then old.getT, then `{sets:3, reps:[8,12], inc:2.5}`. Index original reads TEMPLATES and falls back to `type:"compound"` |
| `ensureSessionPlan` | 1790 | 3565 | Seeds from `NXT.templateFor` (saved routine), not `TEMPLATES`. **Drops** index's stale-Push repair (3569–3570) and empty-list reset (3571). Also creates `cfg().sessionTargets[key]` if missing |
| `setsDone`, `safeSetsDone` | 1791–1792 | 2937, 3424 | `NXT.done` |
| `safeSuggestedWeight` | 1793 | 3417 | `NXT.cue(ex).weight` (also logs a suggestion) |
| `safeLastSet` | 1794 | 3407 | Last session's last set, maxReps 100 |
| `logSet` | 1795 | 3740 | `NXT.logSet` |
| `apx96UndoLastSet` | 1796 | 7831 | `NXT.undo` |
| `completeDay` | 1797 | 2949 | `NXT.planDone` |
| `showSessionSheet`, `cycleDayType` | 1798–1799 | — / 6454 | `NXT.sessionPicker` (picker replaces the cycle button). Index `cycleDayType` body is unreachable |
| `showCardioSheet` | 1800 | — | `NXT.cardioModal` |
| `renderRest` | 1801 | 7160 | `NXT.recoveryDay` |
| `apx96OpenReadiness` | 1802 | — | `NXT.recoveryModal` |
| `apx96SaveReadiness` | 1803 | 7781 | `NXT.saveRecovery` |
| `readiness` | 1804–1823 | 2928 | Check-in aware. Score from `NXT.old.readiness()` (the index body); fallback `{score:78, known:false}` |
| `suggestedRestSeconds` | 1824 | 3305 | 150 s for press/row/pulldown/deadlift/squat (not tricep/pushdown), else 90 s |
| `weeklyLossRate` | 1825 | 3050 | `−trendStats().change` |
| `weekStartString` | 1826 | 6808 | `NXT.weekStart` |
| `zone2MinutesThisWeek`, `zone2MinutesThisWeekSafe` | 1827–1828 | 6571, 6826 | `NXT.cardioWeek` (both) |
| `projectedGoalDate` | 1829 | 3059 | Returns "No fixed deadline" |
| `estimatedTotalBurnToday` | 1830 | 3206 | `cfg().maintenanceEstimate` or `USER_TDEE` |
| `apx95StrengthItems` | 1831 | 7626 | `NXT.strengthItems` |
| `apx95Verdict` | 1832 | 7663 | `{...NXT.review(), score:null}` |
| `apx95SetView` | 1833 | 7546 | `NXT.setView` |
| `enhancedRecoveryWarningHTML` | 1834 | 7345 | `reviewCard()` when `review().tone === 'watch'`, else "" |
| `weeklyPlanHTML` | 1835 | 7316 | `NXT.weekHTML` (home week strip). **The index editor and `cycleWeeklyDay` are no longer rendered** |
| `workoutTemplateSettingsHTML` | 1836 | 6050 | `NXT.programmeHTML` |
| `apx96SetMoreView` | 1837 | 7896 | `NXT.more` |
| `restoreBackup` | 1838 | 5250 | `NXT.restoreData(window.pendingApexRestore)` |
| `applyCloudPayload` | 1839–1847 | 5334 | Type checks, snapshot, `NXT.old.applyCloudPayload` (merge, L1981), `NXT.install(false)`, toast on error. Index original is no longer reachable |
| `apx96OpenQueueManager` | 1848 | 7843 | Calls `NXT.old.apx96OpenQueueManager()`, then adds "Save queue as future programme" |
| `v88OpenNoteModal` | 1849 | 3644 | Equipment-note modal (`NXT.ui.noteExercise`) |
| `closeModal` | 1851 | 7167 | `NXT.old.closeModal()`, clears typing flag, restores focus |
| `apx95OpenQuickWeight`, `apx95SaveQuickWeight` | 1854, 1873 | — | Quick weigh-in modal and save. "new low" toast when Morning, prior ≥ 5 readings, and below their minimum |
| `saveEditedSet` | 1874 | 5608 | Edits a logged set; recomputes `volume` |
| `initCloudFromStorage` | 2043 | 5369 | Session check, silent sign-out on error or expiry, loads cloud when connected |
| `render` | 2157–2158 | 2982 | `_render` then `updateCloudSyncStatus()` and `readiness()` |
| `saveCloudNow` | 2161 | 5386 | Upserts `getCloudPayload()` to `apexcut_profiles` |
| `loadCloudNow` | 2193 | 5424 | Selects, `applyCloudPayload`, quiet `saveCloudNow(false)` write-back |

Global `toast` is swapped for a no-op in three places: `cloudSignOutSilent` (2040), `initCloudFromStorage` (2069–2071) and `loadCloudNow` (2215–2216). Each restores it in `finally`.

### 3.6 Cloud load: exact merge semantics

Pipeline: `loadCloudNow()` (2193) → `select data` (2202) → global `applyCloudPayload` override (1839) → type checks (1842–1843) → `NXT.snapshot('Before cloud load')` (1844; returns silently if the snapshot fails) → `NXT.old.applyCloudPayload(payload)` (1981) → `NXT.install(false)` (1845) → back in `loadCloudNow`: if `lastCloudMergeOk`, toast "Loaded from Supabase" and quiet `saveCloudNow(false)` (2219) → `render()`.

`NXT.old.applyCloudPayload(d)` (1981–2007):

- **Six record fields** `logs, bws, cardio, floorball, scans, rest` (1985–1990): `state[field] = unionById(local, cloud).rows` when the cloud value is defined.
- **`unionById`** (1947–1965): cloud rows first, keyed by `id`. A local row replaces the cloud row only if `recTs(local) > recTs(cloud)` (strict, L1959). **Ties keep the cloud row.** Rows without an `id` are concatenated from both sides (L1954, L1960), so repeated merges duplicate them. The reported `added` (L1963) counts every id-less cloud row.
- **`gyms`, `gym`** (1991–1992): **cloud overwrites local** when present.
- **`settings`** (1993–2003): `merged = {...d.settings, ...localSettings}` (L1995). **Local wins for every top-level key that exists locally** (`weeklyPlan`, `dayOverrides`, `zone2WeeklyTarget`, `tdee`, `startWeight`, ...). Then `merged.cutSupport = mergeCutSupport(local, cloud)` (1996). Then the five globals are reassigned from the merged settings (1998–2002).
- Then `persist()` (2005), which also schedules a cloud save (index 2905).
- **Not handled** by the override: `read`, `readiness`, `notifs`, `current`, `sessionPlans`, `exerciseNotes`, `coachInsights`, `addOns`. The index original handled `read`, `notifs` and `current` (5334–5361). `getCloudPayload` does not send `sessionPlans`, `exerciseNotes`, `coachInsights` or `addOns` (index 5311–5333).

`mergeCutSupport(local, cloud)` (1966–1980), per key of the union:

| Key | Rule | Lines |
|---|---|---|
| `adherence`, `suggestions`, `tdeeHistory` | **Local if non-empty, else cloud.** Whole object or array, no per-row union | 1971–1973 |
| `profile`, `templates`, `sessions`, `sessionTargets`, `recovery` (both sides plain objects) | Recursive local-wins merge (`mergeObjectsLocalWins`, 1936–1946) | 1975 |
| Any other key with a local value, including arrays (**`waist`**) and scalars | **Local wins** | 1976 |
| Key only in cloud | Cloud value | 1977 |

`mergeObjectsLocalWins` (1936–1946): local scalars win; both-plain recurses; arrays take the local value, because `isPlain` is false for arrays.

**Consequences.** (a) Cloud `waist` rows never merge in once the local array exists, which is always, because `cfg()` sets `waist: []` (L49). (b) Cloud-only dates in `recovery`, `templates`, `sessions` and `sessionTargets` do merge in. (c) Cloud-only `adherence` rows are dropped whenever the device has at least one adherence row. (d) Cloud `tdeeHistory` and `suggestions` are dropped whenever the device has any.

### 3.7 Safety copy (`snapshot`) rules

- Single slot: every call overwrites `localStorage.nxtfrm_recovery_snapshot` (733–758).
- Payload: `old.getFullBackup()` from index.html, minus the raw `localStorageDump` duplicates of logs, cardio, floorball, bws, scans, rest, settings and notifications (739, 744–746).
- Quota fallback: on a failed write, the previous copy is removed and the write retried; the previous copy is put back if that also fails (749–756).
- Call sites: `saveWeek` L1633 and premium-ui.js:1883 (`setDay`); `restoreWeek` L1640; `saveTemplate` L1661; `saveQueueAsTemplate` L1671; `restoreData` L1709; `resetData` L1721; `install` (V99) L1760; cloud load L1844.
- Failure toast: `snapshotFail` L730, unless `opts.quiet`.

---

## 4. Weekly plan and split resolution

### 4.1 Precedence for a given date, at runtime

| Order | Source | Where | Notes |
|---|---|---|---|
| 1 | `settings.dayOverrides[date]` (truthy) | index `resolveDayType` 2753–2754 | Dated overrides: `chooseSession`, `setDayType`, `moveDay`, `mergeLegsIntoPump` |
| 2 | `settings.weeklyPlan[getDay()]` (truthy) | index `planTypeForDow` 2747–2749 | JS `getDay()` on local noon (`dayOfWeekFor` 2743–2746) |
| 3 | `PLAN[dow].type` | index 2727–2735, read at 2748 | Built-in table. Reached only if step 2 is falsy. Boot (2719) pre-fills all seven days, so in practice it is not reached |
| 4 | `"Rest"` | index 2748, 2752 | Also returned for a missing key |

Engine: `typeFor(d)` (L571–574) returns `resolveDayType(d)` when that global is a function, which is always true at runtime because `cut-support.js` loads after the inline script. Its own fallback (L573) is `settings.dayOverrides?.[d] || settings.weeklyPlan?.[UTC weekday] || "Rest"`. That fallback skips `PLAN` and so differs from `resolveDayType`. It is dead in practice.

Weekday conventions differ. Engine dates are UTC noon (`dateMs`, L58), read with `getUTCDay()` (L61, L573). index.html uses local noon with `getDay()` (2743–2745). They agree for all timezones within ±12 h.

### 4.2 Three built-in split tables

| Table | Where | Content | Used when |
|---|---|---|---|
| `N.split` | cut-support L37 | 0 Rest, 1 FullA, 2 Zone2, 3 FullB, 4 Zone2, 5 FullC, 6 Zone2 (A/B/C rhythm) | V99 migration sets `weeklyPlan = copy(N.split)` (L1761); `install()` fills missing days from it (L1773); `restoreWeek(false)` (L1637) |
| `DEFAULT_WEEKLY_PLAN` | index 2718 | 0 Rest, 1 Push, 2 Pull, 3 Floorball, 4 Pump, 5 Floorball, 6 Legs | Boot merge (2719): `weeklyPlan = {...DEFAULT_WEEKLY_PLAN, ...stored}` |
| `PLAN` | index 2727–2735 | Same types as DEFAULT_WEEKLY_PLAN, plus labels and icons | `planTypeForDow` fallback (step 3 above). `planMeta` (index 5658) for labels |

Interaction: a brand-new profile first sees `DEFAULT_WEEKLY_PLAN` (2719), then the V99 migration (L1759–1761, when `cfg().version` is unset) replaces the plan with `N.split`. `previousWeeklyPlan` keeps the `DEFAULT_WEEKLY_PLAN` copy for such a profile.

### 4.3 `install()`: boot routine, step by step (L1756–1778)

1. `TEMPLATES[type] = copy(rows)` for `N.defaults` (FullA, FullB, FullC; L1757). This adds the A/B/C routines to the global `TEMPLATES`, which index.html's legacy code also reads.
2. `c = cfg()`.
3. If `!c.version && migrate`: `snapshot('Before V99 upgrade')` (1760). **If it fails, `install()` returns right there.** Otherwise:
   - `c.previousWeeklyPlan = copy(settings.weeklyPlan || {})` (1761). This is the pre-V99 plan.
   - `settings.weeklyPlan = copy(N.split)` (1761).
   - `c.previousCardioTarget = settings.zone2WeeklyTarget` (1762).
   - `zone2WeeklyTarget === 180` → 90 (1763).
   - If a set is logged today with a `dayType`, `dayOverrides[today] = that dayType` (1765–1766).
   - `c.version = 99` (1767).
   - If `cfg().recovery` is empty and `state.read.date` exists, copy `state.read` into it (1768).
4. `if (!c.version) c.version = 99` (1771). Loading an older backup therefore does not replace the programme (comment, 1770).
5. `mergeLegsIntoPump()` (1772).
6. `settings.weeklyPlan = {...N.split, ...settings.weeklyPlan}` (1773). Existing keys win.
7. `state.dayType = typeFor(today)`; `state.exercise = templateFor()[0]?.name` (1774).
8. `persist()` (1775, **not wrapped in try**); `maybeSnapshotTDEE()` (1777).

Callers: `NXT.install()` at 1920 (boot, **not wrapped in try**); `restoreData` L1717 (`install(false)`); `applyCloudPayload` override L1845 (`install(false)`).

### 4.4 D33: Legs becomes Pump

- Model: `typeNames()` (L40) excludes `Legs`, so `pickTypes` (L43) and `saveWeek` (L1630) reject it.
- Runtime migration: `mergeLegsIntoPump()` (L1739–1755), called by `install()` on every boot (L1772). It turns `'Legs'` into `'Pump'` in `settings.weeklyPlan`, `settings.dayOverrides`, `cfg().previousWeeklyPlan` (L1742) and `state.dayType` (L1743). It moves `__Legs` keys to `__Pump` in `templates`, `sessionTargets`, `sessions` and `state.sessionPlans` (L1752), **never overwriting an existing `__Pump` key** (L1749). Logged records are not rewritten (comment 1737–1738).
- Still visible: `programmeHTML` lists `['Push','Pull','Pump','Legs']` as editable saved routines (L1627). `names` maps both `Pump` and `Legs` to "Legs" (L38). Two different routines can therefore show the same label.
- Index migrations with the same intent, **none called anywhere in the repository**: `normalizeLegacyDayNames` (6762–6775), `migrateLegsCoreTemplate` (6778–6795), `migrateSingleLegsCoreCycle` (7019–7037).
- `cycleWeeklyDay` (index 7332) can write `'Legs'` (`WEEK_CYCLE_ORDER`, 7315). Its caller `weeklyPlanHTML` is overridden at L1835, so it is unreachable.

### 4.5 Every writer of the split

| Writer | Mutates | Guards | Scope | Line |
|---|---|---|---|---|
| `chooseSession(type)` (engine) | `dayOverrides[today]`; `state.dayType`, `state.exercise`, `state.setNum` | `typeNames()` only. **No logged-sets guard** | Today | L1534–1537 |
| `setDayType(date, type)` (engine) | `dayOverrides[date]`, or `weeklyPlan[dow]` with "every" (and deletes only that date's override) | Refuses if the date has logs (L1571) | One date or every weekday | L1569–1578 |
| `moveDay(from)` (engine) | `dayOverrides[from]` and `[to]` | Refuses if either date has logs (L1581); `to ≥ today` | Two dates | L1579–1584 |
| `saveWeek()` (engine) | `weeklyPlan`, all seven days | `typeNames()`; more than 3 lift days → confirm; snapshot | Whole plan | L1629–1635 |
| `restoreWeek(previous)` (engine) | `weeklyPlan` = `N.split` or `cfg().previousWeeklyPlan` | Confirm; snapshot | Whole plan | L1636–1642 |
| `install()` (engine) | `weeklyPlan` (migration, fill); `dayOverrides[today]` (migration) | `cfg().version` gate | Boot | L1759–1773 |
| `mergeLegsIntoPump()` (engine) | `weeklyPlan`, `dayOverrides`, `previousWeeklyPlan` | Idempotent | Boot | L1742–1743 |
| **`setDay(d, ty)`** (premium-ui.js) | `weeklyPlan[d]`; **`cfg().previousWeeklyPlan`** (premium-ui.js:1884) | `typeNames()`; snapshot | One weekday. Overwrites `previousWeeklyPlan` on every call | premium-ui.js:1880–1887 |
| index `cycleDayType` | `dayOverrides[today]` | — | **Overridden at load (L1799): unreachable** | index 6454–6470 |
| index `applyDayOverrideForDate` | `dayOverrides` (init only) | — | Called at index 2994 | index 6471–6474 |
| index `clearTodayOverride` | deletes `dayOverrides[today]` | — | Reachable: "RESET TODAY TO WEEKLY SPLIT" (index 6048) | index 6477–6485 |
| index `setDateToToday` | `dayOverrides` (init only) | — | Date roll (index 6643, 6649, 6662) | index 6625–6635 |
| index `cycleWeeklyDay(i)` | `weeklyPlan[dow]` (cycle includes "Legs") | — | **Unreachable** (`weeklyPlanHTML` overridden, L1835) | index 7332–7344 |
| index legacy `<select onchange>` in `splitSettingsHTML` | `weeklyPlan[d]` | — | Called from index 7471 and 7907. Reachability not traced | index 6034–6044 |
| index `normalizeLegacyDayNames` | renames in `dayOverrides`, `weeklyPlan` | — | **No callers** | index 6762–6775 |
| index `migrateSingleLegsCoreCycle` | renames in `dayOverrides`, `weeklyPlan` | — | **No callers** | index 7019–7037 |

### 4.6 Scope of a change

- `templates` keys are `gym__type` (no date). Editing a routine changes future sessions of that type at that gym.
- `sessions`, `sessionTargets` and `state.sessionPlans` keys are `date__gym__type` (index 3562–3564). A queue or target is per date. Editing a routine does not change an existing date's queue unless the queue is reset.
- `resetSessionOrder` (index 3590–3603) uses `NXT.templateFor` (saved routine) when present.
- index `cycleDayType` (unreachable) deletes `state.sessionPlans[sessionKey(next, date, gym)]` (index 6460).

### 4.7 The index.html functions named in the brief

| Name | Found? | Summary |
|---|---|---|
| `dayTypeFor` | **No.** No match in index.html | Nearest: `resolveDayType` (2750) |
| `planFor` | **No.** No match in index.html | Nearest: `planTypeForDow` (2747), `planMeta` (5658) |
| `weeklyPlan` | Yes, as `settings.weeklyPlan` (2719, 2748, 6043–6044, 6769–6771, 7027–7031, 7318, 7335–7338) | Plan keyed by `getDay()`. Read by `planTypeForDow` (2748), `weeklyPlanHTML` (7316, overridden), `cycleWeeklyDay` (7332, unreachable). Written by the boot merge (2719), the legacy select (6043), the uncalled migrations (6769, 7027) and `cycleWeeklyDay` (7338, unreachable) |
| `dayOverrides` | Yes, as `settings.dayOverrides` (2753, 6464–6479, 6628, 6765–6767, 7021–7025) | Dated overrides, read first by `resolveDayType`. Written by `cycleDayType` (overridden), `applyDayOverrideForDate`, `clearTodayOverride` (reachable), `setDateToToday`, and the two uncalled migrations |
| `applyCloudPayload` (5334–5361) | Yes | **Replaced at load** (engine L1839). Original: replaces state arrays wholesale when the cloud value is present (`d.logs \|\| state.logs`), applies `gyms`, `gym`, `notifs` (merged), `current` (date, dayType, exercise, setNum) and `read`; `settings = {...settings, ...d.settings}` (**cloud wins**); reassigns START_WEIGHT, TARGET_HIGH, TARGET_LOW, USER_TDEE, ZONE2_WEEKLY_TARGET; `persist()`. Nothing calls it after load: `loadCloudNow` is replaced (engine L2193) and calls the engine's override |
| `persist` (2891–2907) | Yes | Writes, each in its own try: `apm_settings`, `apm_notifications`, `apm_current_gym`, `apm_gyms`, `apm_session_plans`, `apm_addons`, `apm_exercise_notes`, `apm_current_read`, `apm_coach_insights`, `apm_logs`, `apm_cardio`, `apm_floorball`, `apm_bws`, `apm_rest`, `apm_evo_scans`. Calls `scheduleCloudSave()` (2905) unconditionally, then rethrows the first error (2906). **`minimumWorkout` is not written.** Callers that wrap it: `commit()` (engine L760–766) and `maybeSnapshotTDEE` (L486). Callers that do not: `install()` (L1775; an error escapes at the boot line L1920). `NXT.old.applyCloudPayload` (L2005) runs inside the override's try (L1841–1846) |
| `setMinimumWorkoutMode(on)` (6960–6980) | Yes | Sets `state.minimumWorkout`. On: `sessionPlans[key] = minimumPlanNames()` (regex, 3 per day type, 6952–6959). Off: restores `NXT.templateFor(dayType)` names and writes `NXT.cfg().sessionTargets[key]` (6971–6973). Recomputes `state.exercise` and `setNum`; persist; render; toast. **The flag is not persisted** |
| `ensureSessionPlan(type)` (3565–3575) | Yes | **Overridden at load (engine L1790).** Original: seeds `state.sessionPlans[key]` from `TEMPLATES[type]`; for Push, a stale-name repair (3569–3570: reset to base if the plan holds old names or lacks "Tricep Pushdown" or the Smith bench entry); resets an empty array to base (3571). Override: seeds from `NXT.templateFor` (saved routine), **keeps empty arrays, drops the Push repair**, and creates `cfg().sessionTargets[key]` |
| `resolveDayType(date)` (2750–2756) | Yes (extra; the engine's delegate) | `key = date \|\| state.date`; if `dayOverrides[key]` is set, return it; else `planTypeForDow(dayOfWeekFor(key))`. Pure. Callers: boot 2876, `applyDayOverrideForDate` 6473, `clearTodayOverride` 6480, `setDateToToday` 6629, `cycleWeeklyDay` 7340, engine `typeFor` L572 |

### 4.8 Who reads the resolved day type (engine)

`typeFor` (L571) is called by `weekHTML` (L851), `openDay` (L1565), `setDayType` (L1576), `moveDay` (L1582), `install` (L1774) and premium-ui.js (6 uses). `state.dayType` is set from it at boot (index 2876), at each date roll (index 6473, 6480, 6629), and in every engine write path above.

---

## 5. Smells

Facts only, with line numbers. Grouped by kind. No redesign proposed.

### 5.1 Contradictions and duplicated logic

1. **Two cloud-merge implementations.** The engine merge (L1936–2007) and the index original (index 5334–5361). The index one is unreachable after load but still defined. Settings precedence is opposite: cloud wins in the index (5353), local wins in the engine (L1995).
2. **Three built-in split tables** with different day types: `N.split` (L37: Mon FullA, Wed FullB, Fri FullC), `DEFAULT_WEEKLY_PLAN` (index 2718: Mon Push, Tue Pull, Wed Floorball, Fri Floorball), `PLAN` (index 2727). See 4.2.
3. **Two "minimum or shorter workout" definitions.** `NXT.shorter` takes the first three queue entries (L1525). `minimumPlanNames()` (index 6952–6959) picks three by regex per day type. Both write `state.sessionPlans`.
4. **Two Legs-to-Pump migrations.** `mergeLegsIntoPump` (L1739) runs; three index migrations (6762, 6778, 7019) are uncalled. Their scope differs: index also maps `Upper`, `Legs + Core`, `Zone 2 / Rest` (6765–6771, 7021–7031).
5. **Two readiness formulas.** `recScore` (L390–396) and index `readiness()` (2928–2931) both start at 78 with the same sleep term `min(10, max(−18, (s−6.5)·7))`. The engine copy feeds `lowReady` (L401). The index copy feeds today's header through `NXT.old.readiness()` (L1809). Only the first two lines of the index function were read.
6. **Waist drop defined twice.** `review()` (L282, L306): last two `cleanRows` waist rows, latest within 14 days, drop > 0.5 cm. `diagnose()` (L387–388, L446): first minus last waist row inside the plateau window, drop > 0.5 cm. Same threshold, different windows.
7. **Check-in "tired" rule written twice.** `review()` L287 (`energy ≤ 2` non-blank, or `soreness ≥ 4`) and `cue()` L708 (same thresholds, separate code).
8. **Two rep caps for the same data.** Progression (`aimFor`, `coachFor`, `cue`, `training`, `safeLastSet`) uses `sessionRows(…, 100)` (L642, 655, 689, 1476, 1794). Strength and review use the default 15 (L250, used by L263). Copy at L1364 describes only the 15 cap.
9. **Duplicated constants by comment.** `EWMA_GAP_DAYS = 3` (L108) and `BAND_GAP_DAYS = 3` (L923); `FORECAST_SIGMA_FALLBACK = .5` (L152) and `CONE_SIGMA_FALLBACK = .5` (L923). The comment at 920–922 says both must change together.
10. **90 percent step-back** computed in `cue` (L699, `weight·0.9`), again in `coachFor` (L662, `w·0.9`), and written as text in L678.
11. **Two `typeFor` implementations.** Engine fallback (L573) skips PLAN. `resolveDayType` (index 2750) uses it. See 4.1.
12. **Default exercise triple.** `exercise(ex, 3, 8, 12)` in `targetFor` (L579), `{sets:3, reps:[8,12], inc:2.5}` in the override (L1789), `{…, type:"compound"}` in index `exerciseDefByName` (3560).
13. **Two "first exercise" rules.** Index `cycleDayType` (6460), `setDateToToday` (6630), `clearTodayOverride` (6481) and `cycleWeeklyDay` (7341) use `TEMPLATES[...]`. Engine `install` and `saveWeek` use `N.templateFor()`.
14. **Goal fallbacks.** `goalLow()` uses `TARGET_LOW||80` and `TARGET_HIGH||82`; `goalHigh()` uses the same pair (index 6082–6083). Defaults in index 2722–2723 are 78 and 80.
15. **Two weekday conventions.** UTC noon `getUTCDay()` (L61, L573) and local noon `getDay()` (index 2743–2745). See 4.1.
16. **Two copies of the whole engine.** `classic/cut-support.js` (1,829 lines) differs from the root file (2,237 lines). `cmp` reports different. Also `classic/index.html`, `classic/premium-ui.js`.

### 5.2 Dead, unreachable or shadowed code

1. `moveDay` (L1579–1584): no callers anywhere. Exported at L1585.
2. `setGoalVisible` (L1358): no callers anywhere. Exported at L1465. `chartModel` accepts `showGoal` and says it is "accepted for API compatibility" (1002–1003). `N.ui.showGoal` is written only here.
3. `NXT.progress` (L1374) and `NXT.history` (L1679): reachable only through `renderWeight` and `renderHistory`, which premium-ui.js:2829 overwrites. No direct caller in the repository.
4. `NXT.home`, `NXT.training`, `NXT.moreView`: still live, but only as `base.home`, `base.training`, `base.more` in premium-ui.js:5. Their global seams (L1783, L1784, L1787) are overwritten at load.
5. `typeFor` local fallback (L573): unreachable while `resolveDayType` exists.
6. `formulaTDEE` (L343): used only by `tdeeCardHTML`, which returns "" while `CALORIES_ENABLED` is false (L490). premium-ui.js:1387 calls `tdeeCardHTML` anyway, so the call is inert.
7. `old.openEditSet` (L30): captured, never read in this file.
8. Index functions overridden at load and never reached: `cycleDayType` body (index 6454), `ensureSessionPlan` body (3565), `weeklyPlanHTML` body (7316), `applyCloudPayload` body (5334), `cycleWeeklyDay` (7332).
9. Index migrations with no callers: `normalizeLegacyDayNames` (6762), `migrateLegsCoreTemplate` (6778), `migrateSingleLegsCoreCycle` (7019).
10. `estimatedTotalBurnToday` (L1830) is a global override. Callers were not traced.
11. `chartModel` returns `goalRef: null` (L1057). No reader was checked.

### 5.3 Magic numbers (location list, not an exhaustive census)

- Weight sanity: 20–400 kg (L69, L96, L1461, L1873), waist 30–250 cm (L69, L1384, L1380).
- EWMA: half-life 7, gap 3, trend-ready 3 readings (L108, L118). Band: 14-day window, min 7 readings, K = 1 (L125).
- Forecast: 21-day window, min 3 points, trust 10, cap 104 weeks, slope floor −0.02 kg/day, σ fallback 0.5 kg, span ratios 2 and 0.5 (L152, L190).
- Plateau: 28 days, min 10 readings, span 14 days, 0.15 kg/wk, T = 2, ladder [35…90], slack 7, confidence half-widths 0.075 and 0.15 (L193–194, L232).
- Trend stats: 7-day windows and `n ≥ 3` (L242–244).
- review: 1% (L300), 0.15 (L303–304), 0.2 (L305), 0.5 cm (L282, L306), 14 days (L282, L306), energy ≤ 2 and soreness ≥ 4 (L287), 2 lifts (L288), goal range (L302).
- diagnose: 8% drop (L389), readiness 60 (L401, text L455, L459), 5 days (L452, L459), 0.5 cm (L446), adherence 0.85 (L412, L441, L444, L446), 150 kcal (L461), 10 logged days (L430), 7 days (L434), 14 (L430–431).
- Readiness: base 78 (L392, index 2930, override L1822), sleep reference 6.5 h × 7, cap +10 / −18 (L393), energy × 6 around 3 (L394), soreness × 8 above 2 (L394), clamp 35–96 (L395), defaults `energy || 3`, `soreness || 2` (L391).
- Strength: 4 sessions (L266), 21 days fresh (L265), 56 days (L266), 0.95 sustained (L269), +2 / −5 % (L270–271), top 24 (L274), Epley /30 (L257, L638), maxReps 15 (L250), 100 (L642, 655, 689, 1476, 1794).
- Progression: 14 and 28 days (L660, L693, L695–696), `reps ≥ hi+3` for double step (L710), `0.9` step-back (L662, L699), `Math.max(step, …)` (L662, L699), 3 sessions (L670), 2.5 kg default step (L31, L1657, L1789), 1 kg for some exercises (L33–35).
- Activity: 12-week default, cap 104 (L517–518); 90-minute weekly cardio default (L553, L856, L1549, L1675); 180 → 90 migration (L1763).
- Calories (gated): ages 18–80, heights 130–220, weights 40–250 (L314); activity multipliers 1.2, 1.375, 1.55, 1.725 (L314; repeated in the form at L876); BMI 18.5 (L316 and L1623); 0.85 (L318); 50-kcal rounding (L317–318); floors 1500 / 1200 (L319, L892); save guard 0.75 (L893); adherence 1, 0.95, 0.85, 1.1 (L332); 7700 kcal/kg (L371); TDEE window 14 and 21 (L351, L357); thresholds 10, 5, 7, 1000, 5000, 12, 8, 0.9, 6 (L362–373); cap 180 (L485); default height 176 (L1621, L875).
- Recovery copy and cap: 1000 suggestions (L601); 180 TDEE snapshots (L485).
- Rest timer: 60 s warm-up (L1510); 150 / 90 s (L1824).
- Charts: W 420, H 460, left 34, right 8, top 28, bottom 110 (L992); padX 12 (L1020); y-step tiers 0.5 / 1 / 2 (L1012); 0.6 pad (L1014); dense at 45 and 90 points (L1245, L1277); trend break after 7 days (L1029); `BAND_GAP_DAYS` 3, `FUTURE_MAX_DAYS` 42, `FUTURE_SHARE` 0.4 (L923); `startTxt` char width 6.1 (L1231); diamond 3.4 (L1205); halo 11 (L1290); endpoint 3.5 (L1202).
- Weekly plan bounds: sets 1–8, reps 1–30, inc 0–25, 15 exercises (L1658, L1657); cardio target 30–600 min (L1678); cardio duration 1–600, speed 0–80, incline 0–40, HR 30–240 (L1544).
- Scans and weigh-ins: duplicate key to one decimal (L1420, L1422).

### 5.4 Inconsistent guards and write paths

1. `chooseSession` (L1534–1537) has no logged-sets guard. `setDayType` (L1571) and `moveDay` (L1581) do.
2. `logAdherence` (L604–609) and `maybeSnapshotTDEE` (L478–488) are not gated by `CALORIES_ENABLED`. `maybeSnapshotTDEE` runs on every boot (L1777) and writes when a calorie target exists.
3. `review()` reads waist (L277) and check-ins (L287) without any FEATURES gate. `FEATURES.waist` and `FEATURES.checkin` only hide entry points (L331).
4. `diagnose()` calls `adaptiveTDEE()` unconditionally (L377), even though the calorie system is off.
5. `activityWeeks` counts floorball rows regardless of `FEATURES.floorball` (L522).
6. `programmeHTML` lists "Legs" as an editable routine (L1627), against D33.
7. `setDayType` "every" deletes only that date's override (L1574). Other dated overrides on that weekday remain, so "Make every <weekday> this" does not cover them.
8. `validTemplate` uniqueness is exact-string (L1658). Names are trimmed only in `captureDraft` (L1648), so "Ab Crunch" and "Ab Crunch " are distinct at save time only if untrimmed.

### 5.5 Writes during render or read paths

1. `cfg()` writes `settings.cutSupport` on every call (L45–53).
2. `reviewCard()` (L777–780) calls `logSuggestion` (L779), which calls `persist()` (L602) on each new suggestion. It renders on Home (L869), the Progress chart (L1309), the review modal (L899), the recovery page (L1553), the cardio and recovery page (L1677) and the enhanced warning (L1834). Each render can write.
3. `cue()` (L718) logs a suggestion. It is called from `training()` (L1476), `safeSuggestedWeight` (L1793), `aimFor` (L645) and `coachFor` (L661).
4. `chartHTML` writes `N.ui.chart`, `lastPlotted`, `chartAnim` (L1165–1171).
5. The `readiness()` override writes `state.read` and the header on every `render()` (L1808–1813, L2158).
6. The `ensureSessionPlan` override writes `cfg().sessionTargets` when called for display (L1790).
7. `install()` calls `maybeSnapshotTDEE()` on every boot (L1777).

### 5.6 Persistence gaps

1. `state.minimumWorkout` is set at L1525, L1527 and index 6961, and is not in `persist()` (index 2891–2907) or the state initialiser (index 2850–2875). After reload the flag is undefined while `apm_session_plans` holds the shortened queue.
2. `apm_addons` is written by index `persist()` (2900), but absent from the reset list (L1722), the snapshot field map (L744) and the cloud payload (index 5311–5333). Whether `getFullBackup()` (index, not read) includes it is unknown.
3. `cfg().suggestions` is never read here or elsewhere. `followed` is always `null` (L595). See 3.1.
4. `calorieUpdated` (L894) and `previousCardioTarget` (L1762) are written and never read.
5. `settings.goalLow` / `goalHigh` are written (L1624) and read only in fallbacks that never run (index 5915, 5919, 7594, 7595). See 3.2.
6. `unionById` keeps id-less rows from both sides (L1954, L1960), so repeated cloud merges duplicate them.
7. `state.read` is written by `saveRecovery` (L1562), by the `readiness` override (L1808) and by `install` (L1768). Only the first is a user action.

### 5.7 Cloud merge

1. **Cloud waist rows never merge in.** `mergeCutSupport` (L1976) takes the local array. `cfg()` always creates `waist` (L49). See 3.6.
2. **Whole-object local-wins** for `adherence`, `suggestions`, `tdeeHistory` (L1971–1973), with no per-row union.
3. **Top-level settings are local-wins** (L1995). A cloud `weeklyPlan`, `dayOverrides`, `zone2WeeklyTarget` or `tdee` is ignored whenever the device has the key.
4. **Ties keep the cloud row** (L1959, strict `>`).
5. **Override drops fields** the index original handled: `read`, `notifs`, `current` (index 5334–5361). See 3.6.
6. **Pull, merge, then push.** `loadCloudNow` writes back the merged state (L2219). Both steps save, so one load can produce two writes.
7. `added` (L1963) counts every id-less cloud row, so the console line (L2004) is inflated. Console only.
8. The merged `gym` and `gyms` come from the cloud (L1991–1992) while settings come from local. The two asymmetries are not documented in the file.

### 5.8 Start-up fragility

1. `NXT.install()` (L1920) is not wrapped in try. It calls `persist()` (L1775), which rethrows the first storage error (index 2906). A throw there stops this file's top-level code at that line. The later assignments are then skipped: `NXT.old.applyCloudPayload` (L1981), the `let` declarations at L1924–1926, the global overrides from L2043 to L2193, and `initCloudFromStorage()` (L2236). Function declarations are hoisted and still exist. Not executed; reasoned from code.
2. `install()` returns early when the V99 safety copy fails (L1760). `state.dayType` and `state.exercise` stay unset (L1774), and `persist()` is skipped (L1775). `cfg().version` stays unset, so the next load retries.
3. `resetData` returns silently when its safety copy fails (L1721). Intentional, but no toast is added beyond `snapshotFail`.

### 5.9 Stale or misleading copy

1. "Dotted steps mark each week's morning average" (L1246). No weekly-step drawing exists in the chart code (L982–1312). The step code at 1012–1033 is the Y-axis tick step.
2. "Choose All to see older entries, or log a current weight." (L1179). The All range became Cut (L983, L1172).
3. "Warm-ups and sets over 15 reps are excluded from the estimate" (L1364). True only for `strengthItems` (L250, L263). Progression uses 100 (see 5.1 item 8).
4. Empty chart: "A trend line starts when a seven-day window has three readings" (L1179). The code needs three trend-ready readings in a run (L118), not a seven-day window.
5. Hub row "Goals & calories … Your calorie guide" (L1595) is shown while `CALORIES_ENABLED` is false. The row label is hard-coded; the title switch at L1597 uses `N.features.calories`.
6. "Estimated 1RM is a comparison aid" (L1368) is shown while `repsAt` (L635–640) says its estimate is "never stored or shown as a 1RM". That comment is scoped to `repsAt`, so this is a wording point, not a contradiction.

### 5.10 Escaping and helpers

1. `card` (L775), `metric` (L776) and `heading` (L774) interpolate their arguments without escaping. `modal` (L770) escapes its title. Callers escape by convention (for example L1478), so safety depends on each call site.
2. `button` (L773) escapes the action string into an `onclick` attribute, which is correct for that context.

### 5.11 Minor

1. `undo()` calls `.reverse()` and then `.sort()` (L1529). The reverse has no effect.
2. `journeyHTML` declares `const done` (L1100), shadowing the module-level `done()`. Harmless.
3. `strengthItems` returns `family: name` (L273), a copy of `name` with no reader found.
4. `chartModel` discards `showGoal` with `void` (L1003).

---

## 6. Verification and limits

### 6.1 What was run (all read-only)

- Read `cut-support.js` lines 1–2237 in full.
- `node --check cut-support.js`: passes (syntax only; no execution).
- `grep -n` definition index of `cut-support.js` (function, const, let, assignments).
- Extracted the four `return` lists (L901, L1465, L1585, L1779): 70 + 30 + 22 + 27 = 149 exported members. Usage counts per member (ext and int) were computed under `LC_ALL=C` with word-boundary matching across root `.js`/`.html` files, plus `N.` alias counts for `premium-ui.js` and `strata.js`. Two earlier runs gave wrong counts (BSD grep does not support `\b` or `\s`; zsh does not word-split unquoted variables). The counts in section 1 come from the corrected run.
- Global override scan: `renderHome|renderTrain|renderWeight|renderHistory|renderMore|…` reassignments across `premium-ui.js`, `wearables*.js`, `train-anatomy.js`, `strata.js`, `seed*.js`. Found `premium-ui.js:2829` and `strata.js:1001–1005` (wraps). `wearables.recovery-integration.js:180` matched only a local `var readiness`.
- Load order from `index.html` `<script>` tags (grep -n only).
- Consumers: `premium-ui.js` lines 1–5, 1028–1046, 1876–1892, 2038–2068 and grep hits; `cfg()` external writers and readers (`premium-ui.js:43, 53, 1783, 1884, 2132, 2194`, `seed.scenarios.js` fixtures).
- Storage: readers of `suggestions`, `tdeeHistory`, `adherence`, `waist`, `calorieUpdated`, `maintenanceEstimate` outside the engine.
- `index.html`: grep -n for the names in the brief; ±40-line windows read for `resolveDayType` (2750), `planTypeForDow` and the `weeklyPlan` editor (2679–2790), `persist` (2851–2931), `ensureSessionPlan` (3525–3605), `applyCloudPayload` (5294–5374), dayOverrides writers (6424–6518, 6588–6668, 6725–6809), `setMinimumWorkoutMode` and migrations (6920–7067), `weeklyPlanHTML` and `cycleWeeklyDay` (7276–7375). Line-only greps for definitions of the overridden globals and for `sessionKey`, `goalLow`, `goalHigh`, `TEMPLATES`, `START_WEIGHT`, `template`, and similar.
- Nothing was executed beyond the syntax check. No test suite was run. No browser was used. No git command was run. No file was changed except this one.

### 6.2 Not read or not verified

- `index.html` outside the windows listed above. Notably: `template()` (3657), the body of `sessionKey()` (3562–3564, read as a one-line definition only), `getFullBackup()`, `renderFloorball`, `apx96MoreSectionHTML`, `apx96OpenQueueManager`, `readiness()` beyond its first lines, `splitSettingsHTML` (6034) beyond the select, the legacy `renderMore` path.
- `premium-ui.js`, `strata.js`, `wearables*.js` beyond the greps and windows above. Their actual use of `N.*` beyond counts was not traced.
- `classic/` beyond `cmp`.
- Runtime behaviour. Every claim about what happens at load, on merge or on render is a reading of the code. The start-up fragility (5.8) and the cloud-merge outcomes (3.6) are the most likely to differ from a live run.
- Usage counts are regex-based. The `int` column counts string occurrences in generated HTML and can over-count. Treat it as approximate.

---

