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

## Preview deployments should stop sharing production's data

- **Do:** create a second Firebase project, deploy `database.rules.json` to it, and
  set its five `NEXT_PUBLIC_FIREBASE_*` vars on Vercel's Preview environment only.
- **Why:** previews use production's vars today, so rooms created on a preview land
  in the production database.
- **Where:** Vercel project settings and the Firebase console; no code changes.

## Next time someone has a real iPhone handy

- **Do:** open an FTW room on a real iPhone (Safari) and check two things.
  - Are the five hand cards in the bottom bar showing their numbered faces
    (1-5), not a mirrored "RANK CARD" back?
  - Does "Shuffle prompt" read as one word (not "Shuff le")?

  If both look right, delete this entry. If not, fix it (the card flip's
  `backfaceVisibility` in `components/ftw/CardFace.tsx`; Fredoka's `ffl`
  ligature) and verify on the phone.
- **Why:** both show up only in Playwright's WebKit on Windows, not on the Android
  or desktop profiles. Adding the `-webkit-backface-visibility` prefix made no
  difference there. That points to how WebKit's Windows build draws 3D transforms
  and fonts, not to a real iPhone bug, but only a real device can confirm it.
- **Where:** `components/ftw/CardFace.tsx`, `components/ftw/Hand.tsx`.
