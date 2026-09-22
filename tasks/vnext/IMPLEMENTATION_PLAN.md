# NXTFRM VNext — Implementation Plan

Sequencing only. The authoritative task at any moment is `CURRENT_TASK.md`.

## Principle

**Presentation first, semantics never.** Each slice replaces how a screen looks and feels while continuing to read the same engine values through the same functions. No slice may change a calculation, a storage key, a record shape, or what a number means.

## Architecture seam (why this is safe)

Three layers, in load order:

| Layer | File | Role |
|---|---|---|
| Engine | `cut-support.js` (`NXT`) | Trend, plateau, forecast, strength, sessions, backup. **The truth.** |
| Presentation | `premium-ui.js` (`NXP`) | The UI on screen today |
| Legacy | `index.html` inline | Older renderers, largely superseded |

`premium-ui.js:1244` reassigns the legacy globals:

```js
renderHome=NXP.home; renderTrain=NXP.training; renderWeight=NXP.progress;
renderMore=NXP.more; renderHistory=NXP.history;
```

`render()` (`index.html:2919`) calls `renderHome()` / `renderTrain()` / … by name. **That reassignment line is the migration seam.** A slice swaps one screen's renderer and touches nothing else.

## Slices

| Slice | Scope | Gate |
|---|---|---|
| **2A** | VNext visual foundation · navigation + page-transition foundation · Today lifting · Today rest · responsive 390/375/320 · reduced motion | ✅ committed `9fd3772` |
| **2B** | Train: active workout mode, set logging, rest, queue, completion recap | ✅ committed `761f339` |
| **2C** | Progress → Weight: recent trajectory chart (D2), Journey rail (D3), scrub, ranges | ✅ committed `6563be6` |
| **2D** | History: calendar-first, selected-date detail | ✅ committed `eb713de` |
| **2E** | Settings / More: calm configuration rows | ✅ committed `1499653` |
| **D12** | Shared primary-button + destructive contrast patch | ✅ committed `0f54aa6` |
| **2F** | EvoScan flagship: OCR reliability + body-composition workspace | ✅ committed `ba33fa8` |
| **2G** | Progress → Performance | ← **current** |

| 2H | AI surfaces (Why / Ask / proposal sheets) | 2G approved |

## Separately audited, never inside a feature slice

| Slice | Scope | Gate |
|---|---|---|
| X1 | `readiness()` removal | D4 — reference audit must prove it unused |
| X2 | Legacy renderer removal from `index.html` | D5 — separate audit |
| X3 | Supabase / schema / RLS | Owner approval, not yet requested |

## Integration checkpoints

After a group of slices lands, an integration checkpoint reviews them **together** rather than opening the next feature. No new features during a checkpoint. It answers one question: *do these experiences feel like one product?* Checkpoint findings go in `CLAUDE_REVIEW.md` and gate the next slice.

| Checkpoint | Covers | Gate |
|---|---|---|
| **INT-1** | Today · Train · Progress/Weight · History | ✅ passed, committed `2cc4a5c` |

## Working rules

1. **One slice in flight at a time.**
2. **Concurrency:** during Cursor implementation Claude is read-only; during Claude review Cursor pauses edits.
3. **Cursor commits only after Claude's final review records APPROVED.**
4. Cursor reports in `CURSOR_REPORT.md`; Claude reviews the **actual git diff**, never the report alone.
5. Anything not listed in the current task's scope is out of scope, including improvements Cursor believes are obvious.
