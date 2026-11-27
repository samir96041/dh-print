import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { checkArtwork } from "@/lib/upload";

/** Customer uploads finished artwork (PDF/AI/SVG/PNG). Stored privately; path is saved on the design. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const v = checkArtwork(file.name, buf.subarray(0, 512), buf.length);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const path = `${user.id}/${crypto.randomUUID()}.${v.ext}`;
  const { error } = await supabaseAdmin().storage.from("artwork").upload(path, buf, { contentType: file.type || "application/octet-stream" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path, name: file.name.slice(0, 80) });
}
