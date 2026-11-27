// Design document: the single source of truth for designer, proof preview and print files. All units are mm.
import type { Layout } from "./catalog";

export type TextObj = {
  kind: "text"; name?: string; text: string; x: number; y: number; w: number; h: number; // top-left box
  font: string; color: string; size: number; minFont: number; maxFont: number; tracking: number;
  align: "center" | "left"; rotation: number; variable?: boolean; bold?: boolean;
};
export type ImageObj = { kind: "image"; href: string; x: number; y: number; w: number; h: number; rotation: number };
export type DObj = TextObj | ImageObj;
export type DesignDoc = {
  w_mm: number; h_mm: number; bleed_mm: number; safe_mm: number; bg: string; objects: DObj[];
  upload?: { path: string; name: string }; // finished artwork supplied as a file (e.g. PDF/AI) instead of designed
};

export const PT = 0.3528; // mm per pt
const AVG_CHAR = 0.6;     // avg glyph width / em — one deterministic model on client and server so proof == print

/** Per-placeholder fitting: largest size within [minFont,maxFont] (pt) that fits the box; shrink-to-fit. */
export function fitFont(text: string, wMm: number, hMm: number, o: Pick<TextObj, "minFont" | "maxFont" | "tracking">): number {
  const n = Math.max(1, text.length);
  const perPt = PT * (AVG_CHAR + o.tracking / 1000) * n;         // text width (mm) per pt of font size
  const byW = wMm / perPt, byH = hMm / (PT * 1.2);
  return Math.max(o.minFont, Math.min(o.maxFont, byW, byH));
}

export function docFromTemplate(layout: Layout, w_mm: number, h_mm: number, bleed_mm: number): DesignDoc {
  const safe = layout.safe_mm, aw = w_mm - 2 * safe, ah = h_mm - 2 * safe;
  return {
    w_mm, h_mm, bleed_mm, safe_mm: safe, bg: "#ffffff",
    objects: layout.objects.map((t) => {
      const w = aw * t.w, h = ah * t.h;
      const base = { kind: "text" as const, name: t.name, text: t.text, w, h, font: t.font, bold: t.bold, color: "#111111", minFont: t.minFont, maxFont: t.maxFont,
        tracking: t.tracking, align: t.align, rotation: 0, variable: t.variable };
      return { ...base, x: safe + aw * t.x - w / 2, y: safe + ah * t.y - h / 2, size: fitFont(t.text, w, h, t) };
    }),
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Render doc -> SVG (mm user units) incl. bleed. Used by the server for proofs and print files. */
export function docToSvg(doc: DesignDoc, opts: { bleed?: boolean; marks?: boolean; dpi?: number } = { bleed: true }): string {
  const b = opts.bleed ? doc.bleed_mm : 0;
  const W = doc.w_mm + 2 * b, H = doc.h_mm + 2 * b;
  const body = doc.objects.map((o) => {
    const cx = o.x + o.w / 2 + b, cy = o.y + o.h / 2 + b, rot = o.rotation ? ` transform="rotate(${o.rotation} ${cx} ${cy})"` : "";
    if (o.kind === "image") return `<image xlink:href="${esc(o.href)}" x="${o.x + b}" y="${o.y + b}" width="${o.w}" height="${o.h}" preserveAspectRatio="xMidYMid meet"${rot}/>`;
    const sizeMm = o.size * PT, anchor = o.align === "center" ? "middle" : "start", tx = o.align === "center" ? cx : o.x + b;
    return `<text x="${tx}" y="${cy}" dominant-baseline="central" text-anchor="${anchor}" font-family="${esc(o.font)}, sans-serif" font-weight="${o.bold ? 700 : 400}" font-size="${sizeMm}" fill="${esc(o.color)}" letter-spacing="${(o.tracking / 1000) * sizeMm}"${rot}>${esc(o.text)}</text>`;
  }).join("");
  const supplied = doc.upload ? `<text x="${W / 2}" y="${H / 2 - 4}" text-anchor="middle" font-family="DejaVu Sans" font-weight="700" font-size="${Math.min(W, H) / 12}" fill="#111">CUSTOMER-SUPPLIED ARTWORK</text><text x="${W / 2}" y="${H / 2 + Math.min(W, H) / 10}" text-anchor="middle" font-family="DejaVu Sans" font-size="${Math.min(W, H) / 16}" fill="#555">${esc(doc.upload.name)}</text>` : "";
  const marks = opts.marks && b > 0 ? `<rect x="${b}" y="${b}" width="${doc.w_mm}" height="${doc.h_mm}" fill="none" stroke="#e11" stroke-width="0.2" stroke-dasharray="1 1"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${opts.dpi ? Math.round((W / 25.4) * opts.dpi) : W + "mm"}" height="${opts.dpi ? Math.round((H / 25.4) * opts.dpi) : H + "mm"}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${esc(doc.bg)}"/>${body}${supplied}${marks}</svg>`;
}

/** Substitute CSV row values into variable placeholders (matched by object name), refitting each. */
export function applyRow(doc: DesignDoc, row: Record<string, string>): DesignDoc {
  return { ...doc, objects: doc.objects.map((o) => {
    if (o.kind !== "text" || !o.variable || !o.name || row[o.name] == null) return o;
    const text = String(row[o.name]);
    return { ...o, text, size: fitFont(text, o.w, o.h, o) };
  }) };
}
