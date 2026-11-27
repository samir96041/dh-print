import { quote, tierDiscount } from "./pricing";
import assert from "node:assert/strict";
const p = { base_cents: 20, per_cm2_cents: 2, setup_cents: 500, tiers: [{ min: 100, discount: 0.1 }, { min: 500, discount: 0.2 }] };
assert.equal(tierDiscount(p.tiers, 99), 0);
assert.equal(tierDiscount(p.tiers, 100), 0.1);
assert.equal(tierDiscount(p.tiers, 1000), 0.2);
const a = quote(p, { w_mm: 50, h_mm: 50, material_mult: 1, qty: 10 }); // 25cm² -> 70c unit
assert.equal(a.unit_net, 70); assert.equal(a.subtotal, 1200); assert.equal(a.total, 1440);
const b = quote(p, { w_mm: 50, h_mm: 50, material_mult: 1, qty: 100 }); // 10% off -> 63c
assert.equal(b.unit_net, 63);
console.log("pricing ok");
