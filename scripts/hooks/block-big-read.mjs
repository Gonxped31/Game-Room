// PreToolUse hook for Read: refuse a whole-file read of a text file over MAX_LINES.
// Fails open: any error, or a read with a `limit`, lets the call through. So do images and PDFs,
// which Read shows as pictures or by page, and other binary files: their "lines" mean nothing.
import { readFileSync, statSync } from "node:fs";

const MAX_LINES = 1500;
const SHOWN_AS_IS = /\.(png|jpe?g|gif|webp|bmp|ico|pdf)$/i;

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const { file_path: file, limit } = input.tool_input ?? {};
  if (file && !limit && !SHOWN_AS_IS.test(file) && statSync(file).size > 20_000) {
    const data = readFileSync(file);
    const binary = data.subarray(0, 8000).includes(0); // git's test: a NUL byte near the start
    const lines = binary ? 0 : data.toString("utf8").split("\n").length;
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
