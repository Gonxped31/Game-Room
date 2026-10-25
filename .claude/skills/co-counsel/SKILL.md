---
name: co-counsel
description: Reference for working on Co-Counsel, the 2-player cooperative deduction game - its rules, case data and validator, state machine, page flow, theming/dark mode and gotchas. Use whenever changing or debugging anything under lib/games/cocounsel/, components/cocounsel/ or app/cocounsel/, editing or adding a case in cases.json, or answering questions about how Co-Counsel plays.
---

# Co-Counsel

A 2-player cooperative, asymmetric deduction game.
- One player is the **Investigator** (external evidence), the other the
  **Defendant** (internal facts).
- In each "Part" of a case, both secretly lock in one card, trying to find the
  matching pair while talking it out loud.
- There are no live scores. Trust and Focus appear at the end.

**Read first for anything not covered here:**
- `references/co-counsel/co-counsel-game-design.md` - rules, scoring, the launch
  case.
- `references/co-counsel/co-counsel-visual-spec.md` - tokens, components, copy,
  motion, accessibility.
- Mockups are in `references/co-counsel/Visual Design-png/`.

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

## Case data

- `cases.json` holds every case, keyed by ID, so the content can be hand-edited.
  Five ship today: Easy `ruined-birthday` (3 Parts) and `missed-arrival` (3),
  Medium `midnight-playlist` (4) and `empty-frame` (5), Hard
  `unlocked-session` (6). **Adding a case needs no code change**: `CasePicker`
  lists every case by its `tier`, and the tests play each one through.
- **The case being played is `game.caseId`, in the shared state**, so both devices
  always play the same one. The page reads it through `caseForState()`, which
  falls back to `DEFAULT_CASE_ID` for an ID no longer in `cases.json`.
- `cases.ts` casts the import once (`as unknown as CaseBank`, because JSON
  imports widen tuples and literal unions) and exports `CASES`/`getCase(id)`,
  `caseForState`, `DEFAULT_CASE_ID` and `casesByTier()`.
- `caseTypes.ts` has the full shape: `CaseDefinition` → `CasePart` →
  `screens`/`hands`/`correct`/`traps`/`theory`, plus `characters` and `verdict`.
- `caseValidator.ts` implements the design doc's 8 validator checks.
  `caseValidator.test.ts` runs them against the real `cases.json`, so **adding or
  editing a case means running `npm test`**. That includes content rule 5: the
  correct pair must not share a distinctive word (5+ letters, minus common
  words), so a Part can't be solved by matching wording alone.
- **Writing a case:** each Part needs a theory except the last; traps should be
  pairs that *feel* right but contradict the partner's screen, and memory lures
  should misremember an earlier Part's fact. Keep the teaser spoiler-free.
- **One deliberate deviation from the doc's wording**: memory-lure cards are
  required in every Part *after the mechanic first appears*, not in every Part
  from Part 2 on. The shipped case first uses it in Part 3.

## State machine (`lib/games/cocounsel/game.ts`)

- **Phases**: `"SELECTING" | "REVEALED" | "CASE_DONE"`. There is no `PART_DONE`:
  the reveal screen's heading and button come from `lastReveal.outcome` instead.
- **`lockIn(game, caseDef, role, cardId)`** resolves the pair once both roles are
  locked.
  - A miss increments `attempts`. The budget is **case-wide**
    (`MAX_CASE_ATTEMPTS` = 3), a deliberate deviation from the doc's "2 per
    Part".
  - Hitting the cap on the **last** Part gives `"judgeRevealed"`: the correct pair
    is shown.
  - Hitting it on an **earlier** Part gives `"adjourned"`: the pair that was
    actually played is shown, never the answer.
  - Either way the case ends at `CASE_DONE`. Only `"solved"` advances to the next
    Part.
- **`continueAfterReveal`** rebuilds the object explicitly to clear `lastReveal`;
  Firebase rejects an explicit `undefined`.
- **Scores are derived, not stored.** `trustPercent`/`focusPercent`/`classifyDuo`
  are computed over `log` and clamped to 0–100.
- **Flags** (`flagsFor`):
  - A contradicted fact on the partner's screen in the same Part → Trust flag.
  - A fact from an earlier Part → Focus flag.
  - A fact on the card-holder's own screen → just a wrong answer.
- **`normalizeGame`** runs on every read, because RTDB drops the empty `locks`
  and `log`.
- **The state shape is validated by `database.rules.json`** (the `cocounsel`
  node). If you change a field, update the rules and
  `tests/rules/gameState.test.ts`, then run `npm run test:rules`.

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
  included. It asks first once both are seated (`LeaveDialog`, the app's own modal,
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

## Visual system

- **Fonts**: Archivo, Archivo Narrow and Courier Prime are loaded in
  `app/layout.tsx` but not applied to `body`. Components opt in with
  `font-[family-name:var(--font-archivo)]`, etc.
- **Colors** come from `lib/games/cocounsel/theme.ts` `COLOR` tokens via inline
  `style`, never Tailwind color utilities.
  - A past bug: `bg-white` broke dark mode in seven components. Use
    `style={{ backgroundColor: COLOR.white }}`.
  - Neutral tokens are `var(--cc-*)`, defined in the Co-Counsel block of
    `app/globals.css` (`:root` light, `[data-theme="dark"]` dark). Brand and role
    colors are plain hex.
  - `COLOR.paper` is `#FFFFFF`, a deliberate deviation from the spec's `#EEF0F6`.
- **Dark mode** is Co-Counsel-only.
  - `useTheme` starts at `"light"` and reads localStorage
    (`"cocounsel-theme"`) in a deferred effect, because the root `data-theme`
    renders on first paint.
  - `ThemeToggle` and `BackLink` sit **inline** in each of the three header shapes
    (`Wordmark`, `HeaderBand`, `ResultsHeader`). Nothing is `position: fixed` at
    the top, so the full-bleed bands start flush with the viewport.
- **Layout and animation**:
  - `CONTAINER_MAX_WIDTH_CLASS` (480px → 720px at `lg`) is applied to both the
    page and `PartScreen`'s fixed bottom bar.
  - `RevealCard`'s flip reuses the global `flip-inner` class, so it gets the
    reduced-motion override for free. The `stamp-land`/`card-lift` keyframes live
    in `app/globals.css`, with their own reduced-motion disable.
- **`TranscriptSheet`**: the gutter/text row must keep `items-start`. Stretching
  makes the measured line count feed back into itself (30+ empty ruled lines).

## Verifying a change

- `npm test` for the state machine and validator, and `npm run test:rules` if the
  state shape changed.
- For flows across two devices (role pick, auto-assign, swap, a full case), use
  the `live-test` skill.
- For any visual change, use the `ui-review` skill with `--dark`, which captures
  both themes on phone and desktop.
