import { COLOR } from "@/lib/games/cocounsel/theme";

const INK = "#1C1F3D";

function ClaimCardMini({ side, rotate, width, height, stripHeight }: { side: "left" | "right"; rotate: number; width: number; height: number; stripHeight: number }) {
  const stripColor = side === "left" ? COLOR.investigator : COLOR.defendant;
  const tentWidth = width * 0.3;
  const tentHeight = stripHeight * 0.85;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[8px] border-2 bg-white"
      style={{ width, height, borderColor: INK, transform: `rotate(${rotate}deg)` }}
    >
      <div style={{ height: stripHeight, backgroundColor: stripColor }} />
      <div
        className="absolute flex items-center justify-center text-[10px] font-bold"
        style={{
          width: tentWidth,
          height: tentHeight,
          top: 2,
          left: 6,
          backgroundColor: COLOR.yellow,
          color: INK,
          clipPath: "polygon(14% 0, 86% 0, 100% 100%, 0 100%)",
        }}
      >
        2
      </div>
      <div className="absolute left-[10%] right-[10%] rounded-sm" style={{ top: stripHeight + height * 0.14, height: height * 0.05, backgroundColor: "#D7DAE8" }} />
      <div className="absolute left-[10%] right-[25%] rounded-sm" style={{ top: stripHeight + height * 0.25, height: height * 0.05, backgroundColor: "#D7DAE8" }} />
    </div>
  );
}

function LensMark({ width, height, circle, bottom }: { width: number; height: number; circle: number; bottom: number }) {
  return (
    <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2" style={{ width, height, bottom }}>
      <div className="absolute left-0 top-0 rounded-full border-2 border-white" style={{ width: circle, height: circle }} />
      <div className="absolute right-0 top-0 rounded-full border-2 border-white" style={{ width: circle, height: circle }} />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: circle * 0.45, height: circle * 0.45, backgroundColor: COLOR.yellow }}
      />
    </div>
  );
}

/** Co-Counsel's picker-card art: a blue/red split panel with two mini claim cards and the yellow "lens" mark, per references/game-room/game-room-ui-spec.md's "Art: Co-Counsel". */
export default function CoCounselArt() {
  return (
    <div aria-hidden="true" className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex">
        <div className="flex-1" style={{ backgroundColor: COLOR.investigator }} />
        <div className="flex-1" style={{ backgroundColor: COLOR.defendant }} />
      </div>

      {/* Desktop sizing. */}
      <div className="absolute inset-0 hidden min-[760px]:flex min-[760px]:items-start min-[760px]:justify-center min-[760px]:gap-8 min-[760px]:pt-[26px]">
        <ClaimCardMini side="left" rotate={-7} width={80} height={112} stripHeight={18} />
        <ClaimCardMini side="right" rotate={7} width={80} height={112} stripHeight={18} />
        <LensMark width={64} height={40} circle={40} bottom={14} />
      </div>
      {/* Mobile sizing. */}
      <div className="absolute inset-0 flex items-start justify-center gap-8 pt-[12px] min-[760px]:hidden">
        <ClaimCardMini side="left" rotate={-7} width={48} height={68} stripHeight={12} />
        <ClaimCardMini side="right" rotate={7} width={48} height={68} stripHeight={12} />
        <LensMark width={48} height={30} circle={30} bottom={6} />
      </div>
    </div>
  );
}
