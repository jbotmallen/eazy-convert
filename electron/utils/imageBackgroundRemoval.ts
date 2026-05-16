import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { z } from "zod";

export type BackgroundRemovalOutputFormat = "png" | "webp";

const BACKGROUND_REMOVAL_OUTPUT_FORMATS = new Set<BackgroundRemovalOutputFormat>(["png", "webp"]);

export const backgroundRemovalOptionsSchema = z
  .object({
    outputFormat: z.enum(["png", "webp"]).optional(),
  })
  .strict()
  .optional()
  .transform((value) => ({
    outputFormat: value?.outputFormat ?? "png",
  }));

export type BackgroundRemovalOptions = z.infer<typeof backgroundRemovalOptionsSchema>;

export function assertBackgroundRemovalOutputFormat(value: unknown): asserts value is BackgroundRemovalOutputFormat {
  if (typeof value !== "string" || !BACKGROUND_REMOVAL_OUTPUT_FORMATS.has(value as BackgroundRemovalOutputFormat)) {
    throw new Error("Invalid background removal output format.");
  }
}

export function parseBackgroundRemovalOptions(options: unknown): BackgroundRemovalOptions {
  return backgroundRemovalOptionsSchema.parse(options);
}

function createBackgroundRemovalTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
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

export function getBackgroundRemovalOutputPath(
  inputPath: string,
  outputFormat: BackgroundRemovalOutputFormat,
  date = new Date(),
): string {
  assertBackgroundRemovalOutputFormat(outputFormat);

  const inputExt = path.extname(inputPath);
  const outputPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, inputExt)}_no-bg_${createBackgroundRemovalTimestamp(date)}.${outputFormat}`,
  );
  let candidate = outputPath;
  const candidateExt = path.extname(candidate);
  const candidateBase = candidate.slice(0, -candidateExt.length);
  let suffix = 1;

  while (fs.existsSync(candidate)) {
    candidate = `${candidateBase}_${suffix}${candidateExt}`;
    suffix++;
  }

  return candidate;
}

export function getBackgroundRemovalMimeType(outputFormat: BackgroundRemovalOutputFormat): "image/png" | "image/webp" {
  assertBackgroundRemovalOutputFormat(outputFormat);
  return outputFormat === "webp" ? "image/webp" : "image/png";
}

export function getBackgroundRemovalInputMimeType(inputExt: string): "image/png" | "image/jpeg" | "image/webp" | null {
  const ext = inputExt.toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return null;
}

export function getBackgroundRemovalPublicPath(
  moduleEntryPath: string,
  unpackPath: (filePath: string) => string = (filePath) => filePath,
): string {
  const distPath = unpackPath(path.dirname(moduleEntryPath));
  return `${pathToFileURL(distPath).href}/`;
}
