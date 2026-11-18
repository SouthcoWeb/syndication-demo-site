import Link from "next/link";
import { buttonVariants } from "./ui/button";
import { SheetIcon, UploadIcon } from "./ui/icons";
import { Container } from "./ui/primitives";

const STEPS = [
  { title: "Export from inRiver", text: "Export the products you want to show to an Excel file from inRiver." },
  { title: "Import and map", text: "Upload the file on the import page. Columns are matched automatically and you can adjust any of them." },
  { title: "Publish", text: "Check the preview and publish. The website shows exactly the products in your file." },
];

/** Shown on the home and catalog pages until the first catalog is published. */
export function EmptyCatalog() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <Container className="relative py-20 text-center sm:py-28">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <SheetIcon size={26} />
        </span>
        <h1 className="mx-auto mt-6 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
          Your catalog is ready for its first products
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-foreground">
          Import the Excel export from inRiver to publish your products with their basic product information.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/admin" className={buttonVariants({ size: "lg" })}>
            <UploadIcon size={18} /> Import products
          </Link>
        </div>
        <ol className="mx-auto mt-14 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-3xl border bg-card p-6">
              <span className="grid size-8 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">{i + 1}</span>
              <h2 className="mt-4 text-base font-semibold text-foreground">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
