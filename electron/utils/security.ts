import fs from "fs";
import path from "path";

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const EXTERNAL_PROTOCOLS = new Set(["https:"]);
// Desktop allowlist. Stricter than the web build: every host here must be reachable
// from a button shipped inside the packaged app (landing page + in-app links).
// The landing page itself runs unrestricted in a regular browser, so this list
// only governs window.api.openExternal calls from the Electron renderer.
const EXTERNAL_HOSTS = new Set([
  "aka.ms",
  "github.com",
  "www.github.com",
  "linkedin.com",
  "www.linkedin.com",
]);
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);
const VIDEO_QUALITIES = new Set(["original", "360", "480", "720", "1080", "1440", "2160"]);
const YOUTUBE_QUALITIES = new Set(["best", "360", "480", "720", "1080", "1440", "2160"]);
const DOWNLOAD_FORMATS = new Set(["mp4", "mp3"]);

function parseUrl(value: string): URL | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isAllowedExternalUrl(value: string): boolean {
  const url = parseUrl(value);
  return !!url && EXTERNAL_PROTOCOLS.has(url.protocol) && EXTERNAL_HOSTS.has(url.hostname.toLowerCase());
}

export function isAllowedYoutubeUrl(value: string): boolean {
  const url = parseUrl(value);
  return !!url && url.protocol === "https:" && YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
}

export function isAllowedVideoQuality(value: string): boolean {
  return typeof value === "string" && VIDEO_QUALITIES.has(value);
}

export function isAllowedYoutubeQuality(value: string): boolean {
  return typeof value === "string" && YOUTUBE_QUALITIES.has(value);
}

export function isAllowedDownloadFormat(value: string): value is "mp4" | "mp3" {
  return typeof value === "string" && DOWNLOAD_FORMATS.has(value);
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasTraversalSegment(filePath: string): boolean {
  return filePath.split(/[\\/]+/).includes("..");
}

export function isAllowedDocumentPath(filePath: string, allowedExts: readonly string[]): boolean {
  if (typeof filePath !== "string") return false;
  if (!path.isAbsolute(filePath)) return false;
  if (hasTraversalSegment(filePath)) return false;

  const allowed = new Set(allowedExts.map((ext) => ext.toLowerCase()));
  return allowed.has(path.extname(filePath).toLowerCase());
}

export function assertExistingDocumentPath(filePath: string, allowedExts: readonly string[]): void {
  if (!isAllowedDocumentPath(filePath, allowedExts)) {
    throw new Error("Invalid document path.");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("Document file not found.");
  }
}

export function assertStatWithinDocumentLimit(stat: fs.Stats): void {
  if (!stat.isFile()) {
    throw new Error("Document file not found.");
  }
  if (stat.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new Error("Document is too large. Maximum allowed size is 100 MiB.");
  }
}

export function assertDocumentFileWithinLimit(filePath: string): void {
  assertStatWithinDocumentLimit(fs.statSync(filePath));
}

// Reads a file fully while enforcing the document size limit against the same
// file descriptor used for the read. Opening once and validating via fstat
// closes the time-of-check/time-of-use gap — the file cannot be swapped for a
// different (e.g. oversized) one between the size check and the read.
export function readFileWithinDocumentLimit(filePath: string): Buffer {
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    assertStatWithinDocumentLimit(stat);
    const buffer = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < stat.size) {
      const bytesRead = fs.readSync(fd, buffer, offset, stat.size - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return offset === stat.size ? buffer : buffer.subarray(0, offset);
  } finally {
    fs.closeSync(fd);
  }
}

export function assertDocumentPathList(filePaths: string[], allowedExts: readonly string[], minCount = 1): void {
  if (!Array.isArray(filePaths) || filePaths.length < minCount) {
    throw new Error(`Select at least ${minCount} file${minCount === 1 ? "" : "s"}.`);
  }
  for (const filePath of filePaths) {
    assertExistingDocumentPath(filePath, allowedExts);
  }
}
