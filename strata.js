/* NXTFRM · Strata layer (D19). Motion and drawing only.
   Every number drawn here arrives from the page's markup, which premium-ui.js
   and cut-support.js read from the engine. This file computes no statistic,
   writes no record and changes no stored value. */
"use strict";
const STRATA = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const state0 = { lastTab: null, replay: null, animatedKeys: new Set() };
  const reduced = () => {
    try {
      if (document.documentElement.getAttribute("data-nxp-motion") === "reduced") return true;
      return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 86400000;
  const dms = d => Date.parse(d + "T00:00:00Z");
  const shortDate = d => (typeof NXT === "object" && NXT.shortDate) ? NXT.shortDate(d) : d;
  const readJSON = el => { try { return JSON.parse(el.getAttribute(el.dataset.stHero !== undefined ? "data-st-hero" : "data-st-cmap")); } catch (e) { return null; } };

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
  function smooth(points) {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    const s = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x || 1));
    const tg = points.map((p, i) => i === 0 ? s[0] : i === points.length - 1 ? s[s.length - 1] : s[i - 1] * s[i] <= 0 ? 0 : 2 / (1 / s[i - 1] + 1 / s[i]));
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = (b.x - a.x) / 3;
      d += ` C ${(a.x + dx).toFixed(2)} ${(a.y + dx * tg[i - 1]).toFixed(2)}, ${(b.x - dx).toFixed(2)} ${(b.y - dx * tg[i]).toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    return d;
  }
  function niceDomain(vals) {
    const lo0 = Math.min(...vals), hi0 = Math.max(...vals), span = Math.max(1, hi0 - lo0);
    const step = span <= 2 ? .5 : span <= 4 ? 1 : span <= 10 ? 2 : Math.ceil(span / 20) * 5;
    const lo = Math.floor((lo0 - step * .35) / step) * step, hi = Math.ceil((hi0 + step * .35) / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step / 10; v += step) ticks.push(v);
    return { lo, hi, step, ticks };
  }

  /* ---- Today hero: trend chart with scrub + replay ------------------------ */
  const MON = d => { const x = new Date(dms(d)); return (x.getUTCDay() + 6) % 7; };
  function drawHero(tile, animate) {
    const data = readJSON(tile); if (!data || !data.pts || !data.pts.length) return;
    const host = tile.querySelector("[data-st-chart]"), odo = tile.querySelector("[data-st-odo]"), eb = tile.querySelector("[data-st-eb]");
    const W = Math.max(240, host.clientWidth || 320), H = W < 330 ? 170 : 192, P = { l: 4, r: 34, t: 30, b: 24 };
    const pts = data.pts;
    /* Same rule as the Progress chart (D2): the domain comes from the plotted
       readings and trend only. */
    const vals = pts.flatMap(p => p.a === null ? [p.w] : [p.w, p.a]);
    const dom = niceDomain(vals);
    const t0 = dms(pts[0].d), t1 = Math.max(dms(data.today), t0 + DAY);
    const X = d => P.l + (dms(d) - t0) / (t1 - t0) * (W - P.l - P.r);
    const Y = v => P.t + (dom.hi - v) / (dom.hi - dom.lo) * (H - P.t - P.b);
    const tr = pts.filter(p => p.a !== null).map(p => ({ x: X(p.d), y: Y(p.a), p }));
    const uid = "sth" + Math.random().toString(36).slice(2, 7);
    const ticks = dom.ticks.length > 5 ? dom.ticks.filter((_, i) => i % 2 === 0) : dom.ticks;
    const tpath = smooth(tr);
    const base = H - P.b;
    const lastT = tr[tr.length - 1], firstT = tr[0];
    /* Week bands: every other Monday–Sunday week is faintly shaded, and weeks
       are labelled by their Monday, so the eye can count weeks. */
    const mondays = [];
    for (let ms = t0 - MON(pts[0].d) * DAY; ms <= t1; ms += 7 * DAY) mondays.push(ms);
    const xm = ms => P.l + (ms - t0) / (t1 - t0) * (W - P.l - P.r);
    const bands = mondays.map((ms, i) => i % 2 ? `<rect class="st-band" x="${Math.max(P.l, xm(ms)).toFixed(1)}" y="${P.t - 18}" width="${(Math.min(W - P.r, xm(ms + 7 * DAY)) - Math.max(P.l, xm(ms))).toFixed(1)}" height="${base - P.t + 18}" rx="6"/>` : "").join("");
    const wlabs = mondays.filter(ms => ms >= t0 && xm(ms) < W - P.r - 18).map(ms => `<text class="st-ax" x="${xm(ms).toFixed(1)}" y="${H - 6}" text-anchor="${xm(ms) - P.l < 14 ? "start" : "middle"}">${esc(shortDate(new Date(ms).toISOString().slice(0, 10)))}</text>`).join("");
    const pill = (x, y, txt, cls) => {
      const w = 12 + txt.length * 7.4, px = Math.min(W - P.r + 30 - w, Math.max(P.l, x - w / 2));
      return `<g class="st-pillg ${cls || ""}"><rect x="${px.toFixed(1)}" y="${(y - 30).toFixed(1)}" width="${w.toFixed(1)}" height="21" rx="10.5"/><text x="${(px + w / 2).toFixed(1)}" y="${(y - 15.5).toFixed(1)}" text-anchor="middle">${esc(txt)}</text></g>`;
    };
    host.innerHTML = `<svg class="st-hc${animate && !reduced() ? " is-draw" : ""}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" tabindex="0" focusable="true">
      <defs>
        <linearGradient id="${uid}-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9B7BFF" stop-opacity=".5"/><stop offset=".6" stop-color="#7C5CFF" stop-opacity=".1"/><stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/></linearGradient>
        <linearGradient id="${uid}-l" x1="${P.l}" y1="0" x2="${W - P.r}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".55"/><stop offset=".55" stop-color="#B49AFF"/><stop offset="1" stop-color="#F3EEFF"/></linearGradient>
        <filter id="${uid}-g" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="${uid}-c"><rect class="st-hc-reveal" x="0" y="0" width="${W}" height="${H}"/></clipPath>
      </defs>
      ${bands}
      ${ticks.map(v => `<g><line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="st-grid"/><text x="${W - P.r + 8}" y="${Y(v) + 4}" class="st-ax">${Number(v.toFixed(1))}</text></g>`).join("")}
      <g clip-path="url(#${uid}-c)">
        ${tr.length > 1 ? `<path d="${tpath} L ${lastT.x} ${base} L ${firstT.x} ${base} Z" fill="url(#${uid}-a)" class="st-hc-area"/>` : ""}
        ${pts.map((p, i) => `<circle class="st-hc-dot${p.t === "m" ? "" : " is-other"}" cx="${X(p.d).toFixed(2)}" cy="${Y(p.w).toFixed(2)}" r="${p.t === "m" ? 2.5 : 2.7}" style="--i:${i}"/>`).join("")}
        ${tr.length > 1 ? `<path d="${tpath}" class="st-hc-line" stroke="url(#${uid}-l)" filter="url(#${uid}-g)" pathLength="1"/>` : ""}
      </g>
      ${firstT && tr.length > 1 ? `<circle class="st-hc-start" cx="${firstT.x}" cy="${firstT.y}" r="4"/>` : ""}
      ${lastT ? `<circle class="st-hc-halo" cx="${lastT.x}" cy="${lastT.y}" r="12"/><circle class="st-hc-end" cx="${lastT.x}" cy="${lastT.y}" r="5.5"/>${pill(lastT.x, lastT.y, lastT.p.a.toFixed(1), "is-end")}` : ""}
      ${firstT && tr.length > 1 ? pill(firstT.x + 18, firstT.y, firstT.p.a.toFixed(1), "is-start") : ""}
      <line class="st-hc-cur" x1="0" x2="0" y1="${P.t - 18}" y2="${base}" opacity="0"/>
      <circle class="st-hc-act" r="6" cx="0" cy="0" opacity="0"/>
      ${wlabs}
    </svg><div class="st-tip" hidden></div>`;
    const svg = host.querySelector("svg"), cur = svg.querySelector(".st-hc-cur"), act = svg.querySelector(".st-hc-act"), tip = host.querySelector(".st-tip");
    const restText = odo ? odo.getAttribute("aria-label") || odo.textContent : "";
    const restEb = eb ? eb.textContent : "";
    const fmt = v => Number(v).toFixed(1);
    const show = (i, fromReplay) => {
      const p = pts[i]; if (!p) return;
      const v = p.a !== null ? p.a : p.w, x = X(p.d);
      cur.setAttribute("x1", x); cur.setAttribute("x2", x); cur.setAttribute("opacity", fromReplay ? "0" : "1");
      act.setAttribute("cx", x); act.setAttribute("cy", Y(v)); act.setAttribute("opacity", fromReplay ? "0" : "1");
      odoSet(odo, fmt(v), false);
      if (eb) eb.textContent = (p.a !== null ? "Trend · " : "Reading · ") + shortDate(p.d);
      if (tip) {
        tip.hidden = !!fromReplay;
        tip.innerHTML = `<b>${esc(shortDate(p.d))}</b><span>${p.t === "m" ? "Morning" : "Reading"} <em>${fmt(p.w)}</em></span>${p.a !== null ? `<span>Trend <em>${Number(p.a).toFixed(2)}</em></span>` : ""}`;
        const r = svg.getBoundingClientRect(), k = r.width / W;
        tip.style.left = Math.min(Math.max(x * k, 58), r.width - 58) + "px";
      }
      tile.classList.add("is-scrubbing");
    };
    const clear = () => {
      cur.setAttribute("opacity", "0"); act.setAttribute("opacity", "0");
      odoSet(odo, restText, false);
      if (eb) eb.textContent = restEb;
      if (tip) tip.hidden = true;
      tile.classList.remove("is-scrubbing");
    };
    const nearest = clientX => {
      const r = svg.getBoundingClientRect(), x = (clientX - r.left) / r.width * W;
      let best = 0; pts.forEach((p, i) => { if (Math.abs(X(p.d) - x) < Math.abs(X(pts[best].d) - x)) best = i; });
      return best;
    };
    let kIdx = -1;
    svg.addEventListener("pointerdown", e => { stopReplay(); try { svg.setPointerCapture(e.pointerId); } catch (_) {} show(nearest(e.clientX)); });
    svg.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "mouse") show(nearest(e.clientX)); });
    svg.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") clear(); });
    svg.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") setTimeout(clear, 1200); });
    svg.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        kIdx = kIdx < 0 ? pts.length - 1 : Math.max(0, Math.min(pts.length - 1, kIdx + (e.key === "ArrowRight" ? 1 : -1)));
        show(kIdx); e.preventDefault();
      } else if (e.key === "Escape") { kIdx = -1; clear(); }
    });
    const btn = tile.querySelector("[data-st-replay]");
    if (btn) btn.onclick = () => {
      if (state0.replay) { stopReplay(); return; }
      if (reduced()) { show(pts.length - 1, true); setTimeout(clear, 600); return; }
      const rect = svg.querySelector(".st-hc-reveal"), dur = 6500, start = performance.now();
      tile.classList.add("is-replaying"); btn.querySelector("span").textContent = "Stop";
      const run = now => {
        const k = Math.min(1, (now - start) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const xr = P.l + e * (W - P.l - P.r);
        rect.setAttribute("width", xr + 1);
        let idx = 0; pts.forEach((p, i) => { if (X(p.d) <= xr + .5) idx = i; });
        show(idx, true);
        if (k < 1) state0.replay = { raf: requestAnimationFrame(run), done };
        else done();
      };
      const done = () => { state0.replay = null; rect.setAttribute("width", W); tile.classList.remove("is-replaying"); btn.querySelector("span").textContent = "Replay"; clear(); };
      state0.replay = { raf: requestAnimationFrame(run), done };
    };
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
    /* Week bands (Mon–Sun, alternate weeks), the lowest morning reading tagged,
       and a stem from the selected reading to its trend. Marks only. */
    const clip = svg.querySelector("g[clip-path]"), base = m.H - m.bottom, DAY = 86400000;
    if (clip && m.points.length > 1 && (!m.futureDays)) {
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
    const read = page.querySelector("#vn-traj-read");
    if (read && /^no plateau detected\.?$/i.test(read.textContent.trim())) read.hidden = true;
    const wrapEl = page.querySelector("#vn-chart-wrap");
    if (wrapEl && !wrapEl.querySelector(".st-tip")) { wrapEl.style.position = "relative"; wrapEl.insertAdjacentHTML("beforeend", `<div class="st-tip" hidden></div>`); }
  }
  /* ---- Week by week ------------------------------------------------------
     The last five Monday-to-Sunday averages of the morning weigh-ins, one row
     per week on a shared scale so the descent is visible at a glance. Every
     figure is the engine's own NXT.windowStats over NXT.weights(), the same
     call the old Today tile used; nothing is computed here beyond a bar
     length. Scrubbing the chart lights the row that holds the selected day. -- */
  function dressWeeks(page, entering) {
    const m = typeof NXT === "object" && NXT.ui && NXT.ui.chart, anchor = page.querySelector(".vn-togs") || page.querySelector("#vn-chart-wrap");
    if (!m || !anchor || page.querySelector(".st-weeks") || typeof NXT.windowStats !== "function") return;
    const rows = NXT.weights(), today = state.date, ws = NXT.weekStart(today), weeks = [];
    for (let i = 4; i >= 0; i--) {
      const st = NXT.dateAdd(ws, -7 * i), part = i === 0, end = part ? today : NXT.dateAdd(st, 6);
      const days = part ? Math.round((NXT.dateMs(today) - NXT.dateMs(st)) / 86400000) + 1 : 7;
      const w = NXT.windowStats(rows, end, days);
      weeks.push({ st, end: NXT.dateAdd(st, 6), avg: w.avg, n: w.n, part });
    }
    const have = weeks.filter(w => w.avg !== null && w.avg !== undefined);
    if (have.length < 2) return;
    const lo = Math.min(...have.map(w => w.avg)) - 0.5, hi = Math.max(...have.map(w => w.avg)) + 0.15;
    let prev = null;
    const li = weeks.map((w, i) => {
      if (w.avg === null || w.avg === undefined) return "";
      const d = prev === null ? null : w.avg - prev; prev = w.avg;
      const dTxt = d === null ? "" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`;
      const name = w.part ? "This week" : shortDate(w.st);
      const say = `${w.part ? "This week so far" : "Week of " + shortDate(w.st)}: ${w.avg.toFixed(1)} kilograms${d === null ? "" : d === 0 ? ", unchanged" : `, ${d < 0 ? "down" : "up"} ${Math.abs(d).toFixed(1)}`}`;
      return `<li class="st-wk${w.part ? " is-now" : ""}" data-a="${w.st}" data-b="${w.end}" style="--i:${i};--w:${Math.max(.06, (w.avg - lo) / (hi - lo)).toFixed(3)}" aria-label="${esc(say)}">
        <span class="st-wk-d">${esc(name)}${w.part ? `<small>${w.n} ${w.n === 1 ? "day" : "days"}</small>` : ""}</span>
        <span class="st-wk-t" aria-hidden="true"><i></i></span>
        <b class="st-wk-v" aria-hidden="true">${w.avg.toFixed(1)}</b>
        <span class="st-wk-c${d !== null && d > 0 ? " is-up" : ""}" aria-hidden="true">${dTxt}</span>
      </li>`;
    }).join("");
    const host = document.createElement("section");
    host.className = "st-weeks" + (entering && !reduced() ? " is-draw" : "");
    host.setAttribute("aria-label", "Week by week average morning weight");
    host.innerHTML = `<div class="st-wk-h"><h3>Week by week</h3><small>Morning average, Mon–Sun</small></div><ol class="st-wk-l">${li}</ol>`;
    anchor.insertAdjacentElement("afterend", host);
    weeksSync(m.points.length - 1);
  }
  function weeksSync(index) {
    const host = document.querySelector(".st-weeks"), m = NXT.ui && NXT.ui.chart, p = m && m.points && m.points[index];
    if (!host || !p) return;
    host.querySelectorAll(".st-wk").forEach(r => r.classList.toggle("is-on", p.date >= r.dataset.a && p.date <= r.dataset.b));
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
  /* Weekly recap on Home: Sunday shows the week ending today, Monday the week just gone.
     Everything is read from logged rows with the engine's own helpers; no new metric. */
  function recapWeek() {
    if (typeof NXT !== "object" || typeof state !== "object") return null;
    const dow = new Date(NXT.dateMs(state.date)).getUTCDay();
    if (dow !== 0 && dow !== 1) return null;
    const ws = dow === 1 ? NXT.dateAdd(NXT.weekStart(state.date), -7) : NXT.weekStart(state.date);
    return { ws, we: NXT.dateAdd(ws, 6) };
  }
  function dressRecap(page) {
    if (page.id !== "homePage") return;
    const old = page.querySelector(".st-recap");
    if (old) old.remove();
    const wk = recapWeek();
    const bento = page.querySelector(".st-bento");
    if (!wk || !bento) return;
    const N = NXT, esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const all = N.workRows ? N.workRows() : [];
    const inWk = all.filter(r => r.date >= wk.ws && r.date <= wk.we);
    const cardio = (state.cardio || []).filter(r => r && r.date >= wk.ws && r.date <= wk.we && Number(r.duration) > 0).reduce((a, r) => a + Number(r.duration), 0);
    const days = new Set(inWk.map(r => r.date)).size;
    let planned = 0;
    for (let i = 0; i < 7; i++) { const t = N.typeFor(N.dateAdd(wk.ws, i)); if (t && !["Rest", "Zone2", "Floorball"].includes(t)) planned++; }
    const rows = N.weights ? N.weights() : [];
    const cur = N.windowStats(rows, wk.we, 7), prev = N.windowStats(rows, N.dateAdd(wk.we, -7), 7);
    if (!inWk.length && !cardio && !cur.n) return;
    const by = new Map();
    inWk.forEach(r => { const k = (r.exercise || r.name) + "|" + (r.gym || ""); (by.get(k) || by.set(k, []).get(k)).push(r); });
    const best = [];
    by.forEach((sets, k) => {
      const b = N.bestSet(sets); if (!b) return;
      const before = all.filter(r => r.date < wk.ws && (r.exercise || r.name) + "|" + (r.gym || "") === k);
      const pb = N.bestSet(before);
      const beat = !!pb && (Number(b.weight) > Number(pb.weight) || (Number(b.weight) === Number(pb.weight) && Number(b.reps) > Number(pb.reps)));
      best.push({ name: b.exercise || b.name, w: Number(b.weight), r: Number(b.reps), beat });
    });
    best.sort((a, b) => (b.beat - a.beat) || (b.w - a.w));
    const top = best.slice(0, 3), fmt = n => String(Math.round(n * 10) / 10);
    const wt = cur.avg !== null ? `${cur.avg.toFixed(1)}<small> kg</small>` : "—";
    const dl = cur.avg !== null && prev.avg !== null && cur.n >= 2 && prev.n >= 2 ? (cur.avg - prev.avg) : null;
    const dtxt = dl === null ? `avg of ${cur.n}` : `avg · `+ `${dl > 0 ? "+" : dl < 0 ? "\u2212" : ""}${Math.abs(dl).toFixed(1)} kg vs last week`;
    const range = `${N.shortDate(wk.ws)} \u2013 ${N.shortDate(wk.we)}`;
    const el = document.createElement("section");
    el.className = "st-tile st-recap"; el.setAttribute("aria-label", "Your week");
    el.style.setProperty("--c", "var(--st-accent)");
    el.innerHTML = `<div class="st-tile-head"><h3 class="st-h3">${recapWeek() && new Date(N.dateMs(state.date)).getUTCDay() === 1 ? "Last week" : "Your week"}</h3><span class="st-meta">${esc(range)}</span></div>
      <div class="st-rc-stats">
        <div><b class="vn-num">${days}${planned ? `<small> / ${planned}</small>` : ""}</b><span>Lifting</span><em>${inWk.length} working sets</em></div>
        <div><b class="vn-num">${Math.round(cardio)}<small> min</small></b><span>Cardio</span><em>&nbsp;</em></div>
        <div><b class="vn-num">${wt}</b><span>Weight</span><em>${esc(dtxt)}</em></div>
      </div>
      ${top.length ? `<ul class="st-rc-best" aria-label="Best sets">${top.map(t => `<li${t.beat ? ' data-beat="1"' : ""}><span>${esc(t.name)}</span><b class="vn-num">${fmt(t.w)} \u00d7 ${t.r}</b>${t.beat ? '<i>New best</i>' : ""}</li>`).join("")}</ul>` : ""}`;
    const anchor = [...bento.children].find(c => /NXTFRM decision/i.test(c.textContent));
    if (anchor) anchor.insertAdjacentElement("beforebegin", el); else bento.appendChild(el);
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
    if (!p || (opts && opts.clear) || state0.replay) { tip.hidden = true; const st0 = svg.querySelector("#st-stem"); if (st0) st0.setAttribute("visibility", "hidden"); return; }
    const r = svg.getBoundingClientRect(), wr = wrapEl.getBoundingClientRect(), k = r.width / m.W;
    const gap = p.avg !== null && p.avg !== undefined ? Number(p.weight) - Number(p.avg) : null, stem = svg.querySelector("#st-stem");
    if (stem) {
      if (gap !== null && p.ty !== null && p.ty !== undefined && Math.abs(p.y - p.ty) > 3) { stem.setAttribute("x1", p.x); stem.setAttribute("x2", p.x); stem.setAttribute("y1", p.y); stem.setAttribute("y2", p.ty); stem.setAttribute("visibility", "visible"); }
      else stem.setAttribute("visibility", "hidden");
    }
    tip.innerHTML = `<b>${esc(shortDate(p.date))}</b><span>Reading <em>${Number(p.weight).toFixed(1)}</em></span>${p.avg !== null ? `<span>Trend <em>${Number(p.avg).toFixed(2)}</em></span>` : ""}${gap !== null && Math.abs(gap) >= 0.05 ? `<span class="st-tip-gap">${Math.abs(gap).toFixed(1)} kg ${gap < 0 ? "below" : "above"} trend</span>` : ""}`;
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
  function syncDock() {
    const inner = document.querySelector(".tabs .tabs-inner"); if (!inner) return;
    const tabs = [...inner.querySelectorAll(".tab")], i = tabs.findIndex(t => t.classList.contains("active"));
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

  /* ---- Train: swipe between exercises, bump steppers, tick the count ------ */
  function fitTrain() {
    const root = document.querySelector("#trainPage .st-train-active");
    if (!root) return;
    root.style.minHeight = "";
    const top = root.getBoundingClientRect().top + window.scrollY;
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    root.style.minHeight = Math.max(560, Math.round(vh - top)) + "px";
  }
  /* Live read of the set you are about to log against Best last time (D20: heaviest
     load, then most reps). It compares two numbers already on screen; nothing is stored. */
  function syncVs() {
    const refs = document.querySelector("#trainPage .st-refs");
    if (!refs) return;
    let el = document.getElementById("st-vs");
    if (!el || !el.isConnected) {
      el = document.createElement("p"); el.id = "st-vs"; el.className = "st-vs"; el.setAttribute("role", "status");
      refs.insertAdjacentElement("beforebegin", el);
    }
    const best = refs.querySelector(".st-refc[data-w]");
    const wi = document.getElementById("weightInput"), ri = document.getElementById("repsInput"), ty = document.getElementById("n99-set-type");
    const w = wi && wi.value !== "" ? Number(wi.value) : NaN, r = ri && ri.value !== "" ? Number(ri.value) : NaN;
    let kind = "", text = "";
    if (best && Number.isFinite(w) && Number.isFinite(r) && (!ty || ty.value !== "warmup")) {
      const pw = Number(best.dataset.w), pr = Number(best.dataset.r), fmt = n => String(Math.round(n * 100) / 100);
      if (w > pw) { kind = "up"; text = `+${fmt(w - pw)} kg on your best last time`; }
      else if (w === pw && r > pr) { kind = "up"; text = `+${r - pr} ${r - pr === 1 ? "rep" : "reps"} on your best last time`; }
      else if (w === pw && r === pr) { kind = "eq"; text = "Matches your best last time"; }
      else { kind = "dn"; text = "Below your best last time"; }
    }
    el.dataset.k = kind; el.textContent = text;
    const lb = document.getElementById("nxp-log-button");
    if (lb) { if (kind === "up") lb.dataset.beat = "1"; else delete lb.dataset.beat; }
  }
  /* Hold a stepper to keep stepping: starts after a beat, then speeds up. */
  function bindHold() {
    let t = 0, iv = 0, n = 0, btn = null, swallow = 0;
    const stop = () => { clearTimeout(t); clearInterval(iv); btn = null; };
    const tick = () => {
      if (!btn) return;
      n++; swallow = Date.now(); btn.click();
      if (n === 10) { clearInterval(iv); iv = setInterval(tick, 90); }
    };
    document.addEventListener("pointerdown", e => {
      const b = e.target && e.target.closest && e.target.closest("#trainPage .nxp-step");
      if (!b || (e.pointerType === "mouse" && e.button !== 0)) return;
      stop(); btn = b; n = 0;
      t = setTimeout(() => { iv = setInterval(tick, 160); tick(); }, 450);
    }, true);
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => document.addEventListener(ev, e => { if (btn && (ev !== "pointerleave" || e.target === btn)) stop(); }, true));
    document.addEventListener("contextmenu", e => { if (e.target && e.target.closest && e.target.closest("#trainPage .nxp-step")) e.preventDefault(); }, true);
    document.addEventListener("click", e => {
      if (swallow && e.isTrusted && Date.now() - swallow < 400) { e.stopPropagation(); e.preventDefault(); swallow = 0; }
    }, true);
  }
  function bindTrain(page, entering) {
    fitTrain();
    fitNums();
    syncVs();
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
    const b = page.querySelector(".st-tr-count b");
    if (b) {
      const n = Number(b.textContent), prev = state0.lastCount;
      if (!entering && Number.isFinite(prev) && n > prev && !reduced()) { b.classList.remove("st-tick"); void b.offsetWidth; b.classList.add("st-tick"); }
      state0.lastCount = n;
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
    "\u00d7": ["M6 6l12 12M18 6L6 18", "Close", false], "\u2713": ["M5 12.5l4.5 4.5L19 7.5", "Done", true]
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
  function bindIcons() {
    iconify(document.body);
    new MutationObserver(list => { for (const m of list) m.addedNodes.forEach(n => { if (n.nodeType === 1) iconify(n); }); })
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
      if (el.classList.contains("st-rv")) el.classList.add("st-rv-in");
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

  /* Scroll position feeds the canvas parallax (a CSS variable, so no per-frame layout). */
  function bindParallax() {
    let raf = 0;
    const set = () => { raf = 0; document.documentElement.style.setProperty("--st-sy", String(Math.round(window.scrollY || 0))); };
    window.addEventListener("scroll", () => { if (!raf && !reduced()) raf = requestAnimationFrame(set); }, { passive: true });
  }
  function bindRipple() {
    const SEL = ".st-tile,.st-qa,.st-cta,.st-chip,.st-plan-row,.st-dec-chip";
    document.addEventListener("pointerdown", e => {
      if (reduced() || (e.pointerType === "mouse" && e.button !== 0)) return;
      const host = e.target && e.target.closest && e.target.closest(SEL);
      if (!host || host.disabled) return;
      const r = host.getBoundingClientRect(), sp = document.createElement("span");
      sp.className = "st-ripple"; sp.setAttribute("aria-hidden", "true");
      const i = document.createElement("i");
      const d = Math.max(r.width, r.height) * 1.6;
      i.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
      sp.appendChild(i); host.appendChild(sp);
      setTimeout(() => sp.remove(), 650);
    }, true);
  }
  function hydrate(page) {
    if (!page) return;
    const tab = (typeof state === "object" && state && state.tab) || "home";
    const entering = state0.lastTab !== tab;
    state0.lastTab = tab;
    document.documentElement.setAttribute("data-st-tab", tab);
    stopReplay();
    page.classList.toggle("st-enter", entering && !reduced());
    if (entering && !reduced()) setTimeout(() => page.classList.remove("st-enter"), 1400);
    page.querySelectorAll("[data-st-hero]").forEach(t => {
      const odo = t.querySelector("[data-st-odo]");
      if (odo) odoSet(odo, odo.dataset.stOdo, entering);
      drawHero(t, entering);
    });
    page.querySelectorAll("[data-st-odo]").forEach(o => { if (!o.closest("[data-st-hero]")) odoSet(o, o.dataset.stOdo, entering); });
    page.querySelectorAll("[data-st-cmap]").forEach(h => drawCompMap(h, entering));
    if (entering) page.querySelectorAll("[data-st-count]").forEach(countUp);
    dressProgress(page);
    dressWeeks(page, entering);
    foldPerf(page);
    foldBody(page);
    dressRecap(page);
    if (page.id === "trainPage") bindTrain(page, entering);
    bindProgressReplay(page);
    bindView(page, entering);
    syncDock();
  }
  function wrap(name, pageId) {
    const fn = window[name];
    if (typeof fn !== "function" || fn.__strata) return;
    const wrapped = function () {
      const out = fn.apply(this, arguments);
      try { hydrate(document.getElementById(pageId)); } catch (e) { console.error(e); }
      return out;
    };
    wrapped.__strata = true;
    window[name] = wrapped;
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
    } catch (e) { void wrap; console.error(e); }
    bindSpotlight();
    bindStepBump();
    bindSheets();
    if (typeof NXT === "object" && typeof NXT.selectPoint === "function" && !NXT.selectPoint.__strata) {
      const sp = NXT.selectPoint;
      NXT.selectPoint = function (index, opts) { const o = sp.apply(this, arguments); try { progressTip(index, opts); weeksSync(index); } catch (e) {} return o; };
      NXT.selectPoint.__strata = true;
    }
    bindCalSwipe();
    bindIcons();
    bindHold();
    bindRipple();
    bindParallax();
    ['input','click','pointerup'].forEach(ev=>document.addEventListener(ev,e=>{ if(e.target&&e.target.closest&&e.target.closest('#trainPage .st-entry,#trainPage .st-refc,#trainPage .nxp-seg'))setTimeout(syncVs,0); },true));
    document.addEventListener("pointerup", e => {
      const w = e.target && e.target.closest && e.target.closest("#vn-chart-wrap");
      if (w) setTimeout(() => { const t = w.querySelector(".st-tip"); if (t) t.hidden = true; }, 1400);
    }, true);
    let rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        document.querySelectorAll("[data-st-hero]").forEach(t => drawHero(t, false));
        document.querySelectorAll("[data-st-cmap]").forEach(h => drawCompMap(h, false));
        fitTrain();
      }, 150);
    });
    document.documentElement.classList.add("st-on");
  }
  return { hydrate, install, odoSet, stopReplay };
})();
STRATA.install();
if (typeof NXT === "object" && NXT && typeof NXT.repaint === "function" && document.readyState !== "loading") {
  try { render(); } catch (e) { /* render() reports its own errors */ }
}
