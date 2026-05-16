import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { app } from "electron";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { ALLOWED_EXTENSIONS, ALLOWED_OUTPUTS } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ensures a binary path is correctly resolved when the app is packaged (ASAR)
 */
export function getUnpackedPath(originalPath: string): string {
  if (app.isPackaged && originalPath.includes("app.asar")) {
    return originalPath.replace("app.asar", "app.asar.unpacked");
  }
  return originalPath;
}

export function validatePath(filePath: string): boolean {
  if (typeof filePath !== "string") return false;
  if (!path.isAbsolute(filePath)) return false;
  // Reject only `..` path segments, not any byte sequence containing dots.
  // Substring match incorrectly rejected legitimate files like `My..Doc.mp4`.
  // Mirrors the segment-aware traversal check in utils/security.ts.
  if (filePath.split(/[\\/]+/).includes("..")) return false;

  const ext = path.extname(filePath).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_OUTPUTS.includes(ext);
}

export function getFfmpegPath() {
  const executablePath = ffmpegPath as unknown as string;
  if (typeof executablePath !== "string") {
    throw new Error("FFmpeg path not found");
  }
  return getUnpackedPath(executablePath);
}

export function getFfprobePath() {
  const candidate = ffprobePath as unknown as string | { path?: unknown };
  const executablePath = typeof candidate === "string" ? candidate : candidate.path;
  if (typeof executablePath !== "string") {
    throw new Error("FFprobe path not found");
  }
  return getUnpackedPath(executablePath);
}

type RnnoiseModelName = "sh" | "cb" | "mp";
const RNNOISE_MODEL_NAMES: RnnoiseModelName[] = ["sh", "cb", "mp"];

export function getRnnoiseModelPath(name: RnnoiseModelName): string {
  if (!RNNOISE_MODEL_NAMES.includes(name)) {
    throw new Error("Invalid RNNoise model name.");
  }
  const fileName = `${name}.rnnn`;
  const candidate = app.isPackaged
    ? path.join(process.resourcesPath, "rnnoise", fileName)
    : path.join(__dirname, "..", "..", "resources", "rnnoise", fileName);
  if (!fs.existsSync(candidate)) throw new Error(`RNNoise model not found: ${fileName}`);
  return candidate;
}

export function getUniquePath(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;

  const ext = path.extname(filePath);
  const base = filePath.substring(0, filePath.lastIndexOf(ext));
  // UUID suffix avoids same-second collisions that could silently overwrite a
  // prior output when callers invoke ffmpeg with -y.
  const suffix = randomUUID().slice(0, 8);
  return `${base}_${suffix}${ext}`;
}
