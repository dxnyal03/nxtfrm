# CLAUDE REVIEW — INTEGRATION CHECKPOINT INT-1

**Covers:** Today · Train · Progress/Weight · History, reviewed **together** at 390 / 375 / 320
**Commits under review:** `9fd3772` (2A) · `761f339` (2B) · `6563be6` (2C) · `eb713de` (2D)
**No features implemented during this checkpoint.**

---

> **ROUND 2 — CHECKPOINT PASSED.** C1, C2 and C3 are all fixed and re-verified by me; all four polish items landed. Round 1's findings are kept below for the record. Summary of the re-verification is at the end under **ROUND 2 RESULT**.

## A. COHERENCE VERDICT

*(Round 1 assessment — superseded by ROUND 2 RESULT below.)*

**Not yet one product — but close, and the gaps are narrow and specific.**

The four screens share a genuine common language: identical canvas (`rgb(14,16,20)`) on every screen at every width, one nav of consistent height (71px) that recedes only in active workout, consistent status/action/row idioms, and zero horizontal overflow anywhere. Data flows between them coherently.

Two things break the illusion, and one of them is very visible:

1. **The route transition is not the same animation on all screens.** Today plays the VNext spatial tier; the other three play the *old* one.
2. **Train's idle screen was never migrated.** It is a surviving V102 island sitting directly next to fully-migrated screens.

Both are fixable without touching product semantics.

## B. CROSS-SCREEN ISSUES

### B1 — Route transition splits the app in two *(required)*

Measured `animation` on `.content.active`:

| Screen | Animation | Duration | Easing |
|---|---|---|---|
| **Today** | `vn-route-enter` | **0.28s** | `cubic-bezier(.32,.72,0,1)` |
| Train | `v94-enter` | 0.42s | `cubic-bezier(.2,.8,.2,1)` |
| Progress | `v94-enter` | 0.42s | `cubic-bezier(.2,.8,.2,1)` |
| History | `v94-enter` | 0.42s | `cubic-bezier(.2,.8,.2,1)` |

**Root cause:** `render()` (`index.html:2919`) toggles `display` and the `active` class but **never removes `hide`**. The non-home sections keep `class="content hide"` permanently, so `vnext.css`'s `.content:not(.hide)` rule matches **only `#homePage`**. Everything else falls through to the legacy `.content{animation:v94-enter .42s}` in `index.html`.

Three of four screens move 50% slower, on a different curve, than the screen the direction was designed on. This is the single clearest "not one product" signal.

### B2 — Train idle is an un-migrated V102 island *(required)*

2B's scope was *active workout mode*; the pre-workout screen kept its V100 presentation. Against migrated screens it reads as a different app:

| Signal | Train idle | Rest of VNext |
|---|---|---|
| Surfaces | **two stacked rounded cards** | one protagonist surface, content on canvas |
| Primary action radius | **999px lozenge** | 12px control |
| Section heading | **20px uppercase** ("SESSION PLAN", "READY") | 13px sentence case |
| Radii present | 999px, 24px, 20px, 14px | 20 / 12 / 10 |

Card soup and pill soup are exactly what D1 and I7 reject. It is also the screen users pass through *every single lifting session*, immediately before the best-executed screen in the product.

### B3 — Type and radius scales have drifted *(polish)*

Across the four screens I counted 16 distinct rendered font sizes (10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14.5, 15, 16, 17, 18, 19, 20, 28) against a defined scale of ~7, and radii beyond the defined 20/12/10 (999, 24, 18, 14, 13, 5, 2, 1). Much of the excess is concentrated in B2. Worth a consolidation pass once B2 lands — not worth blocking on now.

## C. REQUIRED INTEGRATION FIXES

| # | Issue | Required outcome |
|---|---|---|
| **C1** | Route transition inconsistent (B1) | All five destinations use the VNext spatial tier: `vn-route-enter`, 280ms, `cubic-bezier(.32,.72,0,1)`. Fix in `vnext.css` by covering both `.content` and `.content:not(.hide)` — **do not** modify `render()` in `index.html`; the `.hide` class is load-bearing elsewhere and the render input lock must not be disturbed. |
| **C2** | Train idle un-migrated (B2) | Bring Train idle into the VNext language: at most one protagonity surface, VNext radii, 13px sentence-case section titles, the standard primary action. Preserve every existing control and entry point (Change/session picker, recovery guidance, Start workout, session plan list, add-on section, Rest/Zone2/Floorball idle variants, empty-plan state). Presentation only. |
| **C3** | 3 of 15 deterministic suites failing | See D below. All 15 suites green. |

## D. FUNCTIONAL REGRESSION RESULT

I had been running only the release gate and weight contract. Running **all 15 suites** surfaced three failures — **all from slices I already approved.** That is my process gap, now closed: every future slice review runs the full suite set.

| Suite | Result | Cause |
|---|---|---|
| 12 suites | **OK** | — |
| `wearables.recovery-integration` | 31/1 | **2A.** Asserts the literal string `recLabel=!recLogged?'Not logged'` in `premium-ui.js`. 2A removed it — it was provably dead (`void recLabel;`). |
| `wearables.training-readiness` | 28/1 | **Cascade only.** Spawns the suite above and asserts exit 0 plus `"OK  32 passed"`. Goes green when the root is fixed. |
| `wearables.train-enrichment` | 33/1 | **2B.** Asserts `muscleLine(ex)` and `anatomyStrip(ex)` appear **together** in the exercise head. 2B demoted the anatomy strip into a disclosure. |

**D4 gate verified intact:** `readiness()` is still present in `index.html`. Nothing gated was removed.

**Fix guidance:**
- **recovery-integration** — the test's stated intent is that *readiness and check-in persistence are unchanged*, not that a specific dead local survives. Re-point the assertion at the real intent: `readiness()` still present, and the recovery check-in still reachable and persisting. Keep the test count at **32** — the cascade test hardcodes `"OK  32 passed"`.
- **train-enrichment** — this one is a genuine fidelity gap, not a test-fit problem. `design-vnext` places the anatomy **inline beside the exercise name**, with muscle names beneath — together, in the head, costing no extra vertical height. Restore that pairing. If it cannot be done within the fold budget, report the measured numbers instead of guessing; Log Set must stay ≤844 at 390×844 for 0/1/2 sets.

## E. RESPONSIVE RESULT

**PASS at 390 / 375 / 320** across all four screens.

- Zero horizontal overflow, every screen, every width.
- Canvas identical (`rgb(14,16,20)`) everywhere — no screen has its own background.
- Nav height constant at 71px; recedes only in active workout; no collisions.
- Contrast: 0 failures (audited per screen in each slice review).
- Touch targets: 0 failures except the accepted 320px calendar-cell width (38×46), which is seven-column grid geometry, not a shrunk target.
- 320 behaves as a real design state — Train's aim strip wraps, History's four marks fit, type steps down.
- Known minor wrap: History's month title goes to two lines at 320.

## F. CROSS-SCREEN DATA CONTINUITY — PASS

Realistic flows, all clean:

| Flow | Result |
|---|---|
| Today → Train → log a set → Today | logs 174 → **175** → 175; session sets visible; `dayType` stable `FullB/FullB` |
| Today → Progress | weekly rate `−0.44459` |
| Progress → History → Progress | `−0.44459` → **identical**, no drift |
| Train → History | the set logged in Train **appears on today's date in History** |
| Full tour | logs 175, bws 83, cardio 15, floorball 8 — no stray mutation |

No page errors on any transition.

**Reduced motion:** consistent in effect — all four screens render with effectively zero duration (`1e-06s`). Today reports `animationName: none` while the others report a zeroed `v94-enter`; that difference disappears with C1.

## G. POLISH FIXED / DEFERRED

Batched with the required fixes this checkpoint (small, isolated, no feature work):

| Item | Disposition |
|---|---|
| Train save toast covering session identity | **Fix now** |
| Stacked disclosures at foot of active workout | **Fix now** — fold budget already proven, reachable from the mode bar |
| Selected Progress point flush to right plot edge | **Fix now** |
| History month title wraps at 320 | **Fix now** |
| Type/radius scale consolidation (B3) | **Defer** — reassess after C2 removes most of the excess |

## H. READY FOR NEXT PRODUCT SLICE

**NO** — pending C1, C2 and C3.

Nothing here is architectural; all three are contained presentation or test-intent fixes. No product semantics, storage or training meaning is implicated. Settings (2E) stays closed until this checkpoint passes.

---

## ROUND 2 RESULT — CHECKPOINT PASSED

### C1 — route transition · FIXED
All five destinations now play `vn-route-enter 0.28s cubic-bezier(.32,.72,0,1)` at 390, 375 and 320. Previously Today alone used it while Train, Progress and History ran the legacy `v94-enter 0.42s`. Fixed in `vnext.css` by covering both `.content` and `.content:not(.hide)`; `render()` untouched, so the `.hide` class and the V86 input lock are undisturbed.

**Side effect worth noting:** reduced motion is now uniformly `animationName: none` on all four screens. Before, only Today reported `none` while the rest reported a zeroed legacy animation.

### C2 — Train idle · FIXED
Measured radii on Train idle are now **12px and 20px only** — the VNext set. The 999px, 24px and 14px values are gone. Recovery guidance sits on canvas instead of a pill card; one protagonist surface remains; section titles are 13px sentence case.

I initially read the "Start workout" button as a surviving 999px lozenge. Measurement corrected that: it is **12px radius, 50px height on Today, Train idle and Train active alike**. The impression came from the button's width-to-height ratio.

Every entry point preserved — session picker, recovery guidance, Start workout, the session plan list with last-load lines, add-on section, Rest/Zone2/Floorball idle variants, empty-plan state.

### C3 — failing suites · FIXED
**All 15 suites green, 410 tests.** `recovery-integration` 32 (matching the count the cascade test hardcodes), `train-enrichment` 34, `training-readiness` 29.

Both test edits reviewed assertion by assertion:
- `recovery-integration` — the dead-local assertion is replaced by one on the real intent (check-in entry point reachable). The `readiness()` and persistence assertions are untouched. This is what I asked for.
- `train-enrichment` — the core assertion (`muscleLine(ex)` **and** `anatomyStrip(ex)` in the exercise head) is **unchanged**. Only the slice delimiter moved, from `nxp-ex-actions` to `</section>` from the head start, because Session tools moved to the mode bar. The new delimiter is **tighter**, and a guard was added that the head exists at all. Stronger, not weaker.

**The anatomy restoration cost nothing.** Log Set bottom edge is unchanged at **678 / 750 / 750 / 750** (390px) and **753 / 825 / 825 / 825** (320px) for 0/1/2/3 logged sets — all ≤844. Restoring it inline beside the exercise name added no vertical height, exactly as the approved design intended. Cursor flagged it could not measure this; I did.

### Polish — all four landed
| Item | Verified |
|---|---|
| Train save toast covering session identity | No overlap (toast top 58, mode bar bottom 56) |
| Stacked disclosures at foot of active workout | Session tools now in the mode bar: Leave, Exercise details, Swap, Undo last set, Session options, Finish. **Undo confirmed functional** — session sets 1 → 0 |
| Selected Progress point flush to plot edge | 6px wrap inset, 5px gap to the right edge |
| History month title wraps at 320 | **Single line** at all widths — "Sept 2026" at 320, "September 2026" at 375/390, nav buttons all 44pt |

### Re-verified across the board
- **Responsive:** 0 contrast failures, 0 overflow, all five surfaces × 390/375/320. Only target flags are the accepted 320/375 calendar cells (grid geometry).
- **Data continuity:** Today → Train → log → Today gives logs 174 → **175** → stable; the set appears in History on today's date; Progress' weekly rate is byte-identical after touring screens (`−0.44459`); no stray mutation; no page errors.
- **Reduced motion:** consistent across all four.

### Deferred
Type/radius scale consolidation (B3). C2 removed most of the excess; what remains is minor variance in primary-action type (Today 16px/580, Train idle 15px/600, Train active 17px/600). Not worth blocking on; revisit during a later system pass.

## G. READY FOR NEXT PRODUCT SLICE — **YES**

Today, Train, Progress/Weight and History now read as one product at 390, 375 and 320. Phase 2E (Settings) is unblocked.

## History

| Date | Slice | Verdict | Rounds |
|---|---|---|---|
| 2026-09-22 | 2A Foundation + Today | **APPROVED** | 3 |
| 2026-09-22 | 2B Train active workout | **APPROVED** | 2 |
| 2026-09-22 | 2C Progress / Weight | **APPROVED** | 2 |
| 2026-09-22 | 2D History | **APPROVED** | 2 |
| 2026-09-22 | **INT-1 integration checkpoint** | **PASSED** | 2 |

---

# CLAUDE REVIEW — VNEXT PHASE 2E: SETTINGS

**Method:** a pristine `git archive` of the pre-2E tip (`a354ce0`) was exported and served
independently, so the "before" measurements could not be contaminated by Cursor's in-flight
edits. Every claim below is measured, not read from `CURSOR_REPORT.md`.

## Baseline (pre-2E, measured)

52 distinct capability handlers across nine views · hub 9 rows / **5 surfaces** · 17 storage
keys · 0 page errors · no horizontal overflow at 390/375/320 · reduced motion already clean.

## A. SCOPE — PASS

`cut-support.js`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*` and
`train-anatomy.js` all untouched. `RELEASE` and `CACHE_NAME` remain `109`.

`index.html` carries exactly the one permitted line: the nav label and `aria-label` become
*Settings* and the three-dot glyph becomes a gear. **`data-tab="more"`, `switchTab('more')`,
`#morePage`, `state.moreView` and `renderMore` are all unchanged** — the rename stayed at the
label level, as §3.8 required.

## B. NO SILENT FEATURE LOSS — PASS

All **52** baseline handlers survive. Two added, both from the new segmented control:
`NXP.pickOption('nxp-text',…)` and `NXP.pickOption('nxp-motion',…)`.

Storage key set **identical, 17 before and after**. Touring all nine views writes nothing.

Verified functionally rather than by inspection: Appearance's two `<select>` elements became
segmented controls **backed by hidden inputs under the same ids**, so `val('nxp-text')` and
`val('nxp-motion')` still resolve. Clicking through and saving writes
`{text:"large", motion:"reduced"}` to config. `aria-pressed` tracks selection.

## C. INSTRUMENT / VISUAL — PASS

Hub surfaces **5 → 0**: typographic rows on canvas, hairline separators, chevrons, no
card-per-row and no dashboard tiles. `data` **4 → 0**, `appearance` **1 → 0**.

IA is PLAN / PREFERENCES / BODY / DATA / ABOUT. Body kept its own group per the design brief.

Cloud status is calm when healthy and mirrors the three `updateCloudLocalBanner()` conditions
faithfully, reading `nxtfrm_cloud_banner_dismissed` without writing it (D11). "Not backed up"
carries an amber **diamond plus the word** — never colour alone (I2 / I6).

**Tier discipline held.** Tier 2 surface counts unchanged (goals 2, training 4, coach 3);
Tier 3 untouched. Nothing in this slice reached into 2G territory.

## D. DEFECTS FOUND AND REPAIRED (round 1)

| # | Defect | Measured before | After repair |
|---|---|---|---|
| R1 | Value column wrapped to two lines at 390 and 375 — `"90 min / week"`, `"3 lifting days"`, `"Not backed up"`, `"Not connected"` broken mid-phrase. Cause: `.vn-set-v` carried shrink factor 1 plus `overflow-wrap:anywhere` while `.vn-set-l` grew greedily. | 4 of 9 rows at 390; 5 of 9 at 375 | **0 wrapped at every width** |
| R2 | Chevron orphaned onto its own line at 320 on the Wearable row. Cause: `flex-basis:auto` gave the label a max-content basis that pushed the chevron past the line. | row 129px vs ~90px neighbours | **chevron inline on all 9 rows**, row 110px |

Post-repair geometry: 390 rows 67–87 (spread 20) · 375 rows 67–87 (spread 20) ·
320 rows 69–110 (spread 41). No value truncated. No horizontal overflow at any width.

## E. REGRESSION — PASS

16 suites / **458 tests** / 0 failing, matching baseline exactly. `node --check` clean;
`vnext.css` braces balanced 501/501. Zero page errors across all nine views at all widths.
Reduced motion `animationName:none`. Settings inherits the shared `vn-route-enter`.

## F. THE ONE CRITERION NOT MET — shared primary-button contrast

Acceptance required "no new accessibility regression." One exists, and it is **an instance of
the deferred D12 defect rather than an independent fault**:

| | Pre-2E | Post-2E |
|---|---|---|
| Class | `.n99-button` | `.vn-set-act` |
| Treatment | dark ink `rgb(23,18,31)` on solid violet `rgb(180,154,255)` | white on violet gradient |
| Contrast | **7.88:1 — passes** | **3.80:1 — fails I4** |

Affects two controls: *Save appearance* and *Export app backup*. Settings regressed them by
correctly adopting the shared VNext primary token — the same token that already measures
3.80:1 on Today (`.vn-act`) and Train. My INT-1 checkpoint did not catch it; that is recorded.

Fixing it inside 2E would mean inventing a Settings-only button treatment, which is precisely
what D12 forbids ("adjust the shared gradient/token rather than individual screens"). The
scheduled follow-up patch resolves all three screens in one coherent change.

## G. RECORDED, NOT ACTED ON

- **D12** — shared primary-button contrast, narrow patch immediately after 2E.
- **D13** — `backfillAllCoachInsights()` pre-existing dead code. The pre-2E baseline capture
  confirms it was already unreachable, so this is not a 2E regression.
- **`RESET APP DATA` is styled as the primary action.** Legacy `.btn.danger` inherits the
  violet gradient and only recolours its text to pink — measured **1.04:1**, effectively
  illegible, and it reads as the affirmative CTA. Tier 3 legacy, untouched by this slice.
  Worth folding into the D12 patch since it is the same shared gradient.
- Inherited V96 accessibility debt, unchanged by 2E: body 19, notifications 4 (plus three
  unlabelled 48×28 toggles), app 4, training 2.

## H. HARNESS CORRECTION

My first contrast pass reported three failures at ~1.05:1 that were **false** — the checker
read only `backgroundColor`, so gradient-filled buttons fell through to the page canvas. It
now averages gradient stops; those three actually pass at ~7.3:1. The numbers in this document
are post-fix. The `RESET APP DATA` and primary-button findings survive the correction.

---

# CLAUDE REVIEW — D12: SHARED PRIMARY-BUTTON CONTRAST PATCH

Implemented on `grok-4.7-high-fast`, not the pinned Opus model — see §D.

## A. RENDERED CONTRAST — measured, not inferred

Default state, worst gradient stop, 390px:

| Surface | Class | Before | After |
|---|---|---|---|
| Today primary CTA | `.vn-act` | 3.44:1 | **5.70:1** |
| Train primary CTA | `.n99-button` | 3.44:1 | **5.70:1** |
| Settings *Save appearance* | `.vn-set-act` | 3.44:1 | **5.70:1** |
| Settings *Export app backup* | `.vn-set-act` | 3.44:1 | **5.70:1** |
| Settings quiet variant | `.vn-set-act.is-quiet` | 14.19:1 | 14.19:1 (untouched) |
| **RESET APP DATA** | `.btn.danger` | **1.12:1** | **5.23:1** |

## B. INTERACTION STATES — all measured, opacity and filter composited

| Surface | default | hover | active | focus | disabled |
|---|---|---|---|---|---|
| Today primary | 5.70 | 5.70 | 5.70 | 5.70 | 7.10 |
| Train primary | 5.70 | 5.70 | 5.70 | 5.70 | 19.04 |
| Save appearance | 5.70 | 5.70 | 5.70 | 5.70 | 7.10 |
| Export app backup | 5.70 | 5.70 | 5.70 | 5.70 | 7.10 |
| Quiet variant | 14.19 | 14.19 | 14.19 | 14.19 | 3.34 |
| RESET APP DATA | 5.23 | 5.23 | 5.23 | 5.23 | 5.23 |

**The quiet variant's disabled 3.34:1 is not a defect.** WCAG 2.1 SC 1.4.3 exempts text
in an inactive user-interface component from any contrast requirement. Measured
like-for-like, the pre-2E equivalents sat at **2.12–2.38** in the same state, so this is
an improvement on a long-standing characteristic of `opacity:.42`, not a regression.
D12 went further than required on the primaries, holding full opacity when disabled.

## C. THE CASCADE FINDING

The destructive control was painted by `index.html` ~2196:

```css
.btn{ background:linear-gradient(135deg,#B794F6 0%,#8B5CF6 42%,#7DD3FC 100%) !important }
```

**Importance is sorted before specificity**, so that shorthand beat the correct
`.btn.danger` tint in `premium-ui.css` despite the latter's higher specificity. A
gradient shorthand sets the image and resets `background-color` to transparent — which
is exactly the `rgba(0,0,0,0)` I measured. It sets no `color`, so `--nxt-danger`
`#f0768e` still won the ink, giving pink-on-violet at **1.12:1**.

That is why the app's most destructive control was wearing the affirmative gradient.

## D. MODEL DEVIATION

The pinned `claude-opus-5-thinking-high-fast` returned
`ActionRequiredError: You've hit your usage limit for Opus`, resetting 2026-10-13. No
work was attempted and no file was modified. With owner approval the patch ran on
`grok-4.7-high-fast`, the fallback AGENTS.md §6b already named. Recorded so the slice
stays attributable.

## E. REGRESSION — PASS

CSS only. `cut-support.js`, `premium-ui.js`, `index.html`, `sw.js`,
`manifest.webmanifest`, `wearables.*`, `seed.*` and `train-anatomy.js` all untouched.
`RELEASE`/`CACHE_NAME` at `109`.

16 suites / 458 tests / 0 failing. Braces balanced: `vnext.css` 502/502,
`premium-ui.css` 816/816. All 52 Settings capability handlers reachable; storage an
identical 17 keys. All five destinations render byte-identical markup to 2E
(7449 / 1201 / 16730 / 11258 / 3613). Zero page errors, no overflow at 390/375/320.

`verify-2e.mjs`: **ALL PASS**. Appearance and data text-contrast failures both drop
to **0**; `app` falls 4 → 3 as the reset button is fixed. The residual
body 18 / notifications 5 / app 3 is inherited V96 Tier 3 debt, out of scope.

## F. TEST-HARNESS CORRECTION (mine)

`verify-2e.mjs` read only `backgroundColor`, so gradient-filled buttons fell through
to the page canvas — which is why it certified `a11y: true` over a measured 3.44:1 CTA.
Made gradient-aware, evaluating the **worst** stop.

The first attempt over-corrected, reporting 36 false hub failures: it treated the
page's decorative `rgba(167,139,250,.15)` wash as an opaque background. Now a gradient
counts only when its stops are effectively opaque (α ≥ 0.9), and an element's own fill
takes precedence over any ancestor's. D12's fix would not have been verifiable without
this.

## G. OBSERVATIONS, NOT DEFECTS

- The action fill (`#7C3AED`→`#6D28D9`) is now a deeper step than the signal violet
  `#8B5CF6`. Two steps of one hue doing two jobs — large fills carrying white text
  versus thin accents on dark. Consistent with I1; the identity reads intact.
- The "DANGER ZONE" kicker above the reset button is still generic violet rather than
  the concern colour. Tier 3 legacy, outside D12's button scope.

---

# CLAUDE REVIEW — VNEXT PHASE 2F: EVOSCAN FLAGSHIP

Implemented on `grok-4.7-high-fast` (Opus still rate-limited until 2026-10-13).

## A. SCOPE — PASS

`sw.js`, `manifest.webmanifest`, `seed.*`, `train-anatomy.js` and every wearables suite
except the weight contract are untouched. `RELEASE`/`CACHE_NAME` at `109`.
`cut-support.js` changed by **9 lines**, confined to `cleanRows()` selection as D14 permits.
No other engine function moved.

## B. THE D14 ENGINE CHANGE — verified independently

```js
if(key==="weight"){
  const timing=String(r.timeOfDay||"").trim().toLowerCase();
  if(timing&&timing!=="morning")continue;
}
```

Gated on `key==="weight"`, so waist rows are unaffected. The `timing&&` guard is the
important judgement: rows with **no timing at all** stay eligible, so pre-`timeOfDay`
weigh-ins from the V93–V106 era are not silently dropped out of the trend.

I recomputed the engine's real output from the contract fixture, independent of the test's
assertions:

| | Engine actually produces |
|---|---|
| `ewmaTrend` length | 38 |
| last EWMA avg | 86.3557 |
| last trend coverage | 6 |
| untimed legacy row (91.0) | **still canonical** — no history loss |
| 2026-09-15, post-workout only | **absent** — D14 enforced |
| post-workout contextual rows | **both preserved** (84.8, 85.2) |

## C. THE MODIFIED TEST — legitimate, not weakened

`wearables.weight-contract.test.js` changed because D14 reverses what test 2 asserted.

Test 2 previously required *"a post-workout-only day still yields a canonical point"*. It now
asserts the day is absent from the canonical set **and** that the reading survives in
`N.timingRows("Post-workout")` at the same 85.2 kg — the original intent (the data must not
vanish) is preserved, only the canonical claim is inverted.

Tests 9/10 are characterization tests pinning exact numbers; D14 legitimately moves them
(39→38, `86.253`→`86.3557`, coverage 7→6). **I verified every re-pinned number against the
engine directly** — they are real output, not numbers chosen to pass. The file header declares
the change and why, as AGENTS.md §5 requires.

## D. OCR — the flagship defect is fixed at the owning layer

`.replace(/O/g,"0")` across the whole string is gone. Label normalisation and numeric
normalisation are separate, so `BODY FAT` and `TOTAL DAILY ENERGY` stay searchable while
`8O.4` resolves to `80.4` only inside a numeric context. `verify-2f.mjs` asserts the repair is
**general, not a label special case** — which was the explicit instruction.

`verify-2f.mjs`: **23 passed**, covering uppercase and lowercase printouts, a missing metric
staying `NOT FOUND`, fat/muscle mass not being stolen as body weight, a dropped decimal not
being rewritten into a plausible weight, pounds converting and staying `CHECK`, garbage
producing nothing, competing values marked `CHECK` with both candidates kept, low OCR
confidence forcing `CHECK`, no value carried forward between extracts, correction retaining
the original OCR interpretation, percentage-point semantics, per-metric separate scales, EXIF
orientation, and synthetic-only fixtures.

## E. DELETE SEMANTICS — correct and conservative

`evoDeleteScan()` confirms with a message that states what is removed and what remains, and
always says "A morning weigh-in is not deleted." The cascade filter keeps any `Morning` row by
construction. Where more than one weigh-in matches a legacy scan, it **removes none and says
so** rather than guessing — exactly the instructed behaviour.

## F. STORAGE — compatible

Key `apm_evo_scans` unchanged. All ten original fields keep their names. Additive optional
fields only: `provenance`, `ocrText`, `weighInId`. Proven by test: an older scan without them
still renders its core numbers.

## G. BROWSER QA — PASS

**390 / 393 / 402 / 430 / 375 / 320**: zero horizontal overflow, zero targets under 44pt, zero
page errors at every width. **Zero contrast failures** on the EvoScan surface.

Capability check: the capture form moved behind `evoOpenForm()` as a dashboard-first entry
point, so I verified reachability rather than assuming. All four baseline handlers
(`handleScanFile`, `readEvoScanOCR`, `saveEvoScan`, `useLatestScanTDEE`) and **all nine fields**
are present once opened. Nothing lost.

Other four destinations render byte-identical to 2E (7449 / 1201 / 16730 / 11258 / 3613).
16 suites / 458 tests / 0 failing.

## H. PRODUCT QUALITY

The populated dashboard reads as body-composition intelligence rather than an OCR tool:
weight as protagonist with `MEASURED` vs `ESTIMATED` carried by a diamond as well as a word,
per-metric deltas in correct units, body fat in **percentage points**, a composition bar, an
EvoScan-series trend with per-metric tabs on separate scales, What Changed, and scan history.

The honesty is the strongest part. The context line states plainly that a scan
"is not your morning weigh-in, and not part of the body-weight trend". The composition bar
labels its own limit: "Remainder is scale weight minus fat mass — not a measured compartment,
and not lean mass stored as its own metric", and muscle mass is shown unstacked with
"It is not stacked onto fat mass." That refuses to invent a compartment the scan never
measured (D9).

## I. ONE DESIGN NOTE — not a blocker

Scan history repeats a rose **Delete** on every row, three of them down the list. Targets are
≥44pt, contrast passes and the action now confirms, so nothing here is unsafe — but a
destructive action repeated at that prominence pulls the eye harder than the scan data it sits
beside. Worth demoting into the scan detail view, or behind a swipe/overflow affordance, in a
later polish pass.

## J. LIMITATION WORTH STATING

The dev seed carries **zero scans and 100% Morning weigh-ins**, so neither the dashboard nor
D14 can be exercised by seeding alone. The dashboard above was rendered against synthetic
scans injected at runtime, and D14 is proven by the contract fixture and `verify-2f.mjs`
rather than by the seed. On real data the visible effect of D14 depends on how many
skipped-morning days exist; that dataset is in the owner's browser, not the repo, so the
magnitude there is unmeasured.

---

# CLAUDE REVIEW — VNEXT PHASE 2G: PROGRESS → PERFORMANCE

Implemented on `grok-4.7-high-fast`.

## A. SCOPE — PASS

`premium-ui.js` and `vnext.css` only. **`cut-support.js` and `index.html` are untouched**, so
the strength engine — the e1RM formula, the 21/56-day windows, the ±2/−5 thresholds, the
`sustained` rule and the 24-item cap — is exactly as shipped. `sw.js`,
`manifest.webmanifest`, `seed.*`, `train-anatomy.js` and every wearables suite clean.
`RELEASE`/`CACHE_NAME` at `109`.

`N.strengthHTML()` remains in place for the legacy renderer; the live screen is painted from
`strengthItems()` in `premium-ui.js`. Same migration seam as every prior slice.

## B. ALL SIX STATUSES RENDER — the thing the seed could not test

The seed yields 20 exercises **all classed `Older history`**, so it exercises one of six
states. I injected synthetic lifting history and confirmed the engine classifies, and the UI
renders, every one:

| Engine classification | Delta | Rendered |
|---|---|---|
| `Improving` — Bench Press · Gym A | +11.25% | yes |
| `Holding steady` — Back Squat · Gym A | 0.00% | yes |
| `Watch` — Overhead Press · Gym A | −10.83% | yes |
| `Review` — Deadlift · Gym A | −15.00% | yes |
| `Building data` — Cable Fly · Gym A | null | yes |
| `Older history` — Leg Press · Gym A | null | yes |
| `Improving` — Bench Press · **Gym B** | +7.14% | yes — two gyms, two comparisons |

## C. NOT COLOUR-ALONE — proven in greyscale (I2 / I6)

Rendered with `grayscale(1)` applied. Every status stays distinguishable:

| Status | Glyph | Plain-language line |
|---|---|---|
| Building data | ○ hollow circle | "Not enough yet" |
| Improving | ● filled circle | "Up across the last four sessions" |
| Holding steady | ■ square | "Within the steady band" |
| Watch | ◇ hollow diamond | "Down on this comparison, not repeated yet" |
| Review | ◆ filled diamond | "Down on both of the latest two sessions" |
| Older history | — dash | "Too old to compare" |

The `Older history` sparkline is additionally **dashed**, marking stale data without relying
on colour.

## D. CHARTS — per-exercise scales, with text equivalents

Each spark is on its **own** scale, as the data-viz skill requires — loads differ by an order
of magnitude across the list. Proven by the text equivalents:

```
Cable Fly  … own scale 30.7 to 32.7
Back Squat … own scale 125.7 to 127.7
Leg Press  … own scale 252.3 to 254.3
```

**7 of 7 sparks carry an accessible name**, and each states exercise, gym, that the value is an
estimated 1RM, its own scale, and the dated points. A sparkline that only sighted users can
read would have failed; these do not.

## E. HONESTY — PASS

`Older history` reads "Too old to compare", not as a gap to fill. `Building data` reads "Not
enough yet", not as zero progress. Statuses are engine vocabulary only (I12) — no score, no
composite, no "muscle preserved" (D9).

The disclaimer survives verbatim: *"Estimated 1RM is a comparison aid, not a tested maximum or
proof of muscle retention. Technique, effort and equipment setup affect it."*

**A null delta never renders a percentage** — verified per row against the engine rather than
by scanning page text. Note a *real* 0.00% delta (Back Squat, flat across four sessions)
correctly renders as `0.0%`; that is a true value, not a null one. My first pass flagged it as
a failure, which was a false positive in my harness, not a defect.

## F. BROWSER QA — PASS

**390 / 393 / 402 / 430 / 375 / 320**: zero horizontal overflow, zero targets under 44pt, zero
page errors at every width. **Zero contrast failures** on the Performance surface.

All four baseline handlers present at every width (`setView` ×3, `apx95OpenQuickWeight`). All
five destinations render byte-identical markup (7449 / 1201 / 16730 / 11258 / 3613), 0 errors.

16 suites / 458 tests / 0 failing. `verify-2g.mjs`: 11 passed, on injected fixtures.
`node --check` clean; `vnext.css` braces 653/653.

## G. NOTED, NOT IN SCOPE

**Progress → Body** still links out to the old scan entry via `NXT.more('body')`, which 2F
replaced with the EvoScan workspace. Design brief §S wants Body to gain analytical presence
under Progress while capture stays in Settings. Carried forward; deliberately untouched here.

---

# CLAUDE REVIEW — INTEGRATION CHECKPOINT INT-2

**Covers:** 2E `1499653` · D12 `0f54aa6` · 2F `ba33fa8` · 2G `b137e64`, reviewed **together**
rather than in isolation. No new product feature. `RELEASE`/`CACHE_NAME` held at `109`.

## RESULT — PASSED after two repairs

Eight of ten areas were clean on first pass. Two genuine defects were found, both of the kind
this checkpoint exists to catch: **contradictions between slices whose own tests all passed.**

## Areas verified clean

| # | Area | Evidence |
|---|---|---|
| 1 | Navigation / ownership | One effective renderer set (NXP wins by load order; the legacy assignments remain, D5-gated). **No CSS leakage** — all 618 `vnext.css` selectors resolve inside `#homePage` / `#trainPage` / `#weightPage` / `#historyPage` / `#morePage` / `.tabs` / `.content` / `:root`. |
| 2 | Cross-slice data semantics | D14/D17 hold under injection: Post-workout 99.1 and Evo Scan 99.9 both **non-canonical**; an untimed legacy row **stays** canonical at 88.8; both contextual rows remain stored and present in `timingRows`. Scan save writes `timeOfDay:"Evo Scan"` with a linking `weighInId`; `cleanRows` excludes it. |
| 3 | Train | Input contract intact (`weightInput`, `repsInput`, `n99-set-type`, `n99-rir` — the latter two now hidden inputs behind segmented controls, same pattern as 2E). Warm-up reachable, nav recedes (D6), rest timer and undo present. Add-on does not mutate planned `dayType`. Persistence across reload 174 = 174. **Log → 175, undo → 174.** |
| 4 | Progress | D2 domain **identical** with goal on and off (80–90). Strength engine untouched. All six states render. Null delta never a percentage. Sparkline text equivalents survive. |
| 5 | Today | D11 conditions in the 2E hub mirror `updateCloudLocalBanner()` exactly — same three conditions, same order, dismissal key read and not written. |
| 6 | Body / OCR | Review-before-save intact; `NOT FOUND` distinct from `CHECK`; no carry-forward; units/range/confidence validation intact (`verify-2f` 23/23). Contextual scan weight does not reach the morning trend. |
| 8 | Offline / cache | All 22 production assets registered at `RELEASE 109`. `wearables.fixtures.js` is absent **correctly** — it is injected at runtime only on localhost/`::1`/`file:`, predates VNext, and must not be precached into the production shell. |
| 9 | Tests | 16 suites / 458 tests / 0 failing. All eight verify scripts green. |

## Defects found and repaired

### C1 — `--vn-ink-4` failed WCAG AA on the surface colour

Today's `.vn-evid` labels *Trend* and *Confidence* (11.5px / 500) measured **4.29:1** at all six
widths. The token was safe on canvas but not on `--vn-surface`.

Today shipped in 2A and passed INT-1. It was missed then because my contrast checker only read
`backgroundColor` and became accurate during D12. Fixed at the token so all **27** consumers
inherit it:

| Token | Canvas | Surface | AA |
|---|---|---|---|
| `--vn-ink-3` `#8B92A0` | 6.09 | 5.52 | pass |
| **`--vn-ink-4` new `#7E8593`** | **5.14** | **4.66** | **pass** |
| `--vn-ink-4` old `#787F8D` | 4.73 | **4.29** | **fail** |

`--vn-ink-4` remains the quietest step and the four-step ramp stays distinguishable. No font
size or weight was raised to dodge the threshold.

### C2 — `verify-2e` carried a probe that 2F invalidated

It asserted the body view exposes `#scanWeight` / `.ocr-box`. 2F legitimately replaced both:
capture moved behind `evoOpenForm()` and the raw OCR block was removed per D16. **Not a
regression** — all four handlers and nine fields remained reachable.

Re-pointed at the real contract, and the replacement is **stronger** than what it replaced: it
requires `evoOpenForm` to exist, calls it, then demands all nine field ids and all four handler
call sites inside `#morePage`, then cancels back. It still fails if the scan path disappears.

## Post-repair verification

**30 combinations** — Today · Train · Progress/Weight · History · Settings, at
**390 / 393 / 402 / 430 / 375 / 320**:

- zero horizontal overflow
- zero targets under 44pt
- **zero contrast failures**
- reduced motion `animationName:none` on all five destinations

16 suites / 458 tests / 0 failing. All eight verify scripts pass, including the repaired 2e.
`vnext.css` braces 653/653. `cut-support.js`, `index.html`, `premium-ui.js`, `sw.js`,
`manifest.webmanifest`, `wearables.*`, `seed.*` and `train-anatomy.js` all untouched by the
repair.

## Two false alarms I resolved rather than reported

- **Train "missing logging contract"** — my probe never reached a lifting day; `repaint()`
  re-derives `state.date`. Forcing the weekly plan showed the contract intact.
- **"Undo does not work"** — `apx96UndoLastSet()` calls `confirm()`, and Playwright
  auto-dismisses dialogs. With the dialog accepted: 174 → 175 → 174.

Both are recorded because the method matters: a checkpoint that reports its own harness bugs as
product defects is worse than no checkpoint.

---

# CLAUDE REVIEW — PROGRESS → BODY ANALYTICAL INTEGRATION

Implemented on `grok-4.7-high-fast`.

## A. THE SPLIT NOW MATCHES BRIEF §S

Progress → Body owns the **analysis**; Settings → Body owns the **capture**. The dead-end
*Open scans* hop is gone.

## B. NO SECOND SOURCE OF TRUTH — the main risk, avoided

`evoAnalysisHTML()` was **extracted** from `evoBoardHTML()` in `index.html`, and both screens
call it. `evoBoardHTML` now delegates to it, keeping its capture chrome (back, new scan, manual
entry, TDEE) around the shared analysis. Behaviour unchanged — this is the one `index.html`
edit the task permitted, and it was declared.

`vnext.css` did the same at the style layer: `#morePage .vn-evo*` rules became
`:is(#morePage, #weightPage) .vn-evo*`. Net **+4 selectors** (651 → 655), so the 141 deleted
lines are rescopes, not losses. One component set serves both surfaces, still inside the page
scoping contract.

## C. A HOP REMOVED, NOT A CAPABILITY

`NXT.more('body')` is gone from this screen, replaced by `NXP.openBodyCapture()`. Verified end
to end: from Progress → Body it routes to `morePage` with `moreView:'body'`, the capture form
open, **all nine fields present and all four handlers wired**. The row is labelled honestly —
*New scan · Review and save in Settings · Add ›*.

Handlers went 6 → 18. Waist survives intact: `openWaist()`, per-row `openWaist('<date>')` edit,
and the full reading list.

## D. HONESTY RULES HOLD

`MEASURED` on weight versus `ESTIMATED` on body fat, muscle mass, fat mass, BMR and TDEE, each
carrying a shape as well as a word. Per-metric trend tabs, stated plainly: *"Each metric has
its own scale. This is the EvoScan series, not the morning body-weight trend."* (D15)

The D14 guard copy is present on the analysis: *"EvoScan · post-workout context. Not your
morning weigh-in, and not part of the body-weight trend."*

The composition bar still refuses to invent a compartment — *"Remainder is scale weight minus
fat mass — not a measured compartment, and not lean mass"* — and the page closes with *"Body
fat and muscle figures only appear from saved Evo scans. They are not calculated from waist or
scale weight."* (D9)

What Changed uses **percentage points** for body fat.

## E. CONTRACT FROZEN AS REQUIRED

`cut-support.js`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*` and
`train-anatomy.js` all untouched. `RELEASE`/`CACHE_NAME` at `109`. The D16 OCR contract, the
`apm_evo_scans` key, the record shape, `weighInId` linking, delete semantics and `cleanRows`
are all unchanged.

Viewing writes nothing: scans 3, bws 83, waist 2 before and after touring every Progress view.

## F. VERIFICATION

**All nine verify scripts green** — 2a, 2b, 2b-fold, 2c, 2d, 2e, 2f (23), 2g (11), 2h (10).
Running the earlier ones matters: INT-2 proved a slice can break an earlier slice's assertions.

16 suites / 458 tests / 0 failing. `premium-ui.js` parses; `vnext.css` braces 657/657.

**Progress → Body at 390 / 393 / 402 / 430 / 375 / 320**, populated with synthetic scans and
waist readings: zero overflow, zero targets under 44pt, **zero contrast failures**, zero page
errors.

Cross-screen: all five destinations byte-identical (7449 / 1201 / 16730 / 11258 / 3613), zero
page errors, and the full 30-combination sweep still clean with reduced motion `none`
everywhere.

## G. CARRIED FORWARD, NOT REOPENED

The repeated rose **Delete** in scan history now appears on this surface too, which strengthens
the case for **P1** in `RELEASE_CHECKS.md`. Owner ruling stands: later polish pass, do not
reopen for it.

---

# CLAUDE REVIEW — TRAIN COMPLETION + DEEP POLISH

Implemented on `grok-4.7-high-fast`. AI work paused throughout; nothing AI-related added.

## A. WHAT ALREADY MET THE DESIGN — measured before commissioning any work

The audit changed the shape of this pass. Most of Train already met the approved direction:

| | Measured |
|---|---|
| **Working loop** | **587px** at 390/393/402/430/375, **662px** at 320; 659–741px with three sets |
| **Log Set** | in viewport in **all 24** width × set-count combinations at 844px |
| Input contract | all four ids intact; 26px font (no iOS zoom); inputs 52px |
| Active mode | nav recedes; 19 handlers wired |
| Queue | already contextual (`NXP.queue()`), not a persistent block |
| Previous / target | `Last 30.5kg × 12 · 13 Jul` and `Target 8–12` present |
| Rest timer | `02:30 · +30s · Skip`, counts down |
| Completion | real numbers only — **no score, duration or calories invented** |
| Anatomy | deterministic; **106/107 catalogue, 21/21 templates, 20/20 logged**; unknowns resolve empty |

**The original ~2,200px loop with Log Set below the fold is solved.** The task therefore
forbade chasing a pixel number or rebuilding what passes.

## B. G1 — KEYBOARD DOCK (the real gap)

Before: at viewport heights of 520/480/420 the focused input stayed visible but **Log Set did
not**, with a fixed 278px of reps stepper (78) + set type (74) + RIR (78) between them.

Verified after, emulating a soft keyboard by making `visualViewport` shorter than the layout
viewport — which is the signal the dock actually reads:

| Keyboard | `position` | Log Set bottom | Usable | Reachable | Height |
|---|---|---|---|---|---|
| none | `static` | 678 | 844 | yes | 50px |
| 320px | **`fixed`** | 516 | 524 | **yes** | **50px** |
| 340px | **`fixed`** | 496 | 504 | **yes** | **50px** |

It docks **only** when a keyboard is present and returns to inline flow otherwise. Nothing was
shrunk — the control stays 50px in every state, as required.

**Logging was tested, not merely the button's presence.** A set logged with the keyboard open
produced a byte-identical record at all three heights:
`{ex:"Incline Dumbbell Press", w:62.5, r:9, t:"working", rir:null, gym:"Gym A"}`. Zero page errors.

Hierarchy and order are unchanged; set type and RIR are still present and visible.

## C. G2 — DATE INPUT OVERLAP (owner-reported)

Root cause was **not** the grid: it was already `minmax(0,1fr)` with `min-width:0`, and inputs
were `width:100%; max-width:100%!important`, which is why it never reproduced in Chromium. On
iOS, `input[type="date"]` keeps its native widget and its **`::-webkit-datetime-edit` shadow
parts enforce an intrinsic minimum width** that outer styling cannot defeat, so it spills its
~176px cell onto `Weight · kg`.

Fixed once in the shared layer — `appearance:none`, `-webkit-appearance:none`,
`box-sizing:border-box`, `min-inline-size:0`, `min-height:44px`, plus `min-width:0` on the
`::-webkit-datetime-edit` parts and on grid children/labels holding a date via `:has()`.

Verified across widths: `appearance:none` applied, `box-sizing:border-box`, **0px overlap**,
**52px tall** everywhere. At **375 and below the pair now stacks** (349px full width); 390+
stays two-up at 176–196px.

**Honest limit:** this targets the correct iOS mechanism and is verified applied, but headless
Chromium cannot reproduce the original spill, so final confirmation needs the owner's device.

## D. VERIFIED, NOT REBUILT

**Add-on never mutates the planned day**, proven across reload:

| Day | After add-on + log + refresh |
|---|---|
| Rest | `dayType:Rest, planned:Rest` |
| Zone2 | `dayType:Zone2, planned:Zone2` |
| Floorball | `dayType:Floorball, planned:Floorball` |

Floorball exposes no add-on form, which is correct — `ADDON_DAYS` is `{Rest, Zone2, Cardio}`.

**Greyscale (§34):** rendered at `grayscale(1)`, every state stays legible — Working/Warm-up by
fill, RIR by outline, completed sets by numbered circles, current set by scale and position.
The anatomy's meaning is carried in text by the muscle line, so it is never colour-only.

## E. RESPONSIVE

**390 / 393 / 402 / 430 / 375 / 320**, mid-workout with sets logged: zero overflow, zero targets
under 44pt, **zero contrast failures**, zero page errors at every width.

## F. TESTS

16 suites / 458 tests / 0 failing. **All ten verify scripts green** — 2a, 2b, 2b-fold, 2c, 2d,
2e, 2f (23), 2g (11), 2h (10), train (15). `premium-ui.js` parses; `vnext.css` braces 668/668.

`cut-support.js`, `index.html`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `seed.*` and
`train-anatomy.js` untouched. `RELEASE`/`CACHE_NAME` at `109`.

## G. PROCESS NOTE

Two of my own errors, recorded because they nearly cost more than the work: I misread a Cursor
reconnect as a process death and briefly launched a **second concurrent agent** — caught within
seconds, killed, no partial writes. Root cause was a waiter arming itself via
`pgrep … | head -1`, which had been matching the long-running Cursor **IDE worker** rather than
the delegation. Waiters now match the delegation's own prompt text.

## H. REMAINING LIMITATIONS

- The iOS date fix needs owner-device confirmation (§C).
- Architecture: Train styling still spans `premium-ui.css` (166 rules) and `vnext.css` (139).
  Legacy `renderTrain` remains in `index.html` and `cut-support.js`, superseded by `NXP.training`
  at load order. **Documented as cleanup candidates, not touched** — D5 gates removal.
