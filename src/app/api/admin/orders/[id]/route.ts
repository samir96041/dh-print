import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase/server";
import { STAGES, setStage, generatePrintFiles, type Stage } from "@/lib/orders";
import { notify } from "@/lib/email";

export const maxDuration = 60;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin; try { admin = await requireAdmin(); } catch (r) { return r as Response; }
  const { id } = await params;
  const { stage, archived } = await req.json();
  const sb = supabaseAdmin();
  if (typeof archived === "boolean") { await sb.from("orders").update({ archived }).eq("id", id); return NextResponse.json({ ok: true }); }
  if (!STAGES.includes(stage)) return NextResponse.json({ error: "Bad stage" }, { status: 400 });
  const { data: o } = await sb.from("orders").select("*, profiles(email), order_items(id, proofs(status))").eq("id", id).single();
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!o.paid && STAGES.indexOf(stage as Stage) > STAGES.indexOf("artwork")) return NextResponse.json({ error: "Order is not paid" }, { status: 409 });
  if (STAGES.indexOf(stage as Stage) >= STAGES.indexOf("production")) { // approval gate
    const ok = o.order_items.every((i: { proofs: { status: string }[] }) => i.proofs.some((p) => p.status === "approved"));
    if (!ok) return NextResponse.json({ error: "Blocked: proof not approved by the customer yet" }, { status: 409 });
    for (const i of o.order_items) await generatePrintFiles(i.id); // ensure files exist
  }
  await setStage(id, stage, admin.id);
  if (stage === "completed") await notify(o.profiles?.email, `Order #${o.order_no} is complete`, `<p>Your order is complete. Thank you!</p>`);
  return NextResponse.json({ ok: true });
}
