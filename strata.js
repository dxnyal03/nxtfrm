/* NXTFRM · Strata layer (D19). Motion and drawing only.
   Every number drawn here arrives from the page's markup, which premium-ui.js
   and cut-support.js read from the engine. This file computes no statistic,
   writes no record and changes no stored value. */
"use strict";
const STRATA = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const state0 = { lastTab: null, replay: null };
  const reduced = () => {
    try {
      if (document.documentElement.getAttribute("data-nxp-motion") === "reduced") return true;
      return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shortDate = d => (typeof NXT === "object" && NXT.shortDate) ? NXT.shortDate(d) : d;

  /* ---- Rolling digits ---------------------------------------------------- */
  function odoHTML(text) {
    return String(text).split("").map(ch => /\d/.test(ch)
      ? `<span class="st-od" data-d="${ch}"><span class="st-od-s">${"0123456789".split("").map(n => `<i>${n}</i>`).join("")}</span></span>`
      : `<span class="st-od-x">${esc(ch)}</span>`).join("");
  }
  function odoSet(el, text, animate) {
    if (!el) return;
    const t = String(text);
    el.setAttribute("aria-label", t);
    if (reduced()) { el.textContent = t; return; }
    const shape = t.replace(/\d/g, "0");
    if (el.dataset.shape !== shape || !el.querySelector(".st-od")) {
      el.innerHTML = odoHTML(t);
      el.dataset.shape = shape;
      const strips = el.querySelectorAll(".st-od-s");
      strips.forEach(s => { s.style.transition = "none"; s.style.transform = animate ? "translateY(0)" : `translateY(-${s.parentNode.dataset.d}0%)`; });
      if (animate) {
        void el.offsetWidth;
        strips.forEach((s, i) => {
          s.style.transition = "";
          s.style.transitionDelay = (i * 70) + "ms";
          s.style.transform = `translateY(-${s.parentNode.dataset.d}0%)`;
        });
      }
      return;
    }
    const digits = t.replace(/\D/g, "").split("");
    el.querySelectorAll(".st-od").forEach((od, i) => {
      od.dataset.d = digits[i];
      const s = od.firstChild;
      s.style.transitionDelay = "0ms";
      s.style.transform = `translateY(-${digits[i]}0%)`;
    });
  }

  /* ---- Count-up ---------------------------------------------------------- */
  function countUp(el) {
    const target = Number(el.dataset.stCount);
    if (!Number.isFinite(target) || reduced()) { el.textContent = String(target); return; }
    const t0 = performance.now(), dur = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(target * e));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  /* ---- Shared geometry ---------------------------------------------------- */
  function niceDomain(vals) {
    const lo0 = Math.min(...vals), hi0 = Math.max(...vals), span = Math.max(1, hi0 - lo0);
    const step = span <= 2 ? .5 : span <= 4 ? 1 : span <= 10 ? 2 : Math.ceil(span / 20) * 5;
    const lo = Math.floor((lo0 - step * .35) / step) * step, hi = Math.ceil((hi0 + step * .35) / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step / 10; v += step) ticks.push(v);
    return { lo, hi, step, ticks };
  }

  /* ---- Progress chart finish: gradient trend, week bands, end label and a
     tooltip that follows NXT.selectPoint (the engine's own readout). Adds
     marks only; the model, scale and data are untouched. ------------------- */
  function dressProgress(page) {
    const svg = page.querySelector("#n99-chart-svg"), m = typeof NXT === "object" && NXT.ui && NXT.ui.chart;
    if (!svg || !m || !m.points || !m.points.length || svg.__st) return;
    svg.__st = true;
    const defs = svg.querySelector("defs");
    if (defs) defs.insertAdjacentHTML("beforeend", `<linearGradient id="st-tg" x1="${m.left}" y1="0" x2="${m.W - m.right}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".55"/><stop offset=".55" stop-color="#B49AFF"/><stop offset="1" stop-color="#F3EEFF"/></linearGradient>`);
    svg.querySelectorAll(".vn-trend-line").forEach(l => l.setAttribute("stroke", "url(#st-tg)"));
    const seg = m.segments && m.segments[m.segments.length - 1], tail = seg && seg[seg.length - 1];
    if (tail && !m.forecast) {
      const txt = Number(tail.avg).toFixed(2), w = 14 + txt.length * 6.6, px = Math.min(m.W - m.right - w, tail.x - w / 2);
      svg.insertAdjacentHTML("beforeend", `<g class="st-pillg is-end"><rect x="${px.toFixed(1)}" y="${(tail.y - 30).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="10"/><text x="${(px + w / 2).toFixed(1)}" y="${(tail.y - 16).toFixed(1)}" text-anchor="middle">${txt}</text></g>`);
    }
    /* Labels are drawn in viewBox units, so a narrow phone shrinks them. Scale the small
       chart text back up to its intended size (capped) so 320px stays readable. */
    const rw = svg.getBoundingClientRect().width;
    if (rw > 0) svg.style.setProperty("--tsc", Math.min(1.4, Math.max(1, m.W / rw)).toFixed(3));
    /* Instrument layer. Same points, same scale. (1) A "Vs trend" strip under the plot:
       every morning reading as a bar above or below its own trend value, so daily noise
       reads separately from the trend. Own panel, own zero line: never a second axis on
       the plot. (2) A step per Mon-Sun week at that week's morning average (the figure in
       Week by week), so the plot and the list are one object. (3) A scanner column. */
    {
      const g = svg.querySelector("g[clip-path]"), base0 = m.H - m.bottom, DAY0 = 86400000;
      const sTop = base0 + 20, sBot = m.H - 30, mid = (sTop + sBot) / 2, half = (sBot - sTop) / 2;
      const dev = m.points.map((q, i) => ({ i, x: q.x, d: q.avg !== null && q.avg !== undefined ? Number(q.weight) - Number(q.avg) : null })).filter(q => q.d !== null);
      let strip = "";
      if (dev.length >= 4) {
        const mx = Math.max(.5, Math.ceil(Math.max(...dev.map(q => Math.abs(q.d))) * 2) / 2), kk = half / mx;
        strip += `<line class="st-dev-axis" x1="${m.left}" x2="${(m.futureDays ? m.todayX : m.W - m.right).toFixed(1)}" y1="${mid.toFixed(1)}" y2="${mid.toFixed(1)}"/>`;
        strip += `<text class="st-dev-t" x="${m.left + 2}" y="${(sTop - 6).toFixed(1)}">Each day vs its trend</text>`;
        strip += dev.map((q, n) => {
          const h = Math.max(2, Math.abs(q.d) * kk), up = q.d > 0;
          return `<rect class="st-dev ${up ? "is-up" : "is-dn"}" data-i="${q.i}" style="--i:${n}" x="${(q.x - 2.6).toFixed(1)}" y="${(up ? mid - h : mid).toFixed(1)}" width="5.2" height="${h.toFixed(1)}" rx="2.6"/>`;
        }).join("");
      }
      const cols = [];
      if (m.points.length > 1 && typeof NXT.windowStats === "function") {
        const rowsW = NXT.weights(), first = m.points[0].date, last = m.points[m.points.length - 1].date;
        let st = NXT.weekStart(first);
        for (let guard = 0; st <= last && guard < 20; guard++, st = NXT.dateAdd(st, 7)) {
          const en = NXT.dateAdd(st, 6), endUse = en > last ? last : en, from = st < first ? first : st;
          /* Same window as the Week by week row: the whole Mon-Sun week (to today for this week),
             even when the range starts mid-week, so the step and the list always agree. */
          const wEnd = en > state.date ? state.date : en, days = Math.round((NXT.dateMs(wEnd) - NXT.dateMs(st)) / DAY0) + 1, w = NXT.windowStats(rowsW, wEnd, days);
          if (!w || w.avg === null || w.avg === undefined || w.n < 3) continue;
          cols.push({ x1: Math.max(m.left, m.x(from)), x2: Math.min(m.W - m.right, m.x(endUse)), y: m.y(w.avg), avg: w.avg });
        }
      }
      const steps = cols.map(c => `<line class="st-wstep" x1="${c.x1.toFixed(1)}" x2="${c.x2.toFixed(1)}" y1="${c.y.toFixed(1)}" y2="${c.y.toFixed(1)}"/>`).join("");
      /* Projection end: the date the engine's horizon points to, on the mark itself. */
      const fe = m.forecast && (m.forecast.endpoint || { x: m.forecast.mid.x2, y: m.forecast.mid.y2 }), fr = m.forecastRead;
      if (fe && fr && fr.ok && fr.weeks > 0) {
        const txt = "Goal range · ~" + shortDate(NXT.dateAdd(state.date, fr.weeks * 7)), w = 18 + txt.length * 5.9, px = m.W - m.right - w - 2, py = m.top + 4;
        svg.insertAdjacentHTML("beforeend", `<g class="st-pillg is-goal"><rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="10"/><text x="${(px + w / 2).toFixed(1)}" y="${(py + 13.6).toFixed(1)}" text-anchor="middle">${txt}</text></g>`);
      }
      /* The projection starts from the fitted level (it leads the smoothed trend); a faint
         dotted bridge keeps the two from reading as a break in the line. */
      const tl = m.segments && m.segments.length ? m.segments[m.segments.length - 1].slice(-1)[0] : null;
      if (m.forecast && tl && m.anchor && Math.hypot(m.anchor.x - tl.x, m.anchor.y - tl.y) > 3 && g) {
        g.insertAdjacentHTML("beforeend", `<line class="st-bridge" x1="${tl.x.toFixed(1)}" y1="${tl.y.toFixed(1)}" x2="${m.anchor.x.toFixed(1)}" y2="${m.anchor.y.toFixed(1)}"/>`);
      }
      if (g) {
        g.insertAdjacentHTML("beforeend", steps);
        g.insertAdjacentHTML("beforebegin", `<rect id="st-scan" class="st-scan" x="0" y="${m.top}" width="30" height="${(sBot - m.top).toFixed(1)}" fill="url(#st-scan-g)" visibility="hidden"/>`);
        g.querySelectorAll(".vn-raw-dot").forEach((d, i) => d.style.setProperty("--i", i));
        const defs2 = svg.querySelector("defs");
        defs2 && defs2.insertAdjacentHTML("beforeend", `<linearGradient id="st-scan-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B49AFF" stop-opacity="0"/><stop offset=".5" stop-color="#B49AFF" stop-opacity=".16"/><stop offset="1" stop-color="#B49AFF" stop-opacity="0"/></linearGradient>`);
        g.insertAdjacentHTML("afterend", `<g class="st-devg" aria-hidden="true">${strip}</g>`);
        const lg = page.querySelector("#vn-legend");
        if (strip && lg && !lg.querySelector(".st-lg-dev")) lg.insertAdjacentHTML("beforeend", `<span class="st-lg-dev"><svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 8L4.5 1.5 8 8z" fill="none" stroke="#CDBBFF" stroke-width="1.3" stroke-linejoin="round"/></svg>Above trend</span><span class="st-lg-dev"><svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 1L4.5 7.5 8 1z" fill="#8B5CF6"/></svg>Below trend</span>`);
      }
    }
    /* Week bands (Mon–Sun, alternate weeks), the lowest morning reading tagged,
       and a stem from the selected reading to its trend. Marks only. */
    const clip = svg.querySelector("g[clip-path]"), base = m.H - m.bottom, DAY = 86400000;
    if (clip && m.points.length > 1) {
      const t0 = NXT.dateMs(m.points[0].date), t1 = NXT.dateMs(m.points[m.points.length - 1].date), span = t1 - t0;
      if (span > 0 && span <= 100 * DAY) {
        const xm = ms => m.points[0].x + (ms - t0) / span * (m.points[m.points.length - 1].x - m.points[0].x);
        let ms = NXT.dateMs(NXT.weekStart(m.points[0].date)), i = 0, out = "";
        for (; ms <= t1; ms += 7 * DAY, i++) {
          if (i % 2) continue;
          const a = Math.max(m.left, xm(ms)), b = Math.min(m.W - m.right, xm(ms + 7 * DAY));
          if (b > a) out += `<rect class="st-band" x="${a.toFixed(1)}" y="${m.top}" width="${(b - a).toFixed(1)}" height="${(base - m.top).toFixed(1)}"/>`;
        }
        clip.insertAdjacentHTML("afterbegin", out);
      }
      const low = m.points.reduce((b, p) => p.weight < b.weight ? p : b, m.points[0]);
      if (m.points.length >= 7 && low !== m.points[m.points.length - 1]) {
        const txt = "Low " + Number(low.weight).toFixed(1), w = 16 + txt.length * 6, px = Math.min(m.W - m.right - w, Math.max(m.left, low.x - w / 2));
        svg.insertAdjacentHTML("beforeend", `<g class="st-pillg is-low"><rect x="${px.toFixed(1)}" y="${(low.y + 10).toFixed(1)}" width="${w.toFixed(1)}" height="18" rx="9"/><text x="${(px + w / 2).toFixed(1)}" y="${(low.y + 22.5).toFixed(1)}" text-anchor="middle">${txt}</text></g>`);
      }
      if (clip) clip.insertAdjacentHTML("beforeend", `<line id="st-stem" class="st-stem" y1="0" y2="0" x1="0" x2="0" visibility="hidden"/>`);
    }
    const wrapEl = page.querySelector("#vn-chart-wrap");
    if (wrapEl && !wrapEl.querySelector(".st-tip")) { wrapEl.style.position = "relative"; wrapEl.insertAdjacentHTML("beforeend", `<div class="st-tip" hidden></div>`); }
  }
  /* ---- Week by week (D101) -----------------------------------------------------------------------------
     Every Monday-to-Sunday week of the cut, newest first. Each row leads with the change in morning average on
     the week before, drawn as a bar, but only between weeks with at least three mornings (the rule the chart's
     weekly steps use, D41), so the week in progress shows its mornings until it has three. Beside it: the
     average, the mornings weighed, and what happened that week from the records themselves: lifting days and
     cardio minutes (NXT.activityWeeks) and chart notes (D100); the fastest full week carries a star. Five weeks
     show and the rest fold behind "Show all". A row opens in place to its seven mornings against the week's
     average; "Show on chart" keeps the old jump. Every figure is the engine's own NXT.windowStats over
     NXT.weights(); nothing here is stored. */
  const WK = { open: new Set(), all: false, data: null };
  const WKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], WKLONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function weeksData() {
    const N = NXT, rows = N.weights().filter(r => r.date <= state.date), today = state.date;
    if (!rows.length) return null;
    const ws0 = N.weekStart(today), cs = typeof settings === "object" && settings && Number.isFinite(N.dateMs(settings.cutStart)) && settings.cutStart <= today ? settings.cutStart : null;
    const w0 = N.weekStart(cs || rows[0].date), weeks = [];
    for (let st = w0; st <= ws0 && weeks.length < 104; st = N.dateAdd(st, 7)) {
      const part = st === ws0, so = part ? Math.round((N.dateMs(today) - N.dateMs(st)) / 864e5) + 1 : 7;
      const w = N.windowStats(rows, part ? today : N.dateAdd(st, 6), so);
      weeks.push({ st, end: N.dateAdd(st, 6), avg: w.avg, n: w.n, part, so });
    }
    const pre = N.windowStats(rows, N.dateAdd(w0, -1), 7);
    weeks.forEach((w, i) => {
      const p = i ? weeks[i - 1] : { avg: pre.avg, n: pre.n };
      w.chg = w.n >= 3 && p.n >= 3 && w.avg !== null && p.avg !== null ? w.avg - p.avg : null;
    });
    const act = new Map((typeof N.activityWeeks === "function" ? N.activityWeeks(Math.min(104, weeks.length)) : []).map(x => [x.start, x]));
    const notes = typeof N.chartNotes === "function" ? N.chartNotes() : {};
    const byDate = new Map(rows.map(r => [r.date, Number(r.weight)]));
    const full = weeks.filter(w => !w.part && w.chg !== null);
    const best = full.length >= 2 ? full.reduce((m, w) => w.chg < m.chg ? w : m, full[0]) : null;
    return { weeks, act, notes, byDate, best: best && best.chg <= -.1 ? best.st : null, mx: Math.max(.5, ...weeks.map(w => Math.abs(w.chg || 0))) };
  }
  function weekRowHTML(D, w, k, hidden) {
    const N = NXT, a = D.act.get(w.st), dd = new Date(w.st + "T12:00:00");
    const name = w.part ? "This week" : shortDate(w.st), sub = w.part ? (w.n >= 3 ? "so far" : `${7 - w.so} ${7 - w.so === 1 ? "day" : "days"} to go`) : `${w.n} of 7`;
    const c = w.chg, open = WK.open.has(w.st), avg = w.avg === null ? "—" : w.avg.toFixed(1);
    const val = c === null ? `<b>${avg}</b><small>${w.avg === null ? "no mornings" : "kg" + (w.part ? " so far" : "")}</small>`
      : `<b>${Math.abs(c) < .05 ? "" : c < 0 ? "−" : "+"}${Math.abs(c).toFixed(1)}</b><small>${avg} kg</small>`;
    const mid = c !== null ? `<span class="wk-bar${c > 0 ? " is-up" : ""}" aria-hidden="true"><i style="--w:${(Math.abs(c) / D.mx).toFixed(3)}"></i></span>`
      : `<span class="wk-wait">${w.part ? `<b>${w.n === w.so ? w.n : w.n + " of " + w.so}</b> ${(w.n === w.so ? w.n : w.so) === 1 ? "morning" : "mornings"} so far. A change shows once 3 are in.` : w.avg === null ? "No mornings weighed this week." : "Fewer than 3 mornings: no change shown."}</span>`;
    const chips = [];
    if (D.best === w.st) chips.push('<span class="wk-c is-best">★ Fastest week</span>');
    if (a && a.liftDays) chips.push(`<span class="wk-c">${a.liftDays} ${a.liftDays === 1 ? "lift" : "lifts"}</span>`);
    if (a && a.cardioMin) chips.push(`<span class="wk-c">${a.cardioMin} min cardio</span>`);
    for (let i = 0; i < 7; i++) { const d = N.dateAdd(w.st, i), nt = D.notes[d]; if (nt) chips.push(`<span class="wk-c is-note"><i aria-hidden="true"></i>${esc(N.noteLabel(nt.kind))} · ${WKDAY[i]}</span>`); }
    const label = `${w.part ? "This week" : "Week of " + shortDate(w.st)}: ${w.avg === null ? "no mornings weighed" : `average ${avg} kilograms`}${c === null ? "" : `, ${Math.abs(c) < .05 ? "unchanged" : (c < 0 ? "down " : "up ") + Math.abs(c).toFixed(1)} on the week before`}, ${w.n} of ${w.so} mornings weighed`;
    return `<li class="wk-row${w.part ? " is-now" : ""}${open ? " is-open" : ""}${hidden ? " is-more" : ""}" data-a="${w.st}" data-b="${w.end}" style="--i:${k}">
      <button type="button" class="wk-head" aria-expanded="${open}" aria-controls="wk-p-${w.st}" aria-label="${esc(label)}"><span class="wk-d">${esc(name)}<small>${esc(sub)}</small></span>${mid}<span class="wk-v">${val}</span></button>
      ${chips.length ? `<div class="wk-ctx">${chips.join("")}</div>` : ""}
      <div class="wk-p" id="wk-p-${w.st}"${open ? "" : " hidden"}>${open ? weekPanelHTML(D, w) : ""}</div></li>`;
  }
  function weekPanelHTML(D, w) {
    const N = NXT, days = [];
    for (let i = 0; i < 7; i++) { const d = N.dateAdd(w.st, i); days.push({ i, d, v: D.byDate.has(d) ? D.byDate.get(d) : null, fut: d > state.date, note: D.notes[d] || null }); }
    const have = days.filter(x => x.v !== null);
    if (!have.length) return `<p class="wk-pe">No mornings weighed this week.</p>`;
    const avg = w.avg !== null ? w.avg : have.reduce((s, x) => s + x.v, 0) / have.length, dev = Math.max(.4, ...have.map(x => Math.abs(x.v - avg)));
    /* The average gets its own gutter at the left of its line, so no day's bar or value can ever cover it. */
    const Wd = 340, mid = 58, G = 44, slot = (Wd - G - 6) / 7, X = i => G + slot * i + slot / 2, H = v => Math.max(4, Math.abs(v - avg) / dev * 34);
    const bars = days.map(x => {
      const cx = X(x.i).toFixed(1);
      if (x.fut) return `<circle class="wk-fut" cx="${cx}" cy="${mid}" r="3"/>`;
      if (x.v === null) return `<circle class="wk-miss" cx="${cx}" cy="${mid}" r="7"/>`;
      const h = H(x.v), up = x.v >= avg, y = up ? mid - h : mid;
      return `<rect class="wk-day${up ? " is-up" : ""}" x="${(X(x.i) - 11).toFixed(1)}" y="${y.toFixed(1)}" width="22" height="${h.toFixed(1)}" rx="5" style="--k:${x.i}"/><text class="wk-dv" x="${cx}" y="${(up ? y - 6 : y + h + 14).toFixed(1)}" text-anchor="middle">${x.v.toFixed(1)}</text>`;
    }).join("");
    const labs = days.map(x => `<text class="wk-dl" x="${X(x.i).toFixed(1)}" y="124" text-anchor="middle">${WKDAY[x.i]}${x.note ? " ◆" : ""}</text>`).join("");
    const missed = days.filter(x => !x.fut && x.v === null).map(x => WKLONG[x.i]);
    const foot = w.part && days.some(x => x.fut) ? `${days.filter(x => x.fut).length} ${days.filter(x => x.fut).length === 1 ? "day" : "days"} to go` : missed.length === 0 ? "Every morning weighed" : missed.length === 1 ? `${missed[0]} not weighed` : missed.length === 2 ? `${missed[0]} and ${missed[1]} not weighed` : `${missed.length} mornings not weighed`;
    const sr = days.map(x => `${WKLONG[x.i]} ${x.fut ? "still to come" : x.v === null ? "not weighed" : x.v.toFixed(1) + " kilograms"}${x.note ? ", note: " + N.noteLabel(x.note.kind) + (x.note.text ? " " + x.note.text : "") : ""}`).join("; ");
    return `<svg class="wk-days" viewBox="0 0 ${Wd} 132" aria-hidden="true"><line class="wk-avg" x1="${G - 4}" x2="${Wd - 4}" y1="${mid}" y2="${mid}"/><text class="wk-al" x="0" y="${mid - 3}">avg</text><text class="wk-al is-v" x="0" y="${mid + 11}">${avg.toFixed(1)}</text>${bars}${labs}</svg>
      <p class="st-sr">${esc(sr)}.</p>
      <div class="wk-pf"><span>${esc(foot)}</span><button type="button" class="wk-go">Show on chart<span aria-hidden="true"> ›</span></button></div>`;
  }
  function weekShowOnChart(li) {
    const mm = NXT.ui.chart, sv = document.getElementById("n99-chart-svg"), host = li.closest(".st-weeks");
    if (!mm || !sv || !host) return;
    const a = li.dataset.a, b = li.dataset.b, inWk = mm.points.map((q, i) => ({ q, i })).filter(o => o.q.date >= a && o.q.date <= b);
    sv.querySelectorAll(".st-weeksel").forEach(e => e.remove());
    host.querySelectorAll(".wk-row.is-pick").forEach(e => e.classList.remove("is-pick"));
    if (!inWk.length) { toast("That week is outside this chart range. Choose Cut to see it."); return; }
    li.classList.add("is-pick");
    const x1 = Math.max(mm.left, inWk[0].q.x - 8), x2 = Math.min(mm.W - mm.right, inWk[inWk.length - 1].q.x + 8);
    const gp = sv.querySelector("g[clip-path]");
    gp && gp.insertAdjacentHTML("afterbegin", `<rect class="st-weeksel" x="${x1.toFixed(1)}" y="${mm.top}" width="${(x2 - x1).toFixed(1)}" height="${(mm.H - mm.bottom - mm.top).toFixed(1)}" rx="8"/>`);
    NXT.selectPoint(inWk[inWk.length - 1].i);
    const wrapEl = document.getElementById("vn-chart-wrap"); wrapEl && wrapEl.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
  }
  function dressWeeks(page, entering) {
    const m = typeof NXT === "object" && NXT.ui && NXT.ui.chart, anchor = page.querySelector(".vn-togs") || page.querySelector("#vn-chart-wrap");
    if (!m || !anchor || page.querySelector(".st-weeks") || typeof NXT.windowStats !== "function") return;
    const D = weeksData();
    if (!D || D.weeks.filter(w => w.avg !== null).length < 2) return;
    WK.data = D;
    const list = D.weeks.slice().reverse(), SHOW = 5;
    const host = document.createElement("section");
    host.className = "st-weeks wk" + (entering && !reduced() ? " is-draw" : "") + (WK.all ? " is-all" : "");
    host.setAttribute("aria-label", "Week by week: the change in morning average, Monday to Sunday");
    host.innerHTML = `<div class="wk-h"><h3>Week by week</h3><small>Mon–Sun morning average</small></div>
      <div class="wk-leg" aria-hidden="true"><span>Week</span><span>Weekly change</span><span>Average</span></div>
      <ol class="wk-l">${list.map((w, k) => weekRowHTML(D, w, k, k >= SHOW)).join("")}</ol>
      ${list.length > SHOW ? `<div class="wk-morerow"><button type="button" class="wk-more" aria-expanded="${WK.all}">${WK.all ? "Show fewer" : `Show all ${list.length} weeks`}</button></div>` : ""}`;
    anchor.insertAdjacentElement("afterend", host);
    host.addEventListener("click", e => {
      const more = e.target.closest(".wk-more");
      if (more) { WK.all = !WK.all; host.classList.toggle("is-all", WK.all); more.setAttribute("aria-expanded", String(WK.all)); more.textContent = WK.all ? "Show fewer" : `Show all ${list.length} weeks`; return; }
      const go = e.target.closest(".wk-go");
      if (go) { weekShowOnChart(go.closest(".wk-row")); return; }
      const head = e.target.closest(".wk-head");
      if (!head) return;
      const li = head.closest(".wk-row"), st = li.dataset.a, w = WK.data && WK.data.weeks.find(x => x.st === st), panel = li.querySelector(".wk-p");
      if (!w || !panel) return;
      const open = !li.classList.contains("is-open");
      li.classList.toggle("is-open", open); head.setAttribute("aria-expanded", String(open));
      if (open) { WK.open.add(st); if (!panel.innerHTML.trim()) panel.innerHTML = weekPanelHTML(WK.data, w); panel.hidden = false; haptic("tick"); }
      else { WK.open.delete(st); panel.hidden = true; }
    });
    weeksSync(m.points.length - 1);
  }
  function weeksSync(index) {
    const host = document.querySelector(".st-weeks"), m = NXT.ui && NXT.ui.chart, p = m && m.points && m.points[index];
    if (!host || !p) return;
    host.querySelectorAll(".wk-row").forEach(r => r.classList.toggle("is-on", p.date >= r.dataset.a && p.date <= r.dataset.b));
  }
  /* ---- Performance list: fold the long tail ------------------------------
     The engine's rows and order are untouched. When there is recent history the
     older-history rows tuck behind one button; when everything is old, only the
     first six show. Nothing is removed, and the button says how many are hidden. */
  /* Body tab: the latest scan and its composition stay open; the deeper sections fold
     behind their own headings and remember their state across re-renders. */
  const bodyOpen = { "What changed": true };
  function foldBody(page) {
    if (page.id !== "weightPage") return;
    page.querySelectorAll(".nxp-progress-body-section .vn-evo-sec").forEach(sec => {
      const h = sec.querySelector(":scope > h2");
      if (!h || !/^(Trend|What changed|Scan history)$/.test(h.textContent.trim()) || h.dataset.stFold) return;
      const name = h.textContent.trim();
      h.dataset.stFold = "1";
      h.setAttribute("role", "button"); h.tabIndex = 0;
      const set = open => { sec.classList.toggle("is-collapsed", !open); h.setAttribute("aria-expanded", open ? "true" : "false"); bodyOpen[name] = open; };
      set(!!bodyOpen[name]);
      const toggle = () => set(sec.classList.contains("is-collapsed"));
      h.addEventListener("click", toggle);
      h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
  }
  function foldPerf(page) {
    const list = page.querySelector(".vn-perf-rows");
    if (!list || list.parentNode.querySelector(".st-fold")) return;
    const rows = [...list.querySelectorAll(":scope > .vn-perf-row")];
    const older = rows.filter(r => r.dataset.status === "Older history"), recent = rows.length - older.length;
    const hide = recent > 0 ? (older.length > 3 ? older : []) : (rows.length > 6 ? rows.slice(6) : []);
    if (!hide.length) return;
    hide.forEach(r => r.classList.add("is-fold"));
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "st-fold"; btn.setAttribute("aria-expanded", "false");
    const label = recent > 0 ? `Show ${hide.length} older ${hide.length === 1 ? "lift" : "lifts"}` : `Show all ${rows.length} lifts`;
    btn.innerHTML = `<span>${label}</span><i aria-hidden="true">›</i>`;
    btn.onclick = () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      hide.forEach(r => r.classList.toggle("is-fold", open));
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      btn.firstChild.textContent = open ? label : "Show fewer";
    };
    list.insertAdjacentElement("afterend", btn);
  }
  function progressTip(index, opts) {
    const m = NXT.ui.chart, wrapEl = document.getElementById("vn-chart-wrap"), svg = document.getElementById("n99-chart-svg");
    const tip = wrapEl && wrapEl.querySelector(".st-tip");
    if (!tip || !m || !m.points || !svg) return;
    const p = m.points[index];
    if (!p || (opts && opts.clear) || state0.replay) { tip.hidden = true; const st0 = svg.querySelector("#st-stem"), sc0 = svg.querySelector("#st-scan"); if (st0) st0.setAttribute("visibility", "hidden"); if (sc0) sc0.setAttribute("visibility", "hidden"); return; }
    const r = svg.getBoundingClientRect(), wr = wrapEl.getBoundingClientRect(), k = r.width / m.W;
    svg.querySelectorAll(".st-dev.is-sel").forEach(e => e.classList.remove("is-sel"));
    const selBar = svg.querySelector(`.st-dev[data-i="${index}"]`); if (selBar && !(opts && opts.clear)) selBar.classList.add("is-sel");
    const scan = svg.querySelector("#st-scan");
    if (scan) { scan.setAttribute("x", (p.x - 15).toFixed(1)); scan.setAttribute("visibility", "visible"); }
    const gap = p.avg !== null && p.avg !== undefined ? Number(p.weight) - Number(p.avg) : null, stem = svg.querySelector("#st-stem");
    if (stem) {
      if (gap !== null && p.ty !== null && p.ty !== undefined && Math.abs(p.y - p.ty) > 3) { stem.setAttribute("x1", p.x); stem.setAttribute("x2", p.x); stem.setAttribute("y1", p.y); stem.setAttribute("y2", p.ty); stem.setAttribute("visibility", "visible"); }
      else stem.setAttribute("visibility", "hidden");
    }
    const nt = typeof NXT.chartNotes === "function" ? NXT.chartNotes()[p.date] : null;
    const did = [dayDid(p.date), nt ? NXT.noteLabel(nt.kind) + (nt.text ? ": " + nt.text : "") : ""].filter(Boolean).join(" · ");
    tip.innerHTML = `${did ? `<span class="st-tip-ctx">${esc(did)}</span>` : ""}<b>${esc(shortDate(p.date))}</b><span>Reading <em>${Number(p.weight).toFixed(1)}</em></span>${p.avg !== null ? `<span>Trend <em>${Number(p.avg).toFixed(2)}</em></span>` : ""}${gap !== null && Math.abs(gap) >= 0.05 ? `<span class="st-tip-gap">${Math.abs(gap).toFixed(1)} kg ${gap < 0 ? "below" : "above"} trend</span>` : ""}`;
    tip.style.left = Math.min(Math.max(r.left - wr.left + p.x * k, 58), wr.width - 58) + "px";
    tip.hidden = false;
    const hi = (p.ty !== null && p.ty !== undefined ? Math.min(p.y, p.ty) : p.y), lo = (p.ty !== null && p.ty !== undefined ? Math.max(p.y, p.ty) : p.y), h = tip.offsetHeight;
    const above = r.top - wr.top + hi * k - h - 16;
    tip.style.top = (above >= 0 ? above : Math.min(wr.height - h, r.top - wr.top + lo * k + 18)) + "px";
  }
  function stopReplay() {
    if (!state0.replay) return;
    cancelAnimationFrame(state0.replay.raf);
    const d = state0.replay.done; state0.replay = null; d && d();
  }

  /* ---- Progress chart replay (drives NXT.selectPoint, the engine's own
     readout, so the header shows exactly what scrubbing shows) --------------- */
  function bindProgressReplay(page) {
    const btn = page.querySelector("[data-st-chart-replay]");
    if (!btn) return;
    btn.onclick = () => {
      if (state0.replay) { stopReplay(); return; }
      const m = NXT.ui.chart, rect = document.getElementById("vn-chart-clip-r");
      if (!m || !m.points || !m.points.length || !rect) return;
      const full = Number(rect.getAttribute("width")), x0 = Number(rect.getAttribute("x"));
      if (reduced()) { NXT.selectPoint(m.points.length - 1, { clear: true }); return; }
      const dur = 6500, start = performance.now(), wrap = document.getElementById("vn-chart-wrap");
      wrap && wrap.classList.add("is-replaying"); btn.querySelector("span").textContent = "Stop";
      const run = now => {
        const k = Math.min(1, (now - start) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const xr = x0 + e * full; rect.setAttribute("width", Math.max(0, xr - x0));
        let idx = 0; m.points.forEach((p, i) => { if (p.x <= xr + .5) idx = i; });
        NXT.selectPoint(idx);
        if (k < 1) state0.replay = { raf: requestAnimationFrame(run), done };
        else done();
      };
      const done = () => { state0.replay = null; rect.setAttribute("width", full); wrap && wrap.classList.remove("is-replaying"); btn.querySelector("span").textContent = "Replay"; NXT.selectPoint(m.points.length - 1, { clear: true }); };
      state0.replay = { raf: requestAnimationFrame(run), done };
    };
  }

  /* ---- Composition map ---------------------------------------------------- */
  function drawCompMap(host, animate) {
    let pts; try { pts = JSON.parse(host.getAttribute("data-st-cmap")); } catch (e) { return; }
    if (!pts || pts.length < 2) return;
    const W = Math.max(240, host.clientWidth || 320), H = Math.round(Math.min(260, W * .66)), P = { l: 34, r: 16, t: 18, b: 30 };
    const fx = niceDomain(pts.map(p => p.f)), my = niceDomain(pts.map(p => p.m));
    const X = v => P.l + (v - fx.lo) / (fx.hi - fx.lo) * (W - P.l - P.r);
    const Y = v => P.t + (my.hi - v) / (my.hi - my.lo) * (H - P.t - P.b);
    const uid = "stc" + Math.random().toString(36).slice(2, 7);
    const xy = pts.map(p => ({ x: X(p.f), y: Y(p.m), p }));
    const d = xy.map((q, i) => (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1)).join(" ");
    const A = xy[0], B = xy[xy.length - 1];
    host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="st-cmap${animate && !reduced() ? " is-draw" : ""}" aria-hidden="true">
      <defs><marker id="${uid}-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--st-accent-lift)"/></marker></defs>
      ${fx.ticks.map(v => `<line class="st-grid" x1="${X(v)}" x2="${X(v)}" y1="${P.t}" y2="${H - P.b}"/><text class="st-ax" x="${X(v)}" y="${H - 12}" text-anchor="middle">${Number(v.toFixed(1))}</text>`).join("")}
      ${my.ticks.map(v => `<line class="st-grid" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="st-ax" x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${Number(v.toFixed(1))}</text>`).join("")}
      ${/* D50: the region up and to the left of the first scan is "less fat, more muscle than the first scan". Geometry only, no score. */""}
      <rect class="st-cm-zone" x="${P.l}" y="${P.t}" width="${Math.max(0, A.x - P.l).toFixed(1)}" height="${Math.max(0, A.y - P.t).toFixed(1)}" rx="6"/>
      ${A.x - P.l > 70 && A.y - P.t > 24 ? `<text class="st-cm-zl" x="${P.l + 7}" y="${P.t + 14}">Less fat · more muscle</text>` : ""}
      <line class="st-cm-ref" x1="${A.x.toFixed(1)}" x2="${A.x.toFixed(1)}" y1="${P.t}" y2="${H - P.b}"/><line class="st-cm-ref" x1="${P.l}" x2="${W - P.r}" y1="${A.y.toFixed(1)}" y2="${A.y.toFixed(1)}"/>
      <text class="st-ax st-ax-f" x="${W - P.r}" y="${H - 1}" text-anchor="end">Fat mass kg →</text>
      <text class="st-ax st-ax-m" x="${P.l}" y="${P.t - 6}">↑ Muscle mass kg</text>
      <path d="${d}" class="st-cm-path" pathLength="1" marker-end="url(#${uid}-ar)"/>
      ${xy.map((q, i) => `<circle class="st-cm-pt${i === 0 ? " is-first" : i === xy.length - 1 ? " is-last" : ""}" cx="${q.x}" cy="${q.y}" r="${i === xy.length - 1 ? 6 : 4.5}" style="--i:${i}"/>`).join("")}
      <circle class="st-hc-halo" cx="${B.x}" cy="${B.y}" r="13"/>
      <text class="st-cm-l" x="${A.x + 9}" y="${A.y - 8}">${esc(shortDate(A.p.d))}</text>
      <text class="st-cm-l is-last" x="${B.x + 10}" y="${B.y + 16}">${esc(shortDate(B.p.d))}</text>
    </svg>`;
  }

  /* ---- Dock indicator and spotlight --------------------------------------- */
  let dockI = -1, dockT = 0;
  function syncDock() {
    const inner = document.querySelector(".tabs .tabs-inner"); if (!inner) return;
    const tabs = [...inner.querySelectorAll(".tab")], i = tabs.findIndex(t => t.classList.contains("active"));
    if (dockI !== -1 && i !== dockI && !reduced()) { inner.classList.remove("is-moving"); void inner.offsetWidth; inner.classList.add("is-moving"); clearTimeout(dockT); dockT = setTimeout(() => inner.classList.remove("is-moving"), 560); }
    dockI = i;
    inner.style.setProperty("--tab-i", String(Math.max(0, i)));
    inner.style.setProperty("--tab-n", String(tabs.length || 5));
    inner.classList.add("st-dock");
  }
  function bindSpotlight() {
    document.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const el = e.target && e.target.closest && e.target.closest(".st-tile");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  /* ---- Train: swipe between exercises, bump steppers ---------------------- */
  function fitTrain() {
    const root = document.querySelector("#trainPage .st-train-active");
    if (!root) return;
    root.style.minHeight = "";
    const top = root.getBoundingClientRect().top + window.scrollY;
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    root.style.minHeight = Math.max(560, Math.round(vh - top)) + "px";
  }
  /* Hold-to-repeat on the steppers lives in premium-ui.js (one loop, one place). */
  function bindTrain(page) {
    fitTrain();
    fitNums();
    const ex = page.querySelector(".st-train-active .st-ex");
    if (ex && !ex.__stSwipe) {
      ex.__stSwipe = true;
      let x0 = null, y0 = 0, id = null;
      ex.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; id = e.pointerId; });
      ex.addEventListener("pointermove", e => {
        if (x0 === null || e.pointerId !== id) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (Math.abs(dy) > 30) { x0 = null; ex.style.transform = ""; return; }
        if (Math.abs(dx) > 8 && !reduced()) ex.style.transform = `translateX(${dx * .35}px)`;
      });
      const end = e => {
        if (x0 === null) return;
        const dx = e.clientX - x0; x0 = null; ex.style.transform = "";
        if (Math.abs(dx) > 60 && typeof NXP === "object") NXP.goExercise(dx < 0 ? 1 : -1);
      };
      ex.addEventListener("pointerup", end);
      ex.addEventListener("pointercancel", () => { x0 = null; ex.style.transform = ""; });
    }
  }
  /* Long values (72.5, 102.5) step down in size so they never collide. */
  function fitNum(input) {
    if (!input) return;
    const s = String(input.value || input.placeholder || "");
    input.setAttribute("data-len", String(Math.min(5, Math.max(1, s.length))));
  }
  function fitNums() { ["weightInput", "repsInput"].forEach(id => fitNum(document.getElementById(id))); }
  function bindStepBump() {
    document.addEventListener("input", e => { if (e.target && (e.target.id === "weightInput" || e.target.id === "repsInput")) fitNum(e.target); }, true);
    document.addEventListener("click", e => { if (e.target && e.target.closest && e.target.closest("#trainPage .nxp-step, #trainPage .st-refc")) setTimeout(fitNums, 0); }, true);
    document.addEventListener("pointerup", e => { if (e.target && e.target.closest && e.target.closest("#trainPage .nxp-step")) setTimeout(fitNums, 0); }, true);
    document.addEventListener("pointerdown", e => {
      const btn = e.target && e.target.closest && e.target.closest("#trainPage .nxp-step");
      if (!btn || reduced()) return;
      const input = document.getElementById(btn.dataset.stepTarget);
      if (!input) return;
      const cls = Number(btn.dataset.step) > 0 ? "st-bump-up" : "st-bump-dn";
      input.classList.remove("st-bump-up", "st-bump-dn"); void input.offsetWidth; input.classList.add(cls);
      clearTimeout(input.__stBump); input.__stBump = setTimeout(() => input.classList.remove(cls), 260);
    }, true);
  }

  /* ---- Sheets: the page behind recedes; drag the sheet down to close ------ */
  function bindSheets() {
    const root = document.getElementById("modalRoot");
    if (!root) return;
    const sync = () => {
      const sheet = root.querySelector(".n99-modal .sheet");
      document.documentElement.classList.toggle("st-sheet-open", !!sheet);
      if (!sheet || sheet.__stDrag) return;
      sheet.__stDrag = true;
      let y0 = null, dy = 0, t0 = 0;
      sheet.addEventListener("pointerdown", e => {
        const r = sheet.getBoundingClientRect();
        const onGrip = e.clientY - r.top < 56;
        if (!onGrip && sheet.scrollTop > 0) return;
        if (!onGrip && e.target.closest("input,textarea,select,button,a,label,[role=slider]")) return;
        y0 = e.clientY; dy = 0; t0 = performance.now();
      });
      sheet.addEventListener("pointermove", e => {
        if (y0 === null) return;
        dy = Math.max(0, e.clientY - y0);
        if (dy > 4) { sheet.style.transition = "none"; sheet.style.transform = `translateY(${dy}px)`; }
      });
      const end = () => {
        if (y0 === null) return;
        const v = dy / Math.max(1, performance.now() - t0);
        y0 = null; sheet.style.transition = "";
        if (dy > 120 || (dy > 40 && v > .6)) {
          sheet.style.transform = "translateY(110%)";
          setTimeout(() => { if (typeof closeModal === "function") closeModal(); }, 200);
        } else sheet.style.transform = "";
      };
      sheet.addEventListener("pointerup", end);
      sheet.addEventListener("pointercancel", end);
    };
    new MutationObserver(sync).observe(root, { childList: true });
    sync();
  }

  /* ---- Hydrate after every paint ------------------------------------------ */
  /* One icon set. Single-glyph controls (› ‹ + − × ✓) become the same 1.9px round-cap SVG strokes the
     Train header already uses. Done where the glyph is the whole content of its element, so
     "+ Weight" style labels keep their text. Runs on whatever gets added to the page. */
  const ICONS = {
    "\u203a": ["M8 5l7 7-7 7", "Next", true], "\u2039": ["M16 5l-7 7 7 7", "Previous", true],
    "+": ["M12 5v14M5 12h14", "Increase", false], "\u2212": ["M5 12h14", "Decrease", false],
    "\u00d7": ["M6 6l12 12M18 6L6 18", "Close", false], "\u2713": ["M5 12.5l4.5 4.5L19 7.5", "Done", true],
    "\u2191": ["M12 19V6M6.5 11.5 12 6l5.5 5.5", "Up", true], "\u2193": ["M12 5v13M6.5 12.5 12 18l5.5-5.5", "Down", true]
  };
  function iconify(root) {
    if (!root || root.nodeType !== 1 || root.closest("svg")) return;
    const els = [root, ...root.querySelectorAll("*")];
    for (const el of els) {
      if (el.childElementCount || el.closest("svg,script,style,textarea,input")) continue;
      const t = el.textContent.trim(), ic = t.length === 1 && ICONS[t];
      if (!ic || el.dataset.stIco) continue;
      if (!ic[2] && !el.closest("button,[role=button]")) continue; /* \u00d7 between weight and reps is a times sign, not a close */
      el.dataset.stIco = "1";
      el.innerHTML = `<svg class="st-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${ic[0]}"/></svg>`;
      const btn = el.closest("button");
      if (btn && !ic[2] && !btn.hasAttribute("aria-label") && !btn.textContent.trim()) btn.setAttribute("aria-label", ic[1]);
    }
  }
  /* ---- D44 · Segmented controls share one sliding pill ----------------------
     Every segmented control (range, Progress tabs, History filter, Working/Warm-up,
     weigh-in timing) gets the same glass pill, which springs from the option you
     left to the one you chose. Repaints rebuild the DOM, so the last position is
     remembered per control. Presentation only: the buttons and handlers are untouched. */
  const SEGS = ".vn-seg, .n99-progress-tabs, .vn-hist-filters, .nxp-seg-type .nxp-seg, .st-qw-seg";
  const segMem = {};
  function segKey(c) { return (c.closest("[id$='Page']") || document.body).id + "|" + c.className.replace(/\s*st-segc\s*/g, " ").trim(); }
  /* The pill starts moving on pointerdown, before the click handler repaints the
     screen; if a repaint replaces the control mid-slide, the new pill resumes from
     where the old one was, so the motion is continuous rather than late. */
  const SEG_MS = 340, segAnim = {};
  const segEase = x => 1 - Math.pow(1 - x, 3);
  function pillBox(c, btn) { return { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight }; }
  function ensurePill(c) {
    let pill = c.querySelector(":scope>.st-seg-pill");
    if (!pill) { c.insertAdjacentHTML("afterbegin", '<i class="st-seg-pill" aria-hidden="true"></i>'); pill = c.firstElementChild; c.classList.add("st-segc"); }
    return pill;
  }
  function putPill(pill, b, ms) {
    pill.style.transitionDuration = ms == null ? "" : ms + "ms";
    pill.style.transform = `translate(${b.x}px,${b.y}px)`; pill.style.width = b.w + "px"; pill.style.height = b.h + "px";
  }
  function jumpPill(pill, b) { pill.style.transition = "none"; putPill(pill, b); void pill.offsetWidth; pill.style.transition = ""; }
  function placeSeg(c) {
    const act = c.querySelector(":scope>button.active, :scope>button.is-on, :scope>button[aria-pressed='true']");
    const pill = ensurePill(c), key = segKey(c);
    if (!act) { pill.style.opacity = "0"; return; }
    const box = pillBox(c, act), run = segAnim[key];
    if (run && run.to.x === box.x && run.to.w === box.w && !reduced()) {
      const t = (performance.now() - run.t0) / SEG_MS;
      if (t < 1 && !pill.dataset.on) {
        const k = segEase(Math.max(0, t)), mid = { x: run.from.x + (box.x - run.from.x) * k, y: box.y, w: run.from.w + (box.w - run.from.w) * k, h: box.h };
        jumpPill(pill, mid); pill.dataset.on = "1"; pill.style.opacity = "1"; putPill(pill, box, Math.round((1 - t) * SEG_MS)); segMem[key] = box; return;
      }
    }
    if (!pill.dataset.on) jumpPill(pill, box);
    pill.dataset.on = "1"; pill.style.opacity = "1"; putPill(pill, box); segMem[key] = box;
  }
  document.addEventListener("pointerdown", e => {
    const btn = e.target.closest && e.target.closest("button"), c = btn && btn.parentElement;
    if (!c || !c.matches || !c.matches(SEGS) || btn.matches(".active,.is-on,[aria-pressed='true']")) return;
    const pill = ensurePill(c), key = segKey(c), to = pillBox(c, btn);
    const from = segMem[key] || (() => { const a = c.querySelector(":scope>button.active, :scope>button.is-on, :scope>button[aria-pressed='true']"); return a ? pillBox(c, a) : to; })();
    if (!pill.dataset.on) { jumpPill(pill, from); pill.dataset.on = "1"; pill.style.opacity = "1"; }
    segAnim[key] = { from, to, t0: performance.now() }; segMem[key] = to;
    if (reduced()) jumpPill(pill, to); else putPill(pill, to);
  }, { capture: true, passive: true });
  function bindSegs(root) { (root || document).querySelectorAll(SEGS).forEach(c => { if (c.offsetParent !== null) placeSeg(c); }); }
  let segRaf = 0;
  function queueSegs() { cancelAnimationFrame(segRaf); segRaf = requestAnimationFrame(() => bindSegs(document)); }
  document.addEventListener("click", e => { const c = e.target.closest && e.target.closest(SEGS); if (c) setTimeout(queueSegs, 0); }, true);
  window.addEventListener("resize", () => { Object.keys(segMem).forEach(k => delete segMem[k]); document.querySelectorAll(".st-seg-pill").forEach(p => delete p.dataset.on); queueSegs(); });

  /* ---- D44 · Press feedback everywhere ---------------------------------------
     Anything tappable dips on touch and springs back on release (Web Animations on
     the independent `scale` property, so it never fights an element's own transform
     or transitions). Large surfaces dip less than buttons. Off under reduced motion. */
  const PRESS = "button:not(:disabled), [role=button], summary, a[href], .st-tile[onclick], label:has(>input[type=checkbox])";
  const SPRING_BACK = "linear(0.0027,0.0851,0.2168,0.4029,0.5926,0.7408,0.885,0.9931,1.057,1.1015,1.1196,1.1192,1.1064,1.0893,1.0663,1.0438,1.0266,1.0102,0.9982,0.9914,0.9869,0.9854,0.9859,0.9877,0.9903,0.9927,0.9954,0.9976,0.9992,1.0005,1.0013,1.0017,1.0018,1.0017,1.0014,1.0011,1.0008,1.0005,1.0002,1.0001,1)";
  let pressed = null;
  function pressDepth(el) { const r = el.getBoundingClientRect(), big = r.height > 96 || el.classList.contains("st-tile"); return big ? 0.985 : r.width > 200 ? 0.97 : r.width > 100 ? 0.96 : 0.92; }
  function release() {
    const el = pressed; pressed = null; if (!el || !el.animate) return;
    const from = el.__stScale || 0.96; el.__stPress && el.__stPress.cancel();
    el.__stPress = el.animate([{ scale: String(from) }, { scale: "1" }], { duration: 440, easing: SPRING_BACK });
  }
  function bindPress() {
    if (!Element.prototype.animate) return;
    document.addEventListener("pointerdown", e => {
      if (reduced() || e.button > 0) return;
      const el = e.target.closest && e.target.closest(PRESS);
      if (!el || el.closest(".nxp-stepper-row input, #vn-chart-wrap, .st-qw-field")) return;
      pressed = el; const d = el.__stScale = pressDepth(el);
      el.__stPress && el.__stPress.cancel();
      el.__stPress = el.animate([{ scale: "1" }, { scale: String(d) }], { duration: 110, easing: "cubic-bezier(.32,.72,0,1)", fill: "forwards" });
    }, { passive: true });
    ["pointerup", "pointercancel", "dragstart"].forEach(t => document.addEventListener(t, release, { passive: true }));
    document.addEventListener("pointermove", e => { if (pressed && e.buttons && Math.hypot(e.movementX, e.movementY) > 6) release(); }, { passive: true });
  }
  function bindIcons() {
    iconify(document.body);
    new MutationObserver(list => { let added = false; for (const m of list) m.addedNodes.forEach(n => { if (n.nodeType === 1) { iconify(n); added = true; } }); if (added) queueSegs(); })
      .observe(document.body, { childList: true, subtree: true });
  }
  /* History calendar: horizontal swipe changes month. Delegated, installed once.
     Vertical intent is left to the browser (grid is touch-action:pan-y). */
  function bindCalSwipe() {
    let s = null, swallow = 0;
    const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.addEventListener("pointerdown", e => {
      const g = e.target && e.target.closest && e.target.closest(".nxp-cal-grid");
      if (!g || (e.pointerType === "mouse" && e.button !== 0)) return;
      s = { g, x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
    }, true);
    document.addEventListener("pointermove", e => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.on) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.4) { if (Math.abs(dy) > 14) s = null; return; }
        s.on = true; s.g.classList.add("is-dragging");
        try { s.g.setPointerCapture(e.pointerId); } catch (x) {}
      }
      if (!reduce()) s.g.style.transform = "translateX(" + Math.max(-70, Math.min(70, dx * 0.45)) + "px)";
    }, true);
    const end = e => {
      if (!s || (e && e.pointerId !== s.id)) return;
      const cur = s; s = null;
      if (!cur.on) return;
      const dx = (e && e.clientX != null ? e.clientX : cur.x) - cur.x;
      cur.g.classList.remove("is-dragging");
      swallow = Date.now();
      const go = e && e.type === "pointerup" && Math.abs(dx) >= 56;
      if (go && typeof NXP === "object" && NXP.historyShiftMonth) {
        cur.g.style.transform = "";
        NXP.historyShiftMonth(dx < 0 ? 1 : -1);
      } else {
        cur.g.classList.add("is-settling");
        cur.g.style.transform = "";
        setTimeout(() => cur.g.classList.remove("is-settling"), 260);
      }
    };
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
    document.addEventListener("click", e => {
      if (swallow && Date.now() - swallow < 350) { e.stopPropagation(); e.preventDefault(); swallow = 0; }
    }, true);
  }

  /* ---- Scroll-in, tap ripple, rolling trend figure ----------------------- */
  const io = (typeof IntersectionObserver === "function") ? new IntersectionObserver(list => {
    for (const e of list) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      if (el.hasAttribute("data-st-view")) { el.classList.add("is-in", "st-play"); rollDec(el); }
      if (el.classList.contains("st-rv")) { el.classList.add("st-rv-in"); revealNums(el); }
    }
  }, { threshold: 0.28, rootMargin: "0px 0px -6% 0px" }) : null;
  function rollDec(root) {
    const el = root.querySelector(".st-dec-val");
    if (!el || reduced() || el.dataset.stRolled) return;
    const m = /^([+\u2212-]?)(\d+(?:\.\d+)?)(.*)$/.exec(el.textContent.trim());
    if (!m) return;
    el.dataset.stRolled = "1";
    const sign = m[1], target = parseFloat(m[2]), unit = m[3], dp = (m[2].split(".")[1] || "").length;
    const t0 = performance.now(), dur = 900;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = sign + (target * e).toFixed(dp) + unit;
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = sign + (0).toFixed(dp) + unit;
    requestAnimationFrame(step);
  }
  function bindView(page, entering) {
    const live = entering && !reduced() && io;
    page.querySelectorAll("[data-st-view]").forEach(el => {
      if (!live) { el.classList.add("is-in"); return; }
      io.observe(el);
    });
    if (!live) return;
    /* Cards that start below the fold wait for the scroll instead of animating unseen. */
    const fold = window.innerHeight || 800;
    page.querySelectorAll(".st-bento>*, .vn-weight>*").forEach(el => {
      if (el.getBoundingClientRect().top < fold * 0.96) return;
      el.classList.add("st-rv");
      io.observe(el);
    });
  }

  /* ---- D71 · Native tab navigation -----------------------------------------------------------------
     One wrapper around switchTab (installed below): every tab keeps its own scroll position, tapping the
     tab you are already on returns it to the top, and a change of tab is a View Transition — the page
     crossfades while its title slides in the direction of travel, and the session name (Today → Train)
     and the trend figure (Today → Progress) fly across when both ends are on screen. Reduced motion, a
     hidden page, an open sheet or a browser without View Transitions gets the plain swap, as before. */
  const TABS = ["home", "train", "weight", "history", "more"];
  const TITLES = { home: "Today", train: "Train", weight: "Progress", history: "History", more: "Settings" };
  const MAST = { home: "#homePage .st-head .st-h1", train: "#trainPage .nxp-train-chrome h1", weight: "#weightPage .nxp-progress-chrome h1", history: "#historyPage .vn-hist-chrome h1", more: "#morePage .vn-set-title" };
  const MORPH = [
    { name: "st-m-session", sel: { home: "#homePage .st-t-train .st-h2", train: "#trainPage .nxp-train-chrome h1, #trainPage .st-tbar-t" } },
    { name: "st-m-trend", sel: { home: "#homePage .st-mini [data-st-odo]", weight: "#n99-chart-average" } },
    { name: "st-m-live", sel: { home: "#stLive", weight: "#stLive", history: "#stLive", more: "#stLive", train: "#trainPage .st-tbar" } }
  ];
  const scrollMemo = {};
  /* Portal launch: Start / Resume workout opens the workout as a circle of light from the button. */
  let lastPress = null;
  document.addEventListener("pointerdown", e => { const b = e.target && e.target.closest && e.target.closest(".st-cta,.st-live"); lastPress = b ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; }, true);
  function onScreen(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect(), vh = window.innerHeight || 800;
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  }
  function pick(sel) { if (!sel) return null; for (const el of document.querySelectorAll(sel)) if (onScreen(el)) return el; return null; }
  function currentTab() { return (typeof state === "object" && state && TABS.includes(state.tab)) ? state.tab : "home"; }
  /* The tab asked for last. A tap during a running transition used to compare against state.tab, which only
     changes inside the transition's update; a quick third tap back to the tab on screen then rendered at once and
     the two pending updates landed after it (WebKit may run an interrupted update late), so the app ended on an
     older tab (iPhone simulator, 2026-10-19). Every update now renders the latest request. */
  let navLast = null, navPending = 0, navUntil = 0;
  function navigate(orig, args) {
    const shown = currentTab(), to = TABS.includes(args[0]) ? args[0] : "home";
    const pending = navPending > 0 && performance.now() < navUntil;
    const from = pending && navLast ? navLast : shown;
    if (to === from) {
      if (to !== shown) return; /* already on its way */
      const out = orig.apply(null, args);
      if ((window.scrollY || 0) > 2) window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
      return out;
    }
    navLast = to;
    scrollMemo[shown] = window.scrollY || 0;
    const swap = () => {
      const target = navLast;
      if (currentTab() === target) return;
      window.scrollTo(0, 0);
      const o = orig.apply(null, [target].concat(Array.prototype.slice.call(args, 1)));
      const back = scrollMemo[target] || 0;
      if (back) window.scrollTo(0, back);
      queueTop();
      return o;
    };
    const de = document.documentElement;
    if (typeof document.startViewTransition !== "function" || reduced() || document.hidden || de.classList.contains("st-sheet-open")) return swap();
    const portal = to === "train" && lastPress && performance.now() - lastPress.t < 1500;
    if (portal) { de.style.setProperty("--st-px", Math.round(lastPress.x) + "px"); de.style.setProperty("--st-py", Math.round(lastPress.y) + "px"); lastPress = null; }
    de.setAttribute("data-st-nav", portal ? "portal" : TABS.indexOf(to) > TABS.indexOf(shown) ? "fwd" : "back");
    const named = [];
    const tag = (el, n) => { if (el) { el.style.viewTransitionName = n; named.push(el); } };
    /* A portal is the only motion of its transition: no title travel, no flying name. */
    /* D71 calmer (owner, 2026-10-19: "tab switch animation not so aggressive"): elements no longer fly
       between tabs; the page fades and the title moves a few points. MORPH stays defined for reference. */
    const pairs = [];
    if (!portal) tag(pick(MAST[shown]), "st-mast");
    pairs.forEach(p => tag(p.el, p.m.name));
    const untag = () => { named.splice(0).forEach(el => { el.style.viewTransitionName = ""; }); };
    let out;
    navPending++; navUntil = performance.now() + 1500;
    try {
      const t = document.startViewTransition(() => {
        untag();
        out = swap();
        if (!portal) tag(pick(MAST[currentTab()]), "st-mast");
        pairs.forEach(p => tag(pick(p.m.sel[currentTab()]), p.m.name));
      });
      /* The direction attribute stays until the last overlapping transition is done. */
      const done = () => { untag(); navPending = Math.max(0, navPending - 1); if (!navPending) de.removeAttribute("data-st-nav"); };
      t.finished.then(done, done);
      /* Tapping another tab before this one settles skips it, and `ready` rejects with an AbortError.
         Nothing failed, but the page's unhandledrejection handler would toast "App error", so it is
         absorbed here (found on the iPhone simulator, 2026-10-19). */
      if (t.ready && t.ready.catch) t.ready.catch(() => {});
      if (t.updateCallbackDone && t.updateCallbackDone.catch) t.updateCallbackDone.catch(() => {});
    } catch (e) { untag(); navPending = Math.max(0, navPending - 1); if (!navPending) de.removeAttribute("data-st-nav"); return swap(); }
    return out;
  }

  /* ---- D72 · Scroll-aware top chrome ----------------------------------------------------------------
     Once the page scrolls, a frosted strip sits behind the clock and status icons so text never runs
     under them; when the page title has scrolled away, a small glass capsule with the tab's name settles
     under the status bar (tap it to go back to the top). Hidden in an active workout, which has its own
     header (D6). Decorative duplicate of the visible title, so it is hidden from assistive tech. */
  let topEl = null, topRaf = 0;
  function ensureTop() {
    if (topEl && topEl.isConnected) return topEl;
    topEl = document.createElement("div");
    topEl.id = "stTop";
    topEl.setAttribute("aria-hidden", "true");
    topEl.innerHTML = '<i class="st-top-scrim"></i><button type="button" class="st-top-bar" tabindex="-1"><span class="st-top-t"></span></button>';
    topEl.querySelector(".st-top-bar").addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }));
    document.body.appendChild(topEl);
    return topEl;
  }
  function updateTop() {
    topRaf = 0;
    if (!document.body) return;
    const el = ensureTop(), tab = currentTab(), y = window.scrollY || 0;
    const workout = tab === "train" && !!document.querySelector("#trainPage .st-train-active");
    const bar = el.querySelector(".st-top-bar"), mast = document.querySelector(MAST[tab]);
    const line = bar.getBoundingClientRect().bottom || 60;
    const past = mast && mast.offsetParent !== null ? mast.getBoundingClientRect().bottom < line : y > 140;
    el.classList.toggle("is-scrolled", y > 4 && !workout);
    el.classList.toggle("is-compact", !!past && y > 4 && !workout);
    const t = el.querySelector(".st-top-t");
    if (t.textContent !== TITLES[tab]) t.textContent = TITLES[tab] || "";
  }
  function queueTop() { if (!topRaf) topRaf = requestAnimationFrame(updateTop); }
  function bindTop() { window.addEventListener("scroll", queueTop, { passive: true }); window.addEventListener("resize", queueTop); queueTop(); }

  /* ---- D75 · Workout mini-player, live Train tab, screen stays awake ----------------------------------
     A lift session that has started and is not finished (N.sessionLogs() has rows, N.planDone() is
     false) follows you: on any other tab a glass pill above the dock shows the session, sets done of
     planned and the live rest countdown — tap it to return (it morphs into the workout header). The
     Train tab carries the same progress as a ring. While the workout itself is on screen the screen
     stays awake (Screen Wake Lock), so the rest timer never hides behind the lock screen. Everything
     here reads the engine's own values; nothing is stored. */
  let liveEl = null, liveTick = 0, wake = null, wakeBusy = false;
  function liveSession() {
    try {
      if (typeof NXT !== "object" || typeof template !== "function" || typeof state !== "object" || !state) return null;
      if (["Rest", "Zone2", "Floorball"].includes(state.dayType)) return null;
      if (!NXT.sessionLogs().length || NXT.planDone()) return null;
      const list = template() || [];
      const total = list.reduce((a, e) => a + (Number(e.sets) || 0), 0);
      const count = list.reduce((a, e) => a + Math.min(NXT.done(e.name), Number(e.sets) || 0), 0);
      const rest = typeof apx96RestRemaining === "function" ? apx96RestRemaining() : 0;
      return { name: NXT.label(state.dayType), count, total, rest };
    } catch (e) { return null; }
  }
  function fmt(s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  /* D75b · On phones the live session is part of the dock itself: the glass grows a row above the tabs.
     Wide layouts (the side rail, >=1024px) keep the floating pill. */
  function liveHost() {
    const tabs = document.querySelector(".tabs");
    return tabs && !(window.matchMedia && matchMedia("(min-width:1024px)").matches) ? tabs : document.body;
  }
  function placeLive(el) {
    const host = liveHost();
    if (el.parentElement !== host) { if (host === document.body) host.appendChild(el); else host.insertBefore(el, host.firstChild); }
    el.classList.toggle("is-docked", host !== document.body);
  }
  function ensureLive() {
    if (liveEl && liveEl.isConnected) { placeLive(liveEl); return liveEl; }
    liveEl = document.createElement("button");
    liveEl.type = "button"; liveEl.id = "stLive"; liveEl.className = "st-live"; liveEl.hidden = true;
    liveEl.innerHTML = '<span class="st-live-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" pathLength="1" class="st-live-tr"/><circle cx="18" cy="18" r="15.5" pathLength="1" class="st-live-arc"/></svg><i class="st-live-dot"></i></span>'
      + '<span class="st-live-t"><b class="st-live-n"></b><small><span class="st-live-c"></span><span class="st-live-r"></span></small></span>'
      + '<svg class="st-live-up" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 12.5 10 8l4.5 4.5"/></svg>';
    liveEl.addEventListener("click", () => { if (typeof NXP === "object" && NXP.enterTrain) NXP.enterTrain(); });
    placeLive(liveEl);
    return liveEl;
  }
  function updateLive() {
    if (!document.body) return;
    const s = liveSession(), tab = currentTab();
    const inTrain = tab === "train";
    const el = ensureLive();
    const show = !!s && !inTrain;
    if (el.hidden === show) el.hidden = !show;
    document.body.classList.toggle("st-live-on", show);
    const trainTab = document.querySelector('.tabs .tab[data-tab="train"]');
    if (trainTab) {
      trainTab.classList.toggle("is-live", !!s);
      if (s) trainTab.style.setProperty("--live", String(s.total ? Math.round(s.count / s.total * 100) : 0));
    }
    if (s) {
      el.style.setProperty("--live", String(s.total ? s.count / s.total : 0));
      el.querySelector(".st-live-n").textContent = s.name;
      el.querySelector(".st-live-c").textContent = s.count + "/" + s.total + " sets";
      el.querySelector(".st-live-r").textContent = s.rest ? " · Rest " + fmt(s.rest) : "";
      el.classList.toggle("is-resting", s.rest > 0);
      el.setAttribute("aria-label", "Return to workout: " + s.name + ", " + s.count + " of " + s.total + " sets" + (s.rest ? ", resting " + fmt(s.rest) : ""));
      const dock = document.querySelector(".tabs");
      if (dock && !el.classList.contains("is-docked")) { const r = dock.getBoundingClientRect(); if (r.height) el.style.setProperty("--st-live-bottom", Math.max(12, Math.round((window.innerHeight || 0) - r.top + 10)) + "px"); }
    }
    clearTimeout(liveTick);
    if ((s && (show || s.rest)) || glShown) liveTick = setTimeout(updateLive, 1000);
    const workoutOn = inTrain && !!document.querySelector("#trainPage .st-train-active");
    document.documentElement.classList.toggle("st-in-workout", workoutOn);
    glanceTick(workoutOn, s ? s.rest : 0);
    syncWake(workoutOn && document.visibilityState === "visible");
  }
  async function syncWake(on) {
    if (wakeBusy || !("wakeLock" in navigator)) return;
    wakeBusy = true;
    try {
      if (on && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); }
      else if (!on && wake) { const w = wake; wake = null; await w.release(); }
    } catch (e) { wake = null; } finally { wakeBusy = false; }
  }
  function bindLive() {
    document.addEventListener("visibilitychange", updateLive);
    window.addEventListener("resize", updateLive);
    /* The engine starts a rest just after the screen repaints for the logged set, so the pill, the Train
       ring and Glance listen to the rest starting, not only to repaints. */
    try {
      if (typeof apx96StartRest === "function" && !apx96StartRest.__strataLive) {
        const f = apx96StartRest;
        apx96StartRest = function () { const o = f.apply(this, arguments); setTimeout(updateLive, 0); return o; };
        apx96StartRest.__strataLive = true;
      }
    } catch (e) {}
    updateLive();
  }

  /* ---- D77 · Your sky --------------------------------------------------------------------------------
     The background stars are your workouts: one star for every lifting day (by date and gym) in the last
     16 weeks, a little brighter and larger the more working sets it held; today's finished session glows.
     Positions are a stable hash of the day, so the sky only grows. Decorative and aria-hidden; nothing
     here is a score, and nothing is stored. */
  let starKey = "";
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function paintStars() {
    try {
      if (typeof NXT !== "object" || typeof NXT.workRows !== "function" || typeof state !== "object" || !state) return;
      const since = NXT.dateAdd(state.date, -112), days = new Map();
      for (const r of NXT.workRows()) { if (r.date < since) continue; const k = r.date + "|" + (r.gym || "Gym A"); days.set(k, (days.get(k) || 0) + 1); }
      const doneToday = typeof NXT.planDone === "function" && NXT.planDone();
      const key = [...days].map(([k, n]) => k + ":" + n).join(",") + (doneToday ? "|done" : "");
      if (key === starKey) return;
      starKey = key;
      let host = document.getElementById("stStars");
      if (!host) { host = document.createElement("div"); host.id = "stStars"; host.setAttribute("aria-hidden", "true"); document.body.prepend(host); }
      host.innerHTML = [...days].map(([k, n]) => {
        const h = hashStr(k), x = 3 + (h % 9400) / 100, y = 2 + ((h >>> 11) % 7000) / 100;
        const s = Math.min(3.4, 1.3 + n / 10), o = Math.min(1, .5 + n / 36);
        const today = k.startsWith(state.date + "|") && doneToday;
        return `<i${today ? ' class="is-today"' : ""} style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--s:${s.toFixed(2)}px;--o:${o.toFixed(2)};--d:${((h >>> 5) % 60) / 10}s"></i>`;
      }).join("");
    } catch (e) { /* decorative */ }
  }

  /* ---- D78 · Haptics ----------------------------------------------------------------------------------
     A light system tick when something is saved (Log set, Save weigh-in, Log cardio, Finish) and while a
     finger scrubs across readings. Android: the Vibration API. iPhone (iOS 18+): toggling a switch control
     plays the system selection haptic, so a hidden one is toggled. Follows the phone's own System Haptics
     setting; under reduced motion only the save tick remains. Nothing is stored. */
  let hapticLabel = null;
  function haptic(kind) {
    try {
      if (kind === "tick" && reduced()) return;
      if (typeof navigator.vibrate === "function" && !/iP(hone|ad|od)/.test(navigator.userAgent || "")) { navigator.vibrate(kind === "success" ? [10, 40, 16] : 6); return; }
      if (!hapticLabel || !hapticLabel.isConnected) {
        hapticLabel = document.createElement("label");
        hapticLabel.setAttribute("aria-hidden", "true");
        hapticLabel.style.display = "none";
        const sw = document.createElement("input");
        sw.type = "checkbox"; sw.setAttribute("switch", ""); sw.tabIndex = -1;
        hapticLabel.appendChild(sw);
        document.head.appendChild(hapticLabel);
      }
      hapticLabel.click();
      if (kind === "success") setTimeout(() => { try { hapticLabel.click(); } catch (e) {} }, 85);
    } catch (e) { /* no haptics on this device */ }
  }
  function bindHaptics() {
    const wrap = (name, test) => {
      try {
        const f = window[name];
        if (typeof f !== "function" || f.__strataH) return;
        const g = function () {
          const before = test();
          const out = f.apply(this, arguments);
          const check = () => { if (test() > before) haptic("success"); };
          if (out && typeof out.then === "function") out.then(check, () => {}); else check();
          return out;
        };
        g.__strataH = true;
        window[name] = g;
      } catch (e) {}
    };
    wrap("apx95SaveQuickWeight", () => (state && Array.isArray(state.bws) ? state.bws.length : 0));
    const n = (obj, k, test) => { if (!obj) return; const f = obj[k]; if (typeof f !== "function" || f.__strataH) return; obj[k] = function () { const b = test(); const o = f.apply(this, arguments); const c = () => { if (test() > b) haptic("success"); }; if (o && typeof o.then === "function") o.then(c, () => {}); else c(); return o; }; obj[k].__strataH = true; };
    /* The Train form calls NXP.logSet(); the cardio form and Finish call NXT directly. */
    if (typeof NXP === "object") n(NXP, "logSet", () => (state && Array.isArray(state.logs) ? state.logs.length : 0));
    /* A set that sets a new best gets a second, stronger tick once its row has painted. */
    if (typeof NXP === "object" && typeof NXP.logSet === "function" && !NXP.logSet.__strataPR) {
      const f = NXP.logSet;
      NXP.logSet = function () { const o = f.apply(this, arguments); setTimeout(() => { if (document.querySelector("#trainPage .st-lrow.is-fresh.is-pr")) { haptic("success"); setTimeout(() => haptic("success"), 160); } }, 200); return o; };
      NXP.logSet.__strataPR = true; NXP.logSet.__strataH = true;
    }
    if (typeof NXT === "object") {
      n(NXT, "saveCardio", () => (state && Array.isArray(state.cardio) ? state.cardio.length : 0));
      n(NXT, "finish", () => (typeof NXT.planDone === "function" && NXT.planDone() ? 1 : 0));
    }
  }

  /* ---- D79 · Dynamic Island alerts -------------------------------------------------------------------
     Confirmations grow out of the Dynamic Island as a black capsule (on phones without one, from the top
     edge) instead of a glass toast. The alert is now announced to VoiceOver (role=status), and a second
     alert restarts the timer instead of vanishing on the first one's. Same words as before. */
  let toastTimer = 0, toastOut = 0;
  function bindIsland() {
    if (typeof toast !== "function" || toast.__strataIsland) return;
    const orig = toast;
    toast = function (m) {
      const t = document.getElementById("toast");
      if (!t) return orig.apply(this, arguments);
      t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      clearTimeout(toastTimer); clearTimeout(toastOut);
      t.classList.remove("st-island", "is-out"); void t.offsetWidth;
      t.textContent = String(m == null ? "" : m);
      t.classList.add("st-island");
      /* In a workout the Log button already confirms the set in place; the alert is still announced to
         VoiceOver but not drawn over the instrument. */
      t.classList.toggle("is-quiet", quietToast || (/^(working|warm-up|extra) set saved/i.test(t.textContent) && !!document.querySelector("#trainPage .st-train-active")));
      t.style.display = "block";
      toastTimer = setTimeout(() => {
        t.classList.add("is-out");
        toastOut = setTimeout(() => { t.style.display = "none"; t.classList.remove("st-island", "is-out", "is-quiet"); }, reduced() ? 0 : 280);
      }, 2300);
    };
    toast.__strataIsland = true;
  }

  /* ---- Weight chart: a glowing head on the latest trend value, a tick under the finger --------------- */
  let lastScrub = -1;
  function dressChartHead() {
    const svg = document.getElementById("n99-chart-svg"), m = typeof NXT === "object" && NXT.ui && NXT.ui.chart;
    if (!svg || !m || !Array.isArray(m.points) || svg.querySelector(".st-comet")) return;
    const last = [...m.points].reverse().find(p => p && p.ty !== null && p.ty !== undefined && Number.isFinite(Number(p.ty)));
    if (!last) return;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "st-comet"); g.setAttribute("aria-hidden", "true"); g.setAttribute("pointer-events", "none");
    g.innerHTML = `<circle class="st-comet-halo" cx="${last.x}" cy="${last.ty}" r="11"/><circle class="st-comet-ring" cx="${last.x}" cy="${last.ty}" r="6.5"/><circle class="st-comet-core" cx="${last.x}" cy="${last.ty}" r="3.4"/>`;
    svg.appendChild(g);
  }

  /* ---- Stretchy large titles: pulling down past the top swells the page title, iOS-style ----------- */
  let stretchRaf = 0;
  function stretchTitle() {
    stretchRaf = 0;
    const y = window.scrollY || 0, el = document.querySelector(MAST[currentTab()]);
    if (!el) return;
    const s = y < 0 && !reduced() ? Math.min(1.12, 1 - y / 900) : 1;
    el.style.transform = s === 1 ? "" : `scale(${s.toFixed(3)})`;
    el.style.transformOrigin = "0 100%";
  }
  function bindStretch() { window.addEventListener("scroll", () => { if (!stretchRaf) stretchRaf = requestAnimationFrame(stretchTitle); }, { passive: true }); }

  /* ---- D80 · Keyboard-safe sheets, calmer weigh-in entry, a guarded gym switch --------------------------
     With the keyboard up, a sheet sits on top of it (its bottom follows the visual viewport, its height is
     capped to what is visible) and its primary button stays pinned in view; the focused field is brought
     into view inside the sheet. The weigh-in field keeps one decimal (the field's own step) and says what
     it wants instead of Safari's "Enter a valid value". Switching gym once today's session has sets asks
     first, because every aim and comparison then reads the other gym's history. */
  function bindSheetKeyboard() {
    const vv = window.visualViewport, de = document.documentElement;
    const sync = () => {
      const sheet = document.querySelector("#modalRoot .modal .sheet");
      const kb = vv ? Math.max(0, Math.round((window.innerHeight || 0) - vv.height - (vv.offsetTop || 0))) : 0;
      const open = !!sheet && kb > 60;
      de.classList.toggle("st-kb-open", open);
      if (open) {
        de.style.setProperty("--st-kb", kb + "px");
        de.style.setProperty("--st-vvh", Math.round(vv.height) + "px");
        const a = document.activeElement;
        if (a && sheet.contains(a) && typeof a.scrollIntoView === "function") a.scrollIntoView({ block: "nearest" });
      }
    };
    if (vv) { vv.addEventListener("resize", sync); vv.addEventListener("scroll", sync); }
    document.addEventListener("focusin", () => setTimeout(sync, 80));
    document.addEventListener("focusout", () => setTimeout(sync, 160));
    document.addEventListener("input", e => {
      const el = e.target;
      if (!el || el.id !== "apx95WeightValue") return;
      el.setCustomValidity("");
      const v = String(el.value || ""), m = /^(\d+)\.(\d{2,})$/.exec(v);
      if (m) el.value = m[1] + "." + m[2].charAt(0);
      el.setAttribute("data-len", String(Math.min(6, Math.max(1, String(el.value || "").length))));
    }, true);
    document.addEventListener("invalid", e => {
      const el = e.target;
      if (el && (el.id === "repsInput" || el.id === "weightInput")) {
        e.preventDefault();
        if (Date.now() - (bindSheetKeyboard.last || 0) < 400) return;
        bindSheetKeyboard.last = Date.now();
        const aim = document.querySelector("#trainPage .st-ref.is-aim");
        if (typeof toast === "function") toast(aim ? "Add the " + (el.id === "repsInput" ? "reps" : "weight") + ", or tap Aim to fill both" : "Add the " + (el.id === "repsInput" ? "reps" : "weight") + " for this set");
        if (aim && !reduced()) { aim.classList.remove("st-nudge"); void aim.offsetWidth; aim.classList.add("st-nudge"); setTimeout(() => aim.classList.remove("st-nudge"), 1300); }
        return;
      }
      if (el && el.id === "apx95WeightValue") el.setCustomValidity(el.validity.valueMissing ? "Enter your weight, like 82.4" : "Use kilograms with one decimal, between 20 and 400 — like 82.4");
    }, true);
  }
  function bindGymGuard() {
    if (typeof cycleGym !== "function" || cycleGym.__strata) return;
    const f = cycleGym;
    cycleGym = async function () {
      try {
        const n = typeof NXT === "object" && NXT.sessionLogs ? NXT.sessionLogs().filter(r => r.setType !== "warmup").length : 0;
        if (n && !(NXT.planDone && NXT.planDone()) && typeof NXP === "object" && NXP.ask) {
          const gyms = state.gyms && state.gyms.length > 1 ? state.gyms : ["AF Redhill", "SUTD"];
          const next = gyms[(Math.max(0, gyms.indexOf(state.gym)) + 1) % gyms.length];
          const ok = await NXP.ask({ title: "Switch to " + next + "?", body: "Today's " + n + " logged " + (n === 1 ? "set stays" : "sets stay") + " with " + state.gym + ". Aims and comparisons will use " + next + "'s history.", ok: "Switch to " + next });
          if (!ok) return;
        }
      } catch (e) { /* fall through to the switch */ }
      return f.apply(this, arguments);
    };
    cycleGym.__strata = true;
  }

  /* ---- D82 · Glance mode ------------------------------------------------------------------------------
     Between sets the phone is usually at arm's length. After eight seconds without a touch during a rest,
     the workout gives way to a near-black glance view: the rest ring and countdown large enough to read
     across the gym, the next load, the exercise and the session's running time. Any touch returns to the
     workout; when the rest runs out it says "Go" and returns by itself, so Log is always one step away.
     Reads the engine's own countdown; nothing is stored. Static under reduced motion. */
  let glEl = null, glShown = false, glTouch = Date.now(), glGo = 0, glQuiet = 0;
  function restLeftNow() { try { return typeof apx96RestRemaining === "function" ? apx96RestRemaining() : 0; } catch (e) { return 0; } }
  function glanceBlocked() {
    const a = document.activeElement;
    return document.hidden || document.documentElement.classList.contains("st-sheet-open") || !!document.getElementById("stAsk") || !!document.getElementById("stFinish") || !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function ensureGlance() {
    if (glEl && glEl.isConnected) return glEl;
    glEl = document.createElement("div");
    glEl.id = "stGlance"; glEl.className = "st-gl"; glEl.hidden = true;
    glEl.setAttribute("role", "button"); glEl.setAttribute("tabindex", "-1");
    glEl.innerHTML = '<div class="st-gl-in"><p class="st-gl-ex"></p><div class="st-gl-orb"><i class="st-gl-core"></i><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="st-gl-tr" cx="60" cy="60" r="55" pathLength="1"/><circle class="st-gl-arc" cx="60" cy="60" r="55" pathLength="1"/></svg><div class="st-gl-t"><small>Rest</small><b></b></div></div><p class="st-gl-next"><small>Up next</small><b></b></p><p class="st-gl-meta"></p><p class="st-gl-hint">Tap to return</p></div>';
    /* Returning by hand means "I am looking": Glance waits 20 s before it offers itself again. */
    glEl.addEventListener("click", () => { glQuiet = Date.now() + 20000; hideGlance(); });
    document.body.appendChild(glEl);
    return glEl;
  }
  function sessionClock() {
    try {
      const ts = NXT.sessionLogs().map(r => Number(r.ts) || 0).filter(Boolean);
      if (!ts.length) return "";
      const s = Math.max(0, Math.floor((Date.now() - Math.min(...ts)) / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      return h ? h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0") : m + ":" + String(sec).padStart(2, "0");
    } catch (e) { return ""; }
  }
  function glanceMeta() {
    let setLine = "";
    try { const t = NXT.targetFor(state.exercise), d = NXT.done(state.exercise); setLine = d < Number(t.sets) ? "Set " + (d + 1) + " of " + t.sets : "Extra set"; } catch (e) {}
    const clock = sessionClock();
    return [setLine, clock ? "Session " + clock : ""].filter(Boolean).join("  ·  ");
  }
  function paintGlance() {
    if (!glEl || !glShown) return;
    const meta = glEl.querySelector(".st-gl-meta"), mt = glanceMeta();
    if (meta.textContent !== mt) meta.textContent = mt;
    const left = restLeftNow(), total = (typeof NXP === "object" && NXP.ui && NXP.ui.restTotal) || 90;
    const b = glEl.querySelector(".st-gl-t b");
    if (left > 0) {
      glEl.classList.remove("is-go");
      glEl.classList.toggle("is-final", left <= 10);
      b.textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
      glEl.style.setProperty("--pct", String(Math.max(0, Math.min(100, left / total * 100))));
    } else if (!glEl.classList.contains("is-go")) {
      glEl.classList.add("is-go"); glEl.classList.remove("is-final"); b.textContent = "Go";
      glEl.style.setProperty("--pct", "0");
      clearTimeout(glGo); glGo = setTimeout(hideGlance, 1700);
    }
  }
  function showGlance() {
    if (glShown || glanceBlocked()) return;
    const el = ensureGlance();
    const ex = document.querySelector("#trainPage .st-ex-title"), next = document.querySelector("#trainPage .st-orb-next b");
    el.querySelector(".st-gl-ex").textContent = ex ? ex.textContent.trim() : "";
    el.querySelector(".st-gl-next b").textContent = next ? next.textContent.trim() : "";
    el.querySelector(".st-gl-meta").textContent = glanceMeta();
    el.setAttribute("aria-label", "Rest view. Tap to return to the workout.");
    glShown = true; el.hidden = false; el.classList.remove("is-go", "is-out");
    paintGlance();
  }
  function hideGlance() {
    clearTimeout(glGo);
    glTouch = Date.now();
    if (!glShown || !glEl) return;
    glShown = false;
    if (reduced()) { glEl.hidden = true; return; }
    glEl.classList.add("is-out");
    setTimeout(() => { if (!glShown && glEl) { glEl.hidden = true; glEl.classList.remove("is-out"); } }, 260);
  }
  function glanceTick(inWorkout, rest) {
    if (glShown) { if (!inWorkout) hideGlance(); else paintGlance(); return; }
    if (inWorkout && rest > 3 && Date.now() - glTouch > 8000 && Date.now() > glQuiet) showGlance();
  }
  function bindGlance() {
    const touch = () => { glTouch = Date.now(); };
    document.addEventListener("keydown", () => { if (glShown) hideGlance(); }, true);
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(t => document.addEventListener(t, touch, { capture: true, passive: true }));
    window.addEventListener("scroll", touch, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) hideGlance(); });
  }

  /* ---- Session light: on Train the canvas takes the session's own hue (D54's Dusk palette) ---------- */
  function sessionHue() {
    const t = (typeof state === "object" && state && state.dayType) || "";
    return /^Full/.test(t) ? "full" : t === "Push" ? "push" : t === "Pull" ? "pull" : (t === "Pump" || t === "Legs") ? "legs" : t === "Zone2" ? "walk" : "rest";
  }

  /* ---- Scrub context: the reading's day, as lived — the session lifted and any cardio --------------- */
  function dayDid(date) {
    try {
      const sets = (state.logs || []).filter(r => r && r.date === date && r.setType !== "warmup");
      const bits = [];
      if (sets.length) { const t = sets[0].dayType; bits.push((NXT.label && t ? NXT.label(t) : "Lifted") + " · " + sets.length + (sets.length === 1 ? " set" : " sets")); }
      const mins = (state.cardio || []).filter(r => r && r.date === date).reduce((a, r) => a + (Number(r.duration || r.minutes) || 0), 0);
      if (mins > 0) bits.push(Math.round(mins) + " min cardio");
      return bits.join(" · ");
    } catch (e) { return ""; }
  }

  /* ---- Back where you left off ----------------------------------------------------------------------
     If iOS closed the app mid-rest, the countdown comes back on reopening: the rest the engine started is
     the last set's time plus the engine's own rest length for it (suggestedRestSeconds), so nothing new is
     stored. A +30s added before the app closed is not remembered. On the first workout screen after a
     launch, a finished exercise hands over to the first one with sets left. */
  let resumedRest = false, resumedEx = false;
  function resumeRest() {
    if (resumedRest) return; resumedRest = true;
    try {
      if (typeof NXT !== "object" || typeof state !== "object" || !state || restLeftNow() > 0) return;
      if (NXT.planDone && NXT.planDone()) return;
      const logs = NXT.sessionLogs ? NXT.sessionLogs() : [];
      const last = logs.slice().sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))[0];
      if (!last || !Number(last.ts)) return;
      const planned = last.setType === "warmup" ? 60 : (typeof suggestedRestSeconds === "function" ? Number(suggestedRestSeconds(last.exercise)) || 90 : 90);
      const left = Math.floor((Number(last.ts) + planned * 1000 - Date.now()) / 1000);
      if (left >= 10 && left <= planned && typeof apx96StartRest === "function") {
        apx96StartRest(left);
        if (typeof NXP === "object" && NXP.noteRestTotal) NXP.noteRestTotal(planned);
      }
    } catch (e) { /* the workout is unaffected */ }
  }
  function resumeExercise(page) {
    if (resumedEx || page.id !== "trainPage" || !page.querySelector(".st-train-active")) return;
    resumedEx = true;
    try {
      const list = typeof template === "function" ? template() || [] : [], t = NXT.targetFor(state.exercise);
      if (NXT.done(state.exercise) < Number(t.sets)) return;
      const i = list.findIndex(e => NXT.done(e.name) < Number(e.sets));
      if (i >= 0 && NXT.selectExercise) setTimeout(() => NXT.selectExercise(i), 0);
    } catch (e) {}
  }

  /* ---- D92 · The weigh-in moment ------------------------------------------------------------------
     Saving this morning's reading lands it: a glass card shows the last three weeks of mornings and the
     trend line, the new reading drops onto its place, and the card says how it sits against the trend
     ("0.3 kg below trend", the History wording) and the previous morning — plus "Lowest reading yet"
     when the save itself says so. Same numbers the chart shows; nothing stored. The toast is still
     announced to VoiceOver; the card is what you see. Tap or wait to close. */
  let quietToast = false, wmEl = null, wmT = 0;
  function weighMoment(entry, newLow) {
    try {
      if (!entry || typeof NXT !== "object") return false;
      const rows = NXT.weights(), tr = NXT.trend(rows), pt = tr.find(p => p.date === entry.date);
      const since = NXT.dateAdd(entry.date, -20);
      const morn = NXT.timingRows("Morning").filter(r => r.date >= since && r.date <= entry.date);
      const line = tr.filter(p => p.date >= since && p.date <= entry.date && p.avg !== null);
      if (morn.length < 2 || line.length < 2) return false;
      const W = 300, H = 120, d0 = NXT.dateMs(since), d1 = NXT.dateMs(entry.date);
      const vs = morn.map(r => Number(r.weight)).concat(line.map(p => Number(p.avg)));
      const lo = Math.min(...vs) - .25, hi = Math.max(...vs) + .25;
      const X = d => 10 + (NXT.dateMs(d) - d0) / Math.max(1, d1 - d0) * (W - 20), Y = v => 12 + (hi - v) / (hi - lo) * (H - 24);
      const path = line.map((p, i) => (i ? "L" : "M") + X(p.date).toFixed(1) + " " + Y(Number(p.avg)).toFixed(1)).join("");
      const dots = morn.filter(r => r !== entry && !(r.date === entry.date && Number(r.weight) === Number(entry.weight))).map(r => `<circle cx="${X(r.date).toFixed(1)}" cy="${Y(Number(r.weight)).toFixed(1)}" r="2.6"/>`).join("");
      const w = Number(entry.weight), gap = pt && pt.avg !== null ? w - Number(pt.avg) : null;
      const prev = morn.filter(r => r.date < entry.date).at(-1);
      const chips = [];
      if (gap !== null) chips.push(Math.abs(gap) < .05 ? "On trend" : Math.abs(gap).toFixed(1) + " kg " + (gap < 0 ? "below" : "above") + " trend");
      if (prev) { const dd = w - Number(prev.weight); chips.push((Math.abs(dd) < .05 ? "Same as" : (dd < 0 ? "↓ " : "↑ ") + Math.abs(dd).toFixed(1) + " kg vs") + " " + (NXT.dateAdd(prev.date, 1) === entry.date ? "yesterday" : NXT.shortDate(prev.date))); }
      if (newLow) chips.unshift("Lowest reading yet");
      clearTimeout(wmT);
      if (wmEl) wmEl.remove();
      wmEl = document.createElement("div");
      wmEl.className = "st-wm"; wmEl.setAttribute("aria-hidden", "true");
      const ex = X(entry.date), ey = Y(w);
      wmEl.innerHTML = `<div class="st-wm-card${newLow ? " is-low" : ""}"><p class="st-wm-eb">Morning · ${esc(NXT.shortDate(entry.date))}</p><p class="st-wm-v"><b>${w.toFixed(1)}</b><small>kg</small></p>
        <svg class="st-wm-g" viewBox="0 0 ${W} ${H}"><path class="st-wm-tr" d="${path}" pathLength="1"/><g class="st-wm-d">${dots}</g><line class="st-wm-drop" x1="${ex.toFixed(1)}" x2="${ex.toFixed(1)}" y1="0" y2="${ey.toFixed(1)}"/><circle class="st-wm-halo" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="11"/><circle class="st-wm-new" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5" style="--dy:${(-ey).toFixed(1)}px"/></svg>
        <p class="st-wm-chips">${chips.map(c => `<span>${esc(c)}</span>`).join("")}</p></div>`;
      wmEl.addEventListener("click", () => closeWm());
      const el = wmEl;
      setTimeout(() => { if (wmEl === el) { document.body.appendChild(el); wmT = setTimeout(closeWm, reduced() ? 2600 : 3600); } }, 260);
      return true;
    } catch (e) { return false; /* the save itself already happened */ }
  }
  function closeWm() {
    clearTimeout(wmT);
    if (!wmEl) return;
    const el = wmEl; wmEl = null;
    el.classList.add("is-out"); setTimeout(() => el.remove(), reduced() ? 0 : 320);
  }
  function bindWeighMoment() {
    if (typeof apx95SaveQuickWeight !== "function" || apx95SaveQuickWeight.__strataWM) return;
    const f = apx95SaveQuickWeight;
    apx95SaveQuickWeight = function () {
      const before = state && Array.isArray(state.bws) ? state.bws.length : 0;
      const prior = typeof NXT === "object" ? NXT.weights().map(r => Number(r.weight)) : [];
      quietToast = true;
      let out;
      try { out = f.apply(this, arguments); } finally { quietToast = false; }
      const after = state && Array.isArray(state.bws) ? state.bws.length : 0;
      let shown = false;
      if (after > before) {
        const e = state.bws[state.bws.length - 1];
        const morning = String(e && e.timeOfDay || "Morning") === "Morning";
        const newLow = morning && prior.length >= 5 && Number(e.weight) < Math.min(...prior);
        if (morning) shown = weighMoment(e, newLow);
      }
      /* Anything the moment does not replace — a validation message, a non-morning save — is shown as usual. */
      if (!shown) { const t = document.getElementById("toast"); if (t) t.classList.remove("is-quiet"); }
      return out;
    };
    apx95SaveQuickWeight.__strataWM = true;
    apx95SaveQuickWeight.__strataH = true;
  }

  /* D103 · Today's weigh-in pill replays this morning's moment (same card, nothing new computed). */
  function moment() {
    try {
      if (typeof NXT !== "object" || typeof state !== "object" || !state) return false;
      const e = NXT.timingRows("Morning").filter(r => r && r.date === state.date).at(-1);
      return e ? weighMoment(e, false) : false;
    } catch (err) { return false; }
  }

  /* ---- D103 · Morph: one region changes layout as one movement -------------------------------------
     Today's coach deck fans out and folds back with a View Transition: each card in the region, its
     header and everything after it on the page carry a transition name for the length of the change,
     so cards travel to their places and the page below slides instead of jumping. The page itself does
     not fade (the tab transition's root animation is switched off for it). Plain change without support,
     under reduced motion, or while a tab transition is running. */
  function morph(scope, mutate) {
    const de = document.documentElement;
    if (!scope || typeof document.startViewTransition !== "function" || reduced() || document.hidden || de.hasAttribute("data-st-nav") || de.hasAttribute("data-st-morph")) return mutate();
    const named = [];
    const tag = (el, n) => { if (el && el.getClientRects().length) { el.style.viewTransitionName = n; named.push(el); } };
    const untag = () => { named.splice(0).forEach(el => { el.style.viewTransitionName = ""; }); };
    tag(scope.querySelector(".st-codeck-h"), "st-mh");
    scope.querySelectorAll(".co-tile").forEach((el, i) => tag(el, "st-mo-" + i));
    const page = scope.closest(".page") || document.body;
    let k = 0;
    for (let el = scope; el && el !== page; el = el.parentElement)
      for (let sib = el.nextElementSibling; sib; sib = sib.nextElementSibling) tag(sib, "st-ms-" + k++);
    de.setAttribute("data-st-morph", "");
    const done = () => { untag(); de.removeAttribute("data-st-morph"); };
    try {
      const t = document.startViewTransition(() => { mutate(); });
      t.finished.then(done, done);
      if (t.ready && t.ready.catch) t.ready.catch(() => {});
      if (t.updateCallbackDone && t.updateCallbackDone.catch) t.updateCallbackDone.catch(() => {});
    } catch (e) { done(); mutate(); }
  }

  /* ---- D93 · The Observatory ------------------------------------------------------------------------
     Your sky, explorable. Every lifting session is a star, gathered into one constellation per routine and
     laid out on a sunflower spiral in the order you trained (the first session at the centre); walks have
     their own cluster. A star is brighter and larger with more working sets; a four-point flare marks a
     session that set a new best (D27's rule: heaviest load, then most reps, against every earlier session
     of that exercise). Drag to pan, pinch or scroll to zoom, tap a star for its session and open it in
     History. Read-only; nothing stored or scored. */
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const OBS_HUE = { FullA: "#A78BFA", FullB: "#C4B5FD", FullC: "#8B5CF6", Push: "#BF75C5", Pull: "#7C83F5", Pump: "#E06C9F", Legs: "#E06C9F", Zone2: "#E39A5C", Floorball: "#E2B04A" };
  let obs = null;
  function obsData() {
    const rows = NXT.workRows().filter(r => Number(r.weight) > 0).slice().sort((a, b) => a.date.localeCompare(b.date) || (Number(a.ts || 0) - Number(b.ts || 0)));
    const sessions = new Map();
    for (const r of rows) {
      const k = r.date + "|" + (r.gym || "Gym A") + "|" + (r.dayType || "Lift");
      let s = sessions.get(k);
      if (!s) { s = { key: k, date: r.date, gym: r.gym || "Gym A", type: r.dayType || "Lift", sets: 0, rows: [], pr: false, kind: "lift" }; sessions.set(k, s); }
      s.sets++; s.rows.push(r);
    }
    const best = new Map(), beats = (a, b) => Number(a.weight) > Number(b.weight) || (Number(a.weight) === Number(b.weight) && Number(a.reps) > Number(b.reps));
    const lifts = [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const s of lifts) {
      const byEx = {};
      s.rows.forEach(r => { const e = r.exercise || r.name; (byEx[e] = byEx[e] || []).push(r); });
      s.exercises = Object.keys(byEx).length; s.bests = [];
      for (const [ex, sets] of Object.entries(byEx)) {
        const a = NXT.bestSet(sets); if (!a) continue;
        const b = best.get(ex);
        if (b && beats(a, b)) { s.pr = true; s.bests.push(ex + " " + a.weight + " kg × " + a.reps); }
        if (!b || beats(a, b)) best.set(ex, a);
      }
    }
    const walks = new Map();
    (state.cardio || []).forEach(c => { const m = Number(c && (c.duration || c.minutes)); if (!c || !(m > 0) || typeof c.date !== "string" || c.date > state.date) return; const w = walks.get(c.date) || { key: "walk|" + c.date, date: c.date, type: "Zone2", kind: "walk", minutes: 0 }; w.minutes += m; walks.set(c.date, w); });
    const order = NXT.typeNames ? NXT.typeNames() : [];
    const groups = [];
    /* Grouped by the name the app shows: older "Legs" records and today's "Legs" (stored as Pump, D33)
       are one constellation, while the stored records stay exactly as they are. */
    const byName = new Map();
    lifts.forEach(s => { const n = NXT.label(s.type); if (!byName.has(n)) byName.set(n, { type: s.type, items: [] }); byName.get(n).items.push(s); });
    const rank = t => { const i = order.indexOf(t); return i < 0 ? 99 : i; };
    [...byName.entries()].sort((a, b) => rank(a[1].type) - rank(b[1].type)).forEach(([n, G]) => groups.push({ type: G.type, name: n, items: G.items.sort((a, b) => a.date.localeCompare(b.date)) }));
    const wl = [...walks.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (wl.length) groups.push({ type: "Zone2", name: "Walks", items: wl });
    /* Constellations sit on a ring sized by the largest one, so a few sessions stay close and readable. */
    const g = groups.length, maxR = Math.max(0, ...groups.map(G => 12 * Math.sqrt(G.items.length + .6) + 8));
    const R = g === 1 ? 0 : Math.max(70, maxR * 2.1 + 28 + 6 * g);
    let gi = 0;
    groups.forEach((G, i) => {
      const a = -Math.PI / 2 + i / Math.max(1, g) * Math.PI * 2;
      G.cx = R * Math.cos(a); G.cy = R * Math.sin(a) * .82;
      G.items.forEach((s, j) => {
        const r = 12 * Math.sqrt(j + .6), th = j * GOLD;
        s.x = G.cx + r * Math.cos(th); s.y = G.cy + r * Math.sin(th);
        s.r = s.kind === "walk" ? 1.3 + Math.min(2.6, s.minutes / 25) : 1.5 + Math.min(3.1, s.sets / 5);
        s.hue = OBS_HUE[G.type] || "#B49AFF"; s.gi = gi++;
      });
      G.r = 12 * Math.sqrt(G.items.length + .6) + 8;
    });
    const all = groups.flatMap(G => G.items);
    return { groups, all, lifts: lifts.length, walks: wl.length, first: all.length ? all.map(s => s.date).sort()[0] : null };
  }
  function observatory() {
    if (typeof NXT !== "object") return;
    closeObservatory(true);
    const D = obsData();
    const el = document.createElement("div");
    el.id = "stObs"; el.className = "st-obs";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "st-obs-t");
    let dust = "";
    let sd = 9;
    const rnd = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < 140; i++) dust += `<circle cx="${(rnd() * 140 - 20).toFixed(1)}%" cy="${(rnd() * 140 - 20).toFixed(1)}%" r="${(.4 + rnd() * .9).toFixed(2)}" style="--d:${(rnd() * 6).toFixed(2)}s;opacity:${(.15 + rnd() * .45).toFixed(2)}"/>`;
    const groupsSvg = D.groups.map(G => {
      const ln = G.items.length > 1 ? `<path class="st-obs-ln" d="${G.items.map((s, j) => (j ? "L" : "M") + s.x.toFixed(1) + " " + s.y.toFixed(1)).join("")}" stroke="${G.items[0].hue}" pathLength="1"/>` : "";
      const glow = `<circle class="st-obs-neb" cx="${G.cx.toFixed(1)}" cy="${G.cy.toFixed(1)}" r="${(G.r * 1.6).toFixed(1)}" fill="${G.items[0].hue}"/>`;
      const stars = G.items.map(s => `<g class="st-obs-s${s.pr ? " is-pr" : ""}" data-k="${esc(s.key)}" style="--i:${s.gi};--h:${s.hue}" transform="translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})"><g class="st-obs-si">${s.pr ? `<path class="st-obs-flare" d="M0 -${(s.r * 3.4).toFixed(1)}L${(s.r * .45).toFixed(1)} 0L0 ${(s.r * 3.4).toFixed(1)}L-${(s.r * .45).toFixed(1)} 0ZM-${(s.r * 3.4).toFixed(1)} 0L0 ${(s.r * .45).toFixed(1)}L${(s.r * 3.4).toFixed(1)} 0L0 -${(s.r * .45).toFixed(1)}Z"/>` : ""}<circle class="st-obs-halo" r="${(s.r * 2.6).toFixed(1)}"/><circle class="st-obs-core" r="${s.r.toFixed(2)}"/></g></g>`).join("");
      const lab = `<text class="st-obs-lab" x="${G.cx.toFixed(1)}" y="${(G.cy + G.r + 16).toFixed(1)}" text-anchor="middle">${esc(G.name)}<tspan x="${G.cx.toFixed(1)}" dy="15">${G.items.length} ${G.type === "Zone2" ? (G.items.length === 1 ? "walk" : "walks") : (G.items.length === 1 ? "session" : "sessions")}</tspan></text>`;
      return `<g class="st-obs-g">${glow}${ln}${stars}${lab}</g>`;
    }).join("");
    const count = D.lifts + " lifting " + (D.lifts === 1 ? "session" : "sessions") + (D.walks ? " · " + D.walks + " " + (D.walks === 1 ? "walk" : "walks") : "");
    const list = D.all.slice().sort((a, b) => a.date.localeCompare(b.date)).map(s => `<li><button type="button" data-k="${esc(s.key)}">${esc(NXT.shortDate(s.date))} · ${esc(s.kind === "walk" ? "Walk · " + Math.round(s.minutes) + " min" : NXT.label(s.type) + " · " + s.sets + " sets")}${s.pr ? " · new best" : ""}</button></li>`).join("");
    el.innerHTML = `<div class="st-obs-bg" aria-hidden="true"></div>
      <svg class="st-obs-svg" aria-hidden="true"><g class="st-obs-dust">${dust}</g><g class="st-obs-world">${groupsSvg}</g></svg>
      <header class="st-obs-head"><div><p class="st-obs-eb">The Observatory</p><h2 id="st-obs-t">Your sky</h2><p class="st-obs-sub">${D.all.length ? esc(count) + (D.first ? " · since " + esc(NXT.shortDate(D.first)) : "") : "Log a session and its star appears here."}</p></div><button type="button" class="st-obs-x" aria-label="Close">×</button></header>
      <p class="st-obs-legend" aria-hidden="true"><span><i></i>A session, brighter with more sets</span><span><i class="is-pr"></i>A new best</span></p>
      <section class="st-obs-card" hidden aria-live="polite"></section>
      <ul class="st-sr st-obs-list" aria-label="Sessions">${list}</ul>`;
    document.body.appendChild(el);
    if (typeof iconify === "function") iconify(el.querySelector(".st-obs-head"));
    const svg = el.querySelector(".st-obs-svg"), world = el.querySelector(".st-obs-world"), dustG = el.querySelector(".st-obs-dust");
    const view = { x: 0, y: 0, k: 1 };
    const size = () => svg.getBoundingClientRect();
    const apply = () => {
      const r = size();
      world.setAttribute("transform", `translate(${(r.width / 2).toFixed(1)} ${(r.height / 2 + 10).toFixed(1)}) scale(${view.k.toFixed(3)}) translate(${(-view.x).toFixed(1)} ${(-view.y).toFixed(1)})`);
      dustG.setAttribute("transform", `translate(${(-view.x * .12 * view.k).toFixed(1)} ${(-view.y * .12 * view.k).toFixed(1)})`);
    };
    const fit = () => {
      const r = size(); if (!D.all.length) return;
      const xs = D.all.map(s => s.x), ys = D.all.map(s => s.y);
      const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 70;
      view.x = (x0 + x1) / 2; view.y = (y0 + y1) / 2;
      view.k = Math.max(.5, Math.min(3, Math.min(r.width / (x1 - x0), (r.height - 220) / (y1 - y0))));
      apply();
    };
    const card = el.querySelector(".st-obs-card");
    const select = key => {
      el.querySelectorAll(".st-obs-s.is-sel").forEach(g => g.classList.remove("is-sel"));
      const s = D.all.find(x => x.key === key); if (!s) { card.hidden = true; return; }
      const g = el.querySelector(`.st-obs-s[data-k="${CSS.escape(key)}"]`); if (g) g.classList.add("is-sel");
      const day = new Date(NXT.dateMs(s.date)).toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
      card.innerHTML = `<p class="st-obs-c-eb" style="--h:${s.hue}"><i></i>${esc(s.kind === "walk" ? "Walk" : NXT.label(s.type))}${s.kind === "walk" ? "" : " · " + esc(s.gym)}</p><h3>${esc(day)}</h3>
        <p class="st-obs-c-v">${s.kind === "walk" ? `<b>${Math.round(s.minutes)}</b> min` : `<b>${s.sets}</b> working ${s.sets === 1 ? "set" : "sets"} · <b>${s.exercises}</b> ${s.exercises === 1 ? "exercise" : "exercises"}`}</p>
        ${s.pr && s.bests.length ? `<p class="st-obs-c-pr">New best · ${esc(s.bests.slice(0, 2).join(" · "))}</p>` : ""}
        <button type="button" class="st-obs-open">Open in History</button>`;
      card.hidden = false;
      card.querySelector(".st-obs-open").addEventListener("click", () => { closeObservatory(); if (currentTab() !== "history") switchTab("history"); setTimeout(() => { if (typeof NXP === "object" && NXP.historySelect) NXP.historySelect(s.date); }, 80); });
    };
    el.querySelector(".st-obs-list").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (b) select(b.dataset.k); });
    el.querySelector(".st-obs-x").addEventListener("click", () => closeObservatory());
    /* pan · pinch · wheel · tap */
    const pts = new Map(); let start = null, pinch = null;
    svg.addEventListener("pointerdown", e => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; } });
    svg.addEventListener("pointermove", e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { view.x -= dx / view.k; view.y -= dy / view.k; if (start) start.moved += Math.abs(dx) + Math.abs(dy); apply(); }
      else if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); view.k = Math.max(.4, Math.min(5, pinch.k * d / Math.max(1, pinch.d))); if (start) start.moved = 99; apply(); }
    });
    const up = e => {
      const r = size();
      if (pts.size === 1 && start && start.moved < 8 && performance.now() - start.t < 400) {
        const wx = view.x + (e.clientX - r.left - r.width / 2) / view.k, wy = view.y + (e.clientY - r.top - r.height / 2 - 10) / view.k;
        let hit = null, bd = 26 / view.k;
        D.all.forEach(s => { const d = Math.hypot(s.x - wx, s.y - wy); if (d < bd) { bd = d; hit = s; } });
        if (hit) { select(hit.key); haptic("tick"); } else { card.hidden = true; el.querySelectorAll(".st-obs-s.is-sel").forEach(g => g.classList.remove("is-sel")); }
      }
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) start = null;
    };
    svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", e => { pts.delete(e.pointerId); pinch = null; start = null; });
    svg.addEventListener("wheel", e => { e.preventDefault(); view.k = Math.max(.4, Math.min(5, view.k * Math.exp(-e.deltaY * .0015))); apply(); }, { passive: false });
    const key = e => { if (e.key === "Escape") { e.preventDefault(); closeObservatory(); } };
    document.addEventListener("keydown", key, true);
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    obs = { el, key, onResize, back: document.activeElement };
    document.documentElement.classList.add("st-obs-open");
    fit();
    el.querySelector(".st-obs-x").focus({ preventScroll: true });
  }
  function closeObservatory(now) {
    if (!obs) return;
    const o = obs; obs = null;
    document.removeEventListener("keydown", o.key, true);
    window.removeEventListener("resize", o.onResize);
    document.documentElement.classList.remove("st-obs-open");
    if (now || reduced()) o.el.remove(); else { o.el.classList.add("is-out"); setTimeout(() => o.el.remove(), 320); }
    try { if (o.back && o.back.focus && document.contains(o.back)) o.back.focus(); } catch (e) {}
  }

  /* D69 · Living sky. The canvas follows the device clock (the clock the greeting already reads):
     dawn 05–09, day 09–17, dusk 17–21, night 21–05. Presentation only; refreshed every five minutes
     and whenever the app comes back to the foreground. sky(name) pins a state (verification only). */
  let skyPinned = null;
  function skyFor(h) { return h >= 5 && h < 9 ? "dawn" : h >= 9 && h < 17 ? "day" : h >= 17 && h < 21 ? "dusk" : "night"; }
  function setSky() { document.documentElement.setAttribute("data-st-sky", skyPinned || skyFor(new Date().getHours())); }
  function sky(name) { skyPinned = /^(dawn|day|dusk|night)$/.test(String(name)) ? String(name) : null; setSky(); return document.documentElement.getAttribute("data-st-sky"); }
  function bindSky() {
    setSky();
    setInterval(setSky, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setSky(); });
    window.addEventListener("pageshow", setSky);
  }

  /* Scroll position feeds the canvas parallax (a CSS variable, so no per-frame layout). */
  function bindParallax() {
    let raf = 0;
    const set = () => { raf = 0; document.documentElement.style.setProperty("--st-sy", String(Math.round(window.scrollY || 0))); };
    window.addEventListener("scroll", () => { if (!raf && !reduced()) raf = requestAnimationFrame(set); }, { passive: true });
  }
  /* ---- D87 · Touch light ---------------------------------------------------------------------------
     The tap ripple (D38), made continuous: glass catches light under the finger, the light follows it
     while pressed, and on release it opens out and fades. Off under reduced motion. */
  const LIT = ".st-tile,.st-qa,.st-cta,.st-chip,.st-plan-row,.st-dec-chip,.vn-row,.vn-set-row,.st-lrow>button,.co-tile,.st-wpill,.st-codeck-open,.st-share-b,.vn-set-act,.st-fin-done,.st-fin-cardio,.st-ask-acts button,.nxp-cal-day,.st-live,.st-dk-menu button";
  let lit = null;
  function bindRipple() {
    const end = () => {
      if (!lit) return;
      const c = lit; lit = null;
      c.sp.classList.remove("is-held"); c.sp.classList.add("is-out");
      setTimeout(() => c.sp.remove(), 560);
    };
    document.addEventListener("pointerdown", e => {
      if (reduced() || (e.pointerType === "mouse" && e.button !== 0)) return;
      const host = e.target && e.target.closest && e.target.closest(LIT);
      if (!host || host.disabled) return;
      end();
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      const r = host.getBoundingClientRect(), sp = document.createElement("span");
      sp.className = "st-ripple"; sp.setAttribute("aria-hidden", "true");
      const i = document.createElement("i");
      const d = Math.round(Math.min(440, Math.max(160, Math.max(r.width, r.height) * 1.4)));
      i.style.width = i.style.height = d + "px";
      i.style.left = (e.clientX - r.left - d / 2) + "px"; i.style.top = (e.clientY - r.top - d / 2) + "px";
      sp.appendChild(i); host.appendChild(sp);
      lit = { sp, i, host, id: e.pointerId, d };
      requestAnimationFrame(() => { if (lit && lit.sp === sp) sp.classList.add("is-held"); });
    }, true);
    document.addEventListener("pointermove", e => {
      if (!lit || e.pointerId !== lit.id) return;
      const r = lit.host.getBoundingClientRect();
      lit.i.style.left = (e.clientX - r.left - lit.d / 2) + "px"; lit.i.style.top = (e.clientY - r.top - lit.d / 2) + "px";
    }, { capture: true, passive: true });
    ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, e => { if (lit && e.pointerId === lit.id) end(); }, true));
  }

  /* ---- D89 · Dock shortcuts --------------------------------------------------------------------------
     Long-press a dock tab (or right-click it) for that tab's shortcuts, like an iPhone app icon. Each item
     calls a function the app already has; a normal tap still just switches tab. */
  function shortcuts(tab) {
    const go = (t, f) => () => { if (currentTab() !== t) switchTab(t); f && f(); };
    const view = v => () => { if (typeof NXT === "object") NXT.ui.view = v; if (currentTab() !== "weight") switchTab("weight"); else if (typeof render === "function") render(); };
    const hist = f => () => { if (typeof state === "object") state.historyFilter = f; if (currentTab() !== "history") switchTab("history"); else if (typeof render === "function") render(); };
    const s = liveSession(), lift = typeof state === "object" && state && !["Rest", "Zone2", "Floorball"].includes(state.dayType);
    const sessionName = typeof NXT === "object" && state ? NXT.label(state.dayType) : "";
    const L = {
      home: [["Log weight", () => apx95OpenQuickWeight()], ["Log cardio", () => showCardioSheet()]],
      train: [lift ? [s ? "Resume " + sessionName : "Start " + sessionName, () => NXP.enterTrain()] : null, ["Change today's session", () => showSessionSheet()], ["Log cardio", () => showCardioSheet()]],
      weight: [["Weight", view("overview")], ["Training", view("training")], ["Lifts", view("strength")], ["Body", view("body")], ["Log weight", () => apx95OpenQuickWeight()], ["Play your cut", () => story()], ["Share your cut", () => NXP.shareProgress && NXP.shareProgress()]],
      history: [["Your sky", () => observatory()], ["Today", go("history", () => NXP.historySelect && NXP.historySelect(localToday()))], ["Lifting days", hist("strength")], ["Weigh-ins", hist("body")], ["Cardio", hist("conditioning")]],
      more: [["Training plan", () => NXT.more("training")], ["Data & sync", () => NXT.more("data")], ["Appearance", () => NXT.more("appearance")]]
    };
    return (L[tab] || []).filter(Boolean);
  }
  let dk = null, dkSwallow = 0;
  function closeDock() {
    if (!dk) return;
    const m = dk; dk = null;
    document.removeEventListener("keydown", m.key, true);
    m.el.classList.add("is-out");
    setTimeout(() => m.el.remove(), reduced() ? 0 : 200);
    try { if (m.back && m.back.focus) m.back.focus(); } catch (e) {}
  }
  function openDock(btn) {
    closeDock();
    const tab = btn && btn.dataset && btn.dataset.tab, items = tab ? shortcuts(tab) : [];
    if (!items.length) return;
    const el = document.createElement("div");
    el.className = "st-dk";
    el.innerHTML = '<div class="st-dk-scrim"></div><div class="st-dk-menu" role="menu" aria-label="' + esc((TITLES[tab] || "Tab") + " shortcuts") + '">' + items.map(([t], i) => '<button type="button" role="menuitem" data-i="' + i + '">' + esc(t) + '</button>').join("") + "</div>";
    document.body.appendChild(el);
    const menu = el.querySelector(".st-dk-menu"), r = btn.getBoundingClientRect(), mw = Math.min(260, window.innerWidth - 24);
    menu.style.width = mw + "px";
    menu.style.left = Math.max(12, Math.min(window.innerWidth - mw - 12, r.left + r.width / 2 - mw / 2)) + "px";
    menu.style.bottom = Math.round(window.innerHeight - r.top + 14) + "px";
    menu.style.setProperty("--ox", Math.round(r.left + r.width / 2 - parseFloat(menu.style.left)) + "px");
    const key = e => {
      const b = [...menu.querySelectorAll("button")], i = b.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); closeDock(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); b[(i + (e.key === "ArrowDown" ? 1 : -1) + b.length) % b.length].focus(); }
      else if (e.key === "Tab") { e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); }
    };
    dk = { el, key, back: btn };
    document.addEventListener("keydown", key, true);
    el.querySelector(".st-dk-scrim").addEventListener("click", closeDock);
    menu.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const f = items[Number(b.dataset.i)] && items[Number(b.dataset.i)][1];
      dk.back = null; closeDock();
      try { f && f(); } catch (err) { console.error(err); }
    });
    haptic("tick");
    menu.querySelector("button").focus({ preventScroll: true });
  }
  function bindDockShortcuts() {
    let t = 0, sx = 0, sy = 0, btn = null;
    const cancel = () => { clearTimeout(t); t = 0; btn = null; };
    document.addEventListener("pointerdown", e => {
      const b = e.target && e.target.closest && e.target.closest(".tabs .tab");
      if (!b || (e.pointerType === "mouse" && e.button !== 0)) return;
      btn = b; sx = e.clientX; sy = e.clientY;
      clearTimeout(t); t = setTimeout(() => { if (btn) { dkSwallow = Date.now() + 700; openDock(btn); btn = null; } }, 440);
    }, true);
    document.addEventListener("pointermove", e => { if (btn && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); }, { capture: true, passive: true });
    ["pointerup", "pointercancel"].forEach(n => document.addEventListener(n, cancel, true));
    document.addEventListener("click", e => {
      if (Date.now() < dkSwallow && e.target && e.target.closest && e.target.closest(".tabs .tab")) { e.preventDefault(); e.stopImmediatePropagation(); dkSwallow = 0; }
    }, true);
    document.addEventListener("contextmenu", e => {
      const b = e.target && e.target.closest && e.target.closest(".tabs .tab");
      if (!b) return;
      e.preventDefault(); cancel(); openDock(b);
    }, true);
  }

  /* ---- D90 · Pull at the top -------------------------------------------------------------------------
     The page sets overscroll-behavior:none, so iOS never rubber-bands and a pull at the top did nothing.
     A pull now stretches the page and its title with a rubber band; on Today, pulling past the line and
     letting go opens the weigh-in. Not inside sheets, fields, the chart, the week rail, the calendar or
     an active workout. Reduced motion: no stretch, the pull still works. */
  let pullEl = null;
  function ensurePullHint() {
    if (pullEl && pullEl.isConnected) return pullEl;
    pullEl = document.createElement("div");
    pullEl.id = "stPull"; pullEl.className = "st-pull"; pullEl.setAttribute("aria-hidden", "true");
    pullEl.innerHTML = '<i class="st-pull-dot"></i><span>Pull to weigh in</span>';
    document.body.appendChild(pullEl);
    return pullEl;
  }
  function applyPull(px, settle, armed) {
    const main = document.querySelector("main"), still = reduced();
    if (main) {
      main.style.transition = settle ? "transform .5s cubic-bezier(.32,.72,0,1)" : "none";
      main.style.transform = px && !still ? "translateY(" + px.toFixed(1) + "px)" : "";
      if (settle) setTimeout(() => { if (main.style.transform === "") main.style.transition = ""; }, 520);
    }
    const t = document.querySelector(MAST[currentTab()]);
    if (t) { t.style.transformOrigin = "0 100%"; t.style.transition = settle ? "transform .5s cubic-bezier(.32,.72,0,1)" : "none"; t.style.transform = px && !still ? "scale(" + (1 + Math.min(px, 120) / 900).toFixed(3) + ")" : ""; }
    if (currentTab() === "home") {
      const h = ensurePullHint();
      h.style.setProperty("--p", String(Math.min(1, px / 70)));
      h.classList.toggle("is-on", px > 6);
      h.classList.toggle("is-armed", !!armed);
      h.querySelector("span").textContent = armed ? "Release to weigh in" : "Pull to weigh in";
    } else if (pullEl) pullEl.classList.remove("is-on", "is-armed");
  }
  function bindPull() {
    let y0 = null, x0 = 0, pulling = false, px = 0, armed = false;
    const blocked = t => !t || !t.closest || !!t.closest("#modalRoot,input,textarea,select,#vn-chart-wrap,.st-jr-rail,.st-ev-g,.st-story,.st-goal,.st-gl,.st-fin,.st-ask,.st-dk,.vn-week,[data-rail],.nxp-cal-grid,.tabs,#stTop,.st-shr");
    document.addEventListener("touchstart", e => {
      y0 = null;
      if (e.touches.length !== 1 || (window.scrollY || 0) > 0 || blocked(e.target)) return;
      if (document.documentElement.classList.contains("st-sheet-open") || document.querySelector("#trainPage .st-train-active")) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; pulling = false; px = 0; armed = false;
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!pulling) {
        if (dy > 8 && dy > Math.abs(dx) * 1.4 && (window.scrollY || 0) <= 0) pulling = true;
        else { if (dy < -4 || Math.abs(dx) > 14) y0 = null; return; }
      }
      px = 118 * (1 - Math.exp(-Math.max(0, dy) / 170));
      const was = armed;
      armed = currentTab() === "home" && px > 70;
      if (armed && !was) haptic("tick");
      applyPull(px, false, armed);
    }, { passive: true });
    const release = () => {
      if (y0 === null && !pulling) return;
      const go = pulling && armed;
      y0 = null; pulling = false; armed = false;
      applyPull(0, true, false);
      if (go && typeof apx95OpenQuickWeight === "function") setTimeout(() => apx95OpenQuickWeight(), 120);
    };
    document.addEventListener("touchend", release, { passive: true });
    document.addEventListener("touchcancel", release, { passive: true });
  }

  function hydrate(page) {
    if (!page) return;
    if (page.id === "homePage") setTimeout(goalCheck, 1400);
    const tab = (typeof state === "object" && state && state.tab) || "home";
    const entering = state0.lastTab !== tab;
    state0.lastTab = tab;
    document.documentElement.setAttribute("data-st-tab", tab);
    document.documentElement.setAttribute("data-st-session", sessionHue());
    stopReplay();
    page.classList.toggle("st-enter", entering && !reduced());
    if (entering && !reduced()) setTimeout(() => page.classList.remove("st-enter"), 1400);
    page.querySelectorAll("[data-st-odo]").forEach(o => odoSet(o, o.dataset.stOdo, entering));
    page.querySelectorAll("[data-st-cmap]").forEach(h => drawCompMap(h, entering));
    if (entering) page.querySelectorAll("[data-st-count]").forEach(countUp);
    dressProgress(page);
    dressWeeks(page, entering);
    foldPerf(page);
    foldBody(page);
    if (page.id === "trainPage") bindTrain(page);
    bindProgressReplay(page);
    if (page.id === "weightPage") {
      dressChartHead();
      /* D85's Share button is part of the Cut journey markup now (D95), so nothing is injected here. */
      bindJourney(page);
      bindEvidence(page);
      setTimeout(goalCheck, 900);
    }
    resumeRest();
    resumeExercise(page);
    bindView(page, entering);
    syncDock();
    queueTop();
    updateLive();
    paintStars();
  }
  function install() {
    /* The global render slots are `let`/function bindings in index.html, so
       they are reassigned through their own names rather than window[...]. */
    try {
      if (typeof renderHome === "function" && !renderHome.__strata) { const f = renderHome; renderHome = function () { const o = f.apply(this, arguments); hydrate(document.getElementById("homePage")); return o; }; renderHome.__strata = true; }
      if (typeof renderTrain === "function" && !renderTrain.__strata) { const f = renderTrain; renderTrain = function () { const o = f.apply(this, arguments); hydrate(document.getElementById("trainPage")); return o; }; renderTrain.__strata = true; }
      if (typeof renderWeight === "function" && !renderWeight.__strata) { const f = renderWeight; renderWeight = function () { const o = f.apply(this, arguments); hydrate(document.getElementById("weightPage")); return o; }; renderWeight.__strata = true; }
      if (typeof renderHistory === "function" && !renderHistory.__strata) { const f = renderHistory; renderHistory = function () { const o = f.apply(this, arguments); hydrate(document.getElementById("historyPage")); return o; }; renderHistory.__strata = true; }
      if (typeof renderMore === "function" && !renderMore.__strata) { const f = renderMore; renderMore = function () { const o = f.apply(this, arguments); hydrate(document.getElementById("morePage")); return o; }; renderMore.__strata = true; }
    } catch (e) { console.error(e); }
    bindSpotlight();
    bindStepBump();
    bindSheets();
    if (typeof NXT === "object" && typeof NXT.selectPoint === "function" && !NXT.selectPoint.__strata) {
      const sp = NXT.selectPoint;
      NXT.selectPoint = function (index, opts) { const o = sp.apply(this, arguments); try { progressTip(index, opts); weeksSync(index); weeksReplay(index); jrFromChart(index, opts); noteChipSync(index); if (index !== lastScrub && !(opts && opts.clear)) { if (lastScrub !== -1 && !JR.dragging) haptic("tick"); lastScrub = index; } } catch (e) {} return o; };
      NXT.selectPoint.__strata = true;
    }
    bindCalSwipe();
    bindIcons();
    bindRipple();
    bindParallax();
    bindSky();
    bindTop();
    bindLive();
    bindHaptics();
    bindIsland();
    bindStretch();
    bindSheetKeyboard();
    bindGymGuard();
    bindGlance();
    bindDockShortcuts();
    bindPull();
    bindWeighMoment();
    if (typeof switchTab === "function" && !switchTab.__strata) {
      const f = switchTab;
      switchTab = function () { return navigate(f, arguments); };
      switchTab.__strata = true;
    }
    bindPress();
    queueSegs();
    document.addEventListener("pointerup", e => {
      const w = e.target && e.target.closest && e.target.closest("#vn-chart-wrap");
      if (w) setTimeout(() => { const t = w.querySelector(".st-tip"); if (t) t.hidden = true; }, 1400);
    }, true);
    let rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        document.querySelectorAll("[data-st-cmap]").forEach(h => drawCompMap(h, false));
        fitTrain();
      }, 150);
    });
    document.documentElement.classList.add("st-on");
  }

  /* ---- D96 · Cut journey and Evidence, interactive -------------------------------------------------------
     One time cursor for the Weight view. The chart's selection (scrub, replay, a week row) rewinds the Cut
     journey to that day; dragging the journey's bar, its arrow keys or a milestone move the chart's selection
     when that day is on the chart. Every figure is the journey's own level series (D97) shipped in
     data-st-jr: nothing here goes beyond a lookup, a difference and a position on the bar. */
  const JR = { sec: null, d: null, at: null, base: null, k: null, dragging: false };
  function jrParse(sec) { try { return JSON.parse(sec.getAttribute("data-st-jr")); } catch (e) { return null; } }
  function jrAt(d, date) { let v = null, w = null; for (const q of d.pts) { if (q[0] > date) break; v = q[1]; w = q[0]; } return v === null ? null : { v, date: w }; }
  function jrFirstAt(d, kg) { for (const q of d.pts) if (q[1] <= kg) return q[0]; return null; }
  function jrPct(d, v) { return Math.max(0, Math.min(100, (d.max - v) / d.span * 100)); }
  function jrGo(date) {
    const m = NXT.ui && NXT.ui.chart;
    if (m && m.points && m.points.length) {
      if (date === null) { NXT.selectPoint(m.points.length - 1, { clear: true }); return; }
      const i = m.points.findIndex(p => p.date === date);
      if (i >= 0) { NXT.selectPoint(i); return; }
    }
    jrShow(date);
  }
  function jrFromChart(index, opts) {
    if (!JR.sec || !JR.sec.isConnected) return;
    const m = NXT.ui.chart, p = m && m.points && m.points[index];
    if (!p) return;
    jrShow((opts && opts.clear) || index === m.points.length - 1 ? null : p.date);
  }
  function stopCount(el) { if (el) el.dataset.stTok = String(Math.random()); }
  function jrWord(word, date) {
    const em = JR.sec && JR.sec.querySelector("[data-st-jr-noww]"); if (!em) return;
    const i = em.querySelector("i"); if (em.firstChild && em.firstChild.nodeType === 3) em.firstChild.nodeValue = word; if (i) i.textContent = date || "";
  }
  function jrShow(date) {
    const sec = JR.sec, d = JR.d;
    if (!sec || !d || !sec.isConnected) return;
    const q = sel => sec.querySelector(sel);
    const set = (sel, t) => { const el = q(sel); if (el && t != null) { stopCount(el); el.textContent = t; } };
    const rail = q(".st-jr-rail"), dot = q(".vn-journey-now"), trav = q(".vn-journey-travel"), fut = q(".st-jr-fut"), today = q(".st-jr-today"), back = q(".st-jr-back"), when = q(".st-jr-when");
    const L = date ? jrAt(d, date) : null, last = d.pts[d.pts.length - 1][0];
    const isToday = !L || L.date >= last;
    sec.classList.toggle("is-rewind", !isToday);
    rtCursor(isToday ? null : L.date);
    if (isToday) {
      JR.at = null; JR.k = null;
      const b = JR.base;
      set("[data-st-jr-done]", b.done); set("[data-st-jr-sub]", b.sub); set("[data-st-jr-togo]", b.togo); set("[data-st-jr-togol]", b.togol);
      set("[data-st-jr-nowv]", b.nowv); jrWord("Now", b.noww); if (when) when.textContent = b.when;
      dot.style.left = jrPct(d, d.now) + "%"; trav.style.left = b.trav.left; trav.style.width = b.trav.width; trav.classList.toggle("is-back", b.trav.back);
      fut.hidden = true; today.hidden = true; if (back) back.hidden = true;
      sec.querySelectorAll(".st-jr-bead").forEach((x, i) => x.classList.toggle("is-on", !!b.beads[i]));
      rail.setAttribute("aria-valuenow", rail.getAttribute("aria-valuemax")); rail.setAttribute("aria-valuetext", b.vt);
      return;
    }
    JR.at = L.date;
    const v = L.v, done = d.seed - v, togo = v - d.hi, ds = shortDate(L.date);
    const k = Math.floor(v);
    if (JR.k !== null && k !== JR.k && JR.dragging) haptic("tick");
    JR.k = k;
    set("[data-st-jr-done]", Math.abs(done).toFixed(1));
    set("[data-st-jr-sub]", `${done >= .05 ? "down" : done <= -.05 ? "up" : "no change"} by ${ds}`);
    if (q("[data-st-jr-togo]")) { set("[data-st-jr-togo]", Math.max(0, togo).toFixed(1)); set("[data-st-jr-togol]", togo > 0 ? "to go that day" : "in your range that day"); }
    set("[data-st-jr-nowv]", v.toFixed(1)); jrWord("Then", ds);
    if (when) when.textContent = (d.first ? shortDate(d.first) : shortDate(d.pts[0][0])) + " \u2192 " + ds;
    const pv = jrPct(d, v), ps = jrPct(d, d.seed), pn = jrPct(d, d.now);
    dot.style.left = pv + "%";
    trav.classList.toggle("is-back", v > d.seed + .05);
    trav.style.left = Math.min(ps, pv) + "%"; trav.style.width = Math.abs(pv - ps) + "%";
    fut.hidden = false; fut.style.left = Math.min(pv, pn) + "%"; fut.style.width = Math.abs(pn - pv) + "%";
    today.hidden = false; today.style.left = pn + "%";
    if (back) back.hidden = false;
    sec.querySelectorAll(".st-jr-bead").forEach(x => { const r = jrFirstAt(d, Number(x.dataset.k)); x.classList.toggle("is-on", !!r && r <= L.date); });
    rail.setAttribute("aria-valuenow", String(Math.max(0, Math.round((NXT.dateMs(L.date) - NXT.dateMs(d.pts[0][0])) / 864e5))));
    rail.setAttribute("aria-valuetext", `${ds}: ${v.toFixed(1)} kilograms, ${Math.abs(done).toFixed(1)} ${done >= 0 ? "down" : "up"}`);
  }
  function bindJourney(page) {
    const sec = page.querySelector(".st-jr[data-st-jr]");
    JR.sec = null; JR.d = null; JR.at = null; JR.k = null;
    if (!sec) return;
    const d = jrParse(sec);
    if (!d || !Array.isArray(d.pts) || d.pts.length < 3) return;
    JR.sec = sec; JR.d = d;
    const q = sel => sec.querySelector(sel), tx = sel => { const el = q(sel); return el ? el.textContent : null; };
    const rail = q(".st-jr-rail"), trav = q(".vn-journey-travel");
    JR.base = { done: tx("[data-st-jr-done]"), sub: tx("[data-st-jr-sub]"), togo: tx("[data-st-jr-togo]"), togol: tx("[data-st-jr-togol]"), when: tx(".st-jr-when"),
      nowv: tx("[data-st-jr-nowv]"), noww: tx("[data-st-jr-noww] i"), vt: rail.getAttribute("aria-valuetext"),
      trav: { left: trav.style.left, width: trav.style.width, back: trav.classList.contains("is-back") },
      beads: [...sec.querySelectorAll(".st-jr-bead")].map(b => b.classList.contains("is-on")) };
    const pick = x => {
      const r = rail.getBoundingClientRect(), kg = d.max - Math.max(0, Math.min(1, (x - r.left) / r.width)) * d.span;
      if (kg >= d.seed) return d.pts[0][0];
      if (kg <= d.now) return null;
      return jrFirstAt(d, kg);
    };
    let drag = false;
    rail.addEventListener("pointerdown", e => { if (e.button > 0) return; drag = true; JR.dragging = true; try { rail.setPointerCapture(e.pointerId); } catch (_) {} sec.classList.add("is-drag"); jrGo(pick(e.clientX)); });
    rail.addEventListener("pointermove", e => { if (drag) jrGo(pick(e.clientX)); });
    const end = () => { drag = false; JR.dragging = false; sec.classList.remove("is-drag"); };
    rail.addEventListener("pointerup", end); rail.addEventListener("pointercancel", end);
    rail.addEventListener("keydown", e => {
      const n = d.pts.length, ix = JR.at ? Math.max(0, d.pts.findIndex(p => p[0] === JR.at)) : n - 1;
      const near = t => { const j = d.pts.findIndex(p => p[0] >= t); return j < 0 ? n - 1 : j; };
      let to;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = Math.max(0, ix - 1);
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = Math.min(n - 1, ix + 1);
      else if (e.key === "PageUp") to = Math.max(0, near(NXT.dateAdd(d.pts[ix][0], -7)));
      else if (e.key === "PageDown") to = near(NXT.dateAdd(d.pts[ix][0], 7));
      else if (e.key === "Home") to = 0;
      else if (e.key === "End" || (e.key === "Escape" && JR.at)) to = n - 1;
      else return;
      e.preventDefault();
      jrGo(to >= n - 1 ? null : d.pts[to][0]);
    });
    sec.querySelectorAll("[data-st-jr-go]").forEach(b => b.addEventListener("click", () => jrGo(b.getAttribute("data-st-jr-go"))));
    const back = q(".st-jr-back");
    if (back) back.addEventListener("click", () => { jrGo(null); rail.focus({ preventScroll: true }); });
    const play = sec.querySelector("[data-st-story]");
    if (play) play.addEventListener("click", story);
    const m = NXT.ui && NXT.ui.chart, sel = NXT.ui && NXT.ui.selected;
    if (sel && m && m.points && m.points.length && sel !== m.points[m.points.length - 1].date) jrShow(sel);
  }
  /* The rate chart's cursor follows the same day. */
  function rtCursor(date) {
    const svg = document.querySelector("#weightPage .st-rax-svg"), g = svg && svg.querySelector(".st-rax-cur");
    if (!g) return;
    let d; try { d = JSON.parse(svg.getAttribute("data-st-rax")); } catch (e) { return; }
    let pt = null;
    if (date && date >= d.d0 && date < d.d1) for (const p of d.pts) { if (p[0] > date) break; pt = p; }
    if (!pt) { g.setAttribute("visibility", "hidden"); return; }
    const t0 = NXT.dateMs(d.d0), t1 = NXT.dateMs(d.d1), x = (d.x0 + (NXT.dateMs(pt[0]) - t0) / Math.max(864e5, t1 - t0) * (d.x1 - d.x0)).toFixed(1);
    const ln = g.querySelector("line"), c = g.querySelector("circle");
    ln.setAttribute("x1", x); ln.setAttribute("x2", x); c.setAttribute("cx", x); c.setAttribute("cy", String(pt[1]));
    g.setAttribute("visibility", "visible");
  }
  /* D100 · The note chip follows the day the chart shows. */
  function noteChipSync(index) {
    const chip = document.getElementById("st-note-chip"), m = NXT.ui && NXT.ui.chart, p = m && m.points && m.points[index];
    if (!chip || !p || typeof NXT.chartNotes !== "function") return;
    const n = NXT.chartNotes()[p.date];
    chip.dataset.date = p.date;
    chip.classList.toggle("has-note", !!n);
    chip.innerHTML = n ? `<i aria-hidden="true"></i><span>${esc(NXT.noteLabel(n.kind))}${n.text ? " · " + esc(n.text) : ""}</span>` : "<span>+ Note</span>";
    chip.setAttribute("aria-label", n ? `Note on ${shortDate(p.date)}: ${NXT.noteLabel(n.kind)}${n.text ? ", " + n.text : ""}. Edit` : `Add a note for ${shortDate(p.date)}`);
  }
  /* Replay fills the week list as it goes: weeks after the replayed day wait their turn. */
  function weeksReplay(index) {
    const host = document.querySelector(".st-weeks"), m = NXT.ui && NXT.ui.chart, p = m && m.points && m.points[index];
    if (!host) return;
    const on = !!(state0.replay && p);
    host.classList.toggle("is-replay", on);
    host.querySelectorAll(".wk-row").forEach(r => r.classList.toggle("is-ahead", on && r.dataset.a > p.date));
  }
  /* Numbers count up once, as their card scrolls in after a tab change. A rewind cancels a count in flight. */
  function countNum(el) {
    if (reduced() || !el || el.dataset.stCounted) return;
    const txt = el.textContent.trim(), m = /^([+−-]?)(\d+(?:\.\d+)?)$/.exec(txt);
    if (!m) return;
    el.dataset.stCounted = "1";
    const tok = String(Math.random()); el.dataset.stTok = tok;
    const sign = m[1], target = parseFloat(m[2]), dp = (m[2].split(".")[1] || "").length, t0 = performance.now(), dur = 950;
    const step = now => {
      if (!el.isConnected || el.dataset.stTok !== tok) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = k < 1 ? sign + (target * e).toFixed(dp) : txt;
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = sign + (0).toFixed(dp);
    requestAnimationFrame(step);
  }
  function revealNums(el) { if (el && el.querySelectorAll) el.querySelectorAll("[data-st-num]").forEach(countNum); }
  /* What-if pace (D96): drag the marker, or use the arrow keys, to try another pace. Plain arithmetic from
     where you are now to the top of the goal range; it springs back when you let go and is never stored. */
  function bindEvidence(page) {
    const g = page.querySelector(".st-ev-g.is-what");
    if (!g) return;
    let d; try { d = JSON.parse(g.getAttribute("data-st-ev")); } catch (e) { return; }
    if (!d || !(d.now > d.hi) || !(d.ref > 0)) return;
    const sec = g.closest(".st-ev"), knob = g.querySelector(".st-ev-gk"), lab = g.querySelector(".st-ev-gkl"), trail = g.querySelector(".st-ev-trail"), z = g.querySelector(".st-ev-z");
    const wi = sec.querySelector(".st-ev-wi"), hint = sec.querySelector(".st-ev-hint");
    if (!knob || !lab || !trail || !z || !wi) return;
    const mkPct = Math.min(d.axis, Math.max(0, -d.rate) / d.ref * 100), mkAt = mkPct / d.axis * 100;
    const base = { vt: g.getAttribute("aria-valuetext"), now: g.getAttribute("aria-valuenow") };
    const hiTxt = Number.isInteger(d.hi) ? String(d.hi) : Number(d.hi).toFixed(1), flatKg = d.flat / 100 * d.ref;
    let cur = null, drag = false, t = 0, lastStep = null;
    function show(p) {
      clearTimeout(t);
      p = Math.max(0, Math.min(d.axis, p)); cur = p;
      const kg = p / 100 * d.ref, at = p / d.axis * 100;
      g.classList.remove("is-back"); sec.classList.add("is-whatif");
      knob.hidden = false; lab.hidden = false; trail.hidden = false; wi.hidden = false; wi.classList.remove("is-out"); if (hint) hint.hidden = true;
      knob.style.left = at + "%"; lab.style.left = Math.max(10, Math.min(90, at)) + "%";
      trail.style.left = Math.min(at, mkAt) + "%"; trail.style.width = Math.abs(mkAt - at) + "%";
      lab.textContent = "−" + kg.toFixed(2) + " kg/wk";
      const b = wi.querySelector("b"), sp = wi.querySelector("span");
      let vt;
      if (kg <= flatKg) {
        b.textContent = "No arrival at this pace";
        sp.textContent = `Under ${flatKg.toFixed(2)} kg a week the trend reads as flat. A what-if, not a forecast.`;
        vt = `What if ${kg.toFixed(2)} kilograms a week: no arrival, the trend reads as flat`;
      } else {
        const weeks = (d.now - d.hi) / kg, date = NXT.dateAdd(d.today, Math.max(1, Math.round(weeks * 7))), wk = Math.max(1, Math.round(weeks));
        b.textContent = `${hiTxt} kg around ${shortDate(date)}`;
        sp.textContent = `About ${wk} ${wk === 1 ? "week" : "weeks"} at −${kg.toFixed(2)} kg/wk from ${Number(d.now).toFixed(1)} kg now${p > 1 ? ", past the 1% line" : ""}. A what-if, not a forecast.`;
        vt = `What if ${kg.toFixed(2)} kilograms a week: ${hiTxt} kilograms around ${shortDate(date)}`;
      }
      g.setAttribute("aria-valuenow", kg.toFixed(2)); g.setAttribute("aria-valuetext", vt);
      const step = Math.round(kg * 10);
      if (drag && lastStep !== null && step !== lastStep) haptic("tick");
      lastStep = step;
    }
    function reset(delay) {
      clearTimeout(t);
      t = setTimeout(() => {
        if (cur === null) return;
        cur = null; lastStep = null;
        g.classList.add("is-back"); knob.style.left = mkAt + "%"; lab.hidden = true; trail.hidden = true; wi.classList.add("is-out");
        g.setAttribute("aria-valuetext", base.vt); g.setAttribute("aria-valuenow", base.now);
        t = setTimeout(() => { knob.hidden = true; wi.hidden = true; wi.classList.remove("is-out"); g.classList.remove("is-back"); sec.classList.remove("is-whatif"); if (hint) hint.hidden = false; }, reduced() ? 0 : 520);
      }, delay);
    }
    const fromX = x => { const r = z.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * d.axis; };
    g.addEventListener("pointerdown", e => { if (e.button > 0) return; drag = true; g.classList.add("is-drag"); try { g.setPointerCapture(e.pointerId); } catch (_) {} show(fromX(e.clientX)); });
    g.addEventListener("pointermove", e => { if (drag) show(fromX(e.clientX)); });
    const up = () => { if (!drag) return; drag = false; g.classList.remove("is-drag"); reset(1800); };
    g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
    g.addEventListener("keydown", e => {
      const stepPct = 0.05 / d.ref * 100;
      let p = cur === null ? mkPct : cur;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") p += stepPct;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") p -= stepPct;
      else if (e.key === "Escape" && cur !== null) { e.preventDefault(); reset(0); return; }
      else return;
      e.preventDefault(); show(p);
    });
    g.addEventListener("blur", () => { if (cur !== null) reset(700); });
  }

  /* ---- D99 · Play your cut ---------------------------------------------------------------------------------
     A full-screen story of the cut so far, tapped through like a year in review: the start, the kilograms down,
     the fastest week, the lifts, the mornings weighed and where it is heading, ending on the share card (D85).
     Every figure is the engine's: the Cut journey's start and Now (D97), Mon–Sun morning averages with at least
     three readings (the Week by week rule), strengthItems() and its words (I12), the weigh-ins themselves and
     forecastGoal(). Nothing is stored. Under reduced motion nothing moves and nothing advances by itself. */
  const SYD = 6500;
  let SY = null;
  const syLong = d => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return shortDate(d); } };
  const kgTxt = v => Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1);
  const sySigned = v => { const r = Math.round(v * 100) / 100; return (r < 0 ? "−" : r > 0 ? "+" : "") + Math.abs(r).toFixed(2); };
  function cutFacts() {
    if (typeof NXT !== "object" || typeof NXT.weights !== "function") return null;
    const N = NXT, rows = N.weights().filter(r => r.date <= state.date);
    if (rows.length < 5) return null;
    const startW = N.finite(typeof START_WEIGHT !== "undefined" ? START_WEIGHT : null);
    const seed = startW !== null ? startW : rows[0].weight;
    const cs = typeof settings === "object" && settings && Number.isFinite(N.dateMs(settings.cutStart)) && settings.cutStart <= state.date ? settings.cutStart : null;
    const first = cs || rows[0].date;
    const conf = !!N.cfg().targetConfirmed, lo = typeof goalLow === "function" ? Number(goalLow()) : NaN, hi = typeof goalHigh === "function" ? Number(goalHigh()) : NaN;
    const nl = N.nowLevel(rows), now = nl ? nl.value : rows[rows.length - 1].weight;
    const days = Math.max(0, Math.round((N.dateMs(state.date) - N.dateMs(first)) / 864e5));
    const since = days >= 14 ? Math.round(days / 7) + " weeks" : days + " " + N.plural(days, "day");
    const weighed = new Set(rows.filter(r => r.date >= first).map(r => r.date));
    const lv = N.levelSeries(rows).filter(q => q.date >= first);
    return { N, rows, seed, first, conf, lo, hi, now, days, since, weighed, lv, done: seed - now, goal: conf && Number.isFinite(lo) && Number.isFinite(hi) };
  }
  function syBar(F, cls) {
    const max = Math.max(F.seed, F.now, F.goal ? F.hi : F.now) + .6, min = Math.min(F.goal ? F.lo : F.now, F.now, F.seed) - 1.2, span = Math.max(.8, max - min);
    const pc = v => Math.max(0, Math.min(100, (max - v) / span * 100));
    const a = pc(F.seed), b = pc(F.now), beads = [];
    for (let k = Math.floor(F.seed - 1e-6); k > (F.goal ? F.hi : Math.floor(F.now) - 1); k--) beads.push(`<i class="st-sy-bd${k >= F.now ? " is-on" : ""}" style="left:${pc(k).toFixed(2)}%;--d:${(Math.max(0, pc(k) - a) / Math.max(1, b - a)).toFixed(3)}"></i>`);
    return `<div class="st-sy-bar ${cls || ""}" aria-hidden="true"><i class="st-sy-tr"></i>${F.goal ? `<i class="st-sy-gl" style="left:${Math.min(pc(F.lo), pc(F.hi)).toFixed(2)}%;width:${Math.abs(pc(F.lo) - pc(F.hi)).toFixed(2)}%"></i>` : ""}<i class="st-sy-fl" style="left:${Math.min(a, b).toFixed(2)}%;width:${Math.abs(b - a).toFixed(2)}%"></i>${beads.join("")}<i class="st-sy-nw" style="left:${b.toFixed(2)}%;--x0:${a.toFixed(2)}%"></i></div>`;
  }
  function storyChapters(F) {
    const N = F.N, ch = [], dir = F.done >= .05 ? "down" : F.done <= -.05 ? "up" : "no change";
    ch.push({ k: "start", eye: "Day one", num: F.seed.toFixed(1), unit: "kg", sub: `${syLong(F.first)}. The first morning of your cut.`,
      vis: `<div class="st-sy-seed" aria-hidden="true"><i></i><i></i><i></i><b></b></div>${F.goal ? `<p class="st-sy-goal">Goal · ${F.lo}–${F.hi} kg</p>` : ""}` });
    const togo = F.goal ? (F.now > F.hi ? `${(F.now - F.hi).toFixed(1)} kg to your ${F.hi} kg goal.` : F.now >= F.lo ? "You are in your goal range." : "You are below your goal range.") : "";
    ch.push({ k: "down", eye: "So far", num: Math.abs(F.done).toFixed(1), unit: "kg " + (dir === "no change" ? "" : dir), sub: `In ${F.since}. ${togo}`.trim(), vis: syBar(F) });
    const wk = [];
    for (let ws = N.weekStart(F.first); N.dateAdd(ws, 6) < state.date; ws = N.dateAdd(ws, 7)) { const w = N.windowStats(F.rows, N.dateAdd(ws, 6), 7); wk.push({ ws, avg: w.n >= 3 ? w.avg : null }); }
    let best = null;
    for (let i = 1; i < wk.length; i++) if (wk[i].avg !== null && wk[i - 1].avg !== null) { const drop = wk[i - 1].avg - wk[i].avg; if (!best || drop > best.drop) best = { i, drop }; }
    if (best && best.drop >= .1) {
      const pts = wk.map((w, i) => ({ ...w, i })).filter(w => w.avg !== null), lo = Math.min(...pts.map(w => w.avg)), hi = Math.max(...pts.map(w => w.avg));
      const Wd = 340, Hd = 200, x = i => 12 + i * ((Wd - 24) / Math.max(1, wk.length)), y = v => 16 + (hi - v) / Math.max(.4, hi - lo) * (Hd - 40);
      let d = "", prev = null;
      for (const w of pts) { const x0 = x(w.i), x1 = x(w.i + 1), yy = y(w.avg); d += prev === null ? `M${x0.toFixed(1)},${yy.toFixed(1)}` : (prev.i === w.i - 1 ? ` V${yy.toFixed(1)}` : ` M${x0.toFixed(1)},${yy.toFixed(1)}`); d += ` H${x1.toFixed(1)}`; prev = w; }
      const b0 = wk[best.i - 1], b1 = wk[best.i], bx = x(best.i);
      const labs = wk.map((w, i) => (i === 0 || i === wk.length - 1 || i === best.i) ? `<text x="${((x(i) + x(i + 1)) / 2).toFixed(1)}" y="${Hd - 4}" text-anchor="middle"${i === best.i ? ' class="is-on"' : ""}>${esc(shortDate(w.ws))}</text>` : "").join("");
      ch.push({ k: "fast", eye: "The fastest week", num: "−" + best.drop.toFixed(1), unit: "kg", sub: `Week of ${shortDate(b1.ws)}. Your biggest drop in a single week, by morning average.`,
        vis: `<svg class="st-sy-stairs" viewBox="0 0 ${Wd} ${Hd}" aria-hidden="true"><rect class="beam" x="${bx.toFixed(1)}" y="0" width="${(x(best.i + 1) - bx).toFixed(1)}" height="${Hd - 18}"/><path class="st" d="${d}" pathLength="1"/><path class="hl" d="M${bx.toFixed(1)},${y(b0.avg).toFixed(1)} V${y(b1.avg).toFixed(1)} H${x(best.i + 1).toFixed(1)}"/><circle cx="${x(best.i + 1).toFixed(1)}" cy="${y(b1.avg).toFixed(1)}" r="6"/>${labs}</svg>` });
    }
    const items = N.strengthItems(), fresh = items.filter(it => it.delta !== null), imp = fresh.filter(it => it.status === "Improving").sort((a, b) => b.delta - a.delta), hold = fresh.filter(it => it.status === "Holding steady").length;
    if (fresh.length) {
      const top = imp.slice(0, 3), mx = Math.max(1, ...top.map(it => it.delta));
      ch.push({ k: "lifts", eye: "Your lifts", num: String(imp.length), unit: imp.length === 1 ? "improving" : "improving", sub: `Of ${fresh.length} ${N.plural(fresh.length, "lift")} with four recent sessions${hold ? `, ${hold} holding steady` : ""}. The app's own read, not a tested maximum.`,
        vis: top.length ? `<ol class="st-sy-lifts">${top.map((it, i) => `<li style="--k:${i}"><span>${esc(it.name)}</span><i style="--w:${(it.delta / mx * 100).toFixed(1)}%"></i><b>+${it.delta.toFixed(1)}%</b></li>`).join("")}</ol>` : "" });
    }
    const total = F.days + 1, got = F.weighed.size;
    { const cells = [], lead = (new Date(F.first + "T12:00:00").getDay() + 6) % 7, n = total + lead, step = Math.min(28, 1400 / Math.max(1, n));
      for (let i = 0; i < lead; i++) cells.push('<i class="is-pad"></i>');
      for (let i = 0; i < total; i++) { const d = NXT.dateAdd(F.first, i); cells.push(`<i class="${F.weighed.has(d) ? "is-y" : ""}" style="--t:${Math.round((i + lead) * step)}ms"></i>`); }
      /* A long cut folds two or three weeks into a row and shrinks the dots, so the grid never outgrows the screen. */
      const rows7 = Math.ceil(n / 7), per = rows7 > 20 ? 21 : rows7 > 10 ? 14 : 7, sz = per === 21 ? 8 : per === 14 ? 11 : rows7 > 8 ? 12 : 16, gp = per === 21 ? 4 : per === 14 ? 6 : rows7 > 8 ? 6 : 8;
      ch.push({ k: "morn", eye: "Your mornings", num: String(got), unit: "of " + total, sub: `days weighed since ${shortDate(F.first)}. Each one tightens the trend.`, vis: `<div class="st-sy-days" style="--c:${per};--s:${sz}px;--g:${gp}px" aria-hidden="true">${cells.join("")}</div>` }); }
    const f = NXT.forecastGoal(F.rows), share = '<button type="button" class="st-sy-share"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 12.5V3M6.5 6.5 10 3l3.5 3.5M5.5 9.5H5a1.5 1.5 0 0 0-1.5 1.5v4.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 15 9.5h-.5"/></svg>Share your cut</button>';
    if (!F.goal) ch.push({ k: "next", eye: "What's next", num: F.now.toFixed(1), unit: "kg now", sub: "Set a goal range in Settings to see where this is heading.", vis: share });
    else if (F.now <= F.hi) ch.push({ k: "next", eye: "Where you are", num: F.now.toFixed(1), unit: "kg now", sub: F.now >= F.lo ? `Inside your ${F.lo}–${F.hi} kg goal range. A weight range alone does not measure leanness.` : `Below your ${F.lo}–${F.hi} kg goal range.`, vis: share });
    else if (f.ok && f.weeks > 0) ch.push({ k: "next", eye: "What's next", num: "~" + f.weeks, unit: f.weeks === 1 ? "week" : "weeks", sub: `To ${F.hi} kg around ${shortDate(NXT.dateAdd(state.date, f.weeks * 7))}, at your last 3 weeks' pace of ${sySigned(f.slope * 7)} kg/wk. An estimate, not a measurement.`, vis: share });
    else ch.push({ k: "next", eye: "What's next", num: (F.now - F.hi).toFixed(1), unit: "kg to go", sub: (f.reason || "Keep weighing in.").replace(/([^.])$/, "$1."), vis: share });
    return ch;
  }
  function story() {
    if (SY || document.querySelector(".st-story")) return;
    const F = cutFacts(); if (!F) { toast("A few more weigh-ins first: the story needs at least five."); return; }
    const ch = storyChapters(F);
    const el = document.createElement("div");
    el.className = "st-story"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `Your cut, in ${ch.length} parts`);
    el.innerHTML = `<div class="st-sy-bg" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="st-sy-top"><div class="st-sy-segs" aria-hidden="true">${ch.map(() => "<i><b></b></i>").join("")}</div>
        <div class="st-sy-row"><span class="st-sy-n">Your cut · <b>1</b> of ${ch.length}</span><button type="button" class="st-sy-x" aria-label="Close the story"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg></button></div></div>
      <div class="st-sy-stage" aria-live="polite"></div>
      <div class="st-sy-foot"><button type="button" class="st-sy-prev" aria-label="Previous part"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg></button><span class="st-sy-hint">${reduced() ? "Tap the sides to move" : "Tap for next · hold to pause"}</span><button type="button" class="st-sy-next" aria-label="Next part"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg></button></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add("st-story-open");
    SY = { el, ch, i: -1, acc: 0, last: 0, paused: false, raf: 0, back: document.activeElement, held: false };
    const stage = el.querySelector(".st-sy-stage");
    let down = null, holdT = 0;
    stage.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; down = { x: e.clientX, y: e.clientY, t: performance.now() }; clearTimeout(holdT); holdT = setTimeout(() => { if (SY) { SY.held = true; SY.paused = true; el.classList.add("is-held"); } }, 230); });
    stage.addEventListener("pointerup", e => {
      clearTimeout(holdT);
      if (!down || !SY) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
      if (SY.held) { SY.held = false; SY.paused = false; el.classList.remove("is-held"); return; }
      if (dy > 90 && Math.abs(dx) < 70) { storyClose(); return; }
      if (e.target.closest("button")) return;
      (e.clientX < window.innerWidth * .32 ? syGo(SY.i - 1) : syGo(SY.i + 1));
    });
    stage.addEventListener("pointercancel", () => { clearTimeout(holdT); down = null; if (SY && SY.held) { SY.held = false; SY.paused = false; el.classList.remove("is-held"); } });
    el.querySelector(".st-sy-x").addEventListener("click", storyClose);
    el.querySelector(".st-sy-prev").addEventListener("click", () => syGo(SY.i - 1));
    el.querySelector(".st-sy-next").addEventListener("click", () => syGo(SY.i + 1));
    SY.key = e => {
      if (!SY) return;
      if (e.key === "Escape") { e.preventDefault(); storyClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); syGo(SY.i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); syGo(SY.i - 1); }
      else if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); SY.paused = !SY.paused; el.classList.toggle("is-held", SY.paused); }
      else if (e.key === "Tab") { const f = [...el.querySelectorAll("button")].filter(b => !b.disabled && b.offsetParent !== null); if (!f.length) return; const a = f.indexOf(document.activeElement); if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (a === f.length - 1 || a < 0)) { e.preventDefault(); f[0].focus(); } }
    };
    /* On the document, not the overlay: after a tap the focus can sit on the page body. */
    document.addEventListener("keydown", SY.key, true);
    document.addEventListener("visibilitychange", syVis);
    syGo(0);
    el.querySelector(".st-sy-x").focus({ preventScroll: true });
    haptic("tick");
    if (!reduced()) { SY.last = performance.now(); SY.raf = requestAnimationFrame(syTick); }
  }
  function syVis() { if (SY && document.hidden) SY.paused = true; else if (SY && !SY.held) SY.paused = false; }
  function syTick(now) {
    if (!SY) return;
    const dt = Math.min(100, now - SY.last); SY.last = now;
    const lastCh = SY.i >= SY.ch.length - 1;
    if (!SY.paused && !lastCh) SY.acc += dt;
    const seg = SY.el.querySelectorAll(".st-sy-segs b")[SY.i];
    if (seg) seg.style.transform = `scaleX(${lastCh ? 1 : Math.min(1, SY.acc / SYD)})`;
    if (!lastCh && SY.acc >= SYD) syGo(SY.i + 1);
    SY.raf = requestAnimationFrame(syTick);
  }
  function syGo(i) {
    if (!SY) return;
    if (i < 0) i = 0;
    if (i >= SY.ch.length) { storyClose(); return; }
    if (i === SY.i) return;
    SY.i = i; SY.acc = 0;
    const c = SY.ch[i], el = SY.el;
    el.setAttribute("data-ch", c.k);
    el.querySelectorAll(".st-sy-segs b").forEach((b, k) => { b.style.transform = `scaleX(${k < i ? 1 : k === i && reduced() ? 1 : 0})`; });
    el.querySelector(".st-sy-n b").textContent = String(i + 1);
    el.querySelector(".st-sy-prev").disabled = i === 0;
    const stage = el.querySelector(".st-sy-stage");
    stage.innerHTML = `<div class="st-sy-ch is-${c.k}"><p class="st-sy-eye">${esc(c.eye)}</p><div class="st-sy-mega"><span data-st-num>${esc(c.num)}</span>${c.unit ? `<small>${esc(c.unit)}</small>` : ""}</div><p class="st-sy-sub">${esc(c.sub)}</p><div class="st-sy-vis">${c.vis || ""}</div></div>`;
    const node = stage.firstElementChild;
    const sh = node.querySelector(".st-sy-share");
    if (sh) sh.addEventListener("click", () => { storyClose(); setTimeout(() => { if (typeof NXP === "object" && NXP.shareProgress) NXP.shareProgress(); }, 60); });
    if (!reduced()) { requestAnimationFrame(() => { node.classList.add("is-in"); countNum(node.querySelector("[data-st-num]")); }); }
    else node.classList.add("is-in", "is-still");
  }
  function storyClose() {
    if (!SY) return;
    cancelAnimationFrame(SY.raf);
    document.removeEventListener("visibilitychange", syVis);
    document.removeEventListener("keydown", SY.key, true);
    const el = SY.el, back = SY.back; SY = null;
    document.documentElement.classList.remove("st-story-open");
    if (reduced()) el.remove(); else { el.classList.add("is-out"); setTimeout(() => el.remove(), 320); }
    if (back && back.focus && back.isConnected) back.focus({ preventScroll: true });
  }

  /* ---- D99 · Goal reached -------------------------------------------------------------------------------------
     On the day the Cut journey's Now (D97) first enters the goal range, one full-screen moment: the road filled,
     the facts of the cut, the share card. Read from the level series, shown once per app session, nothing stored. */
  let goalShown = false, goalTries = 0;
  function goalDue() {
    if (goalShown) return false;
    const F = cutFacts();
    if (!F || !F.goal || F.lv.length < 3) return false;
    const last = F.lv[F.lv.length - 1];
    if (!(last.value <= F.hi) || last.date < NXT.dateAdd(state.date, -1)) return false;
    return F.lv.slice(0, -1).every(q => q.value > F.hi);
  }
  function goalCheck() {
    if (!goalDue()) return;
    if (document.querySelector(".st-story,.st-goal,.st-wm,.st-fin,.st-ask,.st-obs,#modalRoot .modal")) { if (goalTries++ < 8) setTimeout(goalCheck, 2500); return; }
    goalMoment();
  }
  function goalMoment() {
    if (document.querySelector(".st-goal")) return;
    const F = cutFacts(); if (!F || !F.goal || !(F.now <= F.hi + 1e-9)) return;
    goalShown = true;
    const weeks = Math.max(1, Math.round(F.days / 7));
    const el = document.createElement("div");
    el.className = "st-goal"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "st-goal-t");
    const sparks = reduced() ? "" : Array.from({ length: 18 }, (_, i) => `<i style="--a:${(i * 20).toFixed(0)}deg;--t:${(i % 6) * 90}ms"></i>`).join("");
    el.innerHTML = `<div class="st-sy-bg" aria-hidden="true"><i></i><i></i><i></i></div><div class="st-goal-sp" aria-hidden="true">${sparks}</div>
      <div class="st-goal-in">
        <p class="st-goal-eye">Goal range reached</p>
        <h2 class="st-goal-t" id="st-goal-t">You’re in your goal range</h2>
        ${syBar(F, "is-goal")}
        <div class="st-goal-facts"><div><b data-st-num>${Math.abs(F.done).toFixed(1)}</b><span>kg ${F.done >= 0 ? "down" : "up"}</span></div><div><b data-st-num>${weeks}</b><span>${weeks === 1 ? "week" : "weeks"}</span></div><div><b data-st-num>${F.weighed.size}</b><span>mornings weighed</span></div></div>
        <p class="st-goal-sub">Now ${F.now.toFixed(1)} kg, inside ${kgTxt(F.lo)}–${kgTxt(F.hi)} kg. A weight range alone does not measure leanness.</p>
        <div class="st-goal-acts"><button type="button" class="st-goal-share">Share your cut</button><button type="button" class="st-goal-done">Done</button></div>
      </div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add("st-story-open");
    const back = document.activeElement;
    let key = null;
    const close = () => { document.removeEventListener("keydown", key, true); document.documentElement.classList.remove("st-story-open"); if (reduced()) el.remove(); else { el.classList.add("is-out"); setTimeout(() => el.remove(), 320); } if (back && back.focus && back.isConnected) back.focus({ preventScroll: true }); };
    el.querySelector(".st-goal-done").addEventListener("click", close);
    el.querySelector(".st-goal-share").addEventListener("click", () => { close(); setTimeout(() => { if (typeof NXP === "object" && NXP.shareProgress) NXP.shareProgress(); }, 60); });
    key = e => { if (!el.isConnected) return; if (e.key === "Escape") { e.preventDefault(); close(); } else if (e.key === "Tab") { const f = [...el.querySelectorAll("button")]; const a = f.indexOf(document.activeElement); if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (a === f.length - 1 || a < 0)) { e.preventDefault(); f[0].focus(); } } };
    document.addEventListener("keydown", key, true);
    el.querySelector(".st-goal-done").focus({ preventScroll: true });
    haptic("success");
    if (!reduced()) requestAnimationFrame(() => { el.classList.add("is-in"); el.querySelectorAll("[data-st-num]").forEach(countNum); });
    else el.classList.add("is-in", "is-still");
  }
  return { observatory, closeObservatory, hydrate, install, odoSet, stopReplay, sky, haptic, story, storyClose, goalMoment, goalCheck, moment, morph, glance: () => { glTouch = 0; showGlance(); }, openDock: tab => { const b = document.querySelector('.tabs .tab[data-tab="' + tab + '"]'); if (b) openDock(b); } };
})();
STRATA.install();
if (typeof NXT === "object" && NXT && typeof NXT.repaint === "function" && document.readyState !== "loading") {
  try { render(); } catch (e) { /* render() reports its own errors */ }
}
