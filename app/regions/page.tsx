import Link from "next/link";
import Stage from "@/components/regions/Stage";

/** Checkmate Grid: a solo puzzle, no room. */
export default function RegionsPage() {
  return (
    <Stage
      nav={
        <Link href="/" className="cg-back" aria-label="Back to all games">
          ←
        </Link>
      }
    />
  );
}
