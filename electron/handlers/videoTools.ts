import { app, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { VIDEO_EXTS } from "../utils/constants.js";
import { getFfmpegPath, getFfprobePath, validatePath } from "../utils/helpers.js";
import { resolveRegisteredFilePath } from "../utils/fileRegistry.js";
import { assertProducedOutput, registerProducedOutput } from "../utils/outputRegistry.js";
import { PreviewTokenStore } from "../utils/previewTokenStore.js";
import { registerCancellable } from "../utils/cancellationRegistry.js";
import { assertMediaDurationWithinLimit, assertMediaFileWithinLimit } from "../utils/mediaLimits.js";
import { validateTrimRange, type TrimMode } from "../utils/videoTrim.js";
import {
  assertCompressionPresetId,
  assertCompressionOutputFormat,
  buildCompressionArgs,
  compressionOptionsSchema,
  getCompressionOutputPath,
} from "../utils/videoCompress.js";
import { applyVideoArgs } from "./converter/video.js";

const activeConversions = new Map<number, ChildProcess>();
const activeProbes = new Set<number>();
const activePreviewBuilds = new Set<number>();
const trimPreviewFiles = new Set<string>();
const previewTokens = new PreviewTokenStore();
const PROBE_TIMEOUT_MS = 10_000;
const PREVIEW_BUILD_TIMEOUT_MS = 30_000;
export const VIDEO_PREVIEW_SCHEME = "app-video-preview";

export function clearAllVideoPreviewTokens(): void {
  previewTokens.clear();
}

const VIDEO_MIME_TYPES: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function assertVideoInput(inputPath: string): string {
  if (!validatePath(inputPath)) throw new Error("Invalid input path.");
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    throw new Error("Input file not found.");
  }
  assertMediaFileWithinLimit(inputPath);

  const inputExt = path.extname(inputPath).toLowerCase();
  if (!VIDEO_EXTS.includes(inputExt)) throw new Error("Unsupported video format.");
  return inputExt;
}

function assertVideoOutput(filePath: string): string {
  if (!validatePath(filePath)) throw new Error("Invalid output path.");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("Output file not found.");
  }

  const outputExt = path.extname(filePath).toLowerCase();
  if (!VIDEO_EXTS.includes(outputExt)) throw new Error("Unsupported video output path.");
  return outputExt;
}

function getTrimOutputPath(inputPath: string, inputExt: string): string {
  const token = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  return path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, inputExt)}_trimmed_${token}${inputExt}`,
  );
}

function getTempTrimPreviewPath(inputExt: string): string {
  const token = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  return path.join(app.getPath("temp"), `eazyconvert_trim_preview_${token}${inputExt}`);
}

function cleanupTrimPreviewFile(filePath: string) {
  if (!trimPreviewFiles.delete(filePath)) return;
  void fs.promises.unlink(filePath).catch(() => undefined);
}

export function cleanupAllVideoTrimPreviewFiles(): void {
  for (const filePath of [...trimPreviewFiles]) cleanupTrimPreviewFile(filePath);
}

function createVideoPreviewToken(): string {
  return `video-preview-${randomUUID()}`;
}

function createVideoPreviewUrl(token: string): string {
  return `${VIDEO_PREVIEW_SCHEME}://${token}`;
}

function getPreviewToken(urlOrToken: string): string {
  if (typeof urlOrToken !== "string") throw new Error("Invalid preview token.");
  const trimmed = urlOrToken.trim();
  if (!trimmed) throw new Error("Invalid preview token.");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== `${VIDEO_PREVIEW_SCHEME}:`) {
      throw new Error("Invalid preview token.");
    }
    return parsed.hostname || parsed.pathname.replace(/^\/+/, "");
  } catch (error) {
    if (trimmed.includes("://")) throw error;
    return trimmed;
  }
}

function getVideoMimeType(inputExt: string): string {
  return VIDEO_MIME_TYPES[inputExt] ?? "application/octet-stream";
}

function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || fileSize < 1) return null;

  const [, startText, endText] = match;
  if (!startText && !endText) return null;

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : fileSize - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= fileSize
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, fileSize - 1) };
}

function buildVideoPreviewResponse(filePath: string, inputExt: string, request: Request): Response {
  const stat = fs.statSync(filePath);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": getVideoMimeType(inputExt),
  });
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, stat.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`,
        },
      });
    }

    const contentLength = range.end - range.start + 1;
    headers.set("Content-Length", String(contentLength));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
    return new Response(
      Readable.toWeb(fs.createReadStream(filePath, { start: range.start, end: range.end })) as BodyInit,
      { status: 206, headers },
    );
  }

  headers.set("Content-Length", String(stat.size));
  return new Response(
    Readable.toWeb(fs.createReadStream(filePath)) as BodyInit,
    { status: 200, headers },
  );
}

export function createVideoPreviewProtocolHandler(): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const token = getPreviewToken(request.url);
      const inputPath = previewTokens.get(token);
      if (!inputPath) throw new Error("Preview token is no longer valid.");
      const inputExt = assertVideoInput(inputPath);
      return buildVideoPreviewResponse(inputPath, inputExt, request);
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}

async function probeDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const proc = spawn(getFfprobePath(), [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);

    let output = "";
    let stderrOutput = "";
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      proc.kill();
      finish(() => reject(new Error("Could not read video duration.")));
    }, PROBE_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });
    proc.on("close", (code) => {
      const duration = Number.parseFloat(output);
      if (code === 0 && Number.isFinite(duration) && duration > 0) {
        assertMediaDurationWithinLimit(duration);
        finish(() => resolve(duration));
      } else {
        finish(() => reject(new Error(stderrOutput.trim() || "Could not read video duration.")));
      }
    });
    proc.on("error", () => finish(() => reject(new Error("Could not read video duration."))));
  });
}

async function createTrimPreviewFile(
  senderId: number,
  inputPath: string,
  inputExt: string,
  startSeconds: number,
  endSeconds: number,
): Promise<string> {
  const previewPath = getTempTrimPreviewPath(inputExt);
  const clipSeconds = endSeconds - startSeconds;

  await new Promise<void>((resolve, reject) => {
    let stderrOutput = "";
    let settled = false;
    const proc = spawn(getFfmpegPath(), [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(startSeconds),
      "-t",
      String(clipSeconds),
      "-i",
      inputPath,
      "-c",
      "copy",
      previewPath,
    ]);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      disposeCancel();
      callback();
    };
    const disposeCancel = registerCancellable(senderId, () => proc.kill());
    const timer = setTimeout(() => {
      proc.kill();
      finish(() => reject(new Error("Preview generation timed out.")));
    }, PREVIEW_BUILD_TIMEOUT_MS);

    proc.stderr?.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) finish(resolve);
      else finish(() => reject(new Error(parseFFmpegTrimError(stderrOutput, code))));
    });
    proc.on("error", (err) => finish(() => reject(err)));
  });

  trimPreviewFiles.add(previewPath);
  return previewPath;
}

function parseFFmpegTrimError(stderr: string, code: number | null): string {
  if (/no such file or directory/i.test(stderr)) return "Input file not found.";
  if (/invalid data found/i.test(stderr)) return "File is corrupt or unsupported.";
  if (/permission denied/i.test(stderr)) return "Permission denied - check the output folder.";
  if (/no space left/i.test(stderr)) return "Not enough disk space.";
  return `Trimming failed (code ${code}).`;
}

function parseFFmpegCompressionError(stderr: string): string {
  if (/no such file or directory/i.test(stderr)) return "Input file not found.";
  if (/invalid data found/i.test(stderr)) return "File is corrupt or unsupported.";
  if (/permission denied/i.test(stderr)) return "Permission denied while writing output.";
  if (/no space left/i.test(stderr)) return "Not enough disk space.";
  return "Compression failed.";
}

export function registerVideoToolHandlers() {

  ipcMain.handle("video:probe", async (event, inputId: string) => {
    const senderId = event.sender.id;
    if (activeProbes.has(senderId) || activeConversions.has(senderId)) {
      throw new Error("Video operation already in progress.");
    }

    activeProbes.add(senderId);
    try {
      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      assertVideoInput(inputPath);
      return { durationSeconds: await probeDuration(inputPath) };
    } finally {
      activeProbes.delete(senderId);
    }
  });

  ipcMain.handle("video:preview", async (event, inputId: string) => {
    const inputPath = resolveRegisteredFilePath(event.sender.id, inputId);
    assertVideoInput(inputPath);

    const token = createVideoPreviewToken();
    previewTokens.set(token, inputPath);
    return { url: createVideoPreviewUrl(token) };
  });

  ipcMain.handle("video:preview-trim", async (event, inputId: string, startSeconds: number, endSeconds: number) => {
    const senderId = event.sender.id;
    if (activePreviewBuilds.has(senderId)) {
      throw new Error("Preview generation already in progress.");
    }
    activePreviewBuilds.add(senderId);
    try {
      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      const inputExt = assertVideoInput(inputPath);
      const durationSeconds = await probeDuration(inputPath);
      const validation = validateTrimRange(startSeconds, endSeconds, durationSeconds);
      if (!validation.ok) throw new Error(validation.error);

      const previewPath = await createTrimPreviewFile(senderId, inputPath, inputExt, startSeconds, endSeconds);
      const token = createVideoPreviewToken();
      // Tie temp-file cleanup to token eviction so TTL/LRU eviction (not just
      // explicit revoke) also removes the on-disk preview.
      previewTokens.set(token, previewPath, (filePath) => cleanupTrimPreviewFile(filePath));
      return { url: createVideoPreviewUrl(token) };
    } finally {
      activePreviewBuilds.delete(senderId);
    }
  });

  ipcMain.handle("video:preview:revoke", async (_, urlOrToken: string) => {
    const token = getPreviewToken(urlOrToken);
    const success = previewTokens.delete(token);
    return { success };
  });

  ipcMain.handle("video:show-in-folder", async (_, filePath: unknown) => {
    const allowed = assertProducedOutput(filePath);
    assertVideoOutput(allowed);
    shell.showItemInFolder(allowed);
  });

  ipcMain.handle("video:trim", async (event, inputId: string, startSeconds: number, endSeconds: number, mode: TrimMode) => {
      const senderId = event.sender.id;
      if (activeProbes.has(senderId) || activeConversions.has(senderId)) {
        throw new Error("Video operation already in progress.");
      }
      if (mode !== "fast" && mode !== "accurate") throw new Error("Invalid trim mode.");

      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      const inputExt = assertVideoInput(inputPath);
      const durationSeconds = await probeDuration(inputPath);
      const validation = validateTrimRange(startSeconds, endSeconds, durationSeconds);
      if (!validation.ok) throw new Error(validation.error);

      const outputPath = getTrimOutputPath(inputPath, inputExt);
      if (!validatePath(outputPath)) throw new Error("Invalid output path.");

      const args = ["-ss", String(startSeconds), "-to", String(endSeconds), "-i", inputPath];
      if (mode === "fast") {
        args.push("-c", "copy");
      } else if (!applyVideoArgs(inputExt, inputExt, args)) {
        throw new Error("Unsupported video format.");
      }
      args.push(outputPath);

      return new Promise<{ success: boolean; outputPath: string }>((resolve, reject) => {
        const ffmpegProcess = spawn(getFfmpegPath(), [
          "-n",
          "-hide_banner",
          "-loglevel",
          "error",
          "-progress",
          "pipe:1",
          ...args,
        ]);
        let stderrOutput = "";
        activeConversions.set(senderId, ffmpegProcess);
        const disposeCancel = registerCancellable(senderId, () => ffmpegProcess.kill());

        ffmpegProcess.stdout.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (line.startsWith("out_time_ms=")) {
              const outTimeMs = Number(line.split("=")[1]);
              if (!Number.isFinite(outTimeMs)) return;
              const progress = Math.min(
                99,
                Math.round((outTimeMs / 1_000_000 / validation.clipSeconds) * 100),
              );
              event.sender.send("conversion-progress", progress);
            }
          }
        });

        ffmpegProcess.stderr?.on("data", (data: Buffer) => {
          stderrOutput += data.toString();
        });

        ffmpegProcess.on("close", (code) => {
          if (activeConversions.get(senderId) === ffmpegProcess) {
            activeConversions.delete(senderId);
          }
          disposeCancel();
          if (code === 0) {
            event.sender.send("conversion-progress", 100);
            registerProducedOutput(outputPath);
            resolve({ success: true, outputPath });
          } else {
            reject(new Error(parseFFmpegTrimError(stderrOutput, code)));
          }
        });

        ffmpegProcess.on("error", (err) => {
          if (activeConversions.get(senderId) === ffmpegProcess) {
            activeConversions.delete(senderId);
          }
          disposeCancel();
          reject(err);
        });
      });
  });

  ipcMain.handle("video:compress", async (event, inputId: string, presetId: unknown, outputFormat: unknown, options: unknown) => {
    const senderId = event.sender.id;
    if (activeProbes.has(senderId) || activeConversions.has(senderId)) {
      throw new Error("Video operation already in progress.");
    }

    assertCompressionPresetId(presetId);
    assertCompressionOutputFormat(outputFormat);
    const compressionOptions = compressionOptionsSchema.parse(options);
    const inputPath = resolveRegisteredFilePath(senderId, inputId);
    assertVideoInput(inputPath);
    const durationSeconds = await probeDuration(inputPath);
    const outputPath = getCompressionOutputPath(inputPath, outputFormat);
    if (!validatePath(outputPath)) throw new Error("Invalid output path.");

    const inputBytes = fs.statSync(inputPath).size;
    const args = ["-i", inputPath, ...buildCompressionArgs(presetId, outputFormat, compressionOptions), outputPath];

    return new Promise<{ success: true; outputPath: string; inputBytes: number; outputBytes: number }>((resolve, reject) => {
      const ffmpegProcess = spawn(getFfmpegPath(), [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        ...args,
      ]);
      let stderrOutput = "";
      activeConversions.set(senderId, ffmpegProcess);
      const disposeCancel = registerCancellable(senderId, () => ffmpegProcess.kill());

      ffmpegProcess.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("out_time_ms=")) {
            const outTimeMs = Number(line.split("=")[1]);
            if (!Number.isFinite(outTimeMs)) return;
            const progress = Math.min(
              99,
              Math.round((outTimeMs / 1_000_000 / durationSeconds) * 100),
            );
            event.sender.send("conversion-progress", progress);
          }
        }
      });

      ffmpegProcess.stderr?.on("data", (data: Buffer) => {
        stderrOutput += data.toString();
      });

      ffmpegProcess.on("close", (code) => {
        if (activeConversions.get(senderId) === ffmpegProcess) {
          activeConversions.delete(senderId);
        }
        disposeCancel();
        if (code === 0) {
          event.sender.send("conversion-progress", 100);
          const outputBytes = fs.statSync(outputPath).size;
          registerProducedOutput(outputPath);
          resolve({ success: true, outputPath, inputBytes, outputBytes });
        } else {
          reject(new Error(parseFFmpegCompressionError(stderrOutput)));
        }
      });

      ffmpegProcess.on("error", (err) => {
        if (activeConversions.get(senderId) === ffmpegProcess) {
          activeConversions.delete(senderId);
        }
        disposeCancel();
        reject(err);
      });
    });
  });
}
