import { describe, expect, it } from "vitest";
import { formatLastActive } from "./lastActive";

const now = 1_800_000_000_000;
const ago = (ms: number) => formatLastActive(now - ms, now);
const MIN = 60_000;

describe("formatLastActive", () => {
  it("says 'Just now' under a minute (and for clock skew into the future)", () => {
    expect(ago(0)).toBe("Just now");
    expect(ago(59_000)).toBe("Just now");
    expect(formatLastActive(now + 5_000, now)).toBe("Just now");
  });

  it("counts minutes under an hour", () => {
    expect(ago(MIN)).toBe("1 min ago");
    expect(ago(12 * MIN)).toBe("12 min ago");
    expect(ago(59 * MIN)).toBe("59 min ago");
  });

  it("counts hours under a day, with a singular", () => {
    expect(ago(60 * MIN)).toBe("1 hour ago");
    expect(ago(5 * 60 * MIN)).toBe("5 hours ago");
    expect(ago(23 * 60 * MIN)).toBe("23 hours ago");
  });

  it("says 'Yesterday' for 24-48 hours", () => {
    expect(ago(24 * 60 * MIN)).toBe("Yesterday");
    expect(ago(47 * 60 * MIN)).toBe("Yesterday");
  });

  it("counts days after that", () => {
    expect(ago(48 * 60 * MIN)).toBe("2 days ago");
    expect(ago(3 * 24 * 60 * MIN)).toBe("3 days ago");
    expect(ago(29 * 24 * 60 * MIN)).toBe("29 days ago");
  });

  it("speaks French with the same steps", () => {
    // Intl puts a no-break space inside "12 min"; compare with plain spaces.
    const fr = (ms: number) => formatLastActive(now - ms, now, "fr").replace(/\s/g, " ");
    expect(fr(30_000)).toBe("à l'instant");
    expect(fr(12 * MIN)).toBe("il y a 12 min");
    expect(fr(60 * MIN)).toBe("il y a 1 heure");
    expect(fr(5 * 60 * MIN)).toBe("il y a 5 heures");
    expect(fr(30 * 60 * MIN)).toBe("hier");
    expect(fr(3 * 24 * 60 * MIN)).toBe("il y a 3 jours");
  });
});
