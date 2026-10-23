# SPEC — UI polish, batch 1 (Today rail + strip + cue · Performance groups · Body grid)

Owner, 2026-10-22: "UI improvements … YES do it." Theme of the whole batch: **less repeated, bigger where it matters, grouped.** Presentation only — no calculation, storage key, record shape or engine vocabulary changes. Phone-first (390 / 375 / 320). Every rule in `tasks/vnext/DECISIONS.md` (I1–I12) and the coherence system (`SPEC-coherence.md`, D156) applies: sizes from the scale, SF 400/500/600, Geist 220/300/560/640, tokens only, card 26 / tile 18 / control 14.

## D157 · Today week rail: the capsule is the state

Today: each day capsule carries a letter, a tiny glyph (check / ring / dash), a hue, and a two-item legend row under the rail. Too many channels for seven small targets.

After:
- The capsule's **shape** says the state (I6, never colour alone): **filled** = logged/finished/planned sets complete; **ring** (1.5 px stroke) = planned, not yet; **dim, no ring** = rest; **dashed ring** = not logged (past) or excused; **ring with a small arrow** = moved. Today gets the existing glow ring on top of whichever of those applies, and "in progress" is a half-filled capsule (fill from the bottom to the share of planned sets done).
- Hue stays by category (lift violet, cardio `--st-cardio`, floorball `--st-review`), on the fill or the ring.
- The letter stays, in `--st-ink` on a filled capsule and in the hue on a ring; the inner glyph goes.
- The labels under the capsules ("Full A", "Walk", "Rest") stay.
- **The legend row goes.** `railLegendHTML` becomes a "Key" text button (`.vn-text is-mute`, 13 px) at the right of the rail header; tapping reveals the legend in place (same words as today: Not logged, Partly logged, Excused, Moved, Add-on logged, Planned sets complete). The capsule `aria-label`s already carry those words; keep them.
- Sizes unchanged (44 pt targets, I5). Reduced motion: no fill animation.

## D160 · The set strip is one bar; the cue never truncates

- `tapeHTML` (the 15 pills under the session title) becomes **one segmented bar**: a 4 px track, one segment per working set, 2 px gaps, segments fill in the hue as sets are logged, the current set's segment pulses (reduced motion: static highlight). Exercise boundaries get a slightly wider gap (4 px) so the bar still reads as "6 exercises". `tapeLabelHTML` ("15 working sets · 6 exercises · Plan ›") stays beneath it.
- `.tf-wn` (the cue note, e.g. "You topped your 8–10 range twice at 65. Target 70 × 8") **never truncates**: remove the nowrap/ellipsis, let it run to three lines. Same for `.tf-wt` if it clamps. Check the card at 320 for height.

## D158 · Performance grouped by engine state

Today: fifteen identical rows (name › / best set / status pill / sparkline / e1RM / read sentence / meta). Admin-dashboard density.

After, in `performanceRow` / the list builder (premium-ui.js ~2780–2830):
- The list is **grouped by status in engine order**: Review · Watch · Improving · Holding steady · Building data · Older history (I12 words only). Each group is a header row — status word, count, disclosure chevron — followed by its rows. Review, Watch, Improving and Holding steady are open by default; Building data and Older history are collapsed. Open/closed is memory only (`ui.*`), like the Today plan fold. Empty groups are not rendered.
- A row inside a group is **compact**: name › (left, 16/600), best set last time ("34 kg × 11", 13/500 with the numeral in Geist 300 20 px), the sparkline (unchanged model, `sparkModel`), and the delta ("+5.7 %") next to it. The status pill goes (the group header says it); the read sentence ("Up across the last four sessions") and the meta line ("19 Oct · 8 sessions · Gym A") move **behind a tap**: the row expands in place (`aria-expanded`), revealing both plus the e1RM figure. Only one row open at a time.
- The lead sentence (`performanceIntro`) stays above the groups. The "Since your cut started" card (`strengthSinceHTML`) is unchanged.
- Keep `li.vn-perf-row` with its `data-status`, `data-gym`, `data-e1rm` and `aria-label`; the group header is a `<div class="vn-perf-group">` with `<h3>` + button. Any test that counts `.vn-perf-row` must still pass; a test that asserts on the pill text inside a row may be adapted only if it was asserting the pill's presence (its intent — "status is named" — is now met by the group header; say so in the report).

## D159 · Body page: estimates once, metrics as a grid, one table for change

Today (Progress › Body and Settings › Body, both from index.html `evoMetricRows` / `evoChangedHTML`): five stacked rows each carrying a "◇ Estimated" chip, then "What changed" repeating the same metrics as prose, then Scan history, then three stacked full-width buttons.

After:
- **One caption** under the weight hero: "Weight is measured · body fat, muscle, fat mass, BMR and TDEE are EvoScan estimates" (`.vn-evo-kicker` style). The per-row `evoKindHTML` chips go from the metric rows (they stay on the composition bars, where the distinction is doing work).
- `evoMetricRows` renders a **2-column grid** (`.vn-evo-grid`): per cell, label (12/500, ink-3), value (Geist 300 20 px + unit in SF 12), delta beneath (12/500) with a glyph — ▲ ▼ ■ — and the hue; "Not in this scan" cells keep the `is-missing` style. Order unchanged: Body fat, Muscle mass, Fat mass, BMR, TDEE (TDEE spans both columns if the count is odd, or sits beside BMR — builder's call, say which).
- **"What changed" becomes one table** (`.vn-evo-chg` → a 3-column grid: metric · previous → latest · Δ with glyph). Rows from `evoChangeRows` unchanged. Header line "Since 14 Oct" stays as the kicker.
- **Scan history is unchanged** (audit trail, D102 Edit stays).
- The **three stacked buttons** on Settings › Body become: "New scan" as the one primary (`.n99-button`), then a single row of two text buttons (`.vn-text`): "Enter numbers manually" · "Use latest TDEE as maintenance". Same handlers.
- Body-page charts (`evoTrendSVG`, composition bars) untouched.

## Work split — one writer per file
- **Builder A — `premium-ui.js` + `strata.css`:** D157, D160, D158. Today's CSS lives under `#homePage .tf-*` / `.st-tweek` / `.vn-week-c` in strata.css; Performance under `#weightPage .vn-perf-*` / `.st-perf-*` in strata.css (and some in vnext.css — if a vnext rule must change, write the override in strata.css, scoped, and note it).
- **Builder B — `index.html` + `vnext.css`:** D159. Evo styles are `:is(#morePage, #weightPage) .vn-evo-*` in vnext.css; if a strata.css override (`#weightPage .vn-evo-*`) fights the new layout, list the exact rule in the report — the director applies it.

Rules for both: match the file's comment density and idiom; no new `!important` unless answering one; tokens only; reduced-motion path for anything that moves; `node --check` on touched JS, brace balance on touched CSS, run all `wearables*.test.js` and report the real counts; do not commit, stash, push, or run browser tools. Report < 250 words: what changed, the judgement calls, any test adapted and why, the counts.

## Verification (director)
Simulator at 402 pt (NXTFRM 18 Pro): Today (planned / in-progress / finished states via scenarios), Progress › Performance (groups open/collapsed, row expand), Progress › Body and Settings › Body. Harness 390/375/320 overflow check, the coherence scan (`verify.mjs`, 0 off-scale), 29 suites, reviewer pass.
