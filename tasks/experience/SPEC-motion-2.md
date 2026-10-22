# SPEC — Motion 2 (sheet detents · rest-timer ring in the capsule)

Owner, 2026-10-22: "go" on sheets + rest ring. Presentation only. Phone-first.

## What already exists — extend, do not rebuild
- **Sheets (D151 one sheet system):** `#modalRoot .modal .sheet` in two families (`.n99-modal .sheet` and `.modal:not(.n99-modal) .sheet`), both with the grabber (`.sheet::before`, 40×5), `st-sheet-in` spring, backdrop blur, `html.st-sheet-open main{transform:scale(.94) translateY(10px);filter:brightness(.62)}` (page scales back), `transition: transform .35s var(--st-glide)`. `strata.js bindSheets()` (~514): pointer drag on the top 56 px (or anywhere when not scrolled, not on controls) translates the sheet; release past 120 px or a fast flick (>.6 px/ms over 40 px) dismisses via `closeModal()`, otherwise snaps back. Only bound to `.n99-modal .sheet`.
- **Live capsule (`#stLive`, `ensureLive` ~897, `updateLive` ~957):** ring `.st-live-ring` (circle `pathLength="1"`, driven by `--live` = sets done / total), name, "6/15 sets", ` · Rest 1:05` while `s.rest > 0`, class `is-resting`; `updateLive` reschedules itself every 1000 ms while a session or rest is live. `liveSession()` supplies `{name, count, total, rest, word}`; `NXP.ui.restTotal` is the rest length (default 90). Today's cue card has its own ring (`tickCardRest`, `--tf-rest-pct`). The Train tab icon carries a mini `--live` arc. Rest itself lives in index.html (`apx96StartRest / apx96RestRemaining / apx96TickTimer`) — **do not touch**.

## S1 · Sheet detents (D164)
Every `.sheet` gets up to two detents:
- **Measure on open** (after the entrance animation starts; read `scrollHeight` once): if the content fits within `min(62vh, available)`, there is one detent — the sheet is content-sized as today, drag down dismisses. Otherwise the sheet opens at the **half detent** (62vh, `--st-sheet-h`), content clipped (no inner scroll at half), and gains a **full detent** (`min(92vh, content)`) — drag up or tap the grabber to reach it; at full, the inner scroll works as before and a drag down from `scrollTop === 0` returns to half, then a further drag dismisses.
- **Drag:** transform only; dragging above the current top rubber-bands (`dy * .25`); release snaps to the nearest detent by position and velocity (same thresholds as today for dismiss), `transition: transform .35s var(--st-glide)`; height between detents changes with `transition: height .35s` — if that proves to cost, animate `transform` of a fixed-height sheet instead and say so.
- **Grabber** is a real target: ≥ 44 pt hit area (keep the 40×5 visual), `role="button"`, `aria-label="Expand"` / `"Collapse"` when two detents exist, `aria-hidden` when one. Keyboard: Enter/Space toggles detents, Escape still closes.
- **Both families** get this (`#modalRoot .modal .sheet`), not only `.n99-modal`; if a legacy modal's markup cannot be measured, leave it single-detent and report which.
- **Page behind:** at the full detent the page scales to .92 and dims a touch more (.55 brightness); at half the current .94/.62. Reduced motion: no scale (already), detent changes jump.
- **Do not break:** focus trapping / `closeModal()` / the sheet's forms (steppers, inputs); the modal's own scroll lock; the quick-weight pull-down (`apx95OpenQuickWeight`); keyboard avoidance on iOS (the sheet must still rise above the keyboard — test with the Log weight sheet's input focused; the half detent may need to release to full when an input gains focus).

## S2 · The capsule's ring counts the rest down (D165)
While `s.rest > 0`: the ring's arc shows `rest / restTotal` (shrinking), stroke in the accent, label as today; between the 1 Hz ticks the arc **moves continuously** — `transition: stroke-dashoffset 1s linear` on the circle (reduced motion: no transition, it steps). When rest ends (`s.rest` goes from > 0 to 0 while the capsule is visible): a 200 ms state pulse on the capsule (scale 1.03 → 1, ring flashes to `--st-ink`), class `is-rest-done` for 600 ms, then the ring returns to the sets arc with the same 1 s ease. The Train tab's mini arc keeps showing sets (not rest). `aria-label` already names the rest; keep it. The Today cue ring (`tickCardRest`) gets the same continuous transition on its `--tf-rest-pct` driven arc (`@property --tf-rest-pct` so it can transition) — check it is an SVG or a conic gradient and use the matching mechanism.

## Out of scope
The rest timer logic and its toast/vibration (index.html), `navigate()`/View Transitions, the set-complete moment (M6, owner undecided), the Train active rest rail.

## Builder rules
One builder, `strata.js` + `strata.css` only. Tokens and I8 tiers (touch 120 / state 200 / move 280; the sheet's `.35s var(--st-glide)` is the existing exception for sheets and stays); transform/opacity/stroke-dashoffset only, no per-frame JS beyond the pointer drag that already exists; reduced-motion path for each; match comment style with D-numbers. `node --check strata.js`, brace balance, all 29 suites. No commit, no browser tools. Report < 250 words: detent heights chosen, how the keyboard case was handled, how the ring transition was done, the counts.

## Verification (director)
Simulator: open Log weight (one detent? drag to dismiss), Log cardio with More details (two detents: half → full → half → dismiss), a long sheet (Why / session sheet) for the full detent and inner scroll; rest ring on Today's capsule during a seeded in-progress session (`?reseed=1` has a rest? if not, start one from Train); reduced motion in the harness; 29 suites; reviewer.
