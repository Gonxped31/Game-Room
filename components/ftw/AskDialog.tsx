import type { ButtonHTMLAttributes } from "react";
import RoomDialog, { type RoomDialogProps } from "@/components/RoomDialog";
import { DISPLAY, FOCUS, PrimaryButton, TEXT } from "./ui";

function CancelButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${TEXT} flex h-[58px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--ink)] bg-white px-4 text-[18px] font-bold text-[var(--ink)] shadow-[0_5px_0_var(--ink)] transition-transform duration-[60ms] enabled:active:translate-y-[5px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none motion-reduce:transition-none ${FOCUS} ${className}`}
      {...rest}
    />
  );
}

/** Same Page's questions (Leave room, New room, Reset game): an ink-edged paper card, like the game's notices. */
export default function AskDialog(props: RoomDialogProps) {
  return (
    <RoomDialog
      {...props}
      className={`${TEXT} rounded-2xl border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-[16px] text-[var(--ink)] shadow-[0_6px_0_var(--ink-shadow)]`}
      titleClassName={`${DISPLAY} text-[24px] leading-tight`}
      CancelButton={CancelButton}
      ConfirmButton={PrimaryButton}
    />
  );
}
