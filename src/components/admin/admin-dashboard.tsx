"use client";

import Link from "next/link";
import { logout } from "@/app/admin/actions";
import type { StorageKind } from "@/lib/catalog-store";
import type { CatalogSummary } from "@/lib/catalog-summary";
import type { CatalogVersion, SavedMapping } from "@/lib/types";
import { Button, buttonVariants } from "../ui/button";
import { ArrowUpRightIcon, LogOutIcon } from "../ui/icons";
import { Container } from "../ui/primitives";
import { CatalogSidebar } from "./catalog-sidebar";
import { ImportWizard } from "./import-wizard";
import { Notice } from "./notice";

export function AdminDashboard({
  summary,
  versions,
  savedMapping,
  storage,
  storageError,
}: {
  summary: CatalogSummary | null;
  versions: CatalogVersion[];
  savedMapping: SavedMapping;
  storage: StorageKind;
  storageError: string | null;
}) {
  return (
    <Container className="py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Catalog admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Import products</h1>
          <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
            Upload the Excel export from inRiver, check how each column is used, and publish. The website then shows exactly the products in
            your file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog" className={buttonVariants({ variant: "outline" })}>
            View catalog <ArrowUpRightIcon size={16} />
          </Link>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              <LogOutIcon size={16} /> Sign out
            </Button>
          </form>
        </div>
      </header>

      {storage === "unavailable" && (
        <Notice tone="danger" title="This deployment has no storage" className="mt-8">
          <p>
            Publishing needs a Vercel Blob store (no database). In Vercel open this project’s <strong>Storage</strong> page →{" "}
            <strong>Create Storage</strong> → <strong>Blob</strong> → <strong>Private</strong>, leave the variable prefix empty, then redeploy.
          </p>
          <p className="mt-2">
            Already connected a store? Then this deployment is older than the connection: open <strong>Deployments</strong> → ⋯ →{" "}
            <strong>Redeploy</strong>, wait for <strong>Ready</strong> and reload this page.
          </p>
        </Notice>
      )}
      {storageError && (
        <Notice tone="danger" title="The current catalog could not be read" className="mt-8">
          {storageError}
        </Notice>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ImportWizard savedMapping={savedMapping} liveProducts={summary?.products ?? 0} canPublish={storage !== "unavailable"} />
        <CatalogSidebar summary={summary} versions={versions} storage={storage} />
      </div>
    </Container>
  );
}
