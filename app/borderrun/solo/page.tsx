import Link from "next/link";
import Stage from "@/components/borderrun/Stage";
import RulesButton from "@/components/borderrun/Rules";

/** Border Run solo: the daily route and Endless, no room. */
export default function BorderRunSoloPage() {
  return (
    <Stage
      online
      rules={<RulesButton />}
      nav={
        <Link href="/" className="br-back" aria-label="Back to all games">
          ←
        </Link>
      }
    />
  );
}
