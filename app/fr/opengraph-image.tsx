// The link-preview card image for /fr (docs/link-previews.md).
import { previewImage } from "@/lib/seo/image";

const image = previewImage("/", "fr");
export const alt = image.alt;
export const size = image.size;
export const contentType = image.contentType;
export default image.render;
