# NXTFRM V100 — Premium daily experience

Purple and soft charcoal, with less clutter and clearer everyday controls.

## Updated pages

- Home centres on the next workout, calorie guide and weight trend. Weekly schedule and coaching details sit below the main actions.
- Train has one focused exercise, set-level previous performance, large inputs, a rest timer that stays near the top while scrolling, and a prominent Log set action. Unsaved input values are remembered during the current browser session, separately for each session and exercise; they are not logged records and do not survive a reload.
- Progress keeps the existing date-accurate chart and its inspection controls, with weekly change, optional waist measurement and drill-down links.
- History provides readable calendar dates and daily cards. Tap a saved day to review and edit sets. Logging span is first-to-last set timestamp, not measured workout duration. Original cardio, floorball, scan and daily detail views remain available.
- More has grouped settings with current values, readable subpages, appearance preferences, backup-export status and clear cloud controls.
- Appearance supports larger text and reduced motion while retaining the chosen purple/charcoal palette.

## Supabase check

The existing app stores the Supabase project URL, public key and sign-in session in the user's browser. Those private device settings are not present in this source checkout, so this release does not certify the user's personal cloud connection.

The existing Supabase SDK CDN URL returned HTTP 200 during this update. No personal cloud records were accessed, uploaded, restored or changed during development.

On the device with your configuration, open More → Data & sync → Test connection. This performs GET requests to the project auth settings, verifies the signed-in user with the auth service, and queries only your own backup row's user_id. It does not fetch workout contents or test write permissions. A successful query with no visible row can mean no backup exists or a row policy hides it. The test does not silently save newly entered connection settings. Only publishable/anon keys belong in this client app; never use a service-role or secret key.

Cloud login, load, save and signup controls retain their existing behaviour. Login + Load can replace local data with cloud data; export first. The original safety-copy mechanism remains in place. Test connection is separate from those actions and does not run automatically.

## Data compatibility

Existing workout and bodyweight records, programme logic, apm_* keys, JSON backup envelope and Supabase payload fields are retained. New appearance settings and the last export-request timestamp are optional fields inside settings.cutSupport. An export-request timestamp means a download was prepared, not that the browser finished saving it.

## Open or update

- NXTFRM_V100.html is a single-file review copy with app scripts, styles and icons embedded. OCR and optional cloud services still need the network. File previews may not have reliable persistent storage or PWA installation.
- NXTFRM_V100_PWA.zip contains the installable app. Export your backup first, then deploy every file inside its NXTFRM_V100 folder to the same origin and app location as your previous version. Do not clear website data.
- The previous live Site has not been republished. These downloads and the saved Site version contain the update.

## Validation limits

Automated checks use synthetic records and a small DOM double, not a real Safari/iPhone session. Supabase diagnostic branches are checked with mocked responses; no claim of personal login, row-policy correctness or successful cloud writes is made. Production build and local asset checks are performed separately.
