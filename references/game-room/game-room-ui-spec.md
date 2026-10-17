# Game Room UI Spec

The Game Room is the app's home screen. Players pick a game, get a private room, and send the link to their partner. Players who already have a room can jump back in with its code or its name.

It matches the boards "Game Room, desktop", "Desktop, Join open (First to Worst)", "Game Room, mobile", "Mobile, join sheet", "Mobile, your rooms sheet" and "Join a room, states" on the design canvas. It is shared by every game, so a new game only adds one card.

## Layout

| Viewport | Layout |
| :--- | :--- |
| 760 px and wider | Header row: title, subtitle and Continue chip on the left, the Your rooms button on the right. Cards dealt side by side, centered, 340 px wide each, 56 px gap. Footer line under the cards. Nothing else on the page, so it fits without scrolling at 820 px tall. Page padding 40 px top, 56 px sides, 32 px bottom. |
| Under 760 px | Single column. Cards stack at full width (max 440 px, centered), 20 px gap. Page padding 24 px top, 16 px sides, and 100 px bottom so the floating Your rooms button never covers the last card's buttons. No rotation. |
| More than 2 games | On desktop wrap into a centered row of cards (flex-wrap, same gap). Keep each card at 340 px. |

The page background is flat teal `#0F7983`. It is slightly deeper than the First to Worst table (`#128A94`) so white text passes 4.5:1. The page scrolls vertically if the content is taller than the viewport. Never clip the footer line.

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
  4. **Buttons:** Start and Join side by side (see "Card buttons" below), 56 px tall (mobile 52), 2 px border in the card's ink color, 14 px radius, hard shadow `0 4px 0` in the same ink color, 6 px extra top margin.

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

## Hub actions: Start, Join and Your rooms

There is no general "Join a room" button any more. Each game card has its own **Start** and **Join** buttons, and "Your rooms" is the only extra control on the page.

### Card buttons
The card's single "Start a room" button becomes a row of two equal buttons, 10 px gap, same height as before (56 px desktop, 52 px mobile):
- **Start:** the game's accent fill (pink `#FF3D8F` or yellow `#FFD23A`), ink text, 2 px ink border, 14 px radius, hard shadow `0 4px 0` ink. `aria-label="Start a First to Worst room"` (or Co-Counsel). Creates a room, as before.
- **Join:** same shape, white fill, ink text and border. `aria-label="Join a First to Worst room"` (or Co-Counsel), `aria-haspopup="dialog"`. Opens the join panel for that game.

### Your rooms
| Viewport | Where | Look |
| :--- | :--- | :--- |
| 760 px and wider | One button at the top right of the header. | 44 px tall, white, 2 px black border, 12 px radius, hard shadow `0 3px 0 #000`, Fredoka 700 16 px, list icon, count badge. |
| Under 760 px | A floating pill, fixed 16 px from the right and 28 px from the bottom (plus the safe-area inset). | 52 px tall, white, 2 px black border, 99 px radius, shadow `0 4px 0 #000, 0 10px 24px rgba(0,0,0,.3)`, list icon, "Your rooms", count badge. Cards scroll under it; the page has 100 px bottom padding so the last card's buttons can scroll clear of it. |

Hidden when the guest has no saved rooms. The count badge is a 22 px teal circle with a white number. Accessible name includes the count ("Your rooms, 3 saved").

### Continue chip
Under the subtitle, when the guest has at least one saved room: a pill that opens the most recently active room.
- 44 px tall, `rgba(0,0,0,.2)` fill, white text, 99 px radius, `padding: 0 12px 0 14px`.
- Content: "Continue" (700), a 10 px game-color square (pink for First to Worst, yellow for Co-Counsel) with a white outline, the room name or code, and an arrow. Desktop adds " · First to Worst" after the name. Long names end with an ellipsis.
- Hidden when there are no saved rooms.

### Desktop popover
Clicking a card's Join button or the Your rooms button opens a popover anchored to it: 420 px wide, white, 2 px black border, 18 px radius, 18 px padding, shadow `0 4px 0 #000, 0 18px 40px rgba(0,0,0,.35)`, with a 16 px caret pointing at the button. Join opens above its button (centered on it, caret pointing down) because the button is at the bottom of the card. Your rooms opens below its button, right edges aligned. No dimmed background. It closes on Escape, a click outside, or clicking the button again, and focus returns to the button. Only one popover is open at a time.

### Mobile sheet
Tapping a card's Join button or the Your rooms pill opens a bottom sheet: white, `24px 24px 0 0` radius, `padding: 8px 16px 34px`, over a `rgba(0,0,0,.45)` scrim. A 40×5 px grab handle centered at the top, then a row with the sheet title (`<h2>`, Fredoka 700 19 px, "Join a First to Worst room" or "Your rooms") and a 44 px round close button (`#E9EEEF`, X icon) on the right. On mobile the Code/Name switch sits on its own row under the title. Close with the X, a tap on the scrim, a swipe down, or the back gesture. Sheets are `role="dialog"` with `aria-modal="true"`, trap focus, and return focus to the button that opened them.

### Join content
The join panel below, inside the popover or sheet, titled for the card's game: "Join a First to Worst room" or "Join a Co-Counsel room". If the code or name belongs to a room of the other game, open that room anyway (routing follows `meta.gameSlug`); don't show an error. The input gets focus when it opens, so the keyboard comes up on mobile and the sheet rides above it.

### Your rooms content
- A list (`<ul>`, 8 px gap) of rows, newest activity first, rooms active in the last 30 days. Each row is one link to `/{gameSlug}#{code}`, at least 64 px tall, `padding: 10px 12px`, 2 px `#E1E6E7` border, 14 px radius:
  - a 40 px game tile (First to Worst: teal square with a mini "1" number card; Co-Counsel: blue/red split with the yellow lens),
  - line 1: room name, or the code if it has no name (Fredoka 700 16 px, ellipsis), plus a "Yours" pill (1.5 px teal border, teal 12 px text) if this guest created it,
  - line 2: game name · last activity ("12 min ago", "Yesterday", "3 days ago"), 13 px `#4F5B5D`,
  - a teal arrow on the right.
- Footer note: "Rooms active in the last 30 days, saved on this device." 13 px `#5B6668`.
- If the list scrolls, the sheet grows to at most 75% of the screen height and the list scrolls inside it.

## Join a room form

**Goal:** keep the familiar white panel, with a single input. A small switch chooses whether the player types the room code or the room name. It lives inside the popover (desktop) or sheet (mobile) opened by a card's Join button.

**Panel:** the popover or sheet is the panel; its content uses a 10 px gap between rows.

**Rows, top to bottom:**
1. **Heading row:** `<h2>` "Join a First to Worst room" (or Co-Counsel), Fredoka 700 17 px, on the left, the switch on the right. In the mobile sheet the title moves into the sheet header and the switch gets its own row.
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

- **Start:** creates a new room for that game and goes to its room screen, where the player can copy the link to send to their partner. That "room created" screen is not designed yet. While the room is being created, the card's Start button reads "Starting…", is disabled, and the other card's Start button is disabled too, to prevent double rooms.
- **Join:** look the value up first as a room code, then as a room name. Trim whitespace and ignore case. If the lookup fails, show the not-found error. The code or name is the only credential, so don't reveal anything about a room that isn't found.
- **Returning players:** rooms are saved under the guest's ID (`users/{uid}/rooms`) and appear in Your rooms and the Continue chip.

## Motion
- Cards: on hover or keyboard focus within the card, straighten to 0 degrees and lift 6 px over 150 ms ease-out. On press, the button moves down 4 px and loses its shadow (60 ms).
- Popover: fades in and moves 4 px down over 120 ms. Sheet: slides up over 200 ms ease-out, scrim fades in. The switch changes instantly.
- `prefers-reduced-motion`: no tilt change, no lift, no fade.

## Accessibility
- Page has one `<h1>` ("Game Room"). Each card title is an `<h2>`.
- Each Start and Join button needs a distinct accessible name: `aria-label="Start a First to Worst room"`, `"Join a First to Worst room"`, and the same for Co-Counsel.
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
| Card button, busy | Starting… |
| Footer | No accounts. Send your partner the link and you're both in. |
| Card buttons | Start · Join |
| Your rooms button | Your rooms |
| Join title | Join a First to Worst room / Join a Co-Counsel room |
| Continue chip | Continue · {room name or code} |
| Rooms list note | Rooms active in the last 30 days, saved on this device. |
| Rooms list tag | Yours |
| Switch | Code / Name |
| Join helper | Enter its code to jump back in. / Enter its name to jump back in. |
| Input placeholder | Room code / Room name |
| Join button | Join |
| Join button, busy | Joining… |
| Error | We can't find that room. Check the code and try again. ("name" in Name mode) |

## Adding a game
1. Add a card with the game's title in its own typeface, a one-sentence description, two chips, a Start button in the game's accent color and a white Join button (ink text, 2 px ink border, hard shadow on both).
2. Draw a 200 px art panel from that game's own visuals (its cards, table or mark).
3. Give both buttons their own `aria-label`.
4. Check that the accent color keeps 4.5:1 contrast with the button's text.
