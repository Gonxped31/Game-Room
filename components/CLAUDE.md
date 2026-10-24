# Shared components (loads when working in components)

- **`components/`** - shared pieces:
  - `Header`, `Footer`, `Button`, `RoleStickers`.
  - `RolePicker` - name entry with takeover, for 2 seats (FTW) or a `seats` list.
  - `InviteLinkBanner` - the name field shows only for the creator.
  - Hub (`components/hub/`): `Hub` (header, Continue chip, Your rooms button
    or floating pill), `GameCard` (Start + Join), `HubOverlay` (one shared
    popover on desktop / bottom sheet on mobile), `JoinPanel`,
    `YourRoomsList` (+ `HomeScreenTip`), `useSavedRooms`. Art and list tiles
    live in `components/gameRoom/`.
  - Room pages: `InAppBrowserBanner`.
  - Every page: `LocalModeBanner`, and `ConnectionBanner` ("Reconnecting…" after
    2 s without the database; skipped on `/solo` pages).
  - Crashes: `app/error.tsx` and `app/global-error.tsx` show `RecoveryScreen`
    (Try again, Reload, Back to all games) instead of a blank page.
