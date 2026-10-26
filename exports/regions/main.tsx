// Checkmate Grid, endless puzzles, as one HTML file that plays offline (scripts/export-solo.mjs):
// the site's own stage, without the hub, the daily puzzle or anything online.
import { createRoot } from "react-dom/client";
import Stage from "@/components/regions/Stage";

const app = document.getElementById("app");
if (app) createRoot(app).render(<Stage />);
