# Elevate — native-grade iPhone experience (plan)

Owner request, 2026-10-18: "elevate the whole NXTFRM experience now that you can actually see the app on the
phone — visual upgrade, animation upgrade, upgrade everything." Built on branch `elevate-ios-experience` from
`origin/main` 0ea0fd2 (release 161), verified on an iPhone 18 Pro simulator (iOS 27.0) and in Chrome.

Binding: AGENTS.md, the four NXTFRM skills, DECISIONS.md (D2–D17, D19+ and I2, I4–I6, I10–I12). Presentation and
interaction only: no calculation, storage key, record shape or stored value changes. Every motion has a
reduced-motion path (OS setting and Settings › Appearance). No RELEASE bump, push or deploy without approval.

## What the phone showed (before)
- Five tabs, five frames: side margins 20 / 12 / 12 / 32 / 32 pt and titles 34 / 28 / 36 / 36 / 38 pt at different heights.
- Tab changes are hard cuts, and a tab opens at the previous tab's scroll position (Settings opened at its bottom
  after scrolling Today; Today came back at the wrong place).
- Scrolled content runs under the clock and status icons with nothing behind them.
- Installed app: the first frame is white before the dark launch overlay (no `apple-touch-startup-image`).
- Safari's Share sheet makes the app show "App error · Script error." (a detail-less cross-origin report).
- Sheets stop 46 pt above the screen bottom (a V33 rule adds the safe area twice).
- Weigh-in sheet: the keyboard covers Save (and on refocus the sheet does not lift); long values run under "kg";
  extra decimals get Safari's generic "Enter a valid value".
- "1 readings".

## Slices (one commit each)
1. **iPhone fixes** — ignore detail-less "Script error."; dark launch images for every iPhone size, drawn from
   the launch overlay's own first frame; singular/plural counts; one-decimal weight entry with auto-fit numerals;
   sheets meet the screen edge; sheets rise above the keyboard with the primary action pinned in view.
2. **One page frame** — one gutter token (16 pt, 12 pt under 360), one masthead (context line above a 34 pt Geist
   title) at the same height on every tab. Active Train keeps its own instrument frame (D6/D18 untouched).
3. **Native tab navigation** — every tab keeps its own scroll position; tapping the active tab scrolls to top;
   tab changes move in the direction of travel (View Transitions; dock and canvas stay still).
4. **Scroll-aware top chrome** — a frosted status-bar scrim once content scrolls, and a compact title bar when the
   page title scrolls away (tap it to return to the top). Hidden during an active workout.
5. **Haptics** — a light system tick on Log set, Save weigh-in, Log cardio and Finish (iOS 18+ switch haptic;
   Android vibrate). Follows the phone's own System Haptics setting; nothing stored.
6. **Docs** — report with before/after evidence and proposed decisions D69+.
