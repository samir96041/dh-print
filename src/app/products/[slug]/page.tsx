import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import Configurator from "./Configurator";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <p className="mono text-xs uppercase tracking-widest text-muted">Configure</p>
      <h1 className="display text-4xl sm:text-5xl font-bold mt-1">{product.name}</h1>
      <p className="text-muted mt-2 mb-8">{product.blurb}</p>
      <Configurator product={product} />
    </div>
  );
}
