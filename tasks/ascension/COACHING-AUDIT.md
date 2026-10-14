# Coaching intelligence — read-only audit and staged proposal (2026-10-14, corrected per owner review)

Scope: audit only. No application code, settings, account records, dependencies, schema or production were modified. Nothing was pushed, deployed, reset, cleaned or migrated. This file is new documentation and is uncommitted.

## 1. Repository and application context

| | |
|---|---|
| Canonical source | GitHub `dxnyal03/nxtfrm`, branch `main` at `a3baa71` = merge of PR #34 (`ascension`), merged by the owner 2026-10-13 12:17 UTC |
| Working checkout used | `/Users/alidanial/Documents/NXTFRM`, branch `ascension` at `1fcf4dc` (identical content to `origin/main` minus the merge commit); clean apart from the owner's untracked material (`design-v10x/`, `.claude/`, one PNG, six `tasks/vnext/shots/*.png`) and a stash `WIP on main: 4655060` |
| `/Users/alidanial/Developer/Projects/nxtfrm` | A separate clone of the same repository whose `main` is at `3333461` (2026-10-04, release 144), 16 commits behind `origin/main`; the current source revision is `origin/main` `a3baa71`, independent of which folder holds it. The clone carries unpushed local edits (`AGENTS.md`, `.gitignore`, `tasks/vnext/verify-2*.mjs`, `wearables.train-enrichment.test.js`) and untracked Codex/Cursor config (`.agents/`, `.cursor/`, `CLAUDE.md`, four skills); two worktrees (`codex/bklit-playground`, `codex/motion-kokonut-skills`) sit at the same commit, 0 ahead. Left untouched, as instructed. It would be a valid place to work once fetched and brought up to `origin/main`; nothing about its location causes a regression |
| `sources/` directory | none in either checkout |
| Production | `thecutdanyal.netlify.app` serves the merged release (`coach.js?v=161`, lazy OCR loader, `sw.js` with `RELEASE '161'`), verified by fetching the deployed files. The owner merged without a `RELEASE` bump. **How an already-installed phone picks the new bytes up is unverified**: the expected mechanism (a changed `sw.js` installs a new worker whose precache uses `cache: 'reload'`) was exercised only in desktop Chrome against a local origin, never on an installed iOS PWA |
| Rules read | `AGENTS.md` (unchanged since `029eb51`), `tasks/vnext/DECISIONS.md` D1–D59, the four `.claude/skills/nxtfrm-*` skills, `tasks/ascension/DECISIONS-PROPOSED.md` D60–D68 (proposed, not yet approved) |

## 2. Baseline checks

| Check | Result | Notes |
|---|---|---|
| `for f in wearables*.test.js; do node "$f"; done` | 21 suites, 592 passed, 0 failed | runs shipped code in a VM with fake storage; touches no live data |
| Production smoke (Playwright, no login, no seed, read-only) | branded splash first; `NXT.coach` present; service worker installed with `nxtfrm-v161-premium-cache`; four tabs render; 0 page/console errors | the browser's own temp profile only |
| Netlify deploy preview of the same commit (yesterday) | 10/10 checks | launch, tabs, charts, coach, offline reload |
| Not run | `tasks/vnext/verify-2*` (109-era, fail by design on current markup); anything that writes seed data into a profile the owner uses; anything against Supabase |

## 3. Findings against the six previously reported `cut-support.js` issues

Distinguish: **code present** (in the file), **reaches the UI** (on a live screen today), **reproduced** (exercised locally), **verified on production** (seen on the deployed app).

| # | Issue | Still in code? | Reaches the UI today? | Evidence | Appropriate correction |
|---|---|---|---|---|---|
| 1 | `adaptiveTDEE()` infers intake as `target × ADHERENCE_FACTORS[status]` averaged over logged days and labels the result "your real TDEE" | Yes (`cut-support.js` ~351–375) | **No.** `tdeeCardHTML()` returns `''` while `CALORIES_ENABLED=false` (D49); `diagnose()` only adds TDEE evidence under the flag. `maybeSnapshotTDEE()` still runs on every boot (`install()` ~1824) but stores nothing when no adherence is logged | code read; `inventory-engine.md` §0.3 | Behind the flag: rename to "estimated expenditure, assuming intake ≈ target × factor"; derive confidence from coverage and measurement conditions, not entry counts; stop calling it on boot while the flag is off. Do not delete (owner may re-enable calories) |
| 2 | `diagnose()` divides adherence by every day in the window, so missing answers depress the mean | Yes (`adhMean=adhSum/adhDays`, ~385) | **No.** The `dietary_drift` verdict and the Adherence evidence row are gated by `CALORIES_ENABLED`; `water_masking` no longer requires adherence | code read | Behind the flag: mean over *logged* days plus a separate coverage figure ("7 reported successful of 7 logged · 7 unknown"); require coverage ≥ N before any compliance verdict |
| 3 | One branch flags rapid loss while another recommends keeping the plan | **Yes, and live.** `review()` returns "Losing quickly" when the rate exceeds 1 % of body weight per week, but `diagnose()`'s first branch returns `no_issue` → "Cut is progressing. **Keep the current plan.**" whenever the slope is negative and no plateau exists, with no rate ceiling | Progress › Weight › "Why NXTFRM says this" renders `diagnosisCard()` (~1212, ~1335); Today renders `review()`. The Ascension coordinator (`coach.js`) reconciles Today and Train but does not touch the Progress diagnosis card | code read; both surfaces confirmed live | Give `diagnose()` the same rate ceiling as `review()` (shared constant), or derive the Progress card from the shared coaching decision. Add the fast-loss fixture to tests |
| 4 | Missing reps-in-reserve passes the effort check | **Yes.** `effortOkay = last.sets.every(r => r.rir===null||…||Number(r.rir)>=2)` (`cue()` ~705). The current Train interface does not expose effort entry (`#n99-rir` is a hidden input, `premium-ui.js` 1071), so sets logged with this interface carry no value; values recorded by earlier builds are still read by that rule (a logged reserve under 2 holds the load) | Live on every Train coach line | code read | Keep "unlogged RIR never blocks" (owner decision D24) and keep interpreting historical values exactly as now; carry an explicit effort state (`none / partial / full`) through `cue()` → `coachFor()` → `trainAdvice()` and say, in the advice, that a pushing target rests on reps alone. Whether to re-expose an effort control is a separate decision |
| 5 | Best-set performance can qualify a load increase, including two increments after exceeding the range by 3+ reps | **Yes, by owner decision.** D24: one session over the top is enough; D25: 3+ reps over takes two steps (`cue()` ~708 `(reps>=top+3?2:1)`) | Live on Train and in the Today "Ready to move up" insight | code read; D24/D25 | Conflicts with this roadmap's "avoid automatic jumps based solely on one exceptional set". Proposal needing the owner's decision: cap at one increment per session; allow the second step only when two consecutive sessions exceed the range; always state "based on one session" when D24 applies |
| 6 | Conclusions name causes more confidently than evidence supports | Partly. Dormant: "This looks like compliance, not metabolism", "Likely metabolic adaptation" (both behind the calorie flag), "This may not be a real plateau" (waist off). **Live:** `recovery_deficit` → "Strength or recovery is slipping. This looks like **load, not metabolism**." fires on a plateau plus two lifts down ≥ 8 % | Progress diagnosis card | code read | Hypothesis language with the evidence attached ("two lifts are down while weight is flat; load or recovery may be involved — a hypothesis, not a diagnosis"); never assert what it is *not* |

### Other findings relevant to the roadmap

- **Readiness.** `readiness()` returns `{score:78, known:false}` when no check-in exists (override ~1869). Check-ins are off (D55), so it is always unknown and the header shows "—". D4 gates its removal. No arbitrary precision reaches the UI, but the dead score should not survive a readiness rework.
- **The current Train interface does not expose effort entry.** New sets therefore carry no reps-in-reserve value and the effort rules in `cue()` and `coachFor()` see "unknown"; historical values (older builds, imports) are still interpreted. Any roadmap item that depends on fresh effort data first needs a decision on whether to collect it.
- **Programme edit (section 4): not implemented.** The factory `TEMPLATES.Push` still lists Tricep Dips (3 × 8–15, inc 0) and Cable Lateral Raise; the factory `Pump` lists Calf Raise. The owner's "unchanged" Pull and Legs lists do not match the factory templates (no Unilateral Seated Row, no Romanian Deadlift, no calf raise), so the live routines are the owner's **saved** routines in `cfg().templates[gym__type]`, stored in the owner's browser and cloud row, which this audit cannot read. "Chest Fly" and "Machine Chest Fly" exist in the exercise library (index.html ~7497, ~6989), as does "Machine Lateral Raise" (aliased to Cable Lateral Raise for substitution suggestions only). Comparisons use exact name + gym (`sessionRows`), so a Chest Fly row starts with no history and cannot inherit dip loads by construction. No "excluded exercises" preference exists; `routineDefault()` ("Restore default exercises") would reintroduce Calf Raise.
- **Weight trend.** Morning-only canonical row (D14), EWMA half-life 7 days restarting after a 3-day gap, 28-day OLS plateau test with a ladder to 90 days, 7-day windows for the weekly comparison, Mon–Sun averages requiring ≥ 3 readings. Activity date drives everything; `ts` is kept and used only for sync. Gaps: no explicit outlier rule (a single 2 kg reading enters the EWMA at α≈0.09, so its influence is bounded but not reported); `cleanRows` resolves two Morning rows on one date by **insertion order**, not `ts`; short-term acceleration is visible only through `trendStats` (7-day) versus `detectPlateau` (28-day) — the two are not contrasted anywhere on screen.
- **Cardio.** Minutes against a weekly target; the cardio sheet already says speed or incline cannot establish Zone 2; no calorie-from-duration anywhere while calories are off; the coach's cardio insight is neutral (minutes left), never praise. Cardio is not yet interpreted alongside weight rate (525 min in a week with a 1.6 kg weekly drop produces no caution).
- **Exercise identity.** Name + gym only. No variant, equipment, unit, per-hand/combined or assisted/added-load fields. `Tricep Dips` has `inc: 0` and logs weight 0, so tonnage and e1RM treat it as nothing.
- **Interventions and preferences.** `cfg().suggestions` is written on every Today/Train paint by the engine (`cue()`, `reviewCard()`), capped at 1000, and read by nothing except `coach.js`'s read-guard that restores it. No accepted-intervention record, no effective dates, no review points, no exclusions, no equipment or time-budget preferences. `coach.dismissed`, `dayNotes` (excused/moved) and `planUpdatedAt` stamps exist (Ascension).
- **Corrections.** The set-edit sheet allows exercise, weight, reps, set number, date and notes; it cannot reclassify a set as a warm-up, mark a different machine, or mark an intentional lighter session. `coachFor()` has a one-off "one lighter session is not a trend" heuristic.
- **Consistency across surfaces.** Today and Train now share the coordinator's hold rule (`trainAdvice`); the Progress diagnosis card is still an independent decision (finding 3).
- **Replay safety.** Engine readers filter rows to `≤ state.date`; `coach.js` tests pin "as-of reads equal the earlier state". No end-to-end chronological replay harness exists yet.
- **Live observations supplied (14 Oct):** morning averages 84.06 kg (1–7 Oct) and 82.43 kg (8–14 Oct), 525 cardio minutes (5–11 Oct), several comparable lifts improved. Whether Today reads "Losing quickly" on those numbers cannot be stated from the two weekly averages alone: `review()` uses the four-week fitted rate whenever `detectPlateau()` is conclusive and falls back to the week-on-week change only otherwise (D37), so the verdict depends on the full 28-day series. Finding 3 is reproduced with synthetic fixtures instead (`wearables.coaching-consistency.test.js`). These are observations, not fixtures; nothing was changed.

## 4. Safeguards worth retaining

- Morning weigh-in canonical, contextual readings never in the trend (D7/D8/D14/D17); data-only chart domain (D2); projection dashed and off by default (I11); no invented scores (D9).
- `insufficient_context` and `undetermined` as legitimate outcomes; evidence rows on the diagnosis card; "transparent rules, not a medical assessment" copy on the review sheet.
- Comparable-lift rule (same exercise, same gym), warm-ups excluded, D20 best-set definition, `sessionRows` capped reps for e1RM.
- D22 explicit routine saves with a safety snapshot; D60 edit stamps and newer-wins merge; read-before-write; backups and the recovery snapshot before destructive paths.
- The Ascension coordinator: one insight per domain, hold rule, dismissal by evidence fingerprint, catch-up with consequences shown first, excused days never counted as missed.
- Feature flags (D49/D55) that keep calorie, waist and check-in logic dormant without deleting it.

## 5. Gaps and risks, by impact

1. **Contradiction between surfaces** (finding 3): in the fast-loss state Today says "Losing quickly" while Progress says "Keep the current plan". Reproduced with fixtures. High impact, small fix.
2. **Effort entry is not exposed**, so pushing targets are suggested without saying they rest on reps alone (finding 4). High impact on trust; small fix for the wording, a separate decision for collection.
3. **Two-step increments from one session** (finding 5) conflict with the roadmap; needs an owner decision because D24/D25 approved it.
4. **No exclusion or preference layer**; calf raises can return via "Restore default exercises"; the programme edit is pending.
5. **Diagnosis asserts "not metabolism"** on a live branch (finding 6).
6. **Cardio and weight rate are not read together**; fast loss with rising cardio gets no caution.
7. **Missing-data semantics are implicit**: coverage is shown for weigh-ins but not for effort, recovery or adherence; "unknown" is not a first-class state in `coachFor`/`review`.
8. **Corrections are not supported** (warm-up reclassification, different machine, lighter session); history preservation of corrections has no model.
9. **No intervention record**; "keep doing this" cannot be tracked or reviewed.
10. **Exercise identity is a name**; per-hand and assisted conventions are unrepresented, so tonnage and comparisons are wrong for dumbbells-per-hand and bodyweight lifts.
11. **Dormant misleading maths** (findings 1–2) would resurface unchanged if calories are re-enabled.
12. **Stale second clone** in `~/Developer/Projects/nxtfrm` with unpushed edits (process risk, not app risk).

## 6. Staged implementation proposal

Each stage is independently reviewable, tested in the VM harness against shipped functions, verified in the browser on the affected flows, and reversible by reverting its commit; stages that add stored fields use optional, additive fields inside `settings.cutSupport` (no new `apm_*` keys, no record reshaping) so a rollback leaves later records intact. All stages keep RELEASE untouched; the owner bumps at deploy.

| Stage | What changes | Out of scope | Flows and data | Compatibility risk | Required tests | Rollback | Approval needed |
|---|---|---|---|---|---|---|---|
| **0 · Programme edit** (separate, small) | Owner applies the Push substitution in Settings › Training (D22 editor): remove Tricep Dips, add Chest Fly from the library with 2 working sets, keep every other row; "also save to the other gym" as the owner prefers. Verification checklist in §8 | any code change; calf-raise exclusion (stage 5) | `cfg().templates[gym__Push]`, `templateMeta` stamp; today's Push queue re-seeds only if nothing is logged (D22) | none to code; the saved routine is the owner's data and syncs by D60 rules | manual: checklist in §8 against the owner's own app; a VM test that a routine change never touches `state.logs` already exists (`plan-persistence`) | the editor's "Restore previous" is not available; the owner re-edits, or restores the pre-edit safety snapshot taken by the editor | owner performs it (account write) |
| **1 · Misleading calculations and missing-data handling** | (a) shared rate ceiling for `diagnose()`'s `no_issue` (finding 3); (b) hypothesis wording for `recovery_deficit`, `water_masking`, `metabolic_adaptation`, `dietary_drift` with evidence attached (finding 6); (c) `effort: 'unknown'` carried through `cue()` → `aimFor()` → `coachFor()` → `trainAdvice()` with a stated caveat and lower confidence (finding 4); (d) behind the calorie flag: adherence mean over logged days + coverage, "estimated" wording, no boot-time TDEE call (findings 1–2); (e) a coverage line on the review sheet and Progress card | changing thresholds, D24/D25, collecting effort, new surfaces | Today decision, Progress diagnosis, Train coach line; no stored data | low: copy and one extra gate; D37's single-rate rule preserved by reusing its constant | fast-loss fixture: Today and Progress agree; missing-RIR fixture: suggestion present with "effort not recorded"; adherence 7/14 logged → 100 % reported, 50 % coverage; boot with no adherence → no TDEE call; every existing suite green | revert one commit; no stored fields | none (no account writes); owner approval to proceed |
| **2 · Shared evidence and consistent recommendation logic** | Progress diagnosis card rendered from `NXT.coach` context (same decision as Today/Train); evidence typed as recorded / calculated / estimated / unknown / hypothesis in the context and insight payloads; coverage figures for weigh-ins, cardio, check-ins, effort | new coaches, UI redesign | Progress › Weight card, insight `why` blocks | medium: the diagnosis card's markup is pinned by `verify-152` and release-gate string checks; adapt with intent kept | contradiction fixtures across all three surfaces; typed-evidence shape test; replay "as-of" tests extended to the card | revert; no stored fields | none |
| **3 · Exercise identity and progression** | optional per-exercise metadata in the routine row sidecar (`cfg().exerciseMeta[name]`: equipment, unit convention per-hand/combined, assisted/added, "harder when number rises"), used by tonnage, e1RM and comparisons; one-step cap with "based on one session" caveat (if the owner approves changing D25); later-set comparison and "repeat / add a rep / improve later sets / lighter session" target kinds in `coachFor()` | automatic inference from names; UI for editing metadata beyond one sheet | Train targets, Performance rows, exercise history chart | medium: `aimFor`/`coachFor` are pinned by `wearables.progression.test.js` and D20/D24/D25 | dumbbell per-hand, assisted dip, same-name-different-machine, warm-up exclusion, one-exceptional-set fixtures | revert; sidecar ignored by older code | owner decision on D25 |
| **4 · Whole-session, cardio, weight and recovery interpretation** | session-level patterns (late-exercise drop-off, omitted accessories, over-time sessions); cardio read with weight rate (caution when loss > 1 %/wk and cardio rises); short vs long trend contrast on the chart readout; explicit outlier flag and duplicate-row resolution by `ts`; partial-week labelling | changing the trend maths (D7, D14) | Today insights, week review, Progress readout | medium: `cleanRows` change moves historical canonical rows in the two-morning-rows edge case; must be measured on real data first (R1 pattern) | fixtures for mixed conditions, duplicates, backfill, partial weeks, accelerating loss with rising cardio | revert; the `ts` rule is pure computation | owner approval before the `cleanRows` edge-case change |
| **5 · Preferences, corrections and intervention reviews** | `cfg().preferences` (excluded exercises incl. calf raises, equipment, time budget), honoured by the routine editor, substitution sheet and "Restore defaults"; correction flags on sets (`warmup`, `machine`, `lighter`, `timeout`) kept beside the original record; intervention records (what/why/evidence/expected/effective/review/followed) with a history surface | learning personal patterns | Settings › Training, set-edit sheet, Today/review | medium: set rows gain optional fields; backups/sync carry them (additive) | preference persistence across reload and sync; corrections update targets; intervention lifecycle states | revert; optional fields ignored | none |
| **6 · Restrained personalisation and goal phases** | explicit user-approved phase (fat loss / maintenance / muscle emphasis) in settings; periodic phase check as an insight; association-only pattern notes after N comparable observations | automatic phase changes | Settings › Goals, Today | low | phase persistence; no automatic change; forecast assumptions stated | revert | none |
| **7 · Integrated UX verification** | chronological replay harness over synthetic histories; browser flows for each surface; no-future-leak assertions | — | — | — | replay determinism | — | none |

## 7. Smallest recommended first stage

**Stage 1 (a)–(c)+(e)** — about 40 lines of engine change plus tests: the live contradiction, the live overconfident verdict, the vacuous effort check made honest, and a coverage line. It fixes what the owner would see today on their own numbers, changes no stored data, no thresholds and no owner-approved rule, and it is the foundation the later stages build on. Stage 0 can run in parallel because it is the owner's own two-minute edit.

### Acceptance criteria
1. With a fixture losing ≥ 1 % of body weight per week and no plateau, `review()`, `diagnose()` and `NXT.coach.insights()` all read the cautious verdict; the Progress card never says "Keep the current plan" in that state.
2. `diagnose()` headlines never assert a cause ("looks like load, not metabolism"); they state the observation and name the hypothesis, with evidence rows.
3. With RIR absent (today's reality), `cue()`/`coachFor()`/`trainAdvice()` still suggest, but carry `effort: 'unknown'`, the Train headline says the suggestion is without effort data, and confidence is `medium` at most.
4. Behind the calorie flag, adherence reports "N successful of M logged · K unknown"; no boot-time TDEE computation while the flag is off.
5. All 21 suites green plus the new fixtures; `verify-train-browser` 6/6; Today, Train and Progress inspected at 390 and 320 with the fast-loss and missing-effort fixtures.

### Verification
VM tests against shipped `cut-support.js` and `coach.js` (same harness as `wearables.coach.test.js`), then Playwright on the dev server with the fixtures injected through the page (never into the owner's profile), screenshots of the three surfaces, pixel diff for everything else.

### Rollback
One commit on a new branch from `main`; `git revert` restores the previous behaviour. No stored fields are added, so records created after the change are unaffected.

## 8. Programme-edit verification checklist (for stage 0, performed by the owner in the app)

- Settings › Training › Push (the gym in use) › remove Tricep Dips › Add exercise › "Chest Fly" (library) › sets 2, rep range and step as desired › Save routine.
- Train on the next Push day: Chest Fly appears with "First session on this lift"; no best set, no aim, no history.
- Exercise Details › History for Chest Fly: "No sessions yet". For Tricep Dips (from Progress › Performance › Show all lifts): history and sessions intact.
- Pull and Legs routines unchanged; no calf raise anywhere in Push/Pull/Legs.
- Progress › Performance still lists Tricep Dips with its old sessions.
- If signed in on two devices: the second device shows the new Push after Login + Load (D60 newer-stamp rule).

## 9. Blocking questions

1. **D24/D25 versus this roadmap**: may stage 3 cap load increases at one step per session and require two consecutive sessions for a second step? This changes an owner-approved rule.
2. **Effort collection**: should the Train form re-expose an optional reps-in-reserve control (hidden since D42/D44)? Without it, every effort rule stays unknown-only.
3. **Stage 0 ownership**: do you want to apply the Push edit yourself in the app (recommended; it is your account data), or should it be scripted as a one-time, confirmed migration that targets only your saved Push routine?
4. **The stale clone** in `~/Developer/Projects/nxtfrm`: leave as is (recommended), or do you want its unpushed edits reviewed before any future work there?

Everything else can proceed on the recommended stage without further input.
