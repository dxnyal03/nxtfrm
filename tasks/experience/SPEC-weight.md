# SPEC · Progress → Weight · "The Instrument" (build spec)

Status: **design spec for Stage 3 + 4 build**, synthesised 19 Oct 2026.

Base: the winning proposal, `weight-1/PROPOSAL.md` ("The Instrument"). This spec adds the best ideas from `weight-2` ("Calm analyst") and `weight-3` ("Two scales of depth"), and fixes every flaw the three judges raised (§1).

Worktree read: `experience-upgrade` @ e48faab (D104 `forecastView` landed; Stage 2 `NXP.dayState` in progress). **No worktree file was edited.**

Seed figures used throughout come from the real engine on the 82-reading dev seed, fixed clock 19 Oct 2026, goal 78–80:

| Quantity | Seed value |
|---|---|
| Latest morning | 81.7 |
| Smoothed trend | 82.6 (82.556) |
| vs trend | −0.9 |
| 4-week rate | −0.43 kg/wk from 25 mornings, 22 Sept–19 Oct |
| Range read (1M) | −1.6 kg over 29 d, lowest 81.7 on 19 Oct, weighed 27/30 |
| Estimated level | 81.8 |
| Start weight | 87.1 |
| First reading | 86.7 |
| Compare (previous 30 d vs last 30 d) | 84.4 vs 82.8 averages, unrounded difference rounds to −1.7 |

Reference renders: `weight-1/shots/*` (390×844 default/live/layers/compare/expand/aging, 320, 375, 393, 1280, 1440) and `weight-1/shots/measure.json`. Baseline: `baseline/screens/shots/nobanner/*/02-weight-*.png`.

---

## 0. Owner rulings needed before build

These are numbered **W1–W9** on purpose. They get D-numbers when the owner approves them, after Stage 2's last row. D104 is already taken, and Stage 2 may take more. None of them changes a calculation, a storage key, a record shape or what a stored number means.

| # | Amends | Change | Fallback if rejected |
|---|---|---|---|
| W1 | D28 | Highlight chips move from under the headline to under the plate, as quiet text chips. | Chips stay in the plate between the interpretation and the readouts (costs 40 px; the plot then starts at 388 and is still 300 tall, but 284 is unobscured with the live dock). |
| W2 | D41 | Weekly steps and week bands become an opt-in layer (default off). The "Each day vs its trend" strip moves off the plot into Analysis. The in-plot "Low N" pill becomes a hollow ring, and its words move to the range summary. | Weekly layer defaults on. The rest stands. |
| W3 | D58, D19 | The scale gutter moves to the **right** (still its own gutter, still `text-anchor="end"`, still one axis). It carries one violet value tag for the trend's end. The in-plot end pill, Low pill and Cut-range "Start" pill are retired. | `chartGeo().gutter = 'left'` (D58 placement kept) plus a 38 px right tag lane. That is a one-line switch, and it costs 38 px of plot width, not height. |
| W4 | D59 | Two columns when the Weight content box is **≥ 944 px** wide (about 1108 px viewport with the rail). | Stay single-column 680 at every width. |
| W5 | Q3 | Insufficient Compare windows and unavailable Layers are **disabled with their reason**, never hidden. | Hide them instead. |
| W6 | copy | "Day-to-day spread", "Rate range", "Projection range" and "Rate precision" (was "Confidence"). "Start weight" and "First reading" become separate names. | Keep the current words. The uncertainty names must still differ from each other. |
| W7 | D70 | The Progress page's top padding absorbs the safe-area inset, using `max(18px, var(--nxt-safe-top) + 4px)`. This applies to all four Progress tabs, so the masthead stays one frame. Browser rendering is unchanged. | Option B from weight-1 (fold the context line into the tabs row when the inset is greater than 0). |
| W8 | D96 | While the what-if is active, the Simulation box persists until the user taps Reset, presses Esc or leaves the tab. Today it springs back after 2.6 s. | Keep the spring-back. The box then shows only while dragging and during the hold. |
| W9 | D100, I11 | Stated only for completeness: notes stay on by default, and Projection stays off by default and dashed. | Neither changes. |

---

## 1. What changes from proposal 1

| # | Judge finding (source) | Resolution in this spec |
|---|---|---|
| 1 | Interpretation stays in the main column on desktop, against the brief (J1, J3) | At wide widths the interpretation renders as the **first block of the side column**. Placement is decided at render time from the measured container, so DOM order and focus order match the visual order (P2 graft). On phone it stays the plate's title. §4, §5 |
| 2 | Value printed twice: in the readouts and as gutter tags (J2) | **One gutter tag only**, for the trend end. It ties the stroke to its number (D19 end-value label). The latest reading is identified by the ● readout and the marker. The neutral "81.7" tag is dropped. §7 |
| 3 | `vs trend −0.9` has no unit and uses a hyphen-minus (J2) | Every signed figure uses U+2212 and a unit: "−0.9 kg". `N.signed` must emit U+2212 (F7 fix in Stage 2; assert it). §6 |
| 4 | Compare difference built from rounded values can be 0.1 off without saying so (J2); P3's table doesn't add up (J1–J3) | Show the **true** difference rounded to 1 dp. When the displayed values don't reconcile, add the footnote "Averages are rounded to 0.1 kg; the change uses the unrounded averages." (P2 graft). Truth beats cosmetic arithmetic. Seed: 82.8 / 84.4 / **−1.7 kg** plus the footnote. §11 |
| 5 | Plot height from `innerHeight` re-renders when the Safari toolbar collapses (J3) | Height comes from a **`100svh` probe**, the small viewport, which the toolbar does not change. Re-render happens only on a width change > 2 px, an svh bucket change ≥ 24 px, or orientation. §7.1 |
| 6 | Notched device shows only about 275 px (J1–J3) | W7: top padding becomes `max(18px, safe-top + 4px)` (P3 graft, without changing the masthead). Estimate: about 289 px visible on a 390×844 device with the live dock. Stage 8 verifies in the Simulator. §3.4 |
| 7 | Banner case clears the target by only 2 px (J3) | Accepted. PLAN's acceptance is "no banner + live dock" = 300. With the banner it is 282 (still ≥ 280). Recorded, not optimised further. |
| 8 | 320: "vs trend" crowds "Smoothed trend"; caption wraps (J1) | Below 360 the readouts use **two cells**. The vs figure moves into the trend cell's sub line, and the caption uses its short form. §6.2 |
| 9 | Opening Layers pushes the plot under the dock (J2, J3) | The drawer is **one 48 px chip row** that scrolls horizontally on phone. At 390×844 with the live dock the plot moves to 396–696, still clear of the dock top at 704. §9 |
| 10 | The 1280 mock shows the what-if open by default (J2) | The Simulation box is **never** part of a default state. It exists only after the user drags the gauge. §13.3 |
| 11 | Expand re-host lifecycle risk (J1, J3) | `<dialog>` + `showModal()` (native Esc and focus containment), a **same-height placeholder**, and an explicit restore list run on every exit path (P2 graft). §10 |
| 12 | Tooltip lane could still overlap a mark when both lanes collide | The lane **hides** when both the top and bottom lanes collide. The date and values are always in the readouts, so nothing is lost. Labels can never sit on data, by construction. §8.3 |
| 13 | No day-context link (P2 strength) | A **selection bar** shares the range-summary slot on phone (P3 graft): selected date, Stage 2 day state ("Full Body A · In progress · 6 of 15 sets ›"), + Note, Open day. On desktop it is a **persistent inspector strip** under the plot (P3 graft). §8.4 |
| 14 | Start 86.7 vs 87.1 conflict on one screen (P2 catch) | The plot prints no Start pill. The Cut-range summary says "**First reading** 86.7 kg · 22 Jul". The Journey says "**Start weight** 87.1". The hard-coded fallback is an open question (§20). |
| 15 | Chatty `aria-live` (P2) | `#vn-chart-wrap` becomes `role="slider"` with full `aria-valuetext`. One polite announcement after `pointerup` (P2 graft). §17 |
| 16 | Milestones computed on the estimated level are shown as if weighed (P2) | Journey milestone chips split into **recorded** (a real weigh-in) and **reached on the estimated level** (computed). §13.2 |
| 17 | D-number collision (P3) | Rulings are W1–W9 (§0), numbered at approval. |
| 18 | Weekly steps off by default needs an amendment (J1, J2) | Kept as W2 with a stated fallback. "Show on chart" from a week row always draws that week's step regardless (§8.6). |

Rejected grafts:
- P3's Analysis drawer (partial inert, detents, scroll lock): iOS risk.
- P3's non-violet range pill: an unflagged D56 change.
- P3's custom date-range inputs: scope creep.
- P2's removal of the lit plate: identity loss.
- P2's lane-only top band: it costs 12 px of plot or first viewport.
- P2's desktop live tile: Stage 6 scope.

---

## 2. Page order (all widths)

Phone order, which is also the DOM order:

1. **Masthead**: D70 context line "Cut · week 13" over the title "Progress", plus the "+ Weight" capsule.
2. **Progress tabs**: Weight / Training / Performance (shown as "Lifts" below 360 px) / Body.
3. **Plate** (`<section class="wx-plate" aria-labelledby="wx-h">`). This is the **only lit edge above the fold**.
   - 3a. Interpretation: H2 plus a caption with its window. Expand sits in the plate corner.
   - 3b. Readouts: Latest morning / vs trend / Smoothed trend. They double as the legend.
   - 3c. Range row: [2W 1M 3M Cut], the transport slot, Layers.
   - 3d. Layers drawer: `hidden` until opened. It is always in the DOM.
   - 3e. Plot: `#vn-chart-wrap`.
   - 3f. Slot: the range summary, **or** the selection bar while a day is selected, **or** the Compare table in compare mode. The slot has a fixed height.
4. **Highlights** (W1): up to two D28 text chips. Below them, the slow-week note when it applies.
5. **Cut journey · summary** (quiet surface, ⌄ expands in place).
6. **Analysis** (quiet disclosure rows):
   - Week by week
   - Rate
   - Rate across your cut
   - Each day vs its trend
   - How these numbers are made
   - All weigh-ins · N

**Plate structure rule:** the plate must contain **no nested `<section>`**. `weight-contract` slices the chart HTML up to the first `</section>` when it checks for banned words, so the whole plate must be inside that slice.

---

## 3. Phone geometry and px budgets

Harness: Chrome, DSF 2, seed, fixed clock, reduced motion, `nxtfrm_cloud_banner_dismissed=1` unless stated. y = document top. The page side gutter is 16 px at ≥ 360 and 12 px below.

### 3.1 390 × 844 (dock top 704 with the live row, 768 without)

| Block | y | h | Notes |
|---|---|---|---|
| top inset | 0 | 18 | `max(18px, safe-top + 4px)` (W7) |
| Masthead | 18 | 64 | context line Geist 520 13/17 `--st-accent-lift`; title Geist 640 34/36 |
| gap | 82 | 8 | |
| Tabs | 90 | 44 [52] | the button fills the 44 track; the pill is drawn 4 px inside |
| gap | 134 | 8 | |
| Plate top padding | 142 | 12 | radius `--st-r` (26), side padding 14 |
| 3a Interpretation | 154 | 42 | H2 20/24 + caption 13/16; Expand 44 at the right |
| gap | 196 | 10 | |
| 3b Readouts | 206 | 69 | label row 16 · value 34 · sub row 17 (+2) |
| gap | 275 | 10 | |
| 3c Range row | 285 | 44 | |
| gap | 329 | 8 | |
| 3d Layers drawer | — | 0 / 48 | 0 when closed |
| 3e Plot block | 337 | 338 | top margin 11 · **plot 348→648 (300)** · x-axis lane 26 (648→674) |
| 3f Slot | 675 | 118 | fixed height on phone (range summary ↔ selection bar ↔ compare, see §11) |
| Plate bottom | 793 | | |
| Highlights | 805 | 32–70 | |
| Journey summary | ~890 | ~190 | |
| Analysis | ~1100 | 6 × 58 | |

Results:
- **Plot unobscured: 300 of 300** with the live dock (56 px spare; the x-axis is visible).
- No session: 300 px, plus the range-summary header is visible.
- Banner visible: plot 421.6→721.6, so 282 px unobscured with the live dock.
- Layers open: plot 396→696, so 300 px unobscured with the live dock.

### 3.2 393 × 852

`plotH` = 302, plot 348→650.

| State | Dock top | Unobscured |
|---|---|---|
| live dock | 712 | **302** |
| live dock + banner | — | 290 |

### 3.3 375 × 667

`plotH` = clamp(232, round(667 × .355) = 237, 320) = **237**. Plot 348→585.

| State | Dock top | Unobscured | Baseline |
|---|---|---|---|
| no session | 591 | **237** (all) | 15 |
| live dock | 527 | **179** | 0 |

Chart top is in the first viewport in both states.

### 3.4 320 × 568

Below 360, the page uses compact tokens:

| Element | Value |
|---|---|
| Page gutter | 12 |
| Plate padding | 10 / 10 |
| Range-row gaps | 6 |
| Seg buttons | 4 × 43 |
| Transport | icon-only 44 |
| Layers | 44 |
| Range row total | 272 of the 276 available |

The caption uses its short form (§6.1), so it fits on one line. The interpretation stays at 42 and the readouts at 69 (two cells).

| Block | y | h |
|---|---|---|
| Masthead | 18 | 64 |
| Tabs | 90 | 44 |
| Plate | 142 | — |
| Interpretation | 152 | 42 |
| Readouts | 204 | 69 |
| Range row | 283 | 44 |
| Plot | **348 → 580 (232)** | — |

Unobscured plot:

| State | Dock top | Unobscured | Baseline |
|---|---|---|---|
| no session | 492 | **144** | 0 |
| live dock | 428 | **80** | 0 |

The chart top is in the first viewport. The rest scrolls, which the brief allows for short screens. There is no horizontal overflow.

### 3.5 Real notched iPhone (standalone PWA, estimate)

Inputs: insets 47 top / 34 bottom, and W7 applied.
- The top padding becomes 51 (it was 65), so the plot runs about 381→681.
- The dock top is about 670 with the live row, so about **289 px** is unobscured.
- **Stage 8 must measure this in the iOS Simulator** (NXTFRM 18 Pro device, iOS 27.0 runtime). If it measures under 280, Option B from weight-1 is the next lever. Never a smaller plot.

---

## 4. Desktop and wide layout

**Breakpoint by measured fit.** Use two columns when the `#weightPage` content box is **≥ 944 px**:
- 944 = main 580 minimum (plot width 532 after the gutter, the narrowest that keeps 1M dots ≥ 9 px apart) + 24 gap + 340 side.
- With the 84 px rail, the content starts at x 140, so 944 px is reached at about **1108 px viewport**. That is PLAN's "≥ 1100", rounded to the real fit.

The width is measured by the same ResizeObserver that buckets the chart (§7.1). `N.ui.wxWide` is set from it, and crossing 944 re-renders `progress()`. This is render-time placement, so DOM order equals visual order and focus order.

Below 944 (including 1024–1107 and 768×1024), the page is D59's single 680 / 600 column with the phone composition.

**Grid:** `grid-template-columns: minmax(580px, 820px) 340px; column-gap: 24px; justify-content: center`.

| Viewport | Main column width |
|---|---|
| 1280 | 752 |
| 1440 | 820 |

**Main column** (DOM first):
- Masthead and tabs (tabs max-width 520).
- Plate, which on desktop omits the interpretation:
  - readouts (3 cells, Expand at the right end of the readouts row)
  - range row
  - Layers drawer
  - plot
  - **inspector strip** (persistent, 64)
  - range summary (one row, 60)
- Analysis, with Week by week open by default.

**Side column** (`<aside class="wx-side">`, `position: sticky; top: 24px`):
- Interpretation: H2 + caption, the same component as on phone, in the side variant.
- Highlights.
- Journey summary.
- Rate card, open (gauge, Rate range, Rate precision; the Simulation box only while active).

The side surfaces are quiet: `--st-tile-bg` at 72%, `--st-tile-line` hairline, **no lit edge**.

**Desktop plot height:** `clamp(300, svh − 470, 440)`.

| Viewport | Block | y | h |
|---|---|---|---|
| 1280 × 800 | Masthead | 24 | 64 |
| | Tabs | 96 | 44 |
| | Plate | 156 | — |
| | Readouts | 170 | 69 |
| | Range row | 249 | 44 |
| | **Plot** | **311 → 641** | 330 × ~704 wide |
| | Axis | 641 | 26 |
| | Inspector strip | 667 | 64 |
| | Range summary | 731 | 60 (ends 791 ≤ 800) |
| 1440 × 900 | Plot | 311 → 741 | 430 |
| | Strip | 767 | — |
| | Summary | 831 | — |

**Inspector strip** (desktop, persistent):
- Contents: `Selected · Latest · Mon 19 Oct` | `That day · Full Body A · In progress · 6 of 15 sets` | `+ Note` | `Open day ›` | (`↺ Back to latest` when historical).
- Its day context comes from Stage 2's `NXP.dayState(date)`, falling back to `dayDid(date)`.
- It **never** shows a "this week so far" figure below D41's 3-morning rule. That was P3's flaw, so the field is omitted.

**Precondition (Stage 6):** the live pill must not overlap the Progress tabs at ≥ 1024. Today `strata.js` computes its position from the rail top (around line 924). Coordinate this; do not ship two-column without it.

---

## 5. Material and tokens

### 5.1 Material ladder

1. **Atmosphere.** The sky, stars and aurora, unchanged. They are visible around the plate and **never behind data**.
2. **Quiet surfaces.** Journey, Analysis rows, highlights and desktop side cards. They use `--st-tile-line` hairlines on the canvas and the `--st-tile-bg` fill (side cards only). No lit edge, no bloom, no nested card.
3. **Elevated chrome.** D56 glass capsules: + Weight, Expand, transport, Layers, Compare, Open day, + Note. Segmented tracks have the single sliding violet pill.
4. **Focal (few).** Four elements:
   - The plate's lit edge (`--st-edge`) and one top-left corner bloom in `--st-weight`. It is the only lit edge above the fold.
   - The trend stroke.
   - The violet trend tag.
   - The selected marker.

Remove the baseline's equally glowing `.vn-weight` card that wrapped the Journey and Evidence.

### 5.2 New tokens

New tokens are scoped to `#weightPage` in `strata.css`. Reuse `--st-*`, `--fs-*`, `--fw-*` and `--r-*` everywhere else.

| Token | Value | Use |
|---|---|---|
| `--wx-screen` | `#0A0912` | opaque plot well (stays opaque under `prefers-reduced-transparency`) |
| `--wx-screen-xv` | `#07070C` | Expand surface |
| `--wx-grid` | `rgba(var(--st-hl), .055)` | ≤ 5 horizontal gridlines |
| `--wx-area` | `rgba(139,92,246,.16)` | area fill top stop (→ 0) |
| `--wx-dot` | `rgba(220,213,238,.9)` | morning reading fill |
| `--wx-under` | `rgba(180,154,255,.18)` | 9 px trend underlay (replaces `st-glow` blur) |
| `--wx-hatch` | `repeating-linear-gradient(135deg, rgba(var(--st-hl),.07) 0 1px, transparent 1px 6px)` | gaps, Compare "Before", Simulation |
| `--wx-gutter` | `42px` | right scale gutter (38 tag lane in W3 fallback) |
| `--wx-fs-h2` | `20px` (Geist `--st-font-d` 600, lh 24) | interpretation |
| `--wx-fs-cap` | `var(--fs-label)` 13 (SF 450, lh 16) | caption, sub rows |
| `--wx-fs-lab` | `var(--fs-label)` 13 (SF 560) | readout labels |
| `--wx-fs-num` | `32px` (Geist 300, lh 34, `tabular-nums`) | readout values |
| `--wx-fs-unit` | `15px` (Geist 450) | "kg" after values, vs value |
| `--wx-fs-sum` | `21px` (Geist 300) | range-summary values |
| `--wx-fs-tick` | `11.5px` (SF 500, ink-3 on screen ≈ 6.4:1) | axis ticks, x dates |
| `--wx-fs-tag` | `12.5px` (Geist 560, tabular) | gutter tag, lane |

**Larger text:** under `html[data-nxp-size=large]`, every `--wx-fs-*` scales ×1.12, and numerals scale ×1.06. The first viewport may scroll. `plotH` is unchanged (text never shrinks the plot).

**Colours:**
- Trend gradient: `#7C5CFF` at 60% → `--st-accent-lift` → `#F3EEFF` toward now.
- Status uses the I2 trio (`--st-ok`, `--st-review`, `--st-concern`), always with a word and a ◆ shape.
- Celebration never colours the H2.

**Text floor:** 12 px everywhere, except axis ticks at 11.5 (D50 floor 11).

---

## 6. Instrument header

### 6.1 Interpretation (3a)

- **H2** (`id="wx-h"`): `trajectoryHeadline(plateau)`, e.g. "Losing 0.43 kg a week". The rate is shown to 2 dp (Stage 2 precision).
- **Caption** (window, from `detectPlateau`'s own window):
  - ≥ 360: "4-week rate · 25 mornings, 22 Sept–19 Oct"
  - < 360, when the window ends today: "Last 4 weeks · 25 mornings". The full dates go in the H2's `aria-describedby`.
  - When the window is shorter, it names the real span: "14 days · 9 mornings".
- **Freshness** (`forecastView().freshness`, D104) replaces the caption tail:

| Freshness | Caption tail |
|---|---|
| fresh | nothing |
| aging | "◆ As of 7 Oct · 12 days without a morning" (`--st-review` word + ◆) |
| stale / expired | "◆ Paused · last morning 25 Sept" |

- **Status chip** after the H2, only for review states: "Losing quickly", "Review", "Plateau", or "In range" (✓).
- **Expand** button: 44 glass circle, top-right on phone. On desktop it moves to the readouts row.

### 6.2 Readouts (3b): they are the legend

| Cell | Label (13) | Value | Sub row |
|---|---|---|---|
| A | `●` **Latest morning** | **81.7** kg (32 Geist 300, white→lilac) | "Mon 19 Oct" + **+ Note** (22 visual / 44 hit) |
| B (≥ 360) | **vs trend** | **−0.9 kg** (15 Geist 450, U+2212) | — |
| C | `—` **Smoothed trend** | **82.6** kg (`--st-weight`) | "● Updated today" or "◆ As of 7 Oct" |

- **Below 360:** cells A and C only. Cell C's sub row reads "Reading 0.9 kg below" when fresh. When aging or stale, freshness wins and the vs text moves to the selection bar and the sr text.
- **Historical selection:** labels switch to "● Morning reading" / "Mon 28 Sept" and "— Smoothed trend · on 28 Sept". Cell C keeps the date in its label so the time stays explicit.
- **Post-workout layer on, and the day has a post reading:** a 4th cell appears (◇ "Post-workout 82.9 kg · +0.6 vs morning"). Phone shows it as the cell B position. Otherwise it is absent.
- The D97 **Estimated level never appears here**. It belongs on the Journey, share card, story and goal moment only.
- **Accessible names:**
  - "Latest morning, Monday 19 October, 81.7 kilograms"
  - "Reading 0.9 kilograms below the smoothed trend"
  - "Smoothed trend 82.6 kilograms, updated today"

### 6.3 Range row (3c)

- `[2W 1M 3M Cut]`: segmented, Geist 540 14, the existing `setRange`. In compare mode it reads "1M vs previous".
- **Transport**: one fixed slot, 76 px at ≥ 360 and icon-only 44 below, `data-wx-state`:

| State | Shown | Tier |
|---|---|---|
| idle | `▶ Replay` | glass |
| playing | `■ Stop` | glass |
| historical | `↺ Latest` | violet primary |

  This renders the dead `#nxp-progress-latest`; keep that id on the button. The slot never reflows.
- **Layers**: a 44 circle with a count badge equal to the optional layers on. `aria-expanded` and `aria-controls="wx-layers"`.

---

## 7. The plot

### 7.1 Geometry: `chartGeo(kind)` (new, defined before `chartModel`)

- Returns `{W, H, left, right, top, bottom, padX, plotH, gutter}`, with 1 SVG unit = 1 CSS px, so text never scales. This retires the `--tsc` text-scale hack.
- Page values: `left 6, right 42 (gutter 'right'), top 11, bottom 26, padX 9`.
- **W** = measured `#vn-chart-wrap` width, cached in `N.ui.chartW[kind]`. On first paint it uses an estimate: viewport − gutters − plate padding.
- **plotH** comes from `svh`, the height of a hidden `100svh` probe read once per bucket:

| Context | plotH |
|---|---|
| phone / single column | `clamp(232, round(svh × .355), 320)` |
| wide | `clamp(300, svh − 470, 440)` |
| Expand | remaining dialog height after its chrome |

- **Re-render** only when the width changes by more than 2 px, the svh bucket (24 px steps) changes, or the orientation changes. Guard with `svg.__st` so a re-dress never loops.
- **No window:** if `window` is undefined (node tests), `chartGeo()` returns **today's geometry** (420 × 460, left 34, right 8, top 28, bottom 110, padX 12). That keeps every node contract test unchanged. A new test pins this default.

### 7.2 `chartModel(rows, range, showGoal, geo = chartGeo(), win = null)`

- Replace the hard-coded 420 / 460 / 34 / 8 / 28 / 110 and padX 12 with `geo`.
- `win` = {from, to} lets Compare widen the x-window.
- **Keep verbatim** (release gate, `wearables.release-gate.test.js` ~L675):
  - the D2 domain comment
  - `const xMs=` and `,y=v=>top+` (≤ 2 scale defs)
  - the exact line `const post=postRows.map(r=>({...r,x:x(r.date),y:y(r.weight)}));`
  - the four `N.trend(rows)`, `N.trendConfidence(rows)`, `N.forecastGoal(rows)` and `N.detectPlateau(rows)` calls
  - **no `y2=`, yRight, secondAxis or rightAxis** anywhere in the slice
  - `function chartHTML()` must keep **zero parameters**, because the gate slices up to that exact string
- **Domain (D2, unchanged):** visible morning readings + trend only, with the existing .6 headroom and step rule. Goal, cone, band, post-workout and notes never enter it.

### 7.3 Marks, back to front

All drawn by `plotHTML(model, {kind})`, which is defined **after** `chartHTML`.

1. **Screen.** `--wx-screen` rect with top and bottom hairlines.
2. **Grid.** ≤ 5 horizontal lines in `--wx-grid`. No verticals.
3. **Week bands.** Only when the Weekly layer is on.
4. **Spread band.** Only when on. `trendConfidence` ±1 residual SD, edges through `smoothPath`, 10% lilac.
5. **Area.** `--wx-area` → 0 under the trend.
6. **Post-workout.** ◇ hollow diamonds `vn-post-mark`, painted **before** morning dots (contract). Off by default.
7. **Trend.** Underlay 9 px `--wx-under`, then the stroke 2.75 px with the house gradient. Monotone `smoothPath` (no overshoot). The trend stops at the last reading and never extends into a gap.
8. **Morning readings.** `vn-raw-dot`, r 3, `--wx-dot`, with a 1.4 px keyline in `--wx-screen` so they separate from the stroke where they cross it. r 2.4 above 45 readings and r 1.8 above 90 (D51).
9. **Weekly steps.** Dashed, ≥ 3 mornings, every week in range. This **fixes the `guard<20` bug** at strata.js ~119.
10. **Notes.** D100 flags, one colour, the kind as a word.
11. **Projection.** When on: dashed `2 5` / `7 6` from the `forecastView` origin, cone, and "Goal range · ~16 Nov" pill (D28 wording, D104 dating). When the projection clamps at the floor it ends in a "continues ↓" chevron.
12. **Lowest in range.** Hollow ring only.
13. **Selection.**
    - Dashed cursor: 22% opacity at latest, 50% when historical.
    - Stem from the reading to its trend point, with a hollow ring on the trend.
    - Marker: white core r 5, 2.4 violet ring, r 11 halo at 20%. The halo pulses ×2 on entry, then rests.
14. **Right gutter.**
    - Ticks are right-aligned (`text-anchor="end"` at x = W − 6), and the unit rides the top tick ("85 kg").
    - **One violet tag** for the trend end value (82.6), with a dotted leader from the trend tail.
    - Ticks within 13 px of the tag hide.
    - Gutter elements use class `wx-scale` (never "right…axis" names, which the contract regex forbids).

**Retired:** the end pill, the Low pill, the Cut-range Start pill, the in-plot deviation strip, and the `st-glow` Gaussian blur.

**Gaps and out-of-domain values:**
- A run of ≥ 4 days without mornings draws as a `--wx-hatch` column labelled in the bottom lane ("No mornings 8–19 Oct").
- A post-workout value outside the domain becomes a half-diamond pinned to the plot edge with ▲/▼. Its lane text says "Post-workout 85.4 kg — above this scale", and its Layers chip reads "Post-workout · 1 off scale".

**Cut range:** the summary's left cell reads "First reading 86.7 kg · 22 Jul" (§12). No in-plot Start label.

---

## 8. Inspector

### 8.1 Gesture intent (`NXT.scrub` → state machine, plus `scrubUp` / `scrubCancel`)

- **Touch `pointerdown`:** record only. This fixes the baseline bug where a vertical swipe selected a day.
- **Horizontal lock:** |dx| ≥ 8 and |dx| > 1.2·|dy|. Then `setPointerCapture`, and select the **nearest real reading**. Never interpolate.
- **Vertical intent:** do nothing. `touch-action: pan-y` on the wrap lets the page scroll, and `pointercancel` is ignored.
- **Tap** (< 8 px, < 350 ms): select on `pointerup`.
- **Mouse:** select on `pointerdown`; dragging scrubs. On desktop, hover previews the readouts and lane, and `pointerleave` restores the pinned selection.
- **Every step:** readouts update the same frame (tabular numerals, no odometer while scrubbing) and the existing haptic tick fires.

### 8.2 Selection state

- `N.ui.selected` = date or null.
- `selectPoint(index, opts)` keeps every id it writes today: `n99-chart-date/-weight/-average/-coverage/-timing/-post*`, cursor, active, halo, and `n99-chart-slider`.
- It adds the vs cell `#wx-gap`, the label switch, `data-wx-state` on the transport, the slot swap, and `opts.announce`.
- **Wrapper fix:** `hookProgressSelect` must call `orig.apply(this, arguments)` so `{clear:true}` reaches the engine (F8). If Stage 2 has already landed this, assert it with a test instead.

### 8.3 Lane (the existing `st-tip`, re-homed)

- **Content:** the date only ("Mon 28 Sept"). In week mode it adds "Week of 12 Oct · avg 82.2". Off-scale and gap messages also appear here. Values are **not** repeated, because the readouts hold them.
- **Placement:** top lane (plot top + 6), centred on the cursor x and clamped 10 px from the edges.
  - If any mark's bbox falls inside the lane's rect, flip to the bottom lane (above the x-axis).
  - If both lanes collide, **hide the lane**. The readouts carry the date.
- **Lifetime:** it persists while selected. The touch 1.4 s auto-hide is removed. It clears with the selection.

### 8.4 Selection bar (phone) and inspector strip (desktop)

**Phone.** The 118 px plate slot swaps from the range summary to the selection bar whenever `N.ui.selected` is set, with no layout jump: a 160 ms crossfade, instant under reduced motion. The bar has three rows:
1. "**Selected · Mon 28 Sept**" plus `× ` (44, accessible name "Back to latest").
2. The day context link, from `NXP.dayState(date)` with `dayDid` fallback. Examples: "Full Body A · Finished · 15 sets ›", "Full Body A · In progress · 6 of 15 sets ›", "Rest day", or "No training logged" in ink-4. A note title is shown when present.
3. `+ Note` (D100 sheet) · `Open day ›` (glass).

Clearing the selection (×, ↺ Latest, Esc, End, or a tap outside the plate) restores the range summary.

**Desktop.** The persistent inspector strip shows the same content (§4) and is always visible. At latest it reads "Selected · Latest · Mon 19 Oct".

### 8.5 Keyboard (`chartKey` on `#vn-chart-wrap`, `tabindex=0`)

| Key | Action |
|---|---|
| ← / → | previous / next reading |
| Home / End | first / latest reading (End = back to latest) |
| PageUp / PageDown | ∓ 7 days (nearest reading) |
| Enter | open the selected day in History |
| Esc | back to latest (in Expand: close dialog first) |
| F | open Expand |

The focus ring is the D56 lavender 2 px. Keyboard steps announce through `aria-valuetext` (§17).

### 8.6 Back to latest, week rows, Open day and return

- **Back to latest:** transport `↺ Latest`, the selection bar's ×, Esc or End. The cursor glides 240 ms with `--st-out`, or jumps under reduced motion.
- **Week by week → "Show on chart"** (`weekShowOnChart`):
  - selects the week's last reading
  - draws `.st-weeksel` **and that week's step even if the Weekly layer is off**
  - sets the lane to week mode
  - scrolls the plate into view (instant under reduced motion)
  - On desktop, hovering a row previews the band.
  - **Reverse link:** when the chart selection falls inside a week, that row gets `aria-current="true"` and a lit left rule.
- **Open day** (selection bar, inspector strip, Expand inspector, note menu):
  - Store `N.ui.returnTo = {view:'overview', range, selected, layers, compare, expanded:false, scrollY}`, memory only.
  - Then call `NXP.historySelect(date)` and `switchTab('history')`. If Expand is open, close it first.
  - The History day header shows a `‹ Weight` capsule. It restores range, selection, layers, compare and scroll (with D71 scroll memory). Afterwards `returnTo` is cleared.
- **Notes:** the D100 note sheet. Saving returns to the same selected day.

---

## 9. Layers

- **Drawer:** `#wx-layers` (`role="group"`, `aria-label="Chart layers"`), placed directly under the range row. It is **always in the DOM** and `hidden` when closed, so the contract's legend words ("Morning", "Post-workout", "Projection") stay in the chart HTML.
- **Height:** 48 = 36 px chips (44 hit) + 6/6. On phone the chips are one row that scrolls horizontally, with an edge fade.
- **Open/close:** `STRATA.morph`, 240 ms (instant under reduced motion).
- **Always on, shown as fixed text:** ● Morning readings · — Smoothed trend.

| Chip (glyph + word) | Default | Draws | Disabled reason (W5) |
|---|---|---|---|
| ┄ Weekly averages | off (W2) | D41 steps for every week + alternating week bands | "Needs 2 weeks with 3 mornings" |
| ▬ Day-to-day spread | off | ±1 SD band around the trend | "Needs 7 mornings in 14 days" |
| ◇ Post-workout | off (D8) | diamonds on the same scale; edge chevrons off scale | "No post-workout readings in this range" |
| ⚑ Notes | **on** | D100 flags | shows "· 0" when none |
| ┄ Projection | off (I11) | dashed line + cone + "Goal range · ~16 Nov" | "Needs a confirmed goal" / "Paused · 3 mornings needed" (stale/expired) |

- Chips use `aria-pressed`. Disabled chips use `aria-disabled="true"` plus `aria-describedby` → the reason.
- State lives in `N.ui` (`showWeekly`, `showSpread`, `showNotes`, `showPost`, `showForecast`, `layersOpen`). **No storage key.** `setPostVisible` and `setForecastVisible` stay as wrappers over `setLayer(name, on)`.
- **The three uncertainty names** are used identically everywhere:
  - **Day-to-day spread:** the observed scatter of readings around the trend.
  - **Rate range:** the 4-week rate's ±2 standard errors, e.g. "Likely between −0.35 and −0.51 kg/wk".
  - **Projection range:** the arrival uncertainty. The cone is ±1σ, so it is described as "about 2 in 3".
- The plate markup must not contain the words confidence, certainty, uncertainty, probability, likelihood or accuracy. The contract bans the substring "certainty", which "uncertainty" contains.

---

## 10. Expand

- **Entry:** Expand (plate corner, or the readouts row on desktop) or **F**.
- **Container:** `<dialog class="wx-xv" aria-labelledby="wx-xv-h">` opened with `showModal()`. It is full-screen on phone and `min(1200px, 94vw) × min(820px, 92svh)` when wide. The surface is `--wx-screen-xv` with one faint violet corner.
- **Re-host, never clone:**
  1. Insert `<div class="wx-ph" style="height:{current wrap height}px">` where `#vn-chart-wrap` was.
  2. Move `#vn-chart-wrap` into the dialog.
  3. Re-render with `chartGeo('expand')`, about 520 px plot at 390×844 portrait and the full width in landscape.
  4. Re-run `dressProgress` on the new SVG.

  Ids stay unique, and range, selection, layers and compare carry over from `N.ui`.
- **Restore list, run on every exit** (×, Esc / `cancel` event, swipe-down on the top bar via `bindSheets`, Open day, tab switch, `progress()` re-render):
  1. Move the node back to the placeholder and remove the placeholder.
  2. Re-render with `chartGeo('page')`.
  3. Restore page scroll to the stored `scrollY`.
  4. Return focus to the Expand button (skipped when leaving to History).
  5. Set `N.ui.expanded = false`.
- **Layout (phone):**
  - Top bar: × Close (44, first focus), title "Weight", and the range in words.
  - Compact readouts.
  - Plot.
  - Inspector row: date, day context, + Note, Open day.
  - Bottom (thumb reach): range row with transport, Layers and Compare.
  - **Show as table:** swaps the plot for a `<table>` with columns date / morning / smoothed trend / vs trend for the range. It has a caption and scoped headers.
- **History:** no history entry is pushed, so there is no back trap.
- **Motion:** a View Transition with `view-transition-name: wx-plot`, 280 ms `--st-out`. Under reduced motion, or when `document.startViewTransition` is missing, it is an instant swap.

---

## 11. Compare periods

- **Entry:** a `[Compare]` capsule in the range summary (`aria-pressed`). It is also in Expand. **Done** exits, and so does Esc while focus is inside the compare table.
- **Kinds** (one capsule row):

| Kind | Windows |
|---|---|
| **Previous {range}** (default) | the matched window immediately before |
| **Same days last month** | matched elapsed calendar days, e.g. 1–19 Oct vs 1–19 Sept |
| **Completed weeks / months** | labelled "completed" |
| **First vs last 4 weeks** | Cut range only |

- **Quantity:** **Average morning** (default), **Trend change** (first→last smoothed trend inside the window), or **Lowest morning**.
- **Plot:**
  - The x-window spans both windows (`win`). "Before" is drawn on `--wx-hatch` and "This range" on a faint violet wash.
  - For non-contiguous kinds, the uncompared stretch dims to 40%.
  - **No shifted overlay, no interpolation**, and a D2 data-only domain over what is drawn.
  - The window labels sit in the bottom lane ("Before · 21 Aug–19 Sept" / "This range").
- **Slot:** in compare mode the slot becomes a table (`<caption>` + `th scope`). On phone it grows to its content and the slot is not fixed while comparing.

  | | Window | Mornings | Average morning |
  |---|---|---|---|
  | Before | 21 Aug–19 Sept | n of 30 · % (engine) | 84.4 kg |
  | This range | 20 Sept–19 Oct | 27 of 30 · 90% | 82.8 kg |
  | **Change** | | | **−1.7 kg** |

- **Difference rule:** the change is computed from the **unrounded** values and then rounded to 1 dp. When the displayed values don't reconcile, the footnote adds: "Averages are rounded to 0.1 kg; the change uses the unrounded averages."
- **Base footnote:** "A difference between two averages of your mornings, not a test." It contains **no significance, p-value or "real change" language**.
- **Status:**
  - An incomplete window says "In progress · 19 of 31 days" and switches the kind to matched elapsed days.
  - A window with fewer than 3 mornings or under 30% coverage is **disabled with its reason** (W5): "2 mornings in 21 Aug–19 Sept — too few to compare".
  - Trend change needs a trend-ready point at both ends of the window; otherwise it shows "—" and the reason.
- **Engine:** `comparePeriods(rows, a, b)` and `compareWindows(range, kind, today)` are pure helpers in `cut-support.js`, built on `windowStats` and `trend`. They read morning rows only. They return:
  - n, days and coverage
  - avg, low, trendFirst, trendLast and trendChange
  - partial, ok and reason
  - diff, which is unrounded; rounding happens in presentation only

  They are exported and documented as a presentation of existing figures (D9).

---

## 12. Range summary and highlights

- **Range summary (D50, plate footer, slot default):**
  - Head row: "Last month · 20 Sept–19 Oct" + [Compare].
  - Three cells, values Geist 300 21 and labels SF 12, with no ellipsis on a number:

  | Cell | Value |
  |---|---|
  | **Trend change** | −1.6 kg over 29 days |
  | **Lowest** | 81.7 kg · 19 Oct |
  | **Weighed** | 27 of 30 · 90% |

  - Cut range: the first cell becomes "**First reading** 86.7 kg · 22 Jul" and the trend change moves to a second line.
  - On desktop the summary is one 60 px row.
- **Highlights (W1):** up to two quiet 32 px text chips under the plate, with a glyph and no glowing dot: "★ Lowest weigh-in yet · 81.7 kg" and "↘ 12 weeks of falling weekly averages". The slow-week note follows as a plain sentence. On desktop the highlights sit in the side column.

---

## 13. Journey and Rate

### 13.1 Summary

Quiet surface, about 190 px, always closed by default:
- **Hero:** "5.3 kg down in 13 weeks" · "1.8 kg to go to the top of 78–80".
- **Rail:** the D95 rail (travelled solid, ahead dashed, goal band, now bead).
- **Three labels:**
  - "87.1 · **Start weight** · 22 Jul" (recorded setting)
  - "81.8 · **Estimated level** · as of 19 Oct" with an outlined `estimate` tag
  - "78–80 · **Goal range** · ~16 Nov · 3–4 wk", dated by `forecastView`: "as of 7 Oct" when aging, and **no date** when stale or expired (D104)
- **Actions:** ▶ Play your cut (D99) · ⌄ Details (`aria-expanded`).
- **Mode switch:** `journeyHTML(…, {mode:'summary'})` gives this markup. The **default mode stays unchanged**, because `weight-contract` reads "80–82 Goal" from `N.journeyHTML()`.

### 13.2 Expanded (STRATA.morph 260 ms)

Five kinds of fact, each visibly distinct:

| Kind | Example | Treatment |
|---|---|---|
| Recorded weigh-in | "Lowest weigh-in 81.7 · 19 Oct" | solid chip, ✓ |
| Reached on the estimated level | "First kg down · 4 Aug", "Halfway · 22 Sept", "5% of your start · 9 Oct" | solid-outline chip under "Milestones · on your estimated level" |
| Current model estimate | "81 kg ~31 Oct · estimate" | dashed outline + "estimate" |
| Historical snapshot (rewind) | "◷ Rewound · 28 Aug · 2.1 kg down" + **Back to today** | clock capsule. The chart selects that day (existing link). Rate and Projection gain "**Current analysis · as of 19 Oct**", because rewinding replays the journey, not the model. |
| Simulation (what-if) | see §13.3 | hatched neutral box |

### 13.3 Rate (Evidence)

Placement: the Analysis row "Rate" on phone, and an open side card on desktop.

- Numbers are unchanged: −0.43 kg/wk, 0.5% of body weight a week, gauge, **Rate range** "−0.35 to −0.51 kg/wk · about ±2 standard errors of the 4-week line", projection, and **Rate precision · Medium** (the renamed `plateau.confidence`; its categorical value is kept, W6).
- **Simulation · What if** (only after the user drags the gauge):
  - A `--wx-hatch` box with a dashed neutral border, headed "◌ SIMULATION · WHAT IF".
  - Assumption sentence, with the anchor named: "If you lost 0.80 kg a week from your estimated level of 81.8 kg on 19 Oct, the top of your goal range (80 kg) would come around 4 Nov. A what-if, not a forecast or a target."
  - Arithmetic check: (81.8 − 80) / 0.80 = 2.25 wk ≈ 16 d, and 19 Oct + 16 d = 4 Nov.
  - **Reset** capsule. Above the 1% line it adds "faster than the 1% line" in `--st-review` with a ◆.
  - It never uses violet fill, goal styling, or ranking language.
  - It persists until Reset, Esc or leaving the tab (W8).

---

## 14. Analysis rows

Each row is quiet and 58 px tall:
- **Title:** SF 560 15.5.
- **Summary:** SF 450 13. It must state a **real fact**, never "Tap to see".
- **Control:** `<button aria-expanded>`. The open state is memory only.

| Row | Summary (seed) | Body |
|---|---|---|
| Week by week (D101, `#wx-weeks`) | "Week of 12 Oct −0.5 kg · 7 of 7 mornings" | unchanged D101 rows + Show on chart |
| Rate (phone only) | "−0.43 kg/wk · Rate precision Medium" | §13.3 |
| Rate across your cut (D96) | "In the steady zone since 5 Aug" | unchanged; rate cursor synced |
| Each day vs its trend | "27 of 27 mornings below the trend this range" | `drawDevStrip(host, m)`: same x scale, shared cursor, a list-view toggle, and an sr summary that adds "while cutting, most mornings land below because the trend averages the days before" |
| How these numbers are made | "Trend, rate, spread and projection explained" | D97 note, how to read the chart, the three spread names, the diagnosis and review cards (moved from "Why NXTFRM says this") |
| All weigh-ins · 82 | "Latest 81.7 kg · 19 Oct" | opens the existing sheet |

---

## 15. Data states

Every state pairs a word with a shape; none relies on colour alone.

| State | Interpretation / caption | Readouts | Plot | Below |
|---|---|---|---|---|
| **Empty (0)** | H2 "Your first morning reading starts this chart" | "—" in all cells | empty screen with a ghost grid; a centred **primary** "Log morning weight" capsule | Journey only if the goal is confirmed ("No readings yet"); Analysis shows only "How these numbers are made". Transport, Layers and Compare are disabled with reasons. |
| **One reading** | "Building your baseline" · "1 morning · a trend needs 3 mornings within a week" | 85.0 · vs "—" · trend "—" "after 3 mornings" | one dot; no trend, tag, band or projection; Replay disabled | Layers disabled with reasons |
| **Sparse** (< 10 mornings in 28 d, or gaps) | "Direction still settling" + engine reason | normal | the trend breaks at gaps > 7 days; hatched columns ≥ 4 d | Spread and Projection disabled with reasons |
| **Aging** (4–14 d) | caption "◆ As of 7 Oct · 12 days without a morning" | trend sub "◆ As of 7 Oct" | hatched gap to today; the x-axis ends today; the tag stays at the last trend value | Journey "as of 7 Oct" |
| **Stale / expired** (> 14 d) | "◆ Paused · last morning 25 Sept, 24 days ago" | dated labels | hatch; Projection chip "Paused · 3 mornings needed" | Journey prints no arrival date |
| **At goal** | "In your goal range" + "✓ In range" | normal | unchanged; no goal line (D3) | goal moment (D99) unchanged |
| **Losing quickly** (> 1%/wk) | "Losing 0.95 kg a week" + "◆ Losing quickly" · "1.1% of body weight a week" | normal | normal | the Rate row moves first in Analysis |
| **Gaining / flat** | "Trend is gaining" + "◆ Review" / "Trend is flat · 21 days" + "◆ Plateau" | normal | normal | the Rate summary names it |
| **Historical selection** | unchanged (current) | labels switch (§6.2) | cursor at 50%, stem, marker | phone slot shows the selection bar |
| **Replaying** | unchanged | driven by replay | existing 6.5 s reveal | transport shows ■ Stop |
| **Compare** | unchanged | unchanged | doubled window | the slot shows the table |
| **Rewound** | unchanged | the chart selects the rewind day | historical selection | "Current analysis · as of 19 Oct" on Rate |
| **Long cut** (> 20 wk) | — | — | weekly steps across the whole range (bug fixed) | — |
| **Larger text** | ×1.12 | ×1.06 numerals | plotH unchanged | may scroll |

---

## 16. Motion

`reduced()` in strata.js (around line 9) covers both the OS setting and the in-app setting. Nothing in the plate loops.

| Moment | Motion | Reduced |
|---|---|---|
| Enter Weight tab | trend draws L→R 900 ms `--st-glide`; area fades 400 ms (+200); readings stagger 12 ms (≤ 400 ms); tag fades last; header odometer; halo ×2 then rests | static final frame |
| Repaint after logging | nothing replays (`chartAnim` flag); the new point pops once | none |
| Range change | 180 ms crossfade, trend redraw 600 ms, tag glides 200 ms | instant |
| Scrub / keys | cursor and readouts in the same frame; haptic tick | same |
| Lane | 120 ms fade + 2 px rise; x follows over 80 ms | in place |
| Slot swap | 160 ms crossfade | instant |
| Back to latest | 240 ms glide `--st-out` | jump |
| Layers drawer / layer | morph 240 ms; marks fade 160 ms; band grows from the trend 220 ms | instant |
| Compare on / off | x rescale crossfade 320 ms | instant |
| Expand | View Transition 280 ms | instant swap |
| Replay | existing 6.5 s | jumps to latest |
| Journey open | morph 260 ms | instant |

---

## 17. Accessibility

- **Landmarks:** the plate is `<section aria-labelledby="wx-h">`, the side column is `<aside aria-label="Weight context">`, and Analysis is `<section aria-labelledby="wx-an-h">` (outside the plate).
- **Chart control:** `#vn-chart-wrap` has `role="slider"`, `tabindex="0"`, `aria-label="Weight chart, last month"`, `aria-valuemin="0"`, `aria-valuemax="{n−1}"`, `aria-valuenow="{index}"` and `aria-valuetext`. Example value text: "Monday 28 September: morning 83.1 kilograms, smoothed trend 83.7, 0.6 below trend. Full Body A, finished, 15 sets." It also has `aria-describedby="wx-sr-sum"`.
  - The inner SVG is `aria-hidden="true"`. Slider children are presentational, and the summary carries the content.
  - `#n99-chart-slider` stays `aria-hidden`.
- **sr summary** (`#wx-sr-sum`, per range): "Last month: 27 morning readings, 20 September to 19 October. Smoothed trend from 84.2 to 82.6 kilograms, down 1.6. Lowest 81.7 on 19 October. Latest morning 81.7, 0.9 below trend. Use arrow keys to move between readings, Enter to open the day, F to expand."
- **Announcements:** pointer selections announce once on `pointerup` through `#wx-sel-sr` (polite). Keyboard steps rely on `aria-valuetext`. The baseline's `aria-live` on the whole header is removed.
- **Targets:** every target is ≥ 44 px. Note, Compare and Open day use pseudo-element hit areas.
- **Contrast:** ink-3 on the plate ≈ 6.1:1, ticks on the screen ≈ 6.4:1, trend value ≈ 8:1.
- **Expand:** native modal focus containment, × first, Esc, focus returns, and Show as table.
- **Layers / Compare:** `aria-expanded`, `aria-pressed` and `aria-disabled` + reason. Tables have a caption and `scope`.
- **Never colour only:** dot / line / dashed step / band / diamond / flag / dashed projection / hatch, plus status word and ◆.

---

## 18. Commits, in order

Each commit runs `node --check` on changed JS, a brace balance on changed CSS, and the full deterministic gate:

```
for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done
```

That is 25 files in the tree today. Report the real counts.

Rebase onto Stage 2 first (D104 `forecastView`, `NXP.dayState`, quantity names, the U+2212 `signed`).

1. **Engine geometry** (`cut-support.js`, `wearables.weight-contract.test.js`)
   - Add `chartGeo(kind)` before `chartModel`.
   - Change the signature to `chartModel(rows, range, showGoal, geo = chartGeo(), win = null)`.
   - Add a test: with no window, `chartGeo()` equals today's geometry, and `chartModel()` output is byte-identical to before for the fixture.
   - Release gate unchanged and green.
2. **Engine compare** (`cut-support.js`, tests)
   - Add `comparePeriods` and `compareWindows` and export them.
   - Tests cover: matched windows, a partial calendar month, an insufficient window (with reason), the unrounded diff and the footnote trigger (84.4 / 82.8 → −1.7, flagged), that post-workout rows are never read, and Trend change not-ready.
3. **Selection plumbing** (`cut-support.js`, `premium-ui.js`)
   - `hookProgressSelect` uses `apply(this, arguments)`.
   - Add the `N.ui` flags and `setLayer`.
   - `scrub` becomes the intent machine, plus `scrubUp` / `scrubCancel`.
   - `chartKey` gains Home, End, PageUp, PageDown, Enter and F.
   - `selectPoint` gains `#wx-gap`, the label switch, transport state and `announce`.
   - No visual change yet.
4. **Page composition and plate** (`premium-ui.js` `progress()` Weight branch; `cut-support.js` `chartHTML()` → plate, plus `instrumentHTML`, `rangeRowHTML`, `rangeReadHTML`, `srSummary` **after** `chartHTML`; `strata.css` `#weightPage .wx-*` block and tokens)
   - Masthead context line becomes "Cut · week N", or "Since your first weigh-in" when there is no cut.
   - Highlights move (W1). Journey and Evidence are un-nested. Analysis rows are added.
   - **Delete** the `.replace('<div class="vn-mhead"'…)` seam and the `withGoalDate` regex.
   - **Delete, not override**, the CSS for removed markup: `.vn-mhead`, `.vn-metric-v`, `.vn-trend-val`, the `#weightPage .vn-weight` material/bloom entries, `.st-range-row`, the four `#vn-chart-wrap` margin rules, `.st-wchips` (→ `.wx-hl`), `.st-csum-d`, `.vn-togs`, `.vn-legend`, and the journey/evidence-inside-`vn-weight` rules.
   - No `!important`.
   - W7 top padding.
5. **Plot rebuild** (`cut-support.js` `plotHTML` after `chartHTML`; `strata.js` `dressProgress`)
   - Screen, grid, right gutter `wx-scale`, single trend tag with tick hiding, underlay instead of the blur, dot keyline, gaps, off-scale chevrons, Lowest ring.
   - Remove the end, Low and Start pills.
   - The weekly `guard<20` fix, with weekly drawing gated.
   - `drawDevStrip(host, m)` for Analysis.
   - Adapt `tasks/vnext/verify-152.mjs` (the unit now rides the top tick in the right gutter) and the `verify-2c.mjs` selectors. Keep their intent and report the change.
6. **Inspector**
   - In `strata.js`, `progressTip` becomes the lane with flip and hide, and the touch auto-hide is removed.
   - Selection bar slot (phone) and inspector strip markup.
   - `bindProgressReplay` drives the transport.
   - `weekShowOnChart` draws the week step and scrolls; reverse row highlight.
   - Open day + `returnTo` + History `‹ Weight` capsule (`premium-ui.js` History day header).
   - Slider a11y.
7. **Layers drawer** (`layersHTML` after `chartHTML`; `bindWx` in `strata.js`): chips, disabled reasons, morph.
8. **Expand** (`bindWx`): `<dialog>`, placeholder, restore list, View Transition, Show as table.
9. **Compare UI** (`compareHTML` after `chartHTML`, `win` plumbing, bands, table, footnotes).
10. **Journey summary, Rate copy, Simulation and Current analysis** (`journeyHTML` `{mode:'summary'}`, `evidenceHTML` renames and the `data-wx-current` hook, the recorded vs estimated-level milestone split, W8 persistence).
11. **Wide layout** (`N.ui.wxWide` from the ResizeObserver, render-time placement, ≥ 944 grid, inspector strip persistent, side column). Gated on the Stage 6 live-pill fix.
12. **Motion and Larger text pass** (tokens ×1.12, every reduced path, `prefers-reduced-transparency`).

**Constraints:**
- No new file, so `sw.js` is unchanged and `RELEASE` stays 163.
- No storage key.
- The legacy renderers and `readiness()` are untouched.

---

## 19. Acceptance criteria

Measure with the baseline harness (`baseline/screens/scripts/measure.mjs` and `capture.mjs`): seed, clock 19 Oct 2026 10:00 +08, DSF 2, Asia/Singapore, both reduced-motion settings.

**Fit**
1. 390×844, no banner, live dock: plot rect ≥ 280 tall (target 300) and **fully above the dock top** (704). No banner and no dock: 300.
2. 393×852, live dock: unobscured plot ≥ 280 (target 302).
3. 390×844, live dock + banner: unobscured ≥ 280 (target 282).
4. 375×667: the plot top is inside the first viewport, with and without the live dock. No session: ≥ 230 unobscured.
5. 320×568: the plot top is inside the first viewport. `scrollWidth === clientWidth` (no horizontal overflow). The range row is on one line. Every text is ≥ 11.5 px.
6. 390×844, Layers open, live dock: the plot is still fully above 704.
7. 1280×800: two columns. The interpretation is in the side column. Plot ≥ 330 tall, plus the inspector strip and range summary bottom ≤ 800. At 1440×900 the plot is 430. At 1100 the layout is single column; at 1120 it is two columns.
8. At 390 the plot is not shorter than the baseline's 273 (D52).

**Plot integrity**

9. `chartModel` output with no geometry argument is byte-identical to the pre-change fixture. The release gate and `weight-contract` pass unmodified, except where the spec names an adaptation.
10. The trend tag's bbox intersects no reading's bbox and no trend endpoint, at all 4 ranges × all widths. No tick label lies within 13 px of the tag.
11. The lane's bbox never intersects a plotted mark: test every reading at 390 and 1280. If both lanes collide, the lane is hidden.
12. Turning on Projection, Post-workout or Spread leaves the y-domain unchanged (D2). The 1M domain stays [81, 85] on the seed.
13. No `<text>` element is drawn inside the plot rect, except the lane and bottom-lane gap labels in their lanes.
14. A 30-week synthetic cut draws a weekly step for every eligible week.

**Interaction**

15. A vertical touch swipe starting on the plot scrolls the page and leaves `N.ui.selected` unchanged. A horizontal drag selects only real reading dates.
16. ←, →, Home, End, PageUp, PageDown, Enter, Esc and F behave as in §8.5. After Esc, `N.ui.selected === null` and the readouts show 19 Oct 81.7 (F8 regression).
17. The ↺ Latest / × control is visible whenever the selection is historical.
18. Show on chart: the `.st-weeksel` band spans exactly that Mon–Sun, and that week's step draws with the Weekly layer off.
19. Open day → History → `‹ Weight` restores the same range, selected date, layers and scrollY (±4 px).
20. Expand: the same `#vn-chart-wrap` node (identity check), with range, selection and layers preserved. After closing, focus is on the Expand button, `history.length` is unchanged, and the page layout height is identical before and after.
21. Compare 1M on the seed: 84.4 / 82.8 / −1.7 kg with the rounding footnote, mornings "{n} of 30" from `comparePeriods` for Before and "27 of 30" for This range, and no word from {significant, p-value, real change, confidence}.

**Words and numbers**

22. The plate HTML (up to the first `</section>`) contains none of: certainty, confidence, probability, likelihood, accuracy.
23. kg values are 1 dp and rates 2 dp. Every negative uses U+2212. "Estimated level" does not appear in the plate. "Start weight" and "First reading" are never shown under the same name.
24. The Simulation box is absent from every default render (phone and wide), and present only after a gauge drag, with Reset.

**A11y and motion**

25. axe: zero serious or critical issues on Weight at 390 and 1280. All targets are ≥ 44×44.
26. Under reduced motion (OS and the in-app setting): no animation or transition longer than 0 ms in the plate, Expand, slot swap or Layers. Replay jumps to latest.
27. Larger text: no clipping or overlap. Numerals are not ellipsised.

**Gate**

28. All `wearables*.test.js` pass, with real output reported. `node --check` passes on the changed JS.

---

## 20. Open questions

1. **Start weight fallback.** `index.html:2862` hard-codes `START_WEIGHT = 87.1` when `settings.startWeight` is unset. That is the seed's case, and it drives Journey "5.3 kg down", the story and the share card. Changing it changes a number's meaning, so it needs an owner ruling. This spec only renames the label to "Start weight" to separate it from "First reading 86.7".
2. **Trend lag.** On the seed, every 1M reading sits below the smoothed trend (EWMA bias of about +0.67 kg on a −0.5 kg/wk cut, from the stage-1 backtest). The plot shows this honestly. Stage 7 (elapsed-time-aware EWMA) may change it, and "Each day vs its trend" wording must follow.
3. **W3 gutter side.** If the owner keeps D58's left gutter, the fallback costs 38 px of width at 390, so the plot data width drops from about 310 to about 272 px. Confirm before commit 5.
4. **Stage 2 API names.** This spec assumes `NXP.dayState(date)` and `NXT.forecastView(rows)`. If Stage 2 lands different names or signatures, adapt them; the meaning is unchanged.
5. **Notched-device fit** (about 289 px) is an estimate until Stage 8 measures it in the Simulator. Option B is the reserve.
6. **W8.** Should the Simulation persist until Reset (this spec) or keep D96's 2.6 s spring-back?
