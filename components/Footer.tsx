interface FooterProps {
  room: string;
  /** e.g. "Sam · Master", or undefined before a name/role is picked. */
  identity?: string;
  onChangeRole: () => void;
  onReset: () => void;
  onNewRoom: () => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent text-inherit underline";

export default function Footer({ room, identity, onChangeRole, onReset, onNewRoom }: FooterProps) {
  return (
    <p className="mt-5.5 text-center text-[13px] opacity-85">
      Room: {room}
      {identity ? ` · ${identity}` : null}
      <br />
      <button type="button" onClick={onChangeRole} className={linkClass}>
        Change role
      </button>{" "}
      ·{" "}
      <button type="button" onClick={() => confirm("Reset the whole game?") && onReset()} className={linkClass}>
        Reset game
      </button>{" "}
      ·{" "}
      <button
        type="button"
        onClick={() => confirm("Leave this room and start a brand new one?") && onNewRoom()}
        className={linkClass}
      >
        New room
      </button>
    </p>
  );
}
