import { buildSearchIndex } from "@/lib/catalog-core";
import { getCatalog } from "@/lib/data";

/** Compact search index for the search palette, built from the latest published catalog. */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(buildSearchIndex(await getCatalog()));
}
