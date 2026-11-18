import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppOverlays } from "@/components/layout/app-overlays";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { siteConfig } from "@/config/site";
import { buildNav } from "@/lib/catalog-core";
import { getCatalog } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4f91",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nav = buildNav(await getCatalog());
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-[14px] text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
        >
          Skip to content
        </a>
        <SiteHeader nav={nav} />
        <main id="main">{children}</main>
        <SiteFooter nav={nav} />
        <AppOverlays showCart={nav.hasPrices} />
      </body>
    </html>
  );
}
