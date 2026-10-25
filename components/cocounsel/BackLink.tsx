interface BackLinkProps {
  onBack: () => void;
  className?: string;
}

/**
 * "Back to case selection" - Co-Counsel's own default/home screen (per user
 * request), not the game picker, so only the room's owner gets it. A plain
 * in-page button: `onBack` re-shows CasePicker without touching the room,
 * role claims, or game progress - restarting a case (Rematch/"Start a new
 * case") is the only path that goes to RolePicker instead. Nothing here
 * leaves the room: that's the Footer's "Leave room" (no back link to the hub
 * in a multiplayer room).
 */
export default function BackLink({ onBack, className = "" }: BackLinkProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to case selection"
      className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-black/40 text-lg leading-none text-white ${className}`}
    >
      ←
    </button>
  );
}
