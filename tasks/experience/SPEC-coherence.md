# SPEC — App-wide coherence pass (type, colour, surfaces)

Owner ask, 2026-10-21: "run this pass throughout the app, make sure the theme, font, everything is coherent and consistent."

This spec is the single source of truth for the pass. It changes *values* (sizes, weights, faces, colours, radii), never behaviour, markup structure, calculations or storage. Where a rule here conflicts with an older comment in the CSS, this spec wins; where it conflicts with `tasks/vnext/DECISIONS.md`, stop and report.

## What the audit found (390 pt, every page, 2026-10-21)

Audit data: `~/Library/Caches/DanDev/nxtfrm/experience/coherence/audit.json` (per page: faces, size|weight pairs, colours, radii, surfaces) and `attr.json` (every visible text style attributed to the sheet + selector that sets it). Text nodes by sheet: strata.css 452, inline/inherited 140, vnext.css 131, cut-support.css 2.

1. **Two faces, applied unevenly.** Geist (`--st-font-d`) is the display face on Weight, Performance and History (masthead, figures, segments) but Today's figures, Body's and Settings' headings and numbers, Training's figures and train-idle's sub-head are all SF. Today's `.tf-zf` line declares `var(--st-font-d)` yet computes to a third stack (`-apple-system, system-ui, "SF Pro Text"`) — a later `.vn-num`-style utility is overriding the family. Builder A must find and reconcile that rule.
2. **Weights drift.** SF appears at 400/450/480/500/520/530/540/550/560/580/590/600/620/650/700; Geist at 220/300/520/540/550/560/600/640. On a variable font these read as "almost the same", which is exactly what looks inconsistent.
3. **Half-pixel sizes.** 9.5, 10.5, 11.5, 12.5, 13.5, 13.64, 14.5, 15.5, 16.5 all in use next to their integer neighbours.
4. **Eight purples for one accent.** `#8B5CF6`, `#B49AFF` (180,154,255), `#A78BFA` (167,139,250), `#C4B5FD` (196,181,253), rgb(203,184,255), rgb(205,187,255), rgb(228,218,255), rgb(217,204,255), rgb(220,208,255), `#EDE8FF`. Two near-identical muted inks: `#8A859C` (st) vs `#8A85A0` (vn). Pure `#fff` text beside `--st-ink`.
5. **Legacy slate surfaces.** Settings-body cards render `rgb(30,35,44)` = `--vn-surface-2 #1E232C` — a blue-grey on a purple-charcoal app. `--vn-surface/-2/-3` are the old palette.
6. **Surface drift.** Card fills at rgba(20,19,30,.66) / (18,17,27,.72) / (16,15,24,.78) / (16,15,25,.95) / (22,20,32,.6) / white at .03/.04/.043/.055/.06; radii 12/16/18/20/24/26/30 on surfaces.

## The system

### Faces
- **SF** (`var(--st-font)`): all running text, labels, captions, row titles, section titles, inputs, chart axes.
- **Buttons stay on Geist 560** — D56 (durable) puts buttons on the display face; it beats this spec.
- **Geist** (`var(--st-font-d)`): the masthead, every figure/numeral that stands on its own (hero, card figure, Evo numbers, counts, odometers), and the small "instrument" labels: segmented controls, tab labels, category/kicker eyebrows.
- A numeral *inside a text line* ("84.0 → 82.5 kg", "48 / 60 min", "3 × 8") inherits the line's face and weight. It is not a figure.
- Exception kept: `#trainPage .st-train-active` stays SF throughout (D18 measured contract). Do not touch its sizes or face.

### Type scale — the only permitted sizes
| Role | Size | Weight | Face | Examples |
|---|---|---|---|---|
| Masthead | 34 | 640 | Geist | `.st-h1` |
| Hero numeral (≥32) | as is | 220 | Geist | `.wx-v`, `.st-count-v b` |
| Figure numeral | 20 / 22 / 26 | 300 | Geist | `.wx-sum-c b`, `.st-perf-best`, `.st-act-rv b`, `.tf-sc-c b`, `.vn-evo-row-v b`, `.nxp-history-ex b` |
| Sub-head | 22 | 600 | SF | `.vn-h-sub`, `.st-mt2`, `.st-id-t b` |
| Section title | 17 | 600 | SF | `#weightPage h2/h3`, `.st-sect`, `.vn-evo-sec h2` |
| Row title | 16 | 600 | SF | `.wx-row-t`, `.vn-set-t`, `.st-plan-l b`, `.vn-evo-row-l span` |
| Body | 15 | 400 | SF | `.st-meta` (long), `p.vn-perf-eq`, `.vn-evo-comp-top span`, `.vn-set-v` |
| Instrument label | 13 | 560 | Geist | `.wx-seg button`, progress tabs, `.st-cat`, `.nxp-caption`-style kickers, history filters |
| Label / value | 13 | 500 | SF | `.wx-row-s`, `.tf-ll`, `.tf-zf`, `.st-ref small`, `.nxp-cal-day b`, `.st-perf-pill` |
| Caption / meta | 12 | 400 or 500 | SF | `p.vn-perf-meta`, `.vn-set-s`, `.st-perf-best small`, chips |
| Micro / axis / eyebrow | 11 | 500 | SF | `.st-ax`, `.tf-sc-c small`, `.st-mchip`, `.vn-set-foot` |

Permitted size literals: **11, 12, 13, 15, 16, 17, 20, 22, 26, 34**, plus hero numerals ≥ 28 (leave their size, fix their weight). Nothing ends in `.5`. Nothing below 11 for text (icons/glyph-only spans excepted).

Mapping (old → new): 9.5/10/10.5 → 11 · 11.5 → 12 · 12.5 → 12 (captions) or 13 (labels/values) · 13.5/13.64 → 13 · 14/14.5 → 15 · 15.5/16.5 → 16 · 18/19 → 17 (titles) or 20 (figures) · 21/23/24/25 → 22 (figures) or 26 (large figures) · hero ≥ 28 unchanged.

Weights: **SF 400 / 500 / 600 only.** 450/480 → 400 · 520/530/540/550/560 → 500 for labels, values, captions; → 600 for titles and anything marked strong (`b`, row/section/sub-head) · 580/590/620/640/650/700 → 600. **Geist 220 / 300 / 560 / 640 only** (hero / figure / instrument label / masthead). Letter-spacing values stay as they are.

### Colour — text and accent
Tokens only; no new literals. `--st-ink` (primary) · `--st-ink-2` (secondary) · `--st-ink-3` (muted) · `--st-ink-4` (faint). Accent: `--st-accent #8B5CF6` (fills, active states — I1: signal, never wallpaper) · `--st-accent-lift #B49AFF` (accent text/strokes on dark) · new `--st-accent-tint: #EDE8FF` (text on a violet fill, the lightest tint). Re-point the vnext aliases at the strata tokens: `--vn-ink-4: var(--st-ink-4)`, `--vn-violet-lift: var(--st-accent-lift)`. Replace every literal purple listed in finding 4 with the nearest of `--st-accent` / `--st-accent-lift` / `--st-accent-tint`. Pure `#fff` / `white` text → `--st-ink` unless it sits on a violet fill (then `--st-accent-tint`). Category hues (`--st-cardio`, `--st-review`, `--st-rest`, lean, coral/fat) are untouched.

### Surfaces and radii
- **Card** (the reference is the Today log card / Settings-hub tile): `border-radius: var(--st-r)` (26), fill `var(--st-tile-bg)`, line `var(--st-tile-line)`, highlight `var(--st-tile-hl)`.
- **Tile inside a card**: `var(--st-r-2)` (18), fill `rgba(255,255,255,.04)`.
- **Control** (button, segment, field, chip-with-text): `var(--st-r-3)` (14). **Pill**: 999.
- Retire the slate palette: `--vn-surface: var(--st-surface)`, `--vn-surface-2: var(--st-surface-2)`, `--vn-surface-3: #2A2836`, `--vn-r-surface: var(--st-r)`, `--vn-r-control: var(--st-r-3)`, `--vn-r-input: var(--st-r-3)`.
- Card/tile fills in the audit's list (rgba(18,17,27,.72), (16,15,24,.78), (22,20,32,.6), white .03/.043/.055/.06) → the card or tile token by role. `rgba(16,15,25,.95)` is the dock/sheet material and stays.
- Radii 12/16/20/24/30 on surfaces → 26 (card), 18 (tile) or 14 (control). This supersedes the vnext I7 values 20/12/10 with 26/18/14 — the three tiers remain differentiated, which is I7's intent. Proposed as **D156**.

### Out of scope (do not touch)
Any JS calculation, storage key or record shape · markup structure (class *additions* on existing elements are fine) · the train-active loop (D18) · hero numeral sizes · chart geometry and SVG layout · motion timings (I8) · the sheet/dock material · `design-v102/`, `design-v103/`, `.claude/`.

## Work split — one writer per file
- **Builder A — `strata.css`.** All findings in that sheet, plus the `.vn-num` family override (find it, scope it so the display face wins where this spec says Geist). Add `--st-accent-tint` to the `:root` at the D53 block.
- **Builder B — `vnext.css`, `index.html` `<style>`, and inline `style="…"` font/colour literals in `premium-ui.js` / `cut-support.js`.** Re-point the `--vn-*` aliases at the top of `vnext.css`; apply the scale to vnext rules; no change to any JS logic — string literals inside style attributes only.

Rules for both: change values in place, keep the file's comment style and density, no new `!important`, no restructuring, no renaming of classes, no deletions of rules. Where the mapping is ambiguous for a rule, choose by the role column and note it in the report. Do not commit, do not stash, do not run browser tools; run `node --check` on any touched JS and report brace balance for touched CSS.

## Mechanism found during the pass
The uneven display face had one cause: the pre-Geist baseline `html body :where(*:not(svg *)){font-family:var(--st-font) !important}`. Two faults in one rule — the `!important`, and a specificity of (0,0,2) because `html body` sat *outside* the `:where()` — meant Geist only ever won where a rule also carried `!important`, and a direct declaration on every element even beat inheritance from a Geist parent (odometer digits, unit labels). Now: `html,body{font-family:var(--st-font)}`, `button,input,select,textarea{font-family:inherit}`, and a truly zero-specificity `:where(html body *:not(svg *)){font-family:inherit}`. Rules that name `var(--st-font-d)` win naturally; descendants inherit it.

## Verification (director)
Re-run the two audit scripts (expect the size set to collapse to the permitted literals and the weight set to {400,500,600} ∪ {220,300,560,640}); overflow at 320/375/390 compared with `overflow-before.json` (no new offenders, no scrollWidth > viewport); 29 suites; screenshots per page on the simulator; reviewer (high reasoning) reads the diff against this spec.
