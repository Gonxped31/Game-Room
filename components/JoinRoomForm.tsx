"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readRoomMeta } from "@/lib/session/roomMeta";

/**
 * Enter an existing room's code to jump straight back into it - the room
 * remembers which game it belongs to (lib/session/roomMeta.ts), so this
 * doesn't need to ask which game first.
 */
export default function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "notFound">("idle");

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    // Accept a pasted invite link, not just a bare code.
    const typed = code.trim();
    const normalized = (typed.includes("#") ? typed.slice(typed.lastIndexOf("#") + 1) : typed).toLowerCase();
    if (!normalized) return;

    setStatus("checking");
    const meta = await readRoomMeta(normalized);
    if (meta) {
      router.push(`/${meta.gameSlug}#${normalized}`);
      return;
    }
    setStatus("notFound");
  };

  return (
    <form onSubmit={join} className="mt-5 rounded-xl bg-white px-4 py-3.5 text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
      <p className="m-0 text-sm font-bold">Already have a room code?</p>
      <p className="m-0 mt-0.5 text-sm opacity-70">Enter it to jump back into that room.</p>
      <div className="mt-2.5 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setStatus("idle");
          }}
          placeholder="Room code"
          className="min-w-0 flex-1 rounded-lg border border-black/15 px-2.5 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={status === "checking" || !code.trim()}
          className="shrink-0 cursor-pointer rounded-lg bg-black px-3.5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "checking" ? "Joining…" : "Join"}
        </button>
      </div>
      {status === "notFound" ? <p className="m-0 mt-1.5 text-sm text-red-600">We couldn&apos;t find that room. Double check the code.</p> : null}
    </form>
  );
}
