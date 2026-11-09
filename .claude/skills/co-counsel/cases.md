# Co-Counsel: case data

The cases, their loader and types, the validator, and how to write one. The `co-counsel` skill's `SKILL.md` (next to this file) has the rules that matter on every change.

## Case data

- `cases.json` holds every case, keyed by ID, so the content can be hand-edited.
  `cases.fr.json` is its French twin: same ids, cards, pairs and logic, French
  text (a case added to one goes in both; the parity test checks it).
  Five ship today: Easy `ruined-birthday` (3 Parts) and `missed-arrival` (3),
  Medium `midnight-playlist` (4) and `empty-frame` (5), Hard
  `unlocked-session` (6). **Adding a case needs no code change**: `CasePicker`
  lists every case by its `tier`, and the tests play each one through.
- **The case being played is `game.caseId`, in the shared state**, so both devices
  always play the same one. The page reads it through `caseForState()`, which
  falls back to `DEFAULT_CASE_ID` for an ID no longer in `cases.json`.
- `cases.ts` casts the import once (`as unknown as CaseBank`, because JSON
  imports widen tuples and literal unions) and exports `CASES`/`getCase(id)`,
  `caseForState`, `DEFAULT_CASE_ID` and `casesByTier()`.
- `caseTypes.ts` has the full shape: `CaseDefinition` → `CasePart` →
  `screens`/`hands`/`correct`/`traps`/`theory`, plus `characters` and `verdict`.
- `caseValidator.ts` implements the design doc's 8 validator checks.
  `caseValidator.test.ts` runs them against the real `cases.json`, so **adding or
  editing a case means running `npm test`**. That includes content rule 5: the
  correct pair must not share a distinctive word (5+ letters, minus common
  words), so a Part can't be solved by matching wording alone.
- **Writing a case:** each Part needs a theory except the last; traps should be
  pairs that *feel* right but contradict the partner's screen, and memory lures
  should misremember an earlier Part's fact. Keep the teaser spoiler-free.
- **One deliberate deviation from the doc's wording**: memory-lure cards are
  required in every Part *after the mechanic first appears*, not in every Part
  from Part 2 on. The shipped case first uses it in Part 3.
