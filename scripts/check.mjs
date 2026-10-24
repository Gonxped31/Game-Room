// One command for typecheck + lint + tests. One line per failure, then OK or FAIL.
// Usage: node scripts/check.mjs [--verbose] [--rules]
import { spawnSync } from "node:child_process";

const verbose = process.argv.includes("--verbose");
const withRules = process.argv.includes("--rules");
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function run(cmd) {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", maxBuffer: 1 << 28 });
  const out = strip(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  if (verbose) process.stdout.write(`$ ${cmd}\n${out}\n`);
  return { ok: r.status === 0, out };
}

const failures = [];

// tsc: `file(line,col): error TSxxxx: message`
const tsc = run("npx tsc --noEmit");
if (!tsc.ok) {
  const found = [...tsc.out.matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+: .+)$/gm)];
  for (const m of found) failures.push(`${m[1]}:${m[2]} ${m[3]}`);
  if (!found.length) failures.push(`tsc: ${tsc.out.trim().split("\n")[0] || "failed"}`);
}

// eslint (stylish): a path line, then `  line:col  error  message  rule`
const lint = run("npm run lint");
if (!lint.ok) {
  let file = "";
  let n = 0;
  for (const line of lint.out.split("\n")) {
    const m = line.match(/^\s+(\d+):\d+\s+error\s+(.+?)\s{2,}\S+\s*$/) ?? line.match(/^\s+(\d+):\d+\s+error\s+(.+)$/);
    if (m) {
      failures.push(`${file}:${m[1]} ${m[2].trim()}`);
      n++;
    } else if (/^\S.*\.(m?[jt]sx?|json)\s*$/.test(line) || /^(\/|[A-Za-z]:[\/])/.test(line)) {
      file = line.trim();
    }
  }
  if (!n) failures.push(`lint: ${lint.out.trim().split("\n").pop() || "failed"}`);
}

// vitest: ` FAIL  path > suite > test`, location from the first stack frame in the file
const test = run("npm test");
if (!test.ok) {
  const found = [...test.out.matchAll(/^\s*FAIL\s+(\S+)\s*>?\s*(.*)$/gm)];
  const seen = new Set();
  for (const m of found) {
    const key = `${m[1]} ${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const at = test.out.indexOf(`${m[1]}:`);
    const loc = at >= 0 ? test.out.slice(at + m[1].length + 1).match(/^(\d+)/) : null;
    failures.push(`${m[1]}${loc ? ":" + loc[1] : ""} ${m[2] || "test file failed"}`.trim());
  }
  if (!found.length) failures.push(`test: ${test.out.trim().split("\n").pop() || "failed"}`);
}

if (withRules) {
  const rules = run("npm run test:rules");
  if (!rules.ok) failures.push(`test:rules ${rules.out.trim().split("\n").pop() || "failed"}`);
}

for (const f of failures) console.log(f);
console.log(failures.length ? "FAIL" : "OK");
process.exit(failures.length ? 1 : 0);
