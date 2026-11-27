import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import type { DesignDoc } from "@/lib/design";
import Designer from "./Designer";

export default async function DesignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ revise?: string }> }) {
  const [{ slug }, { revise }] = await Promise.all([params, searchParams]);
  const product = await getProduct(slug);
  if (!product) notFound();
  let revision: { itemId: string; doc: DesignDoc } | undefined;
  if (revise) { // load the latest proof's design for editing (owner only)
    const user = await currentUser();
    const { data: item } = await supabaseAdmin().from("order_items").select("id, orders(user_id), proofs(version, design_data)").eq("id", revise).single();
    if (!user || !item || (item.orders as unknown as { user_id: string }).user_id !== user.id) notFound();
    const latest = [...item.proofs].sort((a: { version: number }, b: { version: number }) => b.version - a.version)[0];
    revision = { itemId: item.id, doc: latest.design_data };
  }
  return <Designer product={product} revision={revision} />;
}
