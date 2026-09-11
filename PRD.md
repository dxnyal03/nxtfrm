# NXTFRM product requirements

NXTFRM is a **single-user, client-side fitness PWA**.
“Private fitness OS” is product positioning only (see `manifest.webmanifest`), not an architecture claim.

This document describes **shipped** behaviour on `origin/main` (`a714b28`) unless a section is marked **PLANNED**, **BACKLOG**, **PRESERVED**, or **UNVERIFIED**.

---

## Product goals

- Log training, bodyweight, cardio, floorball, recovery, and optional waist/scans on one device.
- Coach a cut honestly: show evidence, allow `insufficient_context` / `undetermined`, never invent causes.
- Keep user history local-first. Cloud is optional backup/sync, not the source of truth.
- Never automatically apply calorie or cut-target changes. Suggestions require an explicit user action.
- Prefer usable iPhone/PWA behaviour over decoration.

---

## Architecture

- Plain HTML, CSS, and JavaScript. No framework, no bundler, no build step.
- Open as static files (local `python3 -m http.server` in development; production is a static host).
- Main shipped files: `index.html`, `cut-support.js`, `cut-support.css`, `premium-ui.js`, `premium-ui.css`, `sw.js`, `manifest.webmanifest`.
- `premium-ui.js` owns the live Home and Progress renderers. `cut-support.js` owns coaching/stats, backup helpers, and the Safe Sync overrides. An override block at the bottom of `cut-support.js` reassigns functions; do not break or reorder it.
- Localhost-only: `seed.dev.js`, `seed.scenarios.js` (no-ops off localhost).

---

## Hosting and optional cloud

- Intended deploy is a static site (in-app copy mentions moving data between versions or Netlify links). This repo has **no** `netlify.toml`. Production URL is **UNVERIFIED** from the checkout.
- Optional Supabase: the user stores a project URL and **publishable/anon** key in `apm_sb_url` / `apm_sb_key`. Row table: `apexcut_profiles` (`user_id` + `data`).
- Never put a service-role or private secret in client code.
- Connection settings and sessions live in the browser. This checkout does not contain personal cloud credentials (`READ_ME.md`).

---

## Data: localStorage-first

User records live under `apm_*` keys. Treat them as production data.

Known keys from shipped `persist()` / backup / cloud config:

| Key | Role |
|---|---|
| `apm_logs` | Set logs |
| `apm_bws` | Bodyweight |
| `apm_cardio` | Cardio |
| `apm_floorball` | Floorball |
| `apm_evo_scans` | Body scans |
| `apm_rest` | Rest records |
| `apm_current_read` | Current readiness |
| `apm_current_gym` | Selected gym |
| `apm_gyms` | Gym list |
| `apm_settings` | Settings, including `settings.cutSupport` |
| `apm_notifications` | Notification prefs |
| `apm_coach_insights` | Coach insights |
| `apm_session_plans` | Session plans |
| `apm_exercise_notes` | Equipment notes |
| `apm_last_open_date` | Last open date |
| `apm_sb_url`, `apm_sb_key` | Optional Supabase client config |

Coaching extras (adherence, suggestions, TDEE history, waist, recovery, calories, templates) live inside **`settings.cutSupport`** via `cfg()`. They ride backup/sync with `settings`. Do not add new `apm_*` keys without an explicit migration and rollback plan.

A safety snapshot key `nxtfrm_recovery_snapshot` is written before some restore/cloud-load/reset paths. That is not an `apm_*` training record.

JSON backup envelope and cloud payload fields are retained across V99/V100 (`READ_ME.md`, `cut-support.js` header).

---

## Core tabs and features (shipped)

- **Home** — next session, calorie guide, weight trend, weekly review, schedule below the fold.
- **Train** — one focused exercise, previous performance, rest timer, log set; unsaved inputs are session-only and do not survive reload (`READ_ME.md`).
- **Progress** — date-accurate chart, weekly change, optional waist, TDEE card, diagnosis card, drill-downs.
- **History** — calendar dates, daily cards, edit sets; span is first-to-last set timestamp, not measured duration.
- **More** — grouped settings, appearance, backup/export, cloud controls.

Also shipped: gym A/B, programme/templates, readiness check-in, appearance (larger text / reduced motion), PWA standalone display.

---

## Adaptive cut-coach (Phases 1–4, shipped)

Philosophy: overlay existing signals; do not invent causes; `insufficient_context` is a valid outcome; never auto-apply calorie changes.

| Phase | What shipped | Where |
|---|---|---|
| 1 | Adherence taps + suggestion log | `cfg().adherence`, `cfg().suggestions` |
| 2 | Adaptive TDEE from adherence + weight trend | `NXT.adaptiveTDEE()`, Progress TDEE card, `cfg().tdeeHistory` |
| 3 | Trend stats, plateau, forecast, chart | `ewmaTrend`, `trendConfidence`, `lsFit`, `forecastGoal`, `detectPlateau`, chart HTML |
| 4 | Causal diagnosis | `NXT.diagnose()`, Progress `diagnosisCard()`, Home `review()` headline inject on plateau |

`diagnose()` first-match verdicts: `no_issue` → `dietary_drift` → `water_masking` → `recovery_deficit` → `metabolic_adaptation` → `insufficient_context`.

Adherence for diagnosis is calendar-day mean (unlogged = 0). Evidence includes logged-day counts, not a bare hit-rate.

Confidence is data completeness, not conviction. Charts and evidence must reflect actual stored rows.

---

## Safe Sync (shipped, `dfbd976` + current overrides)

Runtime cloud apply is **merge**, not wholesale replace.

**Live path:** More → Data & sync → **LOGIN + LOAD** and **LOAD CLOUD** both call `loadCloudNow()` (overridden in `cut-support.js`), which calls `applyCloudPayload()`. That wrapper snapshots a safety copy, then runs `NXT.old.applyCloudPayload` as redefined in the Safe Sync IIFE.

That merge implementation:

- Merges cloud **into** current local state, then `persist()`.
- For `logs`, `bws`, `cardio`, `floorball`, `scans`, `rest`: **union by `id`**. Same id: **later `ts` wins** (strictly greater `ts`; if timestamps are equal the cloud row already in the map is kept). Rows without `id` are appended as extras (duplicates are possible).
- `settings`: cloud then **local wins** at the top level (`{...cloudSettings, ...localSettings}`). Nested `cutSupport` uses local-wins object merge, except `adherence` / `suggestions` / `tdeeHistory`, which keep the local value if it is non-empty, otherwise cloud.
- If the cloud payload includes `gyms` / `gym`, those fields are assigned from cloud (not unioned).
- After a successful merge, signed-in `loadCloudNow()` quietly `saveCloudNow(false)` so the merged document can be written back. Autosave via `scheduleCloudSave()` only runs when `cloudUser` is set.
- Signed-out localhost: local-only banner; seed scenarios must sign out before overlay so fixtures are not uploaded.

`index.html` still contains an older `applyCloudPayload()` that assigns `state.logs = d.logs || state.logs` (and similar). **It is not the runtime path**; `cut-support.js` replaces `applyCloudPayload` after load. Do not document Login+Load as if that older body still ran.

**Separate destructive / replace actions (not cloud merge):**

| Action | Behaviour |
|---|---|
| **RESTORE THIS BACKUP** (`restoreBackup` → `NXT.restoreData`) | After confirm + safety snapshot, **replaces** listed local arrays and settings from the file. |
| **Restore safety copy** (`restoreSafety`) | Same `restoreData` path on `nxtfrm_recovery_snapshot`. |
| **Reset NXTFRM records** (`resetData`) | Removes listed `apm_*` keys on this origin, nulls `cloudUser`, reloads. Does not claim to wipe other origins. |

Export first before restore or reset. Test connection (More → Data & sync) is GET-only and does not write (`READ_ME.md`).

---

## Seed and scenario testing (localhost)

Preserved workflow:

1. `?reseed=1` — rebuild base seed; strips **only** the `reseed` query param.
2. Separately, `?scenario=X` — overlay one of `plateau_metabolic`, `plateau_drift`, `water_masking`, `recovery`.

Do not use `?reseed=1` and `?scenario=X` in the same load. Reseed first, then load the scenario separately. The current seed implementation may technically accept the combined query; this is a workflow safety rule, not a parser guarantee. Do not apply scenarios to a signed-in cloud session. Fixture rows may carry `_seed: true` locally; that marker is not a reason to upload.

---

## Mobile / PWA

- `display: standalone`, portrait, icons in `manifest.webmanifest`.
- Shipped service worker cache name: `nxtfrm-v100-premium-cache`. Localhost registration is guarded (`d8876d0`).
- Safe-area insets are used in several CSS rules. The **shipped** viewport meta includes `user-scalable=no` and `maximum-scale=1.0`. That is a **KNOWN COMPLIANCE GAP** against the pinch-zoom requirement below; review it in the UI Stabilization / Apple HIG audit. The shipped app does **not** currently comply.

---

## Apple / iPhone UI principles

NXTFRM is **iPhone / PWA-first**. Dark purple/charcoal branding stays, but **usability overrides decoration**.

- Support `viewport-fit=cover` and `env(safe-area-inset-*)` so home indicator and notch do not cover controls.
- Zero tolerance for overlaps, clipping, or horizontal overflow.
- Touch **hit** regions should be about **44pt-equivalent**. That does **not** require every visual button to render as a 44×44 square. Compact icons may stay visually small if the tap target and spacing are adequate.
- Adequate spacing between adjacent controls.
- Flexible, responsive layout. Avoid fragile fixed widths/heights and unnecessary `absolute` / `fixed` positioning.
- **Never disable pinch zoom** (Apple/iPhone product requirement). Current shipped viewport uses `user-scalable=no` / `maximum-scale=1.0`, so this is a **KNOWN COMPLIANCE GAP** for the UI Stabilization / Apple HIG audit — not present behaviour.
- iOS-friendly form and input sizing (no accidental zoom from tiny inputs once zoom is enabled).
- Clear visual hierarchy; reduced-motion support; accessible focus, labels, and contrast.
- Real **iPhone / installed PWA** verification is required for UI work. Desktop or Cursor browser is **CODE VERIFIED** only.

The global `button { min-width/min-height: 44px }` rule in `a714b28` is a known regression risk for dense Train controls (see `TASKS.md`).

---

## Data safety rules

- Production/user `apm_*` data must never be silently overwritten, deleted, migrated, or reinterpreted. Explicit localhost development reseeding (`?reseed=1`) and user-confirmed restore/reset flows are controlled exceptions.
- Any production schema/migration or sync-semantics change needs a written migration, failure mode, and rollback **before** editing.
- Seed/fixtures must not reach Supabase.
- Agent CODE VERIFIED ≠ user localStorage / Supabase / SW / installed PWA.

---

## Evidence and confidence

- Show the evidence behind a recommendation.
- `insufficient_context` and plateau `undetermined` are valid.
- Do not duplicate diagnosis evidence as a second Home card; Progress owns the diagnosis card; Home may reuse the headline only when a plateau is detected.

---

## Known non-blocking issues

See `TASKS.md` **KNOWN ISSUE**. Do not fold them into unrelated chunks.

---

## Technical constraints

- No new `apm_*` keys unless a task explicitly migrates storage.
- Do not modify Safe Sync semantics as part of another feature.
- Do not touch Phase 1–3 statistics, `diagnose()` internals, seed lifecycle, or the override block unless the approved chunk names them.
- Parse-check modified production JS with `new Function(src)`. Test shipped functions, not a reimplementation.
- One logical change per commit. Deploy only when explicitly told `deploy`.

---

## Future product direction (not shipped)

Preferred sequence after docs: **UI stabilization / Apple HIG audit**, then **V101 UI consolidation**, then **Phase 5** calorie **suggestion** (user confirms; never auto-write). IndexedDB durability and later coaching phases are backlog.

A local-only Git branch `preserve/v101-cache-version` (`68fa5ab`) holds a cache-name / version-check WIP. **Not shipped.**
