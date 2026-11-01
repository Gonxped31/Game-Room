# How to play: every game explains its rules

Every game has a **How to play**: its full rules in a dialog, one tap away
from anywhere in the game. The user's call (2026-10-30), after Last Hop's
players asked "so we just have to block the other player?".

| Rule | Where it's enforced |
| :--- | :--- |
| Every game has `components/<slug>/Rules.tsx` | `lib/games/howToPlay.test.ts` fails without it |
| Adding a game includes it | the `add-game` skill, step 3 |
| A rules change updates it in the same change | this file, and each game's skill |

## Files

- **`components/HowToPlay.tsx`** (shared): the trigger (`variant` `"icon"`,
  the round **?**, or `"link"`, a text button) and the modal `<dialog>`
  (title row with ×, the rules scrolling, "Got it"). It takes the game's
  look (`HowToPlayLook`: class names and the game's own primary button) and
  the rules as `children`. Escape, the backdrop, × and "Got it" close it; it
  opens focused on the rules. It never opens by itself.
- **`components/<slug>/Rules.tsx`** (per game): the rules content and the
  game's look, exported as the button(s) the game's screens place, e.g.
  `export default function RulesButton({ variant, ... })` wrapping
  `<HowToPlay look={LOOK} variant={variant}>…</HowToPlay>`. Take whatever the
  drawings need as props (the viewer's seat, colour, pawn).

## Where it goes

- **The ? button in the game's header (or its top bar), on every screen** of
  the game: name entry, lobby, play, results. On a solo page too.
- **A "How to play" text button where the game is set up**: the lobby, the
  host's setup screen, the solo start screen. Players read rules before they
  start, not mid-turn.
- Never as a separate page, never auto-opened, and never covering a timed
  screen by itself (a player opens it, and the game goes on underneath; say so
  in the rules if timing matters).

## What it says, in this order

Use the sections that apply; skip the rest. Headings are short and plain
("The goal", "A turn", "Scoring", ...).

1. **The goal**: one or two sentences on how you win. Lead with it.
2. **Players and roles**: how many, teams, who does what (the host, the
   ranker and guesser, the Investigator and Defendant...). Say what the host
   decides in a private room and what matchmaking does instead (no host:
   auto-start, votes).
3. **A turn / a round**: the actions, step by step, with the game's real
   button names in bold ("tap **Buzz**").
4. **The rules that matter**: what's allowed and what isn't, with a drawing
   wherever a picture beats a sentence (a move, a board, a card).
5. **Scoring and winning**: points, rounds, ties, when the game ends.
6. **Time**: every clock and countdown, with its length.
7. **Modes and options**: one line each on what changes.
8. **Tips**: two to four, the ones a new player wouldn't guess.

## How it reads and looks

- **Short.** A new player reads it in about a minute. Short sentences, plain
  words, the game's own voice; no wall of text.
- **Numbers come from the game's constants** (clocks, points, rounds), never
  typed twice, so they can't drift from the game.
- **Drawings in code** (inline SVG or the game's own components), in the
  game's style, in the viewer's own colours or pieces where seats have them;
  no screenshots or image files. They're `aria-hidden`: the text must say
  everything the drawing shows.
- **The game's look**: its colours, fonts and primary button
  (`HowToPlayLook`), dark mode included where the game has one (Co-Counsel).
- **Works at 375px** (the `iphone-se` profile) and on desktop; the dialog
  scrolls within 88% of the screen's height.

## Checking it

- The game's live-test script opens it from the header and from the lobby,
  and closes it (Escape, and "Got it").
- `ui-review` screenshots of the open dialog on a phone and on desktop.
- When a rule changes: grep the game's `Rules.tsx` for it in the same change.

## Offline downloads

The offline exports (`exports/`, built by `scripts/export-solo.mjs`) compile
only Tailwind's base, no utilities, so the dialog would show unstyled there.
Keep How to play out of the components they render (each game's `Stage`):
the site's pages place it (Checkmate Grid's and Border Run's `Stage` take a
`rules` prop; Night Highway's solo ? sits in the page's own links).

## Status

Every game has one, on the shared dialog (2026-11-01). Last Hop wrote the
first (2026-10-30) and moved onto `components/HowToPlay.tsx` once it existed.
Where each game places its ? and lobby link is in its skill.
