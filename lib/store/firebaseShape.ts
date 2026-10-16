/**
 * What the Realtime Database does to data, as pure functions - shared by the
 * localStorage fallback (so local mode sees the same shapes) and by tests.
 */

/** Drops null/undefined, empty objects and empty arrays, as the Realtime Database does on write. */
export function pruneLikeFirebase(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value.map(pruneLikeFirebase);
    return items.some((v) => v != null) ? items : null;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const p = pruneLikeFirebase(v);
      if (p != null) out[k] = p;
    }
    return Object.keys(out).length ? out : null;
  }
  return value;
}

/**
 * Paths of every property explicitly set to `undefined` - each one makes a
 * real Firebase write throw ("Data returned contains undefined in property
 * ..."), which the store reports as "not written": the move silently does
 * nothing. Local mode can't catch this (it drops `undefined`), so game tests
 * check transitions with it.
 */
export function undefinedPaths(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  const found: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    const p = path ? `${path}.${k}` : k;
    if (v === undefined) found.push(p);
    else found.push(...undefinedPaths(v, p));
  }
  return found;
}
