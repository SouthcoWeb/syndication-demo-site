"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminConfigured, endSession, isAdmin, passwordMatches, startSession } from "@/lib/admin-auth";
import { readVersion, saveCatalog, StorageError } from "@/lib/catalog-store";
import { CATALOG_TAG } from "@/lib/data";
import { sanitizeCatalog, type CatalogInput } from "@/lib/import/validate";
import type { CatalogVersion, StoredCatalog } from "@/lib/types";

export interface LoginState {
  error: string | null;
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!adminConfigured()) return { error: "Importing is disabled until ADMIN_PASSWORD is set on the server." };
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    // A short pause makes guessing passwords impractical.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "That password is not correct." };
  }
  await startSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/admin");
}

export type ActionResult = { ok: true; message: string; version: CatalogVersion } | { ok: false; error: string };

const SIGNED_OUT: ActionResult = { ok: false, error: "Your admin session has expired. Reload the page and sign in again." };

function failure(error: unknown): ActionResult {
  if (error instanceof StorageError) return { ok: false, error: error.message };
  console.error("Catalog storage failed", error);
  return { ok: false, error: "The catalog could not be saved. Please try again in a moment." };
}

/** Every page shows the new catalog on its next request; the admin sees it immediately. */
function refreshSite() {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}

async function publish(catalog: StoredCatalog, message: string): Promise<ActionResult> {
  try {
    const version = await saveCatalog(catalog);
    refreshSite();
    return { ok: true, message, version };
  } catch (error) {
    return failure(error);
  }
}

/** Publishes an imported catalog after checking every value on the server. */
export async function publishCatalog(input: CatalogInput): Promise<ActionResult> {
  if (!(await isAdmin())) return SIGNED_OUT;
  const result = sanitizeCatalog(input);
  if (!result.ok) return result;
  const catalog: StoredCatalog = { version: 1, importedAt: new Date().toISOString(), ...result.catalog };
  return publish(catalog, `${catalog.products.length} products are live.`);
}

/** Makes an earlier import live again (the current one stays in the history). */
export async function restoreCatalog(versionId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return SIGNED_OUT;
  try {
    const previous = await readVersion(versionId);
    if (!previous) return { ok: false, error: "That version is no longer available." };
    const catalog: StoredCatalog = { ...previous, importedAt: new Date().toISOString(), restoredFrom: previous.importedAt };
    return publish(catalog, `Restored ${catalog.products.length} products.`);
  } catch (error) {
    return failure(error);
  }
}

/** Takes every product off the site (kept in the history, so it can be restored). */
export async function clearCatalog(): Promise<ActionResult> {
  if (!(await isAdmin())) return SIGNED_OUT;
  const catalog: StoredCatalog = { version: 1, importedAt: new Date().toISOString(), source: null, products: [], categories: [], mapping: {} };
  return publish(catalog, "All products were removed from the site.");
}
