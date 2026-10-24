# Git reference

## Commit messages

```
<Area>: <what is now true, or what changed> (T-XXX)

Why the change was needed and anything a reader can't see in the diff,
wrapped at about 72 columns. Bullets when the change has several parts.

Co-Authored-By: <the trailer the session gives>
```

- **Area** is the game or part touched: `Night Highway`, `Word Scramble`,
  `Hub`, `Rules`, `CI`, `Lockfile`, `Todo queue`, `References`, `Docs`.
- The subject describes the result, not a command: `Night Highway: no freeze
  when a race's countdown starts (T-033)`, `Word Scramble: steals, no repeated
  words, fair word lengths`.
- Add the todo ID in parentheses when the commit works one.
- Say what was *not* verified when that matters (`Not verified against CI's
  Linux npm yet`).

## Files that need care when staging

| Path | Rule |
| :--- | :--- |
| `references/` | The user edits it concurrently. Commit only what you changed. |
| `AGENTS.md` Next.js block | `next dev` re-adds it; commit it with your work (see the file). |
| `package-lock.json` | Windows npm drops Linux optional entries (T-054). Commit it only when the task changed dependencies, and say so. |
| `todo.md`, `todos/`, `.todo-last-id` | Changed only by the todo script; commit them with the work they track. |
| Night Highway's generated engine | Kept in git; commit regenerated output with the change that caused it. |
| `*-debug.log`, `.next/`, screenshots | Ignored or scratch; never commit them. |

## Recovery

| Situation | Do |
| :--- | :--- |
| Committed on `main` by mistake, not pushed | `git switch -c <branch>`, then `git switch main && git reset --keep origin/main` (ask first). |
| Something reached `main` that shouldn't have | `git revert <sha>` on a branch, then the normal merge with approval. Never rewrite `main`. |
| Rebase went wrong mid-way | `git rebase --abort`; the branch is back where it was. |
| Rebase finished but the result is wrong | `git reflog` to find the pre-rebase commit; ask before `reset` to it. |
| Autostash didn't apply cleanly | Leave the stash in place (`git stash list`), tell the user. Never `stash drop` someone else's changes. |
| Push refused after a rebase | `git push --force-with-lease` (your branch only). If that refuses too, someone else pushed: fetch and look before anything else. |

## Reporting

After a commit, push or merge, report: the branch, the commit hashes and
subjects, what was left unstaged and why, and what's next (merge approval
needed, a rules deploy, todos the work triggers).
