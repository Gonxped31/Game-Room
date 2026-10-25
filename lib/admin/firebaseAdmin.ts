import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

/**
 * The privileged database handle for /api/admin/* routes only - it bypasses
 * database.rules.json entirely, so it must never reach client code.
 *
 * - Production: `FIREBASE_SERVICE_ACCOUNT` holds the service-account JSON key
 *   (Firebase console > Project settings > Service accounts), set on Vercel
 *   Production only.
 * - Emulators: `FIREBASE_DATABASE_EMULATOR_HOST` makes the SDK talk to the
 *   local Database emulator, which needs no credentials.
 *
 * The database is the one the app uses (`NEXT_PUBLIC_FIREBASE_DATABASE_URL`).
 */

const APP_NAME = "game-room-admin";

export class AdminConfigError extends Error {}

function adminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new AdminConfigError("NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set.");

  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    return initializeApp({ databaseURL, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, APP_NAME);
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT is not set.");
  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT is not valid JSON (paste the whole key file).");
  }
  return initializeApp({ credential: cert(serviceAccount), databaseURL }, APP_NAME);
}

export function adminDb(): Database {
  return getDatabase(adminApp());
}
