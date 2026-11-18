"use client";

import { useState } from "react";
import { columnLetter, FIELD_BY_KEY, FIELDS, type ColumnInfo, type FieldDef, type FieldKey } from "@/lib/import/fields";
import type { ImportResult } from "@/lib/import/normalize";
import type { WorkbookData } from "@/lib/import/spreadsheet";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ArrowRightIcon, ResetIcon, SearchIcon } from "../ui/icons";
import { Chip } from "../ui/primitives";
import { Notice } from "./notice";

const GROUPS = Array.from(new Set(FIELDS.map((f) => f.group)));
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CNY", "JPY", "CAD", "AUD"];

type Filter = "all" | "fields" | "specs" | "skipped";
const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["fields", "Product fields"],
  ["specs", "Specifications"],
  ["skipped", "Not imported"],
];

const fieldClass = "h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring";

export function MappingStep({
  workbook,
  sheetIndex,
  onSheet,
  headerRow,
  onHeaderRow,
  columns,
  mapping,
  onMapping,
  onReset,
  mediaBase,
  onMediaBase,
  currency,
  onCurrency,
  result,
  onNext,
}: {
  workbook: WorkbookData;
  sheetIndex: number;
  onSheet: (index: number) => void;
  headerRow: number;
  onHeaderRow: (row: number) => void;
  columns: ColumnInfo[];
  mapping: FieldKey[];
  onMapping: (mapping: FieldKey[]) => void;
  onReset: () => void;
  mediaBase: string;
  onMediaBase: (value: string) => void;
  currency: string;
  onCurrency: (value: string) => void;
  result: ImportResult;
  onNext: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const sheet = workbook.sheets[sheetIndex];

  const columnsFor = (field: FieldKey) => columns.filter((_, i) => mapping[i] === field);
  const setField = (index: number, field: FieldKey) => {
    const def: FieldDef | undefined = FIELD_BY_KEY.get(field);
    // A single-value field (SKU, name, price …) moves to the newly chosen column.
    const next = mapping.map((f, i) => (i !== index && def && !def.multiple && f === field ? "ignore" : f));
    next[index] = field;
    onMapping(next);
  };

  const visible = columns
    .map((col, i) => ({ col, i, field: mapping[i] ?? "ignore" }))
    .filter(({ col, field }) => {
      if (filter === "fields" && (field === "spec" || field === "ignore")) return false;
      if (filter === "specs" && field !== "spec") return false;
      if (filter === "skipped" && field !== "ignore") return false;
      const q = query.trim().toLowerCase();
      return !q || col.header.toLowerCase().includes(q) || col.samples.some((s) => s.toLowerCase().includes(q));
    });

  const sku = columnsFor("sku")[0];
  const name = columnsFor("name")[0] ?? columnsFor("title")[0];
  const media = columnsFor("image").length + columnsFor("video").length + columnsFor("document").length;
  const relations = columnsFor("related").length + columnsFor("compatible").length;
  const specs = columnsFor("spec").length;
  const skipped = columnsFor("ignore").length;
  const hasPrice = columnsFor("price").length > 0;
  const hasCurrency = columnsFor("currency").length > 0;
  const summary: Array<{ label: string; value: string; missing?: boolean }> = [
    { label: "Part number", value: sku?.header ?? "Not chosen", missing: !sku },
    { label: "Name", value: name?.header ?? "Uses part number" },
    { label: "Media & files", value: media ? plural(media, "column") : "None" },
    { label: "Related & compatible", value: relations ? plural(relations, "column") : "None" },
    { label: "Specifications", value: plural(specs, "column") },
    { label: "Not imported", value: plural(skipped, "column") },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {workbook.sheets.length > 1 && (
          <label className="block text-sm">
            <span className="font-medium text-foreground">Sheet</span>
            <select value={sheetIndex} onChange={(e) => onSheet(Number(e.target.value))} className={cn(fieldClass, "mt-1.5")}>
              {workbook.sheets.map((s, i) => (
                <option key={`${s.name}-${i}`} value={i}>
                  {s.name}
                  {s.hidden ? " (hidden)" : ""} · {plural(Math.max(0, s.rows.length - 1), "row")}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="font-medium text-foreground">Header row</span>
          <select value={headerRow} onChange={(e) => onHeaderRow(Number(e.target.value))} className={cn(fieldClass, "mt-1.5")}>
            {sheet.rows.slice(0, 15).map((row, r) => (
              <option key={r} value={r}>
                Row {r + 1}: {row.filter(Boolean).slice(0, 3).join(" · ").slice(0, 70) || "(empty)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className={cn("rounded-2xl border px-3.5 py-3", item.missing ? "border-danger/40 bg-danger/5" : "bg-subtle")}>
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-foreground" title={item.value}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {!sku && (
        <Notice tone="danger" title="Choose the part number column" className="mt-4">
          Every product needs a unique part number (SKU). Pick the column below and set it to “Part number (SKU)”.
        </Notice>
      )}

      <div className={cn("mt-5 grid gap-4", hasPrice && !hasCurrency && "sm:grid-cols-2")}>
        <label className="block text-sm">
          <span className="font-medium text-foreground">Media base URL</span>
          <span className="ml-1.5 text-muted-foreground">(optional)</span>
          <input
            type="url"
            inputMode="url"
            value={mediaBase}
            onChange={(e) => onMediaBase(e.target.value)}
            placeholder="https://media.example.com/images/"
            className={cn(fieldClass, "mt-1.5")}
          />
          <span className="mt-1 block text-xs text-muted-foreground">Only needed when images or documents are listed as file names instead of full links.</span>
        </label>
        {hasPrice && !hasCurrency && (
          <label className="block text-sm">
            <span className="font-medium text-foreground">Currency of the prices</span>
            <select value={currency} onChange={(e) => onCurrency(e.target.value)} className={cn(fieldClass, "mt-1.5")}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border p-0.5" role="group" aria-label="Show columns">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "h-8 rounded-[10px] px-3 text-[13px] font-medium transition-colors",
                filter === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="relative w-full max-w-60">
            <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a column"
              aria-label="Find a column"
              className="h-9 w-full rounded-xl border bg-background pl-8 pr-3 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={onReset} title="Discard your changes and use the automatic suggestions">
            <ResetIcon size={14} /> Suggestions
          </Button>
        </div>
      </div>

      <ul className="mt-3 divide-y overflow-hidden rounded-2xl border">
        {visible.map(({ col, i, field }) => (
          <li
            key={col.index}
            className={cn(
              "grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,13rem)] sm:items-center sm:gap-4",
              field === "ignore" && "bg-subtle/70",
            )}
          >
            <div className="min-w-0">
              <p className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 w-6 shrink-0 font-mono text-[11px] text-muted-foreground">{columnLetter(col.index)}</span>
                <span className="line-clamp-2 min-w-0 break-words font-medium leading-snug text-foreground" title={col.header}>
                  {col.header}
                </span>
                {col.language && <Chip className="shrink-0">{col.language.toUpperCase()}</Chip>}
              </p>
              <p className="ml-8 text-xs text-muted-foreground">{col.filled ? `${formatNumber(col.filled, 0)} filled` : "Empty"}</p>
            </div>
            <p className="min-w-0 truncate text-[13px] text-muted-foreground sm:pl-0" title={col.samples.join("\n")}>
              {col.samples.slice(0, 3).join(" · ") || "—"}
            </p>
            <select
              aria-label={`Import column “${col.header}” as`}
              value={field}
              onChange={(e) => setField(i, e.target.value as FieldKey)}
              className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
            >
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {FIELDS.filter((f) => f.group === group).map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </li>
        ))}
        {!visible.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No columns match.</li>}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{formatNumber(result.stats.products, 0)}</span>{" "}
          {result.stats.products === 1 ? "product" : "products"} found in {plural(result.stats.rows, "row")}
        </p>
        <Button size="lg" onClick={onNext} disabled={!sku || !result.stats.products}>
          Review <ArrowRightIcon size={17} />
        </Button>
      </div>
    </div>
  );
}
