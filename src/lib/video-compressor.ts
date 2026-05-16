import { z } from "zod";

export type CompressionPresetId = "tiny" | "small" | "balanced" | "high-quality";

export type CompressionPreset = {
  id: CompressionPresetId;
  label: string;
  description: string;
  tooltip: string;
};

export const COMPRESSION_PRESETS = [
  {
    id: "tiny",
    label: "Tiny",
    description: "Strongest compression for small previews and quick sharing.",
    tooltip: "Creates the smallest output for previews and fast sharing. Caps 16:9 video at 640 x 360.",
  },
  {
    id: "small",
    label: "Small",
    description: "Strong compression with cleaner detail for everyday sharing.",
    tooltip: "Creates a compact output with cleaner detail for everyday sharing. Caps 16:9 video at 1280 x 720.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default compression for a smaller file with solid quality.",
    tooltip: "Creates a balanced output with smaller size and solid quality. Caps 16:9 video at 1920 x 1080.",
  },
  {
    id: "high-quality",
    label: "High Quality",
    description: "Lighter compression that keeps more source detail.",
    tooltip: "Creates a higher quality output while preserving more source detail at original resolution.",
  },
] as const satisfies readonly CompressionPreset[];

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

export function isCompressionPresetId(value: string): value is CompressionPresetId {
  return COMPRESSION_PRESETS.some((preset) => preset.id === value);
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
