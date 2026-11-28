import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { generatePrintFiles, setStage } from "@/lib/orders";
import { notify } from "@/lib/email";

export const maxDuration = 60;

/** Customer approves a proof or requests changes. Only the latest pending proof can be actioned. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { id } = await params;
  const { action, note } = await req.json();
  if (!["approve", "changes"].includes(action)) return NextResponse.json({ error: "Bad action" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data: proof } = await sb.from("proofs").select("*, order_items(id, order_id, orders(user_id, order_no, paid))").eq("id", id).single();
  const order = proof?.order_items?.orders;
  if (!proof || order?.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!order.paid) return NextResponse.json({ error: "Please complete payment before approving the proof" }, { status: 402 });
  if (proof.status !== "pending") return NextResponse.json({ error: "This proof version is no longer open" }, { status: 409 });
  if (action === "changes" && !String(note ?? "").trim()) return NextResponse.json({ error: "Please describe the changes you need" }, { status: 400 });

  const status = action === "approve" ? "approved" : "changes_requested";
  await sb.from("proofs").update({ status, change_note: note ?? null }).eq("id", id);
  await sb.from("proof_approvals").insert({ proof_id: id, user_id: user.id, action: status, note });
  const orderId = proof.order_items.order_id as string;

  if (action === "approve") {
    await generatePrintFiles(proof.order_items.id); // gate opens: files generated server-side
    const { data: open } = await sb.from("order_items").select("id, proofs(status, version)").eq("order_id", orderId);
    const allApproved = open?.every((i) => (i.proofs as { status: string }[]).some((p) => p.status === "approved"));
    if (allApproved) await setStage(orderId, "production", user.id, `Proof v${proof.version} approved`);
  } else {
    await setStage(orderId, "proof", user.id, `Changes requested on v${proof.version}`);
  }
  await notify(process.env.ADMIN_EMAIL, `Order #${order.order_no}: proof v${proof.version} ${status}`, `<p>${note ?? ""}</p>`);
  return NextResponse.json({ ok: true, status });
}
