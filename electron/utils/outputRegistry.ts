import path from "path";

// Tracks absolute paths this process has produced as outputs for the user.
// `*:show-in-folder` handlers and `image:background-edit:*` use this set to
// reject arbitrary renderer-supplied paths. Without it, a compromised renderer
// could shell.showItemInFolder() on any file with a whitelisted extension
// (recon / phishing surface) and the background-edit handlers could read or
// write any .png/.webp on disk.
//
// Bounded LRU: the registry grew unboundedly across a session under prior
// design (every produced output inserted, nothing evicted). 4096 outputs is
// well above realistic per-session usage and keeps memory pressure flat.
const MAX_PRODUCED_OUTPUTS = 4096;
const producedOutputs = new Map<string, true>();

function touch(resolved: string): void {
  if (producedOutputs.has(resolved)) producedOutputs.delete(resolved);
  producedOutputs.set(resolved, true);
  while (producedOutputs.size > MAX_PRODUCED_OUTPUTS) {
    const oldest = producedOutputs.keys().next().value;
    if (oldest === undefined) break;
    producedOutputs.delete(oldest);
  }
}

export function registerProducedOutput(filePath: string): string {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
    throw new Error("Invalid output path.");
  }
  const resolved = path.resolve(filePath);
  touch(resolved);
  return resolved;
}

export function isProducedOutput(filePath: unknown): boolean {
  if (typeof filePath !== "string") return false;
  return producedOutputs.has(path.resolve(filePath));
}

export function assertProducedOutput(filePath: unknown): string {
  if (typeof filePath !== "string") throw new Error("Invalid output path.");
  const resolved = path.resolve(filePath);
  if (!producedOutputs.has(resolved)) {
    throw new Error("Output path is not a recognised app-produced file.");
  }
  return resolved;
}
