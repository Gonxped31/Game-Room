import { APP_TITLE, GAMES } from "@/lib/games/registry";
import GamePickerCard from "@/components/GamePickerCard";
import JoinRoomForm from "@/components/JoinRoomForm";

export default function GamePicker() {
  return (
    <main className="mx-auto max-w-[520px] px-4 pb-7 pt-3.5 md:max-w-[800px]">
      <h1 className="m-0 mb-5 inline-block -rotate-2 rounded-[9px] bg-white px-3 py-2 text-[22px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)]">
        {APP_TITLE}
      </h1>
      <p className="mb-4 text-sm opacity-85">Pick a game. You&apos;ll get a private room to share with your partner.</p>
      <div className="grid gap-5 md:grid-cols-2">
        {GAMES.map((game) => (
          <GamePickerCard key={game.slug} game={game} />
        ))}
      </div>
      <div className="md:mx-auto md:max-w-[480px]">
        <JoinRoomForm />
      </div>
      <p className="mt-6 text-center text-sm opacity-85">No accounts. Send your partner the link and you&apos;re both in.</p>
    </main>
  );
}
