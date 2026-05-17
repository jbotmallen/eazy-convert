import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPRESSION_PRESETS,
  compressionOptionsSchema,
  formatBytes,
  isCompressionPresetId,
} from "../src/lib/video-compressor.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("video compressor presets expose stable ids and format-neutral labels", () => {
  assert.deepEqual(
    COMPRESSION_PRESETS.map((preset) => preset.id),
    ["tiny", "small", "balanced", "high-quality"],
  );
  assert.deepEqual(
    COMPRESSION_PRESETS.map((preset) => preset.label),
    ["Tiny", "Small", "Balanced", "High Quality"],
  );
  assert.equal(COMPRESSION_PRESETS.every((preset) => !preset.tooltip.includes("MP4")), true);
  assert.equal(isCompressionPresetId("tiny"), true);
  assert.equal(isCompressionPresetId("high-quality"), true);
  assert.equal(isCompressionPresetId("lossless"), false);
});

test("formatBytes emits compact binary size labels", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
});

test("advanced compression options validate custom CRF range", () => {
  assert.deepEqual(compressionOptionsSchema.parse({ crf: 18 }), { crf: 18 });
  assert.deepEqual(compressionOptionsSchema.parse({ crf: 35 }), { crf: 35 });
  assert.deepEqual(compressionOptionsSchema.parse({ crf: 26, maxHeight: 720 }), { crf: 26, maxHeight: 720 });
  assert.deepEqual(compressionOptionsSchema.parse({ maxHeight: 2160 }), { maxHeight: 2160 });
  assert.throws(() => compressionOptionsSchema.parse({ crf: 17 }), /Too small/);
  assert.throws(() => compressionOptionsSchema.parse({ crf: 36 }), /Too big/);
  assert.throws(() => compressionOptionsSchema.parse({ crf: 24.5 }), /expected int/);
  assert.throws(() => compressionOptionsSchema.parse({ maxHeight: 999 }), /Invalid input/);
  assert.throws(() => compressionOptionsSchema.parse({ maxHeight: 719 }), /Invalid input/);
});

test("preload and types expose video compression API", () => {
  const preloadSource = readSource("electron/preload.cts");
  const typesSource = readSource("src/types.d.ts");

  assert.match(preloadSource, /compress:\s*\(inputId: string, preset: 'tiny' \| 'small' \| 'balanced' \| 'high-quality', outputFormat: string, options\?: \{ crf\?: number; maxHeight\?: 360 \| 480 \| 720 \| 1080 \| 1440 \| 2160 \}\)/);
  assert.match(preloadSource, /ipcRenderer\.invoke\('video:compress', inputId, preset, outputFormat, options\)/);
  assert.match(typesSource, /compress: \(inputId: string, preset: 'tiny' \| 'small' \| 'balanced' \| 'high-quality', outputFormat: string, options\?: \{ crf\?: number; maxHeight\?: 360 \| 480 \| 720 \| 1080 \| 1440 \| 2160 \}\) => Promise<\{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number \}>/);
});

test("video compressor route, navbar link, and home launcher are wired", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");
  const homeSource = readSource("src/pages/AppHomePage.tsx");

  assert.match(appSource, /VideoCompressorPage/);
  assert.match(appSource, /path="\/videos\/compress"/);
  assert.match(navbarSource, /Video Compressor/);
  assert.match(navbarSource, /to: "\/videos\/compress"/);
  assert.doesNotMatch(navbarSource, /Video Compressor", description: "Shrink file size without losing quality", to: "#", icon: Minimize2, comingSoon: true/);
  assert.match(homeSource, /Video Compressor/);
  assert.match(homeSource, /to: "\/videos\/compress"/);
});

test("video compressor page provides batch file selection, presets, progress, cancel, and output access", () => {
  const source = readSource("src/pages/VideoCompressorPage.tsx");

  assert.match(source, /window\.api\.openDocFiles\("video"\)/);
  assert.match(source, /window\.api\.registerDroppedFile/);
  assert.match(source, /window\.api\.video\.compress\(file\.fileId, preset, outputFormat, compressionOptions\)/);
  assert.match(source, /window\.api\.video\.showInFolder/);
  assert.match(source, /window\.api\.cancelConvert/);
  assert.match(source, /window\.api\.onProgress/);
  assert.match(source, /setPreset\("tiny"\)/);
  assert.match(source, /setPreset\("small"\)/);
  assert.match(source, /setPreset\("balanced"\)/);
  assert.match(source, /setPreset\("high-quality"\)/);
  assert.match(source, /Target Export Format/);
  assert.match(source, /SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent"/);
  assert.match(source, /SelectContent className="bg-card\/90 backdrop-blur-xl border-2"/);
  for (const format of ["mp4", "webm", "avi", "mov", "mkv"]) {
    assert.match(source, new RegExp(`value: "${format}"`));
  }
  assert.match(source, /\.mp4\s+\.webm\s+\.avi\s+\.mov\s+\.mkv/);
  assert.match(source, /formatBytes\(file\.inputBytes\)/);
  assert.match(source, /formatBytes\(file\.outputBytes\)/);
  assert.match(source, /Clear Completed/);
});

test("video compression backend writes selected target format", () => {
  const handlerSource = readSource("electron/handlers/videoTools.ts");
  const helperSource = readSource("electron/utils/videoCompress.ts");

  assert.match(handlerSource, /ipcMain\.handle\("video:compress", async \(event, inputId: string, presetId: unknown, outputFormat: unknown, options: unknown\)/);
  assert.match(handlerSource, /assertCompressionOutputFormat\(outputFormat\)/);
  assert.match(handlerSource, /getCompressionOutputPath\(inputPath, outputFormat\)/);
  assert.match(helperSource, /export function assertCompressionOutputFormat\(value: unknown\): asserts value is CompressionOutputFormat/);
  assert.match(helperSource, /export function getCompressionOutputPath\(inputPath: string, outputFormat: CompressionOutputFormat\): string/);
});

test("video compressor page exposes advanced CRF controls with renderer validation", () => {
  const source = readSource("src/pages/VideoCompressorPage.tsx");

  assert.match(source, /const \[showAdvancedControls, setShowAdvancedControls\] = useState\(false\)/);
  assert.match(source, /const \[customCrf, setCustomCrf\] = useState\(26\)/);
  assert.match(source, /compressionOptionsSchema\.safeParse/);
  assert.match(source, /Advanced Quality/);
  assert.match(source, /type="range"/);
  assert.match(source, /min=\{18\}/);
  assert.match(source, /max=\{35\}/);
  assert.match(source, /Custom CRF/);
  assert.match(source, /Lower CRF means higher quality/);
  assert.match(source, /compressionOptions/);
});

test("video compressor page exposes advanced resolution control with renderer validation", () => {
  const source = readSource("src/pages/VideoCompressorPage.tsx");

  assert.match(source, /const \[customMaxHeight, setCustomMaxHeight\] = useState<"original" \| 360 \| 480 \| 720 \| 1080 \| 1440 \| 2160>\("original"\)/);
  assert.match(source, /maxHeight: customMaxHeight === "original" \? undefined : customMaxHeight/);
  assert.match(source, /Max Resolution/);
  assert.match(source, /value=\{String\(customMaxHeight\)\}/);
  assert.match(source, /onValueChange=\{\(value\) =>/);
  assert.match(source, /SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent"/);
  assert.match(source, /SelectContent className="bg-card\/90 backdrop-blur-xl border-2"/);
  assert.match(source, /Original/);
  assert.match(source, /360p/);
  assert.match(source, /720p/);
  assert.match(source, /1080p/);
  assert.match(source, /2160p/);
});

test("video compressor presets show hoverable info tooltips", () => {
  const source = readSource("src/pages/VideoCompressorPage.tsx");

  assert.match(source, /Info/);
  assert.match(source, /presetOption\.tooltip/);
  assert.match(source, /group-hover:opacity-100/);
  assert.match(source, /title=\{presetOption\.tooltip\}/);
  assert.match(source, /aria-label=\{`\$\{presetOption\.label\} preset details`\}/);
});
