# Follow-ups

Deferred work that should happen **when something else happens**, not now. Each
entry names its trigger. When you finish a task, check whether it triggered any
entry below. If it did, do that work (or tell the user it's now due), then delete
the entry. Delete an entry too once it no longer applies.

Format: **When** (the trigger) · **Do** (the change) · **Why** (so a future reader
can judge whether it still applies) · **Where** (files involved).

---

## The first game with 3+ players ships

- **Do:**
  - Merge `useGameSession` and `useMultiplayerSession` into one session engine,
    keeping a thin 1v1 wrapper so existing game pages don't change.
  - Build N-player versions of `RolePicker` and `Header`, which are hardcoded to 2
    seats.
  - Delete the unused `setIdentityName`/`releaseAllIdentityNames`
    (`lib/session/identity.ts`) and `setMultiplayerIdentityName`
    (`lib/session/multiplayer/identity.ts`), along with their tests.
  - Drop the always-empty `names` field that `WithIdentity` forces into every game
    state.
- **Why:** both hooks are already thin mappings over `lib/session/shared/useRoom.ts`.
  They were kept apart only so the 1v1 API stayed stable until a real 3+ player
  game showed what the merged API should look like.
- **Where:** `lib/session/useGameSession.ts`, `lib/session/multiplayer/`,
  `lib/session/types.ts`, `components/RolePicker.tsx`, `components/Header.tsx`,
  both games' `game.ts` (`names: {}` in `newGame`).

## Co-Counsel gets a second case

- **Do:** turn `CasePicker` into a real choice and store the chosen case ID in the
  shared game state.
  - Today the confirmation is local to the creator's device, and the case is fixed
    by `CASE_ID` in `app/cocounsel/page.tsx`.
  - Update `database.rules.json` if the state shape changes, using the
    `database-rules` skill.
- **Why:** with one case there's nothing to sync. With two, the joiner must load the
  creator's choice.
- **Where:** `app/cocounsel/page.tsx`, `components/cocounsel/CasePicker.tsx`,
  `lib/games/cocounsel/game.ts`, `lib/games/cocounsel/cases.json`.

## The designed "Your rooms" arrives

- **Do:** replace the simple `YourRooms` panel with the design.
- **Why:** the spec (`references/new-system-design.md`, section 4) shipped a
  deliberately plain version, with a designed one promised later.
- **Where:** `components/YourRooms.tsx`, `components/HomeScreenTip.tsx`.

## Preview deployments should stop sharing production's data

- **Do:** create a second Firebase project, deploy `database.rules.json` to it, and
  set its five `NEXT_PUBLIC_FIREBASE_*` vars on Vercel's Preview environment only.
- **Why:** previews use production's vars today, so rooms created on a preview land
  in the production database.
- **Where:** Vercel project settings and the Firebase console; no code changes.

## Anytime: known bugs

### Text typed before the page hydrates is lost

- **Seen:** on a WebKit (iPhone) profile, typing a room code into the hub's join
  form right after the page loads. The text shows in the field, but React's state
  stays empty, so "Join" stays disabled. Retyping the *same* text doesn't help,
  because React's value tracker sees no change; the user has to edit it. Fast
  desktop Chromium doesn't hit it. A slow phone on a real network can.
- **Do:** make the hub's controlled inputs survive pre-hydration typing. For
  example, on mount, adopt the input element's current DOM value into state when
  it differs (from a deferred callback, per this repo's set-state-in-effect lint
  rule), or render the field disabled until hydrated. FTW's name field
  (`components/RolePicker.tsx`) likely has the same issue, so check it too. Then
  drop the retry in `fillJoinForm` (live-test skill).
- **Why:** found by the `live-test` skill's phone profiles; reproduced with a
  one-off script.
- **Where:** `components/JoinRoomForm.tsx`, `components/RolePicker.tsx`,
  `.claude/skills/live-test/scripts/two-players.mjs`.

### FTW's name field has no visible box

- **Seen:** on every device, "Your name" (`components/RolePicker.tsx`) renders as
  bare placeholder text on the teal. The input has no background or border:
  Tailwind's base styles make inputs transparent, and the field only sets
  `border-0`.
- **Do:** give it an explicit background (likely white, matching the panel above
  it) and check against `references/ftw/first-to-worst.html`.
- **Why:** found by the `ui-review` skill's screenshots.
- **Where:** `components/RolePicker.tsx`.

## Anytime

- **Do:** update the system design diagram linked from `README.md`.
- **Why:** it shows the architecture from before the guest-ID rework (no auth, open
  rules, seats in game state).
- **Where:** the artifact linked at the top of `README.md`.
