# CURRENT TASK — TRAIN COMPLETION + DEEP POLISH

**Owner:** Cursor (implementation) · **Reviewer:** Claude (audit, measurement, browser QA)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `DECISIONS.md` (binding) · `design-vnext/` · the four NXTFRM skills
**Previous:** 2G `b137e64` · INT-2 `08e56bd` · Body `6c1ded8`

**AI work is PAUSED.** Do not add an AI coach, chat, generated advice, generated muscle
mapping or any model call. This is a deterministic core-product completion task.

---

## 0. I audited the live build first. Most of Train already meets the direction.

Measured today, so you do **not** rebuild these:

| Area | Measured state |
|---|---|
| **Working loop** | **587px** at 390/393/402/430/375 (0 sets), 659–673px at 3 sets. **662–741px at 320.** |
| **Log Set reachability** | **In viewport in all 24 width × set-count combinations** at 844px height |
| Input contract | `weightInput` `repsInput` present, 26px font, 52px tall, `inputmode` set. `n99-set-type` and `n99-rir` are hidden inputs behind segmented controls — contract preserved |
| Active mode | Nav recedes (`.tabs.vn-recede`). 19 handlers incl. leave, details, swap, undo, session menu, finish, queue, adjust/skip rest, set type, RIR |
| Prev / target | `Last 30.5kg × 8 · 13 Jul` and `Target 8–12 reps` both render |
| Queue | Already **contextual** (`NXP.queue()` sheet), not a persistent block |
| Rest timer | Appears on log: `02:30 · +30s · Skip`, counts down, Log Set stays present |
| Completion | "Workout saved · 3 working sets · Progressed 1 / Maintained 0 / Below recent 0 · Next Full Body B tomorrow". Nav restored. **No invented score, duration or calories** |
| Anatomy | Deterministic `NXTLIB`. **106/107 catalogue, 21/21 templates, 20/20 logged history.** Unknown names resolve to empty, never guessed |
| iOS zoom | No risk — inputs are 26px |

**The original ~2,200px loop problem is solved.** Do not chase a pixel number. Do not
restructure what already works. This task is the two real gaps below plus disciplined polish.

---

## 1. G1 — PRIMARY: Log Set is unreachable once the keyboard opens

Measured at 390px wide, emulating the viewport a keyboard leaves behind:

| Viewport height | Input visible | **Log Set visible** |
|---|---|---|
| 844 (no keyboard) | yes | **yes** |
| 520 | yes | **no** |
| 480 | yes | **no** |
| 420 | yes | **no** |

The span from the focused input's bottom to Log Set's top is a fixed **278px**:

```
 78px  .nxp-stepper      Reps
 74px  .nxp-seg-type     Set type · Working / Warm-up
 78px  .nxp-seg-rir      Reps left · — 0 1 2 3 4+
~48px  spacing
```

The **order is correct** — it matches the approved hierarchy (load/reps → RIR → Log Set), so do
not reorder it. The problem is purely that with ~320px of keyboard, that 164px control tail
pushes the primary action off-screen during the exact moment the user is entering a set.

**Fix it so Log Set is reachable while a numeric field is focused.** The expected approach is a
**keyboard-aware docked Log Set** — when `weightInput` or `repsInput` has focus, the primary
action stays reachable above the keyboard — returning to normal flow on blur.

Constraints:
- **Do not shrink any control below comfortable touch size to make room** (explicitly forbidden).
- Do not reorder the hierarchy, and do not hide Set type or RIR.
- Do not break the input contract: `weightInput`, `repsInput`, `n99-set-type`, `n99-rir` keep
  their ids and their values must still be read by the engine at log time.
- Use `visualViewport` where available; degrade safely where it is not.
- The docked state must not collide with the rest timer, the safe-area inset, or the receded nav.
- Reduced motion: no positional animation.

**Test actual logging with the keyboard open**, not DOM presence. A set logged from the docked
control must produce exactly the same record as one logged from the inline control.

## 2. G2 — Date inputs overlap their neighbour on iOS

**Owner-reported, with a screenshot.** In *Log bodyweight*, the `Date` field visibly overlaps
`Weight · kg`.

It does **not** reproduce in headless Chromium at 390/393/402/430/375/320 — the grid is
`minmax(0,1fr)` with `min-width:0` and the inputs are `width:100%; max-width:100%!important`.
So the cause is iOS-specific: **`input[type="date"]` keeps its native widget, which enforces an
intrinsic minimum width that `width:100%` does not defeat**, so it spills its ~176px grid cell.

Confirmed: **no `appearance:none` is set for date inputs anywhere** in `cut-support.css`,
`premium-ui.css` or `vnext.css`.

This is systemic — the same pattern appears in at least seven places:
`apx95WeightDate` · `apx95EditDate` · `n99-waist-date` · `n99-edit-weight-date` ·
`n99-move-date` · `editSetDate` · `bwDate` · `scanDate`.

Fix it **once, in the shared layer**, so every sheet inherits it:
- `appearance:none; -webkit-appearance:none;` on `input[type="date"]`
- `box-sizing:border-box`, and make sure the control can actually shrink inside a grid cell
- keep the field ≥44pt tall and legible; **do not** shrink text to fit
- the date must remain readable and tappable, and the native picker must still open

If, after that, `Date` + `Weight` still cannot sit side by side at 375 and below without
crowding, **stack them** — a two-up row is not worth a collision.

Verify every listed sheet, at all six widths.

## 3. Everything else — verify, do not rebuild

Confirm these still hold and report the evidence. Fix only what is genuinely wrong:

Set logging · warm-up vs working · load · reps · RIR · previous performance · current target ·
session queue · rest timer (start, countdown, +30s, skip, exercise change, reload) · edit ·
undo · swap/substitution · session completion · local persistence · refresh/reload ·
**add-on lifting must never mutate `state.dayType`** · history · Gym A/B separation ·
planned day logic.

**Add-on is a required semantic test:** Rest → add exercise → log → refresh → `state.dayType`
is still `Rest`. Same for Zone2 and Floorball where supported.

## 4. Greyscale (§34)

Current, completed, warm-up, working, selected and disabled must stay distinguishable without
hue — through shape, type, position, icon or copy. Verify by rendering with
`filter:grayscale(1)`.

## 5. Anatomy — already passes its gate; hold the line

Deterministic, complete coverage, graceful empty. **Do not** enlarge it, animate it, add pulse
or glow, or let it grow the working loop. It stays secondary to the current set. If you touch
it at all, it is to keep it quiet.

## 6. Files

| File | Permitted |
|---|---|
| `premium-ui.js` | yes — Train renderer and helpers |
| `vnext.css` | yes — `#trainPage` rules and the shared date-input fix |
| `premium-ui.css` | only if the date fix genuinely belongs there rather than `vnext.css` |

**Do not edit:** `cut-support.js` · `index.html` · `sw.js` · `manifest.webmanifest` ·
`wearables.*` · `seed.*` · `train-anatomy.js`. **`RELEASE`/`CACHE_NAME` stay at `109`.**

Do not create another duplicate Train renderer or a new specificity layer. Existing VNext
tokens and shared primitives only. **Document** architecture cleanup candidates in the report;
do not delete legacy code in this task.

## 7. Responsive

**390 · 393 · 402 · 430 · 375 · 320**, plus reduced viewport heights for the keyboard case.
Zero horizontal overflow, zero clipping, no nav or keyboard collision, ≥44pt on important
targets, 320 a genuine layout rather than a shrink.

## 8. Tests

Add `tasks/vnext/verify-train.mjs`. Use realistic fixtures, not only the default seed: first /
middle / last set · warm-up and working · RIR present and absent · exercise with and without
history · multiple completed sets · active timer · queued exercises · add-on workout · Gym A
and Gym B · mapped and unmapped anatomy.

Run **all sixteen** suites **and every existing verify script** (`2a`…`2h`). INT-2 proved a
slice can break an earlier slice's assertions. Baseline **16 / 458 / 0 failing**.

**Do not weaken a test to make the suite green.**

## 9. Definition of done

- [ ] Log Set reachable while a numeric input is focused, at reduced viewport heights
- [ ] No control shrunk below comfortable touch size to achieve it
- [ ] Input contract intact; a set logged from the docked control is identical
- [ ] Date inputs no longer overlap; fixed once in the shared layer; all 7+ sheets verified
- [ ] Add-on never mutates `state.dayType`, proven across refresh
- [ ] Greyscale states distinguishable
- [ ] Anatomy unchanged in prominence
- [ ] 390/393/402/430/375/320 clean; reduced heights clean
- [ ] 16 suites + all verify scripts green
- [ ] `CURSOR_REPORT.md` (A–H) incl. architecture cleanup candidates
- [ ] **Do not commit. Do not push.**
