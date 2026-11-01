import type { AppCheck } from "firebase/app-check";

/**
 * The daily routes' App Check token (docs/daily.md, "App Check"): reCAPTCHA v3
 * proves a request comes from the game's own page, not a script. Only when
 * NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set, and never on the emulators. App Check
 * starts on the first daily request (nothing loads before), and a failure is
 * no token: the server decides what that means (DAILY_APP_CHECK).
 */
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let started: Promise<AppCheck> | undefined;

export async function appCheckToken(): Promise<string | null> {
  if (!SITE_KEY || process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL) return null;
  try {
    const [{ getToken, initializeAppCheck, ReCaptchaV3Provider }, { getFirebaseApp }] = await Promise.all([import("firebase/app-check"), import("@/lib/store/firebaseApp")]);
    started ??= Promise.resolve(initializeAppCheck(getFirebaseApp(), { provider: new ReCaptchaV3Provider(SITE_KEY), isTokenAutoRefreshEnabled: true }));
    return (await getToken(await started, false)).token;
  } catch {
    return null;
  }
}
