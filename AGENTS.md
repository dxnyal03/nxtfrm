# NXTFRM — agent rules

Applies to every agent working in this repository (Cursor, Claude Code, any other). Read this before editing anything.

## 1. Project skills are binding — read them

These four files are the product's rules, not background reading. Load the ones relevant to what you are touching **before** you write code:

| Skill | Read it when you touch |
|---|---|
| `.claude/skills/nxtfrm-product-design/SKILL.md` | any screen, navigation, colour, type, motion, iPhone/PWA layout |
| `.claude/skills/nxtfrm-fitness-ux/SKILL.md` | splits, sessions, set logging, substitutions, weight, cardio, scans, phases, coaching copy |
| `.claude/skills/nxtfrm-data-viz/SKILL.md` | any chart, trend, forecast, scrubbing, chart accessibility |
| `.claude/skills/nxtfrm-ai-systems/SKILL.md` | coaching, summaries, OCR parsing, proposals, model calls, embeddings |

Generic UI/accessibility/token skills still apply, but **where a generic skill conflicts with an NXTFRM skill or with `tasks/vnext/DECISIONS.md`, NXTFRM wins.**

## 2. Durable decisions

`tasks/vnext/DECISIONS.md` holds owner-approved decisions (D1–D10) and design-system invariants (I1–I12). They are binding. Items marked deferred (Q1–Q6) must not be implemented without owner approval.

## 3. Sources of truth

- **Functional truth:** the current production app. Behaviour, calculations and stored meaning come from here.
- **Visual / UX truth:** `design-vnext/`. Preview it with `python3 -m http.server` → `/design-vnext/`.
- Where they conflict on *behaviour*, production wins — and say so in your report.

## 4. Architecture

Three layers, in load order:

| Layer | File | Role |
|---|---|---|
| Engine | `cut-support.js` (`NXT`) | Trend, plateau, forecast, strength, sessions, backup. **The truth.** |
| Presentation | `premium-ui.js` (`NXP`) | The UI on screen |
| Legacy | `index.html` inline | Older renderers, largely superseded |
| VNext | `vnext.css` | VNext foundation layer, loads last |

`premium-ui.js` ends with `renderHome=NXP.home; renderTrain=NXP.training; …`. That reassignment is the migration seam — swap one screen's renderer and touch nothing else.

## 5. Never, without explicit owner approval

- Change a calculation, a storage key, a record shape, or what a number means
- Touch Supabase schema, RLS or production data
- Delete the legacy renderers (D5) or `readiness()` (D4) — both are separately gated
- Weaken or delete a test to make it pass. Adapt a test only when the UI it asserts on legitimately changed, keep its original intent, and say so in your report
- `git reset --hard`, `git clean`, discard uncommitted work, force push, push, or deploy
- Touch unrelated untracked work: `design-v102/`, `design-v103/`, `.claude/`, the PNG at repo root
- Invent a metric, score or health claim (D9)

## 6. Division of verification labour

**Cursor does not run browser automation.** Two delegated runs completed their writes successfully but the CLI stayed alive afterwards, holding a lingering Playwright/MCP child. The summary that never flushed added nothing to review, so the browser work moved to where it was being redone anyway.

| Cursor owns | Claude owns |
|---|---|
| Production implementation | Browser verification |
| Repo-aware wiring | Responsive QA (390 / 375 / 320) |
| Syntax and static checks (`node --check`, brace balance) | Interaction QA |
| Deterministic test suites | Visual fidelity |
| Updating `CURSOR_REPORT.md` | Reduced-motion checks |
| | Comparison against `design-vnext/` |

Do not add Playwright, Puppeteer or an MCP browser to a delegated run unless a task genuinely cannot be implemented without it — and say so in the report if you do.

Run the deterministic suites and report their real output. That is the verification Cursor is responsible for.

**Run all sixteen.** Enumerate them with `wearables*.test.js` — note there is no dot after `wearables`. The glob `wearables.*.test.js` silently skips `wearables.test.js`, which is how a suite went unrun for five slices. The full run is 16 suites / 458 tests at INT-1:

```
for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done
```

## 6b. Delegation model

Delegated runs pin an explicit model rather than using Auto, so slice quality is reproducible and not a lottery:

```
agent -p "<task>" --model claude-opus-5-thinking-high-fast --output-format text -f --trust
```

Auto was in use for slices 2A–2D and INT-1. It selects per request, so two slices held to the same standard could be written by different models at different reasoning levels, which makes a regression impossible to attribute. Pinning removes that variable.

Chosen for the failure modes this project actually hits. The defects found in review were not hard coding problems — they were adherence and care problems: a label narrowed from *Conditioning* to *Cardio* while the block still held floorball rows; the anatomy strip demoted out of the exercise head against the approved design; a stylesheet linked at `?v=110` against a `RELEASE` of `109`. Those come from working off a partial view of a long constraint list and large files. So: **high reasoning** for constraint adherence, **1M context** because `index.html` alone is ~305KB and a slice routinely spans it plus `premium-ui.js` and `cut-support.js`, and **fast** per the owner's preference.

Set per delegation via `--model`; the interactive Cursor config is left alone.

**Fallback.** On 2026-09-22 the pinned model returned `ActionRequiredError: You've hit your usage limit for Opus` (resets 2026-10-13) and exited without attempting work. D12 ran on `grok-4.7-high-fast` with owner approval. When the pinned model is unavailable, use that fallback and **record the model in the slice's review entry**, so a quality regression stays attributable to a model rather than to chance.

## 6a. Working agreement

- Implement only the scope in `tasks/vnext/CURRENT_TASK.md`. Anything else — including improvements that look obvious — is out of scope; raise it in your report instead.
- Verify what §6 assigns you: `node --check` on changed JS, balanced braces on changed CSS, and the deterministic suites green. Report their real output. Claude runs the browser, responsive, interaction and reduced-motion checks.
- **Do not commit or push.** Update `tasks/vnext/CURSOR_REPORT.md` and stop. The design director reviews the working tree and the actual git diff.
- If the page requests a new `.js`/`.css`, the offline shell in `sw.js` must list it at the current `RELEASE` — otherwise the release gate fails and the PWA breaks offline.
