# Coaching Intelligence 2.0 — engine report (`coach.js`)

Branch `ascension`, 2026-10-13. Workstream C (coaching engine). Nothing committed or pushed.

## 1. Summary

`coach.js` adds `NXT.coach`, a deterministic coordinator over the existing engine. It provides:

- one validated shared context;
- day statuses (done / partial / missed / excused / moved / upcoming / today / rest, plus `untracked`);
- excuse and catch-up writers;
- a dismissal memory;
- a ranked, explainable insight list (at most one per domain, top 3 for Today);
- a deterministic review of the last completed Mon–Sun week.

There are no model calls, no scores (D9), and only canonical morning weigh-ins feed anything weight-related (D14). Nothing is emitted for switched-off features (D49/D55). No existing calculation, threshold, record shape or storage key changed. `review()`, `diagnose()`, `coachFor()`, `aimFor()`, `bestSet()`, `strengthItems()`, `activityWeeks()` and `setDayType()` are called, not edited.

Verification:

- **Static:** `node --check coach.js` passes.
- **Suites:** after the §10 owner decisions, 20 suites, 563 passed, 0 failed (48 in `wearables.coach.test.js`). This section's figures below are from before §10: 558 passed, 0 failed at that run. That is the 490 baseline, plus my 43 in `wearables.coach.test.js`, plus 25 in `wearables.plan-persistence.test.js`, which the reliability agent is adding concurrently (it read 23 earlier in the session). The release gate passes with the new script tag and offline-shell entry.
- **Browser:** the app boots in Chrome on the dev server with zero page errors. Reads made zero writes. The write path survives a reload. Details in §7.

**Files.** New: `coach.js` (1,140 lines; 183 are the contract header) and `wearables.coach.test.js` (907 lines, 43 tests). One line in `index.html`: `<script src="coach.js?v=161"></script>` right after `cut-support.js`. One line in `sw.js`: `'coach.js'` after `'cut-support.js'` in `VERSIONED`. No other file was touched. The other modified files in the working tree belong to the parallel agents.

## 2. Architecture

```
stored rows (logs, bws, cardio, floorball) + settings (weeklyPlan, dayOverrides, cutSupport)
        │
        ▼
existing engine (cut-support.js) ── review · detectPlateau · trendStats · weights · workRows
        │                            sessionRows · bestSet · aimFor · coachFor · strengthItems
        │                            activityWeeks · activitySummary · typeFor · templateFor
        ▼
coach.js
  index()        one pass over the records → per-date sets/cardio/floorball, per-lift rows,
                 first activity date, moved-from links
  dayCtx()       DayContext per date                       ─┐
  weekOf()       the week around a date                     │ buildContext() = context()
  liftsFor()     planned + recent lifts with aim/coach      │
  review/trend/plateau (windowed, see below)               ─┘
  proposalAt()   catch-up proposal                          → catchUp()
  evaluators     schedule · strength · cardio · weight · data
  coordinator    staleness → conflict demotion → dismissal → one per domain → rank
                                                            → insights()
  reviewOf()     last completed week                        → weekReview()
  writers        excuse · unexcuse · dismiss · markReviewSeen · applyCatchUp → NXT.commit()
```

**Idiom.** `coach.js` uses `Object.assign(NXT, (() => { const N = NXT; … return {coach:{…}}; })());`, the same idiom as the bottom of `cut-support.js`. Load-time code touches only `NXT`.

**Read guard: `pinned(patch, fn)`.**
- **The problem.** `aimFor()` and `coachFor()` call `cue()`, which appends to `cfg().suggestions` and calls `persist()`. That log is one nothing reads (inventory finding 15). Calling them for every lift on every Today render would write storage and start cloud saves.
- **The guard.** While a read runs, `pinned()` swaps the global `persist` for a no-op, then restores it and the suggestion log in a `finally`. This is the same swap-and-restore idiom `loadCloudNow()` uses for `toast`.
- **Fallback.** If `persist` were ever not a swappable global-object property, lift aims read `null` instead, so a read can still never write.
- **Proof in Chrome.** With `persist`, `Storage.setItem` and `NXT.commit` instrumented, every read made 0 calls. The suggestion log, settings and state were byte-identical before and after.

**As-of reads.** When a read is given a date other than `state.date`, `state.date` and `state.dayType` are pinned for the synchronous call and restored. The whole engine (`cleanRows`, `workRows`, `review`, `aimFor`) then answers "as of" that date. A test proves that a later state asked about an earlier date returns output deep-equal to the earlier state's.

**Performance.** Two narrowings each return the identical answer. Both are pinned by equality tests, and mutation-tested: breaking either makes a test fail.
1. **`review()` runs on a 56-day log window.** Its output depends only on delta-based lift statuses, which need a lift's last four sessions inside 56 days. Each lift's first working row is kept too, so `strengthItems()` keeps its first-appearance tie-break before its cap of 24.
2. **`aimFor()`/`coachFor()` run on just the dates of the engine's own last three sessions for that lift.** They read only `last`, `prev`, `slice(-3)` and `at(-3)`.

Timings (Node, 40 weeks / 1,720 logs):

| Call | Time |
|---|---|
| `insights()` | 38 ms (was 97 ms before the narrowings) |
| `context()` | 34 ms |
| `weekReview()` | 27 ms |
| `dayStatuses` (42 days) | 6 ms |
| Today today: `N.review()` + `N.strengthItems()` | ~112 ms per render (for scale) |

On the seed in Chrome: `insights()` 5.9 ms, `weekReview()` 1.3 ms, `context()` 3.0 ms.

**Storage.** There is no new `apm_*` key. Two objects are added inside `settings.cutSupport`, each created lazily on the first write. They ride backup and sync with `settings` like the other coaching extras. The reliability agent's change stamps programme edits inside `commit()`. Because `applyCatchUp` writes its note and then calls `setDayType()`, one `commit()` persists and stamps both.

## 3. Contract

The full contract is also in the `coach.js` header. Dates are `'YYYY-MM-DD'`. An omitted date means `state.date`; an invalid one returns `null` or `[]`. Read functions never persist.

### 3.1 `NXT.coach.dayContext(date)` → DayContext | null

`{date, type, label, status, reason, note, movedTo, movedFrom, logged:{sets, cardioMin, floorball}}`

| status | rule (first match wins) |
|---|---|
| `done` | the day's own record exists: working sets on a lifting day (≥ half the planned working sets), cardio minutes on Zone2, a floorball session on Floorball |
| `partial` | lifting day with working sets < half planned. Planned = that date's session queue (a shortened session stays short), else its session targets, else the saved routine for the gym it was lifted at |
| `excused` / `moved` | `cfg().dayNotes[date].status`. Applies to any date, so a trip can be excused ahead |
| `rest` | type `Rest` |
| `today` | `date === state.date`, own record not there yet |
| `upcoming` | after `state.date` |
| `untracked` | past day before the first stored activity record, or a Floorball day while `features.floorball` is off. No observation, so neither done nor missed |
| `partial` | past day with other activity but not its own (D48's "logged, plan not done": a walk day with only an add-on lift, a lifting day with only a walk) |
| `missed` | past, expects activity, nothing at all logged, not excused or moved |

`reason`: `sick` / `travel` / `rest` / `other`, or `null`. `note`: text or `null`. `movedTo` is the date a moved session went to. `movedFrom` is set on the day that received a moved session. `logged.sets` counts `workRows()` (working sets, all gyms).

### 3.2 `NXT.coach.dayStatuses(start, end)` → DayContext[]

Inclusive range, clamped to 92 days, built from one pass over the records. Returns `[]` for invalid input or `end < start`.

### 3.3 `NXT.coach.context(date)` → Context | null

```
{date, dayType,
 plan:{weeklyPlan:{0..6: type|null} (0 = Sunday), overrides:{date: type} (last week's Monday → next week's Sunday)},
 week:{start, end, days:[DayContext×7], liftsPlanned, liftsDone, liftsMissed, liftsRemaining, cardioMin, cardioTarget, daysLeft},
 lifts:[{name, gym, lastDate, daysSince, best:{weight,reps}|null, aim:{weight,reps,kind,why}|null, holdReason,
         stall, readyToIncrement, returning, nextDate, nextType, coach:{kind,headline,note}|null}],
 weight:{trend:{current,previous,earlier:{n,avg}, change, priorChange, percent}, review:{tone,title,message,action,reason,change},
         confidence, plateau:{ok,plateau,status,weeklyRate,lower,upper,n,spanDays,plateauDays,confidence,lastDate,lastAvg,reason},
         lastMorningDate, lastMorningWeight, daysSinceMorning, contextualOnlyDays},
 cardio:{weekMin, target, lastDate},
 cut:{start, goal:{low,high}|null, elapsedDays},
 freshness:{lastMorningDate, daysSinceMorning, lastSetDate, daysSinceSet, lastCardioDate, daysSinceCardio, lastContextualDate},
 features:{…NXT.features}}
```

Week fields:
- **`liftsPlanned`**: lifting-type days not excused, moved or untracked.
- **`liftsDone`**: dates up to `date` with working sets, the same as `completedWeek()`.
- **`cardioTarget`**: `settings.zone2WeeklyTarget || 90`, the value every screen uses.
- **`daysLeft`**: days from `date` to Sunday inclusive (Mon 7 … Sun 1).

Lifts:
- **Which lifts.** Exercises in the routines scheduled over the next 7 days at `state.gym`, plus any lift with working sets in the last 28 days at any gym. At most 40, planned first.
- **`aim`/`coach`.** `aimFor()`/`coachFor()` run for that lift's gym with the routine of its next scheduled day, so the rep range is the user's own. Leg Press in Friday's Full C reads 10–15, not Monday's 8–12.
- **Flags.** `returning` = 15+ days since the last session. `holdReason` = `aim.why` when the aim is not a load step.

Everything missing is `null` or empty, and the shape test walks the whole object for NaN or undefined. A scheduled session is never assumed done.

### 3.4 `NXT.coach.catchUp(date)` → Proposal | null

```
{missedDate, missedType, missedLabel, todayType, consequences:[strings],
 apply:{setDayType:{date, type}, dayNote:{date, status:'moved', to}}}
```

A proposal is made only when **all** of these hold:
- `date` is not a lifting day and is not excused.
- Nothing is logged on `date`: no log row of any kind (warm-ups included, matching `setDayType`'s guard), no cardio, no floorball.
- A lifting day 1–7 days before `date` is `missed`, or, since the owner decision in §10, `partial` with zero working sets.
- No later day up to the end of `date`'s week covers it. Covering means the same session type is already logged on a later past day, or still scheduled after `date` and not excused.

The most recent qualifying day wins. Cross-week misses are therefore offered only when the session doesn't recur this week. `apply` is plain data stating exactly what `applyCatchUp` writes.

Example consequences (10-week fixture, Thursday):
1. "Full Body B moves to today (Thu 15 Oct)."
2. "Today’s Easy cardio is dropped for this week."
3. "Wednesday reads Moved."
4. "Tomorrow is still Full Body C, so lifting falls on two days in a row." (only when true)
5. "The weekly plan itself does not change."

### 3.5 `NXT.coach.insights(date)` → Insight[] (≤ 3) with `.all`

`.all` holds every visible insight, ranked, at most one per domain (≤ 5). `.all` is an array property, so `JSON.stringify` drops it.

```
{id, domain:'schedule'|'strength'|'weight'|'cardio'|'data', severity:'act'|'watch'|'info', title, body,
 evidence:[{label, value, date?}], why:{noticed, evidence, matters, canDo}, action?:{label, kind, payload},
 dismissible:true, fingerprint}
```

**ids:** `schedule.catchup:<missedDate>` · `schedule.behind:<weekStart>` · `schedule.streak` · `strength.ready` · `strength.hold` · `strength.stall` · `strength.returning` · `cardio.week:<weekStart>` · `weight.review` · `data.morning`.

**`why` sentences:** `noticed` is the observation, `evidence` the observation's data, `matters` the interpretation, `canDo` the optional action. Each is a plain sentence ending in a period.

**Action payloads (the UI maps these):**

| Payload | Call |
|---|---|
| `catchUp` → the Proposal | confirm, then `applyCatchUp` |
| `excuse` → `{date}` | `NXT.coach.excuse` |
| `{sheet:'review'}` | `NXT.openReview` |
| `{sheet:'cardio'}` | `showCardioSheet` |
| `{sheet:'weight'}` | `apx95OpenQuickWeight` |
| `{sheet:'day', date}` | `NXT.openDay` |
| `{tab:'train'}` | open Train |
| `{tab:'weight', view:'strength', exercise?}` | Progress › Performance |

**Fingerprint.** `fingerprint` is the FNV-1a hash of the evidence labels and values. Values are chosen at the granularity that should bring a dismissed insight back: a new session, new minutes, a new verdict, or a new flat session for a stall. Daily noise (a rate moving in its second decimal) does not change it.

### 3.6 `NXT.coach.weekReview(weekStart?)` → WeekReview | null

By default this reviews the last completed Mon–Sun week before `state.date`'s week; any date selects its own week. Returns `null` for a week not yet over, or when nothing (activity or a morning weigh-in) is stored on or before its Sunday.

```
{weekStart, weekEnd, lifts:{planned, done, missed, excused, moved}, sets, tonnage, vsPrev:{sets, tonnage},
 outcomes:{beat, matched, below, exercises}, cardio:{min, target, sessions}, weight:{avg, prevAvg, change, readings},
 days:[DayContext×7], nextWeek:[{date,type,label}×7], seen, headline, lines:[strings]}
```

- **From `activityWeeks()`, by construction and by test:** `done` (= `liftDays`; partial days count as done), `sets`, `tonnage`, `cardio.min`, `cardio.sessions` and `vsPrev`. They are `null` before the first activity record (absent, never zero).
- **`outcomes`.** The finish summary's D20 rule: each exercise's best working set against its previous session at the same gym. `exercises` counts exercise-sessions, compared or not.
- **`weight`.** The Mon–Sun average of canonical readings (Week by week's rule), `null` below 3 readings, rounded to 2 decimals.
- **`nextWeek`.** The week after the reviewed one, which by default is the current week.
- **Copy.** The headline uses D59 wording ("Plan met · 3 of 3 lifting days" / "Below plan · 2 of 3 lifting days" / "Nothing logged this week"). The lines are factual, and the strength line uses the engine's own status words ("Tracked lifts on Sunday: 3 Improving · 4 Holding steady · 1 Review"). There are no causation claims.

### 3.7 Stored fields (additive, inside `settings.cutSupport`)

| Field | Shape | Writer |
|---|---|---|
| `dayNotes[date]` | `{status:'excused', reason:'sick'\|'travel'\|'rest'\|'other', note:'' (≤ 140 chars), ts}` | `excuse` |
| `dayNotes[date]` | `{status:'moved', to:'YYYY-MM-DD', ts}` | `applyCatchUp` |
| `coach.dismissed['<id>\|<fingerprint>']` | `ts` (entries > 60 days pruned on the next write, cap 200) | `dismiss` |
| `coach.reviewSeen` | `'YYYY-MM-DD'` (a Monday, monotonic) | `markReviewSeen` |

### 3.8 Writers

Every writer persists through `NXT.commit` (save, close the open sheet, repaint, toast) and returns a boolean.

- **`excuse(date, reason, note)`.**
  - Refused with a toast when the day has any log row ("This day already has logged sets.", same guard as `setDayType`), when it is a Rest day ("A rest day has nothing to excuse."), or when it already has its own record ("This day is already logged.").
  - An unknown reason becomes `other`. The note is whitespace-collapsed and capped at 140 characters.
  - Toast: "Wed 14 Oct excused · sick".
- **`unexcuse(date)`.** Removes an `excused` note only. Toast: "Excuse removed".
- **`dismiss(id, fingerprint?)`.** Without a fingerprint it uses the current one. Unknown ids return `false` and write nothing. No toast.
- **`markReviewSeen(weekStart?)`.** Defaults to the last completed week. A no-op (`true`, no write) when a later week is already seen. `commit()` closes an open sheet, so call it from the review sheet's Done/close action.
- **`applyCatchUp(proposal)`.**
  1. Re-derives the proposal. A stale or tampered one is refused with "This catch-up no longer applies." and nothing is written.
  2. Writes `dayNotes[missedDate] = {status:'moved', to, ts}`.
  3. Unticks a stale "Make every <weekday> this" box if one is in the DOM, since `setDayType` reads it and a catch-up must stay one day.
  4. Calls the existing `NXT.setDayType(date, type)`: one commit, stamped by the reliability agent's programme stamping. `settings.weeklyPlan` and `dayOverrides` are never written directly.
  5. If `setDayType` refuses, the note is rolled back.
  6. Toast: "Full Body B moved to today".

## 4. Evaluator rules and thresholds

| Domain | Rule | Severity | Threshold and rationale |
|---|---|---|---|
| schedule | catch-up proposal (§3.4) | act | **7-day window** (brief). Only a past `missed` lifting day qualifies, so a session that was started, or a day with other activity, is not "missed". Covering by the same type up to Sunday prevents a second copy of a session the week already has. |
| schedule | week behind: `planned − done − still scheduled > 0` | act if `planned − done ≤ daysLeft` (recoverable), else info | The brief's recoverability rule. Not emitted while a catch-up exists (catch-up outranks it). Recoverable action: "Plan <first free day>" (opens the day sheet). Unrecoverable action: "Excuse <last missed day>". |
| schedule | weeks-at-plan streak (full weeks, today's plan count, `activityWeeks`/`activitySummary` rule) | info | **≥ 3 weeks** (brief). Says plainly that the plan count is today's plan (no plan history). |
| strength | `aimFor().kind === 'load'` → one combined "ready to move up" naming lifts and loads | act | Lifts planned in the **next 7 days** at `state.gym`, trained **≤ 14 days** ago and not today (an aim relative to a session already done today would be stale). |
| strength | `coachFor().kind === 'stall'` → names the most recent stalled lift, lists the others | watch | D25's rule (three flat best sets within 28 days). Body is `coachFor`'s own note. |
| strength | 15+ days since the last session (cue's "ease back in"; > 28 days = new baseline) | info | One lift: "X: back after N days" with `coachFor`'s note. Several: "N lifts back after a break". |
| cardio | below target **and** behind the plan's pace | act if the rest fits at **≤ 45 min/day** (brief), else info | **Pace gate** (added, see §9). The expected minutes are the share of the plan's walk days already past times the target, or calendar days if the plan has none. Without it, every Monday would nag "90 min left". **Gate:** cardio logged in the last **28 days**, so nothing for someone not tracking cardio. |
| weight | mirrors `NXT.review()` only when its tone is `watch` or `detectPlateau().plateau` | tone decides: watch → watch, else info | Same headline as the Today decision card. Body = `review().reason` (the numbers) or the plateau reason, never the card's message. `why.matters` carries `review().message`. |
| data | last morning weigh-in exactly **3 days** ago | act | The EWMA restarts after a gap of **more than** 3 days (`EWMA_GAP_DAYS`), so weighing in today keeps the trend line continuous. A concrete, engine-grounded action. |
| data | **4+ days** | watch | The trend restarts and needs 3 readings to show again. The weekly comparison needs 3 readings per week. |
| data | only post-workout or scan weigh-ins, no morning one ever | watch | D14: they never enter the trend. `contextualOnlyDays` is counted and stated. |

## 5. Coordinator rules (in order)

1. Each evaluator proposes 0–n candidates.
2. **Staleness.** A candidate whose newest evidence date is more than **14 days** before `date` is dropped. Exactly 14 days stays.
3. **Conflict.** A cautious weight decision turns `strength.ready` (act) into `strength.hold` (info), reworded: "Hold Incline Dumbbell Press for now — qualifies for the next step, but the weight decision reads “Losing quickly” … holding the load is the conservative choice … Your call." Cautious means `review().tone === 'watch'`, or a title or action about recovery or slipping lifts (covers "Give recovery some attention", "Review your training load", "Losing fast, and lifts are slipping", "Losing steadily, watch your lifts", and the diagnose headline "Strength or recovery is slipping…").
4. **Dismissal.** Hide `id|fingerprint` pairs found in `coach.dismissed`.
5. **One per domain.** Keep the highest severity; evaluator order breaks ties, so catch-up comes before the others in schedule. "Week behind" is not proposed at all while a catch-up exists, so dismissing a catch-up does not make a near-duplicate "behind" card pop up.
6. **Rank.** Severity (act > watch > info), then schedule > strength > cardio > weight > data, then id. Top 3 for Today; `.all` carries the rest.

The coordinator is a pure function of stored data and date. Tests prove that two calls give deep-equal output, that two loads of the same data agree, and that as-of reads equal the earlier state.

## 6. Example outputs

### 6.1 Seed data (Chrome, `http://localhost:8763/?reseed=1`, real today Tue 13 Oct 2026)

Seed state: 174 logs (last lift 4 Aug), 83 morning weigh-ins (through today), 15 cardio rows (last 2 Sep). Weekly plan: the A/B/C split. Today is Zone2.

`NXT.coach.insights()`:

```
schedule.catchup:2026-10-12 [act]  "Full Body A missed yesterday"
  body: "Today is planned as Easy cardio with nothing logged yet, so the session can move here."
  why.matters: "Without it, this week can reach at most 2 of 3 planned lifting days."
  action: Move to today (catchUp)
strength.returning [info] "14 lifts back after a break"
  body: "DB Preacher Curl, Lat Pulldown, Reverse Fly +11 more: last logged 70–77 days ago."
```

There is no cardio insight: no cardio in 28 days. No weight insight: the decision reads "Cutting steadily", tone good. No data insight: weighed in this morning.

`NXT.coach.catchUp()`:

```
{missedDate:"2026-10-12", missedType:"FullA", missedLabel:"Full Body A", todayType:"Zone2",
 consequences:["Full Body A moves to today (Tue 13 Oct).","Today’s Easy cardio is dropped for this week.",
   "Monday reads Moved.","Tomorrow is still Full Body B, so lifting falls on two days in a row.",
   "The weekly plan itself does not change."],
 apply:{setDayType:{date:"2026-10-13",type:"FullA"}, dayNote:{date:"2026-10-12",status:"moved",to:"2026-10-13"}}}
```

`NXT.coach.weekReview()` (5–11 Oct):

```
headline: "Below plan · 0 of 3 lifting days"
lifts {planned 3, done 0, missed 3, excused 0, moved 0} · sets 0 · tonnage 0 · vsPrev {0, 0}
outcomes {0,0,0,0} · cardio {min 0, target 90, sessions 0} · weight {avg 82.21, prevAvg 82.72, change −0.5, readings 7}
lines: ["Missed: Mon Full Body A, Wed Full Body B, Fri Full Body C",
        "Cardio: 0 of 90 min · 0 sessions",
        "Morning average 82.2 kg · −0.5 kg vs the week before · 7 readings"]
seen: false
```

### 6.2 Fixtures (10 weeks of rows: Mon/Wed/Fri lifting, Tue/Thu/Sat walks; this week Wed not logged)

`weekReview()` (5–11 Oct):
- Headline: "Plan met · 3 of 3 lifting days".
- "3 lifting days · 43 working sets · 25,887 kg tonnage (±0 sets, +2,383 kg vs the week before)"
- "Best set vs last time: 15 beat · 2 matched · 1 below"
- "Tracked lifts on Sunday: 15 Improving"
- "Cardio: 90 of 90 min · 3 sessions"
- "Morning average 84.0 kg · −0.4 kg vs the week before · 7 readings"

### 6.3 Before / after against the existing engine

"Before" is what NXTFRM surfaces today: the Today decision card (`review()`) and, where a lift is involved, Train's coach line (`coachFor()`) for that lift. "After" is what the coordinator adds.

| Scenario | Before: Today decision / Train coach | After: `NXT.coach.insights().all` |
|---|---|---|
| New user, no rows | "Building your baseline" (neutral) | — (nothing) |
| 10 weeks at plan; Wed Full B not logged; today Thu (walk day) | "Cutting steadily, strength holding" (good) | schedule.catchup:2026-10-14 [act] "Full Body B missed yesterday" |
| Same week, today Fri (a lifting day) | "Cutting steadily, strength holding" (good) | schedule.behind [act] "1 lifting session behind this week" (action: Plan Saturday) · cardio.week [act] "60 min of cardio left this week" |
| Same week, today Sun, a walk logged | "Cutting steadily, strength holding" (good) | cardio.week [act] "40 min of cardio left this week" · schedule.behind [info] "1 of 3 lifting days, 1 day left" (action: Excuse Friday) |
| 10 weeks at plan, this week on track | "Cutting steadily, strength holding" (good) | schedule.streak [info] "10 weeks in a row at plan" |
| Incline DB Press 30 × 13 (8–12), loss −0.35 kg/wk | "Cutting steadily" (good) / Train: "Add 2.5 kg" | strength.ready [act] "Ready to move up: Incline Dumbbell Press" ("30 × 13 → 32.5 kg") |
| Same lift, loss −1.26 kg/wk (1.5 %/wk) | **"Losing quickly" (watch) / Train: "Add 2.5 kg". The two disagree.** | weight.review [watch] "Losing quickly" · strength.hold [info] "Hold Incline Dumbbell Press for now" |
| Lat Pulldown 50 × 10 three Wednesdays running | "Cutting steadily" (good) / Train: "Same best set three times" (only inside Train) | strength.stall [watch] "Lat Pulldown: same best set three times" |
| Romanian Deadlift last done 18 days ago | "Cutting steadily" (good) / Train: "Ease back in" | strength.returning [info] "Romanian Deadlift: back after 18 days" |
| Weight flat for 6 weeks | "Time for a small review" (neutral) | weight.review [info] "Time for a small review" (body: "…level for about 7 weeks…") |
| Last morning weigh-in 3 days ago | "Cutting steadily" (good): the card still reads the last week | data.morning [act] "Weigh in today to keep the trend continuous" |
| Last morning weigh-in 5 days ago + a post-workout reading | "Cutting steadily" (good) | data.morning [watch] "No morning weigh-in for 5 days" ("…1 day since had only post-workout or scan readings, which never enter the trend.") |
| Sat: 20 of 90 cardio min | "Cutting steadily" (good) | cardio.week [act] "70 min of cardio left this week" ("…2 days left, about 35 min a day.") |
| Sun: 20 of 90 cardio min | "Cutting steadily" (good) | cardio.week [info] "Cardio target out of reach this week" |

## 7. Verification (real output)

- `node --check coach.js`: OK. `node --check sw.js`: OK.
- `for f in wearables*.test.js; do node "$f"; done`: **20 suites, 558 passed, 0 failed** at the last run (490 baseline + 43 coach + 25 plan-persistence). The release gate is 54/54, including "the service-worker shell matches what the page requests".

`wearables.coach.test.js`: **43 passed, 0 failed**. It loads the shipped `cut-support.js` and then `coach.js` into one vm context. The index.html helpers (`resolveDayType`, `sessionKey`, `getT`, `TEMPLATES`) are copied in, and `persist`/`save`/`toast`/`render`/`localStorage` are instrumented. Coverage:

- **New user, sparse rows and 10 weeks of rows.** Morning weigh-ins only, unless a test injects post-workout or scan readings.
- **Day statuses.** The half-planned-sets boundary (8 = done, 7 = partial; a shortened queue changes the plan), D48 "neither" days, and `untracked` (before the first record; Floorball with the feature off). `dayStatuses` range, clamp and bad input.
- **Catch-up.** Exact consequences, the single write path through `setDayType` (a spy confirms the call), the weekly plan unchanged, the Moved note and its links, and the toast. A stale or tampered proposal is refused. A ticked "every weekday" box is neutralised. No proposal when today is a lifting day, cardio or a warm-up is logged today, today is excused, or a later day covers the miss. Window boundary: a miss 7 days back qualifies, 8 does not.
- **Excuse.** Status, reason, note, plan count and undo. Refusals for days with logged sets, rest days and walks already walked; nothing is persisted.
- **Insights.** A shape contract over 11 fixtures. Ready → hold demotion under "Losing quickly". Stall, returning, week behind (recoverable vs not) and streak. Weight mirrors `review()`. Cardio reachable vs unreachable, including exactly 45 min/day and a target of 91. Data at 2 / 3 / 4 days, contextual-only days, and no morning ever. Staleness at 14 vs 15 days. Dismissal: hidden, pruned, re-surfaced on new evidence. Switched-off features stay silent.
- **Week review.** Totals equal `activityWeeks`. Outcomes follow the finish-summary rule, including the gym, bodyweight and warm-up cases. The weight average needs 3 readings and ignores contextual ones. `seen` is monotonic.
- **Copy.** No exclamation, cheerleading, causation or "muscle preserved".
- **Determinism, as-of equality, purity.** Zero persist/save/setItem/toast/render calls and byte-identical settings and state across every read. A source scan confirms the six read functions name no writer, and `persist` is named only inside the read guard. The test also shows the guard is needed: `aimFor()` alone logs a suggestion and persists.
- **Equality of the two narrowings with the full calls.** This includes a 30-lift case where `strengthItems()`' cap of 24 decides the verdict.
- **Mutation check.** Disabling the first-row trick fails the cap test. Narrowing to two sessions instead of three fails the stall and equality tests.

Browser (Playwright, Chrome, 390 px, dev server `localhost:8763`, isolated context):

- **Boot.** Script order is `cut-support.js` → `coach.js` → `premium-ui.js`. Today renders. **0 page errors, 0 console errors, 0 coach warnings.**
- **Reads.** With `persist`, `Storage.setItem` and `NXT.commit` instrumented, all reads made **0/0/0** calls. The suggestion log, settings and state were unchanged, and `window.persist` was restored.
- **Write path.**
  - `applyCatchUp` → override `FullA` for today, `state.dayType` FullA, Monday reads `moved`, today's `movedFrom` is Monday, the weekly plan is unchanged.
  - Toasts: "Day updated" (`setDayType`), then "Full Body A moved to today".
  - `excuse(+3 days, 'travel', 'Work trip')` → "Fri 16 Oct excused · travel". `dismiss` hides the insight. `markReviewSeen` sets `seen`.
  - After a reload, the override, both notes, the dismissal and `reviewSeen` all persisted. Today shows "Full Body A". 0 errors.

## 8. Integration notes for the C-UI agent

1. **The week rail and History calendar must read `dayContext`/`dayStatuses`.** The current rail derives the plan count from `typeFor()` per day. After a catch-up it reads "This week · 0 of 4 lifts done": the moved Monday still counts, and so does an excused day. The Monday capsule keeps its "not logged" ring. `NXT.coach.context().week.liftsPlanned` gives the honest count (here 2), and the statuses give `moved`/`excused`. Observed in the browser after `applyCatchUp`.
2. **Catch-up.** Show `proposal.consequences` in a confirm sheet and call `applyCatchUp(proposal)` only on confirm. Offer "Mark excused" as the secondary action (`excuse(proposal.missedDate, reason)`).
3. **The weight insight intentionally repeats the decision headline.** Don't stack it beside the decision card on Today. Use it where the decision card isn't, or as the anchor of a feed.
4. **Commit side effects.** `dismiss` and `markReviewSeen` go through `commit()`, which closes the open sheet and repaints. Call `markReviewSeen` from the review sheet's Done/close.
5. **`.all` doesn't serialise.** `insights().all` is an array property; copy it out if you serialise.
6. **Train coordination is now available** (superseded by §10). Use `NXT.coach.trainAdvice(ex)` in place of `N.coachFor(ex)` for Train's coach line and target rows. It is identical unless a cautious weight decision meets a load step.

## 9. Deviations from the brief, limitations, open questions

1. **Ninth status, `untracked`.** The brief's eight statuses would call every past day before the first record (and every Floorball day while floorball is off) `missed`. A History calendar would then show months of false misses for a new or migrated user. `untracked` follows `activityWeeks`' "absent, never zero" rule. Remove it only if the owner prefers the literal list.
2. **Documented extras beyond the brief's field list.**
   - `week.end`, `liftsMissed`, `liftsRemaining`
   - `lifts.nextDate`, `nextType`, `coach`; `holdReason` (the brief's "hold reason")
   - `weight.lastMorningWeight`
   - the `freshness` fields
   - `dismiss(id, fingerprint?)` (second argument optional)
   - `NXT.coach.thresholds`
3. **Dismissal keys are `<id>|<fingerprint>` with a timestamp value.** This is how `{[insightId]: ts}` can hide "until the fingerprint changes".
4. **Cardio pace gate.** A new, constant-free rule (the plan's elapsed walk-day share). Without it the brief's "minutes vs target" fires every Monday.
5. **Catch-up and other activity:** resolved by the owner, see §10. A lifting day with zero working sets now qualifies even when a walk was logged. It still reads `partial`.
6. **A Rest day with add-on lifts reads `rest`.** `logged.sets > 0` is shown, whereas the D48 rail marks it done.
7. **The two narrowings depend on today's internals of `review()`/`strengthItems()` and `aimFor()`/`coachFor()`.** They are pinned by equality tests, so a future change there fails loudly rather than silently.
8. **As-of reads use the current settings** (plan, overrides, notes, dismissals). The app keeps no settings history.
9. **Sync.** Safe Sync merges `cutSupport` objects local-wins per key, so on a second device an unexcused note can come back from the cloud. This is the same as every other `cutSupport` object today. The reliability agent's stamped merge covers the plan and overrides, not these notes.
10. **The streak uses today's weekly plan for past weeks.** This is the same caveat as Progress › Training, and the insight says so.
11. **Read-time dismissals are not expired.** Entries over 60 days are pruned only on the next write, because a read must stay pure and deterministic.
12. **Performance.** ~38 ms per `insights()` at 1,720 logs in Node (5.9 ms on the seed in Chrome). This is on top of Today's existing ~112 ms of `review()` + `strengthItems()` at that size. If the UI calls it on every repaint, consider calling it after first paint.
13. **No owner decision recorded yet** for this module in `tasks/vnext/DECISIONS.md`. Logging it is for the design director.

## 10. Owner decisions implemented (2026-10-13)

Relayed by the coordinator. `untracked` and the cardio pace rule are kept as built.

### 10.1 Catch-up eligibility

**Rule.** A lifting day with zero working sets now qualifies for `catchUp()` even when a walk or other activity was logged that day: the lift did not happen, and the walk is a detail.
- **Status word kept.** The day's `dayContext` status stays `partial`, for D48.
- **Target day stays strict.** Nothing of any kind may be logged on `date`: no log row, no cardio, no floorball.
- **Started sessions excluded.** A lifting day with some working sets never qualifies.

**Contract.** The Proposal gains `logged:{sets, cardioMin, floorball}` for the missed day:

`{missedDate, missedType, missedLabel, todayType, logged, consequences, apply}`

The UI can then write "Full Body B didn't happen Wed (you walked 30 min instead)".

**Insight copy.** The catch-up insight's `why.noticed` says so: "Full Body B on Wed 14 Oct has no logged sets (30 min of cardio was logged instead) and is not marked excused or moved." Activity other than cardio is reported generically ("other activity"), so a switched-off feature is never named (D55).

**After applying.** The day reads `moved`, and the walk stays recorded in `logged`.

### 10.2 `NXT.coach.trainAdvice(exercise)`

`NXT.coach.trainAdvice(exercise)` → `{...NXT.coachFor(exercise), coordinated:{hold, reason, source}}`, or `null` when `coachFor()` is null or the name is empty.
- **Inputs.** The same as `coachFor()`: today's session and `state.gym`. `coachFor()` and `aimFor()` are untouched (D25).
- **Identical otherwise.** The output is `coachFor()`'s, plus `coordinated:{hold:false, reason:null, source:null}`, unless `coachFor()` steps the load up (`kind 'load'`) **and** the weight decision is cautious under the coordinator's rule 3 (tone `watch`, or a title or action about recovery or slipping lifts).
- **The weight review is read only when a load step is on the table.**

When both hold, the advice becomes:
- `kind: 'hold'`. Train's pill map already reads it as "Hold".
- `headline`: "Hold 30 kg — weight decision reads “Losing quickly”".
- **Per-set targets at the last session's best load.** They use `coachFor()`'s own drop pattern, shifted to that best set (30 × 13, 30 × 12, 30 × 11 instead of 32.5 × 10/9/8). `weight` and `reps` are that best set.
- `note`, one sentence: "The Aim still shows the engine's next step (32.5 kg); repeating 30 kg is the conservative choice until the decision settles."
- `coordinated: {hold: true, reason: "Weight decision reads “Losing quickly”", source: "weight"}`.

**Read-only.** `coachFor()` runs inside the read guard, so `cue()`'s suggestion log and `persist()` are neutralised. Train's existing direct `N.cue()`/`N.aimFor()` calls keep logging as before.

**UI follow-up.** Swap `N.coachFor(ex)` for `NXT.coach.trainAdvice(ex)` in Train's coach line and in `useTarget()`.

### 10.3 Tests and verification

Two existing tests were adapted for the decision, with their intent kept:
- The exact-proposal test now includes `logged`.
- The D55 silence test now scans user-facing copy (titles, bodies, why, evidence, action labels, consequences) instead of raw JSON, where it matched the new data key `logged.floorball`.

Five tests were added:
1. A lifting day with only a walk qualifies, still reads `partial`, and the proposal carries `logged`. The copy names cardio. Floorball is reported generically and never named. After applying, the day reads Moved and the walk stays recorded.
2. A started session never qualifies, and the target day stays strict.
3. `trainAdvice` holds under "Losing quickly" with a load step: an exact output, while `coachFor` and `aimFor` still state 32.5 kg.
4. `trainAdvice` is identical to `coachFor` with steady weight, on a one-more-rep day under "Losing quickly", for an unknown lift, and for empty input.
5. `trainAdvice` is deterministic and read-only: zero persist, save, setItem, render or toast calls, unchanged settings and state, and a clean source scan.

Results:
- `node --check coach.js`: OK.
- `wearables.coach.test.js`: **48 passed, 0 failed**.
- **Full run: 20 suites, 563 passed, 0 failed** (490 baseline + 48 coach + 25 plan-persistence). Release gate 54/54.
- **Chrome (seed data):** `trainAdvice()` on six seed lifts matches `coachFor()` (all `baseline` after 71 days; no hold, since the seed has no ready lifts). 0 `persist` and 0 `setItem` calls, suggestion log unchanged, `catchUp().logged` present, 0 page errors.

