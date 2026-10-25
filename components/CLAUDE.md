# Shared components (loads when working in components)

- **`components/`** - shared pieces:
  - `Footer` (room code, Reset game, New room), `Button`.
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
