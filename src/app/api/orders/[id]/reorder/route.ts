import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";

/** One-click reorder: clone the saved design + config and jump straight to checkout (artwork is reused, no redesign). */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: item } = await sb.from("order_items").select("*, orders!inner(user_id)").eq("order_id", id).eq("orders.user_id", user.id).limit(1).single();
  if (!item?.design_id) return NextResponse.json({ error: "Nothing to reorder" }, { status: 404 });
  const { data: d } = await sb.from("designs").select("*").eq("id", item.design_id).single();
  const { data: copy, error } = await sb.from("designs").insert({ user_id: user.id, product_id: d.product_id, name: d.name, data: d.data, config: { ...d.config, qty: item.qty } }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: `/checkout?design=${copy.id}` });
}
