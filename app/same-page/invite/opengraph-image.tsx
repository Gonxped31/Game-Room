// The link-preview card image for /same-page/invite (docs/link-previews.md).
import { previewImage } from "@/lib/seo/image";

const image = previewImage("/same-page/invite", "en");
export const alt = image.alt;
export const size = image.size;
export const contentType = image.contentType;
export default image.render;
