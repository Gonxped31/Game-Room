import type { ButtonHTMLAttributes } from "react";
import RoomDialog, { type RoomDialogProps } from "@/components/RoomDialog";
import { COLOR, RADIUS } from "@/lib/games/cocounsel/theme";
import Button from "./Button";

// The secondary button is 52px and plain-hex ink: matched to the primary (56px), in the light/dark theme's ink.
const CancelButton = (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button variant="secondary" className="disabled:opacity-60" style={{ height: 56, color: COLOR.ink, borderColor: COLOR.ink }} {...props} />
);
const ConfirmButton = (props: ButtonHTMLAttributes<HTMLButtonElement>) => <Button className="disabled:opacity-60" {...props} />;

/** Co-Counsel's questions (Leave room, New room, Reset case), on the page's paper with an ink edge. Render it inside the [data-theme] root so it follows the light/dark toggle. */
export default function AskDialog(props: RoomDialogProps) {
  return (
    <RoomDialog
      {...props}
      className="border-2 p-5 font-[family-name:var(--font-archivo)] text-base"
      style={{ backgroundColor: COLOR.white, color: COLOR.ink, borderColor: COLOR.ink, borderRadius: RADIUS.card }}
      titleClassName="text-xl font-extrabold"
      CancelButton={CancelButton}
      ConfirmButton={ConfirmButton}
    />
  );
}
