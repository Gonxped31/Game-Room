import { describe, expect, it } from "vitest";
import { generateRoomCode } from "./room";

describe("generateRoomCode", () => {
  it("generates a 6-character code from the safe alphabet", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[a-km-np-z2-9]{6}$/);
  });

  it("excludes visually ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).not.toMatch(/[il0o1]/);
    }
  });

  it("is effectively unique across many calls", () => {
    const codes = new Set(Array.from({ length: 500 }, generateRoomCode));
    expect(codes.size).toBe(500);
  });
});
