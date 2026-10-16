import { GAMES } from "@/lib/games/registry";
import Hub from "@/components/hub/Hub";

// Slightly deeper than First to Worst's own table (#128A94, app/globals.css's
// --table) so white text passes 4.5:1 - a deliberately distinct color per
// references/game-room/game-room-ui-spec.md, not a reuse of --table.
const HUB_TABLE = "#0F7983";

export default function GamePicker() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: HUB_TABLE }}>
      <Hub games={GAMES} />
    </div>
  );
}
