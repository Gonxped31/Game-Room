import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_TITLE } from "@/lib/games/registry";

// The owner's dashboard: not linked from the hub, and kept out of search.
export const metadata: Metadata = {
  title: `Admin · ${APP_TITLE}`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
