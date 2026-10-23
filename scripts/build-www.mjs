// Packages the web app into www/ for the native iOS shell (Capacitor). The repo's web files stay the
// source of truth; this copies only what the page loads, and never the development data:
//   - seed.dev.js / seed.scenarios.js (fake records; they key on location.hostname === "localhost",
//     which is also the native app's hostname) — their <script> tags are removed and the files are not copied
//   - wearables.fixtures.js (test fixture)            — not copied
//   - sw.js (service worker; the app's files are already on the device) — not copied
//   - splash/ (PWA launch images; the native app has its own launch screen) — not copied
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.resolve(ROOT, process.argv[2] || "www");
const NEVER = new Set(["seed.dev.js", "seed.scenarios.js", "wearables.fixtures.js", "sw.js"]);

let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const before = html.length;
html = html.replace(/<script src="seed\.(dev|scenarios)\.js(\?[^"]*)?"><\/script>\s*/g, "");
if (/seed\.(dev|scenarios)\.js/.test(html.replace(/<!--[\s\S]*?-->/g, ""))) throw new Error("a seed reference is still in index.html");

const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"#:${}]+)"/g)) refs.add(m[1].split("?")[0]);
const files = [...refs].filter(f => !f.startsWith("splash/") && !NEVER.has(f) && fs.existsSync(path.join(ROOT, f)));
for (const extra of ["icon-512.png", "fonts/GEIST-OFL.txt"]) if (fs.existsSync(path.join(ROOT, extra))) files.push(extra);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), html);
for (const f of new Set(files)) {
  const to = path.join(OUT, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), to);
}
const leaked = fs.readdirSync(OUT, { recursive: true }).filter(f => NEVER.has(path.basename(String(f))));
if (leaked.length) throw new Error("development files leaked into the bundle: " + leaked.join(", "));
console.log(`www/: index.html (${before - html.length} bytes of seed tags removed) + ${new Set(files).size} files`);
