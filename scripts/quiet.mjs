// Run a command: one summary line on success, full output only on failure.
// Usage: node scripts/quiet.mjs <label> <command...>
import { spawnSync } from "node:child_process";

const [label, ...cmd] = process.argv.slice(2);
const start = Date.now();
const r = spawnSync(cmd.join(" "), { shell: true, encoding: "utf8", maxBuffer: 1 << 28 });
const secs = ((Date.now() - start) / 1000).toFixed(1);
if (r.status === 0) {
  console.log(`${label}: OK (${secs}s)`);
} else {
  process.stdout.write(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  console.log(`${label}: FAIL (${secs}s)`);
}
process.exit(r.status ?? 1);
