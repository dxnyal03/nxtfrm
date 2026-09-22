/**
 * VNext Phase 2E acceptance checks — Settings.
 * Run: node tasks/vnext/verify-2e.mjs
 * Requires: http server at NXTFRM_BASE (default http://127.0.0.1:8765)
 *
 * OWNERSHIP: this file is authored by Cursor and RUN BY CLAUDE. AGENTS.md §6
 * assigns browser, responsive, interaction and reduced-motion verification to
 * Claude; Cursor does not launch a browser. Everything here is deterministic
 * and re-runnable.
 *
 * TIER GATING (CURRENT_TASK.md §3.5). Settings spans three visual generations:
 *   Tier 1  hub · appearance · data      premium-ui.js — VNext, fully gated
 *   Tier 2  goals · training · coach     cut-support.js — chrome only, gated
 *                                        on chrome + capability, not on the
 *                                        V99 body's own visual metrics
 *   Tier 3  body · notifications · app   index.html V96 — preserved, deferred
 * Tier 3 contrast/target/overflow numbers are MEASURED AND REPORTED but do not
 * fail the run, because the markup that produces them is in a file this slice
 * is not permitted to edit. They are the deferred-deviation evidence.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://localhost:8765';
const SHOTS = path.join(__dirname, 'shots');
const OUT = path.join(__dirname, 'verify-2e-results.json');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWS = ['hub', 'goals', 'training', 'coach', 'appearance', 'data', 'body', 'notifications', 'app'];
const TIER = {
  hub: 1, appearance: 1, data: 1,
  goals: 2, training: 2, coach: 2,
  body: 3, notifications: 3, app: 3,
};

/* Every capability that the §3.1 inventory classifies KEEP, expressed as a
   DOM probe. This is the test that catches silent feature loss: if a row, a
   form or a button stops being reachable, the matching probe returns false. */
const CAPABILITIES = {
  hub: [
    ['account block', '.vn-set-account'],
    ['goals entry', '[onclick*="NXT.more(\'goals\')"]'],
    ['training entry', '[onclick*="NXT.more(\'training\')"]'],
    ['cardio & recovery entry', '[onclick*="NXT.more(\'coach\')"]'],
    ['appearance entry', '[onclick*="NXT.more(\'appearance\')"]'],
    ['reminders entry', '[onclick*="NXT.more(\'notifications\')"]'],
    ['body & scans entry', '[onclick*="NXT.more(\'body\')"]'],
    ['data & sync entry', '[onclick*="NXT.more(\'data\')"]'],
    ['app & install entry', '[onclick*="NXT.more(\'app\')"]'],
    ['wearable connection', '[onclick*="NXP.openWearableConnection()"]'],
  ],
  goals: [
    ['calorie guide', '.n99-calorie'],
    ['goal lower bound', '#n99-goal-low'],
    ['goal upper bound', '#n99-goal-high'],
    ['save goal range (BMI floor)', '[onsubmit*="NXT.saveGoal()"]'],
    ['weekly review', '[onclick*="NXT.openReview()"]'],
  ],
  training: [
    ['weekly plan editor', '#n99-day-0'],
    ['weekly plan editor · all seven days', '#n99-day-6'],
    ['save weekly plan (confirm + snapshot)', '[onsubmit*="NXT.saveWeek()"]'],
    ['gym switch', '[onclick*="cycleGym()"]'],
    ['saved workout Full A', '[onclick*="NXT.editTemplate(\'FullA\')"]'],
    ['saved workout Full B', '[onclick*="NXT.editTemplate(\'FullB\')"]'],
    ['saved workout Full C', '[onclick*="NXT.editTemplate(\'FullC\')"]'],
    ['other routine Push', '[onclick*="NXT.editTemplate(\'Push\')"]'],
    ['other routine Pull', '[onclick*="NXT.editTemplate(\'Pull\')"]'],
    ['other routine Pump', '[onclick*="NXT.editTemplate(\'Pump\')"]'],
    ['other routine Legs', '[onclick*="NXT.editTemplate(\'Legs\')"]'],
    ['programme default A/B/C', '[onclick*="NXT.restoreWeek(false)"]'],
    ['programme default previous', '[onclick*="NXT.restoreWeek(true)"]'],
  ],
  coach: [
    ['weekly cardio target', '#n99-card-goal'],
    ['save cardio target', '[onsubmit*="NXT.saveCardioGoal()"]'],
    ['recovery check-in', '[onclick*="apx96OpenReadiness()"]'],
    ['weekly review card', '.n99-review'],
  ],
  appearance: [
    ['text size control', '#nxp-text'],
    ['motion control', '#nxp-motion'],
    ['text size segment', '[onclick*="NXP.pickOption(\'nxp-text\'"]'],
    ['motion segment', '[onclick*="NXP.pickOption(\'nxp-motion\'"]'],
    ['save appearance', '[onsubmit*="NXP.saveAppearance()"]'],
  ],
  data: [
    ['supabase connection test', '#nxp-connection-test'],
    ['connection result region', '#nxp-connection-result'],
    ['project url', '#sbUrl'],
    ['project key', '#sbKey'],
    ['account email', '#sbEmail'],
    ['account password', '#sbPass'],
    ['cloud login', '[onclick*="cloudLogin()"]'],
    ['cloud signup', '[onclick*="cloudSignup()"]'],
    ['save cloud', '[onclick*="saveCloudNow(true)"]'],
    ['load cloud', '[onclick*="loadCloudNow()"]'],
    ['export app backup', '[onclick*="exportJSON()"]'],
    ['export workout CSV', '[onclick*="exportCSV()"]'],
    ['restore a backup', '[onclick*="exportFullBackup()"]'],
    ['import backup file', 'input[type="file"][onchange*="readImportFile"]'],
    ['safety copy export', '[onclick*="NXT.exportSafety()"]'],
    ['safety copy restore', '[onclick*="NXT.restoreSafety()"]'],
  ],
  body: [
    ['evo scan page', '#scanWeight, [onclick*="Scan"], .ocr-box'],
  ],
  notifications: [
    ['weigh-in reminder', '[onclick*="toggleNotif(\'weighIn\')"]'],
    ['zone 2 reminder', '[onclick*="toggleNotif(\'zone2\')"]'],
    ['backup reminder', '[onclick*="toggleNotif(\'backup\')"]'],
    ['weigh-in time', '[onchange*="updateNotifTime(\'weighInTime\'"]'],
    ['backup day', '[onchange*="updateNotifTime(\'backupDay\'"]'],
    ['request permission', '[onclick*="requestAppNotifications()"]'],
    ['test notification', '[onclick*="testAppNotification()"]'],
  ],
  app: [
    ['install instructions', '.card, .apx96-card'],
    ['danger zone', '.apx96-danger'],
    ['reset control', '[onclick*="NXT.resetData()"]'],
  ],
};

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

    const root = document.querySelector(rootSel) || document.getElementById('morePage') || document.body;
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
      if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY' && !el.closest('summary')) continue;
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
      if (el.type === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      /* The V96 reminder toggle keeps its 48x28 pill but carries a
         transparent ::after that extends the hit area to 44pt (vnext.css). */
      let h = r.height;
      let w = r.width;
      if (el.classList.contains('toggle')) {
        const after = getComputedStyle(el, '::after');
        if (after && after.content && after.content !== 'none') {
          const top = parseFloat(after.top) || 0;
          const bottom = parseFloat(after.bottom) || 0;
          const left = parseFloat(after.left) || 0;
          const right = parseFloat(after.right) || 0;
          h = h - top - bottom;
          w = w - left - right;
        }
      }
      if (w < 44 - 0.5 || h < 44 - 0.5) {
        targetFails.push({
          label: (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0, 40),
          w: Math.round(w * 10) / 10,
          h: Math.round(h * 10) / 10,
          cls: el.className?.toString?.().slice(0, 50) || '',
        });
      }
    });

    return {
      overflow,
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
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

async function goView(page, view) {
  await page.evaluate((v) => {
    if (state.tab !== 'more') switchTab('more');
    NXT.more(v);
  }, view);
  await page.waitForTimeout(140);
}

async function setSignedIn(page, on) {
  await page.evaluate((on) => {
    /* In-memory only. cloudUser is the same global the production UI reads;
       nothing is persisted and no Supabase call is made. */
    cloudUser = on ? { id: 'verify-2e-user', email: 'a.very.long.test.address@nxtfrm-example.co.uk' } : null;
  }, on);
}

async function snapshotStorage(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

function diffStorage(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed = [];
  keys.forEach((k) => {
    if (a[k] !== b[k]) changed.push(k);
  });
  return changed;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
  const results = {
    tiers: TIER,
    capabilities: {},
    renders: {},
    noCardPerRow: {},
    widths: {},
    labels: {},
    destructive: {},
    storage: {},
    reducedMotion: {},
    otherTabs: {},
    cloudCalm: {},
    rename: {},
    deferred: { tier3: {} },
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
  await page.goto(`${BASE}/index.html?reseed=1`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(500);

  /* ---- 0. Label rename, identifiers untouched (§3.8) ---- */
  results.rename = await page.evaluate(() => {
    const tab = document.querySelector('[data-tab="more"]');
    return {
      label: tab?.querySelector('.tab-label')?.textContent?.trim() || '',
      aria: tab?.getAttribute('aria-label') || '',
      dataTab: tab?.getAttribute('data-tab') || '',
      onclick: tab?.getAttribute('onclick') || '',
      iconPaths: tab?.querySelectorAll('svg circle, svg path').length || 0,
      pageId: !!document.getElementById('morePage'),
      hasMoreView: 'moreView' in state || state.moreView !== undefined,
      renderMoreIsNXP: typeof renderMore === 'function',
    };
  });
  results.pass.rename = results.rename.label === 'Settings'
    && results.rename.aria === 'Settings'
    && results.rename.dataTab === 'more'
    && results.rename.onclick.includes("switchTab('more')")
    && results.rename.pageId;

  /* ---- 1 + 2. Every subview renders, signed-in and local-only ---- */
  for (const signedIn of [false, true]) {
    const key = signedIn ? 'signedIn' : 'localOnly';
    await setSignedIn(page, signedIn);
    results.capabilities[key] = {};
    results.renders[key] = {};
    for (const view of VIEWS) {
      const errs = [];
      const onErr = (e) => errs.push(String(e));
      page.on('pageerror', onErr);
      await goView(page, view);
      page.off('pageerror', onErr);

      const probes = CAPABILITIES[view] || [];
      const found = await page.evaluate((sels) => sels.map(([name, sel]) => {
        let el = null;
        try { el = document.querySelector('#morePage ' + sel.split(',').map((s) => s.trim()).join(', #morePage ')); } catch (e) { el = null; }
        return [name, !!el];
      }), probes);

      results.renders[key][view] = await page.evaluate(() => {
        const p = document.getElementById('morePage');
        return {
          view: p?.getAttribute('data-vn-view') || '',
          nodes: p?.querySelectorAll('*').length || 0,
          text: (p?.textContent || '').trim().length,
          hasBack: !!p.querySelector('.vn-set-back, .vn-set-subhead .n99-button, .apx96-back, [onclick*="NXT.more(\'hub\')"], [onclick*="apx96SetMoreView(\'hub\')"]'),
        };
      });
      results.renders[key][view].errors = errs;
      results.capabilities[key][view] = Object.fromEntries(found);
    }
    /* Sign out is an account capability and must appear exactly when signed in. */
    await goView(page, 'hub');
    const signOutPresent = await page.evaluate(
      () => !!document.querySelector('#morePage [onclick*="cloudSignOut()"]'),
    );
    results.capabilities[key].hub['sign out matches session'] = signOutPresent === signedIn;
  }

  const missing = [];
  Object.entries(results.capabilities).forEach(([stateKey, views]) => {
    Object.entries(views).forEach(([view, probes]) => {
      Object.entries(probes).forEach(([name, ok]) => {
        if (!ok) missing.push(`${stateKey}/${view}/${name}`);
      });
    });
  });
  results.capabilities.missing = missing;
  results.pass.capabilities = missing.length === 0;

  const renderFails = [];
  Object.entries(results.renders).forEach(([stateKey, views]) => {
    Object.entries(views).forEach(([view, info]) => {
      if (info.errors.length || info.text < 40 || info.view !== view) {
        renderFails.push(`${stateKey}/${view}`);
      }
      if (view !== 'hub' && !info.hasBack) renderFails.push(`${stateKey}/${view}/no-back`);
    });
  });
  results.renders.fails = renderFails;
  results.pass.allViewsRender = renderFails.length === 0;

  await setSignedIn(page, false);

  /* ---- 3. No card-per-row on the hub ---- */
  await goView(page, 'hub');
  results.noCardPerRow = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#morePage .vn-set-row')];
    const surfaced = rows.filter((r) => {
      const cs = getComputedStyle(r);
      const bg = cs.backgroundColor;
      const opaque = bg && bg !== 'transparent' && !/rgba\(\d+,\s*\d+,\s*\d+,\s*0\)/.test(bg);
      const boxed = parseFloat(cs.borderRadius) > 0
        || parseFloat(cs.borderLeftWidth) > 0
        || parseFloat(cs.borderRightWidth) > 0
        || parseFloat(cs.borderBottomWidth) > 0
        || (cs.boxShadow && cs.boxShadow !== 'none');
      return opaque || boxed;
    }).map((r) => r.querySelector('.vn-set-t')?.textContent || '?');
    /* A group must be a label, not a container. */
    const groups = [...document.querySelectorAll('#morePage .vn-set-group')];
    const groupSurfaces = groups.filter((g) => {
      const cs = getComputedStyle(g);
      return parseFloat(cs.borderRadius) > 0 || (cs.boxShadow && cs.boxShadow !== 'none');
    }).length;
    /* D1: Settings hub claims no protagonist surface at all. */
    const raised = [...document.querySelectorAll('#morePage .n99-card, #morePage .vn-surface, #morePage .card, #morePage .apx96-card')].length;
    return {
      rowCount: rows.length,
      surfaced,
      groupCount: groups.length,
      groupSurfaces,
      raised,
      groupTitles: [...document.querySelectorAll('#morePage .vn-set-grp')].map((g) => g.textContent.trim()),
    };
  });
  results.pass.noCardPerRow = results.noCardPerRow.rowCount >= 9
    && results.noCardPerRow.surfaced.length === 0
    && results.noCardPerRow.groupSurfaces === 0
    && results.noCardPerRow.raised === 0;
  results.pass.informationArchitecture = JSON.stringify(results.noCardPerRow.groupTitles)
    === JSON.stringify(['Plan', 'Preferences', 'Body', 'Data', 'About']);

  /* ---- 4 + 5. Targets, contrast, overflow at 390 / 375 / 320 ---- */
  for (const width of [390, 375, 320]) {
    await page.setViewportSize({ width, height: 844 });
    results.widths[width] = {};
    for (const view of VIEWS) {
      await goView(page, view);
      const audit = await page.evaluate(auditFn(), { rootSel: '#morePage' });
      results.widths[width][view] = audit;
      if (TIER[view] === 3) {
        results.deferred.tier3[`${view}@${width}`] = {
          overflow: audit.overflow,
          textFailCount: audit.textFailCount,
          targetFailCount: audit.targetFailCount,
          textFails: audit.textFails.slice(0, 6),
          targetFails: audit.targetFails.slice(0, 6),
        };
      }
    }
    const gated = VIEWS.filter((v) => TIER[v] <= 2);
    results.pass[`a11y${width}`] = gated.every((v) => {
      const a = results.widths[width][v];
      return !a.overflow && a.textFailCount === 0 && a.targetFailCount === 0;
    });
    /* Overflow is gated on EVERY view including Tier 3: a legacy body may
       look dated, but it may not push the page sideways. */
    results.pass[`overflow${width}`] = VIEWS.every((v) => !results.widths[width][v].overflow);

    if (width === 390 || width === 320) {
      await goView(page, 'hub');
      await page.screenshot({ path: path.join(SHOTS, `settings-hub-${width}.png`), fullPage: true });
      await goView(page, 'appearance');
      await page.screenshot({ path: path.join(SHOTS, `settings-appearance-${width}.png`), fullPage: true });
      await goView(page, 'data');
      await page.screenshot({ path: path.join(SHOTS, `settings-data-${width}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });

  /* ---- 6. Persistent labels — never placeholder-as-label ---- */
  results.labels = {};
  for (const view of VIEWS) {
    await goView(page, view);
    results.labels[view] = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#morePage input, #morePage select, #morePage textarea').forEach((el) => {
        if (el.type === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const byFor = el.id ? document.querySelector(`#morePage label[for="${CSS.escape(el.id)}"]`) : null;
        const wrapping = el.closest('label');
        const aria = el.getAttribute('aria-label') || '';
        const labelledby = el.getAttribute('aria-labelledby');
        const byIds = labelledby ? labelledby.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean) : [];
        /* A sibling label that visually precedes the control also counts as a
           persistent label — the V96/V99 forms print .label spans this way. */
        const prev = el.previousElementSibling;
        const sibling = prev && prev.tagName === 'LABEL' ? prev : null;
        const named = !!(byFor || wrapping || aria || byIds.length || sibling);
        const text = (byFor || wrapping || sibling || byIds[0])?.textContent?.trim() || aria;
        if (!named) {
          bad.push({ id: el.id || '', type: el.type || el.tagName, placeholder: el.getAttribute('placeholder') || '', reason: 'no persistent label' });
          return;
        }
        if (!text && el.getAttribute('placeholder')) {
          bad.push({ id: el.id || '', type: el.type || el.tagName, placeholder: el.getAttribute('placeholder'), reason: 'placeholder is the only text' });
        }
      });
      const total = [...document.querySelectorAll('#morePage input, #morePage select, #morePage textarea')]
        .filter((el) => el.type !== 'hidden').length;
      return { total, bad };
    });
  }
  results.pass.labels = VIEWS.filter((v) => TIER[v] <= 2)
    .every((v) => results.labels[v].bad.length === 0);
  results.deferred.tier3.labels = Object.fromEntries(
    VIEWS.filter((v) => TIER[v] === 3).map((v) => [v, results.labels[v].bad]),
  );

  /* ---- 7. Destructive separation, and it still confirms ---- */
  await goView(page, 'app');
  results.destructive = await page.evaluate(() => {
    const zone = document.querySelector('#morePage .apx96-danger');
    const btn = document.querySelector('#morePage [onclick*="NXT.resetData()"]');
    const other = document.querySelector('#morePage .apx96-card:not(.apx96-danger)');
    const zs = zone ? getComputedStyle(zone) : null;
    const bs = btn ? getComputedStyle(btn) : null;
    const os = other ? getComputedStyle(other) : null;
    return {
      hasZone: !!zone,
      hasButton: !!btn,
      buttonInZone: !!(zone && btn && zone.contains(btn)),
      routedToGuardedReset: (btn?.getAttribute('onclick') || '').includes('NXT.resetData()'),
      inlineClearGone: !(document.getElementById('morePage').innerHTML || '').includes('localStorage.clear()'),
      resetConfirms: /confirm\(/.test(String(NXT.resetData)),
      resetSnapshots: /snapshot\(/.test(String(NXT.resetData)),
      zoneMark: zs?.boxShadow || '',
      zoneDistinct: !!(zs && os && (zs.boxShadow !== os.boxShadow || zs.borderColor !== os.borderColor)),
      buttonColour: bs?.color || '',
      buttonDistinct: !!(bs && os && bs.color !== getComputedStyle(document.querySelector('#morePage .btn:not(.danger)') || other).color),
    };
  });
  results.pass.destructive = results.destructive.hasZone
    && results.destructive.hasButton
    && results.destructive.buttonInZone
    && results.destructive.routedToGuardedReset
    && results.destructive.inlineClearGone
    && results.destructive.resetConfirms
    && results.destructive.resetSnapshots
    && results.destructive.zoneDistinct;

  /* ---- 8. Touring every subview writes nothing ------------------------
     Measured on a SECOND tour. The first tour is a warm-up because
     NXT.reviewCard() (cut-support.js, reached by the `coach` subview) appends
     one deduplicated audit row to cfg().suggestions and persists it. That is
     pre-existing engine behaviour in a file this slice may not edit; the
     dedup guard makes it idempotent, so the second tour must write nothing
     at all. Both tours are reported. */
  const beforeWarm = await snapshotStorage(page);
  for (const view of VIEWS) await goView(page, view);
  const afterWarm = await snapshotStorage(page);
  for (const view of VIEWS) await goView(page, view);
  const afterSecond = await snapshotStorage(page);
  await goView(page, 'hub');
  results.storage = {
    firstTourChanged: diffStorage(beforeWarm, afterWarm),
    secondTourChanged: diffStorage(afterWarm, afterSecond),
    moreViewPersisted: await page.evaluate(() => {
      const raw = localStorage.getItem('apm_settings') || '';
      return raw.includes('moreView');
    }),
  };
  results.pass.noStorageWrites = results.storage.secondTourChanged.length === 0
    && results.storage.moreViewPersisted === false;

  /* ---- 9. Reduced motion: no positional animation ---- */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goView(page, 'hub');
  results.reducedMotion = await page.evaluate(async () => {
    /* "No positional movement" is measured as: either no transform keyframe,
       or a transform keyframe whose duration is imperceptible (<=20ms). The
       shared reduced-motion path in premium-ui.css collapses every duration
       to .001ms rather than removing the keyframes, which is the behaviour
       2A shipped for all five destinations. */
    function moves(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const anims = el.getAnimations ? el.getAnimations() : [];
      const names = anims.map((a) => a.animationName || (a.effect && a.effect.getKeyframes && 'keyframes') || '');
      const transformed = anims.some((a) => {
        try {
          return (a.effect.getKeyframes() || []).some((k) => k.transform && k.transform !== 'none');
        } catch (e) { return false; }
      });
      const durMs = Math.max(0, ...cs.animationDuration.split(',').map((d) => parseFloat(d) * 1000 || 0));
      return {
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
        animationDurationMs: durMs,
        transitionDuration: cs.transitionDuration,
        transform: cs.transform,
        runningNames: names,
        hasTransformKeyframe: transformed,
        positional: transformed && durMs > 20,
      };
    }
    const out = { before: moves(document.getElementById('morePage')) };
    NXT.more('appearance');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    out.afterSubviewChange = moves(document.getElementById('morePage'));
    const seg = document.querySelector('#morePage .vn-seg-opt');
    out.segment = seg ? {
      transitionDuration: getComputedStyle(seg).transitionDuration,
    } : null;
    const act = document.querySelector('#morePage .vn-set-act');
    out.action = act ? { transitionDuration: getComputedStyle(act).transitionDuration } : null;
    NXT.more('hub');
    return out;
  });
  const rmStill = (m) => !m || !m.positional;
  const rmQuick = (d) => !d || d.split(',').every((x) => parseFloat(x) <= 0.02);
  results.pass.reducedMotion = rmStill(results.reducedMotion.afterSubviewChange)
    && rmQuick(results.reducedMotion.segment?.transitionDuration)
    && rmQuick(results.reducedMotion.action?.transitionDuration);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---- D11: cloud is calm when healthy, prominent when actionable ---- */
  results.cloudCalm = await page.evaluate(() => {
    const read = () => {
      NXT.more('hub');
      const row = [...document.querySelectorAll('#morePage .vn-set-row')]
        .find((r) => /Cloud & sync/.test(r.textContent || ''));
      const flag = row?.querySelector('.vn-set-flag');
      return {
        value: row?.querySelector('.vn-set-v')?.textContent?.trim() || '',
        flag: flag ? flag.className : '',
        dot: !!(flag && getComputedStyle(flag.querySelector('i') || flag, null).display !== 'none'
          && flag.querySelector('i') && getComputedStyle(flag.querySelector('i')).display !== 'none'),
      };
    };
    const savedUrl = localStorage.getItem('apm_sb_url');
    const savedKey = localStorage.getItem('apm_sb_key');
    const savedErr = lastCloudError;
    const savedUser = cloudUser;

    /* Healthy, signed in */
    cloudUser = { id: 'u', email: 'a@b.co' };
    lastCloudError = null;
    const healthy = read();

    /* A — sync failure */
    lastCloudError = new Error('verify-2e simulated');
    const failure = read();
    lastCloudError = savedErr;

    /* B — configured but signed out */
    cloudUser = null;
    localStorage.setItem('apm_sb_url', 'https://verify2e.supabase.co');
    localStorage.setItem('apm_sb_key', 'sb_publishable_verify2e');
    const signedOut = read();

    if (savedUrl === null) localStorage.removeItem('apm_sb_url'); else localStorage.setItem('apm_sb_url', savedUrl);
    if (savedKey === null) localStorage.removeItem('apm_sb_key'); else localStorage.setItem('apm_sb_key', savedKey);
    cloudUser = savedUser;
    lastCloudError = savedErr;
    NXT.more('hub');
    return { healthy, failure, signedOut };
  });
  results.pass.cloudCalm = !/is-watch|is-concern/.test(results.cloudCalm.healthy.flag)
    && /is-concern/.test(results.cloudCalm.failure.flag)
    && /is-watch/.test(results.cloudCalm.signedOut.flag);

  /* ---- readiness() preserved and not promoted (D4 / §3.7) ---- */
  results.readiness = await page.evaluate(() => {
    const seen = {};
    ['coach', 'hub', 'app', 'notifications', 'body'].forEach((v) => {
      NXT.more(v);
      seen[v] = /Readiness\s+\d/.test(document.getElementById('morePage').textContent || '');
    });
    NXT.more('hub');
    return { stillDefined: typeof readiness === 'function', scoreShownInSettings: seen };
  });
  results.pass.readiness = results.readiness.stillDefined
    && Object.values(results.readiness.scoreShownInSettings).every((v) => v === false);

  /* ---- 10. Non-regression: the other four destinations ---- */
  const otherTabs = {};
  for (const tab of ['home', 'train', 'weight', 'history', 'more']) {
    const errs = [];
    const onErr = (e) => errs.push(String(e));
    page.on('pageerror', onErr);
    await page.evaluate((t) => { switchTab(t); }, tab);
    await page.waitForTimeout(220);
    page.off('pageerror', onErr);
    const id = { home: 'homePage', train: 'trainPage', weight: 'weightPage', history: 'historyPage', more: 'morePage' }[tab];
    otherTabs[tab] = await page.evaluate((id) => {
      const el = document.getElementById(id);
      return {
        active: !!(el && el.classList.contains('active')),
        nodes: el ? el.querySelectorAll('*').length : 0,
        text: el ? (el.textContent || '').trim().length : 0,
      };
    }, id);
    otherTabs[tab].errors = errs;
  }
  results.otherTabs = otherTabs;
  results.pass.otherTabs = Object.values(otherTabs).every((t) => t.active && t.nodes > 10 && t.errors.length === 0);

  results.consoleErrors = consoleErrors.slice(0, 30);
  results.pass.noConsoleErrors = consoleErrors.length === 0;

  await browser.close();

  /* ---- All sixteen deterministic suites ---- */
  const { spawnSync } = await import('child_process');
  const root = path.join(__dirname, '../..');
  const suites = fs.readdirSync(root).filter((f) => /^wearables.*\.test\.js$/.test(f)).sort();
  results.suiteCount = suites.length;
  for (const suite of suites) {
    const r = spawnSync(process.execPath, [suite], { cwd: root, encoding: 'utf8', timeout: 300000 });
    const out = (r.stdout || '') + (r.stderr || '');
    const last = out.trim().split('\n').filter(Boolean).slice(-1)[0] || '';
    results.suites[suite] = { status: r.status, pass: r.status === 0, tail: last.slice(0, 200) };
  }
  results.pass.suites = suites.length === 16 && Object.values(results.suites).every((s) => s.pass);

  /* ---- Aggregate ---- */
  const required = [
    'rename', 'capabilities', 'allViewsRender', 'noCardPerRow', 'informationArchitecture',
    'a11y390', 'a11y375', 'a11y320', 'overflow390', 'overflow375', 'overflow320',
    'labels', 'destructive', 'noStorageWrites', 'reducedMotion', 'cloudCalm', 'readiness',
    'otherTabs', 'noConsoleErrors', 'suites',
  ];
  results.pass.all = required.every((k) => results.pass[k]);

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.pass, out: OUT }, null, 2));
  if (!results.pass.all) {
    const failed = required.filter((k) => !results.pass[k]);
    console.error('FAILED:', failed.join(', '));
    process.exit(1);
  }
  console.log('verify-2e: ALL PASS');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
