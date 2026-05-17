import { ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "child_process";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { imageSize } from "image-size";
import { PDFDocument } from "pdf-lib";
import { IMAGE_EXTS } from "../../utils/constants.js";
import { resolveRegisteredFilePath } from "../../utils/fileRegistry.js";
import { assertProducedOutput, registerProducedOutput } from "../../utils/outputRegistry.js";
import { registerCancellable } from "../../utils/cancellationRegistry.js";
import {
  assertDocumentFileWithinLimit,
  assertDocumentPathList,
  isAllowedDocumentPath,
  readFileWithinDocumentLimit,
} from "../../utils/security.js";
import { getFfmpegPath, getUnpackedPath, validatePath } from "../../utils/helpers.js";
import { getUniqueName, timestamp } from "../document/utils.js";
import {
  assertImageCompressionOutputFormat,
  assertImageCompressionPresetId,
  buildImageCompressionArgs,
  getAutoImageOutputFormat,
  getImageCompressionOutputPath,
  imageCompressionOptionsSchema,
  type ResolvedImageCompressionOutputFormat,
} from "../../utils/imageCompress.js";
import {
  getBackgroundRemovalInputMimeType,
  getBackgroundRemovalMimeType,
  getBackgroundRemovalOutputPath,
  getBackgroundRemovalPublicPath,
  parseBackgroundRemovalOptions,
} from "../../utils/imageBackgroundRemoval.js";

const require = createRequire(import.meta.url);

const PDF_IMAGE_EXTS = IMAGE_EXTS;
const IMAGE_OUTPUT_EXTS = [".pdf", ".webp", ".jpg", ".png"] as const;
const MAX_IMAGE_PDF_PAGE_COUNT = 500;
const activeImageCompressions = new Map<number, ChildProcess>();
const activeBackgroundRemovals = new Set<number>();
const cancelledBackgroundRemovals = new Set<number>();
const EDITABLE_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"] as const;

// SECURITY: outputPath in `image:background-edit:sources` and
// `image:background-edit:save` is renderer-supplied. Without this allowlist a
// compromised renderer could read or write any .png/.webp file on disk by
// passing an arbitrary absolute path. We only accept paths that this process
// itself produced via image:remove-background or a prior background-edit:save.
//
// Bounded LRU mirrors outputRegistry.ts so prolonged sessions cannot grow the
// registry unboundedly.
const MAX_PRODUCED_BACKGROUND_OUTPUTS = 1024;
const producedBackgroundOutputs = new Map<string, true>();

function touchBackgroundOutput(resolved: string): void {
  if (producedBackgroundOutputs.has(resolved)) producedBackgroundOutputs.delete(resolved);
  producedBackgroundOutputs.set(resolved, true);
  while (producedBackgroundOutputs.size > MAX_PRODUCED_BACKGROUND_OUTPUTS) {
    const oldest = producedBackgroundOutputs.keys().next().value;
    if (oldest === undefined) break;
    producedBackgroundOutputs.delete(oldest);
  }
}

function registerProducedBackgroundOutput(outputPath: string): void {
  touchBackgroundOutput(path.resolve(outputPath));
  registerProducedOutput(outputPath);
}

function assertProducedBackgroundOutput(outputPath: unknown): string {
  if (typeof outputPath !== "string") throw new Error("Invalid output path.");
  const resolved = path.resolve(outputPath);
  if (!producedBackgroundOutputs.has(resolved)) {
    throw new Error("Output path is not a recognised background-removal result.");
  }
  return resolved;
}

function assertImagePdfPageCountWithinLimit(count: number): void {
  if (count > MAX_IMAGE_PDF_PAGE_COUNT) {
    throw new Error(`Output PDF has too many pages (${count}). Maximum allowed is ${MAX_IMAGE_PDF_PAGE_COUNT}.`);
  }
}

/** Returns true if image→image conversion is supported. No extra FFmpeg args needed. */
export function applyImageArgs(inputExt: string, outputExt: string): boolean {
  return IMAGE_EXTS.includes(inputExt) && [".png", ".jpg", ".webp"].includes(outputExt);
}

function assertImageInput(inputPath: string): string {
  if (!validatePath(inputPath)) throw new Error("Invalid input path.");
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    throw new Error("Input file not found.");
  }

  const inputExt = path.extname(inputPath).toLowerCase();
  if (!IMAGE_EXTS.includes(inputExt)) throw new Error("Unsupported image format.");
  return inputExt;
}

function parseFFmpegImageCompressionError(stderr: string): string {
  if (/no such file or directory/i.test(stderr)) return "Input file not found.";
  if (/invalid data found/i.test(stderr)) return "File is corrupt or unsupported.";
  if (/permission denied/i.test(stderr)) return "Permission denied while writing output.";
  if (/no space left/i.test(stderr)) return "Not enough disk space.";
  return "Image compression failed.";
}

function convertImageToPngBuffer(inputPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(getFfmpegPath(), [
      "-v", "error",
      "-i", inputPath,
      "-frames:v", "1",
      "-f", "image2pipe",
      "-vcodec", "png",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";
    ffmpegProcess.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpegProcess.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    ffmpegProcess.on("error", reject);
    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(stderr.trim() || "Image could not be prepared for PDF output."));
      }
    });
  });
}

function getImageMimeType(inputExt: string): "image/png" | "image/jpeg" | "image/webp" | null {
  const ext = inputExt.toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return null;
}

async function readImageDataUrl(inputPath: string): Promise<string> {
  const inputExt = assertImageInput(inputPath);
  assertDocumentFileWithinLimit(inputPath);
  const mimeType = getImageMimeType(inputExt);
  if (mimeType) {
    return `data:${mimeType};base64,${fs.readFileSync(inputPath).toString("base64")}`;
  }

  return `data:image/png;base64,${(await convertImageToPngBuffer(inputPath)).toString("base64")}`;
}

// Hard ceiling for an individual edited image dimension. 16384 px matches
// Chromium's max canvas size, so anything larger could not have been produced
// by the in-app editor and is treated as malformed input.
const MAX_EDITED_IMAGE_DIMENSION = 16384;

function parseEditableImageDataUrl(value: unknown): { buffer: Buffer; ext: "png" | "webp" } {
  if (typeof value !== "string") throw new Error("Invalid edited image data.");
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Edited image must be a PNG or WEBP data URL.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > 100 * 1024 * 1024) {
    throw new Error("Edited image is too large.");
  }

  const declaredExt = match[1] as "png" | "webp";
  let metadata: { width?: number; height?: number; type?: string };
  try {
    metadata = imageSize(buffer);
  } catch {
    throw new Error("Edited image is not a valid PNG or WEBP.");
  }
  if (metadata.type !== declaredExt) {
    throw new Error("Edited image format does not match the declared MIME type.");
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_EDITED_IMAGE_DIMENSION ||
    height > MAX_EDITED_IMAGE_DIMENSION
  ) {
    throw new Error("Edited image dimensions are out of range.");
  }

  return { buffer, ext: declaredExt };
}

function getEditedImageOutputPath(outputPath: string, outputExt: "png" | "webp"): string {
  const outputDirectory = path.dirname(outputPath);
  const outputBase = path.basename(outputPath, path.extname(outputPath));
  return getUniqueName(outputDirectory, `${outputBase}_edited_${timestamp()}.${outputExt}`);
}

export function registerImageHandlers() {

  ipcMain.handle("image:to-pdf", async (event, imageIds: string[]) => {
    const imagePaths = imageIds.map((imageId) => resolveRegisteredFilePath(event.sender.id, imageId));
    assertDocumentPathList(imagePaths, PDF_IMAGE_EXTS);
    imagePaths.forEach((imagePath) => assertDocumentFileWithinLimit(imagePath));
    assertImagePdfPageCountWithinLimit(imagePaths.length);

    const pdf = await PDFDocument.create();
    for (const imagePath of imagePaths) {
      const buffer = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const image = ext === ".png"
        ? await pdf.embedPng(buffer)
        : ext === ".jpg" || ext === ".jpeg"
          ? await pdf.embedJpg(buffer)
          : await pdf.embedPng(await convertImageToPngBuffer(imagePath));
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const outputDirectory = path.dirname(imagePaths[0]);
    const outputPath = getUniqueName(outputDirectory, `Images_${timestamp()}.pdf`);
    fs.writeFileSync(outputPath, await pdf.save());
    registerProducedOutput(outputPath);
    return outputPath;
  });

  ipcMain.handle("image:compress", async (event, inputId: string, presetId: unknown, outputFormat: unknown, options: unknown) => {
    const senderId = event.sender.id;
    if (activeImageCompressions.has(senderId)) {
      throw new Error("Image operation already in progress.");
    }

    assertImageCompressionPresetId(presetId);
    assertImageCompressionOutputFormat(outputFormat);
    const compressionOptions = imageCompressionOptionsSchema.parse(options);
    const inputPath = resolveRegisteredFilePath(senderId, inputId);
    const inputExt = assertImageInput(inputPath);
    const resolvedOutputFormat: ResolvedImageCompressionOutputFormat = outputFormat === "auto"
      ? getAutoImageOutputFormat(inputExt)
      : outputFormat;
    const outputPath = getImageCompressionOutputPath(inputPath, resolvedOutputFormat);
    if (!validatePath(outputPath)) throw new Error("Invalid output path.");

    const inputBytes = fs.statSync(inputPath).size;
    const args = [
      "-i",
      inputPath,
      ...buildImageCompressionArgs(presetId, resolvedOutputFormat, compressionOptions),
      outputPath,
    ];

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
      activeImageCompressions.set(senderId, ffmpegProcess);
      const disposeCancel = registerCancellable(senderId, () => ffmpegProcess.kill());
      event.sender.send("conversion-progress", 5);

      ffmpegProcess.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("progress=")) {
            event.sender.send("conversion-progress", line.includes("end") ? 100 : 50);
          }
        }
      });

      ffmpegProcess.stderr?.on("data", (data: Buffer) => {
        stderrOutput += data.toString();
      });

      ffmpegProcess.on("close", (code) => {
        if (activeImageCompressions.get(senderId) === ffmpegProcess) {
          activeImageCompressions.delete(senderId);
        }
        disposeCancel();
        if (code === 0) {
          event.sender.send("conversion-progress", 100);
          const outputBytes = fs.statSync(outputPath).size;
          registerProducedOutput(outputPath);
          resolve({ success: true, outputPath, inputBytes, outputBytes });
        } else {
          reject(new Error(parseFFmpegImageCompressionError(stderrOutput)));
        }
      });

      ffmpegProcess.on("error", (err) => {
        if (activeImageCompressions.get(senderId) === ffmpegProcess) {
          activeImageCompressions.delete(senderId);
        }
        disposeCancel();
        reject(err);
      });
    });
  });

  ipcMain.handle("image:remove-background", async (event, inputId: string, options: unknown) => {
    const senderId = event.sender.id;
    if (activeImageCompressions.has(senderId) || activeBackgroundRemovals.has(senderId)) {
      throw new Error("Image operation already in progress.");
    }

    const removalOptions = parseBackgroundRemovalOptions(options);
    const inputPath = resolveRegisteredFilePath(senderId, inputId);
    const inputExt = assertImageInput(inputPath);
    const outputPath = getBackgroundRemovalOutputPath(inputPath, removalOptions.outputFormat);
    if (!validatePath(outputPath)) throw new Error("Invalid output path.");

    const inputMimeType = getBackgroundRemovalInputMimeType(inputExt);
    let directInputBuffer: Buffer | null = null;
    let inputBytes: number;
    if (inputMimeType) {
      // Read race-free: the size-limit check and the read share one file
      // descriptor, so the file cannot be swapped between check and use.
      directInputBuffer = readFileWithinDocumentLimit(inputPath);
      inputBytes = directInputBuffer.length;
    } else {
      // Transcoded by ffmpeg below, which fails on oversized/invalid input.
      assertDocumentFileWithinLimit(inputPath);
      inputBytes = fs.statSync(inputPath).size;
    }
    activeBackgroundRemovals.add(senderId);
    cancelledBackgroundRemovals.delete(senderId);
    const disposeBgCancel = registerCancellable(senderId, () => {
      cancelledBackgroundRemovals.add(senderId);
    });
    event.sender.send("conversion-progress", 5);

    try {
      const { removeBackground } = await import("@imgly/background-removal-node");
      if (cancelledBackgroundRemovals.has(senderId)) throw new Error("Image background removal cancelled.");

      event.sender.send("conversion-progress", 20);
      const inputBuffer = directInputBuffer ?? (await convertImageToPngBuffer(inputPath));
      const inputArrayBuffer = inputBuffer.buffer.slice(
        inputBuffer.byteOffset,
        inputBuffer.byteOffset + inputBuffer.byteLength,
      ) as ArrayBuffer;
      const inputBlob = new Blob([inputArrayBuffer], { type: inputMimeType ?? "image/png" });
      const blob = await removeBackground(inputBlob, {
        publicPath: getBackgroundRemovalPublicPath(
          require.resolve("@imgly/background-removal-node"),
          getUnpackedPath,
        ),
        model: "medium",
        output: {
          format: getBackgroundRemovalMimeType(removalOptions.outputFormat),
          quality: 0.92,
        },
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) {
            const downloadProgress = Math.round(20 + (Math.min(current, total) / total) * 35);
            event.sender.send("conversion-progress", downloadProgress);
          }
        },
      });
      if (cancelledBackgroundRemovals.has(senderId)) throw new Error("Image background removal cancelled.");

      event.sender.send("conversion-progress", 90);
      const outputBuffer = Buffer.from(await blob.arrayBuffer());
      fs.writeFileSync(outputPath, outputBuffer);
      const outputBytes = fs.statSync(outputPath).size;
      event.sender.send("conversion-progress", 100);
      registerProducedBackgroundOutput(outputPath);
      return { success: true, outputPath, inputBytes, outputBytes };
    } catch (err) {
      if (cancelledBackgroundRemovals.has(senderId)) {
        throw new Error("Image background removal cancelled.");
      }
      const msg = err instanceof Error ? err.message : "Image background removal failed.";
      throw new Error(msg || "Image background removal failed.");
    } finally {
      activeBackgroundRemovals.delete(senderId);
      cancelledBackgroundRemovals.delete(senderId);
      disposeBgCancel();
    }
  });

  ipcMain.handle("image:background-edit:sources", async (event, inputId: string, outputPath: unknown) => {
    const inputPath = resolveRegisteredFilePath(event.sender.id, inputId);
    if (!isAllowedDocumentPath(inputPath, EDITABLE_IMAGE_EXTS)) throw new Error("Invalid input path.");
    // SECURITY: outputPath must be a path this process produced for the user
    // (background-removal result or prior edited save), not arbitrary disk.
    const allowedOutputPath = assertProducedBackgroundOutput(outputPath);
    if (!isAllowedDocumentPath(allowedOutputPath, [".png", ".webp"])) throw new Error("Invalid output path.");
    if (!fs.existsSync(allowedOutputPath) || !fs.statSync(allowedOutputPath).isFile()) throw new Error("Output file not found.");
    assertDocumentFileWithinLimit(allowedOutputPath);

    return {
      originalDataUrl: await readImageDataUrl(inputPath),
      cutoutDataUrl: await readImageDataUrl(allowedOutputPath),
    };
  });

  ipcMain.handle("image:background-edit:save", async (_, outputPath: unknown, dataUrl: unknown) => {
    const allowedOutputPath = assertProducedBackgroundOutput(outputPath);
    if (!isAllowedDocumentPath(allowedOutputPath, [".png", ".webp"])) throw new Error("Invalid output path.");
    if (!fs.existsSync(allowedOutputPath) || !fs.statSync(allowedOutputPath).isFile()) throw new Error("Output file not found.");

    const { buffer, ext } = parseEditableImageDataUrl(dataUrl);
    const editedPath = getEditedImageOutputPath(allowedOutputPath, ext);
    if (!validatePath(editedPath)) throw new Error("Invalid output path.");
    fs.writeFileSync(editedPath, buffer);
    registerProducedBackgroundOutput(editedPath);

    return {
      success: true,
      outputPath: editedPath,
      outputBytes: fs.statSync(editedPath).size,
    };
  });

  ipcMain.handle("image:show-in-folder", async (_, filePath: unknown) => {
    const allowed = assertProducedOutput(filePath);
    if (!isAllowedDocumentPath(allowed, IMAGE_OUTPUT_EXTS)) throw new Error("Invalid output path.");
    if (!fs.existsSync(allowed) || !fs.statSync(allowed).isFile()) throw new Error("Output file not found.");
    shell.showItemInFolder(allowed);
  });
}
