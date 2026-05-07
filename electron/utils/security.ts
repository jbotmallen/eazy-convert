import fs from "fs";
import path from "path";

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const EXTERNAL_PROTOCOLS = new Set(["https:"]);
const EXTERNAL_HOSTS = new Set(["aka.ms"]);
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

export function assertDocumentFileWithinLimit(filePath: string): void {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error("Document file not found.");
  }
  if (stat.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new Error("Document is too large. Maximum allowed size is 100 MiB.");
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
