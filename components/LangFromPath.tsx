"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { langOfPath } from "@/lib/i18n/lang";
import { LangProvider } from "@/lib/i18n/useLang";

/** The root layout's language: French under /fr, English everywhere else (docs/i18n.md). */
export default function LangFromPath({ children }: { children: ReactNode }) {
  return <LangProvider lang={langOfPath(usePathname() ?? "/")}>{children}</LangProvider>;
}
