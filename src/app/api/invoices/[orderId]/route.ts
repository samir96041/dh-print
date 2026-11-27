import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/pricing";

/** Printable HTML invoice/receipt (Print → Save as PDF). Owner or admin only. */
export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { orderId } = await params;
  const { data: o } = await supabaseAdmin().from("orders").select("*, invoices(number, issued_at), profiles(full_name,email), order_items(qty, unit_cents, line_cents, products(name))").eq("id", orderId).single();
  if (!o || (o.user_id !== user.id && user.role !== "admin") || !o.paid) return new Response("Not found", { status: 404 });
  const rows = o.order_items.map((i: { qty: number; unit_cents: number; line_cents: number; products: { name: string } }) =>
    `<tr><td>${i.products.name}</td><td>${i.qty}</td><td>${money(i.unit_cents)}</td><td>${money(i.line_cents)}</td></tr>`).join("");
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  return new Response(`<!doctype html><meta charset=utf-8><title>${o.invoices?.number}</title><style>body{font:15px system-ui;max-width:640px;margin:40px auto;padding:0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ccc;text-align:left}.r{text-align:right}</style>
<h1>Invoice ${o.invoices?.number ?? ""}</h1><p>Order #${o.order_no} · ${new Date(o.created_at).toLocaleDateString("en-GB")}<br>Billed to: ${esc(o.profiles?.full_name ?? "")} ${esc(o.profiles?.email ?? "")}</p>
<table><tr><th>Item</th><th>Qty</th><th>Unit (net)</th><th>Net</th></tr>${rows}</table>
<p class=r>Subtotal ${money(o.subtotal_cents)}<br>VAT 20% ${money(o.vat_cents)}<br><b>Total ${money(o.total_cents)}</b></p><p>Paid. Thank you.</p><script>onload=()=>0</script>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}
