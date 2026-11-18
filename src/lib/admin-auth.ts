import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

/**
 * Admin access for the import page: one shared password (ADMIN_PASSWORD) and a signed,
 * HTTP-only session cookie. Changing the password (or SESSION_SECRET) signs everyone out.
 * Server-only.
 */

const COOKIE = "catalog_admin";
const SESSION_SECONDS = 12 * 60 * 60;

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function key(): Buffer {
  return createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}\n${process.env.ADMIN_PASSWORD ?? ""}`).digest();
}

const sign = (value: string) => createHmac("sha256", key()).update(value).digest("base64url");

/** Constant-time comparison of equal-length digests. */
function same(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

export function passwordMatches(input: string): boolean {
  return adminConfigured() && same(input, process.env.ADMIN_PASSWORD ?? "");
}

export function createSessionToken(now = Date.now()): string {
  const expires = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${expires}.${sign(expires)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !adminConfigured()) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d{1,12}$/.test(expires)) return false;
  if (Number(expires) * 1000 <= now) return false;
  return same(signature, sign(expires));
}

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(COOKIE)?.value);
}

export async function startSession(): Promise<void> {
  // Secure cookies only over HTTPS, so a test machine reached over plain http:// can still sign in.
  const proto = (await headers()).get("x-forwarded-proto") ?? "";
  (await cookies()).set(COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: proto.split(",")[0].trim() === "https",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
