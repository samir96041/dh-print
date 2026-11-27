import { requireAdmin, supabaseAdmin } from "@/lib/supabase/server";

/** Xero-ready sales-invoice CSV (Xero's import columns). Full Xero API sync is the planned upgrade path. */
export async function GET() {
  try { await requireAdmin(); } catch (r) { return r as Response; }
  const { data } = await supabaseAdmin().from("orders").select("order_no, created_at, subtotal_cents, vat_cents, invoices(number), profiles(full_name,email), order_items(qty, unit_cents, products(name))").eq("paid", true).order("created_at");
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = ["*ContactName,EmailAddress,*InvoiceNumber,Reference,*InvoiceDate,*DueDate,Description,*Quantity,*UnitAmount,*AccountCode,*TaxType"];
  for (const o of (data ?? []) as unknown as { order_no: number; created_at: string; invoices: { number: string } | null; profiles: { full_name: string; email: string }; order_items: { qty: number; unit_cents: number; products: { name: string } }[] }[]) {
    const d = o.created_at.slice(0, 10).split("-").reverse().join("/");
    for (const i of o.order_items) lines.push([q(o.profiles.full_name || o.profiles.email), q(o.profiles.email), q(o.invoices?.number ?? `ORD-${o.order_no}`), q(`Order ${o.order_no}`), d, d, q(i.products.name), i.qty, (i.unit_cents / 100).toFixed(4), 200, q("20% (VAT on Income)")].join(","));
  }
  return new Response(lines.join("\n"), { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="xero-invoices.csv"' } });
}
