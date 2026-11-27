"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return <button className="btn !py-1.5 !px-3 text-sm" disabled={busy} onClick={async () => {
    setBusy(true);
    const r = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
    const j = await r.json(); setBusy(false);
    if (r.ok) router.push(j.url); else alert(j.error);
  }}>{busy ? "…" : "Reorder"}</button>;
}

export function ProfileForm({ name, company }: { name: string; company: string }) {
  const router = useRouter(); const [saved, setSaved] = useState(false);
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ full_name: f.get("name"), company: f.get("company") }) });
      setSaved(true); router.refresh();
    }}>
      <input name="name" defaultValue={name} className="field" placeholder="Full name" required />
      <input name="company" defaultValue={company} className="field" placeholder="Company (optional)" />
      <button className="btn !py-1.5 !px-3 text-sm">Save</button>{saved && <span className="text-sm text-green-800 ml-2">Saved</span>}
    </form>
  );
}
