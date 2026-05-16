import { ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { spawn, type ChildProcess } from "child_process";
import { VIDEO_EXTS, AUDIO_EXTS } from "../../utils/constants.js";
import { validatePath, getUniquePath, getFfmpegPath, getFfprobePath } from "../../utils/helpers.js";
import { isAllowedVideoQuality } from "../../utils/security.js";
import { resolveRegisteredFilePath } from "../../utils/fileRegistry.js";
import { registerProducedOutput } from "../../utils/outputRegistry.js";
import { registerCancellable } from "../../utils/cancellationRegistry.js";
import { assertMediaDurationWithinLimit, assertMediaFileWithinLimit } from "../../utils/mediaLimits.js";
import { applyImageArgs, registerImageHandlers } from "./image.js";
import { applyVideoArgs } from "./video.js";
import { applyAudioArgs } from "./audio.js";

async function getDuration(inputPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = spawn(getFfprobePath(), [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);

    let output = "";
    probe.stdout.on("data", (data) => { output += data.toString(); });
    probe.on("close", () => {
      const duration = parseFloat(output);
      resolve(isNaN(duration) ? null : duration);
    });
    probe.on("error", () => resolve(null));
  });
}

const FFMPEG_ERRORS: [RegExp, string][] = [
  [/no such file or directory/i, "Input file not found."],
  [/invalid data found/i, "File is corrupt or unsupported."],
  [/encoder .+ not found/i, "Required encoder not available."],
  [/permission denied/i, "Permission denied — check the output folder."],
  [/no space left/i, "Not enough disk space."],
];

function parseFFmpegError(stderr: string, code: number | null): string {
  for (const [pattern, message] of FFMPEG_ERRORS) {
    if (pattern.test(stderr)) return message;
  }
  return `Conversion failed (code ${code}).`;
}

const activeConversions = new Map<number, ChildProcess>();

export function registerConverterHandlers() {
  registerImageHandlers();

  ipcMain.handle(
    "convert",
    async (event, inputId: string, outputFormat: string, quality?: string) => {
      const senderId = event.sender.id;
      if (activeConversions.has(senderId)) {
        throw new Error("Conversion already in progress.");
      }
      const absoluteInputPath = resolveRegisteredFilePath(senderId, inputId);

      if (!validatePath(absoluteInputPath)) throw new Error("Invalid input path.");

      if (!fs.existsSync(absoluteInputPath))
        throw new Error("Input file not found.");

      const inputExt = path.extname(absoluteInputPath).toLowerCase();
      const isTimedMedia = VIDEO_EXTS.includes(inputExt) || AUDIO_EXTS.includes(inputExt);
      if (isTimedMedia) assertMediaFileWithinLimit(absoluteInputPath);
      const requestedOutputExt = outputFormat.startsWith(".")
        ? outputFormat.toLowerCase()
        : `.${outputFormat.toLowerCase()}`;
      const outputExt = requestedOutputExt;
      const finalOutputPath = getUniquePath(
        path.join(
          path.dirname(absoluteInputPath),
          `${path.basename(absoluteInputPath, inputExt)}${outputExt}`,
        ),
      );
      if (!validatePath(finalOutputPath)) throw new Error("Invalid output format.");

      const args: string[] = ["-i", absoluteInputPath];

      const isSupported =
        applyImageArgs(inputExt, outputExt) ||
        applyVideoArgs(inputExt, outputExt, args) ||
        applyAudioArgs(inputExt, outputExt, args);

      if (!isSupported) {
        throw new Error(`Unsupported conversion: ${inputExt} → ${outputExt}`);
      }

      if (VIDEO_EXTS.includes(inputExt) && quality) {
        if (!isAllowedVideoQuality(quality)) throw new Error("Invalid video quality.");
      }

      if (VIDEO_EXTS.includes(inputExt) && quality && quality !== "original") {
        const h = parseInt(quality, 10);
        args.push("-vf", `scale=-2:${h}`);
      }

      args.push(finalOutputPath);

      let totalDuration: number | null = null;
      if (isTimedMedia) {
        totalDuration = await getDuration(absoluteInputPath);
        if (totalDuration !== null) assertMediaDurationWithinLimit(totalDuration);
      }

      return new Promise((resolve, reject) => {
        const ffmpegExe = getFfmpegPath();
        const fullArgs = [
          "-y",
          "-hide_banner",
          "-loglevel", "error",
          "-progress", "pipe:1",
          ...args,
        ];

        const ffmpegProcess = spawn(ffmpegExe, fullArgs);
        let stderrOutput = "";

        activeConversions.set(senderId, ffmpegProcess);
        const disposeCancel = registerCancellable(senderId, () => ffmpegProcess.kill());

        ffmpegProcess.stdout.on("data", (data) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (line.startsWith("out_time_ms=") && totalDuration) {
              const value = line.split("=")[1];
              const outTimeMs = Number(value);
              if (!Number.isFinite(outTimeMs)) return;
              const progress = Math.min(
                99,
                Math.round((outTimeMs / 1_000_000 / totalDuration) * 100),
              );
              event.sender.send("conversion-progress", progress);
            }
          }
        });

        ffmpegProcess.stderr?.on("data", (data) => {
          stderrOutput += data.toString();
        });

        ffmpegProcess.on("close", (code) => {
          activeConversions.delete(senderId);
          disposeCancel();
          if (code === 0) {
            event.sender.send("conversion-progress", 100);
            registerProducedOutput(finalOutputPath);
            resolve(finalOutputPath);
          } else {
            reject(new Error(parseFFmpegError(stderrOutput, code)));
          }
        });

        ffmpegProcess.on("error", (err) => {
          activeConversions.delete(senderId);
          disposeCancel();
          reject(err);
        });
      });
    },
  );
}
