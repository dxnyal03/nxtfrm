# NXTFRM `index.html` inventory (read-only)

- **Repo / branch:** `/Users/alidanial/Documents/NXTFRM`, branch `ascension`. Anchored to `HEAD` (the state read when the run began on 2026-10-13).
- **File:** `index.html`, 8,025 lines, 342,033 bytes, `RELEASE 161` (`sw.js` line 1; every script and stylesheet is requested with `?v=161`).
- **Mode:** read-only. No repository file was edited, no git state was changed, and the app was not run. This file is the only output. Intermediate analysis lives in the session scratchpad.
- **Anchor and concurrent edits.** Every line number in this report refers to git `HEAD` `029eb51`, the state the run began from: `index.html` 8,025 lines, `premium-ui.js` 2,880 lines, `cut-support.js` 2,237 lines. The analysis ran on copies taken with `git show HEAD:<file>`. While the run was in progress, the parallel Ascension workstreams in `tasks/ascension/PLAN.md` changed the working tree: `index.html` (+116/−27, last changed 12:58:58), `premium-ui.js` (+244/−10, last changed 12:50:48) and `cut-support.js` (+46/−8, last changed 12:57:55). Section 9 lists those changes. The reachability results were re-checked against a 12:45 copy of `premium-ui.js`, and no status changed.
- **Line numbers** refer to `index.html` unless a file is named. "cut" = `cut-support.js` (NXT engine), "premium" = `premium-ui.js` (NXP), "strata" = `strata.js`.

## Legend and method

**Status values**

- **LIVE**: referenced from a live entry point. Entry points are `premium-ui.js`, `strata.js`, `cut-support.js`, shell markup and `onclick` strings, boot-time statements, and verified captured-original call sites (`NXT.old.X(...)` and the `…Source` / `_render` aliases). Reachability is followed transitively through function bodies. A row marked `live: cut-support.js` is referenced from the NXT engine only.
- **OVERRIDDEN**: a later script assigns the same global name. For functions, the original body does not run unless a wrapper calls it, and the table says so when one does. For data names (`let`/`const` values such as `settings`, `START_WEIGHT`), it means the value is reassigned later.
- **LEGACY-ONLY**: reached only from the legacy renderers (`renderHome`, `renderTrain`, `renderWeight`, `renderHistory`, `renderMore`, `renderRest`, `renderFloorball`), or only from code that cannot run. Rows marked "dead in practice" are referenced solely from NXT functions that are never called.
- **UNREFERENCED**: no reference from any live or legacy code.
- **SHADOWED**: a duplicate definition that a later definition overrides. The later one wins.

**Counts** (403 main-script declarations, duplicates counted separately): LIVE 169, OVERRIDDEN 47, LEGACY-ONLY 116, UNREFERENCED 67, SHADOWED 4.

**Method**

1. Declarations and parse-time statements of the main inline script (2713–7519) were extracted. A function span ends at the next column-0 closing brace. The parse-time statements and boot-time callbacks are listed in section 5.3.
2. Each name was searched in `premium-ui.js`, `cut-support.js`, `strata.js`, `train-anatomy.js`, `wearables*.js`, `seed.dev.js`, `seed.scenarios.js`, `sw.js`, the shell markup (2609–2712), the boot script (7948–8025), the tagged scripts (7521–7948), and the bodies of other main-script functions.
3. Overrides are top-level assignments and `function` declarations that run after the main script: `cut-support.js` 1781–2237, `premium-ui.js` 2811–2880, `strata.js` 1040 onward, `window.NAME=` anywhere, and the dynamic `window[name]=` list in `seed.dev.js`.
4. Captured originals count as live only at verified call sites. The call sites are `cut-support.js` 1809, 1845, 1848, 1851, 1602 (`NXT.old.apx96MoreSectionHTML`), and the premium wrappers at 2834–2845 and the `_render` alias at `cut-support.js` 2157–2158. Shorthand entries in the `NXT.old` capture object (`cut-support.js` 29–30) are not calls.
5. Legacy More UI: `premium-ui.js` 2037–2046 handles `hub`, `appearance`, `data`, `body`, `training` and `routine` itself, and calls the legacy router (`base.more` = `NXT.moreView`, `cut-support.js` 1592) only for other views. The router's training, goals and coach branches, and the `apx96MoreSectionHTML` training, goals, coach, body and data branches (`index.html` 7905–7916, 7911–7913, 7920–7922), are unreachable.
6. Dead-in-practice corrections were applied to five names whose only referencing code is never called (see the notes under section 1).

**Limits.** This is static text analysis. String-built calls, dynamic `window[name]` access and runtime-only paths are not modelled. Nothing was executed. Treat LIVE as "statically referenced from a live path", not "observed running in a browser".

## 1. Runtime-path functions (main inline script, 2713–7519)

Every top-level declaration of the main script is listed, in source order. Duplicates appear twice. "Reads / writes" gives the storage keys written or read through `save()`, `load()` and `localStorage` in the body, then the `state.*` and `settings.*` fields the body writes (W) or reads (R). Purposes for legacy and dead helpers are inferred from the name and body. Core paths were read.

**Notes on the table**

- **Legacy renderers.** `renderHome` 7039, `renderTrain` 7088, `renderWeight` 7169, `renderHistory` 7431, `renderMore` 7464, `renderRest` 7160 and `renderFloorball` 7151 are replaced at runtime. `premium-ui.js` 2829–2830 reassigns five of them and `cut-support.js` 1783–1787 and 1801 handle the rest. Their bodies still exist. Decision D5 (`tasks/vnext/DECISIONS.md`) gates deletion behind a separate audit.
- **`renderFloorball`** is defined twice. The later definition is in `apex-v96` at 7869. That one is only called from the legacy `renderTrain` (7089), so it is LEGACY-ONLY.
- **Wrapped originals (the original still runs).** `render` 2982 (`cut-support.js` 2158), `readiness` 2928 (1804), `closeModal` 7167 (1851), `getT` 2919 (1788, original via `NXT.old`), `apx96OpenQueueManager` 7843 (1848), and the `apex-v96` timer functions `apx96TickTimer` 7799 and `apx96StartRest` 7811 (`premium-ui.js` 2834–2845).
- **Overridden, original not called (body is dead).** `startWorkoutNow` 6443 (`premium-ui.js` 2853, which calls `NXP.enterTrain`), `applyCloudPayload` 5334 (`cut-support.js` 1839; the live merge is `NXT.old.applyCloudPayload`, reassigned at 1981), `initCloudFromStorage` 5369 (2043), `saveCloudNow` 5386 (2161), `loadCloudNow` 5424 (2193), `saveEditedSet` 5608 (1874), `v88OpenNoteModal` 3644 (1849).
- **Dead in practice (grep says LIVE, reachability says no).** `gymSettingsHTML` 3210, `renameGym` 3280 and `recentSetsHTML` 5630 are referenced only from NXT functions that are never called (`programmeHTML` at `cut-support.js` 1627, `training` at 1489). `jss` 3261 and `fmt` 2914 are referenced only from the same dead NXT code. `strata.js` defines its own local `fmt`. These five are reported as LEGACY-ONLY.
- **Duplicates.** `jss` (3260, 3261), `setGym` (3268, 3274), `logsForDate` (6204, 7235) and `renderFloorball` (7151, 7869). The later definition is the one that runs. `logsForDate` matters: `workoutTotals` (6261) calls the three-argument form, but the one-argument definition at 7235 wins, so the type and gym arguments are ignored. `workoutTotals` is itself reachable only through the intercepted legacy coach branch, so this is latent today.

- **Feature gates (HEAD).** `FEATURES` (`cut-support.js` 331) defaults `calories`, `floorball`, `wearable`, `waist`, `classic`, `reminders` and `checkin` to `false`, and `CALORIES_ENABLED` is `false` (327). Some rows marked LIVE are reachable only through UI those flags hide. `notificationsSettingsHTML` (5110) and the notification controls it renders (`toggleNotif` 5072, `updateNotifTime` 5073, `requestAppNotifications` 5036, `testAppNotification` 5066) are reached only from the Reminders row, which is hidden (`premium-ui.js` 2059). The Classic app link is hidden (2068). The Wearable row and the recovery home card are hidden (2065, 227). The 13 wearable scripts still load on every launch.

| Line | Name | Kind | Status | Live path / override | Purpose | Reads / writes |
|---:|---|---|---|---|---|---|
| 2714 | `SETTINGS_DEFAULTS` | data | LIVE | live: cut-support.js | Default settings: start 87.1 kg, target 78–80, TDEE 2644, Zone 2 180 min. | — |
| 2715 | `settings` | data | OVERRIDDEN | overridden by cut-support.js:1997 | Settings object from apm_settings. Holds weeklyPlan, dayOverrides, cutSupport, leanMode and goals. | R:apm_settings |
| 2718 | `DEFAULT_WEEKLY_PLAN` | data | LIVE | live: index top-level | Boot default for settings.weeklyPlan (Sun Rest, Mon Push, Tue Pull, Wed Floorball, Thu Pump, Fri Floorball, Sat Legs). Only fills missing days. | — |
| 2721 | `START_WEIGHT` | data | OVERRIDDEN | overridden by cut-support.js:1998 | Cached start weight from settings. Reassigned by goal save and by cloud merge. | settings R: startWeight |
| 2722 | `TARGET_HIGH` | data | OVERRIDDEN | overridden by cut-support.js:1999 | Cached upper lean-zone target. Reassigned by goal save and by cloud merge. | settings R: targetHigh |
| 2723 | `TARGET_LOW` | data | OVERRIDDEN | overridden by cut-support.js:2000 | Cached lower lean-zone target. Reassigned by goal save and by cloud merge. | settings R: targetLow |
| 2724 | `USER_TDEE` | data | OVERRIDDEN | overridden by cut-support.js:2001 | Cached TDEE from settings. Reassigned by goal save and by cloud merge. | settings R: tdee |
| 2725 | `ZONE2_WEEKLY_TARGET` | data | OVERRIDDEN | overridden by cut-support.js:2002 | Cached Zone 2 weekly minutes target. Reassigned by goal save and by cloud merge. | settings R: zone2WeeklyTarget |
| 2727 | `PLAN` | data | LIVE | live: cut-support.js | Static weekday to {type,label,icon} map. Used only when weeklyPlan lacks a day. | — |
| 2743 | `dayOfWeekFor` | fn | LIVE | live via resolveDayType | Day of week (0 = Sunday) for a YYYY-MM-DD string, read at local noon. | — |
| 2747 | `planTypeForDow` | fn | LIVE | live via resolveDayType | Session type for a weekday: settings.weeklyPlan, then PLAN, then Rest. | settings R: weeklyPlan |
| 2750 | `resolveDayType` | fn | LIVE | live: cut-support.js | The one resolver for a date: dated override, then weekly plan, then PLAN. Called at boot, render, rollover and overrides. | state R: date; settings R: dayOverrides |
| 2758 | `TEMPLATES` | data | LIVE | live: premium-ui.js | Built-in exercise lists per type (Push, Pull, Pump, Legs, Zone2). NXT.install adds FullA/B/C. | — |
| 2798 | `EXERCISE_ALIASES` | data | LIVE | live via exerciseFamily | Exercise family to accepted names. Shares history across renamed exercises. | — |
| 2827 | `apexInputActive` | fn | LEGACY-ONLY | legacy only (via v80Select) | True when an input, textarea or select has focus (V85 input guard). | — |
| 2831 | `apexBlurSafeRender` | fn | UNREFERENCED | no references | Runs fn only when no input is focused (V85). No caller. | — |
| 2836 | `exerciseFamily` | fn | LIVE | live: seed.dev.js | Maps an exercise name to its family base name via EXERCISE_ALIASES. | — |
| 2842 | `sameExerciseFamily` | fn | LIVE | live via previous | True when two exercise names share a family. | — |
| 2843 | `familyNames` | fn | LEGACY-ONLY | legacy only (via exerciseBelongsToDay, safeFamily, safeLastSet) | All alias names for an exercise family. | — |
| 2848 | `CARDIO_TYPES` | data | LIVE | live: cut-support.js | Cardio activity choices for the cardio log form. | — |
| 2850 | `state` | data | LIVE | live: premium-ui.js | Runtime state. 15 apm_* keys load at parse time. date, tab, minimumWorkout and typing flags are not persisted. | R:apm_addons R:apm_bws R:apm_cardio R:apm_coach_insights R:apm_current_gym R:apm_current_read R:apm_evo_scans  |
| 2878 | `load` | fn | LIVE | live: premium-ui.js | Reads localStorage JSON with a fallback. Corrupt JSON silently returns the fallback. | R:{k} |
| 2879 | `save` | fn | LIVE | live: premium-ui.js | Writes localStorage JSON. No try/catch, so a quota error throws to the caller. | W:{k} |
| 2886 | `sbClient` | data | LIVE | live via initSupabaseClient | Cached Supabase client, created by initSupabaseClient(). | — |
| 2887 | `cloudUser` | data | OVERRIDDEN | overridden by cut-support.js:2062; cut-support.js:2066; cut-support.js:2076 | Signed-in Supabase user (null when signed out). Reassigned by cut-support cloud code. | — |
| 2888 | `cloudStatusText` | data | OVERRIDDEN | overridden by cut-support.js:2062; cut-support.js:2067; cut-support.js:2077; cut-support.js:2168; cut-support.js:2180; cut-support.js:2185; cut-support.js:2200; cut-support.js:2205; cut-support.js:2213; cut-support.js:2230 | Cloud status label shown in the sync card. Reassigned by cut-support cloud code. | — |
| 2889 | `cloudTimer` | data | LIVE | live: cut-support.js | Debounce timer for scheduleCloudSave (900 ms). | — |
| 2891 | `persist` | fn | LIVE | live: premium-ui.js | Writes each apm_* key separately (D29), then scheduleCloudSave(). Throws the first error after all writes. | W:apm_addons W:apm_bws W:apm_cardio W:apm_coach_insights W:apm_current_gym W:apm_current_read W:apm_evo_scans ; state R: addOns,bws,cardio,coachInsights,exerciseNotes,floorball… |
| 2908 | `today` | fn | LIVE | live: premium-ui.js | Local-date YYYY-MM-DD for now. | — |
| 2912 | `uid` | fn | LIVE | live: cut-support.js | Random 8-character id for new records. | — |
| 2913 | `esc` | fn | LIVE | live: premium-ui.js | HTML-escapes a value for innerHTML. | — |
| 2914 | `fmt` | fn | LEGACY-ONLY | dead in practice: only from NXT.weekHTML (cut-support.js:852); strata.js defines its own local fmt | Short weekday/month/day label for a YYYY-MM-DD string. | — |
| 2915 | `val` | fn | LIVE | live: premium-ui.js | Value of an input by id, or empty string. | — |
| 2916 | `toast` | fn | OVERRIDDEN | overridden by cut-support.js:2040; cut-support.js:2041; cut-support.js:2070; cut-support.js:2071; cut-support.js:2216; cut-support.js:2225 | Shows a 1.7 s toast. Overridden temporarily to a no-op during cloud sign-out and load. | — |
| 2917 | `plan` | fn | LIVE | live: premium-ui.js | Plan metadata for state.dayType. | state R: dayType |
| 2919 | `getT` | fn | OVERRIDDEN | overridden by cut-support.js:1788 (original still runs via wrapper) | Finds a TEMPLATES exercise by name. Overridden: NXT.targetFor; the original is still called through NXT.old.getT. | — |
| 2920 | `latestWeight` | fn | LEGACY-ONLY | legacy only (via weightStats) | Latest weigh-in in state.bws, else START_WEIGHT. | state R: bws |
| 2921 | `weightStats` | fn | LEGACY-ONLY | legacy only (via homeProgressStripHTML, renderWeight) | Start, latest, lost, remaining and 7-entry average from state.bws. Legacy consumers only. | state R: bws |
| 2928 | `readiness` | fn | OVERRIDDEN | overridden by cut-support.js:1804 (original still runs via wrapper) | Heuristic 35–96 readiness score from state.read. Wrapped by cut-support (adds known:true). D4 keeps it until a reference audit; D9 forbids new scores. | state R: read |
| 2937 | `setsDone` | fn | OVERRIDDEN | overridden by cut-support.js:1791 | Logged sets today for an exercise family at the current gym. Overridden: NXT.done. | state R: date,gym,logs |
| 2938 | `dayProgress` | fn | UNREFERENCED | no references | Done and total sets for the legacy progress strip. No live caller. | — |
| 2939 | `previous` | fn | LIVE | live: premium-ui.js | Most recent logged sets for an exercise family at the current gym. | state R: gym,logs |
| 2947 | `suggest` | fn | UNREFERENCED | no references | Suggested next weight from the previous session. No caller. | — |
| 2948 | `autoNext` | fn | UNREFERENCED | no references | Advances state.exercise to the next exercise with sets left. No caller. | state W: exercise,setNum |
| 2949 | `completeDay` | fn | OVERRIDDEN | overridden by cut-support.js:1797 | True when every template exercise has its target sets logged. Overridden: NXT.planDone. | — |
| 2954 | `switchTab` | fn | LIVE | live: premium-ui.js | Validates the tab name, sets state.tab, persist()s and renders. Every tab tap therefore writes all keys and schedules a cloud save. | persist(); state W: tab |
| 2960 | `bindTabs` | fn | LIVE | live via render | Binds onclick once on each [data-tab] button (guarded by __apexBound). | — |
| 2976 | `apexForceRender` | fn | UNREFERENCED | no references | Clears typing flags and renders. No caller. | state W: typingWeight |
| 2982 | `render` | fn | OVERRIDDEN | overridden by cut-support.js:2158 (original runs via cut-support.js:2158 wrapper) | Main paint. Skips while an input is focused or typing. Runs applyDayOverrideForDate, rollToTodayIfNeeded, ensureLeanSettings, toggles pages, dispatches renderX and rebinds tabs. Wrapped by cut-support (adds sync status and readiness). | state R: tab,typingWeight |
| 3042 | `movingAverageData` | fn | LEGACY-ONLY | legacy only (via weeklyLossRate) | Three-to-seven entry moving average of weigh-ins (legacy weight trend). | state R: bws |
| 3050 | `weeklyLossRate` | fn | OVERRIDDEN | overridden by cut-support.js:1825 | Weekly weight-change rate from the moving average. Overridden: NXT.trendStats. | — |
| 3059 | `projectedGoalDate` | fn | OVERRIDDEN | overridden by cut-support.js:1829 | ETA text from the weight trend. Overridden to a fixed "No fixed deadline". | — |
| 3067 | `weightPaceLabel` | fn | UNREFERENCED | no references | Pace label (On track, Slow, Too fast) from the weekly rate. No caller. | — |
| 3075 | `zone2LogsThisWeek` | fn | UNREFERENCED | no references | Zone 2 cardio logs this week (legacy). No caller. | state R: cardio,date |
| 3086 | `zone2Minutes` | fn | UNREFERENCED | no references | Zone 2 minutes this week (legacy). No caller. | — |
| 3089 | `zone2TargetForDay` | fn | UNREFERENCED | no references | Hard-coded Zone 2 target text per day type. No caller. | state R: dayType |
| 3100 | `zone2Quality` | fn | UNREFERENCED | no references | Zone 2 quality label from duration and intensity. No caller. | — |
| 3108 | `smartProgression` | fn | UNREFERENCED | no references | Progression suggestion from the previous session (legacy). No caller. | state R: read |
| 3136 | `progressionHTML` | fn | UNREFERENCED | no references | Progression card HTML. No caller. | — |
| 3174 | `weeklyReportHTML` | fn | UNREFERENCED | no references | Weekly report card HTML. No caller. | state R: date,logs |
| 3193 | `activeCaloriesToday` | fn | UNREFERENCED | no references | Active-calorie estimate for today from cardio, floorball and lifting sets (legacy). | state R: cardio,date,floorball,logs |
| 3206 | `estimatedTotalBurnToday` | fn | OVERRIDDEN | overridden by cut-support.js:1830 | Burn estimate: USER_TDEE plus active calories. Overridden: NXT.cfg().maintenanceEstimate. | — |
| 3210 | `gymSettingsHTML` | fn | LEGACY-ONLY | dead in practice: only from NXT.programmeHTML (cut-support.js:1627), which only the intercepted legacy training branch reaches | Two-gym name editor card. Reached through NXT.programmeHTML. | state R: gyms |
| 3222 | `goalSettingsHTML` | fn | LEGACY-ONLY | legacy only (via renderMore) | Goal form card (lean zone, start weight, TDEE, Zone 2). Only in the intercepted apx96 goals branch. | settings R: startWeight,tdee,weeklyTarget,zone2WeeklyTarget |
| 3243 | `saveGoalSettings` | fn | UNREFERENCED | no references | Dead. Reads DOM ids (setStart, setTargetHigh...) that are absent from current markup. | persist(); settings W: startWeight,targetHigh,targetLow,tdee,zone2WeeklyTarget |
| 3260 | `jss` | fn | SHADOWED | duplicate; later definition at line 3261 wins | Escapes a string for a single-quoted inline onclick argument. Defined twice; identical bodies. | — |
| 3261 | `jss` | fn | LEGACY-ONLY (wins over duplicate) | dead in practice: only from NXT.training (cut-support.js:1488) and gymSwitcherHTML (no caller) | Escapes a string for a single-quoted inline onclick argument. Defined twice; identical bodies. | — |
| 3262 | `gymSwitcherHTML` | fn | UNREFERENCED | no references | Gym chip row. No caller. | state W: gyms; state R: gym |
| 3268 | `setGym` | fn | SHADOWED | duplicate; later definition at line 3274 wins | Sets state.gym, persist()s and renders. Defined twice; the second wins. | persist(); state W: gym |
| 3274 | `setGym` | fn | UNREFERENCED (wins over duplicate) | no references | Sets state.gym, persist()s and renders. Defined twice; the second wins. | persist(); state W: gym |
| 3280 | `renameGym` | fn | LEGACY-ONLY | dead in practice: only from gymSettingsHTML (dead in practice, see above) | Renames a gym and rewrites logs and cardio gym fields. Does not rekey sessionPlans, exerciseNotes or coachInsights. | persist(); state W: cardio,gym,gyms,logs |
| 3294 | `isIsolationExercise` | fn | LEGACY-ONLY | legacy only (via restReason, suggestedRestSeconds) | Name heuristic for isolation exercises (rest suggestion). | — |
| 3300 | `isHeavyCompound` | fn | LEGACY-ONLY | legacy only (via restReason, suggestedRestSeconds) | Name heuristic for heavy compounds (rest suggestion). | — |
| 3305 | `suggestedRestSeconds` | fn | OVERRIDDEN | overridden by cut-support.js:1824 | Rest seconds suggestion. Overridden: NXT engine. | state R: dayType,read |
| 3321 | `restRangeText` | fn | LEGACY-ONLY | legacy only (via safeRestRange) | Rest range label. Legacy. | — |
| 3330 | `restReason` | fn | LEGACY-ONLY | legacy only (via safeRestReason) | Rest reason text. Legacy. | state R: dayType |
| 3337 | `restSuggestionCardHTML` | fn | UNREFERENCED | no references | Rest suggestion card HTML. No caller. | state R: dayType,read |
| 3359 | `exerciseLogsForFamily` | fn | UNREFERENCED | no references | Logs for an exercise family. No caller. | state R: gym,logs |
| 3364 | `bestStatsBefore` | fn | UNREFERENCED | no references | Best set before a log id (PR helper). No caller. | — |
| 3376 | `detectPR` | fn | UNREFERENCED | no references | Personal-record detection. No caller. | — |
| 3390 | `showPRSheet` | fn | UNREFERENCED | no references | PR celebration sheet. No caller. | state R: gym |
| 3407 | `safeLastSet` | fn | OVERRIDDEN | overridden by cut-support.js:1794 | Wrapper returning the last set. Overridden: NXT.sessionRows. | state R: logs |
| 3417 | `safeSuggestedWeight` | fn | OVERRIDDEN | overridden by cut-support.js:1793 | Wrapper for the suggested weight. Overridden: NXT.cue. | — |
| 3424 | `safeSetsDone` | fn | OVERRIDDEN | overridden by cut-support.js:1792 | Wrapper for setsDone. Overridden: NXT.done. | state R: date,logs |
| 3431 | `safeRestSeconds` | fn | LEGACY-ONLY | legacy only (via safeRestRange) | Try-wrapper for suggestedRestSeconds. Legacy. | — |
| 3432 | `safeRestRange` | fn | LEGACY-ONLY | legacy only (via focusModeHTML) | Try-wrapper for restRangeText. Legacy. | — |
| 3433 | `safeRestReason` | fn | LEGACY-ONLY | legacy only (via focusModeHTML) | Try-wrapper for restReason. Legacy. | — |
| 3434 | `safeProgression` | fn | UNREFERENCED | no references | Try-wrapper for progression. No caller. | — |
| 3437 | `safeFamily` | fn | LEGACY-ONLY | legacy only (via sameExerciseForProgress) | Try-wrapper for exerciseFamily. Legacy. | — |
| 3441 | `logExerciseName` | fn | LEGACY-ONLY | legacy only (via sameExerciseForProgress) | Exercise name of a log row. Legacy. | — |
| 3442 | `sameExerciseForProgress` | fn | LEGACY-ONLY | legacy only (via comparableRowsForProgress, sortedExerciseLogs) | Progress-side exercise match. Legacy. | — |
| 3446 | `sortedExerciseLogs` | fn | LEGACY-ONLY | legacy only (via comparableRowsForProgress) | Sorted logs for an exercise. Legacy. | state R: gym,logs |
| 3456 | `rowsByDate` | fn | LEGACY-ONLY | legacy only (via comparableRowsForProgress) | Groups log rows by date. Legacy. | state R: date |
| 3465 | `comparableRowsForProgress` | fn | LEGACY-ONLY | legacy only (via progressiveOverloadStatus) | Rows used for overload comparison. Legacy. | state R: date,logs |
| 3478 | `progressiveOverloadStatus` | fn | LEGACY-ONLY | legacy only (via progressiveOverloadCardHTML) | Overload status from history. Legacy. | — |
| 3524 | `progressiveOverloadCardHTML` | fn | LEGACY-ONLY | legacy only (via focusModeHTML) | Overload card HTML. Legacy. | — |
| 3552 | `allExerciseDefs` | fn | LIVE | live via uniqueExerciseDefs | Flat list of all template exercise definitions. | — |
| 3557 | `exerciseDefByName` | fn | OVERRIDDEN | overridden by cut-support.js:1789 | Exercise definition for a name and type. Overridden: NXT.cfg().sessionTargets, then NXT.templateFor. | state R: dayType |
| 3562 | `sessionKey` | fn | LIVE | live: premium-ui.js | Key date__gym__type for sessionPlans and cfg().sessions and sessionTargets. | state R: date,dayType,gym |
| 3565 | `ensureSessionPlan` | fn | OVERRIDDEN | overridden by cut-support.js:1790 | Seeds today's exercise list for a type when missing. Overridden: NXT.templateFor (the isStalePush heuristic here no longer runs). | state W: sessionPlans; state R: dayType |
| 3577 | `moveSessionExercise` | fn | LIVE | live: premium-ui.js | Swaps two entries in today's queue, then persist()s and renders. | persist(); state W: exercise,sessionPlans; state R: dayType |
| 3590 | `resetSessionOrder` | fn | LIVE | live via apx96OpenQueueManager | Resets today's queue to the saved programme (NXT.templateFor). | persist(); state W: exercise,sessionPlans,setNum; state R: dayType |
| 3606 | `v88AllExerciseNames` | fn | LIVE | live: premium-ui.js | Sorted exercise picker list from templates and NXTLIB.names(). | — |
| 3617 | `v88NoteKey` | fn | LIVE | live: cut-support.js | Note key gym__exercise. | state R: gym |
| 3618 | `v88NoteFor` | fn | LIVE | live: premium-ui.js | Reads the gym note for an exercise from state.exerciseNotes. | state W: exerciseNotes |
| 3619 | `v88SetNote` | fn | LEGACY-ONLY | legacy only (via v88OpenNoteModal) | Saves the gym note to state.exerciseNotes, then persist()s. | persist(); state W: exerciseNotes |
| 3620 | `v88RemoveExercise` | fn | LIVE | live via apx96OpenQueueManager | Removes an exercise from today's queue (state.sessionPlans). | persist(); state W: exercise,sessionPlans,setNum; state R: dayType |
| 3626 | `sessionPlansSafe` | fn | LIVE | live via v88AddExercise | Ensures state.sessionPlans exists and returns it. | state W: sessionPlans |
| 3627 | `v88AddExercise` | fn | LIVE | live via v88OpenAddModal | Adds an exercise to today's queue (state.sessionPlans). | persist(); state W: exercise; state R: dayType |
| 3631 | `v88ReplaceAt` | fn | LIVE | live via v88OpenReplaceModal | Replaces one queue entry (state.sessionPlans). | persist(); state W: exercise,setNum; state R: dayType |
| 3636 | `v88OpenAddModal` | fn | LIVE | live: premium-ui.js | Opens the add-exercise modal. | — |
| 3640 | `v88OpenReplaceModal` | fn | LIVE | live via apx96OpenQueueManager | Opens the replace-exercise modal. | state R: dayType |
| 3644 | `v88OpenNoteModal` | fn | OVERRIDDEN | overridden by cut-support.js:1849 | Opens the gym note modal. Overridden: NXT.ui.noteExercise version. | state R: gym |
| 3648 | `workoutQueueHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain) | Legacy session builder card. Only from the legacy renderTrain. | state R: dayType,exercise |
| 3652 | `v88CurrentNoteHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain) | Legacy note card. Only from the legacy renderTrain. | state R: exercise,gym |
| 3657 | `template` | fn | LIVE | live: premium-ui.js | Today's exercise definitions: ensureSessionPlan mapped to exerciseDefByName. | state R: dayType |
| 3661 | `currentExerciseIndex` | fn | LIVE | live via showSubstituteSheet | Index of state.exercise in today's queue. | state R: exercise |
| 3667 | `replaceExerciseInSession` | fn | LIVE | live via showSubstituteSheet | Replaces an exercise in today's queue (onclick). | persist(); state W: exercise,sessionPlans,setNum; state R: dayType |
| 3683 | `nextExerciseAfter` | fn | LEGACY-ONLY | legacy only (via advanceToNextExerciseOrFinish, focusButtonLabel, skipExercise) | Next exercise in today's queue. | — |
| 3690 | `exerciseIsComplete` | fn | LEGACY-ONLY | legacy only (via focusButtonLabel, logSet) | Whether an exercise has all target sets logged. Legacy focus mode. | — |
| 3694 | `advanceToNextExerciseOrFinish` | fn | LEGACY-ONLY | legacy only (via logSet) | Moves to the next exercise or finishes. Legacy focus mode. | persist(); state W: exercise,setNum; state R: date,dayType,gym |
| 3712 | `focusButtonLabel` | fn | LEGACY-ONLY | legacy only (via focusModeHTML) | Focus-mode button label. Legacy. | — |
| 3719 | `getInputNumber` | fn | LEGACY-ONLY | legacy only (via logSet) | Reads a numeric input with fallback. Legacy. | — |
| 3725 | `currentTargetForExercise` | fn | LEGACY-ONLY | legacy only (via currentSetNumber, exerciseIsComplete, logSet) | Target sets and reps for the current exercise. Legacy. | — |
| 3728 | `ensureExerciseSelected` | fn | LIVE | live via showSubstituteSheet | Keeps state.exercise valid for today's queue. | state W: exercise |
| 3735 | `currentSetNumber` | fn | LEGACY-ONLY | legacy only (via logSet) | Next set number for an exercise. Legacy. | — |
| 3740 | `logSet` | fn | OVERRIDDEN | overridden by cut-support.js:1795 | Logs a set. Overridden: NXT.logSet. | persist(); state W: logs,setNum; state R: date,dayType,gym |
| 3796 | `skipExercise` | fn | LEGACY-ONLY | legacy only (via focusModeHTML) | Skips the current exercise (onclick). | persist(); state W: exercise,setNum |
| 3807 | `uniqueExerciseDefs` | fn | LIVE | live via showSubstituteSheet | Deduplicated exercise definitions. | — |
| 3819 | `pickerExerciseList` | fn | UNREFERENCED | no references | Filtered picker list for the replacement sheet. | state R: dayType |
| 3837 | `chooseReplacementExercise` | fn | UNREFERENCED | no references | Picks a replacement exercise (onclick). | state W: pendingReplaceExercise; state R: exercise |
| 3847 | `renderExercisePickerOptions` | fn | UNREFERENCED | no references | Picker option HTML. No caller. | state R: exercise,pendingReplaceExercise |
| 3864 | `showSubstituteSheet` | fn | LIVE | live: premium-ui.js | Substitute-exercise sheet. | state W: pendingReplaceExercise; state R: dayType |
| 3899 | `focusModeHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain) | Legacy focus-mode screen. Only from the legacy renderTrain. | state R: exercise |
| 3956 | `saveFocusSet` | fn | UNREFERENCED | no references | Legacy focus-mode save. No caller. | persist(); state W: logs; state R: date,dayType,exercise,gym,setNum |
| 3970 | `skipCurrentExercise` | fn | UNREFERENCED | no references | Legacy skip helper. No caller. | state W: exercise,setNum |
| 3979 | `dateKey` | fn | UNREFERENCED | no references | Helper that returns a Date for a date string. No caller. | — |
| 3980 | `monthCalendarDays` | fn | UNREFERENCED | no references | Month grid days. No caller. | — |
| 3995 | `dayTrainingType` | fn | UNREFERENCED | no references | Training type for a calendar day. No caller. | state R: floorball,logs,rest |
| 4008 | `dayClass` | fn | UNREFERENCED | no references | CSS class for a calendar day. No caller. | — |
| 4018 | `selectedHistoryDate` | fn | UNREFERENCED | no references | Selected history date. No caller. | state R: date,selectedHistoryDate |
| 4021 | `selectHistoryDate` | fn | UNREFERENCED | no references | Selects a history date. No caller. | state W: selectedHistoryDate |
| 4025 | `dayHistoryHTML` | fn | UNREFERENCED | no references | History detail HTML for a day. No caller. | state R: cardio,floorball,gym,logs |
| 4063 | `showZone2Prompt` | fn | LEGACY-ONLY | legacy only (via advanceToNextExerciseOrFinish) | Zone 2 prompt modal. Legacy. | state R: date,dayType |
| 4077 | `EVO_SPEC` | data | LIVE | live via evoFormHTML | Body-scan OCR field specification. | — |
| 4085 | `EVO_LABELS` | data | LIVE | live via evoFindLabels | Body-scan label vocabulary for OCR. | — |
| 4095 | `EVO_KEYS` | data | LIVE | live via evoFormHTML | Body-scan metric keys. | — |
| 4097 | `evoIsNumericToken` | fn | LIVE | live via evoNumbersIn | Whether an OCR token is numeric. | — |
| 4104 | `evoRepairNumeric` | fn | LIVE | live via evoNumbersIn | Repairs common OCR digit confusions. | — |
| 4115 | `evoLabelView` | fn | LIVE | live via evoExtractReport | Normalised OCR text view for label matching. | — |
| 4129 | `evoFindLabels` | fn | LIVE | live via evoExtractReport | Finds metric labels in OCR text. | — |
| 4147 | `evoRegionEnd` | fn | LIVE | live via evoExtractReport | End of a label region in OCR text. | — |
| 4158 | `evoNumbersIn` | fn | LIVE | live via evoExtractReport | Numbers found in an OCR slice. | — |
| 4175 | `evoInterpret` | fn | LIVE | live via evoExtractReport | Interprets an OCR number for a metric key. | — |
| 4189 | `evoTokenConf` | fn | LIVE | live via evoExtractReport | Confidence score for an OCR token. | — |
| 4203 | `evoSameValue` | fn | LIVE | live via evoDecide | Compares two values for one metric. | — |
| 4207 | `evoPrefer` | fn | LIVE | live via evoDecide | Preference rule between OCR candidates. | — |
| 4213 | `evoDecide` | fn | LIVE | live via evoExtractReport | Chooses the winning OCR candidate for one metric. | — |
| 4227 | `evoExtractReport` | fn | LIVE | live via readEvoScanOCR | Parses OCR text into a metric report. Live OCR path. | — |
| 4260 | `evoBlankField` | fn | LIVE | live via evoFormHTML | Empty OCR field record for one metric. | — |
| 4264 | `evoBlankReport` | fn | LIVE | live: premium-ui.js | Empty OCR report object. | — |
| 4269 | `evoFinite` | fn | LIVE | live via useLatestScanTDEE | Finite-number helper for scan values. | — |
| 4274 | `evoFmt` | fn | LIVE | live via evoDetailHTML | Formats a scan metric value for display. | — |
| 4280 | `evoProvenanceFor` | fn | LIVE | live via saveEvoScan | Provenance label for a value (entered or prior). | — |
| 4288 | `evoChangeRows` | fn | LIVE | live via evoMetricRows | Change rows between two scans. | — |
| 4309 | `evoSeries` | fn | LIVE | live via evoChartModel | Time series for one metric. | — |
| 4315 | `evoChartModel` | fn | LIVE | live via evoTrendSVG | Chart model (points and scale) for one metric trend. | — |
| 4325 | `evoShort` | fn | LIVE | live via evoBoardHTML | Short date label for scans. | — |
| 4331 | `evoResolveScanDelete` | fn | LIVE | live via evoDeleteScan | Decides which linked Evo Scan weigh-in (state.bws) a scan delete also removes. Morning weigh-ins are never removed. | — |
| 4354 | `evoReadOrientation` | fn | LIVE | live via readEvoScanOCR | Reads the EXIF orientation of a scan photo (JPEG/TIFF). | — |
| 4377 | `evoTiffOrientation` | fn | LIVE | live via evoReadOrientation | TIFF EXIF orientation parser. | — |
| 4401 | `EVO_INPUT` | data | LIVE | live via evoFormHTML | Map from metric key to form input id. | — |
| 4402 | `evoJobSeq` | data | LIVE | live via evoCancelForm | Counter for OCR job ids. | — |
| 4404 | `evoUi` | fn | LIVE | live: premium-ui.js | Body-scan UI state object. | state W: evoUi |
| 4408 | `evoOrdered` | fn | LIVE | live: premium-ui.js | Body scans sorted by date (premium-ui). | state R: scans |
| 4411 | `latestEvoScan` | fn | LIVE | live via useLatestScanTDEE | Latest body scan. | — |
| 4414 | `previousEvoScan` | fn | LEGACY-ONLY | legacy only (via scanDelta) | Scan before the latest. Legacy. | — |
| 4418 | `scanDelta` | fn | LEGACY-ONLY | legacy only (via evoScanSummaryHTML) | Change in one scan metric. Legacy. | — |
| 4425 | `evoStored` | fn | LIVE | live via evoCaptureForm | Normalises a stored scan record. | — |
| 4430 | `evoRender` | fn | LIVE | live via evoCancelForm | Repaints the body-scan page. | state W: typingWeight |
| 4439 | `scanImageToBase64` | fn | LIVE | live via readEvoScanOCR | Reads a scan photo file to base64. | — |
| 4447 | `evoBytesFromDataURL` | fn | LIVE | live via readEvoScanOCR | Decodes a data URL to bytes. | — |
| 4457 | `handleScanFile` | fn | LIVE | live via evoFormHTML | Handles a scan photo file input (onchange). | state W: currentScanImage |
| 4470 | `setScanStatus` | fn | LIVE | live via readEvoScanOCR | Sets the OCR status message. | — |
| 4476 | `evoLoadImage` | fn | LIVE | live via readEvoScanOCR | Loads a scan image into an element. | — |
| 4488 | `evoDrawOriented` | fn | LIVE | live via readEvoScanOCR | Draws an image onto a canvas with EXIF orientation. | — |
| 4514 | `evoEnhance` | fn | LIVE | live via evoDrawOriented | Contrast enhancement for OCR input. | — |
| 4543 | `evoThresholdCanvas` | fn | LIVE | live via readEvoScanOCR | Thresholds a canvas for OCR. | — |
| 4560 | `evoFoundCount` | fn | LIVE | live via readEvoScanOCR | Number of values found in an OCR report. | — |
| 4563 | `evoRecognize` | fn | LIVE | live via readEvoScanOCR | Runs Tesseract OCR on a canvas. | — |
| 4570 | `extractEvoValues` | fn | UNREFERENCED | no references | Old value extractor. No caller. | state R: currentScanImage |
| 4586 | `readEvoScanOCR` | fn | LIVE | live via evoFormHTML | Full scan-to-values pipeline (onclick). | state W: currentScanImage; state R: date |
| 4651 | `evoOpenForm` | fn | LIVE | live via evoBoardHTML | Opens the body-scan form (onclick). | — |
| 4658 | `evoCancelForm` | fn | LIVE | live via evoFormHTML | Closes the body-scan form. | state W: currentScanImage |
| 4666 | `evoOpenScan` | fn | LIVE | live via evoHistoryHTML | Opens a saved scan detail. | — |
| 4672 | `evoCloseDetail` | fn | LIVE | live via evoDetailHTML | Closes a scan detail. | — |
| 4678 | `evoSetTrend` | fn | LIVE | live via evoTrendHTML | Sets the scan trend metric (onclick). | — |
| 4683 | `saveEvoScan` | fn | LIVE | live via evoFormHTML | Saves a body scan to state.scans (apm_evo_scans), then persist(). | persist(); state W: bws,currentScanImage,scans; state R: date |
| 4723 | `evoCaptureForm` | fn | LIVE | live via useLatestScanTDEE | Reads the body-scan form into a record. | — |
| 4737 | `useLatestScanTDEE` | fn | LIVE | live via evoFormHTML | Copies the latest scan TDEE into settings.tdee. | persist(); state R: scans; settings W: tdee |
| 4752 | `evoDeleteScan` | fn | LIVE | live via evoDetailHTML | Deletes a scan from state.scans. Also removes a linked Evo Scan weigh-in from state.bws (not a morning one), then persist(). | persist(); state W: bws,scans |
| 4770 | `evoKindHTML` | fn | LIVE | live via evoFormHTML | Scan kind label HTML. | — |
| 4775 | `evoStatusHTML` | fn | LIVE | live via evoFormHTML | Scan status HTML. | — |
| 4779 | `evoBit` | fn | LIVE | live via evoHistoryHTML | One metric value from a scan, with provenance. | — |
| 4784 | `evoBackHTML` | fn | LIVE | live via evoBoardHTML | Body-scan back-face HTML. | — |
| 4787 | `evoMetricRows` | fn | LIVE | live via evoDetailHTML | Metric rows for a scan card. | — |
| 4795 | `evoCompHTML` | fn | LIVE | live via evoDetailHTML | Comparison HTML for one scan. | — |
| 4809 | `evoTrendSVG` | fn | LIVE | live via evoTrendHTML | Trend SVG for one metric. | — |
| 4830 | `evoTrendHTML` | fn | LIVE | live via evoAnalysisHTML | Trend block HTML. | — |
| 4835 | `evoChangedHTML` | fn | LIVE | live via evoDetailHTML | Changed-since-last-scan HTML. | — |
| 4841 | `evoHistoryHTML` | fn | LIVE | live via evoAnalysisHTML | Scan history list HTML. | — |
| 4851 | `evoProvenanceHTML` | fn | LIVE | live via evoDetailHTML | Provenance HTML for a scan. | — |
| 4863 | `evoFormHTML` | fn | LIVE | live via renderEvoScanPage | Body-scan manual entry form HTML. | state R: currentScanImage,date |
| 4890 | `evoDetailHTML` | fn | LIVE | live: premium-ui.js | Scan detail HTML. | — |
| 4914 | `evoAnalysisHTML` | fn | LIVE | live: premium-ui.js | Body-scan analysis block shared by Settings and Progress. | — |
| 4927 | `evoBoardHTML` | fn | LIVE | live via renderEvoScanPage | Body-scan board HTML. | — |
| 4936 | `renderEvoScanPage` | fn | LIVE | live: premium-ui.js | Body-scan page content (used by premium-ui and the More body view). | — |
| 4948 | `tempSubstituteContext` | data | UNREFERENCED | no references | Substitute-sheet state object. Dead. | — |
| 4950 | `fallbackSubstitutions` | fn | UNREFERENCED | no references | Fallback substitute options. Dead. | — |
| 4975 | `safeSubstituteOptions` | fn | UNREFERENCED | no references | Try-wrapper for substitute options. Dead. | — |
| 4983 | `useSubstituteTemp` | fn | UNREFERENCED | no references | Applies a temporary substitute. Dead. | state W: exercise,setNum; state R: dayType |
| 5031 | `notificationSupported` | fn | LIVE | live via testAppNotification | True when the Notification API exists. | — |
| 5032 | `notificationPermissionLabel` | fn | LIVE | live via notificationsSettingsHTML | Permission label text. | — |
| 5036 | `requestAppNotifications` | fn | LIVE | live via notificationsSettingsHTML | Requests notification permission (onclick). | persist(); state W: notifs |
| 5050 | `sendAppNotification` | fn | LIVE | live via testAppNotification | Sends a notification through the service worker or Notification API. | — |
| 5066 | `testAppNotification` | fn | LIVE | live via notificationsSettingsHTML | Sends a test notification (onclick). | — |
| 5072 | `toggleNotif` | fn | LIVE | live via notificationsSettingsHTML | Toggles one reminder in state.notifs, then persist()s (onclick). | persist(); state W: notifs |
| 5073 | `updateNotifTime` | fn | LIVE | live via notificationsSettingsHTML | Sets one reminder time in state.notifs, then persist()s (onclick). | persist(); state W: notifs |
| 5074 | `notificationDayKey` | fn | LIVE | live via checkScheduledNotifications | Per-day key for "already sent" tracking. | — |
| 5078 | `currentHHMM` | fn | LIVE | live via checkScheduledNotifications | Current HH:MM string. | — |
| 5082 | `weeklyDayCode` | fn | LIVE | live via checkScheduledNotifications | Weekday code for the backup reminder. | — |
| 5085 | `checkScheduledNotifications` | fn | LIVE | live: index top-level | Scheduler: weigh-in, Zone 2 and backup reminders. Runs every 30 s and once at 1.5 s. | persist(); state W: notifs |
| 5110 | `notificationsSettingsHTML` | fn | LIVE | live via apx96MoreSectionHTML | Reminder settings card (apx96 notifications view). | state R: notifs |
| 5155 | `maybeNotifyZone2` | fn | LEGACY-ONLY | legacy only (via showZone2Prompt) | Zone 2 reminder through the legacy prompt. | state R: notifs |
| 5162 | `installInstructionsHTML` | fn | LIVE | live via apx96MoreSectionHTML | Install help card (apx96 app view). | — |
| 5176 | `getFullBackup` | fn | LIVE | live: cut-support.js | Builds the backup object: structured records plus a localStorageDump of every apm_* key. Includes apm_sb_url and apm_sb_key. | state R: bws,cardio,date,dayType,exercise,floorball… |
| 5202 | `exportFullBackup` | fn | LIVE | live via backupRestoreHTML | Downloads nxtfrm-backup-DATE.json. | state R: date |
| 5212 | `readImportFile` | fn | LIVE | live via backupRestoreHTML | Reads a chosen backup file (onchange). | — |
| 5226 | `countMaybe` | fn | LIVE | live via previewRestore | Length of an array or 0. | — |
| 5227 | `previewRestore` | fn | LIVE | live via readImportFile | Summarises a backup before restore. | — |
| 5250 | `restoreBackup` | fn | OVERRIDDEN | overridden by cut-support.js:1838 | Restores a backup. Overridden by cut-support. | persist(); state W: bws,cardio,dayType,exercise,floorball,gym,gyms…; settings R: startWeight,targetHigh,targetLow,tdee,zone2WeeklyTarget |
| 5291 | `backupRestoreHTML` | fn | LIVE | live: premium-ui.js | Backup and restore card (apx96 data view). | — |
| 5311 | `getCloudPayload` | fn | LIVE | live: cut-support.js | Cloud payload: logs, cardio, floorball, bws, scans, rest, read, readiness, gyms, gym, settings, notifs, current{date,dayType,exercise,setNum}, savedAt. | state R: bws,cardio,date,dayType,exercise,floorball… |
| 5334 | `applyCloudPayload` | fn | OVERRIDDEN | overridden by cut-support.js:1839 | Pre-merge body. Dead: cut-support replaces it and reassigns NXT.old.applyCloudPayload. | persist(); state W: bws,cardio,date,dayType,exercise,floorball,gym…; settings R: startWeight,targetHigh,targetLow,tdee,zone2WeeklyTarget |
| 5362 | `initSupabaseClient` | fn | LIVE | live: premium-ui.js | Creates or returns the cached Supabase client from localStorage apm_sb_url and apm_sb_key. | R:apm_sb_key R:apm_sb_url |
| 5369 | `initCloudFromStorage` | fn | OVERRIDDEN | overridden by cut-support.js:2043 | Reads the stored session and sets cloudUser. Overridden by cut-support; the main-script call at 7497 still runs. | — |
| 5381 | `scheduleCloudSave` | fn | LIVE | live: seed.dev.js | Debounced (900 ms) saveCloudNow(false) when signed in. Blocked on deploy previews by seed.dev.js. | — |
| 5386 | `saveCloudNow` | fn | OVERRIDDEN | overridden by cut-support.js:2161 | Upserts the payload into apexcut_profiles (user_id + data). Overridden by cut-support (quiet mode). | — |
| 5424 | `loadCloudNow` | fn | OVERRIDDEN | overridden by cut-support.js:2193 | Selects apexcut_profiles.data and applies it. Overridden by cut-support, which also saves back. | — |
| 5447 | `cloudLogin` | fn | LIVE | live: seed.dev.js | Stores apm_sb_url and apm_sb_key, signs in with a password, then loads. Blocked on deploy previews. | W:apm_sb_key W:apm_sb_url |
| 5466 | `cloudSignup` | fn | LIVE | live: seed.dev.js | Stores apm_sb_url and apm_sb_key, signs up, then saves. Blocked on deploy previews. | W:apm_sb_key W:apm_sb_url |
| 5486 | `cloudSignOut` | fn | LIVE | live: premium-ui.js | Signs out and clears cloudUser. | — |
| 5496 | `cloudCardHTML` | fn | LIVE | live: premium-ui.js | Cloud status and sign-in card (apx96 data view). | R:apm_sb_key R:apm_sb_url |
| 5538 | `supabaseSQLHelpHTML` | fn | LIVE | live: premium-ui.js | SQL help text: apexcut_profiles table plus RLS policies for select, insert and update. | — |
| 5566 | `logDisplayName` | fn | LIVE | live via recentSetsHTML | Exercise name for a logged set. | — |
| 5569 | `logWeight` | fn | LIVE | live via recentSetsHTML | Weight of a logged set. | — |
| 5572 | `logReps` | fn | LIVE | live via recentSetsHTML | Reps of a logged set. | — |
| 5575 | `logSetNum` | fn | LIVE | live via recentSetsHTML | Set number of a logged set. | — |
| 5578 | `openEditSet` | fn | LIVE | live: premium-ui.js | Opens the edit-set modal. | state R: date,logs |
| 5608 | `saveEditedSet` | fn | OVERRIDDEN | overridden by cut-support.js:1874 | Saves an edited set. Overridden by cut-support. | persist(); state R: date,logs |
| 5622 | `deleteLoggedSet` | fn | LIVE | live via openEditSet | Deletes a logged set from state.logs (onclick). | persist(); state W: logs |
| 5630 | `recentSetsHTML` | fn | LEGACY-ONLY | dead in practice: only from NXT.training (cut-support.js:1489); premium-ui replaces training (2829) and base.training is never called | Recent sets list HTML. | state R: date,logs |
| 5658 | `planMeta` | fn | LIVE | live via plan | Label and icon metadata for a session type. | — |
| 5669 | `weekdayName` | fn | LEGACY-ONLY | legacy only (via splitSettingsHTML) | Short weekday name. | — |
| 5673 | `exerciseRecapHTML` | fn | LEGACY-ONLY | legacy only (via completionSummaryHTML) | Exercise recap for a finished day. Legacy. | state R: date,dayType |
| 5691 | `todayProgressStripHTML` | fn | UNREFERENCED | no references | Today progress strip. No caller. | — |
| 5701 | `todaysWorkoutLogHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain) | Today workout log. Legacy. | state R: date,dayType |
| 5722 | `completionSummaryHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain, showZone2Prompt) | Completion summary card. Legacy. | state R: date,dayType,gym |
| 5742 | `cutQualityScore` | fn | LEGACY-ONLY | legacy only (via renderWeight) | Cut quality score (legacy weight chart). | — |
| 5758 | `v72SmoothPath` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | SVG smoothing path for the legacy chart. | — |
| 5775 | `v72ShortDate` | fn | UNREFERENCED | no references | Short date label for the legacy chart. No caller. | — |
| 5783 | `v73FormatDelta` | fn | UNREFERENCED | no references | Signed delta text. No caller. | — |
| 5790 | `v75ParseDate` | fn | UNREFERENCED | no references | Date parse helper. No caller. | — |
| 5793 | `v75FormatDelta` | fn | UNREFERENCED | no references | Signed delta text. No caller. | — |
| 5800 | `v76RawWeightRows` | fn | UNREFERENCED | no references | Raw weight rows. No caller. | state R: bws,date |
| 5809 | `v76MovingAverage` | fn | UNREFERENCED | no references | Moving average. No caller. | — |
| 5817 | `v76Delta` | fn | UNREFERENCED | no references | Delta text. No caller. | — |
| 5822 | `v76WeeklyRows` | fn | UNREFERENCED | no references | Weekly rows. No caller. | — |
| 5834 | `v76LinearSlope` | fn | UNREFERENCED | no references | Linear trend slope. No caller. | — |
| 5844 | `v76ForecastInfo` | fn | UNREFERENCED | no references | Forecast info. No caller. | — |
| 5856 | `v76CoachText` | fn | UNREFERENCED | no references | Coach text for the old forecast. No caller. | — |
| 5869 | `v80DateLabel` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Date label for the legacy weight chart. | — |
| 5872 | `v80Delta` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Delta text for the legacy weight chart. | — |
| 5877 | `v80RawRows` | fn | LEGACY-ONLY | legacy only (via v80Rows) | Raw rows for the legacy weight chart. | state R: bws,date |
| 5886 | `v80AverageRows` | fn | LEGACY-ONLY | legacy only (via v80Rows) | Averaged rows for the legacy weight chart. | — |
| 5889 | `v80Rows` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Rows for the legacy weight chart. | — |
| 5893 | `v80Select` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Selects a point on the legacy weight chart (onclick). | persist(); state W: weightInspecting,weightSelectedDate |
| 5908 | `v80SelectedIndex` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Selected index on the legacy chart. | state R: weightSelectedDate |
| 5914 | `v80GoalLow` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML, v80FmtGoalRange) | Lower goal for the legacy chart. | settings R: goalLow |
| 5918 | `v80GoalHigh` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML, v80FmtGoalRange) | Upper goal for the legacy chart. | settings R: goalHigh |
| 5922 | `v80FmtGoalRange` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Goal range text for the legacy chart. | — |
| 5926 | `v80WeeklyStats` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML, v80CutRead) | Weekly stats for the legacy chart. | state R: date |
| 5933 | `v80CutRead` | fn | LEGACY-ONLY | legacy only (via premiumWeightChartHTML) | Cut read text for the legacy chart. | — |
| 5942 | `premiumWeightChartHTML` | fn | LEGACY-ONLY | legacy only (via renderWeight) | Legacy weight chart HTML (from renderWeight). | state R: weightInspecting,weightSelectedDate |
| 5995 | `strengthRetentionHTML` | fn | UNREFERENCED | no references | Strength retention card. No caller. | — |
| 6012 | `safeLatestEvoScan` | fn | LEGACY-ONLY | legacy only (via evoScanSummaryHTML) | Try-wrapper for latestEvoScan. | state R: scans |
| 6020 | `evoScanSummaryHTML` | fn | LEGACY-ONLY | legacy only (via renderWeight) | Scan summary card (legacy renderWeight). | — |
| 6034 | `splitSettingsHTML` | fn | LEGACY-ONLY | legacy only (via renderMore) | Legacy split editor (onchange writes settings.weeklyPlan). Only in the intercepted training branch, so unreachable. | persist(); state W: dayType; state R: date; settings W: weeklyPlan |
| 6050 | `workoutTemplateSettingsHTML` | fn | OVERRIDDEN | overridden by cut-support.js:1836 | Routine settings HTML. Overridden: NXT.programmeHTML. | state R: dayType |
| 6066 | `setGymAndRender` | fn | UNREFERENCED | no references | Sets the gym and renders (onclick). | persist(); state W: gym |
| 6071 | `setExerciseAndRender` | fn | LEGACY-ONLY | legacy only (via exerciseSelectHTML, workoutQueueHTML) | Sets the exercise and renders (onclick). | persist(); state W: exercise,setNum |
| 6077 | `goalRangeText` | fn | LEGACY-ONLY | legacy only (via homeProgressStripHTML) | Lean-zone text. Legacy. | — |
| 6082 | `goalLow` | fn | LIVE | live: premium-ui.js | Lower lean-zone bound (min of TARGET_LOW and TARGET_HIGH). | — |
| 6083 | `goalHigh` | fn | LIVE | live: premium-ui.js | Upper lean-zone bound. | — |
| 6084 | `updateGoalSettingsFromInputs` | fn | LEGACY-ONLY | legacy only (via goalSettingsHTML) | Saves goal inputs (goalLow, goalHigh, goalStartWeight, goalTDEE, goalZ2) to settings, then persist(). Live goal writer. | persist(); settings W: startWeight,targetHigh,targetLow,tdee,weeklyTarget |
| 6109 | `resetGoalSettings` | fn | LEGACY-ONLY | legacy only (via goalSettingsHTML) | Resets goal settings to defaults (onclick). | persist(); settings W: startWeight,targetHigh,targetLow,weeklyTarget |
| 6121 | `gymSelectorHTML` | fn | UNREFERENCED | no references | Gym selector HTML. No caller. | state R: gym,gyms |
| 6127 | `exerciseSelectHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain) | Exercise select HTML. Legacy. | state R: exercise |
| 6140 | `normalizeDayType` | fn | LIVE | live via dayTypeLabel | Case-insensitive day-type normaliser. Maps Legs to "Legs", not Pump. | — |
| 6150 | `exerciseBelongsToDay` | fn | LEGACY-ONLY | legacy only (via inferredLogDayType, latestCompletedDateForType) | Whether an exercise belongs to a day type. | — |
| 6175 | `inferredLogDayType` | fn | LEGACY-ONLY | legacy only (via latestCompletedDateForType) | Infers a day type from a log row. | — |
| 6192 | `cleanGymName` | fn | LEGACY-ONLY | legacy only (via coachInsightKey, generateCoachInsight, gymMatchesLog) | Trims a gym name, falling back to state.gym. | state R: gym |
| 6193 | `coachInsightKey` | fn | LEGACY-ONLY | legacy only (via backfillAllCoachInsights, generateCoachInsight, latestCoachInsight) | Key for coach insights: gym and type. | state R: dayType,gym |
| 6196 | `logGym` | fn | LEGACY-ONLY | legacy only (via gymMatchesLog) | Gym of a log row. | — |
| 6199 | `gymMatchesLog` | fn | LEGACY-ONLY | legacy only (via latestCompletedDateForType) | Whether a log row matches a gym. | state R: gym |
| 6204 | `logsForDate` | fn | SHADOWED | duplicate; later definition at line 7235 wins | Logs for a date. Defined twice; the second (1-argument) wins, so the 3-argument call in workoutTotals is ignored. | state R: date,dayType,logs |
| 6213 | `latestCompletedDateForType` | fn | LEGACY-ONLY | legacy only (via backfillAllCoachInsights, latestCoachInsight) | Latest completed date for a type. | state R: logs |
| 6227 | `latestCoachInsight` | fn | LEGACY-ONLY | legacy only (via completionSummaryHTML, homeCompletedSummaryHTML, renderHome) | Latest stored coach insight. Legacy. | persist(); state W: coachInsights; state R: dayType,gym |
| 6260 | `workoutTotals` | fn | LEGACY-ONLY | legacy only (via completionSummaryHTML, exerciseRecapHTML, generateCoachInsight) | Set count, volume and totals for a date. Calls the 1-argument logsForDate. | state R: date,dayType |
| 6271 | `generateCoachInsight` | fn | LEGACY-ONLY | legacy only (via backfillAllCoachInsights, completionSummaryHTML, latestCoachInsight) | Generates a coach insight for a workout. Legacy. | state R: date,dayType,gym |
| 6299 | `saveWorkoutInsight` | fn | LEGACY-ONLY | legacy only (via advanceToNextExerciseOrFinish, homeCompletedSummaryHTML, showZone2Prompt) | Stores a coach insight in state.coachInsights (apm_coach_insights). Legacy. | persist(); state W: coachInsights; state R: date,dayType,gym |
| 6307 | `backfillAllCoachInsights` | fn | LEGACY-ONLY | legacy only (via renderMore) | Backfills coach insights (onclick). Only in the intercepted coach branch. | persist(); state W: coachInsights; state R: gym,gyms |
| 6342 | `coachInsightObservation` | fn | LEGACY-ONLY | legacy only (via homeInsightCardHTML, professionalCoachInsightHTML) | Insight observation text. Legacy. | — |
| 6356 | `coachInsightAction` | fn | LEGACY-ONLY | legacy only (via homeInsightCardHTML, professionalCoachInsightHTML) | Insight action text. Legacy. | — |
| 6367 | `coachInsightSub` | fn | LEGACY-ONLY | legacy only (via professionalCoachInsightHTML) | Insight subtitle text. Legacy. | state R: gym |
| 6373 | `professionalCoachInsightHTML` | fn | LEGACY-ONLY | legacy only (via completionSummaryHTML, renderTrain) | Coach insight card HTML. Legacy. | state R: gym |
| 6420 | `startSessionPrompt` | fn | UNREFERENCED | no references | Starts a session. No caller. | — |
| 6421 | `confirmStartSession` | fn | UNREFERENCED | no references | Confirms a session start. No caller. | state W: gym |
| 6424 | `safeCall` | fn | UNREFERENCED | no references | Calls a render function and returns an error card on failure. No caller. | — |
| 6430 | `cycleGym` | fn | LIVE | live: premium-ui.js | Cycles to the next gym. Falls back to hard-coded gym names ["AF Redhill","SUTD"] when fewer than two are stored. | persist(); state W: gym; state R: gyms |
| 6438 | `gymToggleChipHTML` | fn | LEGACY-ONLY | legacy only (via renderHome) | Gym toggle chip HTML. Legacy. | state R: gym |
| 6443 | `startWorkoutNow` | fn | OVERRIDDEN | overridden by premium-ui.js:2853 | Legacy start: switchTab("train"). Overridden: premium-ui enters Train mode; the original is not called. | — |
| 6454 | `cycleDayType` | fn | OVERRIDDEN | overridden by cut-support.js:1799 | Legacy today-type cycle. Overridden: NXT.sessionPicker. | persist(); state W: dayType,exercise,sessionPlans,setNum; state R: date,gym; settings W: dayOverrides |
| 6471 | `applyDayOverrideForDate` | fn | LIVE | live via render | Recomputes state.dayType from resolveDayType(state.date). Runs on every render. | state W: dayType; state R: date; settings W: dayOverrides |
| 6477 | `clearTodayOverride` | fn | LEGACY-ONLY | legacy only (via splitSettingsHTML) | Deletes today's dated override and resets to the weekly split. Only in the legacy split editor; the live UI has no single-day clear. | persist(); state W: dayType,exercise; state R: date; settings W: dayOverrides |
| 6488 | `compactVolume` | fn | LEGACY-ONLY | legacy only (via homeInsightCardHTML) | Compact volume text. Legacy. | — |
| 6493 | `homeInsightCardHTML` | fn | LEGACY-ONLY | legacy only (via homeCompletedSummaryHTML, renderHome) | Legacy Home insight card. | state R: gym |
| 6541 | `homeProgressStripHTML` | fn | LEGACY-ONLY | legacy only (via homeCompletedSummaryHTML, renderHome) | Legacy Home progress strip. | — |
| 6552 | `homeFocusCardHTML` | fn | LEGACY-ONLY | legacy only (via renderHome) | Legacy Home focus card. | — |
| 6571 | `zone2MinutesThisWeek` | fn | OVERRIDDEN | overridden by cut-support.js:1827 | Zone 2 minutes this week. Overridden: NXT.cardioWeek. | state R: cardio,date |
| 6581 | `zone2CardHTML` | fn | LEGACY-ONLY | legacy only (via homeCompletedSummaryHTML, renderTrain) | Zone 2 card HTML. Legacy. | settings R: zone2WeeklyTarget |
| 6600 | `quickLogZone2` | fn | LEGACY-ONLY | legacy only (via zone2CardHTML) | Quick-logs Zone 2 minutes (onclick). | persist(); state W: cardio; state R: date |
| 6618 | `localToday` | fn | LIVE | live: premium-ui.js | Local-date YYYY-MM-DD (same as today()). | — |
| 6625 | `setDateToToday` | fn | LIVE | live via rollToTodayIfNeeded | Sets state.date to today, recomputes dayType and exercise, writes apm_last_open_date directly, then persist()s. | W:apm_last_open_date persist(); state W: date,dayType,exercise,setNum; settings W: dayOverrides |
| 6636 | `rollToTodayIfNeeded` | fn | LIVE | live: index top-level | Moves state.date to today when it is behind, or when the app stayed open past midnight. Called from bootApexcut, render and visibilitychange. | R:apm_last_open_date W:apm_last_open_date; state R: date |
| 6656 | `dateWarningHTML` | fn | LEGACY-ONLY | legacy only (via renderHome) | "Viewing <date>, not today" card. Legacy. | state R: date |
| 6674 | `migratePumpSessionPlans` | fn | UNREFERENCED | no references | Migration for Pump session plans. No call site (dead). | persist(); state W: sessionPlans |
| 6688 | `migrateLegsCoreToAbCrunch` | fn | UNREFERENCED | no references | Migration renaming a Legs Core exercise. No call site (dead). | persist(); state W: sessionPlans |
| 6706 | `todayWorkoutSummary` | fn | LEGACY-ONLY | legacy only (via homeCompletedSummaryHTML) | Today workout summary. Legacy. | state R: date,dayType,gym |
| 6717 | `isTodayWorkoutCompleted` | fn | LEGACY-ONLY | legacy only (via renderHome) | Whether today's workout is complete. Legacy. | — |
| 6724 | `homeCompletedSummaryHTML` | fn | LEGACY-ONLY | legacy only (via renderHome) | Legacy Home completed-summary card. | state R: date,dayType,gym |
| 6762 | `normalizeLegacyDayNames` | fn | UNREFERENCED | no references | Renames Upper and Legs + Core to Pump in weekly plan and overrides. No call site (dead). | persist(); state W: dayType; settings W: dayOverrides,weeklyPlan |
| 6778 | `migrateLegsCoreTemplate` | fn | UNREFERENCED | no references | Migration for Legs Core templates. No call site (dead). | persist(); state W: sessionPlans |
| 6798 | `ensureLeanSettings` | fn | LIVE | live via render | Writes default settings.leanMode (enabled true, minimumWorkout true) if missing. Runs on every render. | settings W: leanMode |
| 6808 | `weekStartString` | fn | OVERRIDDEN | overridden by cut-support.js:1826 | Monday date of the current week. Overridden: NXT.weekStart. | state R: date |
| 6814 | `hardTrainingDaysThisWeek` | fn | LEGACY-ONLY | legacy only (via enhancedRecoveryWarningHTML, leanCutScore, recoveryWarningHTML) | Hard training days this week. Legacy. | state R: cardio,logs |
| 6826 | `zone2MinutesThisWeekSafe` | fn | OVERRIDDEN | overridden by cut-support.js:1828 | Try-wrapper for Zone 2 minutes. Overridden: NXT.cardioWeek. | — |
| 6829 | `strengthRetentionSignal` | fn | LEGACY-ONLY | legacy only (via leanCutScore) | Strength retention signal. Legacy. | state R: logs |
| 6855 | `leanCutScore` | fn | LEGACY-ONLY | legacy only (via leanCutModeCardHTML, recoveryWarningHTML) | Lean-cut score. Legacy. | settings R: zone2WeeklyTarget |
| 6908 | `leanCutModeCardHTML` | fn | LEGACY-ONLY | legacy only (via homeCompletedSummaryHTML, renderHome, renderWeight) | Lean-cut mode card. Legacy. | — |
| 6928 | `recoveryWarningHTML` | fn | LEGACY-ONLY | legacy only (via enhancedRecoveryWarningHTML) | Recovery warning card. Legacy. | — |
| 6952 | `minimumPlanNames` | fn | LEGACY-ONLY | legacy only (via minimumWorkoutCardHTML, setMinimumWorkoutMode) | First three names in today's plan (minimum mode). | state R: dayType |
| 6960 | `setMinimumWorkoutMode` | fn | LEGACY-ONLY | legacy only (via minimumWorkoutCardHTML) | Sets the non-persisted state.minimumWorkout flag. Legacy card only. | persist(); state W: exercise,minimumWorkout,sessionPlans,setNum; state R: dayType |
| 6981 | `minimumWorkoutCardHTML` | fn | LEGACY-ONLY | legacy only (via renderTrain) | Minimum-workout card. Legacy renderTrain only. | state R: minimumWorkout |
| 6998 | `leanCutSettingsHTML` | fn | LEGACY-ONLY | legacy only (via renderMore) | Lean-cut settings card. Only in the intercepted goals branch. | persist(); settings R: leanMode |
| 7019 | `migrateSingleLegsCoreCycle` | fn | UNREFERENCED | no references | Migration for a single Legs Core cycle. No call site (dead). | persist(); state W: dayType; settings W: dayOverrides,weeklyPlan |
| 7039 | `renderHome` | fn | OVERRIDDEN | overridden by premium-ui.js:2829; cut-support.js:1783 | Legacy Home renderer. Overridden by premium-ui.js:2829 (NXP.home); cut-support.js:1783 (NXT.home) is replaced first. | state R: date,dayType,gym |
| 7084 | `pushDayNoteHTML` | fn | UNREFERENCED | no references | Empty stub returning "". No caller. | — |
| 7085 | `pullDayNoteHTML` | fn | UNREFERENCED | no references | Empty stub returning "". No caller. | — |
| 7086 | `pumpDayNoteHTML` | fn | UNREFERENCED | no references | Empty stub returning "". No caller. | — |
| 7088 | `renderTrain` | fn | OVERRIDDEN | overridden by premium-ui.js:2829; cut-support.js:1784 | Legacy Train renderer. Overridden by premium-ui.js:2829 (NXP.training). | persist(); state W: exercise,read; state R: date,dayType,gym |
| 7137 | `saveSet` | fn | UNREFERENCED | no references | Legacy set save. No caller. | persist(); state W: logs; state R: date,dayType,exercise,gym,setNum |
| 7151 | `renderFloorball` | fn | SHADOWED | duplicate; later definition at line 7869 wins | Legacy Floorball renderer. Defined twice; the apex-v96 definition at 7869 wins, but it is only called from the legacy renderTrain. | persist(); state W: floorball; state R: date |
| 7160 | `renderRest` | fn | OVERRIDDEN | overridden by cut-support.js:1801 | Legacy Rest renderer. Overridden by cut-support.js:1801 (NXT.recoveryDay). | — |
| 7164 | `showWeightPrompt` | fn | LIVE | live via apx96SaveFloorball | Opens the weigh-in prompt (onclick). | persist(); state W: bws; state R: date,dayType |
| 7167 | `closeModal` | fn | OVERRIDDEN | overridden by cut-support.js:1851 (original still runs via wrapper) | Clears the modal root. Wrapped by cut-support (calls NXT.old.closeModal and resets typing flags). | — |
| 7169 | `renderWeight` | fn | OVERRIDDEN | overridden by premium-ui.js:2829; cut-support.js:1785 | Legacy Progress renderer. Overridden by premium-ui.js:2829 (NXP.progress). | persist(); state W: bws,typingWeight; state R: date |
| 7219 | `dayTypeLabel` | fn | LIVE | live: premium-ui.js | Display label for a type (normalizeDayType plus planMeta). | state R: dayType |
| 7225 | `historyDateList` | fn | LEGACY-ONLY | legacy only (via renderHistory) | Dates for the legacy history list. Only from the legacy renderHistory. | state R: date |
| 7235 | `logsForDate` | fn | LIVE (wins over duplicate) | live: premium-ui.js | Logs for a date. Defined twice; the second (1-argument) wins, so the 3-argument call in workoutTotals is ignored. | state R: logs |
| 7238 | `cardioForDate` | fn | LIVE | live: premium-ui.js | Cardio logs for a date. | state R: cardio |
| 7241 | `bwForDate` | fn | LIVE | live: premium-ui.js | Weigh-ins for a date. | state R: bws |
| 7244 | `summaryForDate` | fn | LEGACY-ONLY | legacy only (via calendarViewHTML, renderHistory, showHistoryDay) | Day summary for the history calendar. | state R: dayType |
| 7254 | `strengthRetentionDetails` | fn | LEGACY-ONLY | legacy only (via strengthRetentionCardHTML) | Strength retention details. Legacy. | state R: logs |
| 7277 | `strengthRetentionCardHTML` | fn | LEGACY-ONLY | legacy only (via renderWeight) | Strength retention card (legacy renderWeight). | — |
| 7286 | `SMART_ALTS` | data | LIVE | live via smartAlternativesFor | Smart substitute map. | — |
| 7301 | `smartAlternativesFor` | fn | LIVE | live via showSubstituteSheet | Substitute options for an exercise. | — |
| 7314 | `WEEK_ROW_DOW` | data | LEGACY-ONLY | legacy only (via cycleWeeklyDay, weeklyPlanHTML) | Monday-first row to getDay() map used by the weekly editor. | — |
| 7315 | `WEEK_CYCLE_ORDER` | data | LEGACY-ONLY | legacy only (via cycleWeeklyDay) | Order used when cycling a weekday. | — |
| 7316 | `weeklyPlanHTML` | fn | OVERRIDDEN | overridden by cut-support.js:1835 | Weekly plan editor. Overridden: NXT.weekHTML. | settings W: weeklyPlan |
| 7332 | `cycleWeeklyDay` | fn | LEGACY-ONLY | legacy only (via weeklyPlanHTML) | Cycles one weekday in settings.weeklyPlan (onclick). Only in the legacy editor. | persist(); state W: dayType,exercise; state R: date; settings W: weeklyPlan |
| 7345 | `enhancedRecoveryWarningHTML` | fn | OVERRIDDEN | overridden by cut-support.js:1834 | Recovery warning HTML. Overridden: NXT.review. | — |
| 7356 | `calendarMonthState` | fn | LIVE | live: premium-ui.js | Calendar month state. | state W: historyMonth; state R: date |
| 7363 | `shiftHistoryMonth` | fn | LEGACY-ONLY | legacy only (via calendarViewHTML) | Moves the history calendar month (onclick). | persist(); state W: historyMonth |
| 7370 | `dateKeyFromParts` | fn | LIVE | live: premium-ui.js | Date string from year, month and day. | — |
| 7373 | `calendarTypeShort` | fn | LEGACY-ONLY | legacy only (via calendarViewHTML) | Short type label for a calendar cell. | — |
| 7380 | `calendarViewHTML` | fn | LEGACY-ONLY | legacy only (via renderHistory) | History calendar HTML. Legacy renderHistory only. | persist(); state W: historyMonth |
| 7431 | `renderHistory` | fn | OVERRIDDEN | overridden by premium-ui.js:2829; cut-support.js:1786 | Legacy History renderer. Overridden by premium-ui.js:2829 (NXP.history). The original is reached only from cut-support NXT.history, which has no caller. | — |
| 7464 | `renderMore` | fn | OVERRIDDEN | overridden by premium-ui.js:2829; cut-support.js:1787 | Legacy More renderer. Overridden by premium-ui.js:2829 (NXP.more). | — |
| 7487 | `exportJSON` | fn | OVERRIDDEN | overridden by premium-ui.js:2830 | Legacy JSON export. Overridden by premium-ui.js:2830 (NXP.exportBackup). | — |
| 7490 | `exportCSV` | fn | LIVE | live: premium-ui.js | CSV export of logs (download). | state R: logs |
| 7491 | `download` | fn | LIVE | live: premium-ui.js | Creates a Blob and triggers a download. | — |
| 7503 | `bootApexcut` | fn | LIVE | live: index top-level | Boot sequence on DOMContentLoaded: rollToTodayIfNeeded, bindTabs, render, then __nxSplashReady(). | — |

## 2. State and persistence

### 2.1 `state` object (2850–2875)

All fields are set at parse time. Keys are read with `load()`. Writes happen in `persist()` (2891–2906) unless noted.

| Field | Source | Stored key | Written by `persist()` | Notes |
|---|---|---|---|---|
| `tab` | literal `"home"` (2851) | none | no | Set by `switchTab` (2954) and the parse-time nav handler (2951). |
| `date` | `today()` (2852) | none | no | Always today at load. Rewritten by `setDateToToday` (6625–6633), the dead cloud body (5347) and `restoreBackup` (cut 1717). |
| `dayType` | `""`, then `resolveDayType` at 2876 | none | no | Derived. Recomputed on every `render()` by `applyDayOverrideForDate` (6471–6474). |
| `exercise`, `setNum` | literals (2854–2855) | none | no | Session cursor. |
| `logs` | `load("apm_logs",[])` (2856) | `apm_logs` | yes | Logged sets. |
| `cardio` | 2857 | `apm_cardio` | yes | Cardio logs. |
| `floorball` | 2858 | `apm_floorball` | yes | Floorball logs. |
| `bws` | 2859 | `apm_bws` | yes | Weigh-ins. |
| `scans` | 2860 | `apm_evo_scans` | yes (last write) | Body-scan records. Photos are no longer stored (D30, 4696). |
| `rest` | 2861 | `apm_rest` | yes | Rest records. |
| `read` | 2862 | `apm_current_read` | yes | Sleep, energy and soreness check-in. Also in the cloud payload. |
| `gym` | 2863 | `apm_current_gym` | yes | Current gym name. |
| `gyms` | 2864 | `apm_gyms` | yes | Gym names (default `["Gym A","Gym B"]`). |
| `notifs` | 2865, defaults 2881–2883 | `apm_notifications` | yes | Reminder settings and the sent map. |
| `coachInsights` | 2866 | `apm_coach_insights` | yes | Coach insight store (legacy engine). |
| `sessionPlans` | 2867 | `apm_session_plans` | yes | Keyed `date__gym__type` (`sessionKey`, 3562). |
| `addOns` | 2873 | `apm_addons` | yes | Optional strength add-ons, kept separate from `sessionPlans` on purpose. |
| `exerciseNotes` | 2874 | `apm_exercise_notes` | yes | Keyed `gym__exercise` (`v88NoteKey`, 3617). |

Fields added at runtime and never persisted: `typingWeight`, `minimumWorkout` (set at `cut-support.js` 1525 and 1527 and `index.html` 6961), `moreView` (cut 1590), and `progressView` and `progressRange` (written only by the dead v95 functions, 7541–7554). `minimumWorkout` is lost on reload.

`settings` (2715, from `apm_settings`) is persisted first, at 2898. It holds `weeklyPlan`, `dayOverrides`, `cutSupport`, `leanMode`, the goal values and `name`.

### 2.2 `SETTINGS_DEFAULTS` (2714) and settings keys

`SETTINGS_DEFAULTS` = `startWeight 87.1`, `targetHigh 80`, `targetLow 78`, `tdee 2644`, `zone2WeeklyTarget 180`. It has no `weeklyPlan`; `DEFAULT_WEEKLY_PLAN` (2718) fills that in at 2719.

Keys written at runtime:

- `weeklyPlan`: boot default-fill (2719); see section 3.
- `dayOverrides`: see section 3.
- `leanMode`: created with `enabled, aggressiveCut, conservativeProgression, minimumWorkout, recoveryWarnings` all `true` (6798–6805), on every render, persisted on the next `persist()`.
- `cutSupport` (`cfg()`, `cut-support.js` 45–53): `profile`, `templates` (key `gym__type`), `sessions`, `sessionTargets`, `recovery`, `adherence`, arrays `waist`, `suggestions`, `tdeeHistory`. Install adds `version` (99), `previousWeeklyPlan`, `previousCardioTarget` (cut 1761–1767).
- `startWeight`, `targetHigh`, `targetLow`, `tdee`: `updateGoalSettingsFromInputs` (6084). `zone2WeeklyTarget`: `saveCardioGoal` (cut 1678). `saveGoalSettings` (3243) also writes these but is dead (see section 8).
- `name`: `saveName` (premium 66–68). It is read by the splash (2639) and `userName` (premium 58). Both default to `'Dan'` when the field is undefined.
- `tee` → `tdee` rename (2716): one-time, the old key is deleted.

### 2.3 `persist()` write order (2891–2906)

`persist()` writes each record in its own `w()` wrapper (2896–2897). Each wrapper has its own try/catch and the first error is kept. The order is:

1. `apm_settings` (2898)
2. `apm_notifications`
3. `apm_current_gym`
4. `apm_gyms`
5. `apm_session_plans`
6. `apm_addons`
7. `apm_exercise_notes`
8. `apm_current_read`
9. `apm_coach_insights`
10. `apm_logs`
11. `apm_cardio`
12. `apm_floorball`
13. `apm_bws` (2903)
14. `apm_rest`
15. `apm_evo_scans` (2904)

Then `scheduleCloudSave()` (2905), which runs even when a local write failed. Then `throw firstErr` (2906).

This is the D29 per-key write. The decision text (`tasks/vnext/DECISIONS.md` line 35) says settings come first and the scan record last. The code agrees.

Not written by `persist()`:

- `apm_last_open_date` (6632, 6653): direct `localStorage`.
- `apm_sb_url`, `apm_sb_key` (5454–5455, 5473–5474): direct.
- `nxtfrm_recovery_snapshot` (`snapshot`, cut 733–757).
- `nxtfrm_cloud_banner_dismissed` (cut 2150; `seed.dev.js` line 13 on preview hosts).

### 2.4 `load()` and `save()` (2878–2879)

- **`load(k, fb)`**: `JSON.parse(localStorage.getItem(k)) ?? fb` inside a `try`. Any error returns `fb` silently. A corrupt value is therefore replaced by the fallback in memory, and the next `persist()` writes that fallback back over the raw value (2891–2906). No copy is taken first.
- **`save(k, v)`**: `localStorage.setItem(k, JSON.stringify(v))`. No `try`, so a quota error throws to the caller. `persist()` contains that error.

### 2.5 `nxtfrm_recovery_snapshot` (cut-support.js 724–757)

- **Written only by** `NXT.snapshot(reason, opts)` (733–757). The payload is `{reason, createdAt, data}`, where `data` is `getFullBackup()` minus the duplicate raw copies of `logs`, `cardio`, `floorball`, `bws`, `scans`, `rest`, `settings`, `notifications` and `apm_recovery_backup`.
- **Quota handling** (`snapshotFail` 726–732, write retry 749–756): on a quota error it removes the previous copy and retries. If that fails it restores the previous copy. A failure sets `snapshot.issue` and toasts "Could not make a safety copy".
- **Callers.** Engine: `cut-support.js` 1633 (saveWeek), 1640 (restoreWeek), 1661, 1671, 1709 (restore), 1721 (local reset), 1760 (V99 install; aborts install on failure), 1844 (cloud load). Premium: 1883 (`setDay`), 2007 (routine edit), 2022 (save workout to routine), 2163 (scan-photo removal).
- **Readers.** The safety-copy UI (`cut-support.js` 1685–1696).
- **Contents.** It includes `apm_sb_url` and `apm_sb_key`, because only `apm_recovery_backup` is removed from the raw dump (cut 739).

### 2.6 Migrations and normalisers that run (in execution order)

1. `index.html` 2716: `settings.tee` → `settings.tdee`. Once.
2. `index.html` 2719: `settings.weeklyPlan` default-fill from `DEFAULT_WEEKLY_PLAN`. Every boot.
3. `index.html` 2881–2883: `state.notifs` defaults and the `sent` map. Every boot.
4. `cut-support.js` 1920 → `NXT.install(true)` (1756–1779). Every boot:
   - 1758: `TEMPLATES.FullA/FullB/FullC` ← NXT defaults.
   - 1759–1768, **only when `cfg().version` is unset (once per device)**: snapshot "Before V99 upgrade" (1760; the install aborts here if the snapshot fails). `previousWeeklyPlan` ← old `weeklyPlan` (1761). `weeklyPlan` ← `N.split` (1761). `previousCardioTarget` (1762). `zone2WeeklyTarget` 180 → 90 (1763–1764). Today's started day becomes a dayOverride (1766). `version = 99` (1767). Recovery backfill (1768).
   - 1770: `version = 99` if absent (restores call with `migrate = false`).
   - 1772: `mergeLegsIntoPump()` (1739–1752), the D33 migration. It swaps `'Legs'` to `'Pump'` in `weeklyPlan`, `dayOverrides`, `previousWeeklyPlan` and `state.dayType` (1742–1743). It moves `<gym>__Legs` keys in `templates`, `sessionTargets`, `sessions` and `state.sessionPlans` to `__Pump` (1744–1752) unless the Pump key already exists. Logs are not rewritten.
   - 1773: `weeklyPlan = {...N.split, ...weeklyPlan}`.
   - 1774: `state.dayType = typeFor(state.date)`; `state.exercise` set.
   - 1775: `persist()`. **Every launch rewrites every `apm_*` key.**
   - 1777: `maybeSnapshotTDEE()` (478–490). Appends today's adaptive TDEE row to `cutSupport.tdeeHistory` (capped at 180) and persists when a row is recorded.
5. `index.html` 6798: `ensureLeanSettings()`, called on every render (2996). Writes the default `leanMode` when missing.
6. `index.html` 6140: `normalizeDayType()`. A runtime name normaliser, not a migration. Any string containing "leg" maps to `"Legs"`, not `"Pump"`.

**Dead migrations (no call site anywhere in the repo):** `migratePumpSessionPlans` 6674 (rewrites Pump session plans), `migrateLegsCoreToAbCrunch` 6688 (renames a legs-core exercise to Ab Crunch), `normalizeLegacyDayNames` 6762 (`Upper` and `Legs + Core` to `Pump` in weeklyPlan and dayOverrides), `migrateLegsCoreTemplate` 6778 (rewrites the Pump template), and `migrateSingleLegsCoreCycle` 7019 (`Legs` and `Legs + Core` to `Pump`, and `Zone 2 / Rest` to `Zone2`, in weeklyPlan and dayOverrides).

Consequence: any stored `Upper`, `Legs + Core` or `Zone 2 / Rest` value in `weeklyPlan`, `dayOverrides` or the previous plan is not converted by any live code. This is a static finding and has not been checked against real data.

## 3. Weekly plan and split

### 3.1 Functions that touch the plan fields

**`settings.weeklyPlan`** (keys are JS `getDay()`, 0 = Sunday)

| Function | Line | Action | Status |
|---|---|---|---|
| `planTypeForDow` | 2747 | R | LIVE (called by `resolveDayType`) |
| `resolveDayType` | 2750–2757 | R | LIVE. The single resolver: override, then weekly plan, then `PLAN`. |
| boot default-fill | 2719 | W | LIVE, every boot |
| `mergeLegsIntoPump` | cut 1742 | W (swap) | LIVE, every boot |
| `install` V99 branch | cut 1761 | W (`N.split`) | LIVE, once per device |
| `install` merge | cut 1773 | W | LIVE, every boot |
| `setDayType`, "every" box | cut 1574 | W `[dow]` | LIVE, via the openDay modal |
| `saveWeek` | cut 1634 | W | dead in practice (only from `programmeHTML`) |
| `restoreWeek` | cut 1641 | W | dead in practice (only from `programmeHTML`) |
| `setDay` | premium 1880–1885 | W `[d]` | LIVE (Settings > Training day list, `pickDay` 1876) |
| `splitSettingsHTML` onchange | 6043 | W `[d]` | unreachable (intercepted branch) |
| `normalizeLegacyDayNames`, `migrateSingleLegsCoreCycle` | 6765–6771, 7021–7031 | W | dead (no call site) |
| `cycleWeeklyDay` | 7332–7338 | W `[dow]` | LEGACY-ONLY (only from the legacy weekly editor) |
| `weeklyPlanHTML` | 7316 | R | OVERRIDDEN by `NXT.weekHTML` (cut 1835) |
| `cfg().previousWeeklyPlan` (the brief's "prevPlan") | cut 1761, swap at 1742; premium `setDay` 1884 | W | see 3.4 |

**`settings.dayOverrides`** (key is `YYYY-MM-DD`)

| Function | Line | Action | Status |
|---|---|---|---|
| `applyDayOverrideForDate` | 6471–6474 | creates `{}`, R via `resolveDayType` | LIVE (every render) |
| `setDateToToday` | 6625–6633 | creates `{}` | LIVE |
| `chooseSession` | cut 1534–1537 | W `[state.date]` | LIVE (Today "Change" → `sessionPicker`, cut 1533, via `window.showSessionSheet`) |
| `setDayType` | cut 1569–1576 | W `[date]`, or deletes it when "every" is ticked | LIVE (via `NXT.openDay`, premium week strip `premium-ui.js` 127) |
| `moveDay` | cut 1579–1584 | W `[from]` and `[to]` | UNREFERENCED in the live UI (no button calls `NXT.moveDay`) |
| `install` started-day | cut 1766 | W `[state.date]` | LIVE, once per device |
| `mergeLegsIntoPump` | cut 1742 | W (swap) | LIVE, every boot |
| `cycleDayType` | index 6454–6468 | W `[state.date]` | OVERRIDDEN (`cut-support.js` 1799, `NXT.sessionPicker`) |
| `clearTodayOverride` | index 6477–6485 | W (`delete`) | LEGACY-ONLY |

**`cfg().templates`, `cfg().sessionTargets`, `state.sessionPlans`** (the routine and session stores)

| Function | Line | Writes | Status |
|---|---|---|---|
| `ensureSessionPlan` (engine) | cut 1790 | `state.sessionPlans[key]` and `sessionTargets[key]` when missing | LIVE (overrides the main version at 3565) |
| `ensureSessionPlan` (main) | 3565–3576 | `state.sessionPlans[key]`; includes an `isStalePush` reset | OVERRIDDEN |
| `moveSessionExercise` | 3577–3589 | `state.sessionPlans` | LIVE (premium) |
| `resetSessionOrder` | 3590–3604 | `state.sessionPlans` from `NXT.templateFor` | LIVE (onclick) |
| `v88RemoveExercise`, `v88AddExercise`, `v88ReplaceAt` | 3620, 3627, 3631 | `state.sessionPlans` | LIVE (onclick) |
| `shorter`, `fullSession` | cut 1523–1528 | `state.sessionPlans`, `cfg().sessionTargets`, `state.minimumWorkout` | LIVE (premium calls `NXT.shorter`, `NXT.fullSession`) |
| `resume` | cut 1522 | deletes `cfg().sessions[key]` | LIVE (premium `NXT.resume`) |
| `reseedToday` | premium 1985–1996 | `state.sessionPlans[key]` and `cfg().sessionTargets[key]` | LIVE (routine save) |
| `routineSave` | premium 2003–2016 | `cfg().templates[gym__type]` | LIVE (Settings > Training routine) |
| `saveTodayToRoutine` | premium 2019–2028 | `cfg().templates[gym__type]` | LIVE |
| `setMinimumWorkoutMode` | index 6960–6980 | `state.minimumWorkout`, `cfg().sessionTargets` | LEGACY-ONLY (only the legacy card calls it) |
| `cycleDayType` | index 6456 | `delete state.sessionPlans[key]` | OVERRIDDEN |

**`TEMPLATES`** (built-in lists, index 2758–2796). Mutated only by `install` (cut 1758), which adds `FullA`, `FullB` and `FullC`. Readers include `getT` (2919, overridden), `allExerciseDefs` (3552), `setDateToToday` (6633), and `templateFor` (cut 575–578) as the fallback. Saved routines live in `cfg().templates`, not in `TEMPLATES`.

**`state.dayType` writers.** Boot (2876, 1774); every render (6471–6474); `setDateToToday` (6625–6633); `chooseSession` (cut 1536); `setDayType` (1572); `moveDay` (1582); `saveWeek` (1634); `restoreWeek` (1641); `restoreBackup` (1717); `mergeLegsIntoPump` (1743); `setDay` (premium 1885). `cycleDayType` (6454), `clearTodayOverride` (6477) and `setMinimumWorkoutMode` are legacy.

### 3.2 Boot call order (what sets `state.dayType` and the session plan)

1. **Parse-time, main script** (2713–7519). 2715–2716 load settings and rename `tee`. 2718–2719 fill `weeklyPlan` in memory from `DEFAULT_WEEKLY_PLAN`. 2876 sets `state.dayType` using `resolveDayType`. 2881–2883 defaults `notifs`. 2951 binds the nav `onclick`. 5010–5030 service worker. 5107–5108 notification timers. 6446–6451 error listeners. 6665 `visibilitychange`. 7493–7496 `window.onerror`. 7497 `initCloudFromStorage()` (main body; may call `render()` after `getSession`, see section 5).
2. **Parse-time, `cut-support.js`.** The NXT engine is built (26–1779). Overrides are assigned (1781–2237). `NXT.install()` runs at 1920 (see 2.6 item 4). That run replaces `weeklyPlan` with `N.split` once per device, applies `mergeLegsIntoPump`, merges the split defaults, sets `state.dayType = typeFor(state.date)` (1774), and calls `persist()` (1775).
3. **Parse-time, `premium-ui.js`.** Reassigns the render globals (2829–2830) and calls `NXP.applyAppearance()` (2831). Wrappers at 2833–2880.
4. **Parse-time, `seed.dev.js`.** On a deploy preview, replaces the cloud entry points (section 4).
5. **`DOMContentLoaded` → `bootApexcut`** (7503–7512): `rollToTodayIfNeeded()` (no roll at boot, because `state.date` is today), `bindTabs()`, `render()`. `render()` runs `applyDayOverrideForDate()` again (6471), then `ensureLeanSettings()`, then the NXP page renderer. Last, `__nxSplashReady()`.

### 3.3 Traces

**(a) App boot.** `state.dayType` is computed three times: at 2876 from the in-memory settings, at 1774 inside `install`, and in every render (6471). On a device that already has `cutSupport.version = 99`, the result is the stored weekly plan or dated override for today. On a device with no version, `install` first replaces the plan with `N.split` (Sun Rest, Mon Full Body A, Tue Zone 2, Wed Full Body B, Thu Zone 2, Fri Full Body C, Sat Zone 2), so the boot default `DEFAULT_WEEKLY_PLAN` is only transient. The "previous" plan stored at that moment is the boot default (Push, Pull, Floorball, Pump, Floorball, Legs), not `{}`. The session queue is seeded lazily: `ensureSessionPlan` (cut 1790) runs on the first `template()` call, which the first render makes, and seeds from `NXT.templateFor(type)` (saved routine for this gym, else `TEMPLATES`).

**(b) Date rollover.** Trigger: any `render()`, `bootApexcut`, or `visibilitychange` (6665) after the app stayed open past midnight. `render` runs `applyDayOverrideForDate` for the stale date first (6471), then `rollToTodayIfNeeded` (6636). A roll happens when `state.date < today`, or when `apm_last_open_date` differs from today and `state.date` is not today. `setDateToToday({silent:true})` then sets `state.date`, recomputes `state.dayType` with `resolveDayType(today)`, sets `state.exercise` to `TEMPLATES[type][0]` (not the saved routine's first exercise), sets `setNum = 1`, writes `apm_last_open_date` directly, and calls `persist()`. Today's queue is seeded lazily by `ensureSessionPlan`. `ensureExerciseSelected` (3728–3734) only fills an empty `state.exercise`, so a stale name from `TEMPLATES` can survive the roll until the user picks an exercise. This is static and not verified at runtime.

**(c) Set or clear a day override.**

- *Set today.* `sessionPicker` (cut 1533) lists `N.pickTypes`. `chooseSession` (1534–1537) writes `dayOverrides[state.date] = type`, sets `state.dayType`, `state.exercise` (from `templateFor(type)`) and `setNum = 1`, then `N.commit`. Unlike `setDayType`, it has no check for logged sets on that date (see section 8). The entry points are the Today "Change" action (premium 136, 149) and the session menu (premium 1292), through `window.showSessionSheet` (cut 1798).
- *Set any date.* The week strip in premium (127) calls `NXT.openDay(date)` (cut 1564). The modal's buttons call `NXT.setDayType(date, type)` (1566–1567). `setDayType` (1569–1576) refuses if the date has logged sets (1570). If "Make every <weekday> this" is ticked (`#n99-day-every`), it writes `settings.weeklyPlan[dow] = type` and deletes `dayOverrides[date]` (1574). Otherwise it writes `dayOverrides[date] = type` (1575). It then sets `state.dayType = typeFor(state.date)` and resets `state.exercise` (1572).
- *Move.* `moveDay` (1579–1584) swaps the overrides of two dates, but no UI calls it. It is unreferenced.
- *Clear.* The live UI has **no single-day clear**. The only path that removes a dated override is the "every" option in `setDayType`. Once set, an override persists until it is replaced or removed that way. `applyDayOverrideForDate` never deletes. `clearTodayOverride` (6477–6485) is legacy and unreachable.
- *Install.* The V99 install creates an override for today when a record for today already has a `dayType` (cut 1766).

**(d) Save a routine in Settings > Training** (premium `routineSave`, 2003–2016).

1. Validate the rows (`N.validTemplate`).
2. `N.snapshot('Before routine edit', {quiet: true})`. If that fails, `confirmNoSafetyCopy` (1999–2003) asks the user.
3. Write `cfg().templates[gym + '__' + type]` for the current gym, and for each other gym when "both" is chosen (2010).
4. For each gym, `reseedToday(type, gym)` (1985–1996). If nothing is logged for that type, gym and day, it writes `state.sessionPlans[sessionKey(type, state.date, gym)]` (1992) and `cfg().sessionTargets[key]` (1993), and sets `state.exercise` if the type and gym match today.
5. `N.commit(label + ' saved' + (live ? " · today's workout updated" : ''))`.

It does **not** touch `settings.weeklyPlan`, `dayOverrides` or `state.dayType`. The separate `saveTodayToRoutine` (2019–2028) writes `cfg().templates` from today's queue without reseeding.

**(e) Cloud load merges settings.** Path: `loadCloudNow` (cut 2193–2228) → `applyCloudPayload` wrapper (cut 1839–1846), which runs `NXT.snapshot('Before cloud load')` (1844) and then `NXT.old.applyCloudPayload` (reassigned at cut 1981–2006).

- Records are merged by `id` for `logs`, `bws`, `cardio`, `floorball`, `scans` and `rest` (`unionById`, cut 1947–1965). `gyms` and `gym` are taken from the cloud when present (1991–1992).
- Settings: `merged = {...cloud.settings, ...localSettings}` (cut 1995–1996). **Local values win for every top-level key.** `cutSupport` is merged per key with local values winning (`mergeCutSupport`, 1996; `adherence`, `suggestions` and `tdeeHistory` keep a non-empty local value). `START_WEIGHT`, `TARGET_HIGH`, `TARGET_LOW`, `USER_TDEE` and `ZONE2_WEEKLY_TARGET` are then recalculated (1997–2002). `persist()` runs and `lastCloudMergeOk` is set.
- Then `NXT.install(false)` (cut 1845) runs `mergeLegsIntoPump`, merges `weeklyPlan` with `N.split`, sets `state.dayType` and persists again. `state.date` is not restored from the cloud on this path. The cloud `current.date` branch exists only in the dead main-script body (5347).
- `loadCloudNow` then writes the merged payload back to the cloud (`saveCloudNow(false)`, cut 2219).

**Effect on the plan.** Boot always writes `weeklyPlan`, `dayOverrides` (as `{}`) and the goal values into local settings. Because local values win, the cloud's `weeklyPlan`, `dayOverrides` and goals are normally shadowed on a device that already has local settings. This is a static reading of the merge order and has not been run.

### 3.4 Brief names that differ from the code

- **`dayTypeFor`**: no such identifier exists in the repository.
- **`prevPlan`**: no such identifier. The stored field is `settings.cutSupport.previousWeeklyPlan` (`cut-support.js` 1761 write, 1742 swap; `premium-ui.js` 1884 write; restored by `restoreWeek`, 1636–1641).
- **`setDayType`, `moveDay`, `resume`, `finish`**: they exist, inside the NXT engine (`cut-support.js` 1569, 1579, 1522 and 1512). `setDayType` is live through the openDay modal. `moveDay` has no UI caller. `resume` and `finish` are live (premium calls `NXT.resume` and `NXT.finish`).
- **`setMinimumWorkoutMode`**: legacy (index 6960). Its card exists only in the legacy `renderTrain`. The live minimum mode is `NXT.shorter` and `NXT.fullSession` (cut 1523–1528), which use the non-persisted `state.minimumWorkout`.
- **`startWorkoutNow`**: overridden. The live version is `premium-ui.js` 2853 (`NXP.enterTrain`). The original (index 6443) would only switch tabs.
## 4. Cloud / Supabase

### 4.1 Functions

| Function | Lines | Behaviour | Override / guard |
|---|---|---|---|
| `initSupabaseClient` | 5362–5368 | Reads `apm_sb_url` and `apm_sb_key` from `localStorage`. Returns `null` when either is missing or `window.supabase` is absent. Otherwise creates the client once and caches it in `sbClient` (2886). | none |
| `initCloudFromStorage` (main) | 5369–5380 | Calls `getSession()`. On a session sets `cloudUser` and `cloudStatusText`, then calls `render()` (5377). Runs at parse time (7497). | overridden by cut 2043 (which runs again at 2236) |
| `initCloudFromStorage` (engine) | cut 2043–2085 | Checks stored `sb-*-auth-token` keys. Signs out silently when the session is stale. Otherwise sets `cloudUser`, marks `cloudSessionChecked`, and calls `loadCloudNow()`. | the global name, so blocked on preview hosts |
| `cloudSignOutSilent` | cut 2038–2042 | Suppresses the toast, runs `cloudSignOut()`, and clears stored auth tokens. | none |
| `scheduleCloudSave` | 5381–5385 | Debounces 900 ms, then `saveCloudNow(false)`. No-op unless signed in. Called from `persist()` (2905). | replaced with a no-op on previews (`seed.dev.js` 10–11) |
| `saveCloudNow` | 5386–5423 | Upserts into `apexcut_profiles` with `onConflict: user_id`, sending `{user_id, data, updated_at}`. Retries without `updated_at` if the error names that column. Toasts. | overridden by cut 2161–2191 (quiet mode; sets `lastCloudError`, `lastCloudSyncAt`) |
| `loadCloudNow` | 5424–5446 | Selects `data` for `user_id`, calls `applyCloudPayload`, toasts. | overridden by cut 2193–2228. After a successful merge the override calls `saveCloudNow(false)` (cut 2219), so a load also writes back. |
| `cloudLogin` | 5447–5465 | Stores `apm_sb_url` and `apm_sb_key` (5454–5455), sets `sbClient = null` (5456), runs `signInWithPassword`, then `loadCloudNow()` and `render()`. | replaced on previews |
| `cloudSignup` | 5466–5485 | Same stores (5473–5474), `sbClient = null` (5475), `signUp`, then `saveCloudNow(false)`. | replaced on previews |
| `cloudSignOut` | 5486–5495 | `auth.signOut()`, `cloudUser = null`, `render()`. | none |
| `cloudCardHTML` | 5496–5537 | Account and sync card. Reads `apm_sb_url` and `apm_sb_key` (5497–5498). | none |
| `supabaseSQLHelpHTML` | 5538–5565 | SQL text to create `apexcut_profiles` and its row-level-security policies (5548–5561). | none |
| `getCloudPayload` | 5311–5333 | Builds the payload (4.2). | none |
| `getFullBackup` | 5176–5200 | Builds the backup object: the structured records (`logs`, `cardio`, `floorball`, `bws`, `scans`, `rest`), `current`, `settings`, `notifications`, and a `localStorageDump` of every `apm_*` key (5196–5199). Used by `exportFullBackup` (5202), the recovery snapshot (cut 733–757) and the safety-copy download. Its original is captured in `NXT.old` (cut 29) and is still called, so it is not overridden. | none (`NXT.old` capture only) |
| `applyCloudPayload` (main) | 5334–5361 | Pre-merge body: the cloud overwrites local values, and `state.date` and `state.dayType` come from the cloud. **Unreachable** (see 4.4). | overridden by cut 1839–1846 |
| `updateCloudLocalBanner` | cut 2113–2141 | Shows the banner for a failed save, a sign-out after a sync failure, configured-but-signed-out, or unsynced data at risk. Dismissible only for the last case. | wrapped by premium 2869–2879 (hidden in focused Train mode, D6) |
| `retryCloudSave` | cut 2142–2147 | Calls `saveCloudNow(true)`. | calls the global, so blocked on previews |
| `dismissCloudLocalBanner`, `openCloudLoginFromBanner` | cut 2148–2153 | Dismiss sets `nxtfrm_cloud_banner_dismissed` (2150). Open calls `switchTab('more')` and `NXT.more('data')`. | `openCloudLoginFromBanner` replaced on previews |
| `testConnection` (premium) | premium 2221–2262 | Read-only checks: `/auth/v1/settings`; then, with a session token, `/auth/v1/user` and a `select=user_id` query on `apexcut_profiles`. Its text says "No records written or restored." Uses the cached `initSupabaseClient()`. | none needed; read-only |

### 4.2 Table, payload and keys

- **Table:** `apexcut_profiles`, the name from the earlier app name, kept. Columns used: `user_id` (conflict key), `data` (JSON payload), `updated_at` (optional). Policies in the help text (5548–5561) are select, insert and update, each limited to the owner. There is no delete policy in the help text.
- **Payload** (`getCloudPayload`, 5311–5333): `logs`, `cardio`, `floorball`, `bws`, `scans`, `rest`, `read`, `readiness` (`state.readiness` is never set, so this is always `[]`), `gyms`, `gym`, `settings` (the whole settings object, including `cutSupport`), `notifs`, `current` (`date`, `dayType`, `exercise`, `setNum`) and `savedAt`.
- **Where `apm_sb_url` and `apm_sb_key` are read:** 5363–5364 (`initSupabaseClient`), 5497–5498 (`cloudCardHTML`), cut 2120 (banner "configured" check), premium 49 (status text), 1836 and 2074 (configured checks), 2223–2224 (`testConnection`).
- **Where they are written:** only 5454–5455 (`cloudLogin`) and 5473–5474 (`cloudSignup`). Both are written before the sign-in succeeds, so a failed attempt still leaves them stored.
- **Where they leak:** `getFullBackup` dumps every `apm_*` key into `localStorageDump` (5196–5199). Both keys therefore appear in exported JSON files (5202–5210) and in the recovery snapshot (section 2.5). See section 8.
- **Write cadence:** `persist()` schedules a save (2905 → 5381) on every call, including every tab tap (`switchTab`, 2954–2958). Each save uploads the whole payload after 900 ms.

### 4.3 Deploy-preview guard (D23): does a preview host write to the cloud?

`seed.dev.js` runs its guard at lines 5–14. It runs only on `localhost` or on a deploy-preview host matching `^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$` exactly (line 6–7). On a preview it:

- replaces `window.cloudLogin`, `cloudSignup`, `saveCloudNow`, `loadCloudNow` and `openCloudLoginFromBanner` with a function that toasts "Cloud sync is off on this preview link" and returns `false`;
- replaces `scheduleCloudSave` with a no-op (lines 10–11);
- sets `nxtfrm_cloud_banner_dismissed = '1'` (line 13).

Paths covered: `persist()` → `scheduleCloudSave` (no-op); `retryCloudSave`, the `loadCloudNow` write-back and the sign-up path → `saveCloudNow` (replaced); `initCloudFromStorage` and `cloudLogin` → `loadCloudNow` (replaced). Not writes: `cloudSignOut` and `testConnection`.

The guard runs after `cut-support.js` (7950) and `premium-ui.js` (7965) have loaded (`seed.dev.js` is at 7967), and the engine calls globals at call time, so the replacements take effect. **The result: on a preview, no cloud write is reachable through these names.** This is a static check; it has not been run against a live preview.

**Limits.** The guard does not cover `localhost`, where cloud sync is fully enabled and the fixtures are also loaded. Fixture data written on `localhost` can reach a signed-in account if the developer signs in there. That is by design under D23 (which names deploy previews only), but worth knowing.

### 4.4 Stale and duplicate client code

- **Stale pre-merge body.** `applyCloudPayload` at 5334–5361 is dead. `cut-support.js` 1839 replaces the global, and the original is captured in `NXT.old` (cut 29). The merge reassigns `NXT.old.applyCloudPayload` (1981), so nothing calls the 5334 body. It would overwrite local data, and it sets `state.date` from the cloud. Deleting it is a D5-style audit item.
- **GoTrueClient double construction.** `cloudLogin` (5456) and `cloudSignup` (5475) set `sbClient = null` before calling `initSupabaseClient()`. If a client already exists (created at boot by 7497 when the URL and key are stored), this constructs a second `createClient` in the same browser context, with the same default storage key. Static reading only. The console warning was not captured.
- The engine's `initCloudFromStorage` (cut 2043) and the main-script call (7497) both reuse the cached client. They do not create a second one.
- `testConnection` (premium 2221) reuses the cached client and makes only read requests.

## 5. Launch and boot

### 5.1 Splash (2632–2679)

- **Placement.** An inline IIFE in `<body>` (script 2632–2679). It runs when the parser reaches it, after the `<head>` stylesheets (2625–2628) and before the app shell (`<div class="app">`, 2683). It appends a `<style>` to `<head>` and the `#nxSplash` node to `<body>` (`appendChild`, 2664). Both happen before any shell markup is parsed.
- **Styling.** `#nxSplash` is `position: fixed; inset: 0; z-index: 99999`, with an opaque background `#0d0c12`, so it covers the empty shell (CSS string 2650–2662).
- **DOM** (2643–2650): `#nxSplash` (`aria-hidden="true"`), `<i class="nxs-glow">`, an inline SVG with `nxs-track`, `nxs-n` (the N path, with a gradient stroke) and `nxs-tip`, `<p class="nxs-hi">` (the greeting), and `<span class="nxs-wordmark">NXTFRM</span>`.
- **Greeting** (2638–2639): "Late night" (before 05:00), "Morning" (before 12:00), "Afternoon" (before 18:00), otherwise "Evening". Then `, <name>`, where the name is `apm_settings.name`. **If the name is undefined it defaults to `'Dan'`** (2639), a hard-coded personal default. `premium-ui.js` 58 uses the same default.
- **Once-per-tab gate** (2636–2637): `sessionStorage['nxSplash']` is set before the splash is shown. A later load in the same tab session returns at once and skips the splash.
- **Timing.** CSS keyframes: glow bloom 0.72 s, mark stroke draw 0.78 s, tip light at 0.62 s (0.24 s), greeting at 0.7 s (0.38 s), wordmark at 0.9 s (0.28 s) (2651–2662).
- **Finish.** `window.__nxSplashReady` (2672–2676) adds `is-ready` and schedules `finish` at `max(0, 1550 − elapsed)` ms (500 ms under reduced motion). Fallback: `setTimeout(finish, reduce ? 500 : 2200)` (2677). `finish` (2665–2670) sets `pointer-events: none`, adds `is-out` (opacity fades over 0.32 s), then removes the nodes after 360 ms (0 under reduced motion). A click on the splash calls `finish` (2671).
- **Reduced motion.** `matchMedia('(prefers-reduced-motion:reduce)')` (2641). The inline CSS (2663) sets `animation: none !important; transition: none !important` and shows the final states directly.
- **Callers.** `__nxSplashReady` is called only from `bootApexcut` (7508–7509).
- **Risk.** If `DOMContentLoaded` (and so `bootApexcut`) takes longer than 2.2 s, the fallback removes the splash while the shell sections (`#homePage` and the rest, 2693–2697) are still empty.

### 5.2 `bootApexcut` (7503–7512)

```
function bootApexcut(){
  try{
    rollToTodayIfNeeded();   // 7505  -> 6636
    bindTabs();              // 7506  -> 2960
    render();                // 7507  -> 2982, wrapped by cut-support.js 2158
    if(window.__nxSplashReady)window.__nxSplashReady();   // 7508
  }catch(e){ console.error(e); }                          // 7509-7511
}
```

- **Trigger** (7513–7517): `document.readyState === "loading"` is true while the parser-blocking main script runs, so `bootApexcut` is deferred to `DOMContentLoaded`. It therefore runs after every synchronous script that follows: `cut-support.js`, the wearables modules, `train-anatomy.js`, `premium-ui.js`, `strata.js`, `seed.dev.js`, `seed.scenarios.js` and the boot inline script.
- **Errors.** `render()` catches its own exceptions and shows an error card (3030–3036). A throw before `__nxSplashReady` leaves the splash to the 2.2 s fallback.

### 5.3 Parse-time order (before `DOMContentLoaded`)

| Lines | What runs |
|---|---|
| 16–2608 | Inline `<style>` in `<head>`. |
| 2610–2628 | Manifest, icons, theme and PWA meta, font preload (2624), and four stylesheets with `?v=161` (2625–2628). |
| 2632–2679 | Splash IIFE (section 5.1). |
| 2680–2708 | Toast, `#modalRoot`, `.app`, the cloud-local banner (2684), `<main>` with five `<section>` shells (2692–2698), and the nav (2700–2708) with inline `onclick="switchTab(...)"` attributes. |
| 2711–2712 | `tesseract.js@5` and `@supabase/supabase-js@2` from jsDelivr, both synchronous and parser-blocking. |
| 2713–7519 | Main script. Top-level side effects: 2716, 2719, 2876, 2881–2883 (state defaults), 2951 (nav `onclick` property, which replaces the inline attributes), 5010–5030 (service worker), 5107–5108 (notification timers, 1.5 s and every 30 s), 6446–6451 (error and rejection toasts), 6665 (`visibilitychange`), 7493–7496 (`window.onerror`), 7497 (`initCloudFromStorage()`, main body), 7513–7517 (boot scheduling). |
| 7521–7948 | Tagged scripts: `apex-v85`, `apex-v95`, `apex-v96`, `apex-v86` (section 7). |
| 7950–7965 | `cut-support.js` (NXT engine, overrides, `NXT.install()` at 1920, `initCloudFromStorage()` at 2236), wearables modules, `train-anatomy.js`, `premium-ui.js` (overrides 2829–2832, `NXP.applyAppearance()` 2831, wrappers 2833–2880). |
| 7966–7968 | `strata.js` (`STRATA.install()` 1040), `seed.dev.js` (D23 guard, section 4.3), `seed.scenarios.js` (localhost only). |
| 7969–7977 | Boot inline script: loads `wearables.fixtures.js` only on `localhost`, `127.0.0.1`, `[::1]`, `::1` or `file:`. |
| 7978–8024 | `</body>`, then the `validateField` script (section 8). |

**What paints first.** The splash is inserted at 2664, before the shell markup (2683) is parsed, and it is opaque and fixed, so it is the first content over the page. The shell sections are empty until `render()`. An intermediate paint of the blank body during the 342 KB parse is possible, and the splash background covers it.

**One early render.** `initCloudFromStorage()` in the main script (7497) calls `render()` (5377) after `getSession()` resolves, if a session is stored. That promise continuation may run before `cut-support.js` and `premium-ui.js` are parsed, which would paint the legacy renderers. Under the splash this is hidden. Without the splash (the once-per-tab gate has been set), it could show briefly. Timing was not verified.

### 5.4 Service worker (5010–5030) and the offline shell

- **Localhost branch** (5010–5012). On `localhost`, `127.0.0.1`, `[::1]` or `::1`, every existing service-worker registration is unregistered and none is created. The comment says local dev is served uncached.
- **Other hosts** (5013–5029). If service workers are supported, the protocol is not `file:`, and `!window.NXTFRM_STANDALONE`, the page adds a `controllerchange` listener (5015–5028) and calls `register("./sw.js")` followed by `reg.update()` (5029). `window.NXTFRM_STANDALONE` is never defined anywhere in the repository, so the condition is always true.
- **`controllerchange` behaviour.** If an input is focused, it toasts "Update ready…" and does not reload. If logs exist for `state.date`, it toasts "Your session is saved; reopen when ready" and does not reload. Otherwise it calls `location.reload()`.
- **`sw.js`.** `RELEASE = '161'` and `CACHE_NAME = 'nxtfrm-v161-premium-cache'`. Install precaches `ASSETS`: `./`, `./index.html`, the manifest, icons, the font, and 22 versioned scripts and stylesheets (`?v=161`). Every listed file exists on disk. `cache.addAll` is all-or-nothing, so one missing file would stop the worker installing. Activate deletes other `nxtfrm-*`, `apexcut-*` and `apex-*` caches. Fetch is network-first for same-origin GETs, caches successful responses, falls back to the cache, then to `./index.html` for navigations, then to a 503. Cross-origin requests are not intercepted.
- **Not in the shell:** `tesseract.js` and `@supabase/supabase-js` (cross-origin CDN scripts, so offline cold starts depend on the browser's HTTP cache); `wearables.fixtures.js` (dev only, loaded dynamically).

## 6. Inline CSS (`index.html` lines 16–2608)

**Placement and load order.** The `<style>` block sits in `<head>` at line 16, before the four external sheets (`cut-support.css`, `premium-ui.css`, `vnext.css`, `strata.css`, 2625–2628). At equal specificity the external rules therefore win. The external sheets also define `:root` tokens: `premium-ui.css` (8 occurrences of `:root`), `vnext.css` (26) and `strata.css` (39) were not analysed for token values.

**Totals.** 482 `!important` occurrences in the file. 476 are inside the style block. The other 6 are in the splash stylesheet string (2 at 2663) and in JS template strings at 3913, 6586, 7096 and 7174.

**Reduced motion.** Three `@media (prefers-reduced-motion)` blocks in the style block: 2505 (a global `*` rule with `!important` durations), 2509 (score and trend transitions), and 2551–2561 ("QUICK WIN 2", a global `*` rule that sets durations to 0.01 ms and `scroll-behavior: auto`, all `!important`). The splash has its own rule at 2663.

### 6.1 `:root` token blocks (four in the block; the last definition of a name wins)

| Block | Lines | Tokens defined |
|---|---|---|
| A | 23–40 | `--bg #0b0d12`, `--panel #12151c`, `--panel2 #171b24`, `--panel3 #1e2430`, `--line rgba(255,255,255,.075)`, `--text #f4f4f5`, `--muted #9ca3af`, `--muted2 #71717a`, `--purple #a78bfa`, `--purple2 #8b5cf6`, `--sky #7dd3fc`, `--green #a477f5`, `--red #fb7185`, `--yellow #facc15`, `--orange #fb923c`, `--radius 22px` |
| B | 768–772 | `--premium-bg #080A0F`, `--premium-card #151922`, `--premium-card2 #11151D` (not redefined later) |
| C | 2151–2166 | `--bg #080A10`, `--panel #111520`, `--panel2 #171B27`, `--ink #F5F3FF`, `--muted #A7A3B5`, `--faint #6B647A`, `--purple #A78BFA`, `--purple2 #8B5CF6`, `--violet #C084FC`, `--sky #7DD3FC`, `--green #bea0ff`, `--amber #FDE68A`, `--rose #FDA4AF`, `--line rgba(255,255,255,.075)` |
| D | 2332–2351 | `--bg #000000`, `--panel #111112`, `--panel2 #171618`, `--panel3 #1e1d1f`, `--line rgba(235,229,244,.085)`, `--text #f6f5f7`, `--muted #9f9ca4`, `--muted2 #6a686e`, `--purple #b18aff`, `--purple2 #a477f5`, `--sky #aa7afa`, `--green #b18aff`, `--red #ff758c`, `--yellow #f7d76b`, `--orange #ff9a62`, `--radius 26px`, `--shadow`, `--ease` |

**Effective values** (block D, which is last, overrides A and C for shared names): `--bg #000000`, `--panel #111112`, `--panel2 #171618`, `--panel3 #1e1d1f`, `--text #f6f5f7`, `--muted #9f9ca4`, `--muted2 #6a686e`, `--purple #b18aff`, `--purple2 #a477f5`, `--sky #aa7afa`, `--green #b18aff`, `--red #ff758c`, `--yellow #f7d76b`, `--orange #ff9a62`, `--radius 26px`. Tokens that only block A, B or C defines remain as written. The `--ink`, `--faint`, `--violet`, `--amber`, `--rose` and `--premium-*` tokens are never redefined in the block.

### 6.2 Rule groups and live use

Each group runs from its comment header to the next one. A class is **JS** if it appears in `premium-ui.js`, `strata.js`, `cut-support.js`, `train-anatomy.js` or `seed.dev.js` (so it can be emitted by live code), **legacy** if it appears only in `index.html` script or markup (2608–8025), and **none** if no script contains it. "JS" does not prove the rule renders, and class names built at runtime would be missed, so the "none" column is a candidate list only.

| Group (comment) | Lines | Selectors | JS | Legacy | None | Status |
|---|---|---:|---:|---:|---:|---|
| NXTFRM presentation styles (base) | 17–165 | 24 | 18 | 6 | 0 | LIVE |
| V110: legacy `.tabs` rules retired | 166–234 | 6 | 6 | 0 | 0 | LIVE |
| V12 additions | 235–280 | 5 | 2 | 3 | 0 | MIXED |
| V19 layout stability fixes | 281–440 | 27 | 17 | 10 | 0 | MIXED |
| V25 Preview-approved polish | 441–495 | 7 | 1 | 6 | 0 | LEGACY |
| V26 typography polish | 496–507 | 4 | 2 | 1 | 1 (`big-num`) | MIXED, one DEAD class |
| V28 overlap fix | 508–538 | 9 | 5 | 2 | 2 (`rest-suggest`, `timer-card`) | MIXED, two DEAD |
| V29 compact rest suggestion | 539–583 | 3 | 0 | 3 | 0 | LEGACY |
| V30 Evo Scan OCR | 584–648 | 5 | 0 | 1 | 4 (`scan-metric`, `scan-preview`, `scan-status`, `scan-upload`) | DEAD (candidate) |
| V32 Notification settings | 649–657 | 4 | 2 | 2 | 0 | MIXED |
| V33 modal / bottom sheet fix | 658–686 | 3 | 3 | 0 | 0 | LIVE |
| V34 Notification polish | 687–709 | 3 | 0 | 3 | 0 | LEGACY |
| V37 backup and restore | 710–742 | 2 | 0 | 2 | 0 | LEGACY |
| V41 Edit set | 743–766 | 3 | 1 | 2 | 0 | MIXED |
| V93 "Reverted Old Design" | 767–842 | 9 | 2 | 7 | 0 | LEGACY-mostly |
| V43 fixes (goal chart, exercise and gym selectors) | 843–871 | 3 | 1 | 2 | 0 | MIXED |
| V46 coach insights | 872–983 | 12 | 0 | 12 | 0 | LEGACY (coach branch unreachable) |
| V47 Focus Mode cleanup | 984–1119 | 10 | 0 | 10 | 0 | LEGACY |
| V49 stability, simple gym toggle | 1120–1146 | 3 | 1 | 2 | 0 | MIXED |
| V52 hard tab fix | 1147–1153 | 7 | 7 | 0 | 0 | LIVE |
| V53 day cycle | 1154–1183 | 2 | 0 | 2 | 0 | LEGACY |
| V54 Home layout polish | 1184–1501 | 26 | 3 | 23 | 0 | LEGACY (old Home) |
| V56 Zone 2 return | 1502–1573 | 6 | 1 | 5 | 0 | LEGACY |
| V57 auto-today fix | 1574–1605 | 1 | 0 | 1 | 0 | LEGACY |
| V58 progressive overload bar | 1606–1620 | 9 | 1 | 8 | 0 | LEGACY |
| V59 progressive overload visual | 1621–1708 | 10 | 1 | 9 | 0 | LEGACY |
| V61 session exercise replacement | 1709–1739 | 3 | 1 | 2 | 0 | MIXED |
| V65 Home completed workout | 1740–1804 | 5 | 1 | 4 | 0 | LEGACY |
| V93 "Reverted Old Design" (first) | 1805–2005 | 15 | 2 | 13 | 0 | LEGACY |
| V70 upgrade pack | 2006–2024 | 11 | 1 | 10 | 0 | LEGACY |
| V93 "Reverted Old Design" (second) | 2025–2149 | 18 | 7 | 11 | 0 | MIXED |
| V72 visual and weight trend polish | 2150–2218 | 31 | 10 | 20 | 1 (`weight-chart-pro`) | MIXED, one DEAD |
| V74 pulsing latest-weight dot | 2219–2235 | keyframes only | | | | n/a |
| V80 integrated progress | 2236–2249 | 33 | 4 | 29 | 0 | LEGACY-mostly (legacy weight chart) |
| V81 latest card and tooltip | 2250–2256 | 7 | 0 | 7 | 0 | LEGACY |
| V83 input and keying safety | 2257–2264 | 8 | 0 | 8 | 0 | LEGACY |
| V84 weigh-in keying stability | 2265–2274 | 8 | 2 | 6 | 0 | MIXED |
| V85 global input safety | 2275–2299 | element selectors | | | | global |
| V85 mobile form layout rescue | 2300–2315 | element selectors | | | | global |
| V86 keyboard stability | 2316–2325 | 2 | 0 | 1 | 1 (`bottom-nav`) | LEGACY, one DEAD |
| V88 session builder and notes | 2326–2329 | 15 | 3 | 12 | 0 | LEGACY-mostly |
| V94 APEX PERFORMANCE UI (largest block) | 2330–2496 | 103 | 29 | 73 | 1 (`scan-upload`) | MIXED, mostly legacy |
| V107 dock stays put while typing | 2497–2510 | 2 | 0 | 2 | 0 | LEGACY |
| V96 DEEP APP SYSTEM | 2511–2535 | 39 | 4 | 35 | 0 | LEGACY-mostly |
| V94 design system, QUICK WIN 1–6 (focus, reduced motion, buttons, errors, disabled) | 2536–2607 | element selectors and pseudo-classes | | | | global |

**Reading the table.** Of the 503 class selectors in these rows, 355 are legacy-only and 10 have no reference in any script (about 73% in total), and 138 are referenced by a live module. So most of the 476 `!important` declarations sit on code that the live renderers no longer emit. The external sheets are loaded after this block, so for live classes the external rules win at equal specificity. Deleting a legacy group is a D5-style audit item. Removing a "none" class needs a runtime check first, because its name may be built dynamically.

## 7. Tagged scripts (`apex-v85`, `apex-v95`, `apex-v96`, `apex-v86`)

Four inline blocks sit between the main script and the external scripts (`index.html` 7521–7948). Their effectiveness at runtime, judged statically:

- **`apex-v85-input-listeners`** (7521–7537): **effective.** A capture-phase `focusin` on INPUT, TEXTAREA and SELECT sets `window.__apexTyping = true` (7522–7526). `focusout` clears it 900 ms later (7527–7531). `render()` returns early while the flag is set (guard at 2987), so the page does not rebuild under an input being typed in. A capture-phase `touchstart` on those elements calls `stopPropagation()` (7532–7536). No `touchstart` listener exists in `premium-ui.js`, `cut-support.js`, `strata.js` or `index.html` (the only other match is a test file), so that part is latent.
- **`apex-v95-progress-command-centre`** (7539–7776): **mostly dead.** It defines 21 functions. Five are overridden by the engine: `apx95SetView` (7546, by cut 1833), `apx95StrengthItems` (7626, cut 1831), `apx95Verdict` (7663, cut 1832), `apx95OpenQuickWeight` (7702, cut 1854) and `apx95SaveQuickWeight` (7720, cut 1873). The quick-weight sheet is live through those engine functions, not through these bodies. The other 16 have no caller, including the weight edit and delete path (`apx95EditWeight` 7732, `apx95SaveEditedWeight` 7750, `apx95DeleteWeight` 7766). The v95 "command centre" therefore adds no live code of its own.
- **`apex-v96-deep-app-revamp`** (7779–7929): **partly live.** Live: the rest-timer helpers `apx96RestEnd` (7790), `apx96RestInterval` (7791), `apx96RestRemaining` (7792), `apx96FormatTimer` (7795), `apx96AdjustRest` (7817) and `apx96SkipRest` (7821); `apx96SaveFloorball` (7860); and the More fallback `apx96MoreHeader` (7900) and `apx96MoreSectionHTML` (7903). `apx96MoreSectionHTML` is reached only for the notifications and app views (the training, goals, coach, body and data branches are unreachable; section 8). Wrapped, so the original still runs: `apx96TickTimer` (7799; premium 2835–2837 adds `NXP.paintRest()`), `apx96StartRest` (7811; premium 2845–2846 adds `NXP.noteRestTotal()`), `apx96OpenQueueManager` (7843; cut 1848). Overridden, original not called: `apx96SaveReadiness` (7781, cut 1803), `apx96UndoLastSet` (7831, cut 1796), `showHistoryDay` (7886, premium 2830), `apx96SetMoreView` (7896, cut 1837). Legacy only: `renderFloorball` (7869, the winning definition; only from the legacy `renderTrain`, 7089) and `apx96RestTimerHTML` (7827; only from `NXT.training`, which premium never calls). Unreferenced: `apx96BaseLogSet` (7852) and `apx96HistoryDates` (7878).
- **`apex-v86-keyboard-lock`** (7933–7948): **effective, but duplicated.** It registers the same `focusin` and `focusout` handlers as v85. It also toggles the `apex-keyboard-open` class on `<body>` (7937 add, 7944 remove), which `index.html` 2317–2321 uses to hide `.bottom-nav` and `premium-ui.css` 2941 uses to hide `.tabs`. The class toggle is the only effect that v86 adds. The duplicate handlers are harmless.

Status counts across the 41 functions in these blocks: LIVE 9, OVERRIDDEN 12, LEGACY-ONLY 2, UNREFERENCED 18. Full list:

| Line | Block | Name | Status | Live path / override |
|---:|---|---|---|---|
| 7541 | v95 | `apx95ProgressState` | UNREFERENCED | no references |
| 7546 | v95 | `apx95SetView` | OVERRIDDEN | overridden by cut-support.js:1833 |
| 7551 | v95 | `apx95SetRange` | UNREFERENCED | no references |
| 7556 | v95 | `apx95Num` | UNREFERENCED | no references |
| 7561 | v95 | `apx95DateMs` | UNREFERENCED | no references |
| 7565 | v95 | `apx95DailyRows` | UNREFERENCED | no references |
| 7581 | v95 | `apx95MovingRows` | UNREFERENCED | no references |
| 7593 | v95 | `apx95TargetRange` | UNREFERENCED | no references |
| 7601 | v95 | `apx95PeriodAverage` | UNREFERENCED | no references |
| 7609 | v95 | `apx95WeekChange` | UNREFERENCED | no references |
| 7616 | v95 | `apx95SignedKg` | UNREFERENCED | no references |
| 7622 | v95 | `apx95ShortDate` | UNREFERENCED | no references |
| 7626 | v95 | `apx95StrengthItems` | OVERRIDDEN | overridden by cut-support.js:1831 |
| 7663 | v95 | `apx95Verdict` | OVERRIDDEN | overridden by cut-support.js:1832 |
| 7691 | v95 | `apx95InspectDate` | UNREFERENCED | no references |
| 7696 | v95 | `apx95DeltaValue` | UNREFERENCED | no references |
| 7702 | v95 | `apx95OpenQuickWeight` | OVERRIDDEN | overridden by cut-support.js:1854 |
| 7720 | v95 | `apx95SaveQuickWeight` | OVERRIDDEN | overridden by cut-support.js:1873 |
| 7732 | v95 | `apx95EditWeight` | UNREFERENCED | no references |
| 7750 | v95 | `apx95SaveEditedWeight` | UNREFERENCED | no references |
| 7766 | v95 | `apx95DeleteWeight` | UNREFERENCED | no references |
| 7781 | v96 | `apx96SaveReadiness` | OVERRIDDEN | overridden by cut-support.js:1803 |
| 7790 | v96 | `apx96RestEnd` | LIVE | live via apx96TickTimer |
| 7791 | v96 | `apx96RestInterval` | LIVE | live via apx96TickTimer |
| 7792 | v96 | `apx96RestRemaining` | LIVE | live: premium-ui.js |
| 7795 | v96 | `apx96FormatTimer` | LIVE | live: premium-ui.js |
| 7799 | v96 | `apx96TickTimer` | OVERRIDDEN | overridden by premium-ui.js:2835 (original still runs via wrapper) |
| 7811 | v96 | `apx96StartRest` | OVERRIDDEN | overridden by premium-ui.js:2845 (original still runs via wrapper) |
| 7817 | v96 | `apx96AdjustRest` | LIVE | live: premium-ui.js |
| 7821 | v96 | `apx96SkipRest` | LIVE | live: premium-ui.js |
| 7827 | v96 | `apx96RestTimerHTML` | LEGACY-ONLY | dead in practice: only from NXT.training (cut-support.js 1485), which premium-ui never calls |
| 7831 | v96 | `apx96UndoLastSet` | OVERRIDDEN | overridden by cut-support.js:1796 |
| 7843 | v96 | `apx96OpenQueueManager` | OVERRIDDEN | overridden by cut-support.js:1848 (original still runs via wrapper) |
| 7852 | v96 | `apx96BaseLogSet` | UNREFERENCED | no references |
| 7860 | v96 | `apx96SaveFloorball` | LIVE | live: premium-ui.js |
| 7869 | v96 | `renderFloorball` | LEGACY-ONLY | legacy only |
| 7878 | v96 | `apx96HistoryDates` | UNREFERENCED | no references |
| 7886 | v96 | `showHistoryDay` | OVERRIDDEN | overridden by premium-ui.js:2830 |
| 7896 | v96 | `apx96SetMoreView` | OVERRIDDEN | overridden by cut-support.js:1837 |
| 7900 | v96 | `apx96MoreHeader` | LIVE | live via apx96MoreSectionHTML |
| 7903 | v96 | `apx96MoreSectionHTML` | LIVE | live: cut-support.js NXT.old call |

## 8. Known hazards

Ordered by the risk they carry. Severity tags: **[data]** could lose or corrupt stored records; **[cloud]** sync or account behaviour; **[privacy]**; **[UI]**; **[latent]** no live path today; **[dead]** code that never runs; **[a11y]**; **[ops]**. Every item is a static finding unless marked "verify at runtime".

1. **[data] Corrupt JSON is silently replaced.** `load()` returns the fallback for any parse error (2878). `persist()` then rewrites every `apm_*` key on every call (2891–2906). The first save after a corrupt read overwrites the raw value with the fallback, and no recovery copy is taken first. Verify at runtime.
2. **[data] Every launch rewrites all records.** `NXT.install()` ends with `persist()` (cut 1775), and install runs on every boot at parse time (cut 1920). The write also schedules a cloud save if signed in. The `maybeSnapshotTDEE()` persist (cut 478–490) is one more write per day.
3. **[data, cloud] Cloud values for plan and goals are normally shadowed.** The merge is `{...cloud.settings, ...localSettings}` (cut 1995–1996). Boot always writes `weeklyPlan`, `dayOverrides` (as `{}`) and the goal keys into local settings, so the cloud values for those keys are only used when the local object lacks them. Verify at runtime on a device that has local settings. The Ascension baseline audit (`tasks/ascension/PLAN.md`) reports the same path as a confirmed split-data-loss bug (`cut-support.js` ~1990, `index.html` ~2717).
4. **[cloud] Every tab tap uploads the whole payload.** `switchTab` calls `persist()` (2954–2958). `persist()` calls `scheduleCloudSave()` (2905), which uploads after 900 ms (5381–5385). A load also writes back (cut 2219). This costs bandwidth and makes the cloud copy as fresh as the last tap.
5. **[cloud] Possible second Supabase client.** `cloudLogin` and `cloudSignup` set `sbClient = null` (5456, 5475) before calling `initSupabaseClient()`. Once a client exists (created at boot by 7497 when the URL and key are stored), this constructs another `createClient` in the same browser context. Verify the console warning at runtime.
6. **[privacy, cloud] Backups carry the Supabase key.** `getFullBackup` dumps every `apm_*` key, which includes `apm_sb_url` and `apm_sb_key` (5196–5199). The same dump goes into exported JSON (5202) and the recovery snapshot (cut 733–757). The key is the one the user typed; `validConfig` (premium 2213–2220) warns against service-role keys, but it is used only by the connection test (premium 2229). `cloudLogin` and `cloudSignup` store the key without it.
7. **[cloud] Deploy-preview guard does not cover localhost.** On `localhost`, cloud writes are live and the fixture scripts also load (seed.dev.js 6–7; seed.scenarios.js is localhost-only). Fixture data written there can reach a signed-in account. This follows D23, which names only deploy previews.
8. **[data] Two old plan names are no longer converted.** Only `Legs` → `Pump` runs on boot (cut 1739–1752). The migrators for `Upper`, `Legs + Core` and `Zone 2 / Rest` have no call site (6762–6771, 7021–7031). Stored values of those names in `weeklyPlan`, `dayOverrides` or the previous plan are not converted by live code. Verify against real data.
9. **[data, latent] `logsForDate` is defined twice.** `workoutTotals` (6261) calls the three-argument form, but the one-argument definition at 7235 wins, so the type and gym filters are ignored. `workoutTotals` is reachable only through the intercepted legacy coach branch, so the bug is latent.
10. **[data, latent] Renaming a gym orphans its plans and notes.** `renameGym` (3280–3289) rewrites `gym` on logs and cardio only. Session plans, exercise notes and coach insights are keyed by gym name (`sessionKey` 3562–3564, `v88NoteKey` 3617, `coachInsightKey` 6193) and are not rekeyed. `renameGym` is dead in practice (its only caller, `gymSettingsHTML`, is unreachable), so this is latent.
11. **[data] A day with logged sets can be re-typed from Today.** `chooseSession` (cut 1534–1537) has no logged-sets check. `setDayType` has one (cut 1570). The Today path therefore changes the day type of a day with records. The records keep their own `dayType`, so this affects the plan rather than history. The working tree adds this guard (section 9). Confirm the intended behaviour.
12. **[data] `moveDay` has no caller but writes overrides on both dates.** It swaps overrides for two dates (cut 1579–1584) and nothing in the live UI calls it. If it were wired back in, the overrides would stay in place with no single-day clear to undo them.
13. **[data] A rollover can leave a stale exercise selected.** `setDateToToday` sets `state.exercise` from `TEMPLATES` (6625–6633), not from the saved routine. `ensureExerciseSelected` (3728–3734) only fills an empty value, so the stale name can persist until the user picks one. Verify at runtime.
14. **[data] A failed snapshot blocks the V99 upgrade on every launch.** `install` returns before `version` is set when the "Before V99 upgrade" snapshot fails (cut 1760). It also skips `mergeLegsIntoPump` on that boot, and retries on the next one. The working tree keeps the early return (section 9).
15. **[state] `minimumWorkout` is lost on reload.** It is set at cut 1525, 1527 and main 6961 and is not in `persist()` (2891–2906). The trimmed session queue is persisted, but the flag that marks the session as minimum is not.
16. **[ops] Duplicate definitions.** `jss` (3260, 3261), `setGym` (3268, 3274), `renderFloorball` (7151, 7869) and `logsForDate` (6204, 7235). The later definition wins in each case. Delete the earlier copies in a separate change.
17. **[ops] Duplicate error handling and listeners.** `window.addEventListener("error")` and `"unhandledrejection"` (6446, 6449) both toast, and `window.onerror` (7493) also replaces the Home page. One uncaught error therefore produces up to two toasts and a blank Home. The focus listeners in `apex-v85` (7522–7531) and `apex-v86` (7934–7947) are the same, so each focus event runs them twice.
18. **[UI, security] Raw error text is written into the page.** `window.onerror` (7493–7496) interpolates `msg` into a template string and assigns it with `innerHTML` (7495). The message is not escaped. The Home page is replaced by that card, and there is no recovery action.
19. **[dead] Stale pre-merge `applyCloudPayload`.** The body at 5334–5361 is unreachable. `cut-support.js` 1839 replaces the global, and the merge reassigns `NXT.old.applyCloudPayload` (1981). The body would overwrite local records and set `state.date` from the cloud (5347). Remove it in a D5-style audit.
20. **[dead] Five migrations have no call site.** `migratePumpSessionPlans` (6674), `migrateLegsCoreToAbCrunch` (6688), `normalizeLegacyDayNames` (6762), `migrateLegsCoreTemplate` (6778), `migrateSingleLegsCoreCycle` (7019).
21. **[dead] `saveGoalSettings` reads DOM ids that do not exist.** It reads `setStart`, `setTargetHigh`, `setTargetLow`, `setTDEE` and `setZone2Target` (3243–3259). The live goal form uses `goalStartWeight`, `goalTDEE` and `goalZ2` (3222 markup, saved by `updateGoalSettingsFromInputs`, 6084).
22. **[dead, latent] Intercepted Settings branches.** `NXT.moreView` handles `training`, `goals` and `coach` itself (cut 1592–1600), and premium handles `training` and `data` before calling it (premium 2037–2046). The `apx96MoreSectionHTML` branches for training, goals, coach, body and data (7905–7916, 7911–7913, 7920–7922) are therefore unreachable. Helpers that are reachable only from them are dead in practice: `splitSettingsHTML` (6034; its `onchange` writes `settings.weeklyPlan`), `goalSettingsHTML` (3222), `leanCutSettingsHTML` (6998), `backfillAllCoachInsights` (6307), and the coach-insight engine (6213–6373).
23. **[dead] The apex-v95 weight-edit path has no caller.** `apx95EditWeight` (7732), `apx95SaveEditedWeight` (7750) and `apx95DeleteWeight` (7766).
24. **[latent bug] `apx96StopRest()` is undefined.** `addOnRemove` calls it when the last add-on is removed (premium 1142), inside a `try` that swallows the `ReferenceError`. The rest timer is therefore not stopped on that path. A rest-stop helper that does exist is `apx96SkipRest` (7821). The test `wearables.train-enrichment.test.js` (270) asserts only that the text `apx96StopRest` appears in `addOnRemove`, so it passes while the function is missing. The same line is in `classic/premium-ui.js` (786). Verify at runtime.
25. **[privacy] Hard-coded personal defaults.** The splash greeting defaults to the name `'Dan'` (2639) and so does `userName` (premium 58). `cycleGym` falls back to the gym names `"AF Redhill"` and `"SUTD"` when fewer than two are stored (6431).
26. **[ops, offline] Unpinned CDN scripts block parsing.** `tesseract.js@5` and `@supabase/supabase-js@2` load from jsDelivr without exact versions (2711–2712), synchronously, before the main script. Neither is in the `sw.js` shell. `initSupabaseClient` returns null when `window.supabase` is missing (5363–5366). The Supabase connection test reports the missing library (premium 2230).
27. **[a11y] Pinch zoom is disabled.** The viewport meta sets `maximum-scale=1.0,user-scalable=no` (line 5). WCAG 1.4.4 (resize text) is affected.
28. **[CSS] Heavy `!important` use and token overrides.** 476 `!important` declarations sit in the block (section 6). Four `:root` blocks share names, and the last definition wins (2332–2351 override 23–40 and 2151–2166). Nine class names are referenced by no script (section 6.2), which is a candidate list.
29. **[code] `validateField` sits after `</body>`.** The script at 7978–8024 comes after `</body>`. The parser moves it back inside `<body>`, so it works, but the HTML is invalid. Its capture-phase `blur` and `focus` listeners run for every form control.
30. **[code] The service-worker guard tests an undefined flag.** `window.NXTFRM_STANDALONE` (5013) is never defined, so registration runs on every non-localhost host.
31. **[code, latent] `touchstart` is stopped with no consumer.** `apex-v85` calls `stopPropagation()` on touches on form controls (7532–7536). No listener is affected today.
32. **[boot] Possible early legacy paint.** `initCloudFromStorage` in the main script (7497) calls `render()` at 5377 once `getSession()` resolves, if a session is stored. That can run before `cut-support.js` and `premium-ui.js` are parsed, and paint legacy renderers. The splash hides it on first load. Verify timing.
33. **[cloud] Credentials are stored before sign-in succeeds.** `cloudLogin` and `cloudSignup` write `apm_sb_url` and `apm_sb_key` (5454–5455, 5473–5474) before `signInWithPassword` or `signUp` runs. A failed attempt leaves the URL and key stored, and they then appear in the banner's "configured" check (cut 2120).
34. **[data] The cloud payload includes a field that is never set.** `getCloudPayload` sends `readiness: state.readiness || []` (5320). `state.readiness` is never assigned, so the field is always empty.
35. **[ops, latent] Gated features still ship.** The 13 wearable scripts (`wearables.js` and its modules) and `train-anatomy.js` load on every launch, while the Wearable row (premium 2065) and the Reminders row (2059) are hidden by `FEATURES` (cut-support.js 331). Those scripts are parsed on every launch with no visible effect. This matches PLAN item 8.

## 9. Working-tree changes not in the HEAD anchor

The analysis is anchored to `HEAD` `029eb51`. At session start the working tree matched HEAD (`git status` listed only untracked items). It changed during the run and was still changing at the last check (about 13:00). The changes belong to the parallel Ascension workstreams in `tasks/ascension/PLAN.md`, where each file has a named owner. Nothing in this report was re-verified against them, except where stated.

- **`index.html`** (`git diff`: +116 −27; last changed 12:58:58). Line 2 carries `style="background:#07060B;color-scheme:dark"` on `<html>`. Lines 6–13 add a comment and `<meta name="color-scheme" content="dark"/>`, and the theme-colour meta changed from `#121216` to `#07060B`. The head and launch-splash changes fit PLAN agent E's scope. Lines below an insertion move, so the offset changes as the file is edited. The boot-time findings (section 5) describe HEAD.
- **`premium-ui.js`** (`git diff`: +244 −10; last changed 12:50:48). At 12:45 the file had a 219-line block inside the NXP IIFE at line 1285, with small edits at 1239–1282 and 1495. That fits PLAN agent B's `exerciseDetails()` scope. The main-script reachability was re-run against the 12:45 version and nothing changed (0 of 403 statuses). Later edits were not analysed.
- **`cut-support.js`** (`git diff`: +46 −8; last changed 12:57:55). It adds programme stamps for the cloud merge's conflict rule: `settings.planUpdatedAt`, `cfg().overrideMeta[date]` and `cfg().templateMeta[gym__type]`. They are stamped in `commit()` and rebased in `install()`. It also:
  - adds a logged-sets guard to `chooseSession` ("Same rule as the day sheet (D35)"), which resolves hazard 11 in the working tree;
  - wraps `persist()` inside `install` and wraps `NXT.install()` itself in a `try`, so a refused write no longer stops the rest of the file (D29). Install still returns early when the V99 snapshot fails, but it now rebases first (hazard 14);
  - adds `addOns` to the backup restore keys.
  The merge block (`applyCloudPayload`, 1981–2006 at HEAD) was not among the changed hunks at the last check, so hazard 3 still describes HEAD.

The other analysed files were unchanged at the last check: `strata.js`, `sw.js` and the wearables modules.

## Caveats and method notes

- **Static analysis only.** Nothing was executed, no browser was used, and the app was not run. "LIVE" means statically referenced from a live entry point. It does not mean observed running.
- **Entry points.** A name is live if a live entry point references it, followed transitively through function bodies. The entry points are `premium-ui.js`, `strata.js`, `cut-support.js`, the shell markup and `onclick` strings, boot statements, and verified captured-original call sites. Within `cut-support.js` and `premium-ui.js`, references count even when the referencing function is itself unused. Five names were corrected by hand where that gave a false LIVE (section 1).
- **Engine and UI internals.** `cut-support.js` (the NXT engine) and `premium-ui.js` (NXP) were not classified function by function. Only the references they make to main-script names were checked, plus the reachability checks named in sections 3 and 8.
- **Not modelled.** String-built calls, `window[name]` lookups, and paths that depend on runtime data. Verify "verify at runtime" items in a browser before acting on them.
- **Purposes.** Purposes for core paths were read from the code. Purposes for legacy and dead helpers are inferred from their names and bodies.
- **Not analysed.** The wearables modules, `train-anatomy.js` internals, `design-vnext/`, `design-v10x/`, the seed scenarios' content and the tests.
- **Repository state.** Nothing in the repository was edited. The only file written is this one. No git state was changed (only `git show`, `git status` and `git diff` were run).
