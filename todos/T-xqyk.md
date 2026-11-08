T-xqyk | 3 | T-054 | - | devops | Run agk github: adds the kit github skill and scripts/ci.mjs to the existing GitHub repo
created: 2026-11-08T07:50:18.912Z

Trigger: once T-054 restores CI (the lockfile fixed, ci.yml back on push and pull_request instead of manual dispatch).
Do: run `agk github` in the repo, on its own branch. Merge any .kit files it leaves next to .github/workflows/ci.yml (and anything else it would overwrite) into the repo's own versions, keeping the repo's CI steps (lint, tsc, npm test, npm run test:rules on the emulator). Delete each .kit file once merged, then run node scripts/doctor.mjs.
Why: Claude reads CI runs through scripts/ci.mjs (one line per failure) instead of raw logs, and the github skill tells it to check CI after every push. The repo is already on GitHub (origin) with its own CI, so agk setup skipped this.
