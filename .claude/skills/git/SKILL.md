---
name: git
description: Use when starting work, committing, rebasing, pushing or merging into main. One branch per task, rebase onto main, push the branch, merge only with approval.
---

# Git: branch, rebase, push, merge with approval

`main` is production: **every push or merge to `main` auto-deploys on Vercel.**

## 1. Start every new task on a new branch

- `git fetch origin`, then `git switch -c <branch> origin/main`. Names: short
  kebab-case `<area>-<topic>`, todo ID first when there is one
  (`t-054-lockfile`, `nighthighway-fog`, `docs-git-skill`).
- Follow-ups to the same task stay on its branch. Never commit on `main`.
- The user may be working in the same checkout. If it's on a branch of theirs
  (or has their uncommitted changes), don't switch it: work in a worktree,
  `git worktree add <scratchpad>/<branch> -b <branch> origin/main`, and remove
  it after the merge.

## 2. Commit on the branch (no approval needed)

0. `git branch --show-current` must print your branch. If it doesn't, someone
   switched the checkout: stop, don't commit, and tell the user.
1. Run the checks CLAUDE.md requires for the change (`./scripts/check` at least).
   While CI only runs on manual dispatch (T-054), these are the only gate.
2. `git status --short`. Stage the paths you changed **by name**; never
   `git add -A` or `git add .`. The user edits `references/` at the same time:
   leave out files you didn't touch and mention them instead.
3. One logical change per commit, in the house style (`reference.md`). Todo
   changes (made through the todo script) go in the same commit as the work.

## 3. Rebase onto main after every commit, then push

```bash
git fetch origin
git rebase --autostash origin/main
git push -u origin <branch>            # first push
git push --force-with-lease            # after a rebase rewrote pushed commits
```

- Push only right after a successful rebase. `--force-with-lease` is fine on
  your own work branch, **never on `main`**.
- On a conflict: resolve it if the intent of both sides is clear, rerun the
  checks, `git rebase --continue`. Otherwise `git rebase --abort` and ask.

## 4. Merge into main: only with the user's approval

1. Rebase and push (step 3), with the checks green, plus `ui-review`/`live-test`
   if the change needs them.
2. Ask, stating: the branch, its commits, the checks run, and anything
   that follows the deploy (a rules deploy, existing rooms affected).
3. Once approved (that covers the push to `main` too):
   ```bash
   git switch main && git pull --ff-only
   git merge --ff-only <branch> && git push origin main
   git branch -d <branch> && git push origin --delete <branch>
   ```
   If `--ff-only` refuses, `main` moved: go back to the branch, rebase, and ask
   again if the rebase changed anything beyond your branch's own commits.
4. Rules changes: deploy the rules only after Vercel finishes, and ask first
   (`database-rules` skill).

## Never

- Commit or push straight to `main`, or force-push it.
- `reset --hard`, `checkout -- <file>`, `clean`, `stash drop`, or deleting an
  unmerged branch without asking. Undo pushed work with `git revert`.
- `--no-verify`, or committing `package-lock.json` changes the task didn't need.

Commit messages, special files, recovery recipes: `reference.md`.
