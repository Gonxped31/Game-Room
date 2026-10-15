"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/games/registry";
import { findRoomsByName, readRoomMeta, type RoomMeta } from "@/lib/session/roomMeta";

function gameTitle(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.title ?? slug;
}

/**
 * Enter an existing room's code OR its display name to jump straight back
 * into it - the room remembers which game it belongs to
 * (lib/session/roomMeta.ts), so this doesn't need to ask which game first.
 * A code, when given, is authoritative (the name field is ignored) since
 * it's the one actually-unique identifier; a name alone may match more than
 * one room, in which case the matches are listed so the player can pick.
 */
export default function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "notFound">("idle");
  const [candidates, setCandidates] = useState<{ room: string; meta: RoomMeta }[] | null>(null);

  const goTo = (room: string, gameSlug: string) => router.push(`/${gameSlug}#${room}`);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setCandidates(null);

    // Accept a pasted invite link, not just a bare code.
    const typedCode = code.trim();
    const normalizedCode = (typedCode.includes("#") ? typedCode.slice(typedCode.lastIndexOf("#") + 1) : typedCode).toLowerCase();
    const typedName = name.trim();
    if (!normalizedCode && !typedName) return;

    setStatus("checking");

    if (normalizedCode) {
      const meta = await readRoomMeta(normalizedCode);
      if (meta) {
        goTo(normalizedCode, meta.gameSlug);
        return;
      }
      setStatus("notFound");
      return;
    }

    const matches = await findRoomsByName(typedName);
    if (matches.length === 0) {
      setStatus("notFound");
      return;
    }
    if (matches.length === 1) {
      goTo(matches[0].room, matches[0].meta.gameSlug);
      return;
    }
    setStatus("idle");
    setCandidates(matches);
  };

  return (
    <form onSubmit={join} className="mt-5 rounded-2xl bg-white px-4 py-3.5 text-black shadow-[0_4px_10px_rgba(0,0,0,.25)]">
      <p className="m-0 text-sm font-bold">Already have a room?</p>
      <p className="m-0 mt-0.5 text-sm opacity-70">Enter its code, its name, or both, to jump back in.</p>
      <div className="mt-2.5 grid gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setStatus("idle");
            setCandidates(null);
          }}
          placeholder="Room code"
          className="w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
            setCandidates(null);
          }}
          placeholder="Room name"
          className="w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={status === "checking" || (!code.trim() && !name.trim())}
          className="cursor-pointer rounded-lg bg-black px-3.5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "checking" ? "Joining…" : "Join"}
        </button>
      </div>
      {status === "notFound" ? <p className="m-0 mt-1.5 text-sm text-red-600">We couldn&apos;t find that room. Double check the code or name.</p> : null}
      {candidates ? (
        <div className="mt-2.5 grid gap-1.5">
          <p className="m-0 text-sm font-semibold">Multiple rooms named &quot;{name.trim()}&quot; - which one?</p>
          {candidates.map(({ room, meta }) => (
            <button
              key={room}
              type="button"
              onClick={() => goTo(room, meta.gameSlug)}
              className="cursor-pointer rounded-lg border border-black/15 px-2.5 py-2 text-left text-sm"
            >
              <span className="font-bold">{gameTitle(meta.gameSlug)}</span> <span className="opacity-60">· {room}</span>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
