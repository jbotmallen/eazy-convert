import { z } from "zod";

export type ImageCompressionPresetId = "tiny" | "small" | "balanced" | "high-quality";
export type ImageCompressionOutputFormat = "auto" | "webp" | "jpg" | "png";

export type ImageCompressionPreset = {
  id: ImageCompressionPresetId;
  label: string;
  description: string;
  tooltip: string;
};

export const IMAGE_COMPRESSION_PRESETS = [
  {
    id: "tiny",
    label: "Tiny",
    description: "Strongest compression for small previews and quick sharing.",
    tooltip: "Creates the smallest static image output. Caps the longest edge at 720 px.",
  },
  {
    id: "small",
    label: "Small",
    description: "Compact output with cleaner detail for everyday sharing.",
    tooltip: "Creates a compact static image with cleaner detail. Caps the longest edge at 1080 px.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default compression for smaller files with solid quality.",
    tooltip: "Creates a balanced image with smaller size and solid quality. Caps the longest edge at 1920 px.",
  },
  {
    id: "high-quality",
    label: "High Quality",
    description: "Lighter compression that keeps more source detail.",
    tooltip: "Creates a higher quality output while preserving more source detail at original dimensions.",
  },
] as const satisfies readonly ImageCompressionPreset[];

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

export function isImageCompressionPresetId(value: string): value is ImageCompressionPresetId {
  return IMAGE_COMPRESSION_PRESETS.some((preset) => preset.id === value);
}

export function isImageCompressionOutputFormat(value: string): value is ImageCompressionOutputFormat {
  return value === "auto" || value === "webp" || value === "jpg" || value === "png";
}

export function getAutoImageOutputFormat(inputExt: string): Exclude<ImageCompressionOutputFormat, "auto"> {
  return inputExt.toLowerCase() === ".webp" ? "png" : "webp";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const formatted = unitIndex === 0 ? String(Math.round(value)) : Number(value.toFixed(1)).toString();
  return `${formatted} ${units[unitIndex]}`;
}
