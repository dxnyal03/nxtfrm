/* Local-only diagnosis and demo fixtures. Does nothing off localhost. Loaded after seed.dev.js.

   Request one with ?scenario=<name> (add &reseed=1 to rebuild the default seed first). Every fixture starts
   from the default seed, which is itself the "weight-populated" state: 82 morning readings over 90 days,
   goal 78–80 kg, and on a lifting day today's session already under way (Full Body A, 6 of 15 working sets,
   started about 22 minutes ago). `?reseed=1` with no scenario returns to that default and clears the marker.

   Diagnosis fixtures (overlay the last 30 days): plateau_metabolic, plateau_drift, water_masking, recovery.
   Visual-checkpoint fixtures (edit the default seed in place):
     today-unstarted  lifting day, nothing logged today, no Finish record
     today-active     the default seed as is (session in progress), marker only
     today-finished   every planned working set logged at the current gym, plus the Finish record
     today-rest       today overridden to Rest, nothing logged; the plan is otherwise untouched
     weight-sparse    mornings only on Mondays and Thursdays for the last 10 weeks (earlier history kept)
     weight-stale     the last morning reading is 20 days ago (later mornings dropped)

   The marker lives in NXT.cfg().activeScenario. While it is set a fixed "Synthetic data · <name>" badge sits
   under the status bar, so a screenshot can never be mistaken for real records. A today-* fixture also leaves
   NXT.cfg().scenarioUndo (the date and the override it replaced), consumed on the next load that leaves the
   fixture, because the seed rebuilds records but keeps settings. Any cloud user is signed out before a fixture
   is applied, so fixture data is never uploaded. */
(function () {
  if (location.hostname !== 'localhost') return;

  const DIAGNOSIS = ['plateau_metabolic', 'plateau_drift', 'water_masking', 'recovery'];
  const CHECKPOINT = ['today-unstarted', 'today-active', 'today-finished', 'today-rest', 'weight-sparse', 'weight-stale'];
  const NAMES = DIAGNOSIS.concat(CHECKPOINT);
  const WINDOW_DAYS = 30;
  const LIFTS = ['FullA', 'FullB', 'FullC', 'Push', 'Pull', 'Pump', 'Legs'];

  function scenarioRequested() {
    const m = /(?:^|[?&])scenario=([^&]*)/.exec(location.search);
    if (!m) return null;
    return decodeURIComponent(m[1] || '').trim();
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }

  function todayDate() {
    if (typeof state === 'object' && state && /^\d{4}-\d{2}-\d{2}$/.test(state.date)) return state.date;
    if (typeof today === 'function') return today();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dateFromToday(offsetDays) {
    const d = new Date(todayDate() + 'T12:00:00');
    d.setDate(d.getDate() + offsetDays);
    return iso(d);
  }

  function dow(date) {
    return new Date(date + 'T12:00:00').getDay();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const round1 = n => Math.round(n * 10) / 10;
  const round05 = n => Math.round(n * 2) / 2;

  function overlayMap(existing, start, end, overlay) {
    const next = {};
    Object.keys(existing || {}).forEach(date => {
      if (date < start || date > end) next[date] = existing[date];
    });
    Object.assign(next, overlay);
    return next;
  }

  function overlayArray(existing, start, end, overlay) {
    const kept = (Array.isArray(existing) ? existing : []).filter(r => r && r.date && (r.date < start || r.date > end));
    return kept.concat(overlay).sort((a, b) => a.date.localeCompare(b.date));
  }

  function mergeByDate(existing, overlay) {
    const map = new Map();
    (Array.isArray(existing) ? existing : []).forEach(r => { if (r && r.date) map.set(r.date, r); });
    overlay.forEach(r => map.set(r.date, r));
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function flatBws(days, seed) {
    const rnd = mulberry32(seed);
    const rows = [];
    for (let day = 1 - days; day <= 0; day++) {
      const date = dateFromToday(day);
      rows.push({
        id: uid(),
        date,
        weight: round1(82 + (rnd() - 0.5) * 0.16),
        timeOfDay: 'Morning',
        ts: Date.parse(date + 'T07:30:00'),
        _seed: true
      });
    }
    return rows;
  }

  function yesOn(offsets) {
    const out = {};
    offsets.forEach(day => {
      const date = dateFromToday(day);
      out[date] = { status: 'yes', ts: Date.parse(date + 'T21:00:00'), _seed: true };
    });
    return out;
  }

  function offsets(from, to, keep) {
    const days = [];
    for (let day = from; day <= to; day++) if (keep(day, day - from)) days.push(day);
    return days;
  }

  function tdeeRow(day, tdee, weightChange, confidence) {
    return {
      date: dateFromToday(day),
      tdee,
      intake: 2100,
      weightChange,
      windowDays: 14,
      confidence,
      _seed: true
    };
  }

  function decliningLiftLogs(existing) {
    const lifts = [
      { name: 'Incline Dumbbell Press', dayType: 'Push', high: 30, low: 27, reps: 10 },
      { name: 'Lat Pulldown', dayType: 'Pull', high: 55, low: 50, reps: 10 }
    ];
    const dates = [-18, -12, -7, -2].map(dateFromToday);
    const names = new Set(lifts.map(l => l.name));
    const kept = (Array.isArray(existing) ? existing : []).filter(r => {
      const ex = r && (r.exercise || r.name);
      if (!names.has(ex) || (r.gym || 'Gym A') !== 'Gym A') return true;
      return false;
    });
    const added = [];
    lifts.forEach(l => {
      dates.forEach((date, i) => {
        const weight = i < 2 ? l.high : l.low;
        const sessionTs = Date.parse(date + 'T18:00:00');
        for (let setNum = 1; setNum <= 3; setNum++) {
          const entry = {
            id: uid(),
            date,
            dayType: l.dayType,
            gym: 'Gym A',
            exercise: l.name,
            setNum,
            weight,
            reps: l.reps,
            volume: Math.round(weight * l.reps),
            ts: sessionTs + setNum * 90000,
            _seed: true
          };
          if (typeof exerciseFamily === 'function') entry.movementFamily = exerciseFamily(l.name);
          added.push(entry);
        }
      });
    });
    return kept.concat(added);
  }

  const builders = {
    plateau_metabolic() {
      return {
        bws: flatBws(30, 401),
        adherence: yesOn(offsets(-27, 0, (day, i) => i !== 5 && i !== 19)),
        recovery: {},
        waist: [],
        tdeeHistory: [tdeeRow(-27, 2800, -0.6, 'high'), tdeeRow(-14, 2650, -0.2, 'high'), tdeeRow(0, 2580, 0, 'medium')]
      };
    },
    plateau_drift() {
      return {
        bws: flatBws(30, 402),
        adherence: yesOn(offsets(-29, 0, (day, i) => i % 3 !== 2)),
        recovery: {},
        waist: [],
        tdeeHistory: []
      };
    },
    water_masking() {
      return {
        bws: flatBws(28, 403),
        adherence: yesOn(offsets(-27, 0, (day, i) => i !== 3 && i !== 11 && i !== 19)),
        recovery: {},
        waist: [
          { id: uid(), date: dateFromToday(-21), cm: 92, ts: Date.parse(dateFromToday(-21) + 'T07:45:00'), _seed: true },
          { id: uid(), date: dateFromToday(0), cm: 90.8, ts: Date.parse(dateFromToday(0) + 'T07:45:00'), _seed: true }
        ],
        tdeeHistory: []
      };
    },
    recovery() {
      const rec = {};
      [-12, -9, -6, -3, 0].forEach(day => {
        const date = dateFromToday(day);
        rec[date] = { sleep: 5, energy: 1, soreness: 4, date, _seed: true };
      });
      return {
        bws: flatBws(30, 404),
        adherence: yesOn(offsets(-27, 0, (day, i) => i !== 6 && i !== 20)),
        recovery: rec,
        waist: [],
        tdeeHistory: [],
        logs: true
      };
    }
  };

  /* ---- Visual-checkpoint fixtures: edit the default seed in place. ---- */

  function keyFor(type, date, gym) {
    if (typeof sessionKey === 'function') return sessionKey(type, date, gym);
    return `${date}__${gym || 'Gym'}__${type}`;
  }

  function liftType(type) {
    return LIFTS.includes(type);
  }

  /* Forget the day's session bookkeeping: any Finish record for the day (every key that starts with the date,
     whichever gym or type), its session plan and targets, and the live set position. Logs are left alone. */
  function clearDaySession(cut, day) {
    const sessions = cut.sessions && typeof cut.sessions === 'object' ? cut.sessions : (cut.sessions = {});
    Object.keys(sessions).forEach(k => { if (k.slice(0, 10) === day) delete sessions[k]; });
    if (state.sessionPlans && typeof state.sessionPlans === 'object') {
      Object.keys(state.sessionPlans).forEach(k => { if (k.slice(0, 10) === day) delete state.sessionPlans[k]; });
    }
    if (cut.sessionTargets && typeof cut.sessionTargets === 'object') {
      Object.keys(cut.sessionTargets).forEach(k => { if (k.slice(0, 10) === day) delete cut.sessionTargets[k]; });
    }
    state.setNum = 1;
  }

  /* Remove everything the seed logged today, and the day's session bookkeeping with it. */
  function clearToday(cut, day) {
    state.logs = (Array.isArray(state.logs) ? state.logs : []).filter(r => !r || r.date !== day);
    clearDaySession(cut, day);
  }

  /* A today-* fixture notes what it changed outside the records (cut.scenarioUndo), because the default seed
     rebuilds logs and mornings but keeps settings: a Rest override or a Finish record for today would otherwise
     survive `?reseed=1`, and seed.dev.js clears the marker before this script can see it. */
  function noteUndo(cut, day, prevOverride) {
    cut.scenarioUndo = { date: day, prevOverride: prevOverride == null ? null : prevOverride };
  }

  function applyUndo(cut) {
    const undo = cut.scenarioUndo;
    delete cut.scenarioUndo;
    if (!undo || typeof undo !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(undo.date)) return;
    clearDaySession(cut, undo.date);
    settings.dayOverrides = settings.dayOverrides && typeof settings.dayOverrides === 'object' ? settings.dayOverrides : {};
    if (undo.prevOverride) settings.dayOverrides[undo.date] = undo.prevOverride;
    else delete settings.dayOverrides[undo.date];
    if (typeof resolveDayType === 'function') state.dayType = resolveDayType(state.date);
    if (typeof NXT === 'object' && typeof NXT.templateFor === 'function') { const f = (NXT.templateFor() || [])[0]; state.exercise = f && f.name ? f.name : ''; }
  }

  /* The today-* lifting fixtures assume the seed's lifting day. Should the checkpoint be opened on a day the
     plan makes Rest or cardio, the day is overridden to Full Body A so the fixture still shows a session. */
  function ensureLiftingToday(day) {
    const type = typeof NXT === 'object' && typeof NXT.typeFor === 'function' ? NXT.typeFor(day) : state.dayType;
    if (liftType(type)) { state.dayType = type; return type; }
    settings.dayOverrides = settings.dayOverrides || {};
    settings.dayOverrides[day] = 'FullA';
    state.dayType = 'FullA';
    return 'FullA';
  }

  /* The newest weight logged for an exercise at this gym before today, so the finished session reads as a
     continuation of the seed's history rather than a fresh start. */
  function lastWeightFor(name, gym, day) {
    let best = null;
    (Array.isArray(state.logs) ? state.logs : []).forEach(r => {
      if (!r || r.date >= day || (r.gym || 'Gym A') !== gym || (r.exercise || r.name) !== name) return;
      if (r.setType === 'warmup') return;
      const w = Number(r.weight);
      if (!Number.isFinite(w)) return;
      if (!best || r.date > best.date || (r.date === best.date && Number(r.ts || 0) > Number(best.ts || 0))) best = { date: r.date, ts: r.ts, weight: w };
    });
    return best ? best.weight : null;
  }

  function templateNames(type, gym) {
    let tpl = [];
    try { tpl = (typeof NXT === 'object' && typeof NXT.templateFor === 'function') ? NXT.templateFor(type, gym) || [] : []; }
    catch (e) { tpl = []; }
    return tpl.filter(e => e && e.name).map(e => ({ name: e.name, sets: Number(e.sets) > 0 ? Number(e.sets) : 3, lo: Array.isArray(e.reps) ? Number(e.reps[0]) || 8 : 8, hi: Array.isArray(e.reps) ? Number(e.reps[1]) || 12 : 12 }));
  }

  /* Every planned working set for today, logged at the current gym with the same template the app plans from
     (NXT.templateFor), loads continued from the seed's history, reps starting two above the floor and easing
     one per set. The session spans the last 55 minutes so the Finish lands "now". */
  function finishedSession(type, gym, day) {
    const list = templateNames(type, gym);
    const base = Date.now() - 55 * 60000;
    const logs = [];
    list.forEach((ex, exIdx) => {
      const last = lastWeightFor(ex.name, gym, day);
      const weight = round05(last != null ? last : 20);
      for (let setNum = 1; setNum <= ex.sets; setNum++) {
        const reps = Math.max(ex.lo, Math.min(ex.hi, ex.lo + 2) - (setNum - 1));
        const entry = { id: uid(), date: day, dayType: type, gym, exercise: ex.name, setNum, weight, reps, volume: Math.round(weight * reps), setType: 'working', ts: base + exIdx * 8 * 60000 + setNum * 2 * 60000, _seed: true };
        if (typeof exerciseFamily === 'function') entry.movementFamily = exerciseFamily(ex.name);
        logs.push(entry);
      }
    });
    return logs;
  }

  const fixtures = {
    'today-unstarted'(cut, day) {
      noteUndo(cut, day, settings.dayOverrides && settings.dayOverrides[day]);
      ensureLiftingToday(day);
      clearToday(cut, day);
      const first = templateNames(state.dayType, state.gym)[0];
      state.exercise = first ? first.name : '';
    },
    'today-active'(cut, day) {
      /* The seed holds a live session for its own lifting day; opened on a day the plan makes a walk or
         rest, the day is overridden to a lifting day and the first six working sets are logged unfinished. */
      noteUndo(cut, day, settings.dayOverrides && settings.dayOverrides[day]);
      const type = ensureLiftingToday(day), gym = state.gym || 'Gym A';
      const today = (Array.isArray(state.logs) ? state.logs : []).filter(r => r && r.date === day && (r.gym || 'Gym A') === gym && r.setType !== 'warmup');
      if (!today.length) {
        clearToday(cut, day);
        const logs = finishedSession(type, gym, day).slice(0, 6);
        state.logs = state.logs.concat(logs);
        state.exercise = logs.length ? logs[logs.length - 1].exercise : '';
      }
      delete cut.sessions[keyFor(type, day, gym)];
    },
    'today-finished'(cut, day) {
      noteUndo(cut, day, settings.dayOverrides && settings.dayOverrides[day]);
      const type = ensureLiftingToday(day), gym = state.gym || 'Gym A';
      clearToday(cut, day);
      const logs = finishedSession(type, gym, day);
      state.logs = state.logs.concat(logs);
      cut.sessions[keyFor(type, day, gym)] = { date: day, gym, type, finished: true, finishedAt: Date.now(), sets: logs.length };
      state.exercise = logs.length ? logs[logs.length - 1].exercise : '';
    },
    'today-rest'(cut, day) {
      noteUndo(cut, day, settings.dayOverrides && settings.dayOverrides[day]);
      clearToday(cut, day);
      settings.dayOverrides = settings.dayOverrides || {};
      settings.dayOverrides[day] = 'Rest';
      state.dayType = 'Rest';
      state.exercise = '';
    },
    'weight-sparse'() {
      /* Ten weeks: today and the 69 days before it. Inside that span only Monday and Thursday mornings stay,
         so any 28-day window holds eight readings, under the ten the plateau and trend reads need. */
      const from = dateFromToday(-69);
      state.bws = (Array.isArray(state.bws) ? state.bws : []).filter(r => {
        if (!r || !r.date) return false;
        if (r.date < from) return true;
        if ((r.timeOfDay || 'Morning') !== 'Morning') return true;
        const d = dow(r.date);
        return d === 1 || d === 4;
      });
    },
    'weight-stale'() {
      const last = dateFromToday(-20);
      state.bws = (Array.isArray(state.bws) ? state.bws : []).filter(r => r && r.date && r.date <= last);
    }
  };

  /* Leaving a today-* fixture (or finding its note left behind by a reseed): take back what it changed. */
  function undoFixture() {
    if (typeof state !== 'object' || !state || typeof settings !== 'object') return;
    const cut = (typeof NXT === 'object' && typeof NXT.cfg === 'function') ? NXT.cfg() : (settings.cutSupport || (settings.cutSupport = {}));
    if (!cut.scenarioUndo) return;
    applyUndo(cut);
    if (typeof persist === 'function') persist();
    if (typeof NXT === 'object' && typeof NXT.repaint === 'function') NXT.repaint();
    else if (typeof render === 'function') render();
  }

  function applyScenario(name) {
    if (typeof state !== 'object' || !state || typeof settings !== 'object') return;
    const cut = (typeof NXT === 'object' && typeof NXT.cfg === 'function') ? NXT.cfg() : (settings.cutSupport || (settings.cutSupport = {}));
    if (!cut.sessions || typeof cut.sessions !== 'object') cut.sessions = {};
    const end = todayDate();

    if (fixtures[name]) {
      fixtures[name](cut, end);
    } else {
      const built = builders[name]();
      const start = dateFromToday(1 - WINDOW_DAYS);

      state.bws = mergeByDate(state.bws, built.bws);
      cut.adherence = overlayMap(cut.adherence, start, end, built.adherence);
      cut.recovery = overlayMap(cut.recovery, start, end, built.recovery);
      cut.waist = overlayArray(cut.waist, start, end, built.waist);
      cut.tdeeHistory = overlayArray(cut.tdeeHistory, start, end, built.tdeeHistory);
      if (cut.calories == null || cut.calories === '') cut.calories = 2100;
      if (built.logs) {
        state.logs = decliningLiftLogs(state.logs);
        const todayRec = cut.recovery[end];
        if (todayRec) state.read = { sleep: todayRec.sleep, energy: todayRec.energy, soreness: todayRec.soreness, date: end, _seed: true };
      }
    }
    cut.activeScenario = name;

    if (typeof persist === 'function') persist();
    if (typeof NXT === 'object' && typeof NXT.repaint === 'function') NXT.repaint();
    else if (typeof render === 'function') render();
  }

  function ensureLocalOnly() {
    if (typeof cloudUser === 'undefined' || !cloudUser) return;
    console.info('NXTFRM: signing out before applying a seed scenario so fixture data is not uploaded.');
    cloudUser = null;
    if (typeof cloudSignOutSilent === 'function') cloudSignOutSilent();
  }

  function currentMarker() {
    if (typeof NXT === 'object' && typeof NXT.cfg === 'function') return NXT.cfg().activeScenario || null;
    if (typeof settings === 'object' && settings && settings.cutSupport) return settings.cutSupport.activeScenario || null;
    return null;
  }

  /* ---- The badge: one fixed element on document.body, outside every page, so page re-renders cannot remove
     it. Shown only while a marker is set; absent otherwise. Styles are injected here (no stylesheet). ---- */
  const BADGE_ID = 'nxt-scenario-badge';
  const BADGE_CSS = `#${BADGE_ID}{position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;z-index:10090;pointer-events:none;` +
    `font:500 12px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;letter-spacing:.01em;white-space:nowrap;` +
    `color:var(--st-ink-2,#B9B5C8);background:rgba(var(--st-hl,255,255,255),.08);border:1px solid rgba(var(--st-hl,255,255,255),.12);` +
    `box-shadow:inset 0 1px 0 rgba(var(--st-hl,255,255,255),.07);border-radius:999px;padding:7px 11px;` +
    `-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2)}`;
  let badgeObserver = null;

  /* The badge sits under the status bar, or under the local-only banner while that is on screen. */
  function placeBadge(el) {
    const banner = document.getElementById('cloudLocalBanner');
    const r = banner && !banner.hidden ? banner.getBoundingClientRect() : null;
    el.style.top = r && r.height > 0 && r.bottom > 0 ? Math.round(r.bottom + 8) + 'px' : '';
  }

  function mountBadge(name) {
    if (!document.body) return;
    let style = document.getElementById(BADGE_ID + '-style');
    if (!style) {
      style = document.createElement('style');
      style.id = BADGE_ID + '-style';
      style.textContent = BADGE_CSS;
      document.head.appendChild(style);
    }
    let el = document.getElementById(BADGE_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BADGE_ID;
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'off');
    }
    el.dataset.scenario = name;
    el.textContent = 'Synthetic data · ' + name;
    if (el.parentNode !== document.body) document.body.appendChild(el);
    placeBadge(el);
    if (!el.dataset.placed) {
      el.dataset.placed = '1';
      let raf = 0;
      const re = function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; placeBadge(el); }); };
      window.addEventListener('scroll', re, { passive: true });
      window.addEventListener('resize', re);
    }
    /* Should anything replace body's children wholesale, put the badge back. */
    if (!badgeObserver && typeof MutationObserver === 'function') {
      badgeObserver = new MutationObserver(function () {
        const active = currentMarker();
        if (active && !document.getElementById(BADGE_ID)) mountBadge(active);
      });
      badgeObserver.observe(document.body, { childList: true });
    }
  }

  function showBadge(name) {
    if (document.body) mountBadge(name);
    else document.addEventListener('DOMContentLoaded', function () { mountBadge(name); }, { once: true });
  }

  function hideBadge() {
    const el = document.getElementById(BADGE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  const requested = scenarioRequested();
  const want = NAMES.includes(requested) ? requested : null;
  const marker = currentMarker();
  if (marker !== want) {
    if (want) ensureLocalOnly();
    undoFixture();
    if (marker && typeof window.__nxtForceSeed === 'function') window.__nxtForceSeed();
    if (want) applyScenario(want);
  } else if (!marker) {
    /* No scenario in play, but `?reseed=1` has just rebuilt the seed with the previous fixture's marker gone
       (seed.dev.js nulls it) while its override or Finish record stayed in settings. Clear that note too. */
    undoFixture();
  }
  if (typeof document !== 'object' || !document) return;
  const active = currentMarker();
  if (active) showBadge(active); else hideBadge();
})();
