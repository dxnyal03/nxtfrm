# Elevate — proposed decisions (awaiting owner approval)

All presentation and interaction. None changes a calculation, a storage key, a record shape or what a number means;
every motion has a reduced-motion path (OS setting and Settings › Appearance). Numbering continues from the Ascension
proposals (D60–D68).

| # | Decision |
|---|---|
| D69 | **Living sky.** The canvas follows the device clock: dawn 05–09 (apricot), day 09–17 (orchid), dusk 17–21 (violet), night 21–05 (indigo, stars forward). Titles pick up the hour's light. Static under reduced motion. |
| D69a | **Dark launch images.** `apple-touch-startup-image` for 13 iPhone sizes, each the launch overlay's own first frame (D65), rendered by `tasks/elevate/splash.mjs`. |
| D70 | **One page frame.** One gutter (16 pt, 12 pt under 360) and one masthead (context line over a 34 pt Geist title) on every tab. Active Train keeps its own frame (D6, D18). |
| D71 | **Native tab navigation.** Per-tab scroll memory, re-tap to top, View Transitions (title travels with direction; session name and trend figure morph; Start workout opens as a portal). Plain swap without support or under reduced motion. |
| D72 | **Scroll-aware top chrome.** A frosted strip under the status bar once scrolled; a glass title capsule once the title has gone (tap to top). Hidden in a workout. |
| D73 | **Withdrawn (owner, 2026-10-19).** The "Muscles this week" body map on Today was built, then removed at the owner's request ("remove muscles worked from the today page"). Its code and styles are deleted; nothing else used them. |
| D74 | **Rest orb and set ignition.** The rest strip is a ring driven by the engine's countdown with an 8 s breath, a last-10 s pulse and "Go" when a rest runs out; "Up next" shows the coach's target for the next set. A logged row gets one sweep of light. |
| D75 | **Workout mini-player.** While a lift session is under way (logged sets, not finished) other tabs show a live pill (sets done, rest); the Train tab wears a progress ring; Screen Wake Lock while the workout is on screen. |
| D76 | **In-app questions.** Finish workout, Undo last set, Delete weigh-in and a gym switch with logged sets ask in a glass sheet instead of `confirm()`; same answers. |
| D77 | **Finish moment and your sky.** Finishing opens a full-screen scene (constellation of the session's sets, closing ring, counted numbers, D27 highlights, typeset receipt; volume = load × reps of working sets). Background stars are lifting days of the last 16 weeks. |
| D78 | **Haptics.** A system tick on saves and while scrubbing (iOS 18+ switch haptic; Android vibrate); follows the phone's System Haptics setting. |
| D79 | **Dynamic Island alerts.** Toasts grow out of the island, are announced (role=status) and restart their timer per alert; a workout's "set saved" alert is announced but not drawn. |
| D80 | **Keyboard-safe sheets.** Sheets meet the screen edge, ride on the keyboard with the confirm button pinned; weigh-in keeps one decimal, fits long values and states what it expects. |
| D81 | **Today and chrome polish.** A warning verdict leads Today; Liquid Glass dock; stretchy titles; a morning weigh-in chip (04–12, until logged); the chart's latest trend value glows and the tooltip names the day as lived (session, sets, cardio). |
| D82 | **Glance mode.** After 8 s untouched during a rest: a near-black view with countdown, next load, set and session clock. Any touch or key returns; 20 s grace after a manual return. |
| D83 | **New best, per set.** The set that first passes every earlier session (D27's rule) carries a lit star; light burst and double tick when fresh. Nothing stored. |
| D84 | **History numbers.** The calendar shows the filter's own number (morning kg, working sets, cardio minutes); the day card leads with the morning reading (D7) and lists later readings under it. |
| D85 | **Share your cut.** A 1080×1350 card from the Cut journey's facts with the morning trend line and lifting days; "Show weights" off keeps only the changes; Web Share or PNG. Nothing stored or sent by the app. |
| D86 | **Back where you left off.** A rest interrupted by iOS closing the app resumes on reopening (last set's time + the engine's rest length; nothing stored; a +30 s is not remembered); the first workout screen after launch moves off a finished exercise. |
| D75b | **Live dock.** On phones the live workout is a row inside the dock's glass above the tabs; wide layouts keep the floating pill. |
| D87 | **Touch light.** Glass catches light under the finger, follows it while pressed, then opens out and fades (D38's ripple made continuous). |
| D88 | **Tilt light.** Where the phone reports orientation, a reflection sweeps across tiles and the canvas drifts with the tilt; iPhone asks once from Settings › Appearance; nothing stored. |
| D89 | **Dock shortcuts.** Long-press or right-click a dock tab for its shortcuts, each calling an existing function; a tap still switches tab. |
| D90 | **Pull to weigh in.** A rubber-band pull at the top (the root sets `overscroll-behavior:none`); on Today, releasing past the line opens the weigh-in. Not in sheets, fields, chart, rail, calendar or a workout. |
| D91 | **Session prints.** Each lifting session draws an artwork from its sets (ribbon per exercise, thicker with more kg lifted; bead per set) in History's day card and the finish scene. Seeded by date; nothing stored. |
| D92 | **The weigh-in moment.** Saving this morning's reading shows it landing on the last three weeks of mornings and the trend, with its gap to trend, to the previous morning, and "Lowest reading yet". |
| D93 | **The Observatory.** An explorable sky: one constellation per routine (by shown name), stars brighter with more sets, flares for new bests (D27), walks clustered; pan, pinch, tap, open in History. |
| D94 | **Depth while scrolling.** Cards recede as they pass under the frosted top bar (CSS scroll timelines where supported). |
| D95 | **Cut journey and Evidence that add up.** The journey leads with kg down and kg to the goal. Its rail shows the road travelled (solid), the road ahead (dashed) and the goal range, and the goal label carries the projected date (D28). Evidence leads with the four-week rate and its share of body weight, on a gauge drawn on review()'s own lines (the flat band and the 1% line), with the word review() uses. The projection names both of its inputs, where the last three weeks put you today and their pace, so the weeks add up on the card. Confidence says what it measures (the rate to within ±kg a week). A plateau takes a card only when there is one. Share becomes an icon in the header; the leanness note moves into "Why NXTFRM says this". The engine now exports its flat-band constant (`flatKgWeek`, value unchanged) so the card reads the same threshold as the verdict. |
| — | **Trial data.** `seed.dev.js` (localhost and previews only, D23) adds five recent weeks of Full Body A/B/C and today's session under way on a lifting day. |

