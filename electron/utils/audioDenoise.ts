import { randomUUID } from "crypto";
import path from "path";

export type DenoiseEngine = "rnnoise" | "fft";
export type DenoisePreset = "light" | "medium" | "aggressive";
export type RnnoiseModelName = "sh" | "cb" | "mp";
export type AudioDenoiseOutputFormat = "mp3" | "ogg" | "wav" | "aac" | "flac";

export type AudioDenoiseOptions =
  | { engine: "rnnoise"; preset: DenoisePreset; model: RnnoiseModelName }
  | { engine: "fft"; preset: DenoisePreset };

const DENOISE_ENGINES: DenoiseEngine[] = ["rnnoise", "fft"];
const DENOISE_PRESETS: DenoisePreset[] = ["light", "medium", "aggressive"];
const RNNOISE_MODEL_NAMES: RnnoiseModelName[] = ["sh", "cb", "mp"];
const AUDIO_DENOISE_OUTPUT_FORMATS: AudioDenoiseOutputFormat[] = [
  "mp3",
  "ogg",
  "wav",
  "aac",
  "flac",
];

const RNNOISE_MIX: Record<DenoisePreset, number> = {
  light: 0.3,
  medium: 0.6,
  aggressive: 1.0,
};

const AFFTDN_NR_DB: Record<DenoisePreset, number> = {
  light: 6,
  medium: 12,
  aggressive: 24,
};

const AUDIO_ENCODER_ARGS: Record<AudioDenoiseOutputFormat, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  ogg: ["-c:a", "libvorbis", "-q:a", "4"],
  wav: ["-c:a", "pcm_s16le"],
  aac: ["-c:a", "aac", "-b:a", "192k"],
  flac: ["-c:a", "flac", "-compression_level", "5"],
};

export function isRnnoiseModelName(value: unknown): value is RnnoiseModelName {
  return typeof value === "string" && (RNNOISE_MODEL_NAMES as string[]).includes(value);
}

export function assertDenoiseEngine(value: unknown): asserts value is DenoiseEngine {
  if (typeof value !== "string" || !DENOISE_ENGINES.includes(value as DenoiseEngine)) {
    throw new Error("Invalid denoise engine.");
  }
}

export function assertDenoisePreset(value: unknown): asserts value is DenoisePreset {
  if (typeof value !== "string" || !DENOISE_PRESETS.includes(value as DenoisePreset)) {
    throw new Error("Invalid denoise preset.");
  }
}

export function assertAudioDenoiseOutputFormat(
  value: unknown,
): asserts value is AudioDenoiseOutputFormat {
  if (
    typeof value !== "string" ||
    !AUDIO_DENOISE_OUTPUT_FORMATS.includes(value as AudioDenoiseOutputFormat)
  ) {
    throw new Error("Invalid audio output format.");
  }
}

export function validateDenoiseOptions(value: unknown): AudioDenoiseOptions {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid denoise options.");
  }
  const opts = value as { engine?: unknown; preset?: unknown; model?: unknown };
  assertDenoiseEngine(opts.engine);
  assertDenoisePreset(opts.preset);
  if (opts.engine === "rnnoise") {
    const model = opts.model ?? "sh";
    if (!isRnnoiseModelName(model)) throw new Error("Invalid RNNoise model.");
    return { engine: "rnnoise", preset: opts.preset, model };
  }
  return { engine: "fft", preset: opts.preset };
}

// FFmpeg filter-graph metacharacters: , ; [ ] \ ' : and the single quote used
// for the outer string literal. The single-quote wrap below removes the special
// meaning of most of these; we still escape backslash and single-quote inside
// the quoted region per FFmpeg's "ffmpeg-utils" quoting rules.
export function escapeFfmpegFilterPath(p: string): string {
  const forwardSlashed = p.replace(/\\/g, "/");
  const inner = forwardSlashed.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${inner}'`;
}

export function buildAfftdnFilter(preset: DenoisePreset): string {
  const nr = AFFTDN_NR_DB[preset];
  return `afftdn=nr=${nr}:nf=-50:nt=w`;
}

export function buildArnndnFilter(preset: DenoisePreset, modelPath: string): string {
  const mix = RNNOISE_MIX[preset];
  return `arnndn=m=${escapeFfmpegFilterPath(modelPath)}:mix=${mix}`;
}

export function buildAudioDenoiseEncoderArgs(format: AudioDenoiseOutputFormat): string[] {
  return [...AUDIO_ENCODER_ARGS[format]];
}

export function getAudioDenoiseOutputPath(
  inputPath: string,
  outputFormat: AudioDenoiseOutputFormat,
): string {
  const inputExt = path.extname(inputPath);
  const token = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  return path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, inputExt)}_denoised_${token}.${outputFormat}`,
  );
}

export function getVideoDenoiseOutputPath(inputPath: string): string {
  const inputExt = path.extname(inputPath);
  const token = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  return path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, inputExt)}_denoised_${token}${inputExt}`,
  );
}
