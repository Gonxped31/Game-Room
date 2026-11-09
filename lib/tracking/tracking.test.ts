import { describe, expect, it } from "vitest";
import { entryKey, finishedEntry, finishedHeader, gameKey, readFirstTouch, type FinishedInput } from "./events";
import { parseSource, sanitizeTag, withoutTags } from "./source";

describe("source tags", () => {
  it("reads utm_source, medium and campaign, with ref as a short utm_source", () => {
    expect(parseSource("?utm_source=TikTok&utm_medium=social&utm_campaign=Launch%20Week")).toEqual({ src: "tiktok", med: "social", cmp: "launch-week" });
    expect(parseSource("?ref=reddit")).toEqual({ src: "reddit" });
    expect(parseSource("?utm_source=discord&ref=reddit")).toEqual({ src: "discord" });
    expect(parseSource("?utm_campaign=x")).toBeNull();
    expect(parseSource("")).toBeNull();
  });

  it("keeps any new channel as it is, sanitized", () => {
    expect(sanitizeTag("  Product Hunt! ")).toBe("product-hunt");
    expect(sanitizeTag("news.ycombinator.com")).toBe("news.ycombinator.com");
    expect(sanitizeTag("x".repeat(60))).toHaveLength(40);
    expect(sanitizeTag("???")).toBeNull();
    expect(sanitizeTag("")).toBeNull();
  });

  it("removes only the tags from the address, keeping the path, other parameters and the hash", () => {
    expect(withoutTags("/fr/same-page/invite", "?utm_source=invite&utm_campaign=ftw", "#abc234")).toBe("/fr/same-page/invite#abc234");
    expect(withoutTags("/", "?ref=x&lang=fr", "")).toBe("/?lang=fr");
    expect(withoutTags("/regions", "?a=1", "#x")).toBeNull();
  });
});

describe("finished records", () => {
  const room: FinishedInput = { slug: "ftw", mode: "room", id: "3", room: "abc234", players: 2, lang: "fr" };

  it("builds a room game's header and keys", () => {
    expect(finishedHeader(room, 5)).toEqual({ slug: "ftw", mode: "room", players: 2, lang: "fr", at: 5, room: "abc234" });
    expect(finishedHeader({ ...room, mode: "challenge", matchmade: true }, 5)).toMatchObject({ matchmade: true });
    expect(gameKey("abc234", "3")).toBe("abc234_3");
    expect(entryKey("abc234_3", "uid1")).toBe("abc234_3_uid1");
  });

  it("refuses what the rules would", () => {
    expect(finishedHeader({ ...room, room: undefined }, 5)).toBeNull();
    expect(finishedHeader({ ...room, mode: "solo" }, 5)).toBeNull();
    expect(finishedHeader({ ...room, id: "a_b" }, 5)).toBeNull();
    expect(finishedHeader({ ...room, id: "x".repeat(41) }, 5)).toBeNull();
    expect(finishedHeader({ ...room, players: 0 }, 5)).toBeNull();
    expect(finishedHeader({ ...room, players: 1.5 }, 5)).toBeNull();
    expect(finishedHeader({ ...room, slug: "Same Page" }, 5)).toBeNull();
    expect(finishedHeader({ slug: "regions", mode: "solo", id: "k2x9", players: 1, lang: "en" }, 5)).toEqual({ slug: "regions", mode: "solo", players: 1, lang: "en", at: 5 });
  });

  it("carries the finisher's first touch, direct when unknown", () => {
    expect(finishedEntry("k", "u", { src: "tiktok", med: "social", cmp: "test1" }, 5)).toEqual({ game: "k", uid: "u", src: "tiktok", cmp: "test1", at: 5 });
    expect(finishedEntry("k", "u", null, 5)).toEqual({ game: "k", uid: "u", src: "direct", at: 5 });
  });

  it("reads a stored first touch, skipping malformed ones", () => {
    expect(readFirstTouch({ src: "tiktok", med: "social", at: 7 })).toEqual({ src: "tiktok", med: "social", at: 7 });
    expect(readFirstTouch({ src: "Tik Tok", at: 7 })).toBeNull();
    expect(readFirstTouch({ src: "tiktok" })).toBeNull();
    expect(readFirstTouch(null)).toBeNull();
  });
});
