interface FooterProps {
  room: string;
  /** "Master" / "Guesser", or undefined before a role is picked. */
  role?: string;
  onChangeRole: () => void;
  onReset: () => void;
}

export default function Footer({ room, role, onChangeRole, onReset }: FooterProps) {
  return (
    <p className="mt-5.5 text-center text-[13px] opacity-85">
      Room: {room}
      {role ? ` · ${role}` : null}
      <br />
      <button type="button" onClick={onChangeRole} className="cursor-pointer border-0 bg-transparent text-inherit underline">
        Change role
      </button>{" "}
      ·{" "}
      <button
        type="button"
        onClick={() => confirm("Reset the whole game?") && onReset()}
        className="cursor-pointer border-0 bg-transparent text-inherit underline"
      >
        Reset game
      </button>
    </p>
  );
}
