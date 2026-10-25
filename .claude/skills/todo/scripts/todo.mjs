// Minimal todo tracker. The script does the bookkeeping so nobody reads the todo files.
//
//   node .claude/skills/todo/scripts/todo.mjs <command> [args]
//
//   add "text" [-p 1-3] [--dep T-A,T-B] [--size S|M|L] [--tag a,b]   create; prints the new ID
//   next                                              best eligible line, or "none"
//   list [-p N] [--tag X] [--all]                     eligible items; --all adds blocked (*)
//   set T-XXX [-p N] [--dep T-A,T-B|-] [--size S|M|L|-]   change priority, deps or size
//   detail T-XXX "text" | --file path [--append]       write the item's detail text
//   edit T-XXX "new text"                             replace an item's description
//   tag T-XXX a,b                                     replace an item's tags ("-" clears)
//   show T-XXX                                        the line, then the detail text if any
//   done T-XXX                                        remove, archive with date; prints items it
//                                                     fully unblocked
//   rm T-XXX                                          remove without archiving
//   migrate                                           convert an old todo.md (see "migrate" below)
//
//   stats                                             counts by priority and size, done this week
//   graph                                             dependency tree: what unblocks what
//   html [--out file]                                 a self-contained HTML board (light/dark)
//   help                                              usage, color flags
//
// Output is plain unless color is on (see "Colors" below); then list also groups by
// priority and ends with a summary line.
//
// dep is one ID, several comma-separated IDs, or "-". An item is eligible once none of
// its deps are still open.
//
// ---- Data: one file per todo -----------------------------------------------------------
// Several agents work in parallel git worktrees, so nothing here is shared between items:
//   todos/<ID>.md      line 1: "ID | P | dep | size | tags | description"
//                      line 2: "created: <ISO time>" (absent on todos from the old todo.md)
//                      then a blank line and the free-form detail text, if any.
//   todo-archive.md    finished items, one line each; append-only, merged with
//                      `merge=union` (.gitattributes), so two branches' `done`s both stay.
//   todo.md            a stub: the old queue's file, kept so branches from before the move
//                      conflict there when rebased, and `migrate` can read them.
// New IDs are random (T- plus 4 characters from ID_ALPHABET), checked against every
// open and archived ID here, so two worktrees never need to agree on a counter. Two
// branches that each add a todo touch different files, and git merges them cleanly.
// The old numeric IDs (T-017) stay valid.
//
// TODO_ROOT=<dir> points the script at another directory (used by tests/todo/).
// TODO_TEST_IDS=a,b,... hands out those ID suffixes in order (tests only).

import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TODO_ROOT || path.resolve(here, "../../../..");
const ARCHIVE = path.join(ROOT, "todo-archive.md");
const DETAILS = path.join(ROOT, "todos");
const LEGACY_TODO = path.join(ROOT, "todo.md"); // the old single-file queue; `migrate` converts it
/**
 * What todo.md holds once migrated. The file stays (rather than being deleted) so a branch
 * from before the move conflicts *in it* when rebased: git can't mistake the deletion for
 * todo.md being renamed into a todo file and pour the branch's edits there.
 */
const LEGACY_STUB = [
  "# The todo queue moved to one file per todo: todos/<ID>.md, managed by",
  "# node .claude/skills/todo/scripts/todo.mjs (see .claude/skills/todo/SKILL.md).",
  "# This file stays so old branches conflict here when rebased; `migrate` reads them.",
];
const LEGACY_LAST_ID = path.join(ROOT, ".todo-last-id"); // the old ID counter; `migrate` deletes it
/** No 0/o, 1/l/i: an ID is easy to read aloud and retype. 31^4 = 923,521 IDs. */
const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const ID_LENGTH = 4;
const ID_RE = /^T-(\d{3,}|[23456789abcdefghjkmnpqrstuvwxyz]{4})$/;
const LINE_ID_RE = /^\s*(T-[0-9a-z]+)\s*\|/i;
const TAGS_RE = /^[a-z0-9-]+(,[a-z0-9-]+)*$/; // line format: ID | P | dep | size | tags | description

// ---- Colors (display only) ---------------------------------------------------------
// Color is on when stdout is a TTY, unless NO_COLOR is set; FORCE_COLOR forces it on.
// --color=always (= --pretty) and --color=never (= --plain) override both, so --pretty
// beats NO_COLOR. Piped output, and anything Claude runs, is plain. Every style is named
// in PALETTE (basic 16-color codes, so they follow the terminal theme) and applied through
// c(); this block is the only place escape codes are written.
const ANSI = { bold: 1, dim: 2, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37, gray: 90 };
const PALETTE = {
  p1: ["bold", "red"], p2: ["yellow"], p3: ["blue"], // priority
  sizeS: ["green"], sizeM: ["yellow"], sizeL: ["bold", "magenta"],
  id: ["cyan"],
  next: ["bold"], arrow: ["green"], // the item `next` picks
  blocked: ["gray"], blockedDep: ["dim", "cyan"],
  num: ["bold", "white"], label: ["dim"], ready: ["green"], blockedCount: ["gray"], urgent: ["red"], // summary line
  marker: ["dim"], // "+" after an ID that has detail text
  done: ["green"], unblocked: ["cyan"],
  cycle: ["red"], rule: ["dim"], error: ["red"], warn: ["yellow"],
};
const PRIORITY_STYLE = { 1: PALETTE.p1, 2: PALETTE.p2, 3: PALETTE.p3 };
const SIZE_STYLE = { S: PALETTE.sizeS, M: PALETTE.sizeM, L: PALETTE.sizeL };

let PRETTY = false; // stdout
let ERR_PRETTY = false; // stderr (error:/warn: prefixes)

const paint = (text, styles) => {
  const codes = [...new Set(styles.flat(Infinity))].map((x) => ANSI[x]);
  return text === "" || !codes.length ? text : `\x1b[${codes.join(";")}m${text}\x1b[0m`;
};
const c = (text, ...styles) => (PRETTY ? paint(text, styles) : text);
const ce = (text, ...styles) => (ERR_PRETTY ? paint(text, styles) : text);
const visible = (text) => text.replace(/\x1b\[[0-9;]*m/g, ""); // widths ignore escape codes
const width = (text) => [...visible(text)].length;
const padTo = (text, n) => text + " ".repeat(Math.max(0, n - width(text)));

function colorEnabled(mode, stream) {
  if (mode === "always") return true;
  if (mode === "never") return false;
  const force = process.env.FORCE_COLOR;
  if (force) return force !== "0";
  return !process.env.NO_COLOR && Boolean(stream.isTTY);
}

const die = (msg) => {
  console.error(ERR_PRETTY ? `${ce("error:", PALETTE.error)} ${msg}` : msg);
  process.exit(1);
};

const warn = (msg) => console.error(ERR_PRETTY ? `${ce("warn:", PALETTE.warn)} ${msg}` : `warning: ${msg}`);

const splitLines = (text) => text.split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l !== "");
const readLines = (file) => (fs.existsSync(file) ? splitLines(fs.readFileSync(file, "utf8")) : []);

function writeAtomic(file, lines) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.map((l) => `${l}\n`).join(""));
  fs.renameSync(tmp, file);
}

// ---- Items ------------------------------------------------------------------------------

// One "ID | P | dep | size | tags | description" line, split on the first 5 pipes only
// (the description may contain "|"); null if it isn't one.
function parseLine(raw) {
  if (!raw.trim() || raw.trimStart().startsWith("#")) return null;
  const parts = [];
  let rest = raw;
  for (let n = 0; n < 5; n++) {
    const at = rest.indexOf("|");
    if (at < 0) return null;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at + 1);
  }
  const id = normalizeId(parts[0]);
  if (!ID_RE.test(id)) return null;
  const p = Number.parseInt(parts[1], 10);
  return { id, p: Number.isNaN(p) ? 2 : p, dep: parts[2], size: parts[3], tags: parts[4], desc: rest.trim() };
}

const fmt = (i) => `${i.id} | ${i.p} | ${i.dep} | ${i.size} | ${i.tags} | ${i.desc}`;
const fileOf = (id) => path.join(DETAILS, `${id}.md`);

/** A todo file's parts, or null if the file isn't a todo (e.g. an old-format detail file). */
function readItemFile(file) {
  const lines = splitLines(fs.readFileSync(file, "utf8"));
  const item = parseLine(lines[0] ?? "");
  if (!item) return null;
  let at = 1;
  const created = /^created:\s*(\S+)\s*$/.exec(lines[1] ?? "")?.[1];
  if (created) at = 2;
  if (lines[at] === "") at++;
  return { item: created ? { ...item, created } : item, body: lines.slice(at).join("\n").trimEnd() };
}

function writeItem(item, body = "") {
  fs.mkdirSync(DETAILS, { recursive: true });
  const lines = [fmt(item)];
  if (item.created) lines.push(`created: ${item.created}`);
  if (body.trim()) lines.push("", ...body.trimEnd().split(/\r?\n/));
  writeAtomic(fileOf(item.id), lines);
}

const bodyOf = (id) => readItemFile(fileOf(id))?.body ?? "";

/** A line git writes around a conflict (<<<<<<<, |||||||, =======, >>>>>>>). */
const MARKER_LINE = /^(<{7}|\|{7}|={7}|>{7})( |$)/;
const todoLines = (text) => [...new Set(splitLines(text ?? ""))].filter((l) => l.trim() && !l.trimStart().startsWith("#") && !MARKER_LINE.test(l));

/**
 * A file's content at a git index stage while it's in conflict: 1 the common base,
 * 2 ours (in a rebase: main), 3 theirs (the commit being replayed). null otherwise.
 */
function stage(n, rel) {
  try {
    return execFileSync("git", ["show", `:${n}:${rel}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/**
 * The old queue still in todo.md, or no lines once it's the stub. Mid-rebase (todo.md in
 * conflict) it's the replayed commit's version, plus the todos that commit finished or
 * removed: in its parent's todo.md, gone from its own.
 */
function legacyQueue() {
  const none = { lines: [], removed: [] };
  if (!fs.existsSync(LEGACY_TODO)) return none;
  const text = fs.readFileSync(LEGACY_TODO, "utf8");
  if (!todoLines(text).length) return none; // the stub
  const theirs = stage(3, "todo.md");
  if (theirs === null) return { lines: todoLines(text), removed: [] };
  const lines = todoLines(theirs);
  const kept = new Set(lines.map(parseLine).filter(Boolean).map((i) => i.id));
  const removed = todoLines(stage(1, "todo.md")).map(parseLine).filter((i) => i && !kept.has(i.id));
  return { lines, removed };
}

let warnedLegacy = false;
/** Every open todo. Warns (once) about an old todo.md waiting for `migrate`, and about stray files. */
function loadItems({ quiet = false } = {}) {
  const legacy = legacyQueue().lines.length > 0;
  if (!quiet && !warnedLegacy && legacy) {
    warnedLegacy = true;
    warn("todo.md is the old single-file format; run `migrate` (see the todo skill)");
  }
  if (!fs.existsSync(DETAILS)) return [];
  const items = [];
  for (const name of fs.readdirSync(DETAILS).sort()) {
    if (!name.endsWith(".md")) continue;
    const parsed = readItemFile(path.join(DETAILS, name));
    if (!parsed || `${parsed.item.id}.md` !== name) {
      if (!quiet && !legacy) warn(`todos/${name} is not a todo file (line 1 must be its ID line)`);
      continue;
    }
    items.push({ ...parsed.item, hasBody: parsed.body !== "" });
  }
  return items;
}

function archivedIds() {
  const ids = new Set();
  for (const l of readLines(ARCHIVE)) {
    const m = LINE_ID_RE.exec(l);
    if (m) ids.add(normalizeId(m[1]));
  }
  return ids;
}

/** "t-K7Q3 " -> "T-k7q3": IDs are case-insensitive to type. */
function normalizeId(s) {
  const t = (s ?? "").trim();
  return /^t-/i.test(t) ? `T-${t.slice(2).toLowerCase()}` : t;
}

const checkId = (s) => {
  const id = normalizeId(s);
  if (!ID_RE.test(id)) die(`bad ID '${s}' (expected T-k7q3, or an old one like T-017)`);
  return id;
};

const testIds = (process.env.TODO_TEST_IDS ?? "").split(",").filter(Boolean);
/** A random ID not in `taken` (and adds it there). */
function newId(taken) {
  for (;;) {
    const suffix = testIds.length ? testIds.shift() : Array.from({ length: ID_LENGTH }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join("");
    const id = `T-${suffix}`;
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

const depList = (dep) => (dep === "-" ? [] : dep.split(","));

// The deps still open, or "-"; list shows these so finished deps don't look stale.
const openDeps = (item, ids) => depList(item.dep).filter((d) => ids.has(d)).join(",") || "-";

const eligible = (items) => {
  const ids = new Set(items.map((i) => i.id));
  return items.filter((i) => depList(i.dep).every((d) => !ids.has(d)));
};

// An item as printed by next, list and show: deps already finished are dropped.
const display = (item, items) => fmt({ ...item, dep: openDeps(item, new Set(items.map((i) => i.id))) });

// Age: old numeric todos (no created time) first, by ID, then by creation time.
const byAge = (a, b) => (a.created ?? "").localeCompare(b.created ?? "") || a.id.localeCompare(b.id);
const byPriority = (a, b) => a.p - b.p || byAge(a, b);

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
  const known = new Set([...items.map((i) => i.id), ...archivedIds()]);
  const unknown = depList(dep).filter((d) => !known.has(d));
  if (unknown.length) warn(`${unknown.join(", ")} not found (counts as done)`);
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

// "T-001,T-k7q3" or "-"; an item can't depend on itself.
function parseDeps(value, selfId) {
  if (value === undefined || value === "-") return "-";
  const ids = value.replace(/\s+/g, "").split(",").map(checkId);
  if (ids.includes(selfId)) die("task cannot depend on itself");
  return [...new Set(ids)].join(",");
}

function parseTags(value) {
  if (value === undefined || value === "-") return "-";
  const tags = value.replace(/\s+/g, "");
  if (!TAGS_RE.test(tags)) die(`bad tags '${value}' (lowercase, comma-separated, a-z 0-9 -)`);
  return tags;
}

function find(items, raw) {
  const id = checkId(raw);
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

// ---- Commands -----------------------------------------------------------------------------

function add(argv) {
  const { flags, pos } = parseArgs(argv, ["-p", "--dep", "--size", "--tag"]);
  const text = pos.join(" ").split(/\s+/).filter(Boolean).join(" ");
  if (!text) die("usage: add \"text\" [-p 1-3] [--dep T-A,T-B] [--size S|M|L] [--tag a,b]");
  const p = parsePriority(flags["-p"]);
  const size = parseSize(flags["--size"]);
  const tags = parseTags(flags["--tag"]);
  const items = loadItems();
  const id = newId(new Set([...items.map((i) => i.id), ...archivedIds()]));
  const dep = parseDeps(flags["--dep"], id);
  checkDeps(items, id, dep);
  writeItem({ id, p, dep, size, tags, desc: text, created: new Date().toISOString() });
  console.log(id);
}

const bestOf = (items) => [...eligible(items)].sort(byPriority)[0];

// One item as a colored row. `cols` pads the dep and tags columns so rows line up.
function prettyRow(item, items, { blocked = false, isNext = false, mark = false, cols = { dep: 0, tags: 0 }, lead = "" } = {}) {
  const ids = new Set(items.map((i) => i.id));
  const open = openDeps(item, ids);
  const bold = isNext ? ["bold"] : [];
  const tone = (text, ...styles) => c(text, blocked ? [PALETTE.blocked, bold] : [styles, bold]);
  const sep = tone(" | ");
  const dep = open === "-" ? tone("-") : c(`⏸ ${open}`, blocked ? PALETTE.blockedDep : PALETTE.p2);
  const detailMark = mark ? (item.hasBody ? c("+", PALETTE.marker) : " ") : "";
  const head = [
    lead + tone(item.id, PALETTE.id) + detailMark,
    tone(String(item.p), PRIORITY_STYLE[item.p] ?? []),
    padTo(dep, cols.dep),
    tone(item.size, SIZE_STYLE[item.size] ?? []),
    padTo(tone(item.tags), cols.tags),
  ].join(sep);
  const room = (process.stdout.columns || 0) - width(head) - width(sep);
  const desc = room > 12 && [...item.desc].length > room ? `${[...item.desc].slice(0, room - 1).join("")}…` : item.desc;
  return head + sep + tone(desc);
}

function next() {
  const items = loadItems();
  const best = bestOf(items);
  if (!PRETTY) return console.log(best ? display(best, items) : "none");
  console.log(best ? prettyRow(best, items, { isNext: true, lead: c("▶ ", PALETTE.arrow, "bold") }) : c("none", PALETTE.label));
}

function summary(items) {
  const ready = eligible(items).length;
  const urgent = items.filter((i) => i.p === 1).length;
  const num = (n, style = PALETTE.num) => c(String(n), style);
  return [
    `${num(items.length)} ${c("open", PALETTE.label)}`,
    `${num(ready, PALETTE.ready)} ${c("ready", PALETTE.label)}`,
    `${num(items.length - ready, PALETTE.blockedCount)} ${c("blocked", PALETTE.label)}`,
    `${num(urgent, urgent > 0 ? PALETTE.urgent : PALETTE.num)} ${c("P1", PALETTE.label)}`,
  ].join(c(" · ", PALETTE.label));
}

function listPretty(shown, items, ok) {
  const nextId = bestOf(items)?.id;
  const ids = new Set(items.map((i) => i.id));
  const cols = {
    dep: Math.max(1, ...shown.map((i) => width(openDeps(i, ids) === "-" ? "-" : `⏸ ${openDeps(i, ids)}`))),
    tags: Math.max(1, ...shown.map((i) => width(i.tags))),
  };
  const out = [];
  for (const p of [1, 2, 3]) {
    const group = shown.filter((i) => i.p === p);
    if (!group.length) continue;
    if (out.length) out.push("");
    out.push(c(`P${p} ${"─".repeat(30)}`, PRIORITY_STYLE[p], "bold"));
    for (const item of group) {
      const isNext = item.id === nextId;
      out.push(prettyRow(item, items, {
        blocked: !ok.has(item.id), isNext, mark: true, cols,
        lead: isNext ? c("▶ ", PALETTE.arrow, "bold") : "  ",
      }));
    }
  }
  if (out.length) out.push("");
  out.push(summary(items));
  console.log(out.join("\n"));
}

function list(argv) {
  const { flags } = parseArgs(argv, ["-p", "--tag"], ["--all"]);
  const tag = flags["--tag"]?.toLowerCase();
  const p = flags["-p"] === undefined ? null : Number(flags["-p"]);
  if (p !== null && ![1, 2, 3].includes(p)) die(`bad priority '${flags["-p"]}' (use 1-3)`);
  const items = loadItems();
  const ok = new Set(eligible(items).map((i) => i.id));
  const shown = items
    .sort(byPriority)
    .filter((i) => (p === null || i.p === p) && (!tag || i.tags.split(",").includes(tag)) && (flags["--all"] || ok.has(i.id)));
  if (PRETTY) return listPretty(shown, items, ok);
  const out = shown.map((i) => (ok.has(i.id) ? "" : "*") + display(i, items));
  if (out.length) console.log(out.join("\n"));
}

const wrap = (text, w) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && [...line].length + 1 + [...word].length > w) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  return line ? [...lines, line] : lines;
};

const clip = (text, n) => ([...text].length > n && n > 1 ? `${[...text].slice(0, n - 1).join("")}…` : text);

// The pretty `show`: a small card with title, status, what it waits on and what waits on it.
function showCard(item, items, detailText) {
  const ids = new Set(items.map((i) => i.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const cols = process.stdout.columns || 80;
  const label = (text) => c(padTo(text, 9), PALETTE.label);
  const ref = (id) => {
    const other = byId.get(id);
    return other ? `${c(id, other === item ? PALETTE.id : eligible(items).includes(other) ? PALETTE.id : PALETTE.blocked)} ${clip(other.desc, cols - 18)}` : `${c(id, PALETTE.rule)} ${c("(done)", PALETTE.label)}`;
  };
  const open = depList(item.dep).filter((d) => ids.has(d));
  const blocked = open.length > 0;
  const isNext = bestOf(items)?.id === item.id;
  const status = blocked ? c(`blocked by ${open.join(", ")}`, PALETTE.blockedDep) : isNext ? c("▶ ready, picked by next", PALETTE.arrow, "bold") : c("ready", PALETTE.ready);
  const waiting = items.filter((i) => depList(i.dep).includes(item.id)).map((i) => i.id);
  const out = [
    `${c(item.id, PALETTE.id, "bold")}${item.hasBody ? c(" +", PALETTE.marker) : ""}`,
    ...wrap(item.desc, Math.max(30, cols - 2)).map((l) => `  ${c(l, blocked ? PALETTE.blocked : "bold")}`),
    "",
    `${label("priority")}${c(`P${item.p}`, PRIORITY_STYLE[item.p] ?? [])}`,
    `${label("size")}${item.size === "-" ? c("-", PALETTE.label) : c(item.size, SIZE_STYLE[item.size] ?? [])}`,
    `${label("tags")}${item.tags === "-" ? c("-", PALETTE.label) : item.tags.split(",").map((t) => c(t, PALETTE.id)).join(c(", ", PALETTE.label))}`,
    `${label("status")}${status}`,
  ];
  const deps = depList(item.dep);
  if (deps.length) out.push(`${label("waits on")}${deps.map(ref).join(`\n${" ".repeat(9)}`)}`);
  if (waiting.length) out.push(`${label("blocks")}${waiting.map(ref).join(`\n${" ".repeat(9)}`)}`);
  if (detailText) out.push("", c(`── detail ${"─".repeat(Math.max(0, Math.min(cols, 60) - 10))}`, PALETTE.rule));
  console.log(out.join("\n"));
}

function show(argv) {
  const items = loadItems();
  const item = find(items, argv[0]);
  const detailText = bodyOf(item.id);
  if (PRETTY) showCard(item, items, detailText);
  else console.log(display(item, items));
  if (detailText) console.log(detailText);
}

function edit(argv) {
  const item = find(loadItems(), argv[0]);
  const text = argv.slice(1).join(" ").split(/\s+/).filter(Boolean).join(" ");
  if (!text) die('usage: edit T-XXX "new text"');
  writeItem({ ...item, desc: text }, bodyOf(item.id));
}

function set(argv) {
  const { flags, pos } = parseArgs(argv, ["-p", "--dep", "--size"]);
  const items = loadItems();
  const item = find(items, pos[0]);
  if (pos.length !== 1 || !["-p", "--dep", "--size"].some((f) => f in flags)) {
    die("usage: set T-XXX [-p 1-3] [--dep T-A,T-B|-] [--size S|M|L|-]");
  }
  const next = { ...item };
  if ("-p" in flags) next.p = parsePriority(flags["-p"]);
  if ("--size" in flags) next.size = parseSize(flags["--size"]);
  if ("--dep" in flags) {
    next.dep = parseDeps(flags["--dep"], item.id);
    checkDeps(items, item.id, next.dep);
  }
  writeItem(next, bodyOf(item.id));
}

function detail(argv) {
  const { flags, pos } = parseArgs(argv, ["--file"], ["--append"]);
  const item = find(loadItems(), pos[0]);
  let text;
  if (flags["--file"]) {
    if (!fs.existsSync(flags["--file"])) die(`no such file '${flags["--file"]}'`);
    text = fs.readFileSync(flags["--file"], "utf8");
  } else text = pos.slice(1).join(" ");
  if (!text.trim()) die('usage: detail T-XXX "text" | --file path [--append]');
  const old = flags["--append"] ? bodyOf(item.id) : "";
  writeItem(item, old ? `${old}\n${text.trimEnd()}` : text);
}

function tag(argv) {
  const item = find(loadItems(), argv[0]);
  if (argv.length !== 2) die("usage: tag T-XXX a,b  (\"-\" clears)");
  writeItem({ ...item, tags: parseTags(argv[1]) }, bodyOf(item.id));
}

function remove(argv, archive) {
  const item = find(loadItems(), argv[0]);
  fs.rmSync(fileOf(item.id), { force: true });
  if (archive) {
    const date = new Date().toISOString().slice(0, 10);
    const lines = readLines(ARCHIVE);
    writeAtomic(ARCHIVE, [...(lines.length ? lines : ["# Completed: original line | done YYYY-MM-DD"]), `${fmt(item)} | done ${date}`]);
  }
  const left = loadItems({ quiet: true });
  const ids = new Set(left.map((i) => i.id));
  const freed = left
    .filter((i) => depList(i.dep).includes(item.id) && depList(i.dep).every((d) => !ids.has(d)))
    .map((i) => i.id);
  if (archive && PRETTY) console.log(`${c("done", PALETTE.label)} ${c(item.id, PALETTE.done)}`);
  if (freed.length) console.log(`${c("unblocked:", PALETTE.label)} ${freed.map((id) => c(id, PALETTE.unblocked)).join(", ")}`);
}

// ---- migrate ----------------------------------------------------------------------------
// Converts the old single-file queue (todo.md + todos/<ID>.md detail text + .todo-last-id)
// into one file per todo, leaving todo.md as the stub. The output is deterministic (no
// created line for these), so two branches migrating the same untouched todo write
// identical files and merge cleanly.
//
// Its main use is mid-rebase: an old branch rebased onto a migrated main stops on each of
// its commits that touched todo.md, which conflicts with main's stub (LEGACY_STUB). Running
// migrate there reads that commit's todo.md from git's conflict stages and applies it to
// the files already in the tree:
// - todos the commit finished or removed lose their files;
// - an ID already taken by a *different* todo (the old counter's collisions) gets a new
//   random ID, and the deps of the todos being migrated follow it;
// - a todo already migrated under a new ID (at an earlier stop) reuses that ID;
// - a todo whose description is mostly the same words is the same todo, edited: the file
//   in the tree wins, and the difference is reported.
// A detail file both sides changed under one ID keeps the side that is a todo file; the
// other side, old detail text, becomes the migrated todo's detail.

const words = (text) => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
function sameTodo(a, b) {
  if (fmt(a) === fmt(b)) return true;
  const x = words(a.desc);
  const y = words(b.desc);
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.max(1, new Set([...x, ...y]).size) >= 0.5;
}

const isTodoFileFor = (text, id) => parseLine(splitLines(text)[0] ?? "")?.id === id;

function migrate() {
  const { lines, removed } = legacyQueue();
  const report = [];
  let inTree = new Map(loadItems({ quiet: true }).map((i) => [i.id, i]));
  /** The file in the tree holding this old line's todo: same ID and same todo, or migrated earlier under a new ID. */
  const fileFor = (old) => {
    const same = inTree.get(old.id);
    if (same && sameTodo(same, old)) return same;
    return [...inTree.values()].find((o) => o.id !== old.id && o.desc === old.desc);
  };

  for (const gone of removed) {
    const target = fileFor(gone);
    if (!target) continue;
    fs.rmSync(fileOf(target.id), { force: true });
    inTree.delete(target.id);
    report.push(`${target.id}: finished or removed by this commit`);
  }

  const legacy = lines.map(parseLine).filter(Boolean);
  // Lines the old script couldn't read either (a missing field...): say so rather than drop them silently.
  const unreadable = lines.filter((l) => !parseLine(l));

  // Old detail text lives at todos/<ID>.md: read it all before writing anything.
  const oldBody = new Map();
  for (const item of legacy) {
    const file = fileOf(item.id);
    const rel = `todos/${item.id}.md`;
    const theirs = stage(3, rel);
    const ours = theirs === null ? null : stage(2, rel);
    if (theirs !== null && ours !== null) {
      const todoSide = [ours, theirs].find((t) => isTodoFileFor(t, item.id));
      if (todoSide === undefined) die(`${rel} is in conflict and neither side is a todo file: resolve it by hand`);
      writeAtomic(file, splitLines(todoSide));
      const other = todoSide === ours ? theirs : ours;
      if (!isTodoFileFor(other, item.id) && other.trim()) oldBody.set(item.id, other.trimEnd());
    } else if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      if (text.split(/\r?\n/).some((l) => MARKER_LINE.test(l))) die(`${rel} has conflict markers: resolve it by hand`);
      if (!readItemFile(file)) oldBody.set(item.id, text.trimEnd());
    }
  }

  inTree = new Map(loadItems({ quiet: true }).map((i) => [i.id, i])); // after resolving detail conflicts
  const taken = new Set([...inTree.keys(), ...archivedIds(), ...legacy.map((i) => i.id), ...removed.map((i) => i.id)]);
  const renames = new Map();
  const plan = [];
  for (const item of legacy) {
    const mine = inTree.get(item.id);
    if (mine && !sameTodo(mine, item)) {
      const twin = fileFor(item);
      if (twin) {
        renames.set(item.id, twin.id); // migrated under a new ID at an earlier stop
        continue;
      }
      const id = newId(taken);
      renames.set(item.id, id);
      report.push(`${item.id} -> ${id}: ${item.id} is already "${clip(mine.desc, 50)}"`);
      plan.push({ item: { ...item, id }, from: item.id, moved: true });
    } else if (mine) {
      if (fmt(mine) !== fmt(item)) report.push(`${item.id}: kept todos/${item.id}.md; todo.md had "${clip(item.desc, 50)}"`);
      if (oldBody.has(item.id)) writeItem(mine, oldBody.get(item.id)); // the commit's newer detail text
    } else plan.push({ item, from: item.id, moved: false });
  }
  for (const { item, from, moved } of plan) {
    const dep = depList(item.dep).map((d) => renames.get(d) ?? d).join(",") || "-";
    writeItem({ ...item, dep }, oldBody.get(from) ?? "");
    if (moved && fs.existsSync(fileOf(from)) && !readItemFile(fileOf(from))) fs.rmSync(fileOf(from)); // its old detail file
  }
  if (fs.existsSync(LEGACY_TODO)) writeAtomic(LEGACY_TODO, LEGACY_STUB);
  fs.rmSync(LEGACY_LAST_ID, { force: true });
  if (!lines.length && !removed.length) return console.log("nothing to migrate");
  console.log(`migrated ${plan.length} todo${plan.length === 1 ? "" : "s"}${report.length || unreadable.length ? ":" : ""}`);
  for (const line of report) console.log(`  ${line}`);
  for (const line of unreadable) console.log(`  not a todo line, left out: ${line}`);
}

// ---- stats ---------------------------------------------------------------------------
const BAR = 20;
const bar = (n, max, styles) => {
  const len = n === 0 ? 0 : Math.max(1, Math.round((n / max) * BAR));
  return padTo(c("█".repeat(len), styles), BAR);
};

// Archive lines end in "| done YYYY-MM-DD"; count the last 7 days, today included.
function doneThisWeek() {
  const since = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  return readLines(ARCHIVE).filter((l) => {
    const date = /\|\s*done (\d{4}-\d{2}-\d{2})\s*$/.exec(l)?.[1];
    return date !== undefined && date >= since;
  }).length;
}

function stats() {
  const items = loadItems();
  const out = [summary(items), ""];
  const rows = (title, buckets) => {
    const max = Math.max(1, ...buckets.map((b) => b.n));
    out.push(c(title, PALETTE.label));
    for (const b of buckets) out.push(`  ${padTo(c(b.label, b.styles), 3)} ${bar(b.n, max, b.styles)} ${c(String(b.n), PALETTE.num)}`);
    out.push("");
  };
  rows("priority", [1, 2, 3].map((p) => ({ label: `P${p}`, n: items.filter((i) => i.p === p).length, styles: PRIORITY_STYLE[p] })));
  rows("size", ["S", "M", "L", "-"].map((z) => ({ label: z, n: items.filter((i) => i.size === z).length, styles: SIZE_STYLE[z] ?? PALETTE.label })));
  out.push(`${c("done this week", PALETTE.label)} ${c(String(doneThisWeek()), PALETTE.done)}`);
  console.log(out.join("\n"));
}

// ---- graph ---------------------------------------------------------------------------
// A tree per ready item, with the items waiting on it indented below. Items in a cycle
// (or only reachable through one) are listed last.
function graph() {
  const items = loadItems().sort(byAge);
  const ids = new Set(items.map((i) => i.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const open = (i) => depList(i.dep).filter((d) => ids.has(d));
  const children = (id) => items.filter((i) => open(i).includes(id));
  const inCycle = (start) => {
    const seen = new Set();
    const stack = [...open(byId.get(start))];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === start) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...open(byId.get(cur)));
    }
    return false;
  };
  const cyclic = new Set(items.filter((i) => inCycle(i.id)).map((i) => i.id));
  const style = (i) => (cyclic.has(i.id) ? PALETTE.cycle : open(i).length ? PALETTE.blocked : PALETTE.id);
  const room = Math.max(30, (process.stdout.columns || 80) - 12);
  const label = (i) => {
    const desc = [...i.desc].length > room ? `${[...i.desc].slice(0, room - 1).join("")}…` : i.desc;
    return `${c(i.id, style(i))} ${c(desc, open(i).length ? PALETTE.blocked : [])}`;
  };
  const printed = new Set();
  const out = [];
  const walk = (i, prefix, last, top) => {
    const again = printed.has(i.id);
    out.push(top ? label(i) : `${prefix}${last ? "└─ " : "├─ "}${label(i)}${again ? c(" …", PALETTE.rule) : ""}`);
    if (again) return;
    printed.add(i.id);
    const kids = children(i.id);
    const below = top ? "" : prefix + (last ? "   " : "│  ");
    kids.forEach((k, n) => walk(k, below, n === kids.length - 1, false));
  };
  for (const i of items.filter((x) => !open(x).length)) walk(i, "", true, true);
  const rest = items.filter((i) => !printed.has(i.id));
  if (rest.length) {
    out.push("", c("cycle / unreachable:", PALETTE.cycle));
    for (const i of rest) out.push(`  ${label(i)} ${c(`⏸ ${open(i).join(",")}`, PALETTE.blockedDep)}`);
  }
  if (out.length) console.log(out.join("\n"));
}

// ---- html ----------------------------------------------------------------------------
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Colors are CSS variables, mirroring PALETTE, with light and dark sets.
function html(argv) {
  const { flags } = parseArgs(argv, ["--out"]);
  const items = loadItems().sort(byPriority);
  const ok = new Set(eligible(items).map((i) => i.id));
  const nextId = bestOf(items)?.id;
  const ids = new Set(items.map((i) => i.id));
  const sections = [1, 2, 3].map((p) => {
    const rows = items.filter((i) => i.p === p).map((i) => {
      const open = openDeps(i, ids);
      return `<tr class="${ok.has(i.id) ? "ready" : "blocked"}${i.id === nextId ? " next" : ""}">` +
        `<td class="id">${i.id === nextId ? "▶ " : ""}${i.id}${i.hasBody ? '<span class="mark">+</span>' : ""}</td>` +
        `<td class="p p${i.p}">P${i.p}</td><td class="size size${i.size === "-" ? "x" : i.size}">${esc(i.size)}</td>` +
        `<td class="dep">${open === "-" ? "" : "⏸ " + esc(open)}</td><td class="tags">${esc(i.tags === "-" ? "" : i.tags)}</td>` +
        `<td>${esc(i.desc)}</td></tr>`;
    });
    return rows.length ? `<h2 class="p p${p}">P${p}</h2><table>${rows.join("")}</table>` : "";
  });
  const ready = ok.size;
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Todo board</title>
<style>
:root { color-scheme: light dark; --bg: #fbfaf7; --fg: #1d1d1b; --muted: #77746b; --line: #e4e1d8;
  --p1: #c4281c; --p2: #a86d00; --p3: #1f5fbf; --sizeS: #1b7f3a; --sizeM: #a86d00; --sizeL: #9c27b0;
  --id: #0b7f8a; --blocked: #8f8c83; --dep: #0b7f8a; --ready: #1b7f3a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #16171a; --fg: #e8e6df; --muted: #8d8a81;
  --line: #2d2f34; --p1: #ff6b60; --p2: #e3b341; --p3: #6ea8ff; --sizeS: #56d364; --sizeM: #e3b341; --sizeL: #d98cf0;
  --id: #56c7d4; --blocked: #6f6c64; --dep: #56c7d4; --ready: #56d364; } }
:root[data-theme="dark"] { --bg: #16171a; --fg: #e8e6df; --muted: #8d8a81; --line: #2d2f34; --p1: #ff6b60; --p2: #e3b341;
  --p3: #6ea8ff; --sizeS: #56d364; --sizeM: #e3b341; --sizeL: #d98cf0; --id: #56c7d4; --blocked: #6f6c64; --dep: #56c7d4; --ready: #56d364; }
body { background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 24px 16px; }
h1 { font-size: 20px; margin: 0 0 4px } .sum { color: var(--muted); margin-bottom: 8px } .sum b { color: var(--fg) } .sum .ready { color: var(--ready) }
h2 { font-size: 13px; letter-spacing: .08em; margin: 24px 0 6px; border-bottom: 1px solid var(--line); padding-bottom: 4px }
table { border-collapse: collapse; width: 100% } td { padding: 4px 8px 4px 0; vertical-align: top; border-bottom: 1px solid var(--line) }
.id { color: var(--id); white-space: nowrap; font-family: ui-monospace, monospace } .mark { color: var(--muted) } .dep { color: var(--dep); white-space: nowrap }
.tags { color: var(--muted) } .p1 { color: var(--p1); font-weight: 700 } .p2 { color: var(--p2) } .p3 { color: var(--p3) }
.sizeS { color: var(--sizeS) } .sizeM { color: var(--sizeM) } .sizeL { color: var(--sizeL); font-weight: 700 }
tr.blocked td { color: var(--blocked) } tr.blocked .id, tr.blocked .p, tr.blocked .size { color: var(--blocked) } tr.blocked .dep { color: var(--dep); opacity: .7 }
tr.next td { font-weight: 700 } tr.next .id { color: var(--ready) }
@media (max-width: 600px) { .tags, td.size { display: none } }
</style></head><body>
<h1>Todo board</h1>
<div class="sum"><b>${items.length}</b> open · <span class="ready"><b>${ready}</b> ready</span> · <b>${items.length - ready}</b> blocked · <b>${items.filter((i) => i.p === 1).length}</b> P1</div>
${sections.join("\n")}
</body></html>
`;
  if (flags["--out"]) fs.writeFileSync(flags["--out"], page);
  else process.stdout.write(page);
}

function help() {
  console.log(`usage: todo.mjs <command> [args] [color flags]

commands:
  add "text" [-p 1-3] [--dep T-A,T-B] [--size S|M|L] [--tag a,b]   prints the new ID
  next | list [-p N] [--tag X] [--all] | show T-XXX
  set T-XXX [-p N] [--dep ...|-] [--size S|M|L|-] | edit T-XXX "text" | tag T-XXX a,b
  detail T-XXX "text" | --file path [--append]
  done T-XXX | rm T-XXX
  migrate                      convert an old todo.md into one file per todo
  stats | graph | html [--out file]

color (display only; output is plain when piped):
  --color=auto|always|never   auto = TTY and no NO_COLOR (FORCE_COLOR forces on)
  --pretty                    same as --color=always; overrides NO_COLOR
  --plain                     same as --color=never
  With color on, list groups by priority and ends with a summary line.`);
}

let colorMode = "auto";
const rest = [];
for (const a of process.argv.slice(2)) {
  if (a === "--pretty") colorMode = "always";
  else if (a === "--plain") colorMode = "never";
  else if (a.startsWith("--color=")) {
    colorMode = a.slice("--color=".length);
    if (!["auto", "always", "never"].includes(colorMode)) die(`bad color mode '${colorMode}' (auto, always or never)`);
  } else rest.push(a);
}
PRETTY = colorEnabled(colorMode, process.stdout);
ERR_PRETTY = colorEnabled(colorMode, process.stderr);

const [cmd, ...args] = rest;
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
  case "migrate": migrate(); break;
  case "stats": stats(); break;
  case "graph": graph(); break;
  case "html": html(args); break;
  case "help": case "--help": case "-h": help(); break;
  default: die("usage: todo.mjs add|next|list|show|set|detail|edit|tag|done|rm|migrate|stats|graph|html|help");
}
