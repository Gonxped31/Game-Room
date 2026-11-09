"use client";

import { ensureGuestUid } from "@/lib/session/shared/auth";
import { hasFirebaseConfig } from "@/lib/store/config";
import { firstTouchPath } from "./events";
import { DIRECT, parseSource, sanitizeTag, type SourceTags, withoutTags } from "./source";

/**
 * The browser side of source tracking (docs/tracking.md). The first source
 * this browser arrived from is kept in localStorage, then written once to
 * `users/{uid}/firstTouch` when the guest is signed in, lazily, so the first
 * visit never waits on it. Local mode (no Firebase) keeps it in localStorage
 * only. No cookies, no third parties, nothing personal: just the tags.
 */

const KEY = "partyfox.firstTouch";

interface Stored extends SourceTags {
  /** This device's clock: the database's copy takes the server's. */
  at: number;
  /** The uid the database copy was written for. */
  sentFor?: string;
}

/** Stands in when storage is blocked (a private window that refuses it): this page load only. */
let memory: Stored | null = null;
let sending = false;

function load(): Stored | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Stored> | null;
    const src = sanitizeTag(raw?.src);
    if (!raw || !src || typeof raw.at !== "number") return memory;
    const med = sanitizeTag(raw.med);
    const cmp = sanitizeTag(raw.cmp);
    return { src, ...(med ? { med } : {}), ...(cmp ? { cmp } : {}), at: raw.at, ...(typeof raw.sentFor === "string" ? { sentFor: raw.sentFor } : {}) };
  } catch {
    return memory;
  }
}

function save(value: Stored) {
  memory = value;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: `memory` keeps it for this page load.
  }
}

/** This browser's first source, or null before SourceCapture has run. Effects and handlers only. */
export function localFirstTouch(): SourceTags | null {
  if (typeof window === "undefined") return null;
  const stored = load();
  return stored ? { src: stored.src, ...(stored.med ? { med: stored.med } : {}), ...(stored.cmp ? { cmp: stored.cmp } : {}) } : null;
}

const afterIdle = (run: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 2000);
};

async function send() {
  if (sending) return;
  sending = true;
  try {
    const uid = await ensureGuestUid();
    const stored = load();
    if (!stored || stored.sentFor === uid) return;
    const { serverTimestamp, updateRoot } = await import("@/lib/store");
    const value = { src: stored.src, ...(stored.med ? { med: stored.med } : {}), ...(stored.cmp ? { cmp: stored.cmp } : {}), at: serverTimestamp() };
    // Refused when this guest already has one (written once, by the rules): that's the first touch, keep it.
    await updateRoot({ [firstTouchPath(uid)]: value }).catch(() => {});
    save({ ...stored, sentFor: uid });
  } catch {
    // Sign-in failed: the next page load tries again.
  } finally {
    sending = false;
  }
}

/**
 * Reads this visit's tags, remembers the first touch, and removes the tags
 * from the address bar (keeping the path, other parameters and the #hash),
 * so they don't spread when the URL is copied. Once per page load, from
 * SourceCapture's effect. The owner's /admin is left alone.
 */
export function captureSource(): void {
  const { pathname, search, hash } = window.location;
  if (/^\/(admin|api)(\/|$)/.test(pathname)) return;
  const tags = parseSource(search);
  const clean = withoutTags(pathname, search, hash);
  if (clean) {
    try {
      // The current state keeps Next's own router entries.
      window.history.replaceState(window.history.state, "", clean);
    } catch {
      // Some in-app browsers refuse replaceState: the tags just stay visible.
    }
  }
  let stored = load();
  if (!stored) {
    stored = { ...(tags ?? { src: DIRECT }), at: Date.now() };
    save(stored);
  }
  if (hasFirebaseConfig && !stored.sentFor) afterIdle(() => void send());
}
