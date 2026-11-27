"use client";
import { useState } from "react";
import TemplateEditor from "./TemplateEditor";
import type { Layout } from "@/lib/catalog";

type P = { id: string; name: string; slug: string; config: { sizes: { w: number; h: number }[] }; pricing: unknown; layout: Layout };

export default function ProductEditor({ p }: { p: P }) {
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState("");
  const [cfg, setCfg] = useState(JSON.stringify(p.config, null, 2));
  const [pr, setPr] = useState(JSON.stringify(p.pricing, null, 2));
  const [layout, setLayout] = useState<Layout>(p.layout);
  async function save() {
    let body; try { body = { config: JSON.parse(cfg), pricing: JSON.parse(pr), layout }; } catch { return setMsg("Invalid JSON"); }
    const r = await fetch(`/api/admin/products/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setMsg(r.ok ? "Saved ✓" : (await r.json()).error);
  }
  return (
    <div className="panel p-4">
      <button className="display font-bold text-lg w-full text-left flex justify-between" onClick={() => setOpen(!open)}>{p.name}<span className="mono text-xs text-muted">{open ? "close" : "edit"}</span></button>
      {open && (
        <div className="space-y-5 mt-4">
          <div><span className="label">Template (placeholders & fitting rules)</span>
            <TemplateEditor layout={layout} onChange={setLayout} w={p.config.sizes[0]?.w ?? 100} h={p.config.sizes[0]?.h ?? 100} /></div>
          <div className="grid lg:grid-cols-2 gap-3">
            {([["Config (sizes, materials, min qty) — JSON", cfg, setCfg], ["Pricing (base, setup, volume tiers) — JSON", pr, setPr]] as const).map(([label, v, set]) => (
              <label key={label}><span className="label">{label}</span><textarea className="field mono text-xs h-56" value={v} onChange={(e) => set(e.target.value)} spellCheck={false} /></label>))}
          </div>
          <div className="flex items-center gap-3"><button className="btn !py-1.5 !px-3 text-sm" onClick={save}>Save</button><span className="text-sm">{msg}</span></div>
        </div>
      )}
    </div>
  );
}
