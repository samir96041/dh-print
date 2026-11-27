// Pure pricing engine — shared by client (live calculator) and server (checkout re-validates).
export type Tier = { min: number; discount: number }; // discount 0..1
export type Pricing = { base_cents: number; per_cm2_cents: number; setup_cents: number; tiers: Tier[] };
export type Selection = { w_mm: number; h_mm: number; material_mult: number; qty: number };

export const VAT_RATE = 0.2; // assumption: flat 20% UK VAT, prices shown VAT-inclusive

export function tierDiscount(tiers: Tier[], qty: number): number {
  return tiers.reduce((d, t) => (qty >= t.min && t.discount > d ? t.discount : d), 0);
}

export function quote(p: Pricing, s: Selection) {
  const qty = Math.max(1, Math.floor(s.qty));
  const area = (s.w_mm / 10) * (s.h_mm / 10); // cm²
  const raw = (p.base_cents + area * p.per_cm2_cents) * s.material_mult;
  const discount = tierDiscount(p.tiers, qty);
  const unit_net = Math.round(raw * (1 - discount));
  const subtotal = unit_net * qty + p.setup_cents;
  const vat = Math.round(subtotal * VAT_RATE);
  return { qty, discount, unit_net, subtotal, vat, total: subtotal + vat, unit_gross: Math.round(unit_net * (1 + VAT_RATE)) };
}

export const money = (c: number) => `£${(c / 100).toFixed(2)}`;
