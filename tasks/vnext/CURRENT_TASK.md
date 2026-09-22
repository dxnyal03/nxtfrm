# CURRENT TASK — D12: SHARED PRIMARY-BUTTON CONTRAST PATCH

**Owner:** Cursor (implementation) · **Reviewer:** Claude (measurement + acceptance)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (D12 is binding) · `tasks/vnext/CLAUDE_REVIEW.md` §F
**Previous:** 2A `9fd3772` · 2B `761f339` · 2C `6563be6` · 2D `eb713de` · INT-1 `2cc4a5c` · 2E `1499653`

---

## 1. Objective

Fix the shared VNext primary-action contrast **once, at the token**, so every screen
inherits the fix. Then fix the destructive-action treatment, which is a separate and
more severe defect.

This is a **narrow accessibility patch**. It is not a redesign. Nothing else changes.

---

## 2. Measured evidence — this is rendered truth, not inference

All figures below are computed from `getComputedStyle` on the live page, averaging
gradient stops, at 390px.

### 2.1 The shared primary treatment

Five sites in `vnext.css` carry the **identical** declaration:

```css
background:linear-gradient(180deg,#9B71F8,var(--vn-violet));
color:#fff;
box-shadow:0 1px 0 rgba(255,255,255,.15) inset, 0 6px 16px -10px rgba(139,92,246,.45);
```

| # | Line | Selector | Screen |
|---|---|---|---|
| 1 | ~260 | `#homePage .vn-act` | Today primary CTA |
| 2 | ~627 | `#trainPage .vn-train-active .nxp-train-cta` | Train active CTA |
| 3 | ~687 | `#trainPage .vn-train-ready .n99-button` | Train ready |
| 4 | ~724 | `#trainPage .nxp-train-idle.vn-train .nxp-train-idle-actions .n99-button`, `… .nxp-session-tools .n99-button` | Train idle |
| 5 | ~1571 | `#morePage .vn-set-act` | Settings (Save appearance, Export app backup) |

White text against that gradient:

| Stop | Contrast vs `#fff` | Verdict |
|---|---|---|
| `#9B71F8` (lightest — the worst case) | **3.44:1** | FAIL |
| `#8B5CF6` (`--vn-violet`) | **4.23:1** | FAIL |
| averaged | **3.80:1** | FAIL |

**Both stops fail.** The brand violet cannot carry white text at AA as it stands.
For reference, the legacy treatment it replaced — dark ink `#17121F` on `#B49AFF` —
measured **7.88:1**.

### 2.2 Candidate replacements, white text, measured

The binding constraint is the **lightest stop**, because that is the worst case.

| Colour | vs `#fff` | Verdict |
|---|---|---|
| `#8B5CF6` current base | 4.23:1 | fail |
| `#7C3AED` | **5.70:1** | pass — closest to current identity |
| `#7A45E0` | 5.59:1 | pass |
| `#7339DC` | 6.27:1 | pass |
| `#6D28D9` | 7.10:1 | pass |

`#7C3AED` → `#6D28D9` is a violet gradient that keeps white text, stays unmistakably
violet, and passes at both stops with margin. **You are not required to use these
exact values** — but whatever you choose must be measured, not assumed.

### 2.3 The destructive control — more severe

`RESET APP DATA` in Settings → App & install renders as:

- `color: rgb(240,118,142)` — i.e. `--nxt-danger` from `premium-ui.css:59`
- `background-image: linear-gradient(135deg, rgb(183,148,246), rgb(139,92,246))` —
  the **violet affirmative gradient** from `index.html:124`
- measured **1.04:1** — effectively illegible

So the app's most destructive control is filled with the affirmative-action gradient
and reads as the primary CTA.

**There is a cascade puzzle here you must resolve by measurement, not by reading.**
`premium-ui.css:651` already declares a correct restrained treatment:

```css
.btn.danger{background:var(--nxt-danger-tint);border-color:var(--nxt-danger);color:var(--nxt-danger)}
```

Its `color` clearly wins — the measured colour is exactly `--nxt-danger`. But its
`background` does not take effect and the `.btn` gradient shows through, with
`background-color` computing to `rgba(0,0,0,0)`. There are further `.btn.danger`
rules at `index.html:131` and `index.html:2402`. Stylesheet order is: inline
`<style>` (line 16) → `cut-support.css` → `premium-ui.css` → `vnext.css`.

**Find out which declaration actually wins and why the background does not apply.**
Do not guess. Then fix it at the correct level.

Measured destructive-palette options:

| Treatment | Contrast | Verdict |
|---|---|---|
| `#DC5A76` text on canvas `#0E1014` | 5.23:1 | pass |
| `#DC5A76` text on surface `#171B22` | 4.74:1 | pass |
| `#FF8FA3` text on canvas | 8.80:1 | pass |
| white on a `#DC5A76` fill | 3.64:1 | **fail — do not fill with concern + white** |

---

## 3. Required work

### 3.1 Primary — fix at the token, never screen by screen

Introduce a shared token (or a single shared class) for the primary-action fill and
its ink, define it **once**, and have all five sites consume it. Do not patch five
selectors with five literals — that reproduces the defect the next time anything
changes.

Requirements (D12):
- maintain the premium violet identity
- keep white text if practical
- **≥4.5:1 for normal-size text**, verified at the lightest gradient stop
- verify **default, hover, pressed/active, focus and disabled** states
- **do not** raise font size to qualify as large text
- do not materially degrade the established VNext visual language

Note `.vn-act:active` and `.nxp-train-cta:active` apply `filter:brightness(.94)`.
A pressed state that darkens only increases contrast, but **measure it** rather than
assuming. The `:disabled` case at `opacity:.42` is the one that can regress — check it.

`--vn-violet` also carries non-button meaning (active tab, selected date, focus
rings, the focal surface). **Do not change `--vn-violet` itself** unless you have
verified every one of those consumers. Prefer a new action-specific token.

### 3.2 Destructive — narrow exception inside Tier 3

Fix only the destructive-action treatment. **Do not redesign the App & install page**
or anything else in Tier 3.

Requirements:
- clearly destructive, never affirmative
- **≥4.5:1** text contrast, measured
- visually separated from primary and normal actions
- consistent hover / pressed / focus / disabled behaviour
- no accidental visual promotion
- **preserve existing functionality and identifiers** — `NXT.resetData()`, the
  confirm, and every class name stay as they are

Prefer a **restrained** destructive treatment — tinted or outlined — over another
filled gradient.

Note `.btn.danger` is also used by `cloudSignOut()` (`index.html:4842`) and
`deleteLoggedSet()` (`index.html:4914`). Whatever you change affects those too, which
is correct — but check them.

---

## 4. Files

| File | Permitted |
|---|---|
| `vnext.css` | yes — the five primary sites and the shared token |
| `premium-ui.css` | yes — **only** for the destructive treatment |
| `index.html` | yes — **only** if the measurement proves the winning `.btn`/`.btn.danger` declaration lives there. CSS only. No markup, no handler, no identifier. |

**Do not edit:** `cut-support.js`, `premium-ui.js`, `sw.js`, `manifest.webmanifest`,
any `wearables.*`, `seed.*`, `train-anatomy.js`.

**`RELEASE` and `CACHE_NAME` stay at `109`.** No new asset is introduced, so `sw.js`
needs no edit.

## 5. Explicitly out of scope

`backfillAllCoachInsights()` removal — that is **D13 and stays separate** · any Tier 3
page redesign · the inherited V96 contrast debt in body / notifications / training ·
`readiness()` (D4) · legacy renderer removal (D5) · any new feature · any storage,
record-shape or calculation change · `RELEASE`/`CACHE_NAME` bump.

## 6. Verification you owe

- Brace balance on every changed stylesheet
- **All sixteen suites.** `for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done`
  Baseline **16 suites / 458 tests / 0 failing**. It must stay exactly there.
- No browser. Claude measures rendered contrast and runs browser QA.

State in `CURSOR_REPORT.md`: which declaration was actually winning for `.btn.danger`
and why its background did not apply · the token you introduced · the chosen values ·
every consumer you changed · your reasoning for each state (hover/pressed/focus/disabled).

**Do not commit. Do not push.**

---

## 7. Definition of done

- [ ] One shared token/class defines the primary fill and ink; all five sites consume it
- [ ] Primary ≥4.5:1 with normal-size text, verified at the **lightest** gradient stop
- [ ] Default / hover / pressed / focus / disabled all verified
- [ ] Font size not increased to dodge the threshold
- [ ] Violet identity intact; `--vn-violet` unchanged, or every consumer re-verified
- [ ] `RESET APP DATA` ≥4.5:1, clearly destructive, not promoted
- [ ] `.btn.danger`'s other consumers (sign out, delete set) checked
- [ ] Functionality and identifiers preserved
- [ ] 16 suites / 458 tests green; `RELEASE`/`CACHE_NAME` at 109
- [ ] `CURSOR_REPORT.md` updated, including the cascade finding
- [ ] **Not committed**
