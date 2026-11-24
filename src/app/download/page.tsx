import type { Metadata } from "next";
import Link from "next/link";
import { DownloadGate } from "@/components/download-gate";
import { ArrowLeftIcon, ExternalLinkIcon, LockIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { getCatalog } from "@/lib/data";
import { downloadsConfigured } from "@/lib/download-auth";
import { productHref } from "@/lib/product";

export const metadata: Metadata = {
  title: "Download",
  robots: { index: false, follow: false },
};

/** Reads the requested document from the address, so it is rendered per request. */
export const dynamic = "force-dynamic";

const SOUTHCO_URL = "https://www.southco.com";

type Props = { searchParams: Promise<{ product?: string; doc?: string }> };

/** Shown instead of a file to anyone without the presenter password. */
export default async function DownloadPage({ searchParams }: Props) {
  const { product: slug = "", doc = "" } = await searchParams;
  const index = Number(doc);
  const product = (await getCatalog()).bySlug.get(slug);
  const document = product && Number.isInteger(index) ? product.documents[index] : undefined;

  return (
    <Container className="grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-[0_30px_60px_-40px_rgb(15_23_42/0.45)]">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <LockIcon size={22} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Downloads are for the presenter only</h1>

        {product && document && (
          <p className="mt-3 rounded-xl border bg-subtle px-3.5 py-2.5 text-sm text-foreground">
            <span className="font-medium">{document.label}</span>
            <span className="text-muted-foreground">
              {" "}
              · {document.format} · {product.sku}
            </span>
          </p>
        )}

        <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>This website is for demonstration purposes only.</p>
          <p>If you are presenting this website, enter your password to download the file.</p>
          <p>
            Otherwise the file cannot be downloaded here. You can find it on{" "}
            <a href={SOUTHCO_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
              southco.com
            </a>
            . Thank you!
          </p>
        </div>

        {!downloadsConfigured() ? (
          <p className="mt-6 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground">
            Downloads are turned off on this demo website.
          </p>
        ) : product && document ? (
          <DownloadGate product={slug} doc={index} />
        ) : (
          <p className="mt-6 text-sm text-danger">This document could not be found.</p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm">
          <Link href={product ? productHref(product.slug) : "/catalog"} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
            <ArrowLeftIcon size={15} /> {product ? `Back to ${product.sku}` : "Back to products"}
          </Link>
          <a
            href={SOUTHCO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Go to southco.com <ExternalLinkIcon size={14} />
          </a>
        </div>
      </div>
    </Container>
  );
}
