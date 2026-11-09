// Detour, endless routes, as one HTML file that plays offline (scripts/export-solo.mjs):
// the site's own stage, without the hub, the daily route or anything online.
// No URL to take the language from: the browser's, read once at startup.
import { createRoot } from "react-dom/client";
import Stage from "@/components/borderrun/Stage";
import { defaultLang } from "@/lib/i18n/lang";
import { LangProvider } from "@/lib/i18n/useLang";

const lang = defaultLang(navigator.languages);
document.documentElement.lang = lang;

const app = document.getElementById("app");
if (app)
  createRoot(app).render(
    <LangProvider lang={lang}>
      <Stage />
    </LangProvider>,
  );
