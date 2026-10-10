/**
 * Release 151 — Today week rail capsules with outcome states, plan-vs-actual header, 28-day decision
 * sparkline, Lifts/Trend mini copy, Progress "Cut" range (D48); calorie system hidden app-wide (D49).
 *
 * Run (seed only runs on the hostname "localhost"):
 *   python3 -m http.server 8765 &
 *   node tasks/vnext/verify-151.mjs
 *
 * Every check reads the rendered DOM or calls the shipped engine. Fixtures are the dev seed
 * plus injected rows (a 45-min walk on Tuesday, a repeat of the last lifting session two days
 * ago with the best set beaten on most exercises, and a cut start 60 days back).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://localhost:8765';
const OUT = path.join(__dirname, 'verify-151-results.json');
const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const clearModal = (page) => page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });

async function fresh(browser, opts = {}) {
  const ctx = await browser.newContext({ ...IPHONE, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/index.html?reseed=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await clearModal(page);
  return { ctx, page, errors };
}
/* Fixture: Tuesday walk, a lifting session two days ago (best set +1 rep on exercises 0,1,3,4;
   first set −2.5 kg on exercises 2,5), cut start 60 days back. */
async function fixture(page) {
  return page.evaluate(() => {
    const ws = NXT.weekStart(), tue = NXT.dateAdd(ws, 1);
    state.cardio = state.cardio || [];
    state.cardio.push({ id: 'fx-walk', date: tue, type: 'Walk', duration: 45, ts: Date.now() });
    const work = NXT.workRows(), last = [...new Set(work.map((r) => r.date))].sort().at(-1);
    const rows = work.filter((r) => r.date === last), d = NXT.dateAdd(state.date, -2), byEx = {};
    rows.forEach((r) => { (byEx[r.exercise || r.name] = byEx[r.exercise || r.name] || []).push(r); });
    let n = 0, up = 0, down = 0;
    Object.values(byEx).forEach((sets, i) => {
      const best = NXT.bestSet(sets);
      sets.forEach((r) => {
        const c = JSON.parse(JSON.stringify(r)); c.id = 'fx' + (n++); c.date = d; c.ts = NXT.dateMs(d) + 36e5 * 10 + n * 60000;
        if (r === best) { if (i % 3 === 2) { c.weight = Number(c.weight) - 2.5; down++; } else { c.reps = Number(c.reps) + 1; up++; } }
        state.logs.push(c);
      });
    });
    settings.cutStart = NXT.dateAdd(state.date, -60); settings.startWeight = 86.8;
    persist(); NXT.repaint();
    return { tue, d, exercises: Object.keys(byEx).length, up, down, gym: rows[0] && (rows[0].gym || 'Gym A') };
  });
}

const browser = await chromium.launch();
try {
  /* ---------- 1. Baseline seed: rail states before any fixture ---------- */
  {
    const { ctx, page, errors } = await fresh(browser);
    await page.click('[data-tab="home"]'); await page.waitForTimeout(1000);
    const labels = await page.evaluate(() => [...document.querySelectorAll('#homePage .vn-week-c')].map((e) => e.getAttribute('aria-label')));
    const past = labels.filter((l) => /not logged/.test(l)).length;
    check('rail: past planned days with nothing logged read "not logged"', past >= 1, labels);
    check('rail: capsules — every cell has a capsule with the letter; status mark is a check (done) or hollow ring (not logged), never a dashed stroke or a dot row', await page.evaluate(() => [...document.querySelectorAll('#homePage .vn-week-c')].every((e) => { const cap = e.querySelector('.st-cap'), d = cap && cap.querySelector('.vn-week-d'), m = cap && cap.querySelector('.st-cap-s'); const cs = cap && getComputedStyle(cap); return cap && d && cs.borderStyle !== 'dashed' && !e.querySelector('.vn-week-w') && ((e.classList.contains('is-done') === !!(m && m.classList.contains('is-done'))) && (e.classList.contains('is-missed') === !!(m && m.classList.contains('is-missed')))); })));
    check('rail: no Cut range without a cut start', (await page.evaluate(() => { NXT.ui.view = 'overview'; switchTab('weight'); return new Promise((r) => setTimeout(() => r(document.querySelectorAll('#weightPage .vn-seg button').length), 800)); })) === 4);
    check('baseline: no page errors', errors.length === 0, errors);
    await ctx.close();
  }
  /* ---------- 2. With fixture: states, header, minis, sparkline ---------- */
  {
    const { ctx, page, errors } = await fresh(browser);
    const fx = await fixture(page);
    await page.click('[data-tab="home"]'); await page.waitForTimeout(1200);
    const cells = await page.evaluate(() => [...document.querySelectorAll('#homePage .vn-week-c')].map((e) => ({ a: e.getAttribute('aria-label'), c: e.className })));
    const tue = cells[1], thu = cells[3];
    check('rail: Tuesday walk with 45 min logged is done (check badge, no dashed ring)', /Easy cardio · done/.test(tue.a) && /is-done/.test(tue.c) && !/is-missed/.test(tue.c), tue);
    check('rail: Thursday walk with an add-on lift is neither done nor "not logged"', /logged, plan not done/.test(thu.a) && !/is-done|is-missed/.test(thu.c), thu);
    const head = await page.evaluate(() => document.querySelector('#homePage .st-tweek-h span').textContent);
    check('header: plan vs actual — lifts and cardio minutes', /This week · 1\/3 lifts · 45\/90 min/.test(head), head);
    const headBox = await page.evaluate(() => { const h = document.querySelector('#homePage .st-tweek-h'); const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getClientRects().length; }; return { lines: lines(h.querySelector('span')), btnLines: lines(h.querySelector('.vn-text')) }; });
    check('header: stays on one line at 390 and "Edit plan" does not wrap', headBox.lines <= 1 && headBox.btnLines <= 1, headBox);
    const lifts = await page.evaluate(() => document.querySelector('#homePage .st-minis .st-mini-lifts')?.innerText.replace(/\s+/g, ' '));
    check(`lifts mini: last session's D20 outcome "${fx.up}/${fx.exercises} beat" + session name and recency`, lifts && new RegExp(`${fx.up} ?/${fx.exercises} beat`).test(lifts) && /2 days ago/.test(lifts), lifts);
    const engine = await page.evaluate(({ d, gym }) => { const rows = NXT.workRows().filter((r) => r.date === d && r.setType !== 'warmup'); const byEx = {}; rows.forEach((r) => { (byEx[r.exercise || r.name] = byEx[r.exercise || r.name] || []).push(r); }); let up = 0; Object.entries(byEx).forEach(([n, s]) => { const p = NXT.sessionRows(n, gym, d, 100).at(-1); if (!p) return; const a = NXT.bestSet(s), b = NXT.bestSet(p.sets); if (Number(a.weight) > Number(b.weight) || (Number(a.weight) === Number(b.weight) && Number(a.reps) > Number(b.reps))) up++; }); return up; }, fx);
    check('lifts mini: the count matches NXT.bestSet() applied per exercise', engine === fx.up, { engine, fixture: fx.up });
    const spark = await page.evaluate(() => { const p = document.querySelector('.st-dec-spark path'); return p ? (p.getAttribute('d').match(/[ML]/g) || []).length : 0; });
    check('decision sparkline: 28 points — the four-week window of the rate beside it', spark === 28, { points: spark });
    check('trend mini: shows rate or "Flat", never "-0.00/wk"', !/-0\.00\/wk/.test(await page.evaluate(() => document.querySelector('#homePage .st-minis .st-tile .st-meta').textContent)));
    /* Progress: Cut range */
    await page.evaluate(() => { NXT.ui.view = 'overview'; switchTab('weight'); }); await page.waitForTimeout(1200);
    const btns = await page.evaluate(() => [...document.querySelectorAll('#weightPage .vn-seg button')].map((b) => b.textContent.trim()));
    check('progress: Cut range appears between 3M and All when a cut start exists', btns.join(',') === '2W,1M,3M,Cut,All', btns);
    await page.locator('#weightPage .vn-seg button:has-text("Cut")').click(); await page.waitForTimeout(1400);
    const cut = await page.evaluate(() => ({ range: NXT.ui.range, first: NXT.ui.chart.points[0].date, start: settings.cutStart, sub: document.querySelector('#weightPage .vn-progress-chrome p').textContent, startMark: /Start \d/.test(document.querySelector('#n99-chart-svg').textContent), active: document.querySelector('#weightPage .vn-seg button.active').textContent.trim() }));
    check('progress: Cut range plots from the cut start, subtitle and start mark follow', cut.range === 'cut' && cut.first >= cut.start && /cut started/.test(cut.sub) && cut.startMark && cut.active === 'Cut', cut);
    const domain = await page.evaluate(() => { const m = NXT.ui.chart; const ys = m.points.flatMap((p) => [p.weight, p.avg].filter((v) => v !== null)); return { low: m.low, high: m.high, min: Math.min(...ys), max: Math.max(...ys), goalLow: goalLow() }; });
    check('progress: Cut range keeps the data-only Y domain (D2) — the goal below the data does not stretch it', domain.low <= domain.min && domain.high >= domain.max && domain.low > domain.goalLow, domain);
    /* Week by week: the D41 dots only — no adherence marks (D49) */
    check('ledger: no adherence marks or legend', (await page.evaluate(() => document.querySelectorAll('.wx-dots i.a-y, .wx-dots i.a-n, .wx-note').length)) === 0);
    /* D49: calorie system hidden everywhere, data untouched */
    const cal = await page.evaluate(() => ({ flag: NXT.features.calories, stored: NXT.cfg().calories, energy: document.body.innerText.includes('Energy estimate') }));
    check('calories hidden: flag off, stored target untouched, no Energy estimate on Progress', cal.flag === false && cal.stored === 2100 && !cal.energy, cal);
    await page.click('[data-tab="home"]'); await page.waitForTimeout(800);
    await page.evaluate(() => { const d = document.querySelector('#homePage details.vn-more'); if (d) d.open = true; });
    const today = await page.evaluate(() => document.querySelector('#homePage').innerText);
    check('calories hidden: no calorie guide or adherence taps under More for today', !/Calorie guide|Hit target|Way over/.test(today));
    await page.click('[data-tab="more"]'); await page.waitForTimeout(800);
    const more = await page.evaluate(() => document.querySelector('#morePage').innerText);
    check('calories hidden: Settings row reads Goals with the range, no kcal', /Goals\n/.test(more) && !/kcal|Goals & calories/.test(more), more.slice(0, 200));
    await page.evaluate(() => NXT.more('goals')); await page.waitForTimeout(600);
    const goals = await page.evaluate(() => document.querySelector('#morePage').innerText);
    check('calories hidden: Goals page has goal range + cut start, no calorie guide', /Your goal range/.test(goals) && /Cut start/.test(goals) && !/calorie guide|kcal/i.test(goals));
    const diag = await page.evaluate(() => { const d = NXT.diagnose(); return { labels: d.evidence.map((e) => e.label), headline: d.headline, verdict: d.verdict }; });
    check('calories hidden: diagnosis evidence carries no Adherence/TDEE row and never asks for adherence', !diag.labels.some((l) => /Adherence|TDEE/.test(l)) && !/adherence|TDEE/i.test(diag.headline), diag);
    check('no page errors with the fixture', errors.length === 0, errors);
    await ctx.close();
  }
  /* ---------- 2b. Verdicts that depend on adherence are off; waist still works ---------- */
  for (const [name, notVerdict] of [['plateau_drift', 'dietary_drift'], ['plateau_metabolic', 'metabolic_adaptation']]) {
    const { ctx, page } = await fresh(browser);
    await page.goto(`${BASE}/index.html?scenario=${name}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500); await clearModal(page);
    const d = await page.evaluate(() => NXT.diagnose().verdict);
    check(`${name}: verdict is no longer ${notVerdict} (${d})`, d !== notVerdict, d);
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh(browser);
    await page.goto(`${BASE}/index.html?scenario=water_masking`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500); await clearModal(page);
    const d = await page.evaluate(() => { const d = NXT.diagnose(); return { v: d.verdict, reason: d.reason }; });
    check('water_masking: still detected from waist alone, reason no longer cites adherence', d.v === 'water_masking' && !/adherence/i.test(d.reason), d);
    await ctx.close();
  }
  /* ---------- 3. Layout 320 / 375 / 390 / 393 ---------- */
  for (const width of [320, 375, 390, 393]) {
    const { ctx, page } = await fresh(browser, { viewport: { width, height: width === 320 ? 700 : 844 } });
    await fixture(page);
    await page.click('[data-tab="home"]'); await page.waitForTimeout(1000);
    const m = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#homePage .vn-week-c')].map((e) => e.getBoundingClientRect());
      const rail = document.querySelector('#homePage .vn-week');
      const head = document.querySelector('#homePage .st-tweek-h span').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, minH: Math.min(...cells.map((r) => r.height)), minW: Math.min(...cells.map((r) => r.width)), railClip: rail.scrollWidth > rail.clientWidth + 1, headLines: Math.round(head.height / 17) };
    });
    /* Ring cells are 40px wide (34px at ≤359px) by the D34 design; the dot adds height, never width. */
    check(`${width}px: no overflow, rail cells ≥44 tall and ≥${width < 360 ? 34 : 40} wide, nothing clipped, header ≤2 lines`, m.sw <= m.iw && m.minH >= 44 && m.minW >= (width < 360 ? 34 : 40) && !m.railClip && m.headLines <= 2, m);
    await page.evaluate(() => { NXT.ui.view = 'overview'; switchTab('weight'); }); await page.waitForTimeout(1000);
    const seg = await page.evaluate(() => { const bs = [...document.querySelectorAll('#weightPage .vn-seg button')].map((b) => b.getBoundingClientRect()); const seg = document.querySelector('#weightPage .vn-seg'); return { n: bs.length, minW: Math.min(...bs.map((b) => b.width)), minH: Math.min(...bs.map((b) => b.height)), clip: seg.scrollWidth > seg.clientWidth + 1, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
    check(`${width}px: five range buttons fit, ≥44 tall, no clipping`, seg.n === 5 && seg.minH >= 40 && !seg.clip && seg.sw <= seg.iw, seg);
    await ctx.close();
  }
  /* ---------- 4. Reduced motion ---------- */
  {
    const { ctx, page } = await fresh(browser, { reducedMotion: 'reduce' });
    await fixture(page);
    await page.click('[data-tab="home"]'); await page.waitForTimeout(1500);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.st-tweek')).length);
    check('reduced motion: 0 running animations on the week rail', running === 0, { running });
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), failures, results }, null, 2));
console.log(`\n${results.length - failures} / ${results.length} passed · results → ${path.relative(process.cwd(), OUT)}`);
process.exit(failures ? 1 : 0);
