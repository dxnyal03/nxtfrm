/* Local-only fake data for NXTFRM. Does nothing off localhost. */
(function () {
  if (location.hostname !== 'localhost') return;

  const KEYS = {
    logs: 'apm_logs',
    bws: 'apm_bws',
    cardio: 'apm_cardio',
    floorball: 'apm_floorball',
    read: 'apm_current_read',
    settings: 'apm_settings'
  };

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }

  function parseJSON(raw, fallback) {
    try { return raw == null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  }

  function reseedRequested() {
    return /(?:^|[?&])reseed=1(?:&|$)/.test(location.search);
  }

  function isVacant(key) {
    const raw = localStorage.getItem(key);
    if (raw == null) return true;
    const value = parseJSON(raw, null);
    if (Array.isArray(value)) return value.length === 0;
    if (key === KEYS.read) {
      return !value || (value.sleep === '' && value.energy === '' && value.soreness === '');
    }
    if (key === KEYS.settings) {
      const recovery = value && value.cutSupport && value.cutSupport.recovery;
      return !recovery || !Object.keys(recovery).length;
    }
    return false;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rnd = mulberry32(100);
  const round1 = n => Math.round(n * 10) / 10;
  const round05 = n => Math.round(n * 2) / 2;

  function todayDate() {
    if (typeof today === 'function') return today();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dateFromToday(offsetDays) {
    const d = new Date(todayDate() + 'T12:00:00');
    d.setDate(d.getDate() + offsetDays);
    return iso(d);
  }

  const TEMPLATES_SEED = {
    Push: [
      { name: 'Incline Dumbbell Press', start: 28, inc: 2.5, reps: [8, 12] },
      { name: 'Smith Machine Bench Press', start: 50, inc: 2.5, reps: [6, 10] },
      { name: 'Machine Shoulder Press', start: 40, inc: 2.5, reps: [8, 12] },
      { name: 'Cable Lateral Raise', start: 8, inc: 1, reps: [12, 15] },
      { name: 'Tricep Pushdown', start: 25, inc: 2.5, reps: [10, 15] },
      { name: 'Tricep Dips', start: 15, inc: 0, reps: [8, 15] }
    ],
    Pull: [
      { name: 'Lat Pulldown', start: 52.5, inc: 2.5, reps: [6, 10] },
      { name: 'Chest Supported T-Bar Row', start: 40, inc: 2.5, reps: [6, 10] },
      { name: 'Unilateral Seated Row', start: 32.5, inc: 2.5, reps: [6, 10] },
      { name: 'Reverse Fly', start: 10, inc: 1, reps: [8, 12] },
      { name: 'DB Preacher Curl', start: 12, inc: 1, reps: [8, 12] },
      { name: 'Cable Hammer Curl', start: 12.5, inc: 1, reps: [8, 12] }
    ],
    Pump: [
      { name: 'Leg Press', start: 120, inc: 5, reps: [8, 12] },
      { name: 'Romanian Deadlift', start: 70, inc: 5, reps: [8, 10] },
      { name: 'Hamstring Curl', start: 40, inc: 2.5, reps: [10, 15] },
      { name: 'Calf Raise', start: 60, inc: 2.5, reps: [10, 15] },
      { name: 'Ab Crunch', start: 20, inc: 2.5, reps: [12, 20] }
    ],
    Legs: [
      { name: 'Squat / Leg Press', start: 80, inc: 2.5, reps: [6, 10] },
      { name: 'Romanian Deadlift', start: 70, inc: 2.5, reps: [8, 10] },
      { name: 'Hamstring Curl', start: 40, inc: 2.5, reps: [10, 15] },
      { name: 'Calf Raises', start: 80, inc: 2.5, reps: [15, 20] },
      { name: 'Adductor Machine', start: 40, inc: 2.5, reps: [12, 15] },
      { name: 'Ab Crunch', start: 20, inc: 2.5, reps: [12, 20] }
    ]
  };

  const seenByExercise = {};

  function buildLogs() {
    const logs = [];
    const rotation = ['Push', 'Pull', 'Pump', 'Legs'];
    let sessionIndex = 0;
    let liftOpportunity = 0;
    for (let day = -89; day <= -1 && sessionIndex < 40; day++) {
      const date = dateFromToday(day);
      const d = new Date(date + 'T12:00:00');
      const dow = d.getDay();
      const liftDay = dow === 1 || dow === 2 || dow === 4 || dow === 6;
      if (!liftDay) continue;
      liftOpportunity++;
      if (liftOpportunity % 5 === 0) continue;
      const dayType = rotation[sessionIndex % 4];
      const exercises = TEMPLATES_SEED[dayType];
      const sessionTs = Date.parse(date + 'T18:00:00') + sessionIndex * 1000;
      exercises.forEach((ex, exIdx) => {
        const n = (seenByExercise[ex.name] = (seenByExercise[ex.name] || 0) + 1);
        const bump = ex.inc ? Math.floor((n - 1) / 2) * ex.inc : 0;
        const weight = round05(ex.start + bump);
        for (let setNum = 1; setNum <= 3; setNum++) {
          const reps = Math.round(ex.reps[0] + (ex.reps[1] - ex.reps[0]) * (setNum - 1) / 2 + (rnd() > 0.7 ? 1 : 0));
          const entry = {
            id: uid(),
            date,
            dayType,
            gym: 'Gym A',
            exercise: ex.name,
            setNum,
            weight,
            reps,
            volume: Math.round(weight * reps),
            ts: sessionTs + exIdx * 180000 + setNum * 90000,
            _seed: true
          };
          if (typeof exerciseFamily === 'function') entry.movementFamily = exerciseFamily(ex.name);
          logs.push(entry);
        }
      });
      sessionIndex++;
    }
    return logs;
  }

  function buildBws() {
    const bws = [];
    for (let day = -89; day <= 0; day++) {
      const date = dateFromToday(day);
      const d = new Date(date + 'T12:00:00');
      if (d.getDay() === 0 && rnd() < 0.35) continue;
      const t = (day + 89) / 89;
      const trend = 87 - 5 * t;
      const noise = (rnd() - 0.5) * 0.7;
      const weekly = Math.sin(t * Math.PI * 8) * 0.15;
      const weight = round1(Math.max(81.2, Math.min(87.6, trend + noise + weekly)));
      bws.push({
        id: uid(),
        date,
        weight,
        timeOfDay: 'Morning',
        ts: Date.parse(date + 'T07:30:00'),
        _seed: true
      });
    }
    return bws;
  }

  function pickDates(count, predicate) {
    const dates = [];
    for (let day = -89; day <= -1 && dates.length < count; day++) {
      const date = dateFromToday(day);
      const d = new Date(date + 'T12:00:00');
      if (predicate(d.getDay(), dates.length, day)) dates.push(date);
    }
    return dates;
  }

  function buildCardio() {
    const types = ['Incline Walk', 'Zone 2', 'Treadmill', 'Bike'];
    const dates = pickDates(15, (dow, i) => dow === 0 || dow === 3 || (dow === 5 && i % 2 === 0));
    return dates.map((date, i) => ({
      id: uid(),
      date,
      gym: 'Gym A',
      type: types[i % types.length],
      duration: 25 + (i % 4) * 5,
      intensity: 3 + (i % 3),
      speed: '',
      incline: types[i % types.length] === 'Incline Walk' ? 6 : '',
      hr: 125 + (i % 8),
      ts: Date.parse(date + 'T17:00:00'),
      _seed: true
    }));
  }

  function buildFloorball() {
    const dates = pickDates(8, dow => dow === 3 || dow === 5);
    const notes = ['League match', 'Training + small games', 'Tournament block', 'Club session'];
    return dates.map((date, i) => ({
      id: uid(),
      date,
      duration: i % 2 === 0 ? 120 : 90,
      intensity: 6 + (i % 4),
      notes: notes[i % notes.length],
      ts: Date.parse(date + 'T20:00:00'),
      _seed: true
    }));
  }

  function buildRecovery() {
    const recovery = {};
    const offsets = [0, -3, -8, -14, -21, -29, -38, -47, -61, -76];
    offsets.forEach((offset, i) => {
      const date = dateFromToday(offset);
      const row = {
        sleep: round1(6.5 + (i % 4) * 0.5 + (rnd() > 0.5 ? 0.5 : 0)),
        energy: 2 + ((i + 2) % 4),
        soreness: 1 + (i % 4),
        date,
        _seed: true
      };
      recovery[date] = row;
    });
    return recovery;
  }

  function writeIfAllowed(key, value) {
    if (!reseedRequested() && !isVacant(key)) return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }

  function applyRuntime(written) {
    if (typeof state !== 'object' || !state) return;
    if (written.logs) state.logs = written.logs;
    if (written.bws) state.bws = written.bws;
    if (written.cardio) state.cardio = written.cardio;
    if (written.floorball) state.floorball = written.floorball;
    if (written.read) state.read = written.read;
    if (written.settings && typeof settings === 'object') {
      if (!settings.cutSupport || typeof settings.cutSupport !== 'object') settings.cutSupport = {};
      settings.cutSupport.recovery = Object.assign({}, settings.cutSupport.recovery, written.settings.cutSupport.recovery);
      if (written.settings.startWeight != null) settings.startWeight = written.settings.startWeight;
    }
    if (typeof persist === 'function') persist();
    if (typeof NXT === 'object' && typeof NXT.repaint === 'function') NXT.repaint();
    else if (typeof render === 'function') render();
  }

  function seed() {
    const logs = buildLogs();
    const bws = buildBws();
    const cardio = buildCardio();
    const floorball = buildFloorball();
    const recovery = buildRecovery();
    const todayKey = todayDate();
    const todayCheck = recovery[todayKey] || Object.values(recovery)[0];
    const read = {
      sleep: todayCheck.sleep,
      energy: todayCheck.energy,
      soreness: todayCheck.soreness,
      date: todayCheck.date,
      _seed: true
    };

    const existingSettings = parseJSON(localStorage.getItem(KEYS.settings), {});
    const settingsPayload = Object.assign({}, existingSettings, {
      startWeight: existingSettings.startWeight != null ? existingSettings.startWeight : 87.1,
      targetHigh: existingSettings.targetHigh != null ? existingSettings.targetHigh : 80,
      targetLow: existingSettings.targetLow != null ? existingSettings.targetLow : 78,
      tdee: existingSettings.tdee != null ? existingSettings.tdee : 2644,
      zone2WeeklyTarget: existingSettings.zone2WeeklyTarget != null ? existingSettings.zone2WeeklyTarget : 180,
      cutSupport: Object.assign({}, existingSettings.cutSupport, {
        recovery: Object.assign({}, (existingSettings.cutSupport && existingSettings.cutSupport.recovery) || {}, recovery)
      })
    });

    const written = {};
    if (writeIfAllowed(KEYS.logs, logs)) written.logs = logs;
    if (writeIfAllowed(KEYS.bws, bws)) written.bws = bws;
    if (writeIfAllowed(KEYS.cardio, cardio)) written.cardio = cardio;
    if (writeIfAllowed(KEYS.floorball, floorball)) written.floorball = floorball;
    if (writeIfAllowed(KEYS.read, read)) written.read = read;
    if (writeIfAllowed(KEYS.settings, settingsPayload)) written.settings = settingsPayload;
    if (Object.keys(written).length) applyRuntime(written);
  }

  window.clearSeedData = function () {
    function stripArray(key, stateField) {
      const arr = parseJSON(localStorage.getItem(key), []);
      if (!Array.isArray(arr)) return;
      const kept = arr.filter(row => !row || row._seed !== true);
      localStorage.setItem(key, JSON.stringify(kept));
      if (typeof state === 'object' && state && stateField) state[stateField] = kept;
    }
    stripArray(KEYS.logs, 'logs');
    stripArray(KEYS.bws, 'bws');
    stripArray(KEYS.cardio, 'cardio');
    stripArray(KEYS.floorball, 'floorball');

    const read = parseJSON(localStorage.getItem(KEYS.read), null);
    if (read && read._seed === true) {
      localStorage.removeItem(KEYS.read);
      if (typeof state === 'object' && state) state.read = { sleep: '', energy: '', soreness: '' };
    }

    const currentSettings = parseJSON(localStorage.getItem(KEYS.settings), null);
    if (currentSettings && currentSettings.cutSupport && currentSettings.cutSupport.recovery) {
      const next = {};
      Object.keys(currentSettings.cutSupport.recovery).forEach(date => {
        const row = currentSettings.cutSupport.recovery[date];
        if (!row || row._seed !== true) next[date] = row;
      });
      currentSettings.cutSupport.recovery = next;
      localStorage.setItem(KEYS.settings, JSON.stringify(currentSettings));
      if (typeof settings === 'object' && settings) {
        if (!settings.cutSupport) settings.cutSupport = {};
        settings.cutSupport.recovery = next;
      }
    }
    if (typeof persist === 'function') persist();
    location.reload();
  };

  seed();
})();
