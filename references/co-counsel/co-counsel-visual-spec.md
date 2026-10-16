# Co-Counsel: Visual Spec for Claude Code

Use this as the visual source of truth when building the app screens. It matches the design canvas "Co-Counsel Visual Design" (foundations board plus 7 phone screens). Screens are mobile-first at 390 px wide. On desktop, center the same column (max-width about 480 px) on the Docket Paper background.

## Idea in one line
Two color worlds for two players (blue Investigator, red Defendant), yellow for anything you can act on, testimony typed like a court transcript, and results delivered by rubber stamps.

## Design tokens

```css
:root {
  /* Color */
  --ink: #1C1F3D;            /* text, card edges, hard shadows */
  --paper: #EEF0F6;          /* app background */
  --white: #FFFFFF;
  --investigator: #2447D8;   /* Cyanotype */
  --defendant: #C8372D;      /* Wax Red */
  --yellow: #FFD23A;         /* actions, exhibit tents, current tab/pip */
  --green: #0F7A4A;          /* correct pair stamp */
  --amber: #A65A00;          /* plausible-but-wrong stamp */
  --text-2: #4A4F73;         /* secondary text */
  --card-edge-blue: #C9D0E8; /* unselected card border, Investigator */
  --card-edge-red: #E8CFCC;  /* unselected card border, Defendant */
  --rule-blue: #E3E7F4;      /* ruled lines on transcript, Investigator */
  --rule-red: #F3E3E1;       /* ruled lines on transcript, Defendant */
  --gutter-blue: #5566B4;    /* line numbers, Investigator */
  --gutter-red: #B0453D;     /* line numbers, Defendant */
  --disabled-bg: #DDE1EE;
  --disabled-text: #5C6286;

  /* Radius */
  --r-card: 12px; --r-button: 14px; --r-paper: 6px; --r-stamp: 6px;

  /* Type */
  --font-ui: 'Archivo', system-ui, sans-serif;           /* 400..800 */
  --font-display: 'Archivo Narrow', sans-serif;          /* 600, 700: stamps and big numbers */
  --font-typed: 'Courier Prime', monospace;              /* 400, 700: testimony */
}
```

Load fonts from Google Fonts: `Archivo:wght@400;500;600;700;800`, `Archivo+Narrow:wght@600;700`, `Courier+Prime:wght@400;700`.

Spacing is an 8-point grid with a 16 px screen margin. Cards and buttons have a 2 px ink border. Selected or pressable objects get a hard shadow with no blur (`0 5px 0 var(--ink)` on cards, `0 4px 0 var(--ink)` on buttons).

## Type scale

| Use | Font | Size / line | Weight |
| :--- | :--- | :--- | :--- |
| Wordmark | Archivo | 40 / 1, tracking -0.03em | 800 |
| Screen heading | Archivo | 26-28 / 1.1, tracking -0.01em | 800 |
| Body | Archivo | 15-17 / 1.4 | 500 |
| Card claim | Archivo | 17-18 / 1.25 | 700 |
| Small labels | Archivo | 13-15 | 600-700 |
| Stamp | Archivo Narrow, uppercase | 36-52 / 1.1, tracking 0.03em | 700 |
| Big score numbers | Archivo Narrow | 60 / 1.05 | 700 |
| Testimony | Courier Prime | 15 / 26 | 400 |

Use sentence case for labels. No all-caps except stamps.

## Role identity
- **Investigator:** `--investigator` header band, "You're Maya, the Investigator".
- **Defendant:** `--defendant` header band, "You're Leo, the Defendant".
- Role color is never the only cue. The role name is always written next to it.
- The role colors appear on: the header band, the "What you know" tab, the transcript gutter, the card border tint, and the card strip on the reveal screen.

## Components

**Header band (during a Part):** full-width role color, white text, 20 px vertical padding. Row 1: docket tabs (3 tabs, 28x10 px, rounded top corners; current = yellow, others = white at 35%) with "Part N of 3" on the left; two pips and "N tries left" on the right (available pip = yellow filled, used pip = ring). Row 2: Part title (heading style) and "You're {Name}, the {Role}".

**Transcript sheet ("What you know"):** white sheet, 6 px radius, small role-colored tab at the top left. Courier Prime 15 / 26. A ruled line every 26 px (`repeating-linear-gradient` with `background-origin: content-box`). A 40 px right-aligned gutter of line numbers with a 3 px double rule. Line numbers should cover every wrapped line of the text; generate them from the rendered line count.

**Exhibit tent:** 44x36 yellow trapezoid (`clip-path: polygon(14% 0, 86% 0, 100% 100%, 0 100%)`) with the card number in Archivo Narrow 24 px, ink.

**Claim card (in hand):** white, 12 px radius, 2 px role-tinted border, tent on the left, claim text on the right, min height 64 px, 10 px gap between cards.
- Selected: 3 px ink border, `box-shadow: 0 5px 0 var(--ink)`, a 26 px ink circle with a white check at the right.
- Tapping a selected card again deselects it.

**Primary button:** 56 px tall, yellow, 2 px ink border, hard shadow, Archivo 800 18 px, optional lock icon. Pressed: move down 4 px and drop the shadow. Disabled: `--disabled-bg`, `--disabled-text`, no shadow, label "Pick a card to lock in". On a Defendant screen the disabled button uses a warm gray (`#E6DFE0` with `#6B5A5C` text).

**Secondary button:** 52 px, transparent, 2 px ink border, Archivo 700 16 px.

**Stamp:** inline block, rotated -6 to +4 degrees, 4-5 px solid border plus a 2 px outline at 3-4 px offset, 6 px radius, Archivo Narrow 700 uppercase. Colors: green = "Working theory", amber = "Doesn't fit", ink = "Doesn't hold up", green (larger) = "Not guilty". Use a paper-colored background when it overlaps cards.

**Reveal cards:** two cards side by side, each with a 30 px role-color strip reading "Maya's card" or "Leo's card", then tent and claim text (18 px). Card bodies have a 200 px minimum height so the overlapping stamp doesn't cover the text.

**Results header (reveal and verdict):** split band, left half blue ("Maya, Investigator"), right half red ("Leo, Defendant"), with a small yellow lens shape (the overlap of two circles) at the seam.

## Screens and states

0. **Pick a case:** small wordmark, heading "Pick a case", "You both play the case you choose here.", a room row ("Room k7x2q9m4" with a secondary "Copy room link" button, 44 px tall), then one folder-style card per difficulty tier. Each card has a small tab at the top left naming the tier (Easy, Medium, Hard) and a row of docket tabs showing the number of Parts. The available case card has a 3 px ink border, a hard shadow, the title, a spoiler-free teaser, "Best played on a call with your partner.", and a primary "Choose this case" button. Tiers without a case yet use a dashed gray border and read "Up to 5 Parts... Coming later." and "6 or more Parts... Coming later." The teaser must never reveal either player's private info. In v1, with one case, the screen still shows all three tiers so the structure is clear.
1. **Pick a role:** wordmark with the two-circle mark, case title, room code, "Who are you this round?" and two large full-width role buttons (blue and red), with a yellow plus badge at the seam. Microcopy: "Your partner picks the other role. Never look at each other's screen."
2. **Part, Investigator / Defendant:** header band, transcript sheet, one line "Say it out loud. Don't show your screen.", 3 claim cards, primary button pinned at the bottom.
3. **Locked in, waiting:** "Your card" shown face up with a lock badge next to a dashed slot "Leo is still choosing". Heading "Locked in. Waiting for Leo." Body "Keep talking. Both cards flip at the same time."
4. **Reveal, plausible but wrong:** split header, tabs and pips ("1 try left"), two cards, amber stamp "Doesn't fit", heading "Plausible, but something doesn't fit.", body "Talk it through, then pick again.", button "Pick again". The wrong pair uses the ink stamp "Doesn't hold up" with the heading "That doesn't hold up."
5. **Reveal, working theory:** green stamp, heading "Working theory accepted.", the theory as a typed "Case notes" sheet, button "Continue to Part 2". After the second miss, show the correct pair and the theory, with "The judge reveals the pair" as the heading.
6. **Verdict and scores:** split header, green "Not guilty" stamp, typed verdict text, Focus and Trust as big numbers with 10 px ink bars, duo classification on an ink block with yellow Archivo Narrow text, attempts line, primary "See the full case file", secondary "Rematch with swapped roles". Scores appear only here, never during play.

## Motion (one moment matters most: the reveal)
1. Both cards flip together: `rotateY(180deg)`, about 0.7 s, `cubic-bezier(.3, 1.25, .4, 1)`, `backface-visibility: hidden`. Card backs use the role color with an inset 2 px white border.
2. About 0.3 s after the flip, the stamp lands: from scale 1.6 and opacity 0 to its resting rotation at scale 1, about 0.25 s, ease-out.
3. Selecting a card: a 120 ms lift. Pressing a button: a 60 ms move down.
4. Respect `prefers-reduced-motion`: no flip and no stamp animation, just show the final state.

## Accessibility
- Cards and buttons are real `<button>` elements. A card hand is a `role="radiogroup"` with each card `role="radio"` and `aria-checked`.
- Icon-only controls need `aria-label`. Decorative SVGs get `aria-hidden="true"`.
- Result changes are announced in an `aria-live="polite"` region.
- Visible keyboard focus: a 3 px ink outline with a 2 px offset (use a white outline on colored bands).
- Text contrast is at least 4.5:1, except large stamp text at 3:1 or better. White on `--investigator` is about 7:1 and white on `--defendant` is about 5.2:1.

## Notes for building
- Card text comes from the case JSON (see the game design doc). Keep card claims short enough for two lines at 17 px on a 358 px wide column, and let the card grow if the text is longer.
- Don't show emoji or tropey gradients. The only gradients are the transcript ruled lines.
- Keep the game title in one constant (`GAME_TITLE`) so it can be renamed later.
