// Border Run, endless routes, as one HTML file that plays offline (scripts/export-solo.mjs):
// the site's own stage, without the hub, the daily route or anything online.
import { createRoot } from "react-dom/client";
import Stage from "@/components/borderrun/Stage";

const app = document.getElementById("app");
if (app) createRoot(app).render(<Stage />);
