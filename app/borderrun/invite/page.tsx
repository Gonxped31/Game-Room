// /borderrun/invite: the room page again, where invite links land (lib/share.ts inviteUrl),
// with the invite's link preview ("You're invited to a ... room").
import { pageMetadata } from "@/lib/seo/metadata";

export { default } from "@/app/borderrun/page";
export const metadata = pageMetadata("/borderrun/invite", "en");
