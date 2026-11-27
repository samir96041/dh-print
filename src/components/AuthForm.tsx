"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setInfo(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")), password = String(f.get("password"));
    const sb = supabaseBrowser();
    const { data, error } = mode === "login"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { data: { full_name: String(f.get("name")) } } });
    setBusy(false);
    if (error) return setErr(error.message);
    if (mode === "signup" && !data.session) return setInfo("Check your email to confirm your account, then log in.");
    router.push(next); router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-14">
      <h1 className="display text-4xl font-bold mb-6">{mode === "login" ? "Log in" : "Create account"}</h1>
      <form onSubmit={submit} className="panel p-5 space-y-4">
        {mode === "signup" && <label className="block"><span className="label">Full name</span><input name="name" required className="field" autoComplete="name" /></label>}
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="field" autoComplete="email" /></label>
        <label className="block"><span className="label">Password</span><input name="password" type="password" required minLength={8} className="field" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        {info && <p className="text-sm text-green-800">{info}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "…" : mode === "login" ? "Log in" : "Sign up"}</button>
      </form>
      <p className="text-sm text-muted mt-4">
        {mode === "login" ? <>No account? <Link className="underline" href="/signup">Sign up</Link></> : <>Have an account? <Link className="underline" href="/login">Log in</Link></>}
      </p>
    </div>
  );
}
