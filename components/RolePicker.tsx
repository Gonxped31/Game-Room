"use client";

import { useState } from "react";
import type { SeatId } from "@/lib/session/types";
import Button from "./Button";

interface RolePickerProps<S extends SeatId> {
  /** Names of the seats already held in this room, if any - so a returning player (new device, cleared storage) can just say who they are. */
  names: Partial<Record<S, string>>;
  /** Which held seats this guest may take over (their holder has been offline for 2 minutes). */
  canTakeOver: Partial<Record<S, boolean>>;
  onPick: (seat: S, name: string) => void;
  /** Every seat of the game, in order. Defaults to the 1v1 pair. */
  seats?: readonly S[];
  /** The primary buttons' fill and pressed-state shadow - default to the shared pink. */
  accentColor?: string;
  accentShadowColor?: string;
}

const PAIR = ["p1", "p2"] as const;

const bubble = "m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]";

/** "Sam", "Sam and Alex", "Sam, Alex and Kim". */
const listNames = (names: string[]) => (names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export default function RolePicker<S extends SeatId>({ names, canTakeOver, onPick, seats = PAIR as unknown as readonly S[], accentColor, accentShadowColor }: RolePickerProps<S>) {
  const accent = accentColor ? { backgroundColor: accentColor, boxShadow: `0 4px 0 ${accentShadowColor ?? accentColor}` } : undefined;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  // A newcomer takes the first free seat, so seat order is join order.
  const unclaimed = seats.find((seat) => !names[seat]) ?? null;
  const held = seats.filter((seat) => names[seat]);

  if (unclaimed) {
    const submit = () => {
      const name = draft.trim();
      if (!name) {
        setError("Enter your name to continue.");
        return;
      }
      setError("");
      onPick(unclaimed, name);
    };
    const inAlready = held.map((seat) => names[seat]!);
    const prompt = inAlready.length
      ? `${listNames(inAlready)} ${inAlready.length === 1 ? "is" : "are"} already in. What's your name?`
      : seats.length === 2
        ? "What's your name? The other player joins next with their own."
        : "What's your name? The others join next with their own.";
    return (
      <div className="mt-6 grid gap-3">
        <p className={bubble}>{prompt}</p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your name"
          maxLength={24}
          aria-label="Your name"
          className="w-full rounded-xl border-0 bg-white p-3.5 text-lg text-black shadow-[0_3px_8px_rgba(0,0,0,.25)] placeholder:text-black/45"
        />
        {error ? (
          <p role="alert" className={bubble}>
            {error}
          </p>
        ) : null}
        <Button onClick={submit} style={accent}>
          Continue
        </Button>
      </div>
    );
  }

  // Every seat is held by other guests - this device lost its guest ID
  // (wiped storage, another browser) or is one visitor too many. A seat can
  // be taken over once its holder has been offline for 2 minutes.
  const anyFree = seats.some((seat) => canTakeOver[seat]);
  return (
    <div className="mt-6 grid gap-3">
      <p className={bubble}>
        {anyFree
          ? "Welcome back! Which one are you on this device?"
          : `${seats.length === 2 ? "Both" : "All"} seats are taken. A seat frees up 2 minutes after its player goes offline.`}
      </p>
      {seats.map((seat, i) => (
        <Button
          key={seat}
          variant={i % 2 ? "alt" : undefined}
          disabled={!canTakeOver[seat]}
          className={i % 2 ? "disabled:cursor-not-allowed disabled:opacity-60" : undefined}
          onClick={() => onPick(seat, names[seat]!)}
          style={i % 2 || !canTakeOver[seat] ? undefined : accent}
        >
          {canTakeOver[seat] ? `I'm ${names[seat]} · Take this seat` : `${names[seat]} is playing`}
        </Button>
      ))}
    </div>
  );
}
