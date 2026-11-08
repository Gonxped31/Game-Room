# Co-Counsel: roles, seats and page flow

How roles are picked and kept, and what the page renders when. The `co-counsel` skill's `SKILL.md` (next to this file) has the rules that matter on every change.

## Roles and seats

- `INVESTIGATOR = "p1"` and `DEFENDANT = "p2"` (`constants.ts`) are **fixed**, and
  never rotate within a case. There's no name entry: character names come from
  the case (`caseDef.characters.investigator/defendant`). Never hardcode
  "Maya"/"Leo".
- **Seats live at room level and persist** through "Rematch" and "Start a new
  case".
- **Auto-assign**: once one role is taken, the next player gets the other
  automatically (an effect in `app/cocounsel/page.tsx`). `pickingRef` stops that
  effect from racing this device's own click. Seats, members and players arrive
  via separate listeners, so there's a render where the clicked role already
  reads as taken but `me` isn't set yet.
- **`ConfirmRoleScreen`** ("Welcome back! Last time you were X") shows when
  rejoining while the case is still fresh (`isFreshGame`: Part 1, no misses, no
  locks), once per visit (`roleConfirmedThisVisit`).
  - **"Switch role instead"** (`handleSwitchRole`) is one atomic seat swap when
    both players are seated, or a move to the empty role otherwise. The other
    device simply finds itself in the other role.
- **Takeover**: when both roles are held by other guests, `RolePicker` enables a
  role only once its player has been offline for 2 minutes (`canTakeOver`).

## Page flow (`app/cocounsel/page.tsx`)

The page renders the first state that applies:
1. `connectionError` or `roomMissing` → message.
2. `!game` → "Connecting…". **This must stay ahead of everything else for
   hydration safety.**
3. `showCasePicker` → `CasePicker`.
4. `needsRoleConfirm` → `ConfirmRoleScreen`.
5. `!me` → `RolePicker`.
6. `!bothJoined` → `Wordmark` + the shared `InviteLinkBanner`.
7. `CASE_DONE` → `RecapScreen`, `AdjournedScreen` or `VerdictScreen`, decided by
   `game.log.at(-1)?.outcome`.
8. `REVEALED` → `RevealScreen`.
9. Otherwise → `PartScreen`.

**Who sees the case picker:**
- **`isCreator`** is a `useState` lazy initializer reading `window.location.hash
  === ""` on the very first render. It works because the session layer only
  writes the hash *after* creating the room.
- That's why everything that navigates *into* a room uses a hard navigation (a
  plain `<a>` or `window.location`, never `router.push`), so the hash is settled
  by the first render.
- **Only the owner ever sees `CasePicker`.** `isOwner = isCreator === true ||
  canRenameRoom` (`meta.createdBy` is this guest), so the owner is still
  recognised after a reload. Only a fresh creation shows the picker unprompted.
- **The owner picks the first case before taking a seat**, but the rules only
  accept game writes from seated players. So that choice waits in
  `pendingCaseId` and is written by `claimRole` once the seat claim lands. The
  role picker already shows the pending case's characters.
- **Choosing a case** (`handleChooseCase`) starts it fresh for both players,
  except the case already underway, which just resumes ("Resume this case"). The
  picker marks the current case "In progress" or "Just played".

**Back links and leaving:**
- **On the owner's screens**, back returns to `CasePicker` (`forceCasePicker`),
  without touching the room or game state.
- **A joiner** gets no back link (`onBack` unset), and `CasePicker` has none
  either: a multiplayer room has no link back to the hub.
- **The Footer's "Leave room"** is the way out for both, `CasePicker`
  included. It asks first once both are seated (`AskDialog`, the app's own modal,
  following the light/dark toggle), gives up the seat and goes
  to `/`.
- **The error and unknown-room screen** has a plain "Back to all games" link.

**Endings:**
- `"adjourned"` never offers the recap, because it would spoil the answers.
- `"judgeRevealed"` shows the case verdict and offers "See the full case file".
- **"Start a new case"** (`AdjournedScreen`) and **"Pick another case"**
  (`VerdictScreen`) open the picker for the owner only. The other player sees
  "Waiting for your partner to pick the next case…" until the owner's choice
  restarts the shared game. **"Rematch"** and the footer's reset replay the same
  case.
