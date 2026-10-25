---
name: todo
description: Use when the user asks to work on, add, or review todos, or says "next todo".
---

# Todos: work the queue through the script

`todos/` and `todo-archive.md` are the script's data. **Never read or edit them
directly**; always go through the script, so the queue costs almost no tokens.

## 1. Commands

Run from the repo root (`T` below stands for `node .claude/skills/todo/scripts/todo.mjs`):

| Command | What it does |
| :--- | :--- |
| `T next` | The best eligible item as its raw line, or `none` |
| `T list [-p N] [--tag X] [--all]` | Eligible items; `--all` adds blocked ones, marked `*` |
| `T show T-XXX` | The item's line, then its detail text if any |
| `T add "text" [-p 1-3] [--dep T-A,T-B] [--size S\|M\|L] [--tag a,b]` | Creates an item; prints only the new ID |
| `T set T-XXX [-p 1-3] [--dep T-A,T-B\|-] [--size S\|M\|L\|-]` | Changes priority, deps or size, keeping the ID |
| `T edit T-XXX "new text"` | Replaces the item's one-line description |
| `T tag T-XXX a,b` | Replaces an item's tags (`-` clears) |
| `T detail T-XXX "text"` or `--file path` [`--append`] | Sets the item's detail text (replaces it unless `--append`) |
| `T stats` | Counts by priority and size, with bars, and done this week |
| `T graph` | Dependency tree: each ready item with what waits on it; cycles last |
| `T html [--out file]` | Self-contained HTML board with light and dark colors |
| `T done T-XXX` | Removes and archives the line; prints `unblocked: ...` for items it fully freed |
| `T rm T-XXX` | Removes it without archiving (obsolete) |
| `T migrate` | Converts an old single-file `todo.md`, also mid-rebase (see section 3) |

Line format: `ID | P | dep | size | tags | description`.

- **Deps:** one ID, several comma-separated (`T-025,T-k7q3`), or `-`. An item is
  eligible only when *none* of its deps are still open. A dep that isn't open
  counts as done (a dep found nowhere also prints a typo warning). A cycle is
  refused. `list` shows only the deps still open; `done`/`rm` print `unblocked:`
  only for items with no deps left.
- **IDs** are random: `T-` plus 4 characters (`T-k7q3`), never reused, checked
  against every open and archived ID. Old numeric IDs (`T-017`) stay valid. IDs are
  case-insensitive to type.
- **Tags:** lowercase only (others are rejected), comma-separated, `-` for none. Area tags: devops, infra,
  frontend, backend, full-stack, docs. Game slugs (`ftw`, `cocounsel`,
  `nighthighway`, `buzzerquiz`, `wordscramble`) are valid tags too.
- **Detail text:** `done` and `rm` delete it with the item. The archive keeps only
  the one-line entry, so put anything worth keeping in the code or commit.
- **Color** is for humans only: it turns on in a terminal (`--pretty`, `--color=always`,
  or `FORCE_COLOR`), and `--pretty` overrides `NO_COLOR`. Piped output, which is what
  Claude gets, is always plain, so don't pass color flags.
- `next` picks the lowest P, then the oldest item, among eligible items.

## 2. Working a todo

1. Run `T next`.
2. If the item may have detail text, run `T show <id>`.
3. If size is L, or the description is vague, outline a plan and confirm with the user before editing.
4. Do the work. Keep the change focused on that one todo.
5. Run `T done <id>`.
6. Run `T add ...` for any follow-up work discovered, instead of expanding scope.
7. Report in 1-2 sentences, then stop. Don't start the next todo unless the user asked for a batch.

## 3. Parallel worktrees

Several agents work at once, each in its own worktree. The queue is built so their
branches merge cleanly:

- **One file per todo** (`todos/<ID>.md`). Two branches that add, edit or finish
  *different* todos touch different files. Only the same todo changed on both sides
  conflicts, and that is a real conflict: keep the right version by hand.
- **Random IDs** need no shared counter, so two worktrees never hand out the same one.
- **`todo-archive.md`** only ever gets lines appended, and `.gitattributes` merges it
  with `merge=union`, so both branches' `done` lines stay.

**A branch from before this format** (its `todo.md` still lists todos) is migrated
*during* its rebase onto `main`. `main` keeps a short stub `todo.md`, so each of the
branch's commits that touched the old queue stops with a conflict in it. At every
such stop:

```bash
node .claude/skills/todo/scripts/todo.mjs migrate   # main's script: the rebase put it here
git add -A todos todo.md
git rm -q --ignore-unmatch .todo-last-id
git rebase --continue                                # repeat at the next stop
```

`migrate` reads the branch's side of the conflict and writes the stub back:
- a todo whose ID `main` already uses for a *different* todo (the old counter's
  collisions) gets a new random ID, and the deps pointing at it follow;
- one already migrated at an earlier stop keeps the ID it got there;
- the same todo, edited on both sides, keeps `main`'s file (reported).

It prints every rename and anything it left out. Other conflicting files are resolved
as usual.
