// Minimal todo tracker. The script does the bookkeeping so nobody reads todo.md.
//
//   node .claude/skills/todo/scripts/todo.mjs <command> [args]
//
//   add "text" [-p 1-3] [--dep T-A,T-B] [--size S|M|L] [--tag a,b]   append; prints the new ID
//   next                                              best eligible line, or "none"
//   list [-p N] [--tag X] [--all]                     eligible items; --all adds blocked (*)
//   set T-XXX [-p N] [--dep T-A,T-B|-] [--size S|M|L|-]   change priority, deps or size
//   detail T-XXX "text" | --file path [--append]       write todos/T-XXX.md
//   edit T-XXX "new text"                             replace an item's description
//   tag T-XXX a,b                                     replace an item's tags ("-" clears)
//   show T-XXX                                        the line, then todos/T-XXX.md if any
//   done T-XXX                                        remove, archive with date, delete its detail file;
//                                                     prints items it fully unblocked
//   rm T-XXX                                          remove without archiving (detail file deleted too)
//
// dep is one ID, several comma-separated IDs, or "-". An item is eligible once none of
// its deps are still in todo.md.
//
// Data lives in the repo root: todo.md, todo-archive.md, todos/<ID>.md.
// TODO_ROOT=<dir> points the script at another directory (used for testing).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TODO_ROOT || path.resolve(here, "../../../..");
const TODO = path.join(ROOT, "todo.md");
const ARCHIVE = path.join(ROOT, "todo-archive.md");
const LAST_ID = path.join(ROOT, ".todo-last-id"); // highest ID ever issued, so rm never frees one for reuse
const DETAILS = path.join(ROOT, "todos");
const ID_RE = /^T-\d{3,}$/;
const TAGS_RE = /^[a-z0-9-]+(,[a-z0-9-]+)*$/; // line format: ID | P | dep | size | tags | description

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

const readLines = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l !== "") : [];

function writeAtomic(file, lines) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.map((l) => `${l}\n`).join(""));
  fs.renameSync(tmp, file);
}

function ensureFiles() {
  if (!fs.existsSync(TODO)) writeAtomic(TODO, ["# ID | P(1-3) | dep | size(S/M/L/-) | tags(a,b or -) | description"]);
  if (!fs.existsSync(ARCHIVE)) writeAtomic(ARCHIVE, ["# Completed: original line | done YYYY-MM-DD"]);
}

// Split on the first 4 pipes only; the description may contain "|".
function parse(lines) {
  const items = [];
  for (const raw of lines) {
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const parts = [];
    let rest = raw;
    for (let n = 0; n < 5; n++) {
      const at = rest.indexOf("|");
      if (at < 0) break;
      parts.push(rest.slice(0, at).trim());
      rest = rest.slice(at + 1);
    }
    if (parts.length < 5 || !ID_RE.test(parts[0])) continue;
    const p = Number.parseInt(parts[1], 10);
    items.push({ id: parts[0], p: Number.isNaN(p) ? 2 : p, dep: parts[2], size: parts[3], tags: parts[4], desc: rest.trim(), raw });
  }
  return items;
}

const maxId = (...sets) =>
  Math.max(0, ...sets.flat().map((l) => /^\s*T-(\d+)\s*\|/.exec(l)?.[1]).filter(Boolean).map(Number));

// Highest ID ever issued: the larger of the stored value and what's in both files.
function highestId(lines) {
  const stored = fs.existsSync(LAST_ID) ? Number.parseInt(fs.readFileSync(LAST_ID, "utf8"), 10) || 0 : 0;
  return Math.max(stored, maxId(lines, readLines(ARCHIVE)));
}

const rememberId = (n) => fs.writeFileSync(LAST_ID, `${n}`);

const checkId = (s) => {
  if (!ID_RE.test(s ?? "")) die(`bad ID '${s}' (expected T-001)`);
};

const depList = (dep) => (dep === "-" ? [] : dep.split(","));

// The deps still waiting in todo.md, or "-"; list shows these so finished deps don't look stale.
const openDeps = (item, ids) => depList(item.dep).filter((d) => ids.has(d)).join(",") || "-";

const eligible = (items) => {
  const ids = new Set(items.map((i) => i.id));
  return items.filter((i) => depList(i.dep).every((d) => !ids.has(d)));
};

// An item as printed by next, list and show: deps already finished are dropped.
const display = (item, items) => fmt({ ...item, dep: openDeps(item, new Set(items.map((i) => i.id))) });

const byPriority = (a, b) => a.p - b.p || a.id.localeCompare(b.id);
const fmt = (i) => `${i.id} | ${i.p} | ${i.dep} | ${i.size} | ${i.tags} | ${i.desc}`;

// True if following deps from `id` leads back to `id`.
function hasCycle(items, id, dep) {
  const deps = new Map(items.map((i) => [i.id, depList(i.dep)]));
  deps.set(id, depList(dep));
  const seen = new Set();
  const stack = [...deps.get(id)];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === id) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(deps.get(cur) ?? []));
  }
  return false;
}

// Refuses a cycle; warns about deps that are neither open nor in the archive (likely typos).
function checkDeps(items, id, dep) {
  if (hasCycle(items, id, dep)) die(`circular dependency: ${id} -> ${dep} leads back to ${id}`);
  const known = new Set(items.map((i) => i.id));
  for (const l of readLines(ARCHIVE)) {
    const m = /^\s*(T-\d+)\s*\|/.exec(l);
    if (m) known.add(m[1]);
  }
  const unknown = depList(dep).filter((d) => !known.has(d));
  if (unknown.length) console.error(`warning: ${unknown.join(", ")} not found (counts as done)`);
}

function parsePriority(value) {
  const p = value === undefined ? 2 : Number(value);
  if (![1, 2, 3].includes(p)) die(`bad priority '${value}' (use 1-3)`);
  return p;
}

function parseSize(value) {
  const size = value ?? "-";
  if (!["S", "M", "L", "-"].includes(size)) die(`bad size '${size}' (use S, M, L or -)`);
  return size;
}

// "T-001,T-002" or "-"; an item can't depend on itself.
function parseDeps(value, selfId) {
  if (value === undefined || value === "-") return "-";
  const ids = value.replace(/\s+/g, "").split(",");
  for (const id of ids) {
    checkId(id);
    if (id === selfId) die("task cannot depend on itself");
  }
  return [...new Set(ids)].join(",");
}

function parseTags(value) {
  if (value === undefined || value === "-") return "-";
  const tags = value.replace(/\s+/g, "");
  if (!TAGS_RE.test(tags)) die(`bad tags '${value}' (lowercase, comma-separated, a-z 0-9 -)`);
  return tags;
}

function find(items, id) {
  checkId(id);
  return items.find((i) => i.id === id) ?? die(`${id} not found`);
}

// Pulls "-p 1", "--dep T-001", "--all"... out of argv; the rest are positionals.
function parseArgs(argv, valueFlags, boolFlags = []) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (valueFlags.includes(a)) {
      if (i + 1 >= argv.length) die(`${a} needs a value`);
      flags[a] = argv[++i];
    } else if (boolFlags.includes(a)) flags[a] = true;
    else if (a.startsWith("-") && a.length > 1) die(`unknown option '${a}'`);
    else pos.push(a);
  }
  return { flags, pos };
}

function add(argv) {
  const { flags, pos } = parseArgs(argv, ["-p", "--dep", "--size", "--tag"]);
  const text = pos.join(" ").split(/\s+/).filter(Boolean).join(" ");
  if (!text) die("usage: add \"text\" [-p 1-3] [--dep T-A,T-B] [--size S|M|L] [--tag a,b]");
  const p = parsePriority(flags["-p"]);
  const size = parseSize(flags["--size"]);
  const tags = parseTags(flags["--tag"]);
  ensureFiles();
  const lines = readLines(TODO);
  const n = highestId(lines) + 1;
  const id = `T-${String(n).padStart(3, "0")}`;
  const dep = parseDeps(flags["--dep"], id);
  checkDeps(parse(lines), id, dep);
  rememberId(n);
  writeAtomic(TODO, [...lines, `${id} | ${p} | ${dep} | ${size} | ${tags} | ${text}`]);
  console.log(id);
}

function next() {
  const items = parse(readLines(TODO));
  const [best] = eligible(items).sort(byPriority);
  console.log(best ? display(best, items) : "none");
}

function list(argv) {
  const { flags } = parseArgs(argv, ["-p", "--tag"], ["--all"]);
  const tag = flags["--tag"]?.toLowerCase();
  const p = flags["-p"] === undefined ? null : Number(flags["-p"]);
  if (p !== null && ![1, 2, 3].includes(p)) die(`bad priority '${flags["-p"]}' (use 1-3)`);
  const items = parse(readLines(TODO));
  const ok = new Set(eligible(items).map((i) => i.id));
  const out = items
    .sort(byPriority)
    .filter((i) => (p === null || i.p === p) && (!tag || i.tags.split(",").includes(tag)) && (flags["--all"] || ok.has(i.id)))
    .map((i) => (ok.has(i.id) ? "" : "*") + display(i, items));
  if (out.length) console.log(out.join("\n"));
}

function show(argv) {
  const items = parse(readLines(TODO));
  const item = find(items, argv[0]);
  console.log(display(item, items));
  const detail = path.join(DETAILS, `${item.id}.md`);
  if (fs.existsSync(detail)) console.log(fs.readFileSync(detail, "utf8").trimEnd());
}

function edit(argv) {
  const lines = readLines(TODO);
  const item = find(parse(lines), argv[0]);
  const text = argv.slice(1).join(" ").split(/\s+/).filter(Boolean).join(" ");
  if (!text) die('usage: edit T-XXX "new text"');
  const updated = fmt({ ...item, desc: text });
  writeAtomic(TODO, lines.map((l) => (l === item.raw ? updated : l)));
}

function set(argv) {
  const { flags, pos } = parseArgs(argv, ["-p", "--dep", "--size"]);
  const lines = readLines(TODO);
  const item = find(parse(lines), pos[0]);
  if (pos.length !== 1 || !["-p", "--dep", "--size"].some((f) => f in flags)) {
    die("usage: set T-XXX [-p 1-3] [--dep T-A,T-B|-] [--size S|M|L|-]");
  }
  const next = { ...item };
  if ("-p" in flags) next.p = parsePriority(flags["-p"]);
  if ("--size" in flags) next.size = parseSize(flags["--size"]);
  if ("--dep" in flags) {
    next.dep = parseDeps(flags["--dep"], item.id);
    checkDeps(parse(lines), item.id, next.dep);
  }
  writeAtomic(TODO, lines.map((l) => (l === item.raw ? fmt(next) : l)));
}

function detail(argv) {
  const { flags, pos } = parseArgs(argv, ["--file"], ["--append"]);
  const item = find(parse(readLines(TODO)), pos[0]);
  let text;
  if (flags["--file"]) {
    if (!fs.existsSync(flags["--file"])) die(`no such file '${flags["--file"]}'`);
    text = fs.readFileSync(flags["--file"], "utf8");
  } else text = pos.slice(1).join(" ");
  if (!text.trim()) die('usage: detail T-XXX "text" | --file path [--append]');
  const file = path.join(DETAILS, `${item.id}.md`);
  const old = flags["--append"] && fs.existsSync(file) ? fs.readFileSync(file, "utf8").trimEnd() + "\n" : "";
  fs.mkdirSync(DETAILS, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${old}${text.trimEnd()}\n`);
  fs.renameSync(tmp, file);
}

function tag(argv) {
  const lines = readLines(TODO);
  const item = find(parse(lines), argv[0]);
  if (argv.length !== 2) die("usage: tag T-XXX a,b  (\"-\" clears)");
  const updated = fmt({ ...item, tags: parseTags(argv[1]) });
  writeAtomic(TODO, lines.map((l) => (l === item.raw ? updated : l)));
}

function remove(argv, archive) {
  const lines = readLines(TODO);
  const item = find(parse(lines), argv[0]);
  writeAtomic(TODO, lines.filter((l) => l !== item.raw));
  if (archive) {
    ensureFiles();
    const date = new Date().toISOString().slice(0, 10);
    writeAtomic(ARCHIVE, [...readLines(ARCHIVE), `${item.raw} | done ${date}`]);
  }
  fs.rmSync(path.join(DETAILS, `${item.id}.md`), { force: true });
  const left = parse(readLines(TODO));
  rememberId(highestId([...lines]));
  const ids = new Set(left.map((i) => i.id));
  const freed = left
    .filter((i) => depList(i.dep).includes(item.id) && depList(i.dep).every((d) => !ids.has(d)))
    .map((i) => i.id);
  if (freed.length) console.log(`unblocked: ${freed.join(", ")}`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case "add": add(args); break;
  case "next": next(); break;
  case "list": list(args); break;
  case "set": set(args); break;
  case "detail": detail(args); break;
  case "edit": edit(args); break;
  case "tag": tag(args); break;
  case "show": show(args); break;
  case "done": remove(args, true); break;
  case "rm": remove(args, false); break;
  default: die("usage: todo.mjs add|next|list|show|set|detail|edit|tag|done|rm");
}
