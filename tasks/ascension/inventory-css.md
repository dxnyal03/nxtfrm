# NXTFRM CSS layer inventory

Read-only audit of the five stylesheets on branch `ascension` (baseline commit `029eb51`). Generated 2026-10-13. Nothing was edited except this file. No git state was changed and the app was not run. All numbers are produced by a static parser over one frozen snapshot of the working tree, taken at 12:49 local time on 2026-10-13 (sha1: index.html a4b92622, premium-ui.js 9e31423, strata.css 5924fd8e, premium-ui.css 851f1d7a, vnext.css b4a84771, cut-support.css efd15349). At that moment `git status` showed index.html and premium-ui.js as modified and uncommitted, and they were still changing. The CSS files were not modified. The index.html edit adds 8 lines at lines 6 to 13 (a `style` attribute on `<html>`, a `color-scheme` meta and a new theme-color), so every index.html line from 6 on is 8 higher than in HEAD (029eb51). Citations use snapshot numbering throughout; the inline style text is unchanged.

## Key findings

1. **D54 ("no green, teal or cyan remains in any stylesheet") is not met at the literal level.** No green literal (hue 70 to 160 degrees) and no named colour appears in any declaration. But 50 teal and cyan usages survive in the inline `<style>` (index.html:56 to index.html:2541: `rgba(125,211,252,…)`, `#7dd3fc`, `#bae6fd`, `#a6e3fa`). 45 of them sit in rules that match markup. The two `--sky` definitions (index.html:42, 2169) are shadowed by index.html:2351 (`#aa7afa`), so the token now resolves to violet, but the name and literal remain.
2. **Blue-ish literals: 40 occurrences** (strata 31, vnext 5, inline 4). Mostly indigo tints (`rgba(99,102,241,…)`, `#5552BB` for D54 "pull"), the blue-violet `--st-lift` `#8B7CFF` (strata.css:22) and cool-grey tints (`rgba(148,163,184,.1)` at strata.css:58; `#79818F` at vnext.css:1095, 1100, 1162).
3. **The Today aurora probably renders empty.** `--st-a1` to `--st-a4` are defined only under `:root[data-st-tab="train|weight|history|more"]` (strata.css:55 to 58). Today sets `data-st-tab="home"` (strata.js:964, tab at index.html:2710), so `body::before` (strata.css:61 to 76) reads undefined custom properties with no fallback. This is a static reading; confirm in a browser before changing anything.
4. **Token sprawl.** 281 root token names carry 343 definitions. 19 names are defined in two or more files with different values, and the value that wins is whichever file loads last. 56 names have no `var()` reference anywhere. Eight names are listed for the canvas colour in section 1.2, and the page is painted by a literal `#07060B` (strata.css:59).
5. **Strata wins by `!important`.** strata.css carries 1237 of 1851 `!important` declarations (67%) across 615 rules. All 20 most specific `!important` selectors are in strata.css (ID chains, up to specificity 2.2.0; section 3.5).
6. **Sheet field recipe is only partly realised.** D44 specifies 52px height and a 14px radius. `.input,.select,.textarea{min-height:45px !important}` (index.html:373) beats the 52px declared at index.html:2412 and strata.css:1976 (neither is `!important`), so sheet fields render 45px tall. The 14px radius does win (strata.css:1976, `var(--r-ctl) !important`). Generic inputs keep index.html:2412 `border-radius:17px !important`, which conflicts with I7 (input 10px) and D44 (14px).
7. **Two sheet families.** Sheets built by `cut-support.js:770` (`.modal.n99-modal > section.sheet.n99`) get strata's sheet recipe. Legacy modals built by twelve index.html call sites (lines 3400 to 7897) use `.modal` without `n99-modal`, so they do not get the strata sheet rules: they get index.html:2498 (30px top radius) and cut-support.css:14 (background).
8. **Three type scales plus raw sizes.** `--fs-*` (strata.css:1342, eight values from 11px to 28px) is used by strata only: 143 of its 548 size declarations use it. `--nxt-type-*` (premium-ui.css:96 to 104) is a separate nine-step ramp with different values (title 24px against `--fs-title` 28px, which is unused). vnext.css and the inline block use raw sizes; the inline block has 64 declarations at 10px or below. Strata still has 171 off-scale text sizes (9px to 17px) and 79 display sizes of 19px and up, against D44's instruction to snap off-scale text onto the scale.
9. **Dead CSS is concentrated in premium-ui.css and vnext.css.** Share of style rules whose selectors name classes or ids that no emitter produces: premium-ui.css 39.5% (303 of 768; the `.nxp-train-lift` cluster has no emitter), vnext.css 21.3% (138 of 649; `.vn-train-active`, while the JS now emits `st-train-active`), cut-support.css 10.5%, index.html 4.4%, strata.css 6.9%.
10. **Responsive surface is narrow.** The 359px breakpoint carries most of it (strata 161 rules, vnext 50, premium-ui 13; premium-ui also has 32 rules at 360px). Nothing uses `prefers-color-scheme`, `display-mode` or `pointer: coarse`. `hover: hover` appears only in strata (5 rules), and `prefers-reduced-transparency` only in strata (10 rules).

## 0. Scope, load order and method

**Load order** (index.html). The inline block comes first, then four linked sheets, all with `?v=161`:

| Order | Layer | Location | Style rules (excl. keyframe steps) | Declarations | `!important` declarations |
|---|---|---|---|---|---|
| 1 | inline `<style>` | index.html:24 to 2616 | 704 | 2792 | 475 |
| 2 | cut-support.css | index.html:2633 (link) | 200 | 689 | 17 |
| 3 | premium-ui.css | index.html:2634 (link) | 768 | 2880 | 96 |
| 4 | vnext.css | index.html:2635 (link) | 649 | 2481 | 26 |
| 5 | strata.css | index.html:2636 (link) | 1810 | 5552 | 1237 |

No stylesheet is injected at runtime. The only runtime style strings are `style.cssText` assignments (premium-ui.js:2851, strata.js:954, cut-support.js:1398). The `classic/` folder is not loaded and is out of scope.

Method, all static:

- Parser: a small tokenizer that keeps real file line numbers, so every citation points at the file as it sits in the working tree. Scripts are in the session scratchpad, not in the repo.
- Liveness: a selector is **live** when every top-level class, id and `data-*` attribute it names occurs in premium-ui.js, strata.js, cut-support.js, train-anatomy.js or the index.html shell (the inline style block is excluded). **Dead** means at least one such name never occurs. Names built dynamically from a stem (`'n99-day-'+x`) are treated as dynamic and not dead. Sampled dead names were checked with substring searches and show no dynamic construction.
- Cascade model (section 3): for a representative element, every matching declaration is collected. Winner = `!important` first, then specificity, then load order, then source order. Media queries are evaluated at 390 by 844 (iPhone). Page-id ancestors (`#homePage` and so on) must match the element's page. Other ancestors are assumed present. Hover, focus and other state pseudo-classes are excluded (resting state). It is an approximation and was not checked in a browser.
- Colour hue buckets: GREEN 70 to 160 degrees, TEAL/CYAN 160 to 205, BLUE-ISH 205 to 250, VIOLET/INDIGO 250 to 300, MAGENTA/ORCHID 300 to 345, RED/ROSE and APRICOT/AMBER outside those ranges (not listed). Lavender `#C4B5FD` (252 degrees) and identity violet `#8B5CF6` (258 degrees) are VIOLET/INDIGO.
- Authority: DECISIONS.md rows D19, D41, D44, D53, D54, D56, D59 were read for vocabulary. D44 refers to an "eight-step scale" without listing the steps. The only eight-value ramp in code is `--fs-micro` to `--fs-title` (strata.css:1342), and this report treats it as that scale.

## 1. Token map

### 1.1 Headline numbers

- Root-level custom property names (on `:root`, `html`, `body`, `.app` or `:root[...]`): **281 names, 343 definitions** (inline 4 blocks at index.html:31, 776, 2159, 2340; cut-support.css:2; premium-ui.css:2; vnext.css:27 and 365; strata.css:7, 55 to 58, 1327, 1341, 1935, 2293, 2454, 2610, 2631). `html`, `body` and `.app` define no tokens.
- Names defined in more than one file: **19**, every one with different values. Effective value = the last unconditional definition in load order (inline, then cut-support, premium-ui, vnext, strata; within a file, source order).
- Names with zero `var()` references: **56** (of which 1 also appear in JS). Examples: `--panel`, `--panel2`, `--panel3`, `--premium-bg`, `--premium-card`, `--radius`, `--faint`, `--nxt-font`, `--nxt-z-*`, `--nxt-chart-*`, `--st-r-3`, `--r-card`, `--fs-title`, `--btn-font`.
- Non-root custom properties (set on individual selectors, usually from JS inline styles): **13 names, 37 definitions**; table in 1.5.
- Scoped overrides: `--st-a1` to `--st-a4` (aurora tints) are defined only under `:root[data-st-tab=…]` for four tabs, not for Today (see key finding 3). `--st-font-d` is redefined three times in strata.css (lines 43, 1329, 2294). Effective: Geist.

### 1.2 Same concept, different names

Effective values use the cascade rule above. "Definitions" counts every `:root`-level declaration of the name across all files.

| Concept | Token | Effective value (file:line) | Definitions | CSS var() refs |
|---|---|---|---|---|
| Canvas / page background | `--bg` | `#121216` (cut-support.css:3) | 4 | 1 |
|  | `--premium-bg` | `#080A0F` (index.html:777) | 1 | 0 |
|  | `--nxt-background` | `#0f0e14` (premium-ui.css:22) | 1 | 5 |
|  | `--nxt-bg` | `var(--nxt-background)` (premium-ui.css:204) | 1 | 2 |
|  | `--n99-bg` | `var(--nxt-background)` (premium-ui.css:221) | 2 | 1 |
|  | `--vn-canvas` | `#0E1014` (vnext.css:29) | 1 | 7 |
|  | `--st-bg` | `#08080D` (strata.css:8) | 1 | 5 |
|  | `--st-bg-2` | `#0D0D14` (strata.css:9) | 1 | 0 |
| Raised surface / card | `--panel2` | `#23232d` (cut-support.css:3) | 4 | 0 |
|  | `--nxt-surface` | `#1a1922` (premium-ui.css:24) | 2 | 21 |
|  | `--nxt-surface-alt` | `#1f1e29` (premium-ui.css:25) | 1 | 11 |
|  | `--nxt-raised` | `var(--nxt-surface-alt)` (premium-ui.css:205) | 1 | 5 |
|  | `--n99-raised` | `var(--nxt-surface-alt)` (premium-ui.css:223) | 2 | 2 |
|  | `--premium-card` | `#151922` (index.html:778) | 1 | 0 |
|  | `--nxt-surface-2` | `#23232d` (cut-support.css:4) | 1 | 0 |
|  | `--vn-surface-2` | `#1E232C` (vnext.css:32) | 1 | 8 |
|  | `--st-tile-bg` | `rgba(20,19,30,.66)` (strata.css:29) | 1 | 15 |
| Primary ink | `--text` | `#f6f5f7` (index.html:2346) | 2 | 3 |
|  | `--ink` | `#F5F3FF` (index.html:2163) | 1 | 1 |
|  | `--nxt-text-primary` | `#F4F2FA` (strata.css:1937) | 2 | 17 |
|  | `--nxt-text` | `var(--nxt-text-primary)` (premium-ui.css:209) | 1 | 11 |
|  | `--n99-text` | `var(--nxt-text-primary)` (premium-ui.css:224) | 2 | 6 |
|  | `--vn-ink` | `#F4F2FA` (strata.css:1936) | 2 | 72 |
|  | `--st-ink` | `#F4F2FA` (strata.css:10) | 1 | 95 |
| Secondary ink | `--muted` | `#9f9ca4` (index.html:2347) | 3 | 6 |
|  | `--nxt-text-secondary` | `#B9B5C8` (strata.css:1937) | 2 | 42 |
|  | `--nxt-muted` | `var(--nxt-text-secondary)` (premium-ui.css:211) | 1 | 18 |
|  | `--n99-muted` | `var(--nxt-text-secondary)` (premium-ui.css:225) | 2 | 15 |
|  | `--vn-ink-2` | `#B9B5C8` (strata.css:1936) | 2 | 54 |
|  | `--st-ink-2` | `#B9B5C8` (strata.css:11) | 1 | 42 |
| Tertiary / faint ink | `--muted2` | `#6a686e` (index.html:2348) | 2 | 4 |
|  | `--faint` | `#6B647A` (index.html:2165) | 1 | 0 |
|  | `--nxt-text-muted` | `#9893AA` (strata.css:1937) | 2 | 61 |
|  | `--nxt-text-tertiary` | `var(--nxt-text-muted)` (premium-ui.css:210) | 1 | 38 |
|  | `--vn-ink-3` | `#9893AA` (strata.css:1936) | 2 | 64 |
|  | `--vn-ink-4` | `#8A85A0` (strata.css:1936) | 2 | 26 |
|  | `--st-ink-3` | `#9893AA` (strata.css:12) | 1 | 122 |
|  | `--st-ink-4` | `#8A859C` (strata.css:13) | 1 | 20 |
| Violet identity | `--purple` | `#b18aff` (index.html:2349) | 3 | 13 |
|  | `--purple2` | `#a477f5` (index.html:2350) | 3 | 0 |
|  | `--violet` | `#C084FC` (index.html:2168) | 1 | 0 |
|  | `--nxt-purple-primary` | `#b49aff` (premium-ui.css:43) | 1 | 44 |
|  | `--nxt-purple` | `var(--nxt-purple-primary)` (premium-ui.css:212) | 1 | 11 |
|  | `--nxt-accent` | `var(--nxt-purple-primary)` (premium-ui.css:215) | 1 | 1 |
|  | `--n99-accent` | `var(--nxt-purple-primary)` (premium-ui.css:227) | 2 | 8 |
|  | `--nxt-violet` | `var(--nxt-purple-deep)` (premium-ui.css:214) | 1 | 0 |
|  | `--vn-violet` | `#8B5CF6` (vnext.css:48) | 1 | 20 |
|  | `--vn-action` | `#6D28D9` (vnext.css:56) | 1 | 2 |
|  | `--st-accent` | `#8B5CF6` (strata.css:18) | 1 | 17 |
|  | `--st-accent-lift` | `#B49AFF` (strata.css:19) | 1 | 43 |
|  | `--st-weight` | `#B49AFF` (strata.css:21) | 1 | 10 |
| Green (should not exist) | `--green` | `#b18aff` (index.html:2352) | 3 | 11 |
| Cyan / sky (should not exist) | `--sky` | `#aa7afa` (index.html:2351) | 3 | 11 |
| Success / "good" | `--nxt-success` | `#C4B5FD` (premium-ui.css:54) | 1 | 1 |
|  | `--st-lean` | `#C4B5FD` (strata.css:27) | 1 | 11 |
|  | `--vn-ok` | `#8B5CF6` (vnext.css:63) | 1 | 0 |
| Warning / amber | `--yellow` | `#f7d76b` (index.html:2354) | 2 | 0 |
|  | `--amber` | `#FDE68A` (index.html:2171) | 1 | 0 |
|  | `--orange` | `#ff9a62` (index.html:2355) | 2 | 0 |
|  | `--nxt-warning` | `#e8b271` (premium-ui.css:56) | 1 | 7 |
|  | `--vn-review` | `#B8842A` (vnext.css:64) | 1 | 9 |
|  | `--st-floor` | `#E2B04A` (strata.css:24) | 1 | 5 |
| Danger / rose | `--red` | `#ff758c` (index.html:2353) | 2 | 2 |
|  | `--rose` | `#FDA4AF` (index.html:2172) | 1 | 0 |
|  | `--nxt-danger` | `#f0768e` (premium-ui.css:59) | 1 | 4 |
|  | `--vn-concern` | `#DC5A76` (vnext.css:66) | 1 | 9 |
|  | `--st-fat` | `#F0709A` (strata.css:26) | 1 | 1 |
| Surface radius | `--radius` | `26px` (index.html:2356) | 2 | 0 |
|  | `--nxt-radius-surface` | `var(--nxt-radius-lg)` (premium-ui.css:217) | 1 | 0 |
|  | `--nxt-radius-card` | `var(--nxt-radius-xl)` (premium-ui.css:218) | 1 | 7 |
|  | `--vn-r-surface` | `20px` (vnext.css:69) | 2 | 5 |
|  | `--st-r` | `26px` (strata.css:34) | 1 | 10 |
|  | `--r-tile` | `26px` (strata.css:1940) | 1 | 2 |
| Control radius | `--nxt-radius-control` | `var(--nxt-radius-md)` (premium-ui.css:216) | 1 | 5 |
|  | `--vn-r-control` | `12px` (vnext.css:70) | 1 | 18 |
|  | `--st-r-2` | `18px` (strata.css:35) | 1 | 1 |
|  | `--r-ctl` | `14px` (strata.css:1940) | 1 | 1 |
|  | `--st-r-3` | `14px` (strata.css:36) | 1 | 0 |
| Input radius | `--vn-r-input` | `10px` (vnext.css:71) | 1 | 8 |
| Space step 4 / gutter | `--nxt-space-4` | `16px` (premium-ui.css:86) | 1 | 34 |
|  | `--vn-s4` | `16px` (vnext.css:73) | 1 | 35 |
|  | `--nxt-gutter` | `var(--nxt-space-4)` (premium-ui.css:91) | 1 | 1 |
|  | `--vn-gutter` | `20px` (vnext.css:75) | 2 | 8 |
| Body type size | `--nxt-type-body` | `.9375rem` (premium-ui.css:100) | 1 | 11 |
|  | `--fs-body` | `14.5px` (strata.css:1342) | 1 | 22 |
| Title type size | `--nxt-type-title` | `1.5rem` (premium-ui.css:98) | 1 | 0 |
|  | `--fs-title` | `28px` (strata.css:1342) | 1 | 0 |
| Easing (cubic .32,.72,0,1 per I8) | `--vn-ease` | `cubic-bezier(.32,.72,0,1)` (vnext.css:81) | 1 | 26 |
|  | `--st-out` | `cubic-bezier(.32,.72,0,1)` (strata.css:40) | 1 | 54 |
|  | `--nxt-ease` | `cubic-bezier(.2, .7, .3, 1)` (premium-ui.css:131) | 1 | 7 |
|  | `--ease` | `cubic-bezier(.2,.8,.2,1)` (index.html:2358) | 1 | 4 |
| Touch / press duration | `--vn-t-touch` | `120ms` (vnext.css:78) | 1 | 8 |
|  | `--nxt-duration-press` | `90ms` (premium-ui.css:143) | 1 | 8 |
|  | `--nxt-motion-press` | `var(--nxt-duration-press) var(--n…` (premium-ui.css:150) | 1 | 6 |
| State duration | `--vn-t-state` | `200ms` (vnext.css:79) | 1 | 14 |
|  | `--nxt-motion-fast` | `110ms` (premium-ui.css:140) | 1 | 2 |
|  | `--nxt-duration-fast` | `var(--nxt-motion-fast)` (premium-ui.css:144) | 1 | 23 |

Notes on the table:

- Canvas has eight names in section 1.2. `--bg` is read once (index.html inline; effective value cut-support.css:3) and `--st-bg` five times in strata.css (strata.css:8). Neither paints the page: the painted colour is the literal `#07060B` in strata.css:59 (`html{background:#07060B !important}`).
- The request named `--vn-bg`; that token does not exist. The vnext canvas token is `--vn-canvas` (vnext.css:29).
- `--nxt-text-*`, `--nxt-surface`, `--n99-*` and `--vn-ink-*` are defined in two or three files. In each case the later file wins: strata.css:1936 and 1937 override the vnext and premium ink values, and premium-ui.css:221 to 227 turns the cut-support `--n99-*` values into aliases of `--nxt-*`.
- Radius: five families (`--radius`, `--nxt-radius-*`, `--vn-r-*`, `--st-r*`, `--r-*`). Value sets overlap (14px, 18px, 26px) but the names differ, so no single source defines "surface" or "control".
- Spacing: `--nxt-space-1` to `--nxt-space-8` (premium-ui.css:83 to 90) and `--vn-s1` to `--vn-s8` (vnext.css:73 to 74) are the same 4 to 40px ramp under two names. strata.css uses raw pixels (174 distinct spacing values).
- Type: `--nxt-type-*` (premium-ui.css:96 to 104), `--fs-*` (strata.css:1342) and raw sizes. See section 4.
- Motion: `--vn-t-touch` 120ms, `--vn-t-state` 200ms, `--vn-t-move` 280ms and `--vn-ease` (vnext.css:78 to 81) match I8. `--nxt-motion-fast` 110ms, `--nxt-duration-press` 90ms and `--nxt-duration-sheet` 260ms (premium-ui.css:140 to 147) do not. `--st-out` (strata.css:40) matches I8 easing. `--ease` (index.html:2358) and `--nxt-ease` (premium-ui.css:131) are separate easings.
- Radius: only the vnext family (`--vn-r-surface` 20px, `--vn-r-control` 12px, `--vn-r-input` 10px at vnext.css:69 to 71) matches the I7 ladder. The strata family (`--st-r` 26px, `--st-r-2` 18px, `--st-r-3` 14px at strata.css:34 to 36; `--r-tile` 26px and `--r-ctl` 14px at strata.css:1940) is what the Today and Weight surfaces render (section 5.2).

### 1.3 Every root-level token

Flags: DUP-FILES (defined in more than one file), DIFF-VALUES (different unconditional values), SHADOWED-IN-FILE (defined twice in one file), ALIAS (effective value is a `var()`), UNUSED (no `var()` reference), JS-ONLY (no CSS reference but named in JS), LEGACY-HUE-NAME (name says green, sky, yellow, orange, amber, rose or red), SCOPED-ONLY (no value on the Today tab).

| Token | Family | Effective value (cascade winner) | CSS var() refs | Flags |
|---|---|---|---|---|
| `--bg` | surface / background / aurora | `#121216` cut L3 | idx 1 | DUP-FILES, DIFF-VALUES |
| `--line` | surface / background / aurora | `rgba(235,229,244,.085)` idx L2345 | idx 4 | DIFF-VALUES, SHADOWED-IN-FILE |
| `--n99-bg` | surface / background / aurora | `var(--nxt-background)` prem L221 | cut 1 | DUP-FILES, DIFF-VALUES, ALIAS |
| `--n99-input` | surface / background / aurora | `#15151b` cut L5 | cut 2 | - |
| `--n99-raised` | surface / background / aurora | `var(--nxt-surface-alt)` prem L223 | cut 2 | DUP-FILES, DIFF-VALUES, ALIAS |
| `--n99-surface` | surface / background / aurora | `var(--nxt-surface)` prem L222 | cut 1 | DUP-FILES, DIFF-VALUES, ALIAS |
| `--nxt-atmosphere` | surface / background / aurora | `rgba(140, 118, 196, .10)` prem L28 | prem 2 | - |
| `--nxt-background` | surface / background / aurora | `#0f0e14` prem L22 | prem 5 (JS 1) | - |
| `--nxt-background-elevated` | surface / background / aurora | `#14131b` prem L23 | prem 1 | - |
| `--nxt-bg` | surface / background / aurora | `var(--nxt-background)` prem L204 | prem 2 | ALIAS |
| `--nxt-border` | surface / background / aurora | `var(--nxt-border-subtle)` prem L207 | prem 11 | ALIAS |
| `--nxt-border-strong` | surface / background / aurora | `rgba(232, 226, 245, .17)` prem L38 | prem 6 | - |
| `--nxt-border-subtle` | surface / background / aurora | `rgba(232, 226, 245, .085)` prem L37 | cut 3, prem 34 | - |
| `--nxt-chart-band` | surface / background / aurora | `rgba(180, 154, 255, .10)` prem L199 | 0 | UNUSED |
| `--nxt-chart-grid` | surface / background / aurora | `rgba(232, 226, 245, .06)` prem L193 | 0 | UNUSED |
| `--nxt-edge` | surface / background / aurora | `rgba(228,223,239,.12)` cut L4 | 0 | UNUSED |
| `--nxt-hairline` | surface / background / aurora | `var(--nxt-border-subtle)` prem L208 | prem 17 | ALIAS |
| `--nxt-interactive` | surface / background / aurora | `var(--nxt-surface-interactive)` prem L206 | prem 2 | ALIAS |
| `--nxt-raised` | surface / background / aurora | `var(--nxt-surface-alt)` prem L205 | prem 5 | ALIAS |
| `--nxt-surface` | surface / background / aurora | `#1a1922` prem L24 | prem 21 | DUP-FILES, DIFF-VALUES |
| `--nxt-surface-2` | surface / background / aurora | `#23232d` cut L4 | 0 | UNUSED |
| `--nxt-surface-alt` | surface / background / aurora | `#1f1e29` prem L25 | prem 11 | - |
| `--nxt-surface-interactive` | surface / background / aurora | `#262430` prem L26 | cut 1, prem 17 | - |
| `--nxt-surface-selected` | surface / background / aurora | `rgba(180, 154, 255, .13)` prem L27 | prem 1 | - |
| `--panel` | surface / background / aurora | `#1b1b22` cut L3 | 0 | DUP-FILES, DIFF-VALUES, UNUSED |
| `--panel2` | surface / background / aurora | `#23232d` cut L3 | 0 | DUP-FILES, DIFF-VALUES, UNUSED |
| `--panel3` | surface / background / aurora | `#2b2b36` cut L3 | 0 | DUP-FILES, DIFF-VALUES, UNUSED |
| `--premium-bg` | surface / background / aurora | `#080A0F` idx L777 | 0 | UNUSED |
| `--premium-card` | surface / background / aurora | `#151922` idx L778 | 0 | UNUSED |
| `--premium-card2` | surface / background / aurora | `#11151D` idx L779 | 0 | UNUSED |
| `--st-a1` | surface / background / aurora | (none) | st 2 | SCOPED-ONLY (no value on Today/home) |
| `--st-a2` | surface / background / aurora | (none) | st 2 | SCOPED-ONLY (no value on Today/home) |
| `--st-a3` | surface / background / aurora | (none) | st 2 | SCOPED-ONLY (no value on Today/home) |
| `--st-a4` | surface / background / aurora | (none) | st 1 | SCOPED-ONLY (no value on Today/home) |
| `--st-bg` | surface / background / aurora | `#08080D` st L8 | st 5 | - |
| `--st-bg-2` | surface / background / aurora | `#0D0D14` st L9 | 0 | UNUSED |
| `--st-edge` | surface / background / aurora | `linear-gradient(155deg,rgba(255,255,255…` st L2295 | st 3 | - |
| `--st-hl` | surface / background / aurora | `255,255,255` st L14 | st 154 | - |
| `--st-tile` | surface / background / aurora | `linear-gradient(180deg,rgba(var(--st-hl…` st L30 | st 18 | - |
| `--st-tile-bg` | surface / background / aurora | `rgba(20,19,30,.66)` st L29 | st 15 | - |
| `--st-tile-hl` | surface / background / aurora | `inset 0 1px 0 rgba(var(--st-hl),.07)` st L32 | st 15 | - |
| `--st-tile-line` | surface / background / aurora | `rgba(var(--st-hl),.075)` st L31 | st 20 | - |
| `--vn-canvas` | surface / background / aurora | `#0E1014` vn L29 | vn 7 | - |
| `--vn-surface` | surface / background / aurora | `#171B22` vn L31 | vn 6 | - |
| `--vn-surface-2` | surface / background / aurora | `#1E232C` vn L32 | vn 8 | - |
| `--vn-surface-3` | surface / background / aurora | `#262C37` vn L33 | vn 4 | - |
| `--vn-zone` | surface / background / aurora | `#12151B` vn L30 | 0 | UNUSED |
| `--btn-ink` | ink / text | `#EDE8FF` st L2460 | st 1 | - |
| `--btn-text` | ink / text | `#CDBBFF` st L2461 | st 4 | - |
| `--faint` | ink / text | `#6B647A` idx L2165 | 0 | UNUSED |
| `--ink` | ink / text | `#F5F3FF` idx L2163 | idx 1 | - |
| `--muted` | ink / text | `#9f9ca4` idx L2347 | idx 6 (JS 1) | DIFF-VALUES, SHADOWED-IN-FILE |
| `--muted2` | ink / text | `#6a686e` idx L2348 | idx 4 (JS 1) | DIFF-VALUES, SHADOWED-IN-FILE |
| `--n99-muted` | ink / text | `var(--nxt-text-secondary)` prem L225 | cut 9, prem 6 | DUP-FILES, DIFF-VALUES, ALIAS |
| `--n99-text` | ink / text | `var(--nxt-text-primary)` prem L224 | cut 2, prem 4 | DUP-FILES, DIFF-VALUES, ALIAS |
| `--nxt-chart-axis-text` | ink / text | `var(--nxt-text-muted)` prem L194 | 0 | ALIAS, UNUSED |
| `--nxt-muted` | ink / text | `var(--nxt-text-secondary)` prem L211 | prem 18 | ALIAS |
| `--nxt-text` | ink / text | `var(--nxt-text-primary)` prem L209 | prem 11 | ALIAS |
| `--nxt-text-disabled` | ink / text | `#5f5a6b` prem L34 | prem 8 | - |
| `--nxt-text-muted` | ink / text | `#9893AA` st L1937 | cut 7, prem 54 | DUP-FILES, DIFF-VALUES |
| `--nxt-text-primary` | ink / text | `#F4F2FA` st L1937 | cut 1, prem 16 | DUP-FILES, DIFF-VALUES |
| `--nxt-text-secondary` | ink / text | `#B9B5C8` st L1937 | cut 1, prem 41 | DUP-FILES, DIFF-VALUES |
| `--nxt-text-tertiary` | ink / text | `var(--nxt-text-muted)` prem L210 | prem 38 | ALIAS |
| `--st-ink` | ink / text | `#F4F2FA` st L10 | st 95 | - |
| `--st-ink-2` | ink / text | `#B9B5C8` st L11 | st 42 | - |
| `--st-ink-3` | ink / text | `#9893AA` st L12 | st 122 | - |
| `--st-ink-4` | ink / text | `#8A859C` st L13 | st 20 | - |
| `--text` | ink / text | `#f6f5f7` idx L2346 | idx 3 | DIFF-VALUES, SHADOWED-IN-FILE |
| `--vn-ink` | ink / text | `#F4F2FA` st L1936 | vn 72 | DUP-FILES, DIFF-VALUES |
| `--vn-ink-2` | ink / text | `#B9B5C8` st L1936 | vn 54 | DUP-FILES, DIFF-VALUES |
| `--vn-ink-3` | ink / text | `#9893AA` st L1936 | vn 64 | DUP-FILES, DIFF-VALUES |
| `--vn-ink-4` | ink / text | `#8A85A0` st L1936 | vn 26 | DUP-FILES, DIFF-VALUES |
| `--amber` | accent / category / status | `#FDE68A` idx L2171 | 0 | UNUSED, LEGACY-HUE-NAME |
| `--green` | accent / category / status | `#b18aff` idx L2352 | idx 11 | DIFF-VALUES, SHADOWED-IN-FILE, LEGACY-HUE-NAME |
| `--n99-accent` | accent / category / status | `var(--nxt-purple-primary)` prem L227 | cut 7, prem 1 | DUP-FILES, DIFF-VALUES, ALIAS |
| `--nxt-accent` | accent / category / status | `var(--nxt-purple-primary)` prem L215 | prem 1 | ALIAS |
| `--nxt-activity-cardio` | accent / category / status | `var(--nxt-warning)` prem L68 | prem 1 | ALIAS |
| `--nxt-activity-lift` | accent / category / status | `var(--nxt-purple-primary)` prem L67 | prem 1 | ALIAS |
| `--nxt-activity-weight` | accent / category / status | `var(--nxt-text-secondary)` prem L69 | prem 1 | ALIAS |
| `--nxt-chart-ink` | accent / category / status | `var(--nxt-purple-primary)` prem L191 | cut 3 | ALIAS |
| `--nxt-chart-ink-secondary` | accent / category / status | `#7f74a8` prem L192 | cut 1 | - |
| `--nxt-danger` | accent / category / status | `#f0768e` prem L59 | prem 4 | - |
| `--nxt-danger-tint` | accent / category / status | `rgba(240, 118, 142, .12)` prem L60 | prem 1 | - |
| `--nxt-info-tint` | accent / category / status | `rgba(180, 154, 255, .09)` prem L61 | cut 1 | - |
| `--nxt-on-purple` | accent / category / status | `#17121f` prem L49 | prem 8 | - |
| `--nxt-purple` | accent / category / status | `var(--nxt-purple-primary)` prem L212 | prem 11 | ALIAS |
| `--nxt-purple-bright` | accent / category / status | `var(--nxt-purple-soft)` prem L213 | prem 3 | ALIAS |
| `--nxt-purple-deep` | accent / category / status | `#6b58a8` prem L45 | prem 6 | - |
| `--nxt-purple-edge` | accent / category / status | `rgba(180, 154, 255, .26)` prem L48 | cut 1, prem 11 | - |
| `--nxt-purple-glow` | accent / category / status | `rgba(180, 154, 255, .22)` prem L46 | 0 | UNUSED |
| `--nxt-purple-primary` | accent / category / status | `#b49aff` prem L43 | cut 1, prem 43 | - |
| `--nxt-purple-soft` | accent / category / status | `#cdbcff` prem L44 | prem 7 | - |
| `--nxt-purple-tint` | accent / category / status | `rgba(180, 154, 255, .13)` prem L47 | prem 7 | - |
| `--nxt-success` | accent / category / status | `#C4B5FD` prem L54 | prem 1 | - |
| `--nxt-success-tint` | accent / category / status | `rgba(196, 181, 253, .12)` prem L55 | 0 | UNUSED |
| `--nxt-violet` | accent / category / status | `var(--nxt-purple-deep)` prem L214 | 0 | ALIAS, UNUSED |
| `--nxt-warning` | accent / category / status | `#e8b271` prem L56 | cut 2, prem 5 | - |
| `--nxt-warning-edge` | accent / category / status | `rgba(232, 178, 113, .34)` prem L58 | prem 2 | - |
| `--nxt-warning-tint` | accent / category / status | `rgba(232, 178, 113, .12)` prem L57 | prem 1 | - |
| `--orange` | accent / category / status | `#ff9a62` idx L2355 | 0 | DIFF-VALUES, SHADOWED-IN-FILE, UNUSED, LEGACY-HUE-NAME |
| `--purple` | accent / category / status | `#b18aff` idx L2349 | idx 13 | DIFF-VALUES, SHADOWED-IN-FILE |
| `--purple2` | accent / category / status | `#a477f5` idx L2350 | 0 | DIFF-VALUES, SHADOWED-IN-FILE, UNUSED |
| `--red` | accent / category / status | `#ff758c` idx L2353 | idx 2 | DIFF-VALUES, SHADOWED-IN-FILE, LEGACY-HUE-NAME |
| `--rose` | accent / category / status | `#FDA4AF` idx L2172 | 0 | UNUSED, LEGACY-HUE-NAME |
| `--sky` | accent / category / status | `#aa7afa` idx L2351 | idx 11 | DIFF-VALUES, SHADOWED-IN-FILE, LEGACY-HUE-NAME |
| `--st-accent` | accent / category / status | `#8B5CF6` st L18 | st 17 (JS 3) | - |
| `--st-accent-deep` | accent / category / status | `#6D28D9` st L20 | st 1 | - |
| `--st-accent-lift` | accent / category / status | `#B49AFF` st L19 | st 43 (JS 2) | - |
| `--st-cardio` | accent / category / status | `#D37732` st L23 | st 13 (JS 6) | - |
| `--st-fat` | accent / category / status | `#F0709A` st L26 | st 1 (JS 6) | - |
| `--st-floor` | accent / category / status | `#E2B04A` st L24 | st 5 (JS 1) | - |
| `--st-lean` | accent / category / status | `#C4B5FD` st L27 | st 11 (JS 3) | - |
| `--st-lift` | accent / category / status | `#8B7CFF` st L22 | st 9 (JS 13) | - |
| `--st-rest` | accent / category / status | `#9B8BB8` st L25 | 0 (JS 2) | JS-ONLY |
| `--st-weight` | accent / category / status | `#B49AFF` st L21 | st 10 (JS 7) | - |
| `--violet` | accent / category / status | `#C084FC` idx L2168 | 0 | UNUSED |
| `--vn-action` | accent / category / status | `#6D28D9` vn L56 | vn 2 | - |
| `--vn-action-fill` | accent / category / status | `linear-gradient(180deg,var(--vn-action-…` vn L59 | vn 6 | - |
| `--vn-action-ink` | accent / category / status | `#fff` vn L58 | vn 7 | - |
| `--vn-action-lift` | accent / category / status | `#7C3AED` vn L57 | vn 1 | - |
| `--vn-action-shadow` | accent / category / status | `0 1px 0 rgba(255,255,255,.15) inset, 0 …` vn L60 | vn 6 | - |
| `--vn-concern` | accent / category / status | `#DC5A76` vn L66 | vn 9 | - |
| `--vn-ok` | accent / category / status | `#8B5CF6` vn L63 | 0 | UNUSED |
| `--vn-review` | accent / category / status | `#B8842A` vn L64 | vn 7, st 2 | - |
| `--vn-review-lift` | accent / category / status | `#D5A448` vn L65 | vn 6 | - |
| `--vn-violet` | accent / category / status | `#8B5CF6` vn L48 | vn 20 | - |
| `--vn-violet-dim` | accent / category / status | `rgba(139,92,246,.16)` vn L50 | vn 9 | - |
| `--vn-violet-lift` | accent / category / status | `#A78BFA` vn L49 | vn 22 | - |
| `--vn-violet-line` | accent / category / status | `rgba(139,92,246,.42)` vn L51 | vn 13 | - |
| `--yellow` | accent / category / status | `#f7d76b` idx L2354 | 0 | DIFF-VALUES, SHADOWED-IN-FILE, UNUSED, LEGACY-HUE-NAME |
| `--nxt-radius-card` | radius | `var(--nxt-radius-xl)` prem L218 | prem 7 | ALIAS |
| `--nxt-radius-control` | radius | `var(--nxt-radius-md)` prem L216 | prem 5 | ALIAS |
| `--nxt-radius-lg` | radius | `18px` prem L78 | prem 9 | - |
| `--nxt-radius-md` | radius | `14px` prem L77 | cut 1, prem 5 | - |
| `--nxt-radius-pill` | radius | `999px` prem L80 | cut 1, prem 28 | - |
| `--nxt-radius-sm` | radius | `10px` prem L76 | cut 1, prem 4 | - |
| `--nxt-radius-surface` | radius | `var(--nxt-radius-lg)` prem L217 | 0 | ALIAS, UNUSED |
| `--nxt-radius-xl` | radius | `24px` prem L79 | prem 4 | - |
| `--r-card` | radius | `18px` st L1940 | 0 | UNUSED |
| `--r-ctl` | radius | `14px` st L1940 | st 1 | - |
| `--r-tile` | radius | `26px` st L1940 | st 2 | - |
| `--radius` | radius | `26px` idx L2356 | 0 | DIFF-VALUES, SHADOWED-IN-FILE, UNUSED |
| `--st-r` | radius | `26px` st L34 | st 10 | - |
| `--st-r-2` | radius | `18px` st L35 | st 1 | - |
| `--st-r-3` | radius | `14px` st L36 | 0 | UNUSED |
| `--st-rail` | radius | (none) | st 2 | SCOPED-ONLY (no value on Today/home) |
| `--vn-r-control` | radius | `12px` vn L70 | vn 18 | - |
| `--vn-r-input` | radius | `10px` vn L71 | vn 8 | - |
| `--vn-r-surface` | radius | `20px` vn L69 | vn 5 | - |
| `--nxt-bottom-gap` | spacing / layout | `var(--nxt-space-4)` prem L175 | prem 1 | ALIAS |
| `--nxt-chart-pad` | spacing / layout | `var(--nxt-space-4)` prem L200 | 0 | ALIAS, UNUSED |
| `--nxt-gutter` | spacing / layout | `var(--nxt-space-4)` prem L91 | cut 1 | ALIAS |
| `--nxt-header-pad-bottom` | spacing / layout | `9px` prem L183 | prem 1 | - |
| `--nxt-header-pad-top` | spacing / layout | `8px` prem L182 | prem 1 | - |
| `--nxt-rest-clearance` | spacing / layout | `20px` prem L186 | 0 | UNUSED |
| `--nxt-screen-top` | spacing / layout | `calc(var(--nxt-safe-top) + var(--nxt-sp…` prem L181 | prem 1 | - |
| `--nxt-space-1` | spacing / layout | `4px` prem L83 | cut 1, prem 15 | - |
| `--nxt-space-2` | spacing / layout | `8px` prem L84 | prem 65 | - |
| `--nxt-space-3` | spacing / layout | `12px` prem L85 | cut 1, prem 79 | - |
| `--nxt-space-4` | spacing / layout | `16px` prem L86 | prem 34 | - |
| `--nxt-space-5` | spacing / layout | `20px` prem L87 | prem 4 | - |
| `--nxt-space-6` | spacing / layout | `24px` prem L88 | cut 2, prem 4 | - |
| `--nxt-space-7` | spacing / layout | `32px` prem L89 | 0 | UNUSED |
| `--nxt-space-8` | spacing / layout | `40px` prem L90 | 0 | UNUSED |
| `--nxt-tabs-pad-bottom` | spacing / layout | `8px` prem L169 | prem 2 | - |
| `--nxt-tabs-pad-top` | spacing / layout | `10px` prem L168 | prem 2 | - |
| `--vn-gutter` | spacing / layout | `20px` vn L75 | vn 8 | - |
| `--vn-s1` | spacing / layout | `4px` vn L73 | vn 6 | - |
| `--vn-s2` | spacing / layout | `8px` vn L73 | vn 31 | - |
| `--vn-s3` | spacing / layout | `12px` vn L73 | vn 61 | - |
| `--vn-s4` | spacing / layout | `16px` vn L73 | vn 35 | - |
| `--vn-s5` | spacing / layout | `20px` vn L74 | vn 31 | - |
| `--vn-s6` | spacing / layout | `24px` vn L74 | vn 12 | - |
| `--vn-s7` | spacing / layout | `32px` vn L74 | vn 3 | - |
| `--vn-s8` | spacing / layout | `40px` vn L74 | vn 5 | - |
| `--btn-font` | type | `600 16px/1 var(--st-font-d)` st L2455 | 0 | UNUSED |
| `--fs-body` | type | `14.5px` st L1342 | st 22 | - |
| `--fs-cap` | type | `12px` st L1342 | st 26 | - |
| `--fs-cta` | type | `16px` st L1342 | st 1 | - |
| `--fs-hero` | type | `22px` st L1342 | st 7 | - |
| `--fs-label` | type | `13px` st L1342 | st 30 | - |
| `--fs-micro` | type | `11px` st L1342 | st 13 | - |
| `--fs-row` | type | `15.5px` st L1342 | st 34 | - |
| `--fs-sect` | type | `18px` st L1342 | st 11 | - |
| `--fs-title` | type | `28px` st L1342 | 0 | UNUSED |
| `--fw-head` | type | `590` st L1343 | st 5 | - |
| `--fw-med` | type | `550` st L1343 | st 65 | - |
| `--fw-reg` | type | `400` st L1343 | st 40 | - |
| `--fw-semi` | type | `600` st L1343 | st 28 | - |
| `--nxt-font` | type | `-apple-system, BlinkMacSystemFont, "SF …` prem L95 | 0 | UNUSED |
| `--nxt-tracking-eyebrow` | type | `.07em` prem L115 | prem 11 | - |
| `--nxt-tracking-tight` | type | `-.02em` prem L114 | cut 1, prem 5 | - |
| `--nxt-type-body` | type | `.9375rem` prem L100 | prem 11 | - |
| `--nxt-type-body-sm` | type | `.875rem` prem L101 | cut 1, prem 8 | - |
| `--nxt-type-display` | type | `2.75rem` prem L96 | cut 1, prem 1 | - |
| `--nxt-type-heading` | type | `1.0625rem` prem L99 | 0 | UNUSED |
| `--nxt-type-label` | type | `.75rem` prem L103 | cut 2, prem 22 | - |
| `--nxt-type-meta` | type | `.8125rem` prem L102 | cut 4, prem 19 | - |
| `--nxt-type-metric` | type | `1.75rem` prem L97 | prem 1 | - |
| `--nxt-type-micro` | type | `.6875rem` prem L104 | prem 10 | - |
| `--nxt-type-title` | type | `1.5rem` prem L98 | 0 | UNUSED |
| `--nxt-weight-body` | type | `400` prem L111 | cut 1, prem 9 | - |
| `--nxt-weight-cta` | type | `600` prem L109 | prem 9 | - |
| `--nxt-weight-hero` | type | `700` prem L106 | cut 1, prem 9 | - |
| `--nxt-weight-meta` | type | `500` prem L110 | cut 3, prem 40 | - |
| `--nxt-weight-metric` | type | `650` prem L107 | prem 20 | - |
| `--nxt-weight-nav` | type | `500` prem L112 | prem 2 | - |
| `--nxt-weight-title` | type | `600` prem L108 | prem 8 | - |
| `--st-font` | type | `-apple-system,BlinkMacSystemFont,"SF Pr…` st L1328 | st 228 | DIFF-VALUES, SHADOWED-IN-FILE |
| `--st-font-d` | type | `"Geist",-apple-system,BlinkMacSystemFon…` st L2294 | st 55 | DIFF-VALUES, SHADOWED-IN-FILE |
| `--ease` | motion | `cubic-bezier(.2,.8,.2,1)` idx L2358 | idx 4 | - |
| `--nxt-duration-exit` | motion | `170ms` prem L147 | prem 1 | - |
| `--nxt-duration-fast` | motion | `var(--nxt-motion-fast)` prem L144 | prem 23 | ALIAS |
| `--nxt-duration-normal` | motion | `var(--nxt-motion-normal)` prem L145 | prem 11 | ALIAS |
| `--nxt-duration-press` | motion | `90ms` prem L143 | prem 8 | - |
| `--nxt-duration-sheet` | motion | `260ms` prem L146 | prem 1 | - |
| `--nxt-ease` | motion | `cubic-bezier(.2, .7, .3, 1)` prem L131 | prem 7 | - |
| `--nxt-ease-in` | motion | `cubic-bezier(.4, 0, .9, .3)` prem L133 | prem 1 | - |
| `--nxt-ease-linear` | motion | `linear` prem L134 | prem 1 | - |
| `--nxt-ease-out` | motion | `cubic-bezier(.16, .84, .44, 1)` prem L132 | prem 44 | - |
| `--nxt-motion` | motion | `var(--nxt-duration-fast) var(--nxt-ease)` prem L148 | prem 44 | ALIAS |
| `--nxt-motion-enter` | motion | `var(--nxt-duration-sheet) var(--nxt-eas…` prem L151 | prem 1 | ALIAS |
| `--nxt-motion-fast` | motion | `110ms` prem L140 | prem 2 | - |
| `--nxt-motion-leave` | motion | `var(--nxt-duration-exit) var(--nxt-ease…` prem L152 | 0 | ALIAS, UNUSED |
| `--nxt-motion-normal` | motion | `190ms` prem L141 | prem 8 | - |
| `--nxt-motion-press` | motion | `var(--nxt-duration-press) var(--nxt-eas…` prem L150 | prem 6 | ALIAS |
| `--nxt-motion-slow` | motion | `var(--nxt-duration-normal) var(--nxt-ea…` prem L149 | 0 | ALIAS, UNUSED |
| `--st-glide` | motion | `cubic-bezier(.22,1,.36,1)` st L39 | st 19 | - |
| `--st-out` | motion | `cubic-bezier(.32,.72,0,1)` st L40 | st 54 | - |
| `--st-spring` | motion | `cubic-bezier(.34,1.56,.64,1)` st L38 | st 18 | - |
| `--st-spring-snappy` | motion | `linear(0.0018,0.033,0.1074,0.1883,0.296…` st L1938 | st 3 | - |
| `--st-spring-soft` | motion | `linear(0.0007,0.0331,0.1005,0.1781,0.27…` st L1939 | st 1 | - |
| `--vn-ease` | motion | `cubic-bezier(.32,.72,0,1)` vn L81 | vn 26 | - |
| `--vn-t-move` | motion | `280ms` vn L80 | vn 3 | - |
| `--vn-t-state` | motion | `200ms` vn L79 | vn 14 | - |
| `--vn-t-touch` | motion | `120ms` vn L78 | vn 8 | - |
| `--btn-glass` | elevation / material | `linear-gradient(180deg,rgba(255,255,255…` st L2458 | st 2 | - |
| `--btn-glass-shadow` | elevation / material | `inset 0 1px 0 rgba(255,255,255,.16),ins…` st L2459 | st 2 | - |
| `--btn-primary` | elevation / material | `radial-gradient(120% 140% at 50% -20%,r…` st L2456 | st 1 | - |
| `--btn-primary-shadow` | elevation / material | `inset 0 1px 0 rgba(255,255,255,.38),ins…` st L2457 | st 2 | - |
| `--nxt-shadow-low` | elevation / material | `0 1px 2px rgba(0, 0, 0, .28)` prem L72 | prem 3 | - |
| `--nxt-shadow-medium` | elevation / material | `0 8px 24px rgba(0, 0, 0, .34)` prem L73 | 0 | UNUSED |
| `--shadow` | elevation / material | `0 22px 55px rgba(0,0,0,.34)` idx L2357 | idx 3 | - |
| `--st-depth` | elevation / material | `0 1px 0 rgba(255,255,255,.05) inset,0 3…` st L2296 | st 3 | - |
| `--st-shadow` | elevation / material | `0 24px 48px -28px rgba(0,0,0,.85),0 2px…` st L33 | st 11 | - |
| `--nxt-bottom-reserve` | chrome / z / safe-area / chart | `calc(var(--nxt-tabs-stack) + var(--nxt-…` prem L176 | prem 2 | - |
| `--nxt-button-height` | chrome / z / safe-area / chart | `48px` prem L118 | prem 3 | - |
| `--nxt-chart-line` | chrome / z / safe-area / chart | `2px` prem L195 | 0 | UNUSED |
| `--nxt-chart-line-secondary` | chrome / z / safe-area / chart | `1.5px` prem L196 | 0 | UNUSED |
| `--nxt-chart-point` | chrome / z / safe-area / chart | `3.5px` prem L197 | 0 | UNUSED |
| `--nxt-chart-point-active` | chrome / z / safe-area / chart | `5.5px` prem L198 | 0 | UNUSED |
| `--nxt-control` | chrome / z / safe-area / chart | `var(--nxt-button-height)` prem L219 | prem 5 | ALIAS |
| `--nxt-control-compact` | chrome / z / safe-area / chart | `44px` prem L120 | prem 22 | - |
| `--nxt-control-height` | chrome / z / safe-area / chart | `44px` prem L119 | prem 2 | - |
| `--nxt-control-sm` | chrome / z / safe-area / chart | `38px` prem L121 | prem 1 | - |
| `--nxt-header-row` | chrome / z / safe-area / chart | `40px` prem L184 | prem 1 | - |
| `--nxt-header-stack` | chrome / z / safe-area / chart | `calc(var(--nxt-header-pad-top) + var(--…` prem L185 | 0 | UNUSED |
| `--nxt-nav-height` | chrome / z / safe-area / chart | `calc(var(--nxt-tabs-pad-top) + var(--nx…` prem L172 | prem 2 | - |
| `--nxt-safe-bottom` | chrome / z / safe-area / chart | `env(safe-area-inset-bottom, 0px)` prem L15 | idx 10, cut 1, prem 2 | - |
| `--nxt-safe-left` | chrome / z / safe-area / chart | `env(safe-area-inset-left, 0px)` prem L16 | 0 | UNUSED |
| `--nxt-safe-right` | chrome / z / safe-area / chart | `env(safe-area-inset-right, 0px)` prem L17 | 0 | UNUSED |
| `--nxt-safe-top` | chrome / z / safe-area / chart | `env(safe-area-inset-top, 0px)` prem L14 | idx 2, cut 1, prem 2, vn 1, st 1 | - |
| `--nxt-tab-min-height` | chrome / z / safe-area / chart | `52px` prem L170 | prem 2 | - |
| `--nxt-tabs-border-y` | chrome / z / safe-area / chart | `1px` prem L171 | prem 1 | - |
| `--nxt-tabs-chrome` | chrome / z / safe-area / chart | `var(--nxt-nav-height)` prem L173 | 0 | ALIAS, UNUSED |
| `--nxt-tabs-stack` | chrome / z / safe-area / chart | `calc(var(--nxt-nav-height) + var(--nxt-…` prem L174 | prem 2 | - |
| `--nxt-touch-min` | chrome / z / safe-area / chart | `44px` prem L122 | cut 1, prem 24 | - |
| `--nxt-z-base` | chrome / z / safe-area / chart | `0` prem L155 | 0 | UNUSED |
| `--nxt-z-elevated` | chrome / z / safe-area / chart | `10` prem L156 | 0 | UNUSED |
| `--nxt-z-header` | chrome / z / safe-area / chart | `30` prem L158 | prem 1 | - |
| `--nxt-z-modal` | chrome / z / safe-area / chart | `10000` prem L162 | 0 | UNUSED |
| `--nxt-z-popover` | chrome / z / safe-area / chart | `500` prem L160 | 0 | UNUSED |
| `--nxt-z-sheet` | chrome / z / safe-area / chart | `1000` prem L161 | 0 | UNUSED |
| `--nxt-z-sticky` | chrome / z / safe-area / chart | `30` prem L157 | 0 | UNUSED |
| `--nxt-z-tabs` | chrome / z / safe-area / chart | `80` prem L159 | prem 1 | - |
| `--nxt-z-toast` | chrome / z / safe-area / chart | `20000` prem L163 | 0 | UNUSED |
| `--st-col` | chrome / z / safe-area / chart | (none) | st 2 | SCOPED-ONLY (no value on Today/home) |
| `--vn-line` | chrome / z / safe-area / chart | `rgba(255,255,255,.06)` vn L35 | vn 33 | - |
| `--vn-line-2` | chrome / z / safe-area / chart | `rgba(255,255,255,.10)` vn L36 | vn 15 | - |
| `--vn-line-3` | chrome / z / safe-area / chart | `rgba(255,255,255,.16)` vn L37 | vn 3 | - |
| `--n99-border` | other | `var(--nxt-border-subtle)` prem L226 | cut 10, prem 1 | DUP-FILES, DIFF-VALUES, ALIAS |

### 1.4 Tokens with more than one definition, in cascade order

Abbreviations: idx = index.html inline `<style>`, cut = cut-support.css, prem = premium-ui.css, vn = vnext.css, st = strata.css. "(shadowed)" marks an unconditional definition overridden later. `[@…]` marks a media condition, `[…]` a scoped selector.

| Token | Every definition in cascade order (file:line value) |
|---|---|
| `--bg` | idx L32 (shadowed) `#0b0d12`; idx L2160 (shadowed) `#080A10`; idx L2341 (shadowed) `#000000`; cut L3 `#121216` |
| `--line` | idx L36 (shadowed) `rgba(255,255,255,.075)`; idx L2173 (shadowed) `rgba(255,255,255,.075)`; idx L2345 `rgba(235,229,244,.085)` |
| `--n99-bg` | cut L5 (shadowed) `#121216`; prem L221 `var(--nxt-background)` |
| `--n99-raised` | cut L5 (shadowed) `#23232d`; prem L223 `var(--nxt-surface-alt)` |
| `--n99-surface` | cut L5 (shadowed) `#1b1b22`; prem L222 `var(--nxt-surface)` |
| `--nxt-surface` | cut L4 (shadowed) `#1b1b22`; prem L24 `#1a1922` |
| `--panel` | idx L33 (shadowed) `#12151c`; idx L2161 (shadowed) `#111520`; idx L2342 (shadowed) `#111112`; cut L3 `#1b1b22` |
| `--panel2` | idx L34 (shadowed) `#171b24`; idx L2162 (shadowed) `#171B27`; idx L2343 (shadowed) `#171618`; cut L3 `#23232d` |
| `--panel3` | idx L35 (shadowed) `#1e2430`; idx L2344 (shadowed) `#1e1d1f`; cut L3 `#2b2b36` |
| `--st-a1` | st L55 [:root[data-st-tab="train"]] `rgba(124,58,237,.5)`; st L56 [:root[data-st-tab="weight"] `rgba(139,92,246,.4)`; st L57 [:root[data-st-tab="history] `rgba(99,102,241,.34)`; st L58 [:root[data-st-tab="more"]] `rgba(139,92,246,.3)` |
| `--st-a2` | st L55 [:root[data-st-tab="train"]] `rgba(99,102,241,.22)`; st L56 [:root[data-st-tab="weight"] `rgba(85,82,187,.2)`; st L57 [:root[data-st-tab="history] `rgba(211,119,50,.16)`; st L58 [:root[data-st-tab="more"]] `rgba(148,163,184,.1)` |
| `--st-a3` | st L55 [:root[data-st-tab="train"]] `rgba(168,85,247,.16)`; st L56 [:root[data-st-tab="weight"] `rgba(180,154,255,.14)`; st L57 [:root[data-st-tab="history] `rgba(139,92,246,.18)`; st L58 [:root[data-st-tab="more"]] `rgba(99,102,241,.14)` |
| `--st-a4` | st L55 [:root[data-st-tab="train"]] `rgba(236,72,153,.08)`; st L56 [:root[data-st-tab="weight"] `rgba(211,119,50,.1)`; st L57 [:root[data-st-tab="history] `rgba(196,181,253,.07)`; st L58 [:root[data-st-tab="more"]] `rgba(236,72,153,.06)` |
| `--muted` | idx L38 (shadowed) `#9ca3af`; idx L2164 (shadowed) `#A7A3B5`; idx L2347 `#9f9ca4` |
| `--muted2` | idx L39 (shadowed) `#71717a`; idx L2348 `#6a686e` |
| `--n99-muted` | cut L6 (shadowed) `#b3adbf`; prem L225 `var(--nxt-text-secondary)` |
| `--n99-text` | cut L6 (shadowed) `#f0edf6`; prem L224 `var(--nxt-text-primary)` |
| `--nxt-text-muted` | prem L33 (shadowed) `#8b8499`; st L1937 `#9893AA` |
| `--nxt-text-primary` | prem L31 (shadowed) `#f2eff7`; st L1937 `#F4F2FA` |
| `--nxt-text-secondary` | prem L32 (shadowed) `#b5aec4`; st L1937 `#B9B5C8` |
| `--text` | idx L37 (shadowed) `#f4f4f5`; idx L2346 `#f6f5f7` |
| `--vn-ink` | vn L42 (shadowed) `#F1F3F7`; st L1936 `#F4F2FA` |
| `--vn-ink-2` | vn L43 (shadowed) `#AEB4C0`; st L1936 `#B9B5C8` |
| `--vn-ink-3` | vn L44 (shadowed) `#8B92A0`; st L1936 `#9893AA` |
| `--vn-ink-4` | vn L45 (shadowed) `#7E8593`; st L1936 `#8A85A0` |
| `--green` | idx L43 (shadowed) `#a477f5`; idx L2170 (shadowed) `#bea0ff`; idx L2352 `#b18aff` |
| `--n99-accent` | cut L6 (shadowed) `#b18aff`; prem L227 `var(--nxt-purple-primary)` |
| `--orange` | idx L46 (shadowed) `#fb923c`; idx L2355 `#ff9a62` |
| `--purple` | idx L40 (shadowed) `#a78bfa`; idx L2166 (shadowed) `#A78BFA`; idx L2349 `#b18aff` |
| `--purple2` | idx L41 (shadowed) `#8b5cf6`; idx L2167 (shadowed) `#8B5CF6`; idx L2350 `#a477f5` |
| `--red` | idx L44 (shadowed) `#fb7185`; idx L2353 `#ff758c` |
| `--sky` | idx L42 (shadowed) `#7dd3fc`; idx L2169 (shadowed) `#7DD3FC`; idx L2351 `#aa7afa` |
| `--yellow` | idx L45 (shadowed) `#facc15`; idx L2354 `#f7d76b` |
| `--radius` | idx L47 (shadowed) `22px`; idx L2356 `26px` |
| `--st-rail` | st L2610 [@(min-width:1024px)] `84px` |
| `--vn-r-surface` | vn L69 `20px`; vn L365 [@(max-width:359px)] `18px` |
| `--vn-gutter` | vn L75 `20px`; vn L365 [@(max-width:359px)] `16px` |
| `--st-font` | st L42 (shadowed) `-apple-system,BlinkMacSystemFont,"SF Pro Text…`; st L1328 `-apple-system,BlinkMacSystemFont,"SF Pro Text…` |
| `--st-font-d` | st L43 (shadowed) `-apple-system,BlinkMacSystemFont,"SF Pro Disp…`; st L1329 (shadowed) `var(--st-font)`; st L2294 `"Geist",-apple-system,BlinkMacSystemFont,"SF …` |
| `--st-col` | st L2610 [@(min-width:1024px)] `680px`; st L2631 [@(min-width:1440px)] `720px` |
| `--n99-border` | cut L6 (shadowed) `rgba(228,223,239,.12)`; prem L226 `var(--nxt-border-subtle)` |

### 1.5 Non-root custom properties

| Custom property | Where defined (outside :root/html/body) | Sample value | Notes |
|---|---|---|---|
| `--c` | strata.css:208 .st-t-dec.vn-tone-watch, strata.css:2246 #trainPage .st-cmeter-h | `var(--vn-review,#B8842A)` | set from JS inline style strings |
| `--e` | strata.css:1694 .st-dec-trend.is-down, strata.css:1694 .st-dec-trend.is-up, strata.css:1694 .st-dec-trend.is-flat | `#C4B5FD` |  |
| `--k` | strata.css:1178 #historyPage .st-cal-stats .lift,…, strata.css:1181 #historyPage .st-cal-stats .floor…, strata.css:1182 #historyPage .st-cal-stats .body … (+16 more) | `var(--st-lift)` |  |
| `--n99-accent` | premium-ui.css:800 .nxp | `var(--nxt-accent)` |  |
| `--nxa-body-hi` | strata.css:2668 .nxa | `#403B4F` | set from JS inline style strings |
| `--nxa-body-lo` | strata.css:2668 .nxa | `#1E1C28` | set from JS inline style strings |
| `--nxa-prim-hi` | strata.css:2668 .nxa | `#F2ECFF` | set from JS inline style strings |
| `--nxa-prim-lo` | strata.css:2668 .nxa | `#6A49D8` | set from JS inline style strings |
| `--nxa-prim-mid` | strata.css:2668 .nxa | `#B49AFF` | set from JS inline style strings |
| `--nxa-sec-hi` | strata.css:2668 .nxa | `#7D6BB3` | set from JS inline style strings |
| `--nxa-sec-lo` | strata.css:2668 .nxa | `#3A3256` | set from JS inline style strings |
| `--st-font-d` | strata.css:2299 #trainPage .st-train-active | `-apple-system,BlinkMacSystemFont,"SF …` |  |
| `--st-mast` | strata.css:2400 #trainPage, strata.css:2401 #weightPage, strata.css:2402 #historyPage (+1 more) | `rgba(124,58,237,.45)` |  |

### 1.6 Colour literals outside token definitions

"Occurrences" counts hex, rgb(a), hsl(a) and oklch/color() literals in declarations that are not custom-property definitions. "Distinct strings" are case-folded, whitespace-free literal texts. "Distinct base colours" ignores alpha. Token-definition literals are counted separately.

| File | Occurrences outside tokens | Distinct literal strings | Distinct base colours | Literals inside token definitions | Named colour keywords in declarations |
|---|---|---|---|---|---|
| index.html | 714 | 273 | 122 | 48 | 0 |
| cut-support.css | 83 | 75 | 69 | 15 | 0 |
| premium-ui.css | 14 | 13 | 9 | 33 | 0 |
| vnext.css | 52 | 29 | 11 | 25 | 0 |
| strata.css | 649 | 267 | 79 | 97 | 0 |

`color-mix()` is used 99 times in strata.css. Its hex arguments are counted above. No `oklch()`, `lab()` or `hwb()` literals were found.

## 2. Colour audit

### 2.1 Result

- **GREEN (70 to 160 degrees):** 0 literals outside token definitions, 0 inside them. Named keywords (`green`, `teal`, `cyan`, `aqua`, `lime`, `mint`, `blue`, `sky`) appear only in comments (premium-ui.css:52, 66, 3136, 3137; strata.css:1288) and class names (`.apx96-chip.sky`, `.apx96-chip.lime`, index.html:2524 to 2525).
- **TEAL/CYAN (160 to 205 degrees): 52 occurrences** = 2 token definitions (`--sky` at index.html:42 and 2169, both `#7dd3fc`, shadowed by index.html:2351) and **50 usages**: 45 in rules that match markup, 3 in rules whose class names are absent from the markup, and 2 on `body` (element-only rules). Every usage is in the inline block; none is in cut-support, premium-ui, vnext or strata.
- **BLUE-ISH (205 to 250 degrees): 40 occurrences** (strata 31, vnext 5, inline 4). Table 2.3.
- **VIOLET/INDIGO (250 to 300 degrees): 566 occurrences** and **MAGENTA/ORCHID: 14**, the identity and category hues. Not listed one by one. The most frequent literals are `#8b5cf6` (15), `#bea0ff` (13), `#b18aff` (12), `#a78bfa` (9), `#b49aff` (9) and `rgba(139,92,246,…)` variants.
- `#a477f5` (the value the `--green` and `--purple2` names carry in index.html:43 and 2350) is VIOLET/INDIGO (261 degrees), dominant blue channel. It is not a green or teal value, but its name is. Effective `--green` is `#b18aff` (index.html:2352), effective `--purple2` is `#a477f5` (index.html:2350).

### 2.2 Teal and cyan occurrences (TEAL/CYAN)

"Later identical selector" is the first later declaration with the same selector text and property and at least equal importance. It is a textual override signal, not a cascade proof.

| Where | Literal (hue) | Property | Selector | Rule status | Later identical selector (override) |
|---|---|---|---|---|---|
| index.html:42 | `#7dd3fc` (199°) | --sky | `(token) --sky` | element | shadowed by later :root block |
| index.html:56 | `rgba(125,211,252,.08)` (199°) | background | `body` | element | - |
| index.html:81 | `rgba(125,211,252,.07)` (199°) | background | `.hero` | live | - |
| index.html:254 | `rgba(125,211,252,.055)` (199°) | background | `.coach` | live | - |
| index.html:551 | `rgba(125,211,252,.13)` (199°) | border | `.rest-strip` | live | - |
| index.html:552 | `rgba(125,211,252,.055)` (199°) | background | `.rest-strip` | live | - |
| index.html:649 | `rgba(125,211,252,.08)` (199°) | background | `.scan-status` | dead | - |
| index.html:650 | `rgba(125,211,252,.15)` (199°) | border | `.scan-status` | dead | - |
| index.html:651 | `#bae6fd` (201°) | color | `.scan-status` | dead | - |
| index.html:658 | `rgba(125,211,252,.14)` (199°) | border | `.notify-card` | live | index.html:697 |
| index.html:658 | `rgba(125,211,252,.07)` (199°) | background | `.notify-card` | live | index.html:698 |
| index.html:697 | `rgba(125,211,252,.16)` (199°) | border | `.notify-card` | live | - |
| index.html:698 | `rgba(125,211,252,.075)` (199°) | background | `.notify-card` | live | - |
| index.html:898 | `rgba(125,211,252,.10)` (199°) | background | `.coach-pro:before` | live | - |
| index.html:920 | `rgba(125,211,252,.14)` (199°) | border | `.coach-source` | live | - |
| index.html:921 | `rgba(125,211,252,.08)` (199°) | background | `.coach-source` | live | - |
| index.html:922 | `#bae6fd` (201°) | color | `.coach-source` | live | - |
| index.html:1022 | `rgba(125,211,252,.08)` (199°) | background | `.focus-premium:after` | live | - |
| index.html:1082 | `rgba(125,211,252,.13)` (199°) | border | `.focus-rest-line` | live | - |
| index.html:1083 | `rgba(125,211,252,.055)` (199°) | background | `.focus-rest-line` | live | - |
| index.html:1143 | `#bae6fd` (201°) | color | `.gym-toggle-chip .swap` | live | - |
| index.html:1225 | `rgba(125,211,252,.08)` (199°) | background | `.home-hero-clean:after` | live | - |
| index.html:1390 | `rgba(125,211,252,.16)` (199°) | border | `.home-source-pill` | live | - |
| index.html:1391 | `rgba(125,211,252,.08)` (199°) | background | `.home-source-pill` | live | - |
| index.html:1392 | `#bae6fd` (201°) | color | `.home-source-pill` | live | - |
| index.html:1468 | `rgba(125,211,252,.15)` (199°) | border-color | `.home-focus-clean` | live | - |
| index.html:1469 | `rgba(125,211,252,.055)` (199°) | background | `.home-focus-clean` | live | - |
| index.html:1515 | `rgba(125,211,252,.15)` (199°) | border | `.zone2-card` | live | - |
| index.html:1516 | `rgba(125,211,252,.085)` (199°) | background | `.zone2-card` | live | - |
| index.html:1528 | `rgba(125,211,252,.12)` (199°) | background | `.zone2-card:before` | live | - |
| index.html:1538 | `rgba(125,211,252,.16)` (199°) | border | `.zone2-icon` | live | - |
| index.html:1539 | `rgba(125,211,252,.10)` (199°) | background | `.zone2-icon` | live | - |
| index.html:1574 | `rgba(125,211,252,.14)` (199°) | border | `.zone2-mini-button` | live | - |
| index.html:1575 | `rgba(125,211,252,.075)` (199°) | background | `.zone2-mini-button` | live | - |
| index.html:1576 | `#bae6fd` (201°) | color | `.zone2-mini-button` | live | - |
| index.html:1621 | `#7dd3fc` (199°) | background | `.po-fill` | live | - |
| index.html:1690 | `#7dd3fc` (199°) | background | `.po-progress` | live | - |
| index.html:1934 | `rgba(125,211,252,.15)` (199°) | border | `.minimum-card` | live | - |
| index.html:1935 | `rgba(125,211,252,.06)` (199°) | background | `.minimum-card` | live | - |
| index.html:2102 | `rgba(125,211,252,.22)` (199°) | border-color | `.calendar-day.today` | live | - |
| index.html:2103 | `rgba(125,211,252,.07)` (199°) | background | `.calendar-day.today` | live | - |
| index.html:2139 | `#7dd3fc` (199°) | background | `.calendar-dot.cardio` | live | index.html:2484 |
| index.html:2169 | `#7dd3fc` (199°) | --sky | `(token) --sky` | element | shadowed by later :root block |
| index.html:2176 | `rgba(125,211,252,.08)` (199°) | background | `body` | element | - |
| index.html:2198 | `rgba(125,211,252,.10)` (199°) | background | `.home-hero-clean,.hero` | live | - |
| index.html:2205 | `#7dd3fc` (199°) | background | `.btn,.home-cta,.tab.active,.minimum-actions button.…` | live | - |
| index.html:2254 | `rgba(125,211,252,.10)` (199°) | background | `.v80-coach-icon` | live | index.html:2489 |
| index.html:2525 | `rgba(125,211,252,.16)` (199°) | border-color | `.apx96-chip.sky` | live | - |
| index.html:2525 | `rgba(125,211,252,.07)` (199°) | background | `.apx96-chip.sky` | live | - |
| index.html:2525 | `#a6e3fa` (196°) | color | `.apx96-chip.sky` | live | - |
| index.html:2541 | `rgba(125,211,252,.15)` (199°) | border-color | `.apx96-floorball` | live | - |
| index.html:2541 | `rgba(125,211,252,.15)` (199°) | background | `.apx96-floorball` | live | - |

### 2.3 Blue-ish occurrences (BLUE-ISH)

| Where | Literal (hue) | Property | Selector | Rule status | Later identical selector (override) |
|---|---|---|---|---|---|
| index.html:35 | `#1e2430` (220°) | --panel3 | `(token) --panel3` | element | - |
| index.html:38 | `#9ca3af` (218°) | --muted | `(token) --muted` | element | - |
| index.html:1202 | `#151329` (245°) | background | `.home-hero-clean` | live | - |
| index.html:2198 | `#151827` (230°) | background | `.home-hero-clean,.hero` | live | - |
| vnext.css:44 | `#8b92a0` (220°) | --vn-ink-3 | `(token) --vn-ink-3` | element | - |
| vnext.css:45 | `#7e8593` (220°) | --vn-ink-4 | `(token) --vn-ink-4` | element | - |
| vnext.css:1095 | `#79818f` (218°) | background | `#weightPage .vn-key-raw, #weightPage .n99-legend i.…` | live | - |
| vnext.css:1100 | `#79818f` (218°) | box-shadow | `#weightPage .vn-key-post, #weightPage .n99-legend i…` | live | - |
| vnext.css:1162 | `#79818f` (218°) | background | `#weightPage .vn-journey-travel` | live | - |
| strata.css:22 | `#8b7cff` (247°) | --st-lift | `(token) --st-lift` | element | - |
| strata.css:55 | `rgba(99,102,241,.22)` (239°) | --st-a2 | `(token) --st-a2` | live | - |
| strata.css:56 | `rgba(85,82,187,.2)` (242°) | --st-a2 | `(token) --st-a2` | live | - |
| strata.css:57 | `rgba(99,102,241,.34)` (239°) | --st-a1 | `(token) --st-a1` | live | - |
| strata.css:58 | `rgba(148,163,184,.1)` (215°) | --st-a2 | `(token) --st-a2` | live | - |
| strata.css:58 | `rgba(99,102,241,.14)` (239°) | --st-a3 | `(token) --st-a3` | live | - |
| strata.css:698 | `rgba(139,124,255,.18)` (247°) | background | `#historyPage .nxp-cal-day.has-lift` | live | strata.css:2366 |
| strata.css:1108 | `#8b7cff` (247°) | background | `.st-wk.is-on .st-wk-t i` | dead | - |
| strata.css:1156 | `rgba(139,124,255,.22)` (247°) | background | `#historyPage .nxp-cal-day[data-k]:not([data-k="none…` | live | - |
| strata.css:1158 | `rgba(139,124,255,.7)` (247°) | box-shadow | `#historyPage .nxp-cal-day[data-k] .nxp-cal-marks i.…` | live | - |
| strata.css:1179 | `rgba(139,124,255,.8)` (247°) | box-shadow | `#historyPage .st-cal-stats .lift i,#historyPage .st…` | live | - |
| strata.css:1570 | `#5552bb` (242°) | --k | `(token) --k` | live | - |
| strata.css:1577 | `#9a97aa` (249°) | color | `#homePage .st-tweek .vn-week-c:not(.is-k-rest) .vn-…` | live | - |
| strata.css:1579 | `#6b6880` (248°) | color | `#homePage .st-tweek .vn-week-c.is-k-rest .vn-week-t` | live | - |
| strata.css:1622 | `#5552bb` (242°) | background | `#homePage .st-tweek .vn-week::before` | live | - |
| strata.css:1630 | `#6b6880` (248°) | color | `#homePage .st-tweek .vn-week-c.is-k-rest .vn-week-d` | live | strata.css:1662 |
| strata.css:1662 | `#6b6880` (248°) | color | `#homePage .st-tweek .vn-week-c.is-k-rest .vn-week-d` | live | - |
| strata.css:1715 | `#6b6880` (248°) | color | `.st-dec-chip::after` | live | - |
| strata.css:2099 | `#5552bb` (242°) | --k | `(token) --k` | live | - |
| strata.css:2110 | `#6b6880` (248°) | color | `#homePage .st-tweek [data-rail] .vn-week-c.is-k-res…` | live | - |
| strata.css:2120 | `#6b6880` (248°) | color | `#homePage .st-tweek [data-rail] .vn-week-c.is-misse…` | live | - |
| strata.css:2137 | `#6b6880` (248°) | color | `#homePage .st-tweek [data-rail] .vn-week-c.is-k-res…` | live | - |
| strata.css:2329 | `rgba(99,102,241,.06)` (239°) | background | `.st-tile` | live | strata.css:2380 |
| strata.css:2366 | `rgba(139,124,255,.42)` (247°) | background | `#historyPage .nxp-cal-day.has-lift` | live | - |
| strata.css:2366 | `rgba(139,124,255,.14)` (247°) | background | `#historyPage .nxp-cal-day.has-lift` | live | - |
| strata.css:2366 | `rgba(139,124,255,.7)` (247°) | box-shadow | `#historyPage .nxp-cal-day.has-lift` | live | - |
| strata.css:2374 | `rgba(99,102,241,.10)` (239°) | background | `#weightPage .vn-weight` | live | strata.css:2380 |
| strata.css:2401 | `rgba(99,102,241,.42)` (239°) | --st-mast | `(token) --st-mast` | live | - |
| strata.css:2437 | `rgba(139,124,255,.46)` (247°) | background | `#historyPage .vn-hist-calendar .nxp-cal-day[data-k=…` | live | - |
| strata.css:2437 | `rgba(139,124,255,.14)` (247°) | background | `#historyPage .vn-hist-calendar .nxp-cal-day[data-k=…` | live | - |
| strata.css:2437 | `rgba(139,124,255,.85)` (247°) | box-shadow | `#historyPage .vn-hist-calendar .nxp-cal-day[data-k=…` | live | - |

### 2.4 Verdict against D54

D54 says "No green, teal or cyan remains in any stylesheet" and lists the replacement set (violet `#8B5CF6`, apricot `#D37732`, raspberry `#A43066`, orchid `#BF75C5`, indigo `#5552BB`, gold `#E2B04A`, mauve `#9B8BB8`, lavender `#C4B5FD`, rose `#F0709A`). The strata layer follows that set (`--st-cardio`, `--st-floor`, `--st-rest`, `--st-fat`, `--st-lean` at strata.css:23 to 27). The inline block does not. Its sky tints appear to date from the pre-Dusk palette, and 41 of its usages sit in rules that match markup and have no later identical-selector override, so they render today. Owner decision needed before any cleanup.

## 3. Layer conflicts

### 3.1 Winners per component (cascade model, 390px)

Columns: winning declaration (file:line), its selector, whether it is `!important`, its specificity, and how many declarations from other layers it overrides. "none" means no rule sets the property for that element. Media-conditioned winners are marked.

| Component | Property | Winner | Selector | !important | Specificity | Value | Other-layer declarations overridden |
|---|---|---|---|---|---|---|---|
| Canvas: html | `background` | strata.css:59 | `html` | yes | 0.0.1 | `#07060B` | 4 |
| Canvas: html | `color` | index.html:50 | `html` | no | 0.0.1 | `var(--text)` | 0 |
| Canvas: body (Today) | `background` | strata.css:60 | `body` | yes | 0.0.1 | `transparent` | 7 |
| Canvas: body (Today) | `color` | index.html:2180 | `body` | yes | 0.0.1 | `var(--ink)` | 2 |
| Canvas: body (Today) | `font-family` | strata.css:1331 | `body` | yes | 0.0.1 | `var(--st-font)` | 3 |
| Aurora: body::before (Today, data-st-tab=home) | `background` | strata.css:64 | `body::before` | yes | 0.0.2 | `radial-gradient(46% 34% at 12% 10%,var(--…` | 0 |
| Aurora: body::before (Today, data-st-tab=home) | `opacity` | strata.css:63 | `body::before` | yes | 0.0.2 | `1` | 1 |
| Aurora: body::before (Weight tab) | `background` | strata.css:64 | `body::before` | yes | 0.0.2 | `radial-gradient(46% 34% at 12% 10%,var(--…` | 0 |
| Tile surface: .st-tile (Today) | `background` | strata.css:2329 | `.st-tile` | yes | 0.1.0 | `radial-gradient(120% 90% at 0% 0%,color-m…` | 0 |
| Tile surface: .st-tile (Today) | `box-shadow` | strata.css:2320 | `.st-tile` | yes | 0.1.0 | `var(--st-depth)` | 0 |
| Tile surface: .st-tile (Today) | `border-radius` | strata.css:120 | `.st-tile` | no | 0.1.0 | `var(--st-r)` | 0 |
| Tile surface: .st-tile (Today) | `border-color` | strata.css:2320 | `.st-tile` | yes | 0.1.0 | `transparent` | 0 |
| Chart card: .vn-weight (Weight) | `background` | strata.css:2374 | `#weightPage .vn-weight` | yes | 1.1.0 | `radial-gradient(130% 55% at 0% 0%,rgba(13…` | 1 |
| Chart card: .vn-weight (Weight) | `box-shadow` | strata.css:2320 | `#weightPage .vn-weight` | yes | 1.1.0 | `var(--st-depth)` | 1 |
| Chart card: .vn-weight (Weight) | `border-radius` | strata.css:406 | `#weightPage .vn-weight` | no | 1.1.0 | `var(--st-r)` | 0 |
| Primary button: .st-cta (Today training card) | `background` | strata.css:2466 | `#homePage .st-t-train .st-cta` | yes | 1.2.0 | `var(--btn-primary)` | 0 |
| Primary button: .st-cta (Today training card) | `box-shadow` | strata.css:2466 | `#homePage .st-t-train .st-cta` | yes | 1.2.0 | `var(--btn-primary-shadow)` | 0 |
| Primary button: .st-cta (Today training card) | `border-radius` | strata.css:2465 | `#homePage .st-t-train .st-cta` | yes | 1.2.0 | `999px` | 0 |
| Primary button: .st-cta (Today training card) | `color` | strata.css:2465 | `#homePage .st-t-train .st-cta` | yes | 1.2.0 | `#fff` | 0 |
| Primary button: .st-cta (Today training card) | `font-family` | strata.css:2467 | `#homePage .st-t-train .st-cta` | yes | 1.2.0 | `var(--st-font-d)` | 0 |
| Primary button: .st-cta (Today training card) | `font-size` | strata.css:1345 | `.st-cta` | yes | 0.1.0 | `var(--fs-cta)` | 0 |
| Primary button: .st-cta (Today training card) | `font-weight` | strata.css:2467 | `#homePage .st-t-train .st-cta` | yes | 1.2.0 | `620` | 0 |
| Primary button: .st-cta (Today training card) | `min-height` | strata.css:143 | `.st-cta` | no | 0.1.0 | `54px` | 0 |
| Glass button: .st-chip (Today) | `background` | strata.css:2475 | `.st-chip` | yes | 0.1.0 | `var(--btn-glass)` | 0 |
| Glass button: .st-chip (Today) | `box-shadow` | strata.css:2475 | `.st-chip` | yes | 0.1.0 | `var(--btn-glass-shadow)` | 0 |
| Glass button: .st-chip (Today) | `border-radius` | strata.css:2474 | `.st-chip` | yes | 0.1.0 | `999px` | 0 |
| Glass button: .st-chip (Today) | `color` | strata.css:2476 | `.st-chip` | yes | 0.1.0 | `var(--btn-ink)` | 0 |
| Glass button: .st-chip (Today) | `font-family` | strata.css:2476 | `.st-chip` | yes | 0.1.0 | `var(--st-font-d)` | 0 |
| Glass button: .st-chip (Today) | `font-size` | strata.css:107 | `.st-chip` | no | 0.1.0 | `550 14px var(--st-font)` | 0 |
| Segmented track: .vn-seg (Weight) | `background` | strata.css:2492 | `#weightPage .vn-seg` | yes | 1.1.0 | `rgba(255,255,255,.045)` | 1 |
| Segmented track: .vn-seg (Weight) | `box-shadow` | strata.css:2492 | `#weightPage .vn-seg` | yes | 1.1.0 | `inset 0 0 0 1px rgba(255,255,255,.07),ins…` | 1 |
| Segmented track: .vn-seg (Weight) | `border-radius` | strata.css:2492 | `#weightPage .vn-seg` | yes | 1.1.0 | `999px` | 1 |
| Segmented track: .vn-seg (Weight) | `padding` | vnext.css:1035 | `#weightPage .vn-seg` | no | 1.1.0 | `3px` | 0 |
| Segmented pill: .st-seg-pill (Weight) | `background` | strata.css:2495 | `.vn-seg.st-segc .st-seg-pill` | yes | 0.3.0 | `radial-gradient(120% 120% at 50% 0%,rgba(…` | 0 |
| Segmented pill: .st-seg-pill (Weight) | `box-shadow` | strata.css:2496 | `.vn-seg.st-segc .st-seg-pill` | yes | 0.3.0 | `inset 0 1px 0 rgba(255,255,255,.32),0 8px…` | 0 |
| Segmented pill: .st-seg-pill (Weight) | `border-radius` | strata.css:2494 | `.vn-seg.st-segc .st-seg-pill` | yes | 0.3.0 | `999px` | 0 |
| Segmented option: .vn-seg-opt (More) | `background` | vnext.css:1705 | `#morePage .vn-seg-opt` | no | 1.1.0 | `transparent` | 0 |
| Segmented option: .vn-seg-opt (More) | `color` | vnext.css:1705 | `#morePage .vn-seg-opt` | no | 1.1.0 | `var(--vn-ink-2)` | 0 |
| Segmented option: .vn-seg-opt (More) | `font-size` | vnext.css:1706 | `#morePage .vn-seg-opt` | no | 1.1.0 | `inherit` | 0 |
| Segmented option: .vn-seg-opt (More) | `border-radius` | vnext.css:1704 | `#morePage .vn-seg-opt` | no | 1.1.0 | `var(--vn-r-control)` | 0 |
| Segmented option: .vn-seg-opt (More) | `min-height` | vnext.css:1703 | `#morePage .vn-seg-opt` | no | 1.1.0 | `46px` | 0 |
| Dock: nav.tabs (Today) | `background` | strata.css:376 | `.tabs` | yes | 0.1.0 | `rgba(22,21,30,.72)` | 2 |
| Dock: nav.tabs (Today) | `box-shadow` | strata.css:378 | `.tabs` | yes | 0.1.0 | `inset 0 1px 0 rgba(var(--st-hl),.08),0 22…` | 1 |
| Dock: nav.tabs (Today) | `border-radius` | strata.css:375 | `.tabs` | yes | 0.1.0 | `30px` | 1 |
| Dock: nav.tabs (Today) | `backdrop-filter` | strata.css:377 | `.tabs` | yes | 0.1.0 | `blur(24px) saturate(1.7)` | 2 |
| Dock: nav.tabs (Today) | `padding` | strata.css:379 | `.tabs` | yes | 0.1.0 | `6px` | 1 |
| Dock inner: .tabs-inner.st-dock | `background` | premium-ui.css:303 | `.tabs-inner` | yes | 0.1.0 | `transparent` | 0 |
| Dock inner: .tabs-inner.st-dock | `box-shadow` | none | - | - | - | - | 0 |
| Dock inner: .tabs-inner.st-dock | `border-radius` | none | - | - | - | - | 0 |
| Active tab: .tab.active | `background` | premium-ui.css:327 | `.tabs .tab.active` | yes | 0.3.0 | `transparent` | 5 |
| Active tab: .tab.active | `box-shadow` | premium-ui.css:330 | `.tabs .tab.active` | yes | 0.3.0 | `none` | 2 |
| Active tab: .tab.active | `color` | strata.css:392 | `.tabs .tab.active` | yes | 0.3.0 | `#fff` | 7 |
| Page title: h1.st-h1 (Today) | `font-family` | strata.css:2303 | `.st-h1` | yes | 0.1.0 | `var(--st-font-d)` | 0 |
| Page title: h1.st-h1 (Today) | `font-size` | strata.css:2346 | `#homePage .st-head .st-h1` | yes | 1.2.0 | `34px` | 0 |
| Page title: h1.st-h1 (Today) | `font-weight` | strata.css:2303 | `.st-h1` | yes | 0.1.0 | `640` | 0 |
| Page title: h1.st-h1 (Today) | `letter-spacing` | strata.css:2303 | `.st-h1` | yes | 0.1.0 | `-.04em` | 0 |
| Page title: plain h1 (Weight) | `font-family` | strata.css:2303 | `#weightPage h1` | yes | 1.0.1 | `var(--st-font-d)` | 0 |
| Page title: plain h1 (Weight) | `font-size` | strata.css:2307 | `#weightPage h1` | yes | 1.0.1 | `36px` | 14 |
| Page title: plain h1 (Weight) | `font-weight` | strata.css:2303 | `#weightPage h1` | yes | 1.0.1 | `640` | 11 |
| Page title: plain h1 (Weight) | `letter-spacing` | strata.css:2303 | `#weightPage h1` | yes | 1.0.1 | `-.04em` | 13 |
| Page title: plain h1 (Weight) | `color` | strata.css:2304 | `#weightPage h1` | yes | 1.0.1 | `transparent` | 3 |
| Numeral: .st-odo (Today mini) | `font-family` | strata.css:2312 | `#homePage .st-minis .st-odo` | yes | 1.2.0 | `var(--st-font-d)` | 0 |
| Numeral: .st-odo (Today mini) | `font-size` | strata.css:1967 | `#homePage .st-minis .st-odo` | yes | 1.2.0 | `26px` | 0 |
| Numeral: .st-odo (Today mini) | `font-weight` | strata.css:2312 | `#homePage .st-minis .st-odo` | yes | 1.2.0 | `220` | 0 |
| Numeral: .st-odo (Today mini) | `letter-spacing` | strata.css:1967 | `#homePage .st-minis .st-odo` | yes | 1.2.0 | `-.03em` | 0 |
| Numeral: .st-odo (Today mini) | `color` | strata.css:226 | `.st-odo` | no | 0.1.0 | `transparent` | 0 |
| Input: generic .input (outside sheets) | `background` | index.html:2412 | `.input` | yes | 0.1.0 | `#0c0c0d` | 0 |
| Input: generic .input (outside sheets) | `border-radius` | index.html:2412 | `.input` | yes | 0.1.0 | `17px` | 0 |
| Input: generic .input (outside sheets) | `min-height` | index.html:373 | `.input` | yes | 0.1.0 | `45px` | 0 |
| Input: generic .input (outside sheets) | `font-size` | index.html:2413 | `.input` | yes | 0.1.0 | `16px` | 0 |
| Input: generic .input (outside sheets) | `color` | index.html:2413 | `.input` | yes | 0.1.0 | `#f6f5f7` | 0 |
| Input: generic .input (outside sheets) | `box-shadow` | index.html:2414 | `.input` | yes | 0.1.0 | `inset 0 1px 0 rgba(255,255,255,.018)` | 0 |
| Input: inside .modal .sheet | `background` | strata.css:1990 | `.n99-modal .sheet .st-qw-field input` | yes | 0.3.1 | `transparent` | 2 |
| Input: inside .modal .sheet | `border-radius` | strata.css:1976 | `.n99-modal .sheet :where(input:not([type=checkbox]):not([ty…` | yes | 0.2.0 | `var(--r-ctl)` | 3 |
| Input: inside .modal .sheet | `min-height` | index.html:373 | `.input` | yes | 0.1.0 | `45px` | 2 |
| Input: inside .modal .sheet | `font-size` | strata.css:1991 | `.n99-modal .sheet .st-qw-field input` | yes | 0.3.1 | `200 64px/1 var(--st-font-d)` | 4 |
| Input: inside .modal .sheet | `color` | strata.css:1977 | `.n99-modal .sheet :where(input:not([type=checkbox]):not([ty…` | yes | 0.2.0 | `var(--st-ink)` | 2 |
| Input: inside .modal .sheet | `box-shadow` | strata.css:1990 | `.n99-modal .sheet .st-qw-field input` | yes | 0.3.1 | `none` | 1 |
| Sheet: .sheet in .modal | `background` | strata.css:725 | `.n99-modal .sheet` | yes | 0.2.0 | `radial-gradient(90% 40% at 50% 0%,rgba(13…` | 4 |
| Sheet: .sheet in .modal | `box-shadow` | strata.css:726 | `.n99-modal .sheet` | yes | 0.2.0 | `0 -20px 60px -20px rgba(0,0,0,.9)` | 1 |
| Sheet: .sheet in .modal | `border-radius` | strata.css:724 | `.n99-modal .sheet` | yes | 0.2.0 | `28px 28px 0 0` | 3 |
| Sheet: .sheet in .modal | `padding` | index.html:397 | `.sheet` | yes | 0.1.0 | `16px 12px calc(22px + var(--nxt-safe-bott…` | 1 |
| Sheet: .sheet in .modal | `backdrop-filter` | none | - | - | - | - | 0 |
| Toast: .toast | `background` | strata.css:1952 | `.toast` | yes | 0.1.0 | `rgba(26,23,38,.92)` | 2 |
| Toast: .toast | `box-shadow` | strata.css:1953 | `.toast` | yes | 0.1.0 | `inset 0 1px 0 rgba(255,255,255,.1),inset …` | 2 |
| Toast: .toast | `border-radius` | index.html:2499 | `.toast` | yes | 0.1.0 | `999px` | 0 |
| Toast: .toast | `color` | strata.css:1952 | `.toast` | yes | 0.1.0 | `var(--st-ink)` | 2 |
| Toast: .toast | `font-size` | strata.css:1952 | `.toast` | yes | 0.1.0 | `550 13.5px/1.2 var(--st-font)` | 2 |
| Toast: .toast | `font-family` | strata.css:1952 | `.toast` | yes | 0.1.0 | `550 13.5px/1.2 var(--st-font)` | 0 |

### 3.2 Layer behaviour, by component

- **Canvas.** html and body are painted by strata (strata.css:59 and 60, both `!important`). Earlier layers set html and body background (index.html:50 and 2362; cut-support.css:8) and lose. `--bg` and `--n99-bg` are irrelevant to the painted colour.
- **Aurora.** strata.css:61 to 76 is the only `background` on `body::before`. On the Today tab the referenced tints are undefined (key finding 3). The weight, history and more tabs get a value through strata.css:55 to 58.
- **Tiles and cards.** Tile surface and edge come from strata (strata.css:120, 2320, 2329), with `--st-depth` and `--st-tile` defined in strata.css:29 to 33 and 2295 to 2296. Chart cards (`#weightPage .vn-weight`) are strata-only except for vnext's base surface.
- **Primary button (D56).** Entirely strata (strata.css:143, 1345, 2465 to 2467, all in strata). `--btn-primary` and `--btn-primary-shadow` are defined in strata.css:2456 and 2457; the training-card rule has the highest specificity.
- **Glass button.** Entirely strata (strata.css:2474 to 2476, `.st-chip`, `--btn-glass` and `--btn-glass-shadow`).
- **Segmented control.** The track is strata (strata.css:2491 to 2492) over vnext (vnext.css:1033 to 1035, 12px radius, 3px padding). On the Weight tab the track becomes a 999px pill. The More-tab options (`#morePage .vn-seg-opt`) get vnext only (12px radius, 46px min-height), so they are not capsules.
- **Dock.** `.tabs` background, shadow, radius, blur and padding come from strata (strata.css:375 to 379, `!important`; strata.css:2619 at 1024px and up), over premium-ui.css:303 and vnext. The active tab is premium-ui.css:327 and 330, then strata.css:392 for colour.
- **Page title.** `.st-h1` (Today) is strata-only (strata.css:2303 to 2304, then 2346 for the 34px size on the Today header). The plain `h1` on the Weight tab is contested: 14 earlier declarations for font-size, 11 for weight, 13 for letter-spacing. Strata (strata.css:2303 to 2307) wins them all at specificity 1.0.1.
- **Numerals.** The Today mini odometer (`.st-odo`) is strata-only (strata.css:1967, 2312). `.st-big` is laid out in strata.css:222 to 223 (flex, gap, margin) but sets no numeral style.
- **Inputs.** See section 3.3 and 3.4. Generic `.input` is inline (index.html:2411 to 2414, 373). In a `.n99-modal` sheet, strata overrides radius (strata.css:1976) but not min-height.
- **Sheets.** `.n99-modal .sheet` is strata (strata.css:724 to 726, `!important`), over inline and cut-support. Legacy `.modal > .sheet` sheets get index.html:2498 and cut-support.css:14 (table 3.4).
- **Toast.** Background, colour, shadow and font are strata (strata.css:1952 to 1953, `!important`). Radius (999px) is inline (index.html:2499, `!important`) because strata does not set it.
- **Chart text.** No single element model fits: chart text is styled per chart (`#weightPage .st-pillg.is-start-ref text` at strata.css:2276, `.st-dev-k text` at strata.css:1859, and similar). The model cannot give one winner, so the chart row is omitted from 3.1.

### 3.3 Conflicts that change what renders

- **Sheet field height.** index.html:373 `min-height:45px !important` wins over strata.css:1976 `min-height:52px` (not important) and index.html:2412 `min-height:52px` (not important). D44 specifies 52px. Decide whether 45 or 52 is intended, then make one declaration important or remove the other.
- **Input radius.** index.html:2412 `border-radius:17px !important` on `.input` wins outside sheets. In sheets, strata.css:1976 `var(--r-ctl) !important` (14px) wins. Three radii for one control family (17px inline, 14px strata sheet, 10px `--vn-r-input` which the `.input` rule never reads). I7 says input 10px.
- **Aurora on Today** (key finding 3).
- **Plain h1 on Weight.** Fourteen earlier font-size declarations are overridden (table 3.1). The title is stacked over premium-ui, vnext and cut-support rules that still carry their own sizes.
- **Segmented track radius.** vnext sets 12px (`--vn-r-control`), strata sets 999px (strata.css:2492, `!important`). The pill wins on the Weight tab only.
- **Toast radius.** Radius comes from inline only (index.html:2499, `!important`). Background, colour, shadow and font come from strata (strata.css:1952 to 1953, `!important`), which also overrides the inline background on the same element, because both are `!important` and strata loads later. It works today but depends on that load order.

### 3.4 Legacy sheets (no `n99-modal`) versus new sheets

| Selector | Property | Winner (file:line, value, importance) |
|---|---|---|
| `.modal > .sheet` (legacy, no n99-modal) | `background` | cut-support.css:14 `var(--n99-raised)` (important) |
| `.modal > .sheet` (legacy, no n99-modal) | `border-radius` | index.html:2498 `30px 30px 0 0` (normal) |
| `.modal > .sheet` (legacy, no n99-modal) | `box-shadow` | index.html:2498 `0 -24px 70px rgba(0,0,0,.48)` (normal) |
| `.modal > .sheet` (legacy, no n99-modal) | `padding` | index.html:397 `16px 12px calc(22px + var(--nxt-safe-bo…` (important) |
| `.modal .sheet .input` (legacy) | `border-radius` | index.html:2412 `17px` (important) |
| `.modal .sheet .input` (legacy) | `min-height` | index.html:373 `45px` (important) |
| `.modal .sheet .input` (legacy) | `font-size` | index.html:2413 `16px` (important) |

Twelve call sites in index.html build `<div class="modal">` without `n99-modal` (lines 3400, 3646, 3650, 3654, 3885, 4074, 5589, 7173, 7712, 7744, 7853, 7897). Only `cut-support.js:770` builds `.modal.n99-modal`. D44 says sheets and forms share one field recipe, which holds only for that second family.

### 3.5 `!important` by file and the 20 most specific selectors using it

| File | `!important` declarations | Rules containing one | Share of its rules |
|---|---|---|---|
| index.html | 475 | 187 | 27% |
| cut-support.css | 17 | 13 | 6% |
| premium-ui.css | 96 | 51 | 7% |
| vnext.css | 26 | 18 | 3% |
| strata.css | 1237 | 615 | 34% |
| **Total** | **1851** | | |

| # | File:line | Specificity | Selector | !important properties | Media |
|---|---|---|---|---|---|
| 1 | strata.css:2308 | 2.2.0 | `#weightPage .vn-weight .vn-h-sub#vn-traj-headline` | font-family, letter-spacing | - |
| 2 | strata.css:979 | 2.2.0 | `#weightPage .vn-weight .vn-h-sub#vn-traj-headline` | font-size | - |
| 3 | strata.css:2282 | 2.0.0 | `#weightPage #vn-chart-wrap` | margin-inline | (max-width:359px) |
| 4 | strata.css:2281 | 2.0.0 | `#weightPage #vn-chart-wrap` | margin-inline, padding-inline | - |
| 5 | strata.css:2774 | 1.6.1 | `#trainPage .st-train .st-lrow.is-now .st-entry .nxp-stepper-row input[data-le…` | font-size | (max-width:359px) |
| 6 | strata.css:2773 | 1.6.1 | `#trainPage .st-train .st-lrow.is-now .st-entry .nxp-stepper-row input[data-le…` | font-size | (max-width:359px) |
| 7 | strata.css:2772 | 1.5.1 | `#trainPage .st-train .st-lrow.is-now .st-entry .nxp-stepper-row input` | font-size | (max-width:359px) |
| 8 | strata.css:1169 | 1.5.1 | `#historyPage .nxp-cal-day[data-k].is-selected .nxp-cal-marks i.cond` | background | - |
| 9 | strata.css:2582 | 1.5.0 | `:root[data-nxp-motion="reduced"] #weightPage .st-act-wrap.is-draw .st-act-bar` | animation | - |
| 10 | strata.css:2137 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-k-rest .vn-week-t` | color | - |
| 11 | strata.css:2136 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-done .vn-week-t` | color | - |
| 12 | strata.css:2135 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-today .vn-week-t` | color, font-weight | - |
| 13 | strata.css:2133 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-today .vn-week-t` | color, font, letter-spacing | - |
| 14 | strata.css:2133 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-lift .vn-week-t` | color, font, letter-spacing | - |
| 15 | strata.css:2133 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c:not(.is-lift) .vn-week-t` | color, font, letter-spacing | - |
| 16 | strata.css:2133 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-k-rest .vn-week-t` | color, font, letter-spacing | - |
| 17 | strata.css:2130 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-today .vn-week-d` | color | - |
| 18 | strata.css:2128 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-today .st-cap` | background, box-shadow | - |
| 19 | strata.css:2124 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-done .vn-week-d` | color | - |
| 20 | strata.css:2120 | 1.5.0 | `#homePage .st-tweek [data-rail] .vn-week-c.is-missed .vn-week-t` | color, font-weight | - |

### 3.6 Chart text

There is no single chart-text rule. A selector whose last compound is `text` (SVG text) appears in only three files: inline (1), vnext (1) and strata (8), listed below. Chart labels get their fill and size per chart, which is why the component model in 3.1 cannot give one winner for chart text.

| File:line | Selector | Declared properties |
|---|---|---|
| index.html:2266 | `.v80-stage text` | pointer-events |
| vnext.css:1967 | `:is(#morePage, #weightPage) .vn-evo-chart text` | fill, font-size, font-variant-numeric |
| strata.css:267 | `.st-pillg text` | fill, font, font-variant-numeric |
| strata.css:269 | `.st-pillg.is-end text` | fill |
| strata.css:1799 | `.st-pillg.is-low text` | fill, font-size, font-weight |
| strata.css:1840 | `#weightPage .st-dev-k text` | fill, font |
| strata.css:1843 | `.st-pillg.is-goal text` | fill, font |
| strata.css:1858 | `#weightPage .vn-chart-svg>text` | font-size |
| strata.css:1859 | `#weightPage .st-dev-k text` | font-size |
| strata.css:2276 | `#weightPage .st-pillg.is-start-ref text` | fill, font |

## 4. Typography scale

### 4.1 Font sizes per file (sorted, with counts)

- **index.html** (218 `font-size` decls, 38 distinct): 7px×2, 8px×5, 8.5px×1, 9px×28, 9.5px×1, 10px×27, 10.5px×2, 11px×29, 12px×24, 12.5px×2, 13px×18, 14px×8, 15px×7, 16px×9, 17px×4, 18px×5, 19px×7, 20px×3, 21px×5, 22px×9, 23px×2, 24px×2, 25px×1, 26px×1, 27px×1, 30px×1, 31px×1, 32px×1, 33px×1, 34px×1, 37px×2, 38px×2, 41px×1, 43px×1, 46px×1, 47px×1, 48px×1, 52px×1
- **cut-support.css** (82 `font-size` decls, 26 distinct): .4em×1, 11px×1, 12px×13, 13px×12, 14px×16, 15px×2, 16px×9, 18px×1, 19px×1, 21px×2, 22px×1, 23px×1, 24px×2, 25px×1, 27px×2, 29px×1, 31px×1, 34px×2, 35px×2, 47px×1, 64px×1, clamp(29px,7.5vw,38px)×1, var(--nxt-type-body-sm)×1, var(--nxt-type-meta)×4, var(--nxt-type-display)×1, var(--nxt-type-label)×2
- **premium-ui.css** (261 `font-size` decls, 34 distinct): .4em×1, 10px×1, .6875rem×10, .75rem×40, .8125rem×27, .875rem×25, .9375rem×14, 1rem×12, 1.0625rem×5, 1.125rem×12, 18px×1, 1.25rem×14, 1.35rem×2, 1.375rem×3, 1.5rem×4, 1.5625rem×1, 1.6875rem×1, 1.7rem×1, 1.75rem×4, 1.8rem×1, 1.8125rem×1, 1.9rem×1, 2rem×4, 2.5rem×1, 0×1, var(--nxt-type-body)×11, var(--nxt-type-body-sm)×8, var(--nxt-type-meta)×19, var(--nxt-type-micro)×10, var(--nxt-type-display)×1, var(--nxt-type-metric)×1, clamp(1.35rem,6.2vw,1.75rem)×1, clamp(1.75rem,8vw,2.25rem)×1, var(--nxt-type-label)×22
- **vnext.css** (192 `font-size` decls, 31 distinct): .44em×1, .6em×1, 10px×2, 10.5px×3, 11px×3, 11.5px×14, 12px×12, 12.5px×19, 13px×21, 13.5px×11, 14px×9, 14.5px×19, 15px×22, 16px×10, 17px×10, 18px×4, 19px×6, 20px×3, 21px×1, 22px×2, 23px×4, 24px×1, 1.5rem×1, 26px×6, 1.625rem×1, 28px×1, 30px×1, 32px×1, 34px×1, 44px×1, 56px×1
- **strata.css** (301 `font-size` decls, 57 distinct): 9px×1, 9.5px×1, 10px×6, 10.5px×6, 11px×12, 11.5px×10, 12px×13, .78em×1, 12.5px×9, .8em×1, 13px×5, 13.5px×4, 14px×6, 14.5px×1, 15px×3, 15.5px×1, 16px×7, 16.5px×1, 17px×5, 18px×5, 19px×6, 20px×4, 21px×2, 22px×9, 24px×3, 25px×2, 26px×4, 28px×2, 30px×1, 31px×1, 32px×3, 34px×1, 36px×2, 38px×3, 40px×1, 44px×3, 48px×2, 52px×3, 58px×1, 64px×1, 88px×1, 104px×1, 120px×1, 150px×1, var(--fs-hero)×7, var(--fs-cta)×1, var(--fs-body)×21, var(--fs-row)×34, var(--fs-cap)×25, var(--fs-label)×30, var(--fs-micro)×10, var(--fs-sect)×11, var(--fs-cap,12.5px)×1, var(--fs-micro,11px)×2, var(--fs-body,14.5px)×1, calc(11px * var(--tsc,1))×1, calc(10.5px * var(--tsc,1))×1

Font shorthand (`font:`) sizes, counted separately:

- **index.html**: no `font:` shorthand with a size
- **cut-support.css**: no `font:` shorthand with a size
- **premium-ui.css**: no `font:` shorthand with a size
- **vnext.css**: no `font:` shorthand with a size
- **strata.css** (247 `font:` decls, 34 distinct sizes): 9.5px×1, 10px×2, 10.5px×13, 11px×8, 11.5px×14, 12px×22, 12.5px×23, 13px×36, 13.5px×13, 14px×22, 14.5px×8, 15px×13, 15.5px×11, 16px×2, 16.5px×1, 17px×4, 18px×6, 19px×2, 20px×5, 21px×1, 22px×13, 23px×3, 24px×6, 25px×1, 26px×1, 28px×3, 30px×4, 34px×1, 38px×1, 44px×1, 58px×2, 64px×2, 76px×1, 128px×1

### 4.2 Font families

| File | font-family declarations | Distinct stacks (first line) |
|---|---|---|
| index.html | 1 | L52 `-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",Roboto,Arial,sans-serif` |
| index.html | 1 | L506 `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif` |
| index.html | 1 | L2371 `-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",sans-serif` |
| premium-ui.css | 12 | L556 `inherit` |
| vnext.css | 2 | L151 `-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Inter,system-ui,sans-serif` |
| strata.css | 17 | L86 `var(--st-font)` |
| strata.css | 17 | L1967 `var(--st-font-d)` |

Notes: Inter appears in six stacks (index.html:52, 506 and 2371; vnext.css:151 and 419; premium-ui.css:95, which is the unused `--nxt-font`). No Inter font file, `@font-face` or font link exists in the project, so those stacks fall back to the system face. Only Geist is bundled (fonts/geist-latin-wght.woff2, OFL, `fonts/GEIST-OFL.txt`).

### 4.3 Geist (`--st-font-d`)

- `@font-face` for Geist: strata.css:2292, variable weight 100 to 900, `font-display:swap`, file `fonts/geist-latin-wght.woff2`. `sw.js:40` lists the file for the offline cache.
- `--st-font-d` is defined three times: strata.css:43 (SF stack), strata.css:1329 (`var(--st-font)`), and strata.css:2294 (Geist first). The effective value is Geist. It has 55 `var()` references, all in strata.css, covering page titles, tile headings, numerals and the primary button (`.st-cta` font-family at strata.css:2467); `--btn-font` (strata.css:2455) is defined but never referenced.
- Body text uses `--st-font` (228 `var()` references; defined at strata.css:42 and 1328, applied to body at strata.css:86 and 1331). It is the SF stack, consistent with D53.
- The active Train loop redefines `--st-font-d` back to the SF stack on `#trainPage .st-train-active` (strata.css:2299), which is how D53's SF exception is implemented.


### 4.4 The eight-step scale and conformance

The eight-step ramp is `--fs-micro` 11px, `--fs-cap` 12px, `--fs-label` 13px, `--fs-body` 14.5px, `--fs-row` 15.5px, `--fs-sect` 18px, `--fs-hero` 22px and `--fs-title` 28px (strata.css:1342), with `--fs-cta` 16px as a ninth value. `--fs-title` has no references. `--fs-cta` is used once (strata.css:1345).

| File | Size declarations (font-size + font:) | `--fs-*` token | Raw value on the 8 steps (px, rem or em) | Other tokens (--nxt-type-*, inherit) | Off the 8 steps (px, em, calc, clamp) |
|---|---|---|---|---|---|
| index.html | 218 | 0 | 85 | 0 | 133 (33 distinct, px/em/calc/clamp) |
| cut-support.css | 82 | 0 | 28 | 8 | 46 (17 distinct, px/em/calc/clamp) |
| premium-ui.css | 261 | 0 | 97 | 72 | 92 (20 distinct, px/em/calc/clamp) |
| vnext.css | 192 | 0 | 62 | 0 | 130 (24 distinct, px/em/calc/clamp) |
| strata.css | 548 | 143 | 155 | 0 | 250 (41 distinct, px/em/calc/clamp) |

Reading the table: strata is the only file that uses the ramp, and it covers 143 of its 548 size declarations with a `--fs-*` token; 155 more are raw values on the steps. Its remaining 250 off-scale sizes are 171 text sizes between 9px and 17px and 79 display sizes of 19px and up. D44 says off-scale text was snapped to the scale, so the strata text sizes contradict it. Premium-ui.css uses `--nxt-type-*` (80 `var()` references in premium-ui.css and cut-support.css), a different ramp. vnext.css and the inline block use raw sizes only, with half-pixel steps (11.5, 12.5, 13.5, 14.5, 10.5) that are not on the ramp.

## 5. Spacing and radius

### 5.1 Padding, margin and gap values per file

| File | Declarations | Distinct values | Most used (count) |
|---|---|---|---|
| index.html | 433 | 81 | `12px`×69, `10px`×51, `7px`×38, `8px`×25, `6px`×23, `4px`×18, `5px`×17, `14px`×16, `0`×15, `15px`×12 |
| cut-support.css | 131 | 68 | `0`×15, `12px`×11, `10px`×8, `14px`×7, `18px`×6, `5px`×5, `16px 0`×4, `6px`×4, `16px`×3, `8px`×3 |
| premium-ui.css | 520 | 129 | `0`×91, `var(--nxt-space-3)`×36, `var(--nxt-space-2)`×33, `2px`×27, `4px`×20, `0 0 var(--nxt-space-3)`×14, `var(--nxt-space-4)`×12, `0 0 var(--nxt-space-2)`×12, `3px`×11, `8px`×11 |
| vnext.css | 393 | 93 | `0`×78, `var(--vn-s3)`×35, `var(--vn-s5)`×21, `var(--vn-s4)`×21, `var(--vn-s2)`×18, `0 0 var(--vn-s3)`×14, `8px`×12, `4px`×12, `3px`×10, `2px`×8 |
| strata.css | 683 | 174 | `0`×88, `6px`×49, `8px`×41, `10px`×40, `12px`×38, `4px`×31, `2px`×30, `14px`×27, `3px`×23, `16px`×18 |

Share of spacing declarations that use a `var()` token: premium-ui.css 182 of 520, vnext.css 174 of 393, index.html 10 of 433, strata.css 1 of 683. Strata has the widest range (174 distinct values).

### 5.2 Border radius per file

| File | Declarations | Distinct values | Values with counts |
|---|---|---|---|
| index.html | 183 | 26 | `999px`×41, `18px`×20, `17px`×17, `20px`×16, `16px`×12, `24px`×8, `14px`×8, `50%`×7, `22px`×7, `15px`×6, `26px`×6, `30px`×5, `25px`×5, `19px`×4, `28px`×3, `21px`×2, `23px`×2, `0`×2, `32px`×2, `11px`×2, `27px`×2, `29px`×2, `26px 26px 0 0`×1, `30px 30px 0 0`×1, `31px`×1, `10px`×1 |
| cut-support.css | 29 | 21 | `9px`×4, `50%`×3, `0`×3, `11px`×2, `22px`×1, `25px`×1, `13px`×1, `20px`×1, `12px`×1, `16px`×1, `25px 25px 0 0`×1, `30px`×1, `8px`×1, `var(--nxt-radius-md)`×1, `var(--nxt-radius-sm)`×1, `4px`×1, `3px`×1, `7px`×1, `0 10px 10px 0`×1, `15px`×1, `var(--nxt-radius-pill)`×1 |
| premium-ui.css | 78 | 17 | `var(--nxt-radius-pill)`×28, `0`×9, `var(--nxt-radius-lg)`×8, `var(--nxt-radius-card)`×7, `var(--nxt-radius-control)`×5, `var(--nxt-radius-sm)`×4, `var(--nxt-radius-md)`×4, `var(--nxt-radius-xl)`×3, `12px`×2, `0 0 2px 2px`×1, `50%`×1, `20px`×1, `inherit`×1, `13px`×1, `11px`×1, `1.5px`×1, `16px`×1 |
| vnext.css | 90 | 15 | `var(--vn-r-control)`×18, `50%`×15, `1px`×14, `0`×11, `var(--vn-r-input)`×8, `var(--vn-r-surface)`×5, `2px`×5, `10px`×4, `8px`×3, `7px`×2, `inherit`×1, `6px`×1, `5px`×1, `3px`×1, `999px`×1 |
| strata.css | 219 | 32 | `50%`×35, `999px`×35, `18px`×16, `inherit`×13, `2px`×13, `16px`×12, `14px`×12, `12px`×12, `0`×11, `22px`×10, `var(--st-r)`×9, `24px`×7, `20px`×5, `30px`×3, `10px`×3, `99px`×3, `11px`×2, `26px`×2, `3px`×2, `var(--r-tile)`×2, `17px`×1, `8px`×1, `var(--st-r-2)`×1, `28px 28px 0 0`×1, `28px`×1, `13px`×1, `1.5px`×1, `15px`×1, `var(--st-r,26px)`×1, `var(--r-ctl)`×1, `19px`×1, `9px`×1 |

Radius tokens, each with the effective value and references:

| Token family | Tokens (value, file:line) | Notes |
|---|---|---|
| `--radius` | 22px (index.html:47), 26px (index.html:2356) | 0 references (unused) |
| `--nxt-radius-*` | sm 10, md 14, lg 18, xl 24, pill 999 (premium-ui.css:76 to 80) | `--nxt-radius-card` = xl (24px) |
| `--vn-r-*` | surface 20, control 12, input 10 (vnext.css:69 to 71); 359px override: surface 18 (vnext.css:365) | Matches I7. `--vn-r-input` has 8 references and the `.input` rule never reads it |
| `--st-r*` | 26, 18, 14 (strata.css:34 to 36) | `--st-r-3` unused |
| `--r-*` | tile 26, card 18, ctl 14 (strata.css:1940) | `--r-card` unused |

On the Today tab a regular tile resolves to `--st-r` (26px, strata.css:120), and the mini-strip tiles set 20px directly (strata.css:1964). `--vn-r-surface` (20px) has 5 references in vnext.css. Input radii are 17px (index.html:2412), 14px (strata.css:1976, sheets) and 10px (`--vn-r-input`, which the `.input` rule never reads). Control radii are 999px (capsules, D56), vnext 12px (`--vn-r-control`) and premium 14px (`--nxt-radius-control`).

## 6. Dead CSS estimate

### 6.1 Live and dead rules per file

Rules are counted once each. Live means every selector in it names only classes, ids and attributes that occur in markup or JS. Partly dead means some selectors in a list are dead and some are live (counted as live in the headline). Element/root means no class or id is named (for example `html, body` or `:root`).

| File | Style rules (excl. keyframe steps) | Live | Live, partly dead | Dead (every selector names an absent class/id) | Element/root only |
|---|---|---|---|---|---|
| index.html | 704 | 632 (89.8%) | 5 | 31 (4.4%) | 36 |
| cut-support.css | 200 | 175 (87.5%) | 2 | 21 (10.5%) | 2 |
| premium-ui.css | 768 | 451 (58.7%) | 10 | 303 (39.5%) | 4 |
| vnext.css | 649 | 500 (77.0%) | 6 | 138 (21.3%) | 5 |
| strata.css | 1810 | 1639 (90.6%) | 19 | 124 (6.9%) | 28 |

### 6.2 Prefix families

Requested prefixes per file. Each cell gives rules naming the prefix, how many of them are dead, and how many distinct class names with the prefix occur in the emitting files.

| Prefix | index.html | cut-support.css | premium-ui.css | vnext.css | strata.css |
|---|---|---|---|---|---|
| `nxp-` | - | - | 639 rules, 296 dead; 112 of 187 names in JS/HTML | 164 rules, 62 dead; 54 of 72 names in JS/HTML | 205 rules, 4 dead; 47 of 49 names in JS/HTML |
| `vn-` | - | - | - | 563 rules, 136 dead; 168 of 214 names in JS/HTML | 363 rules, 27 dead; 86 of 90 names in JS/HTML |
| `st-` | - | - | - | - | 1399 rules, 119 dead; 315 of 355 names in JS/HTML |
| `apx96-` | 62 rules, 4 dead; 31 of 35 names in JS/HTML | 4 rules, 1 dead; 3 of 5 names in JS/HTML | 6 rules, 0 dead; 6 of 7 names in JS/HTML | 2 rules, 0 dead; 2 of 2 names in JS/HTML | 9 rules, 0 dead; 6 of 7 names in JS/HTML |
| `n99-` | - | 150 rules, 19 dead; 51 of 56 names in JS/HTML | 175 rules, 50 dead; 38 of 42 names in JS/HTML | 35 rules, 2 dead; 11 of 11 names in JS/HTML | 53 rules, 0 dead; 10 of 10 names in JS/HTML |
| `v88-` | 38 rules, 0 dead; 12 of 12 names in JS/HTML | - | - | - | - |
| `is-` | - | 2 rules, 0 dead; 3 of 3 names in JS/HTML | 32 rules, 16 dead; 17 of 17 names in JS/HTML | 88 rules, 14 dead; 38 of 38 names in JS/HTML | 284 rules, 24 dead; 82 of 82 names in JS/HTML |
| `card` | 14 rules, 0 dead; 1 of 1 names in JS/HTML | 1 rule, 0 dead; 1 of 1 names in JS/HTML | 2 rules, 0 dead; 1 of 1 names in JS/HTML | - | - |
| `metric` | 14 rules, 0 dead; 1 of 1 names in JS/HTML | - | - | - | - |
| `pill` | 9 rules, 0 dead; 1 of 1 names in JS/HTML | - | - | - | - |
| `tab` | 15 rules, 0 dead; 1 of 1 names in JS/HTML | 3 rules, 0 dead; 1 of 1 names in JS/HTML | 20 rules, 0 dead; 1 of 1 names in JS/HTML | 3 rules, 0 dead; 1 of 1 names in JS/HTML | 11 rules, 0 dead; 1 of 1 names in JS/HTML |

All prefixes with at least 8 rules, top 40 by rule count:


"Class names found in JS/HTML" counts distinct class names with that prefix that occur in the emitting files, out of distinct class names in the CSS.

| File | Prefix | Rules naming it | Dead rules | Dead share | Class names found in JS/HTML |
|---|---|---|---|---|---|
| strata.css | `st-` | 1399 | 119 | 9% | 315 of 355 |
| premium-ui.css | `nxp-` | 639 | 296 | 46% | 112 of 187 |
| vnext.css | `vn-` | 563 | 136 | 24% | 168 of 214 |
| strata.css | `vn-` | 363 | 27 | 7% | 86 of 90 |
| strata.css | `is-` | 284 | 24 | 8% | 82 of 82 |
| strata.css | `nxp-` | 205 | 4 | 2% | 47 of 49 |
| premium-ui.css | `n99-` | 175 | 50 | 29% | 38 of 42 |
| vnext.css | `nxp-` | 164 | 62 | 38% | 54 of 72 |
| cut-support.css | `n99-` | 150 | 19 | 13% | 51 of 56 |
| premium-ui.css | `nxp` | 91 | 12 | 13% | 1 of 1 |
| vnext.css | `is-` | 88 | 14 | 16% | 38 of 38 |
| index.html | `home-` | 76 | 0 | 0% | 23 of 23 |
| index.html | `v80-` | 73 | 0 | 0% | 30 of 30 |
| index.html | `apx96-` | 62 | 4 | 6% | 31 of 35 |
| strata.css | `n99-` | 53 | 0 | 0% | 10 of 10 |
| index.html | `po-` | 41 | 0 | 0% | 13 of 13 |
| index.html | `v88-` | 38 | 0 | 0% | 12 of 12 |
| vnext.css | `n99-` | 35 | 2 | 6% | 11 of 11 |
| index.html | `lean-` | 34 | 0 | 0% | 10 of 10 |
| cut-support.css | `n99` | 33 | 1 | 3% | 1 of 1 |
| premium-ui.css | `is-` | 32 | 16 | 50% | 17 of 17 |
| strata.css | `wx-` | 30 | 0 | 0% | 6 of 6 |
| index.html | `focus-` | 29 | 1 | 3% | 10 of 11 |
| index.html | `calendar-` | 25 | 0 | 0% | 9 of 9 |
| strata.css | `tabs` | 23 | 0 | 0% | 1 of 1 |
| premium-ui.css | `tabs` | 22 | 0 | 0% | 1 of 1 |
| premium-ui.css | `tab` | 20 | 0 | 0% | 1 of 1 |
| index.html | `coach-` | 17 | 0 | 0% | 12 of 12 |
| strata.css | `sheet` | 17 | 0 | 0% | 1 of 1 |
| index.html | `tab` | 15 | 0 | 0% | 1 of 1 |
| index.html | `zone2-` | 15 | 0 | 0% | 5 of 5 |
| index.html | `card` | 14 | 0 | 0% | 1 of 1 |
| index.html | `metric` | 14 | 0 | 0% | 1 of 1 |
| index.html | `active` | 14 | 0 | 0% | 1 of 1 |
| index.html | `history-` | 14 | 0 | 0% | 4 of 4 |
| strata.css | `nxa` | 13 | 1 | 8% | 1 of 1 |
| index.html | `gym-` | 12 | 0 | 0% | 2 of 2 |
| cut-support.css | `cloud-` | 11 | 0 | 0% | 5 of 5 |
| strata.css | `tab` | 11 | 0 | 0% | 1 of 1 |
| index.html | `btn` | 10 | 0 | 0% | 1 of 1 |

### 6.3 Largest dead clusters per file

Grouped by the first absent name in each dead selector. Line ranges span the rules in that cluster.

**index.html**

| Absent class/id (first missing name) | Dead rules | Lines |
|---|---|---|
| `.scan-upload` | 3 | 593–2492 |
| `.big-num` | 2 | 236–403 |
| `.scan-metric` | 2 | 618–628 |
| `.focus-exercise` | 1 | 444–444 |
| `.scan-preview` | 1 | 611–611 |
| `.scan-status` | 1 | 644–644 |
| `.v72-weight-number` | 1 | 2222–2222 |
| `.v72-svg-wrap` | 1 | 2223–2223 |
| `.v77-value` | 1 | 2235–2235 |
| `.v77-head` | 1 | 2236–2236 |
| `.v79-shell` | 1 | 2237–2237 |
| `.v79-svg-wrap` | 1 | 2238–2238 |

**cut-support.css**

| Absent class/id (first missing name) | Dead rules | Lines |
|---|---|---|
| `.n99-chart-selected` | 10 | 123–205 |
| `.n99-chart-controls` | 4 | 116–205 |
| `.n99-scrubber` | 3 | 132–134 |
| `.apx96-rest` | 1 | 17–17 |
| `.n99-unit` | 1 | 115–115 |
| `.n99-chart-hint` | 1 | 148–148 |
| `.nxt98-timer-actions` | 1 | 197–197 |

**premium-ui.css**

| Absent class/id (first missing name) | Dead rules | Lines |
|---|---|---|
| `.nxp-train-lift` | 105 | 1313–3353 |
| `.nxp-progress-hero` | 18 | 2151–2546 |
| `.nxp-more` | 14 | 2725–2759 |
| `.nxp-home` | 13 | 907–1134 |
| `.nxp-calories` | 9 | 884–892 |
| `.nxp-home-decision` | 9 | 928–1138 |
| `.nxp-ex-nav` | 8 | 1877–2080 |
| `.nxp-more-account` | 8 | 2728–2756 |
| `.nxp-ex-rail` | 7 | 1359–1387 |
| `.nxp-aim` | 6 | 1480–2068 |
| `.n99-chart-selected` | 6 | 2086–2106 |
| `.nxp-progress-strength-summary` | 6 | 2332–2550 |

**vnext.css**

| Absent class/id (first missing name) | Dead rules | Lines |
|---|---|---|
| `.vn-train-active` | 47 | 423–907 |
| `.vn-aim` | 9 | 581–873 |
| `.vn-surface` | 6 | 203–235 |
| `.vn-train-tools-panel` | 5 | 460–473 |
| `.vn-train-sets` | 5 | 604–621 |
| `.vn-sect` | 4 | 195–765 |
| `.vn-act` | 4 | 269–399 |
| `.vn-train-tools` | 3 | 455–459 |
| `.vn-train-more` | 3 | 752–760 |
| `.vn-train-ready` | 3 | 770–780 |
| `.vn-head` | 2 | 157–380 |
| `.vn-evid` | 2 | 167–170 |

**strata.css**

| Absent class/id (first missing name) | Dead rules | Lines |
|---|---|---|
| `.vn-week-m` | 16 | 1554–1670 |
| `.st-coach` | 13 | 1463–1508 |
| `.st-cs` | 11 | 1484–1500 |
| `.st-ring` | 8 | 193–200 |
| `.st-wk-t` | 6 | 1106–1122 |
| `.st-half` | 5 | 117–1046 |
| `.st-dots` | 5 | 547–2707 |
| `.st-evid` | 4 | 209–1355 |
| `.st-bleed` | 4 | 868–1017 |
| `.st-coach-h` | 4 | 1475–2067 |
| `.st-t-week` | 3 | 350–352 |
| `.st-chips` | 3 | 551–1041 |


### 6.4 Notes on the estimate

- Dead does not mean deletable. Some dead selectors may be needed by runtime code paths the static scan cannot see (for example, a class set in a template string with a computed name). The dynamic-stem check covers the common patterns (`'n99-day-'+x`, `'nxp-field-'+x`, `'st-es-'+x`); the scan found no others with a visible stem.
- The premium-ui.css dead share is mostly the `nxp-` family from the old Train, Progress and Home screens. Strata reuses several of those names (`.nxp-train-idle`, `.nxp-cal-*`) and those are live.
- `.nxp-train-lift` and `.vn-train-active` are the two largest clusters. Both are Train-screen selectors that the current markup no longer uses (`st-train-active` is set at premium-ui.js:862 and queried at strata.js:600 and 657).

## 7. Responsive

### 7.1 Media queries per file

Counts are style rules nested inside each query. Queries are normalised (no spaces). Comma lists are shown as written.

| File | Query | Rules inside |
|---|---|---|
| index.html | `(max-width: 370px)` | 31 |
| index.html | `(max-width: 360px)` | 10 |
| index.html | `(max-width: 390px)` | 10 |
| index.html | `(max-width: 380px)` | 8 |
| index.html | `(max-width: 430px)` | 7 |
| index.html | `(prefers-reduced-motion: reduce)` | 7 |
| index.html | `(max-width: 340px)` | 5 |
| cut-support.css | `(max-width: 370px)` | 8 |
| cut-support.css | `(max-width: 359px)` | 4 |
| cut-support.css | `(min-width: 650px)` | 2 |
| cut-support.css | `(prefers-reduced-motion: reduce)` | 1 |
| premium-ui.css | `(max-width: 360px)` | 32 |
| premium-ui.css | `(max-width: 340px)and(max-height: 600px)` | 22 |
| premium-ui.css | `(max-width: 359px)` | 13 |
| premium-ui.css | `(prefers-reduced-motion: reduce)` | 5 |
| premium-ui.css | `(max-width: 370px)` | 4 |
| vnext.css | `(max-width: 359px)` | 50 |
| vnext.css | `(prefers-reduced-motion: reduce)` | 17 |
| vnext.css | `(max-width: 375px)` | 1 |
| strata.css | `(max-width: 359px)` | 161 |
| strata.css | `(prefers-reduced-motion: no-preference)` | 29 |
| strata.css | `(prefers-reduced-motion: reduce)` | 26 |
| strata.css | `(min-width: 1024px)` | 11 |
| strata.css | `(prefers-reduced-transparency: reduce)` | 10 |
| strata.css | `(hover: hover)` | 5 |
| strata.css | `(min-width: 768px)` | 4 |
| strata.css | `(max-width: 420px)` | 2 |
| strata.css | `(max-width: 389px)` | 2 |
| strata.css | `(min-width: 560px)` | 1 |
| strata.css | `(max-width: 339px)` | 1 |
| strata.css | `(min-width: 1440px)` | 1 |

### 7.2 Feature counts per file (raw occurrences)

| Feature | index.html | cut-support.css | premium-ui.css | vnext.css | strata.css |
|---|---|---|---|---|---|
| @media blocks (raw) | 23 | 5 | 14 | 16 | 78 |
| prefers-reduced-motion | 3 | 1 | 3 | 8 | 20 |
| prefers-reduced-transparency | 0 | 0 | 0 | 0 | 9 |
| hover: hover | 0 | 0 | 0 | 0 | 5 |
| pointer: coarse / fine | 0 | 0 | 0 | 0 | 0 |
| prefers-color-scheme | 0 | 0 | 0 | 0 | 0 |
| display-mode | 0 | 0 | 0 | 0 | 0 |
| env(safe-area-inset-*) | 0 | 0 | 4 | 6 | 4 |
| dvh / svh / lvh units | 5 | 1 | 0 | 1 | 0 |
| 100vh / 100vw / vh | 1 | 1 | 3 | 1 | 9 |
| @supports | 1 | 0 | 0 | 0 | 2 |
| @container | 0 | 0 | 0 | 0 | 0 |
| color-mix( | 0 | 0 | 0 | 0 | 99 |
| clamp( / min( / max( | 0 | 1 | 2 | 7 | 4 |
| [data-nxp-motion] switch | 0 | 0 | 10 | 24 | 34 |

Width breakpoints: max-width 339, 340, 359, 360, 370, 375, 380, 389, 390, 420 and 430px; min-width 560px (strata.css:1054), 650px (cut-support.css:204), 768px (strata.css:2603), 1024px (strata.css:2609) and 1440px (strata.css:2630). Height conditions are used only in premium-ui.css: `(max-width: 340px) and (max-height: 600px)` (22 rules). The phone rules (359 to 430px) carry most of the responsive code. Safe-area `env()` appears in premium-ui.css (4), vnext.css (6) and strata.css (4), and not in index.html. `dvh` appears in index.html (5), cut-support.css (1) and vnext.css (1).
