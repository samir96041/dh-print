import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase/server";

/** Admin edits a product's parameter config / pricing / template layout (all JSON — no code change to add sizes or tiers). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (r) { return r as Response; }
  const { id } = await params; const { config, pricing, layout, active } = await req.json();
  const sb = supabaseAdmin();
  if (pricing && (!Array.isArray(pricing.tiers) || typeof pricing.base_cents !== "number")) return NextResponse.json({ error: "pricing needs base_cents and tiers[]" }, { status: 400 });
  if (config && (!Array.isArray(config.sizes) || !Array.isArray(config.materials))) return NextResponse.json({ error: "config needs sizes[] and materials[]" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (config) patch.config = config; if (pricing) patch.pricing = pricing; if (typeof active === "boolean") patch.active = active;
  if (Object.keys(patch).length) await sb.from("products").update(patch).eq("id", id);
  if (layout) await sb.from("templates").update({ layout }).eq("product_id", id);
  return NextResponse.json({ ok: true });
}
