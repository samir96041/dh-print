// Server-side print-file engine (Node runtime only). Renders a DesignDoc to PNG/PDF and merges CSV rows.
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import Papa from "papaparse";
import { applyRow, docToSvg, type DesignDoc } from "./design";

export const MAX_CSV_ROWS = 500; // ponytail: Vercel function time ceiling; move to a queue/worker for bigger events

const FONT_DIR = path.join(process.cwd(), "public", "fonts"); // bundled via outputFileTracingIncludes; same files the browser designer loads
const FONT_FILES = ["DejaVuSans", "DejaVuSans-Bold", "DejaVuSerif", "DejaVuSerif-Bold", "DejaVuSansMono", "DejaVuSansMono-Bold"].map((f) => path.join(FONT_DIR, f + ".ttf"));

/** PNG at product dpi, including bleed. Pixel size is set in the SVG (mm -> px at dpi); fonts are bundled so output is identical on any host. */
export async function renderPng(doc: DesignDoc, dpi: number, o: { bleed?: boolean; marks?: boolean } = { bleed: true }) {
  const svg = docToSvg(doc, { ...o, dpi });
  return new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" } }).render().asPng();
}

/** Print PDF: page = trim + bleed, raster at dpi. ponytail: raster PDF (text not vector); embed fonts + vector output if the press needs it. */
export async function renderPdf(doc: DesignDoc, dpi: number) {
  const png = await renderPng(doc, dpi);
  const pdf = await PDFDocument.create();
  const wPt = ((doc.w_mm + 2 * doc.bleed_mm) / 25.4) * 72, hPt = ((doc.h_mm + 2 * doc.bleed_mm) / 25.4) * 72;
  const page = pdf.addPage([wPt, hPt]);
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: wPt, height: hPt });
  pdf.setTitle("Digital Heroes print file"); pdf.setProducer("DH Print");
  return Buffer.from(await pdf.save());
}

export function parseCsv(text: string): { rows: Record<string, string>[]; error?: string } {
  const r = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  if (r.errors.length && !r.data.length) return { rows: [], error: r.errors[0].message };
  if (!r.data.length) return { rows: [], error: "CSV has no data rows" };
  if (r.data.length > MAX_CSV_ROWS) return { rows: [], error: `Max ${MAX_CSV_ROWS} rows per upload (got ${r.data.length})` };
  return { rows: r.data };
}

/** One PDF per CSV row (placeholders matched by name), zipped. */
export async function mergeCsv(doc: DesignDoc, rows: Record<string, string>[], dpi: number) {
  const zip = new JSZip(); const pad = String(rows.length).length;
  for (let i = 0; i < rows.length; i++) {
    const label = (rows[i].number || rows[i].name || "").replace(/[^\w-]+/g, "_").slice(0, 24);
    zip.file(`row_${String(i + 1).padStart(pad, "0")}${label ? "_" + label : ""}.pdf`, await renderPdf(applyRow(doc, rows[i]), dpi));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** OrderID_ProductType_Date_Output */
export const outputDir = (orderNo: number, productSlug: string, d = new Date()) =>
  `${orderNo}_${productSlug}_${d.toISOString().slice(0, 10).replace(/-/g, "")}_Output`;

/** Page 1 of a customer PDF/AI (PDF-compatible) as a PNG for the proof. Throws if unreadable -> caller falls back to a file card. */
export async function pdfFirstPagePng(file: Buffer, maxPx = 1600): Promise<Buffer> {
  const mupdf = await import("mupdf");
  const page = mupdf.Document.openDocument(file, "application/pdf").loadPage(0);
  const [x0, y0, x1, y1] = page.getBounds();
  const k = Math.min(3, maxPx / Math.max(x1 - x0, y1 - y0));
  return Buffer.from(page.toPixmap(mupdf.Matrix.scale(k, k), mupdf.ColorSpace.DeviceRGB, false, true).asPNG());
}
