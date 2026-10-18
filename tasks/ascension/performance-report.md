# Performance and reliability pass (Ascension workstream G)

Branch `ascension`, baseline `029eb51` (release 161). `RELEASE` and `CACHE_NAME` stay at 161. Measured 2026-10-13 on one Mac (Chrome 155 via Playwright). PLAN item 8. Written by the performance agent; saved by the orchestrator because the agent's harness refused the file write.

## 1. What changed, and the result

| # | Change | Where |
|---|---|---|
| B | Tesseract OCR is no longer a launch-time script. `loadTesseract()` fetches the same URL the first time "Read scan" is tapped. | `index.html` |
| C | The 13 `wearables.*.js` modules are no longer loaded or precached. Files and suites stay. The dev-only fixtures loader skips itself when the modules are absent. One Settings sentence made true. | `index.html` script block, `sw.js` `VERSIONED`, `premium-ui.js` `dataView()` (one line) |
| D | Service worker: cache-first for this release's `?v=` files and the font/icons; network-first for navigations and everything else. (Revised afterwards by the orchestrator's decision to stale-while-revalidate; see §12.) | `sw.js`, new `wearables.sw-strategy.test.js` |
| A, E | Measurement tooling and a startup cost inventory. | cache folder, section 7 |

| | Before | After |
|---|---:|---:|
| Script requests at launch (production host / localhost) | 22 / 23 | 8 / 8 |
| JS requested, bytes (production host / localhost) | 1,329,003 / 1,408,137 | 909,236 / 909,236 |
| Home renders at launch (returning user) | 2 | 1 |
| Legacy-UI Home painted before the real one (slow link) | yes | no |
| IndexedDB opened on every launch | yes (13-store database) | no |
| Offline-shell entries precached | 32 | 19 |
| JS heap after GC (MB) | 2.4 | 2.0 |
| 4x CPU, returning user: ScriptDuration (ms) | 130 | 116 |
| 4x CPU, returning user: DOMContentLoaded (ms) | 363 | 339 |
| 4x CPU, returning user: load event (ms) | 394 | 344 |
| 4x CPU, returning user: Home UI first visible (ms) | 362 | 338 |
| 4x CPU + Slow 4G, returning: DOMContentLoaded (ms) | 2805 | 2404 |
| 4x CPU + Slow 4G, returning: Home UI first visible (ms) | 2804 | 2403 |
| 4x CPU + Slow 4G, returning: legacy Home first painted | 2233 | none |
| 4x CPU + Slow 4G, returning: load event (ms) | 2902 | 2409 |
| 4x CPU + Slow 4G, returning: layout work (ms) | 160 | 57.9 |

What the numbers say:

1. **Startup does less work.** 14 fewer script requests on a production host, 420 KB less JavaScript requested (about 78 KB on the wire with brotli), one Home render instead of two for a returning user, no IndexedDB open, a 15% smaller JS heap, and an offline shell that precaches 13 fewer files.
2. **Startup is more reliable, and this is the larger win.** The wearable modules caused a second `NXT.repaint()` after IndexedDB opened. On a slow link it fires while the parser is still waiting for `premium-ui.js`, so the first Home the user saw was the old V99 layout, about 600 ms before the real one (§5.4). Removing the Tesseract tag removes a launch-blocking CDN dependency: with that request stalled the app did not boot at all (§4).
3. **On a fast link the saving is modest and a returning user's CPU time is flat.** First Home paint is 7 to 11% earlier and script time falls 9 to 11%. Style recalc rises about 80 ms at 4x because the Home entrance animation now plays to the end; before, the second render replaced the Home DOM 78 ms in and cut 6 of its 13 running animations.

## 2. How it was measured, and what to distrust

- `perf.mjs`: 390x844 mobile Chrome, fresh context per run, `sessionStorage.nxSplash=1`, `Emulation.setCPUThrottlingRate` 4, then `Performance.getMetrics`, navigation timing, response sizes of every script, and a `MutationObserver` on `#homePage` for the first Home paint. Medians.
- Two scenarios. **fresh**: empty storage, so localhost seeds fake data. **returning**: storage carried over from a warm-up context, no seeding, closest to a real launch.
- **The machine was shared and busy** (load average 3 to 25 from other agents) and jsDelivr latency varied by about 0.5 s between runs. The comparison that counts is the **interleaved A/B on frozen copies of the app** (`perf-tree/S0` = tree at 13:23; `S1` = S0 plus exactly this pass's `index.html` edits), runs alternating A,B,B,A. The two CDN scripts are served from disk so network variance is out of the CPU numbers.
- **Slow 4G** rows add CDP network emulation (150 ms RTT, 1.6 Mbps down), the local server answering in brotli like Netlify, and the CDN scripts delayed accordingly. A model, not a phone.
- **"Home UI first visible"** is the first paint containing the Strata UI. **"Home, any content"** also counts the old V99 render, which is what exposed the flash.
- The live-server runs in `perf-before.json` / `perf-after.json` (`spec_live`) are not like-for-like: the live tree grew by 31.6 KB JS and 20 KB CSS from other workstreams while measuring (+41 ms ScriptDuration at 4x, mostly the new coach pipeline; §7 item 12).

## 3. Full tables (frozen trees, interleaved)

### 3.1 4x CPU, CDN scripts local, returning user (median of 11 pairs)

| Metric | Before | After | Change | Pairs improved |
|---|---:|---:|---:|---:|
| ScriptDuration | 130 | 116 | -14.2 (-10.9%) | 11/11 |
| TaskDuration | 549 | 570 | +20.6 (+3.8%) | 2/11 |
| Layout | 69.6 | 59.2 | -10.4 (-14.9%) | 10/11 |
| Style recalc | 64.6 | 147 | +82.4 (+127.6%) | 0/11 |
| domInteractive | 251 | 222 | -28.7 (-11.4%) | 11/11 |
| DOMContentLoaded | 363 | 339 | -23.6 (-6.5%) | 10/11 |
| load event | 394 | 344 | -50.1 (-12.7%) | 11/11 |
| Home UI (Strata) first visible | 362 | 338 | -23.9 (-6.6%) | 10/11 |
| JS heap after GC (MB) | 2.4 | 2.0 | -0.4 (-15.3%) | 11/11 |
| JS bytes requested | 1,408,137 | 909,236 | -498,901 (-35.4%) | 11/11 |
| Script requests | 23 | 8 | -15 (-65.2%) | 11/11 |
| Home renders at launch | 2 | 1 | -1 (-50.0%) | 11/11 |

Style recalc doubles and TaskDuration is flat because the entrance animation now runs its full ~800 ms. Traced: before, running animations went 13 to 7 within 78 ms of the first frame; after, 13 run to completion.

### 3.2 4x CPU, fresh (localhost seeds fake data; median of 11 pairs)

| Metric | Before | After | Change | Pairs improved |
|---|---:|---:|---:|---:|
| ScriptDuration | 162 | 148 | -14.1 (-8.7%) | 11/11 |
| TaskDuration | 537 | 458 | -79.2 (-14.8%) | 11/11 |
| Layout | 64.9 | 61.5 | -3.4 (-5.2%) | 9/11 |
| Style recalc | 61.4 | 53 | -8.4 (-13.7%) | 11/11 |
| domInteractive | 364 | 334 | -30.2 (-8.3%) | 11/11 |
| DOMContentLoaded | 404 | 376 | -27.4 (-6.8%) | 11/11 |
| load event | 427 | 383 | -44.6 (-10.4%) | 11/11 |
| Home UI (Strata) first visible | 333 | 302 | -30.7 (-9.2%) | 11/11 |
| JS heap after GC (MB) | 2.4 | 2.0 | -0.4 (-15.5%) | 11/11 |
| Home renders at launch | 3 | 2 | -1 (-33.3%) | 11/11 |

### 3.3 4x CPU plus emulated Slow 4G, returning user (median of 9 pairs)

| Metric | Before | After | Change | Pairs improved |
|---|---:|---:|---:|---:|
| ScriptDuration | 115 | 113 | -2.3 (-2.0%) | 8/9 |
| TaskDuration | 743 | 565 | -179 (-24.0%) | 9/9 |
| Layout | 160 | 57.9 | -102 (-63.8%) | 9/9 |
| domInteractive | 2708 | 2298 | -409 (-15.1%) | 9/9 |
| DOMContentLoaded | 2805 | 2404 | -400 (-14.3%) | 9/9 |
| load event | 2902 | 2409 | -493 (-17.0%) | 9/9 |
| Home UI (Strata) first visible | 2804 | 2403 | -401 (-14.3%) | 9/9 |
| Home, any content, first visible | 2233 | 2403 | +170 (+7.6%) | 0/9 |
| Home renders at launch | 2 | 1 | -1 (-50.0%) | 9/9 |

On the slow link "Home, any content" gets later because the earlier number was the legacy V99 Home painting mid-parse. The real UI arrives about 400 ms sooner.

### 3.4 4x CPU plus Slow 4G, fresh (median of 9 pairs)

TaskDuration 705 → 523 (-25.9%, 9/9), Layout 170 → 69.3 (-59.2%), domInteractive 2835 → 2444, DOMContentLoaded 2878 → 2487, load 3030 → 2495, Home UI 2805 → 2411 (-14.1%, 9/9); ScriptDuration flat (+10 ms, 0/9).

### 3.5 Native CPU (no throttle), returning user (median of 11 pairs)

ScriptDuration 31.3 → 27.9 (-11.0%, 11/11), Layout 18.9 → 13.8, Style recalc 17.9 → 39.5 (the animation now completes), domInteractive 69.6 → 62.2, DOMContentLoaded 96.5 → 87.8, load 109 → 88.9 (-18.4%), Home UI 96.2 → 87.4 (-9.1%), JS heap 2.4 → 2.0 MB. Native, fresh: main-thread CPU 160 → 136 ms (-15.4%, 11/11).

## 4. B: lazy OCR

**Before.** `index.html` carried the Tesseract CDN tag, parser-blocking, ahead of the main script, on every launch: 66,695 bytes (about 8.6 KB brotli), 9 ms of evaluation at 4x, and a cold-cache CDN round trip (483 ms from this Mac) the whole page waited for.

**After.** Tag removed. `loadTesseract()` (beside `evoRecognize`) inserts the same URL on first use; one shared load; resolves when `window.Tesseract` exists; rejects on error or after 20 s; removes a failed tag and retries on the next tap. `readEvoScanOCR()` shows "Loading the reader", awaits the loader, and then the original guard runs unchanged (toast "OCR library not loaded", status "OCR needs a connection to load. You can still enter the numbers."). URL still range-pinned `@5`.

**Verified in Chrome** (`ocr-check.mjs`, 9/9): scan form opens; `typeof Tesseract` is `undefined` at launch with 0 tags; aborted request → honest message, form usable, 0 errors; CDN blocked → same; request that never answers → honest message at 21 s; failed load then next tap retries; two quick taps → one tag; online end to end on a synthetic report image reads all six values exactly; D16 review-before-save unchanged.

**Reliability finding.** On the before tree, with only the Tesseract request stalled, the app never booted (after 8 s `readyState` was `loading`, `NXT` undefined, Home empty). After the change that stall is harmless. The same failure still exists for `@supabase/supabase-js@2`, still a parser-blocking CDN tag (§9).

## 5. C: the wearable modules

**Decision: remove them from the page and the offline shell.** The 13 files, `wearables.fixtures.js` and all suites are untouched.

### 5.1 Every reference is guarded for absence

`premium-ui.js` (`previewAllowed`, `currentIntegrated`, `currentTraining`, `wearableConnectionLabel`, `openWearableConnection`, `recoveryHomeCard`, `openRecovery`): every access starts `NXT.wearables&&` and every consumer falls back; `trainGuidanceHTML()`, the only one on a live screen, returns `''`. Today recovery card and Settings Wearable row are behind `N.features.wearable` / `checkin` (false, D55). `cut-support.js` `resetData()` guards the store inside `try`. `coach.js`, `strata.js`, `train-anatomy.js`, `seed.*`: no references. Forced-on proof (`wearable-proof.mjs`): with the flags set true and the modules absent, every surface renders with 0 page errors.

### 5.2 Backup equivalence

Same starting storage, clock frozen: `getFullBackup()` deep-equal with and without the modules (124,742 bytes both); whole `localStorage` deep-equal (17 keys). The wearable store section was absent from every backup before and after. **There is no wearable data in production**: no page script calls `ingestDelivery`, `collectAndIngest`, `connect` or `disconnect`; `connectLive` returns `auth_deferred` and writes nothing; after a normal launch `nxtfrm_wearables_db` exists with 13 object stores and 0 records in every one. `NXT.resetData()` works both ways.

### 5.3 What they cost

Parse and evaluation of all 13 modules: 3.2 ms at 4x (streamed compile) — not why they go. Cost: 13 requests / 353,072 B (about 70 KB brotli), IndexedDB opened and hydrated every launch, a second Home render, 0.4 MB heap, 13 extra offline-shell files, and `wearables.fixtures.js` (79 KB) fetched on localhost.

### 5.4 The second render and the legacy flash

`wearables.sync.js` ends with `hydrateFromStore().then(() => NXT.repaint())`. Returning user, fast link: Home re-rendered 70–100 ms after boot (45 ms inclusive at 4x), 78 ms into the entrance animation. Slow link (`early-render.mjs`): IndexedDB answered while the parser was still fetching `premium-ui.js`, so the first write to `#homePage` was the **V99 Home from `cut-support.js`** at 2,225 ms with `NXP` undefined; the Strata Home followed at 2,740 ms. After the change the first and only Home write is the real one at 2,344 ms. The release gate's "early legacy render() is not invoked before premium-ui" test inspects HTML text only, so this dynamic route was never covered.

### 5.5 Copy and decision-record consequences

- Settings › Data & sync › Backup & restore now reads: "Wearable evidence in the on-device wearable store is not included; wearable sync is switched off, so the app holds none." (first clause verbatim because the release gate pins it).
- D55 says "Flip a flag to restore". After this change, restoring a working wearable feature also needs the 13 script tags and the `VERSIONED` entries back (files all still present). Proposed D60 in `tasks/ascension/DECISIONS-PROPOSED.md`.
- Left alone, pinned by tests: two legacy "App & install" copy lines in `index.html` about the wearable store, and a toast sentence in `cut-support.js`; now vacuous.
- Orphan database: devices that ran earlier releases keep an empty `nxtfrm_wearables_db`; nothing opens or deletes it now. Harmless.

## 6. D: service worker strategy

**What was wrong.** `fetch` was network-first for everything, so an installed PWA waited on the network for each of about 26 versioned files on every launch and used the cache only on failure.

**As shipped by the agent:** navigation → network-first with cached copy, then cached `./index.html`, then 503; `?v=` equal to `RELEASE` → cache-first from this release's cache (`ignoreVary`), miss fetches and stores, offline miss → 503; font and icons → cache-first; `./`, `./index.html`, manifest, unversioned → network-first; `?v=` of another release → network-first, never trusted; non-GET, other origin, out of scope → not handled. Unchanged: `skipWaiting`, `clients.claim`, cleanup of this app's own caches, push handlers, no page storage. Precache requests use `cache: 'reload'`.

**The contract this adds, and the risk.** Cache-first means a deploy that changes a `?v=` file without bumping `RELEASE` is not picked up on devices that already hold that release. A new install happens whenever `sw.js` itself changes. See §12 for the orchestrator's revision.

### 6.1 Tests
`wearables.sw-strategy.test.js` (23): cached versioned file answered with zero fetches; uncached one fetched once, stored, then served from cache; navigation fetches first and falls back to cached `./index.html`; out-of-scope ignored; no `localStorage`/`indexedDB` anywhere in the source; font/icons cache-first; another `?v=` untrusted; navigation carrying `?v=` stays network-first; offline miss 503; 404/redirected not stored; non-GET ignored; lookups hit this release's cache only; install precaches the whole shell with `cache: 'reload'`; activate deletes only this app's old caches; push handler; every script/stylesheet in `index.html` in the shell; every `?v=` equals `RELEASE`; the 13 modules neither loaded nor precached; Tesseract not a tag.

### 6.2 Real Chrome end to end (`sw-e2e.mjs`, 15/15)
Served at `http://nxtfrm.test:8773` (localhost cannot register a worker). First visit: worker installs and controls the page; one cache with 19 shell entries. Second visit: the server saw only `/` and `/sw.js`; 13 of 13 same-origin resources answered by the worker. Deploy with new bytes and no bump: not picked up (by design at the time). Deploy with `RELEASE` 162: new worker, only the v162 cache remains. Server stopped: cold reload still opens the app from the cache, 0 page errors.

## 7. E: other startup costs (engine unchanged)

| # | Cost | Number | Note |
|---|---|---|---|
| 1 | `@supabase/supabase-js@2` | 218 KB (about 47 KB brotli), 2.6 ms eval; parser-blocking CDN tag | Biggest launch variable (0.1–0.6 s); stalled, the app does not boot. `initSupabaseClient` tolerates a missing library, so a non-blocking load ahead of `initCloudFromStorage()` is the fix |
| 2 | Home render | 87 ms inclusive per render at 4x | now once per launch |
| 3 | `dateMs` | 23,475 calls, 55 ms self at 4x | a per-string memo would remove most of it |
| 4 | `maybeSnapshotTDEE` | 19–26 ms at 4x per launch | with no adherence logged (D49) it recomputes every launch for a hidden feature |
| 5 | `persist()` | once per launch, 15 keys rewritten | the disk write and the upload are the cost |
| 6 | `cfg()` | 32 calls, 0.2 ms | not a cost |
| 7 | `odoSet` | 61 ms self at 4x | the page's first forced layout, not extra work |
| 9 | `index.html` | 354 KB (81 KB brotli), 73% inline JS | inline scripts get no persistent V8 code cache |
| 10 | External CSS | 525 KB raw (96 KB brotli), render-blocking | design-system workstream |
| 12 | Growth watch | +31.6 KB JS from other workstreams; `coachCall` ~50 ms inclusive at 4x per Home render | memoising `buildContext` per render would trim it |

## 8. Verification (real output, at the time of the agent's run)

`node --check` clean on `sw.js`, `premium-ui.js`, `wearables.sw-strategy.test.js`; 9 inline `<script>` blocks in `index.html` parse. Suites: 21 suites / 586 passed / 0 failed. Sweep `shots.mjs … 390 perf-after`: no page/console errors, no overflow. Visual parity frozen before vs after at 390: all 8 sweep screens ≤0.02% pixels, all 21 flow screens ≤0.05%. `ocr-check.mjs` 9/9, `sw-e2e.mjs` 15/15, `wearable-proof.mjs` pass.

## 9. Risks, limitations, follow-ups

1. Freshness vs bump (see §12).
2. `supabase-js` is the next launch blocker: one parser-blocking CDN script that stalls the whole boot.
3. Record D60; adapt the stale `wearables.sync.test.js` assertion ("SW caches production wearable modules only") together with the pinned copy checks.
4. Engine items untouched: a `dateMs` memo, a negative cache for `maybeSnapshotTDEE` while adherence is not logged, writing only changed keys in `persist()`, a per-render coach context.
5. Tesseract still range-pinned with no SRI; first use downloads worker, wasm and language data regardless.
6. No real phone and no Netlify measurement; 4x CPU is a proxy; the SW was exercised in Chrome only, not Safari or an installed iOS PWA.

## 10. Files

Changed: `index.html` (Tesseract tag and comment; `loadTesseract()` and the `readEvoScanOCR()` guard; 13 script tags replaced by a comment; fixtures loader guard), `sw.js`, `premium-ui.js` (one sentence in `dataView()`), new `wearables.sw-strategy.test.js`. Tooling in `~/Library/Caches/DanDev/nxtfrm/ascension/` (`perf.mjs`, `perf-before.json`, `perf-after.json`, `ab-report.mjs`, `trace-scripts.mjs`, `profile.mjs`, `coverage.mjs`, `renders.mjs`, `early-render.mjs`, `wearable-proof.mjs`, `ocr-check.mjs`, `sw-e2e.mjs`, frozen trees `perf-tree/S0..S3`).

## 11. Reproduce

```
cd ~/Library/Caches/DanDev/nxtfrm/ascension
node perf.mjs --label x --runs 11 --returning --cdn local --compare perf-tree/S0 perf-tree/S1 --out /tmp/x.json
node ab-report.mjs /tmp/x.json returning
node sw-e2e.mjs
cd /Users/alidanial/Documents/NXTFRM && for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done
```

## 12. Orchestrator revision (decision)

`RELEASE`/`CACHE_NAME` are bumped by the owner per production deploy (AGENTS.md), and the trial runs on a deploy preview that receives pushes without a bump. A strict cache-first strategy would therefore pin a phone to the first bytes it saw. Decision: versioned assets are served **stale-while-revalidate** — answered from this release's cache immediately (same instant launch), then refreshed in the background so the next launch has new bytes; real release bumps still switch atomically to a new cache. Caveat documented in `sw.js`: only a deploy without a bump can produce a mixed generation across two launches, which the owner's bump-per-deploy workflow never does.
