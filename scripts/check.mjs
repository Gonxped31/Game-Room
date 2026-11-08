// Runs the project's checks, listed in scripts/check.json. Prints only what failed, then OK or FAIL.
// Usage: node scripts/check.mjs [--fast] [--verbose] [--rules]
//   --fast     skips steps marked "slow" (the pre-commit hook runs this)
//   --verbose  prints every step's full output
//   --<flag>   runs the steps marked { "flag": "--<flag>" }, which are skipped otherwise
//              (--rules: the database rules tests, which need Java and the emulator)
// A step: { "name": "test", "run": "npm test", "slow": true, "format": "vitest", "tail": 30 }.
// When it fails, a step with a "format" (tsc, eslint, vitest) prints one line per failure,
// `file:line message`; without one, or when the parser finds nothing, the last `tail` lines of
// its output are printed (default 20).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fast = args.includes("--fast");
const verbose = args.includes("--verbose");
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
/** A path relative to the repo, as tools print absolute ones. */
const rel = (p) => (path.isAbsolute(p) ? path.relative(ROOT, p).replace(/\\/g, "/") : p);

// ---- Failure parsers: the output of a failed step -> one `file:line message` per failure
const PARSERS = {
  // tsc: `file(line,col): error TSxxxx: message`
  tsc(out) {
    return [...out.matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+: .+)$/gm)].map((m) => `${rel(m[1])}:${m[2]} ${m[3]}`);
  },
  // eslint (stylish): a path line, then `  line:col  error  message  rule`
  eslint(out) {
    const found = [];
    let file = "";
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s+(\d+):\d+\s+error\s+(.+?)\s{2,}\S+\s*$/) ?? line.match(/^\s+(\d+):\d+\s+error\s+(.+)$/);
      if (m) found.push(`${rel(file)}:${m[1]} ${m[2].trim()}`);
      else if (/^\S.*\.(m?[jt]sx?|json)\s*$/.test(line) || /^(\/|[A-Za-z]:[\\/])/.test(line)) file = line.trim();
    }
    return found;
  },
  // vitest: ` FAIL  path > suite > test`, location from the first stack frame in the file
  vitest(out) {
    const found = [];
    const seen = new Set();
    for (const m of out.matchAll(/^\s*FAIL\s+(\S+)\s*>?\s*(.*)$/gm)) {
      const key = `${m[1]} ${m[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const at = out.indexOf(`${m[1]}:`);
      const loc = at >= 0 ? out.slice(at + m[1].length + 1).match(/^(\d+)/) : null;
      found.push(`${m[1]}${loc ? `:${loc[1]}` : ""} ${m[2] || "test file failed"}`.trim());
    }
    return found;
  },
};

let steps;
try {
  ({ steps } = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "check.json"), "utf8")));
  if (!Array.isArray(steps) || !steps.every((s) => typeof s.name === "string" && typeof s.run === "string")) {
    throw new Error('needs a "steps" array of { "name", "run" }');
  }
  const unknown = steps.find((s) => s.format !== undefined && !PARSERS[s.format]);
  if (unknown) throw new Error(`step "${unknown.name}": unknown format "${unknown.format}" (${Object.keys(PARSERS).join(", ")})`);
} catch (e) {
  console.log(`scripts/check.json: ${e.message}`);
  console.log("FAIL");
  process.exit(1);
}

const start = Date.now();
let ran = 0;
let failed = 0;
for (const step of steps) {
  if (fast && step.slow) continue;
  if (step.flag && !args.includes(step.flag)) continue;
  ran++;
  const r = spawnSync(step.run, { cwd: ROOT, shell: true, encoding: "utf8", maxBuffer: 1 << 28 });
  const out = strip(`${r.stdout ?? ""}${r.stderr ?? ""}`).trimEnd();
  if (verbose) console.log(`$ ${step.run}\n${out}`);
  if (r.status === 0) continue;
  failed++;
  const parsed = step.format ? PARSERS[step.format](out) : [];
  if (parsed.length) {
    for (const line of parsed) console.log(line);
    continue;
  }
  console.log(`${step.name}: FAIL`);
  if (verbose) continue;
  const lines = out.split(/\r?\n/);
  const tail = lines.slice(-(step.tail ?? 20));
  if (lines.length > tail.length) console.log(`  (${lines.length - tail.length} lines above; --verbose shows them)`);
  for (const line of tail) console.log(`  ${line}`);
}

const secs = ((Date.now() - start) / 1000).toFixed(1);
console.log(failed ? "FAIL" : `OK (${ran} step${ran === 1 ? "" : "s"}, ${secs}s)`);
process.exit(failed ? 1 : 0);
