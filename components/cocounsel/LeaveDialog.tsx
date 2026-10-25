import type { ButtonHTMLAttributes } from "react";
import LeaveRoomDialog from "@/components/LeaveRoomDialog";
import { COLOR, RADIUS } from "@/lib/games/cocounsel/theme";
import Button from "./Button";

// The secondary button is 52px and plain-hex ink: matched to the primary (56px), in the light/dark theme's ink.
const StayButton = (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button variant="secondary" className="disabled:opacity-60" style={{ height: 56, color: COLOR.ink, borderColor: COLOR.ink }} {...props} />
);
const LeaveButton = (props: ButtonHTMLAttributes<HTMLButtonElement>) => <Button className="disabled:opacity-60" {...props} />;

/** Co-Counsel's "Leave room" question, on the page's paper with an ink edge. */
export default function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => Promise<void> }) {
  return (
    <LeaveRoomDialog
      onStay={onStay}
      onLeave={onLeave}
      className="border-2 p-5 font-[family-name:var(--font-archivo)] text-base"
      style={{ backgroundColor: COLOR.white, color: COLOR.ink, borderColor: COLOR.ink, borderRadius: RADIUS.card }}
      titleClassName="text-xl font-extrabold"
      StayButton={StayButton}
      LeaveButton={LeaveButton}
    />
  );
}
