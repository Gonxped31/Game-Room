import { APP_TITLE, GAMES } from "@/lib/games/registry";
import GamePickerCard from "@/components/GamePickerCard";
import JoinRoomForm from "@/components/JoinRoomForm";

// Slightly deeper than First to Worst's own table (#128A94, app/globals.css's
// --table) so white text passes 4.5:1 - a deliberately distinct color per
// references/game-room/game-room-ui-spec.md, not a reuse of --table.
const HUB_TABLE = "#0F7983";

export default function GamePicker() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: HUB_TABLE }}>
      <main className="px-4 pb-6 pt-6 min-[760px]:px-14 min-[760px]:pb-8 min-[760px]:pt-10">
        <h1
          className="m-0 mb-5 inline-block rounded-[9px] bg-white px-3.5 py-2 text-[26px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)] min-[760px]:px-4 min-[760px]:py-2.5 min-[760px]:text-[30px]"
          style={{ fontFamily: "var(--font-fredoka)", transform: "rotate(-2deg)" }}
        >
          {APP_TITLE}
        </h1>
        <p className="mb-8 max-w-[520px] text-base leading-[1.35] text-white min-[760px]:mb-10 min-[760px]:text-[19px]">
          Pick a game. You&apos;ll get a private room to share with your partner.
        </p>

        <div className="flex flex-col items-center gap-5 min-[760px]:flex-row min-[760px]:flex-wrap min-[760px]:items-start min-[760px]:justify-center min-[760px]:gap-14">
          {GAMES.map((game, i) => (
            <div key={game.slug} className="w-full max-w-[440px] min-[760px]:w-[340px] min-[760px]:max-w-none">
              <GamePickerCard game={game} index={i} />
            </div>
          ))}
        </div>

        <JoinRoomForm />

        <p className="mt-6 text-center text-sm leading-[1.35] text-white min-[760px]:text-[15px]">
          No accounts. Send your partner the link and you&apos;re both in.
        </p>
      </main>
    </div>
  );
}
