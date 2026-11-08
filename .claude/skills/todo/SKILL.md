---
name: todo
description: The work queue, kept by a script. Use when the user asks to work on, add or review todos, says "next todo", or when work must wait for a trigger.
---

# Todos: work the queue through the script

`todos/` and `todo-archive.md` are the script's data. **Never read or edit them
directly** (the settings deny it); always go through the script, so the queue costs
almost no tokens.

## 1. Commands

Run from the repo root (`T` below stands for `node .claude/skills/todo/scripts/todo.mjs`):

| Command | What it does |
| :--- | :--- |
| `T next` | The best eligible item as its raw line, or `none` |
| `T list [-p N] [--tag X] [--all]` | Eligible items; `--all` adds blocked ones, marked `*` |
| `T show T-XXX` | The item's line, then its detail text if any |
| `T add 'text' [-p 1-3] [--dep T-A,T-B] [--size S\|M\|L] [--tag a,b]` | Creates an item; prints only the new ID |
| `T set T-XXX [-p 1-3] [--dep T-A,T-B\|-] [--size S\|M\|L\|-]` | Changes priority, deps or size, keeping the ID |
| `T edit T-XXX 'new text'` | Replaces the item's one-line description |
| `T tag T-XXX a,b` | Replaces an item's tags (`-` clears) |
| `T detail T-XXX 'text'` or `--file path` (`-`: stdin) [`--append`] | Sets the item's detail text (replaces it unless `--append`) |
| `T stats` | Counts by priority and size, with bars, and done this week |
| `T graph` | Dependency tree: each ready item with what waits on it; cycles last |
| `T html [--out file]` | Self-contained HTML board with light and dark colors |
| `T done T-XXX` | Removes and archives the line; prints `unblocked: ...` for items it fully freed |
| `T rm T-XXX` | Removes it without archiving (obsolete) |
| `T migrate` | Converts an old single-file `todo.md`, also mid-rebase (see section 4) |

Line format: `ID | P | dep | size | tags | description`.

- **Deps:** one ID, several comma-separated (`T-025,T-k7q3`), or `-`. An item is
  eligible only when *none* of its deps are still open. A dep that isn't open
  counts as done (a dep found nowhere also prints a typo warning). A cycle is
  refused. `list` shows only the deps still open; `done`/`rm` print `unblocked:`
  only for items with no deps left.
- **IDs** are random: `T-` plus 4 characters (`T-k7q3`), never reused, checked
  against every open and archived ID. Old numeric IDs (`T-017`) stay valid. IDs are
  case-insensitive to type.
- **Tags:** lowercase only (others are rejected), comma-separated, `-` for none. Area
  tags: devops, infra, frontend, backend, full-stack, docs, admin. Game slugs
  (`ftw`, `cocounsel`, `nighthighway`, `buzzerquiz`, `wordscramble`, `regions`,
  `borderrun`, `lasthop`) are valid tags too.
- **Detail text:** `done` and `rm` delete it with the item. The archive keeps only
  the one-line entry, so put anything worth keeping in the code or commit.
- **Color** is for humans only: it turns on in a terminal (`--pretty`, `--color=always`,
  or `FORCE_COLOR`), and `--pretty` overrides `NO_COLOR`. Piped output, which is what
  Claude gets, is always plain, so don't pass color flags.
- `next` picks the lowest P, then the oldest item, among eligible items.
- **Quote text with single quotes.** Inside double quotes, Bash runs text between
  backticks as a command, and PowerShell drops the backticks. For text with an
  apostrophe, send it on stdin: `T detail <ID> --file - <<'EOF'`, the text, then `EOF`
  (Bash); in PowerShell, write each apostrophe twice inside single quotes.

## 2. Working a todo

1. Run `T next`.
2. If the item may have detail text, run `T show <id>`.
3. If size is L, or the description is vague, outline a plan and confirm with the user before editing.
4. Do the work. Keep the change focused on that one todo.
5. Run `T done <id>`.
6. Run `T add ...` for any follow-up work discovered, instead of expanding scope.
7. Report in 1-2 sentences, then stop. Don't start the next todo unless the user asked for a batch.

## 3. Deferred work

Work that waits on something ("when X ships, do Y") is a todo, not a note in chat:

    T add '<what>' --tag <area>
    T detail <ID> 'Trigger: <X>. Do: <Y>. Why: <reason>.'

The detail must stand alone: whoever picks it up won't have this conversation. Before
finishing any task, `T list --all` and look for todos the work just triggered.

## 4. Parallel worktrees

Several agents work at once, each in its own worktree. The queue is built so their
branches merge cleanly:

- **One file per todo** (`todos/<ID>.md`). Two branches that add, edit or finish
  *different* todos touch different files. Only the same todo changed on both sides
  conflicts, and that is a real conflict: keep the right version by hand.
- **Random IDs** need no shared counter, so two worktrees never hand out the same one.
- **`todo-archive.md`** only ever gets lines appended, and `.gitattributes` merges it
  with `merge=union`, so both branches' `done` lines stay.

**A branch from before this format** (its `todo.md` still lists todos) is migrated
*during* its rebase onto `main`, with `T migrate` at each conflict stop. The
procedure, and what `migrate` does with clashing IDs, is in `reference.md` (next to
this file).
