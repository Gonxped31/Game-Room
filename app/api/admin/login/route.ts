import { NextResponse } from "next/server";
import { adminPassword, NO_STORE } from "@/lib/admin/guard";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, checkPassword, createSessionToken } from "@/lib/admin/session";

/** Slows down password guessing; the password is the only thing guarding /admin. */
const FAILED_LOGIN_DELAY_MS = 1000;

export async function POST(request: Request) {
  const password = adminPassword();
  if (!password) return NextResponse.json({ error: "Admin is turned off here." }, { status: 404, headers: NO_STORE });

  const body: unknown = await request.json().catch(() => null);
  const attempt = body && typeof body === "object" && "password" in body && typeof body.password === "string" ? body.password : "";
  if (!checkPassword(password, attempt)) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return NextResponse.json({ error: "Wrong password." }, { status: 401, headers: NO_STORE });
  }

  const response = NextResponse.json({ signedIn: true }, { headers: NO_STORE });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(password, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MS / 1000,
  });
  return response;
}
