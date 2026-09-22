/**
 * VNext Phase 2A acceptance checks.
 * Run: npx playwright@1.49.1 install chromium && node tasks/vnext/verify-2a.mjs
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, 'shots');
const OUT = path.join(__dirname, 'verify-2a-results.json');
fs.mkdirSync(SHOTS, { recursive: true });

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
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

async function forceDayType(page, type) {
  await page.evaluate((dayType) => {
    if (typeof resolveDayType === 'function') {
      /* Prefer override so resolveDayType / typeFor stay the source of truth. */
      settings.dayOverrides = settings.dayOverrides || {};
      settings.dayOverrides[state.date] = dayType;
      state.dayType = dayType;
      state.exercise = (typeof NXT !== 'undefined' && NXT.templateFor)
        ? (NXT.templateFor()[0]?.name || '')
        : state.exercise;
      if (typeof persist === 'function') persist();
      if (typeof render === 'function') render();
      else if (typeof NXP !== 'undefined' && NXP.home) NXP.home();
    }
  }, type);
  await page.waitForTimeout(120);
}

async function auditPage(page) {
  return page.evaluate(({ contrastFn }) => {
    /* contrast helpers inlined — evaluate cannot close over Node fns */
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
          if (a > 0.05 && !fgUnder) {
            /* composite later against ancestor */
            fgUnder = { rgb: p, a };
          }
        }
        n = n.parentElement;
      }
      const base = parseColor(getComputedStyle(document.getElementById('homePage') || document.body).backgroundColor)
        || [14, 16, 20];
      /* homePage uses a gradient; computed bg may be transparent — use canvas token */
      const canvas = [14, 16, 20];
      const bottom = (base[0] + base[1] + base[2] === 0) ? canvas : base;
      if (!fgUnder) return bottom;
      const { rgb, a } = fgUnder;
      return [
        Math.round(rgb[0] * a + bottom[0] * (1 - a)),
        Math.round(rgb[1] * a + bottom[1] * (1 - a)),
        Math.round(rgb[2] * a + bottom[2] * (1 - a)),
      ];
    }

    const home = document.getElementById('homePage');
    const overflow = home ? home.scrollWidth > home.clientWidth + 1 : true;
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

    const textFails = [];
    const walker = document.createTreeWalker(home || document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      const t = (text.textContent || '').trim();
      if (!t || t.length < 1) continue;
      const el = text.parentElement;
      if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.1) continue;
      const fg = parseColor(style.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) {
        textFails.push({
          text: t.slice(0, 48),
          ratio: Math.round(ratio * 100) / 100,
          color: style.color,
          bg: `rgb(${bg.join(',')})`,
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString?.().slice(0, 60) || '',
        });
      }
    }

    const targetFails = [];
    const interactives = home
      ? home.querySelectorAll('button, a, [onclick], summary, input, select, textarea')
      : [];
    interactives.forEach((el) => {
      if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY' && !el.closest('summary')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const w = r.width;
      const h = r.height;
      if (w < 44 - 0.5 || h < 44 - 0.5) {
        targetFails.push({
          label: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          w: Math.round(w * 10) / 10,
          h: Math.round(h * 10) / 10,
          cls: el.className?.toString?.().slice(0, 50) || '',
          tag: el.tagName.toLowerCase(),
        });
      }
    });

    return {
      overflow: overflow || docOverflow,
      scrollWidth: home?.scrollWidth,
      clientWidth: home?.clientWidth,
      textFails: textFails.slice(0, 25),
      textFailCount: textFails.length,
      targetFails: targetFails.slice(0, 25),
      targetFailCount: targetFails.length,
      hasVnToday: !!home?.querySelector('.vn-today'),
      hasDecision: !!home?.querySelector('.vn-surface.vn-focal'),
      hasPrimary: !!home?.querySelector('.vn-act'),
      dayType: typeof state !== 'undefined' ? state.dayType : null,
    };
  }, { contrastFn: true });
}

async function aboveFold(page) {
  return page.evaluate(() => {
    const decision = document.querySelector('#homePage .vn-surface.vn-focal');
    const cta = document.querySelector('#homePage .vn-act');
    const vh = 844;
    const dBottom = decision ? decision.getBoundingClientRect().bottom : null;
    const cBottom = cta ? cta.getBoundingClientRect().bottom : null;
    return {
      decisionAbove: dBottom !== null && dBottom <= vh,
      ctaAbove: cta ? cBottom <= vh : true, /* rest has no primary CTA */
      dBottom,
      cBottom,
    };
  });
}

async function entryPoints(page) {
  return page.evaluate(() => {
    const checks = {
      startWorkoutNow: typeof startWorkoutNow === 'function',
      showCardioSheet: typeof showCardioSheet === 'function',
      apx96OpenReadiness: typeof apx96OpenReadiness === 'function',
      showSessionSheet: typeof showSessionSheet === 'function',
      cycleGym: typeof cycleGym === 'function',
      apx95OpenQuickWeight: typeof apx95OpenQuickWeight === 'function',
      'NXT.openReview': typeof NXT?.openReview === 'function',
      'NXT.openCalories': typeof NXT?.openCalories === 'function',
      'NXT.more': typeof NXT?.more === 'function',
      'NXP.openRecovery': typeof NXP?.openRecovery === 'function',
      switchTab: typeof switchTab === 'function',
      'NXP.addOnPick': typeof NXP?.addOnPick === 'function',
    };
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    const home = document.getElementById('homePage');
    const html = home?.innerHTML || '';
    const wired = {
      openReview: html.includes('NXT.openReview'),
      cycleGym: html.includes('cycleGym()'),
      showSessionSheet: html.includes('showSessionSheet'),
      apx95OpenQuickWeight: html.includes('apx95OpenQuickWeight'),
      showCardioSheet: html.includes('showCardioSheet'),
      apx96OpenReadiness: html.includes('apx96OpenReadiness'),
      openCalories: html.includes('NXT.openCalories'),
      openRecovery: html.includes('NXP.openRecovery'),
      moreTraining: html.includes("NXT.more('training')"),
      addOnPick: html.includes('NXP.addOnPick'),
      startOrResume: /startWorkoutNow|switchTab\('train'\)/.test(html),
    };
    return { missing, wired, checks };
  });
}

async function otherTabs(page) {
  const tabs = ['train', 'weight', 'history', 'more'];
  const out = {};
  for (const tab of tabs) {
    const errors = [];
    const onErr = (msg) => errors.push(msg);
    page.on('pageerror', onErr);
    await page.evaluate((t) => switchTab(t), tab);
    await page.waitForTimeout(200);
    const ok = await page.evaluate((t) => {
      const id = { train: 'trainPage', weight: 'weightPage', history: 'historyPage', more: 'morePage' }[t];
      const el = document.getElementById(id);
      if (!el) return false;
      const shown = el.classList.contains('active') || getComputedStyle(el).display !== 'none';
      return shown && el.innerHTML.trim().length > 20;
    }, tab);
    page.off('pageerror', onErr);
    out[tab] = { ok, errors: errors.slice(0, 5) };
  }
  await page.evaluate(() => switchTab('home'));
  await page.waitForTimeout(150);
  return out;
}

async function reducedMotion(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => switchTab('train'));
  await page.waitForTimeout(100);
  await page.evaluate(() => switchTab('home'));
  await page.waitForTimeout(100);
  const anim = await page.evaluate(() => {
    const el = document.getElementById('homePage');
    const style = getComputedStyle(el);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      hasVn: !!el.querySelector('.vn-today'),
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return anim;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
  const results = { widths: {}, reducedMotion: null, otherTabs: null, entryPoints: null, consoleErrors: [] };
  const widths = [390, 375, 320];

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

    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('#homePage .vn-today, #homePage .nxp-home, #homePage .n99', { timeout: 30000 });
    await page.waitForTimeout(400);

    /* Lifting state */
    await forceDayType(page, 'Push');
    await page.waitForSelector('#homePage .vn-today', { timeout: 10000 });
    const liftAudit = await auditPage(page);
    const fold = width === 390 ? await aboveFold(page) : null;
    await page.screenshot({
      path: path.join(SHOTS, `today-lift-${width}.png`),
      fullPage: true,
    });

    /* Rest state */
    await forceDayType(page, 'Rest');
    await page.waitForSelector('#homePage .vn-today', { timeout: 10000 });
    const restAudit = await auditPage(page);
    await page.screenshot({
      path: path.join(SHOTS, `today-rest-${width}.png`),
      fullPage: true,
    });

    if (width === 390) {
      results.entryPoints = await entryPoints(page);
      results.otherTabs = await otherTabs(page);
      results.reducedMotion = await reducedMotion(page);
      /* restore lift for fold already captured */
    }

    results.widths[width] = {
      lift: { ...liftAudit, fold },
      rest: restAudit,
      consoleErrors,
    };
    results.consoleErrors.push(...consoleErrors);
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

  /* Summary */
  let failed = false;
  for (const w of widths) {
    for (const state of ['lift', 'rest']) {
      const a = results.widths[w][state];
      if (a.overflow) {
        console.log(`FAIL overflow @${w} ${state}`);
        failed = true;
      }
      if (a.textFailCount > 0) {
        console.log(`FAIL contrast @${w} ${state}: ${a.textFailCount}`, a.textFails.slice(0, 5));
        failed = true;
      }
      if (a.targetFailCount > 0) {
        console.log(`FAIL targets @${w} ${state}: ${a.targetFailCount}`, a.targetFails.slice(0, 5));
        failed = true;
      }
      if (!a.hasVnToday) {
        console.log(`FAIL missing .vn-today @${w} ${state}`);
        failed = true;
      }
    }
  }
  if (results.widths[390].lift.fold && !results.widths[390].lift.fold.decisionAbove) {
    console.log('FAIL decision not above fold @390');
    failed = true;
  }
  if (results.widths[390].lift.fold && !results.widths[390].lift.fold.ctaAbove) {
    console.log('FAIL CTA not above fold @390');
    failed = true;
  }
  console.log(JSON.stringify({
    ok: !failed,
    reducedMotion: results.reducedMotion,
    otherTabs: results.otherTabs,
    entryPoints: results.entryPoints,
    shots: fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png')),
  }, null, 2));
  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
