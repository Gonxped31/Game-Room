/**
 * Design tokens from references/co-counsel/co-counsel-visual-spec.md, as plain
 * values rather than CSS custom properties - this repo's established pattern
 * (see lib/games/ftw/CardFace.tsx, lib/games/ecard/CardFace.tsx) is inline
 * Tailwind arbitrary values / style props per component, not a shared
 * :root theme layer, so these are just named exports for that same usage.
 */
export const COLOR = {
  ink: "#1C1F3D",
  paper: "#EEF0F6",
  white: "#FFFFFF",
  investigator: "#2447D8",
  defendant: "#C8372D",
  yellow: "#FFD23A",
  green: "#0F7A4A",
  amber: "#A65A00",
  text2: "#4A4F73",
  cardEdgeBlue: "#C9D0E8",
  cardEdgeRed: "#E8CFCC",
  ruleBlue: "#E3E7F4",
  ruleRed: "#F3E3E1",
  gutterBlue: "#5566B4",
  gutterRed: "#B0453D",
  disabledBg: "#DDE1EE",
  disabledText: "#5C6286",
  // Defendant-screen disabled button uses warm gray instead of the blue-leaning
  // disabledBg/disabledText above - see the visual spec's primary-button notes.
  disabledBgWarm: "#E6DFE0",
  disabledTextWarm: "#6B5A5C",
} as const;

export const RADIUS = {
  card: "12px",
  button: "14px",
  paper: "6px",
  stamp: "6px",
} as const;

/** The two role colors, keyed the same way case data screens are. */
export const ROLE_COLOR: Record<"investigator" | "defendant", string> = {
  investigator: COLOR.investigator,
  defendant: COLOR.defendant,
};
