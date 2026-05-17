import path from "path";
import fs from "fs";
import { z } from "zod";
import { getUniquePath } from "./helpers.js";

export type CompressionOutputFormat = "mp4" | "webm" | "avi" | "mov" | "mkv";

const COMPRESSION_OUTPUT_FORMATS = new Set<CompressionOutputFormat>(["mp4", "webm", "avi", "mov", "mkv"]);

export const COMPRESSION_PRESETS = {
  tiny: {
    crf: "32",
    audioBitrate: "96k",
    maxHeight: 360,
  },
  small: {
    crf: "30",
    audioBitrate: "128k",
    maxHeight: 720,
  },
  balanced: {
    crf: "26",
    audioBitrate: "128k",
    maxHeight: 1080,
  },
  "high-quality": {
    crf: "21",
    audioBitrate: "160k",
  },
} as const;

export type CompressionPresetId = keyof typeof COMPRESSION_PRESETS;

const maxHeightSchema = z.union([
  z.literal(360),
  z.literal(480),
  z.literal(720),
  z.literal(1080),
  z.literal(1440),
  z.literal(2160),
]);

export const compressionOptionsSchema = z
  .object({
    crf: z.number().int().min(18).max(35).optional(),
    maxHeight: maxHeightSchema.optional(),
  })
  .strict()
  .optional()
  .transform((value) => value ?? {});

export type CompressionOptions = z.infer<typeof compressionOptionsSchema>;

export function assertCompressionPresetId(presetId: unknown): asserts presetId is CompressionPresetId {
  if (typeof presetId !== "string" || !(presetId in COMPRESSION_PRESETS)) {
    throw new Error("Invalid compression preset.");
  }
}

export function assertCompressionOutputFormat(value: unknown): asserts value is CompressionOutputFormat {
  if (typeof value !== "string" || !COMPRESSION_OUTPUT_FORMATS.has(value as CompressionOutputFormat)) {
    throw new Error("Invalid compression output format.");
  }
}

function createCompressionTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  // Format: YYYYMMDD-HHMMSS
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function getCompressionOutputPath(inputPath: string, outputFormat: CompressionOutputFormat): string {
  const inputExt = path.extname(inputPath);
  const outputPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, inputExt)}_compressed_${createCompressionTimestamp()}.${outputFormat}`,
  );
  let candidate = getUniquePath(outputPath);
  const candidateExt = path.extname(candidate);
  const candidateBase = candidate.slice(0, -candidateExt.length);
  let suffix = 1;

  while (fs.existsSync(candidate)) {
    candidate = `${candidateBase}_${suffix}${candidateExt}`;
    suffix++;
  }

  return candidate;
}

export function buildCompressionArgs(
  presetId: CompressionPresetId,
  outputFormat: CompressionOutputFormat,
  options: CompressionOptions = {},
): string[] {
  const preset = COMPRESSION_PRESETS[presetId];
  const customCrf = options.crf;
  const customMaxHeight = options.maxHeight;
  const args = outputFormat === "webm"
    ? [
      "-c:v",
      "libvpx-vp9",
      "-crf",
      String(customCrf ?? preset.crf),
      "-b:v",
      "0",
      "-cpu-used",
      "5",
      "-row-mt",
      "1",
      "-threads",
      "0",
    ]
    : [
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      String(customCrf ?? preset.crf),
    ];

  if (customMaxHeight !== undefined) {
    args.push("-vf", `scale=-2:min(${options.maxHeight}\\,ih)`);
  } else if ("maxHeight" in preset) {
    args.push("-vf", `scale=-2:min(${preset.maxHeight}\\,ih)`);
  }

  if (outputFormat === "webm") {
    args.push("-c:a", "libopus");
  } else {
    if (outputFormat === "mp4" || outputFormat === "mov") args.push("-pix_fmt", "yuv420p");
    if (outputFormat === "mp4") args.push("-movflags", "+faststart");
    args.push("-c:a", "aac", "-b:a", preset.audioBitrate);
  }

  return args;
}
