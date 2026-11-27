"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/catalog";
import { money, quote } from "@/lib/pricing";

/** Instant calculator: every change re-prices client-side using the same pure engine the server re-checks at checkout. */
export default function Configurator({ product }: { product: Product }) {
  const { config, pricing } = product;
  const router = useRouter();
  const [sizeId, setSizeId] = useState(config.sizes[0].id);
  const [custom, setCustom] = useState({ w: 100, h: 100 });
  const [materialId, setMaterialId] = useState(config.materials[0].id);
  const [orientation, setOrientation] = useState(config.orientations[0]);
  const [qty, setQty] = useState(config.min_qty);

  const isCustom = sizeId === "custom";
  const size = config.sizes.find((s) => s.id === sizeId);
  const material = config.materials.find((m) => m.id === materialId)!;
  const dims = useMemo(() => {
    let w = isCustom ? custom.w : size!.w, h = isCustom ? custom.h : size!.h;
    if (orientation === "portrait" && w > h) [w, h] = [h, w];
    return { w, h };
  }, [isCustom, custom, size, orientation]);

  const c = config.custom;
  const customErr = isCustom && c && (custom.w < c.min_w || custom.w > c.max_w || custom.h < c.min_h || custom.h > c.max_h)
    ? `Size must be ${c.min_w}–${c.max_w} × ${c.min_h}–${c.max_h} mm` : null;
  const qtyErr = !Number.isFinite(qty) || qty < config.min_qty ? `Minimum quantity is ${config.min_qty}` : null;
  const q = quote(pricing, { w_mm: dims.w, h_mm: dims.h, material_mult: material.mult, qty: qtyErr ? config.min_qty : qty });
  const nextTier = pricing.tiers.filter((t) => t.min > q.qty).sort((a, b) => a.min - b.min)[0];

  function design() {
    const sel = { size: isCustom ? "custom" : sizeId, w: dims.w, h: dims.h, material: materialId, orientation, qty: q.qty };
    sessionStorage.setItem(`cfg:${product.slug}`, JSON.stringify(sel));
    router.push(`/design/${product.slug}`);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="panel p-5 space-y-6">
        <div>
          <span className="label">Size</span>
          <div className="flex flex-wrap gap-2">
            {config.sizes.map((s) => <Chip key={s.id} on={sizeId === s.id} onClick={() => setSizeId(s.id)}>{s.label}</Chip>)}
            {c && <Chip on={isCustom} onClick={() => setSizeId("custom")}>Custom size</Chip>}
          </div>
          {isCustom && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label><span className="label">Width mm</span><input className="field" type="number" value={custom.w} onChange={(e) => setCustom({ ...custom, w: +e.target.value })} /></label>
              <label><span className="label">Height mm</span><input className="field" type="number" value={custom.h} onChange={(e) => setCustom({ ...custom, h: +e.target.value })} /></label>
              {customErr && <p className="col-span-2 text-sm text-red-700">{customErr}</p>}
            </div>
          )}
        </div>
        <div>
          <span className="label">Material</span>
          <div className="flex flex-wrap gap-2">{config.materials.map((m) => <Chip key={m.id} on={materialId === m.id} onClick={() => setMaterialId(m.id)}>{m.label}</Chip>)}</div>
        </div>
        {config.orientations.length > 1 && (
          <div>
            <span className="label">Orientation</span>
            <div className="flex gap-2">{config.orientations.map((o) => <Chip key={o} on={orientation === o} onClick={() => setOrientation(o)}><span className="capitalize">{o}</span></Chip>)}</div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="qty">Quantity</label>
          <input id="qty" className="field max-w-40" type="number" min={config.min_qty} value={qty || ""} onChange={(e) => setQty(Math.floor(+e.target.value))} />
          {qtyErr && <p className="text-sm text-red-700 mt-1">{qtyErr}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {pricing.tiers.map((t) => (
              <button key={t.min} onClick={() => setQty(t.min)} className={`mono text-xs border-[1.5px] border-ink px-2 py-1 ${q.qty >= t.min ? "bg-ink text-paper" : "bg-card"}`}>
                {t.min}+ → {Math.round(t.discount * 100)}% off
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="panel p-5 h-fit lg:sticky lg:top-20" aria-live="polite">
        <span className="label">Instant price</span>
        <p className="display text-5xl font-bold">{money(q.total)}</p>
        <p className="text-sm text-muted">inc. VAT · {money(q.unit_gross)} each{q.discount > 0 && ` · ${Math.round(q.discount * 100)}% volume discount applied`}</p>
        <dl className="mono text-xs mt-4 space-y-1 border-t border-line pt-3">
          <Row k={`${q.qty} × ${money(q.unit_net)}`} v={money(q.unit_net * q.qty)} />
          {pricing.setup_cents > 0 && <Row k="Setup" v={money(pricing.setup_cents)} />}
          <Row k="Subtotal" v={money(q.subtotal)} /><Row k="VAT 20%" v={money(q.vat)} />
        </dl>
        {nextTier && <p className="text-xs mt-3 bg-paper border border-line p-2">Order {nextTier.min - q.qty} more to get {Math.round(nextTier.discount * 100)}% off.</p>}
        <button className="btn w-full mt-4" disabled={!!customErr || !!qtyErr} onClick={design}>Design your artwork →</button>
      </aside>
    </div>
  );
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`px-3 py-2 text-sm border-[1.5px] border-ink transition ${on ? "bg-ink text-paper" : "bg-card hover:bg-paper"}`}>{children}</button>
);
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><dt>{k}</dt><dd>{v}</dd></div>;
