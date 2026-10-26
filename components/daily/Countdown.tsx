"use client";

import { useEffect, useState } from "react";
import { msUntilNextDay } from "@/lib/daily/day";

/** "Next puzzle in 5h 12m", ticking; empty until mounted (the clock is never read during render). */
export default function Countdown({ className }: { className?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msUntilNextDay(Date.now()));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (left === null) return <p className={className}>&nbsp;</p>;
  const minutes = Math.ceil(left / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return <p className={className}>Next puzzle in {h ? `${h}h ${m}m` : `${m}m`}</p>;
}
