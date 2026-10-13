# NXTFRM Ascension — program plan

Baseline `029eb51` (origin/main, release 161). Branch `ascension`. Production (`thecutdanyal.netlify.app`, built from `main`) is not touched; the trial is a Netlify deploy preview from a PR that stays unmerged.

Binding: `AGENTS.md`, `tasks/vnext/DECISIONS.md` D2–D59 (Strata look, Dusk palette, no invented scores, morning weight canonical, features switched off by D49/D55 stay off), the four `.claude/skills/nxtfrm-*` skills.

## Baseline audit (2026-10-13)

- 18 deterministic suites, 490 tests, 0 failures. Zero page errors and zero horizontal overflow at 320/390 on every tab.
- Visual quality is already high (D41–D59). The leap has to come from intelligence, adaptivity, reliability, engineering and the remaining product gaps, not a restyle.
- Confirmed data-loss path: Safe Sync's top-level settings merge is local-wins while boot always fills a default weekly plan locally, so a fresh or wiped device that loads from the cloud reverts the customised split and writes the reverted plan back (`cut-support.js` ~1990, `index.html` ~2717). This is the reported split bug.
- ~350 KB of wearable JS (13 scripts) is parsed on every launch for a feature switched off by D55; Tesseract OCR is fetched from a CDN on every launch although scans are rare.
- Coaching is five separate surfaces with no shared context, no memory of dismissed advice, no weekly review beyond the decision card, and no notion of a missed, excused or moved session.

## Priority matrix (value × frequency × severity, feasibility, risk)

| # | Item | Value | Risk | Workstream |
|---|---|---|---|---|
| 1 | Split persistence root cause + conflict strategy + tests | Critical | Medium (sync semantics) | F Reliability (Opus) |
| 2 | Coaching Intelligence 2.0: shared context, insight coordinator, dismissal memory, explainability | Very high | Medium | C Coaching (Opus engine → Sonnet UI) |
| 3 | Day context: done / missed / excused / moved, catch-up proposal with consequences and confirmation | Very high | Medium | C |
| 4 | Week in review (deterministic, last completed Mon–Sun week) | High | Low | C |
| 5 | Calendar shows plan, missed and excused days | High | Low | C UI |
| 6 | Exercise history chart in Exercise Details (per-session best set, e1RM dashed, scrub) | High | Low | B Charts (Sonnet) |
| 7 | Startup: dark first frame before CSS, opaque hold until ready, single clean reveal, no veil | Medium | Low | E Launch (Sonnet) |
| 8 | Performance: lazy OCR, lazy wearable modules if provably safe | Medium | Medium | G Perf (Sonnet) |
| 9 | Design-system consolidation: canonical tokens, alias legacy tokens, remove proven-dead CSS, pixel-diff guarded | Medium | Medium | A Design (Sonnet) |
| 10 | iPhone: pinch-zoom re-enabled if every live input is ≥16px; target/contrast sweep | Medium | Low | A |

Deferred (not in this release): IndexedDB durability; retiring the 109-era verify scripts; classic app folder; anything behind D49/D55 flags.

## File ownership (parallel phase)

| Agent | Owns | Must not touch |
|---|---|---|
| F Opus reliability | `cut-support.js` merge block + plan/routine stamping, `index.html` boot defaults, `wearables.plan-persistence.test.js` | strata.*, premium-ui.css, sw.js |
| C Opus coaching engine | new `coach.js`, `wearables.coach.test.js`, `sw.js` + `index.html` script tag for `coach.js` | premium-ui.js, strata.css |
| A Sonnet design system | `index.html` inline `<style>`, `premium-ui.css`, `vnext.css`, `cut-support.css`, token block at top of `strata.css` | premium-ui.js, cut-support.js, coach.js |
| B Sonnet charts | `premium-ui.js` `exerciseDetails()` + Performance rows, append-only block at end of `strata.css` | everything else |
| E Sonnet launch | `index.html` head + splash script region only | app script, CSS layers |
| C-UI Sonnet (after engine lands) | `premium-ui.js` Today/History/sheets, append-only block in `strata.css` | engine files |

Verification per slice: `node --check`, balanced braces, full `wearables*.test.js` run, Playwright sweep (`~/Library/Caches/DanDev/nxtfrm/ascension/shots.mjs`, `flows.mjs`) at 320/375/390/430/768/1280 with zero page errors and zero overflow, reduced-motion pass, pixel diff for presentation-only slices.
