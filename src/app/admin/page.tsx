import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminSetup } from "@/components/admin/admin-setup";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { listVersions, readCatalog, storageKind } from "@/lib/catalog-store";
import { summarizeCatalog, type CatalogSummary } from "@/lib/catalog-summary";
import type { CatalogVersion, SavedMapping } from "@/lib/types";

export const metadata: Metadata = {
  title: "Import products",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) return <AdminSetup />;
  if (!(await isAdmin())) return <AdminLogin />;

  let summary: CatalogSummary | null = null;
  let versions: CatalogVersion[] = [];
  let savedMapping: SavedMapping = {};
  let storageError: string | null = null;
  try {
    // Read straight from storage (not the site cache) so the dashboard is always current.
    const [current, history] = await Promise.all([readCatalog(), listVersions()]);
    if (current) {
      summary = summarizeCatalog(current);
      savedMapping = current.mapping;
    }
    versions = history;
  } catch (error) {
    console.error("Admin could not read the catalog", error);
    storageError = error instanceof Error ? error.message : String(error);
  }

  return (
    <AdminDashboard summary={summary} versions={versions} savedMapping={savedMapping} storage={storageKind()} storageError={storageError} />
  );
}
