# Detour: the map data and the map UI

The detail behind the `borderrun` skill's `SKILL.md` (next to this file): how the data is built, how the map draws, zooms and grows as you play.

## The map data

`scripts/borderrun-data.mjs` builds two committed JSON files from pinned
public sources (world-atlas 2.0.2 = Natural Earth 1:50m, public domain;
i18n-iso-countries 7.14.0 for codes and EN/FR alternatives; Natural Earth
5.1.2 1:50m populated places for capitals; Node's `Intl.DisplayNames` for
display names). Rerun it only to change the data: it is deterministic, so a
rerun with no script change leaves both files as they are.

| File | What | Who loads it |
| :--- | :--- | :--- |
| `lib/games/borderrun/countries.json` | 199 countries by ISO alpha-2: `en`, `fr`, `aliases`, land `borders` (318), and a `capital` (`en`, `fr`, `at` [lon, lat]) for every country with a border | Server (daily) and client |
| `lib/games/borderrun/shapes.json` | `c` centre, `p` simplified outlines, delta-encoded in 1/100° (~200 KB, ~75 KB gzipped) | Client only (`RouteMap`) |

How it's made, and why:
- **Borders are shared arcs**: two countries border each other where their
  topology outlines share an arc, so sea neighbours never count. Checked in
  tests against known pairs (and known non-pairs: France-UK, Spain-Morocco).
- **Each arc is simplified once** (Douglas-Peucker, 0.04°), so neighbours
  share the exact same border line; the map finds a closed border's spot from
  the vertices both countries have.
- **French Guiana is its own country (GF)**, split off France's polygon (it
  borders Brazil and Suriname); France's other overseas islands are dropped.
  Somaliland merges into Somalia, Northern Cyprus into Cyprus; Kosovo is XK.
  Dependencies with no land border (Guam, Bermuda…) are left out.
- **An alias two countries share** ("Congo") is dropped: display names
  decide (Congo = CG, DR Congo / RD Congo = CD).
- **Date line**: a ring that crosses it (Russia's far east, Fiji) is kept
  whole east of 180°, or it would draw as a band across the map.
- The Vatican's outline collapses at this simplification: it has only its
  centre, drawn as a dot (like every country too small to see on the map).
- **Capitals are the official seat**, not the biggest city: `CAPITAL` picks
  by name where Natural Earth lists several or the wrong one (Pretoria,
  Sucre, Dodoma, Porto-Novo…), `CAPITAL_FIX` covers what it is out of date on
  (Gitega, Astana). Tests pin a few.

## The map

**Closed borders** are drawn along their length in red (`borderLines`: the
runs of one country's outline through the other's vertices), with a small ✕
at the border's middle (`borderPoint`), so the mark is as big as the border.

**It zooms and pans** (`useZoom`, in the SVG's viewBox): the + button (from
the whole map it zooms in on what's drawn, not the map's middle), − and
"Show the whole map" once zoomed, double tap or click, pinch, ctrl + wheel
(a trackpad pinch; a plain wheel still scrolls the page), drag once zoomed.
- **Sizes are in the visible width** (`vw`), so dots, ✕s, rings and names
  keep their size on screen; tiny countries switch from a dot to their
  outline as you zoom in. Strokes are `non-scaling-stroke`.
- **Touch**: `touch-action: pan-y` on the whole map (one finger scrolls the
  page), `none` once zoomed; a non-passive `touchmove` cancels the browser's
  own pinch and scroll for two fingers or when zoomed.
- **The zoom resets with the route**: `PlayMap` keys `RouteMap` by the route,
  so finishing keeps the zoom and New route starts with the whole map.
- Live test B12 covers the buttons, drag, double tap or click and ctrl +
  wheel; pinch is only testable on a real phone.

**As you play**, the run grows on the map: `links(play)` (play.ts) gives the
links between neighbours, grown from the start and from the end one guess at
a time (a guess links to the first country of the run it borders; one that
borders none waits). A new guess only adds links, so the drawing never
jumps; tests pin that. `RunLink` draws each as dots across the border.
- **Landing**: a country or link added after the map appeared pops in, a
  ring in its tone spreads from it, a link draws itself in (600 ms). What was
  there when the map mounted (a reload, a new route) stays still: `first` in
  `RouteMap`. All off with reduced motion.
- **Glides**: the buttons, double taps and a guess out of view (zoomed in)
  glide for 300 ms. `settled()` is where the view is heading, so a quick
  second press or a guess mid-glide builds on it instead of cutting it short.
  A finger, the mouse or ctrl + wheel stops a glide. Live test B12 waits
  450 ms after each.
- Once the route is complete (or shown), the links fade and the full route
  line draws in.

**Names** (`placeLabels`) never hide a small country: inside a country only
when the name fits there, otherwise above or below it (beside it only for a
tall one like Chile, since beside drifts onto neighbours), clear of the
small countries drawn and of the zoom buttons' corner (measured with a
`ResizeObserver`). The start's and end's try every side, and at worst cover
a small country rather than go missing. A name with no room is left out:
zooming in makes room, and the route is spelled out under the map.

## The finished map

Once a route is over (complete, or shown on giving up), `PlayMap` passes the
route to `RouteMap`, which draws a dotted line through it (drawn in over
1.2 s, none with reduced motion) and names its countries; `CapitalLine` adds
"Lisbon → Warsaw · 2,760 km as the crow flies" under the map.
- **The line crosses each border at `crossingPoint`**: the shared vertex
  with the shortest detour from the previous point toward the next country,
  not the border's middle (`borderPoint`, still used for the closed-border ✕).
  The middle of Russia-China is on the Amur, so a route coming from the
  Caucasus looped out to Manchuria.
- **Names and the line's ends sit on `anchorOf`**: the country's centre, or
  the middle of its visible outline when the centre is off the map (Russia on
  Europe). The line's ends use the whole map, so the line stays put as you
  pan; names use the part in view.
