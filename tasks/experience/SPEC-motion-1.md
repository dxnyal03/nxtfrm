# SPEC — Motion 1 (masthead collapse · entrance choreography everywhere · press on every surface)

Owner, 2026-10-22: "improve UI even more, animations too" → go on the motion system. Presentation only. Phone-first (402 / 390 / 375 / 320).

## What already exists — extend, do not rebuild
- **D71 tab navigation** (`strata.js navigate()`): a View Transition per tab change, `data-st-nav="fwd|back|portal"` on `<html>`, the masthead (`MAST[tab]`) tagged `st-mast` so the title travels; the page crossfades. The owner asked for it *calmer* on 2026-10-19 — **do not add page slides, flying elements or longer durations.** Leave `navigate()` and the `::view-transition` rules alone.
- **D72 top chrome** (`ensureTop` / `updateTop`): `#stTop.is-scrolled` once `scrollY > 4`, `#stTop.is-compact` once the masthead's bottom has passed the capsule; the capsule shows `TITLES[tab]`.
- **Entrance** (`hydrate()` → `page.classList.add("st-enter")` for 1.4 s on a tab change only; never on a repaint after logging): `.st-enter .st-bento>*` staggers on Today (strata.css ~392–401); `#weightPage.st-enter` draws the chart; `#historyPage.st-enter` pops the calendar days; `[data-st-odo]` roll via `odoSet`, `[data-st-count]` via `countUp`, `[data-st-num]` via `countNum` (inside `.st-rv` reveals).
- **Reveal** (`bindView`): `.st-rv` on below-the-fold cards (`.st-bento>*`, `#weightPage .wx-after/.st-jr/.wx-an`), `.st-rv-in` on intersection.
- **Press** (`bindPress`): `PRESS` selector (buttons, `[role=button]`, `summary`, links, `.st-tile[onclick]`, checkbox labels) — 110 ms scale down on the house easing, 440 ms spring back, depth by size (`pressDepth`).
- **Tokens:** `--st-t-touch:120ms; --st-t-state:200ms; --st-t-move:280ms` (I8), `--st-out`, `--st-spring`; reduced motion honoured by `reduced()` and `:root[data-nxp-motion="reduced"]` / `prefers-reduced-motion`.

## M1 · Masthead collapse, scroll-driven (D161)
As the page scrolls, the masthead (`MAST[tab]` H1 and its eyebrow line) shrinks and fades upward into the title capsule; scroll back and it unfolds. **Scroll-driven, no JS per frame:** `animation-timeline: scroll(root)` with `animation-range: 0 120px` (the sky already uses `scroll(root)`, D153), animating only `transform` (scale from 1 to .72 about the top-left, translateY −8 px) and `opacity` (1 → 0). The eyebrow fades first (`0 60px`). The capsule keeps its JS classes (`is-scrolled` / `is-compact`) — M1 is additive; if `is-compact` and the collapse disagree on a page, note which one wins and why. Not on the active Train loop (D18, D6: it has its own header). Reduced motion: no transform; a plain opacity fade is fine. `@supports not (animation-timeline: scroll())`: nothing happens (the capsule still works).

## M2 · Entrance choreography on every tab (D162)
Today's bento stagger becomes the pattern for the other tabs, **on tab enter only** (`.st-enter`), 280 ms (`--st-t-move`), `st-enter-rise` (6 px rise + fade), 30–40 ms apart, first card at 0, cap at ~180 ms total so the page never feels slow:
- Weight: the plate, then the segmented row, then `.wx-after > *` in order (the chart itself keeps its draw-in).
- Performance: `.vn-perf-lead`, the "Since your cut started" card, then each `.vn-perf-group` (the rows inside do not animate individually).
- Training / Body: each `.vn-evo-sec` / top-level card in order.
- History: the calendar card (its days already pop), then the day sheet card, then the filter row's cards.
- Settings hub: the identity card, then each group of tiles.
Figures roll on enter where they stand alone: add `countNum`/`odoSet` coverage for the Body grid values (`.vn-evo-cell b`), Performance best sets (`.st-perf-best` or the compact row's figure), History's count line, the Weight summary row — by marking them from `hydrate()` with a selector list (no markup edits needed; set `data-st-num` and call `countNum`, or reuse `[data-st-count]`). Rolling only on `entering`; a repaint after logging shows the final value at once (the skill's rule). Reduced motion: no stagger, no rolling.

## M3 · Press feedback on every surface (D163)
Extend `PRESS` to the tappable surfaces that are not buttons: `.st-tile`, `.tf-lc` (Today log cards), `.vn-perf-row` (its overlay button already qualifies — make sure the whole row scales, not the inner button), `.nxp-cal-day`, `.vn-week-c`, `#weightPage .wx-row-b`, `.vn-evo-hist-main`, `.vn-set-row` / Settings list rows, the Analysis rows on Weight, the "Since your cut" rows. `pressDepth` already scales by size (big surfaces .985). Exclude anything that scrolls horizontally or is a scrub target (`#vn-chart-wrap`, steppers, inputs — the exclusion list exists). Keep `-webkit-tap-highlight-color: transparent` on those surfaces and give them the existing highlight (`st-flash`-style 120 ms tint) if buttons have one. Reduced motion: no press animation (already gated by `reduced()`).

## Out of scope
Sheet detents/drag (next slice), the rest-timer ring (next slice), set-complete moment (owner undecided), any change to `navigate()` or the `::view-transition` rules, chart internals, the active Train loop.

## Builder rules
One builder, `strata.js` + `strata.css` only. Tokens and I8 tiers only; `transform`/`opacity`/scroll timelines only — nothing that restyles per frame on the main thread (bindParallax's per-frame restyle was the lag the owner felt; D153); every pattern has a reduced-motion path and is gated by `reduced()` or the media query; match the files' comment style (each block carries its D-number and a one-line why). `node --check strata.js`, brace balance, all 29 suites. No commit, no browser tools. Report < 250 words: what changed per M, the judgement calls (durations, which pages got what), the counts.

## Verification (director)
Simulator: scroll Progress and History (masthead folds into the capsule, unfolds back), enter each tab (stagger, figures roll), press a card/row/day (spring). Harness: reduced-motion contexts show no stagger/roll; 390/375/320 overflow unchanged; coherence scan 0; reviewer pass (motion performance: no layout/paint-triggering properties in animations).
