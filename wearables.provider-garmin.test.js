/* NXTFRM Garmin adapter-shell tests. Run: node wearables.provider-garmin.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("PASS  " + name);
  } catch (err) {
    failed += 1;
    console.error("FAIL  " + name);
    console.error("      " + (err && err.stack ? err.stack : String(err)));
  }
}

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadWorld() {
  const ctx = {
    console: console,
    NXT: {},
    location: { hostname: "localhost", protocol: "http:" },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    process: { env: {} },
    __networkCalls: { fetch: 0 }
  };
  ctx.fetch = function () { ctx.__networkCalls.fetch += 1; throw new Error("network blocked"); };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.js"), "utf8"), ctx, { filename: "wearables.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "wearables.provider-garmin.js"), "utf8"), ctx, { filename: "wearables.provider-garmin.js" });
  return ctx;
}

test("syntax: garmin adapter shell parses", function () {
  new Function(fs.readFileSync(path.join(ROOT, "wearables.provider-garmin.js"), "utf8"));
});

test("live auth is deferred and collect is refused", function () {
  const ctx = loadWorld();
  const garmin = ctx.NXTFRMWearableGarmin;
  const auth = fromVm(garmin.describeLiveAuth());
  assert.strictEqual(auth.provider_id, "garmin.connect");
  assert.strictEqual(auth.confidential_secret_required, true);
  assert.strictEqual(auth.backend_present, false);
  assert.strictEqual(auth.pwa_can_complete_securely, false);
  assert.ok(auth.decision.indexOf("LIVE PROVIDER AUTH DEFERRED") !== -1);
  const adapter = garmin.createAdapter({ connection_id: "conn_x" });
  let code = null;
  try { adapter.collect(); } catch (err) { code = err && err.code; }
  assert.strictEqual(code, "authentication_required");
  assert.strictEqual(garmin.status().live_auth, false);
  assert.strictEqual(garmin.status().secrets, false);
});

test("no secrets in garmin source", function () {
  const src = fs.readFileSync(path.join(ROOT, "wearables.provider-garmin.js"), "utf8");
  assert.ok(src.indexOf("client_secret:") === -1);
  assert.ok(src.indexOf("refresh_token:") === -1);
  assert.ok(src.indexOf("BEGIN PRIVATE KEY") === -1);
});

console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
