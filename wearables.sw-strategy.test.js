"use strict";
/* Service-worker fetch strategy (Ascension performance pass).

   Loads the SHIPPED sw.js into a vm with a fake self / caches / fetch and drives its real
   install, activate, fetch and push listeners. Nothing here models the worker: if the
   strategy in sw.js changes, these assertions see it.

   The contract under test:
     - requests for this release's versioned files (?v=<RELEASE>) and for the font and icons
       listed in ASSETS are stale-while-revalidate: the cached copy answers at once, and in the
       same event one conditional background fetch refreshes the entry for the next launch
       (replaced only by an ok, non-redirected response with a different ETag; a failed fetch
       leaves the cache untouched). A miss fetches and stores; an offline miss answers 503;
     - navigations and everything unversioned stay network-first, with the cache (and the
       cached ./index.html for a navigation) as the offline fallback;
     - requests outside the worker's scope, and non-GET requests, are left alone;
     - the worker never touches the page's own storage;
     - the shell it precaches is what index.html loads, and a release is bumped as a unit
       (every ?v= in index.html equals RELEASE), which is what makes a real release switch
       atomically. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const SW_SRC = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

/* ---- a fake worker environment around the real sw.js ------------------------------------ */
function createWorld(opts) {
  opts = opts || {};
  const scope = opts.scope || "https://app.example.test/";
  const listeners = {};
  const stores = new Map();                 // cache name -> Map(absolute url -> Response)
  // net.hold: a promise the network waits on before answering (the answer must not depend on it)
  const net = { calls: [], requests: [], online: true, status: 200, redirected: false, etag: null, hold: null, body: url => "net:" + url };
  const puts = [];
  const precacheRequests = [];              // the Request objects handed to cache.addAll at install
  const lookups = [];                       // every cache.match: which cache, which url, which options
  const deleted = [];
  const counters = { skipWaiting: 0, claim: 0 };
  const notifications = [];
  const abs = u => new URL(u, scope).href;
  const urlOf = r => (typeof r === "string" ? abs(r) : r.url);

  function fetchImpl(request) {
    const url = urlOf(request);
    net.calls.push(url);
    net.requests.push(request);
    const respond = () => {
      if (!net.online) return Promise.reject(new TypeError("Failed to fetch"));
      const res = new Response(net.body(url), { status: net.status, headers: net.etag ? { etag: net.etag } : {} });
      if (net.redirected) Object.defineProperty(res, "redirected", { value: true });
      return Promise.resolve(res);
    };
    return net.hold ? net.hold.then(respond) : respond();
  }

  function makeCache(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      match(request, options) {
        const url = urlOf(request);
        lookups.push({ cache: name, url, options });
        return Promise.resolve(entries.has(url) ? entries.get(url).clone() : undefined);
      },
      put(request, response) {
        const url = urlOf(request);
        puts.push({ cache: name, url });
        entries.set(url, response);
        return Promise.resolve();
      },
      addAll(requests) {
        precacheRequests.push(...requests);
        return Promise.all(requests.map(r => fetchImpl(r).then(res => {
          if (!res.ok) throw new TypeError("addAll: bad response for " + urlOf(r));
          entries.set(urlOf(r), res);
        }))).then(() => undefined);
      }
    };
  }

  const caches = {
    open(name) { return Promise.resolve(makeCache(name)); },
    keys() { return Promise.resolve([...stores.keys()]); },
    delete(name) { deleted.push(name); return Promise.resolve(stores.delete(name)); },
    match(request) {
      const url = urlOf(request);
      for (const entries of stores.values()) if (entries.has(url)) return Promise.resolve(entries.get(url).clone());
      return Promise.resolve(undefined);
    }
  };

  // new Request(url, init) at install, new Request(event.request, init) when revalidating
  class FakeRequest {
    constructor(input, init) {
      const base = typeof input === "string" ? { url: abs(input), method: "GET", mode: "no-cors" } : input;
      this.url = base.url; this.method = base.method || "GET"; this.mode = base.mode || "no-cors";
      this.cache = (init && init.cache) || base.cache;
    }
  }

  const opened = [];
  const sandbox = {
    URL, Response, Request: FakeRequest, caches, fetch: fetchImpl, console,
    clients: { matchAll() { return Promise.resolve([]); }, openWindow(u) { opened.push(u); return Promise.resolve(); } }
  };
  sandbox.self = {
    registration: { scope, showNotification(title, o) { notifications.push({ title, o }); return Promise.resolve(); } },
    addEventListener(type, fn) { listeners[type] = fn; },
    skipWaiting() { counters.skipWaiting++; return Promise.resolve(); },
    clients: { claim() { counters.claim++; return Promise.resolve(); } }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SW_SRC, ctx, { filename: "sw.js" });
  const exported = vm.runInContext("({ RELEASE, CACHE_NAME, ASSETS, VERSIONED })", ctx);

  const world = {
    scope, abs, net, puts, precacheRequests, lookups, deleted, counters, notifications, opened, listeners, stores,
    RELEASE: exported.RELEASE, CACHE_NAME: exported.CACHE_NAME,
    ASSETS: Array.from(exported.ASSETS), VERSIONED: Array.from(exported.VERSIONED),
    seed(url, body, cacheName, headers) {
      const name = cacheName || exported.CACHE_NAME;
      if (!stores.has(name)) stores.set(name, new Map());
      stores.get(name).set(abs(url), new Response(body, headers ? { headers } : undefined));
    },
    cached(url, cacheName) {
      const entries = stores.get(cacheName || exported.CACHE_NAME);
      return !!entries && entries.has(abs(url));
    },
    // The network stops answering until the returned function is called.
    holdNetwork() { let release; net.hold = new Promise(r => { release = r; }); return () => { net.hold = null; release(); }; },
    // Dispatches a fetch event. `extended` holds what the worker passed to event.waitUntil; settle() awaits it.
    async fetch(url, init) {
      init = init || {};
      const request = { url: abs(url), method: init.method || "GET", mode: init.mode || "no-cors" };
      const extended = [];
      let responded = null;
      listeners.fetch({ request, respondWith(p) { responded = Promise.resolve(p); }, waitUntil(p) { extended.push(Promise.resolve(p)); } });
      if (!responded) return { handled: false, extended, settle: () => Promise.all(extended) };
      // An answer that waits on the (held) network would hang the suite; fail it instead.
      let timer;
      const response = await Promise.race([responded, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("no answer within 1 s: the worker is waiting on something it should not")), 1000); })]);
      clearTimeout(timer);
      return { handled: true, status: response.status, text: await response.text(), extended, settle: () => Promise.all(extended) };
    },
    async install() { let p; listeners.install({ waitUntil(x) { p = x; } }); await p; },
    async activate() { let p; listeners.activate({ waitUntil(x) { p = x; } }); await p; }
  };
  return world;
}

/* ---- stale-while-revalidate: this release's files, the font and the icons ---------------- */
test("a cached versioned file is answered from the cache at once, while exactly one conditional background fetch refreshes it", async () => {
  const w = createWorld();
  const url = "premium-ui.js?v=" + w.RELEASE;
  w.seed(url, "old-bytes", undefined, { etag: '"old"' });
  w.net.etag = '"new"';
  const release = w.holdNetwork();                       // the network is still silent when the answer arrives
  const out = await w.fetch(url);
  assert.strictEqual(out.handled, true);
  assert.strictEqual(out.text, "old-bytes", "the cached copy must answer without waiting for the network");
  assert.deepStrictEqual(w.net.calls, [w.abs(url)], "exactly one background fetch");
  assert.strictEqual(w.net.requests[0].cache, "no-cache", "a conditional request, so an unchanged file is a 304 and a long max-age cannot hide a change");
  assert.strictEqual(out.extended.length, 1, "the revalidation must be held open with event.waitUntil");
  assert.strictEqual(w.puts.length, 0, "nothing is stored until the network has answered");
  release();
  await out.settle();
  assert.strictEqual(w.puts.length, 1, "the new bytes replace the cache entry");
  assert.strictEqual(w.puts[0].cache, w.CACHE_NAME);
  const next = await w.fetch(url);
  assert.strictEqual(next.text, "net:" + w.abs(url), "the next launch runs the new bytes");
  await next.settle();
  assert.strictEqual(w.puts.length, 1, "an unchanged ETag is not written again");
  assert.strictEqual(w.net.calls.length, 2, "one background fetch per request, no more");
});

test("a failed background fetch leaves the cache untouched, and the answer is still the cached copy", async () => {
  const w = createWorld();
  const url = "strata.js?v=" + w.RELEASE;
  w.seed(url, "cached-strata", undefined, { etag: '"a"' });
  w.net.online = false;
  const out = await w.fetch(url);
  assert.strictEqual(out.text, "cached-strata");
  await out.settle();                                    // the revalidation must end quietly, not reject
  assert.strictEqual(w.net.calls.length, 1);
  assert.strictEqual(w.puts.length, 0, "a failed fetch must write nothing");
  const again = await w.fetch(url);
  assert.strictEqual(again.text, "cached-strata", "the entry is exactly as it was");
  await again.settle();
});

test("only an ok, non-redirected response with a different ETag replaces the entry", async () => {
  const cases = [
    { name: "404", set: n => { n.status = 404; }, replaced: false },
    { name: "500", set: n => { n.status = 500; }, replaced: false },
    { name: "redirected", set: n => { n.redirected = true; }, replaced: false },
    { name: "same ETag", set: n => { n.etag = '"same"'; }, seedEtag: '"same"', replaced: false },
    { name: "different ETag", set: n => { n.etag = '"b"'; }, seedEtag: '"a"', replaced: true },
    { name: "no ETag on either side", set: () => {}, replaced: true }
  ];
  for (const c of cases) {
    const w = createWorld();
    const url = "vnext.css?v=" + w.RELEASE;
    w.seed(url, "old", undefined, c.seedEtag ? { etag: c.seedEtag } : undefined);
    c.set(w.net);
    const out = await w.fetch(url);
    assert.strictEqual(out.text, "old", c.name + ": the answer is always the cached copy");
    await out.settle();
    assert.strictEqual(w.puts.length, c.replaced ? 1 : 0, c.name + ": replaced?");
    const after = await w.fetch(url);
    assert.strictEqual(after.text, c.replaced ? "net:" + w.abs(url) : "old", c.name + ": what the next launch runs");
    await after.settle();
  }
});

test("an uncached versioned request fetches once, answers with the network and stores it; the next one comes from the cache", async () => {
  const w = createWorld();
  const url = "strata.js?v=" + w.RELEASE;
  const first = await w.fetch(url);
  assert.strictEqual(first.text, "net:" + w.abs(url));
  assert.strictEqual(w.net.calls.length, 1, "a miss is one fetch, with no extra revalidation");
  await first.settle();
  assert.ok(w.cached(url), "the response must be stored in the current cache");
  assert.strictEqual(w.puts[0].cache, w.CACHE_NAME);
  const release = w.holdNetwork();
  const second = await w.fetch(url);
  assert.strictEqual(second.text, "net:" + w.abs(url), "answered from the cache while the network is silent");
  assert.strictEqual(w.net.calls.length, 2, "and revalidated once in the background");
  release();
  await second.settle();
});

test("the font and icons listed in ASSETS use the same strategy even though their URLs are unversioned", async () => {
  const w = createWorld();
  const statics = w.ASSETS.filter(a => /\.(woff2|png|svg)$/.test(a));
  assert.ok(statics.length >= 5, "expected the font and four icons in ASSETS, got " + statics.join(","));
  const release = w.holdNetwork();
  const outs = [];
  for (const a of statics) {
    w.seed(a, "cached:" + a);
    const out = await w.fetch(a);
    assert.strictEqual(out.text, "cached:" + a, a + " must answer from the cache at once");
    outs.push(out);
  }
  assert.strictEqual(w.net.calls.length, statics.length, "one background fetch each");
  release();
  await Promise.all(outs.map(o => o.settle()));
  // and a font that is not cached yet is fetched and kept
  const w2 = createWorld();
  const miss = await w2.fetch("fonts/geist-latin-wght.woff2");
  await miss.settle();
  assert.strictEqual(w2.net.calls.length, 1);
  assert.ok(w2.cached("fonts/geist-latin-wght.woff2"));
});

test("the lookup asks this release's cache only, and ignores Vary", async () => {
  const w = createWorld();
  w.seed("cut-support.js?v=" + w.RELEASE, "engine");
  w.seed("cut-support.js?v=" + w.RELEASE, "stale-engine", "nxtfrm-v1-premium-cache");     // an older shell must never answer
  const out = await w.fetch("cut-support.js?v=" + w.RELEASE);
  assert.strictEqual(out.text, "engine");
  await out.settle();
  assert.strictEqual(w.lookups.length, 1);
  assert.strictEqual(w.lookups[0].cache, w.CACHE_NAME);
  assert.strictEqual(JSON.stringify(w.lookups[0].options), '{"ignoreVary":true}');
});

test("only THIS release's version is answered from the cache: another ?v= is network-first and never revalidated", async () => {
  const w = createWorld();
  const other = String(Number(w.RELEASE) + 1);
  w.seed("premium-ui.js?v=" + other, "cached-other-release");
  const out = await w.fetch("premium-ui.js?v=" + other);
  assert.strictEqual(out.text, "net:" + w.abs("premium-ui.js?v=" + other));
  assert.strictEqual(w.net.calls.length, 1);
  await out.settle();
  // a ?v= that merely contains the number is not a match either
  const w2 = createWorld();
  w2.seed("premium-ui.js?v=" + w2.RELEASE + "0", "cached");
  const out2 = await w2.fetch("premium-ui.js?v=" + w2.RELEASE + "0");
  assert.strictEqual(out2.text, "net:" + w2.abs("premium-ui.js?v=" + w2.RELEASE + "0"));
  await out2.settle();
});

/* ---- network-first for everything else -------------------------------------------------- */
test("a navigation fetches first and the fresh page replaces the cached one; it is never revalidated twice", async () => {
  const w = createWorld();
  w.seed("index.html", "cached-shell");
  const out = await w.fetch("index.html", { mode: "navigate" });
  assert.strictEqual(out.text, "net:" + w.abs("index.html"));
  await out.settle();
  assert.strictEqual(w.net.calls.length, 1, "network-first is one fetch");
  assert.ok(w.puts.some(p => p.url === w.abs("index.html")), "the fresh page must be stored");
});

test("a navigation falls back to the cached ./index.html when the fetch rejects", async () => {
  const w = createWorld();
  w.seed("index.html", "cached-shell");
  w.net.online = false;
  const root = await w.fetch("", { mode: "navigate" });                    // "./" is not cached in this world
  assert.strictEqual(root.status, 200);
  assert.strictEqual(root.text, "cached-shell");
  const deep = await w.fetch("?source=pwa", { mode: "navigate" });
  assert.strictEqual(deep.text, "cached-shell");
  assert.ok(w.net.calls.length >= 2, "the network must have been tried first");
});

test("a navigation never takes the stale-while-revalidate path, even when its URL carries the current ?v=", async () => {
  const w = createWorld();
  w.seed("index.html?v=" + w.RELEASE, "cached");
  const out = await w.fetch("index.html?v=" + w.RELEASE, { mode: "navigate" });
  assert.strictEqual(out.text, "net:" + w.abs("index.html?v=" + w.RELEASE), "the network answers a navigation, not the cache");
  await out.settle();
  assert.strictEqual(w.net.calls.length, 1);
});

test("unversioned same-origin files are network-first: fresh when online, cached when offline", async () => {
  for (const file of ["manifest.webmanifest", "wearables.fixtures.js", "data/other.json"]) {
    const w = createWorld();
    w.seed(file, "old");
    const online = await w.fetch(file);
    assert.strictEqual(online.text, "net:" + w.abs(file), file + " must come from the network when online");
    await online.settle();
    assert.strictEqual(w.net.calls.length, 1, file + ": no background revalidation for a network-first file");
    w.net.online = false;
    const offline = await w.fetch(file);
    assert.strictEqual(offline.text, "net:" + w.abs(file), file + " falls back to the copy stored from the last good response");
  }
  const w = createWorld();
  w.seed("manifest.webmanifest", "precached-manifest");
  w.net.online = false;
  assert.strictEqual((await w.fetch("manifest.webmanifest")).text, "precached-manifest");
});

test("offline: a versioned file that was never cached answers 503 Offline instead of rejecting", async () => {
  const w = createWorld();
  w.net.online = false;
  const out = await w.fetch("premium-ui.js?v=" + w.RELEASE);
  assert.strictEqual(out.handled, true);
  assert.strictEqual(out.status, 503);
  assert.strictEqual(out.text, "Offline");
});

test("offline: a cached versioned file still opens, and its failed revalidation is silent", async () => {
  const w = createWorld();
  w.seed("coach.js?v=" + w.RELEASE, "cached-coach");
  w.net.online = false;
  const out = await w.fetch("coach.js?v=" + w.RELEASE);
  assert.strictEqual(out.text, "cached-coach");
  await out.settle();
  assert.strictEqual(w.puts.length, 0);
});

test("a failed or redirected network response is returned but never stored", async () => {
  const bad = createWorld();
  bad.net.status = 404;
  const r404 = await bad.fetch("missing.json");
  assert.strictEqual(r404.status, 404);
  await r404.settle();
  assert.strictEqual(bad.puts.length, 0, "a 404 must not be cached");
  const redirected = createWorld();
  redirected.net.redirected = true;
  const moved = await redirected.fetch("moved.json");
  await moved.settle();
  assert.strictEqual(redirected.puts.length, 0, "a redirected response must not be cached");
});

/* ---- what the worker must leave alone --------------------------------------------------- */
test("requests outside the worker's scope are ignored", async () => {
  const w = createWorld();
  const cdn = await w.fetch("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
  assert.strictEqual(cdn.handled, false, "cross-origin requests are not the worker's business");
  const api = await w.fetch("https://xyz.supabase.co/rest/v1/apex_cut?select=*");
  assert.strictEqual(api.handled, false);
  const sub = createWorld({ scope: "https://app.example.test/app/" });
  assert.strictEqual((await sub.fetch("https://app.example.test/other/premium-ui.js?v=" + sub.RELEASE)).handled, false, "same origin but outside the scope path");
  const inside = await sub.fetch("https://app.example.test/app/premium-ui.js?v=" + sub.RELEASE);
  assert.strictEqual(inside.handled, true);
  await inside.settle();
  assert.deepStrictEqual(w.net.calls, []);
});

test("non-GET requests are ignored", async () => {
  const w = createWorld();
  for (const method of ["POST", "PUT", "DELETE", "HEAD"]) {
    assert.strictEqual((await w.fetch("premium-ui.js?v=" + w.RELEASE, { method })).handled, false, method);
  }
});

test("the worker source never references the page's own storage, even in a comment", () => {
  assert.strictEqual(/localStorage|sessionStorage|indexedDB|openDatabase/i.test(SW_SRC), false);
  // the same check the release gate runs, on code only
  const code = SW_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.strictEqual(/localStorage|indexedDB/i.test(code), false);
});

/* ---- install / activate / push stay as they were ---------------------------------------- */
test("install precaches the whole shell from the network (cache: reload) and then skips waiting", async () => {
  const w = createWorld();
  await w.install();
  assert.strictEqual(w.counters.skipWaiting, 1);
  const stored = [...w.stores.get(w.CACHE_NAME).keys()].sort();
  assert.deepStrictEqual(stored, w.ASSETS.map(a => w.abs(a)).sort(), "every ASSETS entry must be precached");
  assert.deepStrictEqual(w.net.calls.sort(), w.ASSETS.map(a => w.abs(a)).sort(), "each one fetched exactly once");
  assert.ok(w.CACHE_NAME.indexOf("v" + w.RELEASE) !== -1, "CACHE_NAME must carry RELEASE");
});

test("install reads the precache from the network (cache: reload), never from the HTTP cache", async () => {
  const w = createWorld();
  await w.install();
  assert.strictEqual(w.precacheRequests.length, w.ASSETS.length);
  assert.ok(w.precacheRequests.every(r => r.cache === "reload"), "every precache request must bypass the HTTP cache");
});

test("activate deletes this app's older shell caches only, keeps the current one, then claims clients", async () => {
  const w = createWorld();
  for (const name of [w.CACHE_NAME, "nxtfrm-v160-premium-cache", "apex-v90-cache", "apexcut-v50", "workbox-precache-v2", "some-other-app"]) w.seed("x", "x", name);
  await w.activate();
  assert.deepStrictEqual(w.deleted.sort(), ["apex-v90-cache", "apexcut-v50", "nxtfrm-v160-premium-cache"].sort());
  assert.deepStrictEqual([...w.stores.keys()].sort(), [w.CACHE_NAME, "some-other-app", "workbox-precache-v2"].sort());
  assert.strictEqual(w.counters.claim, 1);
});

test("the push and notification handlers are still registered and still work", async () => {
  const w = createWorld();
  assert.strictEqual(typeof w.listeners.push, "function");
  assert.strictEqual(typeof w.listeners.notificationclick, "function");
  let p;
  w.listeners.push({ data: { json: () => ({ title: "Weigh in", body: "Morning", tag: "weigh" }) }, waitUntil(x) { p = x; } });
  await p;
  assert.strictEqual(w.notifications.length, 1);
  assert.strictEqual(w.notifications[0].title, "Weigh in");
  assert.strictEqual(w.notifications[0].o.tag, "weigh");
});

/* ---- the shell and the page agree; the release moves as a unit -------------------------- */
function pageRequests() {
  return [...HTML.matchAll(/<(?:script|link)[^>]*?(?:src|href)="((?!https?:|\/\/|data:)[^"]+?\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m => m[1]);
}

test("every script and stylesheet the page requests is in the shell and is answered from the cache while the network is silent", async () => {
  const w = createWorld();
  const requested = [...new Set(pageRequests())];
  assert.ok(requested.length >= 10, "expected the page to request its scripts and stylesheets, found " + requested.length);
  const release = w.holdNetwork();
  const outs = [];
  for (const r of requested) {
    assert.ok(w.ASSETS.indexOf("./" + r) !== -1, r + " is requested by index.html but is not precached");
    w.seed(r, "cached:" + r);
    const out = await w.fetch(r);
    assert.strictEqual(out.text, "cached:" + r, r);
    outs.push(out);
  }
  assert.strictEqual(w.net.calls.length, requested.length, "one background revalidation per file, none of them awaited by the page");
  release();
  await Promise.all(outs.map(o => o.settle()));
});

test("every ?v= index.html carries equals RELEASE (a deploy bumps the page and the worker together)", () => {
  const w = createWorld();
  const versions = new Set();
  for (const m of HTML.matchAll(/(?:src|href)="(?!https?:|\/\/)[^"]*\?v=([^"&]+)"/g)) versions.add(m[1]);
  assert.deepStrictEqual([...versions], [w.RELEASE], "index.html references versions " + [...versions].join(",") + " but sw.js RELEASE is " + w.RELEASE);
  assert.ok(w.CACHE_NAME === "nxtfrm-v" + w.RELEASE + "-premium-cache", "CACHE_NAME must follow RELEASE");
});

test("the thirteen wearable modules are neither loaded by the page nor precached", () => {
  const w = createWorld();
  // Named, not read from the disk: the files may be deleted in a later clean-up and this must still hold.
  const modules = ["wearables.js", "wearables.adapters.js", "wearables.ingest.js", "wearables.canonical.js", "wearables.days.js",
    "wearables.snapshots.js", "wearables.resolution.js", "wearables.recovery.js", "wearables.recovery-integration.js",
    "wearables.training-readiness.js", "wearables.store.js", "wearables.provider-garmin.js", "wearables.sync.js"];
  assert.strictEqual(modules.length, 13);
  for (const m of modules) {
    assert.strictEqual(HTML.indexOf('src="' + m), -1, m + " must not be loaded by the page");
    assert.strictEqual(w.VERSIONED.indexOf(m), -1, m + " must not be in the offline shell");
    assert.strictEqual(w.ASSETS.some(a => a.indexOf(m) !== -1), false, m + " must not be precached");
  }
  // the dev-only fixtures loader may stay, but it must not fire when the modules are off the page
  assert.ok(/typeof NXT==="object"&&NXT&&NXT\.wearables\)\)return;/.test(HTML), "fixtures loader must skip itself when NXT.wearables is absent");
});

test("the Tesseract OCR script is not a launch-time tag and is not part of the shell", () => {
  const w = createWorld();
  assert.strictEqual(/<script[^>]+tesseract/i.test(HTML), false, "Tesseract must be loaded on demand, not by a tag");
  assert.ok(HTML.indexOf("function loadTesseract()") !== -1);
  assert.ok(HTML.indexOf("await loadTesseract()") !== -1);
  assert.strictEqual(w.ASSETS.some(a => /tesseract/i.test(a)), false);
});

/* ---- run --------------------------------------------------------------------------------- */
(async () => {
  let passed = 0, failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); passed += 1; console.log("PASS  " + name); }
    catch (err) { failed += 1; console.log("FAIL  " + name); console.log("      " + (err && err.stack ? err.stack : err)); }
  }
  console.log("");
  console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
