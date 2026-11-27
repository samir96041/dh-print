"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, Textbox, FabricImage, Rect, type FabricObject } from "fabric";
import type { Product } from "@/lib/catalog";
import { docFromTemplate, fitFont, PT, type DesignDoc, type DObj } from "@/lib/design";

const FONTS = ["DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono"]; // the exact fonts the print engine renders with
const loadFonts = () => Promise.all(FONTS.flatMap((f) => ["400", "700"].map((w) => document.fonts.load(`${w} 16px "${f}"`))));
type Cfg = { w: number; h: number; qty: number; [k: string]: unknown };
type Meta = { name?: string; minFont: number; maxFont: number; variable?: boolean; placeholder: boolean; boxH?: number /* px */ };
type Obj = FabricObject & { meta?: Meta; good?: Record<string, number> };

export default function Designer({ product, revision }: { product: Product; revision?: { itemId: string; doc: DesignDoc } }) {
  const router = useRouter();
  const el = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<Canvas | null>(null);
  const ppm = useRef(1);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [sel, setSel] = useState<Obj | null>(null);
  const [fields, setFields] = useState<{ name: string; text: string }[]>([]);
  const [scale, setScale] = useState(1); // mirror of ppm for render
  const [upload, setUpload] = useState<{ path: string; name: string } | null>(revision?.doc.upload ?? null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [, tick] = useState(0);

  useEffect(() => {
    let v: Cfg | null = null;
    if (revision) v = { w: revision.doc.w_mm, h: revision.doc.h_mm, qty: 0 };
    else {
      const raw = sessionStorage.getItem(`cfg:${product.slug}`);
      if (!raw) { router.replace(`/products/${product.slug}`); return; }
      v = JSON.parse(raw);
    }
    loadFonts().then(() => setCfg(v)); // fonts must be ready before text is measured/fitted
  }, [product.slug, router, revision]);

  // ---- bounds: keep every object inside the safe print area; unprintable artwork cannot be created
  const safeRect = () => { const s = product.template.safe_mm * ppm.current; const c = cv.current!; return { l: s, t: s, r: c.getWidth() - s, b: c.getHeight() - s }; };
  const remember = (o: Obj) => { o.good = { left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY, angle: o.angle, width: o.width, fontSize: (o as Textbox).fontSize ?? 0 }; };
  const enforce = useCallback((o: Obj) => {
    o.setCoords();
    const r = o.getBoundingRect(), s = safeRect();
    if (r.width > s.r - s.l + 0.5 || r.height > s.b - s.t + 0.5) { // cannot fit: revert to last valid geometry
      if (o.good) o.set(o.good); o.setCoords(); return;
    }
    let dx = 0, dy = 0;
    if (r.left < s.l) dx = s.l - r.left; else if (r.left + r.width > s.r) dx = s.r - (r.left + r.width);
    if (r.top < s.t) dy = s.t - r.top; else if (r.top + r.height > s.b) dy = s.b - (r.top + r.height);
    if (dx || dy) { o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refit = (t: Textbox & Obj) => {
    if (!t.meta?.placeholder) return;
    const hMm = (t.meta.boxH ?? t.height) / ppm.current;
    const pt = fitFont(t.text ?? "", t.width / ppm.current, hMm, { minFont: t.meta.minFont, maxFont: t.meta.maxFont, tracking: t.charSpacing ?? 0 });
    t.set({ fontSize: pt * PT * ppm.current });
  };

  const build = useCallback((doc: DesignDoc) => {
    const c = cv.current!; c.clear(); c.backgroundColor = doc.bg;
    const p = ppm.current, s = doc.safe_mm * p;
    const guide = new Rect({ left: s, top: s, width: c.getWidth() - 2 * s, height: c.getHeight() - 2 * s, fill: "transparent",
      stroke: "#ff5a1f", strokeDashArray: [6, 4], selectable: false, evented: false, excludeFromExport: true });
    c.add(guide);
    doc.objects.forEach((d) => addObj(d));
    function addObj(d: DObj) {
      const common = { left: (d.x + d.w / 2) * p, top: (d.y + d.h / 2) * p, originX: "center" as const, originY: "center" as const, angle: d.rotation };
      if (d.kind === "text") {
        const t = new Textbox(d.text, { ...common, width: d.w * p, fontFamily: d.font, fontWeight: d.bold ? "bold" : "normal", fill: d.color, fontSize: d.size * PT * p,
          charSpacing: d.tracking, textAlign: d.align, lockUniScaling: true, lockScalingFlip: true, splitByGrapheme: false }) as Textbox & Obj;
        t.meta = { name: d.name, minFont: d.minFont, maxFont: d.maxFont, variable: d.variable, placeholder: !!d.name, boxH: d.name ? d.h * p : undefined };
        c.add(t); remember(t);
      } else {
        FabricImage.fromURL(d.href).then((img) => {
          img.set({ ...common, scaleX: (d.w * p) / img.width, scaleY: (d.h * p) / img.height, lockScalingFlip: true });
          (img as Obj).meta = { minFont: 0, maxFont: 0, placeholder: false }; c.add(img); remember(img as Obj); c.requestRenderAll();
        });
      }
    }
    c.requestRenderAll();
  }, []);

  const syncFields = () => {
    const c = cv.current!; setFields(c.getObjects().filter((o): o is Textbox & Obj => (o as Obj).meta?.placeholder === true).map((o) => ({ name: (o as Obj).meta!.name!, text: (o as Textbox).text })));
  };

  // ---- init canvas once the config is known
  useEffect(() => {
    if (!cfg || !el.current || !box.current) return;
    const avail = Math.min(box.current.clientWidth, 720);
    ppm.current = Math.min(avail / cfg.w, 460 / cfg.h); setScale(ppm.current);
    const c = new Canvas(el.current, { width: cfg.w * ppm.current, height: cfg.h * ppm.current, preserveObjectStacking: true, selection: false });
    cv.current = c;
    const draft = revision ? null : sessionStorage.getItem(`draft:${product.slug}`);
    const doc: DesignDoc = revision ? revision.doc : draft ? JSON.parse(draft) : docFromTemplate(product.template, cfg.w, cfg.h, product.bleed_mm);
    build(doc); syncFields();
    c.on("selection:created", (e) => setSel((e.selected?.[0] as Obj) ?? null));
    c.on("selection:updated", (e) => setSel((e.selected?.[0] as Obj) ?? null));
    c.on("selection:cleared", () => setSel(null));
    c.on("object:moving", (e) => { enforce(e.target as Obj); });
    c.on("object:scaling", (e) => { enforce(e.target as Obj); });
    c.on("object:rotating", (e) => { enforce(e.target as Obj); });
    c.on("object:modified", (e) => {
      const o = e.target as Obj;
      if (o instanceof Textbox && (o.scaleX !== 1)) { // fold scale into font size + width so text stays editable
        o.set({ fontSize: o.fontSize * o.scaleX, width: o.width * o.scaleX, scaleX: 1, scaleY: 1 });
        const m = (o as Obj).meta; if (m?.placeholder) { m.maxFont = Math.max(m.maxFont, (o.fontSize / ppm.current) / PT); m.boxH = o.height; }
      }
      enforce(o); remember(o); tick((n) => n + 1);
    });
    c.on("text:changed", (e) => { const t = e.target as unknown as Textbox & Obj; refit(t); enforce(t); c.requestRenderAll(); syncFields(); });
    return () => { c.dispose(); cv.current = null; };
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions
  const add = (o: FabricObject) => { const c = cv.current!; c.add(o); c.setActiveObject(o); remember(o as Obj); enforce(o as Obj); c.requestRenderAll(); };
  const addText = () => {
    const c = cv.current!;
    const t = new Textbox("New text", { left: c.getWidth() / 2, top: c.getHeight() / 2, originX: "center", originY: "center", width: c.getWidth() * 0.5,
      fontFamily: "DejaVu Sans", fontSize: 8 * ppm.current, fill: "#111111", textAlign: "center", lockUniScaling: true }) as Textbox & Obj;
    t.meta = { minFont: 6, maxFont: 120, placeholder: false }; add(t);
  };
  const addImage = async (file: File) => {
    setErr("");
    if (!/^image\/(png|jpe?g|svg\+xml)$/.test(file.type)) return setErr("Logos must be PNG, JPG or SVG. For PDF/AI files use “Upload finished artwork” at checkout.");
    if (file.size > 4_000_000) return setErr("Image must be under 4 MB.");
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
    const img = await FabricImage.fromURL(url), c = cv.current!;
    const k = Math.min((c.getWidth() * 0.4) / img.width, (c.getHeight() * 0.4) / img.height);
    img.set({ left: c.getWidth() / 2, top: c.getHeight() / 2, originX: "center", originY: "center", scaleX: k, scaleY: k, lockScalingFlip: true });
    (img as Obj).meta = { minFont: 0, maxFont: 0, placeholder: false }; (img as Obj & { _href?: string })._href = url; add(img);
  };
  /** Finished artwork: PNG/JPG/SVG are placed on the canvas; PDF/AI are uploaded and printed from the original file. */
  const artwork = async (file: File) => {
    setErr("");
    if (/\.(png|jpe?g|svg)$/i.test(file.name)) return addImage(file);
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    setBusy(false);
    if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(`/design/${product.slug}`)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "Upload failed");
    setUpload(j);
  };
  const del = () => { const c = cv.current!, o = c.getActiveObject() as Obj | undefined; if (o && !o.meta?.placeholder) { c.remove(o); c.discardActiveObject(); c.requestRenderAll(); } };
  const setField = (name: string, text: string) => {
    const c = cv.current!; const t = c.getObjects().find((o) => (o as Obj).meta?.name === name) as (Textbox & Obj) | undefined;
    if (!t) return; t.set({ text }); refit(t); enforce(t); c.requestRenderAll(); syncFields();
  };
  const setProp = (p: Partial<Textbox>) => { sel?.set(p as never); cv.current?.requestRenderAll(); tick((n) => n + 1); if (sel) enforce(sel); };

  // ---- serialise canvas -> DesignDoc (mm)
  const toDoc = (): DesignDoc => {
    const c = cv.current!, p = ppm.current;
    const objects: DObj[] = [];
    c.getObjects().forEach((o) => {
      const ob = o as Obj; if (!ob.meta) return;
      const w = o.getScaledWidth() / p, hh = ob.meta.placeholder && ob.meta.boxH ? ob.meta.boxH / p : o.getScaledHeight() / p;
      const x = o.left / p - w / 2, y = o.top / p - hh / 2;
      if (o instanceof Textbox) objects.push({ kind: "text", name: ob.meta.name, text: o.text, x, y, w, h: hh, font: o.fontFamily, bold: o.fontWeight === "bold" || Number(o.fontWeight) >= 600, color: String(o.fill),
        size: (o.fontSize / p) / PT, minFont: ob.meta.minFont || 6, maxFont: ob.meta.maxFont || 120, tracking: o.charSpacing ?? 0, align: (o.textAlign as "center" | "left") ?? "center",
        rotation: o.angle, variable: ob.meta.variable });
      else objects.push({ kind: "image", href: (o as Obj & { _href?: string })._href ?? (o as FabricImage).getSrc(), x, y, w, h: hh, rotation: o.angle });
    });
    return { w_mm: cfg!.w, h_mm: cfg!.h, bleed_mm: product.bleed_mm, safe_mm: product.template.safe_mm, bg: String(c.backgroundColor || "#ffffff"), objects };
  };

  async function save() {
    setBusy(true); setErr("");
    const doc = toDoc();
    if (upload) { doc.objects = []; doc.upload = upload; }
    if (revision) { // new proof version for an existing order
      const r = await fetch("/api/proofs/revise", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: revision.itemId, doc }) });
      setBusy(false);
      if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Could not submit revision");
      const { orderId } = await r.json(); router.push(`/orders/${orderId}`); return;
    }
    sessionStorage.setItem(`draft:${product.slug}`, JSON.stringify(doc));
    const r = await fetch("/api/designs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: product.slug, doc, config: cfg }) });
    setBusy(false);
    if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(`/design/${product.slug}`)}`);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Could not save design");
    const { id } = await r.json();
    router.push(`/checkout?design=${id}`);
  }

  const txt = sel instanceof Textbox ? sel : null;
  const pt = txt ? Math.round(txt.fontSize / scale / PT) : 0;
  if (!cfg) return <p className="p-8">Loading…</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 grid lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <h1 className="display text-3xl font-bold">{product.name} designer</h1>
        <p className="text-sm text-muted mb-3">{cfg.w} × {cfg.h} mm · artwork is locked inside the dashed safe area.</p>
        <div ref={box} className="panel p-3 overflow-auto bg-[repeating-conic-gradient(#ece8dc_0%_25%,#f4f1ea_0%_50%)] bg-[length:16px_16px]">
          <div className="inline-block shadow-[4px_4px_0_var(--ink)] border border-ink"><canvas ref={el} /></div>
        </div>
      </div>
      <aside className="space-y-4">
        {fields.length > 0 && (
          <div className="panel p-4 space-y-3">
            <span className="label">Template fields</span>
            {fields.map((f) => (
              <label key={f.name} className="block"><span className="text-xs capitalize">{f.name}</span>
                <input className="field" value={f.text} onChange={(e) => setField(f.name, e.target.value)} /></label>
            ))}
            {product.supports_csv && <p className="text-xs text-muted">Ordering many numbers? Upload a CSV at checkout and we merge one file per row.</p>}
          </div>
        )}
        <div className="panel p-4 space-y-3">
          <span className="label">Add</span>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost !px-3 !py-2 text-sm" onClick={addText}>+ Text</button>
            <label className="btn btn-ghost !px-3 !py-2 text-sm">+ Logo<input type="file" hidden accept="image/png,image/jpeg,image/svg+xml" onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])} /></label>
            <button className="btn btn-ghost !px-3 !py-2 text-sm" onClick={del} disabled={!sel || (sel as Obj).meta?.placeholder}>Delete</button>
          </div>
        </div>
        <div className="panel p-4 space-y-2">
          <span className="label">Have finished artwork?</span>
          {upload ? (
            <p className="text-sm">✓ <b>{upload.name}</b> will be printed as supplied. <button className="underline" onClick={() => setUpload(null)}>Remove</button></p>
          ) : (
            <label className="btn btn-ghost !px-3 !py-2 text-sm">Upload PDF / AI / SVG / PNG<input type="file" hidden accept=".pdf,.ai,.svg,.png,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && artwork(e.target.files[0])} /></label>
          )}
          <p className="text-xs text-muted">PDF/AI are printed from your original file; the proof shows a file card. PNG/SVG are placed on the canvas.</p>
        </div>
        {txt && (
          <div className="panel p-4 space-y-3">
            <span className="label">Selected text</span>
            <select className="field" value={txt.fontFamily} onChange={(e) => setProp({ fontFamily: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
            <div className="flex items-center gap-3">
              <button type="button" aria-pressed={txt.fontWeight === "bold"} className={`h-10 w-10 border-2 border-ink font-bold ${txt.fontWeight === "bold" ? "bg-ink text-paper" : "bg-card"}`}
                onClick={() => setProp({ fontWeight: txt.fontWeight === "bold" ? "normal" : "bold" })}>B</button>
              <input type="color" aria-label="Colour" value={String(txt.fill)} onChange={(e) => setProp({ fill: e.target.value })} className="h-10 w-14 border-2 border-ink" />
              <input type="range" aria-label="Font size" className="flex-1 accent-[var(--accent)]"
                min={(sel as Obj).meta?.minFont || 6} max={(sel as Obj).meta?.maxFont || 120}
                value={pt} onChange={(e) => setProp({ fontSize: +e.target.value * PT * scale })} />
            </div>
            <p className="mono text-xs text-muted">{pt} pt · drag the corner to resize, top handle to rotate</p>
          </div>
        )}
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <button className="btn w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : revision ? "Submit new proof version →" : "Save & continue to checkout →"}</button>
      </aside>
    </div>
  );
}
