/* NXTFRM Native 1 — bundled into the iPhone app only (scripts/build-www.mjs); the web app never loads it.
   Bridges the web app to the NxtNative Capacitor plugin: rest on the lock screen, haptics, keep awake,
   Morning weigh-ins to Apple Health (one way), and the weigh-in reminder. It wraps existing globals and
   never edits them, so with the plugin absent the app behaves exactly as before (SPEC-native-1). */
(function () {
  "use strict";
  var W = window;
  var Cap = W.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins && Cap.Plugins.NxtNative;
  if (!P || W.__nxtNative) return;

  var PREFS_KEY = "nxt_native_prefs", MAP_KEY = "nxt_native_health", BF_KEY = "nxt_native_health_bf", WEIGH_KEY = "apm_bws", SCAN_KEY = "apm_evo_scans";
  var warned = {};

  /* Every native call goes through here: a rejection (or a missing method) is logged once and ignored. */
  function call(method, args) {
    try {
      /* A call that succeeds without data resolves to {}, so "it worked" never looks like a failure (null). */
      return Promise.resolve(P[method](args || {})).then(function (r) { return r == null ? {} : r; }).catch(function (e) { warnOnce(method, e); return null; });
    } catch (e) { warnOnce(method, e); return Promise.resolve(null); }
  }
  var notifyAsked = null;
  function askNotify() { return notifyAsked || (notifyAsked = call("notifyPermission")); }
  function warnOnce(tag, e) {
    if (warned[tag]) return;
    warned[tag] = 1;
    try { console.warn("[native]", tag, e && e.message ? e.message : e); } catch (x) {}
  }

  /* ---- storage (the two new keys only) ---- */
  var LS = W.localStorage;
  var rawGet = function (k) { try { return LS.getItem(k); } catch (e) { return null; } };
  var rawSet = function (k, v) { try { LS.setItem(k, v); } catch (e) {} };
  function readJSON(k, fallback) {
    try { var v = JSON.parse(rawGet(k)); return v && typeof v === "object" ? v : fallback; } catch (e) { return fallback; }
  }
  function prefs() {
    var p = readJSON(PREFS_KEY, {});
    return { health: !!p.health, reminder: !!p.reminder, reminderTime: /^\d\d:\d\d$/.test(p.reminderTime) ? p.reminderTime : "07:30" };
  }
  function savePrefs(p) { rawSet(PREFS_KEY, JSON.stringify(p)); }

  /* ---- dates ---- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function atLocal(date, hh, mm) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(date || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], hh, mm, 0, 0).getTime() : NaN;
  }

  /* ---- rest: lock screen + notification ---- */
  function restEnd() { return typeof apx96RestEnd === "number" ? apx96RestEnd : 0; }
  function nextSet() {
    /* Read-only: the exercise the app has queued and which set is next. */
    try {
      var s = typeof state === "object" && state ? state : null;
      var name = (s && s.exercise) || "";
      var t = typeof template === "function" ? (template() || []).find(function (e) { return e && e.name === name; }) : null;
      var n = s && Number(s.setNum) > 0 ? Number(s.setNum) : 0;
      var sub = n ? "Set " + n + (t && t.sets ? " of " + t.sets : "") + " next" : "Next set";
      return { title: name || "Rest", subtitle: sub, body: name ? name + " · " + sub.toLowerCase() : "Next set is up" };
    } catch (e) { return { title: "Rest", subtitle: "Next set", body: "Next set is up" }; }
  }
  var liveOn = false;
  function restChanged(isAdjust) {
    var end = restEnd();
    if (!end) return;
    var n = nextSet();
    call("notifyPermission");
    /* The rest-end alert needs notification permission even when the weigh-in reminder is off: ask once, at the first rest. */
    askNotify().then(function () { return call("schedule", { id: "rest", at: end, title: "Rest done", body: n.body }); });
    if (isAdjust && liveOn) {
      call("liveUpdate", { endAt: end, subtitle: n.subtitle }).then(function (r) {
        if (r && r.ok === false) call("liveStart", { endAt: end, title: n.title, subtitle: n.subtitle });
      });
    } else {
      liveOn = true;
      call("liveStart", { endAt: end, title: n.title, subtitle: n.subtitle });
    }
  }
  function restStopped() {
    liveOn = false;
    call("cancel", { ids: ["rest"] });
    call("liveEnd");
  }

  /* Wrap a global function, keeping `this` and the return value; `after` never gets to throw. */
  function wrap(name, before, after) {
    var orig = W[name];
    if (typeof orig !== "function") return;
    W[name] = function () {
      var ctx = before ? safe(before) : undefined;
      var out = orig.apply(this, arguments);
      if (after) safe(function () { after(ctx, arguments); });
      return out;
    };
  }
  function safe(fn) { try { return fn(); } catch (e) { warnOnce("hook", e); } }

  var lastLogCount = -1;
  function logCount() { try { return typeof state === "object" && state && Array.isArray(state.logs) ? state.logs.length : 0; } catch (e) { return 0; } }
  lastLogCount = logCount();
  wrap("apx96StartRest", null, function () {
    var c = logCount();
    if (c > lastLogCount) call("haptic", { style: "medium" });
    lastLogCount = c;
    restChanged(false);
  });
  wrap("apx96AdjustRest", null, function () { restChanged(true); });
  wrap("apx96SkipRest", null, function () { restStopped(); });
  wrap("apx96TickTimer", function () { return restEnd(); }, function (was) {
    /* A running timer that reached zero by itself (skip clears the end first, so it is not counted here). */
    if (was > 0 && !restEnd()) { liveOn = false; call("haptic", { style: "success" }); call("liveEnd"); }
  });
  W.document.addEventListener("visibilitychange", function () {
    if (W.document.visibilityState === "visible") {
      if (!restEnd()) { liveOn = false; call("liveEnd"); }
      refreshReminders();
    }
  });

  /* ---- tab haptic ---- */
  wrap("switchTab", function () { return typeof state === "object" && state ? state.tab : undefined; }, function (before) {
    if (typeof state === "object" && state && state.tab !== before) call("haptic", { style: "selection" });
  });

  /* ---- keep awake while a workout is on screen ---- */
  var awake = null;
  function syncAwake() {
    var on = !!(W.document.documentElement && W.document.documentElement.classList.contains("st-in-workout"));
    if (on === awake) return;
    awake = on;
    call("keepAwake", { on: on });
  }
  if (typeof W.MutationObserver === "function" && W.document.documentElement) {
    new W.MutationObserver(syncAwake).observe(W.document.documentElement, { attributes: true, attributeFilter: ["class"] });
    syncAwake();
  }

  /* ---- Morning weigh-ins ---- */
  /* The engine's own rule (cut-support.js cleanRows, via NXT.weights): a Morning row, or a row that never
     recorded a timing; one canonical row per date. Anything else is contextual and is not sent. */
  function morningRows() {
    return typeof NXT === "object" && NXT && typeof NXT.weights === "function" ? NXT.weights() : null;
  }
  function sampleTime(r) {
    var ts = Number(r.ts), d = ts > 0 ? new Date(ts) : null;
    return d && ymd(d) === r.date ? ts : atLocal(r.date, 7, 0);
  }
  var lastVersion = 0;
  function nextVersion() { lastVersion = Math.max(Date.now(), lastVersion + 1); return lastVersion; }

  function syncHealth() {
    var rows = morningRows();
    if (!rows) return Promise.resolve();
    var map = readJSON(MAP_KEY, {}), seen = {}, chain = Promise.resolve();
    rows.forEach(function (r) {
      var kg = Number(r.weight);
      if (!r.id || !(kg > 0)) return;
      var sig = kg + "|" + r.date + "|" + (r.ts || "");
      seen[r.id] = 1;
      if (map[r.id] === sig) return;
      chain = chain.then(function () {
        return call("healthSaveWeight", { id: String(r.id), kg: kg, at: sampleTime(r), version: nextVersion() }).then(function (res) {
          if (res) map[r.id] = sig;
        });
      });
    });
    Object.keys(map).forEach(function (id) {
      if (seen[id]) return;
      chain = chain.then(function () {
        return call("healthDeleteWeight", { id: id }).then(function (res) { if (res) delete map[id]; });
      });
    });
    return chain.then(function () { rawSet(MAP_KEY, JSON.stringify(map)); });
  }

  /* Evo scan body fat % (only this field maps faithfully to Health; scan weight is post-workout and stays out). */
  function syncBodyFat() {
    var raw = readJSON(SCAN_KEY, []);
    var scans = Array.isArray(raw) ? raw : [];
    var map = readJSON(BF_KEY, {}), seen = {}, chain = Promise.resolve(), today = ymd(new Date());
    scans.forEach(function (r) {
      var pct = r && r.bodyFat === null ? NaN : Number(r && r.bodyFat);
      if (!r || !r.id || !(pct >= 2 && pct <= 70) || !r.date || r.date > today) return;
      var sig = pct + "|" + r.date;
      seen[r.id] = 1;
      if (map[r.id] === sig) return;
      chain = chain.then(function () {
        return call("healthSaveBodyFat", { id: String(r.id), pct: pct, at: atLocal(r.date, 12, 0), version: nextVersion() }).then(function (res) {
          if (res) map[r.id] = sig;
        });
      });
    });
    Object.keys(map).forEach(function (id) {
      if (seen[id]) return;
      chain = chain.then(function () {
        return call("healthDeleteBodyFat", { id: id }).then(function (res) { if (res) delete map[id]; });
      });
    });
    return chain.then(function () { rawSet(BF_KEY, JSON.stringify(map)); });
  }

  /* ---- reminder: the next 7 days, minus days that already have a Morning weigh-in ---- */
  function refreshReminders() {
    var p = prefs();
    var done = call("cancelPrefix", { prefix: "rem-" });
    if (!p.reminder) return done;
    var rows = morningRows() || [], have = {};
    rows.forEach(function (r) { have[r.date] = 1; });
    var hh = +p.reminderTime.slice(0, 2), mm = +p.reminderTime.slice(3), now = Date.now(), today = new Date();
    for (var i = 0; i < 7; i++) {
      var day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var date = ymd(day), at = atLocal(date, hh, mm);
      if (have[date] || !(at > now)) continue;
      done = done.then(function (d, a) { return function () {
        return call("schedule", { id: "rem-" + d, at: a, title: "Morning weigh-in", body: "Log it before you eat or train." });
      }; }(date, at));
    }
    return done;
  }

  var queue = Promise.resolve();
  function flush() {
    queue = queue.then(function () {
      return (prefs().health ? syncHealth().then(syncBodyFat) : Promise.resolve()).then(refreshReminders);
    }).catch(function (e) { warnOnce("flush", e); });
    return queue;
  }
  var timer = null;
  function scheduleFlush() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; flush(); }, 400);
  }

  /* Every weigh-in save path ends in localStorage.setItem("apm_bws", …). Patch the Storage prototype where
     it exists (assigning on the instance would store a key in WebKit), else the object itself. */
  var holder = W.Storage && W.Storage.prototype && W.Storage.prototype.setItem ? W.Storage.prototype : LS;
  var origSet = holder.setItem;
  holder.setItem = function (k) {
    var out = origSet.apply(this, arguments);
    if (k === WEIGH_KEY || k === SCAN_KEY) safe(scheduleFlush);
    return out;
  };

  /* ---- Settings › On this iPhone ---- */
  var note = { health: "", reminder: "" };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sw(id, on, label) {
    return '<button type="button" class="toggle' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '" data-nxn="' + id + '"><span></span></button>';
  }
  function groupHTML() {
    var p = prefs();
    return '<h2 class="vn-set-grp">On this iPhone</h2><div class="vn-set-rows">'
      + '<div class="vn-set-row" data-nxn-row="health"><span class="vn-set-l"><span class="vn-set-t">Apple Health</span><span class="vn-set-s">' + esc(note.health || "Send morning weigh-ins and scan body fat") + '</span></span>' + sw("health", p.health, "Send morning weigh-ins to Apple Health") + '</div>'
      + '<div class="vn-set-row" data-nxn-row="reminder"><span class="vn-set-l"><span class="vn-set-t">Weigh-in reminder</span><span class="vn-set-s">' + esc(note.reminder || "Daily, skipped once you have weighed in") + '</span></span>' + sw("reminder", p.reminder, "Daily weigh-in reminder") + '</div>'
      + (p.reminder ? '<div class="vn-set-row"><span class="vn-set-l"><label class="vn-set-t" for="nxn-time">Reminder time</label></span><input id="nxn-time" class="input" type="time" value="' + p.reminderTime + '" style="width:auto;flex:none"></div>' : "")
      + '</div>';
  }
  function renderGroup(el) { el.innerHTML = groupHTML(); }
  function setPref(key, on) {
    var p = prefs(); p[key] = on; savePrefs(p);
  }
  function toggle(which) {
    var p = prefs(), on = !p[which];
    note[which] = "";
    if (!on) { setPref(which, false); if (which === "reminder") refreshReminders(); return Promise.resolve(); }
    if (which === "health") {
      return call("healthAvailable").then(function (a) {
        if (!a || !a.available) throw new Error("Apple Health is not available on this device.");
        return call("healthAuthorize");
      }).then(function (g) {
        if (!g || !g.granted) throw new Error("Allow NXTFRM to write Body Mass in the Health app.");
        setPref("health", true);
        return flush();
      }).catch(function (e) { note.health = e.message; setPref("health", false); });
    }
    return call("notifyPermission").then(function (g) {
      if (!g || !g.granted) throw new Error("Allow notifications for NXTFRM in iOS Settings.");
      setPref("reminder", true);
      return refreshReminders();
    }).catch(function (e) { note.reminder = e.message; setPref("reminder", false); });
  }
  function injectSettings() {
    var page = W.document.getElementById("morePage");
    if (!page || page.getAttribute("data-vn-view") !== "hub") return;
    if (page.querySelector(".nxn-group")) return;
    var groups = page.querySelectorAll(".vn-set-group");
    if (!groups.length) return;
    var sec = W.document.createElement("section");
    sec.className = "vn-set-group nxn-group";
    renderGroup(sec);
    groups[groups.length - 1].parentNode.insertBefore(sec, groups[groups.length - 1]);
    sec.addEventListener("click", function (ev) {
      var row = ev.target.closest && ev.target.closest("[data-nxn-row]");
      if (!row || (ev.target.closest && ev.target.closest("input"))) return;
      toggle(row.getAttribute("data-nxn-row")).then(function () { renderGroup(sec); });
    });
    sec.addEventListener("change", function (ev) {
      if (!ev.target || ev.target.id !== "nxn-time" || !/^\d\d:\d\d$/.test(ev.target.value)) return;
      var p = prefs(); p.reminderTime = ev.target.value; savePrefs(p);
      refreshReminders();
    });
  }
  var more = W.document.getElementById("morePage");
  if (more && typeof W.MutationObserver === "function") new W.MutationObserver(function () { safe(injectSettings); }).observe(more, { childList: true, subtree: true });
  safe(injectSettings);

  /* Reminders are rebuilt on every open, once the page has loaded the app state. */
  setTimeout(function () { safe(refreshReminders); }, 1500);

  W.__nxtNative = { _flush: flush, _refreshReminders: refreshReminders, _inject: injectSettings, _toggle: toggle };
})();
