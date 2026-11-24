/**
 * Document links never point at the real file. They go through /download/<slug>/<index>, which
 * sends the presenter to the file and everyone else to the password page (see download-auth.ts).
 * Safe to import from client components.
 */
export const downloadHref = (slug: string, index: number) => `/download/${encodeURIComponent(slug)}/${index}`;

/** The password page for one document. */
export const unlockHref = (slug: string, index: number) => `/download?product=${encodeURIComponent(slug)}&doc=${index}`;
