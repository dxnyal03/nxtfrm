# Cut journey and Evidence — report

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
