# Reliability F: split persistence (owner report: "a customised weekly split sometimes reverts to the default programme after being saved")

Branch `ascension`, baseline `029eb51` (release 161). Nothing committed, pushed or deployed. No Supabase schema, RLS or data touched. Shipped line numbers below are from `HEAD`. "Now" line numbers are from the working tree at the time of writing. `index.html` is being edited by other agents at the same time, so its lines move.

## 1. Root causes

Commit 3bf1862 fixed one cause (`setMinimumWorkoutMode(false)` re-seeding from `TEMPLATES`), and that fix holds. Seven more causes remain. Each is reproduced by a test that runs the shipped code (§5). RC1 is the reported bug. RC6 and RC7 make it worse and can also lose workouts.

**RC1: the merge lets this device's factory plan beat the account's split, then writes it back.**
- `index.html:2716–2719` boot fills `SETTINGS_DEFAULTS` and `DEFAULT_WEEKLY_PLAN` into `settings` before anything loads.
- On a device without `cutSupport.version`, `install()`'s V99 step (`cut-support.js:1760–1761`) then replaces that plan with the A/B/C split `N.split`. This covers a fresh install, wiped storage, and the reload after "Reset NXTFRM records". So a fresh phone holds `{0:Rest,1:FullA,2:Zone2,3:FullB,4:Zone2,5:FullC,6:Zone2}`, not `DEFAULT_WEEKLY_PLAN`. Any "is this the default?" test has to know both.
- `cut-support.js:1995` `const merged={...d.settings,...localSettings}`: at the top level, this device always wins. That covers `weeklyPlan` and `dayOverrides`, plus the goal and other defaults (see RC8).
- `cut-support.js:2219` `loadCloudNow()` then calls `saveCloudNow(false)` and writes the reverted plan to the account.
- **Amplifier:** `initCloudFromStorage` (`cut-support.js:2043–2071`) auto-loads, merges and writes back on every boot that has a stored session.
- **Reset path:** `resetData` (`cut-support.js:1719–1735`) removes the `apm_*` keys but keeps the Supabase session and `apm_sb_url`/`apm_sb_key`. The reload therefore auto-loads into a factory device and pushes the factory split.
- Reproduced in the vm: device B (fresh) merged device A's row. Afterwards B's plan was the A/B/C split and the write-back carried it.
- Tests:
  - `fresh device: Login + Load keeps the account's split and writes it back`
  - `fresh device: the split install() writes before any load is unstamped and yields`
  - `after a local reset, the boot-time auto-load keeps the account's split`

**RC2: routines merged "local wins" per key.**
- `mergeCutSupport` calls `mergeObjectsLocalWins` (`cut-support.js:1936–1980`). For each `gym__type` key, this device's routine wins: a stale routine on a second device, or a factory routine on any device.
- The account's newer routine is replaced and the old one is written back.
- Tests:
  - `routines: the account's newer routine replaces a stale one on this device`
  - `routines: an unstamped factory routine on this device counts as unset`

**RC3: today's queue is seeded from the factory list before the load, and never re-seeded.**
- The `ensureSessionPlan` override (`cut-support.js:1790`) seeds `state.sessionPlans[today]` and `cfg().sessionTargets[today]` from `templateFor()` the first time Today draws. That happens before the async cloud load; on a fresh phone it means the factory routine.
- `apm_session_plans` is not in `getCloudPayload()` (`index.html:5311–5333`), and `sessionTargets` merges local-wins.
- So after Login + Load, today's workout still shows the factory exercises, and factory targets for today go into the account. This is the "sometimes": it lasts for the day of the load only.
- Test: `fresh device: today's queue seeded before the load follows the account's routine`

**RC4: dated overrides are not merged at all.**
- The account's `dayOverrides` is replaced wholesale by this device's.
- `render()` → `applyDayOverrideForDate()` (`index.html:2994`) creates `{}` on every device, so the account's overrides are always dropped.
- A cleared day cannot be told apart from a day that was never set.
- Test: `dated overrides merge by date; the newer stamp wins, including a cleared day`

**RC5: nothing records which copy is newer.**
- The programme carries no edit time.
- The row write is a whole-`data` upsert with `updated_at: now()` (`cut-support.js:2161–2190`, retried without `updated_at` if the column is missing). `loadCloudNow` selects `data` only (`2193–2230`).
- There is no version or `updated_at` check anywhere. With two devices, whichever loaded last wins.
- Test: `weekly plan: with stamps on both copies the newer wins, either way`

**RC6: writes before reads, which can also wipe workouts.**
- Any `persist()` schedules a whole-row save 900 ms later (`index.html:5381–5385`), and `saveCloudNow` never required the account to have been read first.
- Three paths:
  - `index.html`'s own `initCloudFromStorage()` (`index.html:7497`) can set `cloudUser` before cut-support's auto-load reads.
  - A slow or failed load after Login + Load.
  - "Retry" or "SAVE CLOUD" after a failed load.
- In each, the device's factory plan and empty record lists replace the account row.
- Tests:
  - `an autosave that fires before the first load cannot replace the account`
  - `after a failed load, Retry reads the account before it writes`

**RC7: a full phone stops cut-support.js at load.**
- `persist()` rethrows its first refused write (`index.html:2906`, D29).
- `install()` calls it unguarded (`cut-support.js:1775`), so `cut-support.js:1920` throws and the rest of the file never runs.
- That rest is the Safe Sync merge (`1981`), the `saveCloudNow`/`loadCloudNow`/`initCloudFromStorage` overrides and the `render` wrapper.
- The page then runs `index.html`'s original `applyCloudPayload` (`5334`), which replaces records with the cloud's and lets the cloud win settings. The `applyCloudPayload` wrapper at `1839` was installed before the throw and calls that original through `NXT.old`.
- Test: `cut-support installs its merge and cloud overrides even when persist() throws at boot`

**Save acknowledgement.**
- On a full phone while signed in, `commit()` (`cut-support.js:764`) said "Saved online…" before the debounced cloud save had even started. That was not honest.
- The normal toasts ("Wednesday set to Pull", "Legs saved") fire only after every `localStorage` write has returned, and they claim nothing about the cloud. They are honest and unchanged.
- Test: `a full phone that is signed in is told the change is on its way, not that it is saved`

**RC8: a fresh device's factory settings replace the account's goal range, cut start, TDEE and cardio target. Fixed in the follow-up (§9).**
- The same top-level local-wins rule also lets a fresh device's `SETTINGS_DEFAULTS` replace the account's `startWeight`, `targetLow`/`targetHigh`, `tdee` and `zone2WeeklyTarget`.
- Reproduced: after a merge the fresh device showed `startWeight 87.1` and goal `78–80` instead of the account's `90` and `75–77`.
- `cutStart`, `goalLow`/`goalHigh` and `targetConfirmed` are absent on a fresh device, so they already survived. A name left at the default greeting ("Dan") did not.
- Still local-wins (not requested): the `leanMode` that `ensureLeanSettings()` creates on render, and `previousCardioTarget`.

### Investigated, not a cause
- **D33 (`mergeLegsIntoPump`, `cut-support.js:1739`).** Idempotent. It runs inside `install()` at script load, before the async auto-load, and again after every merge (`install(false)` in the wrapper). Pinned across two boots plus a merge.
- **`resolveDayType`/`planTypeForDow`.** One resolver, precedence override → weekly plan → built-in split. `state.dayType` is re-resolved on every `render()`.
- **Date roll-over.** `setDateToToday` (`index.html:6625`) sets `state.exercise` from `TEMPLATES`, which is cosmetic: Train corrects it, and the queue comes from `templateFor`. Past-date overrides do not affect today.
- **Gym switching.** Routines are per gym by design (D22), so see residual risk 8.
- **`seed.dev.js`.** Host-gated to `localhost` and deploy previews, and it never writes `weeklyPlan`, `dayOverrides` or `templates`. On `localhost` cloud stays enabled: a developer signed in there could push fixture logs, bws and scans, but not the plan.
- **Legacy migrations** (`normalizeLegacyDayNames`, `migrateLegsCoreTemplate`, `migrateSingleLegsCoreCycle`). Defined, never called.
- **Legacy plan editors** (`splitSettingsHTML` select, `cycleWeeklyDay`, `clearTodayOverride`, `cycleDayType`). Not reachable in the current UI.

## 2. Fix and conflict strategy

All of the fix is in `cut-support.js`, except one line in `index.html` (§3).

1. **Edit stamps, taken where edits are committed** (`commit()` → `stampProgramme()`, now `cut-support.js:769–786`).
   - `commit()` is the one door every programme edit goes through: D35 day sheet, session picker, Settings › Training `setDay`, D22 `routineSave`, "Save to routine", `saveWeek`, `restoreWeek`, `saveTemplate`, `saveQueueAsTemplate`, and `coach.js` writers.
   - It compares the programme with the last base and stamps what changed. A cleared override keeps its stamp as a tombstone.
   - `install()` and the merge re-base without stamping, so factory values, migrations and copies that came from the cloud are never "fresh edits".
   - The V99 step also drops any old `planUpdatedAt`, so a migrated split can never carry a stale edit stamp.
2. **Merge rule** (`resolveProgramme`, now `cut-support.js:2025–2080`):
   - The newer stamp wins.
   - An unstamped copy (legacy) loses to a stamped one.
   - Unstamped on both sides: this device's copy counts as **unset**, and the account's wins, when it is either:
     - a plan equal to `DEFAULT_WEEKLY_PLAN` (after D33 Legs→Pump) or to `N.split`;
     - a routine that is absent, fails `validTemplate`, or equals `NXT.defaults`/`TEMPLATES` for its type.
   - Two unstamped customised copies keep this device's, as before. This is documented and pinned.
   - `previousWeeklyPlan` travels with the plan it belongs to.
   - Overrides: union by date, the newer stamp decides, including clears.
   - Records keep union-by-id exactly as before. Waist rows now union by id too.
3. **Today's untouched queue** (`untouchedToday`/`reseedToday`). A queue for today that is still exactly its seed, with no set logged on this device before the merge, is re-seeded from the routine the merge settled on. This is the D22 rule for a routine save. Started or edited queues are kept.
4. **Read before write** (`saveCloudNow`/`loadCloudNow`, now `cut-support.js:2293–2400`).
   - Until this page has fetched the row for the signed-in user, a save reads it first.
   - A merged read ends with its own save. In `loadCloudNow`, `saveCloudNow(false)` is kept, and it now writes the resolved programme.
   - A failed fetch writes nothing.
   - "Empty" (new account, sign-up) writes the first copy.
   - "Unmerged" (no safety copy on a full phone, or an invalid row) saves as before, so D29 holds.
   - Reads are de-duplicated, and a sign-in that lands mid-load reads again rather than waiting on itself.
   - Toasts stay out of reads started by saves (D11).
   - The safety snapshot before a cloud load is unchanged.
5. **Fail-safe install.** `persist()` inside `install()` and inside the merge is caught and logged, so a full phone still installs the Safe Sync merge and overrides.
   - I removed a first-draft blanket `try` around the `NXT.install()` call. It hid programming errors, and it broke the three existing test harnesses that learn page globals from load-time `ReferenceError`s.
6. **Toast.** "This device's storage is full. Sending the change to your account; export a backup and free some space."
7. **Coordinator items folded in:**
   - `chooseSession` refuses a day with logged sets ("This day already has logged sets.") and is stamped like any override.
   - Add-ons are in the cloud payload, merged per session (this device first), restored from the backup's storage dump (absent → `{}`), and cleared by reset. The safety snapshot already kept `apm_addons` in its dump.

## 3. Added optional fields (no new `apm_*` key, no record shape or meaning changed)

| Field | Shape | Set by |
|---|---|---|
| `settings.planUpdatedAt` | ISO string | a committed change to `settings.weeklyPlan`; removed by the V99 migration |
| `settings.cutSupport.overrideMeta[date]` | ISO string | a committed set or clear of `settings.dayOverrides[date]` |
| `settings.cutSupport.templateMeta[gym__type]` | ISO string | a committed change to `cutSupport.templates[gym__type]` (sidecar; routine rows and `validTemplate` untouched) |
| cloud payload `addOns` | the existing `state.addOns` map (`apm_addons`) | `getCloudPayload()` (`index.html:5410`, the only `index.html` line I changed) |

## 4. Files I changed
- `cut-support.js`: 210 lines added, 20 removed (including the §9 follow-up).
- `index.html`: 1 line.
- `wearables.plan-persistence.test.js`: new.

Other agents changed these files in this checkout at the same time; none of it is mine: `index.html` launch sequence and head, `premium-ui.js` exercise history, `strata.css`, `manifest.webmanifest`, `coach.js`, `wearables.coach.test.js`.

## 5. Test output

- `wearables.plan-persistence.test.js` runs shipped `index.html` regions (boot, `persist()`, cloud functions), the whole of `cut-support.js` and `premium-ui.js` in a vm. Around them sit a refusing `localStorage`, fake timers and a fake one-row Supabase client.
- **Against shipped code** (`HEAD` copies of the three files): `FAILED  5 passed, 20 failed`.
  - The 5 passes are guards: started or edited queue kept, records union, D29, D33, sign-up.
  - The 20 failures are RC1–RC8, the toast, and the coordinator items.
- **After the fix:** `OK  25 passed, 0 failed`.
- **Full suite** (`for f in wearables*.test.js; do node "$f" || echo FAIL $f; done`): 20 suites / 558 passed / 0 failed. That is the 18/490 baseline, plus my 25, plus 43 in `wearables.coach.test.js`, which another agent is building in parallel.
- `node --check`: `cut-support.js` and `wearables.plan-persistence.test.js` OK. The changed `index.html` function is compiled by the new harness.
- **Browser smoke test** on `localhost:8763`, in my own tab, after checking that the origin holds no Supabase session: the page boots with 0 console errors, Today renders, and the new merge, read-before-write and stamping are live.

## 6. Verified vs not verified

**Verified** (shipped code in a vm, deterministic):
- every root cause and every fix above;
- the D33 idempotence;
- D29's per-key writes;
- the real `cloudLogin` / `cloudSignup` / auto-load paths against a fake client.

**Not verified:**
- real Supabase (network timing, RLS, the `updated_at`-less retry);
- a real iPhone (iOS storage eviction, Safari quota errors, PWA resume);
- two real devices;
- device clock skew;
- no Playwright or responsive sweep. The only visible changes are two toast strings.

## 7. Residual risks
1. **Row-level last-writer-wins stays.** A compare-and-swap needs a schema change. A device that read before another device's edit can overwrite the row on its next save. The newer stamp wins again at each device's next load, but until then the newer edit exists only on its own device.
2. **A backgrounded PWA does not re-read on resume.** It keeps showing, and pushing, its own copy until it reloads. Recommended follow-up: a quiet load on resume after N minutes, with `install(false)` keeping `state.exercise`. Today it resets the current exercise after every load.
3. **Legacy unstamped data.** Two unstamped customised copies keep this device's. This shrinks as edits get stamped.
4. **Clock skew.** "Newest" is the device clock.
5. **Restores are not re-stamped.** A restored backup keeps its own stamps. On several devices, a newer stamped edit elsewhere wins at the next merge. "Restore safety copy" straight after a cloud load restores the pre-load (possibly factory) state, and saves write it to the account.
6. **A row that is fetched but not merged** (full phone, invalid row) can still be overwritten. This is D29 behaviour, kept on purpose.
7. **The §9 rule judges by value.** A TDEE of 2644, a cardio target of 180 or 90, or the name "Dan", deliberately saved on a device that has never synced, counts as factory and yields to a different account value. The goal range and cut start are protected by their confirmation and date. Stamping these keys in `commit()`, like the programme, is the follow-up if that matters. `leanMode` is still local-wins.
8. **The merge takes the account's current `gym`** (`cut-support.js:1992`). A load can switch the device to a gym with no saved routine, which shows the factory list and looks like a revert.
9. **`classic/`** (frozen release 110, link hidden) still has the old merge and auto-load.
10. **On a full phone, plan edits that need a safety copy are refused.** That covers Settings › Training `setDay`, `saveWeek` and `restoreWeek`, which only say "Could not make a safety copy…". The sheet stays open, so the refusal is easy to read as a save.
11. **The banner text "…did not go through. Your data is safe on this device"** also appears after a failed load, and when the local write failed too.
12. **Pre-D33 rows.** A row from a device that predates D33 and holds only `gym__Legs` routines re-seeds today's queue before `install(false)` moves Legs to Pump.
13. **New `cutSupport` maps from other slices** (for example `coach.js` `dayNotes`) fall under the generic local-wins merge.

## 8. Coordinator questions
- **`minimumWorkout` is never persisted.** Nothing in the live UI reads it; only the legacy `minimumWorkoutCardHTML` does. The shortened queue lives in today's `apm_session_plans` only, and "Full session" restores from `templateFor`. Not part of the revert.
- **`install()` returning early when the V99 snapshot fails.** This only affects a device without `cutSupport.version` whose storage refuses the copy. The plan stays at the boot default (Legs not folded), nothing is stored, and the step retries every boot.
  - Now: the merge treats that default as unset.
  - Edits made in the meantime are stamped, because `install()` re-bases on that path.
  - When V99 finally runs it drops the stale stamp.
- **`previousWeeklyPlan`.** Written by `NXP.setDay` (`premium-ui.js:1884`), by V99, and by the D33 Legs swap; read by `restoreWeek` (a reader, not a writer).
  - It has no stamp of its own and moves with the plan in a merge.
  - `restoreWeek` stamps the plan it restores, because that is a user choice.
  - Pinned by tests.
- **Duplicate `logsForDate`** (now `index.html:6296` and `7327`, same script).
  - The later, date-only one wins for the whole page, so `workoutTotals` ignores type and gym.
  - Every `workoutTotals` caller is a legacy renderer that the live layers never call.
  - The live History (`premium-ui.js` `historyRecords`) calls `logsForDate(date)` with one argument and depends on the date-only version, so do not delete it.

## 9. Follow-up: the settings every fresh device starts with (coordinator request)

**Rule** (`resolveDefaults`, now `cut-support.js:2081–2104`, called in the merge right after `resolveProgramme`).
- When this device's copy is the factory one and the account's differs, the account's copy wins. A customised copy here is kept, as before.
- Factory means:
  - `SETTINGS_DEFAULTS` (start weight 87.1, range 78–80, TDEE 2644, cardio 180);
  - the V99-migrated cardio target of 90;
  - unset;
  - for the name: unset, or "Dan" (what `userName()` greets with when the name is unset).
- An empty name is a choice ("Leave it empty for no name") and is kept.

**Values saved together move together,** so a merge never takes half a range and can never produce an inverted one:
- **Goal:** `targetLow`, `targetHigh`, `goalLow` and `goalHigh` with `cutSupport.targetConfirmed` (`saveGoal`). A range confirmed at the factory numbers is a choice and is kept.
- **Cut start:** `startWeight` with `cutStart` (`saveCutStart`). A start weight of 87.1 saved with a date is kept.
- **Single values:** `tdee`, `zone2WeeklyTarget`, `name`.

**Globals.** `START_WEIGHT`, `TARGET_LOW`, `TARGET_HIGH`, `USER_TDEE` and `ZONE2_WEEKLY_TARGET` are set from the resolved settings by the merge's existing lines. No new field, no stamp, no record shape change.

**Tests:**
- `fresh device: the account's goal range, cut start, TDEE, cardio target and name survive and are written back`.
  - Shipped: fails with `startWeight comes from the account: 87.1 !== 90`.
  - Fixed: the account's values, the confirmation and the globals are on the device and in the write-back.
- `a device with its own values keeps them; a confirmed range is a choice even at the factory numbers`.
  - Every "keeps its own value" assertion passes on shipped code as well.
  - The new rule that the "Dan" greeting name yields to the account's name fails on shipped code (`'Dan' !== 'Account'`).
- File totals: shipped `FAILED  5 passed, 20 failed`, fixed `OK  25 passed, 0 failed`. Full suite: 20 suites / 558 passed / 0 failed.
