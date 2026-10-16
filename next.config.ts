import type { NextConfig } from "next";

// A Vercel build (preview or production) must never ship the localStorage
// fallback: it silently can't sync between devices. Fail the build instead,
// naming exactly which Firebase variables are missing. Local builds and
// `next dev` are unaffected - local mode stays available there on purpose.
const FIREBASE_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];
if (process.env.VERCEL) {
  const missing = FIREBASE_ENV_VARS.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing Firebase environment variables for this Vercel build: ${missing.join(", ")}. ` +
        "Set them in Vercel (Project Settings > Environment Variables) for this environment and redeploy - " +
        "without them the app would fall back to local-only mode and never sync between devices.",
    );
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
