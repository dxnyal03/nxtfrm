# CURRENT TASK — PROGRESS → BODY ANALYTICAL INTEGRATION

**Owner:** Cursor (implementation) · **Reviewer:** Claude (audit, measurement, browser QA)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (D9, D14–D17 binding) · `design-vnext/DESIGN-BRIEF.md` §S · `.claude/skills/nxtfrm-data-viz/SKILL.md`
**Previous:** 2F `ba33fa8` · 2G `b137e64` · INT-2 `08e56bd`

---

## 1. Objective

Make Body Intelligence **properly reachable from Progress**, and remove the stale scan-entry
path — **without changing the 2F data or OCR contract**.

The design brief §S is the direction:

> *Body gets analytical presence under Progress → Body while capture stays under Settings.*

So the split is:

| Surface | Owns |
|---|---|
| **Progress → Body** | the **analysis** — composition, per-metric trends, what changed, scan history and scan detail, waist |
| **Settings → Body & scans** | the **capture** — new scan, OCR review and correction, manual entry |

Today, Progress → Body ends in a dead-end link (`NXT.more('body')`, labelled *Open scans*)
that throws the user into Settings to look at their own data. That is the stale path to remove.

---

## 2. Current state — the baseline nothing may lose

Rendered by `NXP.progress()` (`premium-ui.js:934`), the V100 path. `N.bodyHTML()`
(`cut-support.js:1106`) still exists for the legacy renderer and is **not** what the live screen
uses.

**Handlers (6):** `NXT.setView('overview')` · `NXT.setView('strength')` · `NXT.setView('body')`
· `NXT.openWaist()` · `NXT.more('body')` ← **the stale one** · `apx95OpenQuickWeight()`

**Capabilities:** waist logging (`NXT.openWaist`, `saveWaist`, `deleteWaist`), the full waist
reading list with per-row edit, the Evo scans section, and the copy that scale weight lives on
the Weight tab and nothing here is estimated.

0 surfaces, 0 page errors.

---

## 3. Required work

### 3.1 Bring the analysis to Progress → Body

Surface the EvoScan **analysis** here: latest scan, the supported metrics with change vs the
previous scan, the composition visual, per-metric trends, What Changed, scan history, and scan
detail.

**Do not duplicate the rendering logic.** 2F built these pieces once. Reuse them — extract or
share the existing helpers rather than writing a second implementation that will drift. Two
renderers for the same data is exactly the "duplicate render ownership" INT-2 checked for.

### 3.2 Remove the stale path, honestly

`NXT.more('body')` as *Open scans* must go from this screen. But **capture must stay reachable**
— from Progress → Body the user should be able to get to "add a scan", and that action belongs
to Settings' capture flow. A single clear entry is fine; a dead-end tour is not.

Removing a reachable capability without a replacement is silent feature loss. Removing a
**redundant navigation hop** while keeping the capability is the goal.

### 3.3 Waist stays here

Waist is a Progress → Body capability today and remains one. `openWaist` / `saveWaist` /
`deleteWaist`, the reading list and per-row edit all survive unchanged.

### 3.4 The 2F contract is frozen

**Do not change:** the OCR pipeline or any stage of the D16 contract · `NOT FOUND` versus
`CHECK` · confidence derivation · validation · provenance (`OCR_EXTRACTED` / `USER_CORRECTED`
/ `MANUAL_ENTRY`) · the `apm_evo_scans` key · the scan record shape · `weighInId` linking ·
delete semantics · `cleanRows` and D14.

This slice is **presentation and navigation only**. If it appears to need a data change, stop
and report instead.

### 3.5 Honesty rules carry over

`MEASURED` and `ESTIMATED` stay visually distinct. Per-metric trends on **separate scales**,
never one multi-scale chart. No radar, no Body Score, no invented composite (D9). The EvoScan
series stays clearly distinct from the Morning body-weight trend (D15), and nothing here may
imply a scan weight is the canonical morning weight (D14).

### 3.6 Empty states

No scans and no waist · scans but no waist · waist but no scans · exactly one scan (nothing to
compare against).

---

## 4. Files

| File | Permitted |
|---|---|
| `premium-ui.js` | yes — the Progress `body` view and shared scan-analysis helpers |
| `vnext.css` | yes — `#weightPage` Body section, following the scoping contract |
| `index.html` | **only** if a 2F scan-analysis helper must be shared rather than duplicated, and only to export or relocate it **without changing its behaviour**. Say so in the report. |

**Do not edit:** `cut-support.js` · `sw.js` · `manifest.webmanifest` · `wearables.*` ·
`seed.*` · `train-anatomy.js`. **`RELEASE`/`CACHE_NAME` stay at `109`.**

Use the shared `--vn-action` token (D12) and the corrected `--vn-ink-4` (INT-2).

## 5. Responsive

**390 · 393 · 402 · 430 · 375 · 320.** Zero overflow, targets ≥44pt, charts legible at 320,
contrast ≥4.5:1 for normal text, reduced motion clean.

## 6. Tests

Add `tasks/vnext/verify-2h.mjs`. **Synthetic fixtures only — never a real scan image.**

Note the seed carries **zero scans and no waist readings**, so the populated state must be
driven by injected fixtures or it will never be exercised — the same trap 2F and 2G hit.

Cover: every baseline capability still reachable · the stale `NXT.more('body')` dead-end is
gone while capture remains reachable · the analysis renders from the same data as Settings with
**no second source of truth** · waist logging, listing and per-row edit intact · per-metric
separate scales · `MEASURED`/`ESTIMATED` distinction · a scan weight is never presented as the
canonical morning weight · all four empty states · no writes to `state.scans`, `state.bws` or
the waist store while viewing.

Run **all sixteen** suites plus **every** existing verify script (`2a` … `2g`) — INT-2 proved a
slice can break an earlier slice's assertions. Baseline **16 / 458 / 0 failing**, all verify
scripts green.

## 7. Definition of done

- [ ] Progress → Body carries the analysis, not a link to somewhere else
- [ ] No duplicated rendering logic; one source of truth for scan analysis
- [ ] The stale `NXT.more('body')` *Open scans* dead-end is gone, capture still reachable
- [ ] Waist logging, list and per-row edit unchanged
- [ ] 2F data/OCR contract untouched; `cleanRows`/D14 untouched
- [ ] MEASURED vs ESTIMATED distinct; separate scales; no composite metric
- [ ] Scan weight never implied to be the canonical morning weight
- [ ] All four empty states designed
- [ ] 390/393/402/430/375/320 clean; ≥44pt; contrast; reduced motion
- [ ] All 16 suites and all verify scripts green
- [ ] `CURSOR_REPORT.md` updated (A–H)
- [ ] **Do not commit. Do not push.**
