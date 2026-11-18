import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPageView } from "@/components/catalog/catalog-page-view";
import { categoryCrumbs, productsIn } from "@/lib/catalog-core";
import { getCatalog } from "@/lib/data";
import { buildIndex } from "@/lib/facets";
import { pageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ slug: string[] }> };

/** Re-rendered when a new catalog is published (and at most every 5 minutes as a safety net). */
export const revalidate = 300;

/** Categories of the catalog published at build time; categories imported later render on first visit. */
export async function generateStaticParams() {
  try {
    return Array.from((await getCatalog()).nodes.values()).map((node) => ({ slug: node.path }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const node = (await getCatalog()).nodes.get(slug.join("/"));
  if (!node) return {};
  return pageMetadata({
    title: node.names.length > 1 ? `${node.name} · ${node.names[node.names.length - 2]}` : node.name,
    description: node.description || `Browse ${node.count} ${node.name.toLowerCase()} with full specifications, CAD models and compatible accessories.`,
    path: node.href,
    ogTitle: node.name,
    images: node.image ? [{ url: node.image, alt: node.name }] : undefined,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const node = catalog.nodes.get(slug.join("/"));
  if (!node) notFound();

  return (
    <CatalogPageView
      title={node.name}
      description={node.description}
      breadcrumbs={[{ name: "Home", href: "/" }, { name: "Products", href: "/catalog" }, ...categoryCrumbs(node)]}
      subcategories={node.children.map((n) => ({ name: n.name, href: n.href, count: n.count, image: n.image }))}
      index={buildIndex(productsIn(catalog, node))}
      explorerKey={node.href}
    />
  );
}
