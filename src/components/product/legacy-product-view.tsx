import type { ReactNode } from "react";
import { legacyConfig } from "@/config/legacy";
import { siteConfig } from "@/config/site";
import type { ProductPageData } from "@/lib/catalog-core";
import { familyLabel } from "@/lib/format";
import { productHref } from "@/lib/product";
import { attributeGroups, importedAttributeCount, type AttributeGroup } from "@/lib/product-attributes";
import { Breadcrumbs } from "../breadcrumbs";
import { ArrowUpRightIcon, FileDownIcon, MailIcon } from "../ui/icons";
import { Container } from "../ui/primitives";
import { ProductImage } from "../ui/product-image";
import { AttributePanel } from "./attribute-panel";
import { DocumentList } from "./document-list";
import { TrackView } from "./recently-viewed";
import { SpecTable } from "./spec-table";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[calc(var(--header-height)+24px)] border bg-card">
      <h2 id={`${id}-title`} className="border-b bg-muted px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

interface HiddenRow {
  label: string;
  shown: number;
  total: number;
}

/** Groups the export has more of than the legacy site shows. */
function hiddenRows(full: AttributeGroup[], shown: AttributeGroup[]): HiddenRow[] {
  const byKey = new Map(shown.map((g) => [g.key, g]));
  return full
    .filter((g) => !g.derived)
    .map((g) => {
      const s = byKey.get(g.key);
      const count = (x: AttributeGroup | undefined) => (x ? (x.items.length ? x.items.length : x.count) : 0);
      // Media compares files (images + videos), the rest compare listed attributes.
      return g.key === "media" ? { label: g.label, shown: s?.count ?? 0, total: g.count } : { label: g.label, shown: count(s), total: count(g) };
    })
    .filter((r) => r.total > r.shown);
}

/**
 * Legacy product page (PDP): the basic fields only, in an older single-column style, with the
 * attribute navigator on the right showing how much of the inRiver export this site leaves out.
 */
export function LegacyProductView({ data, full }: { data: ProductPageData; full: ProductPageData }) {
  const { product, card, breadcrumbs, family } = data;
  const drawing = product.documents[0] ?? null;

  const shownGroups = attributeGroups(data).filter((g) => !g.derived && g.count > 0);
  const fullGroups = attributeGroups(full);
  const shownTotal = importedAttributeCount(shownGroups);
  const fullTotal = importedAttributeCount(fullGroups);
  const hidden = hiddenRows(fullGroups, shownGroups);
  const enhancedHref = `${legacyConfig.enhancedUrl}${productHref(product.slug)}`;

  const notShown =
    fullTotal > shownTotal ? (
      <div className="mx-1 mt-3 border border-dashed border-warning/60 bg-warning/5 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-warning">Not shown on this site</p>
        <p className="mt-1 text-xs leading-snug text-foreground/80">
          The inRiver export has <strong>{fullTotal - shownTotal} more attributes</strong> for this part.
        </p>
        <ul className="mt-2 space-y-1">
          {hidden.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{r.label}</span>
              <span className="shrink-0 tabular-nums text-foreground/80">
                {r.shown} / {r.total}
              </span>
            </li>
          ))}
        </ul>
        <a
          href={enhancedHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
        >
          See all {fullTotal} on the enhanced website <ArrowUpRightIcon size={13} />
        </a>
      </div>
    ) : null;

  return (
    <>
      <TrackView product={card} />

      <div className="mx-auto w-full max-w-[1680px] xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-2 xl:pr-8">
        <div className="min-w-0">
          <Container className="pt-4">
            <Breadcrumbs items={breadcrumbs} />
          </Container>

          <Container className="mt-4 space-y-5 pb-14">
            <div id="buy-box" className="scroll-mt-[calc(var(--header-height)+24px)] border bg-card px-4 py-3">
              <h1 className="font-mono text-2xl font-bold text-foreground">{product.sku}</h1>
              <p className="mt-1 text-[15px] text-foreground/80">{product.title}</p>
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div id="media" className="scroll-mt-[calc(var(--header-height)+24px)] border bg-card p-3">
                <ProductImage
                  src={product.images[0]?.src ?? null}
                  alt={product.images[0]?.alt || product.title}
                  sizes="(min-width: 768px) 22rem, 100vw"
                  className="aspect-square w-full"
                  imageClassName="p-4"
                />
              </div>

              <div className="space-y-5">
                <Section id="overview" title="Product information">
                  <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Part number</dt>
                    <dd className="font-bold">{product.sku}</dd>
                    {product.family.code && (
                      <>
                        <dt className="text-muted-foreground">Product family</dt>
                        <dd>{family ? <a href={family.href} className="text-primary underline">{familyLabel(product.family.code, product.family.name)}</a> : product.family.code}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{product.category.join(" › ")}</dd>
                  </dl>
                  {product.description && (
                    <p id="product-description" className="mt-4 whitespace-pre-line rounded-sm border-t pt-4 text-sm leading-relaxed text-foreground/85">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`mailto:${siteConfig.quote.email}?subject=${encodeURIComponent(`Quote request: ${product.sku}`)}`}
                      className="inline-flex items-center gap-1.5 bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      <MailIcon size={15} /> Request a quote
                    </a>
                    {drawing && (
                      <a
                        href={drawing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-muted"
                      >
                        <FileDownIcon size={15} /> {drawing.label}
                      </a>
                    )}
                  </div>
                </Section>
              </div>
            </div>

            <Section id="specifications" title="Specifications">
              <SpecTable product={product} />
            </Section>

            {product.documents.length > 0 && (
              <Section id="downloads" title="Downloads">
                <DocumentList documents={product.documents} />
              </Section>
            )}
          </Container>
        </div>

        <aside aria-label="Attributes shown from inRiver" className="xl:pt-4">
          <AttributePanel
            groups={shownGroups}
            total={shownTotal}
            source={product.source ?? null}
            heading="From inRiver"
            totalLabel={`of ${fullTotal} attributes shown`}
            extra={notShown}
          />
        </aside>
      </div>
    </>
  );
}
