import { dailyRoute } from "@/lib/daily/server";
import { dailyStatus } from "@/lib/daily/service";

/** Today's daily for this game: the puzzle's line, your attempt, streak and name, and the board (lib/daily/service.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return dailyRoute(request, slug, (ctx) => dailyStatus(ctx));
}
