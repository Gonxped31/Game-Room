# Co-Counsel - build history

How Co-Counsel was built, stage by stage.

**This is history, not documentation of the current system.** Entries describe what
was true when they were written, and many describe mechanisms that were later
replaced (most notably by the guest-ID rework: seats moved out of game state, the
per-tab `me` pointer, the polling heartbeat and the open database rules are all
gone). For how things work now, see the root `CLAUDE.md` and the project skills in
`.claude/skills/`.

## Stages

- **Stage 1 (done):** case data (`cases.json`), types (`caseTypes.ts`), the
  validator (`caseValidator.ts`), and the game state machine (`game.ts`) - no UI yet.
  36 Vitest cases: schedule/transition correctness, hand/turn-order rejection, the
  documented Part 1 trap pair's exact flag outcome, Focus-flag computation against
  the documented Part 3 memory lures, the judge-reveals-after-2-misses path, every
  validator check (including that the real shipped case passes cleanly), and a full
  first-try playthrough of the whole case reaching a 100%/100% "Mind-Reading Team"
  result. Verified: zero diff to any existing `lib/session/*` or `lib/games/ftw/*`
  file.
- **Stage 2 (done):** the UI - `components/cocounsel/` (`Wordmark`, `Button`,
  `Stamp`, `ExhibitTent`, `ClaimCard`/`Hand`, `TranscriptSheet`, `PartProgress`/
  `HeaderBand`, `ResultsHeader`, `RevealCard`, `CasePicker`, `RolePicker`,
  `PartScreen`, `RevealScreen`, `VerdictScreen`, `RecapScreen`, `Footer`) and
  `app/cocounsel/page.tsx`. An entirely new visual system from FTW's, per the
  visual spec: three new `next/font/google` loaders (Archivo, Archivo Narrow,
  Courier Prime) added in `app/layout.tsx` alongside Fredoka without touching
  `body`'s font (every Co-Counsel component opts in via `font-[family-name:...]`
  utilities instead), and `lib/games/cocounsel/theme.ts` holding the design doc's
  exact hex/radius tokens as plain named exports - same "inline Tailwind arbitrary
  values, no CSS variable theme layer" convention as every other game's components
  here, just a new palette. `RevealCard`'s flip reuses the literal `flip-inner`
  class name from `components/ftw/CardFace.tsx`'s technique (new component, same
  mechanics) so it inherits the existing global `prefers-reduced-motion` override
  for free; two new keyframes (`stamp-land`, `card-lift`) were added to
  `app/globals.css` alongside FTW's, with their own reduced-motion disable.
  `RolePicker` (role-only, no name entry - the case fixes character names) and
  `Footer` are new Co-Counsel-specific components, not the shared `components/`
  ones, since nothing about this game's visual language matches FTW's. One
  deliberate deviation from FTW's gating pattern: the role-pick screen shows
  whenever `!bothJoined` (not `!me`), so "Rematch with swapped roles" (which resets
  `names` to `{}`) re-prompts *both* devices to pick a role, even the one whose
  local `me` is still set from the previous game - otherwise that device would get
  stuck seeing a stale waiting screen instead of a chance to pick again.
  Verified end-to-end against real Firebase with two isolated browser contexts: the
  full 3-Part case (a first-try solve, a trap-then-retry solve, and a forced
  judge-reveal after 2 misses - confirming the judge shows the *correct* pair, not
  what was actually played), the verdict screen's Trust/Focus/duo classification,
  the recap screen, and that a rematch correctly re-prompts both devices for a
  role. Also verified: `prefers-reduced-motion` disables both the card flip and the
  stamp-land animation, and the hand's `radiogroup`/`radio` roles +
  `aria-checked` + `aria-live` regions all behave correctly. Confirmed FTW is
  unaffected by the shared `app/layout.tsx`/`app/globals.css` additions via a live
  two-device FTW playthrough.
- **Stage 3 (done, post-launch polish):** four user-requested changes, entirely
  scoped to `lib/games/cocounsel/`/`components/cocounsel/`/`app/cocounsel/page.tsx`
  - zero diff to any file outside that tree.
  - **Back button.** `components/cocounsel/BackButton.tsx` - a fixed-position
    `←` link to `/`, rendered once in the page (not threaded through every
    screen component, unlike the shared 1v1 `Header`'s inline approach, since
    Co-Counsel's screens don't share one common header shape). `<main>` carries
    `pt-14` top clearance so the button never overlaps the Wordmark logo or a
    role-colored band's own top-left text.
  - **White, responsive layout.** `COLOR.paper` changed from the visual spec's
    `#EEF0F6` to `#FFFFFF` (a deliberate, documented deviation from the spec,
    per user request) - a single token change, since every consumer of
    `COLOR.paper` (the page background, the bottom action bar, the stamp's
    masking background) was already semantically "match the page background."
    `CONTAINER_MAX_WIDTH_CLASS` (`lib/games/cocounsel/theme.ts`) replaces the
    old fixed `max-w-[480px]`: `480px` on mobile (unchanged - "perfect for
    phone") growing to `720px` by the `lg` breakpoint, shared between the main
    page wrapper and `PartScreen`'s fixed bottom bar (a separate
    `position:fixed` stacking context that can't inherit the page's width, so
    it needs the same class applied directly to stay aligned).
  - **3 tries per case, not 2 per Part.** `MAX_ATTEMPTS_PER_PART` (2) renamed
    to `MAX_CASE_ATTEMPTS` (3) in `constants.ts` - a deliberate deviation from
    the design doc's "2 attempts per Part" (its own "Still Open" section
    already flagged this exact number as worth revisiting after a real
    playthrough). The fix was almost entirely a one-line change:
    `continueAfterReveal` no longer resets `attempts: 0` when advancing to the
    next Part, so the existing "miss count hits the max → judge reveals"
    check in `lockIn` automatically became case-wide instead of per-Part,
    with no other logic changes needed. The judge can now trigger on the very
    first miss of a Part if an earlier Part already spent the rest of the
    budget - verified with a dedicated cross-Part accumulation test
    (`game.test.ts`) and confirmed live against real Firebase.
  - **The link-sharer picks the case.** Previously every device independently
    saw (and had to tap through) the case-picker screen, even though it's
    just a confirmation tap in v1 (one real case). Now only the device that
    visits with no `#room` in the URL at all - the one about to generate a
    fresh room and share its link - sees it; a device that opens an existing
    link skips straight to role-pick. Implemented via a `useState` lazy
    initializer reading `window.location.hash` (runs synchronously on the
    very first client render, strictly before any effects - including
    `useGameSession`'s own hash-generating effect - so it reliably observes
    the hash before that effect can rewrite it). **Hit and fixed a real
    hydration bug while building this**: the `showCasePicker` check was
    initially placed *before* the existing `!game` loading-gate in the
    screen's ternary chain, so it could render `CasePicker` before `game` had
    resolved from `null` - a moment that's supposed to be universally
    identical between server and every client (that's what makes the `!game`
    branch hydration-safe to begin with) - producing a real "Hydration failed"
    console error on the creator's own first load. Fixed by reordering the
    ternary so `!game` is checked first, unconditionally, restoring that
    universal-first-paint guarantee. `handleNewRoom` resets the captured flag
    (via the state setter, from a plain click handler - not an effect) so
    generating a fresh room via "New room" correctly makes that device the
    creator of the *new* room, independent of whatever it was for the old one.
- **Stage 4 (done, consistency pass):** three more user-requested changes, again
  entirely scoped to `lib/games/cocounsel/`/`components/cocounsel/`/
  `app/cocounsel/page.tsx`/the Co-Counsel-only block in `app/globals.css` - zero
  diff to FTW, the picker, or the shared session layer.
  - **Copy-link step matches FTW's, as its own separate screen.** The page's
    branching now mirrors FTW's exact `!game → !me → !bothJoined → playing`
    shape, with `showCasePicker` inserted ahead of it:
    `!game → showCasePicker → !me → !bothJoined → playing`. `!me` shows
    `RolePicker` (pick a role); `!bothJoined` now shows the literal shared
    `components/InviteLinkBanner.tsx` (unchanged, not a Co-Counsel reskin) -
    previously `!bothJoined` went straight back to `RolePicker` a second time,
    with no distinct "waiting, copy the link" step at all. `CasePicker` and
    `RolePicker` both had their embedded "Room X" / copy-link UI stripped
    entirely (that's `InviteLinkBanner`'s job now, one step later, same as
    FTW's own `RolePicker` not showing a room code either) - `CasePicker` is
    now purely about the case, `RolePicker` purely about the role.
  - **Back button matches FTW's style.** `BackButton.tsx`'s classes now
    literally match the shared `Header`'s back-link (`bg-black/40`, `h-9 w-9`,
    no `backdrop-blur-sm`) - still `position: fixed` rather than threaded
    inline per-screen like FTW, since Co-Counsel has no single shared header
    component the way FTW does (its screens split between `Wordmark`-topped
    screens and full-bleed `HeaderBand`/`ResultsHeader` colored bands).
  - **Co-Counsel-only manual light/dark toggle** - deliberately *not* shared
    platform infrastructure; FTW is completely untouched and may get its own
    independent toggle later if ever wanted. `lib/games/cocounsel/useTheme.ts`
    holds `type ThemeMode = "light" | "dark"` state backed by `localStorage`
    under the Co-Counsel-specific key `"cocounsel-theme"`. Unlike the
    `isCreator` lazy-`useState`-initializer pattern (safe only because the JSX
    depending on it stays gated behind `!game`), the theme is applied as a
    `data-theme` attribute directly on the page's root wrapper div, which
    renders unconditionally from the very first paint - so a lazy initializer
    reading `localStorage` would hydration-mismatch for any returning
    dark-mode visitor. `useTheme` instead starts at `"light"` on every render
    (server and client's first paint alike) and only reads the real stored
    value inside an effect via `setTimeout(fn, 0)` - the same
    deferred-first-setState pattern `useGameSession`'s `now` tick already
    uses - so a stored "dark" preference applies as a same-tick correction
    right after mount instead of a server/client mismatch.
    `components/cocounsel/ThemeToggle.tsx` is a sun/moon button mirroring
    `BackButton`'s fixed top-left circle on the opposite (top-right) corner.
    The swap mechanism needed no `dark:` Tailwind variant or
    `@custom-variant` opt-in: every Co-Counsel component already reads colors
    via `style={{color: COLOR.xxx}}`, never Tailwind color utility classes
    (confirmed and enforced - see the `bg-white` note below), so
    `lib/games/cocounsel/theme.ts`'s **neutral/surface** tokens (`ink`,
    `paper`, `white`, `text2`, the card-edge/rule/gutter/disabled tokens)
    became `var(--cc-xxx)` references, a source-of-truth-only change with
    zero edits to any of their ~15 consuming files, since CSS variables
    resolve at paint time regardless of which theme is active. Brand/role
    colors (`investigator`/`defendant`/`yellow`/`green`/`amber`) stayed plain
    hex - already saturated enough to read on a dark background, and part of
    the game's identity rather than an eye-strain concern. `app/globals.css`
    gained a "Co-Counsel:" scoped `:root { --cc-ink: ...; }` (light) +
    `[data-theme="dark"] { --cc-ink: ...; }` block, following the existing
    `stamp-land`/`card-lift` precedent of Co-Counsel-only rules living in
    that same shared file.
    **Bug found and fixed while verifying dark mode live**: seven components
    (`ClaimCard`, `CasePicker`, `VerdictScreen`, `RecapScreen` ×2,
    `TranscriptSheet`, `PartScreen`, `RevealScreen`) used Tailwind's literal
    `bg-white` utility class for card surfaces instead of `COLOR.white`,
    which is exactly the "never Tailwind color utility classes" rule this
    whole mechanism depends on - undetectable by any automated check (tsc/
    eslint/vitest/build all passed with it in place), only visible by
    actually loading dark mode in a browser: those cards stayed hardcoded
    white while their `COLOR.ink` text turned light, becoming unreadable.
    Fixed by moving every instance to `style={{backgroundColor: COLOR.white}}`.
    Verified via a live two-device Playwright run: the restructured flow
    end-to-end (case pick → role pick → shared `InviteLinkBanner` while
    waiting, confirmed via its own text rather than a custom box → second
    device joins → play proceeds), confirming neither `CasePicker` nor
    `RolePicker` show any room-code/copy-link UI; dark mode toggled and
    confirmed to persist across a reload; screenshots of the case-picker,
    role-pick, invite-link, and a Part screen in both themes (including the
    `bg-white` fix); zero console errors throughout. A quick FTW regression
    check confirmed its background/fonts/lack-of-theme-toggle are completely
    unaffected.
- **Stage 5 (done): running out of attempts ends the whole case, not just the
  current Part.** Previously the judge revealing the correct pair after the 3rd
  total miss was a "freebie" - play continued to the next Part exactly as if it
  had been solved, eventually reaching the normal celebratory `VerdictScreen`
  regardless of how many Parts were actually judge-revealed. Now it's a genuine
  loss state.
  - **`game.ts`**: `AttemptOutcome`/`RevealInfo.outcome` split the old single
    `"judgeRevealed"` cap-reached case into two. Reaching the cap on the case's
    **last** Part is still `"judgeRevealed"` (the correct pair IS shown, same as
    before). Reaching it on an **earlier** Part is now `"adjourned"` - shows what
    was actually *played*, not the correct pair, since "only give the final
    answer if they fail at the last Part" per the design rule. `continueAfterReveal`
    sends *either* straight to `CASE_DONE` regardless of Part index (previously
    only last-Part `judgeRevealed` did - an earlier-Part `judgeRevealed` used to
    advance to the next Part, which can no longer happen since that situation
    now produces `adjourned` instead). A solved reveal is still the only outcome
    that can advance to the next Part. How the case ended is read back from
    `game.log.at(-1)?.outcome` once `CASE_DONE` renders (`lastReveal` is already
    cleared by then) - `"solved"` is the only celebratory ending.
  - **New `components/cocounsel/AdjournedScreen.tsx`**, picked by
    `app/cocounsel/page.tsx`'s `CASE_DONE` branch whenever the log's last entry
    isn't `"solved"`, alongside (not replacing) `VerdictScreen`/`RecapScreen`.
    States which Part the case ended on. If the ending was `"judgeRevealed"`
    (last Part) shows `caseDef.verdict.text` as closure and offers "See the full
    case file" (`RecapScreen`, unchanged); if `"adjourned"` (earlier Part), shows
    only the dismissal message and **no** verdict/recap option at all - a
    Recap would spoil every Part's correct pair regardless of how the case
    actually ended, so it's only ever offered when nothing is left to protect.
    Single action either way, "Start a new case", reusing the exact same
    `setGame(newGame(CASE_ID))` handler the "Rematch" button already used (same
    room, same roles, no case-reconfirmation screen) - confirmed via a
    clarifying question before building this.
  - **`Stamp.tsx`** gained a `"red"` `StampColor` (`COLOR.defendant`) for the
    Adjourned framing, distinct from green (success)/amber (retry)/ink (wrong).
    **`RevealScreen.tsx`**: `judgeRevealed`'s stamp also switched to red with
    reworded copy (it no longer means "continue playing", it means "the case is
    over, the judge is just telling you the answer first"); a new `showTheory`
    check (`isFinal && outcome !== "adjourned"`) keeps `isFinal` covering all
    three "no more retries" outcomes while still never revealing a Part's
    `theory` for an `"adjourned"` ending, even though the Part itself has one
    (only the case's last Part lacks a `theory` - adjourned only ever happens
    earlier).
  - **Found and fixed a real regression while verifying this live**: Co-Counsel's
    new "Start a new case" button got both devices permanently stuck on
    `InviteLinkBanner` after resetting. Root cause and fix are the shared
    `useGameSession` self-healing-identity addition documented under
    "Multi-game architecture" above - not specific to this feature, but this is
    where it was caught (a prior session's restructuring of Co-Counsel's
    branching had silently broken the "re-prompt for a role on reset" behavior
    its original design depended on; FTW's own "Reset game" had the identical
    latent bug the whole time, just never exercised).
  - Verified live, two devices: a cap-out on an earlier Part - `AdjournedScreen`
    shows no verdict/recap/answer at all, "Start a new case" resets in-place and
    both devices correctly re-show `RolePicker` to reclaim their roles, reaching
    fresh Part-1 gameplay again in the same room; a cap-out on the case's last
    Part - the correct pair is revealed in `RevealScreen`, and `AdjournedScreen`
    shows the case verdict text with "See the full case file" available; both
    confirmed in dark mode too. The ordinary win path (solving every Part) is
    completely unaffected - existing `VerdictScreen`/`RecapScreen` flow, unchanged.
- **Stage 6 (done): back link moved inline, a `TranscriptSheet` line-count bug
  fixed.** Two user-reported issues.
  - **The back link is no longer `position: fixed` over the whole viewport** -
    the user wanted it next to the logo, like the shared 1v1 `Header`'s inline
    back-link, not floating disconnected in the screen's literal top-left
    corner. `components/cocounsel/BackButton.tsx` (the old fixed component) is
    deleted; new `BackLink.tsx` is the same visual treatment
    (`bg-black/40`/`h-9 w-9`/white arrow) but a plain inline element, placed at
    each of Co-Counsel's three header shapes: prepended into `Wordmark.tsx`
    (covers `CasePicker`/`RolePicker`/`RecapScreen`, and `app/cocounsel/page.tsx`'s
    `!bothJoined` branch, which gained a `Wordmark` above `InviteLinkBanner` -
    previously that screen had no header at all), alongside `HeaderBand.tsx`'s
    `PartProgress` row (the gameplay Part screen), and at the top of
    `ResultsHeader.tsx`'s investigator half (reveal/verdict/adjourned screens).
    `<main>`'s `pt-14` top clearance stays - it's still needed for the
    still-fixed `ThemeToggle`, just no longer doubles as back-button clearance.
  - **`TranscriptSheet.tsx`'s "What you know" sheet was rendering 30+ empty
    ruled lines for a 4-line paragraph.** Root cause: the gutter (line numbers)
    and the text `<p>` are flex row siblings under the *default* `align-items:
    stretch` - the `<p>`'s measured `offsetHeight` (what computes `lineCount`,
    driving how many line-number spans the gutter renders) was being inflated
    to match the gutter's own rendered height via that stretch, which is
    itself driven by `lineCount` - a circular dependency where any tiny
    overshoot compounds every `ResizeObserver` tick with no ceiling. Fixed with
    one class: `items-start` on the row breaks the stretch, so the paragraph's
    measured height is always its genuine intrinsic content height, regardless
    of the gutter's size. Verified live: a 10-line Part 1 transcript now shows
    exactly 10 ruled lines, not 31.
- **Stage 7 (done): the back link goes to case selection (owner only), not
  the game picker; a tier-badge visual bug fixed.** Two more user-reported
  issues, the first refined across two follow-up corrections.
  - **`BackLink` no longer leaves Co-Counsel at all - for the room's
    OWNER.** Per the user: "Pick a case" is Co-Counsel's own default/home
    screen, and the back link should return there - restarting a case
    (Rematch/"Start a new case") is the *only* path that goes to
    `RolePicker`, and leaving the game entirely is still available via the
    Footer's separate "All games" link, not the back link. `BackLink.tsx`
    changed from a `<Link href="/">` to a plain `<button onClick={onBack}>`
    (aria-label "Back to case selection"), threaded as a prop through
    `Wordmark`/`HeaderBand`/`ResultsHeader` and every screen that renders
    them. **A joiner never gets a case-selection "home" to return to at
    all, though** - only the room's owner chose the case (the one who
    shared the invite link), so a joiner's back link leaves Co-Counsel
    entirely instead (this was a correction after the first pass let *any*
    device reach `CasePicker` via back - re-tightened to check `isJoiner`).
    `app/cocounsel/page.tsx`'s `handleBack` is the shared dispatcher every
    non-`CasePicker` screen's `onBack` uses: `isJoiner` routes straight to
    `handleBackToGameRoom` (`router.push("/")`); the owner instead sets
    `forceCasePicker`, which `showCasePicker` ANDs with `!isJoiner`
    (`!isJoiner && (forceCasePicker || !caseConfirmed)` - `isJoiner` gates
    it unconditionally, `forceCasePicker` can never override that gate).
    Nothing about the room/role claims/game progress is touched by setting
    `forceCasePicker`, so the owner re-confirming via "Choose this case"
    (which also clears it) resumes exactly wherever the shared game state
    actually has them, not a reset. `CasePicker`'s OWN back link is a
    separate case - from Co-Counsel's home screen, back goes up a level to
    the game picker directly via `handleBackToGameRoom`, same as a joiner's
    back link anywhere else, rather than re-showing itself as a no-op (this
    screen is owner-only anyway, so no `isJoiner` branch is needed there).
    `RecapScreen`'s pre-existing `onBack` prop (its own "Back to the
    verdict" button, an unrelated concept) was renamed to `onBackToVerdict`
    to free up `onBack` for the new shared meaning.
  - **The "Medium"/"Hard" tier tabs on `CasePicker` read as struck through**
    - the outer dashed box's own top border was visible THROUGH the tab,
    cutting across the tier name, because (unlike the solid ink-filled "Easy"
    tab immediately above it, which is opaque) the dashed tier tabs had no
    `backgroundColor` at all - transparent, so whatever the absolutely-
    positioned tab visually overlapped (the box's own border) showed straight
    through. Fixed by giving them `backgroundColor: COLOR.paper` (matching
    the page background, like "Easy"'s solid fill masks its own overlap) and
    raising/enlarging them to match "Easy"'s exact offset/padding
    (`-top-3.5`/`py-1`, was `-top-3`/`py-0.5`) for a consistent notch across
    all three tier tabs.
- **Stage 8 (done): a stuck "Joining…" button, a joiner seeing case
  selection anyway, a white gap above full-bleed bands.** Three more
  user-reported issues, the second a genuine regression from Stage 7's own
  fix.
  - **`JoinRoomForm`'s button could get permanently stuck reading "Joining…"**
    after joining a room then leaving it (e.g. via the Footer's "All games"
    link or browser back) and returning to the picker - the same category of
    bug as the earlier `useGameSession` identity-stranding fix (see "Multi-
    game architecture" above): Next's client-side navigation can reuse this
    exact component instance rather than remounting it, so `status` was
    never reset back to idle once a join succeeded (there'd seemed no need
    to, since the page was about to navigate away). `goTo` now resets it
    regardless.
  - **Joining Co-Counsel through the picker's "Join a room" form (not a raw
    shared link) could show the case-selection screen to a joiner** - a
    second-order consequence of switching `goTo` from `router.push` to a
    hard `window.location` navigation (below): `app/cocounsel/page.tsx`'s
    `isCreator` reads `window.location.hash` via a `useState` lazy
    initializer specifically because that's the ONE moment guaranteed to run
    before `useGameSession`'s own hash-generating effect can rewrite it (see
    that state's own doc comment) - correct for an organic page load, but a
    client-side `router.push()` transition from a different route doesn't
    reliably guarantee the destination's hash is already settled on
    `window.location` by that same first-render moment, confirmed live. **An
    initial fix attempt moved the detection into a `useEffect` instead**,
    which broke the common case instead: `useGameSession`'s own hash-
    generating effect fires first (`useGameSession` is called earlier in
    this component, and React runs effects in hook-declaration order), so by
    the time a *later*, independently-deferred effect re-checked the hash,
    `useGameSession` had often already rewritten it from empty to a freshly
    generated code - misreading genuine creators as joiners. Reverted that
    attempt; the real fix is in `JoinRoomForm.tsx` instead (see below),
    leaving `isCreator`'s lazy initializer exactly as it always was.
  - **`JoinRoomForm.tsx`'s `goTo` now does a hard navigation**
    (`window.location.href`, set from a `useEffect` reacting to a
    `destination` state value - this project's `react-hooks/immutability`
    lint rule disallows mutating `window.location` directly in a plain event
    handler, "consider using an effect" - rather than `next/navigation`'s
    `router.push`), sidestepping the whole class of client-side-navigation
    timing/caching issues above: a genuine page load guarantees
    `isCreator`'s lazy initializer sees a fully-settled URL, and leaves
    nothing for a future "Joining…"-stuck bug like the one above to reuse
    either.
  - **A visible white gap sat above Co-Counsel's full-bleed colored bands**
    (`HeaderBand`/`ResultsHeader`) - `<main>`'s `pt-14` top padding, still
    reserved for the fixed-position `ThemeToggle` after Stage 7 moved the
    back link inline (its own doc comment said as much at the time), pushed
    every screen down uniformly, including bands meant to start flush with
    the viewport's top edge. Fixed the same way Stage 7 fixed the back
    link: `ThemeToggle.tsx` is no longer `position: fixed` - it's inline,
    paired opposite `BackLink` in each of Co-Counsel's three header shapes
    (`Wordmark`'s row via `justify-between`; `HeaderBand` gained its own
    back-link+theme-toggle row, kept SEPARATE from the `PartProgress` row
    below it since that row's own content already spans close to the full
    content width - cramming a 5th element in risked overflow on narrow
    viewports; `ResultsHeader`'s investigator half keeps `BackLink`,
    `ThemeToggle` mirrors it on the defendant half). `<main>`'s `pt-14` is
    gone entirely - nothing fixed-position remains that needs it.
  - Verified live: the join-via-form flow no longer shows case selection to
    a joiner while the owner's own fresh-visit flow is unaffected; the Join
    button reads "Join" (not stuck) after leaving and returning to the
    picker; the page's very top pixel is the band's own color (not white) on
    the Part/reveal screens, with the back link and theme toggle both
    visible and functional inline on every header shape; dark mode toggling
    and persistence are unaffected. Zero console errors throughout.
- **Stage 9 (done): two devices racing to claim the same role could both
  succeed.** User-reported: "when someone picks a role, normally the other
  should not be able to pick role - this doesn't work yet." Root cause and
  fix live in the shared `lib/session/identity.ts`/`useGameSession.ts` - see
  the detailed write-up under "Multi-game architecture" above (this bug and
  its fix apply to FTW's `RolePicker` too, not just Co-Counsel's, since both
  go through the same `setIdentityName`/`pickIdentity`). The regression
  hit and fixed *while verifying this fix live* - a fresh room's state has
  no `names` key at all (Firebase drops an empty `{}` on write), and the new
  guard code's first version read `state.names[role]` without normalizing
  that first, breaking the ordinary first-role-pick happy path on every new
  room - was caught specifically by testing against a brand-new Co-Counsel
  room rather than a reused one, underscoring why this needed a live
  two-device Playwright run and not just the unit tests.
- **Stage 10 (done): a deliberate "continue as X / switch role" choice when
  rejoining a room, instead of always silently resuming the remembered
  role.** User-requested, after noticing a device always auto-resumed
  whichever role it played last time it had this room open - by design (a
  seat claim is sticky in `localStorage` so a device never loses its seat on
  an unrelated change), but the user wanted the option to override that.
  - **`lib/session/identity.ts`** gained `releaseIdentityName(state, role)` -
    the shared-state counterpart to `setIdentityName`, but it clears a seat
    instead of claiming one (builds a fresh `names` object without that
    role's key, the same Firebase-rejects-explicit-undefined pattern as
    every other field-clearing spot in this codebase; a no-op, never throws,
    releasing a seat nobody holds). `useGameSession.ts` gained
    `releaseIdentity()`, pairing that with clearing this device's own local
    `me` pointer - unlike `pickIdentity`, there's no race to guard against
    (a device can only ever release its OWN seat, no competing writer to
    lose to), so the local `me` is cleared immediately rather than waiting on
    the shared transaction. Both are genuinely generic session primitives
    (not Co-Counsel-specific internally) and live in the shared layer per
    this file's own architecture split, but FTW doesn't call either one -
    zero behavior change there, confirmed live.
    **Superseded by Stage 11 below** - releasing only the initiating
    device's own seat turned out not to be enough for a real "switch", so
    neither `releaseIdentityName` nor `releaseIdentity` exist under those
    names anymore; this paragraph is kept as the narrative record of how the
    feature started.
  - **Scoped to Co-Counsel's own `app/cocounsel/page.tsx` +
    new `components/cocounsel/ConfirmRoleScreen.tsx`.** `isFreshGame`
    (`partIndex === 0 && attempts === 0 && no locks set`) gates the whole
    feature: a device with an already-remembered seat sees the new
    "Welcome back! Last time you were X, the Y." confirm screen ONLY while
    the case is still genuinely untouched - once there's any real progress,
    reopening the room resumes straight into play exactly like before, with
    no prompt at all (switching isn't offered once a match is active, so a
    confirm screen with nothing to confirm would just be nagging on every
    ordinary refresh/reopen). `roleConfirmedThisVisit` is local,
    unpersisted `useState(false)` - resets on every fresh mount of the page
    (i.e. every time the room is opened), which is what makes this
    re-prompt on each rejoin rather than only the very first time ever; it's
    also set `true` directly inside `RolePicker`'s own pick handlers, so a
    brand-new pick (first time ever claiming a seat) is never immediately
    followed by a redundant "continue as X?" prompt on the very next
    render. "Continue" just sets that flag; "Switch role instead" calls
    `releaseIdentity()`, which naturally falls through to the existing
    `!me ? RolePicker` branch with the freed role now selectable again (or,
    if the other player's seat was also already released the same way,
    both roles open - the two devices effectively swap by each
    independently choosing to let go of their own seat, not by one device
    unilaterally overwriting the other's).
  - Verified live against real Firebase, two isolated browser contexts: a
    fresh pick never shows the confirm screen (no redundant prompt right
    after picking); reloading a tab that already has a remembered seat shows
    the confirm screen with correct, case-accurate copy; "Switch role
    instead" frees the seat, returns to `RolePicker` with that role
    re-pickable, and re-picking it works end-to-end; "Continue" on the other
    device resumes normally; and - the key safety check - reloading AFTER a
    card has actually been locked in resumes straight into the "Locked in,
    waiting" state with no confirm screen at all, confirming the mid-game
    guard holds. `tsc`/`eslint`/117 Vitest cases (5 new, covering
    `releaseIdentityName`)/`next build` all clean. A quick live FTW
    regression check (name entry, room creation) confirmed zero impact from
    the two additive, FTW-unused `lib/session/` changes.
- **Stage 11 (done): auto-assign the remaining role, and make "switch role"
  open the choice for BOTH players.** Two follow-up user requests building
  directly on Stage 10's work.
  - **Auto-assign.** With exactly two roles, once one is taken the other is
    already decided - a new effect in `app/cocounsel/page.tsx` auto-claims
    the sole open role the moment it becomes the only one left, instead of
    making the second player tap a button whose outcome is no longer a real
    choice. Fires only while genuinely eligible to see `RolePicker` (game
    loaded, case confirmed, no seat of mine to confirm) and only when
    exactly one role is open - both open (nobody's picked) or both taken
    (nothing to decide) leave it alone, which is also what makes this safe
    after a "switch role" release without any extra bookkeeping (see below).
    **Hit and fixed a real self-race while verifying this live**:
    `pickIdentity` sets `me` only AFTER its shared write is confirmed, but
    the shared write landing is what updates `investigatorTaken`/
    `defendantTaken` in the first place - and that update can reach this
    component and re-render BEFORE the subsequent `meStore.set(role)` line
    actually runs (they're two separate steps separated by an `await`). On
    that in-between render, `me` was still null while the OTHER role
    (not the one just clicked) now read as the only open one - exactly the
    auto-assign trigger condition - so a device that explicitly clicked
    "I'm the Defendant" could watch its OWN auto-assign effect race in and
    silently hand it Investigator instead, overwriting its own explicit
    pick. First caught by a live two-device Playwright run doing a genuine
    swap (not just a fresh join) - a sequential-pick-only test wouldn't have
    exercised this, since it only shows up when a device's own pick and its
    own auto-assign effect can plausibly interleave. Fixed with a
    `pickingRef` (a ref, not state - react-hooks/refs forbids reading a ref
    during render, so it's only ever touched inside the effect and
    `RolePicker`'s click handlers, never in the render body) set whenever a
    pick - explicit or auto-assigned - is in flight on THIS device, which
    the auto-assign effect checks and backs off from.
  - **"Switch role instead" now opens the choice for both players, not just
    the initiator.** `lib/session/identity.ts`'s `releaseIdentityName`
    (Stage 10, single-seat) is replaced by `releaseAllIdentityNames` -
    clears every seat at once, since with only two seats, releasing just the
    initiator's own seat left the other one still held, so the only "open"
    seat remaining was the very one just given up - not a real switch, just
    an elaborate way to reclaim your own old role. `useGameSession.ts`'s
    `releaseIdentity` is likewise replaced by `releaseAllIdentities`,
    clearing this device's own local `me` immediately (as before - still no
    race to guard against here) and writing an empty `names` to the shared
    state. The OTHER player's device needs no new mechanism to notice - its
    local `me` gets cleared by the same self-heal effect that already
    re-prompts both devices after "Rematch"/"Reset case" wipe `names` back
    to `{}`. Once both devices land back on a fully open `RolePicker`,
    auto-assign (above) naturally completes the swap: the initiator must
    pick manually (two roles open, nothing for auto-assign to decide), and
    the moment they do, the OTHER device - still waiting - auto-claims
    whichever role is left, with no click needed on their end either.
  - Verified live against real Firebase, two isolated browser contexts: a
    fresh join still requires the FIRST player to pick manually, but the
    SECOND player gets auto-assigned the remaining role within half a
    second, no click at all; reloading one device, clicking "Switch role
    instead", and confirming BOTH devices land back on a fully open
    `RolePicker` (not just the initiator's); the initiator manually picking
    the role they didn't have before (the actual swap) while the other
    device auto-assigns into the remaining one, instantly, with each
    device's FINAL role correctly matching what was actually clicked (the
    self-race bug above, confirmed fixed - before the fix, this exact
    sequence silently gave the initiator back their OLD role instead of the
    one they clicked); the mid-game guard re-verified unaffected now that a
    fresh join auto-resolves the second seat. `tsc`/`eslint`/117 Vitest
    cases (identity tests updated for `releaseAllIdentityNames`)/
    `next build` all clean. FTW re-confirmed unaffected (name entry, room
    creation) by the `lib/session/` changes, which it still doesn't call.
- **Stage 12 (done): guest IDs and room-level seats** (the platform-wide rework;
  see `platform.md`, "Multi-game platform Stage 9", and the root `CLAUDE.md`).
  Co-Counsel-specific effects:
  - **Seats survive "Rematch"/"Start a new case"**: both players keep their roles
    and go straight into Part 1.
  - **"Switch role instead" is an atomic swap** (`handleSwitchRole`), not a
    release-both-and-re-pick. The other device simply finds itself in the other
    role.
  - **`RolePicker` gained takeover props** (`canTakeOverInvestigator`/
    `canTakeOverDefendant`).
  - **Only the creator gets the room-name field** on the invite screen.
  - **`isCreator` (the case-picker gate) still uses the empty-hash lazy
    initializer**. It still works because `useRoom` only writes the hash after
    the room exists, so the first render always sees it empty.

  Verified against the emulators: the creator picks Defendant, the joiner via the
  hub form is auto-assigned Investigator, and a reload followed by "Switch role
  instead" swaps both seats in one update.
