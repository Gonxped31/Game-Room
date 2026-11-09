T-gcp4 | 3 | - | S | cocounsel | Co-Counsel: "Rematch with swapped roles" keeps the same roles: swap them, or rename the button
created: 2026-11-09T13:35:19.730Z

Trigger: none, any time. handleRematch in app/cocounsel/page.tsx keeps the seats, while the label (English and French, components/cocounsel/text.ts) promises a swap. Either swap the roles in the rematch transition (pure, in lib/games/cocounsel/game.ts, with a Vitest test; check the rules allow the write) or relabel it plain "Rematch" / "Revanche". Why: the button does not do what it says.
