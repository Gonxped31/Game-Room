import Link from "next/link";

/**
 * A persistent "back to the game picker" link, fixed to the viewport so it's
 * always reachable regardless of which screen is showing (role-colored
 * bands, white content screens, etc.) - rendered once in app/cocounsel/page.tsx
 * rather than threaded through every individual screen component.
 */
export default function BackButton() {
  return (
    <Link
      href="/"
      aria-label="Back to all games"
      className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white no-underline"
    >
      ←
    </Link>
  );
}
