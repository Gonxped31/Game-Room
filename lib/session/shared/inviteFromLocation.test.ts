import { describe, expect, it } from "vitest";
import { inviteFromLocation, roomSlugOfPath } from "./inviteFromLocation";

const ORIGIN = "https://partyfox.io";
const at = (pathname: string, hash = "#abc234") => ({ origin: ORIGIN, pathname, hash, href: `${ORIGIN}${pathname}${hash}` });

describe("roomSlugOfPath", () => {
  it("finds the game by its route, which can differ from its slug", () => {
    expect(roomSlugOfPath("/same-page")).toBe("ftw");
    expect(roomSlugOfPath("/regions/race")).toBe("regions");
    expect(roomSlugOfPath("/borderrun")).toBe("borderrun");
    expect(roomSlugOfPath("/buzzerquiz")).toBe("buzzerquiz");
  });

  it("ignores the French prefix, the invite page and a trailing slash", () => {
    expect(roomSlugOfPath("/fr/same-page")).toBe("ftw");
    expect(roomSlugOfPath("/fr/regions/race/invite")).toBe("regions");
    expect(roomSlugOfPath("/lasthop/invite")).toBe("lasthop");
    expect(roomSlugOfPath("/cocounsel/")).toBe("cocounsel");
  });

  it("is null off a room page", () => {
    expect(roomSlugOfPath("/")).toBeNull();
    expect(roomSlugOfPath("/fr")).toBeNull();
    expect(roomSlugOfPath("/regions")).toBeNull();
    expect(roomSlugOfPath("/borderrun/solo")).toBeNull();
    expect(roomSlugOfPath("/fr/nighthighway/solo")).toBeNull();
    expect(roomSlugOfPath("/ftw")).toBeNull();
  });
});

describe("inviteFromLocation", () => {
  it("hands out the room's invite page, tagged, in the page's language", () => {
    expect(inviteFromLocation(at("/same-page"))).toBe(`${ORIGIN}/same-page/invite?utm_source=invite&utm_campaign=ftw#abc234`);
    expect(inviteFromLocation(at("/fr/regions/race"))).toBe(`${ORIGIN}/fr/regions/race/invite?utm_source=invite&utm_campaign=regions#abc234`);
  });

  it("works from the invite page itself", () => {
    expect(inviteFromLocation(at("/fr/borderrun/invite"))).toBe(`${ORIGIN}/fr/borderrun/invite?utm_source=invite&utm_campaign=borderrun#abc234`);
  });

  it("falls back to the address without a known game or a room code", () => {
    expect(inviteFromLocation(at("/somewhere-else"))).toBe(`${ORIGIN}/somewhere-else#abc234`);
    expect(inviteFromLocation(at("/same-page", ""))).toBe(`${ORIGIN}/same-page`);
    expect(inviteFromLocation(at("/same-page", "#Not a code"))).toBe(`${ORIGIN}/same-page#Not a code`);
  });
});
