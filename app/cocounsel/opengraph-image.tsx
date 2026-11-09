// The link-preview card image for /cocounsel (docs/link-previews.md).
import { previewImage } from "@/lib/seo/image";

const image = previewImage("/cocounsel", "en");
export const alt = image.alt;
export const size = image.size;
export const contentType = image.contentType;
export default image.render;
