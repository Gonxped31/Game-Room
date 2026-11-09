# Source tracking and games finished

Two things the owner's dashboard (`/admin`) needs and the rooms alone can't
tell: **where players come from** (the link that first brought them) and **the
north-star metric, games finished per week**. No cookies, no third-party
trackers, nothing personal: a few tags and counts, keyed by the invisible guest
ID.

Code: `lib/tracking/` (browser and shared records), `components/SourceCapture.tsx`
(rendered once by the root layout), `lib/daily/service.ts` (`recordFinished`),
`lib/analytics/tracking.ts` + `trackingAdapter.ts` (the numbers),
`components/admin/FinishedStats.tsx` (the dashboard sections).

## Data model

```
users/{uid}/firstTouch               { src, med?, cmp?, at }                 written once, by its owner; never changed or removed
finished/games/{gameKey}             { slug, mode, players, lang, at, room?, matchmade? }   one per finished game, created once
finished/players/{gameKey}_{uid}     { game: gameKey, uid, src, cmp?, at }   one per finishing guest, written by that guest
```

- `gameKey`: `{room}_{id}` for a room game, `{uid}_{id}` for a solo game, and
  `{uid}_daily-{slug}-{day}` for a daily. Room codes, uids and ids never
  contain `_`.
- `src`, `med`, `cmp`: lowercase `[a-z0-9._-]`, at most 40 characters.
  `src` is `direct` for a link with no tag.
- `mode`: `room` (private room), `match` (matchmade, not a race), `solo`,
  `daily`, `challenge`, `survival`; `matchmade: true` for a public race.
- `players`: 1 to 8. `lang`: `en`/`fr`, the game's content language if it has
  one, else the interface language.
- Every `at` is the server's time (`serverTimestamp()`; the rules check it is
  within the last minute).

### The rules (`database.rules.json`, tests in `tests/rules/tracking.test.ts`)

- `firstTouch`: only the owner writes it; `users/$uid`'s `.write` refuses any
  write that would change or remove an existing one.
- A header is created once (`!data.exists()`); a second device's copy is
  refused, which the client swallows. A room game's header needs `room`, a key
  starting with `{room}_`, the writer seated there (`members/{uid}`) and the
  room's own `gameSlug`. A solo one has no `room` and a key starting with
  `{writer's uid}_`. Clients can't write `daily` (only the server does).
- A participation: the writer's own uid, written once, only after the header
  exists, and only by a guest seated in that room (or the solo game's owner).
- Nobody reads or lists `finished` (no `.read`); the dashboard reads it with
  firebase-admin. Both nodes have `.indexOn: ["at"]` for range queries later.

## Source tracking

- `SourceCapture` runs once per page load, in an effect: it reads
  `utm_source` (or its short alias `ref`), `utm_medium` and `utm_campaign`,
  removes those tags from the address bar (`history.replaceState`, keeping the
  path, other parameters and the #hash) and, if this browser has no first touch
  yet, keeps one in localStorage (`partyfox.firstTouch`; `direct` without a tag).
- Later, when the browser is idle, it waits for the guest's sign-in
  (`ensureGuestUid`) and writes `users/{uid}/firstTouch` once. Local mode keeps
  it in localStorage only. `/admin` is left alone.
- Any source value is accepted (sanitized), so a new channel needs no code.
  Expected ones: tiktok, instagram, youtube, reddit, discord, facebook, x,
  producthunt, plus the app's own links (`lib/share.ts`): `invite` and `daily`,
  with `utm_campaign=<slug>`.

### Attribution (`attributionOf` in `lib/analytics/tracking.ts`)

- A guest counts for their **first touch**. When it never reached the database,
  the source their device sent with a finished game stands in.
- **Before tracking**: a guest with neither, or whose earliest room, visit or
  finished game is more than an hour older than their first touch (they existed
  before tracking shipped and their first touch was written when they came
  back). The hour covers a first room created just before the lazy write lands.
- Known limits: one guest is one browser. An in-app browser (TikTok's,
  Instagram's) is a different browser from Safari; someone who clears their
  site data comes back as a new guest. A stats clear erases visit days, so a
  pre-tracking guest known only from those can look newer than they are.

## What counts as a game finished

A game reports once it reaches its **real end**: a match result or revealed
round (Same Page), a solved case (Co-Counsel), a race's final standings, a final
score, a solo game won or lost. Abandoned games never report. Every seated
device calls `useReportFinished(game)` (`lib/tracking/useReportFinished.ts`):
the header makes it one game, and each device adds its own participation. A
device also remembers the games it reported (localStorage `partyfox.finished`),
so a reload or re-render never posts twice.

Daily puzzles are recorded by the server, in the submit route, when the result
is first written (`recordFinished` in `lib/daily/service.ts`): mode `daily`,
one player, the guest's `firstTouch` read there, and the page's language sent by
`lib/daily/client.ts`. Today's dailies have no failing end (a wrong solve is
refused, not recorded); a daily that adds one should record it the same way.

## The dashboard

- **Games finished**: this week against last week (weeks Monday to Sunday,
  America/Toronto, like the daily), a 12-week trend, and breakdowns by game, by
  mode and by source (a game counts once for each source among its players).
- **Players**: distinct guests who finished at least one game, all time and
  this week. The 500k goal counts this way.
- **Where players come from**: per source and per source + campaign, over the
  chosen days (presets or two dates, Toronto days): new guests (first seen in
  those days), rooms created (by a creator from that source), games finished
  (with a finisher from it) and players who finished.
- **Clear stats** erases `finished` with the other stats-only data and
  everything counts from its time (`analytics/statsSince`). First touches stay:
  they say where a guest came from, and only guests first seen since the clear
  count as new.

## Deploy order

These rules only **add** paths (`users/{uid}/firstTouch`, `finished/...`), so
here the usual order is reversed: **deploy the rules first**
(`npx firebase deploy --only database`), then the app. Old clients never write
the new paths and are unaffected; a new client under the old rules would have
its writes refused (`$other` is false under `users/$uid`).

## Checking it

1. Open the app with `?utm_source=tiktok&utm_campaign=test1` in a private
   window: the tags disappear from the address bar at once.
2. Finish a game (a solo Rank & File puzzle is quickest).
3. In `/admin`, "Where players come from" shows one new guest and one game
   finished under `tiktok` and `tiktok · test1`; "Games finished" counts it this
   week.
