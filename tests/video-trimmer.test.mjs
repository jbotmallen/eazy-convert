import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clampTrimRange,
  formatDuration,
  parseDurationInput,
  validateTrimRange,
} from "../src/lib/video-trimmer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("parseDurationInput accepts seconds, mm:ss, and hh:mm:ss", () => {
  assert.equal(parseDurationInput("75"), 75);
  assert.equal(parseDurationInput("01:15"), 75);
  assert.equal(parseDurationInput("01:02:03"), 3723);
  assert.equal(parseDurationInput(" 00:00:05 "), 5);
});

test("parseDurationInput rejects malformed or negative values", () => {
  assert.equal(parseDurationInput(""), null);
  assert.equal(parseDurationInput("-1"), null);
  assert.equal(parseDurationInput("1:99"), null);
  assert.equal(parseDurationInput("abc"), null);
});

test("formatDuration emits stable hh:mm:ss strings", () => {
  assert.equal(formatDuration(5), "00:00:05");
  assert.equal(formatDuration(75), "00:01:15");
  assert.equal(formatDuration(3723), "01:02:03");
});

test("validateTrimRange accepts only in-bounds forward ranges", () => {
  assert.deepEqual(validateTrimRange(5, 20, 120), { ok: true, clipSeconds: 15 });
  assert.deepEqual(validateTrimRange(20, 20, 120), { ok: false, error: "End time must be after start time." });
  assert.deepEqual(validateTrimRange(-1, 20, 120), { ok: false, error: "Start time must be zero or greater." });
  assert.deepEqual(validateTrimRange(5, 121, 120), { ok: false, error: "End time must be within the video duration." });
});

test("clampTrimRange keeps slider ranges ordered and inside the video duration", () => {
  assert.deepEqual(clampTrimRange(10, 40, 120), { startSeconds: 10, endSeconds: 40 });
  assert.deepEqual(clampTrimRange(-5, 999, 120), { startSeconds: 0, endSeconds: 120 });
  assert.deepEqual(clampTrimRange(80, 20, 120), { startSeconds: 20, endSeconds: 80 });
  assert.deepEqual(clampTrimRange(12, 12, 120), { startSeconds: 12, endSeconds: 12.1 });
  assert.deepEqual(clampTrimRange(119.99, 119.99, 120), { startSeconds: 119.9, endSeconds: 120 });
});

test("preload exposes video trim APIs without raw file paths", () => {
  const preloadSource = readSource("electron/preload.cts");
  const typesSource = readSource("src/types.d.ts");

  assert.match(preloadSource, /video:\s*\{/);
  assert.match(preloadSource, /probe:\s*\(inputId: string\)/);
  assert.match(preloadSource, /trim:\s*\(inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' \| 'accurate'\)/);
  assert.match(preloadSource, /preview:\s*\(inputId: string\)/);
  assert.match(preloadSource, /previewTrim:\s*\(inputId: string, startSeconds: number, endSeconds: number\)/);
  assert.match(preloadSource, /revokePreview:\s*\(urlOrToken: string\)/);
  assert.match(preloadSource, /showInFolder:\s*\(filePath: string\)/);
  assert.match(preloadSource, /ipcRenderer\.invoke\('video:preview'/);
  assert.match(preloadSource, /ipcRenderer\.invoke\('video:preview-trim'/);
  assert.match(preloadSource, /ipcRenderer\.invoke\('video:preview:revoke'/);
  assert.match(preloadSource, /ipcRenderer\.invoke\('video:show-in-folder'/);
  assert.match(typesSource, /video:\s*\{/);
  assert.match(typesSource, /probe: \(inputId: string\) => Promise<\{ durationSeconds: number \}>/);
  assert.match(typesSource, /trim: \(inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' \| 'accurate'\) => Promise<\{ success: boolean; outputPath: string \}>/);
  assert.match(typesSource, /preview: \(inputId: string\) => Promise<\{ url: string \}>/);
  assert.match(typesSource, /previewTrim: \(inputId: string, startSeconds: number, endSeconds: number\) => Promise<\{ url: string \}>/);
  assert.match(typesSource, /revokePreview: \(urlOrToken: string\) => Promise<\{ success: boolean \}>/);
  assert.match(typesSource, /showInFolder: \(filePath: string\) => Promise<void>/);
  const videoTypesBlock = typesSource.match(/video:\s*\{[\s\S]*?\n\s*\};/)?.[0] ?? "";
  assert.doesNotMatch(videoTypesBlock, /Promise<string>/);
});

test("video trimmer route, navbar link, and home launcher are wired", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");
  const homeSource = readSource("src/pages/AppHomePage.tsx");

  assert.match(appSource, /VideoTrimmerPage/);
  assert.match(appSource, /path="\/videos\/trim"/);
  assert.match(navbarSource, /Video Trimmer/);
  assert.match(navbarSource, /to: "\/videos\/trim"/);
  assert.doesNotMatch(navbarSource, /Video Trimmer", description: "Cut clips to the perfect length", to: "#", icon: Scissors, comingSoon: true/);
  assert.match(homeSource, /Video Trimmer/);
  assert.match(homeSource, /to: "\/videos\/trim"/);
});

test("video trimmer page provides file selection, time controls, mode toggle, progress, and cancel", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /window\.api\.openDocFiles\("video"\)/);
  assert.match(source, /window\.api\.registerDroppedFile/);
  assert.match(source, /window\.api\.video\.probe/);
  assert.match(source, /window\.api\.video\.trim/);
  assert.match(source, /clampTrimRange/);
  assert.match(source, /validateTrimRange/);
  assert.match(source, /setMode\("fast"\)/);
  assert.match(source, /setMode\("accurate"\)/);
  assert.match(source, /window\.api\.cancelConvert/);
  assert.match(source, /onProgress/);
  assert.match(source, /probeRequestRef/);
});

test("video trimmer page uses numeric slider state to keep valid trim times clickable", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /const \[trimStartSeconds, setTrimStartSeconds\] = useState\(0\)/);
  assert.match(source, /const \[trimEndSeconds, setTrimEndSeconds\] = useState\(0\)/);
  assert.match(source, /type="range"/);
  assert.match(source, /clampTrimRange/);
  assert.match(source, /setTrimStartSeconds\(range\.startSeconds\)/);
  assert.match(source, /setTrimEndSeconds\(range\.endSeconds\)/);
  assert.match(source, /disabled=\{Boolean\(file\) && \(!validation\.ok \|\| isTrimming\)\}/);
  assert.doesNotMatch(source, /value=\{startText\}/);
  assert.doesNotMatch(source, /value=\{endText\}/);
});

test("video trimmer page requests and revokes backend preview URLs", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /const \[previewUrl, setPreviewUrl\] = useState<string \| null>\(null\)/);
  assert.match(source, /const previewUrlRef = useRef<string \| null>\(null\)/);
  assert.match(source, /window\.api\.video\.preview\(ref\.id\)/);
  assert.match(source, /window\.api\.video\.revokePreview\(urlOrToken\)/);
  assert.match(source, /revokeCurrentPreview/);
  assert.match(source, /return \(\) => \{[\s\S]*void revokeCurrentPreview\(\);?[\s\S]*\}/);
});

test("video trimmer page renders shadcn tabs for full and trimmed video previews", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");
  const tabsSource = readSource("src/components/ui/tabs.tsx");

  assert.match(tabsSource, /data-slot="tabs"/);
  assert.match(tabsSource, /role="tablist"/);
  assert.match(source, /Tabs/);
  assert.match(source, /TabsList/);
  assert.match(source, /TabsTrigger/);
  assert.match(source, /TabsContent/);
  assert.match(source, /value="full"/);
  assert.match(source, /value="trimmed"/);
  assert.match(source, /Full Video/);
  assert.match(source, /Trimmed Preview/);
});

test("video trimmer page debounces trimmed preview generation by one second", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /const \[trimPreviewUrl, setTrimPreviewUrl\] = useState<string \| null>\(null\)/);
  assert.match(source, /const trimPreviewUrlRef = useRef<string \| null>\(null\)/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /1000/);
  assert.match(source, /window\.api\.video\.previewTrim\(file\.id, trimStartSeconds, trimEndSeconds\)/);
  assert.match(source, /window\.api\.video\.revokePreview\(urlOrToken\)/);
  assert.match(source, /trimPreviewRequestRef/);
});

test("video trimmer page renders a metadata-only 16:9 video preview from previewUrl", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /const videoRef = useRef<HTMLVideoElement \| null>\(null\)/);
  assert.match(source, /<video[\s\S]*ref=\{videoRef\}[\s\S]*controls[\s\S]*preload="metadata"[\s\S]*src=\{previewUrl\}/);
  assert.match(source, /aspect-video/);
  assert.doesNotMatch(source, /src=\{file\./);
  assert.doesNotMatch(source, /src=\{.*path.*\}/);
});

test("video trimmer page has preview seek and set buttons for start and end times", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /handleSeekStart/);
  assert.match(source, /handleSeekEnd/);
  assert.match(source, /videoRef\.current\.currentTime = trimStartSeconds/);
  assert.match(source, /videoRef\.current\.currentTime = trimEndSeconds/);
});

test("video trimmer page can play only the selected trim preview range", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /const \[isPreviewingTrim, setIsPreviewingTrim\] = useState\(false\)/);
  assert.match(source, /handlePlayTrimPreview/);
  assert.match(source, /Trim Preview/);
  assert.match(source, /timeupdate/);
  assert.match(source, /video\.pause\(\)/);
  assert.match(source, /video\.currentTime = trimStartSeconds/);
});

test("video trimmer page shows the saved output path and can open it in the file manager", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /const \[outputPath, setOutputPath\] = useState<string \| null>\(null\)/);
  assert.match(source, /const result = await window\.api\.video\.trim/);
  assert.match(source, /setOutputPath\(result\.outputPath\)/);
  assert.match(source, /window\.api\.video\.showInFolder\(outputPath\)/);
  assert.match(source, /Saved Output/);
  assert.match(source, /readOnly/);
  assert.match(source, /Open Folder/);
});
