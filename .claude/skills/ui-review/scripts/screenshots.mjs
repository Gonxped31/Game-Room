// Screenshots pages as real devices: iPhones in WebKit (Safari's engine), an
// Android phone, the hub's 760px breakpoint edge, and a desktop window. Also
// flags horizontal overflow and browser console errors on every shot.
//
//   node .claude/skills/ui-review/scripts/screenshots.mjs [pages...] [options]
//
//   pages            page names without a leading slash - "hub" (the home page),
//                    "same-page", "cocounsel", "same-page#k3m9pq" - or full URLs (default: hub).
//                    No leading "/": Git Bash rewrites "/same-page" into a Windows path.
//   --base=URL       prefix for paths (default http://localhost:3123, the emulator-backed
//                    server from the live-test skill - never the real Firebase project)
//   --profiles=a,b   subset of: iphone-se, iphone, android, edge-760, desktop (default: all)
//   --dark           also capture Co-Counsel pages in its dark theme (its own toggle, in localStorage)
//   --reduced-motion emulate prefers-reduced-motion: reduce
//   --full-page      capture the whole scrollable page, not just the viewport
//   --wait=MS        settle time after load before capturing (default 2000)
//   --out=DIR        output folder (default: a fresh temp folder)
//
// Exits 1 if any shot overflows horizontally or logs a console error.
import { chromium, devices, webkit } from "playwright";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The device set. iPhones run in WebKit (Safari's engine); the rest in Chromium. */
export const PROFILES = {
  "iphone-se": { browser: "webkit", options: devices["iPhone SE (3rd gen)"] }, // 375px - FTW's 5-card hand must fit here
  iphone: { browser: "webkit", options: devices["iPhone 16"] },
  android: { browser: "chromium", options: devices["Pixel 8"] },
  "edge-760": { browser: "chromium", options: { viewport: { width: 760, height: 900 } } }, // the hub's own breakpoint
  desktop: { browser: "chromium", options: { viewport: { width: 1280, height: 800 } } },
};

const launched = {};
/** Shared browsers per engine; call closeBrowsers() when done. */
export async function browserFor(engine) {
  launched[engine] ??= await (engine === "webkit" ? webkit : chromium).launch();
  return launched[engine];
}
export async function closeBrowsers() {
  await Promise.all(Object.values(launched).map((b) => b.close()));
}

/** A fresh context (= a fresh guest ID) for a profile, plus extra context options. */
export async function newProfileContext(profileName, extra = {}) {
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Unknown profile "${profileName}" - use one of ${Object.keys(PROFILES).join(", ")}`);
  const browser = await browserFor(profile.browser);
  return browser.newContext({ ...profile.options, ...extra });
}

function parseArgs(argv) {
  const opts = { paths: [], base: "http://localhost:3123", profiles: Object.keys(PROFILES), dark: false, reducedMotion: false, fullPage: false, wait: 2000, out: null };
  for (const arg of argv) {
    const [key, value] = arg.split(/=(.*)/s);
    if (key === "--base") opts.base = value.replace(/\/$/, "");
    else if (key === "--profiles") opts.profiles = value.split(",").map((s) => s.trim());
    else if (key === "--dark") opts.dark = true;
    else if (key === "--reduced-motion") opts.reducedMotion = true;
    else if (key === "--full-page") opts.fullPage = true;
    else if (key === "--wait") opts.wait = Number(value);
    else if (key === "--out") opts.out = value;
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else opts.paths.push(arg);
  }
  if (!opts.paths.length) opts.paths.push("hub");
  return opts;
}

/** "hub" -> base + "/", "same-page" (or "/same-page") -> base + "/same-page", full URLs untouched. */
function toUrl(page, base) {
  if (/^https?:/.test(page)) return page;
  if (/^[A-Za-z]:[\\/]/.test(page)) {
    throw new Error(`"${page}" looks like a path rewritten by Git Bash - pass page names without a leading slash (e.g. "same-page", "hub").`);
  }
  const path = page === "hub" ? "" : page.replace(/^\//, "");
  return `${base}/${path}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = opts.out ?? mkdtempSync(join(tmpdir(), "game-room-ui-"));
  mkdirSync(outDir, { recursive: true });
  const problems = [];

  for (const path of opts.paths) {
    const url = toUrl(path, opts.base);
    const slug = new URL(url).pathname.replace(/^\/|\/$/g, "").replace(/\W+/g, "-") || "hub";
    for (const profileName of opts.profiles) {
      // Only Co-Counsel has a dark theme.
      const themes = opts.dark && new URL(url).pathname.startsWith("/cocounsel") ? ["light", "dark"] : ["light"];
      for (const theme of themes) {
        const context = await newProfileContext(profileName, opts.reducedMotion ? { reducedMotion: "reduce" } : {});
        if (theme === "dark") {
          await context.addInitScript(() => {
            try {
              window.localStorage.setItem("cocounsel-theme", "dark");
            } catch {
              // storage unavailable
            }
          });
        }
        const page = await context.newPage();
        const errors = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto(url, { waitUntil: "load" });
        await page.waitForTimeout(opts.wait);
        // Hide the Next.js dev-tools button, which would cover content in every shot.
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const file = join(outDir, `${slug}__${profileName}${theme === "dark" ? "__dark" : ""}.png`);
        await page.screenshot({ path: file, fullPage: opts.fullPage });

        const notes = [];
        if (overflow > 1) notes.push(`horizontal overflow ${overflow}px`);
        if (errors.length) notes.push(`${errors.length} console error(s): ${errors[0]}`);
        if (notes.length) problems.push(`${slug} @ ${profileName}${theme === "dark" ? " (dark)" : ""}: ${notes.join("; ")}`);
        console.log(`${notes.length ? "!" : "✓"} ${file}${notes.length ? `  <- ${notes.join("; ")}` : ""}`);
        await context.close();
      }
    }
  }

  await closeBrowsers();
  console.log(`\nScreenshots in ${outDir}`);
  if (problems.length) {
    console.log(`\nPROBLEMS:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(`FAILED: ${error.message}`);
    await closeBrowsers();
    process.exitCode = 1;
  });
}
