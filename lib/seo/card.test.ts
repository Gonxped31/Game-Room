import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "@/lib/i18n/lang";
import { CARD_SIZE, renderCard } from "./card";
import { PREVIEW_ROUTES } from "./previews";

/**
 * Every card renders to a 1200x630 PNG small enough for WhatsApp, which drops
 * preview images over ~300 KB. OG_PREVIEW_DIR=<dir> also writes them there,
 * to look at (docs/link-previews.md).
 */
describe("link-preview cards", () => {
  const out = process.env.OG_PREVIEW_DIR;
  it("render every page's card as a 1200x630 PNG under 300 KB", { timeout: 180_000 }, async () => {
    const sizes: string[] = [];
    for (const { route } of PREVIEW_ROUTES) {
      for (const lang of LANGS) {
        const png = Buffer.from(await (await renderCard(route, lang)).arrayBuffer());
        const at = `${lang} ${route}`;
        expect(png.subarray(1, 4).toString("latin1"), at).toBe("PNG");
        expect([png.readUInt32BE(16), png.readUInt32BE(20)], at).toEqual([CARD_SIZE.width, CARD_SIZE.height]);
        expect(png.length, at).toBeLessThan(300_000);
        sizes.push(`${Math.round(png.length / 1024)} KB  ${at}`);
        if (out) {
          fs.mkdirSync(out, { recursive: true });
          fs.writeFileSync(path.join(out, `${lang}${route === "/" ? "-hub" : route.replace(/\//g, "-")}.png`), png);
        }
      }
    }
    if (out) fs.writeFileSync(path.join(out, "sizes.txt"), sizes.join("\n"));
  });
});
