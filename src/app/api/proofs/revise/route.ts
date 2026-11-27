import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { createProof } from "@/lib/orders";
import { notify } from "@/lib/email";

export const maxDuration = 60;

/** After requesting changes, the customer edits the design and submits it: creates proof v(n+1). */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { itemId, doc } = await req.json();
  const sb = supabaseAdmin();
  const { data: item } = await sb.from("order_items").select("id, order_id, orders(user_id, order_no)").eq("id", itemId).single();
  if (!item || (item.orders as unknown as { user_id: string }).user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: open } = await sb.from("proofs").select("id").eq("order_item_id", itemId).eq("status", "changes_requested");
  if (!open?.length) return NextResponse.json({ error: "No change request is open for this item" }, { status: 409 });
  const proof = await createProof(itemId, doc);
  await notify(user.email, `Proof v${proof.version} ready`, `<p>Your revised proof is ready to review.</p>`);
  return NextResponse.json({ ok: true, version: proof.version, orderId: item.order_id });
}
