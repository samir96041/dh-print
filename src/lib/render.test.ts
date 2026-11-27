import assert from "node:assert/strict";
import JSZip from "jszip";
import { bySlug } from "./catalog";
import { docFromTemplate } from "./design";
import { mergeCsv, outputDir, parseCsv, renderPdf, renderPng } from "./render";

(async () => {
const p = bySlug("race-numbers")!;
const doc = docFromTemplate(p.template, 210, 150, p.bleed_mm);
const png = await renderPng(doc, 300);
const m = { width: png.readUInt32BE(16) }; // PNG IHDR width
assert.equal(m.width, Math.round(((210 + 10) / 25.4) * 300)); // trim + 2×bleed at 300dpi
const pdf = await renderPdf(doc, 300);
assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
const { rows, error } = parseCsv("Number,Name\n101,Ann\n102,Bob\n103,Cy");
assert.ok(!error && rows.length === 3);
const zip = await JSZip.loadAsync(await mergeCsv(doc, rows, 150));
assert.equal(Object.keys(zip.files).length, 3);
assert.ok(parseCsv("a,b\n").error);
assert.match(outputDir(1001, "race-numbers", new Date("2026-03-05")), /^1001_race-numbers_20260305_Output$/);
console.log("render ok", m.width, "px");
})();
