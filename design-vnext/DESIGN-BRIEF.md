# NXTFRM VNext — Phase 1 Design Brief

**Direction: INSTRUMENT.** Isolated, disposable design workspace. No production file was touched.

Prototype: `design-vnext/index.html` · Data: `design-vnext/data.js` (engine-computed) · System: `vnext.css` · App: `vnext.js`

---

## A. Current product audit

**Architecture (rendering ownership).** Five empty `<section>` shells in `index.html:2642-2646`, filled entirely by JS. Three layers, in load order:

| Layer | File | Role |
|---|---|---|
| Engine | `cut-support.js` (`NXT`) | Trend, plateau, forecast, strength, sessions, backup. **The truth.** |
| Presentation | `premium-ui.js` (`NXP`, "V100 layer") | The UI actually on screen today |
| Legacy | `index.html` inline (~4,500 lines) | Older `renderHome/renderTrain/renderWeight` still present, largely superseded |

The engine exposes three clean API surfaces (`cut-support.js:968`, `:1075`, `:1240`). **This separation is the single most valuable thing in the codebase** and is why a visual redesign is feasible without semantic risk.

**What the audit found, with evidence:**

1. **Card soup on Today, confirmed by count.** `premium-ui.js:25-66` emits ten modules — decision, training, bodyweight, recovery, cardio/performance signals, calorie guide, adherence, quick actions, week disclosure — most as `.nxp-home-card` with the same radius and fill. Nothing is the protagonist.
2. **Uniform radius + gradient is the identity.** `--radius:22px` applied to nearly everything, and `linear-gradient(135deg,var(--purple),var(--sky))` used for buttons, tabs, toggles *and* progress bars. Purple is wallpaper, not signal.
3. **The weight chart's scaling failure is real and measurable.** In `chartModel()` (`cut-support.js:754-782`) the goal band, forecast cone and target are all pushed into the y-domain (`:766`, `:773`). Measured on live seeded data:
   - goal off → domain **81–85 (4 kg)**
   - goal confirmed → domain **76–86 (10 kg)**

   The bottom ~40% of the plot then contains **no data at all**. A month of morning readings spanning ~2.5 kg is compressed into the top third to reserve space for a goal several weeks away. This is the highest-value fix in the whole redesign.
4. **Seven layers at near-equal weight** on one chart: raw morning, trend, confidence band, forecast line, forecast cone, goal band, target rule. The confidence band is a thick grey slab that outweighs the data.
5. **Global nav persists during active workouts** and physically overlaps the weight stepper. The Train screen is ~2,200px tall at 390px — "Log set" sits below the fold *during a set*.
6. **A cloud/sync banner occupies the top of the screen in normal operation.**
7. **`readiness()` (`index.html:2865`) synthesises a 35–96 score** from sleep/energy/soreness. This is exactly the invented metric the product rules forbid. It is already unused on the new Today (`recLabel` is computed then `void`-ed, `premium-ui.js:39`) — it should be deleted, not restyled.

**Functional truth confirmed present (all preserved):** `setType` warm-up/working, `rir`, rest timer (`apx96StartRest`), `sessionPlans` vs `addOns` (deliberately separate so an add-on cannot reclassify a day — `index.html:2815-2819`), Gym A/B, double progression, `timeOfDay: Morning | Post-workout | Evo Scan`, substitutions, undo, finish.

---

## B. Research conducted

- **Live inspection** of the running app (local server + Chromium at 390/375/320), including forcing `targetConfirmed` to reproduce the chart-domain failure and reading `chartModel()`'s computed domain directly.
- **Code audit** of engine API surfaces, state shape, persistence keys and `logSet` semantics.
- **Skills applied:** all four NXTFRM skills, plus the generic `dataviz` skill (its palette validator was run, not eyeballed).
- **External calibration:** weight-trend charting (MacroFactor trend semantics, Happy Scale smoothing, raw-behind-trend convention) and active-workout UX (single emphasized set, muted completed/upcoming, "don't turn the workout screen into a dashboard").

## C. Patterns studied

| Reference | Problem it solves | What NXTFRM takes | What NXTFRM does **not** take |
|---|---|---|---|
| MacroFactor / Happy Scale | Daily weight is mostly water noise | Trend is the primary mark; raw readings are recessive context | Smoothing-algorithm pickers; streaks and gamification |
| Apple Health | Dense data, calm presentation | Section rhythm on a bare canvas; typographic hierarchy over boxes | Sterility; burying interpretation |
| Hevy / Strong | Fast logging under fatigue | One dominant set; queue in a sheet; nav recedes | Social feed; badges; PR confetti |
| Oura / WHOOP | Daily verdict | A single stated decision above evidence | **A composite score.** NXTFRM must never invent one |
| Finance/analytics apps | Scrubbing a series | Drag anywhere → nearest observation → stable header | Multi-axis density; tickers |

## D. Principles extracted

1. **A surface is a claim of primacy.** One protagonist surface per screen, plus sheets.
2. **Conclusions on Today; evidence on Progress.**
3. **One chart, one question.**
4. **A distant goal may never set a recent chart's scale.**
5. **Status is a word first, a colour second.**
6. **Violet is signal, never wallpaper.**
7. **Projection must never look like measurement.**
8. **Nothing needs changing is a first-class, well-designed outcome.**

---

## E. Core product model

`OBSERVE → UNDERSTAND → DECIDE → ACT → LEARN`, surfaced as: Today states the decision; Train executes; Progress tests whether it worked; History records what happened and why.

## F. State model (design target — not implemented)

```
phase: cut
weight:    { status: losing, pace: -0.45 kg/wk, confidence: medium }
training:  { planned: 3, completed: 3, performance: holding }
cardio:    { completed: 90, target: 90 }
recovery:  { state: normal }
adherence: { state: good }
concern:   none
decision:  hold
```

Rendered as **discrete named fields, never collapsed into one score.** Today's decision surface is a direct view of `decision` + `concern`; the evidence rows are a direct view of the domain blocks. When the engine gains a real State Engine, the UI binds to it without redesign.

## G. Information architecture

Kept: **Today / Train / Progress / History / Settings.** The five destinations already answer distinct questions; changing them would be novelty. What changes is *internal hierarchy*.

- **Progress** becomes Weight / Performance / Body. **No Recovery tab** — recovery is an input, not an evidence domain, so it stays a check-in.
- **Body** gets analytical presence under Progress → Body while capture stays under Settings. This resolves "Body is hidden in Settings" without duplicating entry.
- **AI has no tab.** It appears as `Why this call ›`, `Ask NXTFRM`, and proposal sheets.

## H. Final design direction — INSTRUMENT

Layered charcoal canvas with a single soft focal light. Content sits **directly on the canvas**, organised by type, space and hairlines. A raised surface appears only to mark the screen's protagonist, or as a transient sheet. Violet marks state — active tab, current set, selected point, selected date, focused input — and nothing else.

Named for how it should feel: a precision instrument, not a dashboard.

## I. Colour system

```
void #08090C   canvas #0E1014   zone #12151B
surface #171B22   surface-2 #1E232C   surface-3 #262C37
ink #F1F3F7  ink-2 #AEB4C0  ink-3 #8B92A0  ink-4 #787F8D
violet #8B5CF6 (mark)   violet-lift #A78BFA (text on dark)
```

**Every ink step clears WCAG AA (4.5:1) against the canvas — verified by a computed audit over all four screens, not by eye.** The first pass failed (`ink-3` 4.41:1, `ink-4` 2.46:1) and the ramp was re-stepped.

**Status trio — validated, not chosen by taste:** `#8B5CF6` / `#B8842A` / `#DC5A76` passes lightness band, chroma floor, CVD separation, normal-vision floor and contrast. Deutan ΔE is 7.8 — inside the 6–8 band that is legal **only with secondary encoding**, which is why **status always ships a word and a distinct dot shape** (circle / rotated square / square). No green anywhere: it is not NXTFRM's identity and the codebase had already aliased `--green` to purple.

**Chart series carry no competing hues.** Trend is violet; *all* raw readings are one neutral slate. Morning vs post-workout is separated by **mark** (filled dot vs hollow diamond), not colour — a first attempt using two neutral hues failed CVD separation at ΔE 2.1, so hue was removed from that job entirely.

## J. Typography

System stack (SF on iOS). Hierarchy from size, space, contrast and position — not weight alone.

| Role | Size / weight |
|---|---|
| Page title | 26 / 640 |
| Major metric | 34 / 660, tabular |
| Exercise name | 27 / 650 |
| Section title | 13 / 600 |
| Primary action | 16 / 580 |
| Body | 15 / 420 |
| Meta | 12.5 / 500 |
| Eyebrow | 11 / 600, uppercase (rare) |

Tabular numerals on every value that can change, so digits never jitter.

## K. Spacing

4-based: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56. Page gutter 20px, **16px at ≤359px**. Sections are separated by padding and one hairline — not by boxes.

## L. Surface / depth

Four tiers: canvas → zone (tonal, no border) → surface (protagonist) → sheet. Depth comes from tonal separation, a 1px inner top highlight and a soft shadow. **Radii are deliberately differentiated** — surface 20, control 12, input 10 — so the screen cannot read as one grid of identical cards. Blur is used only on the nav and sheet scrim.

## M. Component system

Layout: Page · Header · Section · Divider · BottomNav. Action: PrimaryAction · TextAction · IconAction. Selection: Segment · Toggle. Data: **DataRow** (the workhorse that replaces most cards) · Metric · Status · ChartFrame. Form: Stepper · NumericField. Overlay: Sheet · Toast. Train: SessionProgress · ExerciseHeader · AimStrip · SetEditor · SetHistoryRow · RestStrip · QueueRow.

**Card is not a primitive.** Before any filled/bordered control: *does this action need a box?* Primary actions get one; secondary actions are text + chevron; icon actions are bare glyphs with a 44pt hit area.

## N. Navigation

Five tabs. Active tab is the one persistent violet in the product. **Nav hides entirely in active workout mode.** Transitions are a 6px rise + fade (280ms) — position-preserving, never a hard replace and never theatrical.

---

## O. Today — command surface

Order: context → **decision (the one surface)** → today's action → current-state evidence → week → quick actions.

- Adapts by day type, not by label-swapping: on Rest there is **no lifting CTA, no stale lifting data, no gym selector**, and the weight row becomes a prompt when the day has no reading.
- **"Add optional lifting" states that the day stays a rest day** — the add-on semantics made visible.
- Evidence is three data rows (Weight / Performance / Cardio) — conclusions only. **No chart on Today.**
- No sync banner in normal operation.
- Performance uses the engine's own vocabulary: Holding / Improving / Review / Building. Never "muscle preserved".

## P. Train — active workout mode

Entering a workout hides global nav and recomposes the screen around the current set. **The whole logging loop fits one screen: 900px at 390px wide, versus ~2,200px today.**

Top bar (leave / session identity + set count / finish) → per-exercise session bar → exercise name with anatomy → **aim strip (Last · Target · Rest)** → logged-set history → weight stepper → reps stepper → set type → RIR → Log set → prev/queue/next.

Logging: tap → haptic → row settles with a 900ms violet decay to calm → session bar advances → rest timer appears → auto-advance when planned sets complete. No confetti, no score, no full-screen success.

Completion recap reports **only real outcomes** — working sets, and progressed/maintained/below computed by comparing each exercise against its own previous session — plus performance status and the next planned day.

## Q. Progress — Weight (flagship)

**Two representations, deliberately separate. This is the fix.**

**1. Recent trajectory** — "Which way am I going now?"

| Contract | Answer |
|---|---|
| Primary | Smoothed trend (violet line) |
| Context | Raw morning readings (small slate dots) |
| Hidden by default | Post-workout, projection, goal |
| Domain | **Visible morning readings + trend only. Goal and forecast never touch it.** |
| Inspect | Drag anywhere → nearest observation; arrow keys for keyboard |
| 320px | Fewer x-labels; same touch behaviour; no shrunken type |
| Range change | Each range takes its own honest domain — 12W → 80–88, 4W → 81–85 |
| Without colour | Line vs dot vs hollow diamond vs dashed |
| Conclusion | Stated above the chart in words, plus a text summary below |

**2. Cut journey** — "How far through the cut am I?" A horizontal rail (start → now → target band), reading left-to-right to match its own labels. Not a time series. **This is the only place the distant goal appears**, which is precisely what lets the chart above stay tight.

The metric header sits **outside** the plot and updates on scrub without moving. Projection is dashed, off by default, and labelled *"Model estimate, not a measurement."*

## R. Progress — Performance *(specified)*

Question: *Am I maintaining performance during the cut?* A list of lifts with e1RM status using engine vocabulary, ordered by attention needed. **Chart a lift only when its trajectory matters** — otherwise a row with status and last exposure. No KPI grid. Never claims muscle preservation.

## S. Body Intelligence *(specified)*

A page, not a scanner. Current snapshot (weight, body-fat estimate, fat mass, lean mass, waist) with **MEASURED and ESTIMATED visually distinct**; per-metric trends on separate scales (never one multi-scale chart); scan history; direct earlier↔current comparison — no radar charts. No Body Score.

## T. OCR / body scan *(specified)*

`Add body scan → capture/import → crop → quality check → OCR → schema-aware extraction → REVIEW → correct → save`. **Never saves silently.** Every field shows a confidence state; low-confidence fields are visually obvious and tap-to-correct. The parser targets the known scan schema rather than behaving as generic document OCR.

## U. History — audit trail

Calendar native to the page (**not wrapped in a card**). Marks distinguish workout / cardio / weight by **shape as well as colour**. Selecting a date updates the detail region only — the page does not re-render. Day detail states the canonical/contextual weight distinction in words. Designed for three record kinds: **Event** (something happened), **Intervention** (the user deliberately changed the system — with what/why/date/review horizon), **Annotation** (context).

## V. Settings

Calm configuration: PLAN / PREFERENCES / BODY / DATA / ABOUT as typographic rows with chevrons — no cards. **Sync state disappears from normal use** and surfaces only on a real problem.

## W. Forms / sheets

One sheet language: rounded top, grip, title, close, scrollable body, keyboard-safe, safe-area padded, Escape + focus restore, destructive actions separated. Steppers keep the numeric keyboard optional — load and reps are reachable without typing.

## X. AI experience

Pipeline: `raw logs → deterministic calculations → State Engine → snapshot → AI`. **The engine is truth; AI explains, retrieves, compares, plans, proposes, parses.** Surfaces: `Why this call ›`, `Ask NXTFRM`, weekly review, proposal sheets. No tab, no chat bubbles, no per-set commentary.

Mutation rule: a proposal states **what / why / evidence / effect** and requires explicit approval; approved changes become auditable interventions visible in History. Secrets stay server-side in Supabase Edge Functions; the provider stays replaceable; snapshots are compact; numeric history stays relational (embeddings only for notes, annotations, summaries, preferences).

## Y. Motion

Touch 120ms · state 200ms · spatial 280ms, all on `cubic-bezier(.32,.72,0,1)`. Page change is a 6px rise + fade. Metric updates **crossfade in place** — no odometers or rolling digits. A logged set decays from violet to calm over 900ms and does not keep glowing. **Every pattern has a reduced-motion path** (near-instant, no positional movement); the settle animation is removed entirely.

## Z. Visual effects

One page-level radial light plus a faint grain that exists to kill banding. Focal atmosphere appears **only behind the decision surface**. Glow is rare by construction: active tab, current set, focused input, selected point, selected date. No purple fog, no glass panels, no heavy shadows, no neon chart traces.

## AA. Accessibility

- **Every interactive target ≥44pt** — audited computationally; the first pass failed (33px text actions, 36px segments, several used mid-set) and was fixed.
- **All text passes WCAG AA** — audited computationally; the first ink ramp failed and was re-stepped.
- No colour-only meaning anywhere: status carries word + shape, chart series carry mark shape, calendar marks carry shape.
- Chart is keyboard-operable (arrows/Escape), has an `aria-label` and a textual summary.
- Visible focus rings, labelled icon controls, persistent form labels, logical reading order.

## AB. Responsive

Verified at **390 / 375 / 320** with **zero horizontal overflow on every screen**. 320 is a real design state: gutter 16px, gutter-aware type steps, and the Train aim strip **wraps to two rows rather than crushing its numbers**. Safe areas respected top and bottom; nav is safe-area padded.

---

## AC. What survives

The entire engine — trend/EWMA, plateau detection with confidence intervals, forecast, strength e1RM and status vocabulary, session plans, add-on separation, Gym A/B, double progression, warm-up/working, RIR, rest timer, substitutions, undo, backup/restore, `timeOfDay` semantics, the five destinations, and the calendar-first History concept.

## AD. What should be removed / replaced

| Remove | Why |
|---|---|
| `readiness()` 35–96 score | Invented metric; already unused by the new Today |
| Goal band / forecast / target in the recent chart's domain | Destroys recent readability — measured 4 kg → 10 kg |
| Uniform 22px radius + purple→sky gradient on every control | Produces the template look |
| Persistent global nav during active workouts | Overlaps the logging controls |
| Cloud/sync banner in normal operation | Occupies the most valuable pixels |
| Equal-weight card stack on Today | Nothing reads as the protagonist |
| Legacy `renderHome/renderTrain/renderWeight` in `index.html` | Superseded by `premium-ui.js`; dead weight and a divergence risk |

## AE. Implementation risks

1. **`index.html` is 305KB with ~4,500 lines of inline script** and a legacy renderer set that partly duplicates `premium-ui.js`. Sequence the port so exactly one renderer owns each screen.
2. **`template()` vs `templateFor()` are different stores** (session plan vs programme template). Confusing them silently corrupts sessions.
3. **The render lock** (`index.html:2919`) suppresses repaints while an input is focused. The set-logging motion must not fight it.
4. **Chart domain change is a behaviour change, not styling** — it needs its own review and a check that plateau/forecast text still reads correctly when the goal is off-chart.
5. **Post-workout readings are already excluded from trend maths** but pulled into the domain (`:763`). Removing them from the domain is safe; removing them from the *series* is not.
6. **Known open issue:** on a skipped-morning day the canonical reading can fall back to a dehydrated post-workout value (`index.html:6881`). VNext makes the distinction visible in History but does **not** change the selection rule — that remains a deferred product decision.

## AF. Directions considered

| | Core idea | Strength | Weakness | Risk |
|---|---|---|---|---|
| **A. Refined Surfaces** | Keep cards; make them hierarchical | Lowest risk; incremental | Keeps the failure mode in reach; would read as "V102 with nicer spacing" | Low |
| **B. Instrument** *(chosen)* | Content on canvas; a surface only marks the protagonist | Structurally prevents card soup; makes hierarchy unavoidable; premium and calm | Demands real editorial discipline about what earns a surface | Medium |
| **C. Full-bleed Modal OS** | Every task a focused full-screen mode | Superb for Train | Wrong for Progress/History; heavy navigation; over-animated | High |

## AG. Recommendation

**Direction B, INSTRUMENT** — with C's focus mode adopted *only* for the active workout, where it is genuinely correct. The decisive argument: A leaves the diagnosis unfixed (the disease is equal-weight surfaces, so a rule that rations surfaces is the cure), and C would make evidence screens worse. B is the only option whose core rule directly repairs the audited failure.

## AH. Prototype

**Path:** `design-vnext/index.html` — open directly, or `python3 -m http.server` from the repo root and visit `/design-vnext/`.
On desktop it renders in a phone frame with width toggles (390 / 375 / 320) and screen shortcuts. On a phone it runs full-bleed as the real thing.

**Screens built to depth:** Today (lifting) · Today (rest) · Train (active workout) · Progress → Weight · History (selected date). Plus: session-complete recap, exercise details, workout queue, "Why this call", session picker, weigh-in list, Settings skeleton.

**Interactions implemented:** tab transition · workout-mode entry/exit (nav hide) · stepper increment · **Log Set** with settle animation, haptic, auto-advance · live rest timer with +30s/skip · queue sheet with jump · chart range switch with re-domaining · **chart scrub** (pointer drag + keyboard) with stable header · post-workout and projection toggles · history date change with partial update · sheet open/close with Escape and focus restore · reduced-motion paths.

**Data honesty:** the weight series, EWMA trend, plateau verdict and confidence interval, forecast, review and strength status are **verbatim output of the live `cut-support.js` engine**. Training history was generated from the real `TEMPLATES` and the real double-progression rule, then fed back through the engine so every derived value is engine-truth. Three post-workout readings were added to exercise the contextual series. No invented scores, readiness metrics or health claims.

---

## Unresolved product questions

1. **Canonical weight on skipped-morning days** — post-workout can currently become the trend point. Deferred by prior decision; VNext exposes it but does not change it.
2. **Should the 6M / 1Y ranges exist before there is history?** The prototype disables them with a reason; alternative is to hide them.
3. **Does Performance deserve charts at all**, or only status rows with drill-down?
4. **Where do interventions get created** — Settings, History, or only from an approved AI proposal?
5. **Does Body get a tab in Progress before real scan cadence exists**, or stay under Settings until then?

## Owner approvals required

1. **Adopt INSTRUMENT** as the VNext direction.
2. **Approve the chart-domain change** — excluding goal/forecast from the recent chart is a behaviour change.
3. **Approve deleting `readiness()`** and the legacy `index.html` renderers.
4. **Confirm status vocabulary** — Holding / Improving / Review / Building / None.
5. **Confirm no green** anywhere in the identity.
6. Decide the five open questions above.
