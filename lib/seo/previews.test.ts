import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DAILY_GAMES } from "@/lib/daily/games";
import { ALL_GAMES, gamePath } from "@/lib/games/registry";
import { LANGS, localizePath } from "@/lib/i18n/lang";
import { pageMetadata } from "./metadata";
import { DAILY_SLUGS, INVITE_ROUTES, PREVIEW_ROUTES, previewFor } from "./previews";

const app = path.resolve(__dirname, "../../app");

/** Every public page route under app/ ("/same-page/invite"), as lib/i18n/lang.test.ts walks them. */
function pageRoutes(dir: string, base = ""): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...pageRoutes(path.join(dir, entry.name), `${base}/${entry.name}`));
    else if (entry.name === "page.tsx") found.push(base || "/");
  }
  return found;
}
const PUBLIC = pageRoutes(app).filter((r) => !/^\/(fr|admin|api)(\/|$)/.test(r));

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
const dirOf = (route: string) => path.join(app, ...localizePath(route, "en").split("/").filter(Boolean));
const frDirOf = (route: string) => path.join(app, "fr", ...route.split("/").filter(Boolean));

describe("link previews (docs/link-previews.md)", () => {
  it("cover exactly the public pages", () => {
    expect(PREVIEW_ROUTES.map((p) => p.route).sort()).toEqual([...PUBLIC].sort());
  });

  it("give every page a title, a one-line description, a tagline and an alt in both languages", () => {
    for (const { route } of PREVIEW_ROUTES) {
      for (const lang of LANGS) {
        const p = previewFor(route, lang);
        const at = `${lang} ${route}`;
        for (const text of [p.title, p.ogTitle, p.description, p.tagline, p.alt]) expect(text.trim(), at).not.toBe("");
        expect(p.description.length, `${at}: ${p.description}`).toBeLessThanOrEqual(110);
        expect(p.description, at).not.toMatch(/\n/);
        expect(p.ogTitle.length, at).toBeLessThanOrEqual(60);
      }
      // French copy is French: the two languages differ wherever there's a sentence.
      expect(previewFor(route, "fr").description, route).not.toBe(previewFor(route, "en").description);
    }
  });

  it("use French typography in French", () => {
    for (const { route } of PREVIEW_ROUTES) {
      const p = previewFor(route, "fr");
      for (const text of [p.ogTitle, p.description, p.badge ?? "", p.tagline, p.alt]) expect(text, route).not.toMatch(/[^ ]:|[^ ][?!;]/);
    }
  });

  it("have an invite page, with its invite message, for every game with rooms", () => {
    expect(INVITE_ROUTES.sort()).toEqual(ALL_GAMES.map((g) => `${gamePath(g.slug)}/invite`).sort());
    for (const route of INVITE_ROUTES) {
      const slug = PREVIEW_ROUTES.find((p) => p.route === route)?.slug;
      const title = ALL_GAMES.find((g) => g.slug === slug)?.title ?? "?";
      expect(previewFor(route, "en").ogTitle).toBe(`You're invited to a ${title} room`);
      expect(previewFor(route, "fr").ogTitle).toBe(`On t'invite dans un salon ${title}`);
      expect(pageMetadata(route, "en").robots).toEqual({ index: false, follow: true });
    }
  });

  it("know which solo pages hold a daily puzzle", () => {
    expect([...DAILY_SLUGS].sort()).toEqual(Object.keys(DAILY_GAMES).sort());
  });

  it("give each page its own URL, hreflang links and locale", () => {
    const meta = pageMetadata("/same-page/invite", "fr");
    expect(meta.alternates?.canonical).toBe("/fr/same-page/invite");
    expect(meta.alternates?.languages).toEqual({ en: "/same-page/invite", fr: "/fr/same-page/invite", "x-default": "/same-page/invite" });
    expect(meta.openGraph).toMatchObject({ url: "/fr/same-page/invite", locale: "fr_CA", alternateLocale: ["en_CA"], siteName: "Partyfox" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(pageMetadata("/", "fr").alternates?.canonical).toBe("/fr");
  });

  it("are wired into every page in both languages: its metadata and its card image", () => {
    const missing: string[] = [];
    for (const { route } of PREVIEW_ROUTES) {
      for (const lang of LANGS) {
        const dir = lang === "en" ? dirOf(route) : frDirOf(route);
        const call = `("${route}", "${lang}")`;
        // The root layout holds the English hub's; every other page has its own layout or (invites) page.
        const files = route === "/" && lang === "en" ? [path.join(app, "layout.tsx")] : [path.join(dir, "layout.tsx"), path.join(dir, "page.tsx")];
        if (!files.some((f) => read(f).includes(`pageMetadata${call}`))) missing.push(`${lang} ${route}: pageMetadata${call} in its layout`);
        if (!read(path.join(dir, "opengraph-image.tsx")).includes(`previewImage${call}`)) missing.push(`${lang} ${route}: opengraph-image.tsx calling previewImage${call}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
