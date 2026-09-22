# CURRENT TASK — VNEXT PHASE 2E: SETTINGS

**Owner:** Cursor (implementation) · **Reviewer:** Claude (design/UX acceptance)
**Status:** READY TO START
**Read first:** `AGENTS.md` · `tasks/vnext/DECISIONS.md` (binding) · `design-vnext/DESIGN-BRIEF.md` §V, §W · the four NXTFRM skills
**Previous slices:** 2A `9fd3772` · design-vnext `a0c9203` · 2B `761f339` · 2C `6563be6` · 2D `eb713de` · INT-1 `5b4e14c`

---

## 1. Objective

Settings completes the five-destination VNext shell. It must feel **quiet, structured, predictable, low-cognitive-load**.

**Settings is configuration, not a dashboard.** It must not compete visually with Today, Train, Progress or History. Per the brief (§V): *typographic rows with chevrons — no cards.* Under INSTRUMENT (D1), Settings needs **very few protagonist surfaces** — plausibly zero on the hub.

### 1.1 What you are actually walking into — read this before planning

Settings is **not one screen**. It is a hub plus nine subviews rendered by **three different visual generations**, and the routing falls through two layers:

| View | Rendered by | File | Generation |
|---|---|---|---|
| `hub` | `NXP.more()` | `premium-ui.js:1077` | V100 |
| `appearance` | `NXP.more()` inline branch | `premium-ui.js:1082` | V100 |
| `data` | `NXP.dataView()` | `premium-ui.js:1107` | V100 |
| `goals` | `NXT.goalsHTML()` | `cut-support.js:1263` | V99 |
| `training` | `NXT.programmeHTML()` | `cut-support.js:1272` | V99 |
| `coach` | `NXT.coachHTML()` | `cut-support.js` | V99 |
| `body` | `apx96MoreSectionHTML('body')` → `renderEvoScanPage()` | `index.html:7209` | V96 legacy |
| `notifications` | `apx96MoreSectionHTML('notifications')` → `notificationsSettingsHTML()` | `index.html:7209` | V96 legacy |
| `app` | `apx96MoreSectionHTML(else)` | `index.html:7209` | V96 legacy |

The fallthrough is `NXP.more()` line 1084: `if(view!=='hub'){base.more();return;}` → `NXT.moreView()` (`cut-support.js:1246`) → for `body`/`notifications`/`app`, `N.old.apx96MoreSectionHTML(view)`.

**This is why the slice is scoped the way §3 scopes it.** The hub and the form language are the deliverable. The deep subviews are where scope risk lives, and §3.5 tells you exactly how far to go into each one.

---

## 2. Files / areas

| File | Expected change |
|---|---|
| `premium-ui.js` | `more()`, `moreAccount()`, `moreGroup()`, `dataView()`, `saveAppearance()`, plus new VNext row/section helpers |
| `vnext.css` | New `#morePage` section. Follow the existing scoping contract exactly. |
| `index.html` | **Narrowly permitted, §3.8 only** — the nav tab's visible label, its `aria-label` and its icon. Nothing else. |

**Do not edit:** `cut-support.js`, any `wearables.*`, `train-anatomy.js`, `seed.*`, `sw.js`, `manifest.webmanifest`.

**Never bump `RELEASE`/`CACHE_NAME`** — both stay at `109`. The owner holds that as a deployment checkpoint.

Note the load-order fact: `cut-support.js:1412` sets `renderMore=NXT.moreView`, then `premium-ui.js:1510` sets `renderMore=NXP.more`. The later assignment wins. That is the seam — work above it.

---

## 3. Required behaviours

### 3.1 Functional accounting comes FIRST — before any code

Inventory **every** capability currently reachable from More, hub and subviews both. Classify each: **KEEP / MOVE / DEMOTE / DEFER REDESIGN / OBSOLETE**.

`OBSOLETE` requires owner approval — you may not act on it in this slice, only propose it.

**Silent feature loss is a REQUIRED FIX.** Do not drop a capability because it is absent from the prototype. The prototype is a Settings *skeleton* (§290 of the brief says so explicitly); it is not a capability list.

Put the table in `CURSOR_REPORT.md` section A. The starting inventory — verify and extend it, do not assume it is complete:

Account block (signed in / sign-in needed / local-only, gym, sign out) · Profile & cut → calorie card, goal range form incl. the **BMI 18.5 underweight safety floor in `saveGoal()`**, weekly review entry · Training → weekly plan editor, `saveWeek()` >3-lifting-day confirm + snapshot, saved workouts FullA/B/C, other routines Push/Pull/Pump/Legs, template draft editor, `cycleGym()`, gym names & equipment, programme defaults `restoreWeek()` · Wearable connection · Cardio & recovery → zone2 weekly target, readiness row, recovery warning, coach-insight backfill · Body & scans → `renderEvoScanPage()` · Appearance → text size, motion · Reminders → `notificationsSettingsHTML()` · Data & sync → Supabase connection + test, account/connection settings, backup & restore, export JSON, export CSV, safety copy export/restore, advanced cloud SQL help · App → install instructions, build version, danger-zone reset (routed to `NXT.resetData()`) · footer.

### 3.2 Information architecture

Follow the brief (§V) — **PLAN / PREFERENCES / BODY / DATA / ABOUT**.

The owner's brief listed Body under PREFERENCES; the design brief gives Body its own group. **Resolved by the design director: Body keeps its own group.** It is a distinct domain, not a preference. The owner's instruction *"do not force an item into a section if current semantics make another location more appropriate"* governs.

Advanced controls belong with the domain they configure, or in ABOUT — not in a catch-all drawer.

### 3.3 Visual rule — rows, not cards

Rows are built from **typography, spacing, hairlines, chevrons, toggles and small status text**.

Not: a card around every row · dashboard tiles · purple glowing controls · giant status banners.

Group headings are quiet typographic labels. The existing `.nxp-more-group` card-per-group treatment is exactly what this slice replaces.

### 3.4 Forms and controls — this slice establishes the VNext form language

Everything after 2E inherits it, so it has to be right:

- Persistent labels — never placeholder-as-label
- Current value legible on the row without opening it
- **≥44pt** on every important target (audit computationally, do not eyeball)
- Meaningful toggles with a real selected state
- Visible focus rings
- Keyboard-safe: the field being edited stays visible above the keyboard
- Destructive actions visually separated — the danger zone stays a danger zone
- Explanatory copy only where it earns its place
- **No icon-only controls for important configuration**

### 3.5 Subviews — how deep to go

Three tiers. Do not exceed the tier.

**Tier 1 — bring fully into VNext:** `hub`, `appearance`, `data`.
These are already V100 and owned by `premium-ui.js`. They are in scope.

**Tier 2 — chrome only:** `goals`, `training`, `coach`.
These are V99 in `cut-support.js`, which you may not edit. Give them consistent VNext page chrome (header, back affordance, route transition, spacing) from the `premium-ui.js` side. **Do not rewrite their internals.** Their forms carry real safety behaviour — `saveGoal()`'s BMI floor, `saveWeek()`'s snapshot and confirm, `restoreWeek()`'s confirm. Preserve all of it untouched.

**Tier 3 — preserve functionally, defer redesign:** `body`, `notifications`, `app`.
V96 legacy. `body` is `renderEvoScanPage()` and belongs to **2G**. Do not redesign these. Reach them, keep them working, record them under *Known deviations* as deferred.

If a Tier-2 or Tier-3 subview cannot get consistent chrome without touching a file you may not edit, **say so in the report** rather than editing it.

### 3.6 Cloud & Sync — D11 governs

Healthy normal operation must not dominate Settings. Show status calmly; let genuinely actionable problems become prominent. The three D11 conditions already implemented in `updateCloudLocalBanner()` are the model — reuse that thinking, do not re-derive it.

**Do not:** weaken a data-safety warning · change sync semantics · change a storage key · change Supabase behaviour · change backup/restore semantics.

If the current cloud controls are confusing, improve **hierarchy and copy only**. Do not rewrite the underlying system in this slice.

### 3.7 Entry points for later slices — structure only, no fake controls

- **Body / measurements / scans (2G):** a clean entry point that does not make the scanner feel like the destination.
- **Coaching / AI preferences (2H):** a sensible location **only where existing semantics already support it.** If no real preference exists today, leave the space structurally obvious and add nothing. **No fake controls (D9).**

**Conflict you must not resolve on your own:** the `coach` subview renders `readiness().score`. The design brief (§AD) lists that score for removal, but **D4 gates it and X1 is a separate audited slice.** So: preserve it exactly as it is, and do not give it new prominence. Do not delete it. Note it in the report.

### 3.8 "More" → "Settings"

Rename the **visible label only**. Audit first: `grep -n "'more'\|\"more\"\|morePage\|moreView\|renderMore" index.html premium-ui.js cut-support.js`.

Change: the nav button's `<span class="tab-label">`, its `aria-label`, its icon, and the hub header.
The icon is currently a three-dot "more" glyph. A configuration destination takes a gear. That is the whole permitted `index.html` edit.

**Do not change:** `data-tab="more"` · `switchTab('more')` · `#morePage` · `state.moreView` · `state.tab='more'` · `renderMore` · any storage key · any route identifier.

Visible label and internal identifier do not have to change together. If the audit shows the rename cannot be done safely at the label level, **stop and report** rather than renaming identifiers.

### 3.9 Motion

Settings is **quieter than Train**. Use the existing VNext route language — `vn-route-enter`, 0.28s, `cubic-bezier(.32,.72,0,1)` — already applied to all five destinations as of INT-1. Subview and sheet transitions consistent with it. No bounce, no dramatic page slides, no decorative animation. Reduced motion stays clean: no positional movement.

---

## 4. Must remain unchanged

- Every `apm_*` key, `persist()`, backup/restore semantics, Supabase behaviour
- `state.moreView` stays in-memory UI state — **do not start persisting it**
- All safety behaviour in `saveGoal()` / `saveWeek()` / `restoreWeek()` / `resetData()`
- The V86 render input lock
- `readiness()` (D4) and the legacy renderers (D5)
- **Today, Train, Progress, History — untouched.** Four approved screens. A regression in any of them fails this slice.

## 5. Responsive acceptance

390 / 375 / 320. Zero horizontal overflow. Check: row wrapping · label/value alignment · toggle reachability · long text (a long email in the account row, a long gym name) · section spacing · safe areas · bottom nav clearance.

**Do not shrink text or controls to make 320 fit.** 320 is a real design state — wrap, stack or truncate honestly instead.

## 6. Test requirements

Add `tasks/vnext/verify-2e.mjs`, following the pattern of `verify-2d.mjs`.

1. **Capability reachability** — every KEEP capability from the §3.1 inventory is reachable from Settings. Assert per capability; this is the test that catches silent feature loss.
2. **Every subview renders** — all nine views render without throwing, in both signed-in and local-only states.
3. **No card-per-row** — the hub does not wrap each row in a surface.
4. **Targets ≥44pt** and **contrast ≥4.5:1**, computed, at 390/375/320.
5. **No horizontal overflow** at 390/375/320, hub and every subview.
6. **Labels persist** — no placeholder-as-label on any Settings form control.
7. **Destructive separation** — the reset control is visually distinguished and still confirms.
8. **No storage writes on navigation** — touring every subview writes nothing. Snapshot `localStorage` before and after and assert equality.
9. **Reduced motion** — no positional animation on route or subview change.
10. **Non-regression** — Today, Train, Progress, History render unchanged. **Run all 16 deterministic suites and report real output.**

Screenshots of the hub and one Tier-1 subview at 390 and 320 into `tasks/vnext/shots/`.

## 7. Explicitly out of scope

Progress → Performance (2F) · Body Intelligence / OCR / `renderEvoScanPage()` redesign (2G) · AI integration (2H) · Supabase schema/RLS/data · `readiness()` removal (D4/X1) · legacy renderer removal (D5/X2) · `RELEASE`/`CACHE_NAME` bump · any storage or data-semantic change · **consolidating the per-page `vn-*` primitives in `vnext.css` into a shared scope** (real debt, four scopes deep — raise it in the report, do not act on it here).

---

## 8. Definition of done

- [ ] §3.1 capability inventory complete in `CURSOR_REPORT.md` A, every item classified
- [ ] Every KEEP capability reachable and working — no silent loss
- [ ] Hub is typographic rows with chevrons; no card-per-row, no dashboard tiles
- [ ] IA follows PLAN / PREFERENCES / BODY / DATA / ABOUT
- [ ] Settings reads quieter than Today, Train, Progress and History
- [ ] Cloud & Sync calm when healthy, prominent only when actionable (D11)
- [ ] Form language established: persistent labels, values, 44pt, focus, keyboard-safe, destructive separated
- [ ] Tier discipline held — Tier 2 chrome only, Tier 3 preserved and deferred
- [ ] Body and Coaching entry points structural, with **no fake controls**
- [ ] `readiness()` preserved, not promoted
- [ ] Label renamed to Settings with identifiers untouched, or reported as unsafe
- [ ] 390/375/320 clean; contrast, targets, overflow all pass
- [ ] Other four destinations unchanged; **all 16 suites green**
- [ ] `CURSOR_REPORT.md` completed (A–H)
- [ ] **Do not commit.** Claude reviews the working tree and the actual diff first.
