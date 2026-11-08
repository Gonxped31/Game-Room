---
name: agent-setup
description: Where agent knowledge goes (CLAUDE.md, skills, hooks, scripts, docs, todos) and its size limits. Use when adding or changing any of them, or after a repeated mistake.
---

# Agent setup: where knowledge goes

## 1. Pick the cheapest place that works

| The knowledge is... | Put it in | Costs |
| :--- | :--- | :--- |
| A rule a machine can check | A lint rule, a git hook (`.githooks/`), a permission in `.claude/settings.json`, or a Claude hook in `scripts/hooks/` | Nothing |
| Mechanical work done often | A script with short output: one line per problem, then OK or FAIL | Its output |
| True for every change | The root `CLAUDE.md` | Every turn |
| True for one folder | That folder's `CLAUDE.md` | When the agent works there |
| A procedure for one kind of task | A skill | Its description every session; the body when used |
| Long reference (specs, formulas, data formats) | `docs/`, listed in the root `CLAUDE.md`'s table | When read |
| Work for later, or for when something happens | A todo with its trigger (`todo` skill) | Nothing |
| Why a change was made | The commit message | Nothing |
| Your own habits, true in every repo | `~/.claude/CLAUDE.md` | Every turn, in every repo |

Prefer the top of the table. A written rule is a request; a check is a guarantee. When
a rule becomes a check, keep at most one line saying why.

## 2. When to add something

- The same mistake twice: a rule. If a machine can check it: a check instead.
- The same procedure explained in two sessions: a skill.
- A command run often, with long output: a wrapper script.
- Not before. A guardrail for something that hasn't happened yet is a todo with a
  trigger.

## 3. Size limits

`node scripts/doctor.mjs` enforces them (`check` runs it).

| What | Limit |
| :--- | :--- |
| The root `CLAUDE.md` | 800 words |
| A folder's `CLAUDE.md` | 400 words |
| A skill's description | 30 words, saying when to use it ("Use when ...") |
| A `SKILL.md` | 100 lines; longer reference goes in files next to it |

Change a limit in `scripts/doctor.mjs` only with the reason in the commit.

## 4. Adding a skill

1. Look in `.claude/skills/` first: extend a skill rather than add a near-duplicate.
2. Write `.claude/skills/<name>/SKILL.md` with frontmatter `name` (the folder's name)
   and `description` (what it covers, then "Use when ..."). The body is procedure:
   steps, commands, gotchas. No history, and nothing `CLAUDE.md` already says.
3. A script goes in the skill's `scripts/` folder. Allow it in `.claude/settings.json`
   (`Bash(node .claude/skills/<name>/scripts/<file>:*)`), merging into the list.
4. Don't list skills in `CLAUDE.md`: their descriptions are already in context.
5. Run `node scripts/doctor.mjs`.

## 5. Never

- `@`-imports in `CLAUDE.md`: they load the whole file on every turn. Name the path in
  backticks instead, so it's read only when needed.
- The same fact in two places. Point to its source (the code, a doc) instead of
  copying it: copies go stale.

## 6. The kit's files

agent-kit wrote the files listed in `.claude/agk.json`; change them as the repo needs.
`agk update` brings in the kit's later changes. Where the repo changed a file, it puts
the kit's version next to it as `<file>.kit`: merge what's new into the file, keeping
the repo's changes, then delete the `.kit` file (`doctor` reports it until then).

To reuse this repo's setup in new repos, the user can save it as a preset:
`agk preset save <name> --list` shows what it has beyond the kit. Help them pick what's
generic, then `--only <numbers>`.
