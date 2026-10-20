# Checkpoint · Today + Progress › Weight · 2026-10-20

Branch `experience-upgrade`, HEAD `ca747ea` (+ ledger), 42 commits on `4a3096c` (which sits on PR #39's `b7d8d71`).
Preview: `.claude/launch.json` → `nxtfrm-experience` (http://localhost:8766). Fixtures (localhost only, labelled strip):
`/?reseed=1&scenario=today-unstarted | today-active | today-finished | today-rest | weight-sparse | weight-stale`;
`/?reseed=1` = populated. Not pushed, not merged to main, not deployed. RELEASE 163.

## Completed and committed
- Stage 2: forecast dates anchored with freshness (D104), one day state (D105), names/sources (D106–D108).
- Weight "Instrument" w1–w5 (D109–D146): plate, plot, inspector, Layers, Expand, Compare, Journey summary,
  Rate/Projection copy, Simulation, phone polish; declutter (D148); review fixes; Layers regression fix.
- Today "Task-first" t1–t3 (D120–D143): focus card, log strip (two cards, D149), lead, digest, dock hand-off,
  review fixes; Evo scan tile restored (D147).
- One sheet system (D151) and Log/Edit cardio fields (D150). "Focusing on form" (D152).
- Fixtures, contracts, specs, study summary, ledger, review findings in `tasks/experience/`.

## Tested
- Gate at `ca747ea`: 29 suites (Haiku run, see `checks/integrated-ca747ea.txt`); earlier at `2f3f148`: 28 suites,
  759 tests, 0 failed; release-gate slice clean; RELEASE 163; no new storage keys (D152's `form` flag is the one
  record-field addition, pending the owner's yes).
- Chrome, five phone widths (320/375/390/393/430), fixed clock, seven fixtures: 70 captures, 0 app errors
  (`checkpoint/capture.json`, contact sheets `final-*.png`).
- Cross-review of 61c617f (`REVIEW-2026-10-20.md`): contracts, interactions, fit, OS reduced motion passed; 1
  blocker + 4 major fixed in `b27f334`/`2f3f148`; minors fixed except m6 (eyebrow/inactive-tab contrast, pre-existing),
  m8 (fixture strip, fixture-only), m9 (wide, withdrawn).

## Visually inspected (iPhone 18 Pro simulator, iOS 27, Safari)
Today unstarted / active / finished / rest; Weight populated / stale; Expand → Compare → Layers; the restored scan
tile; the two log cards; Log cardio sheet; the fixed masthead title. Shots in `checkpoint/simulator/`.

## Remaining issues
- In Safari's shorter viewport (status bar + Safari chrome + local-only banner + fixture strip) the Weight plot can
  sit under the live-row dock; the installed PWA has none of that chrome — re-measure in standalone at Stage 8.
- Layers drawer open at 375/320 still pushes the plot under the dock (closed state was already below there).
- Today page height 1338 px at 390 vs the 1300 budget; "More for today" fold remains.
- Rate-chart tick labels at the very edge; eyebrow and inactive tab contrast 2.8–4.1:1 (pre-existing tokens).
- Stage 7 proposals (EWMA, rate range, arrival range) await the owner (`ANALYTICS-STUDY.md`).
- D152 `form` flag awaits the owner's approval.

## Status
Ready for design review on the phone. Next: Stage 6 remaining pages (Train, Training, Performance, Body, History,
Settings) with the same components, then Stage 8 QA incl. standalone-PWA measurement.
