"use client";

import { useSyncExternalStore } from "react";
import { hasFirebaseConfig } from "@/lib/store/config";

/**
 * Invisible guest IDs. On Firebase, an Anonymous Auth user signed in once and
 * persisted by the SDK's default local persistence - every tab in one browser
 * shares it, and the rules (database.rules.json) key everything on it:
 * seats, membership, presence, a guest's own room list. There is no sign-in
 * screen and never will be - a product decision, not a missing feature.
 *
 * In local mode (no Firebase config) a fake uid stands in, so every caller
 * has the same shape. It lives in sessionStorage - one per TAB, surviving a
 * reload of that tab - rather than localStorage, so two tabs of one browser
 * are still two different players: the whole point of local mode is testing
 * both seats on one machine, and a private window (which is how two players
 * share one machine on Firebase) can't see the normal window's localStorage
 * at all.
 */
export type GuestAuth = { status: "loading" } | { status: "ready"; uid: string } | { status: "error" };

const LOADING: GuestAuth = { status: "loading" };
let state: GuestAuth = LOADING;
const listeners = new Set<() => void>();
let started = false;

function setState(next: GuestAuth) {
  state = next;
  listeners.forEach((l) => l());
  if (next.status === "ready") waiters.splice(0).forEach((resolve) => resolve(next.uid));
  if (next.status === "error") failers.splice(0).forEach((reject) => reject(new Error("Guest sign-in failed.")));
}

function localUid(): string {
  const KEY = "localUid";
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const uid = `local-${crypto.randomUUID()}`;
    window.sessionStorage.setItem(KEY, uid);
    return uid;
  } catch {
    return `local-${crypto.randomUUID()}`;
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!hasFirebaseConfig) {
    setState({ status: "ready", uid: localUid() });
    return;
  }
  void (async () => {
    const [{ connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously }, { getFirebaseApp }] = await Promise.all([
      import("firebase/auth"),
      import("@/lib/store/firebaseApp"),
    ]);
    const auth = getAuth(getFirebaseApp());
    // Dev only: point at the Auth emulator (see README, "Testing against the
    // emulators"). The database follows its own URL - an emulator URL there
    // (http://127.0.0.1:9000/?ns=...) needs nothing extra.
    const authEmulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
    if (authEmulator) connectAuthEmulator(auth, authEmulator, { disableWarnings: true });
    // Fires once with the persisted guest (or null) before anything else -
    // only sign in when there's no guest yet, so the uid stays stable.
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ status: "ready", uid: user.uid });
        return;
      }
      signInAnonymously(auth).catch(() => setState({ status: "error" }));
    });
  })().catch(() => setState({ status: "error" }));
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  start();
  return () => listeners.delete(onChange);
}

/** The guest's auth state; `uid` is set once signed in. Server-renders as "loading". */
export function useGuestAuth(): GuestAuth {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}

const waiters: ((uid: string) => void)[] = [];
const failers: ((error: Error) => void)[] = [];

/** Resolves to the guest's uid once signed in (signing in if needed); rejects if sign-in fails. For one-off reads outside a hook. */
export function ensureGuestUid(): Promise<string> {
  start();
  if (state.status === "ready") return Promise.resolve(state.uid);
  if (state.status === "error") return Promise.reject(new Error("Guest sign-in failed."));
  return new Promise((resolve, reject) => {
    waiters.push(resolve);
    failers.push(reject);
  });
}

export const CONNECTION_ERROR_MESSAGE = "Can't connect right now. Check your connection and reload.";
