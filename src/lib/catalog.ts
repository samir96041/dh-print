// Canonical catalogue. Seeded into Supabase via `npm run seed:gen`; pages read the DB and fall back to this
// so the storefront still renders before the DB is connected. Parameter-driven: one product per division.
import type { Pricing } from "./pricing";

export type Size = { id: string; label: string; w: number; h: number };
export type Material = { id: string; label: string; mult: number };
export type Config = {
  sizes: Size[]; custom: { min_w: number; max_w: number; min_h: number; max_h: number } | null;
  materials: Material[]; orientations: string[]; min_qty: number;
};
export type TObject = {
  type: "text"; name: string; text: string; x: number; y: number; w: number; h: number; // x,y centre, w,h box: fractions of the print area
  font: string; bold?: boolean; minFont: number; maxFont: number; tracking: number; variable: boolean; align: "center" | "left";
};
export type Layout = { safe_mm: number; objects: TObject[] };
export type Product = {
  id?: string; slug: string; name: string; blurb: string; accent: string; config: Config; pricing: Pricing;
  bleed_mm: number; dpi: number; supports_csv: boolean; template: Layout;
};

const t = (o: Partial<TObject> & Pick<TObject, "name" | "text" | "x" | "y" | "w" | "h" | "font" | "minFont" | "maxFont">): TObject =>
  ({ type: "text", tracking: 0, variable: false, align: "center", ...o });

export const CATALOG: Product[] = [
  { slug: "labels", name: "Labels & Stickers", blurb: "Die-cut, roll and sheet labels in any size", accent: "#ff5a1f",
    config: { sizes: [{ id: "s", label: "50 × 50 mm", w: 50, h: 50 }, { id: "m", label: "75 × 50 mm", w: 75, h: 50 }, { id: "l", label: "100 × 70 mm", w: 100, h: 70 }],
      custom: { min_w: 20, max_w: 300, min_h: 20, max_h: 300 },
      materials: [{ id: "paper", label: "Matt paper", mult: 1 }, { id: "vinyl", label: "Waterproof vinyl", mult: 1.4 }, { id: "foil", label: "Gloss foil", mult: 1.8 }],
      orientations: ["landscape", "portrait"], min_qty: 10 },
    pricing: { base_cents: 12, per_cm2_cents: 1.2, setup_cents: 400, tiers: [{ min: 100, discount: 0.1 }, { min: 500, discount: 0.2 }, { min: 1000, discount: 0.3 }] },
    bleed_mm: 3, dpi: 300, supports_csv: false,
    template: { safe_mm: 3, objects: [t({ name: "headline", text: "YOUR TEXT", x: .5, y: .5, w: .85, h: .4, font: "DejaVu Sans", minFont: 8, maxFont: 80, tracking: 20 })] } },
  { slug: "race-numbers", name: "Race & Event Numbers", blurb: "Variable-data bibs, one file per runner", accent: "#1f6bff",
    config: { sizes: [{ id: "std", label: "210 × 150 mm", w: 210, h: 150 }, { id: "sm", label: "150 × 100 mm", w: 150, h: 100 }], custom: null,
      materials: [{ id: "tyvek", label: "Tyvek", mult: 1 }, { id: "paper", label: "Tearproof paper", mult: 0.8 }], orientations: ["landscape"], min_qty: 25 },
    pricing: { base_cents: 18, per_cm2_cents: 0.35, setup_cents: 1500, tiers: [{ min: 100, discount: 0.1 }, { min: 500, discount: 0.2 }] },
    bleed_mm: 5, dpi: 300, supports_csv: true,
    template: { safe_mm: 6, objects: [
      t({ name: "number", text: "101", x: .5, y: .4, w: .9, h: .55, font: "DejaVu Sans", bold: true, minFont: 40, maxFont: 220, variable: true }),
      t({ name: "name", text: "RUNNER NAME", x: .5, y: .82, w: .9, h: .14, font: "DejaVu Sans", minFont: 10, maxFont: 40, tracking: 40, variable: true })] } },
  { slug: "mtb-boards", name: "MTB Boards", blurb: "Weatherproof number plates for bikes", accent: "#12a150",
    config: { sizes: [{ id: "std", label: "230 × 190 mm", w: 230, h: 190 }], custom: null,
      materials: [{ id: "corex", label: "Correx", mult: 1 }, { id: "pvc", label: "PVC", mult: 1.3 }], orientations: ["landscape"], min_qty: 1 },
    pricing: { base_cents: 150, per_cm2_cents: 0.5, setup_cents: 800, tiers: [{ min: 50, discount: 0.1 }, { min: 200, discount: 0.2 }] },
    bleed_mm: 5, dpi: 300, supports_csv: true,
    template: { safe_mm: 8, objects: [t({ name: "number", text: "7", x: .5, y: .5, w: .8, h: .7, font: "DejaVu Sans", bold: true, minFont: 60, maxFont: 300, variable: true })] } },
  { slug: "stamps", name: "Stamps", blurb: "Self-inking and traditional rubber stamps", accent: "#7c3aed",
    config: { sizes: [{ id: "s", label: "38 × 14 mm", w: 38, h: 14 }, { id: "m", label: "58 × 22 mm", w: 58, h: 22 }, { id: "l", label: "75 × 38 mm", w: 75, h: 38 }], custom: null,
      materials: [{ id: "self", label: "Self-inking", mult: 1 }, { id: "wood", label: "Traditional wood", mult: 0.9 }], orientations: ["landscape"], min_qty: 1 },
    pricing: { base_cents: 900, per_cm2_cents: 8, setup_cents: 0, tiers: [{ min: 10, discount: 0.1 }] },
    bleed_mm: 1, dpi: 600, supports_csv: false,
    template: { safe_mm: 1.5, objects: [t({ name: "line1", text: "COMPANY LTD", x: .5, y: .35, w: .9, h: .4, font: "DejaVu Sans Mono", minFont: 6, maxFont: 30 }), t({ name: "line2", text: "PAID", x: .5, y: .75, w: .9, h: .3, font: "DejaVu Sans Mono", minFont: 6, maxFont: 24 })] } },
  { slug: "trophies", name: "Trophies", blurb: "Engraved plaques and awards", accent: "#d4a017",
    config: { sizes: [{ id: "s", label: "Plaque 100 × 60 mm", w: 100, h: 60 }, { id: "m", label: "Plaque 150 × 100 mm", w: 150, h: 100 }], custom: null,
      materials: [{ id: "brass", label: "Brass", mult: 1.6 }, { id: "acrylic", label: "Acrylic", mult: 1 }, { id: "wood", label: "Walnut", mult: 1.3 }], orientations: ["landscape"], min_qty: 1 },
    pricing: { base_cents: 1200, per_cm2_cents: 6, setup_cents: 0, tiers: [{ min: 10, discount: 0.1 }, { min: 50, discount: 0.15 }] },
    bleed_mm: 2, dpi: 300, supports_csv: false,
    template: { safe_mm: 5, objects: [t({ name: "title", text: "CHAMPION", x: .5, y: .3, w: .85, h: .3, font: "DejaVu Serif", minFont: 14, maxFont: 60, tracking: 60 }), t({ name: "recipient", text: "Recipient Name", x: .5, y: .68, w: .85, h: .2, font: "DejaVu Serif", minFont: 10, maxFont: 36 })] } },
  { slug: "laser-cut", name: "Laser-Cut Work", blurb: "Acrylic, wood and metal cut to your shape", accent: "#e11d48",
    config: { sizes: [{ id: "s", label: "100 × 100 mm", w: 100, h: 100 }, { id: "m", label: "200 × 200 mm", w: 200, h: 200 }],
      custom: { min_w: 20, max_w: 600, min_h: 20, max_h: 400 },
      materials: [{ id: "acrylic", label: "Acrylic 3mm", mult: 1 }, { id: "birch", label: "Birch ply", mult: 0.9 }, { id: "steel", label: "Steel 1mm", mult: 1.7 }], orientations: ["landscape", "portrait"], min_qty: 1 },
    pricing: { base_cents: 200, per_cm2_cents: 2.5, setup_cents: 1000, tiers: [{ min: 25, discount: 0.1 }, { min: 100, discount: 0.2 }] },
    bleed_mm: 0, dpi: 300, supports_csv: false,
    template: { safe_mm: 3, objects: [t({ name: "headline", text: "YOUR TEXT", x: .5, y: .5, w: .85, h: .4, font: "DejaVu Sans", minFont: 8, maxFont: 80, tracking: 20 })] } },
];

export const bySlug = (s: string) => CATALOG.find((p) => p.slug === s);
