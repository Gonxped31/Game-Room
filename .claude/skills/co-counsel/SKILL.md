---
name: co-counsel
description: Co-Counsel, the 2-player cooperative deduction game - rules, cases.json and its validator, state machine, page flow, dark mode. Use when changing or debugging lib/games/cocounsel/, components/cocounsel/, app/cocounsel/, or adding a case.
---

# Co-Counsel

A 2-player cooperative, asymmetric deduction game.
- One player is the **Investigator** (external evidence), the other the
  **Defendant** (internal facts); in French "côté enquête" / "côté défense".
- In each "Part" of a case, both secretly lock in one card, trying to find the
  matching pair while talking it out loud.
- There are no live scores. Trust and Focus appear at the end.

**Read first for anything not covered here:**
- `references/co-counsel/co-counsel-game-design.md` - rules, scoring, the launch
  case.
- `references/co-counsel/co-counsel-visual-spec.md` - tokens, components, copy,
  motion, accessibility.
- Mockups are in `references/co-counsel/` (the `Visual Design-png` folder).

Detail, next to this file: `flow.md` (roles and seats, the page's render order, who
sees the case picker, back links, endings), `cases.md` (case data, validator, writing
a case), `visual.md` (fonts, tokens, dark mode, layout).

## Roles and seats

- `INVESTIGATOR = "p1"` and `DEFENDANT = "p2"` (`constants.ts`) are **fixed**, and never
  rotate within a case. Character names come from the case: never hardcode "Maya"/"Leo".
- **Seats live at room level and persist** through "Rematch" and "Start a new case".
- Auto-assign (`pickingRef` stops it racing this device's own click), `ConfirmRoleScreen`,
  "Switch role instead" (one atomic swap) and takeover: `flow.md`.

## Case data

- `cases.json` holds every case, keyed by ID. **Adding a case needs no code change**
  (`CasePicker` lists every case by its `tier`), but **adding or editing one means
  running `npm test`**: `caseValidator.test.ts` runs the design doc's 8 checks on it.
- **The case being played is `game.caseId`, in the shared state**, read through
  `caseForState()`. The shipped cases and how to write one: `cases.md`.
- **Two languages**: `cases.fr.json` has the same ids and logic in French (a parity
  test checks it); `getCase`/`caseForState`/`casesByTier`/`validateCase` take a
  `lang`. Case text follows **each viewer's** interface language, so the two
  players can read different languages. Interface words: `components/cocounsel/text.ts`.

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

The page renders the first state that applies (the order: `flow.md`). Rules:
- `!game` → "Connecting…" **must stay ahead of everything else for hydration safety.**
- **`isCreator` reads `window.location.hash === ""` on the very first render**, so
  anything navigating into a room is a hard navigation (`<a>`, `window.location`).
- **Only the owner ever sees `CasePicker`**. Their first pick waits in `pendingCaseId`
  until the seat claim lands (the rules take game writes only from seated players).
- `"adjourned"` never offers the recap, because it would spoil the answers.

## Visual system (`visual.md`)

- **Colors** come from `lib/games/cocounsel/theme.ts` `COLOR` tokens via inline
  `style`, never Tailwind color utilities (`bg-white` broke dark mode in seven components).
- **Dark mode** is Co-Counsel-only. Nothing is `position: fixed` at the top.
- **`TranscriptSheet`**: the gutter/text row must keep `items-start`.

## Verifying a change

- `npm test` for the state machine and validator, and `npm run test:rules` if the
  state shape changed.
- For flows across two devices (role pick, auto-assign, swap, a full case), use
  the `live-test` skill.
- For any visual change, use the `ui-review` skill with `--dark`, which captures
  both themes on phone and desktop.
