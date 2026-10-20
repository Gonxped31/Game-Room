import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow, Atkinson_Hyperlegible, Big_Shoulders, Bricolage_Grotesque, Courier_Prime, Fredoka, Overpass, Overpass_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { APP_TITLE } from "@/lib/games/registry";
import LocalModeBanner from "@/components/LocalModeBanner";
import ConnectionBanner from "@/components/ConnectionBanner";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Co-Counsel's own type system (see references/co-counsel/co-counsel-visual-spec.md) -
// loaded here alongside Fredoka but not applied to `body`, so every other page
// keeps Fredoka as before. Co-Counsel's own root wrapper opts into these.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin"],
  weight: ["600", "700"],
});
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Night Highway's type (references/night-highway/Night Highway.html). Google
// now ships "Big Shoulders Display" as Big Shoulders' large optical sizes: the
// browser picks the size from the font size (the opsz axis), so big headings
// get the Display cut. It's also the hub card's title face, so it preloads;
// the Overpass faces only ever appear in the game, so they don't.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
  // next/font has no metrics to size-match a fallback for it; name one instead.
  adjustFontFallback: false,
  fallback: ["Oswald", "Arial Narrow", "Impact", "sans-serif"],
});
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  preload: false,
});
const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  preload: false,
});

// Buzzer Quiz's type (references/buzzer-quiz/buzzer-quiz-visual-spec.md).
// Bricolage Grotesque is also its hub card's title face, so it preloads;
// Atkinson Hyperlegible only appears in the game.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: APP_TITLE,
  // Opened from the Home Screen, iOS runs it as a standalone app - whose
  // storage (the guest ID, the room list) Safari doesn't wipe after 7 days.
  appleWebApp: { capable: true, title: APP_TITLE, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F7983",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${archivo.variable} ${archivoNarrow.variable} ${courierPrime.variable} ${bigShoulders.variable} ${overpass.variable} ${overpassMono.variable} ${bricolage.variable} ${atkinson.variable}`}>
      <body className="min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-[family-name:var(--font-fredoka)] font-medium">
        {children}
        <LocalModeBanner />
        <ConnectionBanner />
      </body>
    </html>
  );
}
