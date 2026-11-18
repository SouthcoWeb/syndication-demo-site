"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearCatalog, restoreCatalog, type ActionResult } from "@/app/admin/actions";
import type { StorageKind } from "@/lib/catalog-store";
import type { CatalogSummary } from "@/lib/catalog-summary";
import { formatNumber, plural } from "@/lib/format";
import type { CatalogVersion } from "@/lib/types";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { HistoryIcon, LayersIcon, LoaderIcon, SheetIcon, TrashIcon } from "../ui/icons";
import { LocalTime } from "./local-time";
import { Notice } from "./notice";

type Pending = { kind: "restore"; version: CatalogVersion } | { kind: "clear" } | null;

/** Live catalog facts, import history with restore, and removing every product. */
export function CatalogSidebar({ summary, versions, storage }: { summary: CatalogSummary | null; versions: CatalogVersion[]; storage: StorageKind }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, startTransition] = useTransition();

  const run = () => {
    const pending = confirm;
    if (!pending) return;
    startTransition(async () => {
      const outcome = pending.kind === "restore" ? await restoreCatalog(pending.version.id) : await clearCatalog();
      setResult(outcome);
      setConfirm(null);
      router.refresh();
    });
  };

  const facts: Array<[string, string]> = summary
    ? [
        ["Categories", formatNumber(summary.categories, 0)],
        ["Families", formatNumber(summary.families, 0)],
        ["With images", `${formatNumber(summary.withImages, 0)} of ${formatNumber(summary.products, 0)}`],
        ["With prices", summary.withPrices ? formatNumber(summary.withPrices, 0) : "None (quote only)"],
        ["With compatible parts", formatNumber(summary.withCompatible, 0)],
      ]
    : [];

  return (
    <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-height)+24px)]">
      <section className="rounded-3xl border bg-card p-6" aria-labelledby="live-catalog">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <LayersIcon size={19} />
          </span>
          <div>
            <h2 id="live-catalog" className="text-sm font-semibold text-foreground">
              Live catalog
            </h2>
            <p className="text-xs text-muted-foreground">{storage === "blob" ? "Stored in Vercel Blob" : storage === "file" ? "Stored on this server (.data folder)" : "No storage connected"}</p>
          </div>
        </div>
        {summary && summary.products > 0 ? (
          <>
            <p className="mt-5 text-4xl font-semibold tracking-tight tabular-nums text-foreground">{formatNumber(summary.products, 0)}</p>
            <p className="text-sm text-muted-foreground">products on the website</p>
            <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              <SheetIcon size={15} className="mt-px shrink-0" />
              <span>
                {summary.restoredFrom ? "Restored version" : (summary.fileName ?? "Import")}
                {summary.sheet ? ` › ${summary.sheet}` : ""} · <LocalTime iso={summary.importedAt} />
              </span>
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">No products are published yet. Import your first file to fill the website.</p>
        )}
      </section>

      {result && (
        <Notice tone={result.ok ? "success" : "danger"} title={result.ok ? result.message : "Something went wrong"}>
          {!result.ok && result.error}
        </Notice>
      )}

      {versions.length > 0 && (
        <section className="rounded-3xl border bg-card p-6" aria-labelledby="import-history">
          <h2 id="import-history" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <HistoryIcon size={16} className="text-muted-foreground" /> Import history
          </h2>
          <ol className="mt-4 space-y-3">
            {versions.map((version, i) => (
              <li key={version.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground" title={version.fileName ?? undefined}>
                    {version.restoredFrom ? "Restored version" : (version.fileName ?? (version.products ? "Import" : "All products removed"))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {plural(version.products, "product")} · <LocalTime iso={version.importedAt} />
                  </p>
                </div>
                {i === 0 ? (
                  <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-foreground">Live</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "restore", version })}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {summary && summary.products > 0 && (
        <section className="rounded-3xl border border-danger/25 p-6" aria-labelledby="remove-all">
          <h2 id="remove-all" className="text-sm font-semibold text-foreground">
            Remove all products
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Takes every product off the website. You can restore it from the history.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setConfirm({ kind: "clear" })}>
            <TrashIcon size={15} className="text-danger" /> Remove all
          </Button>
        </section>
      )}

      <Dialog open={confirm !== null} onClose={() => !busy && setConfirm(null)} label="Confirm" width="28rem">
        <div className="rounded-3xl border bg-background p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-foreground">{confirm?.kind === "clear" ? "Remove all products?" : "Restore this version?"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {confirm?.kind === "clear"
              ? "The website will show no products until you import or restore a catalog."
              : confirm?.kind === "restore"
                ? `The website will show the ${plural(confirm.version.products, "product")} of this version. The current catalog stays in the history.`
                : null}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={confirm?.kind === "clear" ? "ink" : "primary"} onClick={run} disabled={busy}>
              {busy && <LoaderIcon size={16} className="animate-spin" />}
              {confirm?.kind === "clear" ? "Remove all" : "Restore"}
            </Button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
