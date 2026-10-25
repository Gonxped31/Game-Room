import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/admin/guard";
import { ADMIN_COOKIE } from "@/lib/admin/session";

export async function POST() {
  const response = NextResponse.json({ signedIn: false }, { headers: NO_STORE });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
