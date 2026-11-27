import { supabaseAdmin } from "@/lib/supabase/server";
import ProductEditor from "./ProductEditor";

export default async function Products() {
  const { data } = await supabaseAdmin().from("products").select("id, name, slug, active, config, pricing, templates(layout)").order("name");
  if (!data?.length) return <p className="text-muted">No products in the database yet — run supabase/seed.sql.</p>;
  return <div className="space-y-4">{data.map((p) => <ProductEditor key={p.id} p={{ id: p.id, name: p.name, slug: p.slug, config: p.config, pricing: p.pricing, layout: p.templates?.[0]?.layout }} />)}</div>;
}
