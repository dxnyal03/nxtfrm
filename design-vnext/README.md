# design-vnext — NXTFRM VNext prototype (Phase 1)

Isolated, disposable design workspace. **Nothing here is production code and no production file was modified.**

## Preview

```bash
# from the repo root
python3 -m http.server 8777
# then open http://localhost:8777/design-vnext/
```

Opening `index.html` directly from disk also works.

- **Desktop** → renders inside a phone frame with a control bar: width toggles (390 / 375 / 320) and screen shortcuts.
- **Phone** → runs full-bleed as the real thing. The control bar is hidden below 760px.

## Files

| File | What it is |
|---|---|
| `DESIGN-BRIEF.md` | The Phase 1 deliverable — audit, research, system, screens, risks, approvals |
| `index.html` | Prototype shell + desktop harness |
| `vnext.css` | The design system |
| `vnext.js` | Screens, chart engine, interactions |
| `data.js` | Fixture — see below |

## Screens

`Today · lift` — `Today · rest` — `Train` (active workout) — `Weight` — `History`

Reachable on desktop via the control bar; on a phone via the bottom nav (Train opens the idle state, then **Start workout** enters active mode).

## Interactions worth trying

- **Log Set** — settle animation, auto-advance, live rest timer (+30s / Skip)
- **Chart scrub** — drag anywhere across the plot; the header updates without moving. Arrow keys work too; Escape clears.
- **Range switch** — each range takes its own y-domain (12W → 80–88, 4W → 81–85)
- **Post-workout / Projection** toggles — both off by default
- **Queue sheet** — jump between exercises
- **History** — select a date; only the detail region updates

## Data

`data.js` is a fixture, and it is honest about what it is:

- Weight series, EWMA trend, plateau verdict + confidence interval, forecast, review copy and strength status are **verbatim output of the live `cut-support.js` engine**.
- Training history was generated from the real `TEMPLATES` and the real double-progression rule, then fed back through the engine so every derived value is engine-truth.
- Three `Post-workout` readings were added to exercise the contextual series.
- Exercise metadata (primary/secondary muscles, equipment) is copied verbatim from `train-anatomy.js`.

No invented scores, readiness metrics, durations or health claims.

## Verification run on this prototype

- **Contrast** — computed audit over all screens: all text passes WCAG AA. (First pass failed; the ink ramp was re-stepped.)
- **Touch targets** — computed audit: every interactive target ≥44pt. (First pass failed at 33/36px; fixed.)
- **Responsive** — 390 / 375 / 320 with zero horizontal overflow on every screen.
- **Chart palette** — validated with the `dataviz` skill's validator, not by eye. The status trio passes all checks; an earlier two-neutral chart palette failed CVD separation (ΔE 2.1) and hue was removed from that job.

## Scope

Built to depth: the five stress-test screens plus the sheets they need.
Specified but not built: Performance, Body Intelligence, OCR review, full Settings, AI proposal sheet. See `DESIGN-BRIEF.md` sections R–X.
