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

## 6. Working agreement

- Implement only the scope in `tasks/vnext/CURRENT_TASK.md`. Anything else — including improvements that look obvious — is out of scope; raise it in your report instead.
- Verify with Playwright at **390 / 375 / 320**: no horizontal overflow, text ≥4.5:1, interactive targets ≥44pt, reduced motion works, and untouched screens still render without console errors.
- **Do not commit or push.** Update `tasks/vnext/CURSOR_REPORT.md` and stop. The design director reviews the working tree and the actual git diff.
- If the page requests a new `.js`/`.css`, the offline shell in `sw.js` must list it at the current `RELEASE` — otherwise the release gate fails and the PWA breaks offline.
