import fs from "fs";

export const MAX_MEDIA_FILE_SIZE_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_MEDIA_DURATION_SECONDS = 6 * 60 * 60;

export function assertMediaFileWithinLimit(filePath: string): void {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error("Media file not found.");
  if (stat.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    throw new Error("Media file is too large. Maximum allowed size is 4 GiB.");
  }
}

export function assertMediaDurationWithinLimit(durationSeconds: number): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Could not read media duration.");
  }
  if (durationSeconds > MAX_MEDIA_DURATION_SECONDS) {
    throw new Error("Media duration is too long. Maximum allowed duration is 6 hours.");
  }
}
