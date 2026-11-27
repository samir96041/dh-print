import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { full_name, company } = await req.json();
  await supabaseAdmin().from("profiles").update({ full_name: String(full_name).slice(0, 80), company: String(company ?? "").slice(0, 80) }).eq("id", user.id); // role is never writable here
  return NextResponse.json({ ok: true });
}
