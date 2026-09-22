# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

Overwrite this file each slice. Keep it factual: Claude reviews the actual git diff regardless, and a report that overstates completeness costs a review round.

---

## Slice

`D11 — cloud/local banner targeting` + root `.gitignore` for `.playwright-mcp/`

## Status

`READY FOR REVIEW`

---

## A. Files changed

| File | Added / Modified | What changed |
|---|---|---|
| `cut-support.js` | Modified | **Only** `updateCloudLocalBanner` / `dismissCloudLocalBanner` (was ~1553–1560). Replaced in-memory `cloudBannerDismissed` with D11 targeting (A sync fail / B cloud configured + signed out / C unsynced local data) and persistent dismiss under `nxtfrm_cloud_banner_dismissed`. |
| `.gitignore` | Added | Single entry: `.playwright-mcp/` |
| `tasks/vnext/CURSOR_REPORT.md` | Modified | This report. |
| `tasks/vnext/verify-d11-results.json` | Added | Playwright evidence for banner cases A/B/C + tab smoke. |

No other production files touched this pass (including no other regions of `cut-support.js`).

---

## B. Behaviour implemented

### CHANGE 1 — D11 banner targeting

Show `#cloudLocalBanner` only when `cloudSessionChecked` **and** one of:

- **A** `lastCloudError` set (actionable; not suppressible by dismiss)
- **B** both `apm_sb_url` and `apm_sb_key` present **and** signed out (`!cloudUser && !hasStoredSbAuthToken()`) (actionable; not suppressible)
- **C** signed out, `state.logs` or `state.bws` non-empty, `!lastCloudSyncAt`, and dismiss key not set (informational; dismissible)

Dismiss writes `localStorage['nxtfrm_cloud_banner_dismissed']='1'` (try/catch). Reads likewise. Key uses `nxtfrm_` deliberately so it stays off the `apm_*` backup/restore surface.

Kept: existing markup, Log in / Dismiss buttons, `openCloudLoginFromBanner`, session-checked gating (no flash before session known).

### CHANGE 2 — `.gitignore`

Ignores only `.playwright-mcp/`. Does **not** ignore `design-v102/`, `design-v103/`, `design-vnext/`, `tasks/`, or `.claude/`.

---

## C. Architecture / state wiring

- No fitness calculation, trend, plateau, forecast, or fitness-data storage logic changed.
- No `apm_*` keys, `persist()`, Safe Sync, schema, or `NXT` API surface changes.
- Dismiss persistence is a new **non-`apm_`** preference key only.
- Case C is gated with signed-out so a signed-in first-sync (`lastCloudSyncAt` still null) does not surface the local-only banner.

---

## D. Tests performed

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Case C: local, signed out, cloud not configured, data present → banner shows | PASS | Playwright MCP |
| 2 | Case C: Dismiss → hidden; key=`1`; **reload** → stays hidden | PASS | Playwright MCP |
| 3 | Case B: cloud configured + signed out → shows **even if previously dismissed** | PASS | Playwright MCP |
| 4 | Case A: `lastCloudError` → shows despite dismiss | PASS | Playwright MCP (extra check) |
| 5 | Today contrast ≥4.5:1 @ 390/375/320 × lift/rest | PASS | `verify-2a.mjs` → 0 `textFails` |
| 6 | Today targets ≥44pt | PASS | 0 `targetFails` |
| 7 | No horizontal overflow @ 390/375/320 | PASS | `scrollWidth === clientWidth` all six |
| 8 | Train / Progress / History / More / Today — no console errors | PASS | D11 run + verify-2a `otherTabs` |
| 9 | `node wearables.release-gate.test.js` | **53 passed, 0 failed** | CLI |

Test file paths:

- `tasks/vnext/verify-d11-results.json`
- `tasks/vnext/verify-2a.mjs` / `tasks/vnext/verify-2a-results.json`
- `wearables.release-gate.test.js`

Verification note: the page still requests `cut-support.js?v=109`. Browser HTTP cache can retain the pre-D11 script. Playwright checks used a no-store fulfill for `cut-support.js*` so the live file was exercised. **Shipping this change to real clients still needs the existing cache-bust / RELEASE path** (not done in this pass — out of authorised file list).

---

## E. Responsive verification

| Width | Today · lifting | Today · rest | Notes |
|---|---|---|---|
| 390 | PASS | PASS | Contrast / targets / overflow |
| 375 | PASS | PASS | Same |
| 320 | PASS | PASS | Same |

Screenshots refreshed by verify-2a under `tasks/vnext/shots/`.

---

## F. Known deviations

| Item | Note |
|---|---|
| Cache-bust | `index.html` still loads `cut-support.js?v=109`. Content changed; version query / SW RELEASE not bumped (not authorised this pass). Reviewer should decide whether this rides the next release bump. |
| Prior Today deviations (Q2, demoted rows, etc.) | Unchanged; not re-opened. |
| Cloud/local banner vs I10 | **Resolved by D11** for healthy local+dismissed and healthy signed-in operation; actionable A/B still surface. |

---

## G. Git status (this pass focus)

```
 M cut-support.js          # D11 banner functions only
?? .gitignore              # .playwright-mcp/
 M tasks/vnext/CURSOR_REPORT.md
?? tasks/vnext/verify-d11-results.json
(+ prior Phase 2A / unrelated untracked still in tree — not touched this pass)
```

**Nothing committed.** No push.

---

## H. Questions / blockers

1. Should the next release bump `cut-support.js?v=` (and SW shell if required) so installed PWAs pick up D11 without a hard cache clear?
