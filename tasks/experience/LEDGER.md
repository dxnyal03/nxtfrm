# Experience upgrade — progress ledger

Integration branch `experience-upgrade` (worktree `~/Developer/Worktrees/nxtfrm/experience-upgrade`). Today stream on
`experience-today` (worktree `…/experience-today`), merged into `experience-upgrade` at integration. No push, merge to
main or deploy. RELEASE 163. Phone first (320–430 px); desktop layouts withdrawn 2026-10-20.

| Task | Owner / model | Status | Commit / files | Checks | Next action |
|---|---|---|---|---|---|
| Stage 1 baseline | coordinator + probes | done | cache `experience/baseline/`, PLAN.md F1–F8 | 307 shots, 7 viewports | — |
| Stage 2 forecast time (D104) | builder / Opus 5.5 | done | `e48faab` | 24 suites green | — |
| Stage 2 day state (D105) | builder / Opus 5.5 | done | `363ee05` | 25 suites green | — |
| Stage 2 names + sources (D106–D107) | builder / Opus 5.5 | done | `5e7a63d` | 26 suites green | — |
| Stage 2 verification fixes (D108) | fixer / Opus 5.5 | done | `8ae6eee` | 26 suites, 679 tests | — |
| Docs: plan, contracts, specs, study, preview config | coordinator | done | `4a3096c`, `54c60ba`, `f6a6f3f` | — | keep CONTRACTS.md in step with any approved Stage 7 change |
| Demo fixtures `?scenario=` ×6 + badge | builder / Fable 5.1 | done | `ad0756f` seed.scenarios.js | 27 suites green; 6 scenarios verified | use in the checkpoint |
| Weight w1 engine (D109–D117) | builder / Opus 5.5 | done | `85cf367` | 27 suites | — |
| Weight w2 plate + plot (D118–D119) | builder / Fable 5.1 | done | `682edc4` | 27 suites, 709 tests; §19 1–6, 8–10, 12–14 pass | — |
| Weight w3 inspector + Layers (D130–D133) | builder / Fable 5.1 | done | `e59b765` | 27 suites, 717 tests; §19 15–19, 25–26 pass | — |
| Weight w4 Expand, Compare, Journey/Rate copy | builder / Fable 5.1 (running, resumed 14:41) | in progress | — | — | on landing: w5 phone polish (Sonnet) |
| Weight w5 phone polish (remove wide-width paths, motion, Larger text) | nxtfrm-weight-builder / Sonnet | queued | — | — | after w4 |
| Today t1 picker + focus card (D120–D127) | builder / Fable 5.1 | done | `fa4aa01` | 27 suites, 691 tests | — |
| Today t2 log strip, lead, digest (D128–D129) | builder / Fable 5.1 | done | `076ae8d` | 27 suites, 691 tests; §16 partial | — |
| Today t3 dock hand-off, CSS sweep, fit | builder / Fable 5.1 (running, resumed 14:41) | in progress | uncommitted: strata.css, strata.js, verify-151/152 | — | on landing: merge into experience-upgrade |
| Integration (merge experience-today) | coordinator | queued | — | full gate + check runner | then checkpoint render |
| Checkpoint: fixtures, phone shots, preview 8766, simulator | coordinator + nxtfrm-check-runner / Haiku | queued | — | — | then one Sonnet review |
| Cross-review | nxtfrm-reviewer / Sonnet high | queued | — | — | builders fix, re-review changed areas |
| Stage 7 proposals (EWMA, rate range, arrival) | owner decision; nxtfrm-analysis-specialist / Opus only for a bounded question | pending owner | ANALYTICS-STUDY.md, cache patches | reviewed by skeptics | ask the owner; implement with Sonnet |
| Stage 6 remaining pages | builders / Sonnet | queued | — | — | after the checkpoint is reviewable |
