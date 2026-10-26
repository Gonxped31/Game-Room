// Starts the Firebase Auth + Database emulators and a Next dev server pointed at
// them, prints READY once both are up, and stops both (including the emulators'
// Java process) on Ctrl+C or when this process is killed.
//
//   node .claude/skills/live-test/scripts/dev-against-emulators.mjs [port]
//
// Shell env vars override .env.local, so the app talks to the emulators, never
// to the real Firebase project. Next allows one dev server per project - stop
// any other `npm run dev` first.
import { spawn, execSync } from "node:child_process";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = process.argv[2] ?? "3123";
const PROJECT = "demo-game-room";
const isWindows = process.platform === "win32";

const appEnv = {
  ...process.env,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: `http://127.0.0.1:9000/?ns=${PROJECT}-default-rtdb`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
  // The server routes' firebase-admin (lib/admin/firebaseAdmin.ts): the /admin and daily routes read and
  // write the Database emulator and accept the Auth emulator's guest tokens.
  FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9000",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
};

// Each child's full output goes to its own log file, for when something dies.
const LOG_DIR = mkdtempSync(join(tmpdir(), "game-room-live-"));

const FAILURE = /port taken|EADDRINUSE|Another next dev server is already running|Could not start/i;

const children = [];
let ready = false;

/**
 * Spawns `command` and resolves once its output matches `readyPattern` AND, if
 * given, `probeUrl` answers. The probe matters for Next: it prints "Ready"
 * before checking for another dev server in this project, then exits.
 */
function start(name, command, env, { readyPattern, probeUrl }) {
  const child = spawn(command, { shell: true, env, detached: !isWindows });
  children.push(child);
  const logFile = join(LOG_DIR, `${name.replace(/\W+/g, "-")}.log`);
  return new Promise((resolve, reject) => {
    let exited = false;
    const onData = (data) => {
      const text = data.toString();
      appendFileSync(logFile, text);
      if (FAILURE.test(text)) reject(new Error(`${name}: ${text.trim().split("\n")[0]} - see ${logFile}`));
      if (readyPattern.test(text)) void waitForProbe();
    };
    const waitForProbe = async () => {
      if (!probeUrl) return resolve();
      while (!exited) {
        let status = 0;
        try {
          status = (await fetch(probeUrl)).status;
        } catch {
          // not listening yet
        }
        if (status >= 200 && status < 500) return resolve();
        if (status >= 500) {
          // Usually a Turbopack panic from a corrupted dev cache (a dev server
          // that was force-killed mid-write): stop all dev servers, delete
          // .next/dev, and start again.
          return reject(new Error(`${name}: ${probeUrl} answered ${status} - see ${logFile}. If it shows a Turbopack panic, stop all dev servers and delete .next/dev.`));
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      exited = true;
      const message = `${name} exited (code ${code}) - see ${logFile}`;
      reject(new Error(message));
      if (ready) {
        // Died after READY: take everything down so the failure is visible.
        console.error(`FAILED: ${message}`);
        stopAll();
        process.exit(1);
      }
    });
  });
}

function stopAll() {
  for (const child of children) {
    try {
      if (isWindows) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}
process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

try {
  await start("emulators", `npx firebase emulators:start --only auth,database --project ${PROJECT}`, process.env, {
    readyPattern: /All emulators ready/,
  });
  await start("next dev", `npx next dev -p ${PORT}`, appEnv, { readyPattern: /Ready in/, probeUrl: `http://localhost:${PORT}/` });
  ready = true;
  console.log(`READY http://localhost:${PORT} (Auth emulator :9099, Database emulator :9000) - logs in ${LOG_DIR}`);
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  stopAll();
  process.exit(1);
}
