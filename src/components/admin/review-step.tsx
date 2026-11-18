"use client";

import { useState } from "react";
import type { ImportResult } from "@/lib/import/normalize";
import { formatNumber, formatPrice, plural } from "@/lib/format";
import { Button } from "../ui/button";
import { AlertIcon, ArrowLeftIcon, LoaderIcon, UploadIcon } from "../ui/icons";
import { ProductImage } from "../ui/product-image";
import { Notice } from "./notice";

const PREVIEW = 8;

function rowsText(rows: number[] | undefined, total: number): string {
  if (!rows?.length) return "";
  const more = total > rows.length ? ` and ${formatNumber(total - rows.length, 0)} more` : "";
  return ` Row${rows.length > 1 ? "s" : ""} ${rows.join(", ")}${more}.`;
}

export function ReviewStep({
  result,
  onBack,
  onPublish,
  publishing,
  canPublish,
}: {
  result: ImportResult;
  onBack: () => void;
  onPublish: () => void;
  publishing: null | "videos" | "saving";
  canPublish: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const { products, stats } = result;
  const errors = result.issues.filter((i) => i.level === "error");
  const warnings = result.issues.filter((i) => i.level === "warning");
  const share = (n: number) => (stats.products ? `${formatNumber(n, 0)} of ${formatNumber(stats.products, 0)}` : "0");

  const tiles: Array<[string, string]> = [
    ["Products", formatNumber(stats.products, 0)],
    ["With images", share(stats.withImages)],
    ["With videos", formatNumber(stats.withVideos, 0)],
    ["With documents", formatNumber(stats.withDocuments, 0)],
    ["Related links", formatNumber(stats.relatedLinks, 0)],
    ["Compatible links", formatNumber(stats.compatibleLinks, 0)],
    ["Prices", stats.withPrices ? share(stats.withPrices) : "None · quote only"],
    ["Specification columns", formatNumber(stats.specColumns, 0)],
  ];

  return (
    <div>
      {errors.map((e) => (
        <Notice key={e.message} tone="danger" title={e.message} className="mb-3" />
      ))}

      {warnings.length > 0 ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertIcon size={17} className="text-warning" /> {plural(warnings.length, "thing")} to check before publishing
          </p>
          <ul className="mt-2.5 space-y-1.5 pl-6 text-sm leading-relaxed text-foreground/80">
            {warnings.map((w) => (
              <li key={w.message} className="list-disc">
                {w.message}
                <span className="text-muted-foreground">{rowsText(w.rows, w.count ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !errors.length && <Notice tone="success" title="Everything looks good" />
      )}

      <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-subtle px-3.5 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 text-sm font-semibold text-foreground">Preview</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {products.slice(0, PREVIEW).map((p) => (
          <div key={p.sku} className="min-w-0 rounded-2xl border bg-card p-2">
            <ProductImage src={p.images[0]?.src ?? null} alt="" sizes="200px" className="aspect-square rounded-xl" imageClassName="p-3" />
            <div className="px-1.5 pb-1 pt-2.5">
              <p className="truncate font-mono text-xs font-semibold text-foreground">{p.sku}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{p.name}</p>
              <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={p.category.join(" › ")}>
                {p.category.join(" › ")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {products.length > 0 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-4 text-sm font-medium text-primary hover:underline" aria-expanded={showAll}>
          {showAll ? "Hide the product table" : `Show all ${formatNumber(products.length, 0)} products as a table`}
        </button>
      )}
      {showAll && (
        <div className="mt-3 max-h-[28rem] overflow-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="sticky top-0 bg-subtle text-xs text-muted-foreground">
              <tr>
                {["Part number", "Name", "Category", "Images", "Specs", "Related", "Compatible", "Price"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.sku}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-foreground">{p.sku}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-foreground" title={p.title}>
                    {p.name}
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-muted-foreground">{p.category.join(" › ")}</td>
                  <td className="px-3 py-2 tabular-nums">{p.images.length}</td>
                  <td className="px-3 py-2 tabular-nums">{p.specs.length}</td>
                  <td className="px-3 py-2 tabular-nums">{p.related.length}</td>
                  <td className="px-3 py-2 tabular-nums">{p.compatible.length}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{p.price != null ? formatPrice(p.price, p.currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Button variant="ghost" onClick={onBack} disabled={publishing !== null}>
          <ArrowLeftIcon size={16} /> Back to mapping
        </Button>
        <Button size="lg" onClick={onPublish} disabled={!canPublish || publishing !== null || !products.length}>
          {publishing ? <LoaderIcon size={18} className="animate-spin" /> : <UploadIcon size={18} />}
          {publishing === "videos" ? "Preparing videos…" : publishing === "saving" ? "Publishing…" : `Publish ${plural(products.length, "product")}`}
        </Button>
      </div>
    </div>
  );
}
