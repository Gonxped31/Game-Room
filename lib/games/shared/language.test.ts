import { describe, expect, it } from "vitest";
import { defaultLang, isLang } from "./language";

describe("defaultLang", () => {
  it("picks French when French comes first", () => {
    expect(defaultLang(["fr-FR", "en"])).toBe("fr");
    expect(defaultLang(["FR"])).toBe("fr");
  });

  it("picks English otherwise", () => {
    expect(defaultLang(["en-US", "fr"])).toBe("en");
    expect(defaultLang(["de"])).toBe("en");
    expect(defaultLang(["fry"])).toBe("en");
  });

  it("falls back to English with no preference", () => {
    expect(defaultLang([])).toBe("en");
    expect(defaultLang(undefined)).toBe("en");
  });
});

describe("isLang", () => {
  it("accepts only en and fr", () => {
    expect(isLang("en")).toBe(true);
    expect(isLang("fr")).toBe(true);
    expect(isLang("de")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
