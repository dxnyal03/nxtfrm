/* VNext 2F — EvoScan extraction, provenance, delete, and D14 canonical weight.
   Synthetic fixtures only. No personal scan image is read or written. */
import fs from "fs";
import path from "path";
import vm from "vm";
import zlib from "zlib";
import assert from "assert";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (err) { failed++; console.log("FAIL  " + name); console.log("      " + (err && err.stack ? err.stack : err)); }
}

const start = html.indexOf("/* EVO_PARSE_START");
const end = html.indexOf("/* EVO_PARSE_END */");
assert.ok(start > 0 && end > start, "parse block markers");
const src = html.slice(start, end) + `
;globalThis.API = {
  EVO_KEYS, EVO_SPEC, evoExtractReport, evoLabelView, evoBlankReport, evoFinite, evoFmt,
  evoProvenanceFor, evoResolveScanDelete, evoReadOrientation, evoChangeRows, evoChartModel, evoSeries
};`;
const sandbox = { Uint8Array, Date };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const E = sandbox.API;

function field(text, extra) {
  const report = E.evoExtractReport(extra ? Object.assign({ text }, extra) : text);
  return { report, f: report.fields };
}

test("uppercase labels survive numeric repair", () => {
  const text = "BODY WEIGHT 8O.4 kg\nBODY FAT 23.1 %\nMUSCLE MASS 36.9 kg\nFAT MASS 19.0 kg\nBMR 1,820 kcal\nTOTAL DAILY ENERGY 2,460 kcal";
  const { report, f } = field(text);
  assert.strictEqual(report.rawText, text, "the OCR string is not mutated");
  assert.strictEqual(f.weight.value, 80.4);
  assert.strictEqual(f.weight.status, "HIGH CONFIDENCE");
  assert.strictEqual(f.bodyFat.value, 23.1);
  assert.strictEqual(f.bodyFat.status, "HIGH CONFIDENCE");
  assert.strictEqual(f.muscleMass.value, 36.9);
  assert.strictEqual(f.fatMass.value, 19);
  assert.strictEqual(f.bmr.value, 1820);
  assert.strictEqual(f.tdee.value, 2460);
  assert.strictEqual(f.tdee.status, "HIGH CONFIDENCE");
});

test("digit-in-word repair is general, not a label special case", () => {
  const { f } = field("B0DY FAT 18.4 %\nT0TAL DAILY ENERGY 2460 kcal\nB0DY WEIGHT 81,8 kg");
  assert.strictEqual(f.bodyFat.value, 18.4);
  assert.strictEqual(f.tdee.value, 2460);
  assert.strictEqual(f.weight.value, 81.8);
  const block = html.slice(start, end);
  assert.strictEqual(block.includes('.replace(/O/g'), false);
  assert.ok(block.includes("BODY\\\\s+FAT"), "the label pattern stays a search, not a repaired string");
});

test("label view does not change the length of the text", () => {
  const sample = "B0DY FAT 8O.4\nT0TAL DAILY ENERGY";
  assert.strictEqual(E.evoLabelView(sample).length, sample.length);
  assert.strictEqual(E.evoLabelView(sample).includes("BODY FAT"), true);
  assert.strictEqual(E.evoLabelView(sample).includes("8O.4"), true, "the number token is left for numeric repair");
});

test("lowercase printout", () => {
  const { f } = field("body weight 82.4 kg\nbody fat 23.1%\nmuscle mass 36.9 kg");
  assert.strictEqual(f.weight.status, "HIGH CONFIDENCE");
  assert.strictEqual(f.bodyFat.value, 23.1);
  assert.strictEqual(f.muscleMass.value, 36.9);
});

test("a missing metric is NOT FOUND and is not invented", () => {
  const { f } = field("BODY WEIGHT 82.4 kg\nMUSCLE MASS 36.9 kg");
  assert.strictEqual(f.bodyFat.status, "NOT FOUND");
  assert.strictEqual(f.bodyFat.value, "");
  assert.strictEqual(f.fatMass.status, "NOT FOUND");
  assert.strictEqual(f.tdee.value, "");
});

test("fat mass and muscle mass are not stolen as body weight", () => {
  const { f } = field("MUSCLE MASS 36.9 kg\nFAT MASS 19.0 kg");
  assert.strictEqual(f.weight.status, "NOT FOUND");
  assert.strictEqual(f.weight.value, "");
  assert.strictEqual(f.muscleMass.value, 36.9);
  assert.strictEqual(f.fatMass.value, 19);
});

test("a dropped decimal is not rewritten into a plausible weight", () => {
  const { f } = field("BODY WEIGHT 818 kg");
  assert.strictEqual(f.weight.status, "NOT FOUND");
  assert.strictEqual(f.weight.value, "");
  assert.strictEqual(JSON.stringify(f.weight).includes("81.8"), false);
});

test("pounds convert to kilograms and stay CHECK", () => {
  const { f } = field("BODY WEIGHT 180 lb");
  assert.strictEqual(f.weight.value, 81.6);
  assert.strictEqual(f.weight.unit, "kg");
  assert.strictEqual(f.weight.status, "CHECK");
});

test("garbage produces no metric", () => {
  const { f } = field("asdf qwerty the quick brown fox");
  for (const key of E.EVO_KEYS) {
    assert.strictEqual(f[key].status, "NOT FOUND", key);
    assert.strictEqual(f[key].value, "", key);
  }
});

test("competing values are CHECK and both candidates are kept", () => {
  const { f } = field("BODY WEIGHT 82.4 kg\nBODY WEIGHT 99.1 kg");
  assert.strictEqual(f.weight.status, "CHECK");
  assert.strictEqual(f.weight.candidates.length, 2);
});

test("low OCR confidence forces CHECK even when the value is plausible", () => {
  const { f } = field("BODY WEIGHT 82.4 kg", { words: [{ text: "82.4", confidence: 40 }] });
  assert.strictEqual(f.weight.value, 82.4);
  assert.strictEqual(f.weight.status, "CHECK");
});

test("high OCR confidence with a specific label and unit is HIGH CONFIDENCE", () => {
  const { f } = field("BODY WEIGHT 82.4 kg", { words: [{ text: "82.4", confidence: 92 }] });
  assert.strictEqual(f.weight.status, "HIGH CONFIDENCE");
});

test("a second extract does not carry a value forward", () => {
  const first = E.evoExtractReport("BODY FAT 23.1 %");
  const second = E.evoExtractReport("BODY WEIGHT 82.4 kg");
  assert.strictEqual(first.fields.bodyFat.value, 23.1);
  assert.strictEqual(second.fields.bodyFat.status, "NOT FOUND");
  assert.strictEqual(second.fields.weight.value, 82.4);
});

test("correction keeps the original OCR interpretation", () => {
  const row = E.evoProvenanceFor(81.2, { ocr: 80.4, raw: "8O.4 kg", source: "OCR_EXTRACTED" });
  assert.strictEqual(row.source, "USER_CORRECTED");
  assert.strictEqual(row.ocr, 80.4);
  assert.strictEqual(row.raw, "8O.4 kg");
  const kept = E.evoProvenanceFor(80.4, { ocr: 80.4, raw: "80.4 kg", source: "OCR_EXTRACTED" });
  assert.strictEqual(kept.source, "OCR_EXTRACTED");
  const typed = E.evoProvenanceFor(70, { ocr: "", source: "MANUAL_ENTRY", raw: "" });
  assert.strictEqual(typed.source, "MANUAL_ENTRY");
  assert.strictEqual(typed.ocr, "");
});

test("body-fat change is percentage points", () => {
  const rows = E.evoChangeRows(
    { weight: 81.8, bodyFat: 22.5, muscleMass: 37.1, fatMass: 18.4 },
    { weight: 82.4, bodyFat: 23.1, muscleMass: 36.9, fatMass: 19.0 }
  );
  const fat = rows.find(r => r.key === "bodyFat");
  assert.strictEqual(fat.delta, "−0.6 percentage points");
  assert.strictEqual(fat.from, "23.1");
  assert.strictEqual(fat.to, "22.5");
  const weight = rows.find(r => r.key === "weight");
  assert.strictEqual(weight.delta, "−0.6 kg");
  const partial = E.evoChangeRows({ weight: 81 }, { weight: 82, bodyFat: 20 });
  assert.strictEqual(partial.some(r => r.key === "bodyFat"), false, "a metric missing on one scan is omitted");
});

test("each metric chart has its own scale", () => {
  const scans = [
    { date: "2026-09-01", weight: 80, bodyFat: 20 },
    { date: "2026-09-12", weight: 90, bodyFat: 22 }
  ];
  const weight = E.evoChartModel(scans, "weight");
  const fat = E.evoChartModel(scans, "bodyFat");
  assert.notStrictEqual(weight.low, fat.low);
  assert.ok(weight.high > 85 && fat.high < 40);
  assert.strictEqual(E.evoSeries(scans, "weight").length, 2);
  assert.strictEqual(E.evoSeries([{ date: "2026-09-01", weight: 80 }], "bodyFat").length, 0);
});

test("an older scan without additive fields still has its core numbers", () => {
  const legacy = { id: "old", date: "2026-08-01", image: "", weight: 84.2, bodyFat: 24, muscleMass: 35, fatMass: 20, tdee: 2500, bmr: 1700, notes: "kept" };
  assert.strictEqual(E.evoFinite(legacy.weight), 84.2);
  assert.strictEqual(E.evoFmt("weight", legacy.weight), "84.2");
  assert.strictEqual(E.evoFmt("bodyFat", legacy.bodyFat), "24.0");
  assert.strictEqual(legacy.provenance, undefined);
  const rows = E.evoChangeRows(legacy, { date: "2026-07-01", weight: 85, bodyFat: 25, muscleMass: 34.5, fatMass: 21, tdee: 2550, bmr: 1700 });
  assert.strictEqual(rows.length, 6);
});

test("delete removes a linked Evo Scan weigh-in and never a morning one", () => {
  const linked = E.evoResolveScanDelete(
    { id: "s", date: "2026-09-01", weight: 99.9, weighInId: "evo" },
    [
      { id: "evo", date: "2026-09-01", weight: 99.9, timeOfDay: "Evo Scan" },
      { id: "am", date: "2026-09-01", weight: 80.1, timeOfDay: "Morning" }
    ]
  );
  assert.strictEqual(linked.weighInId, "evo");
  assert.ok(linked.message.includes("morning"));
  const morning = E.evoResolveScanDelete(
    { id: "s", date: "2026-09-01", weight: 80.1, weighInId: "am" },
    [{ id: "am", date: "2026-09-01", weight: 80.1, timeOfDay: "Morning" }]
  );
  assert.strictEqual(morning.weighInId, null);
  const ambiguous = E.evoResolveScanDelete(
    { id: "s", date: "2026-09-01", weight: 99.9 },
    [
      { id: "a", date: "2026-09-01", weight: 99.9, timeOfDay: "Evo Scan" },
      { id: "b", date: "2026-09-01", weight: 99.9, timeOfDay: "Evo Scan" }
    ]
  );
  assert.strictEqual(ambiguous.weighInId, null);
  assert.ok(/no weigh-in will be removed/i.test(ambiguous.message));
  const none = E.evoResolveScanDelete({ id: "s", date: "2026-09-01", weight: 99.9 }, []);
  assert.strictEqual(none.weighInId, null);
  assert.ok(/weigh-ins stay/i.test(none.message));
});

test("EXIF orientation is read from a synthetic JPEG and ignored on a PNG", () => {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2A, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ];
  const len = payload.length + 2;
  const jpeg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE1, (len >> 8) & 255, len & 255, ...payload]);
  assert.strictEqual(E.evoReadOrientation(jpeg), 6);
  const png = makePNG(8, 8, () => [20, 20, 20]);
  assert.strictEqual(E.evoReadOrientation(png), 1);
  const copy = Uint8Array.from(jpeg);
  assert.strictEqual(E.evoReadOrientation(jpeg), 6);
  assert.deepStrictEqual(jpeg, copy, "reading orientation does not alter the original bytes");
});

test("synthetic scan fixtures cover the required cases and are not real photos", () => {
  const fixtures = {
    uppercase: { image: makePNG(24, 16, (x, y) => [x * 8, y * 12, 40]), text: "BODY WEIGHT 82.4 kg\nBODY FAT 23.1 %" },
    lowercase: { image: makePNG(24, 16, () => [240, 240, 240]), text: "body fat 21.0 %" },
    rotated: { image: syntheticJpeg(6), text: "BODY WEIGHT 82.4 kg" },
    lowContrast: { image: makePNG(24, 16, () => [118, 119, 120]), text: "BODY FAT 23.1 %" },
    missing: { image: makePNG(16, 16, () => [30, 30, 36]), text: "BODY WEIGHT 82.4 kg" },
    droppedDecimal: { image: makePNG(16, 16, () => [10, 10, 12]), text: "BODY WEIGHT 818 kg" },
    pounds: { image: makePNG(16, 16, () => [80, 80, 90]), text: "BODY WEIGHT 180 lb" },
    garbage: { image: makePNG(16, 16, (x, y) => [(x * 17 + y * 13) % 255, 0, 0]), text: "not a scan ???" }
  };
  assert.strictEqual(E.evoReadOrientation(fixtures.rotated.image), 6);
  const lows = [...fixtures.lowContrast.image];
  assert.ok(lows.length > 8);
  assert.strictEqual(field(fixtures.uppercase.text).f.weight.value, 82.4);
  assert.strictEqual(field(fixtures.lowercase.text).f.bodyFat.value, 21);
  assert.strictEqual(field(fixtures.missing.text).f.bodyFat.status, "NOT FOUND");
  assert.strictEqual(field(fixtures.droppedDecimal.text).f.weight.status, "NOT FOUND");
  assert.strictEqual(field(fixtures.pounds.text).f.weight.status, "CHECK");
  assert.strictEqual(field(fixtures.garbage.text).f.weight.status, "NOT FOUND");
  for (const [name, fx] of Object.entries(fixtures)) {
    assert.ok(fx.image[0] === 0xFF || fx.image[0] === 137, name + " is an image byte stream");
  }
});

test("the page does not save during extraction and keeps the handlers and fields", () => {
  const regionStart = html.indexOf("/* EVO_PARSE_START");
  const regionEnd = html.indexOf("function renderEvoScanPage()");
  const saveStart = html.indexOf("function saveEvoScan()");
  const saveEnd = html.indexOf("function evoCaptureForm()");
  const region = html.slice(regionStart, saveStart);
  assert.strictEqual(region.includes("state.scans.push"), false);
  assert.strictEqual(region.includes("state.bws.push"), false);
  assert.strictEqual(region.includes("persist()"), false);
  const save = html.slice(saveStart, saveEnd);
  assert.ok(save.includes("state.scans.push(scan)"));
  assert.ok(save.includes('timeOfDay:"Evo Scan"'));
  assert.ok(html.includes("function readEvoScanOCR("));
  assert.ok(html.includes("function handleScanFile("));
  assert.ok(html.includes("function useLatestScanTDEE("));
  assert.ok(html.includes("function apx96SetMoreView("));
  for (const id of ["scanFile", "scanDate", "scanWeight", "scanBodyFat", "scanMuscleMass", "scanFatMass", "scanTDEE", "scanBMR", "scanNotes"]) {
    assert.ok(html.includes('id="' + id + '"') || html.includes("id=\"${EVO_INPUT") || html.includes(id), id);
  }
  assert.ok(html.includes('id="${EVO_INPUT[key]}"'), "metric inputs are rendered from the field list");
  assert.ok(html.includes("HIGH CONFIDENCE") && html.includes("NOT FOUND") && html.includes(">CHECK<") === false);
  assert.ok(html.includes("evoStatusHTML"));
  const read = html.slice(html.indexOf("async function readEvoScanOCR"), html.indexOf("function evoOpenForm"));
  for (const stage of ["Preparing scan", "Reading report", "Finding metrics", "Checking values"]) {
    assert.ok(read.includes(stage), stage);
  }
  assert.strictEqual(read.includes("m.progress"), false);
  assert.ok(read.includes("state.currentScanImage"));
  assert.strictEqual(html.includes("Body Score"), false);
  assert.strictEqual(html.includes("radar"), false);
  assert.ok(html.includes('save("apm_evo_scans",state.scans)'));
});

function d14Canonical() {
  const N = loadNXT({
    state: {
      date: "2026-09-10",
      bws: [
        { id: "m", date: "2026-09-01", weight: 80.2, timeOfDay: "Morning" },
        { id: "e1", date: "2026-09-01", weight: 99.9, timeOfDay: "Evo Scan" },
        { id: "p", date: "2026-09-02", weight: 99.1, timeOfDay: "Post-workout" },
        { id: "e2", date: "2026-09-03", weight: 99.9, timeOfDay: "Evo Scan" },
        { id: "u", date: "2026-09-04", weight: 81.0 }
      ],
      logs: [], sessionPlans: {}, read: [], gyms: [], dayType: "FullA", gym: "Gym A"
    },
    settings: { cutSupport: { targetConfirmed: true } },
    targetLow: 80, targetHigh: 82
  });
  const rows = N.weights();
  assert.strictEqual(rows.length, 2, "morning plus the untimed legacy row; the two contextual dates are absent");
  assert.strictEqual(rows.find(r => r.date === "2026-09-01").weight, 80.2);
  assert.strictEqual(rows.find(r => r.date === "2026-09-01").timeOfDay, "Morning");
  assert.strictEqual(rows.find(r => r.date === "2026-09-02"), undefined);
  assert.strictEqual(rows.find(r => r.date === "2026-09-03"), undefined);
  assert.strictEqual(rows.find(r => r.date === "2026-09-04").weight, 81);
  const post = N.timingRows("Post-workout");
  assert.strictEqual(post.find(r => r.date === "2026-09-02").weight, 99.1, "the contextual reading is still stored");
  const waist = N.cleanRows([{ date: "2026-09-01", cm: 82 }], "cm");
  assert.strictEqual(waist.length, 1, "waist selection is unchanged");
  assert.strictEqual(waist[0].cm, 82);
}

test("release stays at 109", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.includes("nxtfrm-v109-premium-cache") || sw.includes("109"));
  assert.ok(html.includes("?v=109"));
});

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function makePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const p = rgba(x, y);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Uint8Array.from(Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
function syntheticJpeg(orientation) {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
    orientation & 255, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ];
  const len = payload.length + 2;
  return Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE1, (len >> 8) & 255, len & 255, ...payload, 0xFF, 0xD9]);
}

function makeElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], hidden: false, value: "", textContent: "", innerHTML: "",
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 420, height: 290, right: 420, bottom: 290 }; }
  };
}
const HOST = ["renderHistory", "renderFloorball", "apx96MoreSectionHTML", "getT", "readiness", "getFullBackup", "applyCloudPayload", "apx96OpenQueueManager", "openEditSet", "closeModal", "renderHome", "renderTrain", "renderWeight", "renderMore", "persist", "toast", "render", "uid", "save", "esc"];
const CUT = fs.readFileSync(path.join(ROOT, "cut-support.js"), "utf8") + "\n;globalThis.__NXT__ = NXT;\n";
function loadNXT(fx) {
  const discovered = {};
  const build = () => {
    const box = {
      console,
      document: { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return makeElement(); }, addEventListener() {}, activeElement: null, readyState: "complete", title: "" },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
      load(_k, fb) { return fb; },
      esc(v) { return String(v ?? ""); },
      state: fx.state, settings: fx.settings,
      cloudSessionChecked: false, lastCloudError: null, cloudStatusText: "", cloudStatusTone: "", cloudUser: null, lastCloudSyncAt: null,
      cloudSyncAgo() { return ""; },
      TARGET_LOW: fx.targetLow, TARGET_HIGH: fx.targetHigh,
      goalLow() { return 80; }, goalHigh() { return 82; }
    };
    box.window = box;
    for (const n of HOST) if (!(n in box)) box[n] = function () { return null; };
    for (const n of Object.keys(discovered)) if (!(n in box)) box[n] = discovered[n];
    return box;
  };
  for (let i = 0; i < 140; i++) {
    const ctx = vm.createContext(build());
    try { vm.runInContext(CUT, ctx, { filename: "cut-support.js" }); return ctx.__NXT__; }
    catch (err) {
      const miss = /(\w+) is not defined/.exec(String(err && err.message));
      if (!miss) throw err;
      discovered[miss[1]] = function () { return null; };
    }
  }
  throw new Error("cut-support.js did not load");
}

test("D14: post-workout and Evo Scan weights are absent from the canonical set", d14Canonical);

console.log(failed ? `FAILED  ${passed} passed, ${failed} failed` : `OK  ${passed} passed`);
process.exit(failed ? 1 : 0);
