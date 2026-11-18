import { cache } from "react";
import { unstable_cache } from "next/cache";
import { buildCatalog, type Catalog } from "./catalog-core";
import { EMPTY_CATALOG, readCatalog } from "./catalog-store";
import { toLegacyProduct } from "./legacy";
import type { StoredCatalog } from "./types";

/**
 * Server-only data access. The published catalog is read from storage once and then
 * served from the Next.js data cache until the next import expires the "catalog" tag
 * (or, as a safety net, after CATALOG_REVALIDATE seconds).
 * Never import this file from a "use client" component.
 */

export const CATALOG_TAG = "catalog";
export const CATALOG_REVALIDATE = 300;

const loadPublished = unstable_cache(async (): Promise<StoredCatalog> => (await readCatalog()) ?? EMPTY_CATALOG, ["published-catalog-v1"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_REVALIDATE,
});

/**
 * The published catalog as stored (one storage read per request at most).
 * A storage problem during `next build` must not fail the deployment: pages then start empty and
 * refresh on the next publish or after CATALOG_REVALIDATE. At runtime errors still surface, so a
 * failed refresh keeps serving the previous pages.
 */
export const getStoredCatalog = cache(async (): Promise<StoredCatalog> => {
  try {
    return await loadPublished();
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error;
    console.error("Could not read the published catalog during the build; pages start empty.", error);
    return EMPTY_CATALOG;
  }
});

/** The catalog as the legacy site shows it: every product reduced to the legacy fields. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const stored = await getStoredCatalog();
  return buildCatalog(stored.products.map(toLegacyProduct), stored.categories);
});

/** The full imported catalog (everything in the export), used to show what the legacy site leaves out. */
export const getFullCatalog = cache(async (): Promise<Catalog> => {
  const stored = await getStoredCatalog();
  return buildCatalog(stored.products, stored.categories);
});
