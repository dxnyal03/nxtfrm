/* NXTFRM native bundle tests: the iOS app's www/ never carries development data. Run: node wearables.native-build.test.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { execFileSync } = require("child_process");

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

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "nxtfrm-www-"));
execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-www.mjs"), OUT], { cwd: ROOT, stdio: "pipe" });
const html = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
const live = html.replace(/<!--[\s\S]*?-->/g, "");
const files = fs.readdirSync(OUT, { recursive: true }).map(String);

test("no seed script tags in the bundled page", function () {
  assert.ok(!/<script[^>]+seed\.(dev|scenarios)\.js/.test(live));
});

test("no development files in the bundle", function () {
  for (const f of ["seed.dev.js", "seed.scenarios.js", "wearables.fixtures.js", "sw.js"]) {
    assert.ok(!files.some(x => path.basename(x) === f), f + " was bundled");
  }
});

test("every local script and stylesheet the page loads is in the bundle", function () {
  const refs = [...live.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"#:${}]+)"/g)].map(m => m[1].split("?")[0]).filter(r => !r.startsWith("splash/"));
  assert.ok(refs.length > 5, "expected the app's scripts and styles");
  for (const r of refs) assert.ok(fs.existsSync(path.join(OUT, r)), "missing from bundle: " + r);
});

test("the seed files refuse to run inside the native app as well", function () {
  for (const f of ["seed.dev.js", "seed.scenarios.js"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(/location\.protocol === 'capacitor:'\) return;/.test(src), f + " lacks the native guard");
  }
  assert.ok(/location\.protocol==="capacitor:"\)return;/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), "fixture loader lacks the native guard");
});

fs.rmSync(OUT, { recursive: true, force: true });
console.log("");
console.log((failed ? "FAILED" : "OK") + "  " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
