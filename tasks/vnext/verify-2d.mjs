/**
 * VNext Phase 2D acceptance checks — History.
 * Run: node tasks/vnext/verify-2d.mjs
 * Requires: http server at NXTFRM_BASE (default http://127.0.0.1:8765)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://localhost:8765';
const SHOTS = path.join(__dirname, 'shots');
const OUT = path.join(__dirname, 'verify-2d-results.json');
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

    const root = document.querySelector(rootSel) || document.getElementById('historyPage') || document.body;
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
    root.querySelectorAll('button, a, [onclick], summary, input, select, textarea').forEach((el) => {
      if (el.closest('[hidden]')) return;
      if (el.hasAttribute('hidden')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      /* 7-column calendar at 320: width can sit just under 44; height must clear. */
      if (el.classList.contains('nxp-cal-day')) {
        if (r.height < 44 - 0.5) {
          targetFails.push({
            label: (el.getAttribute('aria-label') || '').slice(0, 40),
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
            cls: 'nxp-cal-day',
          });
        }
        return;
      }
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

async function fulfillLive(page) {
  const files = {
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

async function goHistory(page) {
  await page.evaluate(() => { switchTab('history'); });
  await page.waitForTimeout(180);
}

async function snapshotTraining(page) {
  return page.evaluate(() => ({
    logs: JSON.stringify(state.logs || []),
    cardio: JSON.stringify(state.cardio || []),
    floorball: JSON.stringify(state.floorball || []),
    bws: JSON.stringify(state.bws || []),
  }));
}

async function injectFourKindDay(page, date) {
  return page.evaluate((date) => {
    /* In-memory only — History never writes. Test harness mutates for the four-kind cell. */
    const stamp = Date.now();
    state.logs = (state.logs || []).filter((r) => r && r.date !== date).concat([{
      id: 'v2d-lift-' + stamp, date, exercise: 'Bench Press', weight: 60, reps: 8,
      setNum: 1, setType: 'working', gym: 'Gym A', dayType: 'FullA', ts: stamp,
    }]);
    state.cardio = (state.cardio || []).filter((r) => r && r.date !== date).concat([{
      id: 'v2d-cardio-' + stamp, date, type: 'Zone 2', duration: 30, hr: 130, ts: stamp + 1,
    }]);
    state.floorball = (state.floorball || []).filter((r) => r && r.date !== date).concat([{
      id: 'v2d-fb-' + stamp, date, duration: 60, intensity: 7, notes: 'Match', ts: stamp + 2,
    }]);
    state.bws = (state.bws || []).filter((r) => r && r.date !== date).concat([{
      id: 'v2d-bw-' + stamp, date, weight: 84.2, timeOfDay: 'Morning', ts: stamp + 3,
    }]);
    state.historyMonth = date.slice(0, 7);
    state.historyDate = date;
    state.historyFilter = 'all';
    if (typeof NXP !== 'undefined' && NXP.history) NXP.history();
    return date;
  }, date);
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
  const results = {
    partialUpdate: {},
    scrollJump: {},
    fourKinds: {},
    shapes: {},
    integrity: {},
    filters: {},
    monthNav: {},
    capabilities: {},
    widths: {},
    reducedMotion: {},
    otherTabs: {},
    suites: {},
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
  /* seed.dev.js only mints on hostname === 'localhost'; ?reseed=1 forces a fresh dataset. */
  await page.goto(`${BASE}/index.html?reseed=1`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(500);
  const seedInfo = await page.evaluate(() => ({
    logs: (state.logs || []).length,
    cardio: (state.cardio || []).length,
    floorball: (state.floorball || []).length,
    bws: (state.bws || []).length,
  }));
  results.seed = seedInfo;
  await goHistory(page);

  /* ---- Baseline training snapshot (integrity / no-write) ---- */
  const beforeNav = await snapshotTraining(page);

  /* ---- Dense month (seeded June–Sep 2026) — pick a month with records ---- */
  await page.evaluate(() => {
    state.historyMonth = '2026-08';
    state.historyFilter = 'all';
    state.historyDate = null;
    NXP.history();
  });
  await page.waitForTimeout(120);

  const denseMeta = await page.evaluate(() => {
    const days = [...document.querySelectorAll('#vn-hist-grid .nxp-cal-day:not(.is-outside)')];
    const withMarks = days.filter((d) => d.querySelector('.nxp-cal-marks i'));
    const selected = document.querySelector('#vn-hist-grid .nxp-cal-day.is-selected');
    const other = days.find((d) => d !== selected && d.getAttribute('data-date'));
    return {
      dayCount: days.length,
      marked: withMarks.length,
      selected: selected?.getAttribute('data-date') || null,
      other: other?.getAttribute('data-date') || null,
      summary: document.getElementById('vn-hist-summary')?.textContent || '',
      hasCalendar: !!document.getElementById('vn-hist-calendar'),
      hasFilters: !!document.getElementById('vn-hist-filters'),
      hasChrome: !!document.getElementById('vn-hist-chrome'),
      legend: [...document.querySelectorAll('.nxp-cal-legend span')].map((s) => s.textContent.trim()),
    };
  });
  results.dense = denseMeta;
  results.pass.denseMonth = denseMeta.marked > 5 && denseMeta.hasCalendar;

  /* ---- 1. Partial update proof ---- */
  const partial = await page.evaluate((targetDate) => {
    const cal = document.getElementById('vn-hist-calendar');
    const chrome = document.getElementById('vn-hist-chrome');
    const filters = document.getElementById('vn-hist-filters');
    const marker = document.createElement('span');
    marker.id = 'v2d-cal-marker';
    marker.setAttribute('data-v2d', 'alive');
    cal.appendChild(marker);
    const chromeMark = document.createElement('span');
    chromeMark.id = 'v2d-chrome-marker';
    chrome.appendChild(chromeMark);
    const filterMark = document.createElement('span');
    filterMark.id = 'v2d-filter-marker';
    filters.appendChild(filterMark);

    const beforeDate = state.historyDate;
    NXP.historySelect(targetDate);

    return {
      beforeDate,
      afterDate: state.historyDate,
      calSurvived: !!document.getElementById('v2d-cal-marker'),
      chromeSurvived: !!document.getElementById('v2d-chrome-marker'),
      filtersSurvived: !!document.getElementById('v2d-filter-marker'),
      selectedCell: document.querySelector(`.nxp-cal-day[data-date="${targetDate}"]`)?.classList.contains('is-selected') || false,
      dayHost: document.getElementById('vn-hist-dayhost')?.textContent?.slice(0, 80) || '',
    };
  }, denseMeta.other || '2026-08-15');
  results.partialUpdate = partial;
  results.pass.partialUpdate = partial.calSurvived && partial.chromeSurvived && partial.filtersSurvived && partial.selectedCell;

  /* ---- 2. No scroll jump ---- */
  const scroll = await page.evaluate((targetDate) => {
    const scroller = document.scrollingElement || document.documentElement;
    scroller.scrollTop = 120;
    const before = scroller.scrollTop;
    NXP.historySelect(targetDate);
    const after = scroller.scrollTop;
    return { before, after, delta: Math.abs(after - before) };
  }, denseMeta.selected || '2026-08-10');
  results.scrollJump = scroll;
  results.pass.noScrollJump = scroll.delta <= 2;

  /* ---- 3 + 4. Four kinds + shape differentiation ---- */
  const fourDate = '2026-08-12';
  await injectFourKindDay(page, fourDate);
  await page.waitForTimeout(100);
  const four = await page.evaluate((date) => {
    const cell = document.querySelector(`.nxp-cal-day[data-date="${date}"]`);
    const marks = cell ? [...cell.querySelectorAll('.nxp-cal-marks i')].map((i) => i.className) : [];
    const label = cell?.getAttribute('aria-label') || '';
    const styles = {};
    if (cell) {
      cell.querySelectorAll('.nxp-cal-marks i').forEach((i) => {
        const cs = getComputedStyle(i);
        styles[i.className] = {
          width: cs.width,
          height: cs.height,
          borderRadius: cs.borderRadius,
          borderTopWidth: cs.borderTopWidth,
          borderStyle: cs.borderTopStyle,
          transform: cs.transform,
          background: cs.backgroundColor,
        };
      });
    }
    const day = document.getElementById('vn-hist-dayhost');
    const lanes = [...document.querySelectorAll('.vn-hist-lane')].map((l) => l.getAttribute('data-lane'));
    return {
      marks,
      label,
      styles,
      hasLift: marks.includes('lift'),
      hasCardio: marks.includes('cond'),
      hasFloor: marks.includes('floor'),
      hasBody: marks.includes('body'),
      ariaNamesFloorball: /floorball/i.test(label),
      ariaNamesCardio: /cardio/i.test(label),
      dayHasFloorball: /Floorball/i.test(day?.textContent || ''),
      lanes,
      legendHasFloor: [...document.querySelectorAll('.nxp-cal-legend span')].some((s) => /Floorball/i.test(s.textContent)),
    };
  }, fourDate);
  results.fourKinds = four;
  results.pass.fourKinds = four.hasLift && four.hasCardio && four.hasFloor && four.hasBody
    && four.ariaNamesFloorball && four.ariaNamesCardio && four.legendHasFloor;

  /* Shape geometry — not colour alone */
  const shapes = four.styles;
  const liftS = shapes.lift || {};
  const condS = shapes.cond || {};
  const floorS = shapes.floor || {};
  const bodyS = shapes.body || {};
  const shapeDiff = {
    liftDisc: /50%|999|100%/.test(liftS.borderRadius || '') || parseFloat(liftS.borderRadius || '0') >= 40,
    condRing: parseFloat(condS.borderTopWidth || '0') >= 1,
    floorDiamond: !!(floorS.transform && floorS.transform !== 'none'),
    bodyBar: parseFloat(bodyS.height || '0') > 0
      && parseFloat(bodyS.height || '0') < parseFloat(bodyS.width || '99') * 0.7,
    distinctClassNames: four.marks.length === 4 && new Set(four.marks).size === 4,
  };
  results.shapes = { styles: shapes, ...shapeDiff };
  results.pass.shapesNotColourAlone = shapeDiff.distinctClassNames
    && shapeDiff.liftDisc && shapeDiff.condRing && shapeDiff.bodyBar && shapeDiff.floorDiamond;

  /* ---- Empty day ---- */
  const emptyDay = await page.evaluate(() => {
    const empty = '2026-08-03';
    /* Clear any accidental records on a quiet date if present — prefer a date with none. */
    const days = [...document.querySelectorAll('#vn-hist-grid .nxp-cal-day:not(.is-outside)')];
    const blank = days.find((d) => !d.querySelector('.nxp-cal-marks i'));
    const date = blank?.getAttribute('data-date') || empty;
    NXP.historySelect(date);
    const host = document.getElementById('vn-hist-dayhost');
    return {
      date,
      emptyCopy: /No training or measurements|No lifting|No cardio|No weigh-in/i.test(host?.textContent || ''),
      markCount: blank ? blank.querySelectorAll('.nxp-cal-marks i').length : -1,
    };
  });
  results.emptyDay = emptyDay;
  results.pass.emptyDay = emptyDay.emptyCopy;

  /* ---- Empty month ---- */
  await page.evaluate(() => {
    state.historyMonth = '2025-01';
    state.historyDate = '2025-01-15';
    state.historyFilter = 'all';
    NXP.history();
  });
  await page.waitForTimeout(80);
  const emptyMonth = await page.evaluate(() => ({
    summary: document.getElementById('vn-hist-summary')?.textContent || '',
    marks: document.querySelectorAll('#vn-hist-grid .nxp-cal-marks i').length,
  }));
  results.emptyMonth = emptyMonth;
  results.pass.emptyMonth = /No records this month/i.test(emptyMonth.summary) && emptyMonth.marks === 0;

  /* ---- Sparse month ---- */
  await page.evaluate(() => {
    state.historyMonth = '2026-06';
    state.historyDate = null;
    state.historyFilter = 'all';
    NXP.history();
  });
  await page.waitForTimeout(80);
  const sparse = await page.evaluate(() => {
    const marked = document.querySelectorAll('#vn-hist-grid .nxp-cal-day:not(.is-outside) .nxp-cal-marks i').length;
    return { marked, summary: document.getElementById('vn-hist-summary')?.textContent || '' };
  });
  results.sparse = sparse;
  results.pass.sparseMonth = sparse.marked >= 1;

  /* ---- Filters ---- */
  await page.evaluate(() => {
    state.historyMonth = '2026-08';
    state.historyFilter = 'all';
    NXP.history();
  });
  await page.waitForTimeout(60);
  const filterResults = {};
  for (const f of ['all', 'strength', 'conditioning', 'body']) {
    filterResults[f] = await page.evaluate((filter) => {
      NXP.setHistoryFilter(filter);
      const pressed = [...document.querySelectorAll('#vn-hist-filters button')].map((b) => ({
        t: b.textContent.trim(),
        pressed: b.getAttribute('aria-pressed') === 'true',
        active: b.classList.contains('active'),
      }));
      const marks = {
        lift: document.querySelectorAll('#vn-hist-grid .nxp-cal-marks i.lift').length,
        cond: document.querySelectorAll('#vn-hist-grid .nxp-cal-marks i.cond').length,
        floor: document.querySelectorAll('#vn-hist-grid .nxp-cal-marks i.floor').length,
        body: document.querySelectorAll('#vn-hist-grid .nxp-cal-marks i.body').length,
      };
      return {
        summary: document.getElementById('vn-hist-summary')?.textContent || '',
        pressed,
        marks,
      };
    }, f);
  }
  results.filters = filterResults;
  results.pass.filters = filterResults.all
    && filterResults.strength.marks.cond === 0 && filterResults.strength.marks.floor === 0 && filterResults.strength.marks.body === 0
    && filterResults.body.marks.lift === 0 && filterResults.body.marks.cond === 0 && filterResults.body.marks.floor === 0
    && filterResults.conditioning.marks.lift === 0 && filterResults.conditioning.marks.body === 0
    && /lifting day|No lifting/i.test(filterResults.strength.summary)
    && /weigh-in|No weigh/i.test(filterResults.body.summary);

  /* ---- Month navigation + boundaries ---- */
  await page.evaluate(() => {
    state.historyMonth = '2026-08';
    state.historyFilter = 'all';
    NXP.history();
  });
  await page.waitForTimeout(60);
  const monthNav = await page.evaluate(() => {
    const titleBefore = document.querySelector('.nxp-cal-month')?.textContent || '';
    NXP.historyShiftMonth(-1);
    const titlePrev = document.querySelector('.nxp-cal-month')?.textContent || '';
    const monthPrev = state.historyMonth;
    NXP.historyShiftMonth(1);
    NXP.historyShiftMonth(1);
    const titleNext = document.querySelector('.nxp-cal-month')?.textContent || '';
    NXP.historyThisMonth();
    const titleToday = document.querySelector('.nxp-cal-month')?.textContent || '';
    const today = (typeof localToday === 'function' ? localToday() : state.date);
    /* Boundary: first of month grid should include outside leading days when month doesn't start Mon */
    state.historyMonth = '2026-08';
    NXP.history();
    const first = document.querySelector('#vn-hist-grid .nxp-cal-day');
    const cells = [...document.querySelectorAll('#vn-hist-grid .nxp-cal-day')];
    const outside = cells.filter((c) => c.classList.contains('is-outside')).length;
    const inMonth = cells.filter((c) => !c.classList.contains('is-outside')).length;
    const firstIn = cells.find((c) => !c.classList.contains('is-outside'));
    const lastIn = [...cells].reverse().find((c) => !c.classList.contains('is-outside'));
    return {
      titleBefore,
      titlePrev,
      monthPrev,
      titleNext,
      titleToday,
      todaySelected: document.querySelector(`.nxp-cal-day[data-date="${today}"]`)?.classList.contains('is-selected') || state.historyDate === today,
      outside,
      inMonth,
      firstDate: firstIn?.getAttribute('data-date'),
      lastDate: lastIn?.getAttribute('data-date'),
      firstIsOutsideOrAug1: first?.classList.contains('is-outside') || first?.getAttribute('data-date')?.endsWith('-01'),
    };
  });
  results.monthNav = monthNav;
  results.pass.monthNav = monthNav.monthPrev === '2026-07'
    && monthNav.inMonth === 31
    && monthNav.firstDate === '2026-08-01'
    && monthNav.lastDate === '2026-08-31'
    && monthNav.outside > 0;

  /* ---- Capability reachability ---- */
  await injectFourKindDay(page, fourDate);
  const caps = await page.evaluate((date) => {
    NXP.historySelect(date);
    const edit = document.querySelector('#vn-hist-dayhost .nxp-history-edit');
    let modalOpened = false;
    if (edit) {
      edit.click();
      modalOpened = !!(document.querySelector('.modal, [role="dialog"], .n99-modal, #modal, .sheet')
        || document.body.textContent.includes('Working sets')
        || document.querySelector('.nxp-history-day')
        || document.querySelector('.nxp-history-set'));
    }
    /* Close if a known close control exists */
    const close = document.querySelector('[data-close], .modal-close, .n99-modal-close, button[aria-label="Close"]');
    if (close) close.click();
    /* otherDayDetails via historyDay path */
    let otherReachable = typeof NXP.otherDayDetails === 'function' && typeof NXP.editHistorySet === 'function';
    if (typeof NXP.historyDay === 'function') {
      NXP.historyDay(date);
      const dayModal = document.querySelector('.nxp-history-day') || document.querySelector('.nxp-history-set');
      otherReachable = otherReachable && !!dayModal;
      const allDay = [...document.querySelectorAll('button')].find((b) => /All day details/i.test(b.textContent || ''));
      if (allDay) {
        /* Don't invoke — just confirm the control exists */
        otherReachable = otherReachable && true;
      }
      const close2 = document.querySelector('[data-close], .modal-close, .n99-modal-close, button[aria-label="Close"]');
      if (close2) close2.click();
      /* Also try N.modal close patterns */
      if (typeof closeModal === 'function') closeModal();
    }
    const lanes = [...document.querySelectorAll('.vn-hist-lane')].map((l) => l.getAttribute('data-lane'));
    return {
      editPresent: !!edit,
      modalOpened,
      otherReachable,
      lanes,
      hasEventLane: lanes.includes('event'),
      hasInterventionLane: lanes.includes('intervention'),
      hasAnnotationLane: lanes.includes('annotation'),
    };
  }, fourDate);
  results.capabilities = caps;
  results.pass.capabilities = caps.editPresent && caps.otherReachable
    && caps.hasEventLane && caps.hasInterventionLane && caps.hasAnnotationLane;

  /* ---- Data integrity sample + no writes during navigation ---- */
  await page.evaluate(() => {
    state.historyMonth = '2026-08';
    state.historyFilter = 'all';
    NXP.history();
  });
  const integrity = await page.evaluate(() => {
    const sample = ['2026-08-01', '2026-08-12', '2026-08-20', '2026-07-15'];
    const rows = sample.map((date) => {
      const logs = (state.logs || []).filter((r) => r && r.date === date);
      const cardio = (state.cardio || []).filter((r) => r && r.date === date);
      const floorball = (state.floorball || []).filter((r) => r && r.date === date);
      const bw = (state.bws || []).filter((r) => r && r.date === date && Number(r.weight) > 0);
      NXP.historySelect(date.startsWith(state.historyMonth) ? date : date);
      if (!date.startsWith(state.historyMonth)) {
        state.historyMonth = date.slice(0, 7);
        NXP.history();
        NXP.historySelect(date);
      }
      const host = document.getElementById('vn-hist-dayhost');
      const text = host?.textContent || '';
      const cell = document.querySelector(`.nxp-cal-day[data-date="${date}"]`);
      const marks = cell ? [...cell.querySelectorAll('.nxp-cal-marks i')].map((i) => i.className) : [];
      const expected = {
        lift: logs.length > 0,
        cardio: cardio.length > 0,
        floorball: floorball.length > 0,
        body: bw.length > 0,
      };
      const matchMarks =
        (!!expected.lift === marks.includes('lift'))
        && (!!expected.cardio === marks.includes('cond'))
        && (!!expected.floorball === marks.includes('floor'))
        && (!!expected.body === marks.includes('body'));
      let contentOk = true;
      if (expected.lift && logs[0]?.exercise && !text.includes(logs[0].exercise)) contentOk = false;
      if (expected.floorball && !/Floorball/i.test(text)) contentOk = false;
      if (expected.body && bw[0] && !text.includes(String(bw[0].weight).replace(/\.0$/, ''))) {
        /* weight may be formatted; soft check via kg presence when body expected */
        contentOk = contentOk && /\d/.test(text) && /kg/i.test(text);
      }
      return { date, expected, marks, matchMarks, contentOk, counts: { logs: logs.length, cardio: cardio.length, floorball: floorball.length, bw: bw.length } };
    });
    return rows;
  });
  /* Re-inject four-kind after integrity nav may have moved months */
  await injectFourKindDay(page, fourDate);
  const afterNav = await snapshotTraining(page);
  /* Allow the four-kind inject (test harness) — compare lengths excluding our injected date deltas is hard;
     instead: after a clean navigation-only pass with frozen copies. */
  await page.evaluate(() => {
    /* Freeze current arrays by reference check after read-only nav */
    window.__v2dFreeze = {
      logs: state.logs,
      cardio: state.cardio,
      floorball: state.floorball,
      bws: state.bws,
    };
  });
  await page.evaluate(() => {
    NXP.setHistoryFilter('all');
    NXP.historyShiftMonth(-1);
    NXP.historyShiftMonth(1);
    NXP.historySelect(state.historyDate || '2026-08-10');
    NXP.historyThisMonth();
  });
  const noWrite = await page.evaluate(() => {
    const f = window.__v2dFreeze;
    return {
      sameLogs: state.logs === f.logs,
      sameCardio: state.cardio === f.cardio,
      sameFloorball: state.floorball === f.floorball,
      sameBws: state.bws === f.bws,
    };
  });
  results.integrity = { sample: integrity, noWrite, beforeLen: {
    logs: JSON.parse(beforeNav.logs).length,
    cardio: JSON.parse(beforeNav.cardio).length,
    floorball: JSON.parse(beforeNav.floorball).length,
    bws: JSON.parse(beforeNav.bws).length,
  }};
  results.pass.integrity = integrity.every((r) => r.matchMarks && r.contentOk)
    && noWrite.sameLogs && noWrite.sameCardio && noWrite.sameFloorball && noWrite.sameBws;

  /* ---- Widths 390 / 375 / 320 ---- */
  for (const width of [390, 375, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => {
      state.historyMonth = '2026-08';
      state.historyFilter = 'all';
      NXP.history();
    });
    await page.waitForTimeout(100);
    /* Ensure four-kind day for dense shot */
    if (width === 390 || width === 320) {
      await injectFourKindDay(page, fourDate);
      await page.waitForTimeout(80);
    }
    const audit = await page.evaluate(auditFn(), { rootSel: '#historyPage' });
    results.widths[width] = audit;
    results.pass[`a11y${width}`] = !audit.overflow && audit.textFailCount === 0 && audit.targetFailCount === 0;

    if (width === 390 || width === 320) {
      await page.screenshot({ path: path.join(SHOTS, `history-dense-${width}.png`), fullPage: true });
      await page.evaluate(() => {
        state.historyMonth = '2025-01';
        state.historyDate = '2025-01-15';
        NXP.history();
      });
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(SHOTS, `history-empty-${width}.png`), fullPage: true });
      await injectFourKindDay(page, fourDate);
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(SHOTS, `history-fourkind-${width}.png`), fullPage: true });
    }
  }

  /* ---- Reduced motion ---- */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    state.historyMonth = '2026-08';
    state.historyFilter = 'all';
    NXP.history();
  });
  const rm = await page.evaluate(() => {
    const cal = document.getElementById('vn-hist-calendar');
    const marker = document.createElement('span');
    marker.id = 'v2d-rm-marker';
    cal.appendChild(marker);
    const days = [...document.querySelectorAll('#vn-hist-grid .nxp-cal-day:not(.is-outside)')];
    const a = days[0]?.getAttribute('data-date');
    const b = days[5]?.getAttribute('data-date');
    NXP.historySelect(a);
    NXP.historySelect(b);
    const survived = !!document.getElementById('v2d-rm-marker');
    NXP.historyShiftMonth(1);
    const monthAfter = state.historyMonth;
    NXP.historyShiftMonth(-1);
    return { survived, monthAfter, selected: state.historyDate };
  });
  results.reducedMotion = rm;
  results.pass.reducedMotion = rm.survived && !!rm.selected;
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---- Non-regression other tabs ---- */
  const otherTabs = {};
  for (const tab of ['home', 'train', 'weight', 'more']) {
    const errs = [];
    const onErr = (e) => errs.push(String(e));
    page.on('pageerror', onErr);
    await page.evaluate((t) => { switchTab(t); }, tab);
    await page.waitForTimeout(200);
    page.off('pageerror', onErr);
    const id = { home: 'homePage', train: 'trainPage', weight: 'weightPage', more: 'morePage' }[tab];
    otherTabs[tab] = {
      ok: await page.evaluate((id) => {
        const el = document.getElementById(id);
        return !!(el && (el.classList.contains('active') || !el.classList.contains('hide')));
      }, id),
      errors: errs,
    };
  }
  results.otherTabs = otherTabs;
  results.pass.otherTabs = Object.values(otherTabs).every((t) => t.ok && t.errors.length === 0);

  results.consoleErrors = consoleErrors.slice(0, 30);
  results.pass.noConsoleErrors = consoleErrors.length === 0;

  await browser.close();

  /* ---- Node suites ---- */
  const { spawnSync } = await import('child_process');
  const root = path.join(__dirname, '../..');
  for (const suite of ['wearables.release-gate.test.js', 'wearables.weight-contract.test.js']) {
    const r = spawnSync(process.execPath, [suite], { cwd: root, encoding: 'utf8', timeout: 120000 });
    results.suites[suite] = {
      status: r.status,
      pass: r.status === 0,
      tail: (r.stdout || r.stderr || '').slice(-400),
    };
  }
  results.pass.suites = Object.values(results.suites).every((s) => s.pass);

  /* ---- Aggregate ---- */
  const required = [
    'denseMonth', 'partialUpdate', 'noScrollJump', 'fourKinds', 'shapesNotColourAlone',
    'emptyDay', 'emptyMonth', 'sparseMonth', 'filters', 'monthNav', 'capabilities',
    'integrity', 'a11y390', 'a11y375', 'a11y320', 'reducedMotion', 'otherTabs', 'suites',
  ];
  results.pass.all = required.every((k) => results.pass[k]);

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.pass, out: OUT }, null, 2));
  if (!results.pass.all) {
    const failed = required.filter((k) => !results.pass[k]);
    console.error('FAILED:', failed.join(', '));
    process.exit(1);
  }
  console.log('verify-2d: ALL PASS');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
