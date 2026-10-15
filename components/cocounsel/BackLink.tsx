import Link from "next/link";

/**
 * Inline "back to the game picker" link - NOT fixed-positioned. Each
 * screen places it directly beside its own header content (the Wordmark
 * logo, or a colored band's title), matching the shared 1v1 Header's
 * inline back-link instead of floating disconnected over the whole
 * viewport (the previous `BackButton`, now removed).
 */
export default function BackLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Back to all games"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white no-underline ${className}`}
    >
      ←
    </Link>
  );
}
