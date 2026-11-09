import Stage from "@/components/borderrun/Stage";
import RulesButton from "@/components/borderrun/Rules";
import { BackLink, LangButton } from "@/components/borderrun/SiteHeader";

/** Detour solo: the daily route and Endless, no room. In the page's language (/fr/borderrun/solo re-exports it). */
export default function BorderRunSoloPage() {
  return <Stage online rules={<RulesButton />} nav={<BackLink />} langSwitch={<LangButton />} />;
}
