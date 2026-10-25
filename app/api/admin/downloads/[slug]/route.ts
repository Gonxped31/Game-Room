import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { SOLO_DOWNLOADS_DIR, SOLO_GAMES, soloDownloadName } from "@/lib/games/soloDownloads";

/**
 * A solo game as one HTML file that plays offline (scripts/export-solo.mjs
 * builds it before `next build`; next.config.ts ships it with this route).
 * Only to the signed-in admin; HEAD says whether this build has it.
 */
async function find(slug: string) {
  // Only a solo game's slug picks a file, so nothing else on disk can be asked for.
  const game = SOLO_GAMES.find((entry) => entry.slug === slug);
  if (!game) return null;
  const file = join(process.cwd(), SOLO_DOWNLOADS_DIR, `${game.slug}.html`);
  return (await stat(file).catch(() => null))?.isFile() ? { game, file } : null;
}

const NOT_BUILT = { error: "That download isn't in this build." };

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const found = await find((await params).slug);
  if (!found) return NextResponse.json(NOT_BUILT, { status: 404, headers: NO_STORE });
  const name = soloDownloadName(found.game);
  return new Response(await readFile(found.file), {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const refused = await refuseUnlessAdmin();
  if (refused) return new Response(null, { status: refused.status, headers: NO_STORE });
  const found = await find((await params).slug);
  return new Response(null, { status: found ? 200 : 404, headers: NO_STORE });
}
