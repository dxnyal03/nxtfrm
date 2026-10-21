/* Fake data for NXTFRM. Runs on localhost and on Netlify deploy previews
   (deploy-preview-N--site.netlify.app) only — never on the production host.
   On a preview, cloud sync is switched off so fixture data cannot reach a
   real account. */
(function () {
  const PREVIEW = /^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/i.test(location.hostname);
  if (location.hostname !== 'localhost' && !PREVIEW) return;
  if (PREVIEW) {
    const off = function () { if (typeof toast === 'function') toast('Cloud sync is off on this preview link — it uses test data.'); return false; };
    ['cloudLogin', 'cloudSignup', 'saveCloudNow', 'loadCloudNow', 'scheduleCloudSave', 'openCloudLoginFromBanner'].forEach(function (name) {
      try { if (typeof window[name] === 'function') window[name] = name === 'scheduleCloudSave' ? function () {} : off; } catch (e) {}
    });
    try { localStorage.setItem('nxtfrm_cloud_banner_dismissed', '1'); } catch (e) {}
  }

  const KEYS = {
    logs: 'apm_logs',
    bws: 'apm_bws',
    cardio: 'apm_cardio',
    floorball: 'apm_floorball',
    scans: 'apm_evo_scans',
    rest: 'apm_rest',
    read: 'apm_current_read',
    settings: 'apm_settings'
  };

  const SEED_VERSION = 2;
  let forceSeed = false;

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

  function forcedReseed() {
    return forceSeed || reseedRequested();
  }

  function isVacant(key) {
    // ?reseed=1 (or an internal force) must rebuild even when seedVersion is already set.
    if (forcedReseed()) return true;
    const seededSettings = parseJSON(localStorage.getItem(KEYS.settings), null);
    if (seededSettings && seededSettings.cutSupport && seededSettings.cutSupport.seedVersion != null) return false;
    const raw = localStorage.getItem(key);
    if (raw == null) return true;
    const value = parseJSON(raw, null);
    if (Array.isArray(value)) return value.length === 0;
    if (key === KEYS.read) {
      return !value || (value.sleep === '' && value.energy === '' && value.soreness === '');
    }
    if (key === KEYS.settings) {
      const cut = value && value.cutSupport;
      const recovery = cut && cut.recovery;
      const adherence = cut && cut.adherence;
      return !recovery || !Object.keys(recovery).length || !adherence || !Object.keys(adherence).length;
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

  /* Mirrors the app's base programme (cut-support.js) so the demo history matches the plan on screen. */
  const START = {};
  Object.keys(TEMPLATES_SEED).forEach(k => TEMPLATES_SEED[k].forEach(e => { START[e.name] = e; }));
  START['Leg Extension'] = { name: 'Leg Extension', start: 40, inc: 2.5, reps: [10, 15] };
  const PROGRAMME = {
    FullA: [['Incline Dumbbell Press', 3], ['Chest Supported T-Bar Row', 3], ['Leg Press', 3], ['Hamstring Curl', 2], ['Cable Lateral Raise', 2], ['Ab Crunch', 2]],
    FullB: [['Romanian Deadlift', 3], ['Lat Pulldown', 3], ['Smith Machine Bench Press', 3], ['Leg Extension', 2], ['Reverse Fly', 2], ['DB Preacher Curl', 2]],
    FullC: [['Leg Press', 2], ['Machine Shoulder Press', 2], ['Unilateral Seated Row', 3], ['Hamstring Curl', 2], ['Tricep Pushdown', 2], ['Ab Crunch', 2]]
  };
  const LIFT_DAY = { 1: 'FullA', 3: 'FullB', 5: 'FullC' };

  function buildLogs() {
    const seenByExercise = {};
    const logs = [];
    let sessionIndex = 0;
    for (let day = -89; day <= -1; day++) {
      const date = dateFromToday(day);
      const d = new Date(date + 'T12:00:00');
      const dayType = LIFT_DAY[d.getDay()];
      if (!dayType) continue;
      if (rnd() < 0.08 && day < -21) continue; // the odd missed session, never in the last three weeks
      const exercises = PROGRAMME[dayType].map(([name, sets]) => Object.assign({ sets }, START[name]));
      const sessionTs = Date.parse(date + 'T18:00:00') + sessionIndex * 1000;
      exercises.forEach((ex, exIdx) => {
        const n = (seenByExercise[ex.name] = (seenByExercise[ex.name] || 0) + 1);
        const bump = ex.inc ? Math.min(5, Math.floor((n - 1) / 3)) * ex.inc : 0;
        const weight = round05(ex.start + bump);
        for (let setNum = 1; setNum <= ex.sets; setNum++) {
          const reps = Math.max(ex.reps[0], Math.round(ex.reps[1] - (ex.reps[1] - ex.reps[0]) * (setNum - 1) / 3 + (rnd() > 0.7 ? 1 : 0) - (rnd() > 0.85 ? 1 : 0)));
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
    /* Recent block (Elevate trial data, localhost and previews only): the last five weeks of the plan's
       Full Body A/B/C on Mon/Wed/Fri with steady double progression and one skipped session, and when
       today is a lifting day its session already under way (two exercises logged), so a preview shows
       this week's muscles, session prints, new bests and the live workout without logging first. */
    const FULL = {
      FullA: [['Incline Dumbbell Press', 3, 8, 12, 29, 2.5], ['Chest Supported T-Bar Row', 3, 8, 12, 40, 2.5], ['Leg Press', 3, 8, 12, 105, 5], ['Hamstring Curl', 2, 10, 15, 32.5, 2.5], ['Cable Lateral Raise', 2, 12, 20, 6, 1], ['Ab Crunch', 2, 12, 20, 17.5, 2.5]],
      FullB: [['Romanian Deadlift', 3, 8, 10, 60, 5], ['Lat Pulldown', 3, 8, 12, 47.5, 2.5], ['Smith Machine Bench Press', 3, 8, 12, 45, 2.5], ['Leg Extension', 2, 10, 15, 37.5, 2.5], ['Reverse Fly', 2, 12, 20, 7, 1], ['DB Preacher Curl', 2, 10, 15, 9, 1]],
      FullC: [['Leg Press', 2, 10, 15, 100, 5], ['Machine Shoulder Press', 2, 8, 12, 27.5, 2.5], ['Unilateral Seated Row', 3, 8, 12, 30, 2.5], ['Hamstring Curl', 2, 10, 15, 32.5, 2.5], ['Tricep Pushdown', 2, 10, 15, 22.5, 2.5], ['Ab Crunch', 2, 12, 20, 17.5, 2.5]]
    };
    const PLAN_DAYS = { 1: 'FullA', 3: 'FullB', 5: 'FullC' };
    const seenRecent = {};
    let recentIndex = 0;
    for (let day = -35; day <= 0; day++) {
      const date = dateFromToday(day);
      const dayType = PLAN_DAYS[new Date(date + 'T12:00:00').getDay()];
      if (!dayType) continue;
      recentIndex++;
      if (recentIndex === 4) continue;
      const isToday = day === 0;
      const base = isToday ? Date.now() - 22 * 60000 : Date.parse(date + 'T18:30:00');
      FULL[dayType].forEach(([name, sets, lo, hi, start, inc], exIdx) => {
        if (isToday && exIdx > 1) return;
        const n = (seenRecent[name] = (seenRecent[name] || 0) + 1) - 1;
        const weight = round05(start + Math.floor(n / 2) * inc);
        for (let setNum = 1; setNum <= sets; setNum++) {
          const reps = Math.max(lo, Math.min(hi, lo + 2 + (n % 3)) - (setNum - 1));
          const entry = { id: uid(), date, dayType, gym: 'Gym A', exercise: name, setNum, weight, reps, volume: Math.round(weight * reps), setType: 'working', ts: base + exIdx * 360000 + setNum * 120000, _seed: true };
          if (typeof exerciseFamily === 'function') entry.movementFamily = exerciseFamily(name);
          logs.push(entry);
        }
      });
    }
    return logs;
  }

  function buildBws() {
    const bws = [];
    for (let day = -89; day <= 0; day++) {
      const date = dateFromToday(day);
      const d = new Date(date + 'T12:00:00');
      if (d.getDay() === 0 && day !== 0 && rnd() < 0.35) continue;
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
    const types = ['Incline Walk', 'Zone 2', 'Incline Walk', 'Bike'];
    const dates = pickDates(60, (dow, i, day) => (dow === 2 || dow === 6 || (dow === 4 && Math.abs(day) % 14 >= 7)) && (Math.abs(day) * 7 + 3) % 9 !== 0);
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
    const dates = pickDates(14, (dow, i, day) => dow === 4 && Math.abs(day) % 14 < 7);
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
    const offsets = [];
    for (let o = 0; o >= -89; o--) if (o === 0 || rnd() < 0.8) offsets.push(o);
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

  // Dedicated stream: adherence stays identical no matter what the other builders draw.
  const rndAdherence = mulberry32(1010);
  const ADHERENCE_MIX = [['yes', .55], ['close', .25], ['no', .15], ['over', .05]];

  function pickStatus(r) {
    let acc = 0;
    for (const [status, share] of ADHERENCE_MIX) { acc += share; if (r < acc) return status; }
    return 'yes';
  }

  function buildAdherence() {
    const out = {};
    for (let day = -90; day <= -1; day++) {
      if (rndAdherence() >= 0.85) continue;
      const date = dateFromToday(day);
      out[date] = { status: pickStatus(rndAdherence()), ts: Date.parse(date + 'T21:00:00'), _seed: true };
    }
    return out;
  }

  function writeIfAllowed(key, value) {
    if (!forcedReseed() && !isVacant(key)) return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }

  function applyRuntime(written) {
    if (typeof state !== 'object' || !state) return;
    const forced = forcedReseed();
    if (forced) {
      state.logs = written.logs || [];
      state.bws = written.bws || [];
      state.cardio = written.cardio || [];
      state.floorball = written.floorball || [];
      state.scans = written.scans || [];
      state.rest = written.rest || [];
    } else {
      if (written.logs) state.logs = written.logs;
      if (written.bws) state.bws = written.bws;
      if (written.cardio) state.cardio = written.cardio;
      if (written.floorball) state.floorball = written.floorball;
      if (written.scans) state.scans = written.scans;
      if (written.rest) state.rest = written.rest;
    }
    if (written.read) state.read = written.read;
    if (written.settings && typeof settings === 'object') {
      if (!settings.cutSupport || typeof settings.cutSupport !== 'object') settings.cutSupport = {};
      const cut = written.settings.cutSupport || {};
      if (forcedReseed()) {
        settings.cutSupport.recovery = cut.recovery || {};
        settings.cutSupport.adherence = cut.adherence || {};
        settings.cutSupport.waist = Array.isArray(cut.waist) ? cut.waist : [];
        settings.cutSupport.tdeeHistory = Array.isArray(cut.tdeeHistory) ? cut.tdeeHistory : [];
        settings.cutSupport.activeScenario = null;
      } else {
        settings.cutSupport.recovery = Object.assign({}, settings.cutSupport.recovery, cut.recovery);
        settings.cutSupport.adherence = Object.assign({}, settings.cutSupport.adherence, cut.adherence);
        if (Array.isArray(cut.waist) && !(Array.isArray(settings.cutSupport.waist) && settings.cutSupport.waist.length)) settings.cutSupport.waist = cut.waist;
      }
      if (cut.calories != null) settings.cutSupport.calories = cut.calories;
      if (cut.targetConfirmed != null && settings.cutSupport.targetConfirmed == null) settings.cutSupport.targetConfirmed = cut.targetConfirmed;
      settings.cutSupport.seedVersion = cut.seedVersion;
      if (written.settings.startWeight != null) settings.startWeight = written.settings.startWeight;
    }
    if (typeof persist === 'function') persist();
    if (typeof NXT === 'object' && typeof NXT.repaint === 'function') NXT.repaint();
    else if (typeof render === 'function') render();
  }

  /* Five Evo scans a few days apart, same shape the scan form saves. */
  function buildScans() {
    const out = [];
    const rs = mulberry32(2024);
    for (let day = -84; day <= -2; day += 9) {
      const t = (day + 89) / 89;
      const weight = round1(87 - 5 * t + (rs() - 0.5) * 0.8);
      const bodyFat = round1(27.4 - 3.6 * t + (rs() - 0.5) * 0.6);
      const muscleMass = round1(35.0 - 0.5 * t + (rs() - 0.5) * 0.4);
      const bmr = Math.round(1745 - 40 * t + (rs() - 0.5) * 10);
      out.push({ id: uid(), date: dateFromToday(day), image: '', weight, bodyFat, muscleMass, fatMass: round1(weight * bodyFat / 100), bmr, tdee: Math.round(bmr * 1.54), notes: '', context: 'EVOSCAN', _seed: true });
    }
    return out;
  }

  function buildWaist() {
    const out = [];
    for (let day = -84; day <= -1; day += 14) {
      const t = (day + 89) / 89;
      out.push({ id: uid(), date: dateFromToday(day), cm: round1(92 - 5 * t + (rnd() - 0.5) * 0.6), ts: Date.parse(dateFromToday(day) + 'T07:40:00'), _seed: true });
    }
    return out;
  }

  function seed() {
    const logs = buildLogs();
    const bws = buildBws();
    const cardio = buildCardio();
    const floorball = buildFloorball();
    const recovery = buildRecovery();
    const adherence = buildAdherence();
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
    const existingCut = existingSettings.cutSupport || {};
    const forced = forcedReseed();
    const dropSeeded = rows => (Array.isArray(rows) ? rows : []).filter(r => !r || r._seed !== true);
    const settingsPayload = Object.assign({}, existingSettings, {
      startWeight: existingSettings.startWeight != null ? existingSettings.startWeight : 87.1,
      targetHigh: existingSettings.targetHigh != null ? existingSettings.targetHigh : 80,
      targetLow: existingSettings.targetLow != null ? existingSettings.targetLow : 78,
      tdee: existingSettings.tdee != null ? existingSettings.tdee : 2644,
      zone2WeeklyTarget: existingSettings.zone2WeeklyTarget != null ? existingSettings.zone2WeeklyTarget : 180,
      cutSupport: Object.assign({}, existingSettings.cutSupport, {
        recovery: forced ? recovery : Object.assign({}, existingCut.recovery || {}, recovery),
        adherence: forced ? adherence : Object.assign({}, existingCut.adherence || {}, adherence),
        targetConfirmed: existingCut.targetConfirmed != null ? existingCut.targetConfirmed : true,
        calories: existingCut.calories != null && existingCut.calories !== '' ? existingCut.calories : 2100,
        seedVersion: SEED_VERSION,
        waist: forced ? dropSeeded(existingCut.waist).concat(buildWaist()) : (Array.isArray(existingCut.waist) && existingCut.waist.length ? existingCut.waist : buildWaist()),
        tdeeHistory: forced ? dropSeeded(existingCut.tdeeHistory) : existingCut.tdeeHistory,
        activeScenario: forced ? null : existingCut.activeScenario
      })
    });

    const written = {};
    if (forced) {
      localStorage.setItem(KEYS.logs, JSON.stringify(logs));
      localStorage.setItem(KEYS.bws, JSON.stringify(bws));
      localStorage.setItem(KEYS.cardio, JSON.stringify(cardio));
      localStorage.setItem(KEYS.floorball, JSON.stringify(floorball));
      localStorage.setItem(KEYS.scans, JSON.stringify(buildScans()));
      localStorage.setItem(KEYS.rest, JSON.stringify([]));
      Object.assign(written, { logs, bws, cardio, floorball, scans: JSON.parse(localStorage.getItem(KEYS.scans)), rest: [] });
    } else {
      if (writeIfAllowed(KEYS.scans, buildScans())) written.scans = JSON.parse(localStorage.getItem(KEYS.scans));
      if (writeIfAllowed(KEYS.logs, logs)) written.logs = logs;
      if (writeIfAllowed(KEYS.bws, bws)) written.bws = bws;
      if (writeIfAllowed(KEYS.cardio, cardio)) written.cardio = cardio;
      if (writeIfAllowed(KEYS.floorball, floorball)) written.floorball = floorball;
    }
    if (writeIfAllowed(KEYS.read, read)) written.read = read;
    if (writeIfAllowed(KEYS.settings, settingsPayload)) written.settings = settingsPayload;
    if (Object.keys(written).length) {
      applyRuntime(written);
      if (reseedRequested()) {
        const params = new URLSearchParams(location.search);
        params.delete('reseed');
        const q = params.toString();
        history.replaceState({}, '', location.pathname + (q ? '?' + q : '') + location.hash);
      }
    }
  }

  window.__nxtForceSeed = function () {
    forceSeed = true;
    try { seed(); }
    finally { forceSeed = false; }
  };

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
    if (currentSettings && currentSettings.cutSupport) {
      ['recovery', 'adherence'].forEach(field => {
        const map = currentSettings.cutSupport[field];
        if (!map) return;
        const next = {};
        Object.keys(map).forEach(date => {
          const row = map[date];
          if (!row || row._seed !== true) next[date] = row;
        });
        currentSettings.cutSupport[field] = next;
        if (typeof settings === 'object' && settings) {
          if (!settings.cutSupport) settings.cutSupport = {};
          settings.cutSupport[field] = next;
        }
      });
      localStorage.setItem(KEYS.settings, JSON.stringify(currentSettings));
    }
    if (typeof persist === 'function') persist();
    location.reload();
  };

  seed();

  /* ?demo=goal (localhost and previews only): shows the goal-reached moment (D99) on test data. The goal range
     is set in memory just long enough for the latest reading to be the first that brings "Now" (D97) inside it,
     the moment is drawn, and the range goes straight back. Nothing is written. */
  if (/(?:^|[?&])demo=goal(?:&|$)/.test(location.search)) {
    const tryDemo = function (n) {
      const ready = typeof NXT === 'object' && typeof NXT.levelSeries === 'function' && typeof STRATA === 'object' && STRATA && STRATA.goalMoment;
      if (!ready) { if (n < 60) setTimeout(function () { tryDemo(n + 1); }, 250); return; }
      const lv = NXT.levelSeries();
      if (lv.length < 3) return;
      const last = lv[lv.length - 1].value, prev = lv[lv.length - 2].value;
      if (!(prev > last)) return;
      const keep = { lo: TARGET_LOW, hi: TARGET_HIGH, sLo: settings.targetLow, sHi: settings.targetHigh, conf: NXT.cfg().targetConfirmed };
      let hi = Math.floor((last + prev) / 2 * 10) / 10;
      if (!(hi >= last && hi < prev)) hi = Math.round((last + prev) / 2 * 100) / 100;
      TARGET_HIGH = hi; TARGET_LOW = Math.round((hi - 2) * 10) / 10;
      settings.targetHigh = TARGET_HIGH; settings.targetLow = TARGET_LOW; NXT.cfg().targetConfirmed = true;
      try { STRATA.goalMoment(); }
      finally { TARGET_LOW = keep.lo; TARGET_HIGH = keep.hi; settings.targetLow = keep.sLo; settings.targetHigh = keep.sHi; NXT.cfg().targetConfirmed = keep.conf; }
    };
    setTimeout(function () { tryDemo(0); }, 1200);
  }
})();
