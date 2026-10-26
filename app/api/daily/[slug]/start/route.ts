import { dayKey } from "@/lib/daily/day";
import { connectionHash, dailyRoute } from "@/lib/daily/server";
import { startDaily } from "@/lib/daily/service";

/** Starts (or resumes) today's attempt and hands out the puzzle; the server's clock starts here. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return dailyRoute(request, slug, (ctx) => startDaily(ctx, connectionHash(request, dayKey(ctx.now))));
}
