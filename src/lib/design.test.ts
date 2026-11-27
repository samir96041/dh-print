import assert from "node:assert/strict";
import { fitFont, applyRow, docFromTemplate, docToSvg } from "./design";
import { bySlug } from "./catalog";
const o = { minFont: 10, maxFont: 100, tracking: 0 };
assert.ok(fitFont("A", 100, 50, o) <= 100);                       // capped at max
assert.ok(fitFont("A".repeat(60), 50, 50, o) === 10);             // floors at min
assert.ok(fitFont("12", 100, 50, o) > fitFont("12345678", 100, 50, o)); // longer text shrinks
const p = bySlug("race-numbers")!;
const doc = docFromTemplate(p.template, 210, 150, 5);
const r = applyRow(doc, { number: "88888", name: "A Very Long Runner Name Indeed" });
assert.ok(r.objects[0].kind === "text" && r.objects[0].text === "88888");
assert.ok(docToSvg(r).includes("88888"));
console.log("design ok");
