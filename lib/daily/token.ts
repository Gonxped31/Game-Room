import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { AdminConfigError } from "@/lib/admin/firebaseAdmin";

/**
 * Checks a guest's Firebase ID token and returns its uid, or null if it isn't
 * a valid token for this project - the method Firebase documents for servers
 * without the admin SDK ("Verify ID tokens using a third-party JWT library").
 *
 * Not firebase-admin/auth: it loads jwks-rsa 4, which require()s the
 * ESM-only jose 6, and Vercel's Node refuses that while loading the module.
 * Imported at the top of lib/admin/firebaseAdmin.ts, it took every /admin
 * route down with a 500 (2026-10-26). jose imported from our own code is
 * bundled with the route and loads on any Node.
 */

/** Google's public keys for Firebase ID tokens; jose caches them and refetches on rotation. */
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

function projectId(): string {
  const id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!id) throw new AdminConfigError("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.");
  return id;
}

/** The claims every Firebase ID token for this project carries; jwtVerify already checked exp, iss and aud. */
function uidOf(payload: JWTPayload, now: number): string | null {
  const authTime = payload.auth_time;
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) return null;
  if (typeof authTime !== "number" || authTime * 1000 > now + 60_000) return null;
  return payload.sub;
}

/** `keys` is Google's key set; tests pass their own. */
export async function verifyGuestToken(token: string, keys: Parameters<typeof jwtVerify>[1] = GOOGLE_KEYS): Promise<string | null> {
  const project = projectId();
  const issuer = `https://securetoken.google.com/${project}`;
  // The Auth emulator signs nothing (alg "none"): there, only the claims can be checked. Never set on Vercel.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    try {
      const payload = decodeJwt(token);
      const fresh = typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
      return payload.iss === issuer && payload.aud === project && fresh ? uidOf(payload, Date.now()) : null;
    } catch {
      return null;
    }
  }
  try {
    const { payload } = await jwtVerify(token, keys as Parameters<typeof jwtVerify>[1] & CryptoKey, { issuer, audience: project, algorithms: ["RS256"] });
    return uidOf(payload, Date.now());
  } catch (error) {
    // A bad, expired or foreign token is "not signed in"; failing to reach Google's keys is ours to log.
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code !== "ERR_JWKS_TIMEOUT" && /^ERR_(JWT|JWS|JWK|JOSE)/.test(code)) return null;
    throw error;
  }
}

/** Firebase App Check's public keys, for the daily routes' App Check tokens; jose caches them too. */
const APP_CHECK_KEYS = createRemoteJWKSet(new URL("https://firebaseappcheck.googleapis.com/v1/jwks"));

/** The project's number: the second part of the web app's ID ("1:<number>:web:<hash>"). */
function projectNumber(): string {
  const number = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.split(":")[1];
  if (!number || !/^\d+$/.test(number)) throw new AdminConfigError("NEXT_PUBLIC_FIREBASE_APP_ID has no project number.");
  return number;
}

/**
 * Checks a Firebase App Check token (reCAPTCHA v3; docs/daily.md, "App
 * Check"), as Firebase documents for a third-party JWT library: signed by App
 * Check's keys (RS256, type JWT), issued for this project's number, with the
 * project in its audience, not expired. Not firebase-admin/app-check, for the
 * same reason as verifyGuestToken. `keys` is App Check's key set; tests pass
 * their own.
 */
export async function verifyAppCheckToken(token: string, keys: Parameters<typeof jwtVerify>[1] = APP_CHECK_KEYS): Promise<boolean> {
  const number = projectNumber();
  try {
    await jwtVerify(token, keys as Parameters<typeof jwtVerify>[1] & CryptoKey, {
      issuer: `https://firebaseappcheck.googleapis.com/${number}`,
      audience: `projects/${number}`,
      algorithms: ["RS256"],
      typ: "JWT",
    });
    return true;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code !== "ERR_JWKS_TIMEOUT" && /^ERR_(JWT|JWS|JWK|JOSE)/.test(code)) return false;
    throw error;
  }
}
