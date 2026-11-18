import path from "node:path";
import type { NextConfig } from "next";

/**
 * Pin the app root to this folder, so Next.js never picks a parent folder that has its own
 * lockfile (for example when this repository is checked out inside the original catalog's folder).
 */
const appRoot = path.resolve(process.cwd());

/**
 * Image hosts that go through the Next.js image optimizer (resized, AVIF/WebP).
 * Images from any other host in the imported Excel are still shown, just loaded
 * directly from their source. Add your inRiver / DAM hosts with IMAGE_REMOTE_HOSTS
 * (comma separated) to optimize them too.
 */
const imageHosts = [
  "media.southco.com",
  "i.vimeocdn.com",
  "i.ytimg.com",
  ...(process.env.IMAGE_REMOTE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
];

/**
 * Image optimization is on by default on Vercel. On other machines images are
 * served straight from their source, which avoids proxy/firewall problems on
 * corporate test machines. Force either way with NEXT_IMAGE_OPTIMIZATION=true|false.
 */
const optimizeImages = process.env.NEXT_IMAGE_OPTIMIZATION
  ? process.env.NEXT_IMAGE_OPTIMIZATION === "true"
  : process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: appRoot,
  turbopack: { root: appRoot },
  env: {
    // Read by ProductImage to decide per image whether the optimizer can be used.
    NEXT_PUBLIC_OPTIMIZED_IMAGE_HOSTS: optimizeImages ? imageHosts.join(",") : "",
  },
  images: {
    unoptimized: !optimizeImages,
    formats: ["image/avif", "image/webp"],
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
  experimental: {
    // The import page sends the mapped catalog (not the Excel file) to a Server Action.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
