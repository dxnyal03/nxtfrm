# Ascension · launch (startup) report

Workstream E, plan item 7. Branch `ascension`, nothing committed or pushed. Scope: `index.html` head and launch script, two values in `manifest.webmanifest`, one append-only block at the end of `strata.css`.

## Result

The launch is now one overlay with one reveal. The launch colour `#07060B` is the same everywhere (html, theme-color, manifest, overlay). The overlay is opaque from the first frame until the hold is met and the app is ready, then a single staged exit runs. The old half-transparent "veil" state is gone. Nobody can get stuck: an absolute timer, visibility and bfcache handling, and a failsafe for the pre-paint layer all clear the screen. D27's character and timing are kept (N draw, tip flare, greeting, tap to skip, reduced-motion still frame).

Verification: 83 checks pass, 0 fail (`launch-verify.mjs`, real Chrome, CDP screencast frames mapped to page time). The same harness against `HEAD` fails 10 of 65, which is the old veil, the ignored in-app reduce-motion setting and early-frame leaks. Deterministic suites: 21 suites, 586 tests, 0 failures (baseline was 18 suites and 490 tests; other agents have added suites since).

## What changed

| File | Change |
|---|---|
| `index.html` line 2 | `<html style="background:#07060B;color-scheme:dark">` |
| `index.html` line 13 | `<meta name="color-scheme" content="dark">` with an explanatory comment |
| `index.html` line 2622 | `theme-color` `#121216` to `#07060B` |
| `index.html` lines 2629–2645 | head script "Launch veil" (flat `#07060B` layer, see stage A) |
| `index.html` line 2657 | `<body style="margin:0;background:#07060B">` |
| `index.html` lines 2659–2803 | launch script rewritten (still the first script after `<body>`) |
| `manifest.webmanifest` | `background_color` and `theme_color` `#121216` to `#07060B` |
| `strata.css` line 2805 | `/* ===== Ascension · launch reveal ===== */` block (shell and dock entrance) |

Colour decision: before, `theme-color` and the manifest said `#121216`, the splash `#0d0c12`, and the page canvas (strata.css `html{background:#07060B !important}`) `#07060B`. I chose `#07060B` because it is the app's real canvas: no colour step between the OS launch surface, the first frame, the overlay and the revealed app, and it is the darkest value, so the glow reads best on it.

## Lifecycle as implemented

**A. First frame.** The canvas is dark before any stylesheet is parsed (html style attribute and `color-scheme` meta; OS chrome and launch screen come from `theme-color` and the manifest). The four stylesheets stay render-blocking and synchronous. A tiny head script (placed before the stylesheet links, so it is not held back by them) puts a flat `#07060B` fixed layer into the DOM before any frame can exist. The launch script, which runs once the CSS has arrived, swaps it for the overlay (same colour, same task). Why the veil exists: the launch script is held back by the pending CSS, and a frame already in the rendering pipeline can reach the screen first. Under CPU throttling that frame showed the bare aurora canvas for 1 to 4 frames in several full runs (see Limitations for the measurements). Failsafes: removed at `DOMContentLoaded`, at 3.5 s, on any launch-script failure (`done()`), and never created when the session flag is set.

**B. Hold.** The overlay is opaque (backdrop alpha 1, opacity 1) and nothing of the app shows through. Choreography, all from the first visible frame:

| Element | Timing |
|---|---|
| glow bloom | 0 to 0.96 s, eased to track the draw (was 0.72 s expo-out, which finished before the N did) |
| N draw | 0 to 0.78 s, unchanged |
| tip flare | 0.62 to 0.86 s, unchanged |
| mark settle | scale 1.015 to 1, 0.86 to 1.10 s (new, 240 ms) |
| greeting | 0.70 to 1.08 s, unchanged |
| wordmark | 0.90 to 1.18 s, unchanged |
| fine grain over the glow | the app's own noise image (strata `body::after`), because the 8-bit glow gradient showed concentric rings (measured: about 15 luminance steps over 340 px) |

The hold is 1.55 s measured from the overlay's first visible frame (the later of: first rAF after insertion, `first-paint` entry; falls back to the insertion after 1.5 s on an engine that reports neither), not from script insertion, so a slow cold start still gets the whole draw and rest.

**C. Reveal** (starts when hold is met and the app is ready; a tap skips the hold but never the wait for the app). "Ready" means `__nxSplashReady()` (called by `bootApexcut` after the first `render()`), plus two animation frames (the app has painted once), plus `document.fonts` settled (Geist is `font-display:swap`). Then, once:

| Layer | Timing |
|---|---|
| mark and greeting fade out | 0 to 140 ms |
| backdrop fades | 60 to 420 ms (60 ms lead, 360 ms) |
| `<main>`, cloud banner and dock settle by 6 px | 60 to 480 ms, `cubic-bezier(.32,.72,0,1)` |
| overlay removed | +440 ms |
| html classes and listeners removed | +500 ms |

The mark leaves before the app's text becomes legible, so it never ghosts over the dashboard (contact sheet below). Controlled by classes on `<html>`: `nx-launching` while holding (a marker; no CSS keys on it), swapped for `nx-reveal` at the reveal, both gone at the end. The overlay releases `pointer-events` at the reveal start and taps reach the dock during the fade (11 of 11 samples).

**D. Settled.** Overlay, its style element, html classes, veil and listeners are all removed. The entrance cannot replay on tab changes (checked: no `nx-*` animation appears while switching all five tabs) because it exists only while `html.nx-reveal` does.

Total, first visible frame to overlay removed: hold 1.55 s plus reveal 0.44 s is about 1.99 s (measured 1992 ms and 1994 ms). The old sequence was about 1.9 s; D27's budget is 1.9 s plus or minus 20 percent.

## Fallbacks and safety

- Absolute fallback: 2.2 s after the overlay is inserted, the reveal starts regardless of readiness (never-ready run: overlay removed 2641 ms after insertion).
- Visibility: on `visibilitychange` hidden the timers are cleared (they are throttled in the background); on return they are re-armed from the clocks (`max(performance.now(), Date.now())`), and if the deadline passed the overlay is removed immediately. `pagehide` and `pageshow` with `persisted` (bfcache) also finish it. `resume` is handled like visible.
- Body null guard: the script is the first thing after `<body>` (confirmed), and uses `(document.body || document.documentElement)` if it ever runs in the head.
- Gate: unchanged `sessionStorage 'nxSplash'`. A standalone home-screen PWA cold launch opens a new browsing context, so storage is empty and the sequence plays once. Reloads and in-app navigations in the same session find the flag and skip. Resuming a PWA that is still alive is not a launch, so nothing replays. This is documented in the script's header comment.
- Never half-built: the reveal waits for the app (late-ready run: the overlay stayed opaque past the 1.55 s hold and revealed 29 ms after the app signalled).

## Reduced motion

Both the OS setting and the app's own (Settings, Appearance, stored at `apm_settings.cutSupport.appearance.motion === 'reduced'`) give a still frame: no animation, no fade, no entrance, instant swap. The app's setting is read from storage because `premium-ui.js` has not applied `data-nxp-motion` yet when the launch script runs (the old script ignored it: 5 animations were running with it set). The still frame is held at least 0.5 s, then removed as soon as the app is ready (the old code force-finished at 0.5 s even if the app had not rendered; here it waits for the app, capped by the same 2.2 s). CSS carries the media-query path too, and the strata block disables the entrance under both `prefers-reduced-motion` and `data-nxp-motion="reduced"`.

## Deviations from the brief, and why

1. **No second inline `<style>`.** `wearables.release-gate.test.js` pins exactly one inline `<style>` (`styleOpens === 1`). The first-frame rules are an inline `style` attribute on `<html>` and `<body>` plus the `color-scheme` meta instead. They apply even earlier than a style block would and cannot be overridden by the legacy rules. Pixel check: serving the current page with and without these head changes gives 0 differing pixels on all five screens at 390 and 1280.
2. **Entrance on `<main>` and the dock, transform only, no opacity.** A transform on `.app` re-anchors the `position:fixed` dock (a child of `.app`) to the app's box for the whole animation. Opacity below 1 on `<main>` makes it a backdrop root, so every glass tile inside stops blurring the aurora behind it for 420 ms and snaps back at the end. Measured at the last frame of the entrance: with opacity 6.6 percent of the screen differed from the settled page by up to 29/255; transform only 0.005 percent (max 3). The fade comes from the overlay's backdrop instead. Geometry check at 390, 320 and 1280: `main` and the dock sit exactly 6 px low at the first frame, 0 at the last, never move on x, and size and document height never change.
3. **Overlay split into backdrop and content layers** (new DOM: `.nxs-bg`, `.nxs-fg`) for the staged exit. A single fade of the whole overlay put the half-faded greeting over the dashboard text for about 250 ms.
4. **Hold counted from the first visible frame**, not from insertion (see B).
5. **Reduced motion waits for the app** (see above) instead of a fixed 0.5 s.
6. **A head script was added** (the veil). I first tried moving the whole launch script into the head ahead of the stylesheets, which closes the race by construction (route-override experiment: 73 of 73 checks, 0 leaked frames). The in-file edit was refused by the permission check (Modify Shared Resources) because it re-orders the stylesheet links and `</head>`, so I did not retry it by other means and shipped the smaller additive veil instead. If you want the move, it is two small edits (links and `</head><body>` below the script); say so and it can be done with approval.

## Verification (real output)

Harness: `/Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/launch-verify.mjs [after|before]`. Cold launches in fresh contexts, no service worker, 390x844 and 1280x900, frames from a CDP screencast. Logs: `launch-results.after.log.txt`, `launch-results.before.log.txt`. The machine was loaded by other agents throughout (load average 10 to 34), so absolute times drift by 100 to 200 ms between runs; the relations below do not.

Final run, variant after: `=== 83 passed, 0 failed, 25 informational ===`. Representative lines (phone 390, same run):

```
INFO  phone timeline  splash inserted 21ms, first-paint 84ms, app ready() 776ms, reveal start 1634ms, overlay removed 2076ms, frames 219
PASS  phone (a) no app pixel in any frame before the reveal  95 frames ... 84ms to 1634ms (6742720 pixels tested outside the glow); frames with pixels off the launch colour: 0; worst deviation 5.19
PASS  phone (a) a launch-colour layer is in the DOM before this document's first painted frame  head veil in the DOM at 14ms, overlay at 21ms, first-paint 84ms
PASS  phone (a) overlay stays fully opaque until the reveal (no half-transparent veil)  40 samples before reveal, 0 not opaque
PASS  phone (b) overlay gone by 2300 ms  removed at 2076ms  /  shell settled (opacity 1, no transform, no launch classes)
PASS  phone (c) overlay releases pointer events when the reveal starts / the app takes input after launch / taps reach the dock while the overlay is lifting
PASS  phone (f) second navigation in the same session shows no splash and no veil / reload shows no splash
PASS  reduced-media (d) overlay is a still frame (anims=0, N fully drawn); gone at 947ms (app ready 930ms); held 891ms
PASS  reduced-app-setting (d) the app's own reduce-motion setting gives the still frame  anims=0; removed 923ms
PASS  never-ready (e) fallback removes the overlay  removed at 2681ms = 2641ms after the overlay appeared
PASS  (g) no page errors in any run      PASS  (h) theme-color #07060B, manifest background_color and theme_color #07060B
```

`(a)` test method: every screencast frame from first paint to the reveal start is compared, in 8x8 block means (the overlay carries a few levels of grain), against the launch colour outside the glow circle. The `HEAD` run proves the test can fail: phone 20 of 67 frames leaked (worst deviation 108/255), 17 of 37 samples had backdrop alpha between 0.44 and 0.98, reveal started at 1592 to 1662 ms.

Further scenarios, all passing in the final run:

| Scenario | Result |
|---|---|
| tap to skip | reveal 33 ms after the tap |
| app late (ready at 1950 ms) | overlay waits, reveals 29 ms after ready, 0 leaked frames |
| tap before the app is ready | skips the hold, still waits: reveal 20 ms after ready |
| web font delayed past the hold | reveal waits for the font (1949 ms), never into a swap |
| web font never arrives | absolute fallback, removed 2642 ms after insertion |
| hidden at 0.4 s, back after the deadline (simulated visibility events) | overlay removed 5 ms after returning, nothing stuck |
| hidden briefly, back in time | revealed once, cleaned up |
| `pageshow` with `persisted` mid-launch | removed immediately |
| main thread blocked 450 ms right after insertion | hold counted from the first visible frame: reveal 1550 ms after it |
| launch script fails to parse / throws | veil gone by `DOMContentLoaded` / immediately, app usable, no overlay left |
| 4x and 6x CPU throttle, and 4G plus 4x | completes, 0 leaked frames; reveal 1551 to 1750 ms after first paint; reveal phase had 0 frames over 34 ms (the hold phase hitches while the app renders, same as before) |
| stylesheets held back 1.2 s | nothing of the document paints before the overlay exists; first painted frame is the launch colour (mean 12,11,16 with grain) |

Other checks: layout shift entries 0 at and after the reveal; no `position:fixed` descendants of `<main>` at launch; frame cadence old vs new at 1x and 4x CPU is the same (`launch-jank.mjs`: 0 dropped frames at 1x for both; at 4x the dropped frames are in the hold phase, 2 to 3 for both).

Frames (all under `/Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/shots/launch/`), viewed:

- `after-phone-0060ms.png` is the first painted frame: launch colour with only the faint track of the N (no draw yet, no glow yet). `after-phone-0900ms.png`: N drawn, glow, greeting. `after-phone-1500ms.png`: full composition with wordmark, nothing of the app behind it. `after-phone-2300ms.png`: the settled Today screen. `after-phone-3200ms.png`.
- `after-desktop-0900ms.png`, `...-1500ms.png`, `...-2300ms.png`, `...-3200ms.png`; `after-reduced-media-0300ms.png` (the still frame); `after-slow-css-first-frame.png`.
- `after-reveal-seek-390.png`: deterministic contact sheet of the reveal at 0, 40, 80, 120, 160, 220, 320 and 500 ms (animations stepped, so it does not depend on machine load). The mark is out by 120 ms, the app comes in under the lifting backdrop, settled by 500 ms. `before-reveal-strip-390.png` is the old sequence: the dashboard is visible under the mark for the whole lead-up.
- `before-phone-1500ms.png` shows the old veil (dimmed dashboard under the N and greeting).

Supporting scripts in the same folder: `launch-pop.mjs` (the backdrop-root measurement), `launch-geometry.mjs`, `launch-head-ab.mjs` and `launch-scheme-ab.mjs` (head attributes and `color-scheme` are pixel-inert), `launch-jank.mjs`, `launch-strip-seek.mjs`, `leak-dbg.mjs` (the early-frame race experiments).

Deterministic suites: `for f in wearables*.test.js; do node "$f" || echo FAIL $f; done` printed no FAIL: 21 suites, 586 tests passed, 0 failed (including the release gate: 54 passed, 0 failed). Syntax: `node --check` on both extracted inline scripts passes; `strata.css` braces balance (2011 and 2011 at the time of the first check, re-checked after each edit); exactly one `<style` in `index.html`.

## Limitations and open items

1. **Not tested on a real iPhone or a standalone PWA.** WebKit-specific points rely on fallbacks rather than tests: `PerformanceObserver` `first-paint` (if absent the hold anchors to the insertion after 1.5 s), the individual `translate` property on the dock (if unsupported the dock simply does not shift), `inset` shorthand, `will-change`. The Browser pane was not used; verification is Playwright with real Chrome.
2. **iOS launch screen is out of reach of this slice.** iOS shows its own launch surface before any web content and does not read the manifest colours; the repo has no `apple-touch-startup-image` links. A flat `#07060B` PNG per iPhone resolution (a few KB each), the matching link tags, and entries in `sw.js` would close it. Outside the files this slice may edit.
3. **A frame can still precede the overlay for a moment**, but only as the flat launch-colour veil, never the app. Measured on the pre-veil version: 1 to 4 frames of the bare aurora canvas (no tiles, no text) ahead of the overlay in 4 of 5 full-harness runs that had the throttled scenarios (cpu-6x and 4G plus 4x), and in 1 of 36 bare 6x launches, so it depends on timing and on load. With the veil: 0 leaked frames in every throttled scenario of the six complete full runs since it was added.
4. **Real backgrounding cannot be reproduced in headless Chromium.** CDP `Page.setWebLifecycleState frozen` did not freeze a visible page, so that test was dropped rather than reported as a pass. The visibility logic is verified with simulated `visibilitychange` (overridden `document.hidden`), `pageshow` with `persisted`, and the short-hide case.
5. **Very slow starts are unchanged in kind.** If the app is not ready 2.2 s after the overlay appears, the shell is revealed before its first render (as before this slice). While the Tesseract and Supabase CDN scripts block the body, `ready()` is later (0.7 to 1.0 s locally; 0.1 to 0.5 s in runs where they were out of the tree), so the perf workstream's lazy loading moves that number but not this logic.
6. **Release bump needed.** `strata.css` changed under an unchanged `?v=161`. The service worker is network-first so online launches pick it up, but the lead should bump `RELEASE` with the other slices and re-run the gate. No new `.js` or `.css` file is requested, so the offline shell list needs no change.
7. **`html.nx-launching`** is a marker for the launch phase (used by the tests); no stylesheet keys on it.
8. **I8** gives 280 ms for spatial moves; the shell settle is 420 ms as the brief asked, a one-off for launch.
9. A leftover of my own CPU stress test (two busy-loop `node` processes) was running for a while and skewed some measurements and other agents' CPU; both were killed and the final runs were taken after.

## Re-run

```
node /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/launch-verify.mjs after    # dev server on :8763
node /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/launch-verify.mjs before   # serves HEAD copies from launch-baseline/
node /Users/alidanial/Library/Caches/DanDev/nxtfrm/ascension/launch-strip-seek.mjs 390
cd /Users/alidanial/Documents/NXTFRM && for f in wearables*.test.js; do node "$f" || echo FAIL $f; done
```
