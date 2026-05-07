import path from "path";
import fs from "fs";
import { app } from "electron";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { ALLOWED_EXTENSIONS, ALLOWED_OUTPUTS } from "./constants.js";

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
  if (filePath.includes("..")) return false;

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

export function getUniquePath(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;

  const ext = path.extname(filePath);
  const base = filePath.substring(0, filePath.lastIndexOf(ext));
  const timestamp = Math.floor(Date.now() / 1000);
  return `${base}_${timestamp}${ext}`;
}
