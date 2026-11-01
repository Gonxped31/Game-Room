import { generateKeyPair, SignJWT, UnsecuredJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyAppCheckToken, verifyGuestToken } from "./token";

const PROJECT = "demo-project";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");
});
afterEach(() => vi.unstubAllEnvs());

const now = () => Math.floor(Date.now() / 1000);

/** A token shaped like Firebase's, signed with `key`; `claims` override the defaults. */
function token(claims: Record<string, unknown> = {}, key = keys.privateKey) {
  // Plain claims rather than SignJWT's setters, which would overwrite the overrides.
  return new SignJWT({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: "guest-uid",
    iat: now() - 60,
    exp: now() + 3600,
    auth_time: now() - 60,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .sign(key);
}

describe("verifyGuestToken", () => {
  it("accepts a signed token for this project and returns its uid", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    expect(await verifyGuestToken(await token(), keys.publicKey)).toBe("guest-uid");
  });

  it("refuses another signer, another project, an expired token and a future sign-in", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    expect(await verifyGuestToken(await token({}, otherKeys.privateKey), keys.publicKey)).toBeNull();
    expect(await verifyGuestToken(await token({ aud: "someone-else" }), keys.publicKey)).toBeNull();
    expect(await verifyGuestToken(await token({ iss: "https://securetoken.google.com/someone-else" }), keys.publicKey)).toBeNull();
    expect(await verifyGuestToken(await token({ exp: now() - 10 }), keys.publicKey)).toBeNull();
    expect(await verifyGuestToken(await token({ auth_time: now() + 3600 }), keys.publicKey)).toBeNull();
    expect(await verifyGuestToken("not.a.token", keys.publicKey)).toBeNull();
  });

  it("refuses an unsigned token unless the Auth emulator is in use", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
    const unsigned = new UnsecuredJWT({ auth_time: now() - 60 })
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setAudience(PROJECT)
      .setSubject("emulator-uid")
      .setExpirationTime("1h")
      .encode();
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    expect(await verifyGuestToken(unsigned, keys.publicKey)).toBeNull();
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
    expect(await verifyGuestToken(unsigned, keys.publicKey)).toBe("emulator-uid");
  });
});

const NUMBER = "123456789";

/** A token shaped like App Check's (type JWT), signed with `key`; `claims` override the defaults. */
function appCheckToken(claims: Record<string, unknown> = {}, key = keys.privateKey, typ = "JWT") {
  return new SignJWT({
    iss: `https://firebaseappcheck.googleapis.com/${NUMBER}`,
    aud: [`projects/${NUMBER}`, `projects/${PROJECT}`],
    sub: `1:${NUMBER}:web:abc`,
    iat: now() - 60,
    exp: now() + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test", typ })
    .sign(key);
}

describe("verifyAppCheckToken", () => {
  it("accepts a signed App Check token for this project's number", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", `1:${NUMBER}:web:abc`);
    expect(await verifyAppCheckToken(await appCheckToken(), keys.publicKey)).toBe(true);
  });

  it("refuses another signer, another project, an expired token, a wrong type and garbage", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", `1:${NUMBER}:web:abc`);
    expect(await verifyAppCheckToken(await appCheckToken({}, otherKeys.privateKey), keys.publicKey)).toBe(false);
    expect(await verifyAppCheckToken(await appCheckToken({ aud: ["projects/999"] }), keys.publicKey)).toBe(false);
    expect(await verifyAppCheckToken(await appCheckToken({ iss: "https://firebaseappcheck.googleapis.com/999" }), keys.publicKey)).toBe(false);
    expect(await verifyAppCheckToken(await appCheckToken({ exp: now() - 10 }), keys.publicKey)).toBe(false);
    expect(await verifyAppCheckToken(await appCheckToken({}, keys.privateKey, "at+jwt"), keys.publicKey)).toBe(false);
    expect(await verifyAppCheckToken("not.a.token", keys.publicKey)).toBe(false);
  });
});
