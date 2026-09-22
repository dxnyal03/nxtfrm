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
| D12 | **The shared VNext primary-button contrast defect is a cross-screen design-system defect, fixed in a narrow follow-up patch immediately after 2E — not inside any feature slice.** Measured: white on the violet gradient is **3.80:1**, failing I4 for normal-size text. Present on Today (`.vn-act`), Train and Settings (`.vn-set-act`). The patch must preserve the violet primary identity, keep white text if practical, adjust the **shared gradient/token rather than individual screens**, reach **≥4.5:1**, verify default/hover/pressed/disabled, and re-check every surface consuming the token. **Raising font size purely to qualify as large text is not an acceptable fix.** No unrelated visual redesign. | Approved, scheduled | 2026-09-22 |
| D13 | **`backfillAllCoachInsights()` is pre-existing dead code, not a 2E defect**, and is not removed inside 2E. It became unreachable when V99's `coachHTML()` replaced the apx96 `coach` branch; a pre-2E baseline capture confirms it was already absent from every reachable Settings view. Removal belongs to a cleanup/integration slice and requires first verifying: no direct references, no indirect or string-based references, no migration/backfill path depending on it, and no documented manual invocation. | Approved, deferred | 2026-09-22 |
| D14 | **Only a Morning weigh-in is eligible for the canonical body-weight trend.** Post-workout and EvoScan weights are contextual measurements and must never enter EWMA, plateau, forecast, cut-progress or confidence maths. **When a date has no morning weigh-in, the canonical trend point is absent — there is no fallback.** Measured before the change: a Post-workout 99.1 kg and an EvoScan 99.9 kg each became the canonical row for a skipped-morning date. The actual weights stay fully preserved in the EvoScan record, scan detail, scan history, scan-to-scan comparison and body-composition analysis. **This resolves deferred question Q1** for both timings. Note: the dev seed is 100% Morning, so this is a no-op on seed data and must be proven with injected non-morning fixtures. | Approved | 2026-09-22 |
| D15 | **EvoScan is a separate measurement context**, answering "what did the scan measure at this moment?", never "what is today's canonical body weight?". The distinction stays visible in the data model. Room is preserved for future contexts (`MORNING_FASTED`, `POST_WORKOUT`, `EVOSCAN`, `OTHER`) without over-engineering. EvoScan carries its **own scan-to-scan trend series**, kept distinct from the Morning body-weight trend. | Approved | 2026-09-22 |

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
| ~~Q1~~ | ~~Canonical weight on skipped-morning days~~ — **RESOLVED by D14** | Post-workout can currently become the trend point (`index.html:6881`). Deferred by prior owner decision. VNext may surface the distinction; it must not change the selection rule. |
| Q2 | **Decision verdict vocabulary** ("Hold the plan" / "Nothing needs changing") | The `design-vnext` prototype states a *decision*; production `N.review()` states an *observation*. Changing this is a decision-layer change, not presentation. **Out of scope until a State Engine slice.** |
| Q3 | Chart ranges with insufficient history | Disable-with-reason vs hide. |
| Q4 | Whether Performance charts lifts at all, or only status rows with drill-down | |
| Q5 | Where interventions are created | Settings, History, or only from an approved AI proposal. |
| Q6 | Whether Body gets a Progress tab before real scan cadence exists | |
