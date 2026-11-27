import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/pricing";
import { ProfileForm, ReorderButton } from "./DashClient";

type Item = { id: string; qty: number; products: { name: string }; proofs: { version: number; status: string }[] };
type Order = { id: string; order_no: number; stage: string; paid: boolean; total_cents: number; created_at: string; order_items: Item[] };

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const sb = supabaseAdmin();
  const [{ data: orders }, { data: designs }, { data: profile }] = await Promise.all([
    sb.from("orders").select("id, order_no, stage, paid, total_cents, created_at, order_items(id, qty, products(name), proofs(version, status))").eq("user_id", user.id).order("created_at", { ascending: false }),
    sb.from("designs").select("id, name, config, created_at, products(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
    sb.from("profiles").select("*").eq("id", user.id).single(),
  ]);
  const list = (orders ?? []) as unknown as Order[];
  const activeProofs = list.flatMap((o) => o.order_items.flatMap((i) => {
    const latest = [...i.proofs].sort((a, b) => b.version - a.version)[0];
    return latest && ["pending", "changes_requested"].includes(latest.status) ? [{ o, i, latest }] : [];
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 grid lg:grid-cols-3 gap-6">
      <section className="panel p-5">
        <span className="label">Account</span>
        <p className="display text-xl font-bold">{profile?.full_name || user.email}</p>
        <p className="text-sm text-muted mb-3">{user.email} · <span className="mono uppercase text-xs border border-ink px-1">{user.role}</span> · {list.length} orders</p>
        <ProfileForm name={profile?.full_name ?? ""} company={profile?.company ?? ""} />
      </section>

      <section className="panel p-5 lg:col-span-2">
        <span className="label">Active proofs</span>
        {activeProofs.length === 0 ? <p className="text-sm text-muted">Nothing waiting for your approval.</p> : (
          <ul className="space-y-2">{activeProofs.map(({ o, i, latest }) => (
            <li key={i.id} className="flex justify-between items-center gap-2 text-sm">
              <span>#{o.order_no} · {i.products.name} · <b>v{latest.version}</b> <span className="mono text-xs uppercase">{latest.status.replace("_", " ")}</span></span>
              <Link className="btn !py-1 !px-3 text-sm" href={`/orders/${o.id}`}>{latest.status === "pending" ? "Review" : "Edit"}</Link>
            </li>))}</ul>
        )}
      </section>

      <section className="panel p-5 lg:col-span-3 overflow-x-auto">
        <span className="label">Order history</span>
        {list.length === 0 ? <p className="text-sm text-muted">No orders yet. <Link className="underline" href="/#products">Start one →</Link></p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left mono text-xs uppercase text-muted"><th className="py-2">Order</th><th>Items</th><th>Status</th><th>Total</th><th /></tr></thead>
            <tbody>{list.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="py-2"><Link className="underline" href={`/orders/${o.id}`}>#{o.order_no}</Link><div className="text-xs text-muted">{new Date(o.created_at).toLocaleDateString("en-GB")}</div></td>
                <td>{o.order_items.map((i) => `${i.products.name} ×${i.qty}`).join(", ")}</td>
                <td><span className="mono text-xs uppercase border border-ink px-1.5">{o.paid ? o.stage : "unpaid"}</span></td>
                <td>{money(o.total_cents)}</td>
                <td className="text-right space-x-2 whitespace-nowrap">
                  {o.paid && <a className="underline text-xs" href={`/api/invoices/${o.id}`} target="_blank">Invoice</a>}
                  {o.paid && <ReorderButton orderId={o.id} />}
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </section>

      <section className="panel p-5 lg:col-span-3">
        <span className="label">Saved designs</span>
        {!designs?.length ? <p className="text-sm text-muted">Designs you save appear here for reuse.</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{designs.map((d) => {
            const c = d.config as { w: number; h: number; material: string; qty: number };
            return <div key={d.id} className="border border-line p-3 text-sm bg-paper">
              <b>{(d.products as unknown as { name: string }).name}</b>
              <p className="mono text-xs text-muted">{c.w}×{c.h} mm · {c.material} · qty {c.qty}</p>
              <Link className="underline text-xs" href={`/checkout?design=${d.id}`}>Order again →</Link></div>;
          })}</div>
        )}
      </section>
    </div>
  );
}
