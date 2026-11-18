import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Plain square badge with the site's initials (legacy style). */
export function LogoMark({ className }: { className?: string }) {
  const initials = siteConfig.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden="true" className={cn("grid place-items-center bg-primary text-xs font-bold text-primary-foreground", className)}>
      {initials}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/catalog" aria-label={`${siteConfig.name} home`} className={cn("flex shrink-0 items-center gap-2", className)}>
      <LogoMark className="size-8" />
      <span className="text-lg font-bold text-foreground">{siteConfig.name}</span>
    </Link>
  );
}
