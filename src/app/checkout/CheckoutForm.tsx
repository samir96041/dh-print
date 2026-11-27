"use client";
import { useState } from "react";
import { money } from "@/lib/pricing";

type Summary = { name: string; size: string; material: string; qty: number; unit_net: number; subtotal: number; vat: number; total: number; discount: number };

export default function CheckoutForm({ designId, supportsCsv, minQty, summary: s }: { designId: string; supportsCsv: boolean; minQty: number; summary: Summary }) {
  const [csv, setCsv] = useState<string | null>(null); const [rows, setRows] = useState(0);
  const [notes, setNotes] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function onCsv(f?: File) {
    setErr(""); if (!f) { setCsv(null); setRows(0); return; }
    if (!f.name.toLowerCase().endsWith(".csv")) return setErr("Please upload a .csv file");
    const text = await f.text();
    const n = text.trim().split(/\r?\n/).length - 1;
    if (n < minQty) return setErr(`CSV needs at least ${minQty} rows (found ${n})`);
    setCsv(text); setRows(n);
  }
  async function pay() {
    setBusy(true); setErr("");
    const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ designId, csv, notes }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); return setErr(j.error ?? "Checkout failed"); }
    window.location.href = j.url;
  }
  return (
    <div className="grid sm:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-4">
        <div className="panel p-5">
          <span className="label">Your item</span>
          <p className="display text-xl font-bold">{s.name}</p>
          <p className="text-sm text-muted">{s.size} · {s.material} · {csv ? `${rows} rows from CSV` : `qty ${s.qty}`}</p>
        </div>
        {supportsCsv && (
          <div className="panel p-5">
            <span className="label">Bulk variable data (optional)</span>
            <p className="text-sm text-muted mb-2">Header row must match the template fields (e.g. <span className="mono">number,name</span>). We generate one print file per row.</p>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onCsv(e.target.files?.[0])} className="text-sm" />
            {csv && <p className="text-sm text-green-800 mt-2">✓ {rows} rows — quantity set to {rows}</p>}
          </div>
        )}
        <label className="block"><span className="label">Notes for the print team</span><textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
      <aside className="panel p-5 h-fit">
        <span className="label">Total</span>
        <p className="display text-4xl font-bold">{money(csv && rows !== s.qty ? Math.round(s.total / s.qty * rows) : s.total)}</p>
        <p className="text-xs text-muted">inc. VAT {csv && rows !== s.qty && "· estimate, final price confirmed on payment"}</p>
        {err && <p role="alert" className="text-sm text-red-700 mt-3">{err}</p>}
        <button className="btn w-full mt-4" onClick={pay} disabled={busy}>{busy ? "Processing…" : "Pay securely →"}</button>
        <p className="text-xs text-muted mt-3">Pay once, per order. After payment you review and approve a proof before anything is printed.</p>
      </aside>
    </div>
  );
}
