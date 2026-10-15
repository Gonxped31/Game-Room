# Game Room UI Spec

The Game Room is the app's home screen. Players pick a game, get a private room, and send the link to their partner. Players who already have a room can jump back in with its code or its name.

It matches the boards "Game Room, desktop", "Game Room, mobile" and "Join a room, states" on the design canvas. It is shared by every game, so a new game only adds one card.

## Layout

| Viewport | Layout |
| :--- | :--- |
| 760 px and wider | Header at the top left. Cards dealt side by side, centered, 340 px wide each, 56 px gap. Join panel (520 px) centered under the cards, then the footer line. Page padding 40 px top, 56 px sides, 32 px bottom. |
| Under 760 px | Single column. Cards stack at full width (max 440 px, centered), 20 px gap. Page padding 24 px top and bottom, 16 px sides. No rotation. |
| More than 2 games | On desktop wrap into a centered row of cards (flex-wrap, same gap). Keep each card at 340 px. |

The page background is flat teal `#0F7983`. It is slightly deeper than the First to Worst table (`#128A94`) so white text passes 4.5:1. The page scrolls vertically if the content is taller than the viewport. Never clip the join panel or the footer line.

## Tokens

```css
--hub-table: #0F7983;
--felt: #128A94;          /* First to Worst art panel, matches its table */
--white: #FFFFFF;
--pink: #FF3D8F;          /* First to Worst button */
--ftw-ink: #000000;       /* First to Worst text and borders */
--cc-ink: #1C1F3D;        /* Co-Counsel text and borders */
--cc-blue: #2447D8;
--cc-red: #C8372D;
--yellow: #FFD23A;        /* Co-Counsel button, error outline */
--cc-text-2: #4A4F73;
--panel-shadow: 0 4px 0 rgba(0, 0, 0, 0.22);   /* join panel */
--error: #B3261E;
--font-hub: 'Fredoka', system-ui, sans-serif;   /* 500, 600, 700 */
--font-cc: 'Archivo', system-ui, sans-serif;     /* 500, 600, 800 */
```

Number-card gradients for the First to Worst art (top to bottom):

| Card | From | To |
| :--- | :--- | :--- |
| 1 | `#2DE0F5` | `#1B5BD6` |
| 2 | `#9BE564` | `#14934A` |
| 3 | `#FFF06A` | `#FFB800` |
| 4 | `#FFC25C` | `#FF6A13` |
| 5 | `#FF9CC4` | `#E6287E` |

## Components

### Header
- **Label:** a white box with a 9 px radius, `padding: 10px 16px` (mobile 8px 14px), the text "Game Room" in Fredoka 700 at 30 px (mobile 26), black, rotated -2 degrees, with `box-shadow: 0 3px 8px rgba(0,0,0,.3)`. Use an `<h1>`.
- **Subtitle:** "Pick a game. You'll get a private room to share with your partner." Fredoka 500, 19 px (mobile 16), line height 1.35, white, max width 520 px.

### Game card
A white card, 20 px radius (mobile 18), `padding: 12px 12px 22px` (mobile 10px 10px 16px), shadow `0 6px 0 rgba(0,0,0,.28), 0 16px 30px rgba(0,0,0,.25)`.
- **Tilt (desktop only):** first card -1.5 degrees, second +1.5 degrees, alternating if there are more.
- **Art panel:** 200 px tall (mobile 104), 12 px radius (mobile 10), overflow hidden. Contents are in the next sections.
- **Text block:** 20 px above (mobile 14), 10 px side padding (mobile 6), 12 px gap (mobile 10).
  1. **Title:** the game's typeface, 700 to 800 weight, 32 px (mobile 26), line height 1.1.
  2. **Description:** 16 px (mobile 15), weight 500, line height 1.4.
  3. **Chips:** outlined pills, 2 px border in the card's ink color, 99 px radius, `padding: 3px 12px`, 13 px, weight 600, 8 px gap, wrap allowed.
  4. **Button:** "Start a room", 56 px tall (mobile 52), full width, 2 px border in the card's ink color, 14 px radius, hard shadow `0 4px 0` in the same ink color, 6 px extra top margin.

| | First to Worst | Co-Counsel |
| :--- | :--- | :--- |
| Title font | Fredoka 700 | Archivo 800, tracking -0.02em |
| Ink color | `#000` | `#1C1F3D` |
| Description color | `#333` | `#4A4F73` |
| Description | "Rank topics from 1 (best) to 5 (worst), then guess how your partner ranked them." | "A cooperative mystery. Each of you knows half the story. Talk it out to find the matching pair." |
| Chips | "2 players", "Live or anytime" | "2 players", "Best on a call" |
| Button fill | `#FF3D8F`, black text, Fredoka 700 19 px | `#FFD23A`, ink text, Archivo 800 18 px |

### Art: First to Worst
Panel background `#128A94`. Five white number cards, each 80x112 px (mobile 48x68), 8 px radius (mobile 6), 1 px border `#D6D6D6`, shadow `0 2px 0 rgba(0,0,0,.25), 0 4px 10px rgba(0,0,0,.25)`. Numerals are Fredoka 700, 56 px (mobile 34), filled with the gradients above through `background-clip: text`.

Fan them from the panel center. Horizontal offsets from the center card: -92, -46, 0, 46, 92 px (mobile -56, -28, 0, 28, 56). Rotations -16, -8, 0, 8, 16 degrees around the bottom center. Bottom offsets 26, 34, 38, 34, 26 px (mobile 10, 15, 17, 15, 10).

### Art: Co-Counsel
Left half `#2447D8`, right half `#C8372D`. Two matching mini claim cards, 80x112 px (mobile 48x68), white, 2 px `#1C1F3D` border, 8 px radius, each with a colored strip at the top (18 px, mobile 12), a yellow numbered tent, and two short text bars. The left card is rotated -7 degrees and the right +7. They sit 32 px apart (mobile 32 px) around the center, 26 px from the top (mobile 12). The yellow lens mark (overlap of two circles with white outlines, 64x40, mobile 48x30) sits at the bottom center, 14 px from the bottom (mobile 6).

### Footer lines
One centered line under the join panel, white, Fredoka 500, 15 px (mobile 14): "No accounts. Send your partner the link and you're both in."

## Join a room form

**Goal:** keep the familiar white panel, but with a single input. A small switch chooses whether the player types the room code or the room name. The panel is always visible between the cards and the footer line.

**Panel:** white, 18 px radius, `padding: 18px` (mobile 16px), shadow `0 4px 0 rgba(0,0,0,.22)`, 10 px gap between rows. Desktop width 520 px, centered, 24 px above and 20 px below; mobile full width.

**Rows, top to bottom:**
1. **Heading row:** `<h2>` "Already have a room?" (Fredoka 700, 17 px) on the left, the switch on the right.
2. **Helper text:** 14 px, weight 500, `#444`. "Enter its code to jump back in." or "Enter its name to jump back in." depending on the switch.
3. **Input:** one field, 48 px tall, 12 px radius, 2 px `#7C8A8C` border, 16 px Fredoka 600 (prevents iOS zoom), black text. Placeholder and `aria-label` follow the switch: "Room code" or "Room name". `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`.
4. **Join button:** full width, 48 px tall, 12 px radius, fill `#0F7983`, white Fredoka 700 17 px, hard shadow `0 4px 0 #0A565D`.

**Switch ("Code | Name"):** a two-option segmented control, `role="radiogroup"` with `aria-label="Join with"` and two `role="radio"` buttons. Track `#E9EEEF`, 10 px radius, 3 px padding. Each segment is 34 px tall (mobile 36), `padding: 0 16px`, 14 px weight 600. Selected: `#0F7983` fill, white text. Unselected: transparent, `#3A4547` text. Default is Code. Left and right arrow keys move the selection. Switching keeps focus in the switch, swaps the placeholder, helper text and label, and clears any error. It keeps what was typed only if the player switches back to the same mode; otherwise the input is emptied.

| State | Behavior |
| :--- | :--- |
| Default | Code selected, input empty. Join is disabled (fill `#8FA9AC`, no shadow) until the input has a value. |
| Name mode | Name selected. Helper "Enter its name to jump back in.", placeholder "Room name". |
| Joining | Switch, input and button are disabled. Input fill `#F1F4F4`, border `#C9D1D2`. Button reads "Joining…", fill `#8FA9AC`, `cursor: progress`. The form has `aria-busy="true"`. |
| Not found | Input border becomes `#B3261E` (red, 2 px) with `aria-invalid="true"`. A line with a red warning icon appears between the input and the button, `role="alert"`, linked through `aria-describedby`, text `#B3261E`, 14 px weight 600. Editing the input or switching mode clears it. |
| Success | Navigate straight into the room. No confirmation screen. |

## Behavior

- **Start a room:** creates a new room for that game and goes to its room screen, where the player can copy the link to send to their partner. That "room created" screen is not designed yet. While the room is being created, the card's button reads "Starting…", is disabled, and the other card's button is disabled too, to prevent double rooms.
- **Join:** look the value up first as a room code, then as a room name. Trim whitespace and ignore case. If the lookup fails, show the not-found error. The code or name is the only credential, so don't reveal anything about a room that isn't found.
- **Returning players:** recently used rooms could be remembered on the device and shown as a small "Your rooms" strip (later feature).

## Motion
- Cards: on hover or keyboard focus within the card, straighten to 0 degrees and lift 6 px over 150 ms ease-out. On press, the button moves down 4 px and loses its shadow (60 ms).
- Join panel: no animation. The switch changes instantly.
- `prefers-reduced-motion`: no tilt change, no lift, no fade.

## Accessibility
- Page has one `<h1>` ("Game Room"). Each card title is an `<h2>`.
- Each "Start a room" button needs a distinct accessible name: `aria-label="Start a First to Worst room"` and `aria-label="Start a Co-Counsel room"`.
- The art panels are decorative: `aria-hidden="true"` on the art and on all SVGs.
- The join input's accessible name follows the switch (`aria-label="Room code"` or `"Room name"`); the switch is a radiogroup. The error is announced through `role="alert"` and linked with `aria-describedby`.
- Visible focus: a 3 px white outline with a 2 px offset on the teal background, and a 3 px `#0F7983` outline on the white join panel.
- Contrast: white on `#0F7983` is about 5.1:1. Black on `#FF3D8F` is about 4.8:1. Ink on `#FFD23A` is about 11:1.
- Tap targets at least 44 px tall.

## Copy

| Where | Text |
| :--- | :--- |
| Title | Game Room |
| Subtitle | Pick a game. You'll get a private room to share with your partner. |
| Card button | Start a room |
| Card button, busy | Starting… |
| Footer | No accounts. Send your partner the link and you're both in. |
| Join heading | Already have a room? |
| Switch | Code / Name |
| Join helper | Enter its code to jump back in. / Enter its name to jump back in. |
| Input placeholder | Room code / Room name |
| Join button | Join |
| Join button, busy | Joining… |
| Error | We can't find that room. Check the code and try again. ("name" in Name mode) |

## Adding a game
1. Add a card with the game's title in its own typeface, a one-sentence description, two chips, and a "Start a room" button in the game's accent color (ink text, 2 px ink border, hard shadow).
2. Draw a 200 px art panel from that game's own visuals (its cards, table or mark).
3. Give the button its own `aria-label`.
4. Check that the accent color keeps 4.5:1 contrast with the button's text.
