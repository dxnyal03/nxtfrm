/**
 * Fold + banner check for 2B fix 1a/1b. Run with server on :8765.
 * node tasks/vnext/verify-2b-fold.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://127.0.0.1:8765';

async function fulfillLive(page) {
  await page.route(/premium-ui\.js/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: fs.readFileSync(path.join(__dirname, '../../premium-ui.js')),
      headers: { 'cache-control': 'no-store' },
    });
  });
  await page.route(/vnext\.css/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: fs.readFileSync(path.join(__dirname, '../../vnext.css')),
      headers: { 'cache-control': 'no-store' },
    });
  });
}

async function setup(page) {
  await page.evaluate(() => {
    settings.dayOverrides = settings.dayOverrides || {};
    settings.dayOverrides[state.date] = 'Push';
    state.dayType = 'Push';
    const key = typeof sessionKey === 'function' ? sessionKey() : null;
    if (key && NXT.cfg && NXT.cfg().sessions) delete NXT.cfg().sessions[key];
    const today = state.date;
    state.logs = (state.logs || []).filter((r) => r.date !== today);
    NXP.ui.trainActive = false;
    NXP.ui.drafts.clear();
    /* Force banner-worthy condition so we can prove suppression/restore. */
    try { localStorage.removeItem('nxtfrm_cloud_banner_dismissed'); } catch (e) {}
    if (typeof persist === 'function') persist();
    render();
  });
  await page.evaluate(() => NXP.enterTrain());
  await page.waitForTimeout(200);
}

async function measureFold(page, sets) {
  return page.evaluate(async (n) => {
    const today = state.date;
    const ex = state.exercise || template()[0]?.name;
    state.exercise = ex;
    state.logs = (state.logs || []).filter((r) => !(r.date === today && r.exercise === ex));
    for (let i = 0; i < n; i++) {
      state.logs.push({
        id: 'fold-' + i + '-' + Date.now(),
        date: today,
        dayType: state.dayType,
        gym: state.gym,
        exercise: ex,
        setNum: i + 1,
        weight: 60 + i,
        reps: 8,
        setType: 'working',
        rir: 2,
        volume: (60 + i) * 8,
        ts: Date.now() + i,
      });
    }
    if (n > 0 && typeof apx96StartRest === 'function') apx96StartRest(150);
    else if (typeof apx96SkipRest === 'function') apx96SkipRest();
    NXP.ui.trainActive = true;
    if (typeof persist === 'function') persist();
    render();
    await new Promise((r) => setTimeout(r, 80));
    const btn = document.getElementById('nxp-log-button');
    const banner = document.getElementById('cloudLocalBanner');
    const rest = document.querySelector('.vn-rest');
    const r = btn ? btn.getBoundingClientRect() : null;
    return {
      sets: n,
      bottom: r ? Math.round(r.bottom) : null,
      top: r ? Math.round(r.top) : null,
      vh: window.innerHeight,
      ok: r ? r.bottom <= window.innerHeight + 1 : false,
      bannerHidden: !banner || banner.hasAttribute('hidden') || getComputedStyle(banner).display === 'none',
      restActive: !!(rest && !rest.hasAttribute('hidden')),
      restH: rest && !rest.hasAttribute('hidden') ? Math.round(rest.getBoundingClientRect().height) : 0,
      historyRows: document.querySelectorAll('.vn-train-sets .nxp-set-row').length,
      navReceded: !!document.querySelector('.tabs.vn-recede'),
    };
  }, sets);
}

async function bannerMatrix(page) {
  return page.evaluate(() => {
    function visible() {
      const el = document.getElementById('cloudLocalBanner');
      if (!el) return false;
      if (el.hasAttribute('hidden')) return false;
      return getComputedStyle(el).display !== 'none';
    }
    const out = {};
    NXP.enterTrain();
    out.active = { visible: visible(), receded: !!document.querySelector('.tabs.vn-recede') };
    NXP.leaveTrain();
    if (typeof updateCloudLocalBanner === 'function') updateCloudLocalBanner();
    out.afterLeave = { visible: visible(), receded: !!document.querySelector('.tabs.vn-recede') };
    NXP.enterTrain();
    /* finish path */
    NXT.cfg().sessions[sessionKey()] = {
      date: state.date, gym: state.gym, type: state.dayType,
      finished: true, finishedAt: Date.now(), sets: 1,
    };
    NXP.ui.trainActive = false;
    persist();
    render();
    out.afterFinish = { visible: visible(), receded: !!document.querySelector('.tabs.vn-recede') };
    delete NXT.cfg().sessions[sessionKey()];
    persist();
    const tabs = ['home', 'weight', 'history', 'more', 'train'];
    out.tabs = {};
    for (const t of tabs) {
      switchTab(t);
      if (t === 'train') {
        NXP.ui.trainActive = false;
        render();
      }
      out.tabs[t] = { visible: visible(), receded: !!document.querySelector('.tabs.vn-recede') };
    }
    return out;
  });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
  const fold = {};
  for (const width of [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await fulfillLive(page);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(400);
    await setup(page);
    fold[width] = {};
    for (const n of [0, 1, 2]) {
      fold[width][n] = await measureFold(page, n);
    }
    if (width === 390) {
      fold.banner = await bannerMatrix(page);
    }
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(fold, null, 2));
  fs.writeFileSync(path.join(__dirname, 'verify-2b-fold-results.json'), JSON.stringify(fold, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
