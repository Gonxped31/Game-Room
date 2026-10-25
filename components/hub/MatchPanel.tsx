"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { CONNECTION_ERROR_MESSAGE, ensureGuestUid } from "@/lib/session/shared/auth";
import { findMatch, type MatchGame } from "@/lib/session/shared/findMatch";
import { ANY_LANG } from "@/lib/session/shared/matchmaking";
import { roomHref } from "@/lib/games/registry";
import { defaultLang, type Lang, LANG_LABELS, LANGS } from "@/lib/games/shared/language";

/** Visible focus on the white panel: a 3px teal outline (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0F7983]";

/** The display name this browser last played online with. */
const NAME_KEY = "gameRoom.onlineName";
const MAX_NAME = 24;

const noSubscribe = () => () => {};
function readSavedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // storage unavailable - the name just isn't remembered
  }
}
const browserLang = () => defaultLang(navigator.languages);

function LangSwitch({ lang, onChange, disabled }: { lang: Lang; onChange: (lang: Lang) => void; disabled: boolean }) {
  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="inline-flex shrink-0 items-center self-start rounded-[10px] bg-[#E9EEEF] p-[3px]"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const other = LANGS.find((l) => l !== lang) ?? lang;
          onChange(other);
          e.currentTarget.querySelector<HTMLButtonElement>(`[data-lang="${other}"]`)?.focus();
        }
      }}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          data-lang={l}
          aria-checked={lang === l}
          tabIndex={lang === l ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(l)}
          className={`h-9 cursor-pointer rounded-[8px] px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 min-[760px]:h-[34px] ${FOCUS_RING}`}
          style={{ backgroundColor: lang === l ? "#0F7983" : "transparent", color: lang === l ? "#FFFFFF" : "#3A4547" }}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

interface MatchPanelProps {
  game: MatchGame;
  /** e.g. "Buzzer Quiz" - the panel is titled "Buzzer Quiz matchmaking". */
  gameTitle: string;
  /** id for the heading, so the surrounding dialog can be labelled by it. */
  headingId: string;
  /** In the mobile sheet the title lives in the sheet's header. */
  inSheet: boolean;
}

/**
 * "Matchmaking" (docs/matchmaking.md), inside a card's popover (desktop) or
 * sheet (mobile), styled like the Join form: a display name and (for a game
 * with words) the content language, then Find players. The search seats this guest in a public room
 * (someone else's, or a new one) before the page changes, so the game page
 * opens straight on its lobby.
 */
export default function MatchPanel({ game, gameTitle, headingId, inSheet }: MatchPanelProps) {
  const savedName = useSyncExternalStore(noSubscribe, readSavedName, () => "");
  const suggestedLang = useSyncExternalStore(noSubscribe, browserLang, (): Lang => "en");
  const [typedName, setTypedName] = useState<string | null>(null);
  const [pickedLang, setPickedLang] = useState<Lang | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "offline">("idle");
  const [destination, setDestination] = useState<string | null>(null);
  const errorId = useId();
  const nameId = useId();

  const name = typedName ?? savedName;
  const lang = pickedLang ?? suggestedLang;
  const busy = status === "searching" || destination != null;
  const canSubmit = !busy && name.trim().length > 0;

  // A hard navigation into the room, set from an effect (react-hooks/immutability).
  useEffect(() => {
    if (destination) window.location.href = destination;
  }, [destination]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().slice(0, MAX_NAME);
    if (!trimmed) return;
    setStatus("searching");
    saveName(trimmed);
    try {
      const uid = await ensureGuestUid();
      const code = await findMatch({ uid, name: trimmed, lang: game.languages ? lang : ANY_LANG, game });
      setDestination(roomHref(game.gameSlug, code));
    } catch {
      setStatus("offline");
    }
  };

  return (
    <form onSubmit={search} aria-busy={busy} className="grid gap-2.5">
      {inSheet ? null : (
        <h2 id={headingId} className="m-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold">
          {gameTitle} matchmaking
        </h2>
      )}

      <p className="m-0 text-sm font-medium" style={{ color: "#444444" }}>
        We&apos;ll match you with other players. The game starts by itself once enough of you are in.
      </p>

      <label htmlFor={nameId} className="text-sm font-semibold text-black">
        Your name
      </label>
      <input
        id={nameId}
        data-autofocus
        type="text"
        value={name}
        maxLength={MAX_NAME}
        disabled={busy}
        onChange={(e) => {
          setTypedName(e.target.value);
          setStatus("idle");
        }}
        placeholder="What should others call you?"
        aria-describedby={status === "offline" ? errorId : undefined}
        autoComplete="nickname"
        className={`h-12 w-full rounded-xl border-2 bg-white px-3.5 font-[family-name:var(--font-fredoka)] text-base font-semibold text-black outline-none disabled:bg-[#F1F4F4] disabled:text-black/60 ${busy ? "border-[#C9D1D2]" : "border-[#7C8A8C] focus:border-[#0F7983]"}`}
      />

      {game.languages ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-black">Questions and words in</span>
          <LangSwitch lang={lang} onChange={setPickedLang} disabled={busy} />
        </div>
      ) : null}

      {status === "offline" ? (
        <p id={errorId} role="alert" className="m-0 text-sm font-semibold" style={{ color: "#B3261E" }}>
          {CONNECTION_ERROR_MESSAGE}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className={`h-12 w-full cursor-pointer rounded-xl border-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold text-white transition-transform duration-[60ms] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed motion-reduce:transition-none ${FOCUS_RING}`}
        style={{
          backgroundColor: canSubmit ? "#0F7983" : "#8FA9AC",
          boxShadow: canSubmit ? "0 4px 0 #0A565D" : "none",
          cursor: busy ? "progress" : undefined,
        }}
      >
        <span aria-live="polite">{busy ? "Finding players…" : "Find players"}</span>
      </button>
    </form>
  );
}
