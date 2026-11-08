---
name: git
description: Branching, committing, rebasing, pushing and merging. Use when starting work, committing, rebasing, pushing or merging into main. One branch per task, files staged by name, main only with approval.
---

# Git: branch, rebase, push, merge with approval

`main` is production: **every push or merge to `main` auto-deploys on Vercel.**
`main` moves only through `node scripts/merge.mjs`, after the user approves. The
pre-commit hook (`.githooks/pre-commit`) refuses commits on `main` and runs
`node scripts/check.mjs --fast`. A Claude hook (`scripts/hooks/guard-commands.mjs`)
refuses `--no-verify` and bulk staging, and asks before merges, pushes and commands
that discard work.

## 1. Start every new task on a new branch

- `git fetch origin`, then `git switch -c <branch> origin/main`. Names: short
  kebab-case `<area>-<topic>`, todo ID first when there is one
  (`t-054-lockfile`, `nighthighway-fog`, `docs-git-skill`).
- Follow-ups to the same task stay on its branch. Never commit on `main`.
- The user may be working in the same checkout. If it's on a branch of theirs
  (or has their uncommitted changes), don't switch it: work in a worktree,
  `git worktree add <scratchpad>/<branch> -b <branch> origin/main`, and remove
  it after the merge.
  - A worktree has no installed dependencies: run `npm ci` in it. Never link
    `node_modules` from the main checkout: removing the worktree deletes what the
    link points to.

## 2. Commit on the branch (no approval needed)

0. `git branch --show-current` must print your branch. If it doesn't, someone
   switched the checkout: stop, don't commit, and tell the user.
1. Run the checks CLAUDE.md requires for the change (`node scripts/check.mjs` at
   least). While CI only runs on manual dispatch (T-054), these are the only gate.
2. `git status --short`. Stage the paths you changed **by name**; never
   `git add -A` or `git add .`. The user edits `references/` at the same time:
   leave out files you didn't touch and mention them instead.
3. One logical change per commit, in the house style (`reference.md`). Todo
   changes (made through the todo script) go in the same commit as the work.
4. If the hook fails, fix what it reports. Never get around it.

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

1. Rebase and push (step 3), with `node scripts/check.mjs` passing, plus
   `ui-review`/`live-test` if the change needs them.
2. Ask, stating: the branch, its commits (`git log --oneline origin/main..HEAD`),
   the checks run, and anything that follows the deploy (a rules deploy,
   existing rooms affected).
3. Once approved, make local `main` equal `origin/main`: `git fetch origin`, then
   fast-forward the main checkout (`git -C <main checkout> merge --ff-only
   origin/main`). If `main` moved, rebase the branch (step 3) and ask again if
   that changed anything beyond your branch's own commits.
4. From the branch's checkout: `node scripts/merge.mjs <branch>`. It refuses unless
   the tree is clean, the branch is on top of `main` and the checks pass; then it
   fast-forwards `main` and deletes the branch (from a worktree, it prints how to
   remove the worktree instead).
5. Once the user agrees (approving the merge covers it): `git push origin main`,
   then delete the remote branch: `git push origin --delete <branch>`.
6. Rules changes: deploy the rules only after Vercel finishes, and ask first
   (`database-rules` skill).

## Never

- Commit or push straight to `main`, move it by hand, or force-push it.
- `reset --hard`, `checkout -- <file>`, `restore <file>`, `clean`, `stash drop`,
  `branch -D`, or deleting an unmerged branch without asking. Undo pushed work
  with `git revert`.
- `--no-verify`, or committing `package-lock.json` changes the task didn't need.

Commit messages, special files, recovery recipes: `reference.md`.
