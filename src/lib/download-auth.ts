import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

/**
 * Downloads are for the presenter of this demo site only. Opening a document asks for
 * DOWNLOAD_PASSWORD (a Vercel environment variable); once entered, a signed HTTP-only cookie
 * unlocks every download for 12 hours. Without DOWNLOAD_PASSWORD nobody can download.
 * Changing the password (or SESSION_SECRET) locks downloads again for everyone. Server-only.
 */

const COOKIE = "catalog_downloads";
const SESSION_SECONDS = 12 * 60 * 60;

export function downloadsConfigured(): boolean {
  return Boolean(process.env.DOWNLOAD_PASSWORD);
}

function key(): Buffer {
  return createHash("sha256").update(`downloads\n${process.env.SESSION_SECRET ?? ""}\n${process.env.DOWNLOAD_PASSWORD ?? ""}`).digest();
}

const sign = (value: string) => createHmac("sha256", key()).update(value).digest("base64url");

/** Constant-time comparison (both sides hashed to equal length first). */
function same(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function downloadPasswordMatches(input: string): boolean {
  return downloadsConfigured() && same(input, process.env.DOWNLOAD_PASSWORD ?? "");
}

function verify(token: string | undefined, now = Date.now()): boolean {
  if (!token || !downloadsConfigured()) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d{1,12}$/.test(expires)) return false;
  if (Number(expires) * 1000 <= now) return false;
  return same(signature, sign(expires));
}

export async function hasDownloadAccess(): Promise<boolean> {
  return verify((await cookies()).get(COOKIE)?.value);
}

export async function grantDownloadAccess(): Promise<void> {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const proto = (await headers()).get("x-forwarded-proto") ?? "";
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: proto.split(",")[0].trim() === "https",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}
