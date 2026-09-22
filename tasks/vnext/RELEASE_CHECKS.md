# NXTFRM VNext — Release checks

Items that must be satisfied **before deployment**, not before a slice commit.
The owner holds `RELEASE`/`CACHE_NAME` at `109` as the deployment checkpoint; these
are the things to clear when that gate is opened.

---

## R1 — Inspect the real historical trend after D14 · **required**

**Raised by:** owner, at 2F approval · **Source:** D14, D17

D14 made only Morning weigh-ins eligible for the canonical body-weight trend.
Post-workout and EvoScan readings are contextual and no longer substitute on a date
with no morning reading.

The dev seed is **100% Morning (83/83) and carries zero scans**, so the change is a
**no-op on seed data** — the trend output is byte-identical. The practical impact is
therefore **unmeasured**, because the real dataset lives in the owner's browser
localStorage, not in this repo.

**Before deployment, inspect the real historical trend** and confirm the change reads
correctly against actual history:

- [ ] How many dates lose a canonical point (dates with no Morning weigh-in)
- [ ] Whether the visible trend line, plateau state and forecast change materially
- [ ] That untimed legacy weigh-ins (pre-`timeOfDay`, V93–V106 era) are **still
      present** in the trend — these remain eligible by design
- [ ] That no contextual reading has been migrated, deleted or rewritten (D17)
- [ ] That no continuity is fabricated for a date with no Morning weigh-in (D17)

**This is an inspection, not a migration.** If the result looks wrong, the response is
a decision about the rule — never a data rewrite.

---

## Deferred polish — not release blockers

### P1 — Demote repeated destructive actions in EvoScan scan history
**Raised by:** Claude at 2F review · **Owner ruling:** later polish pass; **do not
reopen 2F for this.**

Scan history repeats a rose **Delete** on every row. It is safe — ≥44pt targets,
passes contrast, and confirms with a message explaining what is removed and what
remains — but a destructive action repeated at that prominence competes with the scan
data beside it. Preferred fix: move it into **scan detail**, or behind a contextual /
overflow affordance.

### P2 — Type and radius scale consolidation
**Raised by:** Claude at INT-1. Minor primary-action type variance across screens
(Today 16px/580, Train idle 15px/600, Train active 17px/600).

### P3 — Shared `vn-*` primitives in `vnext.css`
Each page scope redefines its own type and spacing primitives; there are now five
scopes. Real debt, but consolidating it touches every approved screen, so it needs its
own audited slice rather than riding along inside a feature slice.

### P4 — Inherited V96 accessibility debt
Measured at 2E, unchanged by it and out of scope there: `body` 18, `notifications` 5
(plus three unlabelled 48×28 toggles), `app` 3 text-contrast failures. Belongs to
whichever slice redesigns those Tier 3 legacy subviews.
