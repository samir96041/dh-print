import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/pricing";
import { STAGES } from "@/lib/orders";
import ProofActions from "./ProofActions";

type Proof = { id: string; version: number; preview_path: string; status: string; change_note: string; url?: string };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ id }, { paid }] = await Promise.all([params, searchParams]);
  const user = await currentUser();
  if (!user) redirect("/login");
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("*, invoices(number), order_items(*, products(name,slug), proofs(*)), order_status_history(stage, at, note)").eq("id", id).single();
  if (!o || (o.user_id !== user.id && user.role !== "admin")) notFound();

  const items = await Promise.all(o.order_items.map(async (it: { proofs: Proof[] } & Record<string, unknown>) => {
    const proofs = [...it.proofs].sort((a, b) => b.version - a.version);
    const urls = await Promise.all(proofs.map(async (p) => (await sb.storage.from("proofs").createSignedUrl(p.preview_path, 3600)).data?.signedUrl));
    return { ...it, proofs: proofs.map((p, i): Proof => ({ ...p, url: urls[i] })) };
  }));
  const stageIdx = STAGES.indexOf(o.stage);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10">
      {paid && (o.paid
        ? <p className="panel p-3 mb-4 bg-[#e8f5e9] text-sm">Payment received — your proof is ready below.</p>
        : <p className="panel p-3 mb-4 text-sm">Payment is being confirmed by Stripe — refresh in a few seconds.</p>)}
      {!o.paid && !paid && o.user_id === user.id && process.env.STRIPE_SECRET_KEY && (
        <form method="POST" action={`/api/orders/${o.id}/pay`} className="panel p-3 mb-4 flex items-center justify-between gap-3 text-sm">
          <span>This order is awaiting payment. Pay to approve your proof and send it to production.</span>
          <button className="btn !py-1.5">Pay now</button>
        </form>)}
      <p className="mono text-xs uppercase tracking-widest text-muted">Order #{o.order_no}</p>
      <h1 className="display text-4xl font-bold">{money(o.total_cents)} <span className="text-base font-medium text-muted">inc. VAT · {o.paid ? "paid" : "awaiting payment"}</span></h1>
      <ol className="flex flex-wrap gap-1 my-6" aria-label="Order progress">
        {STAGES.map((s, i) => <li key={s} className={`mono text-xs px-2 py-1 border-[1.5px] border-ink capitalize ${i <= stageIdx ? "bg-ink text-paper" : "bg-card text-muted"}`}>{s}</li>)}
      </ol>
      {items.map((it) => (
        <section key={it.id as string} className="panel p-5 mb-6">
          <h2 className="display text-xl font-bold">{(it.products as { name: string }).name} × {it.qty as number}{it.csv_rows ? ` (${it.csv_rows} CSV rows)` : ""}</h2>
          <div className="mt-4 space-y-5">
            {it.proofs.map((p: Proof, idx: number) => (
              <div key={p.id} className={idx === 0 ? "" : "opacity-60"}>
                <div className="flex items-center gap-2 mb-2"><span className="mono text-sm font-bold">v{p.version}</span>
                  <span className="mono text-xs border border-ink px-1.5 uppercase">{p.status.replace("_", " ")}</span></div>
                {p.url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.url} alt={`Proof v${p.version}`} className="border border-ink max-h-80 bg-white" />}
                {p.change_note && <p className="text-sm mt-1 text-muted">Your note: “{p.change_note}”</p>}
                {idx === 0 && p.status === "pending" && o.paid && <ProofActions proofId={p.id} />}
                {idx === 0 && p.status === "changes_requested" && (
                  <Link className="btn mt-3 inline-flex" href={`/design/${(it.products as { slug: string }).slug}?revise=${it.id}`}>Edit design → submit new version</Link>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="flex gap-3 mb-10">
        {o.paid && <a className="btn btn-ghost" href={`/api/invoices/${o.id}`} target="_blank">Invoice / receipt</a>}
        <Link className="btn btn-ghost" href="/dashboard">← Dashboard</Link>
      </div>
      <h2 className="display text-lg font-bold mb-2">History</h2>
      <ul className="text-sm text-muted space-y-1 mb-10">
        {[...o.order_status_history].sort((a: { at: string }, b: { at: string }) => +new Date(b.at) - +new Date(a.at)).map((h: { at: string; stage: string; note: string }, i: number) =>
          <li key={i}><span className="mono">{new Date(h.at).toLocaleString("en-GB")}</span> — <b className="capitalize text-ink">{h.stage}</b>{h.note && ` · ${h.note}`}</li>)}
      </ul>
    </div>
  );
}
