# CLAUDE REVIEW

## Slice

`VNEXT PHASE 2A: FOUNDATION + TODAY` — final (rounds 1–3)

## Verdict

**APPROVED — ready for the owner's commit decision.**

Round 1 raised two required fixes; round 2 resolved both; round 3 cleared one further copy defect I found on re-inspection. All re-verified by me below. Round 1's findings are kept beneath for the record.

### Round 2 — required fixes, re-verified by Claude
- **Fix 1 (offline shell)** — `'vnext.css'` added to `VERSIONED` in `sw.js`; `index.html` requests `vnext.css?v=109`. `RELEASE` and `CACHE_NAME` untouched, as instructed. **`node wearables.release-gate.test.js` → 53 passed, 0 failed.**
- **Fix 2 (Performance copy)** — row now reads *"20 lifts · last logged 14 Jul · Older history"*. Contradiction gone, and the row is more informative than before. Status word remains engine vocabulary (I12).
- Polish applied: last-lift spacing, and a comment pinning `Older history`/`Building` to `is-neutral`.

### Round 3 — defect I found on re-inspection
The add-on subtitle interpolated `N.label(state.dayType)`, so a Zone 2 day rendered *"today stays a Easy cardio day"* — ungrammatical, and visible three days a week under the default plan. Now reads *"Kept as an add-on — today's plan is unchanged"*, which is correct for every add-on-eligible type (Rest, Zone2, Cardio) and still makes the point that the day is not reclassified. Verified on both Zone2 and Rest.

### Final acceptance — all re-run by Claude after the last change
| Check | Result |
|---|---|
| Contrast ≥4.5:1 — both states, 390/375/320 | **0 failures** |
| Touch targets ≥44pt — both states, 390/375/320 | **0 under 44pt** |
| Horizontal overflow | **none**, all six combinations |
| Surfaces on Today (D1) | **exactly 1**, all six combinations |
| Chart on Today (I9) | **0** |
| Week strip visible, not in a `<details>` | **yes** |
| Reduced motion | animation `none`, renders, tabs switch |
| Normal motion | `vn-route-enter 0.28s cubic-bezier(.32,.72,0,1)` |
| Other four tabs | render, **0 `vn-*` leak**, 0 page errors |
| Release gate | **53 passed, 0 failed** |
| Working tree | nothing committed; `HEAD` still `6bfe084` |

### Housekeeping for the next slice
`.playwright-mcp/` appeared as an untracked tool-cache directory from Cursor's verification run. Harmless and uncommitted, but it should be gitignored or removed before any commit so it does not get swept in.

## Scope check

Clean. `index.html` (+1 line), `premium-ui.js` (`NXP.home()` only), `vnext.css`, plus task-local files under `tasks/vnext/`.

`wearables.release-gate.test.js` was also modified, which §3 nominally forbade. **Reviewed and accepted:** the gate asserts on Today's markup, so it is legitimately coupled to this slice. The change preserves the original intent ("the week is visible, not behind a closed disclosure") and accepts the new always-visible strip *or* the legacy disclosure. I independently confirmed `.vn-week` is rendered, visible, and **not** inside a `<details>` — so the assertion is honest, not weakened. §3 has been amended to carve this out.

No commit, no push. `HEAD` unchanged at `6bfe084`. Unrelated untracked work untouched.

## APPROVED

Verified by me, independently of the report:

- **The INSTRUMENT rule holds.** Exactly **one** `.vn-surface` on Today at 390/375/320, both states. Everything else sits on the canvas with hairlines and spacing. This is the thing that had to be right.
- **Accessibility passes my own audit, not just Cursor's** — 0 contrast failures and 0 sub-44pt targets at all three widths in both states.
- **No horizontal overflow** at 390/375/320, both states.
- **No chart on Today** (I9). **Exactly one surface** (D1).
- **Rest state genuinely adapts**: no gym control, no lifting CTA, no stale lifting figures, morning-weight row reflecting the displayed day, next-session line.
- **Add-on semantics correct** — routes through production `addOnEligible()`/`addOnPick()`, and the copy states the day stays a Rest day. `resolveDayType`, `sessionPlans`/`addOns` separation untouched.
- **Q2 respected.** The decision surface renders `N.review().title` + `message`/`reason`, not the prototype's invented verdict vocabulary. Correct restraint.
- **Demotions declared and still reachable** — recovery, calorie guide and adherence all live under *More for today* with their original entry points. No silent feature loss.
- **Motion is exactly spec**: `vn-route-enter`, `0.28s`, `cubic-bezier(.32,.72,0,1)`. Under `prefers-reduced-motion` the animation is `none` and tab switching still works.
- **No regression in the four untouched tabs.** All render, **zero `vn-*` leakage outside `#homePage`**, unchanged transparent backgrounds, no page errors. Progress is pixel-consistent with my Phase 1 baseline.
- Render input lock, engine, state and storage untouched.

## REQUIRED FIXES

| # | File | Issue | Required outcome |
|---|---|---|---|
| 1 | `index.html`, `sw.js` | `vnext.css` is linked as `?v=110` while `sw.js` `RELEASE = '109'`, so it is absent from the offline shell. Release gate fails (**52 passed, 1 failed** — "the service-worker shell matches what the page requests"), and a cold offline start would render the app unstyled. | Add `'vnext.css'` to the `VERSIONED` array in `sw.js`, and change the `index.html` link to `vnext.css?v=109` so it matches the current `RELEASE`. **Do not bump `RELEASE` or `CACHE_NAME`** — that is a release action, not part of this slice. Then `node wearables.release-gate.test.js` must report 53 passed, 0 failed. |
| 2 | `premium-ui.js` (Today, Performance row) | Copy contradiction. The row subtitle is hardcoded `"${lifts.length} lifts with recent history"` while the status word can be `Older history` — the row currently reads *"20 lifts with recent history · Older history"*. On seeded data this is the default state, so it is visible, not an edge case. | Make the subtitle agree with the status: when `perfLabel === 'Older history'`, the subtitle must not claim recency (e.g. *"N lifts · last logged <date>"* or *"No recent comparable sessions"*). Keep engine vocabulary for the status word (I12). |

**Authorisation for fix 1:** `sw.js` was listed as do-not-edit in §3 because I did not anticipate the slice adding a stylesheet. Registering a new asset at the existing `RELEASE` is mechanical and carries no product decision, so I am authorising that edit and have amended §3. It does not extend to any other `sw.js` change.

## POLISH

Non-blocking; apply if cheap, otherwise defer and say so.

- The last-lift line sits tight under the primary action on the lifting state. A little more separation would let the CTA breathe.
- `perfTone` maps `Older history` to `is-neutral`, which is right. Worth a one-line comment so a later edit does not promote it to `is-ok`.

## REGRESSION RISKS

Each checked, each clear:

- **Engine / calculations** — `cut-support.js` untouched; Today reads the same functions.
- **State / storage** — no key, shape or `persist()` change.
- **Render input lock** — the transition is pure CSS on `.content`; nothing defers `render()` or repaints on focus.
- **`template()` vs `templateFor()`** — not conflated; Today uses `template()` as before.
- **`addOns` vs `sessionPlans`** — separation intact; add-on entry point unchanged.
- **Other four tabs** — verified rendering, zero `vn-*` leak, no errors.
- **Offline shell** — currently broken; that is required fix 1.

## OPEN — owner decision, not a fix for Cursor

**Cloud/local banner vs invariant I10.** I10 says sync state should be absent in normal operation, and the banner currently shows on every open when signed out. But its message is a **data-loss warning** ("iOS may wipe it"), which is arguably a real problem rather than routine sync chatter. I am **not** instructing Cursor to suppress it — silently hiding a data-safety warning is a product decision, not styling. Flagged for the owner.

## VERIFICATION RUN BY CLAUDE

Independent of `CURSOR_REPORT.md`, using my own Playwright scripts and my own Chromium:

- Contrast audit — computed against actual rendered backgrounds, `#homePage`, both states, 390/375/320 → **0 failures**
- Touch-target audit — every `button/a/summary/[tabindex]`, both states, three widths → **0 under 44pt**
- Overflow — `scrollWidth === clientWidth` → **pass**, all six combinations
- Surface count → **1**, all six combinations
- Week strip → rendered, visible, not inside a `<details>`
- Chart count on Today → **0**
- Four other tabs → render, 0 `vn-*` leak, 0 page errors; Progress visually matches Phase 1 baseline
- Reduced motion → `animationName: none`, Today renders, tab switching works
- `node wearables.release-gate.test.js` → **52 passed, 1 failed** (the SW shell gate)

## NEXT ACTION

Cursor: resolve required fixes 1 and 2 only. Re-run `node wearables.release-gate.test.js` (must be 53/0) and the 390/375/320 acceptance checks. Update `CURSOR_REPORT.md`. Do not commit.

---

## History

| Date | Slice | Verdict | Rounds |
|---|---|---|---|
| 2026-09-22 | 2A Foundation + Today | **APPROVED** | 3 |
