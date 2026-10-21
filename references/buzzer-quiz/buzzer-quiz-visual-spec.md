# Buzzer Quiz: Visual Spec

2 to 4 players race to buzz in on multiple-choice questions. Every wrong answer is struck out for everyone, so the question gets easier but is worth fewer points.

This spec matches the "Buzzer Quiz" boards on the design canvas (phone: 390×844, desktop: 1280 wide). The name "Buzzer Quiz" is a working title.

## Look

A dark game-show stage. One loud object, the red buzzer, and one color per player. Everything else stays quiet so the buzzer and the choices read instantly.

## Tokens

```css
--stage: #16113A;        /* page background */
--surface: #251E5C;      /* cards, panels, chips */
--surface-2: #31297A;    /* selected tiles, timer track, raised chips */
--surface-dim: #1E1849;  /* locked player row */
--line-dashed: #4A4380;  /* empty slots, struck choices */
--text: #FFF8EC;         /* main text on stage, choice tiles */
--text-muted: #B8B0E6;   /* labels, captions (about 8:1 on stage) */
--text-struck: #8A83B8;  /* struck choice text */
--ink: #16113A;          /* text on light fills */

--buzz: #FF4B3E;         /* buzzer face, primary buttons */
--buzz-ring: #9E1B14;    /* buzzer ring, button hard shadow */
--buzz-base: #5C0F0B;    /* buzzer drop shadow */
--disabled: #3A3470;     /* disabled buzzer face */
--disabled-ring: #2A245E;

--right: #22C873;        /* correct answer */
--right-ink: #0B2A1A;    /* text and icons on --right */
--right-tint: #1A3D3A;   /* answer revealed, nobody scored */
--points: #FFC23D;       /* "Worth 3 points", topic selection, timer arc */

/* player colors, in join order */
--p1: #FFC23D;  /* amber */
--p2: #46E0A0;  /* mint */
--p3: #59A8FF;  /* sky */
--p4: #FF7AC0;  /* pink */
```

Player colors only ever appear with the player's name or initial next to them, so color is never the only way to tell players apart. Text on a player color is always `--ink`.

## Type

| Role | Font | Size (phone / desktop) |
| :--- | :--- | :--- |
| Screen title | Bricolage Grotesque 800 | 28 / 40 px |
| Question | Bricolage Grotesque 700, line height 1.2 | 24 / 36 px |
| Buzzer label | Bricolage Grotesque 800 | 42 px (38 when smaller) |
| Scores, numbers, letters A–D | Bricolage Grotesque 800 | 16–26 px |
| Choice text | Atkinson Hyperlegible 700 | 18 / 22 px |
| Body, captions | Atkinson Hyperlegible 400/700 | 14–17 px |
| Section labels | Atkinson Hyperlegible 700, uppercase, 0.06–0.08em tracking, `--text-muted` | 13–15 px |

Load: `Bricolage Grotesque` (opsz 12–96, weights 700, 800) and `Atkinson Hyperlegible` (400, 700) from Google Fonts.

## Components

### Buzzer
- Circle, 176 px (150–160 px in tighter states). Face `--buzz`, 10 px ring `--buzz-ring`, shadow `0 10px 0 --buzz-base` plus a soft halo `0 0 0 10px rgba(255,75,62,.16)`. Label "BUZZ" in white.
- Pressed: moves down 6 px and loses most of its drop shadow (80 ms).
- **Disabled (someone else is answering):** face `--disabled`, ring `--disabled-ring`, label "WAIT" in `--text-muted`, caption "Léa is answering".
- **Locked (you answered wrong):** same grey, lock icon above the label "LOCKED", caption "The others can still buzz".
- Desktop: the buzzer sits under the choices with a key hint: "Press Space or click to buzz" and "Then pick with A–D". Keys are drawn as `<kbd>` with a 2 px `--text-muted` border.
- Reserve space beside the buzzer for the v2 power cards. Don't draw them yet.

### Choice tile
- Phone: full width, 56 px tall (52 px when a banner is showing), 16 px radius. Desktop: 2×2 grid, 76–80 px tall, 18 px radius, 14 px gap.
- Default: `--text` fill, `--ink` text. A 34 px (desktop 42) round letter badge, `--ink` fill with a cream letter A–D.
- **Pickable (your turn):** 3 px `--ink` border and a hard shadow `0 5px 0` in your player color. It's a real `<button>`.
- **Struck:** transparent fill, 2 px dashed `--line-dashed` border, text `--text-struck` with a 3 px `--buzz` line-through, red badge with a white ✕. Optional right-aligned name of whoever picked it ("Max", "your pick"). `aria-label="Vistula, struck out"`.
- **Right:** `--right` fill, 3 px `--right-ink` border, check icon on the right. The other choices dim to `--surface` fill with `--text-struck` text.
- **Answer revealed (nobody scored):** `--right-tint` fill, 3 px `--right` border, small "Answer" label.

### Score strip (phone) / score column (desktop)
- Phone: 4 equal chips in a row, 6 px gap. Each: 26 px avatar (player color, initial), name 12 px muted, score 16 px.
- Desktop: a 240–300 px panel on the left with one 60 px row per player (36 px avatar, name, 24 px score), sorted by score.
- **You:** inset 2 px `--text` outline, name reads "You" (desktop "Samir (you)").
- **Buzzed / answering:** chip filled with the player's color, plus a 4 px glow ring at 30% of that color.
- **Locked:** `--surface-dim`, 70% opacity, lock icon in place of the avatar.
- **Points pop:** a cream pill "+3" with a 2 px `--ink` border pops above the chip of whoever scored.

### Question card
`--surface`, 20 px radius (desktop 24), padding 16–18 px (desktop 24–28). The top line shows the question's current value in `--points`: "Worth 3 points", then "Now worth 2 points" after a strike, "No points this time" at the end.

### Status banner
A 48–52 px bar between the question and the choices, 14 px radius. It always says what just happened, in words, and uses `role="status"`.

| Moment | Fill | Text |
| :--- | :--- | :--- |
| Someone buzzed | that player's color | ⚡ "Léa buzzed!" · "Choosing… 4 s" |
| Your turn | your color | "Your turn! Pick an answer" · "3 s" + 5 s progress bar |
| Right | `--right` | ✓ "Léa got it!" · "+3" |
| Wrong (others see) | `--text` | red ✕ "Max was wrong. Buzz again!" |
| Wrong (you) | `--disabled` | 🔒 "Wrong. You're out for this one." |
| Nobody scored | `--text` | "Nobody scored" + "Only one choice was left. The answer was Danube." (or "Time's up. The answer was Danube.") |

(The ⚡ ✓ ✕ 🔒 above stand for inline stroke SVG icons, never emoji.)

### Timer
- Question timer: a 44 px ring (desktop 56 px), 5 px `--surface-2` track, `--points` arc, seconds in the middle. It pauses and drops to 45% opacity while someone is answering.
- Answer timer (5 s): a progress bar inside the "your turn" banner.
- Countdown: a 230 px ring with a `--buzz` arc and a 130 px number.

## Screens

### Phone (390×844)
1. **Master setup:** back button and "New quiz". Language: 2-option segmented control (English / Français). Topics: 2-column grid of 62 px tiles with icons; selected = 3 px `--points` border, `--surface-2` fill, check icon; caption "3 picked, mixed". Questions: segmented 5 / 10 / 15 / 20 (10 selected). Bottom: "Create room" (60 px, `--buzz` fill, `--ink` text, `0 5px 0 --buzz-ring`) and caption "Next you'll get a link to send to your friends."
2. **Waiting room:** title plus room code pill. "Invite friends" card with the link and a Copy button. Players: four 58 px rows, empty slots dashed "Waiting for a player…", the host marked with a crown and "Host". Quiz chips: language, length, topics (outlined in `--points`), plus an "Edit" link for the host. Host button: "Start with 3 players" (needs at least 2). Others see "Waiting for Samir to start" instead of the button.
3. **Countdown:** score strip at the top, "Question 3 of 10", the topic, the big 3-2-1 ring, caption "Thumb on the buzzer…".
4. **Question, 7 states:** waiting to buzz, someone buzzed, your turn, right, wrong (others), locked out (you), nobody scored. Layout from top: top bar (question number pill, topic, timer), score strip, question card, status banner if any, choices, then the buzzer area (or "Next question in 3" pill).
5. **Final ranking:** "Léa wins!" with a 132 px winner avatar and a crown. Ranked list: 1st in the winner's color (64 px), then 58 px rows. Buttons: "Rematch" (primary), "New topics" (2 px cream outline), "Back to Game Room" text link.

### Desktop (fluid, max content width 1040 px for setup, lobby and end)
- **Setup:** language and length on the left (300 px+), a 3×2 topic grid of 110 px tiles on the right, a "How scoring works" note under the left column. "Create room" bottom right.
- **Waiting room:** players as a 2×2 grid of 120 px cards (60 px avatars) on the left. Invite card, quiz chips and Start in a 320 px column on the right.
- **Question:** header (game name, question pill, topic, timer). Score column left, main column right: question card, banner, 2×2 choices, buzzer with key hints.
- **Final ranking:** podium (2nd 150 px, 1st 210 px, 3rd 110 px tall), 4th place row below, buttons centered.
- Under 900 px wide the columns wrap: the score column goes above the question.

## Behavior and motion
- Question and choices appear on every device at the same server time, after the 3-2-1.
- Buzz: the first buzz the server receives wins. Everyone sees the banner within the same frame they receive it. Lock out further buzzes immediately on the client to avoid double taps.
- Wrong: the struck choice fades to its struck style over 200 ms with the line-through drawing left to right. The "Worth" line updates at the same time.
- Right: the choice fills green (150 ms), the "+3" pill pops (scale 0.6 → 1.1 → 1, 300 ms) and the score counts up.
- Between questions: "Next question in 3" then the countdown again.
- `prefers-reduced-motion`: no scale pops or line drawing; state changes are instant.

## Scoring shown to players

| Choices left when answered right | Points |
| :--- | :--- |
| 4 | 3 |
| 3 | 2 |
| 2 | 1 |
| 1 (only the answer left) | 0, the question ends |

A wrong answer costs nothing except being locked out of that question.

## Accessibility
- Buzzer, choices, segmented controls and topic tiles are real `<button>`s. Topics use `aria-pressed`. Segmented controls are `role="radiogroup"` with `role="radio"` + `aria-checked`.
- Status banners use `role="status"` so screen readers announce "Léa buzzed!", "Wrong. You're out for this one.", and so on.
- Timers use `role="timer"` with an `aria-label` in seconds. The 5 s answer bar is a `role="progressbar"`.
- Struck choices carry `aria-label="<choice>, struck out"`. Decorative avatars and icons are `aria-hidden`.
- Keyboard (desktop): Space buzzes, A–D (or 1–4) picks. Show the hints on screen.
- Contrast: cream on stage about 16:1, muted text about 8:1, ink on every player color and on the buzzer above 4.5:1. White "BUZZ" on red is about 3.3:1, fine at 38 px+ bold, so never use the red with small white text.
- Touch targets at least 44 px.

## Copy

| Where | Text |
| :--- | :--- |
| Setup title | New quiz |
| Setup button | Create room |
| Setup caption | Next you'll get a link to send to your friends. |
| Lobby title | Waiting room |
| Empty slot | Waiting for a player… |
| Host start | Start with {n} players |
| Others in lobby | Waiting for {host} to start |
| Countdown caption | Thumb on the buzzer… |
| Question value | Worth {n} points / Now worth {n} points / No points this time |
| Buzz caption | Tap as soon as you know it |
| Someone buzzed | {name} buzzed! · Choosing… {s} s |
| Your turn | Your turn! Pick an answer |
| Right | {name} got it! · +{n} |
| Wrong (others) | {name} was wrong. Buzz again! |
| Wrong (you) | Wrong. You're out for this one. |
| Locked caption | The others can still buzz |
| Nobody scored | Nobody scored. Only one choice was left. The answer was {answer}. / Time's up. The answer was {answer}. |
| Between questions | Next question in {s} |
| End title | {name} wins! |
| End buttons | Rematch · New topics · Back to Game Room |

French strings need the same lengths checked. "Buzz" stays "BUZZ" in both languages.

## In the Game Room

- **Hub card:** art panel `--stage` with a `--surface` spotlight circle, the 128 px buzzer (bottom center) and four 38 px letter badges A–D in the player colors, slightly tilted. Title "Buzzer Quiz" in Bricolage Grotesque 800, 32 px, `--ink`. Description (16 px, `#4A4570`): "Race to buzz in. Every wrong answer gets struck out, so the question gets easier but worth less." Chips: "2–4 players", "EN or FR". Buttons: Start (`--buzz` fill, `--ink` text and 2 px border, `0 4px 0 --ink`) and Join (white, same border).
- **40 px tile ("Your rooms"):** 10 px radius, `--stage` fill, a 26 px buzzer dot (`--buzz` face, 4 px `--buzz-ring` ring).
- **Continue chip:** the hub's chip with a 10 px `--buzz` square: "Continue ■ Quiz night · Buzzer Quiz →".
