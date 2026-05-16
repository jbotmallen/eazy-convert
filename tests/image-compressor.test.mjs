import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  IMAGE_COMPRESSION_PRESETS,
  imageCompressionOptionsSchema,
  getAutoImageOutputFormat,
  isImageCompressionPresetId,
  isImageCompressionOutputFormat,
  formatBytes,
} from "../src/lib/image-compressor.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("image compressor presets expose stable ids and labels", () => {
  assert.deepEqual(
    IMAGE_COMPRESSION_PRESETS.map((preset) => preset.id),
    ["tiny", "small", "balanced", "high-quality"],
  );
  assert.deepEqual(
    IMAGE_COMPRESSION_PRESETS.map((preset) => preset.label),
    ["Tiny", "Small", "Balanced", "High Quality"],
  );
  assert.equal(isImageCompressionPresetId("tiny"), true);
  assert.equal(isImageCompressionPresetId("high-quality"), true);
  assert.equal(isImageCompressionPresetId("lossless"), false);
});

test("image compressor validates output formats and auto output behavior", () => {
  assert.equal(isImageCompressionOutputFormat("auto"), true);
  assert.equal(isImageCompressionOutputFormat("webp"), true);
  assert.equal(isImageCompressionOutputFormat("jpg"), true);
  assert.equal(isImageCompressionOutputFormat("png"), true);
  assert.equal(isImageCompressionOutputFormat("gif"), false);

  for (const ext of [".png", ".jpg", ".jpeg", ".bmp", ".tiff"]) {
    assert.equal(getAutoImageOutputFormat(ext), "webp");
  }
  assert.equal(getAutoImageOutputFormat(".webp"), "png");
});

test("advanced image compression options validate quality and max dimension", () => {
  assert.deepEqual(imageCompressionOptionsSchema.parse({ quality: 1 }), { quality: 1 });
  assert.deepEqual(imageCompressionOptionsSchema.parse({ quality: 100 }), { quality: 100 });
  assert.deepEqual(imageCompressionOptionsSchema.parse({ quality: 82, maxDimension: 1920 }), { quality: 82, maxDimension: 1920 });
  assert.deepEqual(imageCompressionOptionsSchema.parse({ maxDimension: 3840 }), { maxDimension: 3840 });
  assert.throws(() => imageCompressionOptionsSchema.parse({ quality: 0 }), /Too small/);
  assert.throws(() => imageCompressionOptionsSchema.parse({ quality: 101 }), /Too big/);
  assert.throws(() => imageCompressionOptionsSchema.parse({ quality: 82.5 }), /expected int/);
  assert.throws(() => imageCompressionOptionsSchema.parse({ maxDimension: 123 }), /Invalid input/);
});

test("formatBytes emits compact binary size labels", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
});

test("preload and types expose image compression API", () => {
  const preloadSource = readSource("electron/preload.cts");
  const typesSource = readSource("src/types.d.ts");

  assert.match(preloadSource, /compress:\s*\(inputId: string, preset: 'tiny' \| 'small' \| 'balanced' \| 'high-quality', outputFormat: 'auto' \| 'webp' \| 'jpg' \| 'png', options\?: \{ quality\?: number; maxDimension\?: 480 \| 720 \| 1080 \| 1440 \| 1920 \| 2560 \| 3840 \}\)/);
  assert.match(preloadSource, /ipcRenderer\.invoke\('image:compress', inputId, preset, outputFormat, options\)/);
  assert.match(typesSource, /compress: \(inputId: string, preset: 'tiny' \| 'small' \| 'balanced' \| 'high-quality', outputFormat: 'auto' \| 'webp' \| 'jpg' \| 'png', options\?: \{ quality\?: number; maxDimension\?: 480 \| 720 \| 1080 \| 1440 \| 1920 \| 2560 \| 3840 \}\) => Promise<\{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number \}>/);
});

test("image compressor route, navbar link, and home launcher are wired", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");
  const homeSource = readSource("src/pages/AppHomePage.tsx");

  assert.match(appSource, /ImageCompressorPage/);
  assert.match(appSource, /path="\/images\/compress"/);
  assert.match(navbarSource, /Image Compressor/);
  assert.match(navbarSource, /to: "\/images\/compress"/);
  assert.doesNotMatch(navbarSource, /Image Compressor", description: "Reduce file size without quality loss", to: "#", icon: Minimize2, comingSoon: true/);
  assert.match(homeSource, /Image Compressor/);
  assert.match(homeSource, /to: "\/images\/compress"/);
});

test("image compressor page provides batch controls, auto output, advanced controls, progress, cancel, and output access", () => {
  const source = readSource("src/pages/ImageCompressorPage.tsx");

  assert.match(source, /window\.api\.openDocFiles\("image"\)/);
  assert.match(source, /window\.api\.registerDroppedFile/);
  assert.match(source, /window\.api\.image\.compress\(file\.fileId, preset, outputFormat, compressionOptions\)/);
  assert.match(source, /window\.api\.image\.showInFolder/);
  assert.match(source, /window\.api\.cancelConvert/);
  assert.match(source, /window\.api\.onProgress/);
  assert.match(source, /setPreset\("tiny"\)/);
  assert.match(source, /setPreset\("small"\)/);
  assert.match(source, /setPreset\("balanced"\)/);
  assert.match(source, /setPreset\("high-quality"\)/);
  assert.match(source, /value: "auto"/);
  assert.match(source, /value: "webp"/);
  assert.match(source, /value: "jpg"/);
  assert.match(source, /value: "png"/);
  assert.match(source, /\.png\s+\.jpg\s+\.jpeg\s+\.webp\s+\.bmp\s+\.tiff/);
  assert.match(source, /Advanced Quality/);
  assert.match(source, /type="range"/);
  assert.match(source, /min=\{1\}/);
  assert.match(source, /max=\{100\}/);
  assert.match(source, /Max Dimension/);
  assert.match(source, /value=\{String\(customMaxDimension\)\}/);
  assert.match(source, /onValueChange=\{\(value\) =>/);
  assert.match(source, /SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent"/);
  assert.match(source, /SelectContent className="bg-card\/90 backdrop-blur-xl border-2"/);
  assert.match(source, /Original/);
  assert.match(source, /1920 px/);
  assert.match(source, /formatBytes\(file\.inputBytes\)/);
  assert.match(source, /formatBytes\(file\.outputBytes\)/);
  assert.match(source, /Clear Completed/);
});
