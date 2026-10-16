# Game Room platform - build history

How the single-game app became a multi-game platform: the shared session layer, the picker, E-Card (built and removed), joining by code/name, and the guest-ID/locked-down-rules rework.

**This is history, not documentation of the current system.** Entries describe what
was true when they were written, and many describe mechanisms that were later
replaced (most notably by the guest-ID rework: seats moved out of game state, the
per-tab `me` pointer, the polling heartbeat and the open database rules are all
gone). For how things work now, see the root `CLAUDE.md` and the project skills in
`.claude/skills/`.

## Stages

- **Multi-game platform Stage 1 (done):** the shared `lib/session/` + `lib/store`
  refactor (the session/store layer, as it was then - since reworked; see the root `CLAUDE.md` for today's). FTW moved from `/` to `/ftw` with
  zero behavior change — verified by re-running every existing Playwright
  regression script (cross-tab sync, names/stickers, invite/recap, drag-drop,
  reduced-motion) against `/ftw` and a real-Firebase two-pair/four-player test
  confirming the new nested `games/{room}/ftw` path works and isolates correctly.
- **Multi-game platform Stage 2 (done):** `lib/games/registry.ts` (`APP_TITLE`,
  originally "Game Night" and later renamed to "Game Room" once the platform grew
  games unrelated to romance/relationships - see below - + a flat `GAMES` array)
  backs a new `app/page.tsx` - a server
  component listing games as link cards to `/<slug>`, replacing the Stage 1
  redirect. `Footer` gained an "All games" link back to the picker. Root
  `metadata.title` switched from FTW's `GAME_TITLE` to the platform's
  `APP_TITLE`. Verified: `/` renders the picker with no redirect, clicking into
  First to Worst lands on a fresh room, "All games" returns to the picker, and
  the browser back button restores the room (hash intact) - standard navigation
  history, no special-casing needed. Re-ran the FTW regression suite to confirm
  the Footer addition didn't break anything.
- **E-Card, a second game, was built (Stages 3-5 of the multi-game platform
  plan) and then removed.** It was a 12-round Emperor/Citizen/Slave bluffing
  game adapted from *Kaiji*, fully built with its own `lib/games/ecard/` state
  machine, `components/ecard/` UI, and `app/ecard/page.tsx`, verified end-to-end
  including real cross-device Firebase play. Pulled after playtesting: the
  bluffing tension depends on reading your opponent's face in person, which
  doesn't translate to playing on separate phones. Removed cleanly via the
  "adding a new game" pattern in reverse - delete its three directories, drop
  its `lib/games/registry.ts` entry, nothing shared needed to change. The one
  thing worth keeping from it is the Realtime Database gotchas above (now
  folded into "Store design notes"), since those apply to any future game, not
  just that one.
- **Platform renamed "Game Night" → "Game Room".** `APP_TITLE`
  (`lib/games/registry.ts`) drives the picker's title and root `metadata.title`, so
  this was a one-line change there. Done because future games don't have to be about
  romance/relationships the way FTW is - the two shared components that still said
  "partner" (`RolePicker`'s "Your partner joins next..." and `InviteLinkBanner`'s
  "Waiting for your partner to join?") were reworded to "the other player" for the
  same reason, since any future game reuses those as-is. FTW's own in-game copy
  (footer identity line, round status text, etc.) still says things like "Master"/
  "Guesser" and keeps its own relationship-flavored prompt content - only the
  platform-level chrome and shared components changed, not FTW itself.
- **Multi-game platform Stage 6 (done): responsive FTW, themed invite links, join
  by room code.** Three user-requested changes.
  - **FTW grows on desktop.** `lib/games/ftw/constants.ts` gained its own
    `CONTAINER_MAX_WIDTH_CLASS` (`520px` mobile, unchanged, growing to `760px` by
    the `lg` breakpoint) - duplicated from Co-Counsel's identical-in-spirit
    constant rather than imported, consistent with this repo's per-game-layout
    convention. Applied to both `app/ftw/page.tsx`'s `<main>` and
    `RoundBoard.tsx`'s fixed bottom action bar (a separate `position:fixed`
    stacking context that needs the same class applied directly to stay aligned,
    same reasoning as `PartScreen`'s fixed bar in Co-Counsel). Verified the two
    stay pixel-aligned at a 1280px viewport via a live two-device Playwright
    game, not just visually.
  - **`InviteLinkBanner`'s button is themed per game**, not hardcoded to FTW's
    pink everywhere. Gained `accentColor`/`accentShadowColor`/`accentTextColor`
    props, defaulting to FTW's existing pink/dark-pink/white so FTW's call site
    (which passes none of them) stays pixel-identical; Co-Counsel's page passes
    `COLOR.yellow`/`COLOR.ink`/`COLOR.ink`, so its invite screen reads as
    Co-Counsel rather than FTW (and tracks Co-Counsel's own dark-mode toggle,
    since `COLOR.ink` is itself a `var(--cc-ink)` reference). The colors override
    `Button`'s own classes via an inline `style` prop (higher specificity than a
    Tailwind arbitrary-value class), so `Button.tsx` itself needed no changes.
  - **Join a room by code, from the picker.** `lib/session/roomMeta.ts` (since replaced by `lib/session/shared/roomActions.ts` + `updates.ts`) is a new
    shared-session module (see "Multi-game architecture" above for the full
    design) recording which game a room belongs to, plus an optional display
    name; `useGameSession` now exposes `roomName`/`setRoomName`.
    `components/JoinRoomForm.tsx` is a new box on the picker page (`app/page.tsx`)
    - type a code (or paste a whole invite link; it strips everything before the
    last `#`), and it looks up that code's `RoomMeta` and routes straight to
    `/${gameSlug}#${code}` with no "which game?" prompt needed. An unrecognized
    code shows an inline "we couldn't find that room" error instead of
    navigating. The optional room name is set from `InviteLinkBanner` itself (a
    "Name this room (optional)" field, pre-filled with any existing name, saving
    on blur) - showing the raw code as the field's placeholder is the "defaults
    to the ID" behavior; no separate placeholder/default-value plumbing needed,
    since consumers (`Footer`, both games') just render `roomName || room`
    wherever they'd previously shown the bare code. The store layer gained a new
    `Store<T>.readOnce()` method for this (see "Store design notes") - a one-off
    backend read, since the join form has no live subscription to a typed-in
    code's room to read a cache from. Verified live: FTW's and Co-Counsel's rooms
    both round-trip through naming (persists across a reload, shown correctly in
    both games' Footers) and joining (routes to the exact right game and room for
    both), a bogus code shows the inline error without navigating, and zero
    console errors throughout.
- **Multi-game platform Stage 7 (done): Game Room picker redesign, join by room
  name.** Went through two passes - the first matched only the mobile mockup
  (missed the desktop mockup's two-column layout entirely, caught when the user
  pointed at `references/game-room/Game Room, desktop@2x.png` directly); the
  second was a ground-up rebuild against `references/game-room/game-room-ui-spec.md`
  once the user pointed at that file specifically, since it turned out to
  specify far more precisely than the mockup images alone conveyed (exact
  breakpoint, dimensions, colors, states, motion, accessibility) - **including
  that the card art should be code-drawn, not cropped screenshots**, reversing
  the "use the reference PNGs directly" choice from the first pass (`public/
  games/*.png` deleted).
  - **Layout matches the spec's own breakpoint (760px, not Tailwind's `md:`
    768px) via arbitrary `min-[760px]:` variants throughout**, not Tailwind's
    built-in breakpoints - `app/page.tsx` sets its own `#0F7983` background
    (deliberately distinct from FTW's `--table` `#128A94`, per spec, so white
    text keeps 4.5:1 contrast - set on a wrapper div, `app/globals.css`'s
    `--table` itself untouched), exact page padding (40/56/32px desktop,
    24/16/24px mobile), and a flex-wrap card row (340px cards, 56px gap,
    centered) that collapses to a single stacked column (max 440px, 20px gap,
    no tilt) under 760px - the same flex-wrap mechanism the spec says handles
    a 3rd+ game later, so no extra breakpoint logic needed for that case.
  - **`lib/games/registry.ts`'s `GameEntry` redone to match the spec's per-game
    token table exactly**: `ink` (title/chip-border/button-border-shadow-text
    color), `textSecondary` (description color), `accentColor` (button fill),
    `titleClassName`/`buttonTextClassName` (font family/weight/tracking/size,
    e.g. Co-Counsel's Archivo 800 with `-0.02em` tracking vs FTW's default
    Fredoka 700) - `image`/`emoji` dropped (no longer used).
  - **`components/GamePickerCard.tsx`** rebuilt to the spec's exact card chrome
    (20px/18px radius, padding, two-layer shadow) and motion (resting tilt
    alternating -1.5°/+1.5° by card index, **desktop-only** - applied via a
    `--tilt` CSS custom property consumed by an arbitrary-property class gated
    behind `min-[760px]:`, not an unconditional inline `transform`, so it
    genuinely doesn't exist below that breakpoint rather than just resetting to
    0; straightens + lifts 6px on hover/focus, `motion-reduce:` disables the
    transition). New `components/gameRoom/FtwArt.tsx` (the fanned five-card
    hand, numerals gradient-filled via `background-clip:text` reusing
    `NUMBER_GRADIENTS` from `lib/games/ftw/constants.ts` directly rather than
    duplicating those hex values) and `CoCounselArt.tsx` (the blue/red split
    panel, two mini claim cards, and the yellow "lens" mark) - both render two
    full size variants (desktop/mobile numbers), toggled by visibility classes
    at the 760px breakpoint, rather than stacking responsive arbitrary-value
    classes on every one of the many positioned elements.
  - **`components/JoinRoomForm.tsx` rebuilt around the spec's single-input +
    Code/Name switch design**, replacing the previous two-separate-fields
    version. The switch (`role="radiogroup"`, two `role="radio"` segments,
    left/right arrow keys move the selection) only changes the placeholder/
    helper text/`aria-label` - **the lookup itself always tries the typed value
    as a room code first, then as a room name**, per the spec's "Behavior"
    section, so getting the switch "wrong" still works. Each mode keeps its own
    typed value in separate state (`codeValue`/`nameValue`) so switching back
    restores what was there, while switching away starts that mode fresh - a
    simpler equivalent to the spec's stated behavior than explicitly tracking
    "did this value survive a mode switch." Exact states implemented: default/
    disabled-until-typed, busy (`aria-busy`, disabled switch/input/button,
    `cursor:progress`), not-found (red border, `aria-invalid`, `role="alert"`
    linked via `aria-describedby`, cleared on edit or mode switch). One addition
    beyond the spec (which assumes a single match): 2+ rooms sharing a name
    render an inline disambiguation list instead of guessing, carried over from
    the user's standing requirement that the spec itself doesn't mention.
    `lib/session/roomMeta.ts`'s `roomsByName` index (now a unique `roomsByName/{nameKey}` entry - see Architecture) (and the Firebase rule it
    needs - see README's "Database rules") is unchanged from the first pass.
  - Verified live: desktop/mobile/exact-760px-edge screenshots against both
    mockup images: switch keyboard nav and ARIA state; join-by-code, by a
    unique name, by an ambiguous name (two real rooms, one FTW one Co-Counsel,
    both actually named identically) showing the disambiguation list with both
    routing correctly; the not-found error state and its clear-on-edit
    behavior; card click-through with the per-game `aria-label`. Zero console
    errors throughout, `tsc`/`eslint`/`vitest`/`next build` all clean.
- **Multi-game platform Stage 8 (done): Co-Counsel temporarily hidden from
  the picker.** User-requested. `lib/games/registry.ts`'s `GAMES` array has
  its `cocounsel` entry commented out, not deleted - a one-line uncomment
  re-enables it. The game itself is completely untouched: `/cocounsel`
  still loads and plays normally for anyone with a direct link (confirmed
  live), including a room created before this change; `JoinRoomForm`'s
  `gameTitle()` helper falls back to the raw slug (`"cocounsel"`, not
  `"Co-Counsel"`) if someone joins such a room by code/name while it's
  hidden, a minor, accepted display-only side effect of hiding it this way
  rather than a bug (the same fallback now applies to `YourRooms` rows). Unlike
  E-Card's removal (above), no directories were
  deleted, no state machine or components were touched, and nothing about
  `lib/session/`'s shared layer changed - this is a pure picker-listing
  toggle.
- **Multi-game platform Stage 9 (done): guest IDs, locked-down database rules,
  onDisconnect presence, "Your rooms".** Implemented from
  `references/new-system-design.md`. The current design is fully described in
  the root `CLAUDE.md`. In summary:
  - **Guest IDs**: Firebase Anonymous Auth; the local-mode fake uid lives in
    sessionStorage (per tab).
  - **Room data model**: `meta`/`seats`/`members`/`players`/`presence`/
    `lastActive` at room level, and `users/{uid}/rooms`. Seat writes are
    multi-path updates built by `lib/session/shared/updates.ts`.
  - **Presence**: onDisconnect instead of the heartbeat.
  - **Room names**: unique (`roomsByName/{nameKey}`), so the join form's
    disambiguation list is gone.
  - **Hub additions**: "Your rooms" with the iOS Home Screen tip, a manifest, and
    icons.
  - **Room-page additions**: the in-app browser banner and the local-mode banner.
  - **Build guard**: a Vercel build without the Firebase vars fails.
  - **Rules tests**: 86 emulator tests, wired into CI.

  **Decisions made with the user before building** (where the spec conflicted with
  the code):
  - The user supplied `database.rules.json`, and it was then tested and fixed
    against the emulator.
  - Only the creator names or renames a room, later, from `InviteLinkBanner`.
  - Seats persist across game resets, and Co-Counsel's "Switch role instead"
    became an atomic swap.
  - Creating a room seats nobody.
  - 3+ seats are tested via an in-memory `mptest` slug.

  **Rules changes made over the user's original file** (each proven by a test):
  - The creator rename, with `meta/nameKey` required to match a `roomsByName`
    entry that points at the room.
  - The creating update may write the game state.
  - The swap branch, in `seats` and `members`.
  - A takeover hole: the taker's old seat must be vacated, or one uid could hold
    two seats.
  - `users/$uid/rooms` must be an object.
  - Full `ftw`/`cocounsel` `.validate` rules.

  **Verified** against the Auth + Database emulators (see Testing). The live
  deploy hit one problem: the rules went out before the new client, so the old
  client's room creation was refused (see "Deploy order matters").
