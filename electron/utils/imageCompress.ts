import fs from "fs";
import path from "path";
import { z } from "zod";
import { getUniquePath } from "./helpers.js";

export type ImageCompressionOutputFormat = "auto" | "webp" | "jpg" | "png";
export type ResolvedImageCompressionOutputFormat = Exclude<ImageCompressionOutputFormat, "auto">;

export const IMAGE_COMPRESSION_PRESETS = {
  tiny: {
    quality: 45,
    maxDimension: 720,
  },
  small: {
    quality: 62,
    maxDimension: 1080,
  },
  balanced: {
    quality: 78,
    maxDimension: 1920,
  },
  "high-quality": {
    quality: 90,
  },
} as const;

export type ImageCompressionPresetId = keyof typeof IMAGE_COMPRESSION_PRESETS;

const IMAGE_COMPRESSION_OUTPUT_FORMATS = new Set<ImageCompressionOutputFormat>(["auto", "webp", "jpg", "png"]);

const maxDimensionSchema = z.union([
  z.literal(480),
  z.literal(720),
  z.literal(1080),
  z.literal(1440),
  z.literal(1920),
  z.literal(2560),
  z.literal(3840),
]);

export const imageCompressionOptionsSchema = z
  .object({
    quality: z.number().int().min(1).max(100).optional(),
    maxDimension: maxDimensionSchema.optional(),
  })
  .strict()
  .optional()
  .transform((value) => value ?? {});

export type ImageCompressionOptions = z.infer<typeof imageCompressionOptionsSchema>;

export function assertImageCompressionPresetId(value: unknown): asserts value is ImageCompressionPresetId {
  if (typeof value !== "string" || !(value in IMAGE_COMPRESSION_PRESETS)) {
    throw new Error("Invalid image compression preset.");
  }
}

export function assertImageCompressionOutputFormat(value: unknown): asserts value is ImageCompressionOutputFormat {
  if (typeof value !== "string" || !IMAGE_COMPRESSION_OUTPUT_FORMATS.has(value as ImageCompressionOutputFormat)) {
    throw new Error("Invalid image compression output format.");
  }
}

export function getAutoImageOutputFormat(inputExt: string): ResolvedImageCompressionOutputFormat {
  return inputExt.toLowerCase() === ".webp" ? "png" : "webp";
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

export function getImageCompressionOutputPath(
  inputPath: string,
  outputFormat: ResolvedImageCompressionOutputFormat,
): string {
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

function getJpegQualityScale(quality: number): string {
  const ffmpegQuality = Math.round(31 - ((quality - 1) / 99) * 29);
  return String(Math.max(2, Math.min(31, ffmpegQuality)));
}

function getScaleFilter(maxDimension: number): string {
  return `scale='if(gt(iw,ih),min(${maxDimension}\\,iw),-2)':'if(gte(ih,iw),min(${maxDimension}\\,ih),-2)'`;
}

export function buildImageCompressionArgs(
  presetId: ImageCompressionPresetId,
  outputFormat: ResolvedImageCompressionOutputFormat,
  options: ImageCompressionOptions = {},
): string[] {
  const preset = IMAGE_COMPRESSION_PRESETS[presetId];
  const quality = options.quality ?? preset.quality;
  const maxDimension = options.maxDimension ?? ("maxDimension" in preset ? preset.maxDimension : undefined);
  const args = ["-frames:v", "1", "-map_metadata", "-1"];

  if (maxDimension !== undefined) {
    args.push("-vf", getScaleFilter(maxDimension));
  }

  if (outputFormat === "webp") {
    args.push("-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6");
  } else if (outputFormat === "jpg") {
    args.push("-update", "1", "-c:v", "mjpeg", "-q:v", getJpegQualityScale(quality));
  } else {
    args.push("-update", "1", "-c:v", "png", "-compression_level", "9");
  }

  return args;
}
