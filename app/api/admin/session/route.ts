import { NextResponse } from "next/server";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { adminPassword, isAdminRequest, NO_STORE } from "@/lib/admin/guard";
import type { AdminSessionResponse } from "@/lib/admin/types";

export async function GET() {
  const enabled = Boolean(adminPassword());
  const signedIn = enabled && (await isAdminRequest());
  const body: AdminSessionResponse = { enabled, signedIn };
  if (signedIn) body.database = await checkDatabase();
  return NextResponse.json(body, { headers: NO_STORE });
}

async function checkDatabase(): Promise<NonNullable<AdminSessionResponse["database"]>> {
  try {
    await adminDb().ref("games").limitToFirst(1).get();
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminConfigError) return { ok: false, error: error.message };
    console.error("Admin database check failed", error);
    return { ok: false, error: "The admin SDK couldn't read the database (check FIREBASE_SERVICE_ACCOUNT)." };
  }
}
