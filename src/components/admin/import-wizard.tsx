"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { publishCatalog } from "@/app/admin/actions";
import { analyzeColumns, autoMap, detectHeaderRow, hasSkuColumn, mappingToSave, type FieldKey } from "@/lib/import/fields";
import { buildProducts, enrichVimeo, MAX_PRODUCTS } from "@/lib/import/normalize";
import { ImportFileError, readSpreadsheet, type WorkbookData } from "@/lib/import/spreadsheet";
import { formatNumber, plural } from "@/lib/format";
import type { SavedMapping } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { ArrowRightIcon, CheckCircleIcon, CheckIcon, DownloadIcon, LoaderIcon, SheetIcon, UploadIcon, XIcon } from "../ui/icons";
import { MappingStep } from "./mapping-step";
import { Notice } from "./notice";
import { ReviewStep } from "./review-step";

type Step = "upload" | "map" | "review" | "done";

const STEPS: Array<{ key: Exclude<Step, "done">; label: string }> = [
  { key: "upload", label: "Upload file" },
  { key: "map", label: "Map columns" },
  { key: "review", label: "Review & publish" },
];

/** The sheet to start with: one with a part-number column, then a visible one, then the one with most rows. */
function defaultSheet(workbook: WorkbookData): number {
  let best = 0;
  let bestScore = -Infinity;
  workbook.sheets.forEach((sheet, i) => {
    const rows = sheet.rows.filter((r) => r.some(Boolean)).length;
    const sku = hasSkuColumn(analyzeColumns(sheet.rows, detectHeaderRow(sheet.rows)));
    const score = (sku ? 2e9 : 0) + (sheet.hidden ? 0 : 1e9) + rows;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export function ImportWizard({ savedMapping, liveProducts, canPublish }: { savedMapping: SavedMapping; liveProducts: number; canPublish: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [mediaBase, setMediaBase] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<null | "videos" | "saving">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  const sheet = workbook?.sheets[sheetIndex] ?? null;
  const columns = useMemo(() => (sheet ? analyzeColumns(sheet.rows, headerRow) : []), [sheet, headerRow]);
  const result = useMemo(
    () =>
      sheet && file
        ? buildProducts(sheet, columns, mapping, { fileName: file.name, sheetName: sheet.name, headerRow, mediaBase, defaultCurrency: currency })
        : null,
    [sheet, file, columns, mapping, headerRow, mediaBase, currency],
  );
  const errors = result?.issues.filter((i) => i.level === "error") ?? [];

  /** Picks a sheet and header row and suggests a field for every column. */
  const prepare = (data: WorkbookData, index: number, row?: number) => {
    const rows = data.sheets[index].rows;
    const header = row ?? detectHeaderRow(rows);
    setSheetIndex(index);
    setHeaderRow(header);
    setMapping(autoMap(analyzeColumns(rows, header), savedMapping));
  };

  async function openFile(selected: File | undefined) {
    if (!selected) return;
    setError(null);
    setReading(true);
    try {
      const data = await readSpreadsheet(selected.name, new Uint8Array(await selected.arrayBuffer()));
      setWorkbook(data);
      setFile({ name: selected.name, size: selected.size });
      prepare(data, defaultSheet(data));
      setStep("map");
    } catch (err) {
      setError(err instanceof ImportFileError ? err.message : "This file could not be read. Make sure it is an Excel workbook (.xlsx) or a CSV file.");
    } finally {
      setReading(false);
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void openFile(event.dataTransfer.files[0]);
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setWorkbook(null);
    setMapping([]);
    setError(null);
    setPublished(null);
  };

  async function publish() {
    if (!result || !file || !sheet) return;
    setConfirmOpen(false);
    setError(null);
    setPublishing("videos");
    try {
      const products = structuredClone(result.products);
      await enrichVimeo(products);
      setPublishing("saving");
      const outcome = await publishCatalog({
        products,
        categories: [],
        source: { fileName: file.name, sheet: sheet.name, rows: result.stats.rows },
        mapping: mappingToSave(columns, mapping),
      });
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setPublished(outcome.message);
      setStep("done");
      router.refresh();
    } catch {
      setError("The catalog could not be sent to the server. Check your connection and try again; for very large files, import fewer products.");
    } finally {
      setPublishing(null);
    }
  }

  const stepIndex = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === step);

  return (
    <section className="min-w-0 rounded-3xl border bg-card" aria-label="Import wizard">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs font-semibold",
                  i < stepIndex ? "bg-success text-background" : i === stepIndex ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {i < stepIndex ? <CheckIcon size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("font-medium", i === stepIndex ? "text-foreground" : "text-muted-foreground")} aria-current={i === stepIndex ? "step" : undefined}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        {file && step !== "done" && (
          <span className="flex min-w-0 items-center gap-2 rounded-full border bg-subtle py-1 pl-3 pr-1 text-xs text-muted-foreground">
            <SheetIcon size={14} className="shrink-0" />
            <span className="max-w-[16rem] truncate font-medium text-foreground">{file.name}</span>
            <button type="button" onClick={reset} aria-label="Choose another file" className="grid size-6 place-items-center rounded-full hover:bg-muted hover:text-foreground">
              <XIcon size={13} />
            </button>
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {error && (
          <Notice tone="danger" title="Something needs your attention" className="mb-5">
            {error}
          </Notice>
        )}

        {step === "upload" && (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors",
                dragging ? "border-primary bg-primary-soft/40" : "border-border",
              )}
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                {reading ? <LoaderIcon size={24} className="animate-spin" /> : <UploadIcon size={24} />}
              </span>
              <p className="mt-5 text-lg font-semibold text-foreground">{reading ? "Reading your file…" : "Drop your inRiver Excel export here"}</p>
              <p className="mt-1 text-sm text-muted-foreground">The file is read in your browser; only the products you publish are sent to the website.</p>
              <label className={cn(buttonVariants({ size: "lg", className: "mt-6 cursor-pointer" }), "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2")}>
                <UploadIcon size={18} /> Choose file
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="sr-only"
                  disabled={reading}
                  onChange={(e) => {
                    void openFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="mt-4 text-xs text-muted-foreground">
                Excel (.xlsx) or CSV · up to 25 MB · up to {formatNumber(MAX_PRODUCTS, 0)} products
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a href="/samples/inriver-import-template.xlsx" download className="group flex items-start gap-3 rounded-2xl border p-4 transition-colors hover:border-foreground/20 hover:bg-subtle">
                <DownloadIcon size={18} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">Excel template</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">Every supported column with two example rows.</span>
                </span>
              </a>
              <a href="/samples/sample-inriver-export.xlsx" download className="group flex items-start gap-3 rounded-2xl border p-4 transition-colors hover:border-foreground/20 hover:bg-subtle">
                <SheetIcon size={18} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">Sample file (100 latches)</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">Try the whole flow before your own export is ready.</span>
                </span>
              </a>
            </div>
          </div>
        )}

        {step === "map" && workbook && sheet && result && (
          <MappingStep
            workbook={workbook}
            sheetIndex={sheetIndex}
            onSheet={(index) => prepare(workbook, index)}
            headerRow={headerRow}
            onHeaderRow={(row) => prepare(workbook, sheetIndex, row)}
            columns={columns}
            mapping={mapping}
            onMapping={setMapping}
            onReset={() => setMapping(autoMap(columns, {}))}
            mediaBase={mediaBase}
            onMediaBase={setMediaBase}
            currency={currency}
            onCurrency={setCurrency}
            result={result}
            onNext={() => setStep("review")}
          />
        )}

        {step === "review" && result && (
          <ReviewStep
            result={result}
            onBack={() => setStep("map")}
            onPublish={() => (liveProducts > 0 ? setConfirmOpen(true) : void publish())}
            publishing={publishing}
            canPublish={canPublish && errors.length === 0}
          />
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircleIcon size={30} />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Published</h2>
            <p className="mt-2 max-w-md text-pretty text-muted-foreground">{published} Every page of the website now shows the new catalog.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/catalog" className={buttonVariants({ size: "lg" })}>
                View the catalog <ArrowRightIcon size={17} />
              </Link>
              <Button variant="outline" size="lg" onClick={reset}>
                Import another file
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} label="Replace the catalog" width="30rem">
        <div className="rounded-3xl border bg-background p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-foreground">Replace the products on the website?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The {plural(liveProducts, "product")} currently on the website will be replaced by the {plural(result?.products.length ?? 0, "product")} in{" "}
            <span className="font-medium text-foreground">{file?.name}</span>. The current version stays in the import history and can be restored.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void publish()}>Replace and publish</Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
