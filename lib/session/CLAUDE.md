# Session and seats (loads when working in lib/session)

Every file, hook and field (the write builders, `roomActions.ts`, `useRoom`'s timers,
matchmaking, the `useGameSession` fields): `docs/session.md`.

- **Seat and room writes are multi-path updates built by the pure functions in
  `lib/session/shared/updates.ts`**, sent with `updateRoot()`. **Never
  hand-assemble seat or room paths elsewhere.** `seats` and `members` must change
  in the same update.
  - Creating a room seats nobody; the creator then picks a seat like anyone else.
  - A seat swap can never kick anyone. A takeover needs the holder offline for
    over 2 min.
  - Only "Leave room" leaves (and drops the room from "Your rooms"). Closing the
    tab never leaves: the seat persists and presence marks the guest offline.
- **Presence cleanup marks a guest offline but never deletes the entry**
  (`presence.ts`), because takeover is judged on `lastSeen`.
- **A timed step must call `assertDue`** (`shared/deadline.ts`), so that only the
  first device's commit moves the game on (`useDeadline` fires on every device).
- **`shared/useRoom.ts` waits for auth and a real `#code`** before touching the database
  (a bare visit creates the room *then* sets the hash), and **listens to
  `meta`/`seats`/`members`/`players`/`presence`/game separately**, never the whole
  room.
- **In matchmaking the seat write is the lock** (`shared/findMatch.ts`): a lost
  race is refused by the rules and the search moves on.
- **`useSession.ts`** is the session hook for any game size (2–8 seats); games with
  more than 2 players call it directly. **`useGameSession.ts`** is the 1v1 wrapper
  every 2-player game page calls.
  - **Its public API is stable**: `room, game, gameStore, me, other, names,
    bothJoined, roomName, setRoomName, online, pickIdentity, releaseAllIdentities,
    transact, setGame, newRoom`. New fields are additive.
  - **Seats survive `setGame()` resets.**
- **`lib/session/types.ts`**: `Role` (`"p1"|"p2"`) is never renamed per game. A
  game's state holds no seats or names: those live in the room's `seats` and
  `players`.
