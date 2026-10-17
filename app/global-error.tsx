"use client";

import RecoveryScreen from "@/components/RecoveryScreen";

/** The root layout itself crashed: this replaces the whole document, so it brings its own html and body. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <title>Game Room</title>
        <RecoveryScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
