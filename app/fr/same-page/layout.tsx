// The French twin of /same-page's layout (docs/i18n.md), with its French link preview.
import { pageMetadata } from "@/lib/seo/metadata";

export { default, viewport } from "@/app/same-page/layout";
export const metadata = pageMetadata("/same-page", "fr");
