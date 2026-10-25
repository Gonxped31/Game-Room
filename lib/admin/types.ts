/** What GET /api/admin/session answers. */
export type AdminSessionResponse = {
  /** False where ADMIN_PASSWORD is unset (e.g. Vercel Preview). */
  enabled: boolean;
  signedIn: boolean;
  /** Signed in only: whether the admin SDK can reach the database, so a bad service-account key shows up here. */
  database?: { ok: true } | { ok: false; error: string };
};
