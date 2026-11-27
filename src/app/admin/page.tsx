import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/pricing";
import { STAGES } from "@/lib/stages";
import { StageControl } from "./AdminClient";

type Row = {
  id: string; order_no: number; stage: string; paid: boolean; archived: boolean; total_cents: number; created_at: string;
  profiles: { full_name: string | null; email: string } | null;
  order_items: { id: string; qty: number; products: { name: string; slug: string }; proofs: { status: string }[]; print_files: { id: string; kind: string; path: string }[] }[];
};

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string; product?: string; from?: string; to?: string; archived?: string }> }) {
  const f = await searchParams;
  const { data } = await supabaseAdmin().from("orders")
    .select("id, order_no, stage, paid, archived, total_cents, created_at, profiles(full_name,email), order_items(id, qty, products(name,slug), proofs(status), print_files(id, kind, path))")
    .eq("archived", f.archived === "1").order("created_at", { ascending: false }).limit(200);
  const q = (f.q ?? "").toLowerCase();
  const rows = ((data ?? []) as unknown as Row[]).filter((o) =>
    (!f.stage || o.stage === f.stage) &&
    (!f.product || o.order_items.some((i) => i.products.slug === f.product)) &&
    (!f.from || o.created_at >= f.from) && (!f.to || o.created_at <= f.to + "T23:59:59") &&
    (!q || String(o.order_no).includes(q) || (o.profiles?.email ?? "").toLowerCase().includes(q) || (o.profiles?.full_name ?? "").toLowerCase().includes(q)));

  return (
    <>
      <form className="panel p-3 grid sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 text-sm">
        <input name="q" defaultValue={f.q} placeholder="Order # / customer" className="field" />
        <select name="stage" defaultValue={f.stage ?? ""} className="field"><option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        <input name="product" defaultValue={f.product} placeholder="Product slug" className="field" />
        <input type="date" name="from" defaultValue={f.from} className="field" aria-label="From" />
        <input type="date" name="to" defaultValue={f.to} className="field" aria-label="To" />
        <div className="flex gap-2 items-center"><label className="text-xs flex gap-1"><input type="checkbox" name="archived" value="1" defaultChecked={f.archived === "1"} />Archive</label><button className="btn !py-1.5 !px-3 text-sm">Filter</button></div>
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left mono text-xs uppercase text-muted"><th className="p-3">Order</th><th>Customer</th><th>Items</th><th>Stage</th><th>Files</th><th>Total</th><th>Advance</th></tr></thead>
          <tbody>{rows.map((o) => {
            const approved = o.order_items.every((i) => i.proofs.some((p) => p.status === "approved"));
            const files = o.order_items.flatMap((i) => i.print_files);
            return (
              <tr key={o.id} className="border-t border-line align-top">
                <td className="p-3"><Link className="underline" href={`/orders/${o.id}`}>#{o.order_no}</Link><div className="text-xs text-muted">{new Date(o.created_at).toLocaleDateString("en-GB")}</div></td>
                <td>{o.profiles?.full_name}<div className="text-xs text-muted">{o.profiles?.email}</div></td>
                <td>{o.order_items.map((i) => `${i.products.name} ×${i.qty}`).join(", ")}</td>
                <td><span className="mono text-xs uppercase border border-ink px-1.5">{o.paid ? o.stage : "unpaid"}</span>
                  <div className={`text-xs mt-1 ${approved ? "text-green-800" : "text-muted"}`}>{approved ? "● Ready for production" : "○ Awaiting proof approval"}</div></td>
                <td className="space-y-1">{files.length ? files.map((fl) => <a key={fl.id} className="block underline text-xs" href={`/api/admin/files/${fl.id}`}>↓ {fl.kind}</a>) : <span className="text-xs text-muted">locked</span>}</td>
                <td>{money(o.total_cents)}</td>
                <td className="pr-3"><StageControl id={o.id} stage={o.stage} archived={o.archived} /></td>
              </tr>);
          })}</tbody>
        </table>
        {!rows.length && <p className="p-6 text-muted text-sm">No jobs match.</p>}
      </div>
    </>
  );
}
