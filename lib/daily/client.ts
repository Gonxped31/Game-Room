"use client";

import { guestIdToken } from "@/lib/session/shared/auth";
import type { Attempt, BoardEntry, DailyStatus } from "./service";

/** The daily routes' answers, as the page sees them (lib/daily/service.ts builds them). */
export type { Attempt, BoardEntry, DailyStatus };

export interface StartResponse<P> {
  day: string;
  number: number;
  label: string;
  puzzle: P;
  attempt: Attempt;
  serverNow: number;
}

export interface SubmitResponse {
  day: string;
  attempt: Attempt;
  streak: number;
  board: BoardEntry[];
  rank: number | null;
  players: number;
}

export class DailyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Calls /api/daily/<slug>[/<action>] as the guest. Throws DailyRequestError with the server's message. */
export async function dailyRequest<T>(slug: string, action?: "start" | "submit", body?: unknown): Promise<T> {
  let token: string;
  try {
    token = await guestIdToken();
  } catch {
    throw new DailyRequestError("The daily puzzle needs a connection.", 0);
  }
  let response: Response;
  try {
    response = await fetch(`/api/daily/${slug}${action ? `/${action}` : ""}`, {
      method: action ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new DailyRequestError("Can't reach the server. Check your connection.", 0);
  }
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new DailyRequestError(json.error ?? "Something went wrong. Try again.", response.status);
  return json;
}
