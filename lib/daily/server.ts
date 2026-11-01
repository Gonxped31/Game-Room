import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { DAILY_GAMES } from "./games";
import { DailyError, type DailyContext, type DailyStore } from "./service";
import { verifyAppCheckToken, verifyGuestToken } from "./token";

/**
 * The daily routes' server side (app/api/daily/[slug]/): who's asking, the
 * real store, the secret seed and the connection's hash. Never import from
 * client code.
 *
 * - `DAILY_SECRET` (Vercel, Production): the key behind every day's seed and
 *   the connection hashes. Without it the daily is off; on the emulators a
 *   fixed development key stands in.
 */

export const NO_STORE = { "Cache-Control": "no-store" };

function secret(): string {
  const key = process.env.DAILY_SECRET;
  if (key) return key;
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) return "emulator-only-daily-secret";
  throw new AdminConfigError("DAILY_SECRET is not set.");
}

/** The day's seed: an HMAC of the game and day, so nobody can build a puzzle before the server hands it out. */
export const seedFor = (slug: string, day: string) => createHmac("sha256", secret()).update(`seed|${slug}|${day}`).digest("hex");

/**
 * The connection, as a salted hash that changes every day: enough to tell
 * "same connection today" without keeping anyone's IP address. On Vercel the
 * client's address is the first entry of x-forwarded-for.
 */
export function connectionHash(request: Request, day: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${secret()}|ip|${day}|${ip}`).digest("hex").slice(0, 32);
}

/** The DailyStore on the real database (admin SDK). */
export function adminStore(): DailyStore {
  const db = adminDb();
  return {
    async get(path) {
      return (await db.ref(path).get()).val() ?? null;
    },
    async set(path, value) {
      await db.ref(path).set(value);
    },
    async claim(path, value) {
      const result = await db.ref(path).transaction((current) => (current === null ? value : undefined));
      return result.snapshot.val();
    },
    async lowest(path, by, limit) {
      const snapshot = await db.ref(path).orderByChild(by).limitToFirst(limit).get();
      const rows: [string, never][] = [];
      snapshot.forEach((child) => {
        rows.push([child.key!, child.val() as never]);
      });
      return rows;
    },
    async countBelow(path, by, value) {
      const snapshot = await db.ref(path).orderByChild(by).endBefore(value).get();
      return snapshot.numChildren();
    },
  };
}

/**
 * App Check (docs/daily.md, "App Check"): with `DAILY_APP_CHECK` "monitor", a
 * request without a valid App Check token (header X-Firebase-AppCheck) is
 * logged; with "enforce", refused. Unset, or on the emulators: no check.
 * Returns the refusal's message, or null to go on.
 */
async function appCheckRefusal(request: Request): Promise<string | null> {
  const mode = process.env.DAILY_APP_CHECK;
  if ((mode !== "monitor" && mode !== "enforce") || process.env.FIREBASE_AUTH_EMULATOR_HOST) return null;
  const token = request.headers.get("x-firebase-appcheck");
  if (token && (await verifyAppCheckToken(token))) return null;
  if (mode === "monitor") {
    console.warn(`Daily: a request ${token ? "with an invalid" : "without an"} App Check token`);
    return null;
  }
  return "The daily puzzle only answers the game's own page. Reload it and try again.";
}

/**
 * Runs a daily route: finds the game, checks the guest's ID token
 * (Authorization: Bearer …) and, when it's on, App Check, and turns failures
 * into JSON errors.
 */
export async function dailyRoute(request: Request, slug: string, run: (ctx: DailyContext) => Promise<unknown>) {
  const game = DAILY_GAMES[slug];
  if (!game) return NextResponse.json({ error: "No daily puzzle for that game." }, { status: 404, headers: NO_STORE });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: NO_STORE });
  try {
    const uid = await verifyGuestToken(token);
    if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: NO_STORE });
    const refused = await appCheckRefusal(request);
    if (refused) return NextResponse.json({ error: refused }, { status: 401, headers: NO_STORE });
    const body = await run({ store: adminStore(), game, seedFor, uid, now: Date.now() });
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof DailyError) return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    if (error instanceof AdminConfigError) return NextResponse.json({ error: "The daily puzzle isn't available here." }, { status: 503, headers: NO_STORE });
    console.error("Daily route failed", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500, headers: NO_STORE });
  }
}
