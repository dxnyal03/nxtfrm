# CURSOR REPORT

**Cursor fills this in after implementing the slice named in `CURRENT_TASK.md`. Do not commit — Claude reviews the working tree first.**

---

## Slice

`VNEXT PHASE 2E — SETTINGS`

## Status

`READY FOR REVIEW` — implementation complete, Cursor-owned verification green, browser/responsive/visual verification outstanding (Claude, per AGENTS.md §6).

---

## A. Capability inventory (§3.1)

Built by reading the live routing, not the prototype. **The starting inventory in `CURRENT_TASK.md` was not accurate in one respect and it matters: three capabilities it lists under *Cardio & recovery* are already unreachable in production, and have been since V99 intercepted the `coach` route.** Details under "Already unreachable before this slice" below, and in §G.

Legend: **KEEP** = reachable and unchanged · **MOVE** = same capability, different group · **DEMOTE** = still reachable, less prominent · **DEFER REDESIGN** = preserved and working, visual redesign belongs to a later slice · **OBSOLETE** = proposed only, not acted on.

### Hub

| # | Capability | Was | Now | Class |
|---|---|---|---|---|
| 1 | Account state (signed-in email / Sign-in needed / Local-only) + gym + storage line | `.nxp-more-account` card-adjacent block | `.vn-set-account`, typographic, on canvas | KEEP |
| 2 | Goals & calories entry | group *Plan*, titled "Profile & cut" | group **PLAN**, titled "Goals & calories" (matches its destination) | KEEP |
| 3 | Training entry | group *Plan* | group **PLAN** | KEEP |
| 4 | Cardio & recovery entry | group *Recovery* | group **PLAN** | MOVE |
| 5 | Appearance entry | group *Preferences*, value "Purple · charcoal" | group **PREFERENCES**, value is the actual setting ("Standard text", "Larger text · Reduced motion") | KEEP |
| 6 | Reminders entry | group *Preferences* | group **PREFERENCES** | KEEP |
| 7 | Body & scans entry | group *Body* | group **BODY** | KEEP |
| 8 | Data & sync entry | group *Data*, value "Signed in"/"Local-only" | group **DATA**, value is D11-targeted (see §C) | KEEP |
| 9 | Wearable connection | group *Recovery* | group **DATA** | MOVE |
| 10 | App & install entry | group *Data*, titled "App" | group **ABOUT**, titled "App & install" | MOVE |
| 11 | Sign out (signed-in only) | `.nxp-more-signout` button at page foot | separated text action below the groups, own hairline | KEEP |
| 12 | Footer "NXTFRM · your next form" | `.nxp-footer` | `.vn-set-foot` | KEEP |

### `goals` — Tier 2, chrome only

| # | Capability | Class |
|---|---|---|
| 13 | Calorie card → `NXT.openCalories()` | KEEP |
| 14 | Goal range form, lower + upper | KEEP |
| 15 | **`saveGoal()` BMI 18.5 underweight safety floor** | KEEP — untouched, `cut-support.js` not edited |
| 16 | "How your advice works" + Open weekly review → `NXT.openReview()` | KEEP |

### `training` — Tier 2, chrome only

| # | Capability | Class |
|---|---|---|
| 17 | Weekly plan editor, all seven days | KEEP |
| 18 | **`saveWeek()` >3-lifting-day confirm + `N.snapshot()`** | KEEP — untouched |
| 19 | Saved workouts Full A / B / C → `editTemplate()` | KEEP |
| 20 | Other routines Push / Pull / Pump / Legs (in `<details>`) | KEEP |
| 21 | Template draft editor (`drawTemplate`, add/move/remove, `saveTemplate`, `defaultTemplate`) | KEEP |
| 22 | `cycleGym()` | KEEP |
| 23 | Gym names & equipment (`gymSettingsHTML`, in `<details>`) | KEEP |
| 24 | **`restoreWeek(false)` / `restoreWeek(true)` confirm + snapshot** | KEEP — untouched |

### `coach` — Tier 2, chrome only

| # | Capability | Class |
|---|---|---|
| 25 | Weekly Zone 2 target + `saveCardioGoal()` | KEEP |
| 26 | Recovery check-in → `apx96OpenReadiness()` + last 7 check-ins | KEEP |
| 27 | Weekly review card (`reviewCard()`, "Why this advice?") — this **is** the recovery-warning capability, see note | KEEP |

### `appearance` — Tier 1, brought into VNext

| # | Capability | Was | Now | Class |
|---|---|---|---|---|
| 28 | Text size | `<select>` | labelled segment, real selected state | KEEP |
| 29 | Motion | `<select>` | labelled segment, real selected state | KEEP |
| 30 | Save → `NXP.saveAppearance()` | unchanged | unchanged (`val('nxp-text')`/`val('nxp-motion')` still read the same ids, now hidden inputs) | KEEP |

### `data` — Tier 1, brought into VNext

| # | Capability | Class |
|---|---|---|
| 31 | Supabase connection status line (`cloudLabel()`) | KEEP |
| 32 | Test connection + live result region (`#nxp-connection-test`, `#nxp-connection-result`) | KEEP |
| 33 | Account & connection settings (`cloudCardHTML`: url, key, email, password, login, signup, save cloud, load cloud, sign out) | KEEP — inside a disclosure, as before |
| 34 | Export app backup → `exportJSON()` (`NXP.exportBackup`, records `backupExportRequestedAt`) | KEEP |
| 35 | Export workout CSV → `exportCSV()` | KEEP |
| 36 | Restore a backup (`backupRestoreHTML`: export + import JSON + preview) | KEEP |
| 37 | Local safety copy export / restore | KEEP — was a top-level `<details class="n99-card">`, now a disclosure inside **Backup & restore**, where it belongs | MOVE |
| 38 | Advanced cloud SQL help (`supabaseSQLHelpHTML`) | KEEP — group **Advanced**, unchanged content |

### `body` / `notifications` / `app` — Tier 3, preserved

| # | Capability | Class |
|---|---|---|
| 39 | `renderEvoScanPage()` — scans, OCR, composition history | DEFER REDESIGN (2G) |
| 40 | `notificationsSettingsHTML()` — permission, weigh-in time, backup day, three toggles, allow/test | DEFER REDESIGN |
| 41 | `installInstructionsHTML()` | DEFER REDESIGN |
| 42 | Build version card ("NXTFRM V109") | DEFER REDESIGN |
| 43 | **Danger zone reset → `NXT.resetData()`** (confirm + snapshot + wearable-store delete) | KEEP — routing and guards untouched |

### Already unreachable before this slice (no action taken)

`renderMore` is reassigned twice at load: `cut-support.js:1412` → `NXT.moreView`, then `premium-ui.js` → `NXP.more`. `NXT.moreView` intercepts `goals`, `training`, `coach` with its own V99 renderers, and `NXP.more` intercepts `data`. That leaves several legacy branches dead:

| # | Capability | Where it lives | Class |
|---|---|---|---|
| 44 | `readiness().score` row in `apx96MoreSectionHTML('coach')` | `index.html:7222`, dead branch | **Not reachable today.** Preserved, not deleted, not promoted (D4) |
| 45 | `enhancedRecoveryWarningHTML()` in the same dead branch | `index.html:7222` | Functionally still present: it is `review().tone==='watch' ? reviewCard() : ''`, and the live `coachHTML()` renders `reviewCard()` unconditionally (item 27). No loss. |
| 46 | **Coach-insight backfill (`backfillAllCoachInsights()`)** | `index.html:7222` + legacy `renderMore()` | **DEFER REDESIGN — needs an owner decision (§G1).** Already unreachable before 2E; restoring it would require either editing `cut-support.js` (forbidden) or adding a control the hub does not otherwise have. |
| 47 | `apx96MoreSectionHTML` branches for `goals` / `training` / `data` | `index.html:7209` | OBSOLETE (proposed only — superseded by V99/V100, gated behind D5/X2) |
| 48 | Legacy `renderMore()` | `index.html:6771` | OBSOLETE (proposed only — D5/X2) |

**No capability that was reachable before this slice is unreachable after it.** `verify-2e.mjs` asserts items 1–43 individually, in both signed-in and local-only states.

---

## B. Files changed

| File | Added / Modified | What changed |
|---|---|---|
| `premium-ui.js` | Modified | Settings layer rewritten: new `setRow` / `setGroup` / `settingsHead` / `setField` / `pickOption` primitives; `more()` hub rebuilt on the five-group IA; `moreAccount()` retyped; `appearanceView()` added; `dataView()` restructured; `subviewChrome()` added for Tier 2/3; `cloudSignal()` added for D11 targeting; `linkFieldLabels()` added; `moreGroup()` and `header()` removed (both were Settings-only) |
| `vnext.css` | Modified | New `#morePage` scope (~300 lines) following the existing page-id scoping contract; header comment updated to list the Settings scope |
| `index.html` | Modified | **§3.8 only** — one line. Nav tab's `.tab-label` `More`→`Settings`, `aria-label` `More`→`Settings`, three-dot glyph → gear |
| `tasks/vnext/verify-2e.mjs` | Added | Acceptance script, authored by Cursor, **run by Claude** |
| `tasks/vnext/CURSOR_REPORT.md` | Modified | This report |

Not touched: `cut-support.js`, `sw.js`, `manifest.webmanifest`, `wearables.*`, `train-anatomy.js`, `seed.*`, `premium-ui.css`, `cut-support.css`, `design-v102/`, `design-v103/`, `.claude/`, the root PNG.

`RELEASE` and `CACHE_NAME` are still `109` (`git diff --quiet sw.js` → clean). No new `.js`/`.css` is requested by the page, so the offline shell needs no entry. `index.html` still carries 21 `?v=109` references, unchanged.

---

## C. Behaviour implemented

### Information architecture

**PLAN · PREFERENCES · BODY · DATA · ABOUT**, in that order, asserted by the verify script. Body keeps its own group per the design director's resolution. Three placements are judgement calls and are flagged for review in §G:

- **Cardio & recovery → PLAN.** A weekly minutes target is a plan commitment, not a preference; the old *Recovery* group was a fifth group outside the brief's five.
- **Wearable → DATA.** It is a data connection, sitting next to the other data connection (Cloud & sync) rather than in a recovery drawer. §3.2: *advanced controls belong with the domain they configure.*
- **App & install → ABOUT.** Install, build version and the danger zone are the "about this app" domain, and §3.2 names ABOUT as the legitimate home for what would otherwise be a catch-all.

### Rows, not cards

The hub has zero raised surfaces. Every row is a `<button>` with no background, no radius, no border except the shared top hairline, and no shadow; the group heading is a 13/600 label with no container. `.nxp-more-group` is gone. The verify script computes this rather than asserting on class names: it reads `backgroundColor`, all four border widths, `borderRadius` and `boxShadow` off every row, counts raised surfaces inside `#morePage`, and fails if any is non-zero.

### Form language (established here)

- Persistent label above every control; no placeholder is ever the only label.
- The current value is on the row without opening it — Appearance now reads "Standard text" / "Larger text · Reduced motion" instead of the decorative "Purple · charcoal".
- Segmented controls carry `aria-pressed` and a real selected state (violet-dim fill + violet inset ring, I1). They write to a hidden input, so `saveAppearance()` reads exactly the same ids and writes exactly the same `{text, motion}` record. This also avoids focusing a real `<input>`, which would engage the V86 render input lock and dim the dock for 900ms on every tap.
- Targets: rows are 56px min, segments 46px, actions 50px, back 44px, disclosures 48px.
- Destructive separated: the reset stays in the V96 danger zone, routed through `NXT.resetData()` (confirm + snapshot + wearable-store delete), and gets an extra rose inset rule and top margin on the VNext canvas.
- Legacy labels in the cloud/backup forms are now programmatically associated (`linkFieldLabels` adds `for`/`id` only — no control, id or value changes, so every reader of `sbUrl`/`sbKey`/`sbEmail`/`sbPass` is unaffected).

### Cloud & Sync (D11 / §3.6)

`cloudSignal()` reads the same signals `updateCloudLocalBanner()` already uses and maps them to how loud the Data row is. It re-derives nothing, writes nothing, and changes no sync behaviour:

| Condition (same as the banner's) | Row |
|---|---|
| session not yet checked | calm — no flash |
| A · `lastCloudError` | "Sync error", concern dot (square) |
| B · configured && signed out | "Sign-in needed", review dot (diamond) |
| C · signed out && has data && never synced && not dismissed | "Not backed up", review dot |
| healthy | "Signed in" / "Local-only", **no dot, no colour** |

### Entry points for later slices

- **Body (2G):** its own group, one row, reading "Evo scans and measurements" with the current waist count. It is a domain, not a scanner.
- **Coaching / AI (2H):** **nothing added.** No AI or coaching preference exists in production today, so per §3.7 and D9 the space is left structurally obvious (PREFERENCES has room) and no control was invented.

### `readiness()` (D4 / §3.7)

Preserved, untouched, and not promoted. Worth flagging: it is **not rendered anywhere reachable in Settings today** — the `Readiness NN` row the task refers to is in `apx96MoreSectionHTML('coach')`, which V99 superseded (inventory item 44). The verify script asserts both that `readiness` is still defined and that no Settings view prints a readiness score.

### Motion (§3.9)

No new page-level motion. Subview changes already ride the existing `vn-route-enter` (280ms, `cubic-bezier(.32,.72,0,1)`) because `render()` cycles `#morePage` through `display:none` on every repaint. The only new transitions are state-tier (200ms) on the segment fill and the disclosure chevron, plus the 120ms press on the primary action — all with reduced-motion paths under both `prefers-reduced-motion` and `:root[data-nxp-motion="reduced"]`.

### "More" → "Settings" (§3.8)

The audit (`grep -n "'more'\|\"more\"\|morePage\|moreView\|renderMore" …`) shows the visible label is carried by exactly one line. Changed: `.tab-label`, `aria-label`, icon. Unchanged and verified present after the edit: `data-tab="more"`, `switchTab('more')`, `#morePage`, `state.moreView`, `state.tab='more'`, `renderMore`, every `apm_*` key. The rename was safe at the label level; no identifier was renamed.

---

## D. Tier discipline (§3.5)

| Tier | Views | What was done | What was not done |
|---|---|---|---|
| 1 | `hub`, `appearance`, `data` | Fully rebuilt in VNext | — |
| 2 | `goals`, `training`, `coach` | Page chrome only: VNext canvas, 20px gutter, back affordance normalised to "‹ Settings" with an accessible name, `.n99-heading` restacked as a VNext subview header (back above, 26/640 title below), eyebrow quietened | **Their bodies are untouched.** V99 `.n99-card` surfaces, V99 `.n99-button` controls, V99 forms — all as shipped. `cut-support.js` not edited. `saveGoal()`, `saveWeek()`, `restoreWeek()` not touched. |
| 3 | `body`, `notifications`, `app` | Reachable, working. Page canvas only, plus three additive accessibility floors: `aria-label` on the unnamed icon-only back button, `min-height:44px` on `summary` and `.apx96-chip`, and a transparent 44pt hit-area overlay on the 48×28 reminder toggles (the pill itself is **not** resized) | No redesign. Recorded as deferred in §F. |

Tier 2 and Tier 3 chrome is applied from `premium-ui.js` (`subviewChrome()`) after the engine has written the page, so no forbidden file was edited to achieve it.

---

## E. Verification (Cursor §6)

### Static

```
$ node --check premium-ui.js
(exit 0)
$ python3 -c "s=open('vnext.css').read(); print(s.count('{'), s.count('}'))"
501 501
$ git diff --quiet sw.js && echo yes
yes
$ grep -n "const RELEASE\|CACHE_NAME" sw.js
1:const RELEASE = '109';
2:const CACHE_NAME = 'nxtfrm-v109-premium-cache';
```

### All sixteen deterministic suites — real output

```
$ for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done
```

| Suite | Result |
|---|---|
| `wearables.adapters.test.js` | OK  32 passed, 0 failed |
| `wearables.canonical.test.js` | OK  24 passed, 0 failed |
| `wearables.days.test.js` | OK  16 passed, 0 failed |
| `wearables.ingest.test.js` | OK  32 passed, 0 failed |
| `wearables.provider-garmin.test.js` | OK  3 passed, 0 failed |
| `wearables.recovery-integration.test.js` | OK  32 passed, 0 failed |
| `wearables.recovery.test.js` | OK  28 passed, 0 failed |
| `wearables.release-gate.test.js` | OK  53 passed, 0 failed |
| `wearables.resolution.test.js` | OK  19 passed, 0 failed |
| `wearables.snapshots.test.js` | OK  26 passed, 0 failed |
| `wearables.store.test.js` | OK  34 passed, 0 failed |
| `wearables.test.js` | OK  18 passed, 0 failed |
| `wearables.train-enrichment.test.js` | OK  34 passed, 0 failed |
| `wearables.training-readiness.test.js` | OK  29 passed, 0 failed |
| `wearables.weight-contract.test.js` | OK  31 passed, 0 failed |

**16 suites · 458 tests · 0 failing**, matching the stated baseline. No `FAIL` line printed. No test was weakened, adapted or deleted.

Two release-gate string assertions sit inside the code I rewrote and were deliberately preserved verbatim: `"Export app backup"` and `"Wearable evidence in the on-device wearable store is not included"`.

### `tasks/vnext/verify-2e.mjs` — written, NOT run by Cursor

Per AGENTS.md §6 the browser belongs to Claude. The script covers all ten requirements from §6 of the task:

1. capability reachability — items 1–43 above, probed individually, in both session states
2. all nine subviews render without throwing, signed-in and local-only, each with a back affordance
3. no card-per-row and no raised surface on the hub, computed from styles; plus the exact five-group IA
4. targets ≥44pt and contrast ≥4.5:1, computed, at 390/375/320
5. no horizontal overflow at 390/375/320 on every view
6. persistent labels, no placeholder-as-label
7. destructive separation, routed to `NXT.resetData()`, which still confirms and snapshots
8. no storage writes on navigation (see the caveat below)
9. reduced motion — no perceptible positional animation
10. non-regression across all five destinations, plus all sixteen suites

It also asserts the D11 calm/actionable behaviour by simulating each of the three conditions in memory, and asserts `readiness()` is preserved but not displayed.

Screenshots it writes into `tasks/vnext/shots/`: `settings-hub-390/320`, `settings-appearance-390/320`, `settings-data-390/320`.

**Disclosure:** while syntax-checking the new file I ran `node --input-type=module -e "import(...)"`, which executed it rather than merely parsing it. It launched headless Chromium, failed immediately on `ERR_CONNECTION_REFUSED` (no server was running), and exited. `pgrep` afterwards shows no browser process from that run — the only Playwright processes on the machine are the two pre-existing `@playwright/mcp` servers this session never invoked. No browser verification was performed and none is claimed.

---

## F. Known deviations / out of scope

1. **Tier 2 bodies are still V99.** `goals`, `training` and `coach` keep their `.n99-card` surfaces and purple `.n99-button` controls inside VNext chrome. This is §3.5 held literally: chrome is listed as header, back affordance, route transition and spacing, and their bodies live in a file this slice may not edit. The visible consequence is two control languages inside one destination. Restyling `.n99-button` under `#morePage` would have unified it in about six lines and I deliberately did not, because it is a Tier-2 internal, not chrome. **Raise this if you want it done — it is a one-rule change.**
2. **Tier 3 bodies are still V96.** `body`, `notifications` and `app` are preserved, not redesigned. `body` is `renderEvoScanPage()` and belongs to 2G. Their contrast, target and overflow numbers are measured by `verify-2e.mjs` and reported under `deferred.tier3`, but they do **not** gate the run — horizontal overflow is the one thing gated on every view including Tier 3.
3. **Tier 3 back affordance stays a glyph.** It now has an accessible name but no visible text label, unlike Tier 1 and Tier 2. Deferred with the rest of the V96 chrome.
4. **First tour of the subviews writes one storage row.** `coachHTML()` ends in `NXT.reviewCard()`, which calls `logSuggestion()` → `persist()` — a deduplicated audit append in `cut-support.js`, which this slice may not edit. It is idempotent, so the test warms once and then asserts byte-equality of `localStorage` across a second full tour. Both tours are reported in `verify-2e-results.json`. `state.moreView` remains in-memory and is asserted not to be persisted.
5. **Settings sits at a 34px effective gutter, not 20px.** `.content{padding:8px 14px 0}` plus the VNext 20px. This matches Train, Progress and History exactly; only Today zeroes the `.content` inline padding. I did not fix it here because fixing it for Settings alone would make Settings the odd one out. Real debt, worth one shared line.
6. **Consolidating the per-page `vn-*` primitives** is explicitly out of scope (§7) and untouched. `#morePage` now makes it a fifth duplicated scope. The debt is real and growing.
7. **`exportFullBackup()` vs `exportJSON()`.** The `data` view surfaces both, as it did before — "Export app backup" (`NXP.exportBackup`, which records the export timestamp) at top level, and the older `EXPORT BACKUP` inside the Restore disclosure via `backupRestoreHTML()`. Two similarly-named exports on one screen is confusing, but consolidating them is a behaviour change, not a presentation one. Raised, not acted on.
8. No commit. No push.

---

## G. Risks and decisions for review

1. **Coach-insight backfill (inventory item 46) needs your call.** `backfillAllCoachInsights()` is unreachable in production and was already unreachable before this slice — V99's `coachHTML()` replaced the apx96 branch that hosted it. It is *not* a regression I introduced, and I did not restore it, because every route back to it either edits `cut-support.js` or adds a hub control that Settings does not otherwise want. Options: leave it dead pending 2H (AI surfaces, where coach memory plausibly belongs); add it to the `coach` subview in a future slice that may edit `cut-support.js`; or declare it OBSOLETE. I need a decision — I did not want to resolve a silent-feature-loss question unilaterally.
2. **The three IA placements in §C** (Cardio & recovery → PLAN, Wearable → DATA, App → ABOUT). All three are defensible and all three are reversible in one line each.
3. **The Tier-2 body question in §F1** — unify the control language or hold the tier line.
4. **The gear icon is hand-drawn** (hub circle, ring, eight teeth) to match the stroke weight and minimalism of the other four nav glyphs rather than dropping in a denser off-the-shelf cog. Worth an eye at 390 and 320.
5. **Everything visual is unverified.** No browser ran. Contrast, targets, overflow, 320 row wrapping, the Tier-2 header restack, reduced motion and fidelity against `design-vnext/` are all pending `node tasks/vnext/verify-2e.mjs` against a local server.

---

## H. Stop

Working tree ready for design-director review. Nothing committed, nothing pushed.

---

# Repair round 1 — 2E

Two defects from Claude's review. `vnext.css` only. No other file touched, no commit, no push, no browser.

## R1 — the value column wrapped to two lines at 390 and 375

`#morePage .vn-set-v` was `flex:0 1 auto` with `overflow-wrap:anywhere`. Shrink factor 1 plus a break-anywhere rule meant that once `.vn-set-l` (`flex:1 1 auto`) had taken its 199–299px, an atomic value like `90 min / week` or `Not connected` was broken mid-phrase rather than being allowed to keep its width.

A settings value is a token; the description beside it is prose. Prose is the thing that should wrap. So the value now sizes to its content and cannot be shrunk or broken:

```
flex:0 0 auto;min-width:0;max-width:58%;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
```

`overflow-wrap:anywhere` is gone from this rule. `.vn-set-l` keeps `flex:1 1 auto;min-width:0`, so with the value no longer shrinking, the label is the only flexible item left and its `.vn-set-s` description absorbs the wrapping. `font-variant-numeric:tabular-nums` is unchanged. The `max-width:58%` plus ellipsis is the guard against a pathologically long value — it truncates instead of wrapping or overflowing, and 58% still clears every current value at 375px by a wide margin.

## R2 — the chevron orphaned onto its own line at 320

In the `@media (max-width:359px)` block `.vn-set-l` was `flex:1 1 auto`, i.e. flex-basis `auto`, i.e. a basis of the label's max-content width. On the Wearable row that basis exceeded the line on its own, so the chevron was the item that wrapped — the opposite of what that block's own comment intends.

Changed to `flex:1 1 0;min-width:0`. With a zero basis the label can never push the chevron off line 1; label and chevron share the title line and only `.vn-set-v` (`flex:1 1 100%`) drops to line 2, as designed.

The stacking behaviour itself is unchanged. The narrow block now also neutralises the three new base properties from R1 so the stacked value still fills the line and still wraps as prose:

```
max-width:none;white-space:normal;overflow:visible;overflow-wrap:anywhere;
```

## Not changed

Row semantics, `.vn-set-flag` markup and colours, every handler, `premium-ui.js`, `index.html`, `sw.js`. `RELEASE` and `CACHE_NAME` remain `109`; no new asset is requested, so the offline shell needs no edit. No `min-height` was reduced — `.vn-set-row` keeps its 56px floor and rows should only get shorter by losing a wrapped line, from 86–87px toward the ~67px of the rows that already fit.

## Verification

- brace balance on `vnext.css`: 501 open / 501 close — balanced
- `for f in wearables*.test.js; do node "$f" || echo "FAIL $f"; done` → **16 suites · 458 tests · 0 failing**, no `FAIL` line. Matches baseline exactly.
- No Playwright, no browser, no MCP browser. Row geometry at 390 / 375 / 320 is Claude's to re-measure.
