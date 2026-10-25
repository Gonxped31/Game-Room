import { NextResponse } from "next/server";
import { clearStatsUpdate } from "@/lib/admin/clearStats";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { adminPassword, NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { checkPassword } from "@/lib/admin/session";

/** Slows down password guessing, as the login does. */
const WRONG_PASSWORD_DELAY_MS = 1000;

/**
 * Clears the dashboard's stats (see `clearStatsUpdate`). Needs the admin
 * cookie and, in the body, the admin password again (`{password}`): a
 * wrong one answers 403, so the dashboard doesn't take it for a sign-out.
 */
export async function POST(request: Request) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const body: unknown = await request.json().catch(() => null);
  const attempt = body && typeof body === "object" && "password" in body && typeof body.password === "string" ? body.password : "";
  if (!checkPassword(adminPassword(), attempt)) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY_MS));
    return NextResponse.json({ error: "Wrong password." }, { status: 403, headers: NO_STORE });
  }
  try {
    const db = adminDb();
    const users = await db.ref("users").get();
    await db.ref().update(clearStatsUpdate(users.val()));
    return NextResponse.json({ cleared: true }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error("Admin stats clear failed", error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't clear the stats.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
