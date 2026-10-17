---
name: todo
description: Use when the user asks to work on, add, or review todos, or says "next todo".
---

# Todos: work the queue through the script

`todo.md` and `todo-archive.md` are the script's data. **Never read or edit them
directly**; always go through the script, so the queue costs almost no tokens.

## 1. Commands

Run from the repo root (`T` below stands for `node .claude/skills/todo/scripts/todo.mjs`):

| Command | What it does |
| :--- | :--- |
| `T next` | The best eligible item as its raw line, or `none` |
| `T list [-p N] [--tag X] [--all]` | Eligible items; `--all` adds blocked ones, marked `*` |
| `T show T-XXX` | The item's line, then `todos/T-XXX.md` if it exists |
| `T add "text" [-p 1-3] [--dep T-A,T-B] [--size S\|M\|L] [--tag a,b]` | Appends an item; prints only the new ID |
| `T set T-XXX [-p 1-3] [--dep T-A,T-B\|-] [--size S\|M\|L\|-]` | Changes priority, deps or size, keeping the ID |
| `T edit T-XXX "new text"` | Replaces the item's one-line description |
| `T tag T-XXX a,b` | Replaces an item's tags (`-` clears) |
| `T detail T-XXX "text"` or `--file path` [`--append`] | Writes `todos/T-XXX.md` (replaces it unless `--append`) |
| `T stats` | Counts by priority and size, with bars, and done this week |
| `T graph` | Dependency tree: each ready item with what waits on it; cycles last |
| `T html [--out file]` | Self-contained HTML board with light and dark colors |
| `T done T-XXX` | Removes and archives the line; prints `unblocked: ...` for items it fully freed |
| `T rm T-XXX` | Removes it without archiving (obsolete) |

Line format: `ID | P | dep | size | tags | description`.

- **Deps:** one ID, several comma-separated (`T-025,T-026`), or `-`. An item is
  eligible only when *none* of its deps are still in `todo.md`. A dep missing from
  `todo.md` counts as done (a dep found nowhere also prints a typo warning). A cycle
  is refused. `list` shows only the deps still open; `done`/`rm` print `unblocked:`
  only for items with no deps left.
- **IDs** are never reused, even after `rm` (the highest ever issued is kept in `.todo-last-id`).
- **Tags:** lowercase only (others are rejected), comma-separated, `-` for none. Area tags: devops, infra,
  frontend, backend, full-stack, docs. Game slugs (`ftw`, `cocounsel`,
  `nighthighway`, `iai`) are valid tags too.
- **Detail files:** `done` and `rm` both delete `todos/T-XXX.md`. The archive keeps
  only the one-line entry, so put anything worth keeping in the code or commit.
- **Color** is for humans only: it turns on in a terminal (`--pretty`, `--color=always`,
  or `FORCE_COLOR`), and `--pretty` overrides `NO_COLOR`. Piped output, which is what
  Claude gets, is always plain, so don't pass color flags.
- `next` picks the lowest P, then the lowest ID, among eligible items.

## 2. Working a todo

1. Run `T next`.
2. If a `todos/<id>.md` detail file may exist, run `T show <id>`.
3. If size is L, or the description is vague, outline a plan and confirm with the user before editing.
4. Do the work. Keep the change focused on that one todo.
5. Run `T done <id>`.
6. Run `T add ...` for any follow-up work discovered, instead of expanding scope.
7. Report in 1-2 sentences, then stop. Don't start the next todo unless the user asked for a batch.
