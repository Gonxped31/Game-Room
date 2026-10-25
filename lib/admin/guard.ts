import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "./session";

/**
 * Cookie checks for /api/admin/* route handlers. Admin is off wherever
 * `ADMIN_PASSWORD` is unset - keep it unset on Vercel Preview, which shares
 * the production database.
 */

export const adminPassword = () => process.env.ADMIN_PASSWORD || undefined;

/** Admin responses are per-session and must never be cached. */
export const NO_STORE = { "Cache-Control": "no-store" };

export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(adminPassword(), jar.get(ADMIN_COOKIE)?.value, Date.now());
}

/** A 401 response for a request without a valid admin cookie, or null when it may go on. */
export async function refuseUnlessAdmin(): Promise<NextResponse | null> {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: NO_STORE });
}
