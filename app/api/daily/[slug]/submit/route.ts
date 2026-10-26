import { NextResponse } from "next/server";
import { dailyRoute, NO_STORE } from "@/lib/daily/server";
import { submitDaily } from "@/lib/daily/service";

/** Body: { day, moves, name }. The server checks the moves solve the day's puzzle and times the solve itself. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: { day?: unknown; moves?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Unreadable request." }, { status: 400, headers: NO_STORE });
  }
  return dailyRoute(request, slug, (ctx) => submitDaily(ctx, { day: body.day, moves: body.moves, name: body.name }));
}
