import { randomUUID } from "crypto";
import path from "path";

export type AudioOutputFormat = "mp3" | "ogg" | "wav" | "aac" | "flac";
export type AudioTrimPreset = "standard" | "small" | "high" | "custom";
export type AudioTrimMode = "fast" | "accurate";
export type AudioChannelMode = "source" | "mono" | "stereo";

export type AudioCustomOptions = {
  bitrateKbps?: number;
  sampleRateHz?: number;
  channelMode?: AudioChannelMode;
  quality?: number;
  compressionLevel?: number;
};

export type AudioTrimOptions = {
  mode: AudioTrimMode;
  qualityPreset: AudioTrimPreset;
  custom?: AudioCustomOptions;
};

export type AudioTrimValidationResult =
  | { ok: true; clipSeconds: number }
  | { ok: false; error: string };

const AUDIO_OUTPUT_FORMATS: AudioOutputFormat[] = ["mp3", "ogg", "wav", "aac", "flac"];
const AUDIO_TRIM_PRESETS: AudioTrimPreset[] = ["standard", "small", "high", "custom"];
const AUDIO_TRIM_MODES: AudioTrimMode[] = ["fast", "accurate"];
const AUDIO_CHANNEL_MODES: AudioChannelMode[] = ["source", "mono", "stereo"];

type FormatPresetArgs = Record<AudioTrimPreset, string[]>;

const AUDIO_TRIM_ARGS: Record<AudioOutputFormat, FormatPresetArgs> = {
  mp3: {
    standard: ["-c:a", "libmp3lame", "-q:a", "2"],
    small: ["-c:a", "libmp3lame", "-q:a", "5"],
    high: ["-c:a", "libmp3lame", "-q:a", "0"],
    custom: ["-c:a", "libmp3lame"],
  },
  ogg: {
    standard: ["-c:a", "libvorbis", "-q:a", "4"],
    small: ["-c:a", "libvorbis", "-q:a", "2"],
    high: ["-c:a", "libvorbis", "-q:a", "6"],
    custom: ["-c:a", "libvorbis"],
  },
  wav: {
    standard: ["-c:a", "pcm_s16le"],
    small: ["-c:a", "pcm_s16le"],
    high: ["-c:a", "pcm_s16le"],
    custom: ["-c:a", "pcm_s16le"],
  },
  aac: {
    standard: ["-c:a", "aac", "-b:a", "192k"],
    small: ["-c:a", "aac", "-b:a", "128k"],
    high: ["-c:a", "aac", "-b:a", "256k"],
    custom: ["-c:a", "aac"],
  },
  flac: {
    standard: ["-c:a", "flac", "-compression_level", "5"],
    small: ["-c:a", "flac", "-compression_level", "8"],
    high: ["-c:a", "flac", "-compression_level", "3"],
    custom: ["-c:a", "flac"],
  },
};

export function assertAudioOutputFormat(value: unknown): asserts value is AudioOutputFormat {
  if (typeof value !== "string" || !AUDIO_OUTPUT_FORMATS.includes(value as AudioOutputFormat)) {
    throw new Error("Invalid audio output format.");
  }
}

export function assertAudioTrimPreset(value: unknown): asserts value is AudioTrimPreset {
  if (typeof value !== "string" || !AUDIO_TRIM_PRESETS.includes(value as AudioTrimPreset)) {
    throw new Error("Invalid audio trim preset.");
  }
}

export function validateAudioTrimOptions(value: unknown): AudioTrimOptions {
  if (value == null) return { mode: "accurate", qualityPreset: "standard" };
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid audio trim options.");

  const options = value as Partial<AudioTrimOptions>;
  const mode = options.mode ?? "accurate";
  const qualityPreset = options.qualityPreset ?? "standard";
  if (!AUDIO_TRIM_MODES.includes(mode)) throw new Error("Invalid audio trim mode.");
  if (!AUDIO_TRIM_PRESETS.includes(qualityPreset)) throw new Error("Invalid audio trim preset.");

  const custom = options.custom ?? {};
  if (
    custom.bitrateKbps !== undefined &&
    (!Number.isInteger(custom.bitrateKbps) || custom.bitrateKbps < 32 || custom.bitrateKbps > 512)
  ) {
    throw new Error("Invalid audio bitrate.");
  }
  if (
    custom.sampleRateHz !== undefined &&
    (!Number.isInteger(custom.sampleRateHz) || custom.sampleRateHz < 8_000 || custom.sampleRateHz > 192_000)
  ) {
    throw new Error("Invalid audio sample rate.");
  }
  if (custom.channelMode !== undefined && !AUDIO_CHANNEL_MODES.includes(custom.channelMode)) {
    throw new Error("Invalid audio channel mode.");
  }
  if (
    custom.quality !== undefined &&
    (!Number.isInteger(custom.quality) || custom.quality < 0 || custom.quality > 10)
  ) {
    throw new Error("Invalid audio quality.");
  }
  if (
    custom.compressionLevel !== undefined &&
    (!Number.isInteger(custom.compressionLevel) || custom.compressionLevel < 0 || custom.compressionLevel > 12)
  ) {
    throw new Error("Invalid audio compression level.");
  }

  return { mode, qualityPreset, custom };
}

export function validateAudioTrimRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
): AudioTrimValidationResult {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || !Number.isFinite(durationSeconds)) {
    return { ok: false, error: "Enter valid start and end times." };
  }
  if (startSeconds < 0) return { ok: false, error: "Start time must be zero or greater." };
  if (endSeconds <= startSeconds) return { ok: false, error: "End time must be after start time." };
  if (endSeconds > durationSeconds) {
    return { ok: false, error: "End time must be within the audio duration." };
  }
  return { ok: true, clipSeconds: endSeconds - startSeconds };
}

export function getAudioTrimOutputPath(inputPath: string, outputFormat: AudioOutputFormat): string {
  const inputExt = path.extname(inputPath);
  const token = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  return path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, inputExt)}_trimmed_${token}.${outputFormat}`,
  );
}

export function buildAudioTrimArgs(
  outputFormat: AudioOutputFormat,
  options: AudioTrimOptions,
): string[] {
  const preset = options.qualityPreset;
  const custom = options.custom ?? {};
  const args = [...AUDIO_TRIM_ARGS[outputFormat][preset]];
  if (preset === "custom") {
    if (custom.bitrateKbps !== undefined && (outputFormat === "mp3" || outputFormat === "aac")) {
      args.push("-b:a", `${custom.bitrateKbps}k`);
    }
    if (custom.quality !== undefined && (outputFormat === "mp3" || outputFormat === "ogg")) {
      args.push("-q:a", String(custom.quality));
    }
    if (custom.compressionLevel !== undefined && outputFormat === "flac") {
      args.push("-compression_level", String(custom.compressionLevel));
    }
  }
  if (custom.sampleRateHz !== undefined) {
    args.push("-ar", String(custom.sampleRateHz));
  }
  if (custom.channelMode === "mono") {
    args.push("-ac", "1");
  } else if (custom.channelMode === "stereo") {
    args.push("-ac", "2");
  }
  return args;
}
