import { describe, expect, it } from "vitest";
import { MAX_ROOMS_PER_REQUEST, parseRoomCodes } from "./roomCodes";

describe("parseRoomCodes", () => {
  it("takes a list of room codes, dropping duplicates", () => {
    expect(parseRoomCodes({ codes: ["abc234", "xyz789", "abc234"] })).toEqual({ codes: ["abc234", "xyz789"] });
  });

  it("refuses a missing, empty or non-list body", () => {
    for (const body of [null, {}, { codes: [] }, { codes: "abc234" }, "abc234"]) expect(parseRoomCodes(body)).toHaveProperty("error");
  });

  it("refuses anything that isn't a room code, so no other path can be written", () => {
    for (const code of ["ABC234", "abc23", "abc2340", "../x", "abc 23", 7]) expect(parseRoomCodes({ codes: ["abc234", code] })).toHaveProperty("error");
  });

  it(`refuses more than ${MAX_ROOMS_PER_REQUEST} rooms`, () => {
    const alphabet = "abcdefghjkmnpqrstuvwxyz123456789";
    const codeFor = (i: number) => Array.from({ length: 6 }, (_, k) => alphabet[Math.floor(i / alphabet.length ** k) % alphabet.length]).join("");
    const codes = Array.from({ length: MAX_ROOMS_PER_REQUEST + 1 }, (_, i) => codeFor(i));
    expect(new Set(codes).size).toBe(MAX_ROOMS_PER_REQUEST + 1);
    expect(parseRoomCodes({ codes })).toHaveProperty("error");
    expect(parseRoomCodes({ codes: codes.slice(1) })).toHaveProperty("codes");
  });
});
