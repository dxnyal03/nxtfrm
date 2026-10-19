# Cut journey, Evidence and the Progress upgrades — report

Owner request (2026-10-19), with a screenshot of Progress › Cut journey and Evidence: "how can we improve this".
A mockup was proposed; the owner replied "yup i like the direction of the design". Proposed decision: D95 in
`tasks/elevate/DECISIONS-PROPOSED.md`.

Branch `cut-journey-evidence` (worktree `~/Developer/Worktrees/nxtfrm/journey`) on `origin/main` `b06e626`
(release 162). **Nothing pushed or deployed. `RELEASE` unchanged.** Presentation only: no calculation, storage key,
record shape or stored value changed.

## Why

The old card did not add up. "Now" is the smoothed trend, which lags about ten days; "Weekly rate" is the four-week
fit; "Projection" is a separate three-week fit that starts from where that line sits today. Dividing "to goal" by
the weekly rate gave a different number of weeks from the projection, and nothing on screen said why.

## What changed

- **Journey:** kg down since the start and kg to the goal lead in large type. The rail shows the road travelled
  (solid), the road ahead (dashed) and the goal range. The goal label carries the projected date. A net gain is
  drawn as ground to make up, in the review hue. Share is an icon in the header.
- **Evidence:** the four-week rate leads, with its share of body weight and the word `review()` uses ("Losing
  quickly", "Cutting steadily", "Trending up", "Flat", "Settling"). A gauge places it against `review()`'s own lines:
  the flat band and the 1% line. The likely range follows.
- **Projection:** the weeks, the date, and both inputs, for example "Your last 3 weeks: 80.7 kg today, −1.20 kg/wk".
  A trend under the goal range now reads "Below goal" instead of "in your goal range".
- **Confidence:** what it measures: "The 4-week rate is known to within ±0.07 kg a week".
- **Plateau:** a card only when there is one, with its length and the engine's reason.
- The leanness note moved into "Why NXTFRM says this". Strata no longer injects the Share button.

One test was adapted, not weakened: `wearables.weight-contract.test.js` looked for "Goal 80" in the journey markup.
The label now reads "80–82" over "Goal", so the check reads the label text in that order and asks for the whole range.

## Verification

| Check | Result |
|---|---|
| Deterministic suites, Node v26.8.2 | 22 suites · 617 passed · 0 failed · every exit 0 |
| D18 Train layout budget | 6 / 6 at 320–430 px |
| Text contrast (I4), measured against the rendered background | 133 texts in four tones, all AA, lowest 4.98:1 |
| Reduced motion, OS setting and in-app setting | 0 running animations on Progress |
| Draw-in | plays once on scroll-in; not on a repaint |
| Chrome at 320, 375, 390, 402 pt | no overflow, 0 console errors |
| Data states | losing quickly, cutting steadily, plateau, gaining, noisy, at goal, below goal, no goal, thin data, no weigh-ins in the period |

Not verified: WebKit and the iPhone simulator. Serving this worktree to the simulator needs a dev-server entry in
the tracked `.claude/launch.json` of the main checkout, which was left alone.

## Owner decisions

1. **Preview:** push the branch and open a PR for a deploy-preview link (seed data, cloud off, D23).
2. **Release:** bump `RELEASE` to 163 when shipping, so installed apps drop the cached 162 assets promptly.
3. **The "Now" figure:** it is the lagging trend. Making it lead (as the projection's start does) is a calculation
   change and needs a separate decision.

## Progress upgrades (owner: "okasy sure do all", 2026-10-19)

The owner asked for more Progress improvements, saw a three-concept mockup and a list of ideas, and replied "do all".
That list named two items as needing approval because they change data; "do all" is read as that approval (D97,
D100). Three more commits on the same branch: `d92e484`, `a3bcddf`, `b32476d`, plus this documentation.

- **Now that does not lag (D97).** Now is the level of the line through the last three weeks of mornings: the
  projection's own starting point. The smoothed trend line is untouched; a test pins it.
- **Milestones and rewind (D96).** Whole-kilogram dots and milestone chips; drag the bar, use its arrow keys, tap a
  milestone, scrub the chart or replay it, and the journey shows that day.
- **What-if pace (D96).** Drag the rate gauge's marker to see an arrival date at another pace.
- **Rate across your cut (D96).** The four-week rate on every day of the cut, against the flat band and the 1% line.
- **Trim (D98).** The top of the Weight view no longer repeats the journey and evidence.
- **Play your cut, Goal reached, lifts since the cut started (D99).**
- **Notes on the chart (D100).** Holiday, sick, refeed or other, as context.
- **Fix alongside.** The reading's time label under the chart figure measured 4.15:1; it now uses the next ink tone
  (4.95:1).

New suite `wearables.progress-plus.test.js` (14 tests): Now equals forecastGoal's fitted level and falls back to the
trend on thin windows, the trend is unchanged, the rate series matches detectPlateau on today and uses the D37
reference, the journey reads the same numbers, notes are cleaned on read, never created by reading, change no number,
and draw flags only in range.

The rate chart's builder sits after `chartHTML` on purpose: the release gate reads `chartModel…chartHTML` as the
weight chart's model and forbids a second y-axis there; the rate chart is a separate chart with its own axes.

### Verification (after all three commits)

| Check | Result |
|---|---|
| Deterministic suites, Node v26.8.2 | 23 suites · 631 passed · 0 failed · every exit 0 |
| D18 Train layout budget | 6 / 6 at 320–430 px |
| Text contrast (I4), measured against the rendered background | 161 texts on the journey, rewind, rate chart, chart header, what-if, strength card and all six story chapters: all AA, lowest 4.53:1 |
| Reduced motion, OS and in-app | 0 running animations on Progress, the story and the goal moment; the story never advances itself |
| Chrome at 320, 375, 390, 402 pt | no overflow, 0 console errors; every story chapter fits a 320×640 screen |
| Interactions | drag, keys, milestones, back to today, chart scrub and replay linkage, what-if drag and reset, story tap/hold/keys/close with focus returned, goal moment natural trigger once per session and demo link, notes add/show/remove |

Not verified: WebKit and the iPhone simulator, for the reason above; haptics (no hardware in the test browser).

### Owner decisions

1. **Preview:** push the branch and open a PR for a deploy-preview link. `?demo=goal` on the preview shows the goal
   moment on test data.
2. **Release:** bump `RELEASE` to 163 when shipping.
3. **Decisions:** D95–D100 in `tasks/elevate/DECISIONS-PROPOSED.md`.

## Week by week, and the tilt light removed (2026-10-19)

PR dxnyal03/nxtfrm#38 was merged by the owner (`f45e6e0`, Release 163). New branch `week-by-week-tilt` from it.

- **Week by week (D101).** Rebuilt from the proposal the owner approved ("okay"): bars for each week's change, an honest
  week in progress, context chips (lifts, cardio, notes), the fastest week starred, Show all, and rows that open in
  place to their seven mornings. Old ledger styles removed; scrub, replay and "Show on chart" still drive the rows.
- **Tilt light removed (D88 withdrawn).** Owner: "remove the tilt light not nice". The orientation listener, the
  reflections and canvas drift, the Settings › Appearance row and the styles are deleted.

| Check | Result |
|---|---|
| Deterministic suites, Node v26.8.2 | 23 suites · 631 passed · 0 failed · every exit 0 |
| D18 Train layout budget | 6 / 6 |
| Week list at 320, 375, 402 pt | no overflow, 0 console errors; open, Show all, Show on chart, replay all checked |
| Text contrast on the week list | 50 of 51 texts measured AA; the one flag was the workout dock overlapping the capture |
| Reduced motion, OS and in-app | 0 running animations |
| Tilt light | no Settings row, no `deviceorientation` listener, no API left |

Pushed as PR dxnyal03/nxtfrm#39 (with the follow-up that gives the weekly average label its own gutter, found on the
owner's screenshot). `RELEASE` is 163; shipping this needs 164.

## Whole-app pass and a distilled Today (2026-10-19)

Owner: "using the ios sim, now go through each of the pages and the whole nxtfrm, upgrade it and enhance the app
experience", then "tab switch animation not so aggressive", then "think of a more sleek way to do the Today page",
"be creative, think like a senior app designer", "match the design direction of NXTFRM". Same branch and PR.

**Today (D103).** It was about 2,560 px at 320 pt, roughly three screens: the training card, three full coach cards,
the minis, a Decision pushed below them, the scan tile and a Quick actions row, with "Full Body A · 6 of 15" said four
times. Now:
- one pill under the greeting for the morning: a lit "Log morning weight", then "✓ 81.7 kg this morning", which replays
  the weigh-in moment on the trend;
- the training card on its own, ending on its button, followed by the three numbers at a glance;
- the **Coach deck**: the notes stacked like iOS notifications, the top headline readable, a tap fanning them out with a
  View Transition and Show less folding them back;
- the Decision and the latest scan;
- about 1,670 px at 320 pt, with nothing removed that is not one tap away.
A three-step "Your day" strip was tried first and replaced: it repeated the training card in a box of its own.

**Everywhere else (D102).** Edit or delete a cardio session from History; "Last time" set by set in Train (under the
set card, so Log set does not move down); a day's chart note in its History card; Data & sync on the hub's glass cards;
one Edit for scan history; 44 pt targets for the gym toggle and the scrolled title; calmer tab transitions and a fix for
the "App error" toast after a quick second tab tap.

| Check | Result |
|---|---|
| Deterministic suites, Node v26.8.2 | 23 suites · 631 passed · 0 failed · every exit 0 |
| D18 Train layout budget | 6 / 6 at 320–430 pt |
| Whole-app crawl at 402 and 320 pt | 21 screens, 0 console errors; no new overflow or small targets (the flags are screen-reader text, the cropped ghost word, and the existing calendar cells at 320) |
| Text contrast on new surfaces | all ≥ 4.5:1 after darkening the logged pill (it measured 2.5:1 on the bright sky) |
| Reduced motion | OS: 0 running animations, the deck opens in place; in-app: only the settle from changing the setting |
| Functional, disposable profile | cardio edit prefilled → saved in place → "Cardio updated"; delete asks → removed; Last time fills kg and reps; scan Edit reveals Delete; the deck opens, focuses Show less, folds back; the pill replays the moment |

`RELEASE` unchanged (163).
