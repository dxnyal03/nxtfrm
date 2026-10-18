# Polish pass — dead code, bugs, copy, calendar semantics (Ascension)

Branch `ascension`, 2026-10-13. Nothing committed, pushed or deployed; no git state changed (only `status`, `diff`, `log`). Presentation only: no calculation, storage key, record shape or engine maths changed.

"Before" below means a snapshot of the working tree taken immediately before my first edit (served on :8791), so the before/after numbers isolate this pass. Line numbers are as of the end of this pass and will drift while the other agents keep editing. Chrome (system) only: no WebKit and no iOS Simulator on this machine, so Safari/iOS quirks are not verified.

## 1. Files touched

| File | What |
|---|---|
| `premium-ui.js` | A: 9 dead functions + `const dots` removed, `co-rv-on` hide removed. B1: hold block (contextmenu, input event). B2: `apx96StopRest` alias, try/catch removed. B3: `logSuggestion` call removed from `home()`. B6: hold prefill. C: History block label. D: calendar `role`. |
| `strata.js` | A: hero path, `syncVs`, count tick, `wrap()`, `animatedKeys`, first `dressWeeks` variant, `dressRecap`/`recapWeek`; B1: `bindHold` removed. 13 lines added, 291 removed. |
| `cut-support.js` | C: three copy strings only. |
| `index.html` | B4: `window.onerror`. B5: `cloudLogin` / `cloudSignup` client construction. Nothing else. |
| `strata.css` | One appended block at the very end, `/* ===== Ascension · polish ===== */` (error notice, week-sheet bar). No rule deleted or edited. |

## 2. Item by item

### A. Dead code

**premium-ui.js.** Removed `heroTileHTML`, `weeklyTileHTML`, `calendarTileHTML`, `linkSignal`, `loadLine`, `aimCell`, `syncLatestControl`, `arrangeWeightView`, `arrangeStrengthView` (and the comment that belonged to `aimCell`) and the unused `const dots` in `training()`.
- Confirmed first by `grep -w` across `premium-ui.js strata.js cut-support.js coach.js index.html seed.*.js *.test.js` and the whole repo (excluding `classic/`, `design-*`, `node_modules`): every name matched only its own definition. After removal, zero matches outside `classic/premium-ui.js` (the frozen classic app, untouched).
- Kept, as asked: `setRir` (exported), `anatomyStrip`, `sessionFocus` (the train-enrichment tests read them).
- The Monday-recap hide: the `co-rv-on` class is no longer put on `.vn-today` in `home()` (the CSS rule `.co-rv-on .st-recap{display:none !important}` stays, see section 4).

**strata.js.** Removed: `drawHero` and `MON`; the `[data-st-hero]` handling in `hydrate()` and in the resize handler (the odometer loop is now one plain `forEach`); `readJSON` (nothing used it once the hero went; `drawCompMap` parses its own attribute); `smooth`, `dms`, `DAY` (only the hero used them); `syncVs` and its listener; the Train count tick (`.st-tr-count`, `state0.lastCount`) and the then-unused `entering` parameter of `bindTrain`; `wrap()` and the `void wrap` in `install()`; `state0.animatedKeys`; the first (bars) `dressWeeks` variant with the min/max, `lo/hi/pc`, `li`, `pts` and the first `host.innerHTML` it alone used; `dressRecap` and `recapWeek`. The stale doc comment above `dressWeeks` now describes the ledger.
- `STRATA.install()` still wires: spotlight, step bump, sheets (drag-to-dismiss and the page recede), the `NXT.selectPoint` wrapper, calendar swipe, glyph-to-icon rewrite, ripple, parallax, press feedback, segmented pills, the tooltip hider and the resize redraw, plus the five render-slot wrappers.
- Verified at runtime on the before and after trees with the same probe (`wiring-check.mjs`): identical output, 0 errors (`st-on`, wrapped slots, dock vars, spotlight, parallax, glyph rewrite, segment pill, `dressProgress`, 5 ledger rows, `weeksSync`, tooltip, sheet class + drag binding, calendar swipe and month change, `fitTrain`, exercise swipe, `data-len`, step bump, odometer, scroll reveal, no recap node).
- Visual parity: the same 390/320 sweep on both trees, pixel diff at a 16/255 threshold, every screen 0.000–0.010 % of pixels (aurora noise); `progress-weight` (the `dressWeeks` page) 0.000–0.003 %.

### B. Bugs

**B1 · Stepper hold bound twice.** Kept premium-ui's loop (`HOLD_DELAY`/`HOLD_EVERY`), deleted strata's `bindHold`. Strata's tick called `btn.click()`, and premium's click handler (`detail === 0`) stepped again, so a hold ran two loops. Two things strata's loop did were carried over so nothing regressed:
- the long-press `contextmenu` guard: premium now `preventDefault`s it on `.nxp-step` and no longer ends the hold on it (inferred, not seen on a device: an Android long press raises `contextmenu` at about half a second, and premium's old handler ended the hold on it, so strata's loop was the only one that kept going);
- the numeral fit: `stepValue` now dispatches an `input` event, so strata's `fitNum` (`data-len`) follows each step of a hold (before, it updated per synthetic click; without the event the numeral kept the start size until release).

Verified with real pointer holds (`hold-check.mjs`, 1.2 s on "+", every write to `#weightInput.value` timed):

| | writes in 1.2 s | gaps (ms) | min gap after the first repeat |
|---|---|---|---|
| before (mouse) | 13 | 451, 92, 68, 42, 110, 10, 101, 59, 51, 110, **0**, 110 | **0 ms** (doubled) |
| after (mouse) | 8 | 542, 110, 109, 110, 110, 111, 109 | 109 ms |
| after (touch, CDP) | 8 | 541, 110, 109, 112, 108, 112, 109 | 108 ms |

After: one step on pointerdown, the first repeat at 542 ms, then one step per 110 ms; every step is exactly +2.5 (`nonUnitSteps: 0`). `fitnum-check.mjs` (95 → 122.5 over a 1.6 s hold): stale `data-len` samples 27 of 49 before, 0 of 49 after. `ctxmenu-check.mjs`: `contextmenu` default prevented, 6 more writes after it while still held.

**B2 · `apx96StopRest()` undefined.** `apx96SkipRest` (index.html, apex-v96) is the engine's stop: it clears the deadline and the interval, then ticks (the tick wrapper repaints the premium strip). Added the one-line alias `function apx96StopRest(){return apx96SkipRest();}` beside the other apx96 wrappers at the end of premium-ui.js, and `addOnRemove` now calls it without the `try/catch`. The alias keeps the name `wearables.train-enrichment.test.js` looks for in `addOnRemove` (test untouched). Verified (`rest-check.mjs`): the premium strip's Skip takes the timer to 0 and hides the strip ("Ready"), and removing the last add-on while a rest runs: before `typeof apx96StopRest` = undefined and 149 s still running; after a function and 0 s.

**B3 · Today render wrote storage.** Removed the `N.logSuggestion({kind:"review",…})` line from `home()`. The engine's `reviewCard()` (cut-support.js ~805) keeps its own logging. Note: `cfg().suggestions` is never read (only written by `logSuggestion`, guarded by coach.js, and merged by the cloud merge). Verified (`render-write-check.mjs`): three `NXP.home()` paints: before 1 new suggestion row and 15 `localStorage` writes (`persist()` rewrites every key); after 0 rows and 0 writes. The one remaining write during `NXT.repaint()` is `apm_last_open_date`, from the day-rollover in index.html, not from `home()`.

**B4 · `window.onerror`.** Now escapes the message with `esc()`, removes any earlier notice, and inserts one `.nx-err` notice (`role="alert"`, rose diamond + "App error" + the message + a 44 px Dismiss) as the first child of `#homePage`; Today stays. Style is the appended block in strata.css (I2 concern hue, shape and word, never colour alone). Verified (`err-check.mjs`, 390 and 320): `setTimeout(()=>{throw new Error('<img src=x onerror=1>')})` shows the literal text, no `<img>` element, Today unchanged (9 tiles before and after, `.st-bento` present), Dismiss 73×44 removes it, a second error replaces the first (count 1), the executing payload `onerror="window.__pwn=1"` stays inert (`__pwn` 0), no horizontal overflow.

**B5 · "Multiple GoTrueClient".** `cloudLogin` and `cloudSignup` no longer null `sbClient` unconditionally: they drop it only when the stored project URL or key differ from the ones entered (checked before the values are overwritten). Written inline in both functions on purpose: `wearables.plan-persistence.test.js` cuts those two functions out of index.html by name and a shared helper is not in its extract list (my first attempt failed 4 of its tests; reverted, 25/25 now). Verified with the real supabase-js (the cached jsDelivr build, served locally; project host `*.supabase.test`, requests aborted, test values only; `client-check.mjs`): createClient calls over login, login, sign-up with unchanged config / then a changed config / again: before 1, 2, 3, 4, 5 and 4 console warnings; after 0, 0, 0, 1, 1 and 0 warnings.

**B6 · Hold prefill.** In `training()` the coordinated advice is computed once before the weight prefill (`const coach=finished?null:coachAdvice(ex)`; it was computed later, so that is two lines rather than one) and `weight` is now `draft ?? last set ?? (hold ? coach.weight : cue.weight)`. The placeholder, the Aim tile and `NXP.useAim()` still use the engine's Aim. Verified (`prefill-check.mjs`; Incline Dumbbell Press 30 kg × 13/12/11, `NXT.review` stubbed to `tone:'watch'`): before the field opened at 32.5 under "Hold 30 kg — weight decision reads “Losing quickly”"; after it opens at 30, the Aim tile still reads 32.5 × 10, tapping Aim fills 32.5, tapping the first target fills 30. Without the stub (no hold) the prefill is 32.5, unchanged.

**B7 · Week-review sheet and the sticky Done bar.** Measured first: the geometry the brief asks for already held. At the end of the scroll the last Next-week strip ends 14 px above the bar at 390×844, 390×700, 375×667, 320×568, with and without a 34 px safe-area inset (the bar is in flow, so it sits after the strip). Adding padding to the sheet body would only add blank space under the bar. What is real, and what the screenshot showed: the sheet's own 30 px bottom padding (an `!important` `.sheet{padding-bottom:calc(30px + …)}` in the index.html inline CSS) holds the sticky bar 30 px (64 px on a notched phone) above the sheet edge, and rows and the Next-week strip scroll through the gap under Done ("Next week" visible beneath the button at scrollTop 30). Fix, in the appended block: `.n99-modal .sheet:has(.co-rvs){padding-bottom:0 !important}` and the bar's own bottom padding `calc(22px + safe-bottom)`, so the bar is flush with the sheet edge. Verified (`band-check.mjs`, every 3 px of scroll at four viewports, safe 0 and 34 px): content visible beneath the bar up to 30 px before (up to 46.6 px with the 34 px inset; 0 only where the sheet barely scrolls), **0 px** after at every viewport; bar flush (0 px to the sheet edge); end gap strip to bar 14 px before and after; the bar never jumps. Other sheets: scanned 18 sheets at runtime (`sticky-scan.mjs`) and every CSS layer: the week sheet's bar is the only `sticky`/`fixed` element in any sheet.

### C. Copy

| String | Where | Now |
|---|---|---|
| Goals › "How your advice works" | cut-support.js ~1648 | "Weight averages and repeated strength comparisons inform your review. Recommendations explain their evidence; nothing in your plan changes automatically." |
| Chart summary | cut-support.js ~1272 | "Dashed steps mark each week’s morning average." |
| Empty chart | cut-support.js ~1205 | "Choose Cut to see older entries, or log a current weight." |
| History block label | premium-ui.js `historyConditioningBlock` | "Cardio" (floorball rows stay inside it; `data-kind="conditioning"` unchanged) |

- AGENTS.md §6b lists "a label narrowed from Conditioning to Cardio while the block still held floorball rows" as a past review defect. This is the change the brief asked for, so I made it; please confirm it is the intended exception (floorball is off by D55 and the History filter that opens this block already says "Cardio").
- Performance intro "21-day window" / "Four sessions" (premium-ui.js `performanceIntro`, ~1975–1978): **left as is**. The windows are literals inside `strengthItems()` (cut-support.js 265–266: `-21`, `recent.length>=4`, `-56`) and are not exported (`NXT.coach.thresholds` is the coach's own set). Reading them needs an engine export; not done.
- "Import from Strata" untouched.

### D. History calendar semantics

`#vn-hist-grid` is now `role="group"` with the existing `aria-label` (month and year). Roving tabindex and the D59 key handling are untouched. Why not rows and cells: the cells are direct children of the CSS grid and strata.css styles them with `.nxp-cal-grid>.nxp-cal-day`; wrapping them needs `display:contents` shims in layers I may not touch, and `display:contents` on roles has a history of Safari accessibility bugs. A comment above `historyKey` says why. Accessibility tree: `grid "Oct 2026"` before, `group "Oct 2026"` after, 35 buttons unchanged.
- The coaching UI scripts and `verify-152.mjs` contain no calendar keyboard checks (searched for Arrow/Page/Home/tabindex/`historyKey`). I wrote one (`calkeys-check.mjs`) and ran it on both trees: ArrowRight/Left ±1, ArrowDown/Up ±7, Home/End to the week's Monday/Sunday, PageUp/PageDown a month with focus surviving the repaint, one tab stop, Tab leaves the grid: 9/9 on both, 0 page errors.

### E. Viewport meta and CSS layers (report only)

Unchanged: index.html line 5 still carries `maximum-scale=1.0,user-scalable=no`. For PLAN item 10 (pinch zoom): I audited every visible `input`, `select` and `textarea` at 390 px across Today, Train (idle and active), Progress (4 tabs), History, Settings (hub and every sub-page, with `<details>` opened, Evo scan form) and 12 sheets (weigh-in, cardio, day, name, review, routine, substitute, add exercise, note, edit set, waist, add-on picker): 45 visible controls plus those inside opened `<details>`, minimum computed font size 16 px, none under (`inputs-audit.mjs`). No CSS layer other than the appended block was touched.

## 3. Verification (real output)

```
node --check premium-ui.js strata.js cut-support.js coach.js        OK
index.html inline scripts (new Function, 9 bodies)                  9 parsed, 0 failures
for f in wearables*.test.js …                                       21 suites, 588 passed, 0 failed
   (586 baseline + 2 from the sw-strategy suite another agent extended: 23 → 25)
   release-gate 54/54, train-enrichment 34/34, plan-persistence 25/25, coach 48/48, sw-strategy 25/25
NXTFRM_BASE=http://localhost:8763 node tasks/vnext/verify-train-browser.mjs     OK  6 passed, 0 failed
shots.mjs http://localhost:8763 390,320 polish                      no page/console errors, no overflow
shots.mjs … 768,1280,375,430 polish-wide                            no page/console errors, no overflow
coach-ui verify-coach-ui [390][320][375][430]                       58/58 each
coach-ui verify-actions  [390][320][375][430]                       22/22 each
coach-ui verify-extra    [390][320]                                 13/13 each
coach-ui s-hold 390                                                 hold headline, target fill 30, errors []
verify-152 (scratch copy, system Chrome)                            33 / 33 passed
```

`flows.mjs http://localhost:8763 polish 390` **crashes at its last step on the unmodified tree too** (`NXP.routineEdit(0)` is called without `NXP.editRoutine(type)`, so `ui.routine` is undefined; the HEAD sweep `base-flows` stops at the same place). I ran a scratch copy with `NXP.editRoutine('FullA')` added before that call (`polish/flows-patched.mjs`): it completes, 29 files, and its only message, `logOne: no log button`, is identical on the before tree. Flow screenshots before vs after: every frame 0.000–0.002 % except the splash frames (launch animation timing) and `settings-goals` (25 px shorter: the shorter paragraph).

All Playwright checks are in `/Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/polish/` (logs `final-1..4.log`, before/after screenshots in `shots/`). They run against any base, so `node <check>.mjs http://localhost:8763` repeats them.

## 4. Orphaned CSS (left alone, for the design agent)

Classes whose last JS/markup producer left with this pass (computed as: present in the sources before, absent after, and still styled; `orphans.py`):

- **Today hero** (`heroTileHTML`, `drawHero`): `.st-hero`, `.st-hero-top`, `.st-hero-eb`, `.st-hero-meta`, `.st-hero-chart`, `.st-hero-foot`, `.st-big`, `.st-key`, `.st-key-line`, `.st-key-dot`, `.st-rate`, `.st-hc-act`, `.st-hc-area`, `.st-hc-cur`, `.st-hc-dot`, `.st-hc-end`, `.st-hc-line`, `.st-hc-start`, `.is-other`, `.is-start` (as `.st-pillg.is-start`; `.is-start-ref` is live), `.is-scrubbing` (5 selectors; one is `.is-scrubbing .st-wstep-t`, and `.st-wstep-t` has never been produced). Still live: `.st-hc-halo` (composition map), `.st-band`, `.st-pillg`, `.st-ax`, `.st-grid`, `.st-tip`, `.st-replay` (Progress chart).
- **Weekly average tile**: `.st-bars`, `.st-bar`, and `.st-pill` (+ `.is-up`, shared with the hero).
- **Last-5-weeks calendar tile**: `.st-cal`, `.st-cal-d` (+ `.is-fut`, `.is-w`), `.st-cal-h`, `.st-cal-k`, `.st-cal-m`, `.m-lift`, `.m-cardio`, `.m-w`.
- **`aimCell` / `linkSignal`**: `.nxp-aim-cell` (premium-ui.css ×6, vnext.css ×4), `.nxp-aim-top`, `.is-tappable` (premium-ui.css `.nxp-train-lift .nxp-aim-cell.is-tappable`), `.nxp-home-signal`.
- **Monday recap and its hide**: `.st-recap`, `.st-rc-stats`, `.st-rc-best`, `.co-rv-on` (the rule `.co-rv-on .st-recap{display:none !important}` in the coaching UI block).
- **`syncVs` and the count tick**: `.st-vs`, `.st-refs`, `.st-tr-count`, `.st-tick`.
- **First `dressWeeks` variant**: `.st-wk-c`, `.st-wk-d`, `.st-wk-v` (its siblings `.st-wk-trk/-rng/-avg/-link/-note/-key*` already have no rules).

Not mine, same family: `#nxp-progress-latest` is never rendered but premium-ui.js still has its `hookProgressSelect` branch and premium-ui.css still styles `.nxp-progress-latest`.

## 5. Left undone, and why

- **B7 mechanism as written** (padding equal to the bar height): not applied, it would add blank space; the visible defect was fixed another way (above).
- **Performance intro constants**: not exported by the engine (above).
- **Orphaned CSS**: yours to delete behind the pixel-diff guard (section 4); the appended block must survive any tool that rewrites strata.css, so re-check it is still the last block (`grep -n "Ascension · polish" strata.css`).
- Found, not changed (outside the listed scope): `const NS` in strata.js is unused (pre-existing); `bindStepBump`'s click selector still names `#trainPage .st-refc`, which no markup produces, so tapping the Aim tile or a target does not refit `data-len` (a 4 → 5 character change keeps the old numeral size until the next input); `dressWeeks` keeps its `const style = "ledger"` switch and its section `aria-label` still says "average and range" though the ledger shows only the average; `cue()` (cut-support.js ~718) still writes a suggestion row from the Train render path; index.html still raises a toast (`addEventListener("error")`) as well as the new notice for one uncaught error; `classic/premium-ui.js` still holds copies of everything removed (the frozen classic app).
- Not verifiable here: Safari/iOS (no WebKit, no simulator), a physical phone, the `contextmenu` long-press on a real Android device (simulated with a dispatched event).

## 6. Files created, changed or removed

Changed in the repo (all uncommitted): `/Users/alidanial/Documents/NXTFRM/premium-ui.js`, `strata.js`, `cut-support.js`, `index.html`, `strata.css`. Created in the repo: `/Users/alidanial/Documents/NXTFRM/tasks/ascension/polish-report.md`.

Disposable, under `/Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/`: `polish/` (check scripts, `final-*.log`, `shots/`), `shots/polish`, `shots/polish-flows`, `shots/polish-wide`, `shots/polishbase`, `shots/polishbase-flows`.

**A process of another project was stopped by mistake.** My before-snapshot server ran on port 8791 (bound to `::`). A different project's demo server was also listening there on IPv4, and when I stopped mine by port number, `lsof | head -1` returned that one: PID 28116, `node scripts/pmid-app.mjs --demo --port 8791`, the PMID throw-away demo (synthetic data, temp data root), working directory `/Users/alidanial/Documents/02_Projects/PIMD_Automation/02_Aspect_Reconciliation/Current/PMID_RECON_M6_PHASE1_S1`. It received SIGTERM and shut down cleanly (its handler calls `app.close()`); no file in that project was touched, and its demo data lived in a temp folder by design. I tried to restart it the same way; the permission check refused, and I did not work around it. To bring it back: `cd` to that directory and run `node scripts/pmid-app.mjs --demo --port 8791`. My own server on :8791 is stopped too; nothing of mine is left running (the dev server on :8763 was never touched).

Session scratch (not kept): the before-snapshot of the tree and its static server on :8791 (stopped), scratch copies of the coach-ui scripts and `verify-152.mjs` (so tracked result files and the coaching agent's screenshots are untouched), under `/private/tmp/claude-501/-Users-alidanial-Documents-NXTFRM/a6640d33-b77d-4880-ac02-9b5c0cbc01cf/scratchpad/`. One stray file I wrote by mistake (a mistyped path, `/private/tmp/claude-501/-Users-alidanial/Documents-NXTFRM/placeholder`) and its two empty directories were removed.
