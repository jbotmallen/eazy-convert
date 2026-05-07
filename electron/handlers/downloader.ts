import { ipcMain, app } from "electron";
import path from "path";
import { spawn } from "child_process";
import { create as ytDlpCreate, YtFlags } from "yt-dlp-exec";
import { getFfmpegPath } from "../utils/helpers.js";
import {
  isAllowedDownloadFormat,
  isAllowedYoutubeQuality,
  isAllowedYoutubeUrl,
} from "../utils/security.js";
import type { ExecaChildProcess } from "execa";

const getYTExecutable = () => {
  const isDev = process.env.NODE_ENV === "development";
  const relativePath = path.join(
    "node_modules",
    "yt-dlp-exec",
    "bin",
    "yt-dlp.exe",
  );
  const fullPath = isDev
    ? path.join(process.cwd(), relativePath)
    : path.join(process.resourcesPath, "app.asar.unpacked", relativePath);

  return fullPath;
};

const ytdlpExec = ytDlpCreate(getYTExecutable()).exec;

type ExtendedFlags = YtFlags & {
  jsRuntimes?: string;
  concurrentFragments?: number;
};

const ERROR_MAP: [RegExp, string][] = [
  [/this video is not available/i, "Video unavailable — may be region-locked or requires login."],
  [/video unavailable/i, "Video unavailable."],
  [/private video/i, "This video is private."],
  [/sign in to confirm your age/i, "Age-restricted — cannot download without login."],
  [/copyright/i, "Blocked by a copyright restriction."],
  [/has been removed/i, "This video has been removed."],
  [/no video formats found/i, "No downloadable formats found."],
  [/unable to extract/i, "Unsupported URL or video format."],
  [/ffmpeg/i, "FFmpeg not found — reinstall the app."],
];

function parseYtDlpError(stderr: string): string {
  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(stderr)) return message;
  }
  const lines = stderr.trim().split("\n").filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? "";
  const cleaned = lastLine.replace(/^ERROR:\s*/i, "").trim();
  return cleaned || "Download failed.";
}

const activeDownloads = new Map<number, ExecaChildProcess>();

/** Check Windows registry for VC++ Redistributable 2015-2022 (v14.x). */
function checkVcRedist(): Promise<boolean> {
  if (process.platform !== "win32") return Promise.resolve(true);

  const keys = [
    "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64",
  ];

  return new Promise((resolve) => {
    let settled = false;
    let remaining = keys.length;

    for (const key of keys) {
      const proc = spawn("reg", ["query", key, "/v", "Installed"]);
      let stdout = "";

      proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });

      const onDone = (code: number | null) => {
        if (settled) return;
        if (code === 0 && /0x1/i.test(stdout)) {
          settled = true;
          resolve(true);
          return;
        }
        remaining--;
        if (remaining === 0) { settled = true; resolve(false); }
      };

      proc.on("close", onDone);
      proc.on("error", () => onDone(1));
    }
  });
}

export function registerDownloaderHandlers() {
  ipcMain.handle("ytdlp:formats", (_, url: string) =>
    new Promise<number[]>((resolve) => {
      if (!isAllowedYoutubeUrl(url)) {
        resolve([]);
        return;
      }

      const proc = spawn(getYTExecutable(), [
        "--dump-json",
        "--no-playlist",
        "--quiet",
        url,
      ]);

      let stdout = "";
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          const json = JSON.parse(stdout) as {
            formats?: Array<{ height?: number; vcodec?: string }>;
          };
          const heights = (json.formats ?? [])
            .filter(
              (f) =>
                f.vcodec && f.vcodec !== "none" &&
                typeof f.height === "number" && f.height > 0,
            )
            .map((f) => f.height as number);
          resolve([...new Set(heights)].sort((a, b) => a - b));
        } catch {
          resolve([]);
        }
      };

      const timer = setTimeout(() => { proc.kill(); finish(); }, 30_000);

      proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.on("close", () => { clearTimeout(timer); finish(); });
      proc.on("error", () => { clearTimeout(timer); if (!settled) { settled = true; resolve([]); } });
    })
  );

  ipcMain.handle("ytdlp:check", () =>
    new Promise<{ ok: boolean; missing?: string }>((resolve) => {
      const proc = spawn(getYTExecutable(), ["--version"]);

      const handleFailure = () =>
        checkVcRedist().then((has) =>
          resolve(has ? { ok: true } : { ok: false, missing: "Visual C++ Redistributable 2019+" }),
        );

      const timer = setTimeout(() => { proc.kill(); handleFailure(); }, 5000);

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ ok: true });
        } else {
          handleFailure();
        }
      });

      proc.on("error", () => { clearTimeout(timer); handleFailure(); });
    })
  );

  ipcMain.on("cancel-download", (event) => {
    const proc = activeDownloads.get(event.sender.id);
    if (proc) {
      proc.kill();
      activeDownloads.delete(event.sender.id);
    }
  });

  ipcMain.handle(
    "download-youtube",
    async (event, url: string, format: "mp4" | "mp3", quality: string = "best") => {
      try {
        if (!isAllowedYoutubeUrl(url)) throw new Error("Only YouTube URLs are supported.");
        if (!isAllowedDownloadFormat(format)) throw new Error("Invalid download format.");
        if (!isAllowedYoutubeQuality(quality)) throw new Error("Invalid download quality.");

        const downloadDir = app.getPath("downloads");
        const timestamp = Math.floor(Date.now() / 1000);
        const outputTemplate = path.join(
          downloadDir,
          `EazyConvert_YT_${timestamp}.%(ext)s`,
        );

        const qualityHeight = parseInt(quality, 10);
        const hasQuality = !isNaN(qualityHeight) && quality !== "best";

        const options: ExtendedFlags = {
          output: outputTemplate,
          ffmpegLocation: getFfmpegPath(),
          format:
            format === "mp3"
              ? "bestaudio/best"
              : hasQuality
              ? `bestvideo[height<=${qualityHeight}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${qualityHeight}]+bestaudio/best[height<=${qualityHeight}]`
              : "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*+ba/best",
          noWarnings: true,
          referer: "https://www.youtube.com",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          jsRuntimes: "nodejs",
          geoBypass: true,
          noPlaylist: true,
          concurrentFragments: 4,
          bufferSize: "16K",
        };

        if (format === "mp3") {
          options.extractAudio = true;
          options.audioFormat = "mp3";
        } else if (format === "mp4") {
          options.mergeOutputFormat = "mp4";
        }

        return new Promise((resolve, reject) => {
          const downloadProcess: ExecaChildProcess = ytdlpExec(url, options);
          activeDownloads.set(event.sender.id, downloadProcess);
          let lastProgress = 0;
          let isResolved = false;
          let errorOutput = "";

          const finishDownload = () => {
            if (isResolved) return;
            isResolved = true;
            event.sender.send("conversion-progress", 100);
            resolve({ success: true, path: downloadDir });
          };

          downloadProcess.stdout?.on("data", (chunk: Buffer | string) => {
            const output = chunk.toString();
            const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
            if (progressMatch) {
              const progress = parseFloat(progressMatch[1]);
              lastProgress = Math.round(progress);
              event.sender.send("conversion-progress", lastProgress);

              if (progress >= 100) {
                setTimeout(finishDownload, 1500);
              }
            }
          });

          downloadProcess.stderr?.on("data", (chunk: Buffer | string) => {
            const err = chunk.toString();
            console.error(`YT-DLP Stderr: ${err}`);
            errorOutput += err;
          });

          downloadProcess.on("close", (code: number | null) => {
            activeDownloads.delete(event.sender.id);
            if (isResolved) return;

            if (code === 0 || (code === 1 && lastProgress >= 95)) {
              finishDownload();
            } else {
              reject(new Error(parseYtDlpError(errorOutput)));
            }
          });

          downloadProcess.on("error", (err: Error) => {
            activeDownloads.delete(event.sender.id);
            console.error("YT-DLP Process Error:", err);
            if (!isResolved)
              reject(new Error(`Failed to start downloader: ${err.message}`));
          });
        });
      } catch (error: unknown) {
        console.error("YouTube Download Error:", error);
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to download YouTube media",
        );
      }
    },
  );
}
