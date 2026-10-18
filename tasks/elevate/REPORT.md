# Elevate — report

Owner request (2026-10-18): "elevate the whole NXTFRM experience now that you can actually see the app on the
phone — visual upgrade, animation upgrade, upgrade everything", followed by "go crazy visual creativity", "upgrade
the chart", "analyse the app thoroughly", "cook even more with the additions and features".

Branch `elevate-ios-experience` (worktree `~/Developer/Worktrees/nxtfrm/elevate`), 9 commits on `origin/main`
`0ea0fd2` (release 161). **Nothing pushed or deployed. `RELEASE` unchanged.** Presentation and interaction only:
no calculation, storage key, record shape or stored value changed. Proposed decisions: `DECISIONS-PROPOSED.md`.

## What shipped

**The world**
- **Living sky** — the canvas follows the device clock: apricot dawn, orchid day, violet dusk, indigo night.
- **Your sky** — the background stars are your lifting days of the last 16 weeks; today's finished session glows.
- **Session light** — Train takes its session's own hue (Dusk palette, D54).
- **Dark launch** — launch images for 13 iPhone sizes, so the installed app no longer opens on a white screen.

**Moving around**
- **One page frame** — one 16 pt gutter and one 34 pt masthead at the same height on every tab.
- **Native tab navigation** — each tab keeps its scroll position, a re-tap returns to the top, and changes are View
  Transitions: the title travels with the direction, the session name and trend figure fly across.
- **Portal launch** — Start workout opens as a circle of light from the button.
- **Frosted top chrome** — a frosted strip under the status bar and a compact title capsule once the title scrolls away.
- **Liquid Glass dock** — a specular rim, a glint above the active tab, and a pill that stretches as it travels.
- **Dynamic Island alerts** — toasts grow out of the island, are announced to VoiceOver, and no longer vanish early.
- **Stretchy large titles**, sheets that recede around the visible middle, and **haptics** on Log set, Save weigh-in,
  Log cardio, Finish and chart scrubbing (iOS 18+ switch haptic).

**Today**
- **Body of Light** — this week's working sets lit on the body, ranked, assisted muscles dimmer, unmapped exercises named.
- **A warning verdict leads the page** (it sat about 2,000 px down under coach notes).
- **Log morning weight chip** under the greeting between 04:00 and 12:00 until the reading is in.

**Train**
- **Breathing rest orb** — a ring sweeping with the countdown, an 8 s breath, a last-10 s pulse, "Go" at the end, and
  the next set's target beside it.
- **Glance mode** — after 8 s untouched during a rest: a near-black view with the countdown, next load, set and session
  clock, readable at arm's length. Any touch returns.
- **Set ignition** — a sweep of light across each logged row; **new best** sets carry a lit star with a light burst and
  a double tick.
- **Workout mini-player** — a live pill above the dock on other tabs (sets done, rest countdown), the Train tab wears a
  progress ring, and the screen stays awake during a workout (Screen Wake Lock).
- **Finish moment** — a full-screen scene: your sets as a constellation, a closing ring, numbers counting up, the D27
  highlights and a typeset receipt.
- **Back where you left off** — if iOS closes the app mid-rest, the countdown returns, and a finished exercise hands
  over to the next.
- **In-app questions** for Finish, Undo set, Delete weigh-in and switching gym once sets are logged.

**Progress and History**
- **Chart** — a glowing head on the latest trend value, a glowing scrub beam, and the day as lived in the tooltip
  ("Full Body A · 12 sets · 30 min cardio").
- **Share your cut** — a 1080×1350 card from the Cut journey's facts with the trend line; "Show weights" off keeps only
  the changes; native share sheet or PNG.
- **History numbers** — the calendar shows morning kg, working sets or cardio minutes for the chosen filter; the day card
  leads with the morning reading (a post-workout reading used to hide it).

**Fixes found on the phone**
- "App error · Script error." after Safari's Share sheet.
- "1 readings" and every other count of one.
- Sheets stopping 46 pt above the screen edge.
- The keyboard covering Save in the weigh-in sheet; long values under "kg"; Safari's generic "Enter a valid value".
- The idle rest card taking space; a duplicate "set saved" alert over the workout header.
- Settings › Appearance › Reduced not stopping the canvas drift (pre-existing).
- Routine editor copy that contradicted D20/D24.

## Verification

| Check | Result |
|---|---|
| Deterministic suites, Node v26.8.2 | 22 suites · 617 passed · 0 failed · every exit 0 |
| D18 Train layout budget (`verify-train-browser`) | 6 / 6 at 320–430 px |
| Reduced motion, OS setting and in-app setting | 0 running animations on every screen, pill, Glance and finish |
| Chrome 402 and 320 pt | no overflow in new components, 0 console errors |
| iPhone 18 Pro simulator, iOS 27.0 (WebKit) | Today, transitions, sheets, keyboard, portal, orb, pill, ring, new best, Glance, resume after reload |

Not verified on a device: haptics (the simulator has none), wake lock, the share sheet with a file, launch images on a
fresh Home Screen install, and a View Transition caught mid-frame in WebKit (they ran without errors).

## Before this reaches the phone (owner decisions)

1. **Trial** — push the branch and open a PR for a deploy preview (seed data, cloud off, D23).
2. **Release** — assets keep `?v=161` and the service worker serves them stale-while-revalidate (D67), so a `RELEASE`
   bump is what makes installed apps pick this up promptly.
3. **Launch images** — iOS reads them at install time (unverified): re-adding NXTFRM to the Home Screen may be needed.
4. **Decisions** — D69–D86 in `DECISIONS-PROPOSED.md`.

## Backlog from the four audits (not built)

**Reliability first** (ecosystem audit, reproduced in Chrome with a stubbed client):
- Opening the app offline can sign you out: any session-check error signs out and drops the refresh token.
- Offline edits pop raw library errors ("TypeError: Load failed"), nothing retries on reconnect, and "last synced" is
  memory-only.
- Backups revoke the download link immediately (known to break Safari downloads, unverified); the share sheet is safer.
- Local storage headroom: the safety copy doubles the data, about 2–3 years to the ~5 MB budget; `storage.persist()`
  is never requested.
- supabase-js floats on `@2` with no integrity check and is never cached.

**Owner decisions on logic**
- The trend lags about 10 days (all 29 readings in 1M sit below it); a level-and-slope trend would change numbers.
- Two streak rules disagree (Today "5 weeks", finish card "6 weeks").
- `review()` still reads a stored check-in although check-ins are off (D55); on seed data it can flip the verdict.
- After 28+ days away the coach says "Baseline" while Aim says "Match your best" (`aimFor` has no baseline case).

**Next features, ranked by the audits**
- Train: Log pinned in the thumb zone (revisits D59/D18), one-tap "Log 30.5 × 12" with undo, warm-up ramp, plate maths,
  supersets, a swap sheet that shows history.
- Today: a card that follows the day (weigh-in → plan → result → tomorrow), a Why sheet that shows the evidence, a day
  card from the week rail, a "verdict changed today" marker.
- Progress and History: strength since cut start, edit any past record (cardio cannot be edited anywhere today),
  compare with the previous period, month in review, cut story timeline.
- Ecosystem: log weight from Siri or the Action Button (needs a small server inbox), a rest-end notification while in
  another app (Web Push), the plan in Apple Calendar (.ics).
