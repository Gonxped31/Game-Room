import { cacheLife } from "next/cache";
import type { Lang } from "@/lib/i18n/lang";
import { CARD_SIZE, renderCard } from "./card";
import { previewFor } from "./previews";

/**
 * What a route's opengraph-image.tsx exports (docs/link-previews.md):
 *
 *   const image = previewImage("/same-page", "en");
 *   export const { alt, size, contentType } = image;
 *   export default image.render;
 *
 * Next turns those into og:image (and, through metadata.ts, twitter:image)
 * with its width, height, type and alt. The PNG is made once, at build: the
 * "use cache" below lets the prerender keep it, so a preview bot never waits
 * on a render.
 */
export function previewImage(route: string, lang: Lang) {
  return {
    alt: previewFor(route, lang).alt,
    size: CARD_SIZE,
    contentType: "image/png" as const,
    render: async () => new Response(await cardPng(route, lang), { headers: { "Content-Type": "image/png" } }),
  };
}

async function cardPng(route: string, lang: Lang): Promise<Uint8Array<ArrayBuffer>> {
  "use cache";
  cacheLife("max");
  return new Uint8Array(await (await renderCard(route, lang)).arrayBuffer());
}
