# CURRENT TASK — ANATOMY CONTRACT + EXERCISE DETAILS

**Owner:** Cursor (implementation) · **Reviewer:** Claude
**Status:** READY TO START
**Read first:** `AGENTS.md` · `DECISIONS.md` · `.claude/skills/nxtfrm-product-design/SKILL.md`
**Previous:** Body `6c1ded8` · Train `c867ebc`

**AI remains PAUSED.** No model calls, no generated muscle mapping, no AI copy.

---

## 0. Decision already taken — do not relitigate

The owner reviewed contained vs bleeding anatomy and **approved keeping the current
active-Train treatment**. Measured evidence behind that: anatomy currently costs **0px** of
vertical height at 390/375/320 (head 64px and Log Set bottom 678/678/753px are identical with
it hidden), it already has **no background, border or radius**, and `cropFor()` already crops to
the mapped muscles' bounding box.

**Do not restructure Train for anatomy.** This task formalises what exists and adds the
verification that stops it regressing. Then it closes one real gap in Exercise Details.

---

## 1. Formalise the ACTIVE TRAIN anatomy contract

Make these explicit in `vnext.css` (and in a comment stating they are a contract, not
incidental values):

- **Unboxed.** No background, no border, no radius, no shadow. It sits on the canvas.
- **Inside the existing exercise-head row.** Never its own row, never its own surface.
- **0px vertical cost.** It must never increase head height. If space is short, the figure
  shrinks — the row never grows.
- **Relevant-region crop only.** Single view, from `viewFor(primary)`. Never both views on Train.
- **≥360px:** max **72w × 64h**. **≤359px:** max **64w × 56h**.
- **Preserve aspect ratio.** Never distort, never letterbox into a visible field. Crop aspect
  measured across the library ranges **0.50 → 1.70**, so the clamp must absorb that: a 0.5 crop
  renders about 32×64, a 1.7 crop about 72×42.
- **Title legibility outranks anatomy.** At narrow widths the figure yields before the exercise
  title truncates.
- **Never push or overlap** the aim strip (Last / Target / Rest).
- **Unmapped exercises render no anatomy** — never a generic silhouette, never a guess.
  `musclesFor()` already returns empty for unknown names; keep it that way.

## 2. Motion contract

- Exercise change: **opacity / crossfade only**, **≤200ms**, `cubic-bezier(.32,.72,0,1)`.
- **Reduced motion: immediate state swap**, no transition.
- **No pulse, glow, scale bounce, rotation or looping effect.**

`premium-ui.css` already defines a `nxp-ex-anat-enter` keyframe. **Audit it against this
contract** and bring it into line — in particular confirm it is disabled under
`prefers-reduced-motion`.

## 3. Required verification — add to `tasks/vnext/verify-train.mjs`

1. **Anatomy costs 0px** at **390 / 393 / 402 / 430 / 375 / 320**. Measure the exercise-head
   height and the Log Set bottom with anatomy present and with it hidden; both must be
   identical at every width.
2. **Anatomy never overlaps the aim strip.** Assert no intersection between the anatomy box and
   the Last / Target / Rest strip at every width.
3. **Title remains readable at 320.** The exercise title must not be truncated or clipped by
   the figure; assert the title keeps its full text and a sane width.
4. **Reduced motion.** Under `prefers-reduced-motion: reduce`, anatomy has no transition or
   animation on exercise change.
5. **Size clamps hold** at both breakpoints, and aspect ratio is preserved (rendered w/h matches
   the crop's aspect within tolerance).
6. **Unmapped renders nothing** — a name absent from the library produces no figure.

---

## 4. Exercise Details — one real gap, plus restraint

I audited the rendered sheet. It **already** has: the full front + back pair (174×190 at 390,
167×190 at 375, 139×190 at 320), FRONT/BACK labels, Primary and Secondary as **text** as well as
colour, Target / Rest / Increment / Equipment, the baseline note, and Recent sessions with real
data. No sub-44pt targets, no overflow, no page errors. It meets INSTRUMENT — restrained violet
on graphite, not a medical poster.

### 4.1 The gap: Swap Exercise is missing

The owner lists Swap Exercise as something Details must support, and it is **not there**.
`showSubstituteSheet()` already exists and is wired on the Train mode bar.

Add Swap Exercise to Details:
- It must reach the **same substitution flow** that already exists — do not build a second one.
- Returning from swap must land the user back in a coherent place, not a dead end.
- **Do not silently rewrite historical exercise records**, and do not alter programme semantics.
- Treat it as a considered action, not the primary action of the sheet — Details is reference
  depth, and swapping is one thing you can do from it.

### 4.2 Spacing

There is visible dead space between the figure pair and the Primary block. Tighten it so the
sheet reads as one composition. Do not enlarge the figures to fill it — **190px tall is already
the right presence** for this sheet.

### 4.3 Keep it honest

Equipment still shows **only** when the library knows it — no "Unknown" placeholder, never
inferred from the name. Primary/Secondary stay text-labelled so meaning is never colour-only.
No invented cue, no fabricated muscle precision.

---

## 5. Files

| File | Permitted |
|---|---|
| `premium-ui.js` | yes — `exerciseDetails()` and anatomy helpers |
| `vnext.css` | yes — the anatomy contract |
| `premium-ui.css` | only for the `nxp-ex-anat-enter` motion audit |
| `tasks/vnext/verify-train.mjs` | yes — the six checks above |

**Do not edit:** `cut-support.js` · `index.html` · `train-anatomy.js` · `sw.js` ·
`manifest.webmanifest` · `wearables.*` · `seed.*`. **`RELEASE`/`CACHE_NAME` stay at `109`.**

`train-anatomy.js` is the deterministic data layer and is explicitly **out of bounds** — the
mapping is complete (106/107 catalogue, 21/21 templates) and must not be edited.

## 6. Tests

Run **all sixteen** suites and **every** verify script (`2a`…`2h`, `train`). Baseline
**16 / 458 / 0 failing**, all scripts green. Do not weaken a test to make the suite pass.

## 7. Definition of done

- [ ] Anatomy contract explicit in CSS, with a comment marking it a contract
- [ ] Motion contract applied; `nxp-ex-anat-enter` audited and reduced-motion safe
- [ ] All six verification checks added and passing
- [ ] Swap Exercise reachable from Details, reusing the existing flow
- [ ] Details spacing tightened without enlarging the figures
- [ ] Train layout otherwise unchanged — 0px cost preserved
- [ ] 16 suites + all verify scripts green; RELEASE/CACHE_NAME at 109
- [ ] `CURSOR_REPORT.md` updated (A–H)
- [ ] **Do not commit. Do not push.**
