# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`D12 — SHARED PRIMARY-BUTTON CONTRAST PATCH`

## Status

`READY FOR REVIEW` — implementation complete, Cursor-owned verification green. Rendered contrast, responsive, interaction and reduced-motion checks are Claude's (AGENTS.md §6). No browser was used.

---

## A. Cascade finding — `.btn.danger` background

The declaration that paints `RESET APP DATA` is **`index.html:2196–2198`**:

```css
.btn, .home-cta, .tab.active, .minimum-actions button.active,
.complete-actions button.primary, .zone2-actions button.primary {
  background: linear-gradient(135deg, #B794F6 0%, #8B5CF6 42%, #7DD3FC 100%) !important;
  box-shadow: 0 10px 30px rgba(139,92,246,.25) !important;
}
```

That is the winner, and it is a **shorthand**. A `background` shorthand set to a gradient writes `background-image` and resets every other longhand, including `background-color`, to its initial value. Initial `background-color` is `transparent`, which computes to `rgba(0,0,0,0)`. That is the measured background-color.

Why this beats `premium-ui.css` `.btn.danger { background: var(--nxt-danger-tint) }`, which loads later and is more specific (0,2,0 vs 0,1,0): cascade sorts **importance before specificity**. Both are author-origin. The inline rule is `!important`; the premium-ui rule was not. Importance wins, so the later, more specific tint never becomes the used value.

Why `color` still came from `premium-ui.css`: the `!important` rule does not set `color`. Among normal-importance `color` declarations, `.btn.danger { color: var(--nxt-danger) }` is the latest (0,2,0). `--nxt-danger` is `#f0768e` = `rgb(240,118,142)`, which matches the measured ink.

Why this is not `index.html:124`. That rule is `background: linear-gradient(135deg, var(--purple), var(--sky))` with no `!important` and specificity (0,1,0), so `.btn.danger` already outranks it. The variables that would have been used are the last `:root` definitions, `--purple:#b18aff` / `--sky:#aa7afa` (`rgb(177,138,255)` / `rgb(170,122,250)`). The measured stops `rgb(183,148,246)` and `rgb(139,92,246)` are the literals `#B794F6` and `#8B5CF6` in the `!important` gradient. `#f0768e` on `#B794F6` recomputes to **1.12:1**, the severe failure.

The same rule's `box-shadow: … !important` was also winning, so `box-shadow: none` on `.btn.danger` was not applied either. The control kept the affirmative glow.

`index.html` was not edited. Raising the shared `.btn` selector to `.btn:not(.danger)` would have lifted that `!important` from (0,1,0) to (0,2,0) and could have taken the cascade from other buttons. The counter is on `.btn.danger` only, in `premium-ui.css`, which loads after the inline style: same importance, higher specificity (0,2,0), so the restrained fill and `box-shadow: none` win. `background` as a shorthand also clears the gradient image, so `background-color` is no longer transparent.

---

## B. Primary token

Defined once on `:root` in `vnext.css`. `--vn-violet` is unchanged at `#8B5CF6`.

| Token | Value | Role |
|---|---|---|
| `--vn-action-lift` | `#7C3AED` | Lightest gradient stop. **5.70:1** vs `#fff` |
| `--vn-action` | `#6D28D9` | Darkest stop, and the disabled fill. **7.10:1** vs `#fff` |
| `--vn-action-ink` | `#fff` | Ink |
| `--vn-action-fill` | `linear-gradient(180deg, var(--vn-action-lift), var(--vn-action))` | Default fill |
| `--vn-action-shadow` | inset hairline + `rgba(109,40,217,.45)` drop | Same shape as before, tinted to the new stop |

The binding case is the lightest stop. `#7C3AED` is the closest measured pass to the current violet; `#6D28D9` is the dark stop. Both figures were recomputed here and match the task's table. Font size is untouched (16px where the rule set it).

### Consumers

All five sites now read the tokens. No site still carries the `#9B71F8 → var(--vn-violet)` literal.

| # | Selector |
|---|---|
| 1 | `#homePage .vn-act` |
| 2 | `#trainPage .vn-train-active .nxp-train-cta` |
| 3 | `#trainPage .vn-train-ready .n99-button` |
| 4 | `#trainPage .nxp-train-idle.vn-train .nxp-train-idle-actions .n99-button`, `… .nxp-session-tools .n99-button` |
| 5 | `#morePage .vn-set-act` |

`#morePage .vn-set-act.is-quiet` still overrides fill, ink and shadow afterwards (surface-2 / `--vn-ink`). Recomputed at rest: **14.19:1**. Left alone.

Secondary train buttons still override the primary fill with `--vn-surface-2` / `--vn-ink`.

### States

Computed against `#fff`, sRGB WCAG relative luminance. `filter: brightness()` multiplies channels; `opacity` is an element group composited over `#0E1014`.

| State | What applies | Lightest stop | Verdict |
|---|---|---|---|
| Default | `--vn-action-fill` | **5.70:1** (`#7C3AED`); dark stop 7.10:1 | Pass |
| Hover | No `:hover` rule in `vnext.css`, `premium-ui.css`, or on `.btn` in `index.html`. Hover computes as default | **5.70:1** | Pass |
| Pressed | Existing `:active` `filter: brightness(.94)` on `.vn-act`, `.nxp-train-cta`, `.vn-set-act`. Darkens both ink and fill; does not composite with the page | **5.48:1** lightest, 6.77:1 darkest | Pass |
| Focus | Existing outline only (`--vn-violet-lift` / `--vn-violet-line`). Fill and ink unchanged | **5.70:1** | Pass |
| Disabled, if left at opacity .42 | `.nxp .n99-button:disabled` is .42; train CTA's later rule is .45; `button:disabled` is .5. At .42, white on `#7C3AED` over canvas composites to **2.74:1** | Fail | — |
| Disabled, as shipped | One shared rule, tokens only, `opacity: 1`, solid `--vn-action` (`#6D28D9`), shadow and filter cleared. Quiet (`:not(.is-quiet)`) and `.secondary` are excluded | **7.10:1** | Pass |

The disabled rule covers the five consumers. `pointer-events: none` from the existing disabled rules still applies; this rule only replaces the opacity that was destroying contrast. A flat darker stop is the disabled cue, so a disabled primary does not keep the gradient highlight.

---

## C. Destructive treatment

`premium-ui.css` `.btn.danger` only. Class names, `onclick` handlers, the confirm, and `NXT.resetData()` are untouched. `index.html` markup was not edited.

| Property | Value | Contrast |
|---|---|---|
| Ink | `#DC5A76` (the measured concern; equals `--vn-concern`. `--nxt-danger` itself is unchanged) | — |
| Fill | `#0E1014` (canvas), `!important` so the gradient shorthand loses | **5.23:1** |
| Border | `1px` `#DC5A76` (the `.btn` border was already 1px, color was transparent) | — |
| Shadow | `none !important` | the affirmative glow loses |

White on a `#DC5A76` fill is 3.64:1 and was not used. A pink tint over the card was not used either: `#DC5A76` on an 8% tint of itself over `#1a1922` recomputes to **4.38:1**. An opaque canvas fill keeps the pair at the measured 5.23:1 on every parent (the card, the edit-set sheet, the cloud card).

### States

| State | Treatment | Contrast |
|---|---|---|
| Default | Ink and border `#DC5A76`, fill `#0E1014` | **5.23:1** |
| Hover | No `:hover` rule. Computes as default | **5.23:1** |
| Pressed | `.btn:active` still scales the control. Its `filter: brightness(.92)` would leave this pair at **4.55:1** — inside AA, with no margin. `.btn.danger:active { filter: none }` clears it (specificity 0,3,0 vs 0,2,0), so pressed stays **5.23:1** | Pass |
| Focus | Text, fill and border unchanged. On `#morePage` the existing violet focus outline still wins (an id beats `.btn.danger:focus-visible`) and does not recolor the label | **5.23:1** |
| Disabled | `.btn:disabled` opacity .42 would composite this pair to **~1.83:1**. `.btn.danger:disabled` sets `opacity: 1` and keeps the same ink and fill. The border drops to `rgba(220,90,118,.5)` as the disabled cue. `pointer-events: none` and `cursor: not-allowed` still come from the existing rules | **5.23:1** |

### Other `.btn.danger` consumers

Same class, so they inherit this treatment. Handlers were not opened:

| Control | Where | Handler |
|---|---|---|
| RESET APP DATA | `index.html` App & install | confirm, then `localStorage.clear()` |
| SIGN OUT | `cloudCardHTML()` | `cloudSignOut()` |
| DELETE SET | edit-set sheet | `deleteLoggedSet()` |
| DELETE ENTRY | edit weigh-in sheet | `apx95DeleteWeight()` |
| RESET | legacy `renderMore()` card | confirm, then `localStorage.clear()` |

---

## D. Left alone

- `--vn-violet` and every non-button use of it (active tab, selected date, focus ring, focal surface)
- `.vn-set-act.is-quiet` (14.19:1 at rest)
- `backfillAllCoachInsights()` — D13
- `RELEASE` / `CACHE_NAME` — still `109` / `nxtfrm-v109-premium-cache`. No new asset, so `sw.js` was not edited
- `cut-support.js`, `premium-ui.js`, `index.html`, wearables, seed, train-anatomy

---

## E. Verification

No JavaScript was changed, so `node --check` does not apply.

Brace balance (raw, and again with comments stripped):

| File | Raw | Comments stripped |
|---|---|---|
| `vnext.css` | 502 / 502 | 500 / 500 |
| `premium-ui.css` | 816 / 816 | 815 / 815 |

Sixteen suites, enumerated `wearables*.test.js` so `wearables.test.js` is included:

```
16 suites / 458 tests / 0 failing
```

| Suite | Result |
|---|---|
| wearables.adapters.test.js | 32 passed |
| wearables.canonical.test.js | 24 passed |
| wearables.days.test.js | 16 passed |
| wearables.ingest.test.js | 32 passed |
| wearables.provider-garmin.test.js | 3 passed |
| wearables.recovery-integration.test.js | 32 passed |
| wearables.recovery.test.js | 28 passed |
| wearables.release-gate.test.js | 53 passed |
| wearables.resolution.test.js | 19 passed |
| wearables.snapshots.test.js | 26 passed |
| wearables.store.test.js | 34 passed |
| wearables.sync.test.js | 47 passed |
| wearables.test.js | 18 passed |
| wearables.train-enrichment.test.js | 34 passed |
| wearables.training-readiness.test.js | 29 passed |
| wearables.weight-contract.test.js | 31 passed |

Not committed. Not pushed.

---

## F. For Claude to measure

Rendered contrast at 390px, on the lightest gradient stop, for default, hover, pressed, focus and disabled:

- Today `.vn-act`
- Train `.nxp-train-cta`, ready `.n99-button`, idle primary `.n99-button`
- Settings `.vn-set-act` (Save appearance, Export app backup)
- Settings `.vn-set-act.is-quiet` still at its previous pair
- `RESET APP DATA`, plus Sign out and Delete set, including a disabled `.btn.danger` if one can be reached

Disabled primary should be solid `#6D28D9` at opacity 1, not the gradient at opacity .42. Destructive fill should be `#0E1014` with `#DC5A76` ink, and `background-image` should be `none`.
