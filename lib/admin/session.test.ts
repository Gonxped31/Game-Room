import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_MS, checkPassword, createSessionToken, verifySessionToken } from "./session";

const NOW = 1_800_000_000_000;

describe("checkPassword", () => {
  it("accepts only the exact password", () => {
    expect(checkPassword("hunter2", "hunter2")).toBe(true);
    expect(checkPassword("hunter2", "hunter3")).toBe(false);
    expect(checkPassword("hunter2", "")).toBe(false);
  });

  it("refuses everything while no password is configured", () => {
    expect(checkPassword(undefined, "")).toBe(false);
    expect(checkPassword("", "")).toBe(false);
  });
});

describe("session tokens", () => {
  const token = createSessionToken("hunter2", NOW);

  it("verifies a fresh token", () => {
    expect(verifySessionToken("hunter2", token, NOW + 1000)).toBe(true);
  });

  it("expires", () => {
    expect(verifySessionToken("hunter2", token, NOW + ADMIN_SESSION_MS - 1)).toBe(true);
    expect(verifySessionToken("hunter2", token, NOW + ADMIN_SESSION_MS)).toBe(false);
  });

  it("is invalidated by a password change", () => {
    expect(verifySessionToken("new-password", token, NOW)).toBe(false);
  });

  it("refuses a pushed-back expiry or a forged signature", () => {
    const [, sig] = token.split(".");
    expect(verifySessionToken("hunter2", `${NOW + ADMIN_SESSION_MS * 10}.${sig}`, NOW)).toBe(false);
    expect(verifySessionToken("hunter2", `${NOW + 1000}.forged`, NOW)).toBe(false);
  });

  it("refuses missing or malformed tokens", () => {
    for (const bad of [undefined, "", ".", "abc", "12.", ".sig", "nope.sig"]) {
      expect(verifySessionToken("hunter2", bad, NOW)).toBe(false);
    }
    expect(verifySessionToken(undefined, token, NOW)).toBe(false);
  });
});
