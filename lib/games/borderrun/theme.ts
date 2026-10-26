/** Border Run's colours (they match components/borderrun/borderrun.css): a road atlas, with a green highway sign for the title. */
export const PAPER = "#F4F0E6";
export const INK = "#1D2733";
export const SIGN = "#176B4B";
export const ACCENT = "#F5C04A";

/** A guess's fill on the map and its square in the share text. */
export const TONE = {
  endpoint: INK,
  best: "#2E9C5E",
  close: "#E3A12F",
  off: "#D4574B",
  reveal: "#9AA5B1",
} as const;

export const SHARE_SQUARE = { best: "🟩", close: "🟨", off: "🟥" } as const;
