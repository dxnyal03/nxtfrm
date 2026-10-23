# SPEC — Native 1 (rest on the lock screen · haptics · keep awake · weigh-ins to Apple Health · weigh-in reminder)

Owner, 2026-10-23: "sure 1, 2, 3, 4, 5 — but for 4 I want to key in NXTFRM and it updates in Apple Health." Personal iOS app (Capacitor 8.5.3, branch `native-ios`). Free Personal Team signing.

## Owner-facing behaviour
1. **Rest on the lock screen.** Logging a set starts the rest timer as today; in the app it also starts a Live Activity (lock screen + Dynamic Island) counting down to the rest end, and schedules a local notification at the end ("Rest done" + the next set). +30 s / skip update or end both. In the foreground the notification is not shown (the app already toasts and vibrates); in the background or locked it buzzes and sounds.
2. **Haptics.** Medium impact when a set is logged; success notification when a rest ends in the foreground; a selection tick when the dock changes tab.
3. **Keep awake.** The screen stays on while a workout is active (`html.st-in-workout`), and sleeps normally otherwise.
4. **Weigh-ins → Apple Health (one way).** Every *Morning* weigh-in keyed into NXTFRM is written to Health as Body Mass. Editing it in NXTFRM replaces the Health sample; deleting it removes it. Switching the setting on sends the existing morning history once (idempotent). Other weigh-ins (Pre/Post-workout, Night, Evo Scan) are not sent — Health has no notion of "morning", and post-workout readings would put dehydration dips in its chart. Nothing is read from Health.
   Evo scan **body fat %** is also sent (Body Fat Percentage, dated noon on the scan date, scans with 2–70 % and a date not in the future). Scan weight is post-workout and stays out; muscle mass, BMR and TDEE have no faithful Health type.
5. **Weigh-in reminder.** Optional daily notification at a chosen time ("Morning weigh-in"), skipped on days a Morning weigh-in already exists; rescheduled on every weigh-in change and on app open, 7 days ahead.

Settings gets a native-only group **On this iPhone** with: *Apple Health — Send morning weigh-ins* (switch), *Weigh-in reminder* (switch + time). The web app shows nothing new.

## Storage (no existing key or record changes — AGENTS §5)
- `nxt_native_prefs` (new localStorage key): `{ health: false, reminder: false, reminderTime: "07:30" }`.
- `nxt_native_health` (new): `{ [weighInId]: "<weight>|<date>|<ts>" }` — what was last sent, so only real changes are rewritten.
- `nxt_native_health_bf` (new): `{ [scanId]: "<bodyFat>|<date>" }` — what body fat was last sent, from `apm_evo_scans`.

## Bridge contract — `window.Capacitor.Plugins.NxtNative` (all methods return Promises)
| Method | Args | Returns | Notes |
|---|---|---|---|
| `haptic` | `{ style: "light"\|"medium"\|"heavy"\|"selection"\|"success"\|"warning"\|"error" }` | `{}` | |
| `keepAwake` | `{ on: boolean }` | `{}` | `UIApplication.isIdleTimerDisabled` |
| `notifyPermission` | `{}` | `{ granted: boolean }` | requests on first call |
| `schedule` | `{ id: string, at: number /*epoch ms*/, title: string, body: string }` | `{}` | replaces a pending one with the same id |
| `cancel` | `{ ids: string[] }` | `{}` | |
| `cancelPrefix` | `{ prefix: string }` | `{}` | e.g. `"rem-"` |
| `healthAvailable` | `{}` | `{ available: boolean }` | |
| `healthAuthorize` | `{}` | `{ granted: boolean }` | write Body Mass and Body Fat Percentage; `granted` = sharing authorised |
| `healthSaveWeight` | `{ id: string, kg: number, at: number, version: number }` | `{}` | `HKMetadataKeySyncIdentifier = "nxtfrm-bw-"+id`, `HKMetadataKeySyncVersion = version` (Date.now()), so a later version replaces the sample |
| `healthDeleteWeight` | `{ id: string }` | `{}` | deletes samples with that sync identifier written by this app |
| `healthSaveBodyFat` | `{ id: string, pct: number /*percent, e.g. 26.2*/, at: number, version: number }` | `{}` | Body Fat Percentage; sync id `"nxtfrm-bf-"+id`, replaced by a later version |
| `healthDeleteBodyFat` | `{ id: string }` | `{}` | deletes body fat samples with that sync identifier written by this app |
| `liveStart` | `{ endAt: number, title: string, subtitle: string }` | `{ ok: boolean }` | starts or replaces the single rest activity; `staleDate = endAt` |
| `liveUpdate` | `{ endAt: number, subtitle?: string }` | `{ ok: boolean }` | |
| `liveEnd` | `{}` | `{}` | ends with immediate dismissal |

`native.js` must no-op cleanly when `window.Capacitor?.isNativePlatform?.()` is false or the plugin is absent (it is only bundled into the app, but defend anyway), and must catch every rejected promise (a failed native call never breaks the web app).

## Web hooks (native.js only; no edits to the web files)
- **Rest:** wrap the globals `apx96StartRest`, `apx96AdjustRest`, `apx96SkipRest`, `apx96TickTimer` (index.html; `let apx96RestEnd` is reachable by name). After start/adjust: `schedule({id:"rest", at: apx96RestEnd, …})` + `liveStart`/`liveUpdate`. After skip: `cancel(["rest"])` + `liveEnd`. When a tick takes `apx96RestEnd` from >0 to 0 without a skip: `haptic("success")` + `liveEnd`. On `visibilitychange` → visible with no rest running: `liveEnd` (an activity left at 0:00 while the app was suspended).
- **Set logged:** inside the `apx96StartRest` wrapper, `haptic("medium")` only when `state.logs.length` grew since the last call (rest also restarts on resume).
- **Tab change:** wrap `switchTab` — `haptic("selection")` when the tab actually changes.
- **Workout active:** `MutationObserver` on `document.documentElement` `class` → `keepAwake({on: classList.contains("st-in-workout")})`, deduped.
- **Weigh-ins:** wrap `localStorage.setItem`; for key `apm_bws` (every save path ends there: quick sheet, edit, delete, scans, import, cloud restore), debounce 400 ms, diff the Morning entries against `nxt_native_health`, save changed/new (version `Date.now()`), delete removed, update the map. "Morning" = the engine's own definition — use the same predicate the trend uses (find it in cut-support.js; do not invent one). Sample time: `ts` when it falls on `date` (local), else `date` 07:00 local. Then reschedule reminders.
- **Reminder:** `cancelPrefix("rem-")`, then for each of the next 7 days at `reminderTime` without a Morning entry and in the future: `schedule({id:"rem-"+date, …})`. Run on load, on resume, on every `apm_bws` change, on settings change.
- **Settings group:** inject into the Settings hub (`#morePage`) using the existing row/switch markup and classes so it matches; re-inject after re-renders (observer); enabling Health calls `healthAuthorize` then a full sync; enabling the reminder calls `notifyPermission`. If permission is denied, the switch returns to off and the row says why in one line.
