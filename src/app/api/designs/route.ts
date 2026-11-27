import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getProduct } from "@/lib/products";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const raw = await req.text();
  if (raw.length > 8_000_000) return NextResponse.json({ error: "Design too large" }, { status: 413 });
  const { slug, doc, config } = JSON.parse(raw);
  const product = await getProduct(slug);
  if (!product?.id || !Array.isArray(doc?.objects) || doc.objects.length > 60) return NextResponse.json({ error: "Invalid design" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("designs")
    .insert({ user_id: user.id, product_id: product.id, name: `${product.name} design`, data: doc, config }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
