# Shared components (loads when working in components)

- **A multiplayer room has no back link to the hub** (the user's call,
  2026-10-25: you create or join a room, so the other action is to leave it).
  Every room screen's way out is **Leave room**:
  - Private rooms use `leaveToHub` (`lib/session/shared/roomActions.ts`); public rooms use `usePublicRoom`'s `leave`.
  - Either way it gives up the seat, drops the room from "Your rooms" and hard-navigates to `/`.
  - Private rooms ask first (`LEAVE_CONFIRM`) where leaving ends a game for the others.
  - Only screens with no room to leave (an error, an unknown room), solo pages and `RecoveryScreen` link back to `/`.
  - Mid-game screens with no way out stay that way.
- **`components/`** - shared pieces:
  - `Footer` (room code, Reset game, New room, Leave room), `Button`.
  - `RolePicker` - name entry with takeover, for 2 seats (Same Page) or a `seats` list; `accentColor` themes its buttons.
  - `InviteLinkBanner` - the name field shows only for the creator.
  - Hub (`components/hub/`): `Hub` (header, Continue chip, Your rooms button
    or floating pill, mobile jump buttons, the Social folder with "Play from
    anywhere" and the yellow "Talk it out" panel, the Solo folder),
    `GameCard` (desktop card + compact mobile card, Start + Join, plus
    Matchmaking on matchmaking games; `SoloCard` with Play solo),
    `HubOverlay` (one shared popover on desktop / bottom sheet on mobile),
    `JoinPanel`, `MatchPanel` (Matchmaking: name, language, Find players),
    `YourRoomsList` (+ `HomeScreenTip`),
    `useSavedRooms`. Art (`HubArt`: 168px panel + 92px mini per game) and
    list tiles (`GameTile`) live in `components/gameRoom/`. Room links go
    through the registry's `roomHref`, since a game's route can differ from
    its slug (Same Page: `/same-page`, slug `ftw`).
  - Room pages: `InAppBrowserBanner`.
  - Every page: `LocalModeBanner`, and `ConnectionBanner` ("Reconnecting…" after
    2 s without the database; skipped on `/solo` pages).
  - Crashes: `app/error.tsx` and `app/global-error.tsx` show `RecoveryScreen`
    (Try again, Reload, Back to all games) instead of a blank page.
