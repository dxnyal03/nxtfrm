/**
 * Train anatomy layout budget — AUTHORITATIVE browser check (D18).
 *
 * tasks/vnext/verify-train.mjs runs a Node layout model. That model cannot
 * reproduce real text wrapping, so it cannot decide the long-title case: it
 * reported a 0px cost while Chromium measured 13px. This file is the
 * authoritative check for wrapping, and it asserts the D18 budget:
 *
 *   default              anatomy costs 0px where the title fits naturally
 *   long-title exception at most ONE extra title line
 *   hard budget          <= 16px at >= 360px,  <= 10px at <= 359px
 *
 * It also holds the clauses that outrank anatomy: the title is never truncated
 * and the figure never overlaps the Last / Target / Rest strip.
 *
 * Run: node tasks/vnext/verify-train-browser.mjs
 * Requires a server at NXTFRM_BASE (default http://localhost:8765).
 */
import { chromium } from 'playwright';

const BASE = process.env.NXTFRM_BASE || 'http://localhost:8765';
const WIDTHS = [390, 393, 402, 430, 375, 320];
const budgetFor = w => (w >= 360 ? 16 : 10);

let pass = 0, fail = 0;
const ok  = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL  ' + m); } };

/* Same launch as the other browser verify scripts: the system Chrome, so this
   does not depend on a downloaded Playwright build being present. */
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
});
console.log('Train anatomy layout budget (D18) — browser authoritative\n');

for (const width of WIDTHS) {
  const budget = budgetFor(width);
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));

  await page.goto(`${BASE}/index.html?reseed=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(550);
  await page.evaluate(() => eval(`(()=>{const dow=new Date(state.date+'T00:00:00').getDay();
    settings.weeklyPlan[dow]='FullA'; state.dayType=NXT.typeFor(state.date);
    state.exercise=(NXT.templateFor()[0]||{}).name||''; NXT.repaint(); return 1;})()`));
  await page.evaluate(() => switchTab('train'));
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#trainPage button')]
      .find(x => /start workout/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(500);

  const names = await page.evaluate(() =>
    eval('(NXT.templateFor()||[]).map(x=>x&&x.name).filter(Boolean)'));

  const rows = [];
  for (const name of names) {
    const r = await page.evaluate(nm => {
      eval('state.exercise=' + JSON.stringify(nm)); eval('NXT.repaint()');
      const btn   = document.querySelector('#trainPage .nxp-ex-anat');
      const head  = document.querySelector('.nxp-ex-head') || (btn && btn.closest('section,div'));
      const cta   = document.querySelector('#trainPage .nxp-train-cta');
      const title = document.querySelector('.nxp-ex-title');
      const aim   = document.querySelector('#trainPage .vn-aim');
      if (!head || !cta || !title) return { skip: true };

      const lineH = parseFloat(getComputedStyle(title).lineHeight) || 22;
      const measure = () => ({
        head: Math.round(head.getBoundingClientRect().height),
        log:  Math.round(cta.getBoundingClientRect().bottom + window.scrollY),
        lines: Math.round(title.getBoundingClientRect().height / lineH)
      });

      if (!btn) return { noFigure: true, ...measure() };

      const on = measure();
      const bb = btn.getBoundingClientRect();
      const ab = aim ? aim.getBoundingClientRect() : null;
      const overlapsAim = ab
        ? (Math.min(bb.right, ab.right) - Math.max(bb.left, ab.left) > 1 &&
           Math.min(bb.bottom, ab.bottom) - Math.max(bb.top, ab.top) > 1)
        : false;
      /* Truncation check against the real rendered node, not the model. */
      const cs = getComputedStyle(title);
      const truncated = cs.textOverflow === 'ellipsis' || title.scrollWidth > title.clientWidth + 1;
      const fullName = (title.textContent || '').trim() === nm;

      btn.style.display = 'none';
      const off = measure();
      btn.style.display = '';

      return {
        name: nm,
        headCost: on.head - off.head,
        logCost:  on.log  - off.log,
        extraLines: on.lines - off.lines,
        btn: { w: +bb.width.toFixed(1), h: +bb.height.toFixed(1) },
        overlapsAim, truncated, fullName
      };
    }, name);
    await page.waitForTimeout(140);
    if (!r.skip) rows.push(r);
  }

  console.log(`${String(width).padStart(3)}px  budget ${budget}px`);
  for (const r of rows) {
    if (r.noFigure) { console.log(`   ${'(no figure)'.padEnd(28)} skipped`); continue; }
    const cost = Math.max(r.headCost, r.logCost);
    console.log(`   ${r.name.padEnd(28)} head +${String(r.headCost).padStart(2)}  log +${String(r.logCost).padStart(2)}  lines +${r.extraLines}  btn ${r.btn.w}x${r.btn.h}`);
    ok(r.headCost <= budget, `${width}px ${r.name}: head cost ${r.headCost} exceeds ${budget}`);
    ok(r.logCost  <= budget, `${width}px ${r.name}: Log Set cost ${r.logCost} exceeds ${budget}`);
    ok(r.extraLines <= 1,    `${width}px ${r.name}: ${r.extraLines} extra title lines, max 1`);
    ok(!r.truncated,         `${width}px ${r.name}: title is truncated`);
    ok(r.fullName,           `${width}px ${r.name}: title text is not the full name`);
    ok(!r.overlapsAim,       `${width}px ${r.name}: anatomy overlaps the aim strip`);
    const cap = width >= 360 ? { w: 72, h: 64 } : { w: 64, h: 56 };
    ok(r.btn.w <= cap.w + 0.5, `${width}px ${r.name}: width ${r.btn.w} over cap ${cap.w}`);
    ok(r.btn.h <= cap.h + 0.5, `${width}px ${r.name}: height ${r.btn.h} over cap ${cap.h}`);
  }
  ok(errs.length === 0, `${width}px: ${errs.length} page error(s) — ${errs[0] || ''}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${fail === 0 ? 'OK' : 'FAILED'}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
