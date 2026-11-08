# Night Highway: options, pickups, curves, the desert circuit, rain

What the road looks like and how it drives. The `night-highway` skill's `SKILL.md` (next to this file) has the rules that matter on every change.

## Options (`GameState.options`)

- `{ rain, pickups, desert }`, defaults `DEFAULT_OPTIONS` (pickups on, rain and
  desert off).
  `normalizeGame` fills them in for a room made before they existed.
- `setOptions(game, change)` - either player, in the lobby only (refused mid-race),
  and it **clears both Readys** so nobody races with switches they didn't see.
- A race passes them to the engine in `startRace` (`race.options`); between races
  the page previews them with `engine.setOptions` (rain falls in the lobby). Solo
  keeps its own, in localStorage `night-highway:options`, flipped by the title
  card's switches (`#optPickups`/`#optRain`/`#optDesert`, wired by the engine).
- The engine shows the switches of whatever the road is showing (`shownOptions()`:
  the race's while one runs, otherwise the lobby's or solo's), so flipping Desert
  in the lobby swaps the circuit behind the card.

## Pickups (`pickups.ts`)

- Three kinds: **nitro** (+50% nitro), **phase** (5 s see-through: drive through
  traffic, the combo can't break or time out), **shield** (absorbs the next crash:
  it breaks into 0.8 s of phasing, so no speed or combo is lost).
- Laid out from the run's seed in 220 m segments (1-2 per segment, never two in
  one lane, none before 160 m), so both racers meet the same ones. Each collects
  in their own world. Integer-op randomness only, like the traffic.
- Driving *through* a car while phasing is not a near miss (overlap gap < 0).
- Solo runs lay pickups out from where the run starts (`pickupBase`), since the
  car's road position doesn't reset in solo.
- The engine fades the player's car while phasing, so **the ghost car has its own
  copies of every material** (it used to share them, so it would fade too).

## Curves (`road.ts`) - always on

- **The game stays a straight road**: traffic, pickups, collisions and the race
  sync all live in road coordinates. The curves are drawn by **bending the world
  sideways in the vertex shaders** by distance ahead (like OutRun), from a table
  (`nhBend`, 34 samples from -96 m to 1488 m) refilled every frame by
  `fillBendTable`.
  - Built-in materials get the bend in `onBeforeCompile` (`bendMaterial`, applied
    to everything in the scene just before boot, plus the motion-blur mask). The
    custom shaders (glow, buildings) include `BEND_GLSL` themselves. Sprites
    don't go through it (the ghost's name label is offset by hand).
  - Long road pieces (road, walkways, barriers, ground) are subdivided along their
    length so they can bend. Culling is off, since objects draw away from where
    three thinks they are.
  - The drawn bend is exaggerated (`BEND_EXAGGERATION`, ×3): at true scale it
    flattens into the horizon.
- **Bends push the car outward**: lateral speed = curvature × speed² ×
  `CENTRIFUGAL`, so you steer into them. Uses the real curvature, not the
  exaggerated picture.
- A race's curves come from its seed; solo and the title screen roll their own.
- New materials added later must go through `bendMaterial` (or include
  `BEND_GLSL`), or they won't follow the road.

## The desert circuit (an option)

- **A dirt track through a red-rock canyon at sunset** (reference:
  `references/night-highway/desert-canyon-road.png`, its shapes, not its light):
  - Sunset: a low sun ahead-left (`SUN_DIR`, drawn in the sky shader), an
    orange-to-violet sky, warm fog, a warm grade, sunset reflections (a second env
    map), mesas on the horizon instead of the skyline.
  - A single track, still 4 lanes wide (same invisible lanes, so traffic and the
    race sync don't change): packed dirt with ruts and no paint
    (`makeRoadTextures(true)`, fully matte). No oncoming road, barriers or
    oncoming cars (`highwayOnly`, hidden in `writeTraffic`/`updateStreaks`).
  - The road edges wander: sand drifts in over the outer lanes (`sandSpill`) and a
    low rocky bank bulges in and out behind it (`edges`/`updateEdge`, strips rebuilt
    each frame like the walls). A picture only: the car still stops at `LIM` and
    scrapes along the bank. Loose stones lie on the track (visual).
  - Canyon walls (`canyonWall`/`updateWall`): one strip per side, rebuilt every
    frame from the world distance (`wallNoise`), so they wind, step and rise as
    you drive; 10 m rows so they follow the hills. Layered strata texture.
  - Boulders, scrub and a few saguaros on the canyon floor (`scatter`); `offRoad`
    mirrors about the track and keeps a piece's whole radius off it.
  - The title kicker swaps per circuit (`.nh-city-only` / `.nh-desert-only`).
  - The player drives an off-road trophy truck (`orBody` + `orWheels`, built
    beside the car in the same chassis and swapped by `showVehicle`, for the
    ghost too). It shares the car's paint, lamps and nitro flame, and its hitbox,
    so racing doesn't change. Lamps move with it (`LAMPS`); no neon underglow
    there (`UNDERGLOW_DESERT`).
- **Desert traffic**: jeeps and pickups (by the car's id: even a jeep, odd a
  pickup) and dusty tipper haulers, in dusty colours, from their own instanced
  meshes (`TRAFFIC_SETS`, picked in `trafficMeshes`). Same lengths, widths and
  light positions as the city's, so the traffic plays the same. Test hook:
  `traffic()` lists the same-direction traffic in sight.
- **Boot compiles both circuits' shaders** (everything hidden is shown for one
  `renderer.compile`), so the first switch doesn't stall a frame.
- **Driving on dirt** (desert only, same for both racers):
  - Loose grip: sideways speed settles slowly after steering (`drive()`: settle
    rate 3.2 vs the car's 7, 1.6 when wet too) and bends push 1.2x harder. Measured:
    0.3 s after letting go, 33% of the slide is left vs 9% in the city.
  - Bumpy ride: `dirtBump(s)` (washboard, rolling, the odd stone; a picture only)
    moves the truck's wheels exactly and its body softly, and jolts the camera,
    which also rumbles with speed.
  - Deep sand (`sand.ts`): drifts of soft sand across one or two lanes, 18-40 m
    long, never on the start and always leaving a lane free; laid out from the
    run's seed (mixed from the pickups', integer-op randomness only), so both
    racers meet the same ones. In one, the car slows by `SAND_DRAG * v²` - about
    40% of its speed across an average drift, at any speed - slides like in
    rain, and throws a plume. Drawn opaque (`sandPatchMat`): faded in at soft
    edges, they vanished against the dirt. Test hook: `sand()`.
  - Dust (`updateDust`): puffs from the player's wheels (more when sliding or on
    nitro), the traffic and the ghost. Each starts with its vehicle's speed
    (`carry`) and slows, or it would vanish behind the camera at once.
- **Built beside the city, swapped by `setCircuit()`** (called every frame from
  the shown switch; it only does work when the circuit changes). `CIRCUITS` holds
  each one's look; `cityObjs`/`desertObjs` are hidden and shown. Any new
  look-dependent value belongs in `CIRCUITS`.
- **Hills** (`road.ts`: `heightAt`, `fillHillTable`): drawn like the curves - a
  second table (`nhHill`) on the same grid lifts every vertex in the shaders
  (`nhBendXY`). Picture only: traffic, pickups and the race sync don't change.
  Each 260 m segment is flat or one crest/dip of 6-18 m (from the race's seed).
  The camera rides them (`updateCamera`); sprites are lifted by hand (the
  ghost's label). Zeros in the city.
  - **Anything long must be subdivided** (~10 m rows) or its straight segments
    cut through the road on a dip: the big ground plane had 100 m rows and showed
    as an orange band over the road.
- **The screens and HUD get a deeper veil and a text shadow** over the bright
  sky (`.nh.nh-desert`, toggled on the stage root by `setCircuit`).

## Rain (an option)

- **Driving**: sideways speed settles slowly (the car slides after you let go of
  the steering), steering builds up more slowly, braking is weaker (21 vs 32
  m/s²), and bends push 1.5× harder.
- **Look and sound**: falling rain as instanced thin quads (WebGL lines are always
  1 px and vanish at low resolution and under the motion blur), denser fog, a
  shinier road and longer reflections, and a hiss. It eases in and out
  (`rainK`).
