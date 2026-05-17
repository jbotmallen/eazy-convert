import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clampTrimRange,
  formatDuration,
  validateTrimRange,
} from "../src/lib/audio-trimmer.ts";
import { buildAudioTrimArgs } from "../electron/utils/audioTrim.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("audio trim helpers keep ranges ordered and formatted", () => {
  assert.equal(formatDuration(75), "00:01:15");
  assert.deepEqual(validateTrimRange(5, 20, 120), { ok: true, clipSeconds: 15 });
  assert.deepEqual(validateTrimRange(20, 20, 120), { ok: false, error: "End time must be after start time." });
  assert.deepEqual(clampTrimRange(80, 20, 120), { startSeconds: 20, endSeconds: 80 });
});

test("audio trimmer backend, preload, and types are wired without raw input paths", () => {
  const mainSource = readSource("electron/main.ts");
  const preloadSource = readSource("electron/preload.cts");
  const typesSource = readSource("src/types.d.ts");
  const handlerSource = readSource("electron/handlers/audioTools.ts");

  assert.match(mainSource, /registerAudioToolHandlers\(\)/);
  assert.match(mainSource, /AUDIO_PREVIEW_SCHEME/);
  assert.match(preloadSource, /audio:\s*\{/);
  assert.match(preloadSource, /probe:\s*\(inputId: string\)/);
  assert.match(preloadSource, /preview:\s*\(inputId: string\)/);
  assert.match(preloadSource, /previewTrim:\s*\(inputId: string, startSeconds: number, endSeconds: number\)/);
  assert.match(preloadSource, /trim:\s*\(inputId: string, startSeconds: number, endSeconds: number, outputFormat: 'mp3' \| 'ogg' \| 'wav' \| 'aac' \| 'flac', options\?: \{ mode: 'fast' \| 'accurate'; qualityPreset: 'standard' \| 'small' \| 'high' \| 'custom'/);
  assert.match(typesSource, /audio:\s*\{/);
  assert.match(typesSource, /trim: \(inputId: string, startSeconds: number, endSeconds: number, outputFormat: 'mp3' \| 'ogg' \| 'wav' \| 'aac' \| 'flac', options\?: \{ mode: 'fast' \| 'accurate'; qualityPreset: 'standard' \| 'small' \| 'high' \| 'custom'/);
  assert.match(handlerSource, /resolveRegisteredFilePath\(inputId\)/);
  assert.doesNotMatch(handlerSource, /ipcMain\.handle\("audio:trim"[\s\S]*inputPath: string/);
});

test("audio trimmer supports converter output targets and quality presets", () => {
  const handlerSource = readSource("electron/handlers/audioTools.ts");
  const utilSource = readSource("electron/utils/audioTrim.ts");
  const pageSource = readSource("src/pages/AudioTrimmerPage.tsx");

  for (const format of ["mp3", "ogg", "wav", "aac", "flac"]) {
    assert.match(pageSource, new RegExp(`value: "${format}"`));
    assert.match(utilSource, new RegExp(`"${format}"`));
  }

  for (const preset of ["standard", "small", "high", "custom"]) {
    assert.match(pageSource, new RegExp(`value: "${preset}"`));
    assert.match(utilSource, new RegExp(`"${preset}"`));
  }

  assert.match(handlerSource, /assertAudioOutputFormat\(outputFormat\)/);
  assert.match(handlerSource, /validateAudioTrimOptions\(options\)/);
  assert.match(handlerSource, /const canStreamCopy = audioTrimOptions\.mode === "fast" && path\.extname\(inputPath\)\.toLowerCase\(\) === `\.\$\{outputFormat\}`/);
  assert.match(pageSource, /setQualityPreset\(preset\.value\)/);
  assert.match(pageSource, /qualityPreset === "custom"/);
  assert.match(pageSource, /bitrateKbps/);
  assert.match(pageSource, /oggQuality/);
  assert.match(pageSource, /compressionLevel/);
});

test("audio trim encoder args keep custom controls format-specific", () => {
  assert.deepEqual(
    buildAudioTrimArgs("ogg", {
      mode: "accurate",
      qualityPreset: "custom",
      custom: { bitrateKbps: 192, quality: 7 },
    }),
    ["-c:a", "libvorbis", "-q:a", "7"],
  );
  assert.deepEqual(
    buildAudioTrimArgs("aac", {
      mode: "accurate",
      qualityPreset: "custom",
      custom: { bitrateKbps: 160 },
    }),
    ["-c:a", "aac", "-b:a", "160k"],
  );
});

test("audio trimmer route, navbar link, and home launcher are wired", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");
  const homeSource = readSource("src/pages/AppHomePage.tsx");

  assert.match(appSource, /AudioTrimmerPage/);
  assert.match(appSource, /path="\/audio\/trim"/);
  assert.match(navbarSource, /Audio Trimmer/);
  assert.match(navbarSource, /to: "\/audio\/trim"/);
  assert.doesNotMatch(navbarSource, /Audio Splitter", description: "Split audio by timestamps", to: "#", icon: Scissors, comingSoon: true/);
  assert.match(homeSource, /Audio Trimmer/);
  assert.match(homeSource, /to: "\/audio\/trim"/);
});

test("audio trimmer page uses audio previews, trim controls, progress, cancel, and output folder", () => {
  const source = readSource("src/pages/AudioTrimmerPage.tsx");

  assert.match(source, /window\.api\.openDocFiles\("audio"\)/);
  assert.match(source, /window\.api\.registerDroppedFile/);
  assert.match(source, /window\.api\.audio\.probe/);
  assert.match(source, /window\.api\.audio\.preview\(ref\.id\)/);
  assert.match(source, /window\.api\.audio\.previewTrim\(file\.id, trimStartSeconds, trimEndSeconds\)/);
  assert.match(source, /window\.api\.audio\.revokePreview\(urlOrToken\)/);
  assert.match(source, /window\.api\.audio\.trim/);
  assert.match(source, /window\.api\.audio\.showInFolder\(outputPath\)/);
  assert.match(source, /const audioRef = useRef<HTMLAudioElement \| null>\(null\)/);
  assert.match(source, /<audio[\s\S]*ref=\{audioRef\}[\s\S]*controls[\s\S]*src=\{previewUrl\}/);
  assert.match(source, /<audio[\s\S]*controls[\s\S]*src=\{trimPreviewUrl\}/);
  assert.match(source, /type="range"/);
  assert.match(source, /TabsTrigger/);
  assert.match(source, /Full Audio/);
  assert.match(source, /Trimmed Preview/);
  assert.match(source, /window\.api\.cancelConvert/);
  assert.match(source, /onProgress/);
  assert.match(source, /Saved Output/);
  assert.match(source, /Open Folder/);
});
