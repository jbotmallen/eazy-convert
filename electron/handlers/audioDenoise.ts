import { ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { AUDIO_EXTS, VIDEO_EXTS } from "../utils/constants.js";
import {
  getFfmpegPath,
  getFfprobePath,
  getRnnoiseModelPath,
  validatePath,
} from "../utils/helpers.js";
import { resolveRegisteredFilePath } from "../utils/fileRegistry.js";
import { assertProducedOutput, registerProducedOutput } from "../utils/outputRegistry.js";
import { registerCancellable } from "../utils/cancellationRegistry.js";
import { assertMediaDurationWithinLimit, assertMediaFileWithinLimit } from "../utils/mediaLimits.js";
import {
  assertAudioDenoiseOutputFormat,
  buildAfftdnFilter,
  buildArnndnFilter,
  buildAudioDenoiseEncoderArgs,
  getAudioDenoiseOutputPath,
  getVideoDenoiseOutputPath,
  validateDenoiseOptions,
  type AudioDenoiseOptions,
} from "../utils/audioDenoise.js";

function resolveDenoiseFilter(options: AudioDenoiseOptions): string {
  if (options.engine === "rnnoise") {
    const modelPath = getRnnoiseModelPath(options.model);
    return buildArnndnFilter(options.preset, modelPath);
  }
  return buildAfftdnFilter(options.preset);
}

const activeProcs = new Map<number, ChildProcess>();
const PROBE_TIMEOUT_MS = 10_000;

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
      finish(() => reject(new Error("Could not read media duration.")));
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
        finish(() =>
          reject(new Error(stderrOutput.trim() || "Could not read media duration.")),
        );
      }
    });
    proc.on("error", () => finish(() => reject(new Error("Could not read media duration."))));
  });
}

function parseFFmpegError(stderr: string, code: number | null): string {
  if (/no such file or directory/i.test(stderr)) return "Input file not found.";
  if (/invalid data found/i.test(stderr)) return "File is corrupt or unsupported.";
  if (/failed to open model/i.test(stderr)) return "Denoise model file is missing.";
  if (/encoder .+ not found/i.test(stderr)) return "Required encoder not available.";
  if (/permission denied/i.test(stderr)) return "Permission denied - check the output folder.";
  if (/no space left/i.test(stderr)) return "Not enough disk space.";
  return `Denoising failed (code ${code}).`;
}

type DenoiseResult = { success: true; outputPath: string };

function runFfmpeg(
  args: string[],
  durationSeconds: number,
  senderId: number,
  event: Electron.IpcMainInvokeEvent,
  outputPath: string,
): Promise<DenoiseResult> {
  return new Promise<DenoiseResult>((resolve, reject) => {
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
    activeProcs.set(senderId, ffmpegProcess);
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
      if (activeProcs.get(senderId) === ffmpegProcess) {
        activeProcs.delete(senderId);
      }
      disposeCancel();
      if (code === 0) {
        event.sender.send("conversion-progress", 100);
        registerProducedOutput(outputPath);
        resolve({ success: true, outputPath });
      } else {
        reject(new Error(parseFFmpegError(stderrOutput, code)));
      }
    });

    ffmpegProcess.on("error", (err) => {
      if (activeProcs.get(senderId) === ffmpegProcess) {
        activeProcs.delete(senderId);
      }
      disposeCancel();
      reject(err);
    });
  });
}

export function registerAudioDenoiseHandlers() {
  ipcMain.handle(
    "audio:denoise",
    async (event, inputId: string, outputFormat: unknown, options: unknown) => {
      const senderId = event.sender.id;
      if (activeProcs.has(senderId)) {
        throw new Error("Audio operation already in progress.");
      }
      assertAudioDenoiseOutputFormat(outputFormat);
      const denoiseOptions = validateDenoiseOptions(options);
      const inputPath = resolveRegisteredFilePath(senderId, inputId);
      assertAudioInput(inputPath);

      const durationSeconds = await probeDuration(inputPath);
      const outputPath = getAudioDenoiseOutputPath(inputPath, outputFormat);
      if (!validatePath(outputPath)) throw new Error("Invalid output path.");

      const filter = resolveDenoiseFilter(denoiseOptions);
      const args = [
        "-i",
        inputPath,
        "-af",
        filter,
        ...buildAudioDenoiseEncoderArgs(outputFormat),
        outputPath,
      ];
      return runFfmpeg(args, durationSeconds, senderId, event, outputPath);
    },
  );

  ipcMain.handle("video:denoise", async (event, inputId: string, options: unknown) => {
    const senderId = event.sender.id;
    if (activeProcs.has(senderId)) {
      throw new Error("Video operation already in progress.");
    }
    const denoiseOptions = validateDenoiseOptions(options);
    const inputPath = resolveRegisteredFilePath(senderId, inputId);
    assertVideoInput(inputPath);

    const durationSeconds = await probeDuration(inputPath);
    const outputPath = getVideoDenoiseOutputPath(inputPath);
    if (!validatePath(outputPath)) throw new Error("Invalid output path.");

    const filter = resolveDenoiseFilter(denoiseOptions);
    const args = [
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-c:v",
      "copy",
      "-af",
      filter,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ];
    return runFfmpeg(args, durationSeconds, senderId, event, outputPath);
  });

  ipcMain.handle("denoise:show-in-folder", async (_, filePath: unknown) => {
    const allowed = assertProducedOutput(filePath);
    if (!validatePath(allowed)) throw new Error("Invalid output path.");
    if (!fs.existsSync(allowed) || !fs.statSync(allowed).isFile()) {
      throw new Error("Output file not found.");
    }
    shell.showItemInFolder(allowed);
  });
}
