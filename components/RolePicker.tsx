import { Role } from "@/lib/constants";

interface RolePickerProps {
  onPick: (role: Role) => void;
}

export default function RolePicker({ onPick }: RolePickerProps) {
  return (
    <div className="mt-6 grid gap-3">
      <p className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
        Who are you this round? Roles swap every round. Your partner picks the other one.
      </p>
      <button
        type="button"
        onClick={() => onPick("p1")}
        className="w-full cursor-pointer rounded-xl border-0 bg-[#FF3D8F] p-3.5 text-lg font-bold text-white shadow-[0_4px_0_#a3125b] active:translate-y-[3px] active:shadow-none"
      >
        I&apos;m the master
      </button>
      <button
        type="button"
        onClick={() => onPick("p2")}
        className="w-full cursor-pointer rounded-xl border-0 bg-white p-3.5 text-lg font-bold text-black shadow-[0_4px_0_rgba(0,0,0,.3)] active:translate-y-[3px] active:shadow-none"
      >
        I&apos;m the guesser
      </button>
    </div>
  );
}
