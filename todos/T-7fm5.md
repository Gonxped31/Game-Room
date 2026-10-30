T-7fm5 | 2 | - | S | frontend,howtoplay,lasthop | Move Last Hop's How to play onto the shared components/HowToPlay.tsx dialog
created: 2026-10-30T18:30:29.018Z

Trigger: both the lasthop branch (Last Hop) and the how-to-play branch (components/HowToPlay.tsx, docs/how-to-play.md) are on main. What: in components/lasthop/Rules.tsx, replace its own RulesButton/RulesDialog with <HowToPlay look={...} variant={variant}> wrapping RulesContent (keep the drawings and the me/pawns props); the look = Last Hop's ui.tsx tokens (PrimaryButton as DoneButton, the round ? button classes). Check last-hop.mjs still passes (it opens the dialog from the header and the lobby). Why: one shared dialog for every game, per docs/how-to-play.md; Last Hop wrote the first one before the shared shell existed.
