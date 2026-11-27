import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Cookie-bound client: acts as the signed-in user (RLS applies). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach((c) => store.set(c.name, c.value, c.options)); } catch { /* called from RSC */ } },
    },
  });
}

/** Service-role client: server-only, bypasses RLS. Use after verifying the caller's role. */
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function currentUser() {
  await cookies(); // opts every caller into per-request rendering (never statically cached)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null; // DB not connected yet: render as visitor
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  return profile as { id: string; email: string; full_name: string | null; role: "customer" | "admin" } | null;
}

export async function requireAdmin() {
  const u = await currentUser();
  if (!u || u.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return u;
}
