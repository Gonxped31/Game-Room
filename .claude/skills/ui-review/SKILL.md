---
name: ui-review
description: How to make and check a visual/UI change in Game Room - which spec governs which screen, the pitfalls that have bitten this repo before, and a script that screenshots pages as real phones (iPhone in WebKit/Safari's engine, Android) and desktop, flagging horizontal overflow and console errors. Use for any change to components, pages, layout, styles or copy, before calling it done.
---

# UI changes: spec, pitfalls, device screenshots

The games are played on phones *and* computers, so a UI change isn't done until
it's been seen on both. Game-specific visual rules live in the `first-to-worst` and
`co-counsel` skills; this skill covers what applies everywhere.

## 1. Find the spec for the screen you're changing

| Area | Source of truth |
| :--- | :--- |
| Hub (`/`): folders, game cards, join form, "Your rooms" | `references/game-room/game-room-ui-spec.md` (v2: Social and Solo folders, the yellow Talk it out panel, compact mobile cards). The PNGs in `references/game-room/visual-design/` are the v1 boards: still right for the Join popover, sheets and Your rooms, not for the page layout. Its breakpoint is **760px** (`min-[760px]:`), not Tailwind's `md:`. Background `#0F7983`. |
| Same Page (formerly First to Worst, `/same-page`) | `references/ftw/first-to-worst-game-design.md` (the Same Page visual spec). Breakpoint **900px**. |
| Co-Counsel | `references/co-counsel/co-counsel-visual-spec.md` + `Visual Design-png/` |
| Night Highway | `references/night-highway/Night Highway.html` (the original game; its title card is the style for the race page's own screens) |
| Buzzer Quiz | `references/buzzer-quiz/buzzer-quiz-visual-spec.md` (look, screens, copy) + `buzzer-quiz-game-design.md` (behavior). Its breakpoint is **900px**. |
| Word Scramble | `references/scramble/word-scramble-visual-spec.md` + `word-scramble-game-design.md`. Breakpoint **900px**. |

Read the spec itself, not just the mockup images; it pins exact sizes, colors,
states and motion. One past redesign matched only the mobile mockup and missed the
desktop layout entirely.

## 2. Pitfalls this repo has hit before

- **First-paint must match the server render.** Anything depending on `window`,
  `localStorage`, the clock or the user agent must stay behind a gate that's
  identical on server and client (e.g. the `!game` loading state), or come from
  `useSyncExternalStore` with a server snapshot. A case picker rendered too early
  caused a hydration error.
- **Fixed-position elements cover whatever is at the viewport edge.** Reserve
  clearance on the page's `<main>`, or use `position: sticky` (Same Page's dock). Apply the container width
  class to the fixed element directly, since it's its own stacking context. A fixed
  top button once left a white gap above Co-Counsel's colored bands.
- **Co-Counsel colors come only from `COLOR` tokens via inline `style`**, never
  Tailwind color classes. A `bg-white` broke dark mode in seven components and
  passed every automated check. Always look at both themes.
- **Inputs have no default styling.** Tailwind's base styles make form fields
  transparent and borderless, so give every input an explicit background (and a
  border or shadow where it sits on a colored background). FTW's name field and
  custom-prompt box were both invisible on the teal for a while.
- **Server-rendered inputs can be typed into before hydration.** That text never
  reaches React state, so adopt the field's DOM value on mount (see
  the hub's old join form). Inputs that only render after client data loads or
  a click (game screens, the hub's Join popover) don't have this problem.
- **Accessibility patterns already in use; stay consistent:**
  - segmented switches: `role="radiogroup"`/`role="radio"` with arrow keys;
  - errors: `role="alert"` linked via `aria-describedby`, plus `aria-invalid`;
  - live status text: `aria-live`;
  - icon-only buttons: an `aria-label`.
- **Respect reduced motion.** Flips use the global `flip-inner` class, and new
  keyframes need a `prefers-reduced-motion` override in `app/globals.css`.
- **Same Page's 5-note hand must fit one row at 375px** (the `iphone-se` profile).

## 3. Screenshot it on real device profiles

Start the emulator-backed dev server from the `live-test` skill (port 3123):

```bash
node .claude/skills/live-test/scripts/dev-against-emulators.mjs
```

Never point screenshots at a plain `npm run dev`. With `.env.local` set, that's the
real Firebase project, and every game page visit creates a real room.

Then run:

```bash
node .claude/skills/ui-review/scripts/screenshots.mjs hub same-page cocounsel --dark
```

**Pages** are given without a leading slash: `hub`, `same-page`, `cocounsel`, or a full
URL. Git Bash rewrites `/same-page` into a Windows path.

**Profiles** (default: all):

| Profile | Device | Browser |
| :--- | :--- | :--- |
| `iphone-se` | 375px | WebKit |
| `iphone` | iPhone 16 | WebKit |
| `android` | Pixel 8 | Chromium |
| `edge-760` | the hub's breakpoint edge | Chromium |
| `desktop` | 1280px | Chromium |

**Options:**
- `--dark` - adds Co-Counsel's dark theme.
- `--reduced-motion`.
- `--full-page` - the whole scrollable page.
- `--profiles=iphone,desktop`.
- `--out=DIR`, `--wait=MS`.

Every shot is checked for **horizontal overflow** and **console errors**, and the
script exits 1 if any are found. The Next.js dev-tools button is hidden. **Open and
look at the images**: the checks catch breakage, not ugliness.

**Screens that need setup** (a typed name, a joined room, a mid-game state): write
a scratch script that imports `newProfileContext(profile)`, `PROFILES` and
`closeBrowsers()` from `scripts/screenshots.mjs`, drives the page, then calls
`page.screenshot()`. For two-player states, combine it with the `live-test`
patterns.

## 4. What emulation can't show

- **WebKit is Safari's engine, but not an iPhone.** Before shipping anything
  layout-sensitive, check on a real phone:
  - notch and home-bar safe areas (`env(safe-area-inset-*)`);
  - the browser bars that resize the viewport while scrolling;
  - Home Screen standalone mode;
  - real touch drag (Same Page notes).
- **Fonts can differ:** WebKit renders Fredoka visibly lighter than Chromium.
  Judge font weight on a real device.
- **Known artifacts of Playwright's WebKit on Windows**, not proven iPhone bugs:
  - Fredoka's `ffl` ligature renders with a gap ("Shuff le").

  Don't "fix" these from emulation alone; todo T-017 (`todo` skill) is the
  real-iPhone check.

## 5. Done when

- The spec matches on phone and desktop.
- No overflow and no console errors in the screenshots.
- Co-Counsel checked in both themes.
- Lint, `tsc` and `npm test` pass, plus the `live-test` skill if the change touches
  a multiplayer flow.
