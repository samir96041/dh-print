import { supabaseAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/pricing";
import { STAGES } from "@/lib/stages";

export default async function Reports() {
  const { data } = await supabaseAdmin().from("orders").select("stage, paid, total_cents, order_items(qty, line_cents, products(name))").eq("paid", true);
  const orders = (data ?? []) as unknown as { stage: string; total_cents: number; order_items: { qty: number; line_cents: number; products: { name: string } }[] }[];
  const revenue = orders.reduce((s, o) => s + o.total_cents, 0);
  const byProduct = new Map<string, { jobs: number; units: number; net: number }>();
  orders.forEach((o) => o.order_items.forEach((i) => { const r = byProduct.get(i.products.name) ?? { jobs: 0, units: 0, net: 0 }; r.jobs++; r.units += i.qty; r.net += i.line_cents; byProduct.set(i.products.name, r); }));
  const max = Math.max(1, ...[...byProduct.values()].map((v) => v.net));
  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[["Paid orders", String(orders.length)], ["Revenue (inc. VAT)", money(revenue)], ["Avg order", money(orders.length ? Math.round(revenue / orders.length) : 0)]].map(([k, v]) =>
          <div key={k} className="panel p-5"><span className="label">{k}</span><p className="display text-3xl font-bold">{v}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="panel p-5"><span className="label">Throughput by product family</span>
          <ul className="space-y-3">{[...byProduct].map(([name, v]) => (
            <li key={name}><div className="flex justify-between text-sm"><span>{name}</span><span className="mono">{v.jobs} jobs · {v.units} units · {money(v.net)}</span></div>
              <div className="h-2 bg-paper border border-ink mt-1"><div className="h-full bg-accent" style={{ width: `${(v.net / max) * 100}%` }} /></div></li>))}
            {!byProduct.size && <li className="text-sm text-muted">No paid orders yet.</li>}</ul></section>
        <section className="panel p-5"><span className="label">Jobs by pipeline stage</span>
          <ul className="space-y-1 text-sm">{STAGES.map((s) => <li key={s} className="flex justify-between capitalize"><span>{s}</span><span className="mono">{orders.filter((o) => o.stage === s).length}</span></li>)}</ul></section>
      </div>
    </>
  );
}
