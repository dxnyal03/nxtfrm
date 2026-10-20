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
| Weight w4 Expand, Compare, Journey/Rate copy (D134–D139) | builder / Fable 5.1 | done | `1dce7d8` | 27 suites; §19 20–24, 26 pass | — |
| Weight w5 phone polish (D144–D146) | builder / Sonnet 5.5 medium | done | `46f3878` | 28 suites, 0 FAIL; 0 overflow at 320–1280; reduced motion/transparency 0 offenders | — |
| Today t1 picker + focus card (D120–D127) | builder / Fable 5.1 | done | `fa4aa01` | 27 suites, 691 tests | — |
| Today t2 log strip, lead, digest (D128–D129) | builder / Fable 5.1 | done | `076ae8d` | 27 suites, 691 tests; §16 partial | — |
| Today t3 dock hand-off, CSS sweep, fit (D140–D143) | builder / Fable 5.1 | done | `7b49339` strata.css, strata.js, verify-151/152 | 27 suites green; §16 pass except page height 1338 vs 1300 and strip bottom +1.7 px | check run (Haiku) at 7b49339; merge into experience-upgrade after w4 lands |
| Integration (merge experience-today) | coordinator / Fable 5.1 | done | merge commit (see git log) | 28 suites, 737 tests, 0 failed; smoke render 0 errors | w5 on the merged tree, then checkpoint |
| Checkpoint: fixtures, phone shots, preview 8766, simulator | coordinator | in progress | fixtures `ad0756f`…`961defc`; capture → cache `experience/checkpoint/` | capture running; simulator notes `checkpoint/webkit-notes.md` | report after the review |
| Cross-review | reviewer / Sonnet 5.5 high (running) | in progress | HEAD 46f3878 | — | builders fix, re-review changed areas |
| Stage 7 proposals (EWMA, rate range, arrival) | owner decision; nxtfrm-analysis-specialist / Opus only for a bounded question | pending owner | ANALYTICS-STUDY.md, cache patches | reviewed by skeptics | ask the owner; implement with Sonnet |
| Today: Latest Evo scan tile restored (D147, owner request) | builder / Sonnet 5.5 medium | done | `040d9c4` | 28 suites 0 FAIL; 390/375/320 checked | pill colours vs D42 (less fat = mint) to confirm in the fix round |
| Weight plate declutter (D148, owner feedback) | builder / Sonnet 5.5 medium (running) | in progress | — | — | before/after to the owner |
| Stage 6 remaining pages | builders / Sonnet | queued | — | — | after the checkpoint is reviewable |
