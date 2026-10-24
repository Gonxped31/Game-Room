---
description: Create a new project skill from the checklist and template
argument-hint: <skill-name> <what it covers>
---

Create the skill `$ARGUMENTS` in `.claude/skills/<name>/SKILL.md`.

Checklist:
1. Check `.claude/skills/` first; extend an existing skill instead of duplicating one.
2. `description` is one sentence, at most 25 words, with a narrow trigger ("Use when ...").
3. The body is procedure only, under ~50 lines. No history, no restating CLAUDE.md.
4. Long content (specs, tables, examples) goes in sibling files next to SKILL.md, linked by relative path.
5. If the skill ships a script, put it in the skill's `scripts/` and add its `Bash(...)` entry to the `.claude/settings.json` allow list (merge, don't overwrite).
6. Add one row to the skill table in CLAUDE.md. Never use `@`-imports.
7. Run `./scripts/check` if any code changed.

Template:

```markdown
---
name: <name>
description: <One sentence, max 25 words. Use when ...>
---

# <Title>

1. <Step>
2. <Step>

Details: see `reference.md`.
```
