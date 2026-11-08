# Co-Counsel: visual system

Fonts, color tokens, dark mode, headers, layout and animation. The `co-counsel` skill's `SKILL.md` (next to this file) has the rules that matter on every change.

## Visual system

- **Fonts**: Archivo, Archivo Narrow and Courier Prime are loaded in
  `app/layout.tsx` but not applied to `body`. Components opt in with
  `font-[family-name:var(--font-archivo)]`, etc.
- **Colors** come from `lib/games/cocounsel/theme.ts` `COLOR` tokens via inline
  `style`, never Tailwind color utilities.
  - A past bug: `bg-white` broke dark mode in seven components. Use
    `style={{ backgroundColor: COLOR.white }}`.
  - Neutral tokens are `var(--cc-*)`, defined in the Co-Counsel block of
    `app/globals.css` (`:root` light, `[data-theme="dark"]` dark). Brand and role
    colors are plain hex.
  - `COLOR.paper` is `#FFFFFF`, a deliberate deviation from the spec's `#EEF0F6`.
- **Dark mode** is Co-Counsel-only.
  - `useTheme` starts at `"light"` and reads localStorage
    (`"cocounsel-theme"`) in a deferred effect, because the root `data-theme`
    renders on first paint.
  - `ThemeToggle` and `BackLink` sit **inline** in each of the three header shapes
    (`Wordmark`, `HeaderBand`, `ResultsHeader`). Nothing is `position: fixed` at
    the top, so the full-bleed bands start flush with the viewport.
  - **How to play** (`Rules.tsx`, `docs/how-to-play.md`): its ? sits beside
    `ThemeToggle` in all three headers, and `CasePicker` has a link. Its colours
    are the `--cc-*` variables, so it follows dark mode. A rules change (misses,
    Trust/Focus) updates it too.
- **Layout and animation**:
  - `CONTAINER_MAX_WIDTH_CLASS` (480px → 720px at `lg`) is applied to both the
    page and `PartScreen`'s fixed bottom bar.
  - `RevealCard`'s flip reuses the global `flip-inner` class, so it gets the
    reduced-motion override for free. The `stamp-land`/`card-lift` keyframes live
    in `app/globals.css`, with their own reduced-motion disable.
- **`TranscriptSheet`**: the gutter/text row must keep `items-start`. Stretching
  makes the measured line count feed back into itself (30+ empty ruled lines).
