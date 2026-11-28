import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { stripeCheckoutUrl } from "@/lib/orders";

/** "Pay now" for an unpaid order (e.g. customer cancelled on the Stripe page): new Checkout session, 303 to Stripe. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const { id } = await params;
  const { data: o } = await supabaseAdmin().from("orders").select("id, order_no, total_cents, paid, user_id").eq("id", id).single();
  if (!o || o.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (o.paid || !process.env.STRIPE_SECRET_KEY) return NextResponse.redirect(new URL(`/orders/${id}`, req.url), 303);
  return NextResponse.redirect(await stripeCheckoutUrl(o, user.email, new URL(req.url).origin), 303);
}
