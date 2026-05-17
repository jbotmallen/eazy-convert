import { app, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { AUDIO_EXTS } from "../utils/constants.js";
import { getFfmpegPath, getFfprobePath, validatePath } from "../utils/helpers.js";
import { resolveRegisteredFilePath } from "../utils/fileRegistry.js";
import { assertProducedOutput, registerProducedOutput } from "../utils/outputRegistry.js";
import { PreviewTokenStore } from "../utils/previewTokenStore.js";
import { registerCancellable } from "../utils/cancellationRegistry.js";
import { assertMediaDurationWithinLimit, assertMediaFileWithinLimit } from "../utils/mediaLimits.js";
import {
  assertAudioOutputFormat,
  buildAudioTrimArgs,
  getAudioTrimOutputPath,
  validateAudioTrimOptions,
  validateAudioTrimRange,
} from "../utils/audioTrim.js";

const activeConversions = new Map<number, ChildProcess>();
const activeProbes = new Set<number>();
const activePreviewBuilds = new Set<number>();
const trimPreviewFiles = new Set<string>();
const previewTokens = new PreviewTokenStore();
const PROBE_TIMEOUT_MS = 10_000;
const PREVIEW_BUILD_TIMEOUT_MS = 30_000;
export const AUDIO_PREVIEW_SCHEME = "app-audio-preview";

export function clearAllAudioPreviewTokens(): void {
  previewTokens.clear();
}

const AUDIO_MIME_TYPES: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

function assertAudioInput(inputPath: string): string {
  if (!validatePath(inputPath)) throw new Error("Invalid input path.");
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    throw new Error("Input file not found.");
  }
  assertMediaFileWithinLimit(inputPath);

  const inputExt = path.extname(inputPath).toLowerCase();
  if (!AUDIO_EXTS.includes(inputExt)) throw new Error("Unsupported audio format.");
  return inputExt;
}

function assertAudioOutput(filePath: string): string {
  if (!validatePath(filePath)) throw new Error("Invalid output path.");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("Output file not found.");
  }

  const outputExt = path.extname(filePath).toLowerCase();
  if (![".mp3", ".ogg", ".wav", ".aac", ".flac"].includes(outputExt)) {
    throw new Error("Unsupported audio output path.");
  }
  return outputExt;
}

function getTempTrimPreviewPath(inputExt: string): string {
  const token = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  return path.join(app.getPath("temp"), `eazyconvert_audio_trim_preview_${token}${inputExt}`);
}

function cleanupTrimPreviewFile(filePath: string) {
  if (!trimPreviewFiles.delete(filePath)) return;
  void fs.promises.unlink(filePath).catch(() => undefined);
}

export function cleanupAllAudioTrimPreviewFiles(): void {
  for (const filePath of [...trimPreviewFiles]) cleanupTrimPreviewFile(filePath);
}

function createAudioPreviewToken(): string {
  return `audio-preview-${randomUUID()}`;
}

function createAudioPreviewUrl(token: string): string {
  return `${AUDIO_PREVIEW_SCHEME}://${token}`;
}

function getPreviewToken(urlOrToken: string): string {
  if (typeof urlOrToken !== "string") throw new Error("Invalid preview token.");
  const trimmed = urlOrToken.trim();
  if (!trimmed) throw new Error("Invalid preview token.");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== `${AUDIO_PREVIEW_SCHEME}:`) {
      throw new Error("Invalid preview token.");
    }
    return parsed.hostname || parsed.pathname.replace(/^\/+/, "");
  } catch (error) {
    if (trimmed.includes("://")) throw error;
    return trimmed;
  }
}

function getAudioMimeType(inputExt: string): string {
  return AUDIO_MIME_TYPES[inputExt] ?? "application/octet-stream";
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

function buildAudioPreviewResponse(filePath: string, inputExt: string, request: Request): Response {
  const stat = fs.statSync(filePath);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": getAudioMimeType(inputExt),
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

export function createAudioPreviewProtocolHandler(): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const token = getPreviewToken(request.url);
      const inputPath = previewTokens.get(token);
      if (!inputPath) throw new Error("Preview token is no longer valid.");
      const inputExt = assertAudioInput(inputPath);
      return buildAudioPreviewResponse(inputPath, inputExt, request);
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
      finish(() => reject(new Error("Could not read audio duration.")));
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
        finish(() => reject(new Error(stderrOutput.trim() || "Could not read audio duration.")));
      }
    });
    proc.on("error", () => finish(() => reject(new Error("Could not read audio duration."))));
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
  if (/encoder .+ not found/i.test(stderr)) return "Required encoder not available.";
  if (/permission denied/i.test(stderr)) return "Permission denied - check the output folder.";
  if (/no space left/i.test(stderr)) return "Not enough disk space.";
  return `Trimming failed (code ${code}).`;
}

export function registerAudioToolHandlers() {

  ipcMain.handle("audio:probe", async (event, inputId: string) => {
    const senderId = event.sender.id;
    if (activeProbes.has(senderId) || activeConversions.has(senderId)) {
      throw new Error("Audio operation already in progress.");
    }

    activeProbes.add(senderId);
    try {
      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      assertAudioInput(inputPath);
      return { durationSeconds: await probeDuration(inputPath) };
    } finally {
      activeProbes.delete(senderId);
    }
  });

  ipcMain.handle("audio:preview", async (event, inputId: string) => {
    const inputPath = resolveRegisteredFilePath(event.sender.id, inputId);
    assertAudioInput(inputPath);

    const token = createAudioPreviewToken();
    previewTokens.set(token, inputPath);
    return { url: createAudioPreviewUrl(token) };
  });

  ipcMain.handle("audio:preview-trim", async (event, inputId: string, startSeconds: number, endSeconds: number) => {
    const senderId = event.sender.id;
    if (activePreviewBuilds.has(senderId)) {
      throw new Error("Preview generation already in progress.");
    }
    activePreviewBuilds.add(senderId);
    try {
      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      const inputExt = assertAudioInput(inputPath);
      const durationSeconds = await probeDuration(inputPath);
      const validation = validateAudioTrimRange(startSeconds, endSeconds, durationSeconds);
      if (!validation.ok) throw new Error(validation.error);

      const previewPath = await createTrimPreviewFile(senderId, inputPath, inputExt, startSeconds, endSeconds);
      const token = createAudioPreviewToken();
      previewTokens.set(token, previewPath, (filePath) => cleanupTrimPreviewFile(filePath));
      return { url: createAudioPreviewUrl(token) };
    } finally {
      activePreviewBuilds.delete(senderId);
    }
  });

  ipcMain.handle("audio:preview:revoke", async (_, urlOrToken: string) => {
    const token = getPreviewToken(urlOrToken);
    const success = previewTokens.delete(token);
    return { success };
  });

  ipcMain.handle("audio:show-in-folder", async (_, filePath: unknown) => {
    const allowed = assertProducedOutput(filePath);
    assertAudioOutput(allowed);
    shell.showItemInFolder(allowed);
  });

  ipcMain.handle(
    "audio:trim",
    async (
      event,
      inputId: string,
      startSeconds: number,
      endSeconds: number,
      outputFormat: unknown,
      options: unknown,
    ) => {
      const senderId = event.sender.id;
      if (activeProbes.has(senderId) || activeConversions.has(senderId)) {
        throw new Error("Audio operation already in progress.");
      }

      assertAudioOutputFormat(outputFormat);
      const audioTrimOptions = validateAudioTrimOptions(options);
      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      assertAudioInput(inputPath);
      const durationSeconds = await probeDuration(inputPath);
      const validation = validateAudioTrimRange(startSeconds, endSeconds, durationSeconds);
      if (!validation.ok) throw new Error(validation.error);

      const outputPath = getAudioTrimOutputPath(inputPath, outputFormat);
      if (!validatePath(outputPath)) throw new Error("Invalid output path.");
      const canStreamCopy = audioTrimOptions.mode === "fast" && path.extname(inputPath).toLowerCase() === `.${outputFormat}`;
      const args = [
        "-ss",
        String(startSeconds),
        "-to",
        String(endSeconds),
        "-i",
        inputPath,
        ...(canStreamCopy ? ["-c", "copy"] : buildAudioTrimArgs(outputFormat, audioTrimOptions)),
        outputPath,
      ];

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
    },
  );
}
