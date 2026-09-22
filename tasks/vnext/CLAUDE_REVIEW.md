# CLAUDE REVIEW

## Slice

`VNEXT PHASE 2B: TRAIN — ACTIVE WORKOUT MODE` — final (rounds 1–2)

## Verdict

**APPROVED — ready for the owner's commit decision.**

Round 1 found one defect with two parts; round 2 resolved both. Round 1's findings are kept below for the record.

### Round 2 — re-verified by Claude

**1a — banner scoped to active mode.** Verified across eight surfaces: suppressed in Train active mode (including mid-session), present on Today, Progress, Train idle, Train Rest, Train Zone2, and restored after leave. D11 targeting untouched everywhere else.

**1b — fold resolved, and now stable.** Log Set no longer moves as sets accumulate, because the set history was relocated below the CTA and the rest strip compacted to a single 44px row.

| Sets logged | 390px (was) | 320px (was) |
|---|---|---|
| 0 | **678** (763) | **753** (838) |
| 1 | **750** (951) | **825** (1026) |
| 2 | **750** (995) | **825** (1070) |
| 3 | **750** (875) | **825** (950) |

All ≤ 844. The whole logging loop now fits one screen at both widths, for the entire exercise.

**All six semantic contracts re-verified after the fix and still hold** — input contract and record write, add-on non-reclassification across reload, draft survival, rest tick without repaint, nav recede/restore, session survival on leave.

**Full sweep re-run post-fix:** state matrix (6 Train states × 390/375/320) → 0 contrast, 0 target, 0 overflow failures · reduced motion clean · other four tabs unchanged, no errors · Today non-regression still green · release gate **53 passed, 0 failed**.

### Accepted design trade

Cursor moved the set history **below** Log Set. I checked the consequence: the just-logged row is visible without scrolling after set 1 at 390 (811px), but below the fold after set 2 (855px) and at 320 throughout.

**Accepted.** Confirmation that a set landed comes from the in-place "Working set saved" on the button, the advancing session bar, and the CTA incrementing to "Log set 3" — not from the history list, which is reference. Under INSTRUMENT the current set is the protagonist and completed sets are reference, so this is the correct thing to push down. Forcing both above the fold at 320 would mean compressing something that matters more.

### POLISH — non-blocking, carry into a later pass
- The "Working set saved" toast briefly covers the session identity in the mode bar. Transient, but it obscures the one line naming the workout.
- Two stacked disclosures at the foot of an active workout is near the limit; consider reaching *Session tools* from the mode bar instead.

## Scope check

Clean. `premium-ui.js`, `vnext.css`, `CURSOR_REPORT.md` and test artefacts under `tasks/vnext/`. No engine file, no `wearables.*`, no `sw.js`, no `RELEASE`/`CACHE_NAME` change. Nothing committed; `HEAD` at `a0c9203`.

## APPROVED — verified by me, independently of the report

**The six semantic contracts — the things that break silently — all hold:**

| Contract | Evidence |
|---|---|
| Input contract | Exactly one `weightInput` in the DOM (2nd source occurrence is a comment). `repsInput`, `n99-set-type`, `n99-rir` present. A simulated log wrote a correct record: `{Romanian Deadlift, 72.5, 9, working, rir 2, setNum 1, FullB, Gym A, vol 653}` |
| Add-on cannot reclassify | **Zero assignments to `state.dayType` anywhere in `premium-ui.js`.** Added an add-on on a Rest day → dayType stayed `Rest`, survived a **reload** (`resolveDayType` → `Rest`), add-on preserved, `sessionPlans` untouched |
| Draft survival | Set `88.5`, moved to next exercise, moved back → `88.5` still there |
| Rest timer without full repaint | Marked a DOM node, waited 2.5s through ticks → **node survived**, timer advanced `02:30 → 02:27` |
| Nav recede / restore | Receded in active mode, restored on leave, and correctly **not** receded on the other four tabs |
| Session survives leaving | Logged sets still present after `leaveTrain()` |

**Also verified:**
- Contrast, touch targets and overflow: **0 failures** across lifting-idle, lifting-active, mid+resting, Rest, Zone2 and Floorball, at 390/375/320.
- Non-lifting days keep their own screens; `addOnActive()` gating intact.
- Reduced motion: every Train state renders, logging still works, no errors.
- Other four tabs unchanged, no console errors; nav not receded there.
- Release gate **53 passed, 0 failed**.
- **Demotions are real, not losses.** Under *Re-establish your baseline* and *Session tools*: swap, undo, queue, finish, session menu, edit-current-set, coach and exercise details all still reachable.
- Design quality is genuinely good — mode bar, session progress, aim strip as one instrument line, settled set rows, thumb-ordered controls.

## REQUIRED FIXES

### 1. Log Set must stay above the fold during an exercise

§1 of the task set the objective as fitting the logging loop on one screen; §4.2 made Log Set reachability an acceptance criterion. It passes **only before the first set**, then regresses for the rest of the exercise — which is when it matters most.

Measured, Log Set bottom edge against an 844px fold:

| Sets logged | 390px | 320px |
|---|---|---|
| 0 | 763 ok | 838 ok |
| 1 | **951 — over by 107** | **1026 — over by 182** |
| 2 | **995 — over by 151** | **1070 — over by 226** |
| 3 | 875 — over by 31 | 950 — over by 106 |

(The drop at 3 is only the auto-advance resetting the list.)

Two contributors, both must be addressed:

**1a — the cloud/local banner is showing inside active workout mode.** Focused mode means app chrome recedes (D6); a sync banner is exactly the chrome that should not be present mid-set. It also costs ~73px directly: suppressing it moves the 1-set case from 951 → 878 at 390.

Suppress the banner **while active workout mode is engaged**, and restore it on leave and on finish. Do **not** alter the D11 targeting logic for any other context — this is a mode-scoped suppression, not a change to when the banner is warranted.

**1b — the rest strip and set history are too tall stacked above the form.** After 1a there is still an overshoot (390: 34 / 78px at 1 / 2 sets; 320: 109 / 153px). The rest strip measures 80px and each logged-set row 44px, and the list grows through the exercise.

Mechanism is yours — compact the rest strip, tighten set rows, or reflow so they do not stack above the form — but the rest controls (+30s, Skip, remaining time) and the visible set history must both survive.

**Target:** Log Set bottom ≤ 844 at **390×844** with 0, 1 and 2 working sets logged. At **320×844**, ≤ 844 with 0 and 1; get 2 as close as the layout honestly allows and report the number rather than sacrificing touch-target size or type scale to hit it.

## POLISH

- The rest strip's `02:30` is set at a large size; a smaller figure would read as calmly and help 1b.
- `Re-establish your baseline` is good copy, but two stacked disclosures at the foot of an active workout is near the limit — consider whether `Session tools` is better reached from the mode bar's finish/menu affordance.

## REGRESSION RISKS

Each checked, each clear: engine untouched · state/storage untouched · render input lock not fought (rest ticks without repaint proves it) · `template()`/`templateFor()` not conflated · `addOns`/`sessionPlans` separation intact and proven across a reload · other four tabs unchanged · demoted capabilities all reachable · release gate green.

## VERIFICATION RUN BY CLAUDE

Own Playwright scripts, own Chromium, independent of `verify-2b.mjs`: state matrix across six Train states × 390/375/320 (contrast/targets/overflow/nav) · input-contract record write · draft survival · rest-tick node survival · add-on dayType safety across reload · nav recede/restore · session survival on leave · fold measurement at 0/1/2/3 sets at 390 and 320 · fold re-measurement with the banner suppressed · demotion reachability · reduced motion · other-tab non-regression · release gate.

## NEXT ACTION

Cursor: fix 1a and 1b only. Re-measure the fold table at 390 and 320 for 0, 1 and 2 logged sets and put the numbers in the report. Re-run the state matrix and the release gate. Do not commit.

---

## History

| Date | Slice | Verdict | Rounds |
|---|---|---|---|
| 2026-09-22 | 2A Foundation + Today | **APPROVED** | 3 |
| 2026-09-22 | 2B Train active workout | **APPROVED** | 2 |
