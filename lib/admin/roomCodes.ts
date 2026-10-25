import { isRoomCode } from "@/lib/session/room";

/** The most rooms one bulk request (close or delete) may take. */
export const MAX_ROOMS_PER_REQUEST = 500;

/**
 * The room codes in a bulk close or delete request's body (`{codes: [...]}`),
 * without duplicates, or the reason it's refused.
 */
export function parseRoomCodes(body: unknown): { codes: string[] } | { error: string } {
  const codes = (body as { codes?: unknown } | null)?.codes;
  if (!Array.isArray(codes) || codes.length === 0) return { error: "No rooms given." };
  if (!codes.every((code) => typeof code === "string" && isRoomCode(code))) return { error: "Not a room code." };
  const unique = [...new Set(codes as string[])];
  if (unique.length > MAX_ROOMS_PER_REQUEST) return { error: `At most ${MAX_ROOMS_PER_REQUEST} rooms at once.` };
  return { codes: unique };
}
