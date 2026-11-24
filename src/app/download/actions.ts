"use server";

import { getCatalog } from "@/lib/data";
import { downloadHref } from "@/lib/download";
import { downloadPasswordMatches, downloadsConfigured, grantDownloadAccess } from "@/lib/download-auth";

export interface UnlockState {
  error: string | null;
  /** Where to go once unlocked (the download link, which now leads to the file). */
  next: string | null;
}

export async function unlockDownloads(_previous: UnlockState, formData: FormData): Promise<UnlockState> {
  if (!downloadsConfigured()) return { error: "Downloads are turned off on this demo website.", next: null };
  const password = String(formData.get("password") ?? "");
  if (!downloadPasswordMatches(password)) {
    // A short pause makes guessing passwords impractical.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "That password is not correct.", next: null };
  }
  await grantDownloadAccess();

  const slug = String(formData.get("product") ?? "");
  const index = Number(formData.get("doc"));
  const product = (await getCatalog()).bySlug.get(slug);
  const exists = !!product && Number.isInteger(index) && !!product.documents[index];
  return { error: null, next: exists ? downloadHref(slug, index) : "/catalog" };
}
