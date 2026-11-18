import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import type { CatalogVersion, StoredCatalog } from "./types";

/**
 * Where the published catalog lives — no database needed:
 * - Vercel: a Vercel Blob store (connecting it adds BLOB_STORE_ID, and BLOB_READ_WRITE_TOKEN if chosen).
 * - Anywhere else (test machine, local dev): JSON files in .data/ next to the app.
 * Every publish also keeps a copy in the history (last 10), so an import can be undone.
 * Server-only: never import this from a "use client" file.
 */

export const EMPTY_CATALOG: StoredCatalog = {
  version: 1,
  importedAt: "",
  source: null,
  products: [],
  categories: [],
  mapping: {},
};

const HISTORY_LIMIT = 10;

export type StorageKind = "blob" | "file" | "unavailable";

export function storageKind(): StorageKind {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  // Vercel functions have a read-only file system, so a Blob store is required there.
  if (process.env.VERCEL) return "unavailable";
  return "file";
}

export class StorageError extends Error {}

interface Backend {
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
}

const BLOB_PREFIX = "catalog/";
const blobAccess = (): "public" | "private" => (process.env.BLOB_ACCESS === "public" ? "public" : "private");

const blobBackend: Backend = {
  async read(name) {
    // useCache: false reads straight from storage, so a fresh import is never served stale.
    const result = await get(BLOB_PREFIX + name, { access: blobAccess(), useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream).text();
  },
  async write(name, text) {
    try {
      await put(BLOB_PREFIX + name, text, {
        access: blobAccess(),
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const hint = /access/i.test(message) && blobAccess() === "private" ? " If your Blob store only allows public files, set BLOB_ACCESS=public and redeploy." : "";
      throw new StorageError(`Vercel Blob rejected the upload: ${message}.${hint}`);
    }
  },
  async remove(name) {
    await del(BLOB_PREFIX + name);
  },
};

const dataDir = () => path.resolve(process.env.CATALOG_DATA_DIR || path.join(process.cwd(), ".data"));

const fileBackend: Backend = {
  async read(name) {
    try {
      return await fs.readFile(path.join(dataDir(), name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async write(name, text) {
    const file = path.join(dataDir(), name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // Write then rename, so a crash never leaves a half-written catalog.
    const temp = `${file}.${process.pid}-${Date.now()}.tmp`;
    await fs.writeFile(temp, text, "utf8");
    await fs.rename(temp, file);
  },
  async remove(name) {
    await fs.rm(path.join(dataDir(), name), { force: true });
  },
};

const unavailableBackend: Backend = {
  async read() {
    return null;
  },
  async write() {
    throw new StorageError(
      "This deployment has no storage. In Vercel connect a Blob store to this project (Storage → Create Storage → Blob), then redeploy.",
    );
  },
  async remove() {},
};

function backend(): Backend {
  const kind = storageKind();
  return kind === "blob" ? blobBackend : kind === "file" ? fileBackend : unavailableBackend;
}

function parse(text: string): StoredCatalog | null {
  const data = JSON.parse(text) as StoredCatalog;
  return data && data.version === 1 && Array.isArray(data.products) ? data : null;
}

/** The published catalog, or null before the first import. */
export async function readCatalog(): Promise<StoredCatalog | null> {
  const text = await backend().read("current.json");
  return text ? parse(text) : null;
}

/** "2026-10-09T08:52:31.123Z" → "2026-10-09T08-52-31-123Z" (safe in file and blob names). */
const versionId = (iso: string) => iso.replace(/[:.]/g, "-");

async function readHistory(b: Backend): Promise<CatalogVersion[]> {
  const text = await b.read("history/index.json");
  if (!text) return [];
  const data = JSON.parse(text) as unknown;
  return Array.isArray(data) ? (data as CatalogVersion[]) : [];
}

/** Publishes a catalog: keeps a copy in the history, then makes it the live one. */
export async function saveCatalog(catalog: StoredCatalog): Promise<CatalogVersion> {
  const b = backend();
  const text = JSON.stringify(catalog);
  const entry: CatalogVersion = {
    id: versionId(catalog.importedAt),
    importedAt: catalog.importedAt,
    fileName: catalog.source?.fileName ?? null,
    products: catalog.products.length,
    ...(catalog.restoredFrom ? { restoredFrom: catalog.restoredFrom } : {}),
  };
  await b.write(`history/${entry.id}.json`, text);
  await b.write("current.json", text);

  const history = [entry, ...(await readHistory(b)).filter((v) => v.id !== entry.id)];
  await b.write("history/index.json", JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  await Promise.all(history.slice(HISTORY_LIMIT).map((v) => b.remove(`history/${v.id}.json`).catch(() => undefined)));
  return entry;
}

export async function listVersions(): Promise<CatalogVersion[]> {
  return readHistory(backend());
}

export async function readVersion(id: string): Promise<StoredCatalog | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const text = await backend().read(`history/${id}.json`);
  return text ? parse(text) : null;
}
