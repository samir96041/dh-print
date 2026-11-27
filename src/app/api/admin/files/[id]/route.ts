import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase/server";

/** Admin-only signed download of a production file. Customers can never reach this. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (r) { return r as Response; }
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: f } = await sb.from("print_files").select("path").eq("id", id).single();
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data } = await sb.storage.from("print-files").createSignedUrl(f.path, 120, { download: f.path.split("/").pop() });
  return NextResponse.redirect(data!.signedUrl);
}
