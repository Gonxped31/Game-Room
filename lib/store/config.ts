import type { FirebaseOptions } from "firebase/app";

/**
 * The Firebase web config, read from the five NEXT_PUBLIC_FIREBASE_* env vars
 * (inlined into the client bundle at build time). Kept free of any `firebase`
 * runtime import so server components (e.g. the local-mode banner in the
 * root layout) can check it without pulling in the SDK.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every((v) => typeof v === "string" && v.length > 0);

/**
 * True when any Firebase var is missing: the app then runs on the
 * localStorage fallback, which only syncs tabs within ONE browser profile -
 * never separate browsers, profiles or devices. A Vercel build refuses to
 * ship this mode at all (see next.config.ts); locally it's shown with a
 * fixed "Local mode" banner so it can't be mistaken for a sync bug.
 */
export const isLocalMode = !hasFirebaseConfig;
