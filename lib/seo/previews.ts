import { ALL_GAMES, APP_TITLE, type GameEntry, gameBySlug, gamePath, gameText } from "@/lib/games/registry";
import type { Lang } from "@/lib/i18n/lang";
import { texts } from "@/lib/i18n/text";

/**
 * Every public page's link preview, in both languages (docs/link-previews.md):
 * the words WhatsApp, iMessage, Discord, Slack, X... show when a Partyfox link
 * is pasted, and the words on its card image (lib/seo/card.tsx). Each route's
 * layout (or invite page) calls `pageMetadata` (lib/seo/metadata.ts) and its
 * opengraph-image.tsx calls `previewImage` (lib/seo/image.ts) with the route.
 *
 * The route list comes from the registry: the hub, each game's room page and
 * its invite page (`<room page>/invite`, where `inviteUrl` sends invitees),
 * and each solo page. Adding a game means one `PITCH` entry here (and a `SOLO`
 * one if it has a solo page); lib/seo/previews.test.ts says what's missing.
 * Never put room data here: the room code stays in the #hash, which no
 * preview bot ever sends.
 */

export type PreviewKind = "hub" | "game" | "invite" | "solo" | "daily";

export interface Preview {
  /** The English route ("/same-page/invite"); `localizePath` gives the French one. */
  route: string;
  kind: PreviewKind;
  /** The game's registry slug; undefined for the hub. */
  slug?: string;
  /** The browser tab's title: the brand or the game's name. */
  title: string;
  /** The preview's title (og:title). */
  ogTitle: string;
  /** One short line (og:description), at most ~110 characters. */
  description: string;
  /** The card image's pill above the title (players, "You're invited!", "Daily puzzle"). */
  badge?: string;
  /** The card image's line under the title. */
  tagline: string;
  /** The card image's alt text (og:image:alt). */
  alt: string;
}

/** The hub's words. */
const HUB = texts({
  en: {
    description: "Party games for two or more, played through a link. No sign-up, nothing to install.",
    tagline: "Party games for two or more, played through a link.",
  },
  fr: {
    description: "Des jeux entre amis, à deux ou plus, par un simple lien. Sans compte, rien à installer.",
    tagline: "Des jeux entre amis, à deux ou plus, par un simple lien.",
  },
});

/**
 * Each game's one-line pitch (og:description of its page and its invite), by
 * registry slug. The card image shows the registry's shortDescription instead.
 */
const PITCH = texts({
  en: {
    buzzerquiz: "A quiz for 2 to 4. Buzz in first: every wrong answer gets struck out, and the question is worth less.",
    wordscramble: "Two teams race the clock to unscramble words. Hints help, but they cost points.",
    lasthop: "A 1v1 duel on a track or a grid: hop your pieces forward and make the last move.",
    nighthighway: "Drive through the night with friends, live on the same road. Who makes it furthest?",
    ftw: "Rank five things from best to worst, then guess how your partner ranked them.",
    cocounsel: "A cooperative mystery for two. Each of you knows half the story: talk it out to crack the case.",
    regions: "Race on the same chess grids: one piece per row, column and colour. The fastest time wins.",
    borderrun: "Race to link two countries by land, around the closed borders. The fastest time wins.",
  },
  fr: {
    buzzerquiz: "Un quiz de 2 à 4 joueurs. Buzze en premier : chaque mauvaise réponse est barrée, et la question vaut moins.",
    wordscramble: "Deux équipes, un chrono, des lettres en vrac. Les indices aident, mais coûtent des points.",
    lasthop: "Un duel à deux sur une piste ou une grille : avance tes pions et joue le dernier coup.",
    nighthighway: "Prends la route de nuit entre amis, en direct sur la même voie. Qui ira le plus loin ?",
    ftw: "Classe cinq choses de la meilleure à la pire, puis devine l'ordre choisi par l'autre.",
    cocounsel: "Un mystère à résoudre à deux : à toi une moitié de l'histoire, à l'autre le reste.",
    regions: "Fais la course sur les mêmes grilles d'échecs : une pièce par rangée, colonne et couleur.",
    borderrun: "Relie deux pays par la terre en contournant les frontières fermées, plus vite que les autres.",
  },
});

type PitchSlug = keyof (typeof PITCH)["en"];

/**
 * The solo pages' words, by registry slug (the page is the game's `solo.path`).
 * `title` is the preview title, `badge` the image's pill.
 */
const SOLO = texts({
  en: {
    nighthighway: {
      title: "Night Highway · Solo",
      badge: "Solo",
      description: "Just you and the night road. Drive as far as you can and beat your best distance.",
      tagline: "Just you and the road.",
    },
    regions: {
      title: "Rank & File: today's puzzle",
      badge: "Daily puzzle",
      description: "A new chess-piece puzzle every day, the same for everyone. One piece per row, column and colour.",
      tagline: "A piece in every row, column and colour.",
    },
    borderrun: {
      title: "Detour: today's route",
      badge: "Daily route",
      description: "A new route every day, the same for everyone: link two countries by land, around the closed borders.",
      tagline: "Link two countries by land.",
    },
  },
  fr: {
    nighthighway: {
      title: "Night Highway · Solo",
      badge: "Solo",
      description: "Toi et la route de nuit, rien d'autre. Va le plus loin possible et bats ton record.",
      tagline: "Toi et la route, rien d'autre.",
    },
    regions: {
      title: "Rank & File : le défi du jour",
      badge: "Défi du jour",
      description: "Chaque jour, une nouvelle grille d'échecs, la même pour tous : une pièce par rangée, colonne et couleur.",
      tagline: "Une pièce par rangée, colonne et couleur.",
    },
    borderrun: {
      title: "Detour : le défi du jour",
      badge: "Défi du jour",
      description: "Chaque jour, un nouveau parcours, le même pour tous : relie deux pays par la terre.",
      tagline: "Relie deux pays par la terre.",
    },
  },
});

type SoloSlug = keyof (typeof SOLO)["en"];

/** The games whose solo page holds a daily puzzle (lib/daily/games.ts; the test keeps them in step). */
export const DAILY_SLUGS: readonly string[] = ["regions", "borderrun"];

/** The invite pages' words around the game's name. */
const INVITE = texts({
  en: {
    title: (game: string) => `You're invited to a ${game} room`,
    badge: "You're invited!",
    alt: (game: string) => `${game}: you're invited to a room`,
  },
  fr: {
    title: (game) => `On t'invite dans un salon ${game}`,
    badge: "On t'invite !",
    alt: (game) => `${game} : on t'invite dans un salon`,
  },
});

/** "Name: line" in each language's punctuation. */
const labelled = (lang: Lang, name: string, line: string) => `${name}${lang === "fr" ? " :" : ":"} ${line}`;

const pitchOf = (game: GameEntry, lang: Lang): string => {
  const pitch = PITCH[lang][game.slug as PitchSlug];
  if (!pitch) throw new Error(`No link-preview pitch for ${game.slug} (lib/seo/previews.ts)`);
  return pitch;
};

/** Every public route's preview kind and game, from the registry (English routes). */
export const PREVIEW_ROUTES: { route: string; kind: PreviewKind; slug?: string }[] = [
  { route: "/", kind: "hub" },
  ...ALL_GAMES.flatMap((game) => [
    { route: gamePath(game.slug), kind: "game" as const, slug: game.slug },
    { route: `${gamePath(game.slug)}/invite`, kind: "invite" as const, slug: game.slug },
    ...(game.solo ? [{ route: game.solo.path, kind: DAILY_SLUGS.includes(game.slug) ? ("daily" as const) : ("solo" as const), slug: game.slug }] : []),
  ]),
];

/** The rooms' invite pages (English routes), one per game with rooms. */
export const INVITE_ROUTES: string[] = PREVIEW_ROUTES.filter((p) => p.kind === "invite").map((p) => p.route);

/** The preview of `route` (English, "/same-page/invite") in `lang`. Throws for a route with none. */
export function previewFor(route: string, lang: Lang): Preview {
  const entry = PREVIEW_ROUTES.find((p) => p.route === route);
  if (!entry) throw new Error(`No link preview for ${route} (lib/seo/previews.ts)`);
  const { kind, slug } = entry;
  if (kind === "hub" || !slug) {
    const hub = HUB[lang];
    return { route, kind, title: APP_TITLE, ogTitle: APP_TITLE, description: hub.description, tagline: hub.tagline, alt: labelled(lang, APP_TITLE, hub.tagline.replace(/\.$/, "")) };
  }
  const game = gameBySlug(slug)!;
  const card = gameText(game, lang);
  const name = game.title;
  if (kind === "invite") {
    const invite = INVITE[lang];
    return { route, kind, slug, title: name, ogTitle: invite.title(name), description: pitchOf(game, lang), badge: invite.badge, tagline: card.shortDescription, alt: invite.alt(name) };
  }
  if (kind === "solo" || kind === "daily") {
    const solo = SOLO[lang][slug as SoloSlug];
    if (!solo) throw new Error(`No link-preview words for ${slug}'s solo page (lib/seo/previews.ts)`);
    // The tab: "Night Highway · Solo" (as its page titles itself); a daily page keeps the game's name.
    const title = kind === "solo" ? solo.title : name;
    return { route, kind, slug, title, ogTitle: solo.title, description: solo.description, badge: solo.badge, tagline: solo.tagline, alt: `${solo.title}. ${solo.tagline}` };
  }
  return { route, kind, slug, title: name, ogTitle: name, description: pitchOf(game, lang), badge: card.tags[0], tagline: card.shortDescription, alt: labelled(lang, name, card.shortDescription.replace(/\.$/, "")) };
}
