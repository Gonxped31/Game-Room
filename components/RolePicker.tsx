"use client";

import { useState } from "react";
import { Role } from "@/lib/session/types";
import Button from "./Button";

interface RolePickerProps {
  /** Names of the seats already held in this room, if any - so a returning player (new device, cleared storage) can just say who they are. */
  names: Partial<Record<Role, string>>;
  /** Which held seats this guest may take over (their holder has been offline for 2 minutes). */
  canTakeOver: Partial<Record<Role, boolean>>;
  onPick: (role: Role, name: string) => void;
}

export default function RolePicker({ names, canTakeOver, onPick }: RolePickerProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const unclaimed: Role | null = !names.p1 ? "p1" : !names.p2 ? "p2" : null;

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
    const otherName = names.p1 ?? names.p2;
    return (
      <div className="mt-6 grid gap-3">
        <p className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          {otherName
            ? `${otherName} is already in. What's your name?`
            : "What's your name? The other player joins next with their own."}
        </p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your name"
          maxLength={24}
          aria-label="Your name"
          className="w-full rounded-xl border-0 p-3.5 text-lg text-black"
        />
        {error ? (
          <p role="alert" className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
            {error}
          </p>
        ) : null}
        <Button onClick={submit}>Continue</Button>
      </div>
    );
  }

  // Both seats are held by other guests - this device lost its guest ID
  // (wiped storage, another browser) or is a third visitor. A seat can be
  // taken over once its holder has been offline for 2 minutes.
  const anyFree = canTakeOver.p1 || canTakeOver.p2;
  return (
    <div className="mt-6 grid gap-3">
      <p className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
        {anyFree
          ? "Welcome back! Which one are you on this device?"
          : "Both seats are taken. A seat frees up 2 minutes after its player goes offline."}
      </p>
      <Button disabled={!canTakeOver.p1} onClick={() => onPick("p1", names.p1!)}>
        {canTakeOver.p1 ? `I'm ${names.p1} · Take this seat` : `${names.p1} is playing`}
      </Button>
      <Button variant="alt" disabled={!canTakeOver.p2} className="disabled:cursor-not-allowed disabled:opacity-60" onClick={() => onPick("p2", names.p2!)}>
        {canTakeOver.p2 ? `I'm ${names.p2} · Take this seat` : `${names.p2} is playing`}
      </Button>
    </div>
  );
}
