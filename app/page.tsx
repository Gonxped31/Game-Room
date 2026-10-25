import { GAMES } from "@/lib/games/registry";
import Hub from "@/components/hub/Hub";

// The hub's flat teal (references/game-room/game-room-ui-spec.md, "Layout"),
// deep enough that white text passes 4.5:1.
const HUB_TABLE = "#0F7983";

export default function GamePicker() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: HUB_TABLE }}>
      <Hub games={GAMES} />
    </div>
  );
}
