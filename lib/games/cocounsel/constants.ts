import type { Role } from "@/lib/session/types";

export const GAME_TITLE = "Co-Counsel";

/** Roles are fixed for the whole case, not rotating per Part like First to Worst's master/guesser. */
export const INVESTIGATOR: Role = "p1";
export const DEFENDANT: Role = "p2";

/**
 * Misses allowed across the WHOLE case (not per Part - a deliberate deviation
 * from the original design doc's "2 attempts per Part", per user request).
 * The budget carries over between Parts; once it's used up, the judge reveals
 * the correct pair immediately on the next miss, even if that's the very
 * first attempt of a later Part.
 */
export const MAX_CASE_ATTEMPTS = 3;
