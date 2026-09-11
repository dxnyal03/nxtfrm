# NXTFRM tasks

Statuses: **COMPLETE** · **IN PROGRESS** · **PRESERVED** · **PLANNED** · **BACKLOG** · **KNOWN ISSUE**.

Hashes below are from `git log` on this checkout. Do not treat truncated handoff hashes as source of truth.

**Shipped pin:** `origin/main` = `main` = `a714b28` Quick Win: Accessibility & Reduced Motion Support.

---

## COMPLETE

| Hash | Item |
|---|---|
| `693c9d6` | V100 known good |
| `b62f08e` | Dev setup: seed data + localhost guards |
| `d8876d0` | Guard SW registration on localhost; keep `sw.js` identical to prod |
| `125fbb5` | Phase 1: adherence + suggestion logging |
| `53ddca8` | Phase 2: adaptive TDEE from adherence + weight trend |
| `aff4a52` | Phase 2: TDEE card call site + seed adherence data |
| `94cb615` | Prefer saved `settings.tdee` over profile maintenance estimate |
| `f11b23c` | Seed: run once per install, strip reseed query |
| `33e7107` | Phase 3 chunks 1–2: `ewmaTrend` + `trendConfidence` |
| `41bc9b4` | Phase 3 chunk 3 follow-up: `sigma_num` fallback for `forecastGoal` |
| `a22e289` | Phase 3 chunk 4a: extract `lsFit`, behaviour-preserving |
| `1822b91` | Phase 3 chunk 4b: `forecastGoal` regresses raw weights |
| `366bed5` | Phase 3 chunk 4c: `detectPlateau` via raw OLS equivalence + duration ladder |
| `c9948e4` | Phase 3 chunk 4d: anchor forecast level on raw fit, not lagged EWMA |
| `0abf5c3` | Phase 3 chunk 5: chart redesign (confidence band, forecast cone, plateau label) |
| `dfbd976` | Safe Sync: merge-on-load, auto-load, auto-push, status indicator, local-only banner |
| `0f5bc30` | Phase 4: causal diagnosis with 5-scenario decision tree |
| `a714b28` | Quick Win: accessibility and reduced-motion support. **Committed and pushed.** |

`a714b28` is COMPLETE on `origin/main`. This conversation recorded a user-reported browser pass; that is not an agent iPhone/PWA certification and is not labelled USER BROWSER VERIFIED here.

---

## IN PROGRESS

None.

---

## PRESERVED

| Hash / artifact | Item | Notes |
|---|---|---|
| `preserve/v101-cache-version` @ `68fa5ab` | WIP: V101 cache name (`nxtfrm-v101-premium-cache`) and `index.html` version-mismatch cache wipe / reload | Local-only. **Not shipped. Do not push unless asked.** Parent is `a714b28`. |
| `index.html.backup` (untracked) | Byte-identical to Phase 4 `index.html` (`0f5bc30`) | Do not delete, modify, or commit unless a later task says so. |

---

## PLANNED — UI Stabilization / Apple HIG Audit

**Preferred next engineering work**, before V101 consolidation and before Phase 5.

**Purpose:** Current app has observed UI overlaps/glitches. This is a **stabilization pass, not a redesign**.

**Scope:**

- Audit the CSS / override chain (`index.html` styles, `cut-support.css`, `premium-ui.css`)
- Identify overlap / clipping causes
- Safe-area issues
- Bottom-nav collisions
- Compact controls (Train set row, rest timer, gym switcher, tab bar)
- Chart / card width issues
- Long text wrapping
- Fixed / sticky positioning
- z-index conflicts
- Horizontal overflow
- Global 44px `button { min-width/min-height: 44px }` regression risk from `a714b28`
- Viewport currently sets `user-scalable=no` and `maximum-scale=1.0` (conflicts with PRD pinch-zoom principle)

**DO NOT TOUCH:**

- `apm_*` schemas
- Supabase
- Safe Sync
- Coaching calculations (Phases 1–4 stats / `diagnose()`)
- Seed lifecycle
- Phase 4 diagnosis logic

**Verify:** parse-check any JS if touched; `git diff --check`; iPhone/PWA screens for Home, Train, Progress, History, More. Desktop/Cursor browser is CODE VERIFIED only.

After stabilization: **V101 UI consolidation** remains the preferred next **product** phase.

---

## PLANNED — V101 UI consolidation

Preferred product phase after the HIG/stabilization pass.

No detailed UI spec is in this repo yet. Do not implement until a chunk is planned and approved.

Related preserved WIP (`68fa5ab`) is cache/version plumbing only, not the consolidation itself. Do not restore it onto `main` as a substitute for this phase.

---

## PLANNED — Phase 5 calorie target suggestion

Consume `NXT.diagnose()` (verdict, headline, evidence, actions, confidence). Propose a calorie-target **suggestion**. The user must confirm. **Never auto-write** `cfg().calories` or equivalent.

Do not mix with Safe Sync, seed, or UI redesign.

Sync-matrix testing is required only if this phase touches cloud (it should not).

---

## BACKLOG

- Phase 6+ of the six-phase adaptive coaching layer (name only; no shipped design — do not invent features).
- IndexedDB / localStorage durability (Safari/iOS wipe risk). No design in repo.
- Move `validateField` script to before `</body>` (currently after `</body>`; browsers recover, HTML is invalid).
- Revisit global 44×44 visual button rule if the audit keeps compact controls broken.
- Six-item diagnosis checklist for humans: `no_issue`, four fixtures, `insufficient_context` fallback (fixtures exist; keep as a regression ritual).

---

## KNOWN ISSUE

- Plateau diagnosis headline currently wins over the acute recovery `review()` warning when both apply. Flagged as Phase 4.5; do not change unless requested.
- Seed cloud-write protection (`cloudUser` → `cloudSignOutSilent`) is in `seed.scenarios.js` but was only exercised signed-out.
- `?scenario=` stays in the URL after overlay (by design so refresh does not wipe the fixture).
- Multiple GoTrueClient console warning (Supabase client construction). Known, not a blocker.
- IndexedDB migration not done.
- `index.html` still contains a pre-merge `applyCloudPayload` body that is overridden at runtime. Confusing for readers; do not “fix” unless a dedicated cleanup chunk is approved.

---

## Testing / browser verification

After every JS change:

1. `new Function(src)` on the modified production file(s).
2. `git diff --check` and inspect `git diff`.
3. Call the **shipped** `NXT.*` (or other live) function; do not reimplement logic in a test double and call that the proof.

Seed ritual (localhost): do not use `?reseed=1` and `?scenario=X` in the same load. Reseed first, then load the scenario separately. The current seed implementation may technically accept the combined query; this is a workflow safety rule, not a parser guarantee. Never apply scenarios while signed in.

Distinguish:

- **CODE VERIFIED** — parse, diff, local functions, Cursor/desktop browser where relevant.
- **USER BROWSER VERIFICATION REQUIRED** — real `apm_*`, Supabase, auth, service worker, installed PWA, iPhone layout.

If Safe Sync is ever changed, explicit tests: signed out, signed in, local newer, cloud newer, same id / different `ts`, empty cloud, offline/reconnect.

---

## Deployment

Commit ≠ deploy. Deploy only when the user says **deploy**. Do not push `preserve/v101-cache-version` unless asked.

---

## Engineering workflow (every chunk)

1. Plan: atomic deliverable, files/functions, acceptance, risks, DO NOT TOUCH, verification. Wait for approval.
2. One logical change. Do not mix data, coaching logic, UI, sync, and deploy.
3. Parse-check JS; `git diff --check`; inspect the real diff.
4. Production/user `apm_*` data must never be silently overwritten, deleted, migrated, or reinterpreted. Explicit localhost `?reseed=1` and user-confirmed restore/reset are controlled exceptions. Any production schema/migration or sync-semantics change needs a written migration, failure mode, and rollback first.
5. One commit per logical change. Stage named files, not `git add .` (would pick up `index.html.backup`).
6. Do not fix unrelated known issues in the same chunk.
