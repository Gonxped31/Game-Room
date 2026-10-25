import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// The todo script (.claude/skills/todo/scripts/todo.mjs) run against a scratch folder
// (TODO_ROOT), plus real git repos for the parallel-worktree cases it exists for.

const SCRIPT = path.resolve(__dirname, "../../.claude/skills/todo/scripts/todo.mjs");
const roots: string[] = [];

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-"));
  roots.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function todo(root: string, args: string[], ids?: string[]) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, TODO_ROOT: root, TODO_TEST_IDS: ids?.join(",") ?? "", NO_COLOR: "1", FORCE_COLOR: "" },
  });
  return { out: res.stdout.trim(), err: res.stderr.trim(), status: res.status };
}
const write = (root: string, file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (root: string, file: string) => fs.existsSync(path.join(root, file));
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function repo() {
  const dir = scratch();
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "core.autocrlf", "false");
  write(dir, ".gitattributes", "todo-archive.md merge=union\n");
  return dir;
}
const commitAll = (dir: string, msg: string) => {
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", msg);
};

describe("add", () => {
  it("creates one file per todo, with a random 4-character ID and a created time", () => {
    const root = scratch();
    const { out, status } = todo(root, ["add", "Write the docs", "-p", "1", "--size", "S", "--tag", "docs"]);
    expect(status).toBe(0);
    expect(out).toMatch(/^T-[23456789abcdefghjkmnpqrstuvwxyz]{4}$/);
    const lines = read(root, `todos/${out}.md`).split("\n");
    expect(lines[0]).toBe(`${out} | 1 | - | S | docs | Write the docs`);
    expect(lines[1]).toMatch(/^created: \d{4}-\d\d-\d\dT/);
    expect(exists(root, "todo.md")).toBe(false);
    expect(exists(root, ".todo-last-id")).toBe(false);
  });

  it("never reuses an ID that is open or archived", () => {
    const root = scratch();
    write(root, "todo-archive.md", "T-aaaa | 2 | - | S | - | old | done 2026-01-01\n");
    expect(todo(root, ["add", "one"], ["bbbb"]).out).toBe("T-bbbb");
    expect(todo(root, ["add", "two"], ["aaaa", "bbbb", "cccc"]).out).toBe("T-cccc");
  });
});

describe("the queue", () => {
  it("picks by priority, then the oldest (old numeric todos first)", () => {
    const root = scratch();
    write(root, "todos/T-017.md", "T-017 | 2 | - | S | - | old numeric\n");
    todo(root, ["add", "newer", "-p", "2"], ["zzzz"]);
    todo(root, ["add", "urgent", "-p", "1"], ["aaaa"]);
    expect(todo(root, ["next"]).out).toBe("T-aaaa | 1 | - | - | - | urgent");
    todo(root, ["done", "T-aaaa"]);
    expect(todo(root, ["next"]).out).toBe("T-017 | 2 | - | S | - | old numeric");
  });

  it("edits keep the detail text; done archives the line, deletes the file and reports what it unblocked", () => {
    const root = scratch();
    todo(root, ["add", "first"], ["aaaa"]);
    todo(root, ["add", "second", "--dep", "t-AAAA"], ["bbbb"]);
    todo(root, ["detail", "T-aaaa", "Some context."]);
    todo(root, ["edit", "T-aaaa", "first, reworded"]);
    todo(root, ["set", "T-aaaa", "-p", "1"]);
    expect(todo(root, ["show", "T-aaaa"]).out).toBe("T-aaaa | 1 | - | - | - | first, reworded\nSome context.");
    expect(todo(root, ["list"]).out).toBe("T-aaaa | 1 | - | - | - | first, reworded");

    expect(todo(root, ["done", "T-aaaa"]).out).toBe("unblocked: T-bbbb");
    expect(exists(root, "todos/T-aaaa.md")).toBe(false);
    expect(read(root, "todo-archive.md")).toMatch(/^T-aaaa \| 1 \| - \| - \| - \| first, reworded \| done \d{4}-\d\d-\d\d$/m);
    expect(todo(root, ["list"]).out).toBe("T-bbbb | 2 | - | - | - | second");
  });
});

describe("migrate", () => {
  it("turns todo.md and its detail files into one file per todo", () => {
    const root = scratch();
    write(root, "todo.md", "# ID | P(1-3) | dep | size(S/M/L/-) | tags(a,b or -) | description\nT-016 | 3 | - | S | infra | Second Firebase project\nT-017 | 3 | T-016 | S | frontend | Real iPhone check\n");
    write(root, ".todo-last-id", "17");
    write(root, "todos/T-017.md", "Trigger: someone has an iPhone.\n");
    expect(todo(root, ["migrate"]).out).toBe("migrated 2 todos");
    expect(read(root, "todos/T-016.md")).toBe("T-016 | 3 | - | S | infra | Second Firebase project\n");
    expect(read(root, "todos/T-017.md")).toBe("T-017 | 3 | T-016 | S | frontend | Real iPhone check\n\nTrigger: someone has an iPhone.\n");
    expect(read(root, "todo.md")).toMatch(/^# The todo queue moved/);
    expect(exists(root, ".todo-last-id")).toBe(false);
    expect(todo(root, ["list", "--all"]).out).toBe("T-016 | 3 | - | S | infra | Second Firebase project\n*T-017 | 3 | T-016 | S | frontend | Real iPhone check");
  });

  it("reports lines it can't read instead of dropping them silently", () => {
    const root = scratch();
    write(root, "todo.md", "T-021 | - | - | M | Room cleanup function\nT-024 | 2 | - | M | backend | Room cleanup function\n");
    expect(todo(root, ["migrate"]).out).toBe("migrated 1 todo:\n  not a todo line, left out: T-021 | - | - | M | Room cleanup function");
  });

  it("gives a clashing todo a new ID, moves its detail and updates the deps that point at it", () => {
    const root = scratch();
    write(root, "todos/T-055.md", "T-055 | 3 | - | S | nighthighway | Night Highway hub cards\n");
    write(root, "todo.md", "T-055 | 1 | - | M | admin | Admin foundation: firebase-admin, password login\nT-056 | 1 | T-055 | M | admin | Admin dashboard\n");
    write(root, "todos/T-056.md", "Needs the admin login.\n");
    const { out } = todo(root, ["migrate"], ["k7q3"]);
    expect(out).toContain("T-055 -> T-k7q3");
    expect(read(root, "todos/T-055.md")).toBe("T-055 | 3 | - | S | nighthighway | Night Highway hub cards\n");
    expect(read(root, "todos/T-k7q3.md")).toBe("T-k7q3 | 1 | - | M | admin | Admin foundation: firebase-admin, password login\n");
    expect(read(root, "todos/T-056.md")).toBe("T-056 | 1 | T-k7q3 | M | admin | Admin dashboard\n\nNeeds the admin login.\n");
  });

  it("keeps the ID of the same todo edited on the other side", () => {
    const root = scratch();
    write(root, "todos/T-017.md", "T-017 | 3 | - | S | frontend | Real iPhone check: Same Page drag and the sticky dock\n");
    write(root, "todo.md", "T-017 | 3 | - | S | frontend | Real iPhone check: FTW hand cards and the sticky dock\n");
    const { out } = todo(root, ["migrate"]);
    expect(out).toContain("T-017: kept todos/T-017.md");
    expect(fs.readdirSync(path.join(root, "todos"))).toEqual(["T-017.md"]);
  });

  /**
   * An old-format branch (two commits touch todo.md, one adds a detail file) and a main
   * that migrated meanwhile, where T-055 is another todo: the old counter's collision.
   * `more` adds commits to the old branch before main moves on.
   */
  function oldBranchAndMigratedMain(more: (dir: string) => void = () => {}) {
    const dir = repo();
    write(dir, "todo.md", "T-054 | 1 | - | S | devops | Fix the lockfile\n");
    write(dir, ".todo-last-id", "54");
    commitAll(dir, "base");

    git(dir, "switch", "-qc", "old-branch");
    write(dir, "todo.md", "T-054 | 1 | - | S | devops | Fix the lockfile\nT-055 | 1 | - | M | admin | Admin foundation\n");
    write(dir, ".todo-last-id", "55");
    write(dir, "todos/T-055.md", "Password login, signed cookie.\n");
    commitAll(dir, "old branch adds T-055");
    write(dir, "todo.md", "T-054 | 1 | - | S | devops | Fix the lockfile\nT-055 | 1 | - | M | admin | Admin foundation\nT-056 | 2 | T-055 | M | admin | Admin dashboard\n");
    write(dir, ".todo-last-id", "56");
    commitAll(dir, "old branch adds T-056");
    more(dir);

    git(dir, "switch", "-q", "main");
    todo(dir, ["migrate"]);
    write(dir, "todos/T-055.md", "T-055 | 3 | - | S | nighthighway | Night Highway hub cards\n");
    commitAll(dir, "main migrates and has its own T-055");
    git(dir, "switch", "-q", "old-branch");
    return dir;
  }

  /** The documented recipe: rebase; at each stop (todo.md conflicts with main's stub) migrate, stage, continue. */
  function rebaseWithMigrate(dir: string) {
    const outputs: string[] = [];
    let rebasing = spawnSync("git", ["rebase", "main"], { cwd: dir, encoding: "utf8" }).status !== 0;
    while (rebasing) {
      outputs.push(todo(dir, ["migrate"], ["admn"]).out);
      git(dir, "add", "-A", "todos", "todo.md");
      git(dir, "rm", "-q", "--ignore-unmatch", ".todo-last-id");
      rebasing = spawnSync("git", ["-c", "core.editor=true", "rebase", "--continue"], { cwd: dir, encoding: "utf8" }).status !== 0;
      expect(outputs.length).toBeLessThan(6);
    }
    expect(git(dir, "status", "--porcelain")).toBe("");
    return outputs;
  }

  it("migrates an old branch mid-rebase, commit by commit, without losing or duplicating its todos", () => {
    const dir = oldBranchAndMigratedMain();
    const outputs = rebaseWithMigrate(dir);
    expect(outputs.length).toBe(2);
    expect(outputs[0]).toContain("T-055 -> T-admn");
    expect(todo(dir, ["list", "--all"]).out).toBe(
      "T-054 | 1 | - | S | devops | Fix the lockfile\nT-admn | 1 | - | M | admin | Admin foundation\n*T-056 | 2 | T-admn | M | admin | Admin dashboard\nT-055 | 3 | - | S | nighthighway | Night Highway hub cards",
    );
    expect(todo(dir, ["show", "T-admn"]).out).toBe("T-admn | 1 | - | M | admin | Admin foundation\nPassword login, signed cookie.");
    expect(read(dir, "todo.md")).toMatch(/^# The todo queue moved/);
    expect(exists(dir, ".todo-last-id")).toBe(false);
  });

  it("keeps todos the old branch finished finished, even under their new ID", () => {
    const dir = oldBranchAndMigratedMain((d) => {
      // The old script's `done T-055`: the line leaves todo.md, the detail file goes, the archive grows.
      write(d, "todo.md", "T-054 | 1 | - | S | devops | Fix the lockfile\nT-056 | 2 | T-055 | M | admin | Admin dashboard\n");
      fs.rmSync(path.join(d, "todos/T-055.md"));
      write(d, "todo-archive.md", "T-055 | 1 | - | M | admin | Admin foundation | done 2026-10-24\n");
      commitAll(d, "old branch finishes T-055");
    });
    const outputs = rebaseWithMigrate(dir);
    expect(outputs.length).toBe(3);
    expect(outputs[2]).toContain("T-admn: finished or removed by this commit");
    expect(exists(dir, "todos/T-admn.md")).toBe(false);
    expect(todo(dir, ["list", "--all"]).out).toBe(
      "T-054 | 1 | - | S | devops | Fix the lockfile\nT-056 | 2 | - | M | admin | Admin dashboard\nT-055 | 3 | - | S | nighthighway | Night Highway hub cards",
    );
    expect(read(dir, "todo-archive.md")).toContain("Admin foundation | done 2026-10-24");
  });
});

describe("parallel worktrees", () => {
  it("two branches adding and finishing todos rebase without conflicts", () => {
    const dir = repo();
    todo(dir, ["add", "shared one"], ["aaaa"]);
    todo(dir, ["add", "shared two"], ["bbbb"]);
    commitAll(dir, "base");

    git(dir, "switch", "-qc", "a");
    todo(dir, ["add", "from a"], ["cccc"]);
    todo(dir, ["done", "T-aaaa"]);
    commitAll(dir, "a");

    git(dir, "switch", "-q", "main");
    git(dir, "switch", "-qc", "b");
    todo(dir, ["add", "from b"], ["dddd"]);
    todo(dir, ["done", "T-bbbb"]);
    commitAll(dir, "b");

    git(dir, "switch", "-q", "a");
    git(dir, "rebase", "-q", "b");
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(todo(dir, ["list"]).out.split("\n").map((l) => l.split(" | ")[0]).sort()).toEqual(["T-cccc", "T-dddd"]);
    const archived = read(dir, "todo-archive.md");
    expect(archived).toContain("T-aaaa |");
    expect(archived).toContain("T-bbbb |");
  });
});
