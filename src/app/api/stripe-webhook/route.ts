import Stripe from "stripe";
import { markPaid } from "@/lib/orders";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { return new Response("bad signature", { status: 400 }); }
  if (event.type === "checkout.session.completed") await markPaid((event.data.object as Stripe.Checkout.Session).metadata!.order_id);
  return new Response("ok");
}
