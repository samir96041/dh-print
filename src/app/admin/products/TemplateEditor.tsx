"use client";
import { useMemo } from "react";
import { applyRow, docFromTemplate, docToSvg } from "@/lib/design";
import type { Layout, TObject } from "@/lib/catalog";

const FONTS = ["DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono"];
const NEW: TObject = { type: "text", name: "field", text: "TEXT", x: 0.5, y: 0.5, w: 0.8, h: 0.3, font: "DejaVu Sans", minFont: 8, maxFont: 60, tracking: 0, variable: false, align: "center" };

/** Form-based template editor with live preview (placeholders, fitting rules). Positions are fractions of the safe print area. */
export default function TemplateEditor({ layout, onChange, w, h }: { layout: Layout; onChange: (l: Layout) => void; w: number; h: number }) {
  const svg = useMemo(() => docToSvg(applyRow(docFromTemplate(layout, w, h, 0), {}), { bleed: false }).replace("<svg ", '<svg style="width:100%;height:auto;display:block" '), [layout, w, h]);
  const set = (i: number, patch: Partial<TObject>) => onChange({ ...layout, objects: layout.objects.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const num = (i: number, k: keyof TObject, label: string, step = 0.05) => (
    <label className="block"><span className="text-[10px] uppercase text-muted">{label}</span>
      <input type="number" step={step} className="field !py-1 text-sm" value={layout.objects[i][k] as number} onChange={(e) => set(i, { [k]: +e.target.value } as Partial<TObject>)} /></label>
  );
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      <div className="space-y-3">
        <label className="block max-w-40"><span className="label">Safe margin (mm)</span>
          <input type="number" min={0} step={0.5} className="field" value={layout.safe_mm} onChange={(e) => onChange({ ...layout, safe_mm: +e.target.value })} /></label>
        {layout.objects.map((o, i) => (
          <div key={i} className="border border-line p-3 bg-paper space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="block"><span className="text-[10px] uppercase text-muted">Field name (CSV column)</span>
                <input className="field !py-1 text-sm" value={o.name} onChange={(e) => set(i, { name: e.target.value.trim().toLowerCase() })} /></label>
              <label className="block col-span-1 sm:col-span-2"><span className="text-[10px] uppercase text-muted">Default text</span>
                <input className="field !py-1 text-sm" value={o.text} onChange={(e) => set(i, { text: e.target.value })} /></label>
              <label className="block"><span className="text-[10px] uppercase text-muted">Font</span>
                <select className="field !py-1 text-sm" value={o.font} onChange={(e) => set(i, { font: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {num(i, "x", "Centre X")}{num(i, "y", "Centre Y")}{num(i, "w", "Width")}{num(i, "h", "Height")}
              {num(i, "minFont", "Min pt", 1)}{num(i, "maxFont", "Max pt", 1)}{num(i, "tracking", "Tracking", 10)}
            </div>
            <div className="flex flex-wrap gap-4 text-sm items-center">
              <label className="flex gap-1"><input type="checkbox" checked={!!o.bold} onChange={(e) => set(i, { bold: e.target.checked })} />Bold</label>
              <label className="flex gap-1"><input type="checkbox" checked={o.variable} onChange={(e) => set(i, { variable: e.target.checked })} />Variable (filled from CSV)</label>
              <button type="button" className="underline text-red-700 ml-auto" onClick={() => onChange({ ...layout, objects: layout.objects.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={() => onChange({ ...layout, objects: [...layout.objects, { ...NEW, name: `field${layout.objects.length + 1}` }] })}>+ Add placeholder</button>
      </div>
      <div>
        <span className="label">Live preview ({w} × {h} mm)</span>
        <div className="border border-ink bg-white" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-xs text-muted mt-2">Customers see these fields in the designer. “Variable” fields are replaced per row when a CSV is uploaded.</p>
      </div>
    </div>
  );
}
