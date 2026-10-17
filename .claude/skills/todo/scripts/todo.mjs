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
//   stats                                             counts by priority and size, done this week
//   graph                                             dependency tree: what unblocks what
//   html [--out file]                                 a self-contained HTML board (light/dark)
//   help                                              usage, color flags
//
// Output is plain unless color is on (see "Colors" below); then list also groups by
// priority and ends with a summary line.
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
  marker: ["dim"], // "+" after an ID that has a detail file
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

const hasDetail = (id) => fs.existsSync(path.join(DETAILS, `${id}.md`));
const bestOf = (items) => [...eligible(items)].sort(byPriority)[0];

// One item as a colored row. `cols` pads the dep and tags columns so rows line up.
function prettyRow(item, items, { blocked = false, isNext = false, mark = false, cols = { dep: 0, tags: 0 }, lead = "" } = {}) {
  const ids = new Set(items.map((i) => i.id));
  const open = openDeps(item, ids);
  const bold = isNext ? ["bold"] : [];
  const tone = (text, ...styles) => c(text, blocked ? [PALETTE.blocked, bold] : [styles, bold]);
  const sep = tone(" | ");
  const dep = open === "-" ? tone("-") : c(`⏸ ${open}`, blocked ? PALETTE.blockedDep : PALETTE.p2);
  const detailMark = mark ? (hasDetail(item.id) ? c("+", PALETTE.marker) : " ") : "";
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
  const items = parse(readLines(TODO));
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
  const items = parse(readLines(TODO));
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
    `${c(item.id, PALETTE.id, "bold")}${hasDetail(item.id) ? c(" +", PALETTE.marker) : ""}`,
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
  const items = parse(readLines(TODO));
  const item = find(items, argv[0]);
  const detail = path.join(DETAILS, `${item.id}.md`);
  const detailText = fs.existsSync(detail) ? fs.readFileSync(detail, "utf8").trimEnd() : "";
  if (PRETTY) showCard(item, items, detailText);
  else console.log(display(item, items));
  if (detailText) console.log(detailText);
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
  if (archive && PRETTY) console.log(`${c("done", PALETTE.label)} ${c(item.id, PALETTE.done)}`);
  if (freed.length) console.log(`${c("unblocked:", PALETTE.label)} ${freed.map((id) => c(id, PALETTE.unblocked)).join(", ")}`);
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
  const items = parse(readLines(TODO));
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
  const items = parse(readLines(TODO)).sort((a, b) => a.id.localeCompare(b.id));
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
  const items = parse(readLines(TODO)).sort(byPriority);
  const ok = new Set(eligible(items).map((i) => i.id));
  const nextId = bestOf(items)?.id;
  const ids = new Set(items.map((i) => i.id));
  const sections = [1, 2, 3].map((p) => {
    const rows = items.filter((i) => i.p === p).map((i) => {
      const open = openDeps(i, ids);
      return `<tr class="${ok.has(i.id) ? "ready" : "blocked"}${i.id === nextId ? " next" : ""}">` +
        `<td class="id">${i.id === nextId ? "▶ " : ""}${i.id}${hasDetail(i.id) ? '<span class="mark">+</span>' : ""}</td>` +
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
  case "stats": stats(); break;
  case "graph": graph(); break;
  case "html": html(args); break;
  case "help": case "--help": case "-h": help(); break;
  default: die("usage: todo.mjs add|next|list|show|set|detail|edit|tag|done|rm|stats|graph|html|help");
}
