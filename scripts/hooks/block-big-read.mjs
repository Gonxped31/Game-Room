// PreToolUse hook for Read: refuse a whole-file read of a file over MAX_LINES.
// Fails open: any error, or a read with a `limit`, lets the call through.
import { readFileSync, statSync } from "node:fs";

const MAX_LINES = 1500;

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const { file_path: file, limit } = input.tool_input ?? {};
  if (file && !limit && statSync(file).size > 20_000) {
    const lines = readFileSync(file, "utf8").split("\n").length;
    if (lines > MAX_LINES) {
      console.error(
        `${file} has ${lines} lines (over ${MAX_LINES}). Use Grep to find what you need, or Read with offset and limit.`,
      );
      process.exit(2);
    }
  }
} catch {
  // fail open
}
