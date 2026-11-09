"use client";

import { useEffect, useRef, useState } from "react";
import { texts } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";
import { inviteFromLocation } from "@/lib/session/shared/inviteFromLocation";
import Button from "./Button";

const TEXT = texts({
  en: {
    waiting: "Waiting for the other player to join?",
    copied: "Copied!",
    copy: "Copy invite link",
    nameRoom: "Name this room (optional)",
    findAgain: (room: string) => `So you can find this room again later by its code: ${room}`,
  },
  fr: {
    waiting: "L'autre joueur n'est pas encore là ?",
    copied: "Copié !",
    copy: "Copier le lien d'invitation",
    nameRoom: "Nomme ce salon (facultatif)",
    findAgain: (room) => `Pour retrouver ce salon plus tard avec son code : ${room}`,
  },
});

interface InviteLinkBannerProps {
  room: string;
  roomName?: string;
  /** Only the room's creator may name it - leave undefined for everyone else to hide the field. */
  onRenameRoom?: (name: string) => void;
  /** Why the last rename didn't go through, e.g. "That name is taken. Try another." */
  nameError?: string | null;
  /** Button background - defaults to First to Worst's own pink so FTW's
   * usage (which passes none of these) stays pixel-identical. */
  accentColor?: string;
  /** Button's pressed-state drop shadow - should read as a darker shade of accentColor. */
  accentShadowColor?: string;
  accentTextColor?: string;
}

export default function InviteLinkBanner({
  room,
  roomName,
  onRenameRoom,
  nameError,
  accentColor = "#FF3D8F",
  accentShadowColor = "#a3125b",
  accentTextColor = "#FFFFFF",
}: InviteLinkBannerProps) {
  const t = useText(TEXT);
  const [copied, setCopied] = useState(false);
  const [nameDraft, setNameDraft] = useState(roomName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // `roomName` starts undefined (meta hasn't loaded yet, on server and
  // client's first paint alike) and arrives asynchronously once the store
  // delivers a value - re-sync the draft when that happens, but only while
  // the field isn't actively focused, so a partner's concurrent rename
  // doesn't stomp on what this device is mid-typing. Deferred via
  // setTimeout(fn, 0) rather than a direct setState call, same pattern as
  // useGameSession's `now` tick and useTheme's stored-preference read.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    const id = setTimeout(() => setNameDraft(roomName ?? ""), 0);
    return () => clearTimeout(id);
  }, [roomName]);

  const copy = async () => {
    try {
      // The room's invite page in this page's language, not the address as it is (lib/share.ts).
      await navigator.clipboard.writeText(inviteFromLocation(window.location));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (permissions, insecure context) - the link is
      // still right there in the address bar to copy manually.
    }
  };

  const saveName = () => {
    if (onRenameRoom && nameDraft.trim() !== (roomName ?? "")) onRenameRoom(nameDraft);
  };

  return (
    <div className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-center text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
      <p className="m-0 font-semibold">{t.waiting}</p>
      <Button onClick={copy} style={{ backgroundColor: accentColor, boxShadow: `0 4px 0 ${accentShadowColor}`, color: accentTextColor }}>
        {copied ? t.copied : t.copy}
      </Button>
      {onRenameRoom ? (
        <>
          <label className="mt-2.5 block text-left text-xs font-semibold opacity-70">
            {t.nameRoom}
            <input
              ref={inputRef}
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder={room}
              maxLength={40}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "room-name-error" : undefined}
              className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm font-normal text-black ${nameError ? "border-[#D7263D]" : "border-black/15"}`}
            />
          </label>
          {nameError ? (
            <p id="room-name-error" role="alert" className="m-0 mt-1.5 text-left text-xs font-semibold text-[#B3132B]">
              {nameError}
            </p>
          ) : null}
        </>
      ) : null}
      <p className="m-0 mt-1.5 text-left text-[11px] opacity-60">{t.findAgain(room)}</p>
    </div>
  );
}
