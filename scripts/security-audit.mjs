#!/usr/bin/env node
// Security audit: npm audit (parsed) + Electron version watermark + curated
// known-bad version list for native/parser libs that have shipped CVEs.
//
// Exit codes:
//   0 — clean (or only ignored advisories)
//   1 — high/critical advisory present OR pinned package below watermark
//
// Intended to run in CI and locally via `npm run audit:deps`.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// Minimum versions for packages with known historical CVEs. Bump these as
// new advisories drop. Format: semver "X.Y.Z" — comparison is numeric-major
// then numeric-minor then numeric-patch.
const MIN_VERSIONS = {
  electron: "33.0.0",          // Chromium baseline; raise when V8 CVEs land
  "pdf-parse": "2.4.5",
  "pdf-lib": "1.17.1",
  "pdfjs-dist": "5.4.624",
  mammoth: "1.11.0",
  "html-to-docx": "1.8.0",
  "youtube-dl-exec": "3.1.6",
  marked: "17.0.3",
  "ffmpeg-static": "5.3.0",
  "ffprobe-static": "3.1.0",
  zod: "3.23.8",
  lodash: "4.18.1",
};

// Versions we want to actively reject if they reappear via transitive resolution.
const KNOWN_BAD = [
  { name: "lodash", below: "4.18.1", reason: "Prototype pollution + _.template code injection unfixed in 4.17.x (GHSA-xxjr-mmjv-4gpg, GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh) — bumped to 4.18.x line" },
  { name: "minimatch", below: "3.0.5", reason: "ReDoS CVE-2022-3517" },
  { name: "node-fetch", below: "2.6.7", reason: "Information leak CVE-2022-0235" },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function compareSemver(a, b) {
  const pa = String(a).replace(/^\^|~/, "").split(/[.\-+]/).map((p) => Number.parseInt(p, 10) || 0);
  const pb = String(b).replace(/^\^|~/, "").split(/[.\-+]/).map((p) => Number.parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const delta = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

function getInstalledVersion(pkg) {
  const pkgJsonPath = path.join(repoRoot, "node_modules", pkg, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return null;
  try {
    return readJson(pkgJsonPath).version;
  } catch {
    return null;
  }
}

function runNpmAuditJson() {
  // Use spawnSync directly so we can capture JSON even when exit code is non-zero
  // (npm audit exits non-zero whenever it finds advisories — that's expected).
  const result = spawnSync("npm", ["audit", "--json", "--omit=dev"], {
    cwd: repoRoot,
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
  if (!result.stdout) {
    return { error: result.stderr || "npm audit produced no output" };
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    return { error: `Failed to parse npm audit output: ${err.message}` };
  }
}

function summarizeAudit(audit) {
  if (audit.error && typeof audit.error === "string") return { error: audit.error };
  // npm error shape: { message, error: { summary, detail } } — surfaces when the
  // audit endpoint is unreachable (corp proxy, TLS interception, offline).
  if (audit.message && audit.error && typeof audit.error === "object") {
    return { error: `npm audit endpoint error: ${audit.message}` };
  }
  if (!audit.metadata) {
    return { error: `Unexpected npm audit payload (no metadata field)` };
  }
  const meta = audit.metadata?.vulnerabilities ?? {};
  const advisories = [];
  for (const [name, entry] of Object.entries(audit.vulnerabilities ?? {})) {
    if (!entry?.severity || entry.severity === "info") continue;
    advisories.push({
      name,
      severity: entry.severity,
      via: (entry.via ?? []).map((v) => (typeof v === "string" ? v : v?.title ?? v?.source)).filter(Boolean),
      range: entry.range,
      fixAvailable: Boolean(entry.fixAvailable),
    });
  }
  return { meta, advisories };
}

function checkMinVersions() {
  const failures = [];
  for (const [pkg, min] of Object.entries(MIN_VERSIONS)) {
    const installed = getInstalledVersion(pkg);
    if (!installed) continue;
    if (compareSemver(installed, min) < 0) {
      failures.push({ pkg, installed, min });
    }
  }
  return failures;
}

function checkKnownBad() {
  const hits = [];
  for (const entry of KNOWN_BAD) {
    const installed = getInstalledVersion(entry.name);
    if (!installed) continue;
    if (compareSemver(installed, entry.below) < 0) {
      hits.push({ ...entry, installed });
    }
  }
  return hits;
}

function checkYtDlpBundled() {
  const ytDlpPath = path.join(repoRoot, "node_modules", "youtube-dl-exec", "bin", "yt-dlp.exe");
  if (!fs.existsSync(ytDlpPath)) {
    return { ok: true, skipped: true, reason: "yt-dlp binary not present (non-Windows build host?)" };
  }
  try {
    const version = execFileSync(ytDlpPath, ["--version"], { encoding: "utf-8", windowsHide: true }).trim();
    return { ok: true, version };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function header(label) {
  console.log(`\n${DIM}── ${label} ──${RESET}`);
}

function main() {
  let exitCode = 0;

  header("npm audit (production deps)");
  const audit = summarizeAudit(runNpmAuditJson());
  if (audit.error) {
    console.log(`${YELLOW}npm audit unavailable: ${audit.error}${RESET}`);
  } else {
    const m = audit.meta;
    console.log(
      `info=${m.info ?? 0}  low=${m.low ?? 0}  moderate=${m.moderate ?? 0}  ` +
      `${RED}high=${m.high ?? 0}${RESET}  ${RED}critical=${m.critical ?? 0}${RESET}`,
    );
    if ((m.high ?? 0) + (m.critical ?? 0) > 0) {
      exitCode = 1;
      console.log(`${RED}High/critical advisories present:${RESET}`);
      for (const a of audit.advisories.filter((x) => x.severity === "high" || x.severity === "critical")) {
        console.log(`  ${RED}${a.severity.toUpperCase()}${RESET} ${a.name}@${a.range} — fix available: ${a.fixAvailable}`);
        for (const via of a.via.slice(0, 3)) console.log(`    via: ${via}`);
      }
    }
  }

  header("Pinned-version watermarks");
  const belowMin = checkMinVersions();
  if (belowMin.length === 0) {
    console.log(`${GREEN}All watched packages at or above watermark.${RESET}`);
  } else {
    exitCode = 1;
    for (const f of belowMin) {
      console.log(`${RED}OUTDATED${RESET} ${f.pkg} installed=${f.installed} required>=${f.min}`);
    }
  }

  header("Known-bad transitive versions");
  const bad = checkKnownBad();
  if (bad.length === 0) {
    console.log(`${GREEN}No known-bad transitive versions detected.${RESET}`);
  } else {
    exitCode = 1;
    for (const h of bad) {
      console.log(`${RED}REJECTED${RESET} ${h.name}@${h.installed} (must be >= ${h.below}) — ${h.reason}`);
    }
  }

  header("Bundled yt-dlp");
  const ytdlp = checkYtDlpBundled();
  if (ytdlp.skipped) console.log(`${YELLOW}skipped — ${ytdlp.reason}${RESET}`);
  else if (ytdlp.ok) console.log(`${GREEN}bundled yt-dlp ${ytdlp.version}${RESET}`);
  else { console.log(`${RED}yt-dlp check failed: ${ytdlp.reason}${RESET}`); exitCode = 1; }

  header("Result");
  if (exitCode === 0) console.log(`${GREEN}PASS${RESET}`);
  else console.log(`${RED}FAIL — see findings above${RESET}`);

  process.exit(exitCode);
}

main();
