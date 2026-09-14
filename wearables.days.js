/* NXTFRM G4A: UserDayWindow + current day-window pointer.
 * In-memory only. No snapshots, evidence assignment, recovery, or UI.
 */
"use strict";
(function (root) {
  var SCHEMA = "g1.2.1";
  var BOUNDARY = "g4a.user_day_windows";
  var RULE_ID = "user_day_window.g1.2";
  var RULE_VERSION = "1";
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  var IANA_RE = /^[A-Za-z0-9_+\-\/]+$/;

  var OUTCOME = Object.freeze({
    created: "created",
    reused: "reused",
    pointer_set: "pointer_set",
    pointer_unchanged: "pointer_unchanged",
    missing_pointer: "missing_pointer",
    invalid_date: "invalid_date",
    invalid_timezone: "invalid_timezone",
    invalid_window: "invalid_window",
    invalid_pointer: "invalid_pointer",
    continuity_break: "continuity_break",
    integrity_conflict: "integrity_conflict"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function daysErr(code, message, details) {
    var err = new Error(message);
    err.code = code;
    err.details = details == null ? null : details;
    return err;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toCanonUtc(ms) {
    if (!Number.isFinite(ms) || ms % 1000 !== 0) {
      throw daysErr(OUTCOME.invalid_window, "UTC instant must be an exact second.");
    }
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()) +
      "T" + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + ":" + pad2(d.getUTCSeconds()) + "Z";
  }

  function parseUtc(value) {
    if (typeof value !== "string" || !UTC_RE.test(value)) return NaN;
    var ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : NaN;
  }

  function sha256Hex(message) {
    var bytes = utf8Bytes(String(message));
    var bitLen = bytes.length * 8;
    var padded = bytes.slice();
    padded.push(0x80);
    while ((padded.length % 64) !== 56) padded.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    padded.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    padded.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var i;
    for (i = 0; i < padded.length; i += 64) {
      var w = new Array(64);
      var t;
      for (t = 0; t < 16; t++) {
        var o = i + t * 4;
        w[t] = ((padded[o] << 24) | (padded[o + 1] << 16) | (padded[o + 2] << 8) | padded[o + 3]) >>> 0;
      }
      for (t = 16; t < 64; t++) {
        var s0 = (rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3)) >>> 0;
        var s1 = (rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var hex = "";
    for (i = 0; i < H.length; i++) hex += ("00000000" + H[i].toString(16)).slice(-8);
    return hex;
  }

  function utf8Bytes(str) {
    var out = [];
    var i;
    for (i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var u = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        out.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function parseLocalDate(value) {
    if (typeof value !== "string" || !DATE_RE.test(value)) return null;
    var y = +value.slice(0, 4);
    var m = +value.slice(5, 7);
    var d = +value.slice(8, 10);
    var utc = Date.UTC(y, m - 1, d);
    var dt = new Date(utc);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return null;
    return { year: y, month: m, day: d, text: value };
  }

  function addCalendarDay(dateText) {
    var parsed = parseLocalDate(dateText);
    if (!parsed) return null;
    var next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1));
    return next.getUTCFullYear() + "-" + pad2(next.getUTCMonth() + 1) + "-" + pad2(next.getUTCDate());
  }

  function isValidIana(tz) {
    if (!isNonEmptyString(tz) || !IANA_RE.test(tz)) return false;
    if (/^[+-]\d/.test(tz) || /UTC[+-]/i.test(tz) || tz === "Z") return false;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch (err) {
      return false;
    }
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone").indexOf(tz) !== -1;
    }
    return true;
  }

  function tzFormatter(tz) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function tzParts(fmt, instant) {
    var out = {};
    fmt.formatToParts(instant).forEach(function (part) {
      if (part.type !== "literal") out[part.type] = part.value;
    });
    return out;
  }

  function offsetAt(fmt, instant) {
    var p = tzParts(fmt, instant);
    var hour = p.hour === "24" ? 0 : +p.hour;
    return Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second) - instant.getTime();
  }

  function zonedLocalToUtc(year, month, day, hour, minute, second, tz) {
    var fmt = tzFormatter(tz);
    var utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
    var instant = utcGuess - offsetAt(fmt, new Date(utcGuess));
    instant = utcGuess - offsetAt(fmt, new Date(instant));
    instant = utcGuess - offsetAt(fmt, new Date(instant));
    var p = tzParts(fmt, new Date(instant));
    var gotHour = p.hour === "24" ? 0 : +p.hour;
    if (+p.year !== year || +p.month !== month || +p.day !== day || gotHour !== hour || +p.minute !== minute || +p.second !== second) {
      throw daysErr(OUTCOME.invalid_timezone, "Could not resolve local civil time in timezone.");
    }
    return instant;
  }

  function deriveBoundaries(localDate, timezone) {
    var parsed = parseLocalDate(localDate);
    if (!parsed) throw daysErr(OUTCOME.invalid_date, "local_date must be a real YYYY-MM-DD calendar date.");
    if (!isValidIana(timezone)) throw daysErr(OUTCOME.invalid_timezone, "representative_timezone must be a valid IANA name.");
    var next = addCalendarDay(parsed.text);
    var startMs = zonedLocalToUtc(parsed.year, parsed.month, parsed.day, 0, 0, 0, timezone);
    var n = parseLocalDate(next);
    var endMs = zonedLocalToUtc(n.year, n.month, n.day, 0, 0, 0, timezone);
    if (!(startMs < endMs)) throw daysErr(OUTCOME.invalid_window, "Derived window start must precede end.");
    return {
      start_utc: toCanonUtc(startMs),
      end_utc: toCanonUtc(endMs)
    };
  }

  function intervalsOverlap(startA, endA, startB, endB) {
    var a0 = typeof startA === "number" ? startA : parseUtc(startA);
    var a1 = typeof endA === "number" ? endA : parseUtc(endA);
    var b0 = typeof startB === "number" ? startB : parseUtc(startB);
    var b1 = typeof endB === "number" ? endB : parseUtc(endB);
    if (![a0, a1, b0, b1].every(Number.isFinite)) return false;
    return a0 < b1 && a1 > b0;
  }

  function semanticKey(doc) {
    return [doc.user_id, doc.local_date, doc.representative_timezone, doc.assignment_source, doc.start_utc, doc.end_utc].join("\n");
  }

  function deterministicId(doc) {
    return "dw:" + sha256Hex(semanticKey(doc)).slice(0, 32);
  }

  function resultBase(outcome, extra) {
    var out = { outcome: outcome };
    var k;
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  function validateWindow(doc) {
    if (!doc || doc.document_type !== "user_day_window" || doc.schema_version !== SCHEMA) {
      throw daysErr(OUTCOME.invalid_window, "UserDayWindow envelope is invalid.");
    }
    if (Object.prototype.hasOwnProperty.call(doc, "is_current")) {
      throw daysErr(OUTCOME.invalid_window, "user_day_window must not persist is_current.");
    }
    if (doc.snapshot_id || doc.observation_revision || doc.activity_revision || doc.freshness_aggregate) {
      throw daysErr(OUTCOME.invalid_window, "Day window must not carry snapshot or evidence fields.");
    }
    if (!isNonEmptyString(doc.day_window_id) || !isNonEmptyString(doc.user_id)) {
      throw daysErr(OUTCOME.invalid_window, "day_window_id and user_id are required.");
    }
    if (!parseLocalDate(doc.local_date)) throw daysErr(OUTCOME.invalid_date, "local_date is invalid.");
    if (!isValidIana(doc.representative_timezone)) throw daysErr(OUTCOME.invalid_timezone, "representative_timezone is invalid.");
    if (doc.assignment_source !== "profile" && doc.assignment_source !== "travel_override") {
      throw daysErr(OUTCOME.invalid_window, "assignment_source must be profile or travel_override.");
    }
    if (doc.rule_id !== RULE_ID || doc.rule_version !== RULE_VERSION) {
      throw daysErr(OUTCOME.invalid_window, "rule_id/rule_version must be user_day_window.g1.2 v1.");
    }
    var startMs = parseUtc(doc.start_utc);
    var endMs = parseUtc(doc.end_utc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw daysErr(OUTCOME.invalid_window, "start_utc and end_utc must be canonical ...Z instants.");
    }
    if (!(startMs < endMs)) throw daysErr(OUTCOME.invalid_window, "window start must precede end.");
    if (doc.start_utc !== toCanonUtc(startMs) || doc.end_utc !== toCanonUtc(endMs)) {
      throw daysErr(OUTCOME.invalid_window, "UTC timestamps must use canonical YYYY-MM-DDTHH:MM:SSZ.");
    }
    if (doc.assignment_source === "profile") {
      var derived = deriveBoundaries(doc.local_date, doc.representative_timezone);
      if (doc.start_utc !== derived.start_utc || doc.end_utc !== derived.end_utc) {
        throw daysErr(OUTCOME.invalid_window, "profile window bounds must equal derived local midnights.");
      }
    }
    return doc;
  }

  function validatePointer(doc) {
    if (!doc || doc.document_type !== "current_day_window_pointer" || doc.schema_version !== SCHEMA) {
      throw daysErr(OUTCOME.invalid_pointer, "current_day_window_pointer envelope is invalid.");
    }
    if (!isNonEmptyString(doc.user_id) || !isNonEmptyString(doc.day_window_id)) {
      throw daysErr(OUTCOME.invalid_pointer, "pointer identity is incomplete.");
    }
    if (!parseLocalDate(doc.local_date)) throw daysErr(OUTCOME.invalid_date, "pointer local_date is invalid.");
    if (!Number.isFinite(parseUtc(doc.advanced_at_utc))) {
      throw daysErr(OUTCOME.invalid_pointer, "advanced_at_utc must be a canonical UTC instant.");
    }
    return doc;
  }

  function ptrKey(userId, localDate) {
    return userId + "|" + localDate;
  }

  function createDays() {
    var windows = new Map();
    var pointers = new Map();
    var bySemantic = new Map();
    var hooks = { failPointer: false };

    function snapshotState() {
      return {
        windows: Array.from(windows.entries()),
        pointers: Array.from(pointers.entries()),
        bySemantic: Array.from(bySemantic.entries())
      };
    }

    function restoreState(s) {
      windows = new Map(s.windows);
      pointers = new Map(s.pointers);
      bySemantic = new Map(s.bySemantic);
    }

    function listWindows(userId, localDate) {
      var out = [];
      windows.forEach(function (doc) {
        if (doc.user_id === userId && doc.local_date === localDate) out.push(clone(doc));
      });
      return out;
    }

    function currentWindowsForUser(userId, overrideDate, overrideWindow) {
      var out = [];
      var seen = {};
      pointers.forEach(function (ptr) {
        if (ptr.user_id !== userId) return;
        var win = ptr.local_date === overrideDate ? overrideWindow : windows.get(ptr.day_window_id);
        if (!win || seen[win.day_window_id]) return;
        seen[win.day_window_id] = true;
        out.push(win);
      });
      if (overrideWindow && !seen[overrideWindow.day_window_id]) out.push(overrideWindow);
      out.sort(function (a, b) {
        if (a.start_utc < b.start_utc) return -1;
        if (a.start_utc > b.start_utc) return 1;
        return 0;
      });
      return out;
    }

    function assertCurrentContinuity(userId, localDate, window) {
      var chain = currentWindowsForUser(userId, localDate, window);
      var i;
      for (i = 0; i < chain.length - 1; i++) {
        if (chain[i].end_utc !== chain[i + 1].start_utc) {
          throw daysErr(OUTCOME.continuity_break, "Current windows for a user must be gapless and non-overlapping.");
        }
      }
    }

    function createWindow(input) {
      input = input || {};
      try {
        if (!isNonEmptyString(input.user_id)) throw daysErr(OUTCOME.invalid_window, "user_id is required.");
        if (!parseLocalDate(input.local_date)) throw daysErr(OUTCOME.invalid_date, "local_date must be a real YYYY-MM-DD calendar date.");
        if (!isValidIana(input.representative_timezone)) throw daysErr(OUTCOME.invalid_timezone, "representative_timezone must be a valid IANA name.");
        if (input.assignment_source !== "profile" && input.assignment_source !== "travel_override") {
          throw daysErr(OUTCOME.invalid_window, "assignment_source must be profile or travel_override.");
        }
        var derived = deriveBoundaries(input.local_date, input.representative_timezone);
        var startUtc = input.start_utc == null ? derived.start_utc : input.start_utc;
        var endUtc = input.end_utc == null ? derived.end_utc : input.end_utc;
        var built = {
          document_type: "user_day_window",
          schema_version: SCHEMA,
          day_window_id: isNonEmptyString(input.day_window_id) ? input.day_window_id : "",
          user_id: input.user_id,
          local_date: input.local_date,
          representative_timezone: input.representative_timezone,
          start_utc: startUtc,
          end_utc: endUtc,
          assignment_source: input.assignment_source,
          rule_id: RULE_ID,
          rule_version: RULE_VERSION
        };
        if (!built.day_window_id) built.day_window_id = deterministicId(built);
        validateWindow(built);
        var sem = semanticKey(built);
        var existingId = bySemantic.get(sem);
        if (existingId) {
          var existing = windows.get(existingId);
          if (input.day_window_id && input.day_window_id !== existing.day_window_id) {
            return resultBase(OUTCOME.reused, {
              day_window_id: existing.day_window_id,
              window: clone(existing)
            });
          }
          return resultBase(OUTCOME.reused, {
            day_window_id: existing.day_window_id,
            window: clone(existing)
          });
        }
        var prior = windows.get(built.day_window_id);
        if (prior) {
          if (semanticKey(prior) !== sem) {
            return resultBase(OUTCOME.integrity_conflict, {
              day_window_id: prior.day_window_id,
              reason: "duplicate_day_window_id"
            });
          }
          return resultBase(OUTCOME.reused, {
            day_window_id: prior.day_window_id,
            window: clone(prior)
          });
        }
        windows.set(built.day_window_id, clone(built));
        bySemantic.set(sem, built.day_window_id);
        return resultBase(OUTCOME.created, {
          day_window_id: built.day_window_id,
          window: clone(built)
        });
      } catch (err) {
        if (err && (err.code === OUTCOME.invalid_date || err.code === OUTCOME.invalid_timezone || err.code === OUTCOME.invalid_window)) {
          return resultBase(err.code, { reason: err.message });
        }
        throw err;
      }
    }

    function setCurrent(userId, localDate, dayWindowId, advancedAtUtc) {
      var before = snapshotState();
      try {
        if (!isNonEmptyString(userId) || !isNonEmptyString(dayWindowId)) {
          throw daysErr(OUTCOME.invalid_pointer, "user_id and day_window_id are required.");
        }
        if (!parseLocalDate(localDate)) throw daysErr(OUTCOME.invalid_date, "local_date must be a real YYYY-MM-DD calendar date.");
        var window = windows.get(dayWindowId);
        if (!window) throw daysErr(OUTCOME.invalid_pointer, "pointer targets a missing day window.");
        if (window.user_id !== userId) throw daysErr(OUTCOME.invalid_pointer, "pointer user_id does not match window.");
        if (window.local_date !== localDate) throw daysErr(OUTCOME.invalid_pointer, "pointer local_date does not match window.");
        validateWindow(window);
        var pointer = {
          document_type: "current_day_window_pointer",
          schema_version: SCHEMA,
          user_id: userId,
          local_date: localDate,
          day_window_id: dayWindowId,
          advanced_at_utc: advancedAtUtc
        };
        validatePointer(pointer);
        assertCurrentContinuity(userId, localDate, window);
        var existing = pointers.get(ptrKey(userId, localDate));
        if (existing && existing.day_window_id === dayWindowId) {
          return resultBase(OUTCOME.pointer_unchanged, { pointer: clone(existing) });
        }
        if (hooks.failPointer) {
          hooks.failPointer = false;
          throw daysErr(OUTCOME.invalid_pointer, "Forced pointer failure.");
        }
        pointers.set(ptrKey(userId, localDate), clone(pointer));
        return resultBase(OUTCOME.pointer_set, { pointer: clone(pointer) });
      } catch (err) {
        restoreState(before);
        if (err && (err.code === OUTCOME.invalid_pointer || err.code === OUTCOME.invalid_date || err.code === OUTCOME.continuity_break || err.code === OUTCOME.invalid_window)) {
          return resultBase(err.code, { reason: err.message });
        }
        throw err;
      }
    }

    function getCurrentPointer(userId, localDate) {
      var doc = pointers.get(ptrKey(userId, localDate));
      return doc ? clone(doc) : null;
    }

    function getCurrent(userId, localDate) {
      var ptr = pointers.get(ptrKey(userId, localDate));
      if (!ptr) return null;
      var window = windows.get(ptr.day_window_id);
      if (!window) return null;
      if (window.user_id !== ptr.user_id || window.local_date !== ptr.local_date) return null;
      return clone(window);
    }

    function resolveCurrent(userId, localDate) {
      var ptr = getCurrentPointer(userId, localDate);
      if (!ptr) return resultBase(OUTCOME.missing_pointer, { window: null, pointer: null });
      var window = getCurrent(userId, localDate);
      if (!window) return resultBase(OUTCOME.invalid_pointer, { window: null, pointer: ptr });
      return resultBase("ok", { window: window, pointer: ptr });
    }

    function status() {
      return {
        schema_version: SCHEMA,
        api: "NXT.wearables.days",
        boundary: BOUNDARY,
        persists: false,
        network: false,
        interprets_recovery: false,
        day_windows: windows.size,
        current_pointers: pointers.size,
        snapshots: 0,
        snapshot_pointers: 0,
        observation_revisions: 0,
        activity_revisions: 0
      };
    }

    return {
      createWindow: createWindow,
      getWindow: function (id) {
        var doc = windows.get(id);
        return doc ? clone(doc) : null;
      },
      listWindows: listWindows,
      setCurrent: setCurrent,
      getCurrent: getCurrent,
      getCurrentPointer: getCurrentPointer,
      resolveCurrent: resolveCurrent,
      deriveBoundaries: function (localDate, timezone) {
        try {
          return resultBase("ok", deriveBoundaries(localDate, timezone));
        } catch (err) {
          if (err && (err.code === OUTCOME.invalid_date || err.code === OUTCOME.invalid_timezone || err.code === OUTCOME.invalid_window)) {
            return resultBase(err.code, { reason: err.message });
          }
          throw err;
        }
      },
      validateWindow: function (doc) {
        try {
          return resultBase("ok", { window: clone(validateWindow(clone(doc))) });
        } catch (err) {
          return resultBase(err.code || OUTCOME.invalid_window, { reason: err.message });
        }
      },
      intervalsOverlap: intervalsOverlap,
      exportState: function () {
        return {
          day_windows: clone(Array.from(windows.values())),
          pointers: clone(Array.from(pointers.values()))
        };
      },
      hydrateState: function (state, opts) {
        opts = opts || {};
        var skipped = [];
        var degraded = false;
        if (opts.replace !== false) {
          windows = new Map();
          pointers = new Map();
          bySemantic = new Map();
        }
        function skip(kind, reason, id) {
          degraded = true;
          skipped.push({ kind: kind, reason: reason, id: id || null });
        }
        (state && state.day_windows || []).forEach(function (doc) {
          try {
            validateWindow(clone(doc));
            windows.set(doc.day_window_id, clone(doc));
            bySemantic.set(semanticKey(doc), doc.day_window_id);
          } catch (err) {
            skip("day_window", err && err.message ? err.message : "malformed", doc && doc.day_window_id);
          }
        });
        (state && state.pointers || []).forEach(function (doc) {
          try {
            if (doc && Object.prototype.hasOwnProperty.call(doc, "is_current")) {
              throw daysErr(OUTCOME.invalid_pointer, "pointer must not persist is_current.");
            }
            validatePointer(clone(doc));
            var window = windows.get(doc.day_window_id);
            if (!window) throw daysErr(OUTCOME.invalid_pointer, "pointer targets a missing day window.");
            if (window.user_id !== doc.user_id) throw daysErr(OUTCOME.invalid_pointer, "pointer user_id does not match window.");
            if (window.local_date !== doc.local_date) throw daysErr(OUTCOME.invalid_pointer, "pointer local_date does not match window.");
            pointers.set(ptrKey(doc.user_id, doc.local_date), clone(doc));
          } catch (err) {
            skip("day_window_pointer", err && err.message ? err.message : "invalid_pointer", doc && doc.day_window_id);
          }
        });
        return { outcome: degraded ? "degraded" : "ok", skipped: skipped, degraded: degraded };
      },
      listAllWindows: function (userId) {
        var out = [];
        windows.forEach(function (doc) {
          if (!userId || doc.user_id === userId) out.push(clone(doc));
        });
        return out;
      },
      listAllPointers: function (userId) {
        var out = [];
        pointers.forEach(function (doc) {
          if (!userId || doc.user_id === userId) out.push(clone(doc));
        });
        return out;
      },
      status: status,
      createDays: createDays,
      OUTCOME: OUTCOME,
      _test: {
        installWindow: function (doc) {
          windows.set(doc.day_window_id, clone(doc));
          bySemantic.set(semanticKey(doc), doc.day_window_id);
        },
        installPointer: function (doc) {
          pointers.set(ptrKey(doc.user_id, doc.local_date), clone(doc));
        },
        failNextPointer: function () { hooks.failPointer = true; },
        clearHooks: function () { hooks.failPointer = false; }
      }
    };
  }

  var page = createDays();
  if (typeof NXT === "object" && NXT && NXT.wearables) NXT.wearables.days = page;
  root.NXTFRMWearableDays = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
