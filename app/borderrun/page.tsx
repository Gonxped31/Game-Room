import Link from "next/link";
import Stage from "@/components/borderrun/Stage";

/** Border Run: a solo geography game, no room. */
export default function BorderRunPage() {
  return (
    <Stage
      online
      nav={
        <Link href="/" className="br-back" aria-label="Back to all games">
          ←
        </Link>
      }
    />
  );
}
