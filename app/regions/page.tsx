import Link from "next/link";
import Stage from "@/components/regions/Stage";
import RulesButton from "@/components/regions/Rules";

/** Rank & File: a solo puzzle, no room. */
export default function RegionsPage() {
  return (
    <Stage
      online
      rules={<RulesButton />}
      nav={
        <Link href="/" className="cg-back" aria-label="Back to all games">
          ←
        </Link>
      }
    />
  );
}
