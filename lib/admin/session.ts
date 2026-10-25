import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The owner's admin session: one shared password (`ADMIN_PASSWORD`), no
 * accounts. A correct password earns a signed, expiring cookie value. The
 * signing key is derived from the password itself, so changing the password
 * logs every session out. Pure (no Next imports) so it can be unit-tested;
 * `guard.ts` wires it to cookies.
 */

export const ADMIN_COOKIE = "gr_admin";
export const ADMIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (text: string) => createHash("sha256").update(text).digest();
const signingKey = (password: string) => sha256(`game-room-admin-session:${password}`);
const sign = (password: string, expiresAt: number) => createHmac("sha256", signingKey(password)).update(`admin:${expiresAt}`).digest("base64url");

/** Equal-length digests, so the comparison takes the same time whatever the input. */
const sameText = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

/** True when `attempt` is the admin password. Always false while no password is configured. */
export function checkPassword(password: string | undefined, attempt: string): boolean {
  if (!password) return false;
  return sameText(password, attempt);
}

/** A cookie value valid until `now + ADMIN_SESSION_MS`. */
export function createSessionToken(password: string, now: number): string {
  const expiresAt = now + ADMIN_SESSION_MS;
  return `${expiresAt}.${sign(password, expiresAt)}`;
}

/** True when `token` was signed with this password and hasn't expired. */
export function verifySessionToken(password: string | undefined, token: string | undefined, now: number): boolean {
  if (!password || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(token.slice(0, dot));
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  return sameText(token.slice(dot + 1), sign(password, expiresAt));
}
