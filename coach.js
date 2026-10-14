/* NXTFRM coach.js — Coaching Intelligence 2.0, engine layer.

   One coordinated, explainable coach over stored records. Deterministic rules
   only: no model call, no composite score (D9), only canonical Morning weigh-ins
   in anything weight-related (D14), and nothing emitted for features that
   D49/D55 switched off. It CALLS the existing engine (review, detectPlateau,
   trendStats, weights, workRows, sessionRows, bestSet, aimFor, coachFor,
   strengthItems, activityWeeks, activitySummary, typeFor, templateFor,
   setDayType, commit) and changes none of it. The UI renders what this returns.

   Load order: index.html loads cut-support.js → coach.js → premium-ui.js, and
   sw.js lists coach.js in VERSIONED so the offline shell matches the page.

   ===== READ FUNCTIONS =====================================================
   Pure: the same stored data and date give the same output (deep-equal). They
   never persist, never call commit(), never touch localStorage. Dates are
   'YYYY-MM-DD'. An omitted date means state.date; an invalid one returns
   null / [] rather than a guess. When `date` is not state.date the engine is
   read "as of" that date: state.date (and state.dayType) are pinned for the
   duration of the synchronous call and restored in a finally block.

   One side effect had to be neutralised: aimFor()/coachFor() call cue(), and
   cue() appends to cfg().suggestions and calls persist() (a log nothing reads).
   Every call into them runs inside pinned(), which swaps the global persist
   for a no-op and restores both persist and the suggestion log afterwards, the
   same swap-and-restore idiom loadCloudNow() uses for toast. If persist is ever
   not swappable (not a global-object property), progression reads are skipped
   instead (lift aims read null) so a read can still never write.

   NXT.coach.dayContext(date) → DayContext | null
     {date, type, label, status, reason, note, movedTo, movedFrom,
      logged:{sets, cardioMin, floorball}}
     type     resolved day type (dated override → weekly plan → built-in split)
     label    NXT.label(type)
     status   first rule that matches:
       'done'       the day's own record exists: working sets on a lifting day
                    (at least half the planned working sets), cardio minutes on
                    a Zone2 day, a floorball session on a Floorball day
       'partial'    lifting day with working sets, but under half the planned
                    working sets (planned = that date's session queue/targets,
                    else the saved routine for its gym)
       'excused'    cfg().dayNotes[date].status === 'excused'
       'moved'      cfg().dayNotes[date].status === 'moved'
       'rest'       type Rest
       'today'      date === state.date and its own record is not there yet
       'upcoming'   date after state.date
       'untracked'  past day before the first stored activity record (lift,
                    cardio or floorball), or a Floorball day while
                    NXT.features.floorball is off: there is no observation, so
                    it is neither done nor missed (activityWeeks' rule)
       'partial'    past day with other activity but not its own (D48's
                    "logged, plan not done", e.g. a walk day with an add-on lift)
       'missed'     past, expects activity, nothing at all logged, not
                    excused or moved
     reason   excuse reason 'sick'|'travel'|'rest'|'other', else null
     note     free-text note, else null
     movedTo  for a moved day: the date its session went to
     movedFrom the date whose session was moved onto this one, else null
     logged   {sets: working sets (workRows), cardioMin, floorball: sessions}

   NXT.coach.dayStatuses(startDate, endDate) → DayContext[]
     Inclusive range, clamped to 92 days; [] for invalid input. One pass over
     the records for the whole range (for calendars).

   NXT.coach.context(date) → Context | null — the validated shared context
     {date, dayType,
      plan:{weeklyPlan:{0..6: type|null} (stored, 0 = Sunday),
            overrides:{date: type} (from last week's Monday to next week's Sunday)},
      week:{start, end, days:[DayContext ×7], liftsPlanned, liftsDone,
            liftsMissed, liftsRemaining, cardioMin, cardioTarget, daysLeft},
        liftsPlanned  lifting-type days not excused, moved or untracked
        liftsDone     dates up to `date` with working sets (= completedWeek())
        liftsMissed   lifting-type days whose status is 'missed'
        liftsRemaining lifting-type days from `date` on still 'today'/'upcoming'
        cardioMin     cardio minutes Monday → date; cardioTarget = settings
                      .zone2WeeklyTarget || 90 (the value every screen uses)
        daysLeft      days from `date` to Sunday inclusive (Mon 7 … Sun 1)
      lifts:[{name, gym, lastDate, daysSince, best:{weight,reps}|null,
              aim:{weight,reps,kind,why}|null, holdReason, stall,
              readyToIncrement, returning, nextDate, nextType,
              coach:{kind,headline,note,effort}|null}]   (effort: {known,sets,state} from cue(); Stage 1)
        Lifts in the routines scheduled over the next 7 days at state.gym,
        plus every lift with working sets in the last 28 days (any gym), max
        40, planned first. aim/coach come from aimFor()/coachFor() run for that
        lift's gym with the routine of its next scheduled day (so the rep range
        is the user's own). aim is relative to sessions before `date`.
        holdReason = aim.why when the aim is not a load step; stall =
        coachFor().kind === 'stall'; readyToIncrement = aim.kind === 'load';
        returning = 15+ days since the last session (cue()'s "ease back in").
      weight:{trend:{current,previous,earlier:{n,avg}, change, priorChange,
              percent} (trendStats, rows dropped), review (NXT.review()),
              confidence ('high'|'medium'|'low'|null, detectPlateau's — the
              Today chip), plateau (compact detectPlateau()),
              lastMorningDate, daysSinceMorning, contextualOnlyDays},
        contextualOnlyDays  dates after the last morning weigh-in (or in the
                    last 14 days when there is none) that have only
                    post-workout/scan weigh-ins (D14: they never enter a trend)
      cardio:{weekMin, target, lastDate},
      cut:{start (settings.cutStart|null), goal:{low,high}|null (only when the
           goal range is confirmed), elapsedDays|null},
      freshness:{lastMorningDate, daysSinceMorning, lastSetDate, daysSinceSet,
                 lastCardioDate, daysSinceCardio, lastContextualDate},
      features: copy of NXT.features}
     Missing data is null or empty, never a guess. A scheduled session is never
     assumed done: only stored rows count.

   NXT.coach.catchUp(date) → Proposal | null
     {missedDate, missedType, missedLabel, todayType,
      logged:{sets, cardioMin, floorball}   (what the missed day did record),
      consequences:[strings],
      apply:{setDayType:{date, type}, dayNote:{date, status:'moved', to}}}
     Offered when ALL hold: `date` is not a lifting day, is not excused, and
     has nothing logged (no log row of any kind, no cardio, no floorball —
     strict); a lifting day in the 7 days before it had no working sets: it
     is 'missed', or 'partial' with zero sets because a walk or other activity
     was logged instead (the lift did not happen; the status word stays
     partial and `logged` says what was done, so the UI can say "Full Body B
     didn't happen Wed (you walked 30 min instead)"); and no later day up to
     the end of `date`'s week covers it (the same session type either already
     logged on a later past day or still scheduled after `date`). The most
     recent such day wins. `apply` is plain data: exactly what applyCatchUp()
     writes. Nothing is written by this function.

   NXT.coach.trainAdvice(exercise) → coachFor()'s output + coordinated | null
     {...NXT.coachFor(exercise), coordinated:{hold, reason, source}}
     For Train's coach line, today's session, state.gym — the same inputs as
     coachFor(), which stays untouched (D25), as does aimFor(). Identical to
     coachFor() plus {hold:false, reason:null, source:null} unless coachFor()
     steps the load up (kind 'load') AND the weight decision is cautious
     (coordinator rule 3). Then: kind 'hold', headline "Hold 30 kg — weight
     decision reads “Losing quickly”", per-set targets at the last session's
     best load (coachFor()'s drop pattern shifted to that best set), weight/
     reps = that best set, a one-sentence note that the Aim still shows the
     engine's next step, and coordinated {hold:true, reason:"Weight decision
     reads “…”", source:'weight'}. null when coachFor() is null.

   NXT.coach.insights(date) → Insight[] (≤ 3, ranked, for Today)
     The array also carries `.all`: every visible insight, ranked (≤ 1 per
     domain, so ≤ 5). Insight =
     {id, domain:'schedule'|'strength'|'weight'|'cardio'|'data',
      severity:'act'|'watch'|'info', title, body,
      evidence:[{label, value, date?}],
      why:{noticed, evidence, matters, canDo}   (observation → evidence →
          interpretation → optional action, each a plain sentence)
      action?:{label, kind:'catchUp'|'open'|'excuse', payload},
      dismissible:true, fingerprint}
     action payloads: catchUp → the Proposal (confirm, then applyCatchUp);
     excuse → {date}; open → one of {sheet:'review'} (NXT.openReview),
     {sheet:'cardio'} (showCardioSheet), {sheet:'weight'}
     (apx95OpenQuickWeight), {sheet:'day', date} (NXT.openDay),
     {tab:'train'}, {tab:'weight', view:'strength', exercise?}.
     fingerprint = FNV-1a of the evidence labels+values. Values are chosen at
     the granularity that should re-surface a dismissed insight (a new session,
     new minutes, a new verdict), not daily noise.
     ids: schedule.catchup:<missedDate> · schedule.behind:<weekStart> ·
          schedule.streak · strength.ready · strength.hold · strength.stall ·
          strength.returning · cardio.week:<weekStart> · weight.review ·
          data.morning
     Evaluators (each proposes 0–n candidates):
       schedule  the catch-up proposal (act); else "week behind" when planned
                 lifting days − logged − still scheduled > 0: act while the
                 sessions left fit in the days left, info once they cannot;
                 plus a weeks-at-plan streak (activityWeeks/activitySummary,
                 full weeks only) as info from 3 weeks
       strength  over lifts planned in the next 7 days at state.gym, last
                 trained ≤ 14 days ago and not today: aimFor() load step →
                 one combined "ready to move up" (act); coachFor() stall → one
                 insight naming the lift (watch); 15+ days since → info
       cardio    only with cardio logged in the last 28 days and the week's
                 minutes behind the plan's pace (share of its walk days already
                 past × target; calendar days if the plan has none): act when
                 the rest fits at ≤ 45 min a day, else info
       weight    mirrors NXT.review(): only when its tone is 'watch' or a
                 plateau is detected; same headline; tone decides severity
       data      last morning weigh-in exactly 3 days ago → act (weighing in
                 today keeps the EWMA continuous); 4+ → watch; only
                 post-workout/scan readings and no morning one → watch
     Coordinator: drop a candidate whose newest evidence date is > 14 days
     old; a cautious weight decision (tone 'watch', or a title/action about
     recovery or slipping lifts) turns strength.ready into strength.hold
     (info), and trainAdvice() into a hold the same way; hide dismissed
     id|fingerprint pairs; keep one per domain (highest
     severity; a catch-up suppresses "week behind" outright); rank by severity
     (act > watch > info), then schedule > strength > cardio > weight > data,
     then id.

   NXT.coach.weekReview(weekStart?) → WeekReview | null
     The last completed Mon–Sun week before state.date's week, or the given
     week (any date in it). null for a week not yet over, or when nothing at
     all (activity or morning weigh-in) is stored on or before its Sunday.
     {weekStart, weekEnd,
      lifts:{planned, done, missed, excused, moved}  (done = activityWeeks
            liftDays; partial days count as done; planned as in context.week)
      sets, tonnage, vsPrev:{sets, tonnage}   (activityWeeks; null before the
            first activity record or when there is no previous week)
      outcomes:{beat, matched, below, exercises}  (D20: each exercise's best
            working set vs its previous session at that gym — the finish
            summary's rule; exercises = exercise-sessions, compared or not)
      cardio:{min, target, sessions}
      weight:{avg, prevAvg, change, readings}  (Mon–Sun morning average like
            Week by week; null below 3 readings; kg, 2 decimals)
      days:[DayContext ×7], nextWeek:[{date, type, label} ×7] (the week after),
      seen (cfg().coach.reviewSeen ≥ weekStart), headline, lines:[strings]}

   NXT.coach.thresholds — the frozen constants below.

   ===== WRITERS (persist through NXT.commit: save, close sheet, repaint) =====
   Stored additively inside settings.cutSupport (no new apm_* key; rides
   backup/sync with settings), each object created lazily on first write:
     cfg().dayNotes = {'YYYY-MM-DD': {status:'excused', reason, note, ts}
                                   | {status:'moved', to:'YYYY-MM-DD', ts}}
     cfg().coach    = {dismissed:{'<insight id>|<fingerprint>': ts},
                       reviewSeen:'YYYY-MM-DD' (a Monday)}
   NXT.coach.excuse(date, reason, note)   reason ∈ sick|travel|rest|other
       (else other), note ≤ 140 chars. Refused with a toast when the day has
       logged sets (like setDayType), its own record (cardio on a walk day,
       floorball on a floorball day), or is a Rest day. → boolean
   NXT.coach.unexcuse(date)               removes an 'excused' note. → boolean
   NXT.coach.dismiss(id, fingerprint?)    hides that insight until its
       fingerprint changes; without a fingerprint the current one is used.
       Prunes entries older than 60 days (cap 200). → boolean
   NXT.coach.markReviewSeen(weekStart?)   monotonic; defaults to the last
       completed week. commit() closes an open sheet, so call it from the
       review sheet's Done/close action. → boolean
   NXT.coach.applyCatchUp(proposal)       re-derives the proposal and refuses
       a stale one; records dayNotes[missedDate] = {status:'moved', to, ts},
       then writes today's override through the existing NXT.setDayType(date,
       type) (one commit; never settings.weeklyPlan/dayOverrides directly). If
       setDayType refuses, the note is rolled back. The UI confirms first.
   Sync note: Safe Sync merges these objects local-wins per key, so on a
   second device an unexcused note can come back from the cloud (same as
   every other cutSupport object today). */
"use strict";
Object.assign(NXT, (() => {
  const N = NXT;
  const DAY = 864e5;
  const NOT_LIFT = ["Rest", "Zone2", "Floorball"];
  const OFF_PLAN = ["excused", "moved", "untracked"];
  const T = Object.freeze({
    CATCHUP_WINDOW_DAYS: 7,   // a missed lifting day 1–7 days back can be caught up
    STALE_DAYS: 14,           // an insight whose newest evidence is older is dropped
    MORNING_GAP_DAYS: 3,      // the EWMA restarts after a gap of MORE than 3 days
    CARDIO_MAX_PER_DAY: 45,   // cardio is 'act' only if reachable at ≤ 45 min a day
    STREAK_MIN_WEEKS: 3,      // weeks-at-plan streak shown from 3 full weeks
    RETURNING_DAYS: 15,       // cue(): more than 14 days away eases back in
    RECENT_LIFT_DAYS: 28,     // lifts with sets in this window join the context
    RECENT_CARDIO_DAYS: 28,   // no cardio nudges unless cardio was logged in it
    LOOKAHEAD_DAYS: 7,        // planned lifts = routines of the next 7 days
    TOP: 3,                   // insights shown on Today
    MAX_LIFTS: 40,
    MAX_RANGE_DAYS: 92,
    DISMISS_KEEP_DAYS: 60,
    DISMISS_MAX: 200,
    NOTE_MAX: 140
  });
  const SEVERITY = {act: 0, watch: 1, info: 2};
  const DOMAIN = {schedule: 0, strength: 1, cardio: 2, weight: 3, data: 4};
  const REASONS = ["sick", "travel", "rest", "other"];
  const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* ---- small pure helpers ------------------------------------------------ */
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = v => !!v && typeof v === "object" && !Array.isArray(v);
  const isDate = d => typeof d === "string" && Number.isFinite(N.dateMs(d));
  const isLift = t => typeof t === "string" && t !== "" && !NOT_LIFT.includes(t);
  const gap = (from, to) => Math.round((N.dateMs(to) - N.dateMs(from)) / DAY);
  const numOr = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const r2 = v => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
  const kg = v => String(Math.round(Number(v) * 100) / 100);
  const count = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
  const weekday = d => WEEKDAY[new Date(N.dateMs(d)).getUTCDay()];
  const dayShort = d => weekday(d).slice(0, 3) + " " + N.shortDate(d);
  const sign1 = v => (Math.abs(v) < 0.05 ? "±0.0" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1));
  const signedInt = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(Math.round(v)).toLocaleString("en-SG");
  const thousands = v => Math.round(Number(v)).toLocaleString("en-SG");
  const cardioTarget = () => Number(typeof settings === "object" && settings && settings.zone2WeeklyTarget) || 90;
  const say = msg => { if (typeof toast === "function") toast(msg); };
  const warn = (where, e) => { try { console.warn("[coach] " + where + " failed", e); } catch (_) { /* no console */ } };
  /* "yesterday", "Wednesday" (2–6 days back), "last Wednesday" (7), else "Wed 7 Oct". */
  function relDay(d, ref) {
    const k = gap(d, ref);
    if (k === 0) return "today";
    if (k === 1) return "yesterday";
    if (k === -1) return "tomorrow";
    if ((k > 1 && k < 7) || (k < -1 && k > -7)) return weekday(d);
    if (k === 7) return "last " + weekday(d);
    return dayShort(d);
  }
  /* FNV-1a, 32 bit: a stable, dependency-free fingerprint. */
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  const fingerprint = ev => hash(JSON.stringify((ev || []).map(e => [String(e.label), String(e.value)])));

  /* ---- stored notes and coach memory (read without creating anything) ---- */
  function store() { return typeof settings === "object" && settings && plain(settings.cutSupport) ? settings.cutSupport : {}; }
  function notesMap() { const n = store().dayNotes; return plain(n) ? n : {}; }
  function coachMap() { const c = store().coach; return plain(c) ? c : {}; }
  function dismissedMap() { const d = coachMap().dismissed; return plain(d) ? d : {}; }
  function noteFor(d) {
    const n = notesMap()[d];
    if (!plain(n)) return null;
    const note = typeof n.note === "string" && n.note.trim() ? n.note.trim() : null;
    if (n.status === "excused") return {status: "excused", reason: REASONS.includes(n.reason) ? n.reason : "other", note, to: null};
    if (n.status === "moved") return {status: "moved", reason: null, note, to: isDate(n.to) ? n.to : null};
    return null;
  }

  /* ---- read guard -----------------------------------------------------------
     Runs fn with temporary state fields and with cue()'s suggestion log made
     inert (see header). Synchronous; everything is restored in finally. */
  function silenceable() {
    if (typeof persist === "undefined") return true;
    return globalThis.persist === persist;
  }
  function pinned(patch, fn) {
    const keys = Object.keys(patch || {}), prior = keys.map(k => [k, has(state, k), state[k]]);
    const c = N.cfg(), log = Array.isArray(c.suggestions) ? c.suggestions : null, kept = log ? log.slice() : null;
    const g = globalThis, real = g.persist, swap = typeof real === "function";
    if (swap) g.persist = function () { /* reads never write */ };
    try {
      for (const k of keys) state[k] = patch[k];
      return fn();
    } finally {
      for (const [k, had, v] of prior) { if (had) state[k] = v; else delete state[k]; }
      if (swap) g.persist = real;
      if (log) {
        if (c.suggestions !== log) c.suggestions = log;
        if (log.length !== kept.length || log.some((r, i) => r !== kept[i])) log.splice(0, log.length, ...kept);
      }
    }
  }
  function asOf(date, fn) {
    return date === state.date ? pinned({}, fn) : pinned({date, dayType: N.typeFor(date)}, fn);
  }
  /* review() and strengthItems() rebuild every lift's sessions from all logs, one
     full scan per lift. What they report depends only on the last 56 days: a lift
     gets a status/delta only when its last four sessions fall inside 56 days, and
     review() (and diagnose()) read nothing but those delta-based statuses. So they
     run over that window's logs and give the identical answer for a fraction of
     the cost. Each lift's first working row is kept too, so strengthItems() sees
     its lifts in the same first-appearance order (its tie-break before the cap of
     24). The suite pins the equality against the full call on long histories. */
  const REVIEW_WINDOW_DAYS = 56;
  function windowed(ix, end, fn) {
    const from = N.dateAdd(end, -REVIEW_WINDOW_DAYS), first = new Set(), seen = new Set();
    for (const r of ix.work) {   /* workRows() in log order, as strengthItems() walks it */
      if (r.date > end) continue;
      const k = JSON.stringify([r.exercise || r.name, r.gym || "Gym A"]);
      if (!seen.has(k)) { seen.add(k); first.add(r); }
    }
    const logs = (Array.isArray(state.logs) ? state.logs : []).filter(r => r && (first.has(r) || !(typeof r.date === "string" && (r.date < from || r.date > end))));
    return pinned({logs}, fn);
  }

  /* ---- one pass over the records ----------------------------------------- */
  function index() {
    const today = state.date;
    const sets = new Map(), gyms = new Map(), cardio = new Map(), floor = new Map();
    const anyLog = new Set(), byName = new Map(), workBy = new Map(), movedFrom = new Map();
    let first = null, lastSet = null, lastCardio = null;
    const mark = d => { if (first === null || d < first) first = d; };
    const work = N.workRows();
    for (const r of work) {
      sets.set(r.date, (sets.get(r.date) || 0) + 1);
      const gym = r.gym || "Gym A", name = r.exercise || r.name;
      if (!gyms.has(r.date)) gyms.set(r.date, new Map());
      gyms.get(r.date).set(gym, (gyms.get(r.date).get(gym) || 0) + 1);
      if (typeof name === "string" && name) {
        const k = name + "\u0000" + gym;
        if (!workBy.has(k)) workBy.set(k, {name, gym, rows: []});
        workBy.get(k).rows.push(r);
      }
      mark(r.date);
      if (!lastSet || r.date > lastSet) lastSet = r.date;
    }
    for (const r of Array.isArray(state.logs) ? state.logs : []) {
      if (!r || !isDate(r.date)) continue;
      anyLog.add(r.date);
      const name = r.exercise || r.name;
      if (typeof name === "string" && name) { if (!byName.has(name)) byName.set(name, []); byName.get(name).push(r); }
    }
    for (const r of Array.isArray(state.cardio) ? state.cardio : []) {
      if (!r || !isDate(r.date) || r.date > today) continue;
      const m = N.finite(r.duration);
      if (!(m > 0)) continue;
      cardio.set(r.date, (cardio.get(r.date) || 0) + m);
      mark(r.date);
      if (!lastCardio || r.date > lastCardio) lastCardio = r.date;
    }
    for (const r of Array.isArray(state.floorball) ? state.floorball : []) {
      if (!r || !isDate(r.date) || r.date > today) continue;
      floor.set(r.date, (floor.get(r.date) || 0) + 1);
      mark(r.date);
    }
    const notes = notesMap();
    for (const d of Object.keys(notes).sort()) { const n = noteFor(d); if (n && n.status === "moved" && n.to) movedFrom.set(n.to, d); }
    return {today, work, sets, gyms, cardio, floor, anyLog, byName, workBy, movedFrom, first, lastSet, lastCardio};
  }
  const keyFor = (type, d, gym) => (typeof sessionKey === "function" ? sessionKey(type, d, gym) : `${d}__${gym || "Gym"}__${type}`);
  function routine(type, gym) {
    try { const t = N.templateFor(type, gym); return Array.isArray(t) ? t.filter(e => e && typeof e.name === "string") : []; }
    catch (e) { return []; }
  }
  function gymOf(ix, d) {
    const g = ix.gyms.get(d);
    if (!g) return state.gym || "Gym A";
    return [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  }
  /* Planned working sets for that date: its session queue (a shortened session
     stays short), else its session targets, else the saved routine. */
  function plannedSets(d, type, gym) {
    const key = keyFor(type, d, gym), cs = store();
    const targets = plain(cs.sessionTargets) && Array.isArray(cs.sessionTargets[key]) ? cs.sessionTargets[key] : null;
    const queue = plain(state.sessionPlans) && Array.isArray(state.sessionPlans[key]) && state.sessionPlans[key].length ? state.sessionPlans[key] : null;
    const tpl = routine(type, gym);
    const setsOf = e => { const n = Number(e && e.sets); return Number.isFinite(n) && n > 0 ? n : 0; };
    if (queue) return queue.reduce((a, name) => a + setsOf((targets && targets.find(x => x && x.name === name)) || tpl.find(x => x.name === name) || {sets: 3}), 0);
    if (targets && targets.length) return targets.reduce((a, e) => a + setsOf(e), 0);
    return tpl.reduce((a, e) => a + setsOf(e), 0);
  }
  function dayCtx(ix, d) {
    const type = N.typeFor(d), lift = isLift(type), today = ix.today;
    const sets = ix.sets.get(d) || 0, cardioMin = Math.round(ix.cardio.get(d) || 0), floorball = ix.floor.get(d) || 0;
    const note = noteFor(d);
    const ownRecord = lift ? sets > 0 : type === "Zone2" ? cardioMin > 0 : type === "Floorball" ? floorball > 0 : false;
    const expects = lift || type === "Zone2" || (type === "Floorball" && !!(N.features && N.features.floorball));
    let status;
    if (ownRecord) {
      if (lift) { const planned = plannedSets(d, type, gymOf(ix, d)); status = planned > 0 && sets < planned / 2 ? "partial" : "done"; }
      else status = "done";
    }
    else if (note && note.status === "excused") status = "excused";
    else if (note && note.status === "moved") status = "moved";
    else if (type === "Rest") status = "rest";
    else if (d === today) status = "today";
    else if (d > today) status = "upcoming";
    else if (!expects || !ix.first || d < ix.first) status = "untracked";
    else if (sets > 0 || cardioMin > 0 || floorball > 0) status = "partial";
    else status = "missed";
    return {
      date: d, type, label: N.label(type), status,
      reason: note && note.status === "excused" ? note.reason : null,
      note: note ? note.note : null,
      movedTo: note && note.status === "moved" ? note.to : null,
      movedFrom: ix.movedFrom.get(d) || null,
      logged: {sets, cardioMin, floorball}
    };
  }
  function weekOf(ix, date) {
    const start = N.weekStart(date), end = N.dateAdd(start, 6), days = [];
    for (let i = 0; i < 7; i++) days.push(dayCtx(ix, N.dateAdd(start, i)));
    const lifts = days.filter(x => isLift(x.type));
    let liftsDone = 0, cardioMin = 0;
    for (const x of days) if (x.date <= date) { if (x.logged.sets > 0) liftsDone++; cardioMin += ix.cardio.get(x.date) || 0; }
    return {
      start, end, days,
      liftsPlanned: lifts.filter(x => !OFF_PLAN.includes(x.status)).length,
      liftsDone,
      liftsMissed: lifts.filter(x => x.status === "missed").length,
      liftsRemaining: lifts.filter(x => x.date >= date && (x.status === "today" || x.status === "upcoming")).length,
      cardioMin: Math.round(cardioMin), cardioTarget: cardioTarget(), daysLeft: gap(date, end) + 1
    };
  }

  /* ---- lifts ---------------------------------------------------------------- */
  function routineNames(type, d, gym) {
    const key = keyFor(type, d, gym);
    const queue = d === state.date && plain(state.sessionPlans) && Array.isArray(state.sessionPlans[key]) && state.sessionPlans[key].length ? state.sessionPlans[key] : null;
    return (queue || routine(type, gym).map(e => e.name)).filter(n => typeof n === "string" && n);
  }
  /* aimFor()/coachFor() for one lift, for its gym and the routine of its next
     scheduled day. They read only the lift's last three sessions (last, prev,
     slice(-3), at(-3)), so state.logs is narrowed while they run: first to the
     exercise's rows, then to the dates of the engine's own last three sessions
     (sessionRows() decides which dates count). The answer is identical and the
     cost no longer grows with history; the suite pins the equality. */
  function progression(ix, name, gym, type) {
    if (!silenceable()) return {aim: null, coach: null};
    const rows = ix.byName.get(name) || [];
    return pinned({gym, dayType: type, logs: rows}, () => {
      const keep = new Set(N.sessionRows(name, gym, state.date, 100).slice(-3).map(s => s.date));
      return pinned({logs: rows.filter(r => keep.has(r.date))}, () => {
        const a = N.aimFor(name), c = N.coachFor(name);
        return {
          aim: a ? {weight: numOr(a.weight), reps: numOr(a.reps), kind: a.kind || null, why: a.why || null} : null,
          coach: c ? {kind: c.kind || null, headline: c.headline || null, note: c.note || null, effort: c.effort || null} : null
        };
      });
    });
  }
  function liftsFor(ix, date) {
    const gymNow = state.gym || "Gym A", pairs = new Map();
    const add = (name, gym, nextDate, nextType) => {
      const k = name + "\u0000" + gym, p = pairs.get(k);
      if (!p) pairs.set(k, {name, gym, nextDate: nextDate || null, nextType: nextType || null});
      else if (nextDate && (!p.nextDate || nextDate < p.nextDate)) { p.nextDate = nextDate; p.nextType = nextType; }
    };
    for (let k = 0; k < T.LOOKAHEAD_DAYS; k++) {
      const d = N.dateAdd(date, k), t = N.typeFor(d), n = noteFor(d);
      if (!isLift(t) || (n && n.status === "excused")) continue;
      for (const name of routineNames(t, d, gymNow)) add(name, gymNow, d, t);
    }
    const since = N.dateAdd(date, 1 - T.RECENT_LIFT_DAYS);
    for (const w of ix.workBy.values()) if (w.rows.some(r => r.date >= since)) add(w.name, w.gym);
    const out = [];
    for (const p of pairs.values()) {
      const w = ix.workBy.get(p.name + "\u0000" + p.gym), rows = w ? w.rows : [];
      let lastDate = null;
      for (const r of rows) if (!lastDate || r.date > lastDate) lastDate = r.date;
      const b = lastDate ? N.bestSet(rows.filter(r => r.date === lastDate)) : null;
      const daysSince = lastDate ? gap(lastDate, date) : null;
      const pr = lastDate ? progression(ix, p.name, p.gym, p.nextType || N.typeFor(date)) : {aim: null, coach: null};
      const aim = pr.aim;
      out.push({
        name: p.name, gym: p.gym, lastDate, daysSince,
        best: b ? {weight: numOr(b.weight), reps: numOr(b.reps)} : null,
        aim,
        holdReason: aim && aim.kind !== "load" && aim.why ? aim.why : null,
        stall: !!(pr.coach && pr.coach.kind === "stall"),
        readyToIncrement: !!(aim && aim.kind === "load"),
        returning: daysSince !== null && daysSince >= T.RETURNING_DAYS,
        nextDate: p.nextDate, nextType: p.nextType,
        coach: pr.coach
      });
    }
    out.sort((a, b) => (a.nextDate ? 0 : 1) - (b.nextDate ? 0 : 1) || String(a.nextDate || "").localeCompare(String(b.nextDate || ""))
      || String(b.lastDate || "").localeCompare(String(a.lastDate || "")) || a.name.localeCompare(b.name) || a.gym.localeCompare(b.gym));
    return out.slice(0, T.MAX_LIFTS);
  }

  /* ---- context -------------------------------------------------------------- */
  function contextualOnly(canon, lastMorning, date) {
    const canonDates = new Set(canon.map(r => r.date)), from = lastMorning || N.dateAdd(date, -T.STALE_DAYS), seen = new Set();
    let last = null;
    for (const r of Array.isArray(state.bws) ? state.bws : []) {
      if (!r || !isDate(r.date) || r.date <= from || r.date > date || canonDates.has(r.date)) continue;
      const timing = String(r.timeOfDay || "").trim().toLowerCase(), w = N.finite(r.weight);
      if (!timing || timing === "morning" || w === null || w < 20 || w > 400) continue;
      seen.add(r.date);
      if (!last || r.date > last) last = r.date;
    }
    return {days: seen.size, lastDate: last};
  }
  const compactWindow = w => ({n: w && Number.isFinite(w.n) ? w.n : 0, avg: r2(w && w.avg)});
  function buildContext(date, ix) {
    const week = weekOf(ix, date);
    const rv = windowed(ix, date, () => N.review()), ts = N.trendStats(), pl = N.detectPlateau();
    const canon = N.weights(), lastRow = canon.length ? canon[canon.length - 1] : null, lastMorning = lastRow ? lastRow.date : null;
    const ctxOnly = contextualOnly(canon, lastMorning, date);
    const wp = typeof settings === "object" && settings && plain(settings.weeklyPlan) ? settings.weeklyPlan : {}, weeklyPlan = {};
    for (let i = 0; i < 7; i++) weeklyPlan[i] = typeof wp[i] === "string" && wp[i] ? wp[i] : null;
    const ov = typeof settings === "object" && settings && plain(settings.dayOverrides) ? settings.dayOverrides : {}, overrides = {};
    const from = N.dateAdd(N.weekStart(date), -7), to = N.dateAdd(N.weekStart(date), 13);
    for (const d of Object.keys(ov).sort()) if (isDate(d) && d >= from && d <= to && typeof ov[d] === "string" && ov[d]) overrides[d] = ov[d];
    const cutStart = typeof settings === "object" && settings && isDate(settings.cutStart) ? settings.cutStart : null;
    const goal = store().targetConfirmed && typeof goalLow === "function" && typeof goalHigh === "function" ? {low: numOr(goalLow()), high: numOr(goalHigh())} : null;
    const confidence = pl && ["high", "medium", "low"].includes(pl.confidence) ? pl.confidence : null;
    const since = d => (d ? gap(d, date) : null);
    return {
      date, dayType: N.typeFor(date),
      plan: {weeklyPlan, overrides},
      week,
      lifts: liftsFor(ix, date),
      weight: {
        trend: {current: compactWindow(ts.current), previous: compactWindow(ts.previous), earlier: compactWindow(ts.earlier),
          change: r2(ts.change), priorChange: r2(ts.priorChange), percent: r2(ts.percent)},
        review: rv ? {tone: rv.tone || null, title: rv.title || null, message: rv.message || null, action: rv.action || null, reason: rv.reason || null, change: r2(rv.change)} : null,
        confidence,
        plateau: pl ? {ok: !!pl.ok, plateau: pl.plateau === true, status: pl.status || null, weeklyRate: r2(pl.weeklyRate), lower: r2(pl.lower), upper: r2(pl.upper),
          n: pl.n || 0, spanDays: pl.spanDays || 0, plateauDays: numOr(pl.plateauDays), confidence, lastDate: isDate(pl.lastDate) ? pl.lastDate : null, lastAvg: r2(pl.lastAvg), reason: pl.reason || null} : null,
        lastMorningDate: lastMorning, lastMorningWeight: lastRow ? r2(lastRow.weight) : null,
        daysSinceMorning: since(lastMorning), contextualOnlyDays: ctxOnly.days
      },
      cardio: {weekMin: week.cardioMin, target: week.cardioTarget, lastDate: ix.lastCardio},
      cut: {start: cutStart, goal, elapsedDays: cutStart && cutStart <= date ? gap(cutStart, date) : null},
      freshness: {lastMorningDate: lastMorning, daysSinceMorning: since(lastMorning), lastSetDate: ix.lastSet, daysSinceSet: since(ix.lastSet),
        lastCardioDate: ix.lastCardio, daysSinceCardio: since(ix.lastCardio), lastContextualDate: ctxOnly.lastDate},
      features: Object.assign({}, N.features || {})
    };
  }

  /* ---- catch-up --------------------------------------------------------------- */
  function proposalAt(ix, date) {
    const todayType = N.typeFor(date), todayNote = noteFor(date);
    if (isLift(todayType) || (todayNote && todayNote.status === "excused")) return null;
    if (ix.anyLog.has(date) || ix.cardio.has(date) || ix.floor.has(date)) return null;
    const weekEnd = N.dateAdd(N.weekStart(date), 6);
    for (let k = 1; k <= T.CATCHUP_WINDOW_DAYS; k++) {
      const m = N.dateAdd(date, -k), day = dayCtx(ix, m);
      /* The lift did not happen: 'missed', or D48's 'partial' with zero working sets
         (a walk or other activity was logged instead; the status word stays partial
         and `logged` carries what was done). Owner decision, 2026-10-13. */
      if (!isLift(day.type) || !(day.status === "missed" || (day.status === "partial" && day.logged.sets === 0))) continue;
      let covered = false;
      for (let d = N.dateAdd(m, 1); d <= weekEnd && !covered; d = N.dateAdd(d, 1)) {
        if (d === date || N.typeFor(d) !== day.type) continue;
        if (d > date) { const n = noteFor(d); covered = !(n && n.status === "excused"); }
        else covered = (ix.sets.get(d) || 0) > 0;
      }
      if (covered) continue;
      return {
        missedDate: m, missedType: day.type, missedLabel: day.label, todayType,
        logged: {sets: day.logged.sets, cardioMin: day.logged.cardioMin, floorball: day.logged.floorball},
        consequences: consequences(m, day, date, todayType),
        apply: {setDayType: {date, type: day.type}, dayNote: {date: m, status: "moved", to: date}}
      };
    }
    return null;
  }
  function consequences(m, day, date, todayType) {
    const out = [`${day.label} moves to today (${dayShort(date)}).`];
    out.push(todayType === "Rest" ? "Today is no longer a rest day." : `Today’s ${N.label(todayType)} is dropped for this week.`);
    const k = gap(m, date);
    out.push(`${k >= 1 && k < 7 ? weekday(m) : dayShort(m)} reads Moved.`);
    const next = N.dateAdd(date, 1), nextType = N.typeFor(next), nextNote = noteFor(next);
    if (isLift(nextType) && !(nextNote && nextNote.status === "excused")) out.push(`Tomorrow is still ${N.label(nextType)}, so lifting falls on two days in a row.`);
    out.push("The weekly plan itself does not change.");
    return out;
  }

  /* ---- insight construction -------------------------------------------------- */
  function insight(o) {
    const out = {
      id: o.id, domain: o.domain, severity: o.severity, title: o.title, body: o.body,
      evidence: (o.evidence || []).map(e => { const x = {label: String(e.label), value: String(e.value)}; if (isDate(e.date)) x.date = e.date; return x; }),
      why: {noticed: o.why.noticed, evidence: o.why.evidence, matters: o.why.matters, canDo: o.why.canDo}
    };
    if (o.action) out.action = {label: o.action.label, kind: o.action.kind, payload: o.action.payload};
    out.dismissible = true;
    out.fingerprint = fingerprint(out.evidence);
    return out;
  }
  function stale(c, date) {
    const ds = c.evidence.map(e => e.date).filter(isDate).sort();
    return ds.length > 0 && gap(ds[ds.length - 1], date) > T.STALE_DAYS;
  }
  const rank = (a, b) => SEVERITY[a.severity] - SEVERITY[b.severity] || DOMAIN[a.domain] - DOMAIN[b.domain] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  /* ---- evaluators: schedule ---------------------------------------------------- */
  function freeDay(ix, date, end) {
    for (let d = date; d <= end; d = N.dateAdd(d, 1)) {
      if (isLift(N.typeFor(d))) continue;
      if (ix.anyLog.has(d) || ix.cardio.has(d) || ix.floor.has(d)) continue;
      const n = noteFor(d);
      if (n && n.status === "excused") continue;
      return d;
    }
    return null;
  }
  function catchUpInsight(p, ctx) {
    const w = ctx.week, date = ctx.date, sameWeek = p.missedDate >= w.start, when = relDay(p.missedDate, date);
    const most = w.liftsDone + w.liftsRemaining;
    /* Named only for cardio; any other activity stays generic (D55 features stay silent). */
    const instead = p.logged.cardioMin > 0 ? ` (${p.logged.cardioMin} min of cardio was logged instead)` : p.logged.floorball > 0 ? " (other activity was logged instead)" : "";
    return insight({
      id: "schedule.catchup:" + p.missedDate, domain: "schedule", severity: "act",
      title: `${p.missedLabel} missed ${/^(yesterday|last )/.test(when) ? when : "on " + when}`,
      body: `Today is planned as ${N.label(p.todayType)} with nothing logged yet, so the session can move here.`,
      evidence: [{label: "Missed session", value: `${p.missedLabel} · ${dayShort(p.missedDate)}`, date: p.missedDate},
        {label: "Planned today", value: N.label(p.todayType), date}],
      why: {
        noticed: `${p.missedLabel} on ${dayShort(p.missedDate)} has no logged sets${instead} and is not marked excused or moved.`,
        evidence: `Today (${dayShort(date)}) is planned as ${N.label(p.todayType)} and nothing is logged yet. This week: ${w.liftsDone} of ${w.liftsPlanned} planned lifting days logged.`,
        matters: sameWeek ? `Without it, this week can reach at most ${most} of ${w.liftsPlanned} planned lifting days.` : `No later ${p.missedLabel} is scheduled before the end of this week.`,
        canDo: "Move it to today (you see exactly what changes and confirm first), or mark the day excused."
      },
      action: {label: "Move to today", kind: "catchUp", payload: p}
    });
  }
  function behindInsight(ctx, ix) {
    const w = ctx.week, date = ctx.date, short = w.liftsPlanned - w.liftsDone - w.liftsRemaining;
    if (!(short > 0)) return null;
    const need = w.liftsPlanned - w.liftsDone, recoverable = need <= w.daysLeft;
    /* past lifting days with no working sets: 'missed', or 'partial' with only other activity */
    const missed = w.days.filter(x => isLift(x.type) && x.date < date && x.logged.sets === 0 && !OFF_PLAN.includes(x.status));
    const last = missed.length ? missed[missed.length - 1] : null;
    const lastLift = w.days.filter(x => x.date <= date && x.logged.sets > 0).map(x => x.date).pop() || null;
    const missedText = missed.length ? missed.map(x => `${weekday(x.date).slice(0, 3)} ${x.label}`).join(", ") : "none";
    const status = `${w.liftsDone} of ${w.liftsPlanned} planned lifting days logged, ${w.liftsRemaining} still scheduled, ${count(w.daysLeft, "day")} left.`;
    const evidence = [{label: "Lifting days logged", value: `${w.liftsDone} of ${w.liftsPlanned}`, date: lastLift},
      {label: "Missed", value: missedText, date: last ? last.date : null}];
    if (recoverable) {
      const free = freeDay(ix, date, w.end);
      return insight({
        id: "schedule.behind:" + w.start, domain: "schedule", severity: "act",
        title: `${count(short, "lifting session")} behind this week`,
        body: status,
        evidence,
        why: {
          noticed: `This week's planned lifting days are not all logged or still scheduled (missed: ${missedText}).`,
          evidence: status,
          matters: `${count(need, "session")} still fit${need === 1 ? "s" : ""} in the ${count(w.daysLeft, "day")} left.`,
          canDo: free ? `${weekday(free)} has nothing planned; you can make it a lifting day. Nothing changes unless you do.` : "Nothing changes unless you change a day."
        },
        action: free ? {label: `Plan ${free === date ? "today" : weekday(free)}`, kind: "open", payload: {sheet: "day", date: free}} : undefined
      });
    }
    return insight({
      id: "schedule.behind:" + w.start, domain: "schedule", severity: "info",
      title: `${w.liftsDone} of ${w.liftsPlanned} lifting days, ${count(w.daysLeft, "day")} left`,
      body: "Not every planned session can fit in the days left this week.",
      evidence,
      why: {
        noticed: `This week's plan has more lifting sessions left (${need}) than days (${w.daysLeft}).`,
        evidence: status,
        matters: "Next week starts from its own plan; nothing carries over automatically.",
        canDo: last ? `If ${weekday(last.date)} was sick, travel or planned rest, mark it excused so the week reads accurately.` : "No action needed."
      },
      action: last ? {label: `Excuse ${weekday(last.date)}`, kind: "excuse", payload: {date: last.date}} : undefined
    });
  }
  function streakInsight(ctx) {
    const items = N.activityWeeks(26, ctx.date), sum = N.activitySummary(items), need = sum.planLifts;
    if (!(need > 0)) return null;
    const full = items.filter(w => !w.current);
    let run = 0, lastEnd = null, firstStart = null;
    for (let i = full.length - 1; i >= 0; i--) {
      if (full[i].liftDays < need) break;
      run++; lastEnd = lastEnd || full[i].end; firstStart = full[i].start;
    }
    if (run < T.STREAK_MIN_WEEKS) return null;
    return insight({
      id: "schedule.streak", domain: "schedule", severity: "info",
      title: `${run} weeks in a row at plan`,
      body: `Every full week since ${dayShort(firstStart)} had at least ${count(need, "lifting day")}.`,
      evidence: [{label: "Weeks at plan", value: `${run} in a row · plan of ${need}`, date: lastEnd}],
      why: {
        noticed: `The last ${run} full Mon–Sun weeks each had at least ${need} days with logged working sets.`,
        evidence: "Counted from logged working sets; the week in progress is not counted.",
        matters: `The count uses today's weekly plan (${count(need, "lifting day")}); the app does not keep plan history.`,
        canDo: "No action needed."
      }
    });
  }
  function evalSchedule(ctx, ix) {
    const out = [], p = proposalAt(ix, ctx.date);
    if (p) out.push(catchUpInsight(p, ctx));
    else { const b = behindInsight(ctx, ix); if (b) out.push(b); }
    const s = streakInsight(ctx);
    if (s) out.push(s);
    return out;
  }

  /* ---- evaluators: strength --------------------------------------------------- */
  function upcomingLifts(ctx) {
    const horizon = N.dateAdd(ctx.date, T.LOOKAHEAD_DAYS - 1), gymNow = state.gym || "Gym A";
    return ctx.lifts.filter(l => l.gym === gymNow && l.nextDate && l.nextDate <= horizon && l.lastDate && l.lastDate !== ctx.date);
  }
  function readyLifts(ctx) {
    return upcomingLifts(ctx).filter(l => l.readyToIncrement && l.aim && l.best && l.daysSince <= T.STALE_DAYS);
  }
  const loadText = l => `${l.name} ${kg(l.best.weight)} × ${l.best.reps} → ${kg(l.aim.weight)} kg`;
  function readyInsight(ctx) {
    const ready = readyLifts(ctx);
    if (!ready.length) return null;
    const first = ready[0], names = ready.map(l => l.name).join(", ");
    return insight({
      id: "strength.ready", domain: "strength", severity: "act",
      title: ready.length === 1 ? `Ready to move up: ${first.name}` : `${ready.length} lifts ready to move up`,
      body: ready.slice(0, 3).map(loadText).join(" · ") + (ready.length > 3 ? ` · +${ready.length - 3} more` : ""),
      evidence: ready.map(l => ({label: l.name, value: `${kg(l.best.weight)} × ${l.best.reps} → ${kg(l.aim.weight)} × ${l.aim.reps}`, date: l.lastDate}))
        /* Stage 1: say when the step rests on reps alone (no reps-in-reserve recorded). */
        .concat(ready.some(l => l.coach && l.coach.effort && l.coach.effort.state !== "full")
          ? [{label: "Effort", value: ready.every(l => !l.coach || !l.coach.effort || l.coach.effort.state === "none") ? "not recorded last session" : "partly recorded last session"}] : []),
      why: {
        noticed: `${names}: the last best set cleared the rep range, so the coach's next target is a heavier load.`,
        evidence: ready.map(l => (l.coach && l.coach.note ? `${l.name}: ${l.coach.note}` : loadText(l) + ".")).join(" "),
        matters: "Double progression: the load moves up once the best set clears the rep range; target reps at the new load come from your own best set.",
        canDo: `Next ${first.nextDate === ctx.date ? "today" : weekday(first.nextDate)} (${N.label(first.nextType)}): use the new load if warm-ups feel controlled. Repeating the current load is also fine.`
      },
      action: first.nextDate === ctx.date ? {label: "Open Train", kind: "open", payload: {tab: "train"}} : undefined
    });
  }
  /* Coordinator variant: the weight decision says to be careful, so the same
     lifts read as "hold" (info) instead of "move up". */
  function holdInsight(ctx, r) {
    const ready = readyLifts(ctx);
    if (!ready.length) return null;
    const first = ready[0], names = ready.map(l => l.name).join(", ");
    return insight({
      id: "strength.hold", domain: "strength", severity: "info",
      title: ready.length === 1 ? `Hold ${first.name} for now` : "Hold loads for now",
      body: `${names} ${ready.length === 1 ? "qualifies" : "qualify"} for the next step, but the weight decision reads “${r.title}”.`,
      evidence: ready.map(l => ({label: l.name, value: `${kg(l.best.weight)} × ${l.best.reps} · step ${kg(l.aim.weight)} kg`, date: l.lastDate}))
        .concat([{label: "Decision", value: r.title || ""}]),
      why: {
        noticed: `${names} reached the top of the rep range last time.`,
        evidence: `The Today decision reads “${r.title}”${r.reason ? ` (${r.reason})` : ""}.`,
        matters: "While weight drops fast or recovery or lifts are flagged, holding the load is the conservative choice. This is a review prompt, not a diagnosis.",
        canDo: `Repeat ${ready.map(l => `${l.name} ${kg(l.best.weight)} kg`).join(", ")} and add the step once the decision settles. Your call.`
      }
    });
  }
  function stallInsight(ctx) {
    const stalled = upcomingLifts(ctx).filter(l => l.stall && l.best && l.daysSince <= T.STALE_DAYS)
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
    if (!stalled.length) return null;
    const l = stalled[0], others = stalled.slice(1).map(x => x.name);
    return insight({
      id: "strength.stall", domain: "strength", severity: "watch",
      title: `${l.name}: same best set three times`,
      body: (l.coach && l.coach.note ? l.coach.note : `Best set ${kg(l.best.weight)} × ${l.best.reps} for three sessions.`) + (others.length ? ` Also flat: ${others.join(", ")}.` : ""),
      /* the date is part of the value: a fourth flat session is new evidence */
      evidence: stalled.map(x => ({label: x.name, value: `${kg(x.best.weight)} × ${x.best.reps} · flat 3 sessions to ${dayShort(x.lastDate)}`, date: x.lastDate})),
      why: {
        noticed: `${l.name}'s best set has not improved across its last three sessions.`,
        evidence: `Latest best set ${kg(l.best.weight)} × ${l.best.reps} on ${dayShort(l.lastDate)}.`,
        matters: "Three sessions without a better best set is the coach's stall rule. It offers a choice; the aim itself does not change.",
        canDo: l.coach && l.coach.note ? l.coach.note : "Repeat the load, or step down and rebuild."
      },
      action: {label: "See the lift", kind: "open", payload: {tab: "weight", view: "strength", exercise: l.name}}
    });
  }
  function returningInsight(ctx) {
    const back = upcomingLifts(ctx).filter(l => l.returning && l.best)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.name.localeCompare(b.name));
    if (!back.length) return null;
    const l = back[0], one = back.length === 1, note = l.coach && (l.coach.kind === "reentry" || l.coach.kind === "baseline") ? l.coach.note : null;
    const gaps = back.map(x => x.daysSince), lo = Math.min(...gaps), hi = Math.max(...gaps), gapText = `${lo === hi ? lo : lo + "–" + hi} days ago`;
    const names = back.slice(0, 3).map(x => x.name).join(", ") + (back.length > 3 ? ` +${back.length - 3} more` : "");
    return insight({
      id: "strength.returning", domain: "strength", severity: "info",
      title: one ? `${l.name}: back after ${l.daysSince} days` : `${back.length} lifts back after a break`,
      body: one ? (note || `Last session ${dayShort(l.lastDate)}.`) : `${names}: last logged ${gapText}.`,
      evidence: back.map(x => ({label: x.name, value: `${kg(x.best.weight)} × ${x.best.reps}`, date: x.lastDate}))
        .concat([{label: "Next planned", value: `${N.label(l.nextType)} · ${dayShort(l.nextDate)}`, date: l.nextDate}]),
      why: {
        noticed: one ? `${l.name} was last logged ${l.daysSince} days ago (${dayShort(l.lastDate)}) and is planned ${relDay(l.nextDate, ctx.date)}.`
          : `${back.length} lifts in the coming sessions were last logged ${gapText}; the first is planned ${relDay(l.nextDate, ctx.date)}.`,
        evidence: one ? `Best set that day: ${kg(l.best.weight)} × ${l.best.reps}.`
          : back.slice(0, 3).map(x => `${x.name} ${kg(x.best.weight)} × ${x.best.reps} on ${dayShort(x.lastDate)}`).join("; ") + ".",
        matters: "After 15–28 days away the coach eases the load back to about 90%; after four weeks it starts a new baseline.",
        canDo: one ? note || "Pick a manageable load and build back up." : "Pick manageable loads on the day; Train's coach gives each lift's starting point."
      },
      action: l.nextDate === ctx.date ? {label: "Open Train", kind: "open", payload: {tab: "train"}} : undefined
    });
  }
  function evalStrength(ctx) {
    return [readyInsight(ctx), stallInsight(ctx), returningInsight(ctx)].filter(Boolean);
  }

  /* ---- evaluators: cardio, weight, data --------------------------------------- */
  function evalCardio(ctx, ix) {
    const w = ctx.week, date = ctx.date, target = w.cardioTarget, min = w.cardioMin;
    if (!(target > 0) || min >= target) return [];
    if (!ix.lastCardio || ix.lastCardio < N.dateAdd(date, 1 - T.RECENT_CARDIO_DAYS)) return [];
    /* Pace follows the plan: by today the plan has had `elapsed` of its walk
       days, so that share of the target is expected. No walk days in the plan
       → calendar days. Before the first planned walk day nothing is expected. */
    const walks = w.days.filter(x => x.type === "Zone2" && !OFF_PLAN.includes(x.status));
    const elapsed = walks.filter(x => x.date < date).length, before = gap(w.start, date);
    const expected = walks.length ? target * elapsed / walks.length : target * before / 7;
    if (min >= expected) return [];
    const left = Math.round(target - min), daysLeft = w.daysLeft, perDay = Math.ceil(left / daysLeft);
    const reachable = left <= T.CARDIO_MAX_PER_DAY * daysLeft;
    const inWeek = w.days.filter(x => x.date <= date && x.logged.cardioMin > 0).map(x => x.date).pop() || w.start;
    const pace = walks.length ? `By ${weekday(date)} the plan has had ${elapsed} of its ${count(walks.length, "cardio day")}; ${min} min are logged.`
      : `${count(before, "day")} of the week have passed; ${min} min are logged.`;
    return [insight({
      id: "cardio.week:" + w.start, domain: "cardio", severity: reachable ? "act" : "info",
      title: reachable ? `${left} min of cardio left this week` : "Cardio target out of reach this week",
      body: reachable ? `${min} of ${target} min logged · ${count(daysLeft, "day")} left, about ${perDay} min a day.`
        : `${left} min left with ${count(daysLeft, "day")} to go: more than ${T.CARDIO_MAX_PER_DAY} min a day.`,
      evidence: [{label: "Cardio this week", value: `${min} of ${target} min`, date: inWeek}],
      why: {
        noticed: `${min} of the ${target}-minute weekly cardio target is logged.`,
        evidence: pace,
        matters: reachable ? `${left} min over ${count(daysLeft, "day")} is about ${perDay} min a day, within ${T.CARDIO_MAX_PER_DAY} min a day.`
          : `Fitting ${left} min into ${count(daysLeft, "day")} would take ${perDay} min a day.`,
        canDo: reachable ? "Log cardio when you do it; minutes from any day count toward the week." : "Log what fits. The target starts fresh on Monday."
      },
      action: reachable ? {label: "Log cardio", kind: "open", payload: {sheet: "cardio"}} : undefined
    })];
  }
  function evalWeight(ctx) {
    const r = ctx.weight.review, pl = ctx.weight.plateau;
    if (!r || !r.title) return [];
    const watch = r.tone === "watch", flat = !!(pl && pl.plateau);
    if (!watch && !flat) return [];
    const weeks = flat && pl.plateauDays ? Math.round(pl.plateauDays / 7) : null;
    const evidence = [{label: "Decision", value: r.title, date: ctx.weight.lastMorningDate}];
    if (ctx.weight.confidence) evidence.push({label: "Confidence", value: ctx.weight.confidence});
    if (weeks) evidence.push({label: "Plateau", value: "about " + count(weeks, "week")});
    const rate = pl && pl.ok && pl.weeklyRate !== null
      ? `Four-week trend ${pl.weeklyRate > 0 ? "+" : ""}${pl.weeklyRate.toFixed(2)} kg/wk from ${pl.n} morning weigh-ins over ${pl.spanDays} days`
      : `${ctx.weight.trend.current.n} morning readings this week and ${ctx.weight.trend.previous.n} the week before`;
    return [insight({
      id: "weight.review", domain: "weight", severity: watch ? "watch" : "info",
      title: r.title,
      body: watch ? (r.reason || r.message || "") : (pl.reason || r.reason || ""),
      evidence,
      why: {
        noticed: watch ? `The weight decision reads “${r.title}”.` : `The four-week trend is level${weeks ? ` (about ${count(weeks, "week")})` : ""}.`,
        evidence: `${rate}${ctx.weight.confidence ? `; confidence ${ctx.weight.confidence}` : ""}.`,
        matters: r.message || "Morning weigh-ins decide the trend.",
        canDo: `${r.action ? r.action + ". " : ""}Nothing changes automatically.`
      },
      action: {label: "Why", kind: "open", payload: {sheet: "review"}}
    })];
  }
  function evalData(ctx) {
    const wt = ctx.weight, date = ctx.date, last = wt.lastMorningDate, other = wt.contextualOnlyDays, lastOther = ctx.freshness.lastContextualDate;
    const otherText = other ? ` ${count(other, "day")} since had only post-workout or scan readings, which never enter the trend.` : "";
    if (!last) {
      if (!other) return [];
      return [insight({
        id: "data.morning", domain: "data", severity: "watch",
        title: "No morning weigh-ins yet",
        body: `${count(other, "day")} with post-workout or scan readings only. They are kept, but the trend uses morning weigh-ins.`,
        evidence: [{label: "Other timings", value: count(other, "day"), date: lastOther}],
        why: {
          noticed: "Recent weigh-ins are all post-workout or scan readings.",
          evidence: `Last one ${dayShort(lastOther)}.`,
          matters: "Only a morning weigh-in is eligible for the body-weight trend, so there is no trend yet.",
          canDo: "Weigh in one morning, before training."
        },
        action: {label: "Log weight", kind: "open", payload: {sheet: "weight"}}
      })];
    }
    const k = wt.daysSinceMorning;
    if (!(k >= T.MORNING_GAP_DAYS)) return [];
    const continuous = k === T.MORNING_GAP_DAYS;
    const evidence = [{label: "Last morning weigh-in", value: `${dayShort(last)}${wt.lastMorningWeight !== null ? ` · ${kg(wt.lastMorningWeight)} kg` : ""}`, date: last}];
    if (other) evidence.push({label: "Other timings since", value: count(other, "day"), date: lastOther});
    return [insight({
      id: "data.morning", domain: "data", severity: continuous ? "act" : "watch",
      title: continuous ? "Weigh in today to keep the trend continuous" : `No morning weigh-in for ${k} days`,
      body: (continuous ? `Last morning weigh-in: ${dayShort(last)}, 3 days ago. After more than 3 days the trend line restarts from the next reading.`
        : "The trend line restarts from the next morning weigh-in and needs 3 readings to show again.") + otherText,
      evidence,
      why: {
        noticed: `The last morning weigh-in was ${dayShort(last)}, ${k} days ago.`,
        evidence: `The last 7 days have ${count(wt.trend.current.n, "morning reading")}${wt.trend.current.n < 3 ? "; a weekly average needs 3" : ""}.${other ? ` ${count(other, "day")} had only other timings.` : ""}`,
        matters: "The trend restarts after more than 3 days between morning readings, and the Today decision compares weekly averages that each need 3 readings.",
        canDo: "A morning weigh-in, before training, keeps the trend continuous."
      },
      action: {label: "Log weight", kind: "open", payload: {sheet: "weight"}}
    })];
  }

  /* ---- coordinator -------------------------------------------------------------
     1 evaluators propose (0–n each); 2 candidates whose newest evidence is older
     than 14 days are dropped; 3 a cautious weight decision (tone watch, or a
     title/action about recovery or slipping lifts) turns "move up" into "hold"
     (info); 4 dismissed id|fingerprint pairs are hidden; 5 one insight per
     domain (highest severity, evaluator order breaks ties — so a catch-up
     outranks "week behind", which is not even proposed while a catch-up is);
     6 ranked by severity, then schedule > strength > cardio > weight > data,
     then id. */
  function cautious(r) {
    /* Stage 1: the engine owns the predicate (NXT.cautionOf) so Today, Progress and Train read one rule. */
    if (typeof N.cautionOf === "function") return N.cautionOf(r);
    return !!r && (r.tone === "watch" || /slipping|recovery/i.test(String(r.title || "")) || /recovery/i.test(String(r.action || "")));
  }
  function evaluate(date) {
    return asOf(date, () => {
      const ix = index(), ctx = buildContext(date, ix);
      const raw = [].concat(evalSchedule(ctx, ix), evalStrength(ctx), evalCardio(ctx, ix), evalWeight(ctx), evalData(ctx));
      const r = ctx.weight.review, careful = cautious(r);
      const candidates = raw.filter(c => !stale(c, date))
        .map(c => (c.id === "strength.ready" && careful ? holdInsight(ctx, r) : c)).filter(Boolean);
      return {ctx, candidates};
    });
  }
  function visible(candidates) {
    const gone = dismissedMap(), best = new Map();
    for (const c of candidates) {
      if (gone[c.id + "|" + c.fingerprint]) continue;
      const b = best.get(c.domain);
      if (!b || SEVERITY[c.severity] < SEVERITY[b.severity]) best.set(c.domain, c);
    }
    return [...best.values()].sort(rank);
  }

  /* ---- week review ------------------------------------------------------------ */
  function outcomesOf(ix, ws, we) {
    const groups = new Map();
    for (const w of ix.workBy.values()) for (const r of w.rows) {
      if (r.date < ws || r.date > we) continue;
      const k = r.date + "\u0000" + w.gym + "\u0000" + w.name;
      if (!groups.has(k)) groups.set(k, {date: r.date, gym: w.gym, name: w.name, sets: []});
      groups.get(k).sets.push(r);
    }
    let beat = 0, matched = 0, below = 0, exercises = 0;
    for (const g of [...groups.values()].sort((a, b) => (a.date + a.gym + a.name).localeCompare(b.date + b.gym + b.name))) {
      exercises++;
      const prev = pinned({logs: ix.byName.get(g.name) || []}, () => N.sessionRows(g.name, g.gym, g.date, 100)).at(-1);
      if (!prev || !prev.sets || !prev.sets.length) continue;
      const a = N.bestSet(g.sets), b = N.bestSet(prev.sets);
      if (!a || !b) continue;
      const dw = Number(a.weight) - Number(b.weight), dr = Number(a.reps) - Number(b.reps);
      if (dw > 0 || (dw === 0 && dr > 0)) beat++; else if (dw === 0 && dr === 0) matched++; else below++;
    }
    return {beat, matched, below, exercises};
  }
  function reviewOf(ws, we) {
    const ix = index(), canon = N.weights();
    if (!(ix.first && ix.first <= we) && !canon.some(r => r.date <= we)) return null;
    const days = [];
    for (let i = 0; i < 7; i++) days.push(dayCtx(ix, N.dateAdd(ws, i)));
    const led = N.activityWeeks(2, we), cur = led.find(w => w.start === ws) || null, prev = led.find(w => w.start === N.dateAdd(ws, -7)) || null;
    const L = days.filter(x => isLift(x.type)), by = s => L.filter(x => x.status === s);
    const lifts = {planned: L.filter(x => !OFF_PLAN.includes(x.status)).length, done: cur ? cur.liftDays : null,
      missed: by("missed").length, excused: by("excused").length, moved: by("moved").length};
    const outcomes = outcomesOf(ix, ws, we);
    const cardio = {min: cur ? cur.cardioMin : null, target: cardioTarget(), sessions: cur ? cur.cardioSessions : null};
    const wk = N.windowStats(canon, we, 7), pw = N.windowStats(canon, N.dateAdd(we, -7), 7);
    const avg = wk.n >= 3 ? wk.avg : null, prevAvg = pw.n >= 3 ? pw.avg : null;
    const weight = {avg: r2(avg), prevAvg: r2(prevAvg), change: avg !== null && prevAvg !== null ? r2(avg - prevAvg) : null, readings: wk.n};
    const words = {};
    for (const s of asOf(we, () => windowed(ix, we, () => N.strengthItems()))) if (["Improving", "Holding steady", "Watch", "Review"].includes(s.status)) words[s.status] = (words[s.status] || 0) + 1;
    const nextWeek = [];
    for (let i = 7; i < 14; i++) { const d = N.dateAdd(ws, i), t = N.typeFor(d); nextWeek.push({date: d, type: t, label: N.label(t)}); }
    const seenAt = coachMap().reviewSeen;
    /* copy: facts in engine words, no causation, no cheerleading */
    const sets = cur ? cur.sets : null, tonnage = cur ? cur.tonnage : null;
    const anything = (cur && (cur.sets > 0 || cur.cardioMin > 0 || cur.floorSessions > 0)) || wk.n > 0;
    const headline = !anything ? "Nothing logged this week"
      : lifts.planned > 0 && lifts.done !== null ? `${lifts.done >= lifts.planned ? "Plan met" : "Below plan"} · ${lifts.done} of ${lifts.planned} lifting days`
      : lifts.done ? count(lifts.done, "lifting day") : "No lifting logged";
    const lines = [];
    if (cur && cur.sets > 0) {
      let l = `${count(cur.liftDays, "lifting day")} · ${count(cur.sets, "working set")} · ${thousands(cur.tonnage)} kg tonnage`;
      if (prev) l += ` (${signedInt(cur.sets - prev.sets)} sets, ${signedInt(cur.tonnage - prev.tonnage)} kg vs the week before)`;
      lines.push(l);
    }
    const missedL = by("missed"), excusedL = by("excused"), movedL = by("moved");
    if (missedL.length) lines.push("Missed: " + missedL.map(x => `${weekday(x.date).slice(0, 3)} ${x.label}`).join(", "));
    if (excusedL.length) lines.push("Excused: " + excusedL.map(x => `${weekday(x.date).slice(0, 3)} ${x.label}${x.reason && x.reason !== "other" ? ` (${x.reason})` : ""}`).join(", "));
    if (movedL.length) lines.push("Moved: " + movedL.map(x => `${weekday(x.date).slice(0, 3)} ${x.label}${x.movedTo ? ` → ${dayShort(x.movedTo)}` : ""}`).join(", "));
    const compared = outcomes.beat + outcomes.matched + outcomes.below;
    if (compared) lines.push(`Best set vs last time: ${outcomes.beat} beat · ${outcomes.matched} matched · ${outcomes.below} below`);
    const order = ["Improving", "Holding steady", "Watch", "Review"].filter(s => words[s]);
    if (order.length) lines.push("Tracked lifts on Sunday: " + order.map(s => `${words[s]} ${s}`).join(" · "));
    if (cur) lines.push(`Cardio: ${cur.cardioMin} of ${cardio.target} min · ${count(cur.cardioSessions, "session")}`);
    lines.push(weight.avg !== null ? `Morning average ${weight.avg.toFixed(1)} kg${weight.change !== null ? ` · ${sign1(weight.change)} kg vs the week before` : ""} · ${count(wk.n, "reading")}`
      : wk.n ? `Morning average needs 3 readings (${wk.n} logged)` : "No morning weigh-ins");
    return {
      weekStart: ws, weekEnd: we, lifts, sets, tonnage,
      vsPrev: {sets: cur && prev ? cur.sets - prev.sets : null, tonnage: cur && prev ? cur.tonnage - prev.tonnage : null},
      outcomes, cardio, weight, days, nextWeek,
      seen: isDate(seenAt) && seenAt >= ws,
      headline, lines
    };
  }
  const lastCompletedWeek = () => N.dateAdd(N.weekStart(state.date), -7);

  /* ===== public: reads ======================================================== */
  const dateOr = d => (d === undefined || d === null ? state.date : isDate(d) ? d : null);
  function dayContext(date) {
    try {
      const d = dateOr(date);
      return d ? dayCtx(index(), d) : null;
    } catch (e) { warn("dayContext", e); return null; }
  }
  function dayStatuses(startDate, endDate) {
    try {
      if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) return [];
      const ix = index(), out = [];
      for (let d = startDate, i = 0; d <= endDate && i < T.MAX_RANGE_DAYS; d = N.dateAdd(d, 1), i++) out.push(dayCtx(ix, d));
      return out;
    } catch (e) { warn("dayStatuses", e); return []; }
  }
  function context(date) {
    try {
      const d = dateOr(date);
      return d ? asOf(d, () => buildContext(d, index())) : null;
    } catch (e) { warn("context", e); return null; }
  }
  function catchUp(date) {
    try {
      const d = dateOr(date);
      return d ? asOf(d, () => proposalAt(index(), d)) : null;
    } catch (e) { warn("catchUp", e); return null; }
  }
  function insights(date) {
    let all = [];
    try {
      const d = dateOr(date);
      if (d) all = visible(evaluate(d).candidates);
    } catch (e) { warn("insights", e); all = []; }
    const top = all.slice(0, T.TOP);
    top.all = all;
    return top;
  }
  /* Train's coach, coordinated (owner decision, 2026-10-13). coachFor() and aimFor()
     are untouched (D25): this returns coachFor()'s exact output plus `coordinated`.
     Only when coachFor() steps the load up while the weight decision is cautious
     (coordinator rule 3) does it become a hold: kind 'hold', a hold headline, per-set
     targets at the last session's best load (coachFor()'s own drop pattern, shifted
     to that best set), and a one-sentence note that the Aim tile still shows the
     engine's next step. The weight review is only read when a load step is on the
     table. Read-only: coachFor() runs inside the read guard. */
  function trainAdvice(exercise) {
    try {
      if (typeof exercise !== "string" || !exercise) return null;
      return pinned({}, () => {
        const c = N.coachFor(exercise);
        if (!c) return null;
        const same = Object.assign({}, c, {coordinated: {hold: false, reason: null, source: null}});
        if (c.kind !== "load") return same;
        const r = windowed({work: N.workRows()}, state.date, () => N.review());
        if (!cautious(r)) return same;
        const last = N.sessionRows(exercise, state.gym, state.date, 100).at(-1), best = last ? N.bestSet(last.sets) : null;
        if (!best) return same;
        const w = Number(best.weight), n = Number(best.reps), aimReps = Number(c.reps), title = String(r.title || "");
        return Object.assign({}, c, {
          kind: "hold",
          headline: `Hold ${kg(w)} kg — weight decision reads “${title}”`,
          note: `The Aim still shows the engine's next step (${kg(c.weight)} kg); repeating ${kg(w)} kg is the conservative choice until the decision settles.`,
          sets: (Array.isArray(c.sets) ? c.sets : []).map(s => ({n: s.n, weight: w, reps: Math.max(1, n - (aimReps - Number(s.reps)))})),
          weight: w, reps: n,
          coordinated: {hold: true, reason: `Weight decision reads “${title}”`, source: "weight"}
        });
      });
    } catch (e) { warn("trainAdvice", e); return null; }
  }
  function weekReview(weekStart) {
    try {
      const ws = weekStart === undefined || weekStart === null ? lastCompletedWeek() : isDate(weekStart) ? N.weekStart(weekStart) : null;
      if (!ws) return null;
      const we = N.dateAdd(ws, 6);
      if (!(we < state.date)) return null;
      return pinned({}, () => reviewOf(ws, we));
    } catch (e) { warn("weekReview", e); return null; }
  }

  /* ===== public: writers ====================================================== */
  function notesStore() { const c = N.cfg(); if (!plain(c.dayNotes)) c.dayNotes = {}; return c.dayNotes; }
  function coachStore() { const c = N.cfg(); if (!plain(c.coach)) c.coach = {}; if (!plain(c.coach.dismissed)) c.coach.dismissed = {}; return c.coach; }
  function excuse(date, reason, note) {
    if (!isDate(date)) return false;
    const type = N.typeFor(date);
    if ((state.logs || []).some(r => r && r.date === date)) { say("This day already has logged sets."); return false; }
    if (type === "Rest") { say("A rest day has nothing to excuse."); return false; }
    const ix = index();
    if ((type === "Zone2" && ix.cardio.has(date)) || (type === "Floorball" && ix.floor.has(date))) { say("This day is already logged."); return false; }
    const why = REASONS.includes(reason) ? reason : "other";
    const text = String(note === null || note === undefined ? "" : note).replace(/\s+/g, " ").trim().slice(0, T.NOTE_MAX);
    notesStore()[date] = {status: "excused", reason: why, note: text, ts: Date.now()};
    return N.commit(`${dayShort(date)} excused${why !== "other" ? " · " + why : ""}`);
  }
  function unexcuse(date) {
    const n = isDate(date) ? noteFor(date) : null;
    if (!n || n.status !== "excused") return false;
    delete notesStore()[date];
    return N.commit("Excuse removed");
  }
  function prune(map, now) {
    for (const k of Object.keys(map)) { const ts = Number(map[k]); if (!Number.isFinite(ts) || now - ts > T.DISMISS_KEEP_DAYS * DAY) delete map[k]; }
    const keys = Object.keys(map).sort((a, b) => Number(map[b]) - Number(map[a]));
    for (const k of keys.slice(T.DISMISS_MAX - 1)) delete map[k];
  }
  function dismiss(id, fingerprint) {
    if (typeof id !== "string" || !id) return false;
    let fp = typeof fingerprint === "string" && fingerprint ? fingerprint : null;
    if (!fp) { const hit = evaluate(state.date).candidates.find(c => c.id === id); if (!hit) return false; fp = hit.fingerprint; }
    const co = coachStore(), now = Date.now();
    prune(co.dismissed, now);
    co.dismissed[id + "|" + fp] = now;
    return N.commit("");
  }
  function markReviewSeen(weekStart) {
    const ws = weekStart === undefined || weekStart === null ? lastCompletedWeek() : isDate(weekStart) ? N.weekStart(weekStart) : null;
    if (!ws) return false;
    const cur = coachMap().reviewSeen;
    if (isDate(cur) && cur >= ws) return true;
    coachStore().reviewSeen = ws;
    return N.commit("");
  }
  function applyCatchUp(proposal) {
    const date = state.date, p = proposal, want = p && p.apply && p.apply.setDayType;
    const fresh = catchUp(date);
    if (!p || !fresh || !want || fresh.missedDate !== p.missedDate || fresh.missedType !== p.missedType || want.date !== date || want.type !== p.missedType) {
      say("This catch-up no longer applies.");
      return false;
    }
    const existed = plain(N.cfg().dayNotes), notes = notesStore(), had = has(notes, p.missedDate), prior = notes[p.missedDate];
    notes[p.missedDate] = {status: "moved", to: date, ts: Date.now()};
    /* setDayType reads the day sheet's "Make every <weekday> this" box; a
       catch-up is one day only, so a stale ticked box must not turn it into a
       weekly-plan change. */
    const box = typeof document === "object" && document && typeof document.getElementById === "function" ? document.getElementById("n99-day-every") : null;
    if (box && box.checked) box.checked = false;
    N.setDayType(date, p.missedType);   /* the one commit: override + note persist together */
    if (N.typeFor(date) !== p.missedType) {
      if (had) notes[p.missedDate] = prior; else delete notes[p.missedDate];
      if (!existed && !Object.keys(notes).length) delete N.cfg().dayNotes;
      return false;
    }
    say(`${p.missedLabel} moved to today`);
    return true;
  }

  return {coach: {
    thresholds: T,
    context, dayContext, dayStatuses, catchUp, insights, weekReview, trainAdvice,
    excuse, unexcuse, dismiss, markReviewSeen, applyCatchUp
  }};
})());
