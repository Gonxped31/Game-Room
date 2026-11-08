// Fast-forwards main to the branch checked out here, once its checks pass. The only way main
// moves (git skill): run it from the branch's checkout, after the user approves the merge.
// Usage: node scripts/merge.mjs [branch]   (if given, it must be the branch checked out here)
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = "main";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}
function fail(message) {
  console.error(`merge: ${message}`);
  process.exit(1);
}

/** The worktree that has `branch` checked out, or null. */
function worktreeOf(branch) {
  let dir = null;
  for (const line of git("worktree", "list", "--porcelain").split("\n")) {
    if (line.startsWith("worktree ")) dir = line.slice("worktree ".length);
    else if (line === `branch refs/heads/${branch}`) return dir;
  }
  return null;
}

const branch = tryGit("symbolic-ref", "--short", "-q", "HEAD");
if (!branch) fail("HEAD is detached; check out the branch to merge");
if (branch === MAIN) fail(`this checkout is on ${MAIN}; run this from the branch to merge`);
const named = process.argv[2];
if (named && named !== branch) fail(`${named} isn't checked out here (${branch} is); run this from ${named}'s checkout`);
if (tryGit("rev-parse", "--verify", "-q", `refs/heads/${MAIN}`) === null) fail(`there's no ${MAIN} branch`);
if (git("status", "--porcelain", "--untracked-files=no")) fail("uncommitted changes; commit them first");

const base = git("rev-parse", MAIN);
const tip = git("rev-parse", "HEAD");
if (base === tip) fail(`${branch} has nothing that ${MAIN} doesn't`);
if (tryGit("merge-base", "--is-ancestor", MAIN, "HEAD") === null) {
  fail(`${branch} isn't on top of ${MAIN}: git rebase ${MAIN}, then run this again`);
}

// The checks run on exactly what main is about to become.
const check = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check.mjs")], { cwd: ROOT, stdio: "inherit" });
if (check.status !== 0) fail(`checks failed; ${MAIN} is unchanged`);

// Where main is checked out (usually the main checkout, when this is a worktree), fast-forward
// it there so its files follow. Otherwise move the ref alone, guarded by its old value.
const mainTree = worktreeOf(MAIN);
if (mainTree) {
  const r = spawnSync("git", ["merge", "--ff-only", "-q", tip], { cwd: mainTree, encoding: "utf8" });
  if (r.status !== 0) fail(`couldn't fast-forward ${MAIN} in ${mainTree}:\n${(r.stderr || r.stdout).trim()}`);
} else {
  git("update-ref", "-m", `merge.mjs: fast-forward to ${branch}`, `refs/heads/${MAIN}`, tip, base);
}
const count = Number(git("rev-list", "--count", `${base}..${tip}`));
console.log(`merged ${branch} into ${MAIN}: ${count} commit${count === 1 ? "" : "s"} (${base.slice(0, 7)}..${tip.slice(0, 7)})`);

// The branch is done: leave it and delete it. If main is checked out elsewhere, this checkout
// can't switch to it, so say how to finish instead.
const isWorktree = path.resolve(ROOT, git("rev-parse", "--git-dir")) !== path.resolve(ROOT, git("rev-parse", "--git-common-dir"));
if (!mainTree) {
  if (tryGit("switch", "-q", MAIN) !== null && tryGit("branch", "-q", "-d", branch) !== null) {
    console.log(`deleted ${branch}; this checkout is on ${MAIN}`);
  } else {
    console.log(`couldn't switch this checkout to ${MAIN}; ${branch} is kept`);
  }
} else if (isWorktree) {
  console.log(`this worktree is done: cd "${mainTree}" && git worktree remove "${ROOT}" && git branch -d ${branch}`);
} else {
  console.log(`${MAIN} is checked out in ${mainTree}; switch this checkout off ${branch}, then: git branch -d ${branch}`);
}
const remote = tryGit("remote")?.split("\n")[0];
if (remote) console.log(`${remote}: push ${MAIN} once the user agrees (git push ${remote} ${MAIN})`);
