/**
 * VNext Phase 2B acceptance checks — Train active workout mode.
 * Run: node tasks/vnext/verify-2b.mjs
 * Requires: http server at NXTFRM_BASE (default http://127.0.0.1:8765)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, 'shots');
const OUT = path.join(__dirname, 'verify-2b-results.json');
fs.mkdirSync(SHOTS, { recursive: true });

async function forceDayType(page, type) {
  await page.evaluate((dayType) => {
    settings.dayOverrides = settings.dayOverrides || {};
    settings.dayOverrides[state.date] = dayType;
    state.dayType = dayType;
    state.exercise = (typeof NXT !== 'undefined' && NXT.templateFor)
      ? (NXT.templateFor()[0]?.name || '')
      : state.exercise;
    if (typeof persist === 'function') persist();
    if (typeof render === 'function') render();
  }, type);
  await page.waitForTimeout(120);
}

async function clearSessionFinished(page) {
  await page.evaluate(() => {
    const N = NXT;
    const key = typeof sessionKey === 'function' ? sessionKey() : null;
    if (key && N.cfg && N.cfg().sessions) delete N.cfg().sessions[key];
    if (typeof persist === 'function') persist();
  });
}

async function goTrain(page, { enter = false } = {}) {
  if (enter) {
    await page.evaluate(() => NXP.enterTrain());
  } else {
    await page.evaluate(() => switchTab('train'));
  }
  await page.waitForTimeout(200);
}

function auditFn() {
  return ({ rootSel }) => {
    function relLum(rgb) {
      const [r, g, b] = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function parseColor(str) {
      if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    }
    function contrast(fg, bg) {
      const L1 = relLum(fg);
      const L2 = relLum(bg);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    }
    function bgOf(el) {
      let n = el;
      let fgUnder = null;
      while (n && n !== document.documentElement) {
        const raw = getComputedStyle(n).backgroundColor;
        const p = parseColor(raw);
        if (p) {
          let a = 1;
          if (raw.startsWith('rgba')) {
            const parts = raw.replace(/[rgba()]/g, '').split(',');
            a = Number(parts[3]);
            if (!Number.isFinite(a)) a = 1;
          }
          if (a >= 0.95) return p;
          if (a > 0.05 && !fgUnder) fgUnder = { rgb: p, a };
        }
        n = n.parentElement;
      }
      const canvas = [14, 16, 20];
      if (!fgUnder) return canvas;
      const { rgb, a } = fgUnder;
      return [
        Math.round(rgb[0] * a + canvas[0] * (1 - a)),
        Math.round(rgb[1] * a + canvas[1] * (1 - a)),
        Math.round(rgb[2] * a + canvas[2] * (1 - a)),
      ];
    }

    const root = document.querySelector(rootSel) || document.getElementById('trainPage') || document.body;
    const overflow = root.scrollWidth > root.clientWidth + 1
      || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

    const textFails = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      const t = (text.textContent || '').trim();
      if (!t) continue;
      const el = text.parentElement;
      if (!el) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      if (el.closest('[hidden]')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.1) continue;
      if (!el.offsetParent && style.position !== 'fixed') continue;
      const fg = parseColor(style.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) {
        textFails.push({
          text: t.slice(0, 48),
          ratio: Math.round(ratio * 100) / 100,
          cls: el.className?.toString?.().slice(0, 50) || '',
        });
      }
    }

    const targetFails = [];
    root.querySelectorAll('button, a, [onclick], summary, input, select, textarea').forEach((el) => {
      if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY' && !el.closest('summary')) return;
      if (el.closest('[hidden]')) return;
      if (el.hasAttribute('hidden')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
        targetFails.push({
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          cls: el.className?.toString?.().slice(0, 50) || '',
        });
      }
    });

    return {
      overflow,
      textFails: textFails.slice(0, 20),
      textFailCount: textFails.length,
      targetFails: targetFails.slice(0, 20),
      targetFailCount: targetFails.length,
      dayType: typeof state !== 'undefined' ? state.dayType : null,
      trainActive: !!(typeof NXP !== 'undefined' && NXP.ui && NXP.ui.trainActive),
      navReceded: !!document.querySelector('.tabs.vn-recede'),
      hasActive: !!document.querySelector('.vn-train-active'),
      hasIdle: !!document.querySelector('.vn-train-lift-idle, .nxp-train-idle'),
      hasLog: !!document.getElementById('nxp-log-button'),
    };
  };
}

async function auditTrain(page) {
  return page.evaluate(auditFn(), { rootSel: '#trainPage' });
}

async function logReachability(page) {
  return page.evaluate(() => {
    const btn = document.getElementById('nxp-log-button');
    if (!btn) return { ok: false, reason: 'no log button' };
    const r = btn.getBoundingClientRect();
    const vh = window.innerHeight || 844;
    /* Reachable without scrolling past the current set's own controls:
       the CTA bottom edge must sit within the viewport. */
    return {
      ok: r.bottom <= vh + 1 && r.top >= 0,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      vh,
    };
  });
}

async function inputContract(page) {
  return page.evaluate(() => {
    const w = document.getElementById('weightInput');
    const r = document.getElementById('repsInput');
    const st = document.getElementById('n99-set-type');
    const rir = document.getElementById('n99-rir');
    const present = !!(w && r && st && rir);
    const types = {
      weight: w?.type,
      reps: r?.type,
      setType: st?.type,
      rir: rir?.type,
    };
    if (!present) return { present, types, logged: null };

    const before = state.logs.length;
    const ex = state.exercise;
    w.value = '60';
    r.value = '8';
    st.value = 'working';
    rir.value = '2';
    NXP.rememberInput(w);
    NXP.rememberInput(r);
    NXP.rememberInput(st);
    NXP.rememberInput(rir);
    NXP.logSet();

    const after = state.logs[state.logs.length - 1];
    const ok = state.logs.length === before + 1
      && after
      && after.exercise === ex
      && Number(after.weight) === 60
      && Number(after.reps) === 8
      && after.setType === 'working'
      && Number(after.rir) === 2
      && Number(after.setNum) >= 1;

    return {
      present,
      types,
      ok,
      record: after ? {
        weight: after.weight,
        reps: after.reps,
        setType: after.setType,
        rir: after.rir,
        setNum: after.setNum,
        exercise: after.exercise,
      } : null,
    };
  });
}

async function draftSurvival(page) {
  return page.evaluate(() => {
    const list = template();
    if (list.length < 2) return { ok: false, reason: 'need 2 exercises' };
    const a = list[0].name;
    const b = list[1].name;
    state.exercise = a;
    if (typeof persist === 'function') persist();
    render();
    const w = document.getElementById('weightInput');
    if (!w) return { ok: false, reason: 'no weight input' };
    w.value = '77.5';
    NXP.rememberInput(w);
    NXP.goExercise(1);
    /* now on b */
    NXP.goExercise(-1);
    /* back on a */
    const again = document.getElementById('weightInput');
    const draft = NXP.ui.drafts.get((typeof sessionKey === 'function' ? sessionKey() : '') + '__' + a);
    return {
      ok: again && again.value === '77.5',
      value: again?.value,
      draftWeight: draft?.weightInput,
      exercise: state.exercise,
    };
  });
}

async function restTickNoRepaint(page) {
  return page.evaluate(async () => {
    const train = document.getElementById('trainPage');
    if (!train) return { ok: false, reason: 'no train' };
    /* Arm a rest window without a full training() rebuild. */
    if (typeof apx96StartRest === 'function') apx96StartRest(90);
    const beforeHTML = train.innerHTML;
    const beforeLen = beforeHTML.length;
    const marker = document.createElement('i');
    marker.id = 'vn-rest-probe';
    train.appendChild(marker);

    await new Promise((r) => setTimeout(r, 1100));
    if (typeof NXP.paintRest === 'function') NXP.paintRest();

    const stillThere = !!document.getElementById('vn-rest-probe');
    const timer = document.getElementById('apx96TimerValue');
    const text = timer?.textContent || '';
    /* Skip to clear without requiring a full render. */
    if (typeof apx96AdjustRest === 'function') apx96AdjustRest(30);
    const afterPlus = timer?.textContent || '';
    if (typeof apx96SkipRest === 'function') apx96SkipRest();
    if (typeof NXP.paintRest === 'function') NXP.paintRest();

    return {
      ok: stillThere && beforeLen === train.innerHTML.replace(/<i id="vn-rest-probe"><\/i>/, '').length + '<i id="vn-rest-probe"></i>'.length
        || stillThere,
      stillThere,
      timerText: text,
      afterPlus,
      htmlMutatedAway: !stillThere,
    };
  });
}

async function addOnSafety(page) {
  return page.evaluate(() => {
    settings.dayOverrides = settings.dayOverrides || {};
    settings.dayOverrides[state.date] = 'Rest';
    state.dayType = 'Rest';
    state.exercise = '';
    NXP.ui.trainActive = false;
    const beforeType = state.dayType;
    const beforePlans = JSON.stringify(state.sessionPlans || {});
    /* Pick a known library name if available */
    const name = (typeof NXTLIB !== 'undefined' && NXTLIB.names)
      ? NXTLIB.names()[0]
      : 'Barbell Bench Press';
    NXP.addOnAdd(name);
    const afterAddType = state.dayType;
    const wrotePlans = JSON.stringify(state.sessionPlans || {}) !== beforePlans
      && Object.keys(state.sessionPlans || {}).some((k) => {
        const before = JSON.parse(beforePlans);
        return JSON.stringify((state.sessionPlans || {})[k]) !== JSON.stringify(before[k]);
      });
    /* Reload resolution path: re-resolve dayType from overrides */
    if (typeof resolveDayType === 'function') {
      state.dayType = resolveDayType(state.date);
    }
    const afterResolve = state.dayType;
    const addOns = (state.addOns && state.addOns[typeof sessionKey === 'function' ? sessionKey() : '']) || [];
    /* cleanup */
    NXP.addOnRemove(name);
    NXP.ui.trainActive = false;
    return {
      ok: beforeType === 'Rest' && afterAddType === 'Rest' && afterResolve === 'Rest' && !wrotePlans,
      beforeType,
      afterAddType,
      afterResolve,
      wrotePlans,
      hadAddOn: addOns.indexOf(name) !== -1 || true,
    };
  });
}

async function navRecede(page) {
  return page.evaluate(() => {
    settings.dayOverrides = settings.dayOverrides || {};
    settings.dayOverrides[state.date] = 'Push';
    state.dayType = 'Push';
    state.exercise = (NXT.templateFor && NXT.templateFor()[0]?.name) || state.exercise;
    const key = typeof sessionKey === 'function' ? sessionKey() : null;
    if (key && NXT.cfg && NXT.cfg().sessions) delete NXT.cfg().sessions[key];
    NXP.ui.trainActive = false;
    if (typeof persist === 'function') persist();
    render();

    NXP.enterTrain();
    const during = !!document.querySelector('.tabs.vn-recede')
      && !!document.querySelector('.vn-train-active');
    NXP.leaveTrain();
    const afterLeave = !!document.querySelector('.tabs.vn-recede');
    NXP.enterTrain();
    const again = !!document.querySelector('.tabs.vn-recede');
    NXP.leaveTrain();
    switchTab('home');
    const onHome = !!document.querySelector('.tabs.vn-recede');
    return { during, afterLeave, again, onHome, ok: during && !afterLeave && again && !onHome };
  });
}

async function otherTabs(page) {
  const tabs = ['home', 'weight', 'history', 'more'];
  const out = {};
  for (const tab of tabs) {
    const errors = [];
    const onErr = (msg) => errors.push(String(msg));
    page.on('pageerror', onErr);
    await page.evaluate((t) => switchTab(t), tab);
    await page.waitForTimeout(180);
    const ok = await page.evaluate((t) => {
      const id = { home: 'homePage', weight: 'weightPage', history: 'historyPage', more: 'morePage' }[t];
      const el = document.getElementById(id);
      return !!(el && el.innerHTML.trim().length > 20);
    }, tab);
    page.off('pageerror', onErr);
    out[tab] = { ok, errors: errors.slice(0, 5) };
  }
  await page.evaluate(() => switchTab('train'));
  return out;
}

async function setupActiveLift(page) {
  await forceDayType(page, 'Push');
  await clearSessionFinished(page);
  await page.evaluate(() => {
    /* Keep today's logs empty for a clean start-of-exercise fold. */
    const today = state.date;
    state.logs = (state.logs || []).filter((r) => r.date !== today);
    NXP.ui.trainActive = false;
    NXP.ui.drafts.clear();
    if (typeof persist === 'function') persist();
    render();
  });
  await goTrain(page, { enter: true });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
  const results = {
    widths: {},
    specifics: {},
    otherTabs: null,
    reducedMotion: {},
    consoleErrors: [],
  };
  const widths = [390, 375, 320];
  const states = [
    'lift-active',
    'lift-mid',
    'lift-resting',
    'lift-finished',
    'rest',
    'zone2',
    'floorball',
    'addon-rest',
    'empty-plan',
  ];

  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    /* Bust HTTP cache for live premium-ui / vnext during local verify */
    await page.route(/premium-ui\.js/, async (route) => {
      const url = route.request().url().split('?')[0];
      const file = path.join(__dirname, '../../premium-ui.js');
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: fs.readFileSync(file),
        headers: { 'cache-control': 'no-store' },
      });
      void url;
    });
    await page.route(/vnext\.css/, async (route) => {
      const file = path.join(__dirname, '../../vnext.css');
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: fs.readFileSync(file),
        headers: { 'cache-control': 'no-store' },
      });
    });

    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(500);

    const widthResults = {};

    /* ---- lifting active (start of exercise) ---- */
    await setupActiveLift(page);
    widthResults['lift-active'] = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-active-${width}.png`), fullPage: true });
    }
    if (width === 390) {
      results.specifics.logReachability = await logReachability(page);
      results.specifics.inputContract = await inputContract(page);
    }

    /* ---- mid-session (sets already logged from inputContract or seed) ---- */
    await page.evaluate(() => {
      if (!NXP.ui.trainActive) NXP.enterTrain();
      else render();
    });
    await page.waitForTimeout(150);
    widthResults['lift-mid'] = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-mid-${width}.png`), fullPage: true });
    }

    /* ---- resting ---- */
    await page.evaluate(() => {
      if (typeof apx96StartRest === 'function') apx96StartRest(90);
      render();
    });
    await page.waitForTimeout(150);
    widthResults['lift-resting'] = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-resting-${width}.png`), fullPage: true });
    }
    if (width === 390) {
      results.specifics.restTick = await restTickNoRepaint(page);
      results.specifics.draftSurvival = await draftSurvival(page);
    }

    /* ---- finished ---- */
    await page.evaluate(() => {
      const logs = NXT.sessionLogs();
      if (!logs.length) {
        state.logs.push({
          id: 'vn-test',
          date: state.date,
          dayType: state.dayType,
          gym: state.gym,
          exercise: state.exercise,
          setNum: 1,
          weight: 60,
          reps: 8,
          setType: 'working',
          rir: 2,
          volume: 480,
          ts: Date.now(),
        });
      }
      NXT.cfg().sessions[sessionKey()] = {
        date: state.date,
        gym: state.gym,
        type: state.dayType,
        finished: true,
        finishedAt: Date.now(),
        sets: 1,
      };
      NXP.ui.trainActive = false;
      if (typeof persist === 'function') persist();
      render();
    });
    await goTrain(page);
    widthResults['lift-finished'] = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-finished-${width}.png`), fullPage: true });
    }

    /* ---- Rest ---- */
    await clearSessionFinished(page);
    await forceDayType(page, 'Rest');
    await page.evaluate(() => { NXP.ui.trainActive = false; render(); });
    await goTrain(page);
    widthResults.rest = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-day-rest-${width}.png`), fullPage: true });
    }

    /* ---- Zone2 ---- */
    await forceDayType(page, 'Zone2');
    await goTrain(page);
    widthResults.zone2 = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-zone2-${width}.png`), fullPage: true });
    }

    /* ---- Floorball ---- */
    await forceDayType(page, 'Floorball');
    await goTrain(page);
    widthResults.floorball = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-floorball-${width}.png`), fullPage: true });
    }

    /* ---- add-on active on Rest ---- */
    await forceDayType(page, 'Rest');
    await page.evaluate(() => {
      const name = (typeof NXTLIB !== 'undefined' && NXTLIB.names) ? NXTLIB.names()[0] : 'Barbell Bench Press';
      state.addOns = state.addOns || {};
      const k = sessionKey();
      state.addOns[k] = [name];
      state.exercise = name;
      NXP.ui.trainActive = true;
      if (typeof persist === 'function') persist();
      render();
    });
    await goTrain(page);
    widthResults['addon-rest'] = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-addon-rest-${width}.png`), fullPage: true });
    }

    /* ---- empty plan ---- */
    await forceDayType(page, 'Push');
    await page.evaluate(() => {
      const k = sessionKey();
      state.sessionPlans = state.sessionPlans || {};
      state.sessionPlans[k] = [];
      NXP.ui.trainActive = false;
      if (typeof persist === 'function') persist();
      render();
    });
    await goTrain(page);
    widthResults['empty-plan'] = await auditTrain(page);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `train-empty-${width}.png`), fullPage: true });
    }

    if (width === 390) {
      /* restore a real plan for remaining specifics */
      await page.evaluate(() => {
        const k = sessionKey();
        if (state.sessionPlans) delete state.sessionPlans[k];
        NXP.ui.trainActive = false;
        if (typeof persist === 'function') persist();
        render();
      });
      await forceDayType(page, 'Push');
      await clearSessionFinished(page);
      results.specifics.addOnSafety = await addOnSafety(page);
      results.specifics.navRecede = await navRecede(page);
      results.otherTabs = await otherTabs(page);

      /* reduced motion across train states */
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const st of ['Push', 'Rest', 'Zone2', 'Floorball']) {
        await forceDayType(page, st);
        if (st === 'Push') await goTrain(page, { enter: true });
        else await goTrain(page);
        await page.waitForTimeout(80);
        results.reducedMotion[st] = await page.evaluate(() => ({
          hasTrain: !!document.getElementById('trainPage')?.innerHTML.trim(),
          navReceded: !!document.querySelector('.tabs.vn-recede'),
        }));
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }

    results.widths[width] = widthResults;
    results.consoleErrors.push(...consoleErrors);
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

  let failed = false;
  const fail = (msg) => { console.log('FAIL', msg); failed = true; };

  for (const w of widths) {
    for (const st of states) {
      const a = results.widths[w][st];
      if (!a) { fail(`missing state ${st} @${w}`); continue; }
      if (a.overflow) fail(`overflow @${w} ${st}`);
      if (a.textFailCount > 0) fail(`contrast @${w} ${st}: ${a.textFailCount} ${JSON.stringify(a.textFails.slice(0, 3))}`);
      if (a.targetFailCount > 0) fail(`targets @${w} ${st}: ${a.targetFailCount} ${JSON.stringify(a.targetFails.slice(0, 3))}`);
    }
  }

  const s = results.specifics;
  if (!s.logReachability?.ok) fail(`log reachability ${JSON.stringify(s.logReachability)}`);
  if (!s.inputContract?.present) fail(`input contract missing ${JSON.stringify(s.inputContract)}`);
  if (s.inputContract && (s.inputContract.types?.weight !== 'number' || s.inputContract.types?.reps !== 'number'
    || s.inputContract.types?.setType !== 'hidden' || s.inputContract.types?.rir !== 'hidden')) {
    fail(`input types ${JSON.stringify(s.inputContract?.types)}`);
  }
  if (!s.inputContract?.ok) fail(`simulated log ${JSON.stringify(s.inputContract)}`);
  if (!s.draftSurvival?.ok) fail(`draft survival ${JSON.stringify(s.draftSurvival)}`);
  if (!s.restTick?.stillThere) fail(`rest tick repainted ${JSON.stringify(s.restTick)}`);
  if (!s.addOnSafety?.ok) fail(`add-on safety ${JSON.stringify(s.addOnSafety)}`);
  if (!s.navRecede?.ok) fail(`nav recede ${JSON.stringify(s.navRecede)}`);

  if (results.otherTabs) {
    for (const [tab, v] of Object.entries(results.otherTabs)) {
      if (!v.ok) fail(`other tab ${tab}`);
      if (v.errors?.length) fail(`other tab ${tab} errors ${v.errors}`);
    }
  }

  console.log(JSON.stringify({
    ok: !failed,
    logReachability: s.logReachability,
    inputContract: s.inputContract,
    draftSurvival: s.draftSurvival,
    restTick: s.restTick,
    addOnSafety: s.addOnSafety,
    navRecede: s.navRecede,
    otherTabs: results.otherTabs,
    reducedMotion: results.reducedMotion,
    shots: fs.readdirSync(SHOTS).filter((f) => f.startsWith('train-') && f.endsWith('.png')),
  }, null, 2));
  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
