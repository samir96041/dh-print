import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin; try { admin = await requireAdmin(); } catch (r) { return r as Response; }
  const { id } = await params; const { role } = await req.json();
  if (!["customer", "admin"].includes(role)) return NextResponse.json({ error: "Bad role" }, { status: 400 });
  if (id === admin.id) return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
  await supabaseAdmin().from("profiles").update({ role }).eq("id", id);
  return NextResponse.json({ ok: true });
}
