// Night Highway, solo, as one HTML file that plays offline (scripts/export-solo.mjs):
// the site's own stage and engine, without the hub, rooms or anything online.
// There's no URL to take the language from, so it follows the browser's, read once at startup.
import { createRoot } from "react-dom/client";
import Stage from "@/components/nighthighway/Stage";
import { defaultLang } from "@/lib/i18n/lang";
import { LangProvider } from "@/lib/i18n/useLang";

const lang = defaultLang(navigator.languages);
document.documentElement.lang = lang;

const app = document.getElementById("app");
if (app)
  createRoot(app).render(
    <LangProvider lang={lang}>
      <Stage mode="solo" />
    </LangProvider>,
  );
