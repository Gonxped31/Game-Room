import type { ButtonHTMLAttributes } from "react";
import LeaveRoomDialog from "@/components/LeaveRoomDialog";
import { DISPLAY, FOCUS, PrimaryButton, TEXT } from "./ui";

function StayButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${TEXT} flex h-[58px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--ink)] bg-white px-4 text-[18px] font-bold text-[var(--ink)] shadow-[0_5px_0_var(--ink)] transition-transform duration-[60ms] enabled:active:translate-y-[5px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none motion-reduce:transition-none ${FOCUS} ${className}`}
      {...rest}
    />
  );
}

/** Same Page's "Leave room" question: an ink-edged paper card, like the game's notices. */
export default function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => Promise<void> }) {
  return (
    <LeaveRoomDialog
      onStay={onStay}
      onLeave={onLeave}
      className={`${TEXT} rounded-2xl border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-[16px] text-[var(--ink)] shadow-[0_6px_0_var(--ink-shadow)]`}
      titleClassName={`${DISPLAY} text-[24px] leading-tight`}
      StayButton={StayButton}
      LeaveButton={PrimaryButton}
    />
  );
}
