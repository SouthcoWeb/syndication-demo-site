import { getCatalog } from "@/lib/data";

/**
 * Full product record (used by quick view and compare). Rendered per request from the
 * cached catalog, so it always matches the latest import.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = (await getCatalog()).bySlug.get(slug);
  if (!product) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(product);
}
