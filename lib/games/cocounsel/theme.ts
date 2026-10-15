/**
 * Design tokens from references/co-counsel/co-counsel-visual-spec.md. Most
 * are plain values rather than CSS custom properties - this repo's
 * established pattern (see lib/games/ftw/CardFace.tsx, lib/games/ecard/CardFace.tsx)
 * is inline Tailwind arbitrary values / style props per component, not a
 * shared :root theme layer, so these are just named exports for that same
 * usage. The neutral/surface tokens below are the exception: they resolve to
 * `var(--cc-xxx)` (defined in app/globals.css, light + `[data-theme="dark"]`
 * value sets) so Co-Counsel's manual theme toggle (lib/games/cocounsel/useTheme.ts)
 * can swap them without touching any of this module's ~15 consumers. Brand/
 * role colors stay plain hex - already saturated enough to read on a dark
 * background, and part of the game's identity rather than an eye-strain
 * concern.
 */
export const COLOR = {
  ink: "var(--cc-ink)",
  // The visual spec's own value is #EEF0F6 ("Docket Paper") - overridden to
  // pure white per user request, so every surface that was styled to match
  // the page background (the bottom action bar, the stamp's masking
  // background) still reads correctly against it.
  paper: "var(--cc-paper)",
  white: "var(--cc-white)",
  investigator: "#2447D8",
  defendant: "#C8372D",
  yellow: "#FFD23A",
  green: "#0F7A4A",
  amber: "#A65A00",
  text2: "var(--cc-text2)",
  cardEdgeBlue: "var(--cc-card-edge-blue)",
  cardEdgeRed: "var(--cc-card-edge-red)",
  ruleBlue: "var(--cc-rule-blue)",
  ruleRed: "var(--cc-rule-red)",
  gutterBlue: "var(--cc-gutter-blue)",
  gutterRed: "var(--cc-gutter-red)",
  disabledBg: "var(--cc-disabled-bg)",
  disabledText: "var(--cc-disabled-text)",
  // Defendant-screen disabled button uses warm gray instead of the blue-leaning
  // disabledBg/disabledText above - see the visual spec's primary-button notes.
  disabledBgWarm: "var(--cc-disabled-bg-warm)",
  disabledTextWarm: "var(--cc-disabled-text-warm)",
} as const;

/**
 * The content column's responsive max-width, shared by the main page wrapper
 * and anything else that needs to align with it (e.g. PartScreen's fixed
 * bottom action bar, which is in its own `position: fixed` stacking context
 * and so can't just inherit a parent's width). Mobile stays at the original
 * 480px "perfect for phone" width; wider viewports get noticeably more room
 * without stretching into an empty-looking full-desktop-width layout.
 */
export const CONTAINER_MAX_WIDTH_CLASS = "max-w-[480px] sm:max-w-[560px] md:max-w-[640px] lg:max-w-[720px]";

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
