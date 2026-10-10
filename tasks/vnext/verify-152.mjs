/**
 * Release 152 — charts and Today (D50). Presentation only.
 *   Today: Decision trend chip as a 28-day mini chart; minis never truncate.
 *   Progress › Weight: range read (trend change, lowest morning, mornings weighed), caption folded,
 *     unit on the axis, dense ranges thin their dots.
 *   Progress › Performance: best set (D20) leads each row, status pill, no repeated status text.
 *   Progress › Body: composition-map zone relative to the first scan.
 *   Train (no lifting due): cardio meter + Up next preview from the saved routine.
 *   History: a morning weigh-in shows change vs the previous morning and its trend value.
 *
 * Run (the seed only runs on the hostname "localhost"):
 *   python3 -m http.server 8765 &
 *   node tasks/vnext/verify-152.mjs
 * Every expected value is read from the shipped engine (NXT.*), never recomputed here.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://localhost:8765';
const OUT = path.join(__dirname, 'verify-152-results.json');
const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function fresh(browser, opts = {}) {
  const ctx = await browser.newContext({ ...IPHONE, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/index.html?reseed=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
  /* A recent session (3 days ago) repeating the last logged one, so Performance and Today have
     fresh history; force today to a rest day so Train shows its idle view. */
  await page.evaluate(() => {
    const work = NXT.workRows(), last = [...new Set(work.map((r) => r.date))].sort().at(-1), d = NXT.dateAdd(state.date, -3);
    let n = 0; work.filter((r) => r.date === last).forEach((r) => { const c = JSON.parse(JSON.stringify(r)); c.id = 'v152-' + (n++); c.date = d; c.ts = NXT.dateMs(d) + 36e5 * 10 + n * 6e4; state.logs.push(c); });
    settings.dayOverrides = settings.dayOverrides || {}; settings.dayOverrides[state.date] = 'Rest';
    persist(); NXT.repaint();
  });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
  await page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
  return { ctx, page, errors };
}
const tab = async (page, t) => { await page.click(`[data-tab="${t}"]`); await page.waitForTimeout(1200); };

const browser = await chromium.launch();
try {
  {
    const { ctx, page, errors } = await fresh(browser);
    /* Today */
    await tab(page, 'home');
    const dec = await page.evaluate(() => {
      const svg = document.querySelector('#homePage .st-t-dec .st-dec-plot'), chip = svg && svg.closest('button');
      const from = NXT.dateAdd(state.date, -27), tr = NXT.trend(NXT.weights()).filter((p) => p.date >= from && p.date <= state.date && p.avg !== null);
      return { has: !!svg, raw: svg ? svg.querySelectorAll('.st-dec-raw').length : 0, morning: NXT.trend(NXT.weights()).filter((p) => p.date >= from && p.date <= state.date).length, range: chip?.querySelector('.st-dec-range')?.textContent, want: `${tr[0].avg.toFixed(1)} → ${tr.at(-1).avg.toFixed(1)} kg`, label: chip?.getAttribute('aria-label') };
    });
    check('Today: Decision trend chip draws a 28-day chart with one dot per morning reading', dec.has && dec.raw === dec.morning && dec.raw > 0, dec);
    check('Today: chart names the first and last trend value from N.trend()', dec.range === dec.want && /kilograms over 28 days/.test(dec.label), { got: dec.range, want: dec.want });
    const minis = await page.evaluate(() => [...document.querySelectorAll('#homePage .st-minis .st-meta')].map((e) => ({ t: e.textContent, clipped: e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis' })));
    check('Today: no mini tile text is ellipsised or clipped', minis.every((m) => !m.clipped), minis);
    /* Weight */
    await tab(page, 'weight'); await page.evaluate(() => NXT.setView('overview')); await page.waitForTimeout(1000);
    const rr = await page.evaluate(() => {
      const m = NXT.ui.chart, pts = m.points, tr = pts.filter((p) => p.avg !== null), low = pts.reduce((a, p) => (p.weight < a.weight ? p : a), pts[0]);
      const cells = [...document.querySelectorAll('#weightPage .st-rread > div b')].map((b) => b.textContent.replace(/\s+/g, ''));
      const ch = tr.at(-1).avg - tr[0].avg;
      return { cells, want: [(ch > 0 ? '+' : ch < 0 ? '−' : '') + Math.abs(ch).toFixed(1) + 'kg', low.weight.toFixed(1) + 'kg', pts.length + '/' + (Math.round((NXT.dateMs(pts.at(-1).date) - NXT.dateMs(pts[0].date)) / 864e5) + 1)] };
    });
    check('Weight: range read equals the plotted model (trend change, lowest morning, mornings weighed)', JSON.stringify(rr.cells) === JSON.stringify(rr.want), rr);
    check('Weight: chart caption is folded behind "How to read this chart"', await page.evaluate(() => { const d = document.querySelector('#weightPage .st-csum-d'); return !!d && !d.open && !!d.querySelector('#vn-csum'); }));
    check('Weight: the top axis tick carries the unit', await page.evaluate(() => [...document.querySelectorAll('#n99-chart-svg > text')].some((t) => / kg$/.test(t.textContent))));
    await page.evaluate(() => NXT.setRange(0)); await page.waitForTimeout(900);
    const dense = await page.evaluate(() => { const d = document.querySelectorAll('#n99-chart-svg .vn-raw-dot'); return { n: d.length, r: d[0]?.getAttribute('r') }; });
    check('Weight: a range over 90 readings thins its dots', dense.n <= 90 || dense.r === '1.7', dense);
    await page.evaluate(() => NXT.setRange(30));
    /* Performance */
    await page.evaluate(() => NXT.setView('strength')); await page.waitForTimeout(1000);
    const perf = await page.evaluate(() => {
      const items = NXT.strengthItems(), rows = [...document.querySelectorAll('#weightPage .st-perf')];
      return rows.slice(0, 6).map((r) => {
        const item = items.find((x) => x.name === r.querySelector('.vn-perf-name').textContent && x.gym === r.dataset.gym);
        const b = item && item.history.at(-1) && NXT.bestSet(item.history.at(-1).sets);
        return { name: item?.name, best: r.querySelector('.st-perf-best')?.textContent.replace(/\s+/g, ''), want: b ? `${Number(b.weight)}kg×${b.reps}` : null, pill: !!r.querySelector('.st-perf-pill'), dup: /Not enough yet|Too old to compare/.test(r.querySelector('.vn-perf-main').innerText) };
      });
    });
    check('Performance: each row leads with the D20 best set of its latest session', perf.length > 0 && perf.every((p) => p.best === p.want), perf);
    check('Performance: status is a pill; "Not enough yet" / "Too old" no longer repeat in rows', perf.every((p) => p.pill && !p.dup));
    const nameLines = await page.evaluate(() => [...document.querySelectorAll('#weightPage .st-perf .vn-perf-name')].map((h) => { const r = document.createRange(); r.selectNodeContents(h); return r.getClientRects().length; }));
    check('Performance: no lift name runs past two lines at 390', nameLines.every((n) => n <= 2), nameLines);
    /* Body */
    await page.evaluate(() => NXT.setView('body')); await page.waitForTimeout(1500);
    const cm = await page.evaluate(() => ({ zone: !!document.querySelector('.st-cmap .st-cm-zone'), refs: document.querySelectorAll('.st-cmap .st-cm-ref').length }));
    check('Body: composition map shades the less-fat/more-muscle region from the first scan, with reference lines', cm.zone && cm.refs === 2, cm);
    await page.evaluate(() => NXT.setView('overview'));
    /* Train idle */
    await tab(page, 'train');
    const tr = await page.evaluate(() => {
      let d = null, t = null; for (let i = 1; i <= 7; i++) { const dd = NXT.dateAdd(state.date, i), tt = NXT.typeFor(dd); if (!['Rest', 'Zone2', 'Floorball'].includes(tt)) { d = dd; t = tt; break; } }
      const list = NXT.templateFor(t, state.gym);
      return { rows: [...document.querySelectorAll('#trainPage .st-next-row .st-next-n')].map((e) => e.textContent), want: list.map((e) => e.name), meter: !!document.querySelector('#trainPage .st-cmeter[role="img"]') };
    });
    check('Train (rest day): Up next lists the next lifting routine in order', JSON.stringify(tr.rows) === JSON.stringify(tr.want) && tr.rows.length > 0, tr);
    check('Train (rest day): cardio meter has a text equivalent', tr.meter);
    /* History */
    await tab(page, 'history');
    const hw = await page.evaluate(() => {
      const t = NXT.trend(NXT.weights()).find((p) => p.date === state.historyDate);
      return { text: document.querySelector('#historyPage .st-hw')?.textContent || '', want: t && t.avg !== null ? t.avg.toFixed(2) : null };
    });
    check('History: a morning weigh-in shows the change vs the previous morning and its trend value', /kg vs/.test(hw.text) && hw.want && hw.text.includes(hw.want), hw);
    check('no page errors', errors.length === 0, errors);
    await ctx.close();
  }
  /* Layout */
  for (const width of [320, 375, 390, 393]) {
    const { ctx, page } = await fresh(browser, { viewport: { width, height: width === 320 ? 700 : 844 } });
    const out = {};
    for (const [t, view] of [['home'], ['train'], ['weight', 'overview'], ['weight', 'strength'], ['weight', 'body'], ['history']]) {
      await tab(page, t); if (view) { await page.evaluate((v) => NXT.setView(v), view); await page.waitForTimeout(900); }
      out[view || t] = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    }
    const plot = await page.evaluate(() => { NXT.setView('overview'); return true; });
    check(`${width}px: no horizontal overflow on Today, Train, Weight, Performance, Body, History`, Object.values(out).every(Boolean), out);
    await ctx.close();
  }
  /* Reduced motion */
  {
    const { ctx, page } = await fresh(browser, { reducedMotion: 'reduce' });
    await tab(page, 'home'); await page.waitForTimeout(1200);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.st-t-dec,.st-perf,.st-next,.st-rread')).length);
    check('reduced motion: 0 running animations on the new surfaces', running === 0, { running });
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), failures, results }, null, 2));
console.log(`\n${results.length - failures} / ${results.length} passed · results → ${path.relative(process.cwd(), OUT)}`);
process.exit(failures ? 1 : 0);
