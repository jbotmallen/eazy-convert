export type TrimMode = "fast" | "accurate";

export type TrimValidationResult =
  | { ok: true; clipSeconds: number }
  | { ok: false; error: string };

export function validateTrimRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
): TrimValidationResult {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || !Number.isFinite(durationSeconds)) {
    return { ok: false, error: "Enter valid start and end times." };
  }
  if (startSeconds < 0) return { ok: false, error: "Start time must be zero or greater." };
  if (endSeconds <= startSeconds) return { ok: false, error: "End time must be after start time." };
  if (endSeconds > durationSeconds) {
    return { ok: false, error: "End time must be within the video duration." };
  }
  return { ok: true, clipSeconds: endSeconds - startSeconds };
}
