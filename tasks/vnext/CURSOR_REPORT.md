# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`VNEXT PHASE 2G — PROGRESS → PERFORMANCE`

Implementing model: **Grok 4.7** (this session). The pinned Opus model was not used.

## Status

`READY FOR REVIEW` — Performance is a list of engine comparisons. Cursor-owned checks are green. Rendered contrast, responsive, interaction, reduced-motion and visual fidelity are Claude's (AGENTS.md §6). No browser was used.

---

## A. Seam

`NXP.progress()` no longer injects `N.strengthHTML()`. The Performance tab is painted in `premium-ui.js` from `N.strengthItems()` only.

`strengthHTML()` is still in `cut-support.js` and the legacy `NXT.progress()` still calls it. That function was not deleted (D5). The live screen is `renderWeight = NXP.progress`, so the page does not go through it. `arrangeStrengthView()` is a no-op: there are no V99 cards left to reorder. Same pattern as `arrangeWeightView()` after 2C.

`strengthItems()` and `sessionRows()` were not edited. The e1RM formula, the 15-rep and warm-up exclusions, the 4-session / 21-day / 56-day rules, the six status words, the tones, and the 24-item cap are the engine's.

---

## B. Status language

The six words are the engine's, printed as text inside `.vn-perf-flag`, then a colour, then a shape:

| Status | Colour | Shape |
|---|---|---|
| Improving | violet | filled circle |
| Holding steady | violet | filled square |
| Review | amber | filled diamond |
| Watch | ink | hollow diamond |
| Older history | ink | dash |
| Building data | ink | hollow circle |

Watch and Review share a diamond so the engine's "down" idea stays one family. Fill versus stroke is what separates them once the colour is gone. Improving and Holding steady share violet and differ by circle versus square. Older history and Building data share ink and differ by dash versus hollow circle.

A null delta renders no percent. Older history says "Too old to compare". Building data says "Not enough yet". A real zero (Holding steady, identical sessions) renders `0.0%`, which is the engine delta, not a stand-in for null.

The lead line is a count of those words (`1 Review · 1 Watch · …`). It is not a score, and the old "holding / improving" blend is gone. Nothing says "muscle preserved". There is no strength score and no composite.

The disclaimer is the engine sentence, kept whole: "Estimated 1RM is a comparison aid, not a tested maximum or proof of muscle retention. Technique, effort and equipment setup affect it."

---

## C. Sparklines

Each spark is the last eight session e1RMs for that exercise at that gym, scaled with the same padding the engine spark used (`min - 1`, `max + 1`). A Lat Pulldown and a Reverse Fly do not share an axis. One horizontal gridline, one line, one end mark. The mark repeats the status shape. Older history is dashed so the line itself is not only a colour.

The accessible name is `"{exercise} at {gym}, estimated 1RM"` (`aria-label` and `<title>`). The text equivalent is `.vn-perf-eq`: the own-scale bounds and each plotted session. It is clipped so twenty rows do not each grow a paragraph, and it stays in the accessibility tree via `aria-describedby`. `data-min` and `data-max` are that spark's own domain.

`svg.n99-spark` is still on the element, with `vn-perf-spark`, so a count of `svg.n99-spark` still finds every spark. `.n99-strength-row` and `.n99-card` are gone from this tab. The row is `.vn-perf-row`.

---

## D. Layout

One list on the canvas. Hairlines, not cards. The page header and the three tabs are the chrome from Weight. The list is the protagonist (D1).

Rows are not buttons. Drill-down is Q4 and was not added. The interactive targets are the tabs and `+ Weight`, both already at least 44px tall. `+ Weight` stays the secondary header button shared with Weight and Body (`apx95OpenQuickWeight()`). No new primary button was added, so no local fill was introduced and `--vn-action` was not given a second gradient. Tabs stay on `--vn-violet`, which is the signal colour, not the action fill.

Names wrap (`overflow-wrap: anywhere`) and stay at 15px, including at 320. The spark column is 96px, 72px below 360px. The text equivalent cannot widen the row.

---

## E. Fixtures

The dev seed was not replayed here. The task's measurement stands: 20 exercises, all Older history, because lifting ends 2026-07-14 and `state.date` is 2026-09-22. Checking the seed alone cannot show the other five statuses.

`tasks/vnext/verify-2g.mjs` injects history and paints `NXP.progress()` in a vm. It does not open a browser. The main fixture produces all six statuses, plus:

- Smith Bench with a 200 kg warm-up and a 150×20 set on the latest day. The displayed e1RM is the working 110×6 set. 233 and 250 do not appear.
- Lat Pulldown at Gym A and Gym B, as two rows, with different e1RMs.
- Reverse Fly on its own, much smaller, scale. Its domain does not overlap the pulldown's.
- Face Pull (2 sessions), Tricep Pushdown (3), and one long-named single session, all Building data, no percent.
- Cable Crunch on a date 70 days back, Older history.
- An empty log, a one-exercise log, a three-exercise all-older log, and 25 cap exercises of which 24 render. `CapLift-25` is the one the engine drops.

`state.logs` is unchanged by painting Performance, Weight, or Body.

---

## F. Files and constraints

| File | What changed |
|---|---|
| `premium-ui.js` | Performance branch of `progress()`, plus the list helpers. `arrangeStrengthView()` is a no-op. |
| `vnext.css` | `#weightPage` Performance section. |
| `tasks/vnext/verify-2g.mjs` | New. Synthetic logs only. |

Not edited: `cut-support.js`, `index.html`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*`, `train-anatomy.js`. `RELEASE` and `CACHE_NAME` stay at 109. No new page script or stylesheet.

Handlers still in the Performance markup: `NXT.setView('overview')`, `NXT.setView('strength')`, `NXT.setView('body')`, `apx95OpenQuickWeight()`. Weight still renders the trajectory (`vn-weight` / Recent trajectory) and Body still renders `nxp-progress-body`. Neither renders `.vn-perf-row`.

---

## G. Verification

Cursor did not open a browser and did not run Playwright.

```
node --check premium-ui.js          OK (silent, exit 0)
vnext.css braces                    raw 653/653, comment-stripped 651/651
node tasks/vnext/verify-2g.mjs      OK  11 passed
```

Sixteen suites, enumerated as `wearables*.test.js` (no dot). Each printed `0 failed`. The pass counts were 32, 24, 16, 32, 3, 32, 28, 53, 19, 26, 34, 47, 18, 34, 29, 31. That is 16 suites, 458 tests, 0 failing. The release-gate suite (53) is in that run, so the 109 cache check still holds.

Not verified here, and owned by Claude: contrast on the new ink, violet, and amber words; 390 / 393 / 402 / 430 / 375 / 320; overflow; spark legibility at 320; reduced motion; the seed screen's 20 Older-history rows. On that seed screen the expected copy is "Too old to compare", with no percent, and 20 `svg.n99-spark` elements.

---

## H. Out of scope

Progress → Body still leaves capture through `NXT.more('body')`, which 2F turned into the EvoScan workspace. The design brief says Body should gain an analytical presence under Progress → Body while capture stays under Settings. That is a real follow-up. It is not part of 2G and was not touched.

Also left alone: the Weight tab, Today, Train, History, Settings, wearables, `readiness()` (D4), legacy renderer removal (D5), and Q4 (whether a row should open a lift). The legacy `strengthHTML()` remains so the engine progress renderer still has a body if something calls it directly.
