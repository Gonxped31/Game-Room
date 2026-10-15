import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow, Courier_Prime, Fredoka } from "next/font/google";
import type { ReactNode } from "react";
import { APP_TITLE } from "@/lib/games/registry";
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

export const metadata: Metadata = {
  title: APP_TITLE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${archivo.variable} ${archivoNarrow.variable} ${courierPrime.variable}`}>
      <body className="min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-[family-name:var(--font-fredoka)] font-medium">
        {children}
      </body>
    </html>
  );
}
