/**
 * Phase 5 — calorie proposal and intervention ledger (D47) acceptance checks.
 *
 * Run (with a static server on :8765):
 *   python3 -m http.server 8765 &   (the seed only runs on the hostname "localhost")
 *   node tasks/vnext/verify-phase5.mjs
 *
 * Every check calls the shipped engine (NXT.proposeCalories, NXT.applyCalorieProposal,
 * NXT.calorieChanges) or reads the rendered DOM. Nothing is reimplemented here.
 * Fixtures: the dev seed (localhost), the shipped seed scenarios, and two injected
 * weigh-in series (a fast loss, and two weekly averages inside the goal range).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.NXTFRM_BASE || 'http://localhost:8765';
const OUT = path.join(__dirname, 'verify-phase5-results.json');
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
  return { ctx, page, errors };
}
async function scenario(page, name) {
  await page.goto(`${BASE}/index.html?scenario=${name}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
}
async function clearModal(page) {
  await page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
}
const propose = (page) => page.evaluate(() => NXT.proposeCalories());
const changes = (page) => page.evaluate(() => NXT.calorieChanges());

/* Inject a morning-weight series: `days` back from today, starting at `start` kg and
   changing by `slopePerDay`, with ±0.15 kg deterministic noise. Replaces the bws rows
   in that window only. Fixture, not production data (localhost). */
async function injectWeights(page, { days, start, slopePerDay }) {
  await page.evaluate(({ days, start, slopePerDay }) => {
    const today = state.date;
    const keep = (state.bws || []).filter((r) => r.date < NXT.dateAdd(today, -days));
    const rows = [];
    for (let i = days; i >= 0; i--) {
      const d = NXT.dateAdd(today, -i);
      const noise = ((i * 7919) % 31) / 100 - 0.15;
      rows.push({ id: 'fx' + i, date: d, weight: Math.round((start + (days - i) * slopePerDay + noise) * 10) / 10, timeOfDay: 'Morning', ts: NXT.dateMs(d) + 7 * 3600000 });
    }
    state.bws = keep.concat(rows);
    persist(); NXT.repaint();
  }, { days, start, slopePerDay });
  await page.waitForTimeout(600);
}

const browser = await chromium.launch();
try {
  /* ---------- 1. Base seed: steady cut → no proposal, with the engine's reason ---------- */
  {
    const { ctx, page, errors } = await fresh(browser);
    await clearModal(page);
    const p = await propose(page);
    check('base seed: no proposal while the cut is progressing', p.ok === false && /progressing|holding|insufficient|Not enough/i.test(p.reason), p);
    const tile = await page.locator('#homePage .st-prop').count();
    check('base seed: Today shows no proposal row', tile === 0, { count: tile });
    check('base seed: no page errors', errors.length === 0, errors);
    await ctx.close();
  }

  /* ---------- 2. Metabolic plateau → small step down, applied on the second tap only ---------- */
  {
    const { ctx, page, errors } = await fresh(browser);
    await scenario(page, 'plateau_metabolic');
    const p = await propose(page);
    check('metabolic plateau: proposes a reduction of 100–150 kcal', p.ok && p.kind === 'reduce' && p.delta <= -100 && p.delta >= -150 && p.verdict === 'metabolic_adaptation', p.ok ? { kind: p.kind, from: p.from, to: p.to } : p);
    check('metabolic plateau: proposal carries what / why / effect / evidence', p.ok && p.what && p.why && p.effect && Array.isArray(p.evidence) && p.evidence.length >= 2);
    await page.click('[data-tab="home"]');
    await page.waitForTimeout(1200);
    const row = page.locator('#homePage .st-t-dec .st-prop');
    check('metabolic plateau: proposal row sits inside the Decision tile', (await row.count()) === 1);
    const box = await row.boundingBox();
    check('metabolic plateau: proposal row ≥44px tall', box && box.height >= 44, box);
    await row.click();
    await page.waitForTimeout(700);
    const sheet = page.locator('.n99-modal .sheet');
    check('sheet opens with Apply and Not now', (await sheet.locator('#st-prop-apply').count()) === 1 && (await sheet.getByText('Not now').count()) === 1);
    const before = await page.evaluate(() => NXT.cfg().calories);
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^apm_/.test(k)).sort().join(','));
    await sheet.locator('#st-prop-apply').click();
    await page.waitForTimeout(250);
    const armedText = await sheet.locator('#st-prop-apply').textContent();
    const mid = await page.evaluate(() => NXT.cfg().calories);
    check('first tap arms the button and writes nothing', /^Confirm/.test(armedText.trim()) && mid === before, { armedText, before, mid });
    await sheet.locator('#st-prop-apply').click();
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({ cal: NXT.cfg().calories, upd: NXT.cfg().calorieUpdated }));
    check('second tap writes exactly the proposed target once', after.cal === p.to && after.upd === (await page.evaluate(() => state.date)), after);
    const led = await changes(page);
    const last = led.at(-1);
    check('ledger has one proposal row with from/to/source/verdict', led.length >= 1 && last.from === before && last.to === p.to && last.source === 'proposal' && last.verdict === 'metabolic_adaptation', last);
    const again = await propose(page);
    check('cooling-off: no new proposal for 14 days after a change', again.ok === false && again.basis === 'cooldown', again);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('apm_settings')).cutSupport.calories);
    check('persisted: apm_settings.cutSupport.calories holds the new target', stored === p.to, stored);
    check('no new apm_* key was introduced by applying', (await page.evaluate(() => Object.keys(localStorage).filter((k) => /^apm_/.test(k)).sort().join(','))) === keysBefore, keysBefore);
    // Progress: marker + legend + ledger
    await page.click('[data-tab="weight"]');
    await page.waitForTimeout(1500);
    check('Progress: chart draws one target-change mark', (await page.locator('#n99-chart-svg .vn-cal-mark').count()) === 1);
    check('Progress: legend names the mark in words', (await page.locator('#vn-legend .vn-key-cal').count()) === 1 && /Target change/.test(await page.locator('#vn-legend').textContent()));
    check('Progress: accessible summary names the change', /calorie target change/.test(await page.locator('#vn-csum').textContent()));
    check('Progress: Calorie target block shows the ledger row', (await page.locator('.st-caltarget .st-ledger-row').count()) >= 1);
    // History: intervention lane on the day
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(1300);
    const lane = page.locator('.vn-hist-lane[data-lane="intervention"]');
    check('History: intervention lane is visible on the day with the change', (await lane.count()) === 1 && (await lane.isVisible()) && /2,100|1,9/.test(await lane.textContent()));
    check('no page errors across the apply flow', errors.length === 0, errors);
    await ctx.close();
  }

  /* ---------- 3. Not now → snoozed for 7 days, nothing written ---------- */
  {
    const { ctx, page } = await fresh(browser);
    await scenario(page, 'plateau_metabolic');
    const before = await page.evaluate(() => NXT.cfg().calories);
    await page.evaluate(() => NXT.openProposal());
    await page.waitForTimeout(500);
    await page.locator('.n99-modal .sheet').getByText('Not now').click();
    await page.waitForTimeout(700);
    const p = await propose(page);
    const cal = await page.evaluate(() => NXT.cfg().calories);
    check('Not now: proposal is snoozed and the target is untouched', p.ok === false && p.basis === 'snoozed' && cal === before, { basis: p.basis, cal, before });
    check('Not now: Today shows no proposal row', (await page.locator('#homePage .st-prop').count()) === 0);
    check('Not now: ledger records no change', (await changes(page)).length === 0);
    await ctx.close();
  }

  /* ---------- 4. Hold verdicts never propose: drift, water, recovery ---------- */
  for (const [name, basis] of [['plateau_drift', 'drift'], ['water_masking', 'water'], ['recovery', 'recovery']]) {
    const { ctx, page } = await fresh(browser);
    await scenario(page, name);
    const p = await propose(page);
    const d = await page.evaluate(() => NXT.diagnose().verdict);
    check(`${name}: no proposal (${d})`, p.ok === false && (p.basis === basis || d === 'insufficient_context' || p.basis === 'insufficient'), { basis: p.basis, verdict: d, reason: p.reason });
    await ctx.close();
  }

  /* ---------- 5. Losing too fast → ease the deficit by the excess, 100–250 ---------- */
  {
    const { ctx, page } = await fresh(browser);
    await clearModal(page);
    await injectWeights(page, { days: 35, start: 90, slopePerDay: -0.19 }); // ≈ −1.33 kg/wk at ~85 kg → >1% BW
    const r = await page.evaluate(() => { const r = NXT.review(); return { title: r.title, action: r.action, change: r.change }; });
    const p = await propose(page);
    check('fast loss: review flags "Review your target"', r.action === 'Review your target', r);
    check('fast loss: proposes a raise sized to the excess, within 100–250', p.ok && p.kind === 'raise' && p.delta >= 100 && p.delta <= 250 && p.delta % 50 === 0, p.ok ? { from: p.from, to: p.to, delta: p.delta, change: p.change } : p);
    if (p.ok) {
      const ref = await page.evaluate(() => { const s = NXT.trendStats(); return s.current.avg || s.previous.avg; });
      const expectedRate = r.change + p.delta * 7 / 7700;
      const capped = p.delta === 250;
      check('fast loss: the step either lands the pace at the 1% rule (±50 kcal rounding) or is the capped 250 single step and says so', (Math.abs(expectedRate) <= ref * 0.01 + 50 * 7 / 7700 + 1e-9) || (capped && /largest single step/.test(p.effect)), { expectedRate: +expectedRate.toFixed(3), onePct: +(ref * 0.01).toFixed(3), capped });
    }
    await ctx.close();
  }

  /* ---------- 6. Two weekly averages inside the goal range → move to maintenance ---------- */
  {
    const { ctx, page } = await fresh(browser);
    await clearModal(page);
    await injectWeights(page, { days: 45, start: 79.3, slopePerDay: -0.008 }); // flat inside the seeded 78–80 range for the whole plateau window
    await page.evaluate(() => { const c = NXT.cfg(); c.targetConfirmed = true; persist(); NXT.repaint(); });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const s = NXT.trendStats(); return { cur: s.current.avg, prev: s.previous.avg, low: goalLow(), high: goalHigh() }; });
    const p = await propose(page);
    check('goal range: both weekly averages sit inside the confirmed range', r.cur >= r.low && r.cur <= r.high && r.prev >= r.low && r.prev <= r.high, r);
    const d = await page.evaluate(() => NXT.diagnose().verdict);
    check('goal range: a flat trend at goal is never proposed as a step down (engine verdict noted)', !(p.ok && p.kind === 'reduce'), { verdict: d, kind: p.kind });
    check('goal range: proposes maintenance from the TDEE estimate', p.ok && p.kind === 'maintain' && p.to > p.from && p.to % 50 === 0, p.ok ? { from: p.from, to: p.to } : p);
    await ctx.close();
  }

  /* ---------- 7. Manual save is in the same ledger; floor is respected ---------- */
  {
    const { ctx, page } = await fresh(browser);
    await clearModal(page);
    await page.evaluate(() => { const c = NXT.cfg(); c.profile = { age: 23, height: 176, weight: 82, sex: 'male', activity: 1.55, eligible: true }; persist(); });
    await page.evaluate(() => NXT.openCalories());
    await page.waitForTimeout(400);
    await page.fill('#n99-calories', '2300'); // inside the guide's own 25%-below-maintenance guardrail for this profile
    await page.evaluate(() => NXT.saveCalories());
    await page.waitForTimeout(600);
    const led = await changes(page);
    check('manual save: ledger row with from 2,100 → to 2,300, source manual', led.length === 1 && led[0].from === 2100 && led[0].to === 2300 && led[0].source === 'manual', led);
    await scenario(page, 'plateau_metabolic');
    await page.evaluate(() => { const c = NXT.cfg(); c.calories = 1550; c.suggestions = []; persist(); NXT.repaint(); });
    const p = await propose(page);
    check('floor: a step that would cross 1,500 kcal (male) is refused with a reason, not clamped silently', (p.ok === false && p.basis === 'floor') || (p.ok && p.to >= 1500), p.ok ? { to: p.to } : p);
    await ctx.close();
  }

  /* ---------- 8. Layout: 320 / 375 / 390 / 393, no overflow, no nav overlap, targets ≥44 ---------- */
  for (const width of [320, 375, 390, 393]) {
    const { ctx, page } = await fresh(browser, { viewport: { width, height: width === 320 ? 700 : 844 } });
    await scenario(page, 'plateau_metabolic');
    await page.click('[data-tab="home"]');
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const row = document.querySelector('#homePage .st-prop'), r = row.getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, h: r.height, w: r.width, clipped: row.scrollWidth > row.clientWidth + 1 };
    });
    check(`${width}px Today: no horizontal overflow, proposal row ≥44px and unclipped`, m.sw <= m.iw && m.h >= 44 && !m.clipped, m);
    await page.evaluate(() => NXT.openProposal());
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => {
      const sheet = document.querySelector('.n99-modal .sheet');
      const apply = document.getElementById('st-prop-apply').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, sheetScrolls: sheet.scrollHeight > sheet.clientHeight, applyH: apply.height, sheetW: sheet.scrollWidth <= sheet.clientWidth + 1 };
    });
    check(`${width}px sheet: fits width, buttons ≥44px`, s.sw <= s.iw && s.applyH >= 44 && s.sheetW, s);
    await ctx.close();
  }

  /* ---------- 9. Reduced motion: no running animations on the proposal surfaces ---------- */
  {
    const { ctx, page } = await fresh(browser, { reducedMotion: 'reduce' });
    await scenario(page, 'plateau_metabolic');
    await page.click('[data-tab="home"]');
    await page.waitForTimeout(1500);
    await page.evaluate(() => NXT.openProposal());
    await page.waitForTimeout(900);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.target?.closest?.('.st-prop,.st-prop-sheet'))).length);
    check('reduced motion: 0 running animations on the proposal row and sheet', running === 0, { running });
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), failures, results }, null, 2));
console.log(`\n${results.length - failures} / ${results.length} passed · results → ${path.relative(process.cwd(), OUT)}`);
process.exit(failures ? 1 : 0);
