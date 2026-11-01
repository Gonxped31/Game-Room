# Game Room UI Spec (v2: sections)

The Game Room is the app's home screen. Players pick a game, get a private room, and send the link. Games are now grouped by how they're played:

- **Social games:** 2 or more players, each on their own device.
  - **Play from anywhere:** the game shows everyone what's happening. Buzzer Quiz, Word Scramble, Night Highway.
  - **Talk it out:** players need a call or the same room. Same Page (was First to Worst), Co-Counsel.
- **Solo games:** Night Highway.

It matches the boards "Game Room v2, desktop (sections)" and "Game Room v2, mobile (full scroll)" on the design canvas. The join popover, mobile sheets, Your rooms list and join form are unchanged from v1 and are repeated at the end of this file so it stands alone.

## Layout

| Viewport | Layout |
| :--- | :--- |
| 760 px and wider | Header row (title, subtitle, Continue chip on the left, Your rooms button on the right). Then the Social folder, then the Solo folder, then the footer line. 48 px between blocks. Page padding 40 px top, 56 px sides, 36 px bottom. Cards are laid out by the folder's width (see "Card grid"). The page scrolls. |
| Under 760 px | Single column, page padding 22 px top, 16 px sides, 110 px bottom (room for the floating Your rooms pill). Header, jump buttons, Social folder, Solo folder, footer, 22 px apart. Cards are full width and compact (small art on the left). |

The page background stays flat teal `#0F7983`. Cards have no tilt in v2; the folders give the page its structure.

## Tokens

```css
--hub-table: #0F7983;      /* page background */
--social: #0B3C49;         /* Social folder (deep sea) */
--social-accent: #FFE94A;  /* Social tab icon tile, jump dot */
--talk: #FFE94A;           /* Talk it out panel */
--solo: #2B2466;           /* Solo folder (night) */
--solo-accent: #FF8FC7;    /* Solo tab icon tile, jump dot */
--on-folder: #FFFFFF;
--on-folder-2: rgba(255,255,255,.85);   /* descriptions inside folders */
--folder-rule: rgba(255,255,255,.22);
--folder-dots: rgba(255,255,255,.07);
--folder-shadow: 0 6px 0 rgba(0,0,0,.18);
--card-shadow: 0 5px 0 rgba(0,0,0,.25), 0 14px 26px rgba(0,0,0,.2);   /* mobile: 0 4px 0 rgba(0,0,0,.22) */
--font-hub: 'Fredoka', system-ui, sans-serif;   /* 500, 600, 700 */
```

## Components

### Header
- **Label:** `<h1>` "Game Room": white box, 9 px radius, `padding: 10px 16px`, Fredoka 700 30 px (mobile 26), black, rotated -2°, `box-shadow: 0 3px 8px rgba(0,0,0,.3)`.
- **Subtitle:** "Pick a game. You'll get a private room and a link to share." Fredoka 500, 19 px (mobile 17), white, max width 560 px.
- **Continue chip:** under the subtitle (see Continue chip below).
- **Your rooms:** desktop button at the top right; mobile floating pill.

### Jump buttons (mobile only)
A row of three anchor links under the header, 8 px gap, each 38 px tall, 99 px radius, `padding: 0 13px`, Fredoka 700 15 px:
- "Social": `--social` fill, white text, a 10 px `--social-accent` square before the label.
- "Talk it out": `--talk` fill, black text.
- "Solo": `--solo` fill, white text, a 10 px `--solo-accent` square.

They scroll to the matching heading (`scroll-margin-top: 70px` so the folder tab stays visible). Wrap them in `<nav aria-label="Game types">`.

### Folder (one per top section)
A colored panel with a tab on its top-left corner, like a file folder.

| | Desktop | Mobile |
| :--- | :--- | :--- |
| Tab height | 62 px (overlaps the panel by 2 px so they join) | 50 px |
| Tab radius | 22 px top corners | 18 px |
| Tab padding | `0 26px 0 12px`, 14 px gap | `0 16px 0 10px`, 10 px gap |
| Icon tile | 42 px, 12 px radius, accent fill, black icon 26 px, rotated -4° | 32 px, 10 px radius, icon 20 px |
| Title (`<h2>`) | Fredoka 700 28 px, white: "Social games" / "Solo games" | 22 px: "Social" / "Solo" |
| Count pill | 28 px tall, `rgba(255,255,255,.16)`, white 600 14 px: "5 games" | 24 px, 12 px |
| Panel radius | `0 30px 30px 30px` (square under the tab) | `0 22px 22px 22px` |
| Panel padding | `30px 32px 34px`, 26 px gap | `16px 12px 14px`, 14 px gap |
| Pattern | 1.4 px dots, `--folder-dots`, 20 px grid | 16 px grid |

The panel has `--folder-shadow`. Each folder is a `<section aria-labelledby>` pointing at the tab's `<h2>`. Leave a top margin equal to the tab height so the tab never overlaps the block above. The first line inside is the description, Fredoka 500 18 px (mobile 15), `rgba(255,255,255,.92)`:
- Social: "Two or more players, each on their own device."
- Solo: "Play on your own, anytime."

The game count follows the number of cards in that folder (Night Highway counts once in each).

### Sub-section heading ("Play from anywhere")
A 34 px circle (mobile 28) with a 2 px `rgba(255,255,255,.7)` border and a white globe icon, the `<h3>` "Play from anywhere" (Fredoka 700 22 px, mobile 18), then a 2 px `--folder-rule` line filling the rest of the row. Under it, indented 44 px (mobile 38): "The game shows everyone what's happening. No need to talk." (mobile: "No need to talk."), 16 px (mobile 14), `--on-folder-2`.

### Talk it out panel
A bright yellow block inside the Social folder, after the Play from anywhere cards, so the need for a call is the most visible thing on the page.
- Fill `--talk`, radius 26 px (mobile 18), padding `26px 26px 30px` (mobile `14px 10px 12px`), shadow `0 6px 0 rgba(0,0,0,.25)`, 8 px top margin (mobile 6).
- **Heading:** a 38 px black circle (mobile 30) with a yellow speech-bubble icon, then the `<h3>` "Talk it out", Fredoka 700 26 px (mobile 20), black.
- **Tag:** black pill, 30 px tall, white 600 13 px, phone icon: "Call or same room".
- **Desktop, folder under 1300 px wide:** two columns, 28 px gap. Left: heading, tag, then three numbered steps (24 px black circles with yellow numbers, 16 px text, 10 px gap): "Start a call, or sit side by side." · "Each of you opens the room on your own phone." · "Talk it through. The game won't tell you everything." Right: the two 300 px game cards (under the steps when they don't fit beside them).
- **Desktop, folder 1300 px and wider:** heading and tag on one line (20 px apart), the three steps in a row under them (each a third of the row, 32 px apart), then the two wide cards side by side, 28 px gap. It switches at the same folder width as the card grid, so it always matches the cards above.
- **Mobile:** heading, the line "You'll need to talk to win. Get on a call or sit together." (15 px, `#1A1A1A`), the tag, then the two compact cards stacked. No steps.

### Card grid (desktop)
The Play from anywhere cards and the Solo cards share one grid, laid out by the folder's width (a container query), so both folders always look alike:
- **Folder 1300 px and wider** (a viewport of about 1476 px): wide cards, two to a row, each half the row less the 28 px gap. The rows fill the folder at any width.
- **Narrower:** 300 px cards, 28 px apart, at most three to a row (956 px), then two, then one. Three is the cap so six games make two even rows, never five and one.
- Rows are centered, so a card alone on the last row sits in the middle. Cards in a row stretch to the tallest one's height.
- No placeholder for games to come: the Solo folder shows only its games.

### Slants
Buttons and chips are parallelograms: the box leans 10° (`skewX(-10deg)`) and its text leans back, so the text stays upright. The card art ends in a slanted edge leaning the same way (see the cards). The cards themselves stay upright. The press and lift move with `translate`, so they combine with the lean.

### Game card (desktop, 300 px)
White, 300 px wide, 20 px radius, `padding: 10px 10px 18px`, `--card-shadow`.
1. **Art panel:** 168 px tall, 12 px radius, `aria-hidden`. Its bottom edge rises 14 px from left to right.
2. **Text block:** `padding: 16px 8px 0`, 10 px gap, in the game's body font.
   - **Title (`<h4>`):** the game's title font, 28 px, line height 1.05.
   - **Description:** 15 px, weight 500, line height 1.4, description color, min height 3 lines (63 px) so the buttons line up.
   - **Chips:** outlined parallelograms, 2 px ink border, 6 px radius, `padding: 2px 11px`, 13 px weight 700, 6 px gap.
   - **Buttons:** pushed to the bottom (`margin-top: auto`). Start and Join side by side, 10 px gap, 50 px tall, 2 px ink border, 12 px radius, hard shadow `0 4px 0` ink, title font at 18 px. Start uses the accent fill, Join is white. Games strangers can play add Matchmaking, full width under them: ink fill, white text, globe icon, `0 4px 0` accent shadow. Solo cards have one full-width "Play solo" in the accent fill.

### Game card (desktop, wide)
The same content in a wider shape (the Solo card's), from a 1300 px folder: half the row, `padding: 10px`, 20 px radius, `--card-shadow`.
- **Art:** 290×190 on the left, 12 px radius, its right edge slanted (24 px across its height).
- **Text:** on the right, 20 px from the art, `padding: 8px 10px 8px 0`: title, description (no minimum height), chips, then the buttons.
- **Buttons:** Start, Join and Matchmaking share one row when the text column has room (about 410 px); otherwise Matchmaking goes under Start and Join. Solo cards: one full-width "Play solo".

### Game card (mobile, compact)
White, 18 px radius, `padding: 10px 10px 14px`, shadow `0 4px 0 rgba(0,0,0,.22)`, 12 px gap. The card stays upright; its chip and buttons lean like the desktop ones.
- **Top row:** a 92 px square mini art (12 px radius) and, 12 px to its right: title 22 px, short description 14 px (2 lines max), one chip (12 px, the player count).
- **Bottom row:** Start and Join, 48 px tall, 17 px text, then Matchmaking for games that have it. Solo card: one "Play solo" button.
- Cards stack with a 14 px gap (10 px inside the yellow panel).

### Games

| | Buzzer Quiz | Word Scramble | Night Highway | Same Page | Co-Counsel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Section | Play from anywhere | Play from anywhere | Play from anywhere + Solo | Talk it out | Talk it out |
| Title font | Bricolage Grotesque 800, -0.01em | Lilita One | Fredoka 700 (placeholder) | Bagel Fat One | Archivo 800, -0.02em |
| Body font | Atkinson Hyperlegible | Nunito | Fredoka | DM Sans | Archivo |
| Ink | `#16113A` | `#2A1B12` | `#14163A` | `#1D2240` | `#1C1F3D` |
| Description color | `#4A4570` | `#5A4636` | `#4B4E72` | `#565C85` | `#4A4F73` |
| Start fill | `#FF4B3E` | `#FF7A1A` | `#FFD34D` | `#FF8FC7` | `#FFD23A` |
| Chips | 2–4 players · EN or FR | 2–8 players · 2 teams | Solo or with friends | 2 players · Live or anytime | 2 players · Cooperative |
| Description | Race to buzz in. Wrong answers get struck out, so the question gets easier but worth less. | Two teams take turns unscrambling a word against the clock. Hints help, but cost points. | Drive through the night with friends. Who makes it furthest? *(placeholder)* | Rank five things from best to worst, then guess how your partner ranked them. | A cooperative mystery. Each of you knows half the story. Talk it out to find the matching pair. |
| Short (mobile) | Buzz first. Wrong answers get struck out. | Two teams race to unscramble words. | Drive through the night with friends. | Rank 5 things. Guess your partner's order. | Each of you knows half of a mystery. |
| Solo copy | | | Just you and the road. Beat your own best distance. | | |

Night Highway's art, copy, chips and color are placeholders until it has its own design.

### Art panels (168 px desktop, 92 px mini)
- **Buzzer Quiz:** `#16113A`, a 280 px `#251E5C` spotlight circle from the top, four 38 px letter badges A–D (`#FFC23D`, `#46E0A0`, `#59A8FF`, `#FF7AC0`, slightly tilted), a 108 px red buzzer (`#FF4B3E`, 8 px `#9E1B14` ring, `0 8px 0 #5C0F0B`) on a dark ellipse. Mini: the buzzer only, 54 px.
- **Word Scramble:** `#F6E2B8`, five 44 px wood tiles "R E G T I" (`#F2CF8D`, `0 4px 0 #B98535`, tilted) over five 38 px slots, the first an orange "T". Mini: "W O R" tiles over an orange "W" and two slots.
- **Night Highway:** sky gradient `#0B1030` → `#2B2466`, small stars, a `#FFF3C4` moon top right, a dark hill line, a `#2A2C55` road in perspective with yellow `#FFD34D` center dashes and lilac edge lines, two red taillights. Mini: no taillights.
- **Same Page:** `#B9A7FF`, two lined notebook sheets (112×136, tilted -7° and +6°, blue rules, red margin), each with a yellow "1" sticky note, and a 44 px navy circle with "=" between them. Mini: one sheet with the "1" note.
- **Co-Counsel:** blue `#2447D8` / red `#C8372D` halves, two claim cards tilted ±7°, yellow lens mark at the bottom. Mini: the lens only, 64 px wide.

### 40 px tiles (Your rooms list) and Continue colors

| Game | Tile | Continue square |
| :--- | :--- | :--- |
| Buzzer Quiz | `#16113A`, 26 px red buzzer dot | `#FF4B3E` |
| Word Scramble | `#F6E2B8`, 26 px wood "W" | `#FF7A1A` |
| Night Highway | the mini road scene | `#FFD34D` |
| Same Page | `#B9A7FF`, 26 px yellow "1" sticky note | `#B9A7FF` |
| Co-Counsel | blue/red split with the lens | `#FFD23A` |

### Footer
Centered, white, Fredoka 500 15 px (mobile 14): "No accounts. Send the link and everyone's in."

## Hub actions (unchanged from v1)

### Your rooms
| Viewport | Where | Look |
| :--- | :--- | :--- |
| 760 px and wider | Button at the top right of the header. | 44 px tall, white, 2 px black border, 12 px radius, `0 3px 0 #000`, Fredoka 700 16 px, list icon, count badge. |
| Under 760 px | Floating pill, fixed at the bottom right: 4 px from the right edge (as placed on the board), 16 px from the bottom plus the safe-area inset. | 52 px tall, white, 2 px black border, 99 px radius, `0 4px 0 #000, 0 10px 24px rgba(0,0,0,.3)`, list icon, "Your rooms", count badge. |

Hidden when the guest has no saved rooms. Count badge: 22 px teal circle, white number. The accessible name includes the count ("Your rooms, 3 saved").

### Continue chip
44 px tall, `rgba(0,0,0,.2)` fill, white text, 99 px radius, `padding: 0 12px 0 14px`: "Continue" (700), a 10 px game-color square with a 1.5 px white outline, the room name or code, an arrow. Desktop adds " · {game name}". Long names end with an ellipsis. Hidden when there are no saved rooms.

### Desktop popover
A card's Join button or the Your rooms button opens a popover anchored to it: 420 px wide, white, 2 px black border, 18 px radius, 18 px padding, `0 4px 0 #000, 0 18px 40px rgba(0,0,0,.35)`, 16 px caret. Join opens above its button; Your rooms opens below, right edges aligned. Closes on Escape, a click outside, or the button again; focus returns to the button. One popover at a time.

### Mobile sheet
White bottom sheet, `24px 24px 0 0` radius, `padding: 8px 16px 34px`, `rgba(0,0,0,.45)` scrim, 40×5 grab handle, title `<h2>` (Fredoka 700 19 px) and a 44 px round close button. `role="dialog"`, `aria-modal="true"`, focus trapped and returned. Closes with the X, a scrim tap, a swipe down or the back gesture.

### Join content
Titled for the card's game: "Join a {game} room". If the code or name belongs to another game's room, open it anyway (routing follows `meta.gameSlug`). The input gets focus when it opens.

### Your rooms content
- Rows, newest activity first, rooms active in the last 30 days, each a link to `/{gameSlug}#{code}`, at least 64 px tall, `padding: 10px 12px`, 2 px `#E1E6E7` border, 14 px radius. Each row has a 40 px game tile; the room name or code (Fredoka 700 16 px) plus a "Yours" pill if this guest created it; "{game} · {last activity}" in 13 px `#4F5B5D`; a teal arrow.
- Note: "Rooms active in the last 30 days, saved on this device." 13 px `#5B6668`.
- The sheet grows to at most 75% of the screen and the list scrolls inside it.

### Join form
Heading row with the Code/Name switch; helper text (14 px, `#444`); one 48 px input (12 px radius, 2 px `#7C8A8C` border, Fredoka 600 16 px, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`); a full-width 48 px Join button (`#0F7983`, white Fredoka 700 17 px, `0 4px 0 #0A565D`).

Switch: `role="radiogroup"`, `aria-label="Join with"`, track `#E9EEEF`, 34 px segments (mobile 36), selected `#0F7983` with white text. Default Code. Arrow keys move the selection; switching swaps the placeholder, helper and label and clears errors.

| State | Behavior |
| :--- | :--- |
| Default | Code selected, input empty, Join disabled (`#8FA9AC`, no shadow) until there's a value. |
| Joining | Everything disabled, button "Joining…", `aria-busy="true"`. |
| Not found | 2 px `#B3261E` border, `aria-invalid="true"`, a red line with an icon below the input, `role="alert"`, linked by `aria-describedby`. Editing clears it. |
| Success | Go straight into the room. |

## Behavior
- **Start:** creates a room for that game and goes to its room screen. While it's creating, that Start button reads "Starting…" and every other Start button is disabled.
- **Play solo:** opens the solo game directly; no room, no link.
- **Join:** look up the value as a code, then as a name, trimmed and case-insensitive. Reveal nothing about rooms that aren't found.
- **Returning players:** rooms saved under `users/{uid}/rooms` feed Your rooms and the Continue chip.
- **Routing:** Same Page gets a new slug (`/same-page`). Keep the old First to Worst slug redirecting to it, so old links and saved rooms still open.

## Motion
- Cards: on hover or focus within, lift 6 px over 150 ms ease-out. Buttons press down 4 px and lose their shadow (60 ms).
- Jump buttons scroll smoothly to the section.
- Popover fades in and moves 4 px (120 ms). Sheet slides up (200 ms).
- `prefers-reduced-motion`: no lift, instant scroll, no fades.

## Accessibility
- One `<h1>` ("Game Room"). Folder titles are `<h2>`, "Play from anywhere" and "Talk it out" are `<h3>`, card titles are `<h4>`. Each section is labelled by its heading.
- Each button has its own name: "Start a Buzzer Quiz room", "Join a Same Page room", "Play Night Highway solo", and so on.
- Art panels, icon tiles, dots and SVGs are `aria-hidden="true"`.
- Focus: a 3 px white outline with a 2 px offset on teal and on the dark folders; a 3 px black outline on the yellow panel and on white cards.
- Contrast: white on `#0B3C49` about 12:1, on `#2B2466` about 13:1, on `#0F7983` about 5.1:1; black on `#FFE94A` about 17:1. The 85% white descriptions stay above 7:1 on both folders. Check each Start fill against its ink; all current pairs pass 4.5:1.
- Tap targets at least 44 px.

## Copy

| Where | Text |
| :--- | :--- |
| Title | Game Room |
| Subtitle | Pick a game. You'll get a private room and a link to share. |
| Jump buttons | Social · Talk it out · Solo |
| Social folder | Social games (mobile: Social) · {n} games · Two or more players, each on their own device. |
| Sub-section | Play from anywhere · The game shows everyone what's happening. No need to talk. |
| Talk it out | Talk it out · Call or same room · You'll need to talk to win. Get on a call or sit together. |
| Talk it out steps | Start a call, or sit side by side. · Each of you opens the room on your own phone. · Talk it through. The game won't tell you everything. |
| Solo folder | Solo games (mobile: Solo) · {n} game(s) · Play on your own, anytime. |
| Card buttons | Start · Join · Matchmaking · Play solo · Starting… |
| Footer | No accounts. Send the link and everyone's in. |
| Your rooms | Your rooms · Yours · Rooms active in the last 30 days, saved on this device. |
| Join | Join a {game} room · Code / Name · Enter its code (name) to jump back in. · Join · Joining… · We can't find that room. Check the code (name) and try again. |

## Adding a game
1. Pick its folder: Play from anywhere, Talk it out (needs voice), or Solo. A game can appear in two (like Night Highway), with Start/Join in Social and Play solo in Solo.
2. Add its art (168 px tall on the 300 px card, 290×190 on the wide one, so keep the important parts away from the edges the slants cut), a 92 px mini art for the compact card, a 40 px tile and a Continue color.
3. Write a full description (up to 3 lines at 300 px) and a short one (2 lines on mobile).
4. Give every button its own `aria-label` and check the Start fill against its ink at 4.5:1.
5. Update the folder's game count.