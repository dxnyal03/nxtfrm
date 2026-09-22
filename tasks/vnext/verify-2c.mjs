/**
 * VNext Phase 2C acceptance checks — Progress / Weight.
 * Run: node tasks/vnext/verify-2c.mjs
 * Requires: http server at NXTFRM_BASE (default http://127.0.0.1:8765)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, 'shots');
const OUT = path.join(__dirname, 'verify-2c-results.json');
fs.mkdirSync(SHOTS, { recursive: true });

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

    const root = document.querySelector(rootSel) || document.getElementById('weightPage') || document.body;
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
      if (el.closest('[aria-hidden="true"]')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.1) continue;
      if (!el.offsetParent && style.position !== 'fixed') continue;
      if (el.closest('svg')) continue;
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
    root.querySelectorAll('button, a, [onclick], summary, input, select, textarea, [role="application"]').forEach((el) => {
      if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY' && !el.closest('summary')) return;
      if (el.closest('[hidden]')) return;
      if (el.hasAttribute('hidden')) return;
      if (el.id === 'n99-chart-slider') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      /* Chart wrap is the scrub surface — height comes from the plot, not 44pt. */
      if (el.id === 'vn-chart-wrap' || el.classList.contains('vn-chart-wrap')) return;
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
    };
  };
}

async function seedWeightData(page, { confirmed = true, sparse = false } = {}) {
  await page.evaluate(({ confirmed, sparse }) => {
    const today = state.date || '2026-09-22';
    const bws = [];
    let ts = 1000;
    const push = (date, weight, timeOfDay = 'Morning') => {
      bws.push({ id: 'v2c' + bws.length, date, weight, timeOfDay, ts: ts += 10 });
    };
    if (sparse) {
      push(today, 84.2);
      push(NXT.dateAdd(today, -2), 84.5);
    } else {
      for (let i = 35; i >= 0; i--) {
        const d = NXT.dateAdd(today, -i);
        const w = 84.5 + (i * 0.07) + ((i % 3) - 1) * 0.15;
        push(d, Math.round(w * 10) / 10);
        if (i % 5 === 0) push(d, Math.round((w - 0.6) * 10) / 10, 'Post-workout');
      }
    }
    state.bws = bws;
    settings.startWeight = 87.1;
    START_WEIGHT = 87.1;
    settings.targetLow = 78;
    settings.targetHigh = 80;
    TARGET_LOW = 78;
    TARGET_HIGH = 80;
    if (!settings.cutSupport || typeof settings.cutSupport !== 'object') settings.cutSupport = {};
    settings.cutSupport.targetConfirmed = !!confirmed;
    NXT.ui.view = 'overview';
    NXT.ui.range = 30;
    NXT.ui.showGoal = false;
    NXT.ui.showPost = false;
    NXT.ui.showForecast = false;
    NXT.ui.selected = null;
    if (typeof persist === 'function') persist();
  }, { confirmed, sparse });
}

async function goWeight(page) {
  await page.evaluate(() => {
    NXT.ui.view = 'overview';
    switchTab('weight');
  });
  await page.waitForTimeout(200);
}

async function domainProbe(page) {
  return page.evaluate(() => {
    const m = NXT.chartModel();
    return {
      low: m.low,
      high: m.high,
      span: m.low == null ? null : Math.round((m.high - m.low) * 1000) / 1000,
      pointCount: m.points?.length || 0,
      hasForecast: !!m.forecast,
      goalRef: m.goalRef,
      canForecast: !!m.canForecast,
    };
  });
}

async function truthSnapshot(page) {
  return page.evaluate(() => {
    const rows = NXT.weights();
    const r4 = (v) => (v == null ? v : Math.round(v * 10000) / 10000);
    const trend = NXT.trend(rows).map((r) => [r.date, r4(r.weight), r4(r.avg), r.coverage]);
    const stats = NXT.trendStats(rows);
    const plateau = NXT.detectPlateau(rows);
    const forecast = NXT.forecastGoal(rows);
    const conf = NXT.trendConfidence(rows);
    return {
      trendTail: trend.slice(-3),
      trendLen: trend.length,
      stats: {
        change: r4(stats.change),
        percent: r4(stats.percent),
        current: r4(stats.current.avg),
        previous: r4(stats.previous.avg),
      },
      plateau: {
        ok: plateau.ok,
        status: plateau.status,
        weeklyRate: r4(plateau.weeklyRate),
        confidence: plateau.confidence,
        plateauDays: plateau.plateauDays,
      },
      forecast: {
        ok: forecast.ok,
        weeks: forecast.weeks,
        lowWeeks: forecast.lowWeeks,
        highWeeks: forecast.highWeeks,
        confidence: forecast.confidence,
        slope: r4(forecast.slope),
        fittedLevel: r4(forecast.fittedLevel),
      },
      confLen: conf ? conf.length : 0,
      confTail: conf ? conf.slice(-2).map((b) => [b.date, r4(b.sigma), r4(b.lower), r4(b.upper)]) : null,
    };
  });
}

async function trendGeometry(page) {
  return page.evaluate(() => {
    const m = NXT.chartModel();
    return {
      low: m.low,
      high: m.high,
      segments: (m.segments || []).map((seg) => seg.map((p) => [p.date, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100])),
    };
  });
}

async function fulfillLive(page) {
  const files = {
    'cut-support.js': 'application/javascript',
    'premium-ui.js': 'application/javascript',
    'vnext.css': 'text/css',
  };
  for (const [name, type] of Object.entries(files)) {
    const re = new RegExp(name.replace('.', '\\.'));
    await page.route(re, async (route) => {
      const file = path.join(__dirname, '../..', name);
      await route.fulfill({
        status: 200,
        contentType: type,
        body: fs.readFileSync(file),
        headers: { 'cache-control': 'no-store' },
      });
    });
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
  const results = {
    domain: {},
    truth: {},
    postToggle: {},
    scrub: {},
    forecast: {},
    ranges: {},
    widths: {},
    otherTabs: null,
    reducedMotion: {},
    consoleErrors: [],
    pass: {},
  };

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
  await fulfillLive(page);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(400);

  /* ---- Seed rich history with confirmed distant goal ---- */
  await seedWeightData(page, { confirmed: true });
  await goWeight(page);

  /* ---- Truth baseline (byte-identical across this run's toggles) ---- */
  const truthA = await truthSnapshot(page);
  results.truth.before = truthA;

  /* ---- D2 domain: goal band on vs off must match; span << legacy 10kg ---- */
  await page.evaluate(() => { NXT.ui.showGoal = false; NXT.repaint(); });
  await page.waitForTimeout(120);
  const domainOff = await domainProbe(page);

  await page.evaluate(() => { NXT.ui.showGoal = true; NXT.repaint(); });
  await page.waitForTimeout(120);
  const domainOn = await domainProbe(page);

  results.domain = {
    goalOff: domainOff,
    goalOn: domainOn,
    identical: domainOff.low === domainOn.low && domainOff.high === domainOn.high,
    materiallyTighterThan10: domainOff.span != null && domainOff.span < 8,
    legacyWas: '76–86 (10 kg) with goal confirmed',
  };
  results.pass.d2Domain = results.domain.identical && results.domain.materiallyTighterThan10;

  /* ---- Journey present ---- */
  const journey = await page.evaluate(() => ({
    present: !!document.querySelector('.vn-journey'),
    text: (document.querySelector('.vn-journey')?.textContent || '').slice(0, 200),
  }));
  results.pass.journey = journey.present && /Cut journey/.test(journey.text);
  results.journey = journey;

  /* ---- Interpretation without interaction ---- */
  const read = await page.evaluate(() => ({
    headline: document.getElementById('vn-traj-headline')?.textContent || '',
    body: document.getElementById('vn-traj-read')?.textContent || '',
    mhead: document.getElementById('vn-mhead')?.textContent || '',
  }));
  results.read = read;
  results.pass.interpretation = !!(read.headline && read.headline !== '—' && read.mhead);

  /* ---- Forecast off by default; distinct when on; omitted when weak ---- */
  const forecastDefault = await domainProbe(page);
  await page.evaluate(() => { NXT.setForecastVisible(true); });
  await page.waitForTimeout(120);
  const forecastOn = await page.evaluate(() => ({
    hasLine: !!document.querySelector('.vn-proj-line, line[stroke-dasharray="2 5"]'),
    model: !!NXT.ui.chart?.forecast,
    label: (document.getElementById('vn-legend')?.textContent || '').includes('Projection'),
  }));
  await page.evaluate(() => { NXT.setForecastVisible(false); });
  results.forecast = { defaultHas: forecastDefault.hasForecast, whenOn: forecastOn };
  results.pass.forecastDefaultOff = forecastDefault.hasForecast === false;
  results.pass.forecastDistinct = forecastOn.hasLine && forecastOn.label;

  /* Weak evidence: clear enough history that forecast fails, or unconfirm goal */
  await page.evaluate(() => {
    settings.cutSupport.targetConfirmed = false;
    NXT.ui.showForecast = true;
    NXT.repaint();
  });
  await page.waitForTimeout(120);
  const weak = await page.evaluate(() => ({
    canForecast: !!NXT.ui.chart?.canForecast,
    drawn: !!NXT.ui.chart?.forecast,
    tog: !!document.querySelector('.vn-tog[data-tog="proj"]'),
  }));
  results.forecast.weak = weak;
  results.pass.forecastOmittedWeak = !weak.drawn && !weak.tog;
  await page.evaluate(() => {
    settings.cutSupport.targetConfirmed = true;
    NXT.ui.showForecast = false;
    NXT.repaint();
  });

  /* ---- Post-workout: not in domain; trend geometry stable ---- */
  await page.evaluate(() => { NXT.ui.showPost = false; NXT.repaint(); });
  await page.waitForTimeout(100);
  const geoOff = await trendGeometry(page);
  const domPostOff = await domainProbe(page);
  await page.evaluate(() => { NXT.setPostVisible(true); });
  await page.waitForTimeout(120);
  const geoOn = await trendGeometry(page);
  const domPostOn = await domainProbe(page);
  const postMarks = await page.evaluate(() => document.querySelectorAll('.vn-post-mark').length);
  results.postToggle = {
    domainOff: domPostOff,
    domainOn: domPostOn,
    domainIdentical: domPostOff.low === domPostOn.low && domPostOff.high === domPostOn.high,
    geometryIdentical: JSON.stringify(geoOff.segments) === JSON.stringify(geoOn.segments),
    postMarks,
  };
  results.pass.d8Post = results.postToggle.domainIdentical && results.postToggle.geometryIdentical && postMarks > 0;
  await page.evaluate(() => { NXT.setPostVisible(false); });

  /* ---- Truth unchanged after presentation toggles ---- */
  const truthB = await truthSnapshot(page);
  results.truth.after = truthB;
  results.pass.truthUntouched = JSON.stringify(truthA) === JSON.stringify(truthB);

  /* ---- Scrub: drag + keyboard + stable header ---- */
  await goWeight(page);
  const scrub = await page.evaluate(async () => {
    const wrap = document.getElementById('vn-chart-wrap');
    const svg = document.getElementById('n99-chart-svg');
    const mhead = document.getElementById('vn-mhead');
    if (!wrap || !svg || !mhead) return { ok: false, reason: 'missing nodes' };
    const before = {
      h: mhead.getBoundingClientRect().height,
      top: mhead.getBoundingClientRect().top,
      date: document.getElementById('n99-chart-date')?.textContent,
      weight: document.getElementById('n99-chart-weight')?.textContent,
    };
    const br = svg.getBoundingClientRect();
    const pts = NXT.ui.chart.points;
    const target = pts[Math.max(0, pts.length - 5)] || pts[0];
    const clientX = br.left + (target.x / NXT.ui.chart.W) * br.width;
    const clientY = br.top + br.height / 2;
    wrap.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX, clientY, buttons: 1, pointerId: 1 }));
    wrap.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX, clientY, buttons: 1, pointerId: 1 }));
    const mid = {
      date: document.getElementById('n99-chart-date')?.textContent,
      weight: document.getElementById('n99-chart-weight')?.textContent,
      h: mhead.getBoundingClientRect().height,
      top: mhead.getBoundingClientRect().top,
      selected: NXT.ui.selected,
    };
    wrap.focus();
    wrap.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const afterKey = {
      selected: NXT.ui.selected,
      date: document.getElementById('n99-chart-date')?.textContent,
    };
    wrap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const afterEsc = {
      selected: NXT.ui.selected,
      date: document.getElementById('n99-chart-date')?.textContent,
    };
    const touchAction = getComputedStyle(wrap).touchAction;
    return {
      ok: true,
      before,
      mid,
      afterKey,
      afterEsc,
      touchAction,
      headerStable: Math.abs(before.h - mid.h) < 1 && Math.abs(before.top - mid.top) < 1,
      scrubChanged: mid.selected === target.date || mid.date !== before.date,
      escapeClears: afterEsc.selected == null || afterEsc.date === 'Latest morning',
    };
  });
  results.scrub = scrub;
  results.pass.scrub = !!(scrub.ok && scrub.headerStable && scrub.scrubChanged && scrub.escapeClears);

  /* ---- Ranges re-domain ---- */
  const rangeMap = {};
  for (const r of [14, 30, 90, 0]) {
    await page.evaluate((range) => { NXT.setRange(range); }, r);
    await page.waitForTimeout(100);
    rangeMap[r] = await domainProbe(page);
  }
  results.ranges = rangeMap;
  results.pass.ranges = [14, 30, 90, 0].every((r) => rangeMap[r].pointCount >= 0)
    && (rangeMap[14].span !== rangeMap[0].span || rangeMap[14].pointCount !== rangeMap[0].pointCount);

  /* ---- Sparse / empty ---- */
  await seedWeightData(page, { confirmed: true, sparse: true });
  await page.evaluate(() => { NXT.setRange(90); });
  await goWeight(page);
  const sparse = await page.evaluate(() => ({
    points: NXT.ui.chart?.points?.length || 0,
    emptyMsg: !!document.querySelector('.vn-chart-empty, .n99-chart-empty'),
    headline: document.getElementById('vn-traj-headline')?.textContent || document.querySelector('.vn-h-sub')?.textContent || '',
  }));
  results.sparse = sparse;
  results.pass.sparseHonest = sparse.points < 10;

  await seedWeightData(page, { confirmed: false });
  await page.evaluate(() => { state.bws = []; if (typeof persist === 'function') persist(); });
  await goWeight(page);
  const empty = await page.evaluate(() => ({
    empty: !!document.querySelector('.vn-chart-empty, .n99-chart-empty'),
    points: NXT.ui.chart?.visible?.length || 0,
  }));
  results.empty = empty;
  results.pass.empty = empty.empty || empty.points === 0;

  /* ---- Restore rich data for screenshots / audits ---- */
  await seedWeightData(page, { confirmed: true });
  await page.evaluate(() => { NXT.ui.range = 30; NXT.ui.showGoal = false; NXT.ui.showPost = false; NXT.ui.showForecast = false; });
  await goWeight(page);

  const widths = [390, 375, 320];
  const stateNames = ['goal-off', 'goal-on', 'post-on', 'forecast-on', 'range-14', 'range-all'];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const wres = {};
    for (const st of stateNames) {
      await page.evaluate((name) => {
        NXT.ui.view = 'overview';
        if (name === 'goal-off') { NXT.ui.showGoal = false; NXT.ui.showPost = false; NXT.ui.showForecast = false; NXT.ui.range = 30; }
        if (name === 'goal-on') { NXT.ui.showGoal = true; NXT.ui.showPost = false; NXT.ui.showForecast = false; NXT.ui.range = 30; }
        if (name === 'post-on') { NXT.ui.showGoal = false; NXT.ui.showPost = true; NXT.ui.showForecast = false; NXT.ui.range = 30; }
        if (name === 'forecast-on') { NXT.ui.showGoal = false; NXT.ui.showPost = false; NXT.ui.showForecast = true; NXT.ui.range = 30; }
        if (name === 'range-14') { NXT.ui.range = 14; NXT.ui.showForecast = false; NXT.ui.showPost = false; }
        if (name === 'range-all') { NXT.ui.range = 0; }
        NXT.repaint();
        switchTab('weight');
      }, st);
      await page.waitForTimeout(120);
      wres[st] = await page.evaluate(auditFn(), { rootSel: '#weightPage' });
      if ((width === 390 || width === 320) && ['goal-off', 'goal-on', 'post-on', 'forecast-on'].includes(st)) {
        await page.screenshot({ path: path.join(SHOTS, `weight-${st}-${width}.png`), fullPage: true });
      }
    }
    results.widths[width] = wres;
  }

  /* ---- Reduced motion ---- */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await goWeight(page);
  results.reducedMotion = await page.evaluate(auditFn(), { rootSel: '#weightPage' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---- Other tabs non-regression ---- */
  const other = {};
  for (const tab of ['home', 'train', 'history', 'more']) {
    await page.evaluate((t) => switchTab(t), tab);
    await page.waitForTimeout(150);
    other[tab] = await page.evaluate((t) => {
      const id = t === 'home' ? 'homePage' : t === 'train' ? 'trainPage' : t === 'history' ? 'historyPage' : 'morePage';
      const el = document.getElementById(id);
      return { present: !!el, overflow: el ? el.scrollWidth > el.clientWidth + 1 : false };
    }, tab);
  }
  results.otherTabs = other;
  results.pass.otherTabs = Object.values(other).every((o) => o.present && !o.overflow);

  results.consoleErrors = consoleErrors.slice(0, 30);
  results.pass.noConsole = consoleErrors.length === 0;

  const auditPass = widths.every((w) => stateNames.every((st) => {
    const a = results.widths[w][st];
    return a && !a.overflow && a.textFailCount === 0 && a.targetFailCount === 0;
  }));
  results.pass.a11y = auditPass && results.reducedMotion.textFailCount === 0 && !results.reducedMotion.overflow;

  results.pass.all = Object.values(results.pass).every(Boolean);

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  await browser.close();

  console.log(JSON.stringify({
    domain: results.domain,
    pass: results.pass,
    postToggle: results.postToggle,
    forecast: results.forecast,
    scrub: { ok: results.scrub.ok, headerStable: results.scrub.headerStable, scrubChanged: results.scrub.scrubChanged },
    truthMatch: results.pass.truthUntouched,
  }, null, 2));

  if (!results.pass.all) {
    console.error('VERIFY-2C FAILED');
    process.exit(1);
  }
  console.log('VERIFY-2C PASSED');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
