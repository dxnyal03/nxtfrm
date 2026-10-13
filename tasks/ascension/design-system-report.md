# Ascension · Workstream A: design system, sheets, targets, dead CSS

Branch `ascension`, baseline `029eb51`. Presentation layer only: no calculation, storage key, record shape, engine file (`cut-support.js`, `coach.js`, `premium-ui.js`, `strata.js`, `sw.js`) or Supabase object was touched. Nothing was committed, pushed or deployed, and `RELEASE` is not bumped (the stylesheets still load as `?v=161`). The approved look (violet on layered charcoal, Dusk palette D54) is unchanged except where a numbered fix below says otherwise; the pixel evidence is in §5.

## 0. Result

| | deliverable | result |
|---|---|---|
| 1 | one token set | 16 canonical names added to Strata; 58 older names resolve to Strata (29 with an identical value; the rest unread, overridden where read, or moving < ΔE 2); the 19 cross-file conflicts and the 8 canvas names resolve to Strata; 13 names deliberately left alone (§2) |
| 2a | D44 field recipe | sheet and Settings fields render 52px / 14px radius / 16px / violet focus halo (was 45–50px, 11px, 8px on focus); Train numerals untouched |
| 2b | legacy sheets | 9 of the 12 `.modal > .sheet` builders now render the Strata sheet (the other 3 are wrapped into n99 sheets already); `ds-sheets.mjs` 0 failures at 390 and 320 |
| 2c | Dusk | sky/cyan literals 57 → 0 in `index.html` (51 lines → 0), 0 in the four other stylesheets |
| 2d | Today aurora | renders in Chrome via `@property`; without `@property` it was empty (`none`); explicit home set added, identical where it already worked |
| 2e | touch targets | banner Log in / Dismiss, Today "Why", confidence chip, History filters, calendar cells and month arrows: 44px boxes and hit areas (banner and "Why" repaint pixel-identically) |
| 2f | 11px text floor | composition-map labels, 320px range-read labels, chart "kg" unit, calendar month marker: all 11px, nothing clipped |
| 3 | dead CSS | `premium-ui.css` 768 → 564 rules, 136,142 → 108,711 B; `vnext.css` 649 → 532 rules, 99,166 → 83,314 B; **−321 rules, −43,283 B (18.4%)**; `cut-support.css` untouched (21 dead rules, all in fenced families). Each of the 8 batches: tests green, 0 computed-style differences over 43 states, frames identical |
| 4 | fields under 16px | none anywhere (§6) |

`qa-sweep.mjs` on the real tree: small targets 123 → 77 (what is left is layout-limited, §3.5), text under 11px 44 → 0, low contrast 0 → 0, inputs under 16px 0 → 0, overflow 0 → 0, nothing new. 21 test suites / 588 tests green. Brace balance and the grep gate pass on every file touched.

Files changed: `strata.css` (+14,951 B), `index.html` (−42 B, 10 exact string edits), `premium-ui.css` (dead rules only), `vnext.css` (1 declaration + dead rules). `cut-support.css`: none. Hashes in §9.

## 1. How the numbers were taken

Other agents edited `premium-ui.js`, `strata.js`, `sw.js` and the end of `strata.css` the whole time I worked, so a before/after on the live tree mixes their changes with mine. Three kinds of run, each stated where used:

- **Real tree, official** (`localhost:8763`): `shots.mjs`, `flows-ds.mjs` (= `flows.mjs` with the routine-editor step in a try/catch, because `NXP.routineEdit(0)` throws on fresh state, a pre-existing issue), `qa-sweep.mjs`, `pixdiff.py`. Baseline `ds-before-final` was taken right before my edits landed (a 2-line rule for the week-rail "Moved" label at 320px, another agent's, landed in `strata.css` during that run), `ds-after` right after; between the two runs only my three files changed (§9).
- **Real-tree snapshots** (`:8766` = the tree of 16:23 with my CSS reverted byte for byte, `:8765` = the same tree with my CSS): identical JS, animation-frozen screenshots, so any difference is the CSS. Used for the strict pixel A/B, the computed-style diff (43 states, ≈47.9k nodes) and the sheet audit.
- **Frozen bed** (`:8764` = the tree of 15:07 plus my edits, served by `devserver.py`): every dead-CSS batch and the per-step runs. Nothing else touches it.

Tools are in `~/Library/Caches/DanDev/nxtfrm/ascension/` (`shots*.mjs`, `flows*.mjs`, `qa-sweep.mjs`, `pixdiff.py`, `style-snap.mjs` / `style-diff2.py`, `ds-sheets.mjs`, `reduced-sheets.mjs`, `measure-fixes.mjs`, `dead-css.py`, `delete-rules.py`, `verdict2.py`); screenshots under `shots/` (`ds-before-final`, `ds-after*`, `ds-sheets/`, `rs-pre*`, `rs-post*`).

## 2. Canonical tokens (deliverable 1)

**Where.** `strata.css`, first `:root` block (canonical additions, lines 45–57) and the block right after it (alias block, lines 59–98). Strata is the last stylesheet to load, so the aliases win over the older layers' own `:root` declarations without deleting them: the older definitions stay where they are (minimal diff; deleting the alias block reverts the step in one go).

**Canonical = Strata.** Strata already owned the palette (`--st-bg`, `--st-ink*`, `--st-accent*`, `--st-lean/fat/floor/cardio/weight/rest`, `--st-tile-*`, `--st-out`, `--st-r`, `--r-card/ctl/tile`, `--btn-*`, the Geist stack). What the three older layers carried that Strata had no name for is now named once, in 16 new tokens:

```css
--st-surface:#15141D;     /* opaque sheet / card surface (the .n99-modal .sheet literal) */
--st-surface-2:#1F1E29;   /* the raised step above it (premium-ui's --nxt-surface-alt) */
--st-s1:4px; --st-s2:8px; --st-s3:12px; --st-s4:16px; --st-s5:20px; --st-s6:24px; --st-s7:32px; --st-s8:40px;  /* space ramp (was --nxt-space-N and --vn-sN) */
--st-t-touch:120ms; --st-t-state:200ms; --st-t-move:280ms;   /* motion tiers (I8); the easing is --st-out */
--st-ok:#8B5CF6; --st-review:#B8842A; --st-concern:#DC5A76;  /* the I2 status trio */
```

Token names in the page: 281 → 297 (`tokens-dump.mjs`, frozen bed; the live tree has more now because the coaching UI block adds its own `--co-*` names).

**Alias policy.** A name is aliased when (a) its value is already Strata's, or (b) nothing reads it, or every read is overridden before it paints, or (c) the only rendered change, measured by a computed-style diff of every node in 43 screen and sheet states (≈47.9k nodes), is under a just-noticeable step (CIEDE2000 ΔE < 2). The diff of the whole alias block (§2.4) shows four rendered effects, all under that step or invisible at rest, so the names in the tables below with a larger ΔE (`--bg` 2.0, `--text` 3.1, `--panel*`, `--rose`, …) are unread or overridden where read. Anything that moved visible pixels by more was left unaliased and is listed in §2.3 for the owner. Experiments that failed this test and were reverted before they reached the repo: aliasing `--purple/--green/--sky`, `--vn-violet-lift`, `--vn-surface*`, `--vn-r-*` and the old motion curves (visible differences on the dock icon, legacy buttons, Evo strokes and bars, segment pills); aliasing `--nxt-surface-alt` to `--st-surface` (ΔE 3.3 on the `:active` chip), fixed by adding the value-identical `--st-surface-2`.

### 2.1 The eight canvas names and the 19 cross-file conflicts

#### The eight canvas names

| name | resolves through | effective before | effective after | change | read by |
|---|---|---|---|---|---|
| `--bg` | alias → `--st-bg` | `#121216` | `#08080D` | ΔE 2.0 | 1 var() |
| `--premium-bg` | alias → `--st-bg` | `#080A0F` | `#08080D` | ΔE 0.8 | unused |
| `--nxt-background` | alias → `--st-bg` | `#0f0e14` | `#08080D` | ΔE 1.8 | 5 var() + 1 str |
| `--nxt-bg` | `--nxt-background` (already chained) | `#0f0e14` | `#08080D` | ΔE 1.8 | 2 var() |
| `--n99-bg` | `--nxt-background` (already chained) | `#0f0e14` | `#08080D` | ΔE 1.8 | 1 var() |
| `--vn-canvas` | alias → `--st-bg` | `#0E1014` | `#08080D` | ΔE 1.7 | 7 var() |
| `--st-bg` | canonical | `#08080D` | `#08080D` | same | 5 var() |
| `--st-bg-2` | canonical (second step, unchanged) | `#0D0D14` | `#0D0D14` | same | unused |

#### The 19 names defined in two or more files with different values

The value that used to win was whichever file loaded last (inventory §1.4). Every one now resolves to a Strata value.

| name | was defined in | resolves through | effective before | effective after | change | read by |
|---|---|---|---|---|---|---|
| `--bg` | index.html ×3, cut-support | alias → `--st-bg` | `#121216` | `#08080D` | ΔE 2.0 | 1 var() |
| `--n99-bg` | cut-support, premium-ui | `--nxt-background` → `--st-bg` | `#0f0e14` | `#08080D` | ΔE 1.8 | 1 var() |
| `--n99-raised` | cut-support, premium-ui | `--nxt-surface-alt` → `--st-surface-2` | `#1f1e29` | `#1F1E29` | ΔE 0.0 | 2 var() |
| `--n99-surface` | cut-support, premium-ui | `--nxt-surface` → `--st-surface` | `#1a1922` | `#15141D` | ΔE 1.5 | 1 var() |
| `--nxt-surface` | cut-support, premium-ui | alias → `--st-surface` | `#1a1922` | `#15141D` | ΔE 1.5 | 21 var() |
| `--panel` | index.html ×3, cut-support | alias → `--st-surface` | `#1b1b22` | `#15141D` | ΔE 2.5 | unused |
| `--panel2` | index.html ×3, cut-support | alias → `--st-surface` | `#23232d` | `#15141D` | ΔE 4.7 | unused |
| `--panel3` | index.html ×2, cut-support | alias → `--st-surface` | `#2b2b36` | `#15141D` | ΔE 7.2 | unused |
| `--n99-muted` | cut-support, premium-ui | `--nxt-text-secondary` (set by strata, already Strata) | `#B9B5C8` | `#B9B5C8` | same | 15 var() |
| `--n99-text` | cut-support, premium-ui | `--nxt-text-primary` (set by strata, already Strata) | `#F4F2FA` | `#F4F2FA` | same | 6 var() |
| `--nxt-text-muted` | premium-ui, strata | strata declaration (already Strata) | `#9893AA` | `#9893AA` | same | 61 var() |
| `--nxt-text-primary` | premium-ui, strata | strata declaration (already Strata) | `#F4F2FA` | `#F4F2FA` | same | 17 var() |
| `--nxt-text-secondary` | premium-ui, strata | strata declaration (already Strata) | `#B9B5C8` | `#B9B5C8` | same | 42 var() |
| `--vn-ink` | vnext, strata | strata declaration (already Strata) | `#F4F2FA` | `#F4F2FA` | same | 72 var() |
| `--vn-ink-2` | vnext, strata | strata declaration (already Strata) | `#B9B5C8` | `#B9B5C8` | same | 54 var() |
| `--vn-ink-3` | vnext, strata | strata declaration (already Strata) | `#9893AA` | `#9893AA` | same | 64 var() |
| `--vn-ink-4` | vnext, strata | strata declaration; 4 off `--st-ink-4` in blue (ΔE 1.5), not aliased | `#8A85A0` | `#8A85A0` | same | 26 var() |
| `--n99-accent` | cut-support, premium-ui | `--nxt-purple-primary` → `--st-accent-lift` | `#b49aff` | `#B49AFF` | ΔE 0.0 | 8 var() |
| `--n99-border` | cut-support, premium-ui | `--nxt-border-subtle` → `--st-tile-line` | `rgba(232, 226, 245, .085)` | `rgba(255,255,255,.075)` | alpha hairline | 11 var() |

### 2.2 Every aliased name (58)

"effective" = the value `getComputedStyle(:root)` returns on Today, before and after. ΔE is CIEDE2000 between the two. "read by" = `var()` references and string references across all five stylesheets and the JS.

| name | resolves to | effective before | effective after | change | read by |
|---|---|---|---|---|---|
| `--bg` | `--st-bg` | `#121216` | `#08080D` | ΔE 2.0 | 1 var() |
| `--nxt-background` | `--st-bg` | `#0f0e14` | `#08080D` | ΔE 1.8 | 5 var() + 1 str |
| `--vn-canvas` | `--st-bg` | `#0E1014` | `#08080D` | ΔE 1.7 | 7 var() |
| `--premium-bg` | `--st-bg` | `#080A0F` | `#08080D` | ΔE 0.8 | unused |
| `--nxt-surface` | `--st-surface` | `#1a1922` | `#15141D` | ΔE 1.5 | 21 var() |
| `--nxt-surface-alt` | `--st-surface-2` | `#1f1e29` | `#1F1E29` | ΔE 0.0 | 11 var() |
| `--nxt-surface-2` | `--st-surface-2` | `#23232d` | `#1F1E29` | ΔE 1.8 | unused |
| `--panel` | `--st-surface` | `#1b1b22` | `#15141D` | ΔE 2.5 | unused |
| `--panel2` | `--st-surface` | `#23232d` | `#15141D` | ΔE 4.7 | unused |
| `--panel3` | `--st-surface` | `#2b2b36` | `#15141D` | ΔE 7.2 | unused |
| `--premium-card` | `--st-surface` | `#151922` | `#15141D` | ΔE 3.1 | unused |
| `--premium-card2` | `--st-surface` | `#11151D` | `#15141D` | ΔE 3.2 | unused |
| `--text` | `--st-ink` | `#f6f5f7` | `#F4F2FA` | ΔE 3.1 | 3 var() |
| `--ink` | `--st-ink` | `#F5F3FF` | `#F4F2FA` | ΔE 1.8 | 1 var() |
| `--faint` | `--st-ink-4` | `#6B647A` | `#8A859C` | ΔE 13.0 | unused |
| `--line` | `--st-tile-line` | `rgba(235,229,244,.085)` | `rgba(255,255,255,.075)` |  | 4 var() |
| `--nxt-border-subtle` | `--st-tile-line` | `rgba(232, 226, 245, .085)` | `rgba(255,255,255,.075)` |  | 37 var() |
| `--nxt-purple-primary` | `--st-accent-lift` | `#b49aff` | `#B49AFF` | ΔE 0.0 | 44 var() |
| `--nxt-chart-ink` | `--st-weight` | `#b49aff` | `#B49AFF` | ΔE 0.0 | 3 var() |
| `--vn-violet` | `--st-accent` | `#8B5CF6` | `#8B5CF6` | same | 20 var() |
| `--vn-action` | `--st-accent-deep` | `#6D28D9` | `#6D28D9` | same | 2 var() |
| `--purple2` | `--st-accent` | `#a477f5` | `#8B5CF6` | ΔE 8.4 | unused |
| `--violet` | `--st-accent-lift` | `#C084FC` | `#B49AFF` | ΔE 6.7 | unused |
| `--nxt-success` | `--st-lean` | `#C4B5FD` | `#C4B5FD` | same | 1 var() |
| `--vn-ok` | `--st-ok` | `#8B5CF6` | `#8B5CF6` | same | unused |
| `--vn-review` | `--st-review` | `#B8842A` | `#B8842A` | same | 9 var() |
| `--vn-concern` | `--st-concern` | `#DC5A76` | `#DC5A76` | same | 9 var() |
| `--rose` | `--st-fat` | `#FDA4AF` | `#F0709A` | ΔE 12.6 | unused |
| `--yellow` | `--st-floor` | `#f7d76b` | `#E2B04A` | ΔE 10.3 | unused |
| `--amber` | `--st-floor` | `#FDE68A` | `#E2B04A` | ΔE 14.0 | unused |
| `--orange` | `--st-cardio` | `#ff9a62` | `#D37732` | ΔE 11.8 | unused |
| `--radius` | `--st-r` | `26px` | `26px` | same | unused |
| `--nxt-radius-lg` | `--r-card` | `18px` | `18px` | same | 9 var() |
| `--nxt-radius-md` | `--r-ctl` | `14px` | `14px` | same | 6 var() |
| `--nxt-font` | `--st-font` | `-apple-system, BlinkMacSystemFont, "SF Pro` | `-apple-system,BlinkMacSystemFont,"SF Pro T` |  | unused |
| `--vn-ease` | `--st-out` | `cubic-bezier(.32,.72,0,1)` | `cubic-bezier(.32,.72,0,1)` | same | 26 var() |
| `--nxt-ease` | `--st-out` | `cubic-bezier(.2, .7, .3, 1)` | `cubic-bezier(.32,.72,0,1)` |  | 7 var() |
| `--nxt-ease-out` | `--st-out` | `cubic-bezier(.16, .84, .44, 1)` | `cubic-bezier(.32,.72,0,1)` |  | 44 var() |
| `--ease` | `--st-out` | `cubic-bezier(.2,.8,.2,1)` | `cubic-bezier(.32,.72,0,1)` |  | 4 var() |
| `--vn-t-touch` | `--st-t-touch` | `120ms` | `120ms` | same | 8 var() |
| `--vn-t-state` | `--st-t-state` | `200ms` | `200ms` | same | 14 var() |
| `--vn-t-move` | `--st-t-move` | `280ms` | `280ms` | same | 3 var() |
| `--nxt-space-1` | `--st-s1` | `4px` | `4px` | same | 16 var() |
| `--nxt-space-2` | `--st-s2` | `8px` | `8px` | same | 65 var() |
| `--nxt-space-3` | `--st-s3` | `12px` | `12px` | same | 80 var() |
| `--nxt-space-4` | `--st-s4` | `16px` | `16px` | same | 34 var() |
| `--nxt-space-5` | `--st-s5` | `20px` | `20px` | same | 4 var() |
| `--nxt-space-6` | `--st-s6` | `24px` | `24px` | same | 6 var() |
| `--nxt-space-7` | `--st-s7` | `32px` | `32px` | same | unused |
| `--nxt-space-8` | `--st-s8` | `40px` | `40px` | same | unused |
| `--vn-s1` | `--st-s1` | `4px` | `4px` | same | 6 var() |
| `--vn-s2` | `--st-s2` | `8px` | `8px` | same | 31 var() |
| `--vn-s3` | `--st-s3` | `12px` | `12px` | same | 61 var() |
| `--vn-s4` | `--st-s4` | `16px` | `16px` | same | 35 var() |
| `--vn-s5` | `--st-s5` | `20px` | `20px` | same | 31 var() |
| `--vn-s6` | `--st-s6` | `24px` | `24px` | same | 12 var() |
| `--vn-s7` | `--st-s7` | `32px` | `32px` | same | 3 var() |
| `--vn-s8` | `--st-s8` | `40px` | `40px` | same | 5 var() |

### 2.3 Left alone on purpose (13 names)

Each would have moved visible pixels, so it is not aliased; the owner can decide whether the visible change is wanted.

| name(s) | would resolve to | ΔE | what would move |
|---|---|---|---|
| `--purple`, `--green` (`#b18aff`), `--sky` (`#aa7afa`) | `--st-accent-lift #B49AFF` | 4.3 and 8.4 | the dock tab icon, legacy buttons |
| `--vn-violet-lift` (`#A78BFA`) | `--st-accent-lift` | 4.2 | Evo chart strokes, status text |
| `--vn-surface`, `--vn-surface-2`, `--vn-surface-3` | `--st-surface` | 4.1, 5.6, 8.1 | Evo bars, review cards, quiet buttons |
| `--vn-r-surface` 20px, `--vn-r-control` 12px | `--st-r` 26px, `--r-ctl` 14px | n/a (radius) | segment pills and Settings actions would change shape |
| `--muted`, `--muted2` | `--st-ink-3`, `--st-ink-4` | 6.9 and 14.4 | legacy `.sub`, `.kicker`, `.label` text |
| `--red` | `--st-fat` | – | the invalid-field border |
| `--vn-ink-4` `#8A85A0` | `--st-ink-4 #8A859C` | 1.5 | nothing: strata.css re-declares `--vn-ink*` further down the file, so an alias placed at the top would not apply (4 off in blue, below a just-noticeable step) |

### 2.4 What the whole token step did to pixels

Computed style, 43 states, frozen real-tree snapshots, pre-edit vs post-edit CSS (`style-diff2.py`): 869 distinct (element-class, property, old → new) changes in total. The ones that come from the token step, not from §3:

- **inherited body ink** `rgb(245,243,255)` → `rgb(244,242,250)` on every text node that inherits (ΔE 1.77, `--ink`/`--text` → `--st-ink`);
- **hairlines** `rgba(232,226,245,.086)` → `rgba(255,255,255,.075)` on `.cloud-local-banner`, `.apx96-card`, `.nxp-addon` (`--line`, `--nxt-border-subtle` → `--st-tile-line`);
- **Evo marker fill** `rgb(14,16,20)` → `rgb(8,8,13)` (`--vn-canvas` → `--st-bg`, ΔE 1.70);
- **easing** `cubic-bezier(.16,.84,.44,1)` / `(.2,.7,.3,1)` / `(.2,.8,.2,1)` → `(.32,.72,0,1)` on tab labels, `.btn.danger` and the dock (no pixel at rest: one easing instead of five).

In screenshots these show as ≤ 2/255 on the hairlines and ≤ 8/255 on the marker (§5.2), which is why the official 24-luma diff does not see them.

## 3. Intended fixes (deliverable 2)

All of §3 is one block in `strata.css`, **`/* ===== Ascension · sheet unification & targets ===== */`, lines 99–181**, placed right after the alias block (not at the end of the file), plus the Dusk edits in `index.html` and one declaration in `vnext.css`. Strata's later rules have the same specificity as most of mine, so every selector here leads with an ID (`#modalRoot`, `#morePage`, `#cloudLocalBanner`, `#historyPage`, `#weightPage`) or a doubled class, and carries `!important` only where the older layer it beats does.

### 3.1 (2a) The D44 field recipe now renders (52px, 14px radius, 16px text, violet focus halo)

**Cause.** The inline `.input,.select,.textarea{min-height:45px !important}` beat the 52px that `index.html` and `strata.css` declared without `!important`, so sheet and Settings fields rendered 45–50px tall with an 11px radius (8px on focus).

**Fix.** `#modalRoot .sheet :where(input…,select,textarea)` and `#morePage :where(input…,select)` get `min-height:52px !important`; legacy sheets and every Settings field also get the full recipe (14px radius `--r-ctl`, `rgba(255,255,255,.045)` fill, `rgba(var(--st-hl),.11)` border, inset hairline, `450 16px` text, violet halo on focus `0 0 0 4px rgba(139,92,246,.18)` with a `rgba(180,154,255,.6)` border). Excluded by design: Train set numerals and steppers (`#trainPage`, untouched), the weigh-in big number and its compact date row (`.st-qw-field`, `.st-qw-date`), and Settings textareas, which keep their own min-height (the Evo scan box is 88px).

Settings fields (390 and 320 are identical; `measure-fixes.mjs` on the real-tree snapshots, CSS reverted → CSS final; the pristine bed measured the same on every item):

| field (identical at 390 and 320) | before | after |
|---|---|---|
| `#n99-goal-low` | 50px, radius 11px, fill `rgb(21, 21, 27)`, border `rgb(72, 66, 82)` | 52px, radius 14px, fill `rgba(255, 255, 255, 0.043)`, border `rgba(255, 255, 255, 0.11)` |
| `#n99-goal-high` | 50px, radius 11px, fill `rgb(21, 21, 27)`, border `rgb(72, 66, 82)` | 52px, radius 14px, fill `rgba(255, 255, 255, 0.043)`, border `rgba(255, 255, 255, 0.11)` |
| `#n99-card-goal` | 50px, radius 11px, fill `rgb(21, 21, 27)`, border `rgb(72, 66, 82)` | 52px, radius 14px, fill `rgba(255, 255, 255, 0.043)`, border `rgba(255, 255, 255, 0.11)` |

Focus state of `#n99-goal-low` (measured 600 ms after `focus()`, snapshots):

| | height | radius | fill | border | shadow | outline |
|---|---|---|---|---|---|---|
| before, idle | 50px | 11px | `rgb(21,21,27)` | `rgb(72,66,82)` | none | none |
| before, focused | 50px | **8px** | `rgb(21,21,27)` | `rgb(72,66,82)` | none | solid 2px |
| after, idle | 52px | 14px | `rgba(255,255,255,.043)` | `rgba(255,255,255,.11)` | inset hairline | none |
| after, focused | 52px | 14px | `rgba(139,92,246,.09)` | `rgba(180,154,255,.6)` | `0 0 0 4px rgba(139,92,246,.18)` | none (the halo is the ring) |

`ds-sheets.mjs` asserts the rule on 8 pages, the 7 Settings sub-views (every `<details>` fold opened, so the import box, SQL help and the Supabase card are measured), the routine editor and active Train: **0 Settings fields under 52px, 0 fields under 16px**.

### 3.2 (2b) The legacy `.modal > .sheet` builders now look like the Strata sheets

`cut-support.js` builds `.modal.n99-modal > section.sheet.n99`, which Strata styles. Twelve call sites in `index.html` build a plain `.modal > .sheet`, which fell between `index.html:2498` (30px top radius) and `cut-support.css:14` (a background). Nine of the twelve render that way; the other three (`v88OpenNoteModal`, `showHistoryDay`, `apx95OpenQuickWeight`) are wrapped into n99 sheets by `cut-support.js` and already had the recipe (their rows below read "unchanged" for that reason).

Extended to the nine, with no id, field or handler touched: scrim `rgba(4,4,8,.55)` with a 10px blur and `nxt-dim-in`; sheet surface `--st-surface` with the top violet glow, 28px top radius, 1px `rgba(var(--st-hl),.08)` edge, `0 -20px 60px -20px` shadow, `st-sheet-in` spring, 580px max width (560 from 768px up), 22px side padding; grip 40×5; title 600 22px; eyebrows and section labels in the calm Strata label (sentence case, 560 13px, `--st-ink-2`, no tracking, §10); notes 13px; labels 13px sentence case; the 8–10px pills, tags and metric labels raised above the 11px floor and out of tracked caps (the `#6a686e` metric labels moved to `--st-ink-3`: 3.8:1 → 6:1); queue rows (8px notes and 9px numbers → 12px, names 15px and allowed to wrap); fields as §3.1; `.btn` as the D56 primary capsule (50px, `--btn-primary`, Geist 16px / 620 like the n99 buttons), `.btn.secondary` and `.btn.danger` as the glass capsule (Geist 16px / 560; danger keeps the rose word `--st-fat`), `.apx96-chip` as a 44px glass capsule (Geist 14px / 560; the inline REMOVE colour survives). Sentence case: §10.

Reduced motion: under `prefers-reduced-motion: reduce` **and** under the in-app switch (`data-nxp-motion="reduced"`, Settings > Appearance > Motion) neither scrim nor sheet animates (`reduced-sheets.mjs`, §7.5).

All 15 sheets, before (pristine bed, 15:07) → after (final real-tree snapshot), `ds-sheets.mjs`:

| sheet (builder) | width | family | fields before → after (px) | text (px) | buttons before → after (px) | radius | grip | overflow-x |
|---|---|---|---|---|---|---|---|---|
| `edit-set` (openEditSet) | 390 | legacy | 46,48,64 → 52,64 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `substitute` (showSubstituteSheet) | 390 | legacy | – → – | – | 46,57 → 50,57 | 30px → 28px | none → 40px×5px | none |
| `add-exercise` (v88OpenAddModal) | 390 | legacy | 48 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `queue-manager` (apx96OpenQueueManager) | 390 | legacy | – → – | – | 31,46,50 → 44,50 | 30px → 28px | none → 40px×5px | none |
| `replace-exercise` (v88OpenReplaceModal) | 390 | legacy | 48 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `exercise-note` (v88OpenNoteModal) | 390 | n99 | 62 → 62 | 16 | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `edit-weigh-in` (apx95EditWeight) | 390 | legacy | 46,48 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `bodyweight-prompt` (showWeightPrompt) | 390 | legacy | 46 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `pr-sheet` (showPRSheet) | 390 | legacy | – → – | – | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `daily-archive` (showHistoryDay) | 390 | n99 | – → – | – | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `session-complete` (showZone2Prompt) | 390 | legacy | – → – | – | 46,50 → 50,54 | 30px → 28px | none → 40px×5px | none |
| `weigh-in` (apx95OpenQuickWeight (n99, reference)) | 390 | n99 | 46,52,92 → 46,52,92 | 16,64 | 42,44,50,56 → 42,44,50,56 | 28px → 28px | 40px×5px → 40px×5px | 400>388 |
| `cardio` (showCardioSheet (n99)) | 390 | n99 | 49,52 → 52 | 16 | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `why` (NXT.openReview (n99)) | 390 | n99 | – → – | – | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `day-picker` (NXT.openDay (n99)) | 390 | n99 | – → – | – | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `edit-set` (openEditSet) | 320 | legacy | 46,48,64 → 52,64 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `substitute` (showSubstituteSheet) | 320 | legacy | – → – | – | 46,57 → 50,57,72 | 30px → 28px | none → 40px×5px | none |
| `add-exercise` (v88OpenAddModal) | 320 | legacy | 48 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `queue-manager` (apx96OpenQueueManager) | 320 | legacy | – → – | – | 31,46,50 → 44,50,74 | 30px → 28px | none → 40px×5px | none |
| `replace-exercise` (v88OpenReplaceModal) | 320 | legacy | 48 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `exercise-note` (v88OpenNoteModal) | 320 | n99 | 62 → 62 | 16 | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `edit-weigh-in` (apx95EditWeight) | 320 | legacy | 46,48 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `bodyweight-prompt` (showWeightPrompt) | 320 | legacy | 46 → 52 | 16 | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `pr-sheet` (showPRSheet) | 320 | legacy | – → – | – | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `daily-archive` (showHistoryDay) | 320 | n99 | – → – | – | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `session-complete` (showZone2Prompt) | 320 | legacy | – → – | – | 46 → 50 | 30px → 28px | none → 40px×5px | none |
| `weigh-in` (apx95OpenQuickWeight (n99, reference)) | 320 | n99 | 46,52,92 → 46,52,92 | 16,64 | 42,44,50,56 → 42,44,50,56 | 28px → 28px | 40px×5px → 40px×5px | 330>318 |
| `cardio` (showCardioSheet (n99)) | 320 | n99 | 49,52 → 52 | 16 | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `why` (NXT.openReview (n99)) | 320 | n99 | – → – | – | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |
| `day-picker` (NXT.openDay (n99)) | 320 | n99 | – → – | – | 44,50 → 44,50 | 28px → 28px | 40px×5px → 40px×5px | none |

`ds-sheets.mjs` result: **0 failures** (no page error, no horizontal overflow of the page or of a legacy sheet, every legacy field ≥ 52px and 16px, every legacy button ≥ 44px, no legacy text under 11px or under AA contrast). The n99 `weigh-in` sheet is the reference family, and the script itself prints `BAD(5)` for it because of four things that were there before I started and are not in scope: horizontal scroll inside the sheet (400 > 388 at 390px, 330 > 318 at 320), 42px timing pills, a 46px date field, and the 92px big-number field. I looked at the screenshots (`shots/ds-sheets/*-390.png` and `-320.png`, including `cloud-login-card-*.png`): grip, title, fields with the violet halo on the focused field, capsule buttons, glass chips and the dimmed page behind match the n99 sheets.

Not done, and why:
- **No close button.** The legacy builders have no close-button markup (they close through Cancel / Done or the scrim); adding one is a markup change in `index.html`, outside the style block.
- **No swipe-to-close and no page recede.** `strata.js bindSheets()` is keyed to `.n99-modal .sheet`. Changing that selector to `.modal .sheet` would give the nine the same gestures; `strata.js` is not mine (follow-up F1).
- **Settings legacy cards** (the Supabase "Cloud backup" card, the scan card) still use the legacy `.btn` rectangles with the violet → lavender gradient and wide-tracked uppercase labels. Fields are fixed (§3.1); the buttons belong to a different component family and are out of scope.
- `openCloudLogin()` does not exist. The "cloud login" is the Supabase card in Settings > Data (`#sbUrl`, `#sbKey`, `#sbEmail`, `#sbPass`); it gets the field recipe from the `#morePage` rules and is screenshotted in `cloud-login-card-390.png` / `-320.png`.

### 3.3 (2c) Sky / cyan literals out of the inline block (D54)

`grep -c -i -E "125,211,252|7dd3fc|bae6fd|a6e3fa"`, before → after:

| file | lines before | lines after | occurrences before → after |
|---|---|---|---|
| `index.html` | 51 | **0** | 57 → 0 |
| `premium-ui.css`, `vnext.css`, `cut-support.css`, `strata.css` | 0 | **0** | 0 → 0 |

Replacements (10 exact edits in `index.html`): `rgba(125,211,252,x)` → `rgba(139,92,246,x)` violet, 42×; `#bae6fd` → `#C4B5FD` lavender, 6×; `#a6e3fa` → `#C4B5FD`; `--sky:#7dd3fc` / `#7DD3FC` → `--sky:#aa7afa` (the value the cascade already resolved to, so `var(--sky)` renders exactly as before); the `.po-fill` and one `!important` progress gradient `#a78bfa → #7dd3fc` → `#a78bfa → #C4B5FD`; the three-stop banner gradient's `#7DD3FC` end → `#C4B5FD`; `.calendar-dot.cardio{background:#7dd3fc}` → `#D37732` (`--st-cardio`, the Dusk cardio copper); `stop-color="#7DD3FC"` ×2 → `#C4B5FD`. Mauve `#9B8BB8` was not needed.

The body background gradient at line 58 (`radial-gradient(circle at 100% 5%, rgba(125,211,252,.08) …)`) is now `rgba(139,92,246,.08)`. Strata paints the page canvas itself, so nothing visible changed (the Dusk step on the bed was a zero-pixel diff).

**Scope note (needs your eye).** Five of the 57 occurrences are not in the inline `<style>` block: they sit in JS template strings in the `index.html` script (the `v80Trend` SVG gradient stops, a premium-card inline `style="border-color:rgba(125,211,252,.15);background:rgba(125,211,252,.055)"`, and `<span class="home-source-pill" style="color:#bae6fd">`; lines 6134, 6184 and 6722 before the edit). The gate "0 for every file" cannot be met without them and the same `replace_all` edits cover them, so I changed them and say so here. They are string constants inside templates; no logic changed.

### 3.4 (2d) Today's aurora

The inventory suspected Today's aurora rendered empty: `--st-a1..a4` are defined only for `data-st-tab` = train, weight, history, more, and Today sets `data-st-tab="home"`. Checked in a browser (`aurora-check.mjs`, Chrome):

| engine | Today `--st-a1..a4` | Today `body::before` | Train |
|---|---|---|---|
| as shipped | `rgba(139,92,246,.42)`, `rgba(236,72,153,.18)`, `rgba(85,82,187,.16)`, `rgba(211,119,50,.08)` | radial gradients, rendered | its own set |
| as shipped, `@property` registrations removed (an engine or WebView without `@property`) | **(unset) ×4** | **`none`: Today's light is empty** | its own set |
| with the explicit home set, `@property` removed | the same four values | the same radial gradients | its own set |

So in current Chrome the aurora was never empty: the four `@property` registrations carry `initial-value`s that happen to be Today's set. The fragility is real on any engine that ignores `@property`. Defined: `:root[data-st-tab="home"]{--st-a1:rgba(139,92,246,.42);--st-a2:rgba(236,72,153,.18);--st-a3:rgba(85,82,187,.16);--st-a4:rgba(211,119,50,.08)}` (the same four values, so pixel-identical where `@property` works; `strata.css` line 97). Final snapshot, every tab (`aurora-real.mjs`): `data-st-tab` = home, train, weight (Progress), history and more each resolve a non-empty set of four tints and a non-empty `body::before`; Today's is the one above.

### 3.5 (2e) Touch targets ≥ 44px

All measured by `measure-fixes.mjs` on the real-tree snapshots (`:8766` CSS reverted → `:8767` final; the live tree gave the same numbers). Method: where the design wants a small painted capsule (banner buttons, "Why"), the box becomes 44px with a negative block margin and an `isolation:isolate` `::before` paints the capsule at its old size, so **the footprint and the pixels do not move** (the "Why" capsule differs by at most 2/255). Rows and tracks (History filters, calendar cells, month arrows, the confidence chip) simply grow.

| control | measured | 390 before → after | 320 before → after |
|---|---|---|---|
| Cloud banner "Log in" | box height / hit height (px) | 36 / 36 → 44 / 44 | 36 / 36 → 44 / 44 |
| Cloud banner "Dismiss" | box height / hit height (px) | 36 / 36 → 44 / 44 | 36 / 36 → 44 / 44 |
| Cloud banner (container) | height (px), must not grow | 73.6 → 73.6 | 73.6 → 73.6 |
| Today "Why" link | box / hit height (px) | 32 / 32 → 44 / 44 | 32 / 32 → 44 / 44 |
| Today decision confidence chip | box / hit height (px) | 39 / 40 → 44 / 44 | 39 / 40 → 44 / 44 |
| Today decision tile | height (px) | 410.7 → 415.7 | 391.2 → 396.2 |
| History filter button | box / hit height (px) | 38 / 38 → 44 / 44 | 38 / 38 → 44 / 44 |
| History filter track | height (px) | 44 → 50 | 44 → 50 |
| History calendar day cell | w × h (px) | 36.3 × 36.3 → 36.3 × 44 | 28.6 × 28.6 → 28.6 × 44 |
| History calendar grid | height (px) | 209.5 → 248 | 170.9 → 248 |
| History month arrows | width × height (px) | 40 × 44 → 44 × 44 | 36 × 44 → 44 × 44 |
| History page content | height (px) | 1081 → 1126 | 1031 → 1115 |

Residual, explained rather than hidden. `qa-sweep.mjs` still lists the calendar day cells as "small" because it flags any control narrower than 40px: a 7-column grid at 390 / 320 gives 36px / 29px cells, which cannot reach 44 wide without a different layout; their hit area is now 36 × 44 and 29 × 44 (was 36 × 36 and 29 × 29). The same applies to the Today week-rail cells at 320 (7 cells of 35px, another agent's component). The banner buttons are measured by hit area (the brief allowed it): 44px high at both widths.

### 3.6 (2f) Text floor 11px

| text | where | 390 before → after | 320 before → after |
|---|---|---|---|
| Composition-map axis labels (`.st-ax`, `.st-cm-zl`) | Progress > Body | 10.5px,11px → 11px | 10.5px,11px → 11px |
| Range-read labels (`#weightPage .st-rread`) | Progress > Weight | 11.5px,11px → 11.5px,11px | 10.5px → 11px |
| Chart unit label "kg" | Progress > Weight readout | 9.68px → 11px | 9.68px → 11px |
| Calendar month marker (`.is-m1`) | History | 10px → 11px | 9.5px → 11px |

The composition-map glyph boxes grow from 12 to 13px (one label box ends 1.1px below its viewBox; SVG overflow is visible and the label stays inside its tile). At 320 the range-read label "Trend change" is 2px wider than its column at 11px, so below 340px it gets `letter-spacing:-.03em` and 5px of right padding instead of 6px; nothing clips (`measure-fixes.mjs`: `clipped:false` for every label).

`qa-sweep.mjs` on the real tree, before (`ds-before-final`) → after (`ds-after`), no-preference motion, 8 screens × 2 widths (columns: small targets, tiny text, low contrast, inputs < 16px, horizontal overflow):

```
screen                             small tiny contrast inputs<16 overflow   ->  small tiny contrast inputs<16 overflow
320/no-preference/home                11    0        0         0        0   ->      7    0        0         0        0
320/no-preference/train                2    0        0         0        0   ->      0    0        0         0        0
320/no-preference/weight               2    7        0         0        0   ->      0    0        0         0        0
320/no-preference/training             2    7        0         0        0   ->      0    0        0         0        0
320/no-preference/performance          2    0        0         0        0   ->      0    0        0         0        0
320/no-preference/body                 2   12        0         0        0   ->      0    0        0         0        0
320/no-preference/history             43    2        0         0        0   ->     35    0        0         0        0
320/no-preference/more                 2    0        0         0        0   ->      0    0        0         0        0
390/no-preference/home                 4    0        0         0        0   ->      0    0        0         0        0
390/no-preference/train                2    0        0         0        0   ->      0    0        0         0        0
390/no-preference/weight               2    1        0         0        0   ->      0    0        0         0        0
390/no-preference/training             2    1        0         0        0   ->      0    0        0         0        0
390/no-preference/performance          2    0        0         0        0   ->      0    0        0         0        0
390/no-preference/body                 2   12        0         0        0   ->      0    0        0         0        0
390/no-preference/history             41    2        0         0        0   ->     35    0        0         0        0
390/no-preference/more                 2    0        0         0        0   ->      0    0        0         0        0
TOTAL(no-preference) [123, 44, 0, 0, 0] -> [77, 0, 0, 0, 0]
```

Item level (`qa-items.py`, items keyed by width, control and text): 54 fixed, 70 changed, 0 new, 7 remaining unchanged.

- **Fixed**: the banner "Log in" / "Dismiss" (36px), Today "Why" (32px), the confidence chip (39px), the History filter buttons (Lifting, Cardio, Weight, All: 38px), the month arrows at 320 (36px wide), every `.st-ax` / `.st-cm-zl` composition-map label and the "kg" unit (tiny text), the `.is-m1` month marker, and the 320px range-read labels ("Trend change", "Lowest", "over 29 days", "Weighed", "90% of days", "12 Oct").
- **Changed, still listed as small**: the 35 History calendar day cells per width, `29 × 29 → 29 × 44` at 320 and `36 × 36 → 36 × 44` at 390 (listed because they are narrower than 40px: 7 columns).
- **Remaining unchanged (7, all at 320)**: the Today week-rail cells `vn-week-c` (35px wide, 7 cells; another agent's component).
- **New: none.**

## 4. Dead CSS removal (deliverable 3)

### 4.1 What counts as dead, and what is never touched

A style rule is a deletion candidate only if **all** of this holds:

1. at least one class, id or `data-*` attribute that its selector *requires* is produced by **no emitter**: `premium-ui.js`, `strata.js`, `cut-support.js`, `coach.js`, `train-anatomy.js`, `seed.*`, the whole of `index.html` (inline `<style>` included) and every other non-test `.js` in the repo root (23 files, ≈1.45 MB). Names built from a stem (`'st-es-'+k`, `` `nxp-${x}` ``; 17 stems found) count as live;
2. it is not in the `.modal` / `.sheet` / `.n99-*` / `.apx96-*` / `#modalRoot` families the legacy sheets still use;
3. no test pins it: the rule's dead class is not named in any `*.test.js`, **and** no string literal of a test that reads a stylesheet occurs in the rule's text (the release-gate test slices `premium-ui.css` and asserts on text such as `.nxp-aim-cell {`, `.nxp-seg button:active`, `touch-action: manipulation`; a bare DOM query such as `".nxp-aim-cell"` is not a pin).

Comments that tests use as slice anchors (`/* V107 Train lifting workspace.`, `/* ---- Narrow phones`, `/* ---- Rest timer ----`, `/* ---- Exercise navigation`, `/* ---- Last / Target / Rest ----`, `/* ---- Coach note ----`; 9 in all) are never removed. A comment left labelling nothing after a deletion is removed with it; an `@media` wrapper left empty goes with its last rule.

### 4.2 Three independent proofs, all negative for every candidate

- **Static**: no emitter and no test names it (§4.1).
- **Runtime class census**: a `MutationObserver` from page start over the same 43 states recorded **695 distinct classes** on elements; 323 candidates checked: **0 violations**.
- **Chrome CSS coverage** over the same 43 states: `premium-ui.css` 237 used ranges, 206 candidates, **0** containing any used CSS; `vnext.css` 318 used ranges, 117 candidates, **0**.

(The three proofs ran on the frozen bed with the 206 + 117 candidate set; the real tree re-ran the static analysis and only the intersection was deleted, §4.4.)

### 4.3 Result

| file | style rules before → after | bytes before → after | removed | dead rules found (real tree) | validated on the bed | candidates on the real tree | **deleted** (both) | kept: family fence | kept: pinned by a test | kept: partly dead (several selectors, one still matches) |
|---|---|---|---|---|---|---|---|---|---|---|
| `premium-ui.css` | 768 → **564** | 136,142 → **108,711** | −204 rules, −27,431 B (20.1%) | 307 | 206 | 210 | **204** | 53 (6,851 B) | 44 (7,737 B) | 9 |
| `vnext.css` | 649 → **532** | 99,166 → **83,314** | −117 rules, −15,852 B (16.0%) | 138 | 117 | 117 | **117** | 2 (370 B) | 19 (3,091 B) | 6 |
| `cut-support.css` | 200 → **200** | 20,105 → **20,105** | 0 | 21 | 0 | 0 | **0** | 21 (2,111 B) | 0 (0 B) | 2 |
| **total** | | | **−321 rules, −43,283 B** | | | | | | | |

Clusters deleted (a cluster = the first dead class of each rule; bed-validated list):

- `premium-ui.css`: `.nxp-train-lift` 48 rules / 8,739 B, `.nxp-home-decision` 9 rules / 1,191 B, `.nxp-set-dots` 6 rules / 1,025 B, `.nxp-aim` 6 rules / 942 B, `.nxp-ex-rail` 7 rules / 764 B, `.nxp-calories` 6 rules / 732 B, `.nxp-action` 3 rules / 722 B, `.nxp-more` 8 rules / 650 B, `.nxp-progress-strength-summary` 6 rules / 645 B, `.nxp-progress-body-scan` 4 rules / 610 B, and 48 smaller clusters
- `vnext.css`: `.vn-train-active` 19 rules / 3,500 B, `.nxp-ex-rail` 9 rules / 1,348 B, `.vn-surface` 6 rules / 1,123 B, `.vn-train-sets` 5 rules / 743 B, `.vn-act` 3 rules / 622 B, `.vn-train-icon` 2 rules / 532 B, `.vn-aim` 6 rules / 496 B, `.vn-train-more` 3 rules / 399 B, `.vn-sect` 4 rules / 396 B, `.vn-train-tools-panel` 2 rules / 382 B, and 45 smaller clusters

`cut-support.css`: 21 rules (2,111 B) are dead by the same test and every one is in a fenced family; none deleted (Appendix A).

Orphaned `@keyframes`: after the deletions all 12 in `premium-ui.css` and all 4 in `vnext.css` are still referenced by live, fenced or test-pinned rules (checked by name across every stylesheet and script), so none was removed.

### 4.4 How it was applied

1. On the frozen bed, in batches of ≤ 50 rules (premium-ui.css 5, vnext.css 3): delete, run all 21 suites, take animation-frozen screenshots of every page at 390 and 320 and every flow frame, take a computed-style snapshot of ≈47.9k nodes in 43 states, and compare with the state before any deletion. A batch had to pass before the next one ran (table in §5.3: 8 of 8 passed, 0 computed-style differences each).
2. The five premium-ui.css batches applied one after another give a file byte-identical to deleting all 206 at once (sha1 `05ff8286…`), as do the three vnext.css batches (`14127bc4…`).
3. On the real tree the static analysis was re-run first, because other agents had changed emitters and tests since the bed was frozen. `vnext.css`: 117 candidates on both, the real file is byte-identical to the bed's (`14127bc4…`). `premium-ui.css`: 210 candidates on the real tree, 206 on the bed; **only the 204 in both were deleted** (the file is 564 rules, not 562). Two rules the bed deleted are kept on the real tree: `.nxp-train-lift .nxp-aim-cell.is-tappable:active b` and `.nxp-train-lift .nxp-aim-cell:nth-child(3)`: the Train markup no longer emits `nxp-aim-cell` there, which makes it a dead name that tests mention, so the pin applies. Six rules became dead after the bed was frozen (`.nxp-home-signal` ×4 and `.nxp-aim-top` ×2) but were not validated, so they stay (≈0.6 KB; re-running `dead-css.py` and `delete-rules.py` picks them up).
4. The edit to each real file was made on a temp copy and moved into place atomically, after checking the real file had not changed since the copy.
5. After the replacement: 21 suites / 588 tests pass, braces balance, and the real-tree snapshot with the final files shows no computed-style difference and strictly identical frames (§5.4).

## 5. Pixel-diff results (which files differ, and why)

### 5.1 Official runs on the real tree (`pixdiff.py`: luma > 24, flag above 0.5%)

`ds-before-final` (15:59–16:01, right before my edits) → `ds-after` (16:09–16:13, right after: only `strata.css`, `index.html`, `vnext.css` had changed; hashes in §9). 16 page frames and 29 flow frames compared; the differing ones:

| frame | official result | what it is |
|---|---|---|
| `history-390` / `history-320` | size 780×2162 → 780×2252 / 640×2062 → 640×2230 (+45 / +84 CSS px) | History: calendar day cells 36 / 29px → 44px tall, filter track 44 → 50px, month arrows 44px (§3.5) |
| `history-after-log` | 780×2684 → 780×2774 (+45) | the same History page after logging a workout |
| `today-390` / `today-320` | +5 CSS px | the decision tile's confidence chip 39 → 44px (§3.5); the "Why" link and the banner buttons grow their boxes without moving anything |
| `today-liftday`, `desktop-today`, `sheet-cardio`, `sheet-day-picker`, `sheet-weighin`, `sheet-why` | +5 CSS px each | Today behind the sheet, or Today on desktop: the same chip |
| `progress-weight-320` | 640×5662 → 640×5664 (+1 CSS px) | range-read labels 10.5 → 11px at 320 (the label that used to clip by 2px now fits) (§3.6) |
| `settings-goals` | 780×2758 → 780×2766 (+4 CSS px) | two fields 50 → 52px (§3.1) |
| `settings-coach` | 780×1918 → 780×1922 (+2 CSS px) | one field 50 → 52px |
| `splash-1300ms` | 5.85% | not mine: the splash animation caught at another instant (8.94% between two baselines that both predate my edits; up to 37% between two runs of identical code) |

All the "size" rows are intended fixes: screenshots are at 2×, so +10px is +5 CSS px. Where the size changed the frames cannot be compared pixel for pixel; §5.2 compares the same pages on a frozen JS base and attributes the pixels. Nothing else in the two folders differs by more than 0.14% (the composition-map labels at 320: 0.14%, at 390: 0.11%; the "kg" label 0.04%; every other file ≤ 0.01%).

`splash-1300ms` (5.85%) is the splash animation caught at a different instant; it is not mine: the same frame differs by 8.94% between two baselines that both predate my edits (`ds-before-flows` vs `ds-before-final-flows`), and by up to 37% (`splash-620ms`) between two runs of identical code on the bed. The Exercise Details chart/launch frames (`sheet-exercise-details`, `train-active-*`, `train-finish`) are 0.00% in this comparison.

### 5.2 Strict A/B on the frozen real-tree snapshots (any channel > 1, noise mask from a second pre-edit run)

The same 16 + 29 frames, `rs-pre` (CSS reverted) vs `rs-post1` (my CSS, no dead-rule deletions yet). The official diff on this pair lists exactly the same size rows as §5.1. Strictly, 18 more frames differ in a few pixels; each is attributed below by connected component (CSS px bounding box, maximum channel difference). "Hairline alias" is the 1-px bottom edge of the cloud banner (and card edges) moving from `rgba(232,226,245,.086)` to `rgba(255,255,255,.075)`; every other pixel of those frames is identical.

| frame | pixels > 1 | max Δ | largest component, CSS px (x0,y0)–(x1,y1) | cause |
|---|---|---|---|---|
| `progress-body-320` | 8217 | 214 | (63,382)–(194,398) | axis labels 10.5 → 11px (§3.6) + hairline alias |
| `progress-body-390` | 8346 | 214 | (67,399)–(198,415) | axis labels 10.5 → 11px (§3.6) + hairline alias |
| `progress-performance-320` | 676 | 2 | (25,69)–(320,77) | hairline alias (§2.4) |
| `progress-performance-390` | 826 | 2 | (48,69)–(390,77) | hairline alias (§2.4) |
| `progress-training-320` | 676 | 2 | (25,69)–(320,77) | hairline alias (§2.4) |
| `progress-training-390` | 826 | 2 | (48,69)–(390,77) | hairline alias (§2.4) |
| `progress-weight-390` | 5434 | 194 | (271,570)–(371,622) | chart "kg" unit 9.68 → 11px (§3.6) + hairline alias |
| `settings-320` | 765 | 2 | (0,69)–(320,77) | hairline alias (§2.4) |
| `settings-390` | 931 | 2 | (0,69)–(390,77) | hairline alias (§2.4) |
| `train-idle-320` | 1242 | 2 | (52,69)–(320,77) | hairline alias (§2.4) |
| `train-idle-390` | 1385 | 2 | (65,69)–(390,77) | hairline alias (§2.4) |
| `desktop-progress (flow)` | 5060 | 191 | (811,496)–(911,547) | chart "kg" unit 9.68 → 11px (§3.6) + hairline alias |
| `settings-app (flow)` | 4376 | 2 | (8,321)–(381,432) | hairline alias (§2.4) |
| `settings-appearance (flow)` | 891 | 2 | (0,69)–(390,77) | hairline alias (§2.4) |
| `settings-body (flow)` | 1178 | 8 | (0,69)–(390,77) | Evo marker fill alias (ΔE 1.70) |
| `settings-data (flow)` | 891 | 2 | (0,69)–(390,77) | hairline alias (§2.4) |
| `settings-training (flow)` | 891 | 2 | (0,69)–(390,77) | hairline alias (§2.4) |
| `train-idle-liftday (flow)` | 717 | 2 | (65,69)–(390,77) | hairline alias (§2.4) |

Size-only changes (screenshot pixels at 2×): `history-320` 640×2062 → 640×2230 (+84 CSS px); `history-390` 780×2162 → 780×2252 (+45 CSS px); `progress-weight-320` 640×5662 → 640×5664 (+1 CSS px); `today-320` 640×5326 → 640×5336 (+5 CSS px); `today-390` 780×5014 → 780×5024 (+5 CSS px); `desktop-today (flow)` 2560×4806 → 2560×4816 (+5 CSS px); `history-after-log (flow)` 780×2684 → 780×2774 (+45 CSS px); `settings-coach (flow)` 780×1918 → 780×1922 (+2 CSS px); `settings-goals (flow)` 780×2758 → 780×2766 (+4 CSS px); `sheet-cardio (flow)` 780×5014 → 780×5024 (+5 CSS px); `sheet-day-picker (flow)` 780×5014 → 780×5024 (+5 CSS px); `sheet-weighin (flow)` 780×5014 → 780×5024 (+5 CSS px); `sheet-why (flow)` 780×5014 → 780×5024 (+5 CSS px); `today-liftday (flow)` 780×4918 → 780×4928 (+5 CSS px)

Nothing is left unexplained. The largest difference outside the two intended text fixes is **8/255**.

### 5.3 Dead-CSS batches (frozen bed; pixels and computed style)

After every batch of ≤ 50 rules: all 21 test suites, static screenshots of every page at 390 and 320 and every flow frame, and a computed-style snapshot of ≈47.9k nodes in 43 states, compared with the state before any deletion (`verdict2.py`). A batch passes only with **0 computed-style differences (paint, type, geometry, nodes added or removed)** and every frame inside the envelope of known-good captures.

| batch | file | rules | bytes | tests | computed style (43 states) | frames outside the envelope | verdict |
|---|---|---|---|---|---|---|---|
| d1 | `premium-ui.css` | −50 (768 → 718) | 136,142 → 129,429 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d2 | `premium-ui.css` | −50 (718 → 668) | 129,429 → 122,031 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d3 | `premium-ui.css` | −50 (668 → 618) | 122,031 → 114,258 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d4 | `premium-ui.css` | −50 (618 → 568) | 114,258 → 109,172 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d5 | `premium-ui.css` | −6 (568 → 562) | 109,172 → 108,354 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d6 | `vnext.css` | −50 (649 → 599) | 99,176 → 92,695 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d7 | `vnext.css` | −50 (599 → 549) | 92,695 → 85,509 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |
| d8 | `vnext.css` | −17 (549 → 532) | 85,509 → 83,314 | 586 pass, 0 suites failing | paint 0, geometry 0, nodes 0 | 0 flagged on every run | IDENTICAL |

(The `vnext.css` rows start from 99,176 B because the 10-byte "kg" edit of §3.6 was already in; the original file is 99,166 B.)

Some flow frames carry aurora banding noise (≤ 16/255, up to 0.7% of the frame) that flips between two variants from run to run on identical code: seen on `train-active-*`, `train-finish`, `settings-appearance`, `sheet-weighin`, `sheet-day-picker` and `sheet-exercise-details`. §8.1 shows how that was established and handled; the d1 and d4 rows are the two batches a single noise mask had wrongly failed, re-judged against the envelope below.

### 5.4 The final tree: the real-tree snapshot with the dead rules deleted

Real-tree snapshot with my CSS (`rs-post1`, `:8765`) against the same snapshot with the final `premium-ui.css` and `vnext.css` (`rs-post2`, `:8767`); the JS and the other three files are the same bytes:

- **Computed style**, 43 states, 47,895 nodes: 0 paint or type changes, 0 geometry changes, 0 nodes added or removed. The only two numeric differences are the widths of timer-driven progress bars (`70%` → `70.67%` in the routine-edit sheet, `272.6px` → `274.5px` in the weigh-in sheet): time passes between captures.
- **Pages** (16 frames at 390 and 320): strictly identical (no pixel differs by more than 1 in any channel).
- **Flows** (29 frames), captured twice against two captures of the pre-deletion state: every frame lies inside the envelope. The plain strict diff post1 → post2 shows one stray pixel in `settings-appearance`; the second pair shows one in `settings-app`, one in `settings-data` (the same pixel also differs between two captures of the *same* CSS) and the noise-prone Exercise Details sheet (663 px, 0.04%), which is identical in the first pair.
- **Whole change set**, untouched CSS (`rs-pre`) → final (`rs-post2`): the attribution table of §5.2 is identical row for row, and the official 24-luma diff lists the same 5 + 9 size rows. The dead-rule deletions add no pixel to the change.

```
$ V2_STYLE=rs-post1-reduce V2_PAGES=rs-post1 V2_FLOWS=rs-post1-flows,rs-post1b-flows python3 verdict2.py rs-post2 rs-post2b
  run rs-post2  (pages + flows): 0 frame(s) outside the pre-deletion envelope
  run rs-post2b (flows only):    1 frame(s) outside the pre-deletion envelope: sheet-exercise-details.png 663px
[rs-post2+rs-post2b] style: paint=0 geometry=0 nodes=0; frames flagged in every run: 0
VERDICT: IDENTICAL (no style, geometry or pixel change; every frame inside the pre-deletion envelope)
```

## 6. Text fields under 16px (deliverable 4: pinch zoom is another agent's `<meta>`, so this is the list they need)

**None.** Every visible `input`, `select` and `textarea` that opens on a page or in a sheet computes to ≥ 16px at 390 and 320 (iOS Safari only zooms a focused field below 16px, so the `maximum-scale=1.0,user-scalable=no` now in the viewport meta, `index.html` line 5, is no longer needed to stop focus-zoom; removing it is the other agent's edit).

Measured by `ds-sheets.mjs` (`fieldsUnder16` is an empty list) and by `qa-sweep.mjs` (`inputs<16: 0` on all 16 screen-width pairs, before and after). Coverage:

- pages: Today, Train (idle and with a workout started: 2 fields, both 52px), Progress overview / Training / Performance / Body, History, Settings hub;
- Settings sub-views: goals (4 fields), training (0), coach (1), appearance (0), body (0), data (5, including the Supabase card `#sbUrl`, `#sbKey`, `#sbEmail`, `#sbPass`), app (0), every `<details>` fold opened first so the import box, SQL help and cloud card are measured;
- the routine editor, opened through the UI (Settings > Training > Full Body A): a list of exercise rows, no text field;
- the 15 sheets of §3.2 (46 fields over the two widths).

Before my changes the same sweep found none either (`inputs<16: 0` in `qa-ds-before-final.json`), so nothing in this pass changed the answer; the 16px floor of the D44 recipe now also holds for the Settings fields that were 50px tall.

## 7. Verification output (as run, not retyped)

### 7.1 Tests: `for f in wearables*.test.js; do node "$f" || echo FAIL $f; done` (real repo, final state)

```
$ for f in wearables*.test.js; do node "$f" || echo FAIL $f; done   (last line of each suite)
wearables.activity.test.js: OK  13 passed, 0 failed
wearables.adapters.test.js: OK  32 passed, 0 failed
wearables.canonical.test.js: OK  24 passed, 0 failed
wearables.coach.test.js: OK  48 passed, 0 failed
wearables.days.test.js: OK  16 passed, 0 failed
wearables.ingest.test.js: OK  32 passed, 0 failed
wearables.plan-persistence.test.js: OK  25 passed, 0 failed
wearables.progression.test.js: OK  18 passed, 0 failed
wearables.provider-garmin.test.js: OK  3 passed, 0 failed
wearables.recovery-integration.test.js: OK  32 passed, 0 failed
wearables.recovery.test.js: OK  28 passed, 0 failed
wearables.release-gate.test.js: OK  54 passed, 0 failed
wearables.resolution.test.js: OK  19 passed, 0 failed
wearables.snapshots.test.js: OK  26 passed, 0 failed
wearables.store.test.js: OK  34 passed, 0 failed
wearables.sw-strategy.test.js: OK  25 passed, 0 failed
wearables.sync.test.js: OK  47 passed, 0 failed
wearables.test.js: OK  18 passed, 0 failed
wearables.train-enrichment.test.js: OK  34 passed, 0 failed
wearables.training-readiness.test.js: OK  29 passed, 0 failed
wearables.weight-contract.test.js: OK  31 passed, 0 failed
=> 21 suites, 588 tests passed, no FAIL line
```

(586 tests at the start of the work; the two extra are other agents' new tests. No test was added, changed, weakened or deleted by me.)

### 7.2 Brace balance and the sky-literal grep gate (real tree, final state)

```
$ brace balance (comments and strings stripped; index.html = all <style> blocks)
strata.css       {  2314   }  2314   balanced
premium-ui.css   {   612   }   612   balanced
vnext.css        {   559   }   559   balanced
cut-support.css  {   205   }   205   balanced
index.html       {   742   }   742   balanced

$ for f in index.html premium-ui.css vnext.css cut-support.css strata.css; do grep -c -i -E "125,211,252|7dd3fc|bae6fd|a6e3fa" $f; done
index.html       0
premium-ui.css   0
vnext.css        0
cut-support.css  0
strata.css       0
```

### 7.3 Official runs on the real tree after everything (`ds-after2`, `localhost:8763`)

```
== shots ds-after2
done → /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/shots/ds-after2
no page/console errors, no overflow
== flows ds-after2
done → /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/shots/ds-after2-flows
logOne: no log button
routine editor (pre-existing flows.mjs issue): page.evaluate: TypeError: Cannot read properties of undefined (reading 'rows')
== qa-sweep ds-after2
390/reduce/more                  small:0 tiny:0 inputs<16:0 contrast:0 overflow:0 anims:0
→ /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/qa-ds-after2.json
REAL TREE UNCHANGED DURING ds-after2
(tree hashes: `real-ds-after2-hashes-start.txt` / `-end.txt`; strata.css, index.html, premium-ui.js, strata.js, cut-support.js and sw.js had been changed by other agents since `ds-after`; premium-ui.css and vnext.css are the files after my dead-rule deletions)
```

`pixdiff.py ds-before-final ds-after2` (the live tree kept moving: `strata.css`, `index.html`, `premium-ui.js`, `strata.js`, `cut-support.js` changed under other agents between the two runs, so this folder pair also contains their work; the previous pair `ds-before-final → ds-after` is the one that isolates mine):

```
$ python3 pixdiff.py shots/ds-before-final shots/ds-after2   and   shots/ds-before-final-flows shots/ds-after2-flows   (flagged rows only; 16 + 29 frames compared)
history-320.png                      size (640, 2062)->(640, 2230)   <-- differs
history-390.png                      size (780, 2162)->(780, 2252)   <-- differs
progress-weight-320.png              size (640, 5662)->(640, 5664)   <-- differs
today-320.png                        size (640, 5326)->(640, 5336)   <-- differs
today-390.png                        size (780, 5014)->(780, 5024)   <-- differs
desktop-today.png                    size (2560, 4806)->(2560, 4816)   <-- differs
history-after-log.png                size (780, 2684)->(780, 2774)   <-- differs
settings-coach.png                   size (780, 1918)->(780, 1922)   <-- differs
settings-goals.png                   size (780, 2758)->(780, 2716)   <-- differs
sheet-cardio.png                     size (780, 5014)->(780, 5024)   <-- differs
sheet-day-picker.png                 size (780, 5014)->(780, 5024)   <-- differs
sheet-weighin.png                    size (780, 5014)->(780, 5024)   <-- differs
sheet-why.png                        size (780, 5014)->(780, 5024)   <-- differs
splash-1300ms.png                    3.29%          (33, 26, 727, 1683)  <-- differs
today-liftday.png                    size (780, 4918)->(780, 4928)   <-- differs
```

Two rows differ from the `ds-after` pair, and neither is mine. `settings-goals` is 21 CSS px *shorter* than the baseline instead of 4px taller: between the two runs another agent shortened the "How your advice works" paragraph on that page (a three-way crop of baseline, `ds-after` and `ds-after2` shows the fields identical in the last two and only that paragraph changed; the snapshot pair with identical JS in §5.4 shows no change on the page). `splash-1300ms` is the splash animation again (3.29%). `qa-sweep.mjs` on this run gives the same totals as on `ds-after`: small targets 123 → 77, tiny text 44 → 0, contrast 0, inputs under 16px 0, overflow 0; items: 54 fixed, 70 changed, 0 new, 7 remaining.

### 7.4 Legacy sheets: `node ds-sheets.mjs http://localhost:8767 390,320 ds-sheets` (final snapshot before the §10 follow-up; the same audit after it is in §10: identical heights, 0 failures)

```
390/sheet/edit-set             legacy/legacy  fields:6 h=[52,64] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
390/sheet/substitute           legacy/legacy  fields:0 h=[] fs=[] btnH=[50,57] radius=28px grip=40pxx5px ok
390/sheet/add-exercise         legacy/legacy  fields:1 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
390/sheet/queue-manager        legacy/legacy  fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
390/sheet/replace-exercise     legacy/legacy  fields:1 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
390/sheet/exercise-note        n99/legacy     fields:1 h=[62] fs=[16] btnH=[44,50] radius=28px grip=40pxx5px ok
390/sheet/edit-weigh-in        legacy/legacy  fields:3 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
390/sheet/bodyweight-prompt    legacy/legacy  fields:1 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
390/sheet/pr-sheet             legacy/legacy  fields:0 h=[] fs=[] btnH=[50] radius=28px grip=40pxx5px ok
390/sheet/daily-archive        n99/legacy     fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
390/sheet/session-complete     legacy/legacy  fields:0 h=[] fs=[] btnH=[50,54] radius=28px grip=40pxx5px ok
390/sheet/weigh-in             n99/n99        fields:3 h=[92,52,46] fs=[64,16] btnH=[42,44,50,56] radius=28px grip=40pxx5px BAD(5)
390/sheet/cardio               n99/n99        fields:7 h=[52] fs=[16] btnH=[44,50] radius=28px grip=40pxx5px ok
390/sheet/why                  n99/n99        fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
390/sheet/day-picker           n99/n99        fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
320/sheet/edit-set             legacy/legacy  fields:6 h=[52,64] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/substitute           legacy/legacy  fields:0 h=[] fs=[] btnH=[50,57,72] radius=28px grip=40pxx5px ok
320/sheet/add-exercise         legacy/legacy  fields:1 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/queue-manager        legacy/legacy  fields:0 h=[] fs=[] btnH=[44,50,74] radius=28px grip=40pxx5px ok
320/sheet/replace-exercise     legacy/legacy  fields:1 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/exercise-note        n99/legacy     fields:1 h=[62] fs=[16] btnH=[44,50] radius=28px grip=40pxx5px ok
320/sheet/edit-weigh-in        legacy/legacy  fields:3 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/bodyweight-prompt    legacy/legacy  fields:1 h=[52] fs=[16] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/pr-sheet             legacy/legacy  fields:0 h=[] fs=[] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/daily-archive        n99/legacy     fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
320/sheet/session-complete     legacy/legacy  fields:0 h=[] fs=[] btnH=[50] radius=28px grip=40pxx5px ok
320/sheet/weigh-in             n99/n99        fields:3 h=[92,52,46] fs=[64,16] btnH=[42,44,50,56] radius=28px grip=40pxx5px BAD(5)
320/sheet/cardio               n99/n99        fields:7 h=[52] fs=[16] btnH=[44,50] radius=28px grip=40pxx5px ok
320/sheet/why                  n99/n99        fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
320/sheet/day-picker           n99/n99        fields:0 h=[] fs=[] btnH=[44,50] radius=28px grip=40pxx5px ok
fields under 16px (all pages + sheets): 0
FAILURES: 0
→ /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/shots/ds-sheets
ds-sheets exit 0
```

The same audit on the live tree at 17:2x (`localhost:8763`, tag `ds-sheets-live`): 0 failures, 0 fields under 16px, no page or console errors (`errcheck`), and `reduced-sheets.mjs` all ok.

### 7.5 Reduced motion: `node reduced-sheets.mjs http://localhost:8767`

```
media   edit-set           running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
media   substitute         running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
media   add-exercise       running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
media   queue-manager      running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
media   bodyweight-prompt  running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
media   session-complete   running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
switch  edit-set           running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
switch  substitute         running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
switch  add-exercise       running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
switch  queue-manager      running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
switch  bodyweight-prompt  running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
switch  session-complete   running@150ms=[] anim=none modalAnim=none settled opacity=1 transform=none ok
none    edit-set           running@150ms=["CSSTransition","CSSTransition","CSSTransition","CSSTransition","CSSTransition","st-sheet-in"] anim=st-sheet-in modalAnim=nxt-dim-in settled opacity=1 transform=matrix(1, 0, 0, 1, 0, 0) ok
none    substitute         running@150ms=["st-sheet-in"] anim=st-sheet-in modalAnim=nxt-dim-in settled opacity=1 transform=matrix(1, 0, 0, 1, 0, 0) ok
none    add-exercise       running@150ms=["CSSTransition","CSSTransition","CSSTransition","CSSTransition","CSSTransition","st-sheet-in"] anim=st-sheet-in modalAnim=nxt-dim-in settled opacity=1 transform=matrix(1, 0, 0, 1, 0, 0) ok
none    queue-manager      running@150ms=["st-sheet-in"] anim=st-sheet-in modalAnim=nxt-dim-in settled opacity=1 transform=matrix(1, 0, 0, 1, 0, 0) ok
none    bodyweight-prompt  running@150ms=["CSSTransition","CSSTransition","CSSTransition","CSSTransition","CSSTransition","st-sheet-in"] anim=st-sheet-in modalAnim=nxt-dim-in settled opacity=1 transform=matrix(1, 0, 0, 1, 0, 0) ok
none    session-complete   running@150ms=["st-sheet-in"] anim=st-sheet-in modalAnim=nxt-dim-in settled opacity=1 transform=matrix(1, 0, 0, 1, 0, 0) ok
all legacy sheets: no running animation under reduced motion (media and in-app switch); full opacity when settled
reduced-sheets exit 0
```

### 7.6 No page errors

`shots.mjs`, `flows-ds.mjs` and `qa-sweep.mjs` all report "no page/console errors, no overflow" on the real tree and on every snapshot and bed run, with one exception explained in §8.2 (item 5): during one audit of the live tree two `ReferenceError`s (`dressRecap`, `bindHold`) came from another agent's in-flight JS, and were gone on re-run.

## 8. Reverted, not done, deviations and follow-ups

### 8.1 Reverted or abandoned on the way (nothing of this reached the repo)

- **Alias candidates that moved pixels** (§2 policy): `--purple/--green/--sky`, `--vn-violet-lift`, `--vn-surface*`, `--vn-r-*`, the older motion curves, and `--nxt-surface-alt → --st-surface` (ΔE 3.3 on the `:active` chip, fixed by adding the value-identical `--st-surface-2`).
- **A first dead-CSS test fence that was too weak.** Batch 2 of the premium-ui.css run (on the frozen bed) failed `wearables.release-gate.test.js › "the comparison line is typography, not three cards"`: the test slices `premium-ui.css` and looks for the text `.nxp-aim-cell {`, which was only present inside the dead rule `.nxp-train-lift .nxp-aim-cell {`. My analysis only protected rules whose *dead* class appeared in a test; a test that names a *live* class in a selector it slices for pins the rule too. Fixed in `dead-css.py` (a rule is pinned when any string literal in a test that reads a stylesheet occurs in its text; bare single-token DOM queries do not count). Candidates fell from 222 to 206 (premium-ui.css) and 124 to 117 (vnext.css); batch 1, already run, was re-checked against the new list (all 50 of its rules are still candidates). No test was changed or weakened.
- **A verdict method that was too strict.** The Train-active frames (and `settings-appearance`, `sheet-weighin`, `sheet-day-picker`) render with aurora banding noise of up to 16/255 that flips between two variants from run to run **with identical code** (proved: the same frame differs between runs of the undeleted CSS, and between two runs of the same already-validated state). A single noise mask therefore failed batch 1 and batch 4 on frames the deletion did not touch. The control for batch 4: the 15,008-pixel `settings-appearance` difference (≤ 6/255, aurora contours) showed up in both runs of batch 4 *and* in a render of the already-validated batch-3 state made minutes later (`e3`), while a render of the batch-4 state made after that (`e4`) matched the baseline exactly, and a second render of the batch-3 state (`e3b`) did too. The final verdict (`verdict2.py`) accepts a frame that lies inside the envelope of several captures of known-good states, tolerates ≤ 3 stray anti-alias pixels, requires a flagged frame to be flagged again on a rerun of the same code, and still requires **zero** computed-style differences over 43 states. The computed-style comparison, not the pixels, is the primary guard.

### 8.2 Deviations from the brief, and judgement calls

1. **Five sky literals outside the inline `<style>`** were changed (§3.3), because the grep gate you set covers the whole file.
2. **"Dead" means "cannot match"**, not "every class is dead". A rule is a candidate when at least one class, id or data attribute it *requires* has no emitter anywhere (premium-ui.js, strata.js, cut-support.js, coach.js, train-anatomy.js, seed.*, index.html in full, every other non-test `.js`); a descendant rule such as `.nxp-train-lift .nxp-aim-cell` can never match if `.nxp-train-lift` is never produced, however live `.nxp-aim-cell` is elsewhere. Names built from a stem (`'st-es-'+k`) count as live. If you read the brief as "every class dead", the candidate list shrinks; the list is in `ds/dead-final2.json`.
3. **cut-support.css: nothing deleted.** 21 of its 200 rules (2,111 B) are dead by the same test, and all 21 are in the `.n99-*` / `.apx96-*` / `.modal` / `.sheet` families you told me not to touch. They are listed in Appendix A; say the word and they go.
4. **The release is not bumped.** The stylesheets load as `?v=161`; an installed PWA keeps its cached copy until the owner bumps `RELEASE` (and `sw.js` lists the same files at that version). No file was added, so the `sw.js` precache list needed no edit (the release-gate test confirms).
5. **Per-step verification ran on a frozen bed**, not on the live tree: other agents edited `premium-ui.js`, `strata.js`, `sw.js` and the end of `strata.css` continuously (during one of my audits the live tree threw `ReferenceError: dressRecap is not defined` in `strata.js` and `bindHold is not defined` from their in-flight JS; a re-run minutes later was clean, and none of it touches CSS). The bed (`:8764`) is the working tree of 15:07 plus my edits; the real-tree snapshots (`:8765` / `:8766`) are the tree of 16:23 with and without my CSS, with identical JS. The official `ds-before-final` / `ds-after` runs on `:8763` are also reported (§5.1).
6. **Scratch-path incident (disclosure).** I once mistyped a scratchpad path (`/private/tmp/claude-501/-Users-alidanial/Documents-NXTFRM/…`), which created a directory under `/private/tmp/claude-501/`; I moved the file I had written there and then ran `rm -rf /private/tmp/claude-501/-Users-alidanial`. That is the temp area only and it held what I had just created, but I cannot rule out that a separate session whose working directory is `/Users/alidanial` had scratch files under the same name. Nothing in the repo was involved.

7. **Gated decisions untouched.** D5 (legacy renderer removal) and D4 (`readiness()`) are separately gated: no JS was removed. The CSS I deleted styles classes that no renderer, legacy or current, produces (the emitter list includes the legacy renderers inside `index.html`).

### 8.3 Follow-ups for the owner or another workstream

- **F1 `strata.js bindSheets()`**: change the `.n99-modal .sheet` selector to `.modal .sheet` so the nine legacy sheets also get swipe-to-close and the page recede.
- **F2 legacy sheet markup**: add the close button (index.html builders) so the whole family has the same affordance.
- **F3 uppercase button copy**: 15 legacy sheet button labels are capitals in the index.html templates (SAVE CHANGES, CANCEL, NICE, …; list with line numbers in §10); the n99 buttons are sentence case. Changing the copy is a template edit.
- **F4 Settings legacy cards**: the Supabase "Cloud backup" and scan cards still use the legacy `.btn` rectangles and wide-tracked uppercase labels.
- **F5 n99 weigh-in sheet** (pre-existing): horizontal scroll inside the sheet (400 > 388 at 390, 330 > 318 at 320), 42px timing pills, a 46px date field.
- **F6 small targets that are layout-limited**: the History calendar cells (36 / 29px wide in 7 columns, 44px tall now), the Today week rail at 320 (35px cells).
- **F7 the 13 names left unaliased** (§2.3): `--purple`, `--green`, `--sky`, `--vn-violet-lift`, `--vn-surface*`, `--vn-r-*`, `--muted`, `--muted2`, `--red`, `--vn-ink-4` each need a visible-change decision.
- **F8 the 21 dead `.n99-*` / `.apx96-*` rules in cut-support.css** (Appendix A).

## 9. Provenance: what changed, where, and the hashes

| file | before my edits | after my edits (16:09) | final (this report) | what is mine |
|---|---|---|---|---|
| `strata.css` | `7a360dcf` · 269,872 B | `7ead74ad` · 284,823 B | `16157b03` · 287,266 B after the §10 follow-up (others kept editing the end of it) | canonical set lines 45–57, alias block 59–98, sheet and targets block 99–181 |
| `index.html` | `6907794b` · 353,743 B | `94a6d7d5` · 353,701 B | `158836e1` · 354,466 B (others' head and script edits) | 10 exact string edits, §3.3: the inline `<style>` plus 5 literals in script templates |
| `vnext.css` | `b4a84771` · 99,166 B | `d2ef6d60` · 99,176 B | `14127bc4` · 83,314 B | one declaration (the "kg" unit label), then 117 dead rules |
| `premium-ui.css` | `851f1d7a` · 136,142 B | unchanged | `abb19b41` · 108,711 B | 204 dead rules |
| `cut-support.css` | `efd15349` · 20,105 B | unchanged | unchanged | – |

Between the end of the baseline run and the start of the `ds-after` run, the only files whose hash changed were the three I edited (`real-ds-after-hashes-start.txt` against `real-r0-hashes-after.txt`: `strata.css`, `vnext.css`, `index.html`); `premium-ui.js`, `strata.js`, `cut-support.js`, `coach.js`, `sw.js`, `premium-ui.css` and `cut-support.css` were the same bytes in both. The `ds-after` run itself reported "REAL TREE UNCHANGED DURING ds-after".

The three edit applications used exact-string replacement (each `old` string had to occur once, or the stated number of times), with a check that nobody else had written the file between my read and my write, and an atomic rename; no whole shared file was rewritten. No git state was changed (no commit, push, stash, reset, clean or branch switch).

`git diff --stat` for the two files that are purely mine: `premium-ui.css` 743 deletions, 0 insertions; `vnext.css` 1 insertion (the `max(11px,.44em)` declaration), the rest deletions.

Scratch material (edit definitions, dead-rule JSON, batch logs, per-batch backups of both stylesheets) is in the session scratchpad and `~/Library/Caches/DanDev/nxtfrm/ascension/`; it is not in the repo.

## 10. Follow-up: sentence case in the nine legacy sheets

**Asked.** The legacy sheet buttons and eyebrows still read in tracked capitals ("SAVE CHANGES", "REPLACE EXERCISE", "SAME SPLIT") while every Strata capsule and eyebrow is sentence case (D42, D56). Match them; keep "Delete set" a glass capsule with the rose word (I2); if a capital comes from the markup string, leave the markup and report it.

**Where the capitals came from** (computed `text-transform` against the text itself, `case-probe2.mjs`, all nine sheets):

- **Eyebrows and section labels were CSS**: the legacy inline rules (`.kicker`, `.smart-section-label`, `.metric span`, `.pr-tag`, `.coach-panel-title`: 9–11px, 950–1000 weight, up to .16em tracking, `text-transform:uppercase`) and, for `.kicker`, `.apx95-card-kicker`, `.smart-section-label` and `.apx96-kicker`, my own §3.2 rules, which had re-asserted uppercase at 12px / .08em. Fixed.
- **Button labels are capitals in the markup**: `text-transform` was already `none` on every one of them, so CSS cannot change them. Not touched.

**What changed** (`strata.css`, inside the sheet block, lines 99–181; 7 exact edits; nothing at the end of the file):

| element | before | after |
|---|---|---|
| eyebrows and section labels: `.kicker`, `.apx95-card-kicker`, `.smart-section-label`, `.apx96-kicker`, `.coach-panel-title` | uppercase, 9–12px, .08–.16em, weight 550–1000 | sentence case, 560 13px/1.2, no tracking, `--st-ink-2`: the final `.st-cat` rule of D42 |
| `.metric span` | uppercase, 11px, 1.76px tracking, weight 950 | sentence case, 500 12px, `--st-ink-3` |
| `.pr-tag` | uppercase, 11px, 1000 | sentence case, 600 13px |
| `.pill`, `.coach-source` | 11px, weight 900–1000 | Geist 560 12px, no tracking |
| `.btn` (primary) | Geist 620 14px, .05em | Geist 620 16px/24px, −.012em: the n99 primary |
| `.btn.secondary`, `.btn.danger` (glass) | Geist 560 14px, .05em | Geist 560 16px, −.005em: the n99 glass. Danger stays a glass capsule with the rose word (`--st-fat`), not a fill |
| `.apx96-chip` | Geist 560 13px | Geist 560 14px, −.005em (the `.st-chip` size); the REPLACE / NOTE / REMOVE row still fits on one line at 320 |
| session summary: inner `.title`, `.coach-title`, `.coach-panel-main` | weights 950, 1000, 850 | 600, 600, 560 (D42's 1000-weight rule) |

Button heights are unchanged (50px; chips 44px). Sheet heights move by 0 to +8px at 390 (session summary +8, PR sheet +3, edit weigh-in +2, substitute +1; the other five are identical; 320 is the same except the session summary, which is already at the 756px cap), because the eyebrows are 13px instead of 12px; nothing wraps differently or overflows at 390 or 320. After the change a probe of all nine sheets finds no element with `text-transform` other than `none`, no tracked caps and no weight of 850 or more; the only capitals left are the button strings below.

**Still capitals, because the strings themselves are capitals** (a copy edit in the `index.html` templates; current line numbers):

| builder | strings |
|---|---|
| `showPRSheet` (3525) | NICE |
| `showSubstituteSheet` (4019) | CANCEL |
| `openEditSet` (5804–5806) | SAVE CHANGES, DELETE SET, CANCEL |
| `completionSummaryHTML`, the session summary sheet (5939–5940) | LOG ZONE 2, FINISH |
| `showWeightPrompt` (7367) | SAVE, NOT NOW |
| `apx95EditWeight` (7951–7953) | SAVE CHANGES, DELETE ENTRY, CANCEL |
| `apx96OpenQueueManager` (8053–8056) | ＋ ADD, REPLACE, NOTE, REMOVE (the per-row chips), RESET QUEUE, DONE |

I did not force sentence case from CSS (`text-transform:lowercase` plus `::first-letter`): `::first-letter` only applies to block containers (the capsules are `display:flex`), its behaviour on a `<button>` differs between engines, and I can only test Chrome; where it failed (iPhone Safari is the likely place) the labels would come out all lower case. The copy edit is 15 string changes.

**Checked.** `ds-sheets.mjs` on the final snapshot with the change: 0 failures at 390 and 320, fields 52px and 16px, buttons 50px (chips 44px), no overflow, field and button heights identical to the table in §3.2; on the live tree (`ds-sheets-live2`): 0 failures; `reduced-sheets.mjs` all ok; `errcheck` no page or console errors; 21 suites / 588 tests pass. I viewed the nine sheets at 390 and 320 (contact sheets of `shots/ds-sheets/`, the snapshot with identical JS; `ds-sheets-live2/` is the live tree; `ds-sheets-case-before/` is the run before this change).

## Appendix A. Dead rules that were kept on purpose

Dead by the static test, not deleted. Family-fenced rules are the `.modal` / `.sheet` / `.n99-*` / `.apx96-*` / `#modalRoot` rules you told me to leave; test-pinned rules are rules a test that reads the stylesheet needs to find. Real-tree analysis.

**`premium-ui.css`: dead but kept, family fence (`.modal`, `.sheet`, `.n99-*`, `.apx96-*`, `#modalRoot`): 53 rules, 6,851 B**

<details><summary>list</summary>

- L736 `.n99-chart-svg .n99-chart-post-mark` (105 B)
- L890 `.nxp-calories + .n99-quick` (101 B)
- L891 `.nxp-calories + .n99-quick .n99-button` (196 B)
- L892 `.nxp-calories + .n99-small` (72 B)
- L893 `.nxp-trend .n99-stats` (44 B)
- L899 `.nxp-quick > .n99-button` (90 B)
- L910 `.nxp-home-chrome .n99-button` (306 B)
- L1013 `.nxp-home-weight .n99-text` (81 B)
- L1106 `.nxp-home .n99-quick` (141 B)
- L1107 `.nxp-home .n99-quick .n99-button` (212 B)
- L1108 `.nxp-home > .n99-small` (80 B)
- L1110 `.nxp-home-secondary .n99-text` (87 B)
- L1112 `.nxp-home .n99-week` (54 B)
- L1113 `.nxp-home .n99-day` (55 B)
- L1114 `.nxp-home .n99-day b` (65 B)
- L1115 `.nxp-home-trend .n99-metric strong` (58 B)
- L1119 `.nxp-home-trend .n99-stats` (57 B)
- L1120 `.nxp-home .n99-week` (119 B)
- L1126 `.nxp-home .n99-day` (144 B)
- L1141 `.nxp-home-today > .n99-row` (55 B)
- L1344 `.nxp-train-lift .nxp-train-chrome .n99-button` (272 B)
- L1846 `.nxp-train-lift .nxp-rest .n99-button` (334 B)
- L2006 `.nxp-train-lift .nxp-session-tools .n99-button` (201 B)
- L2086 `.nxp .n99-chart-selected strong` (53 B)
- L2089 `.nxp .n99-chart-selected .n99-chart-post` (57 B)
- L2090 `.nxp .n99-chart-selected .n99-chart-post > span` (208 B)
- L2097 `.nxp .n99-chart-selected .n99-chart-post b` (224 B)
- L2105 `.nxp .n99-chart-selected .n99-chart-post small` (163 B)
- L2106 `.nxp .n99-chart-selected #n99-chart-timing` (136 B)
- L2153 `.nxp-progress-hero-primary #n99-chart-weight` (63 B)
- L2160 `.nxp-progress-hero .n99-chart-selected` (157 B)
- L2167 `.nxp-progress-hero .n99-chart-selected > div` (80 B)
- L2168 `.nxp-progress-hero .n99-chart-selected > div[hidden]` (81 B)
- L2176 `.nxp-progress-hero .n99-chart-selected > div.n99-chart-post[hidden]` (142 B)
- L2181 `.nxp-progress-hero .n99-chart-selected > div:not(:first-child)` (273 B)
- L2191 `.nxp-progress-hero .n99-chart-selected > div:not(:first-child) > span` (99 B)
- L2192 `.nxp-progress-hero .n99-chart-selected > div:not(:first-child) > b` (180 B)
- L2196 `.nxp-progress-hero .n99-chart-selected > div:not(:first-child) > small` (122 B)
- L2199 `.nxp-progress-hero .n99-chart-selected strong` (173 B)
- L2206 `.nxp-progress-hero .n99-chart-selected strong small` (105 B)
- L2207 `.nxp-progress-hero .n99-chart-selected span` (96 B)
- L2208 `.nxp-progress-hero .n99-chart-selected b` (175 B)
- L2215 `.nxp-progress-hero .n99-chart-selected small` (99 B)
- L2233 `.nxp-progress-weight .n99-chart-controls` (192 B)
- L2274 `.nxp-progress .n99-chart-controls > label` (126 B)
- L2288 `.nxp-progress-weight .n99-scrubber` (51 B)
- L2351 `.nxp-progress-strength-body > .n99-card` (157 B)
- L2430 `.nxp-progress-strength .n99-spark path[stroke="#edc481"]` (76 B)
- L2544 `.nxp-progress-hero .n99-chart-selected` (102 B)
- L2545 `.nxp-progress-hero .n99-chart-selected strong` (67 B)
- L2546 `.nxp-progress-hero .n99-chart-selected > div:last-child` (76 B)
- L2568 `.n99.nxp .nxp-group-title` (300 B)
- L2732 `.n99.nxp.nxp-more .nxp-group-title` (89 B)

</details>

**`premium-ui.css`: dead but kept, pinned by a test that reads the stylesheet: 44 rules, 7,737 B**

<details><summary>list</summary>

- L574 `.nxp-surface` (166 B) — test:text:.nxp-surface {
- L580 `.nxp-surface-raised` (214 B) — test:text:.nxp-surface-raised {
- L1111 `.nxp-home-week,.nxp-home-trend` (114 B) — test:nxp-home-week
- L1388 `.nxp-train-lift .nxp-rail-jump` (360 B) — test:text:height: var(--nxt-touch-min)
- L1410 `.nxp-ex-head` (100 B) — test:nxp-ex-head
- L1429 `.nxp-train-lift .nxp-ex-head h2` (208 B) — test:nxp-ex-head
- L1451 `.nxp-train-lift .nxp-ex-chip` (476 B) — test:text:height: var(--nxt-touch-min)
- L1485 `.nxp-train-lift .nxp-aim-cell` (261 B) — test:text:.nxp-aim-cell {
- L1498 `.nxp-train-lift .nxp-aim-cell + .nxp-aim-cell` (136 B) — test:text:.nxp-aim-cell {
- L1502 `.nxp-train-lift .nxp-aim-cell.is-tappable` (79 B) — test:text:height: var(--nxt-touch-min)
- L1551 `.nxp-train-lift .nxp-aim-cell.is-tappable:active b` (85 B) — test:nxp-aim-cell
- L1555 `.nxp-train-lift .nxp-coach summary` (327 B) — test:text:height: var(--nxt-touch-min)
- L1685 `.nxp-train-lift .nxp-step:active, .nxp-train-lift .nxp-step.is-held` (185 B) — test:text:.nxp-step:active
- L1691 `.nxp-train-lift .nxp-step:disabled` (52 B) — test:text:.nxp-step:disabled
- L1751 `.nxp-train-lift .nxp-seg button` (69 B) — test:text:height: var(--nxt-touch-min)
- L1781 `.nxp-train-lift .nxp-train-cta:active` (105 B) — test:text:.nxp-train-cta:active
- L1785 `.nxp-train-lift .nxp-train-cta:disabled` (92 B) — test:text:.nxp-train-cta:disabled
- L1877 `.nxp-ex-nav` (143 B) — test:nxp-ex-nav
- L1883 `.nxp-ex-nav button` (477 B) — test:nxp-ex-nav
- L1899 `.nxp-ex-nav button:active` (105 B) — test:nxp-ex-nav
- L1900 `.nxp-ex-nav button:disabled` (107 B) — test:text:.nxp-ex-nav button:disabled
- L1901 `.nxp-ex-nav button span` (60 B) — test:nxp-ex-nav
- L1902 `.nxp-ex-nav .nxp-ex-nav-pos` (218 B) — test:text:width: var(--nxt-touch-min)
- L1910 `.nxp-ex-nav .nxp-ex-nav-pos:active` (90 B) — test:nxp-ex-nav
- L1928 `.nxp-train-lift .nxp-set-row` (332 B) — test:text:height: var(--nxt-touch-min)
- L2069 `.nxp-train-lift .nxp-aim-cell:nth-child(3)` (203 B) — test:nxp-aim-cell
- L2079 `.nxp-train-lift .nxp-ex-head h2` (57 B) — test:nxp-ex-head
- L2080 `.nxp-ex-nav button` (38 B) — test:nxp-ex-nav
- L2964 `.nxp-train-lift .nxp-step:active, .nxp-train-lift .nxp-step.is-held` (94 B) — test:text:.nxp-step:active
- L2973 `.nxp-train-lift .nxp-train-cta:active` (65 B) — test:text:.nxp-train-cta:active
- L2983 `.nxp-train-lift .nxp-ex-head` (106 B) — test:nxp-ex-head
- L3196 `.nxp-train-lift .nxp-ex-title` (323 B) — test:nxp-ex-title
- L3211 `.nxp-train-lift .nxp-ex-title:active` (74 B) — test:nxp-ex-title
- L3212 `.nxp-train-lift .nxp-ex-title:focus-visible` (157 B) — test:text::focus-visible
- L3217 `.nxp-train-lift .nxp-ex-muscles` (175 B) — test:nxp-ex-muscles
- L3229 `.nxp-train-lift .nxp-ex-top` (143 B) — test:nxp-ex-top
- L3237 `.nxp-train-lift .nxp-ex-anat` (516 B) — test:text:height: var(--nxt-touch-min)
- L3253 `.nxp-train-lift .nxp-ex-anat:focus-visible` (156 B) — test:text::focus-visible
- L3261 `.nxp-train-lift .nxp-ex-top` (56 B) — test:nxp-ex-top
- L3283 `.nxp-train-lift .nxp-ex-top.is-forward .nxp-ex-text` (140 B) — test:nxp-ex-top
- L3286 `.nxp-train-lift .nxp-ex-top.is-back .nxp-ex-text` (134 B) — test:nxp-ex-top
- L3289 `.nxp-train-lift .nxp-ex-top.is-forward .nxp-ex-anat, .nxp-train-lift .nxp-ex-top.is-back .nxp-e…` (177 B) — test:nxp-ex-top
- L3294 `.nxp-train-lift .nxp-ex-anat, .nxp-train-lift .nxp-ex-anat .nxa, .nxp-train-lift .nxp-ex-top.is…` (221 B) — test:nxp-ex-top
- L3302 `:root[data-nxp-motion="reduced"] .nxp-train-lift .nxp-ex-anat, :root[data-nxp-motion="reduced"]…` (341 B) — test:text:[data-nxp-motion="reduced"]

</details>

**`vnext.css`: dead but kept, family fence (`.modal`, `.sheet`, `.n99-*`, `.apx96-*`, `#modalRoot`): 2 rules, 370 B**

<details><summary>list</summary>

- L473 `#trainPage .vn-train-tools-panel .nxp-session-tools .n99-button` (130 B)
- L780 `#trainPage .vn-train-ready .n99-button` (240 B)

</details>

**`vnext.css`: dead but kept, pinned by a test that reads the stylesheet: 19 rules, 3,091 B**

<details><summary>list</summary>

- L393 `#trainPage .nxp-ex-top.is-forward .nxp-ex-text, #trainPage .nxp-ex-top.is-back .nxp-ex-text` (124 B) — test:nxp-ex-top
- L399 `:root[data-nxp-motion="reduced"] #homePage .vn-act:active` (73 B) — test:text:[data-nxp-motion="reduced"]
- L514 `#trainPage .vn-train-active .nxp-ex-head` (135 B) — test:nxp-ex-head
- L517 `#trainPage .vn-train-active .nxp-ex-title` (351 B) — test:nxp-ex-title
- L524 `#trainPage .vn-train-active .nxp-ex-muscles` (103 B) — test:nxp-ex-muscles
- L542 `#trainPage .vn-train-active .nxp-ex-top` (103 B) — test:nxp-ex-top
- L585 `#trainPage .vn-aim .nxp-aim-cell` (143 B) — test:text:.nxp-aim-cell {
- L589 `#trainPage .vn-aim .nxp-aim-cell + .nxp-aim-cell` (73 B) — test:text:.nxp-aim-cell {
- L667 `#trainPage .vn-train-active .nxp-step:active, #trainPage .vn-train-active .nxp-step.is-held` (191 B) — test:text:.nxp-step:active
- L691 `#trainPage .vn-train-active .nxp-train-cta:active` (95 B) — test:text:.nxp-train-cta:active
- L730 `:root[data-nxp-motion="reduced"] #trainPage .vn-train-active .nxp-train-cta.is-kb, :root[data-n…` (229 B) — test:text:[data-nxp-motion="reduced"]
- L738 `#trainPage .vn-train-active .nxp-ex-nav` (186 B) — test:nxp-ex-nav
- L742 `#trainPage .vn-train-active .nxp-ex-nav > button` (258 B) — test:nxp-ex-nav
- L748 `#trainPage .vn-train-active .nxp-ex-nav > button:disabled` (70 B) — test:nxp-ex-nav
- L867 `#trainPage .vn-train-active .nxp-ex-title` (57 B) — test:nxp-ex-title
- L872 `#trainPage .vn-aim.wrap3 .nxp-aim-cell` (52 B) — test:text:.nxp-aim-cell {
- L894 `#trainPage .vn-train-active .nxp-ex-top.is-forward .nxp-ex-anat, #trainPage .vn-train-active .n…` (196 B) — test:nxp-ex-top
- L899 `#trainPage .vn-train-active .nxp-ex-anat, #trainPage .vn-train-active .nxp-ex-anat .nxa, #train…` (266 B) — test:nxp-ex-top
- L907 `:root[data-nxp-motion="reduced"] #trainPage .vn-train-active .nxp-ex-anat, :root[data-nxp-motio…` (386 B) — test:text:[data-nxp-motion="reduced"]

</details>

**`cut-support.css`: dead but kept, family fence (`.modal`, `.sheet`, `.n99-*`, `.apx96-*`, `#modalRoot`): 21 rules, 2,111 B**

<details><summary>list</summary>

- L17 `.apx96-rest` (127 B)
- L115 `.n99-unit` (102 B)
- L116 `.n99-chart-controls` (111 B)
- L122 `.n99-chart-controls label` (101 B)
- L123 `.n99-chart-selected` (118 B)
- L124 `.n99-chart-selected > div` (42 B)
- L125 `.n99-chart-selected > div:last-child` (58 B)
- L126 `.n99-chart-selected span` (102 B)
- L127 `.n99-chart-selected strong` (221 B)
- L128 `.n99-chart-selected strong small` (132 B)
- L129 `.n99-chart-selected b` (147 B)
- L130 `.n99-chart-selected small` (93 B)
- L132 `.n99-scrubber` (127 B)
- L133 `.n99-scrubber::-webkit-slider-runnable-track` (97 B)
- L134 `.n99-scrubber::-webkit-slider-thumb` (186 B)
- L148 `.n99-chart-hint` (95 B)
- L197 `.n99 .nxt98-timer-actions button` (83 B)
- L204 `.n99-chart-selected strong` (46 B)
- L205 `.n99-chart-selected strong` (46 B)
- L205 `.n99-chart-controls` (32 B)
- L205 `.n99-chart-controls label` (45 B)

</details>
