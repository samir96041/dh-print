import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getProducts } from "@/lib/products";
import { createProof, markPaid, priceSelection, setStage, stripeCheckoutUrl } from "@/lib/orders";
import { parseCsv } from "@/lib/render";
import type { DesignDoc } from "@/lib/design";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { designId, csv, notes } = await req.json();
  const sb = supabaseAdmin();
  const { data: design } = await sb.from("designs").select("*").eq("id", designId).eq("user_id", user.id).single();
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
  const product = (await getProducts()).find((p) => p.id === design.product_id);
  if (!product) return NextResponse.json({ error: "Product unavailable" }, { status: 404 });

  const cfg = design.config as { w: number; h: number; material: string; qty: number };
  let qty = cfg.qty, rows = 0;
  if (csv) { // CSV drives quantity: one artwork file per row
    if (!product.supports_csv) return NextResponse.json({ error: "CSV merge is not available for this product" }, { status: 400 });
    const p = parseCsv(csv);
    if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
    qty = rows = p.rows.length;
  }
  let q;
  try { q = priceSelection(product, { ...cfg, qty }); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const { data: order, error } = await sb.from("orders").insert({ user_id: user.id, stage: "order", subtotal_cents: q.subtotal, vat_cents: q.vat, total_cents: q.total, notes }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const csvPath = csv ? `${user.id}/${order.id}.csv` : null;
  if (csv) await sb.storage.from("artwork").upload(csvPath!, Buffer.from(csv), { contentType: "text/csv" });
  const { data: item } = await sb.from("order_items").insert({ order_id: order.id, product_id: product.id, design_id: design.id, config: { ...cfg, qty }, qty, unit_cents: q.unit_net, line_cents: q.subtotal, csv_path: csvPath, csv_rows: rows || null }).select().single();
  await sb.from("order_status_history").insert({ order_id: order.id, stage: "order", by_user: user.id });
  await createProof(item!.id, design.data as DesignDoc);
  await setStage(order.id, "artwork", null, "Artwork received");

  if (!process.env.STRIPE_SECRET_KEY) { // demo mode: no gateway configured
    await markPaid(order.id);
    return NextResponse.json({ url: `/orders/${order.id}?paid=1` });
  }
  return NextResponse.json({ url: await stripeCheckoutUrl(order, user.email, new URL(req.url).origin) });
}
