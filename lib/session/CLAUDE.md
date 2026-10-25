# Session and seats (loads when working in lib/session)

- **Seat and room writes are multi-path updates built by the pure functions in
  `lib/session/shared/updates.ts`**, sent with `updateRoot()`:
  - `createRoomUpdate` - seats nobody; the creator then picks a seat like anyone
    else.
  - `claimSeatUpdate`, `switchSeatUpdate`.
  - `swapSeatsUpdate` - two seated members trade seats; it can never kick anyone.
  - `leaveRoomUpdate` - "Leave room": also drops the room from the guest's
    "Your rooms" (`users/{uid}/rooms/{code}`). Closing the tab never leaves:
    the seat persists and presence marks the guest offline.
  - `takeOverSeatUpdate` - only once the holder has been offline for over 2 min.
  - `roomNameUpdate`.

  **Never hand-assemble seat or room paths elsewhere.** `seats` and `members` must
  change in the same update.

- **`lib/session/shared/`** - the room mechanics every game shares:
  - `auth.ts` - guest identity.
  - `updates.ts` - the write builders, plus the `RoomMeta`/`PresenceEntry` types.
  - `roomActions.ts` - `createRoom` (retries code collisions up to 5 times),
    `readRoomMeta`, `findRoomByName`, `renameRoom`, `leaveToHub` (a private
    room's Leave room: leave, hard-navigate to `/`; pages ask first with
    `components/LeaveRoomDialog`, texts in `LEAVE_CONFIRM`), and the
    user-facing messages.
  - `presence.ts` - `.info/connected` + `onDisconnect`, keyed by uid. Cleanup
    marks a guest offline but never deletes the entry, because takeover is judged
    on `lastSeen`.
  - `serverClock.ts` - `useServerClock`, `useTicker`, and `useDeadline`, which
    fires on every device when a stored server-time deadline passes.
    `deadline.ts` has the matching pure helpers: a timed step must call
    `assertDue` so that only the first device's commit moves the game on.
  - `useRoom.ts` - the core hook:
    - It waits for auth and a real `#code` before touching the database.
    - A bare visit creates the room *then* sets the hash.
    - It listens to `meta`/`seats`/`members`/`players`/`presence`/game separately,
      never the whole room.
    - It runs seat actions and presence, and writes `lastActive` at most once a
      minute while at least `minPlayers` seats are filled. In the same timer it
      transacts `activeMinutes` (`nextActiveMinutes`): the room's play time, one
      count a minute from whichever seated device gets there first.
    - A seated guest marks `users/{uid}/visits/{yyyymmdd}/{room}` (`visitUpdate`)
      once a day per room and browser (a localStorage guard): the dashboard's
      player history, which "Leave room" (clearing `users/{uid}/rooms`) leaves alone.
- **Matchmaking** ("Matchmaking" button, `docs/matchmaking.md`):
  - `shared/matchmaking.ts` - the pure decisions: `rankRooms`, `staleRooms`,
    `betterRoom` (the lone-player merge), `nextAutoStart`, and the timings.
  - `shared/findMatch.ts` - `findMatch` (search, else create a public room) and
    `tryJoinRoom`. The seat write is the lock: a lost race is refused by the
    rules and the search moves on.
  - `usePublicRoom.ts` - runs a public room on every seated device: the lowest
    online seat keeps the queue entry and `autoStart`; every device starts the
    game when it passes. Pages start public games with `startingSeats` (the
    online ones). In the lobby, the browser's Back button is Leave room (an
    extra history entry; `leaveOnBack` widens it). It takes `useSession`'s session or the 1v1
    `useGameSession`'s (Night Highway), which carries `leave`, `joinedSeats`,
    `onlineSeats` and `publicLang` for it.
    - It watches `closedAt` (set from /admin): `roomClosed` stops presence and
      `lastActive`, and pages show `roomProblemMessage` (`roomActions.ts`)
      instead of the game.
- **`lib/session/useSession.ts`** - the session hook for any game size (2–8
  seats, `maxPlayers` and optional `minPlayers`): seats, presence, room name,
  `isHost`, `moveToSeat`. Games with more than 2 players call it directly.
- **`lib/session/useGameSession.ts`** - the 1v1 wrapper over `useSession` that
  every 2-player game page calls.
  - **Its public API is stable**: `room, game, gameStore, me, other, names,
    bothJoined, roomName, setRoomName, online, pickIdentity, releaseAllIdentities,
    transact, setGame, newRoom`.
  - **Additive fields**: `uid, connectionError, roomMissing, canRenameRoom,
    roomNameError, canTakeOver, leave, joinedSeats, onlineSeats, publicLang`.
  - `me` is `members[uid]`.
  - **Seats survive `setGame()` resets.**
  - `releaseAllIdentities` means "switch role": a swap, or a move to the empty
    seat.
- **`lib/session/types.ts`** - `Role` (`"p1"|"p2"`, never renamed per game),
  `SeatId`/`seatIds`, and `WithIdentity` (1v1) / `WithMultiplayerIdentity`, which
  every game state must extend. Their `names` field is always `{}`: names live in
  `players`.
