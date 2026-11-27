import { redirect } from "next/navigation";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getProducts } from "@/lib/products";
import { priceSelection } from "@/lib/orders";
import CheckoutForm from "./CheckoutForm";

export default async function Checkout({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  const { design: id } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const { data: design } = await supabaseAdmin().from("designs").select("*").eq("id", id ?? "").eq("user_id", user.id).single();
  if (!design) redirect("/");
  const product = (await getProducts()).find((p) => p.id === design.product_id)!;
  const cfg = design.config;
  const mat = product.config.materials.find((m) => m.id === cfg.material);
  const q = priceSelection(product, cfg);
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="display text-4xl font-bold mb-6">Checkout</h1>
      <CheckoutForm designId={design.id} supportsCsv={product.supports_csv} minQty={product.config.min_qty}
        summary={{ name: product.name, size: `${cfg.w} × ${cfg.h} mm`, material: mat?.label ?? cfg.material, ...q }} />
    </div>
  );
}
