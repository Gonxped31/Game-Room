"use client";

import { useEffect, useRef, useState } from "react";
import Button from "./Button";

interface InviteLinkBannerProps {
  room: string;
  roomName?: string;
  onRenameRoom: (name: string) => void;
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
  accentColor = "#FF3D8F",
  accentShadowColor = "#a3125b",
  accentTextColor = "#FFFFFF",
}: InviteLinkBannerProps) {
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
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (permissions, insecure context) - the link is
      // still right there in the address bar to copy manually.
    }
  };

  const saveName = () => {
    if (nameDraft.trim() !== (roomName ?? "")) onRenameRoom(nameDraft);
  };

  return (
    <div className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-center text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
      <p className="m-0 font-semibold">Waiting for the other player to join?</p>
      <Button onClick={copy} style={{ backgroundColor: accentColor, boxShadow: `0 4px 0 ${accentShadowColor}`, color: accentTextColor }}>
        {copied ? "Copied!" : "Copy invite link"}
      </Button>
      <label className="mt-2.5 block text-left text-xs font-semibold opacity-70">
        Name this room (optional)
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
          className="mt-1 w-full rounded-lg border border-black/15 px-2.5 py-1.5 text-sm font-normal text-black"
        />
      </label>
      <p className="m-0 mt-1.5 text-left text-[11px] opacity-60">So you can find this room again later by its code: {room}</p>
    </div>
  );
}
