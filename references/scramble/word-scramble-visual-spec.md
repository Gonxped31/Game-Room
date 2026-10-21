# Word Scramble: Visual Spec

Two teams take turns unscrambling a word against the clock. Hints place letters but lower the points.

This spec matches the "Word Scramble" boards on the design canvas (phone: 390×844, desktop: 1280 wide). The name "Word Scramble" is a working title.

## Look

Wooden letter tiles on a warm cream table. Two strong team colors, orange and indigo, that differ in lightness as well as hue so they're easy to tell apart. Chunky, friendly type.

## Tokens

```css
--table: #FFF3DF;        /* page background */
--board: #FBE9C8;        /* desktop play area */
--panel: #F6E2B8;        /* settings, info pills */
--line: #E9D3AE;         /* panel borders, empty progress */
--slot: #C9A26B;         /* dashed empty slots */
--ink: #2A1B12;          /* text, borders, hard shadows */
--muted: #6E5847;        /* captions (about 6.5:1 on --table) */

--tile: #F2CF8D;         /* wooden tile face */
--tile-edge: #B98535;    /* tile bottom edge (box-shadow) */

--team-a: #FF7A1A;       /* orange, ink text */
--team-a-edge: #A8480A;
--team-a-soft: #FFE2C9;  /* Team A avatars */
--team-b: #3446D8;       /* indigo, white text */
--team-b-soft: #DCE1FF;  /* Team B avatars */
--team-b-wash: #EEF0FF;

--right: #2FA866;        /* found word tiles */
--right-edge: #1C7346;
--right-tint: #DDF3E6;   /* winning guess row */
--right-ink: #145A36;
--wrong: #B3261E;        /* "not it", hint cost */
--warn: #FFE7B3;         /* "teams must be even" fill */
--warn-edge: #B27300;
--warn-ink: #5C3A00;
--disabled: #E8D6B8;     /* disabled Start */
--disabled-ink: #7A6450;
```

## Type

| Role | Font | Size (phone / desktop) |
| :--- | :--- | :--- |
| Titles, banners | Lilita One | 22–34 / 28–56 px |
| Tile letters | Lilita One | 34 px on 56 px tiles / 46 px on 76 px tiles |
| Big scores | Lilita One | 64–72 / 96–110 px |
| Guess field | Lilita One, 0.12–0.14em tracking | 24 / 30 px |
| Body, names, buttons | Nunito 700/800 | 14–17 px |
| Section labels | Nunito 800, uppercase, 0.08em tracking, `--muted` | 13–14 px |

Load `Lilita One` and `Nunito` (600, 700, 800) from Google Fonts.

## Components

### Letter tile
- Square, 10–14 px radius. Phone 56 px, desktop 76 px (celebration 60 / 84 px).
- Wood: `--tile` face, hard shadow `0 6px 0 --tile-edge` (desktop 8 px), `--ink` letter.
- Scrambled row: each tile rotated slightly (−5° to +5°) so it reads as loose tiles. A letter already placed by a hint stays in the row at 35% opacity.
- **Hint-placed letter:** in its answer slot, `--team-a` (or `--team-b`) face with its darker edge, plus a small lightbulb mark in the corner (phone).
- **Found word:** `--right` face, `0 6px 0 --right-edge`, tiles nudged up and down a few px for a bounce.
- **Revealed (time's up):** white face, 3 px `--ink` border, no shadow. Hinted letters keep the team color.

### Answer slots
Same size as the tiles, 3 px dashed `--slot` border, one per letter. They fill left to right as hints come in.

### Team colors
- Team A: `--team-a` with `--ink` text. Team B: `--team-b` with white text.
- Score pills in the header: "A 12" and "9 B", 34 px tall (desktop 38), Lilita One 18–20 px. The team that just scored gets a 4 px glow ring at 30%.
- Team cards (lobby, scoreboard, end): 3 px `--ink` border, 18–26 px radius, hard shadow `0 6px 0 --ink` (desktop 8 px). The losing team's card on the end screen is white with indigo text.

### Turn banner
- **Your team's turn:** `--team-a` fill (or `--team-b`), "Your team's turn" in Lilita One, team members on the right.
- **Watching:** white fill with a 3 px border in the playing team's color, eye icon, "Team A is playing", and "You're next" (desktop: "You're Team B · you play next").

### Guess field
- 56 px (desktop 64 px), 14–16 px radius, 3 px `--ink` border, white fill, uppercase Lilita One with wide tracking. Has a real `<label>` (visually hidden). `autocomplete="off"`, `spellcheck="false"`.
- Send: phone 56 px square `--team-a` button with an arrow icon (`aria-label="Send guess"`); desktop "Guess" button with text. Enter submits.
- **Watching:** the field is replaced by a dashed `--slot` box with a lock icon: "You can guess on Team B's turn".

### Worth and hint
- "Worth 4 points" (Lilita One 24–26 px), with a caption below: "5 letters · 1 hint used".
- Hint button: white, 2 px `--ink` border, `0 4px 0 --ink`, lightbulb icon, "Hint" plus the cost "−1" in `--wrong`. Disabled when a hint would leave fewer than 2 letters to find (keep at least one point on the table).

### Guess feed
- White panel, 2 px `--line` border, 16–22 px radius, heading "Team guesses" (watching: "Team A's guesses").
- Each row: avatar or name, the guess in Lilita One with a 2 px `--wrong` line-through, and "not it" in `--wrong`.
- Live typing row: "Noah is typing…" in italic `--muted`.
- The winning guess: `--right-tint` row, `--right-ink` text, check icon.
- Desktop footer: "Wrong guesses cost nothing. Keep trying until the timer runs out."
- `aria-live="polite"` on the list.

### Timer
46 px ring (desktop 60 px), white fill, 5–6 px `--line` track, arc in the playing team's color, seconds in Lilita One. At 0 the number turns `--wrong`.

### Turn progress
A row of 10 bars (one per turn), 22×8 px (desktop 34×10), filled in the color of the team that played it, `--line` when not yet played.

## Screens

### Phone (390×844)
1. **Team lobby:** title "Pick a team" plus room code. Invite link field and "Copy link". Two team columns side by side (header in team color with the count, players with avatars, dashed "Open spot", a "Switch to B" button for the viewer's other team). Warning bar ("Teams must be even: 3 vs 2…", `role="status"`). Host settings panel: language EN/FR, length "Turns / Target score", stepper "Turns per team − 5 +". Start disabled until even, with the caption "Even the teams to start".
2. **Your team's turn:** header (scores, "Turn 3 of 10", timer), banner, scrambled tiles, answer slots, worth + Hint, guess field + send, team guesses feed. The guess field sits at about y 420, so the tiles and timer stay visible above the phone keyboard.
3. **Watching:** the same layout, read-only, with the watching banner and the locked box instead of the field.
4. **Correct:** a few scattered confetti tiles (decorative), "Got it!" plus "Found by Léa in 14 s", the word in green tiles, a "+4 Team A · 5 letters − 1 hint" card, and a "Team B plays next" pill.
5. **Time's up:** "Time's up" plus "The word was", the revealed word, "No points for Team A", and a "Team B plays next" pill in Team B's color.
6. **Scoreboard between turns:** "Turn 3 of 10" with the progress bars, the two team cards with big scores and members, a "So far" list (team color, word, points), "Team B is up next" with a 3-second ring.
7. **End of game:** crown, "A WINS" spelled in tiles (the team letter in its color), "Team A wins!", "10 turns · English", both team cards with words found and members, "Rematch" (primary), "Shuffle teams", and "Back to Game Room".

### Desktop (fluid)
- **Lobby (max width 1100 px):** title row with the invite link on the right, team cards side by side (players in a 2-column grid), the warning bar, then one host settings bar with Start at the right end.
- **Turn and watching:** header row, full-width banner, then the board (`--board` panel with 76 px tiles, the field and the worth/hint row under it, max width 560 px) and a 260–340 px guess column on the right.
- **Correct:** the celebration in the board area, with the winning guess highlighted in the guess column.
- **Scoreboard (max width 960 px):** the two team cards with "vs" between them, the "So far" list, and a Team B panel with the countdown.
- **End (max width 900 px):** the same content as the phone, centered, with the buttons in a row.
- Under 900 px wide the guess column drops below the board.

## Behavior and motion
- Every phone gets the new word, the timer start and the reveal at the same server time.
- Guesses: compare uppercase without accents (so "TIGRE" and "TIGRÉ" are checked the same way in French).
- Correct: tiles fly from the scrambled row into the slots (staggered 40 ms each, 250 ms), turn green, then the points card pops. The other team sees the same thing.
- Wrong guess: a short shake of the field (no penalty), then it's added to the feed.
- Hint: the letter tile lifts out of the scrambled row and drops into its slot (200 ms), the "Worth" number ticks down.
- Time's up: the remaining letters drop into the slots in place, white with an ink border.
- `prefers-reduced-motion`: no flying, shaking or bouncing; states change instantly.

## Scoring shown to players
- A word is worth its number of letters. Each hint takes off 1.
- Wrong guesses cost nothing. Time running out scores nothing.
- The current value is always on screen ("Worth 4 points").

## Accessibility
- Team colors also differ in lightness (orange vs indigo) and always come with "Team A" / "Team B" text.
- Scrambled and answer rows carry an `aria-label` with the letters ("Scrambled letters R E G T I", "Answer: T and 4 blanks"), since tiles are decorative spans.
- Banners and result headings use `role="status"`. Timers use `role="timer"`.
- Segmented controls: `role="radiogroup"` + `role="radio"`. Stepper buttons have `aria-label`s ("Fewer turns", "More turns").
- Contrast: ink on cream about 15:1, muted about 6.5:1, ink on orange about 7:1, white on indigo about 6.5:1, ink on green about 5.5:1.
- Touch targets at least 44 px.

## Copy

| Where | Text |
| :--- | :--- |
| Lobby title | Pick a team |
| Empty spot | Open spot |
| Switch | Switch to {team} |
| Uneven warning | Teams must be even: {a} vs {b}. One more player for Team {x}, or someone switches. |
| Start caption | Even the teams to start |
| Your turn | Your team's turn |
| Watching | Team {x} is playing · You're next |
| Worth | Worth {n} points · {len} letters · {h} hint(s) used |
| Hint button | Hint −1 |
| Field placeholder | Type the word |
| Locked field | You can guess on Team {x}'s turn |
| Feed heading | Team guesses / Team {x}'s guesses |
| Wrong guess | not it |
| Correct | Got it! · Found by {name} in {s} s · +{n} Team {x} |
| Time's up | Time's up · The word was · No points for Team {x} |
| Next | Team {x} plays next / Team {x} is up next |
| Progress | Turn {n} of {total} |
| End title | Team {x} wins! |
| End buttons | Rematch · Shuffle teams · Back to Game Room |

## In the Game Room

- **Hub card:** art panel `#F6E2B8` with five wood tiles "R E G T I" (50 px, alternately tilted) over five 44 px answer slots, the first holding an orange "T". Title "Word Scramble" in Lilita One 32 px. Description (Nunito 600, 16 px, `#5A4636`): "Two teams take turns unscrambling a word against the clock. Hints help, but cost points." Chips: "2–8 players", "2 teams". Buttons: Start (`--team-a` fill, `--ink` text and 2 px border, `0 4px 0 --ink`) and Join (white).
- **40 px tile ("Your rooms"):** 10 px radius, `#F6E2B8` fill, a 26 px wood tile with a "W".
- **Continue chip:** the hub's chip with a 10 px `--team-a` square: "Continue ■ p8rdq2 · Word Scramble →".
