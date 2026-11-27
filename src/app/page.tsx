import Link from "next/link";
import { CATALOG } from "@/lib/catalog";
import { money, quote } from "@/lib/pricing";
import { applyRow, docFromTemplate, docToSvg } from "@/lib/design";

// Hero pieces are rendered by the real print engine from the real templates.
const sample = (slug: string, row: Record<string, string>) => {
  const p = CATALOG.find((c) => c.slug === slug)!, s = p.config.sizes[0];
  return docToSvg(applyRow(docFromTemplate(p.template, s.w, s.h, 0), row), { bleed: false });
};
const HERO = [
  { svg: sample("race-numbers", { number: "4821", name: "A. RUNNER" }), cls: "left-0 top-8 w-60 -rotate-6" },
  { svg: sample("trophies", { title: "CHAMPION", recipient: "Sam Taylor" }), cls: "left-24 top-48 w-56 rotate-3" },
  { svg: sample("mtb-boards", { number: "23" }), cls: "left-[200px] top-0 w-44 rotate-6" },
];
const STEPS = ["Configure & see the price", "Design inside the print area", "Approve your proof", "We print & ship"];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 grid lg:grid-cols-[1fr_380px] gap-8 items-center">
        <div>
        <p className="mono text-xs uppercase tracking-widest text-muted rise">Six print divisions · one platform</p>
        <h1 className="display text-5xl sm:text-7xl font-bold leading-[0.95] mt-3 max-w-3xl rise">
          Design it. Proof it. <span className="text-accent">We print it.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted rise">
          Instant prices, an in-browser designer locked to the print area, and production files generated the moment you approve.
        </p>
        <Link href="#products" className="btn mt-7 rise">Start an order →</Link>
        </div>
        <div className="relative hidden lg:block h-80" aria-hidden>
          {HERO.map((h, i) => (
            <div key={i} className={`absolute panel p-2 shadow-[5px_5px_0_var(--ink)] rise ${h.cls}`} style={{ animationDelay: `${i * 120 + 200}ms` }}
              dangerouslySetInnerHTML={{ __html: h.svg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ') }} />
          ))}
        </div>
      </section>
      <ol className="mx-auto max-w-6xl px-4 mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STEPS.map((t, i) => <li key={t} className="mono text-xs border-t-2 border-ink pt-2"><span className="text-accent font-bold">0{i + 1}</span> {t}</li>)}
      </ol>

      <section id="products" className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATALOG.map((p, i) => {
            const s = p.config.sizes[0];
            const from = quote(p.pricing, { w_mm: s.w, h_mm: s.h, material_mult: p.config.materials[0].mult, qty: p.config.min_qty });
            return (
              <Link key={p.slug} href={`/products/${p.slug}`} style={{ animationDelay: `${i * 60}ms` }}
                className="panel rise group p-5 flex flex-col justify-between min-h-44 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink)] transition">
                <div>
                  <span className="inline-block w-8 h-1.5 mb-4" style={{ background: p.accent }} />
                  <h2 className="display text-2xl font-bold group-hover:text-accent transition-colors">{p.name}</h2>
                  <p className="text-sm text-muted mt-1">{p.blurb}</p>
                </div>
                <p className="mono text-xs mt-4">From {money(from.unit_gross)} each · min {p.config.min_qty}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
