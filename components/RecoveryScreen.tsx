"use client";

import { useEffect } from "react";
import { type Lang, localizePath } from "@/lib/i18n/lang";
import { texts } from "@/lib/i18n/text";
import { useLang } from "@/lib/i18n/useLang";

const TEXT = texts({
  en: {
    title: "Something went wrong",
    body: "The game hit a snag. Your room and your seat are saved, so trying again should put you right back in.",
    retry: "Try again",
    reload: "Reload",
    home: "Back to all games",
  },
  fr: {
    title: "Quelque chose s'est mal passé",
    body: "Le jeu a eu un pépin. Ton salon et ta place sont sauvegardés : en réessayant, tu devrais reprendre là où tu étais.",
    retry: "Réessayer",
    reload: "Recharger",
    home: "Retour à tous les jeux",
  },
});

/**
 * What a page shows when it crashes (app/error.tsx, and app/global-error.tsx
 * when even the root layout fails). Styled inline, not with Tailwind or a
 * game's theme, because global-error renders without the app's stylesheet.
 * The room lives in the database and its code stays in the URL, so retrying
 * or reloading puts the player back in their seat.
 * `lang` is for global-error, which has no language context; elsewhere it's the page's.
 */
export default function RecoveryScreen({ error, retry, lang: forcedLang }: { error: Error & { digest?: string }; retry: () => void; lang?: Lang }) {
  const pageLang = useLang();
  const lang = forcedLang ?? pageLang;
  const t = TEXT[lang];
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
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>{t.title}</h1>
        <p style={{ margin: "0 0 18px", lineHeight: 1.45, color: "#333" }}>
          {t.body}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <button type="button" onClick={retry} style={{ ...button, background: "#FF3D8F", color: "#fff" }}>
            {t.retry}
          </button>
          <button type="button" onClick={() => window.location.reload()} style={{ ...button, background: "#eee", color: "#111" }}>
            {t.reload}
          </button>
        </div>
        {/* A hard navigation: whatever crashed shouldn't carry over to the hub (in the page's language). */}
        <a href={localizePath("/", lang)} style={{ display: "inline-block", marginTop: 16, color: "#0F7983", fontWeight: 700 }}>
          {t.home}
        </a>
      </div>
    </main>
  );
}
