import Link from "next/link";
import { siteConfig } from "@/config/site";
import type { NavData } from "@/lib/catalog-core";
import { MailIcon, PhoneIcon } from "../ui/icons";
import { Container } from "../ui/primitives";
import { HeaderActions } from "./header-actions";
import { MegaMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { SearchTrigger } from "./search-command";

/** Legacy header: a classic navy title bar with a plain navigation strip underneath. */
export function SiteHeader({ nav }: { nav: NavData }) {
  return (
    <>
      <div className="bg-primary text-primary-foreground">
        <Container className="flex h-14 items-center gap-3">
          <Link href="/catalog" className="flex shrink-0 items-baseline gap-2" aria-label={`${siteConfig.name} home`}>
            <span className="text-xl font-bold tracking-tight">{siteConfig.name}</span>
            <span className="hidden text-xs text-primary-foreground/70 sm:inline">{siteConfig.tagline}</span>
          </Link>
          <div className="ml-auto hidden items-center gap-5 text-xs text-primary-foreground/80 md:flex">
            <a href={`mailto:${siteConfig.contact.email}`} className="flex items-center gap-1.5 hover:text-primary-foreground hover:underline">
              <MailIcon size={13} /> {siteConfig.contact.email}
            </a>
            <span className="flex items-center gap-1.5">
              <PhoneIcon size={13} /> {siteConfig.contact.phone}
            </span>
          </div>
        </Container>
      </div>
      <header className="sticky top-0 z-40 border-b bg-card shadow-sm">
        <Container className="flex h-[var(--header-height)] items-center gap-2 lg:gap-4">
          <MobileNav nav={nav} />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            <MegaMenu nav={nav} />
            <Link
              href="/catalog"
              className="inline-flex h-10 items-center px-3 text-sm font-bold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              All products
            </Link>
          </nav>
          <div className="flex min-w-0 flex-1 justify-end md:justify-center lg:px-4">
            <SearchTrigger />
          </div>
          <HeaderActions showCart={nav.hasPrices} />
        </Container>
      </header>
    </>
  );
}
