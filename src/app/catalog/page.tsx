import type { Metadata } from "next";
import { CatalogPageView } from "@/components/catalog/catalog-page-view";
import { EmptyCatalog } from "@/components/empty-catalog";
import { topCategories } from "@/lib/catalog-core";
import { getCatalog } from "@/lib/data";
import { buildIndex } from "@/lib/facets";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "All products",
  description: "Browse every product with live filters for specifications, materials, certifications and more.",
  path: "/catalog",
});

/** Re-rendered when a new catalog is published (and at most every 5 minutes as a safety net). */
export const revalidate = 300;

export default async function CatalogPage() {
  const catalog = await getCatalog();
  if (!catalog.products.length) return <EmptyCatalog />;
  return (
    <CatalogPageView
      title="All products"
      description="Browse our product range."
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Products", href: "/catalog" },
      ]}
      subcategories={topCategories(catalog).map((n) => ({ name: n.name, href: n.href, count: n.count, image: n.image }))}
      index={buildIndex(catalog.products)}
      explorerKey="all"
    />
  );
}
