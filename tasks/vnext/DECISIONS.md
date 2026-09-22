# NXTFRM VNext — Durable Decisions

Owner-approved decisions only. Append; do not rewrite history. No transient implementation detail here.

| # | Decision | Status | Date |
|---|---|---|---|
| D1 | **VNext direction is INSTRUMENT.** A surface is a claim of primacy: one protagonist surface per screen, plus transient sheets. Everything else sits on the canvas, organised by type, space and hairlines. | Approved | 2026-09-22 |
| D2 | **The recent weight chart excludes the distant goal from its Y-domain.** Goal band, forecast cone and target reference must not stretch the recent-trajectory scale. | Approved | 2026-09-22 |
| D3 | **The long-term target belongs in a separate Journey treatment**, not on the recent-trajectory chart. | Approved | 2026-09-22 |
| D4 | **`readiness()` is approved for removal ONLY after a reference audit proves it safe.** Removal is a separate, audited slice. Until then it stays. | Approved, gated | 2026-09-22 |
| D5 | **Legacy renderer removal must be separately audited.** No legacy `renderHome/renderTrain/renderWeight/renderHistory/renderMore` deletion inside a feature slice. | Approved, gated | 2026-09-22 |
| D6 | **Active workout may hide or recede global navigation.** | Approved | 2026-09-22 |
| D7 | **Morning weight remains canonical.** | Approved | 2026-09-22 |
| D8 | **Post-workout weight remains contextual** — never enters trend, plateau, forecast or confidence maths. | Approved | 2026-09-22 |
| D9 | **No fake readiness, body, recovery or performance scores.** No invented composite metric of any kind. | Approved | 2026-09-22 |
| D10 | **`design-vnext/` is the visual and UX source of truth.** The current production app is the functional source of truth. Where they conflict on *behaviour*, production wins and the conflict is escalated. | Approved | 2026-09-22 |
| D11 | **The cloud/local banner must not appear during healthy normal operation.** It appears only on a genuine, actionable data-safety condition: sync failure, unsafe local-only state, unsynced data at meaningful risk, or another condition requiring user action. **Legitimate warnings must not be blanket-hidden** — this is a targeting change, not a suppression. | Approved | 2026-09-22 |

## Design-system invariants (flow from D1; binding on implementation)

| # | Invariant |
|---|---|
| I1 | **Violet is signal, never wallpaper.** Permitted: active tab, current set, selected chart point, selected date, focused input, the single focal decision surface. Not permitted: every card, every button, full-screen washes, neon outlines. |
| I2 | **Status is a word first, colour second**, and carries a distinct dot shape. Validated trio: `#8B5CF6` / `#B8842A` / `#DC5A76`. Deutan ΔE is 7.8, which is legal *only* with that secondary encoding. |
| I3 | **No green anywhere in the identity.** (The codebase had already aliased `--green` to purple.) |
| I4 | **All text meets WCAG AA (4.5:1)** against its actual background. Verified computationally, not by eye. |
| I5 | **Every interactive target is ≥44pt effective.** Verified computationally. |
| I6 | **No colour-only meaning** in status, chart series or calendar marks. |
| I7 | **Radii are differentiated** (surface 20 / control 12 / input 10) so no screen reads as one grid of identical cards. |
| I8 | **Motion tiers:** touch 120ms, state 200ms, spatial 280ms, easing `cubic-bezier(.32,.72,0,1)`. Every pattern has a reduced-motion path. No odometers or rolling digits; metric updates crossfade in place. |
| I9 | **Today shows conclusions; Progress shows evidence.** No chart on Today. |
| I10 | **Sync/cloud state is absent from normal operation** and surfaces only on a real problem. |
| I11 | **Projection must never look like measurement** — dashed, off by default, explicitly labelled as an estimate. |
| I12 | **Performance language is engine vocabulary only**: Holding / Improving / Review / Building / Older history. Never "muscle preserved". |

## Deferred — require a decision before any slice may implement them

| # | Item | Note |
|---|---|---|
| Q1 | Canonical weight on skipped-morning days | Post-workout can currently become the trend point (`index.html:6881`). Deferred by prior owner decision. VNext may surface the distinction; it must not change the selection rule. |
| Q2 | **Decision verdict vocabulary** ("Hold the plan" / "Nothing needs changing") | The `design-vnext` prototype states a *decision*; production `N.review()` states an *observation*. Changing this is a decision-layer change, not presentation. **Out of scope until a State Engine slice.** |
| Q3 | Chart ranges with insufficient history | Disable-with-reason vs hide. |
| Q4 | Whether Performance charts lifts at all, or only status rows with drill-down | |
| Q5 | Where interventions are created | Settings, History, or only from an approved AI proposal. |
| Q6 | Whether Body gets a Progress tab before real scan cadence exists | |
