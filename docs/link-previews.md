# Link previews

Paste a Partyfox link into WhatsApp, iMessage, Messenger, Discord, Slack, X,
Facebook or Reddit and it unfurls into a card: the site name **Partyfox**, a
title, one line of description and a 1200×630 image. Every public page has
one, in English and in French (the `/fr/...` link carries the language;
preview bots send none).

## Where things live

| What | Where |
| :--- | :--- |
| The words: titles, one-line descriptions, the image's pill and line, alt text | `lib/seo/previews.ts` (`previewFor(route, lang)`) |
| The metadata: title, description, canonical + hreflang, Open Graph, X card | `lib/seo/metadata.ts` (`pageMetadata(route, lang)`) |
| The images (next/og `ImageResponse`, one look per game) | `lib/seo/card.tsx`; fonts in `lib/seo/fonts/` (OFL) |
| A route's image file | `app/<route>/opengraph-image.tsx` → `previewImage(route, lang)` (`lib/seo/image.ts`) |
| A route's metadata | its `layout.tsx` (the hub's: the root layout; French: `app/fr/layout.tsx`); invite pages export it from `page.tsx` |
| robots.txt, sitemap.xml | `app/robots.ts`, `app/sitemap.ts` |

`route` is always the English route (`"/same-page/invite"`); the French twin
calls the same function with `"fr"`.

## The pages

- **Hub** (`/`): Partyfox and its tagline.
- **Each game's page** (`gamePath(slug)`): the game's name, a one-line pitch
  (`PITCH`), its player-count tag and registry `shortDescription` on the image.
- **Invites** (`<game page>/invite`): where `inviteUrl` (`lib/share.ts`) sends
  invitees. The page is the room page again (a one-line re-export); its card
  says "You're invited to a Same Page room" / "On t'invite dans un salon Same
  Page". It never shows room data: the code stays in the `#hash`, which no bot
  sends. Invite pages are `noindex` (but not blocked in robots.txt: X's bot
  obeys it, and a blocked page gets no card).
- **Solo pages** (`solo.path`): Night Highway solo, and the two daily puzzles
  (`/regions`, `/borderrun/solo`), whose card says "today's puzzle". Daily
  share links go to these same pages (`dailyShareUrl`); there are no dated
  daily pages, so the card can't show a given day's grid.

## The images

- 1200×630 PNG, 55-100 KB each (WhatsApp drops images over ~300 KB);
  `lib/seo/card.test.ts` renders every card and checks size and dimensions.
- The wordmark, pill, name and line sit in the middle 640 px, so square crops
  (small thumbnails) keep them; each game's motif stays at the edges.
- Colors from the registry and each game's page; the name in the game's
  title face. Fonts are vendored subsets (title faces: Basic Latin only,
  enough for the names; Fredoka: Latin + French), read from disk, never
  fetched: Google Fonts' CSS API with `text=` gives static TTF subsets.
  Fredoka has no narrow no-break space, so the card swaps in a no-break one.
- Rendered once at build: `previewImage` wraps the render in `"use cache"`
  with `cacheLife("max")`, so the prerender keeps the PNG.
- To look at them: `OG_PREVIEW_DIR=<dir> npx vitest run lib/seo/card.test.ts`
  writes every card to `<dir>`.

## Adding a game (or a page)

1. A `PITCH` entry in `lib/seo/previews.ts` (both languages), a `SOLO` entry
   if it has a solo page, and a theme + motif in `lib/seo/card.tsx` (without
   one it gets a plain card in its registry colors).
2. Per route, English and French: `pageMetadata(route, lang)` in the layout
   (or invite page), and an `opengraph-image.tsx` calling
   `previewImage(route, lang)` (copy a neighbour's: four lines).
3. The room game's invite page: `app/<route>/invite/page.tsx` and its twin.

`lib/seo/previews.test.ts` fails until every public page has its words, its
metadata and its image file in both languages, with descriptions of at most
110 characters and French typography.

## Checking after a deploy

Previews are cached by each app (WhatsApp and Facebook for days), so check a
new or changed card with a debugger rather than by pasting into a chat:

- <https://www.opengraph.xyz> or <https://metatags.io>: paste a URL, see the
  cards for most apps.
- Facebook / Messenger / WhatsApp: <https://developers.facebook.com/tools/debug/>
  ("Scrape Again" refreshes their cache).
- X: post preview in the composer; LinkedIn: Post Inspector.
- Discord / Slack: paste in a private channel; Discord re-fetches a link
  after about a day, Slack caches ~30 min.
- Try `/`, `/fr`, a game page, `/same-page/invite?utm_source=invite#abc`
  (the card must say "You're invited"), and `/regions`.
- `curl -s https://partyfox.io/fr/lasthop | grep -o '<meta[^>]*og:[^>]*>'`
  shows the tags; open the `og:image` URL to see the PNG.
