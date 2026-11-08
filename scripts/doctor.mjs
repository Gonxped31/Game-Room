// Checks the agent setup: size limits, dead paths, unfilled placeholders, hooks turned on, and
// the kit's versions of files (<file>.kit) still to merge.
// Prints one line per problem, then OK or FAIL. The limits are the agent-setup skill's:
// change them here, with the reason in the commit.
// Usage: node scripts/doctor.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMITS = {
  rootWords: 800, // the root CLAUDE.md: in context on every turn
  nestedWords: 400, // a folder's CLAUDE.md: loaded when the agent works in that folder
  descriptionWords: 30, // a skill's description: in context in every session
  skillLines: 100, // a SKILL.md: loaded when the skill is used
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const words = (text) => text.split(/\s+/).filter(Boolean).length;

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/** A frontmatter field's value, including folded (`>`) and indented continuation lines. */
function field(front, key) {
  const lines = front.split("\n");
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return undefined;
  let value = lines[i].slice(key.length + 1).trim().replace(/^[>|][-+]?$/, "");
  for (const l of lines.slice(i + 1)) {
    if (!/^\s/.test(l)) break;
    value += ` ${l.trim()}`;
  }
  return value.trim().replace(/^(["'])(.*)\1$/, "$2");
}

/** The lines outside fenced code blocks, with their line numbers. */
function proseLines(text) {
  let fenced = false;
  const out = [];
  text.split("\n").forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced) out.push({ line, n: i + 1 });
  });
  return out;
}

// Tracked and untracked-but-not-ignored files, so dependencies and build output are never walked.
const listed = git("ls-files", "-z", "--cached", "--others", "--exclude-standard");
if (listed === null) problems.push("not a git repository");
const files = (listed ?? "").split("\0").filter((f) => f && exists(f));
const markdown = files.filter((f) => f.endsWith(".md"));
const isInstructions = (f) => path.posix.basename(f) === "CLAUDE.md";

// ---- CLAUDE.md files: size, placeholders, @-imports
if (!exists("CLAUDE.md")) problems.push("CLAUDE.md: missing at the root");
for (const f of markdown.filter(isInstructions)) {
  const text = read(f);
  const max = f === "CLAUDE.md" ? LIMITS.rootWords : LIMITS.nestedWords;
  const n = words(text);
  if (n > max) problems.push(`${f}: ${n} words (max ${max}); move detail into a skill, a folder's CLAUDE.md or docs/`);
  const placeholder = /\{\{[^}]*\}\}/.exec(text);
  if (placeholder) problems.push(`${f}: unfilled placeholder ${placeholder[0]}`);
  for (const { line, n: ln } of proseLines(text)) {
    if (/(^|\s)@[^\s@]*[/.][^\s@]*/.test(line.replace(/`[^`]*`/g, ""))) {
      problems.push(`${f}:${ln}: an @-import loads that file on every turn; name the path in backticks instead`);
    }
  }
}

// ---- Skills: frontmatter, description, size
const skillsDir = path.join(ROOT, ".claude", "skills");
const skillNames = fs.existsSync(skillsDir)
  ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
let descriptionWords = 0;
for (const name of skillNames) {
  const rel = `.claude/skills/${name}/SKILL.md`;
  if (!exists(rel)) {
    problems.push(`${rel}: missing`);
    continue;
  }
  const text = read(rel).trimEnd();
  const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
  if (front === undefined) {
    problems.push(`${rel}: no frontmatter (name, description)`);
    continue;
  }
  const declared = field(front, "name");
  if (declared !== name) problems.push(`${rel}: name is "${declared ?? ""}", must be "${name}" (its folder)`);
  const description = field(front, "description") ?? "";
  const n = words(description);
  descriptionWords += n;
  if (!n) problems.push(`${rel}: no description`);
  else if (n > LIMITS.descriptionWords) problems.push(`${rel}: description is ${n} words (max ${LIMITS.descriptionWords})`);
  else if (!/\buse (when|whenever|before|after|for)\b/i.test(description)) problems.push(`${rel}: description must say when to use it ("Use when ...")`);
  const lines = text.split("\n").length;
  if (lines > LIMITS.skillLines) problems.push(`${rel}: ${lines} lines (max ${LIMITS.skillLines}); move reference into files next to it`);
}

// ---- Paths named in agent docs must exist
/**
 * Reports a path that doesn't exist. Links are always checked. A code span can be anything
 * (`origin/main`, `user.name`), so it counts as a path only when it has a slash and its first
 * folder exists next to the file or at the root.
 */
function checkPath(from, n, raw, isLink) {
  const p = raw.replace(/[#?].*$/, "").replace(/:\d+(:\d+)?$/, "");
  if (!p || /^[a-z][a-z0-9+.-]*:/i.test(p) || /[\s<>*{}$|"'`()=\\]/.test(p) || /^[~-]/.test(p)) return;
  const rel = p.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!rel) return;
  const bases = p.startsWith("/") ? [""] : [path.posix.dirname(from), ""];
  if (bases.some((b) => exists(path.posix.join(b, rel)))) return;
  const first = rel.split("/")[0];
  const anchored = isLink || (rel.includes("/") && bases.some((b) => exists(path.posix.join(b, first))));
  if (anchored) problems.push(`${from}:${n}: ${raw} doesn't exist`);
}

const scanned = markdown.filter((f) => isInstructions(f) || f.startsWith(".claude/") || f.startsWith("docs/"));
for (const f of scanned) {
  for (const { line, n } of proseLines(read(f))) {
    for (const [, span] of line.matchAll(/`([^`]+)`/g)) for (const token of span.split(/\s+/)) checkPath(f, n, token, false);
    for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) checkPath(f, n, target, true);
  }
}

// ---- Hooks: the git hooks are on, and every Claude hook script exists
// A CI checkout never turns the hooks on, and needn't: CI runs the checks itself. CI services set CI.
const inCI = Boolean(process.env.CI) && !/^(false|0)$/i.test(process.env.CI);
if (!inCI && git("config", "core.hooksPath")?.trim() !== ".githooks") {
  problems.push("git hooks are off in this clone: git config core.hooksPath .githooks");
}
let settings = {};
try {
  settings = JSON.parse(read(".claude/settings.json"));
} catch (e) {
  problems.push(`.claude/settings.json: ${e.code === "ENOENT" ? "missing" : e.message}`);
}
for (const entries of Object.values(settings.hooks ?? {})) {
  for (const { hooks = [] } of entries) {
    for (const { command = "" } of hooks) {
      for (const [, rel] of command.matchAll(/\$CLAUDE_PROJECT_DIR\/([^"'\s]+)/g)) {
        if (!exists(rel)) problems.push(`.claude/settings.json: hook script ${rel} doesn't exist`);
      }
    }
  }
}

// ---- The kit's versions of files the repo has its own of (agk setup, agk update), still to merge
if (exists(".claude/agk.json")) {
  let kitFiles = [];
  try {
    kitFiles = Object.keys(JSON.parse(read(".claude/agk.json")).files ?? {});
  } catch (e) {
    problems.push(`.claude/agk.json: ${e.message}`);
  }
  for (const f of kitFiles.filter((f) => exists(`${f}.kit`))) {
    problems.push(`${f}.kit: the kit's version of ${f}. Merge what's new in it into ${f}, then delete it`);
  }
}

for (const p of problems) console.log(p);
const always = (exists("CLAUDE.md") ? words(read("CLAUDE.md")) : 0) + descriptionWords;
console.log(
  problems.length
    ? "FAIL"
    : `OK (always in context: CLAUDE.md + ${skillNames.length} skill descriptions, ~${always} words)`,
);
process.exit(problems.length ? 1 : 0);
