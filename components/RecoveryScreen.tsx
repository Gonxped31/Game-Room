"use client";

import { useEffect } from "react";

/**
 * What a page shows when it crashes (app/error.tsx, and app/global-error.tsx
 * when even the root layout fails). Styled inline, not with Tailwind or a
 * game's theme, because global-error renders without the app's stylesheet.
 * The room lives in the database and its code stays in the URL, so retrying
 * or reloading puts the player back in their seat.
 */
export default function RecoveryScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const button = {
    cursor: "pointer",
    border: 0,
    borderRadius: 12,
    padding: "12px 18px",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "inherit",
  } as const;

  return (
    <main
      role="alert"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#0F7983",
        fontFamily: "var(--font-fredoka), system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 380, width: "100%", borderRadius: 18, background: "#fff", color: "#111", padding: 24, textAlign: "center", boxShadow: "0 6px 0 rgba(0,0,0,.25)" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: "0 0 18px", lineHeight: 1.45, color: "#333" }}>
          The game hit a snag. Your room and your seat are saved, so trying again should put you right back in.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <button type="button" onClick={retry} style={{ ...button, background: "#FF3D8F", color: "#fff" }}>
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} style={{ ...button, background: "#eee", color: "#111" }}>
            Reload
          </button>
        </div>
        {/* A hard navigation: whatever crashed shouldn't carry over to the hub. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberately not a client-side navigation */}
        <a href="/" style={{ display: "inline-block", marginTop: 16, color: "#0F7983", fontWeight: 700 }}>
          Back to all games
        </a>
      </div>
    </main>
  );
}
