#!/usr/bin/env node
// Builds each solo game in exports/<slug>/ into one self-contained HTML file,
// downloads/<slug>.html, which only the signed-in admin can download (from
// app/api/admin/downloads/[slug]; never public/, which serves anyone): the game's
// code (three.js included), styles (and Tailwind's base, if the export has a
// tailwind.css) and fonts inlined, nothing fetched while it
// plays, so the file alone plays offline. No hub, rooms or Firebase.
//
// Runs before `next build` (package.json); locally, `npm run export:solo`.
// Uses the Vite that vitest brings. A failure only warns: the site still
// deploys, and /admin says the download isn't in this build.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPORTS = join(repo, "exports");
const OUT = join(repo, "downloads");
// Google Fonts answers woff2 only to a browser it knows supports it.
const FONT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const INLINE_FONTS = /<meta\s+name="inline-fonts"\s+content="([^"]+)"\s*\/?>/;

/** The latin @font-face rules of a Google Fonts stylesheet, each font file inlined as a data: URL. */
async function inlineFonts(cssUrl) {
  const response = await fetch(cssUrl, { headers: { "User-Agent": FONT_USER_AGENT } });
  if (!response.ok) throw new Error(`Google Fonts answered ${response.status}`);
  const css = await response.text();
  const faces = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].filter((m) => m[1] === "latin").map((m) => m[2]);
  if (!faces.length) throw new Error("no latin fonts in the stylesheet");
  const inlined = await Promise.all(
    faces.map(async (face) => {
      const url = face.match(/url\((https:[^)]+)\)/)?.[1];
      if (!url) return face;
      const font = await fetch(url);
      if (!font.ok) throw new Error(`a font file answered ${font.status}`);
      return face.replace(url, `data:font/woff2;base64,${Buffer.from(await font.arrayBuffer()).toString("base64")}`);
    }),
  );
  return inlined.join("\n");
}

/** exports/<slug>/tailwind.css compiled (no utilities, just the base), with the Tailwind that @tailwindcss/turbopack brings. */
async function tailwindBase(file) {
  const { compile } = await import(pathToFileURL(createRequire(join(repo, "package.json")).resolve("@tailwindcss/node")).href);
  const compiler = await compile(await readFile(file, "utf8"), { base: dirname(file), onDependency() {} });
  return compiler.build([]);
}

/** Vite's build of one export (index.html + one script + one stylesheet), merged into a single HTML page. */
async function exportGame(slug) {
  const { build } = await import("vite");
  const root = join(EXPORTS, slug);
  const outDir = await mkdtemp(join(tmpdir(), `solo-export-${slug}-`));
  try {
    await build({
      configFile: false,
      root,
      logLevel: "warn",
      resolve: { alias: { "@": repo } },
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        outDir,
        emptyOutDir: true,
        assetsInlineLimit: () => true,
        cssCodeSplit: false,
        modulePreload: false,
        reportCompressedSize: false,
        // One script by design (three.js alone is ~600 kB).
        chunkSizeWarningLimit: 10_000,
        rolldownOptions: {
          output: { codeSplitting: false },
          // Next's "use client" means nothing here.
          onwarn(warning, warn) {
            if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
          },
        },
      },
    });
    let html = await readFile(join(outDir, "index.html"), "utf8");
    const assets = await readdir(join(outDir, "assets"));
    const unexpected = assets.filter((file) => !/\.(js|css)$/.test(file));
    if (unexpected.length) throw new Error(`assets left outside the page: ${unexpected.join(", ")}`);
    for (const file of assets) {
      const code = await readFile(join(outDir, "assets", file), "utf8");
      const tag = file.endsWith(".js")
        ? new RegExp(`<script[^>]*src="[^"]*${file.replace(".", "\\.")}"[^>]*></script>`)
        : new RegExp(`<link[^>]*href="[^"]*${file.replace(".", "\\.")}"[^>]*>`);
      if (!tag.test(html)) throw new Error(`${file} isn't referenced from the page`);
      // A function replacement, so "$&" in the code stays literal; "</script" inside a string would end the tag.
      html = html.replace(tag, () =>
        file.endsWith(".js") ? `<script type="module">${code.replaceAll("</script", "<\\/script")}</script>` : `<style>${code.replaceAll("</style", "<\\/style")}</style>`,
      );
    }
    // Before the game's own styles, as on the site.
    const tailwind = join(root, "tailwind.css");
    if (existsSync(tailwind)) {
      const base = await tailwindBase(tailwind);
      html = html.replace("</title>", () => `</title>
<style>${base}</style>`);
    }
    const fonts = html.match(INLINE_FONTS);
    if (fonts) {
      try {
        const faces = await inlineFonts(fonts[1].replaceAll("&amp;", "&"));
        html = html.replace(INLINE_FONTS, () => `<style>${faces}</style>`);
      } catch (error) {
        // The stacks fall back to system fonts; the game plays the same.
        console.warn(`export-solo: ${slug}: fonts not inlined (${error.message}); the file uses system fonts.`);
        html = html.replace(INLINE_FONTS, "");
      }
    }
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, `${slug}.html`), html);
    return Buffer.byteLength(html);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

const slugs = (await readdir(EXPORTS, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
for (const slug of slugs) {
  try {
    const bytes = await exportGame(slug);
    console.log(`export-solo: downloads/${slug}.html (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  } catch (error) {
    console.warn(`export-solo: ${slug} not exported: ${error.stack ?? error}`);
  }
}
