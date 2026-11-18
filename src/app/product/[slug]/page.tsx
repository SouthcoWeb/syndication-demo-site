import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyProductView } from "@/components/product/legacy-product-view";
import { getProductPageData } from "@/lib/catalog-core";
import { getCatalog, getFullCatalog } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { productHref } from "@/lib/product";

type Props = { params: Promise<{ slug: string }> };

/** Re-rendered when a new catalog is published (and at most every 5 minutes as a safety net). */
export const revalidate = 300;

/** Products of the catalog published at build time; products imported later render on first visit. */
export async function generateStaticParams() {
  try {
    return (await getCatalog()).products.map((product) => ({ slug: product.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getCatalog()).bySlug.get(slug);
  if (!product) return {};
  return pageMetadata({
    title: `${product.sku} · ${product.name}`,
    description: product.title,
    path: productHref(product.slug),
    ogTitle: `${product.sku} — ${product.name}`,
    images: product.images.slice(0, 1).map((image) => ({ url: image.src, alt: image.alt })),
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [catalog, fullCatalog] = await Promise.all([getCatalog(), getFullCatalog()]);
  const product = catalog.bySlug.get(slug);
  const fullProduct = fullCatalog.bySlug.get(slug);
  if (!product || !fullProduct) notFound();
  return <LegacyProductView data={getProductPageData(catalog, product)} full={getProductPageData(fullCatalog, fullProduct)} />;
}
