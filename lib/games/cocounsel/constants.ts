import type { Role } from "@/lib/session/types";

export const GAME_TITLE = "Co-Counsel";

/** Roles are fixed for the whole case, not rotating per Part like First to Worst's master/guesser. */
export const INVESTIGATOR: Role = "p1";
export const DEFENDANT: Role = "p2";

/** A Part allows this many misses before the judge reveals the correct pair. */
export const MAX_ATTEMPTS_PER_PART = 2;
