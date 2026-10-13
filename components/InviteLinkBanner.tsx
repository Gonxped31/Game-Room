"use client";

import { useState } from "react";
import Button from "./Button";

export default function InviteLinkBanner() {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-center text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
      <p className="m-0 font-semibold">Waiting for your partner to join?</p>
      <Button onClick={copy}>{copied ? "Copied!" : "Copy invite link"}</Button>
    </div>
  );
}
