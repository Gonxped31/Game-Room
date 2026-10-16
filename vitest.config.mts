import { defineConfig } from "vitest/config";

// tests/rules/ needs the Realtime Database emulator, which
// `npm run test:rules` (firebase emulators:exec) starts and advertises via
// FIREBASE_DATABASE_EMULATOR_HOST - plain `npm test` skips those files.
const underEmulator = Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", ...(underEmulator ? [] : ["tests/rules/**"])],
    // Rules test files share one emulator; keep them from racing each other.
    fileParallelism: !underEmulator,
  },
});
