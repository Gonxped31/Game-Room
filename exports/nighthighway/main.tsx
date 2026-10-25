// Night Highway, solo, as one HTML file that plays offline (scripts/export-solo.mjs):
// the site's own stage and engine, without the hub, rooms or anything online.
import { createRoot } from "react-dom/client";
import Stage from "@/components/nighthighway/Stage";

const app = document.getElementById("app");
if (app) createRoot(app).render(<Stage mode="solo" />);
