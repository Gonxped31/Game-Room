import Link from "next/link";
import Stage from "@/components/borderrun/Stage";

/** Border Run solo: the daily route and Endless, no room. */
export default function BorderRunSoloPage() {
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
