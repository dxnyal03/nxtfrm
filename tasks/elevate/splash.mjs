// Renders the launch overlay's first frame (index.html, D65) at every iPhone size: flat #07060B, the N's
// faint track at the overlay's exact size and position. The greeting and wordmark are invisible on that
// frame but still take their space in the overlay's centred column, so they are laid out here too.
import { chromium } from '/Users/alidanial/Documents/NXTFRM/node_modules/playwright/index.mjs';
const OUT = '/Users/alidanial/Developer/Worktrees/nxtfrm/elevate/splash';
const SIZES = [[320,568,2],[375,667,2],[375,812,3],[390,844,3],[393,852,3],[402,874,3],[414,736,3],[414,896,2],[414,896,3],[420,912,3],[428,926,3],[430,932,3],[440,956,3]];
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;height:100%;background:#07060B}
.fg{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.mark{position:relative;overflow:visible;filter:drop-shadow(0 10px 18px rgba(124,77,255,.22));transform:scale(1.015)}
.track{fill:none;stroke-width:52;stroke-linecap:round;stroke-linejoin:round;stroke:rgba(177,138,255,.13)}
.hi{margin:0;font:600 23px/1.2 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;opacity:0}
.wm{font:600 11px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;letter-spacing:.32em;opacity:0}
</style></head><body><div class="fg"><svg class="mark" viewBox="96 84 320 340" width="112" height="119"><path class="track" d="M146 378V134L366 378V134"/></svg><p class="hi">Evening, Dan</p><div class="wm">NXTFRM</div></div></body></html>`;
const browser = await chromium.launch({ channel: 'chrome' });
for (const [w, h, d] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d });
  const page = await ctx.newPage(); await page.setContent(html); await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/${w * d}x${h * d}.png` }); await ctx.close();
}
await browser.close(); console.log('rendered', SIZES.length);
