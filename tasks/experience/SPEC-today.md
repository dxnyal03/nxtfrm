# SPEC · Today briefing (stage 5)

> **Owner ruling 2026-10-20 — phone first.** "Remove the desktop, I'm using this mainly on phone." Every desktop /
> wide-width item in this document is withdrawn: the two-column layout (W4 / D114), the persistent inspector strip, the
> 1280/1440 budgets and acceptance criteria. Wider viewports keep the existing single 680 px column (D59) and must not
> break; nothing else is built or measured for them. Phone viewports: 320×568, 375×667, 390×844, 393×852, 430×932.


**Status:** buildable synthesis, for owner approval and then implementation. Presentation only: no calculation, storage key, record shape or coach-threshold change. No new file, so `sw.js`, `?v=` and `RELEASE` (163) are untouched.

**Base:** Today #1 (task-first, judges' winner 2 of 3). Grafted from #3: the two-zone Weight/Cardio log strip directly under the focus card, the concern taking over the context line, and a pure `NXP.pickToday()` with no engine-file edit. Grafted from #2: live-row hand-off keyed to the **button**, de-duplication of an action that repeats Resume, the Lifts row reading the last *completed* session, the conditional rail legend, and the rendered sparkline data states (No rate / Paused / amber aging).

**Code reality checked in the worktree** (`/Users/alidanial/Developer/Worktrees/nxtfrm/experience-upgrade`, 19 Oct 2026):
- Stage 2 is already present. `forecastView` (D104) is committed. The day-state contract (D105) is in the working tree: `dayState(d, ix, dc)` and `dayIndex()` in `premium-ui.js` around L340–420 return `k ∈ {finished, complete, progress, partial, done, excused, moved, addon, today, planned, rest, untracked, other, missed}`, the word `w`, `loggedSets`, `plan.plannedSets`, `inProgress`, `setsComplete` and `finished.at`. The rail already draws a proportional arc for `progress`, a check ring for `complete` and a half disc for `partial`. **This spec builds on that read and must land after the D105 commit.**
- `coachAdvice(ex)` in `premium-ui.js` already wraps `NXT.coach.trainAdvice(ex)` (coachFor plus the coordinator's hold). It is the only cue source.
- `wearables.day-state.test.js:326` slices `home()` from `function home() {` to `function coachDeck()` and pins three substrings: `dayState(d,dsx,`, `dsToday&&dsToday.inProgress?'Resume workout'` and `class="vn-week"`. The release gate pins `class="vn-week"`. Commits C2–C4 keep all three inside that slice (§13).
- Morph targets (`strata.js:753–754`): `st-m-session` targets `#homePage .st-t-train .st-h2`, which is kept by keeping the classes. `st-m-trend` targets `#homePage .st-mini [data-st-odo]` and is re-pointed in C3.

---

## 0 · Judges' flaws and how this spec fixes them

| # | Flaw raised | Fix in this spec |
|---|---|---|
| 1 | #1: Weight/Cardio logging below the fold (y ≈ 983) | The log strip sits **directly under the focus card**: y 548–679 at 390 (§2, §5) |
| 2 | #1: a genuine concern never leads the page | Under a concern the **context line becomes the concern** link and the lead moves **between the card and the log strip** (§3, §6.2) |
| 3 | #1: hero too dense (44 px count, wrapped plan list, cue, header count) | 44 px count numeral removed. The plan list is **folded at every width** (a `Plan ›` toggle on the tape label). One cue well. Card is 418–422 px, down from 460–509 (§4) |
| 4 | #1: context line was a chart, merging context and progress | The context line is **one line of text**. The sparkline lives in the Weight cell's Zone B (§3, §5) |
| 5 | #1: live row hid at 25 % card visibility, so Resume could be off-screen | The hand-off observes the **primary button** above the dock with 24 px hysteresis (#2) (§8) |
| 6 | #1: scope growth (coach.js `brief()`, D59 two-column, 320 button 2 px into dock) | Picker is a pure `NXP.pickToday()` in `premium-ui.js`, **no `coach.js` edit**. D59 single column kept, two columns deferred (O-1). 320 budget leaves ≥ 60 px clearance (§2) |
| 7 | #1: same half disc for in progress and partial | Stage 2 marks: **in progress = proportional arc**, partial (past only) = half disc, complete = check ring, finished = filled check (§4.4) |
| 8 | #1: 72×26 sparkline exaggerates a 1.4 kg change | Sparkline is about 150×28 and **includes faint morning dots** (D50), so its data-only Y domain (D2) spans daily noise and the slope reads in proportion. Range text is always visible (§5.2) |
| 9 | #1: watch mock mixed seed masthead with illustrative rate | Mock and QA rule: **every figure on one screen comes from one fixture** (A-24) |
| 10 | #3: "Cut week 13" unsourced | Cut week shows **only when `settings.cutStart` is set** (D31). Seed shows none (§3) |
| 11 | #3: act insight silently dropped in the during state | Invariant: **every pool insight appears exactly once** in cue, lead or digest. The carry rule applies only when the cue names that insight's exercise (§6.1, test T5) |
| 12 | #3: rail moved above the title, Edit plan and D48 header count lost | Rail stays inside the card, **under the title and above the button** (D32), with the header `This week · N of 3 lifts` and `Edit plan` (D48) |
| 13 | #3: "after 4 mornings" conflated trend points and mornings | The EWMA needs 3 mornings for a first trend point. Copy says `starts after 3 mornings`. The `< 4 trend points` rule (D50) governs line vs dots (§5.3) |
| 14 | #3 and #2: premature "2 of 2 beat so far · Full A today" | Lifts row reads the **last completed session that is not today's open one**, and hides when the finished receipt shows today's outcome (§7) |
| 15 | #3: test command `node --test *.test.js` | AGENTS §6 loop first, then the PLAN's `node --test` gate (§14) |
| 16 | #3: Edit plan moved into `cut-support.js openDay` | **No `cut-support.js` edit** |
| 17 | #3: cardio by-day bars were a second mini chart | Cardio Zone B is a 4 px week meter with words, not a chart (§5.1) |
| 18 | #3: sparkline without range values | `84.0 → 82.6 kg` is always shown beside the label (§5.2) |
| 19 | #2: `Aim 125` on the card while the digest said `Hold 120` | The cue is only `coachAdvice(ex)` (trainAdvice). The picker never reads `aimFor()` for display. Test T8 pins cue = `coachAdvice` |
| 20 | #2: UI-authored Limits and context prose (`coBasis`, `briefLine`) | No composed sentences. "Based on" uses structured fields only. The context line is a fixed set of **fragments** (counts, names, dates), never a clause about trend direction (§3, §6.3) |
| 21 | #2: second violet capsule (`+ Log weight`) | The only `--btn-primary` on the page is the focus card's button. The unlogged Weight cell is lit with a hue bloom, using glass and no primary fill (§9) |
| 22 | #2: page grows to 1891 px; "Your numbers" like a dashboard | Page is ≤ 1300 px during at 390, against 1681 baseline. There is no numbers block (§2) |
| 23 | #2: concern hue rose `#F0709A` | Watch uses I2 amber `--st-review` `#B8842A` plus ◆ and the word "Watch" |
| 24 | #2: index-to-id refactor of coachAct/coachDismiss | `ui.coachList` stays the index space. `coachAct(i)` and `coachDismiss(i)` are unchanged |
| 25 | #2: top insight shown twice in the during state | The carry rule plus the exactly-once invariant (T5) |

---

## 1 · Intent

Today answers three questions, in this order, inside the first viewport at 390×844:

1. **What should I do next?** The focus card and its single primary button.
2. **What matters now?** The card's state line and its one engine cue. A genuine concern replaces the context line.
3. **How am I progressing?** The log strip's labelled `Smoothed trend · 28 days` sparkline and the lead's headline, which peeks in under the strip.

Four surfaces: **focus card (L3) → log strip (L2) → lead (L2) → digest list (L1)**. The sky is unchanged. A celebration never displaces the task. Only a genuine concern moves anything.

---

## 2 · Block order and px budgets

Budgets are maximums for the build. QA measures them (A-1 to A-8). Dock: 66 px tall, 10 px from the bottom. The live row is hidden while the focus button is visible (§8), so the dock top is 768 at 390×844, 591 at 375×667 and 492 at 320×568. No banner. With the D11 banner, everything shifts down by its height and the order holds.

### 2.1 Order (DOM order = visual order at every width)

| # | Block | Normal | Under a concern |
|---|---|---|---|
| 1 | Masthead: eyebrow, H1, context line | ✓ | context line → concern link |
| 2 | Focus card (rail inside, button last) | ✓ | cue shows the coordinator's hold |
| 3 | Log strip (Weight, Cardio) | ✓ | moves to 4 |
| 4 | Lead interpretation | ✓ | moves to 3, watch material |
| 5 | More insights · N, then Recent evidence (Lifts, Latest scan) | ✓ | ✓ |
| — | Bottom clearance 112 | | |

Removed as blocks: the weigh-in pill (its job moves to the Weight cell, §5), the minis strip, the coach deck, the Decision card's 28-day plot, and the scan tile (now a row).

### 2.2 390×844 (also 393×852: same y, dock top 776)

| Block | Top | Height | Notes |
|---|---|---|---|
| Masthead | 18 | 83 (→ 101) | eyebrow 17 · gap 4 · H1 36 · gap 6 · context 20 |
| Focus card, lift **before** | 116 | **418** (→ 534) | button bottom 516 |
| Focus card, lift **during** | 116 | **422** (→ 538) | button bottom 520 |
| Focus card, sets complete | 116 | ≤ 390 | |
| Focus card, finished | 116 | ≤ 470 | |
| Focus card, cardio day | 116 | 353 (415 with a cue) | |
| Focus card, rest day | 116 | ≤ 405 | no primary button |
| Log strip (during) | 550 | **131** (→ 681) | Zone A 80 · hairline 1 · Zone B 50 |
| Lead (during) | 693 | 240–300 | 75 px visible above dock: eyebrow and headline line 1 |
| Digest + evidence | +16 | 58 per row, 3 rows ≈ 174 | collapsed |
| **Page height** | | **≤ 1300 during**, ≤ 1320 before | baseline 1681 live / 1605 |

**Card interior at 390, during** (padding 18 / 20 / 18, gap token `--tf-gap` 12):
head row 32 · 10 · title 42 · 12 · tape 7 · 6 · tape label 16 · 12 · now well 66 · 14 · rail header 18 · 8 · rail 73 (capsule 54 + 4 + label 15) · 16 · button 54. Before: the now well (66) becomes the cue well (62).

**Concern at 390, before:** card 116–534 · lead (watch) 546–≈ 870 · log strip ≈ 882. The first viewport holds the concern line, the whole card, and the lead's eyebrow, headline and body start (≥ 200 px). The log strip is one scroll away. That is the accepted cost; logging stays reachable through pull to weigh in (D90) and the dock long-press (D89).

### 2.3 375×667 (compact: `max-height: 740px`)

Masthead 16–92 (H1 32). Card top 104. Padding 16. Gap 10. Rail capsule 46 tall (rail 64 + header 18 + gap 8 = 90). Cue note clamps to one line (cue 48). Button 50.

| State | Card | Button bottom | Log strip Zone A | Check |
|---|---|---|---|---|
| during | 104–485 | 469 | 495–575 | Zone A fully above dock 591 ✓ |
| before | 104–475 | 459 | 485–565 | ✓ |
| finished | 104–≤ 530 | ≤ 514 | partly visible | button ✓ |

### 2.4 320×568 (compact + narrow: `max-width: 359px`)

Masthead 14–80: eyebrow 15, H1 28/30, context 18 (fragments drop, §3.2). Card top 90. Padding 13 / 16 / 14. Gap 8. Title 30 (row 34). Head row 30. Rail capsule 46, label 13 (rail with header 84). Cue and now note reduce to the structured target only (well 46–52). Button 48.

| State | Card | Button bottom | Clearance to dock 492 |
|---|---|---|---|
| during | 90–434 | 420 | 72 ✓ |
| before | 90–428 | 414 | 78 ✓ |
| finished | 90–≤ 472 | ≤ 458 | ≥ 34 ✓ (fixes #1's View session behind the dock) |
| cardio | 90–≤ 400 | ≤ 386 | ✓ |

Log strip from 444: its top 44 px (the state row and the top of the Zone A target) shows above the dock. The whole strip is one short scroll away.

Rail capsule widths stay the D48 baseline values (40 at 390, about 33 at 320). They are separate buttons with 4 px gaps. This is the existing I5 exception, not a new one. The day sheet behind each capsule is unchanged.

### 2.5 Desktop and tablet (D59 unchanged)

- **768×1024:** phone composition in the 600 column. Everything through the lead's headline fits above the dock (≈ 948).
- **≥ 1024** (side-rail dock): Today keeps its single column at its current max width inside the D59 column. Capsules widen to fill (max 60).
- **1280×800:** masthead 44–127, card 143–565, log strip 577–708, lead from 720. The first viewport holds the card, the log strip and the lead eyebrow.
- **1440×900:** adds the whole lead.
- **Floating live pill (≥ 1024):** hidden on Today by the same button-visibility rule (§8). That fixes the F8 overlap on Today. Other tabs are stage 6.

**Breakpoint rationale:** no new layout breakpoint. The single column already puts all three answers in the first viewport at 1280×800, so a two-column Today does not pay for a D59 amendment now (deferred, O-1). The only new media conditions are the compact rules (`max-height: 740px`, `max-width: 359px`). They exist because of measured fit at 375×667 and 320×568, not device classes.

---

## 3 · Masthead

### 3.1 Elements

- **Eyebrow** `.st-eyebrow` (unchanged): `Monday · 19 October`. Appends ` · Week N of your cut` **only if** `Number.isFinite(N.dateMs(settings.cutStart))`. N = whole weeks since cutStart + 1, display only (D31). The seed shows the date alone.
- **H1** `.st-h1` (unchanged): `Morning, Dan` (time-of-day word as now). Geist 640 34/36, −0.04em, sky gradient (D69). 28/30 under 360 px.
- **Context line** `p.tf-ctx`: SF 450 14/20, `--st-ink-2`. Figures are SF 600 `--st-ink`; separators `·` are `--st-ink-4`. **One line, never wraps** (`white-space: nowrap; overflow: hidden`). Fragments are dropped from the right to fit, never truncated with an ellipsis.

### 3.2 Context line: fixed fragments, no sentences

`NXP.todayLine(facts) → [{t, strong?}]`, pure. Facts come from `dayState(state.date)`, `coach.context().week` and the plan. It never states a weight, a rate, a trend direction or a future date.

| Day (from `dsToday.k` and `plan.type`) | Fragment 1 | Fragment 2 (dropped first) |
|---|---|---|
| Lift day (today, progress, complete) | `Lifting day {k} of {n}` (ordinal among this week's planned lift days not excused or moved) | `{gym}` |
| Lift day finished | `Lifting day {k} of {n}` | `finished {hh:mm}` |
| Moved session here (`dc.movedFrom`) | `Moved from {Wkd D Mon}` | `Lifting day {k} of {n}` |
| Walk day (Zone2) | `Walk day {k} of {n}` | `{min}/{target} cardio min this week` |
| Floorball day (only if enabled, D55) | `Floorball day` | |
| Rest day | `Rest day` | `Next: {session} {Wkd}` |
| Excused | `Excused · {reason}` | |

The rail header keeps the *done count* (`This week · 0 of 3 lifts`). The context line gives the *position* (`Lifting day 1 of 3`). These are two different facts, not a duplicate.

### 3.3 Concern variant (D81)

When `pick.lead.variant === 'watch'` (§6.1), the context line is replaced by `button.tf-ctx.is-watch`:

`◆ Watch · {lead title, verbatim} · Read below ↓`, for example `◆ Watch · Losing quickly · Read below ↓`.

- Colour: `--st-review` (#B8842A) for the shape and the word "Watch". The title is `--st-ink`.
- Tap or Enter scrolls to the lead (`scrollIntoView({block:'start'})`, with `behavior: 'auto'` under reduced motion) and moves focus to the lead heading (`tabindex="-1"`).
- 44 px hit area through `::after`.
- Accessible name: `Watch: Losing quickly. Read the weight decision below.`
- If the title would overflow, `Read below ↓` drops first, then the title shortens at a word boundary to its first clause. It is never cut mid-word.

There is **no weigh-in pill** in the masthead. Its task moves to the Weight cell (§5), in the thumb zone. Pull to weigh in (D90) and the dock long-press (D89) are unchanged.

---

## 4 · Focus card

### 4.1 Material and anatomy

- Keep `article.st-tile.st-t-train` (the D53 session-lit material, ghost word, `--c` = session hue, and the D71 morph via `.st-h2`). Add `.tf-card.is-{state}`. Radius `--r-tile` (26). It is the page's **only L3 surface** and holds the **only `--btn-primary`**.
- `aria-labelledby="tf-title"`, `aria-describedby="tf-state"`.

Top to bottom:

1. **Head row (32):** `#tf-state` state line on the left (shape + word, Geist 560 12.5/16, `--st-ink-2`; the shape takes the session hue). On the right, a context control: on lift days the gym capsule `Gym A ⇄` (32 px visual, 44 hit; `cycleGym()`, which asks first per D76 when sets exist); on cardio days `＋ Optional lifting` (`NXP.addOnPick()`, only when `addOnEligible`).
2. **Title row (42):** `button.st-h2#tf-title`: session name, Geist 650 38/42, −0.045em, gradient from white to the session hue (30/34 under 360). It is followed by an 18 px `⌄` disc. It calls `showSessionSheet()`. Accessible name: `Full Body A. Change today's session`. When D35 locks the session (sets logged), the `⌄` is hidden and the title is a heading, not a button.
3. **Session tape (7):** `div.tf-tape[role=img]`. One cell per planned working set, grouped by exercise with 6 px between groups and 3 px within. Logged cells use the session hue and are capped per exercise (`Math.min(N.done(e.name), e.sets)`, the ring's own rule). The current exercise's empty cells get a 1 px hue outline. Cells are capped at 24; beyond that each group becomes one proportional bar.
4. **Tape label row (16, 44 hit):** on the left, the count in words: `15 working sets · 6 exercises` (before) or `6 of 15 working sets · 2 of 6 exercises` (during). `6` carries `data-st-odo` (odometer on tab entry). On the right, `Plan ›` (Geist 600 12.5, `--btn-text`): **the plan list is folded by default at every width.** `NXP.todayPlan()` expands it in place under the label (memory only). Each row shows the exercise and its working-set count, SF 450 13.5/20 with counts in Geist 560 12 hue-tinted. The aria-expanded button keeps focus.
5. **State body:** the cue well or now well, the receipt, the meter or the next inset (§4.2).
6. **Rail (header 18 + capsules 73):** §4.4.
7. **Button (54), always last (D32).** Label from the existing expression, so the test-pinned substring stays (§13 C2):
   `dsToday&&dsToday.setsComplete&&!dsToday.finished?'Finish workout':dsToday&&dsToday.inProgress?'Resume workout':…`

### 4.2 States (from `dsToday.k`; never computed locally)

| State (`k`) | State line | Body | Button |
|---|---|---|---|
| `today` (lift, 0 sets) | ○ `Today's training` | **Cue well** (§4.3) | primary `Start workout` → `startWorkoutNow()` |
| `today` + `dc.movedFrom` | → `Moved here from Wed 21 Oct` | as above | as above |
| `progress` | ◔ (arc) `In progress · since 9:40` (first working set `ts`) | **Now well**: `Now · set 1 of 3` (SF 500 12, ink-3) / `Leg Press · Target 125 × 12` (Geist 600 15) / `coachAdvice(ex).headline` (SF 450 12.5, ink-3, one line). On the right, a **rest ring** 52 px (`1:24` Geist 500 14 tabular + `rest`) only while `apx96RestRemaining() > 0` | primary `Resume workout` → `NXP.enterTrain()` |
| `complete` (D21) | ◉ `All 15 planned sets logged` | caption `Finish saves the session. Extra sets stay possible in Train.` (existing D21 wording) | primary `Finish workout` → `NXT.finish()` (D76 ask, then the D77 scene) |
| `finished` | ✓ `Finished · 10:00` (`finished.at`) | **Receipt**: three counters `6 beat · 0 matched · 0 below` (● ■ ▼ with words; `liftOutcome` counts, D20, Geist 300 26 tabular) and a caption `{duration} · Next: {next session} {when}`. Duration = first working set `ts` → `finishedAt`, the Glance clock precedent. Plus **at most one** D27 moment, only when `sessionMoments()[0]` exists: `★ New best · Leg Press 125 kg × 12` | glass `View session` → `NXT.openFinishSummary()` |
| `done` / cardio day (Zone2) | `Today · Cardio` or ✓ `Activity recorded · 32 min` | apricot `--st-cardio`, ghost word `Walk`. Title `Easy cardio` (`N.label`). Meter 6 px: week minutes against `zone2WeeklyTarget`; caption `Today · nothing logged yet` or `✓ 32 min logged · 07:40` and `{daysLeft} days left this week` (`coach.context().week`). Cue only if the engine raised `cardio.week` (carried) | primary `Log cardio` → `showCardioSheet()`; once logged, glass `Log another session` |
| `addon` on a walk or rest day | `＋ Optional lifting · 2 sets` row above the rail | never counts as the plan (R8) | unchanged for the day type |
| `rest` / Rest plan | `Today · Rest` | mauve `--st-rest`, quieter bloom (35 %). Title `Rest`. Existing copy `A planned recovery day. Nothing is scheduled.` **Next inset** (L1 glass, hue dot): `Next session · Mon 26 Oct` / `Full Body A` / `6 exercises · 15 working sets · Gym A` (first lift day after today via `N.typeFor()`, plan via `templateFor()`; opens `NXT.openDay(date)`). Optional glass capsules `＋ Log cardio` and `＋ Optional lifting` | **no primary** |
| `excused` | ⁄ `Excused · sick` | rest-like; glass `Remove excuse` → `NXP.excuseSheet(date)` | none |
| no routine (empty `template()`) | `Today's training` | existing string `No exercises are queued for this session` | glass `Set up routine` → `NXT.more('training')` |

A catch-up offer (`schedule.catchup`, act) does **not** change the card. It becomes the lead (§6) with `Move to today ›`.

### 4.3 Cue (one, engine prose only)

`cueFor(m)`:

- **Before:** `ex` = the first exercise named by the carried insight (§6.1) if there is one, else the first planned exercise. Text = `coachAdvice(ex)`: the headline (Geist 600 14.5/20) and the note (SF 450 12.5/17, ink-3, max 2 lines; 1 line compact; target only under 360). A cautious weight decision shows the coordinator's hold automatically (`Hold 120 kg — weight decision reads "Losing quickly"`).
- **During:** `ex` = `state.exercise` if it has sets left, else the first with sets left (strata's `resumeExercise` rule). Target = `coachAdvice(ex).sets[N.done(ex)]`.
- **Cardio:** carried `cardio.week` insight title and `why.canDo`, verbatim.
- **Nothing to say:** no cue well (no filler). The card shrinks by 74.

Tap: if the cue carries an insight, `NXP.cueSheet()` opens the four-part sheet (§6.3) with the action and Dismiss. Otherwise `NXT.selectExercise(i)` then `NXP.enterTrain()`.

### 4.4 Week rail (D32/D34/D48 + D105)

- Markup stays `div.vn-week[data-rail=capsule][role=list]`, built by the existing code with `dayState(d,dsx,…)`.
- Header row: `This week · {finished or complete count} of {n} lifts` on the left, plus ` · today in progress` when `dsToday.k === 'progress'` (hidden under 360). `Edit plan` → `NXT.more('training')` on the right.
- The capsule (40×54, 46 compact, radius 20) has the weekday letter on top, the mark at the foot and the label beneath. `aria-current="date"` on today. **Roving tabindex:** the rail is one Tab stop and ←/→ move between capsules (graft from #3).

| D105 `k` | Capsule | Mark | Word (in `aria-label`) |
|---|---|---|---|
| planned | hue glass at 82 % | none | Planned |
| today | lit + glow (D34) | none | Today |
| progress | lit | **arc = loggedSets / plannedSets** | In progress, 6 of 15 sets |
| complete | full fill | check ring | Planned sets complete |
| finished / done | full fill (past 26 %) | filled check | Workout finished / Done |
| partial (past only) | plain | half disc | Partly logged, 9 of 15 sets |
| addon | plain | plus | Add-on logged |
| missed | recedes 50 % | hollow ring | Not logged |
| excused | recedes, outline | slash | Excused · reason |
| moved | recedes, label `Moved` | arrow | Moved to Wed 21 Oct |
| rest | mauve | dash | Rest |

The arc (today only) and the half disc (past only) never coexist on the same day position. The word disambiguates as well.

**Legend line** (graft from #2): SF 500 11/14, ink-3, `aria-hidden`, under the rail. It shows only when a day **other than today** carries missed, partial, excused, moved, addon or complete. It lists only those marks present: `○ Not logged · ◑ Partly logged`. The seed week shows none. It adds 18 px when shown.

---

## 5 · Log strip

`section.tf-log[aria-label="Log today"]`. L2 instrument glass (`--st-tile`, `--st-tile-line`, `--st-depth`, no bloom, no gradient edge). Radius `--r-card` (18). It has two cells in a `grid-template-columns: minmax(0,1fr) minmax(0,1fr)` with a 1 px `--st-tile-line` divider. Each cell has two zones split by a hairline:

- **Zone A (80):** a full-zone `<button>` that logs or replays. It says whether today is done.
- **Zone B (50):** a full-zone `<button>` that explains and opens Progress.

Large text (`data-nxp-size=large`) under 430 px: the strip becomes one column (Weight row, then Cardio row), each with Zone A | Zone B side by side.

### 5.1 Cells

| | Weight (`--st-weight`) | Cardio (`--st-cardio`) |
|---|---|---|
| Zone A, logged today | label row `● Weight` (Geist 600 12.5) + `✓ This morning` (SF 600 11, `--st-accent-lift`); value `81.7` Geist 300 28/30 tabular + `kg` SF 500 13; sub `Latest morning · 19 Oct` (SF 400 12, ink-3). Tap → `NXP.weighReplay()` (D92). Name: `Weight logged this morning, 81.7 kilograms. Replay weigh-in.` | `● Cardio` + `✓ 32 min today`; value `32` + `min`; sub `today · 07:40`. Tap → `showCardioSheet()` |
| Zone A, not logged | **lit**: hue corner bloom 40 %, hue gradient edge on this zone only; `○ Not yet today`; value text `Log morning` (Geist 600 17); sub `Last · 81.7 kg · Sun 18 Oct`. Tap → `apx95OpenQuickWeight()`. **This replaces the D103 pill's lit state** | `○ None today`; value `Log cardio` (Geist 600 17); sub `Last · {date}` or `No cardio yet`. Not lit (cardio is not a daily task), except on a walk day where the card already holds the primary |
| Zone B | label `Smoothed trend · 28 days ›` (SF 500 11/13, ink-3; always visible) + figure `84.0 → 82.6 kg` (Geist 560 13 tabular; `82.6` carries `data-st-odo` for the D71 morph) + sparkline (§5.2). Tap → `NXT.ui.view='overview'; switchTab('weight')` | label `This week ›` + `0 / 90 min` (Geist 560 13) + a 4 px meter in `--st-cardio` (no bars, no chart). Tap → Progress › Training |

On a walk day the focus card is the cardio logger. The Cardio cell still shows the logged state, and its Zone A is glass and never lit.

### 5.2 Sparkline (`trendSparkSVG(series, {w, h})`)

The plot code is extracted from `decEvidenceHTML`'s 28-day plot and shared, so the two cannot drift.

- **Series:** `N.trend(N.weights())` over the 28 days ending `state.date` (the D50 window). Canonical morning rows only (D7/D14), no post-workout readings.
- **Marks:** trend stroke 1.8 px with the house gradient (D19) and a 12 % area; faint morning dots r 1.5 at 40 %; lit end dot r 2.5.
- **Y domain:** data-only over readings **and** trend (D2), so the slope sits inside daily noise. No goal line (D3), no projection (I11), no second axis, no `y2=`.
- **Breaks:** the line breaks across EWMA restarts (gap > 3 days, `MORNING_GAP_DAYS`), from #3.
- **Size:** width = zone width − 24 (about 148 at 390, 112 at 320), height 24. `preserveAspectRatio="none"` on the area only; dots are drawn in pixel space.
- **Role:** `role="img"` on the SVG with the summary in `aria-label` (§12). The Zone B button's name includes it.

### 5.3 Weight data states (graft #2's rendered set, with #1's mornings/trend-point rule)

| State | Zone A | Zone B label · figure | Plot |
|---|---|---|---|
| Logged today | ✓ value | `Smoothed trend · 28 days` · `84.0 → 82.6 kg` | line + dots |
| Not logged (≤ 2 days since last) | lit `Log morning` | as above | as above |
| Empty (0 mornings) | lit `Log morning` · `No readings yet` | `Smoothed trend · starts after 3 mornings` · no figure | 3 hollow dots |
| 1–2 mornings | value | `{n} of 3 mornings for a trend` | n filled of 3 dots |
| Sparse (< 4 trend points in 28 d, D50) | value | `Smoothed trend · 28 days · {m} mornings` · latest trend only, **no `→`** | dots only, no line |
| Aging (`forecastView().freshness === 'aging'`) | value, sub `Latest morning · 12 Oct` in `--st-review` | `Smoothed trend · as of 12 Oct` (`forecastWords().asOf`) | line ends at last reading |
| Stale / expired | lit `Log morning` · `Last · 82.9 kg · 1 Oct` (amber date) | `Smoothed trend · to 1 Oct · Paused` (`forecastWords().paused`) | 40 % opacity, desaturated; **never a future date** |
| At goal | unchanged | unchanged (no badge; `review()` says it in the lead) | D99 goal moment unchanged |

Precision: kg 1 dp with the true minus sign U+2212 where signed. No rate is shown in the strip; rates appear only in the lead's evidence chips at 2 dp.

---

## 6 · Lead interpretation

### 6.1 Selection: `NXP.pickToday(input)` (pure, `premium-ui.js`, no DOM, no engine change)

```
input: review   = NXT.review()
       pool     = coach.insights().all minus weight.review, first 3   (D61; as coachStackHTML does now)
       week     = weekReview() if unseen (D63)
       mode     = dsToday.k, template names, cue exercise (cueFor)
1 carried = first pool item with domain 'strength', severity act|watch, whose evidence lifts are
            all in today's template, AND
              (mode ∈ {today, moved}  → it supplies the cue exercise)
              (mode = progress        → only if its lift is the cue's current exercise)
          | first 'cardio.week' item when today is a walk day
          | else null
2 lead    = review.tone === 'watch'                          → {kind:'decision', variant:'watch', place:'afterFocus'}
          : first pool item ≠ carried, severity 'watch'      → {kind:'insight',  variant:'watch', place:'afterFocus'}
          : first pool item ≠ carried, severity 'act'        → {kind:'insight',  variant:'act',   place:'afterLog'}
          : otherwise                                        → {kind:'decision', variant:'calm',  place:'afterLog'}
          info items (streaks, "returning", other celebrations) never lead.
3 digest  = pool items not carried and not lead (engine order: act, watch, info)
          + the Decision when an insight leads
          + week when unseen
   N = digest.length; header omitted at 0.
Invariants (tested): each pool item appears exactly once across carried|lead|digest;
   coach insights on Today ≤ 3; weight.review and the Decision never both shown;
   the order of pool items is the engine's.
```

**De-duplication** (#2):
- The lead's action capsule is hidden when it would repeat the focus button: `action.payload.tab === 'train'` while the button is Start, Resume or Finish. The Suggested text stays.
- The cue never quotes insight prose except a carried insight's own title (cardio).

**Seed result (19 Oct, during):** carried = `strength.ready` (Leg Press, the current exercise). Lead = the calm Decision `Cutting steadily, strength holding`, placed after the log strip. Digest = streak (info) + last week's review, so `More insights · 2`. If the current exercise were not Leg Press, `strength.ready` would lead (act) and the Decision would go to the digest (N = 3). Nothing is dropped.

### 6.2 Placement

- `afterFocus` (genuine concern only): masthead concern line (§3.3) → card → **lead** → log strip → digest.
- `afterLog`: card → log strip → lead → digest.

An action is a task, not a concern, so it does not jump the log strip.

### 6.3 Anatomy: four parts, structured fields only

`section.st-tile.tf-lead[aria-labelledby=tf-lead-h]`. Eyebrow 22 · headline · body · `dl.tf-anat` with three run-in rows (`dt` Geist 600 11.5 ink-3; `dd` SF 500 13.5/18).

| Part | Decision (`review()`) | Insight |
|---|---|---|
| Eyebrow | `⌂ Weight · Decision` + severity shape and word (`○ Calm` / `◆ Watch`) + `Why ›` → `NXT.openReview()` | domain glyph + `CO_DOM` word + `● Action` / `◆ Watch` + `Dismiss` → `NXP.coachDismiss(i)` (450 ms guard kept) |
| **Observation** (h2, Geist 600 18/24) | `title` | `title` |
| Body (SF 400 14.5/21, ink-2, max 3 lines + `More` disclosure) | `message`, verbatim | `body`, verbatim |
| **Evidence** | chips from `reason` split on its own ` · ` (`−0.43 kg/wk over four weeks`, `0.5% of body weight`) | `evidence[]` → `label · value` chips (≤ 3) |
| **Suggested** (always present) | `action` (`Stay consistent`) | `why.canDo` + action capsule (**glass**) → `NXP.coachAct(i)`, unless de-duplicated |
| **Based on** (uncertainty and missing context) | D36 3-step meter + `{confidence} confidence · {m} mornings in 28 days` (`detectPlateau().confidence`; count of morning rows) + `· as of {date}` when aging or `· paused` when stale (`forecastWords`) | newest `evidence[].date` (`Your session on Fri 16 Oct`) + `coordinated.reason` when the engine held a step. Nothing else |

No sentence on this card is composed by the UI. Every string is an engine field, a count, a date, or one of the fixed labels `Evidence` / `Suggested` / `Based on`.

**Variants:** calm = L2 glass with a weight-violet bloom at 25 % and no edge. Act = the domain-hue gradient edge (`.co-tile.is-act` recipe). Watch = an `--st-review` amber edge, ◆, the word "Watch", and one 600 ms edge brighten on reveal (it replaces the infinite `st-watch` pulse). At most **one** L2 edge on the page.

**Engine failure** (`coachCall` returns null): the lead falls back to the Decision and the digest hides its insight group. No error UI.

---

## 7 · More insights · N and Recent evidence

`section.tf-dig` with an `h2` that is visually hidden (`More insights`). One L1 glass tile (`--st-tile` at 50 %, edge at half strength, no shadow) with hairline rows, each 58 high.

- **Row 1, `More insights · N`** (omitted when N = 0): `button[aria-expanded]` with a stacked glyph group (≤ 3 domain discs, 30 px), title Geist 600 15, a count pill (Geist 600 12) and a one-line preview of the domain words (`Streak · Last week's review`, SF 400 13, ink-3, no ellipsis; words drop). Tap → `NXP.digestToggle()` (the old `coachDeck` stays as an alias). It expands in place with `STRATA.morph` (220 ms) to compact rows: glyph, engine title, severity word and shape. Each compact row expands again to the full four-part structure (§6.3), reusing `coachTileHTML` / `reviewTileHTML` internals with the action, Why and Dismiss. The week review row opens `NXP.reviewSheet()`. Open state is memory only (`ui.digestOpen`).
- **Sub-label `Recent evidence`** (SF 500 11, ink-4, not counted).
- **Lifts row:** the D20 outcome of the **last completed lift session that is not today's open one**, if it was within 7 days: `6 of 6 beat last time · Full C · Fri 16 Oct`. Otherwise the engine status word (`Holding · 15 lifts`), or `Building · no comparable sessions yet`. **Hidden when the finished receipt is on the card.** Tap → Performance (`NXT.ui.view='strength'`).
- **Latest Evo scan row** (hidden with no scan, as now): `Latest Evo scan · 17 Oct` / `Fat 26.2 % ↓0.5 · Muscle 34.6 kg ↓0.2` (`bodyScanSource()`, D42 tones, D55 waist hidden). Tap → Progress › Body.

---

## 8 · Live dock hand-off (D75 refinement)

`strata.js updateLive()`:
`show = !!s && !inTrain && !(tab === 'home' && focusCtaVisible)`.

- `focusCtaVisible` comes from an IntersectionObserver on `#homePage .tf-card .tf-cta` (the primary or glass last button). It uses `rootMargin: 0 0 -{dockHeight}px 0` and `threshold: [0, 1]`. Visible means fully inside. Hidden means less than 24 px of the button remains (hysteresis, so there is no flicker at the edge).
- It is bound in Today's hydrate and disconnected on tab change.
- It applies to the docked row and to the floating pill at ≥ 1024.
- The row grows back with `grid-template-rows: 0fr → 1fr` over `--st-t-state` (200 ms, `--st-out`), or instantly under reduced motion.
- The existing 1 s tick also writes `#homePage [data-tf-rest]` text and `--tf-rest-pct` on the card. No new timer. It never re-renders Today.

---

## 9 · Material ladder and tokens

| Level | Elements | Recipe |
|---|---|---|
| L0 | living sky, stars | unchanged (D39/D69) |
| L1 quiet | digest tile, insets inside the card (cue, now, next, receipt counters) | `--st-tile` at 50 %, `--st-tile-line`, `--st-tile-hl`; no bloom, no edge, no shadow |
| L2 instrument | log strip, lead | `--st-tile`, `--st-depth`, neutral `--st-edge` at 40 %; bloom only on the lead (calm 25 %) and on the unlogged Weight Zone A (task) |
| L3 focal | focus card + its button | session-lit: `--c` bloom, `--c` gradient `--st-edge`, ghost word, hue glow; **the only `--btn-primary`** |

Buttons (D56): primary = `--btn-primary`, `--btn-primary-shadow`, `--btn-font` (focus card only). Glass = `--btn-glass`, `--btn-glass-shadow`, `--btn-ink` (View session, lead actions, rest-day options, Set up routine). Text = `--btn-text` (Plan ›, Why ›, Dismiss, Edit plan).

Status: calm uses `--st-ok`; watch uses `--st-review` (I2), never for body text; concern red `--st-concern` is not used on Today in this stage. Category hues: `--st-weight`, `--st-cardio`, `--st-floor`, `--st-rest`, with `--c` per session.

Existing tokens reused: `--st-r`/`--r-tile` (26), `--r-card` (18), `--r-ctl` (14), `--st-s1…s8`, `--st-ink`, `--st-ink-2…4`, `--st-font`, `--st-font-d`, `--st-t-touch/state/move`, `--st-out`, `--st-glide`, `--st-spring`, `--fs-*`, `--fw-*`.

**New tokens (scoped to `#homePage`, declared in the stage-5 block):**

| Token | Value | Purpose |
|---|---|---|
| `--tf-s` | `1`; `1.12` under `:root[data-nxp-size="large"] #homePage` | every `tf-*` font size is `calc(Npx * var(--tf-s))` (fixes F8 on Today) |
| `--tf-gap` | `12px`; `10px` compact; `8px` narrow | block and card-interior rhythm |
| `--tf-pad` | `18px 20px 18px`; `16px` compact; `13px 16px 14px` narrow | card padding |
| `--tf-cap` | `54px`; `46px` compact | rail capsule height |
| `--tf-cta` | `54px`; `50px` compact; `48px` narrow | last button height |
| `--tf-rest-pct` | 0–1, written by the tick | rest ring arc |

Compact = `@media (max-height: 740px)`. Narrow = `@media (max-width: 359px)`. Both are scoped to `#homePage`.

---

## 10 · Typography (390; compact / narrow in brackets)

Geist (`--st-font-d`) for display and numerals; SF (`--st-font`) for body. Nothing below 11 px (D68). All sizes scale with `--tf-s`.

| Role | Spec |
|---|---|
| Eyebrow | Geist 520 13/17, `--st-accent-lift` mixed 70 % with ink-3 |
| H1 | Geist 640 34/36, −0.04em, sky gradient (32 / 28) |
| Context line | SF 450 14/20 ink-2; figures SF 600 ink (13/18 narrow) |
| Card state line | Geist 560 12.5/16 ink-2 |
| Session title | Geist 650 38/42, −0.045em, white → `--c` (36 / 30) |
| Tape label · Plan › | SF 500 12.5/16 ink-3 · Geist 600 12.5 `--btn-text` |
| Cue / now headline · note | Geist 600 14.5/20 · SF 450 12.5/17 ink-3 |
| Rest ring digits | Geist 500 14 tabular |
| Receipt counters | Geist 300 26/28 tabular + SF 500 12 word |
| Rail header · letter · label | SF 550 12 ink-3 · Geist 600 12 hue · SF 600 11 ink-3 (−0.02em narrow) |
| Primary button | `--btn-font` (Geist 600 16), 54 tall |
| Log label · state · value · unit · sub | Geist 600 12.5 · SF 600 11 · Geist 300 28/30 tabular (25 narrow) · SF 500 13 · SF 400 12/15 |
| Zone B label · figure | SF 500 11/13 ink-3 · Geist 560 13 tabular |
| Lead eyebrow · headline · body | SF 500 12 · Geist 600 18/24 · SF 400 14.5/21 ink-2 |
| `dt` · `dd` · chip | Geist 600 11.5 ink-3 · SF 500 13.5/18 · Geist 560 12.5 |
| Digest title · preview · pill | Geist 600 15/20 · SF 400 13/17 ink-3 · Geist 600 12 |

Contrast (I4, on real backgrounds): ink-3 `#9893AA` ≈ 6 : 1 on L2/L3 glass; ink-4 `#8A859C` ≈ 5 : 1 (used only for separators and the sub-label); amber is used only for shapes and short words at ≥ 11 px semibold.

---

## 11 · Interactions and keyboard

| Target | Action |
|---|---|
| Concern line | scroll to lead + focus its heading |
| Gym capsule | `cycleGym()` (D76 ask when sets exist) |
| Session title ⌄ | `showSessionSheet()` |
| Tape label `Plan ›` | `NXP.todayPlan()` toggles the in-place list (`aria-expanded`) |
| Cue (carried insight) | `NXP.cueSheet()`: `N.modal` with the four-part body, action and Dismiss; focus returns to the cue |
| Cue / now well (advice only) / rest ring | `NXT.selectExercise(i)` → `NXP.enterTrain()` |
| Rail capsule | `NXT.openDay(date)`; ←/→/Home/End move focus (roving tabindex) |
| Edit plan | `NXT.more('training')` |
| Start / Resume / Finish / View session / Log cardio | `startWorkoutNow()` / `NXP.enterTrain()` / `NXT.finish()` / `NXT.openFinishSummary()` / `showCardioSheet()` |
| Optional lifting | `NXP.addOnPick()` |
| Weight Zone A | not logged → `apx95OpenQuickWeight()`; logged → `NXP.weighReplay()` |
| Weight Zone B | Progress › Weight with the D71 trend morph (`st-m-trend`) |
| Cardio Zone A / Zone B | `showCardioSheet()` / Progress › Training |
| Lead Why / action / Dismiss | `NXT.openReview()` or the insight Why sheet / `NXP.coachAct(i)` / `NXP.coachDismiss(i)`; after Dismiss, focus moves to the new lead's heading (`tabindex=-1`) |
| Digest row / compact row | `NXP.digestToggle()` / expand in place; dismissing a row moves focus to the next row, otherwise to the digest row |
| Lifts / scan rows | Performance / Progress › Body |
| Pull to weigh in, dock long-press | unchanged (D90 / D89) |

Every control is a `<button>` with an effective target ≥ 44 pt (small capsules extend with `::after`; rail widths are the D48 exception noted in §2.4). There are no nested interactive elements and no swipe-only gestures. Focus rings use the existing lavender ring. Tab order = DOM order = visual order, including the concern reorder, because the DOM is reordered rather than using CSS `order`.

---

## 12 · Motion and reduced motion

Motion plays **on tab entry only** (`#homePage.st-enter`), never on the repaint after logging.

| Pattern | Spec | Reduced (OS `prefers-reduced-motion` **or** `:root[data-nxp-motion="reduced"]`) |
|---|---|---|
| Tab entry | existing D71/D102 fade + 6 px rise | plain swap |
| Session tape | logged cells light left → right, 16 ms stagger, 180 ms each, `--st-out` | lit, static |
| Count | existing odometer on `data-st-odo` | final value |
| In-progress arc / state dot | 2.4 s opacity breath 0.6 ↔ 1 | static |
| Rest ring | `stroke-dashoffset` with a 1 s linear transition per tick; digits swap | digits update, no transition |
| Sparkline | stroke draws 520 ms (`pathLength=1`), dots fade at 440 ms | drawn, static |
| Weight Zone A logged | View Transition morph of the value (existing D92 path) | instant |
| Watch lead | one 600 ms edge brighten | none |
| Concern line jump | smooth scroll | `behavior:'auto'` |
| Digest expand | `STRATA.morph` 220 ms, chevron 180 ms | instant |
| Live row hand-off | 200 ms grid-rows | instant |
| Below-fold reveal | existing `.st-bento>*` `st-rv` | shown |

---

## 13 · Implementation: focused commits, in order

Prerequisite: the D105 day-state work is committed. Work happens on a working branch, never on `main`. Cursor implements and does not commit or push (AGENTS §6a); the commit boundaries below are the review units.

**C1 · Today picker and context line (pure; no UI change)**
- `premium-ui.js`: add `pickToday(input)`, `todayLine(facts)`, `cueFor(m)` as pure functions (no DOM, no persist), exported on `NXP` (`NXP.pickToday`, `NXP.todayLine`). Place them **before** `function home()`.
- `wearables.today-brief.test.js` (new; vm loads `cut-support.js`, `coach.js` and `premium-ui.js` like `wearables.day-state.test.js`): T1–T12 (§14).

**C2 · Focus card (adaptive states, tape, cue, rail header, legend)**
- `premium-ui.js home()` becomes a composer, `todayModel()` + `mastHTML` + `focusHTML` + …. **The rail code (`dayState(d,dsx,…)`, `class="vn-week"`) and the button label expression containing `dsToday&&dsToday.inProgress?'Resume workout'` stay inside `home()`'s text slice.** New helpers (`focusHTML`, `focusLiftHTML`, `focusCardioHTML`, `focusRestHTML`, `tapeHTML`, `cueHTML`, `railLegendHTML`, `NXP.todayPlan`, `NXP.cueSheet`) go **between `home()` and `function coachDeck()`**, so `wearables.day-state.test.js:326` still passes unadapted.
- The card keeps `st-tile st-t-train` and `.st-h2` on the title (the `st-m-session` morph is unchanged).
- `strata.css`: new block `/* Today brief (stage 5) */` after the existing Today rules (around L1038), all selectors `#homePage .tf-*`, new tokens (§9), no `!important`.

**C3 · Log strip and shared sparkline (replaces minis and pill)**
- `premium-ui.js`: `logStripHTML(m)`, `trendSparkSVG(series,{w,h})` extracted from `decEvidenceHTML`'s plot (which then calls it). Remove the `.st-minis` markup and the `.st-wpill` from `home()`. `weightTileHTML` is retired from Today.
- `strata.js:754`: `st-m-trend` home selector → `#homePage .tf-log [data-st-odo]`.
- `strata.css`: `.tf-log*` rules in the stage-5 block.

**C4 · Lead, placement and digest (replaces deck, Decision card, scan tile)**
- `premium-ui.js`: `leadHTML(m)`, `anatHTML`, `digestHTML(m)`, `evidenceRowsHTML(m)`, the concern variant of `mastHTML`, and `NXP.digestToggle` with `coachDeck` kept as an alias (it remains the slice end marker). `ui.coachList` remains the index space for `coachAct(i)` and `coachDismiss(i)`. Lifts summary lifted from `home()` and switched to the last completed non-today session.
- `strata.css`: `.tf-lead*`, `.tf-dig*`, watch edge brighten keyframe.

**C5 · Live dock hand-off**
- `strata.js`: `updateLive()` visibility term + IntersectionObserver bound in Today's hydrate; the tick writes `[data-tf-rest]` and `--tf-rest-pct`; the floating pill obeys the same rule on Today.

**C6 · Remove orphaned Today CSS** (D68 pixel-diff guard)
- `strata.css`: delete `.st-minis*`, `.st-mini*`, `#homePage .st-minis::before`, `.st-codeck*`, the Today `.st-t-dec` / `#homePage .st-dec-plot*` placement and `st-watch` use on Today, **only where unreferenced** (grep before deleting). List anything kept.

**C7 · Browser-check adaptations** (Claude's lane; intent kept)
- `tasks/vnext/verify-151.mjs:96,100,102`: Lifts mini → Lifts evidence row; Decision sparkline → `.tf-log` sparkline. Keep "no `-0.00/wk`" and "no ellipsis".
- `tasks/vnext/verify-152.mjs:61,67`: Decision plot chip → Weight Zone B button; minis meta → log strip sub-lines. Keep the "chart has a text summary" intent.

Not touched: `cut-support.js` (including `chartModel…chartHTML`), `coach.js`, `index.html`, `sw.js`, storage, Supabase.

---

## 14 · Tests (deterministic)

`wearables.today-brief.test.js`:
- T1 A watch Decision leads and is placed `afterFocus`. `todayLine` returns the concern variant flag.
- T2 An act insight leads over a calm Decision, placed `afterLog`.
- T3 Info and celebratory items never lead.
- T4 Carry: before, a strength insight whose lifts are all in the template is carried and supplies the cue exercise.
- T5 **Exactly once:** for every fixture (before, progress with a matching exercise, progress with a different exercise, cardio, rest, watch), each pool item appears exactly once across carried, lead and digest.
- T6 The digest count equals its rows. The review is counted only while unseen. Coach insights ≤ 3.
- T7 A Decision displaced by an insight appears in the digest. `weight.review` and the Decision never both appear.
- T8 The cue equals `coachAdvice(ex)`: with a cautious `caution()`, the cue headline is the coordinator's hold, never `aimFor()`'s step.
- T9 De-dupe: an action with `payload.tab==='train'` is hidden while the focus button is Start, Resume or Finish.
- T10 `todayLine` never contains `kg`, `/wk`, or a date after `state.date`. The cut week appears only with a finite `cutStart`.
- T11 The Lifts summary ignores today's open session.
- T12 The picker and the line write nothing (state and settings JSON unchanged; persist/save/render counts 0).

Gate (report real output):
```
for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done
node --test *.test.js
node --check premium-ui.js && node --check strata.js
```
Plus brace balance on `strata.css`. Unchanged and passing: the release gate (`vn-week`, no `y2=` in the chart slice, canonical calls), the coach suite, the day-state suite (no adaptation), and the weight contract suites.

---

## 15 · Accessibility names and summaries

- Landmarks: `h1` greeting. Focus card is `article` labelled by the title and described by the state line. `section[aria-label="Log today"]`. Lead `section` labelled by its `h2`. Digest `section` with a hidden `h2` "More insights".
- Tape (`role=img`): `6 of 15 working sets logged. Incline Dumbbell Press 3 of 3, Chest Supported T-Bar Row 3 of 3, Leg Press 0 of 3, …`.
- Sparkline (`role=img`), also in the Zone B button name: `Smoothed trend over the last 28 days, from 84.0 to 82.6 kilograms, 25 morning readings. Open Progress.` Aging appends `as of 12 October`. Stale reads `paused since 1 October`. Empty reads `Smoothed trend starts after 3 morning readings.`
- Cardio meter: `Cardio this week, 0 of 90 minutes. Open Training.`
- Rail capsule: `Mon 19 Oct · Full Body A · In progress, 6 of 15 sets` (the D105 word plus counts), with `aria-current="date"` on today.
- Rest ring: `role="timer"`, `aria-live="off"`, label refreshed at most every 15 s (`Rest, 1 minute 24 seconds left`). Rest end is announced once through the existing polite region.
- Severity: every shape has a word (Calm, Watch, Action, beat / matched / below, the logged states). Colour is never alone (I6).
- Concern line: `Watch: {title}. Read the weight decision below.`
- Digest row: `More insights, 2: Streak; Last week's review. Expand.`

---

## 16 · Acceptance criteria (measured on the seeded app, fixed clock 19 Oct 2026 10:00, no banner, reduced motion for screenshots)

Layout and fit:
- **A-1** At 390×844, during: card top 116 ± 4, button bottom ≤ 524, log strip fully visible (bottom ≤ 690 < 768), lead eyebrow and headline line 1 visible above 768.
- **A-2** At 390×844, before: button bottom ≤ 520. Both Zone A buttons fully above 768.
- **A-3** At 375×667 (during and before): button bottom ≤ 583 (dock top 591 − 8). Both Zone A buttons fully above 591.
- **A-4** At 320×568 (before, during, complete, finished, cardio): button bottom ≤ 484 (dock top 492 − 8).
- **A-5** At 393×852, 430×932, 768×1024, 1280×800 and 1440×900: button above the dock. At 1280×800 the log strip is fully in the first viewport.
- **A-6** Page height at 390 ≤ 1300 (during), ≤ 1320 (before). No horizontal overflow at 320–1440 (only the ghost word clips inside the card).
- **A-7** Focus card height at 390 ≤ 422 (before and during), ≤ 470 (finished).
- **A-8** Under a watch Decision at 390: the context line reads `◆ Watch · {review().title} · Read below ↓`; the lead sits directly after the card; its headline and ≥ 3 body lines are above 768.

Content integrity:
- **A-9** Exactly one `--btn-primary` element on Today in every state (computed background check). Rest and excused have none.
- **A-10** The cue's text equals `coachAdvice(ex)` output for the cue exercise in every state. Under a cautious decision it shows the hold.
- **A-11** Every pool insight is reachable exactly once (cue sheet, lead, or digest). Coach insights on Today ≤ 3.
- **A-12** The digest count text equals its insight rows.
- **A-13** No string on Today contains a future date when `forecastView().freshness` is stale or expired.
- **A-14** No `Week N of your cut` when `settings.cutStart` is null (seed).
- **A-15** `6 of 15` reads `In progress` on the card, the rail label and the dock (D105 acceptance).
- **A-16** The Lifts row never names today's open session.
- **A-17** Weight Zone B shows its label (`Smoothed trend · 28 days` or the state variant) and the range figure in every data state listed in §5.3 (fixtures: empty, 1, 2, sparse, aging, stale, logged, unlogged).
- **A-18** Today shows exactly one chart-like SVG (the sparkline). No element matches `.st-dec-plot`, `.st-minis` or `.st-codeck` inside `#homePage`.

Interaction:
- **A-19** Every control in §11 reaches its function (scripted clicks), and each sheet returns focus to its opener.
- **A-20** Keyboard: Tab order follows the DOM. The rail is one Tab stop with working arrow keys. Every control has a visible focus ring. Escape closes sheets.
- **A-21** The live row and floating pill are hidden on Today while the focus button is fully visible, and shown within one tick after it scrolls under the dock. No toggling over 10 scroll steps of ±10 px at the boundary.
- **A-22** Reduced motion (OS and in-app): no CSS animation or transition longer than 0 ms runs on Today except the rest digits text; the screenshot before and after entry is identical.

Accessibility and type:
- **A-23** Text contrast ≥ 4.5 : 1 for all text under 18 px (axe or computed check). Effective targets ≥ 44 × 44 except the D48 rail capsules (unchanged widths).
- **A-24** Each mock or QA screenshot set uses one fixture. No illustrative figure mixes with seed figures on one screen.
- **A-25** Larger text: every `tf-*` text measures 1.12× its default size. No clipped label at 390 or 320.
- **A-26** All deterministic suites pass (§14 gate, real output in the report). `sw.js` and `RELEASE` are unchanged.

---

## 17 · Owner decisions requested (proposed as one D-row after D105, provisionally D106)

1. Adopt the four-surface Today (card → log strip → lead → digest). This supersedes D103's coach deck, the D44/D53 minis strip, the D36/D50 Decision card's placement (its window, range text, confidence and meter are kept), and the scan tile becoming a row.
2. The D103 weigh-in pill is replaced by the lit Weight cell (Zone A). The D92 replay, D90 pull and D89 dock shortcut are kept.
3. Under a genuine concern the context line becomes the concern link and the lead moves above the log strip (a D81 refinement).
4. D75 refinement: the live row and floating pill hide on Today while the focus button is visible.
5. Lead actions are always glass on Today, so the focus button is the page's only primary (a D56 tier detail).
6. The 44 px count numeral on the training card is replaced by the tape and its label (a D53 detail).

Deferred, not in this build:
- **O-1** Two-column Today at ≥ 1180 (needs a D59 amendment).
- **O-2** An engine-owned `why.limits` field.
- **O-3** Moving Edit plan anywhere else.
