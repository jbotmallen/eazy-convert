import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIN_YT_DLP_VERSION = "2026.02.21";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const ytDlpPath = path.join(
  repoRoot,
  "node_modules",
  "youtube-dl-exec",
  "bin",
  "yt-dlp.exe",
);

function compareVersion(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i += 1) {
    const delta = (leftParts[i] ?? 0) - (rightParts[i] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }

  return 0;
}

if (!fs.existsSync(ytDlpPath)) {
  throw new Error(`Missing bundled yt-dlp binary: ${ytDlpPath}`);
}

const version = execFileSync(ytDlpPath, ["--version"], {
  encoding: "utf-8",
  windowsHide: true,
}).trim();

if (compareVersion(version, MIN_YT_DLP_VERSION) < 0) {
  throw new Error(
    `Bundled yt-dlp ${version} is below patched minimum ${MIN_YT_DLP_VERSION}. Run npm install to refresh yt-dlp-exec binary.`,
  );
}

console.log(`Bundled yt-dlp ${version} satisfies patched minimum ${MIN_YT_DLP_VERSION}.`);
