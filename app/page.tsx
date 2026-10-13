"use client";

import { useEffect } from "react";

/**
 * Temporary: First to Worst used to live at `/`. This keeps old bookmarks/
 * links (including their #room hash) working during the Stage 1 refactor.
 * Stage 2 replaces this with the real multi-game picker.
 */
export default function RootRedirect() {
  useEffect(() => {
    window.location.replace(`/ftw${window.location.hash}`);
  }, []);
  return null;
}
