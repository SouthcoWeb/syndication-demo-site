import { getCatalog } from "@/lib/data";
import { unlockHref } from "@/lib/download";
import { hasDownloadAccess } from "@/lib/download-auth";

/** Checks the download password cookie on every request, so this route is never cached. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; index: string }> }) {
  const { slug, index } = await params;
  const i = Number(index);
  const product = (await getCatalog()).bySlug.get(slug);
  const doc = product && Number.isInteger(i) ? product.documents[i] : undefined;
  if (!product || !doc) return new Response("Document not found", { status: 404 });

  const target = (await hasDownloadAccess()) ? doc.url : new URL(unlockHref(slug, i), request.url).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
