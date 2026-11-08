# Todo: migrating a branch from the old single-file queue

**A branch from before the one-file-per-todo format** (its `todo.md` still lists
todos) is migrated *during* its rebase onto `main`. `main` keeps a short stub
`todo.md`, so each of the branch's commits that touched the old queue stops with a
conflict in it. At every such stop:

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
