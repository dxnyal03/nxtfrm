# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

Overwrite this file each slice. Keep it factual: Claude reviews the actual git diff regardless, and a report that overstates completeness costs a review round.

---

## Slice

`VNext Phase 2B — Train: active workout mode` — **fix round for CLAUDE_REVIEW required items 1a + 1b only**

## Status

`READY FOR REVIEW`

---

## A. Files changed

| File | Added / Modified | What changed |
|---|---|---|
| `premium-ui.js` | Modified | **1a:** `syncTrainNav` hides `#cloudLocalBanner` while mode is engaged and restores via `updateCloudLocalBanner` on leave; wrap of `updateCloudLocalBanner` so post-`render` D11 updates cannot re-show mid-set. **1b:** rest strip markup is a single row (timer · rail · +30s · Skip); set history moved below Log Set so row growth cannot push the CTA. |
| `vnext.css` | Modified | **1a:** CSS belt-and-suspenders hide banner + undo banner-driven content inset while `.tabs.vn-recede`. **1b:** compact horizontal rest strip (15px timer); set-history margin adjusted for below-CTA placement. |
| `tasks/vnext/verify-2b.mjs` | Unchanged this round | Re-run green |
| `tasks/vnext/verify-2b-results.json` | Modified | Fresh evidence dump |
| `tasks/vnext/verify-2b-fold.mjs` | Added | Fold table 0/1/2 × 390/320 + banner restore matrix |
| `tasks/vnext/verify-2b-fold-results.json` | Added | Fold/banner numbers |
| `tasks/vnext/shots/train-*.png` | Modified | Re-shot from verify-2b |
| `tasks/vnext/CURSOR_REPORT.md` | Modified | This report |

No edits to `cut-support.js` (D11 targeting untouched), wearables engines, `train-anatomy.js`, `sw.js` RELEASE/CACHE, Supabase, or unrelated untracked trees.

---

## B. Behaviour implemented (this fix)

### 1a — Banner suppressed in active workout mode (D6 chrome)

- While `.tabs.vn-recede` is on, the cloud/local banner is forced `hidden` (and CSS `display:none` + zero content `padding-top`).
- On leave and on finish, `syncTrainNav(false)` / non-receded paint restores via the existing `updateCloudLocalBanner` D11 path — **no change to when the banner is warranted**.
- Verified: hidden in active mode; visible again after leave and after finish; visible on Today / Progress / History / More / Train idle when D11 says show.

### 1b — Rest strip + set history no longer push Log Set past the fold

- Rest strip: one 44px-tall instrument row; timer figure 15px (calmer, cheaper).
- Set history: still fully visible and editable; placed **below** Log Set (before Prev/Queue/Next) so 1→2 logged sets do not move the CTA.
- Touch targets stay ≥44pt; type scale not dropped below the design system.

### Fold table (Log Set bottom edge vs 844)

| Sets logged | 390px | 320px |
|---|---|---|
| 0 | **678** ok | **753** ok |
| 1 | **750** ok | **825** ok |
| 2 | **750** ok | **825** ok |

(1 and 2 match because history sits below the CTA; rest strip height measured 44px when active.) Source: `tasks/vnext/verify-2b-fold-results.json`.

---

## C. Architecture / state wiring

- Presentation only. D11 conditions in `updateCloudLocalBanner` unchanged; mode gate is a wrapper + `syncTrainNav` + CSS.
- Input ids unchanged. Rest timer still updated by `paintRest` / `#apx96TimerValue` / `.nxp-rest-rail` without full repaint.
- No calculation, storage key, record shape, or training-semantic changes.

---

## D. Tests performed

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Contrast ≥4.5:1 — lifting-idle, lifting-active, mid, resting, Rest, Zone2, Floorball × 390/375/320 | PASS | `verify-2b-results.json` `textFailCount:0`; idle audited separately |
| 2 | Touch targets ≥44pt — same matrix | PASS | `targetFailCount:0` |
| 3 | No horizontal overflow — same matrix | PASS | `overflow:false` |
| 4 | Fold table 0/1/2 @390 and 320 | PASS | table above; all ≤844 including 320×2 |
| 5 | Banner hidden in active; restored leave/finish; correct on other surfaces | PASS | `verify-2b-fold-results.json` → `banner` |
| 6 | Input contract + simulated log | PASS | types + record ok |
| 7 | Draft survival | PASS | `77.5` |
| 8 | Rest tick without full repaint | PASS | probe survived; +30s worked |
| 9 | Add-on dayType safety | PASS | Rest→Rest |
| 10 | Nav recede/restore | PASS | |
| 11 | Other four tabs | PASS | no console errors |
| 12 | `node wearables.release-gate.test.js` | PASS | **53 passed, 0 failed** |

---

## E. Responsive verification

| Width | Idle | Active | Mid | Resting | Rest | Zone2 | Floorball |
|---|---|---|---|---|---|---|---|
| 390 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 375 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 320 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

---

## F. Known deviations

| Item | Note |
|---|---|
| Set history position | Below Log Set (was above). Required for fold; history + Edit survive. |
| Rest strip layout | Single horizontal row vs stacked column; controls unchanged. |
| Coach / set-dots / Session tools / etc. | Unchanged demotions from the original 2B pass. |

---

## G. Open questions / risks

1. Original open question about long set-history pushing Log Set is addressed by placing history below the CTA.
2. Shipping still needs the normal cache-bust / RELEASE path (out of scope).

---

## H. Stop

Working tree ready for Claude design/UX review of **1a + 1b only**. **No commit. No push.**
