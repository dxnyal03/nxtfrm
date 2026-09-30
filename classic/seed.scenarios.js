/* Local-only diagnosis fixtures. Does nothing off localhost. Loaded after seed.dev.js. */
(function () {
  if (location.hostname !== 'localhost') return;

  const NAMES = ['plateau_metabolic', 'plateau_drift', 'water_masking', 'recovery'];
  const WINDOW_DAYS = 30;

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

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const round1 = n => Math.round(n * 10) / 10;

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

  function applyScenario(name) {
    if (typeof state !== 'object' || !state || typeof settings !== 'object') return;
    const cut = (typeof NXT === 'object' && typeof NXT.cfg === 'function') ? NXT.cfg() : (settings.cutSupport || (settings.cutSupport = {}));
    const built = builders[name]();
    const end = todayDate();
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

  const requested = scenarioRequested();
  const want = NAMES.includes(requested) ? requested : null;
  const marker = currentMarker();
  if (marker === want) return;
  if (want) ensureLocalOnly();
  if (marker && typeof window.__nxtForceSeed === 'function') window.__nxtForceSeed();
  if (want) applyScenario(want);
})();
