# UI review: the screenshot script in detail, and what emulation can't show

The `ui-review` skill's `SKILL.md` (next to this file) has the procedure; this is its reference.

## The screenshot script (`scripts/screenshots.mjs`)

**Pages** are given without a leading slash: `hub`, `same-page`, `cocounsel`, or a full
URL. Git Bash rewrites `/same-page` into a Windows path.

**Profiles** (default: all):

| Profile | Device | Browser |
| :--- | :--- | :--- |
| `iphone-se` | 375px | WebKit |
| `iphone` | iPhone 16 | WebKit |
| `android` | Pixel 8 | Chromium |
| `edge-760` | the hub's breakpoint edge | Chromium |
| `desktop` | 1280px | Chromium |

**Options:**
- `--dark` - adds Co-Counsel's dark theme.
- `--reduced-motion`.
- `--full-page` - the whole scrollable page.
- `--profiles=iphone,desktop`.
- `--out=DIR`, `--wait=MS`.

Every shot is checked for **horizontal overflow** and **console errors**, and the
script exits 1 if any are found. The Next.js dev-tools button is hidden. **Open and
look at the images**: the checks catch breakage, not ugliness.

**Screens that need setup** (a typed name, a joined room, a mid-game state): write
a scratch script that imports `newProfileContext(profile)`, `PROFILES` and
`closeBrowsers()` from `scripts/screenshots.mjs`, drives the page, then calls
`page.screenshot()`. For two-player states, combine it with the `live-test`
patterns.

## What emulation can't show

- **WebKit is Safari's engine, but not an iPhone.** Before shipping anything
  layout-sensitive, check on a real phone:
  - notch and home-bar safe areas (`env(safe-area-inset-*)`);
  - the browser bars that resize the viewport while scrolling;
  - Home Screen standalone mode;
  - real touch drag (Same Page notes).
- **Fonts can differ:** WebKit renders Fredoka visibly lighter than Chromium.
  Judge font weight on a real device.
- **Known artifacts of Playwright's WebKit on Windows**, not proven iPhone bugs:
  - Fredoka's `ffl` ligature renders with a gap ("Shuff le").

  Don't "fix" these from emulation alone; todo T-017 (`todo` skill) is the
  real-iPhone check.
