import { CATALOG, bySlug, type Product } from "./catalog";
import { supabaseAdmin } from "./supabase/server";

const dbReady = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Products from Supabase (admin-editable); static catalogue if the DB isn't connected / seeded. */
export async function getProducts(): Promise<Product[]> {
  if (!dbReady()) return CATALOG;
  const { data } = await supabaseAdmin().from("products").select("*, templates(layout)").eq("active", true);
  if (!data?.length) return CATALOG;
  return data.map((r) => ({
    id: r.id, slug: r.slug, name: r.name, blurb: r.description ?? "", accent: bySlug(r.slug)?.accent ?? "#ff5a1f",
    config: r.config, pricing: r.pricing, bleed_mm: Number(r.bleed_mm), dpi: r.dpi, supports_csv: r.supports_csv,
    template: r.templates?.[0]?.layout ?? bySlug(r.slug)!.template,
  }));
}
export async function getProduct(slug: string) {
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}
