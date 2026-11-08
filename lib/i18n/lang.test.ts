import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { LANG_HEAD_SCRIPT } from "./headScript";
import { defaultLang, langOfPath, localizePath, unlocalizedPath } from "./lang";
import { formatNumber, plural, texts } from "./text";

describe("langOfPath", () => {
  it("is French only under /fr", () => {
    expect(langOfPath("/fr")).toBe("fr");
    expect(langOfPath("/fr/same-page")).toBe("fr");
    expect(langOfPath("/")).toBe("en");
    expect(langOfPath("/same-page")).toBe("en");
    expect(langOfPath("/frisbee")).toBe("en");
  });
});

describe("localizePath", () => {
  it("adds and removes the /fr prefix, keeping the query and the room code", () => {
    expect(localizePath("/", "fr")).toBe("/fr");
    expect(localizePath("/same-page#abc123", "fr")).toBe("/fr/same-page#abc123");
    expect(localizePath("/regions?utm_source=daily", "fr")).toBe("/fr/regions?utm_source=daily");
    expect(localizePath("/fr/same-page#abc123", "en")).toBe("/same-page#abc123");
    expect(localizePath("/fr", "en")).toBe("/");
    expect(localizePath("/fr/regions", "fr")).toBe("/fr/regions");
  });

  it("leaves /admin, /api, full URLs and hash links alone", () => {
    expect(localizePath("/admin", "fr")).toBe("/admin");
    expect(localizePath("/api/daily/regions", "fr")).toBe("/api/daily/regions");
    expect(localizePath("https://example.com/x", "fr")).toBe("https://example.com/x");
    expect(localizePath("#rules", "fr")).toBe("#rules");
    expect(localizePath("//cdn.example.com/x", "fr")).toBe("//cdn.example.com/x");
  });

  it("unlocalizedPath strips only a real /fr segment", () => {
    expect(unlocalizedPath("/fr/lasthop#x")).toBe("/lasthop#x");
    expect(unlocalizedPath("/frisbee")).toBe("/frisbee");
  });
});

describe("defaultLang", () => {
  it("is French only when French comes first", () => {
    expect(defaultLang(["fr-CA", "en"])).toBe("fr");
    expect(defaultLang(["en-US", "fr"])).toBe("en");
    expect(defaultLang(undefined)).toBe("en");
  });
});

describe("text helpers", () => {
  it("plural follows each language's rule for 0 and 1", () => {
    expect(plural("en", 0, "point", "points")).toBe("points");
    expect(plural("fr", 0, "point", "points")).toBe("point");
    expect(plural("en", 1, "point", "points")).toBe("point");
    expect(plural("fr", 2, "point", "points")).toBe("points");
  });

  it("formats numbers per language", () => {
    expect(formatNumber("en", 12500)).toBe("12,500");
    expect(formatNumber("fr", 12500).replace(/\s/g, " ")).toBe("12 500");
  });

  it("texts returns both halves as given", () => {
    const t = texts({ en: { hi: "Hi", n: (k: number) => `${k}` }, fr: { hi: "Salut", n: (k) => `${k}` } });
    expect(t.fr.hi).toBe("Salut");
    expect(t.en.n(3)).toBe("3");
  });
});

/** Runs the pre-paint script against a fake page; returns where it navigated (null: stayed) and <html lang>. */
function runHead({ path: pathname, choice = null, browser = "en-US", search = "", hash = "" }: { path: string; choice?: string | null; browser?: string; search?: string; hash?: string }) {
  let replaced: string | null = null;
  const html = { lang: "en" };
  runInNewContext(LANG_HEAD_SCRIPT, {
    location: { pathname, search, hash, replace: (to: string) => (replaced = to) },
    localStorage: { getItem: () => choice },
    navigator: { languages: [browser], language: browser },
    document: { documentElement: html },
  });
  return { replaced, lang: html.lang };
}

describe("the pre-paint language script", () => {
  it("sends a French browser with no choice from an English link to its French twin, keeping ?tags and #room", () => {
    expect(runHead({ path: "/same-page", browser: "fr-CA", search: "?utm_source=tiktok", hash: "#abc123" }).replaced).toBe("/fr/same-page?utm_source=tiktok#abc123");
    expect(runHead({ path: "/", browser: "fr" }).replaced).toBe("/fr");
  });

  it("keeps an English browser on English links, and anyone with no choice on /fr links", () => {
    expect(runHead({ path: "/same-page" }).replaced).toBeNull();
    const fr = runHead({ path: "/fr/regions" });
    expect(fr.replaced).toBeNull();
    expect(fr.lang).toBe("fr");
  });

  it("lets an explicit choice win in both directions", () => {
    expect(runHead({ path: "/fr/lasthop", choice: "en", hash: "#x" }).replaced).toBe("/lasthop#x");
    expect(runHead({ path: "/fr", choice: "en" }).replaced).toBe("/");
    expect(runHead({ path: "/lasthop", choice: "fr", browser: "en-US" }).replaced).toBe("/fr/lasthop");
    expect(runHead({ path: "/same-page", choice: "en", browser: "fr-CA" }).replaced).toBeNull();
  });

  it("never touches /admin or /api", () => {
    expect(runHead({ path: "/admin", choice: "fr" }).replaced).toBeNull();
    expect(runHead({ path: "/api/daily/regions", browser: "fr" }).replaced).toBeNull();
  });
});

/** Every page route under app/, as "same-page/solo" style paths ("" is the hub). */
function routes(dir: string, base = ""): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...routes(path.join(dir, entry.name), base ? `${base}/${entry.name}` : entry.name));
    else if (entry.name === "page.tsx") found.push(base);
  }
  return found;
}

describe("French twins", () => {
  const app = path.resolve(__dirname, "../../app");
  const english = routes(app).filter((r) => !/^(fr|admin|api)(\/|$)/.test(r));

  it("every public page has a French twin at app/fr/<route>/page.tsx", () => {
    const missing = english.filter((r) => !fs.existsSync(path.join(app, "fr", r, "page.tsx")));
    expect(missing, "add a one-line re-export for each (docs/i18n.md)").toEqual([]);
  });

  it("every public page's own layout has a French twin too", () => {
    const missing = english.filter((r) => r && fs.existsSync(path.join(app, r, "layout.tsx")) && !fs.existsSync(path.join(app, "fr", r, "layout.tsx")));
    expect(missing).toEqual([]);
  });
});
