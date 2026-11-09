import BackLink from "@/components/regions/BackLink";
import Stage from "@/components/regions/Stage";
import RulesButton from "@/components/regions/Rules";

/** Rank & File: a solo puzzle, no room. */
export default function RegionsPage() {
  return <Stage online rules={<RulesButton />} nav={<BackLink />} />;
}
