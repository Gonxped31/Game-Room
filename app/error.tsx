"use client";

import RecoveryScreen from "@/components/RecoveryScreen";

/** Any page that crashes (every game, the hub) shows the recovery screen instead of going blank. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RecoveryScreen error={error} retry={retry} />;
}
