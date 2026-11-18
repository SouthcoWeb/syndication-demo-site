import Image, { type ImageProps } from "next/image";

/** Hosts configured in next.config.ts (IMAGE_REMOTE_HOSTS); empty when optimization is off. */
const OPTIMIZED_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_OPTIMIZED_IMAGE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
);

/** Local files and allowed hosts go through the image optimizer; anything else loads directly from its source. */
export function canOptimize(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") return true;
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * next/image for imported media: image URLs come from the Excel file, so their hosts are
 * not known at build time. Unknown hosts are shown unoptimized instead of failing.
 */
export function RemoteImage(props: ImageProps) {
  return <Image {...props} unoptimized={props.unoptimized || !canOptimize(props.src)} />;
}
