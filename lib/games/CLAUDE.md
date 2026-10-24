# Games (loads when working in lib/games)

- **Game logic lives in `lib/games/<slug>/`, never in components.**
  - Transitions are pure: they throw on an invalid move (the store turns that into
    a no-op) and never mutate.
  - Every transition has Vitest coverage.
- **Realtime Database data shapes**, assumed from day one in every game:
  - Empty arrays and objects are dropped on write, so read them as `value ?? []`.
  - An explicit `undefined` is rejected on write, so clear a field by building a
    new object without it.

- **`lib/games/<slug>/`** - each game's pure state machine, constants, content and
  tests. `lib/games/shared/language.ts` - the room content language (`en`/`fr`). **`components/<slug>/`** and **`app/<slug>/page.tsx`** - each game's UI.
- **`lib/games/registry.ts`** - every game (`ALL_GAMES`); the hub shows `GAMES`.
  Set `hidden: true` to take a game off the hub while keeping it playable and
  still named correctly in "Your rooms".
