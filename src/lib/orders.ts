// Order lifecycle (server only): create, proofs, approval gate, print-file generation.
import { supabaseAdmin } from "./supabase/server";
import { notify } from "./email";
import { renderPng, renderPdf, mergeCsv, parseCsv, outputDir, pdfFirstPagePng } from "./render";
import type { DesignDoc } from "./design";
import type { Product } from "./catalog";
import { quote } from "./pricing";

import { STAGES, type Stage } from "./stages";
export { STAGES, type Stage };
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "";

export async function setStage(orderId: string, stage: Stage, by: string | null, note?: string) {
  const sb = supabaseAdmin();
  await sb.from("orders").update({ stage, archived: stage === "completed" ? undefined : false }).eq("id", orderId);
  await sb.from("order_status_history").insert({ order_id: orderId, stage, by_user: by, note });
}

/** Server-side price + option validation. Never trust client totals. */
export function priceSelection(p: Product, cfg: { w: number; h: number; material: string; qty: number }) {
  const mat = p.config.materials.find((m) => m.id === cfg.material);
  if (!mat) throw new Error("Unknown material");
  const preset = p.config.sizes.some((s) => (s.w === cfg.w && s.h === cfg.h) || (s.w === cfg.h && s.h === cfg.w));
  const c = p.config.custom;
  const okCustom = !!c && cfg.w >= c.min_w && cfg.w <= c.max_w && cfg.h >= c.min_h && cfg.h <= c.max_h;
  if (!preset && !okCustom) throw new Error("Invalid size");
  if (!Number.isInteger(cfg.qty) || cfg.qty < p.config.min_qty) throw new Error(`Minimum quantity is ${p.config.min_qty}`);
  return quote(p.pricing, { w_mm: cfg.w, h_mm: cfg.h, material_mult: mat.mult, qty: cfg.qty });
}

/** Render + store proof vN for an order item. Supersedes older pending versions. */
export async function createProof(itemId: string, doc: DesignDoc) {
  const sb = supabaseAdmin();
  const { data: last } = await sb.from("proofs").select("version").eq("order_item_id", itemId).order("version", { ascending: false }).limit(1);
  const version = (last?.[0]?.version ?? 0) + 1;
  const path = `${itemId}/v${version}.png`;
  let png: Buffer | null = null;
  if (doc.upload && /\.(pdf|ai)$/i.test(doc.upload.path)) { // show the customer's real artwork, not a placeholder
    try { png = await pdfFirstPagePng(Buffer.from(await (await sb.storage.from("artwork").download(doc.upload.path)).data!.arrayBuffer())); } catch (e) { console.error("pdf preview failed", e); }
  }
  png ??= await renderPng(doc, 150, { bleed: true, marks: true }); // designed proofs show the trim line
  await sb.storage.from("proofs").upload(path, png, { contentType: "image/png", upsert: true });
  await sb.from("proofs").update({ status: "superseded" }).eq("order_item_id", itemId).in("status", ["pending", "changes_requested"]);
  const { data, error } = await sb.from("proofs").insert({ order_item_id: itemId, version, design_data: doc, preview_path: path }).select().single();
  if (error) throw error;
  return data;
}

/** Approval gate: print-ready files exist only after the latest proof is approved. */
export async function generatePrintFiles(itemId: string) {
  const sb = supabaseAdmin();
  const { data: item } = await sb.from("order_items").select("*, orders(order_no), products(slug,dpi)").eq("id", itemId).single();
  const { data: proof } = await sb.from("proofs").select("*").eq("order_item_id", itemId).eq("status", "approved").order("version", { ascending: false }).limit(1).single();
  if (!item || !proof) throw new Error("No approved proof — files are locked");
  const dir = outputDir(item.orders.order_no, item.products.slug);
  const doc = proof.design_data as DesignDoc, dpi = item.products.dpi as number;
  const files: { kind: string; path: string; body: Buffer; type: string }[] = doc.upload ? [] : [
    { kind: "pdf", path: `${dir}/${dir}_v${proof.version}.pdf`, body: await renderPdf(doc, dpi), type: "application/pdf" },
    { kind: "png", path: `${dir}/${dir}_v${proof.version}.png`, body: await renderPng(doc, dpi), type: "image/png" },
  ];
  if (doc.upload) { // finished artwork: hand the customer's original to production untouched
    const { data: orig } = await sb.storage.from("artwork").download(doc.upload.path);
    files.push({ kind: "supplied", path: `${dir}/${dir}_v${proof.version}_supplied.${doc.upload.path.split(".").pop()}`, body: Buffer.from(await orig!.arrayBuffer()), type: "application/octet-stream" });
  }
  if (item.csv_path && !doc.upload) {
    const { data: csv } = await sb.storage.from("artwork").download(item.csv_path);
    const { rows, error } = parseCsv(await csv!.text());
    if (error) throw new Error(error);
    files.push({ kind: "csv-merge", path: `${dir}/${dir}_rows.zip`, body: await mergeCsv(doc, rows, dpi), type: "application/zip" });
  }
  await sb.from("print_files").delete().eq("order_item_id", itemId);
  for (const f of files) {
    await sb.storage.from("print-files").upload(f.path, f.body, { contentType: f.type, upsert: true });
    await sb.from("print_files").insert({ order_item_id: itemId, kind: f.kind, path: f.path });
  }
  return files.length;
}

export async function markPaid(orderId: string) {
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").update({ paid: true }).eq("id", orderId).eq("paid", false).select("*, profiles(email)").single();
  if (!o) return; // already processed (webhook retries are idempotent)
  const n = (await sb.from("invoices").select("id", { count: "exact", head: true })).count ?? 0;
  await sb.from("invoices").upsert({ order_id: orderId, number: `INV-${new Date().getFullYear()}-${String(n + 1).padStart(5, "0")}` }, { onConflict: "order_id" });
  await setStage(orderId, "proof", null, "Payment received; proof v1 ready");
  await notify(o.profiles?.email, `Order #${o.order_no} confirmed — proof ready`, `<p>Thanks! Your proof is ready to review: <a href="${site()}/orders/${orderId}">view proof</a>.</p>`);
}
