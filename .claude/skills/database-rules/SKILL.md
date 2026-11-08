---
name: database-rules
description: Changing, testing and deploying the Firebase rules, database.rules.json - emulator tests, rules-language limits, deploy order. Use when editing them, adding game-state or room fields, debugging permission_denied, or deploying.
---

# Database rules: change, test, deploy

`database.rules.json` is the source of truth for the data model. The client must
match it exactly. Every room/seat write the app makes is built in
`lib/session/shared/updates.ts`, and game state is validated per game.

## The model

Every node and who may write it, in one screen: `model.md` (next to this file). Reads: any
signed-in guest can read one room or one name entry. Nobody can read `/games`,
`/roomsByName` or another uid's `/users`.

## Making a change

1. **Write the test first** in `tests/rules/`:
   - `rooms.test.ts` - room, seat, name and user behavior;
   - `gameState.test.ts` - per-game state shapes, valid states built by the real state machine;
   - `sessionUpdates.test.ts` - the app's own update builders sent through the rules;
   - `matchmaking.test.ts` - public rooms, the queue and `autoStart`.

   Use `assertSucceeds`/`assertFails` from `@firebase/rules-unit-testing`, and the
   fixtures in `tests/rules/helpers.ts` (`seedRoom`, `dbAs`, `TS` for a server
   timestamp).
2. Edit `database.rules.json`.
3. Run `npm run test:rules`. It starts the Database emulator, runs the tests, and
   stops it (needs Java).
4. If the client writes something new, add or change the builder in
   `lib/session/shared/updates.ts` (plus `updates.test.ts`). Never hand-assemble
   seat paths in a component.
5. Also run `npm test` and `npm run lint`.

### Rules-language limits that shape everything

- **Regex in `matches()`** is limited: no `{n,m}` quantifiers. Repeat the
  character class, or check `.length`, as the room-code rule does.
- **No loops or functions.** That's why `members` exists (membership in one
  lookup) and why the seat cap is spelled out for p3–p8.
- **`.write` cascades down, never up.** A write at a parent needs permission *at
  that parent*. The rules grant writes only at specific child paths, so clients
  must use multi-path `update()`s with full leaf paths, never a `set`, `update` or
  transaction on `games/{room}`.
- **`.validate` doesn't run on deletes.** Guard deletions in `.write`.
- **In a multi-path update, `newData` is the whole merged result**, which is how
  the `seats` ↔ `members` cross-checks work.
- **`now` is server time.** Fields checked with `<= now` must be written with
  `serverTimestamp()`, never `Date.now()`.

### Testing 3+ seat rooms

- The deployed rules allow `ftw`/`cocounsel`/`nighthighway`, which all force
  `maxPlayers == 2`, `buzzerquiz`, which forces 4, and `wordscramble`, which forces 8.
- `setupEnv(projectId, "mptest")` in `tests/rules/helpers.ts` injects a test-only
  slug **in memory**. Never add it to the file itself.
- `mptest` has no game-state node, so drop its game path from a create update in
  tests.

## Deploying

**Order matters: deploy the app first, then the rules.** Under new rules, an
older client may write in a way they refuse. This happened once: the rules went
out before the new client, and every room creation failed with
`permission_denied` (`transaction at /games/<code>/meta failed`).

1. Merge and push, and let Vercel finish deploying.
2. Deploy the rules from an up-to-date `main`, with the user's go-ahead:
   ```bash
   npx firebase deploy --only database
   ```
   - `.firebaserc` makes the production project (`first-to-worst-74d1a`) the
     default. Emulator and test commands always pass `--project demo-game-room`,
     which overrides it; keep it that way, or they'd run against production's ID.
   - The CLI must be signed in: `npx firebase login:list`. If it isn't, ask the
     user to run `! npx firebase login` (interactive).
   - Prefer this to pasting the file into the console (Realtime Database →
     Rules): it deploys exactly the committed file. A pasted wrong version once
     left the daily board's index missing (2026-10-26).
3. Hard-reload, and test with a fresh room in a normal window plus a private
   window.

If a rules change makes existing rooms' data invalid (a renamed or newly required
field), those rooms stop accepting writes. Say so in the change summary.

## Debugging `permission_denied`

- **Which path?** The console warning names it (`transaction at /games/x/meta
  failed`). Compare that write against the rule for that path.
- **Stale client?** If the code no longer makes that write at all (search the
  repo), the browser is running an old build. Redeploy or restart `npm run dev`.
- **Signed in?** Every rule requires `auth != null`. Anonymous sign-in must be
  enabled in Firebase Authentication. In-app, a sign-in failure shows "Can't
  connect right now".
- **Reproduce it** as an `assertFails`/`assertSucceeds` case in `tests/rules/`
  with the exact paths and values. The emulator is the fastest way to bisect a
  rule.
