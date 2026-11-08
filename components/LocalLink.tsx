"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocalHref } from "@/lib/i18n/useLang";

/**
 * next/link that keeps the page's language: href="/" on a French page goes to
 * "/fr". For links inside the same language only (the hub, a game's back
 * arrow); a room is still entered with a hard navigation (`<a>`, CLAUDE.md),
 * whose href goes through useLocalHref instead.
 */
export default function LocalLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link href={useLocalHref(href)} {...rest} />;
}
