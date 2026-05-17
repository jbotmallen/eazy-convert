export type AudioTrimMode = "fast" | "accurate";
export type AudioOutputFormat = "mp3" | "ogg" | "wav" | "aac" | "flac";
export type AudioQualityPreset = "standard" | "small" | "high" | "custom";
export type AudioChannelMode = "source" | "mono" | "stereo";

export type AudioCustomOptions = {
  bitrateKbps?: number;
  quality?: number;
  sampleRateHz?: number;
  channelMode?: AudioChannelMode;
  compressionLevel?: number;
};

export type AudioTrimOptions = {
  mode: AudioTrimMode;
  qualityPreset: AudioQualityPreset;
  custom?: AudioCustomOptions;
};

export type TrimValidationResult =
  | { ok: true; clipSeconds: number }
  | { ok: false; error: string };

export type TrimRange = {
  startSeconds: number;
  endSeconds: number;
};

const MIN_SLIDER_GAP_SECONDS = 0.1;

function roundTrimSecond(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clampSecond(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

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
  if (endSeconds > durationSeconds) return { ok: false, error: "End time must be within the audio duration." };
  return { ok: true, clipSeconds: endSeconds - startSeconds };
}

export function clampTrimRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
): TrimRange {
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  if (safeDuration === 0) return { startSeconds: 0, endSeconds: 0 };

  const orderedStart = Math.min(startSeconds, endSeconds);
  const orderedEnd = Math.max(startSeconds, endSeconds);
  let start = clampSecond(orderedStart, 0, safeDuration);
  let end = clampSecond(orderedEnd, 0, safeDuration);
  const minGap = Math.min(MIN_SLIDER_GAP_SECONDS, safeDuration);

  if (end - start < minGap) {
    if (end >= safeDuration) {
      start = Math.max(0, safeDuration - minGap);
      end = safeDuration;
    } else {
      end = Math.min(safeDuration, start + minGap);
      if (end - start < minGap) {
        start = Math.max(0, end - minGap);
      }
    }
  }

  return {
    startSeconds: roundTrimSecond(start),
    endSeconds: roundTrimSecond(end),
  };
}
