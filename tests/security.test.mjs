import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isAllowedExternalUrl,
  isAllowedYoutubeUrl,
  isAllowedDocumentPath,
  isAllowedDownloadFormat,
  isAllowedYoutubeQuality,
  escapeHtml,
} from "../dist-electron/utils/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("external URLs only allow https", () => {
  assert.equal(isAllowedExternalUrl("https://aka.ms/vs/17/release/vc_redist.x64.exe"), true);
  assert.equal(isAllowedExternalUrl("https://github.com/jbotmallen/eazy-convert"), true);
  assert.equal(isAllowedExternalUrl("https://www.github.com/jbotmallen/eazy-convert"), true);
  assert.equal(isAllowedExternalUrl("https://www.linkedin.com/in/mark-allen-jugalbot-b60a5a1b6/"), true);
  assert.equal(isAllowedExternalUrl("http://github.com/example"), false);
  assert.equal(isAllowedExternalUrl("https://evil.example/path"), false);
  assert.equal(isAllowedExternalUrl("file:///C:/Windows/System32/calc.exe"), false);
  assert.equal(isAllowedExternalUrl("not a url"), false);
});

test("youtube URLs only allow known YouTube hosts", () => {
  assert.equal(isAllowedYoutubeUrl("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(isAllowedYoutubeUrl("https://youtu.be/abc"), true);
  assert.equal(isAllowedYoutubeUrl("https://evil.example/watch?v=abc"), false);
  assert.equal(isAllowedYoutubeUrl("javascript:alert(1)"), false);
});

test("document paths require absolute allowed extension and no traversal segment", () => {
  assert.equal(isAllowedDocumentPath("C:\\Users\\USER\\file.pdf", [".pdf"]), true);
  assert.equal(isAllowedDocumentPath("C:\\Users\\USER\\file.xlsx", [".pdf"]), false);
  assert.equal(isAllowedDocumentPath("relative\\file.pdf", [".pdf"]), false);
  assert.equal(isAllowedDocumentPath("C:\\Users\\USER\\..\\secret.pdf", [".pdf"]), false);
});

test("production app does not expose DevTools shortcut", () => {
  const source = readSource("electron/main.ts");
  const shortcutIndex = source.indexOf("before-input-event");
  assert.notEqual(shortcutIndex, -1);
  const guardIndex = Math.max(
    source.lastIndexOf('process.env.NODE_ENV === "development"', shortcutIndex),
    source.lastIndexOf("if (isDevelopment)", shortcutIndex),
  );
  assert.ok(guardIndex > -1 && shortcutIndex - guardIndex < 120, "DevTools shortcut must be gated to development");
});

test("development app exposes Inspect Element from the context menu", () => {
  const source = readSource("electron/main.ts");
  const menuIndex = source.indexOf("context-menu");
  assert.notEqual(menuIndex, -1);
  const guardIndex = source.lastIndexOf("if (isDevelopment)", menuIndex);
  assert.ok(guardIndex > -1 && menuIndex - guardIndex < 600, "Inspect Element menu must be gated to development");
  assert.match(source, /Menu\.buildFromTemplate/);
  assert.match(source, /Inspect Element/);
  assert.match(source, /inspectElement\(params\.x, params\.y\)/);
});

test("document print windows disable script execution and block navigation", () => {
  const utilsSource = readSource("electron/handlers/document/utils.ts");
  assert.match(utilsSource, /will-navigate/);
  assert.match(utilsSource, /setWindowOpenHandler\(\(\)\s*=>\s*\(\{\s*action:\s*"deny"\s*\}\)\)/);

  for (const file of ["electron/handlers/document/docx.ts", "electron/handlers/document/markdown.ts"]) {
    const source = readSource(file);
    assert.match(source, /javascript:\s*false/, `${file} must disable JavaScript in hidden conversion windows`);
    assert.match(source, /hardenDocumentWindow\(win\)/, `${file} must harden hidden conversion windows`);
  }
});

test("generated document HTML includes a restrictive CSP", () => {
  const utilsSource = readSource("electron/handlers/document/utils.ts");
  assert.match(utilsSource, /Content-Security-Policy/);
  assert.match(utilsSource, /script-src 'none'/);
  assert.match(utilsSource, /connect-src 'none'/);

  for (const file of ["electron/handlers/document/docx.ts", "electron/handlers/document/markdown.ts"]) {
    const source = readSource(file);
    assert.match(source, /createDocumentHtml\(/, `${file} generated HTML must include CSP`);
  }
});

test("app CSP blocks script injection primitives", () => {
  const source = readSource("electron/main.ts");
  assert.match(source, /isDevelopment \? "script-src 'self' 'unsafe-inline'; " : "script-src 'self'; "/);
  assert.match(source, /ws:\/\/localhost:5173/, "development CSP must allow Vite websocket");
  assert.match(source, /object-src 'none'/, "app CSP must block plugins");
  assert.match(source, /base-uri 'none'/, "app CSP must block base tag URL rewriting");
  assert.match(source, /frame-src 'none'/, "app CSP must block frames");
});

test("media previews use opaque custom protocols instead of native file paths", () => {
  const mainSource = readSource("electron/main.ts");
  const handlerSource = readSource("electron/handlers/videoTools.ts");
  const audioHandlerSource = readSource("electron/handlers/audioTools.ts");

  assert.match(mainSource, /protocol\.handle\(\s*VIDEO_PREVIEW_SCHEME/);
  assert.match(mainSource, /createVideoPreviewProtocolHandler\(\)/);
  assert.match(mainSource, /protocol\.handle\(\s*AUDIO_PREVIEW_SCHEME/);
  assert.match(mainSource, /createAudioPreviewProtocolHandler\(\)/);
  assert.match(mainSource, /media-src 'self' blob: app-video-preview: app-audio-preview:;/);
  assert.ok(
    mainSource.indexOf("registerVideoToolHandlers()") < mainSource.indexOf("mainWindow.loadURL"),
    "video IPC handlers must be registered before the renderer loads",
  );

  assert.match(handlerSource, /const previewTokens = new PreviewTokenStore\(\)/);
  assert.match(handlerSource, /randomUUID\(\)/);
  assert.match(handlerSource, /ipcMain\.handle\("video:preview"/);
  assert.match(handlerSource, /ipcMain\.handle\("video:preview-trim"/);
  assert.match(handlerSource, /ipcMain\.handle\("video:preview:revoke"/);
  assert.match(handlerSource, /resolveRegisteredFilePath\((senderId|event\.sender\.id),\s*inputId\)/);
  assert.match(handlerSource, /assertVideoInput\(inputPath\)/);
  assert.match(handlerSource, /VIDEO_EXTS/);
  assert.match(handlerSource, /Content-Type/);
  assert.match(handlerSource, /fs\.createReadStream/);
  assert.match(handlerSource, /previewTokens\.delete/);
  assert.doesNotMatch(handlerSource, /return\s+\{\s*path:/);

  assert.match(audioHandlerSource, /const previewTokens = new PreviewTokenStore\(\)/);
  assert.match(audioHandlerSource, /ipcMain\.handle\("audio:preview"/);
  assert.match(audioHandlerSource, /ipcMain\.handle\("audio:preview-trim"/);
  assert.match(audioHandlerSource, /ipcMain\.handle\("audio:preview:revoke"/);
  assert.match(audioHandlerSource, /resolveRegisteredFilePath\((senderId|event\.sender\.id),\s*inputId\)/);
  assert.match(audioHandlerSource, /assertAudioInput\(inputPath\)/);
  assert.match(audioHandlerSource, /Content-Type/);
  assert.match(audioHandlerSource, /fs\.createReadStream/);
  assert.doesNotMatch(audioHandlerSource, /return\s+\{\s*path:/);
});

test("compiled Electron main registers trimmed preview IPC before renderer load", () => {
  const compiledMain = readSource("dist-electron/main.js");
  const compiledHandler = readSource("dist-electron/handlers/videoTools.js");
  const compiledPreload = readSource("dist-electron/preload.cjs");

  assert.match(compiledPreload, /ipcRenderer\.invoke\('video:preview-trim'/);
  assert.match(compiledHandler, /ipcMain\.handle\("video:preview-trim"/);
  assert.match(compiledMain, /registerVideoToolHandlers\(\)/);
  assert.ok(
    compiledMain.indexOf("registerVideoToolHandlers()") < compiledMain.indexOf("mainWindow.loadURL"),
    "compiled video IPC handlers must be registered before the renderer loads",
  );
});

test("video quality values are allowlisted", async () => {
  const security = await import("../dist-electron/utils/security.js");
  assert.equal(typeof security.isAllowedVideoQuality, "function");
  assert.equal(security.isAllowedVideoQuality("original"), true);
  assert.equal(security.isAllowedVideoQuality("1080"), true);
  assert.equal(security.isAllowedVideoQuality("999999"), false);
  assert.equal(security.isAllowedVideoQuality("-1"), false);
});

test("youtube download format and quality values are allowlisted", () => {
  assert.equal(isAllowedDownloadFormat("mp4"), true);
  assert.equal(isAllowedDownloadFormat("mp3"), true);
  assert.equal(isAllowedDownloadFormat("mkv"), false);
  assert.equal(isAllowedDownloadFormat(""), false);

  assert.equal(isAllowedYoutubeQuality("best"), true);
  assert.equal(isAllowedYoutubeQuality("1080"), true);
  assert.equal(isAllowedYoutubeQuality("999999"), false);
  assert.equal(isAllowedYoutubeQuality("-1"), false);
});

test("html escaping protects generated document markup", () => {
  assert.equal(
    escapeHtml(`x</title><script>alert("x")</script>&'`),
    "x&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;",
  );
});

test("renderer no longer receives raw native file paths", () => {
  const preloadSource = readSource("electron/preload.cts");
  const converterSource = readSource("electron/handlers/converter/index.ts");

  assert.doesNotMatch(preloadSource, /getPathForFile:\s*\(/);
  assert.doesNotMatch(converterSource, /outputPath:\s*string/);
  assert.match(converterSource, /resolveRegisteredFilePath/);
});

test("document handlers enforce size and page-count limits before heavy processing", () => {
  const securitySource = readSource("electron/utils/security.ts");
  const pdfSource = readSource("electron/handlers/document/pdf.ts");
  const docxSource = readSource("electron/handlers/document/docx.ts");
  const markdownSource = readSource("electron/handlers/document/markdown.ts");

  assert.match(securitySource, /MAX_DOCUMENT_FILE_SIZE_BYTES/);
  assert.match(securitySource, /assertDocumentFileWithinLimit/);
  assert.match(pdfSource, /MAX_PDF_PAGE_COUNT/);
  assert.match(pdfSource, /assertPdfPageCountWithinLimit/);

  for (const source of [pdfSource, docxSource, markdownSource]) {
    assert.match(source, /assertDocumentFileWithinLimit/);
  }
});

test("desktop packaging verifies bundled yt-dlp is patched", () => {
  const packageJson = JSON.parse(readSource("package.json"));

  assert.equal(
    packageJson.scripts["prebuild:desktop"],
    "node scripts/check-ytdlp-version.mjs",
  );

  const guardSource = readSource("scripts/check-ytdlp-version.mjs");
  assert.match(guardSource, /MIN_YT_DLP_VERSION\s*=\s*"2026\.02\.21"/);
  // Package was migrated from the dead `yt-dlp-exec` (Marinos33/2021) to the
  // maintained `youtube-dl-exec` (microlinkhq) — see electron/handlers/downloader.ts.
  for (const pathSegment of ["node_modules", "youtube-dl-exec", "bin", "yt-dlp.exe"]) {
    assert.match(guardSource, new RegExp(`"${pathSegment.replace(".", "\\.")}"`));
  }
});

test("video trim IPC validates registered files, times, modes, and video extensions", () => {
  const handlerSource = readSource("electron/handlers/videoTools.ts");
  const mainSource = readSource("electron/main.ts");

  assert.match(mainSource, /registerVideoToolHandlers\(\)/);
  assert.match(handlerSource, /ipcMain\.handle\("video:probe"/);
  assert.match(handlerSource, /ipcMain\.handle\("video:trim"/);
  assert.match(handlerSource, /resolveRegisteredFilePath/);
  assert.match(handlerSource, /VIDEO_EXTS/);
  assert.match(handlerSource, /validateTrimRange/);
  assert.match(handlerSource, /mode !== "fast" && mode !== "accurate"/);
  assert.match(handlerSource, /conversion-progress/);
  assert.match(handlerSource, /activeConversions/);
  assert.match(handlerSource, /activeProbes/);
  assert.match(handlerSource, /throw new Error\("Video operation already in progress\."\)/);
  assert.match(handlerSource, /setTimeout/);
  assert.match(handlerSource, /"-n"/);
  assert.match(handlerSource, /resolve\(\{ success: true, outputPath \}\)/);
  assert.doesNotMatch(handlerSource, /resolve\(outputPath\)/);
});

test("video output folder opener validates saved video paths", () => {
  const handlerSource = readSource("electron/handlers/videoTools.ts");
  const preloadSource = readSource("electron/preload.cts");

  assert.match(handlerSource, /ipcMain\.handle\("video:show-in-folder"/);
  assert.match(handlerSource, /assertProducedOutput\(filePath\)/);
  assert.match(handlerSource, /assertVideoOutput\(allowed\)/);
  assert.match(handlerSource, /shell\.showItemInFolder\(allowed\)/);
  assert.match(preloadSource, /showInFolder:\s*\(filePath: string\) => ipcRenderer\.invoke\('video:show-in-folder', filePath\)/);
});

test("trimmed video preview is generated in temp storage and registered by token", () => {
  const handlerSource = readSource("electron/handlers/videoTools.ts");
  const compiledHandlerSource = readSource("dist-electron/handlers/videoTools.js");

  assert.match(handlerSource, /getTempTrimPreviewPath/);
  assert.match(handlerSource, /app\.getPath\("temp"\)/);
  assert.match(handlerSource, /trimPreviewFiles/);
  assert.match(handlerSource, /validateTrimRange\(startSeconds, endSeconds, durationSeconds\)/);
  assert.match(handlerSource, /previewTokens\.set\(token, previewPath,/);
  assert.match(handlerSource, /cleanupTrimPreviewFile/);
  assert.match(handlerSource, /"-t"/);
  assert.match(handlerSource, /"-c", "copy"/);
  assert.match(compiledHandlerSource, /video:preview-trim/);
});

test("video compression IPC validates registered files, presets, output names, and progress", () => {
  const handlerSource = readSource("electron/handlers/videoTools.ts");
  const helperSource = readSource("electron/utils/videoCompress.ts");

  assert.match(handlerSource, /ipcMain\.handle\("video:compress"/);
  assert.match(handlerSource, /compressionOptionsSchema\.parse\(options/);
  assert.match(handlerSource, /resolveRegisteredFilePath\(senderId,\s*inputId\)/);
  assert.match(handlerSource, /assertVideoInput\(inputPath\)/);
  assert.match(handlerSource, /activeConversions/);
  assert.match(handlerSource, /probeDuration\(inputPath\)/);
  assert.match(handlerSource, /buildCompressionArgs/);
  assert.match(handlerSource, /getCompressionOutputPath/);
  assert.match(handlerSource, /conversion-progress/);
  assert.match(handlerSource, /inputBytes/);
  assert.match(handlerSource, /outputBytes/);
  assert.match(handlerSource, /resolve\(\{ success: true, outputPath, inputBytes, outputBytes \}\)/);

  assert.match(helperSource, /COMPRESSION_PRESETS/);
  assert.match(helperSource, /import \{ z \} from "zod"/);
  assert.match(helperSource, /compressionOptionsSchema/);
  assert.match(helperSource, /z\.number\(\)\.int\(\)\.min\(18\)\.max\(35\)/);
  assert.match(helperSource, /z\.union\(\[/);
  assert.match(helperSource, /z\.literal\(360\)/);
  assert.match(helperSource, /z\.literal\(2160\)/);
  assert.match(helperSource, /customCrf/);
  assert.match(helperSource, /customMaxHeight/);
  assert.match(helperSource, /options\.maxHeight/);
  assert.match(helperSource, /scale=-2:min\(\$\{options\.maxHeight\}/);
  assert.match(helperSource, /tiny/);
  assert.match(helperSource, /small/);
  assert.match(helperSource, /balanced/);
  assert.match(helperSource, /high-quality/);
  assert.match(helperSource, /_compressed_/);
  assert.match(helperSource, /YYYYMMDD-HHMMSS/);
  assert.match(helperSource, /getUniquePath/);
  assert.match(helperSource, /while\s*\(\s*fs\.existsSync/);
  assert.match(helperSource, /Invalid compression preset/);
  assert.match(helperSource, /libx264/);
  assert.match(helperSource, /yuv420p/);
  assert.match(helperSource, /\+faststart/);
});

test("image compression IPC validates registered files, output names, metadata stripping, and progress", () => {
  const handlerSource = readSource("electron/handlers/converter/image.ts");
  const helperSource = readSource("electron/utils/imageCompress.ts");

  assert.match(handlerSource, /ipcMain\.handle\("image:compress"/);
  assert.match(handlerSource, /imageCompressionOptionsSchema\.parse\(options/);
  assert.match(handlerSource, /resolveRegisteredFilePath\(senderId,\s*inputId\)/);
  assert.match(handlerSource, /assertImageInput\(inputPath\)/);
  assert.match(handlerSource, /activeImageCompressions/);
  assert.match(handlerSource, /buildImageCompressionArgs/);
  assert.match(handlerSource, /getImageCompressionOutputPath/);
  assert.match(handlerSource, /conversion-progress/);
  assert.match(handlerSource, /inputBytes/);
  assert.match(handlerSource, /outputBytes/);
  assert.match(handlerSource, /resolve\(\{ success: true, outputPath, inputBytes, outputBytes \}\)/);

  assert.match(helperSource, /IMAGE_COMPRESSION_PRESETS/);
  assert.match(helperSource, /import \{ z \} from "zod"/);
  assert.match(helperSource, /imageCompressionOptionsSchema/);
  assert.match(helperSource, /z\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/);
  assert.match(helperSource, /z\.literal\(480\)/);
  assert.match(helperSource, /z\.literal\(3840\)/);
  assert.match(helperSource, /getAutoImageOutputFormat/);
  assert.match(helperSource, /webp/);
  assert.match(helperSource, /jpg/);
  assert.match(helperSource, /png/);
  assert.match(helperSource, /_compressed_/);
  assert.match(helperSource, /YYYYMMDD-HHMMSS/);
  assert.match(helperSource, /getUniquePath/);
  assert.match(helperSource, /while\s*\(\s*fs\.existsSync/);
  assert.match(helperSource, /Invalid image compression preset/);
  assert.match(helperSource, /Invalid image compression output format/);
  assert.match(helperSource, /"-frames:v"/);
  assert.match(helperSource, /"-update"/);
  assert.match(helperSource, /"-map_metadata"/);
  assert.match(helperSource, /"-1"/);
});

test("file registry tokens are sender-scoped and expire", () => {
  const registrySource = readSource("electron/utils/fileRegistry.ts");
  const mainSource = readSource("electron/main.ts");
  const dialogSource = readSource("electron/handlers/dialogs.ts");

  assert.match(registrySource, /type RegisteredFile/);
  assert.match(registrySource, /senderId:\s*number/);
  assert.match(registrySource, /expiresAt:\s*number/);
  assert.match(registrySource, /FILE_TOKEN_TTL_MS/);
  assert.match(registrySource, /purgeExpiredRegisteredFiles/);
  assert.match(registrySource, /registerFilePath\(senderId:\s*number,\s*filePath:\s*string\)/);
  assert.match(registrySource, /resolveRegisteredFilePath\(senderId:\s*number,\s*fileId:\s*string\)/);
  assert.match(registrySource, /entry\.senderId !== senderId/);

  assert.match(mainSource, /registerFilePath\(event\.sender\.id,\s*filePath\)/);
  assert.match(dialogSource, /registerFilePath\(event\.sender\.id/);
});

test("media handlers enforce file size and duration limits before ffmpeg work", () => {
  const limitsSource = readSource("electron/utils/mediaLimits.ts");
  const converterSource = readSource("electron/handlers/converter/index.ts");
  const videoSource = readSource("electron/handlers/videoTools.ts");
  const audioSource = readSource("electron/handlers/audioTools.ts");
  const denoiseSource = readSource("electron/handlers/audioDenoise.ts");

  assert.match(limitsSource, /MAX_MEDIA_FILE_SIZE_BYTES/);
  assert.match(limitsSource, /MAX_MEDIA_DURATION_SECONDS/);
  assert.match(limitsSource, /assertMediaFileWithinLimit/);
  assert.match(limitsSource, /assertMediaDurationWithinLimit/);

  for (const source of [converterSource, videoSource, audioSource, denoiseSource]) {
    assert.match(source, /assertMediaFileWithinLimit/);
    assert.match(source, /assertMediaDurationWithinLimit/);
  }
});

test("convert IPC rejects concurrent work from the same sender", () => {
  const converterSource = readSource("electron/handlers/converter/index.ts");

  assert.match(converterSource, /const senderId = event\.sender\.id/);
  assert.match(converterSource, /activeConversions\.has\(senderId\)/);
  assert.match(converterSource, /throw new Error\("Conversion already in progress\."\)/);
  assert.match(converterSource, /activeConversions\.set\(senderId, ffmpegProcess\)/);
  assert.match(converterSource, /activeConversions\.delete\(senderId\)/);
});

test("trim preview IPC rejects concurrent preview jobs and times out ffmpeg", () => {
  for (const file of ["electron/handlers/videoTools.ts", "electron/handlers/audioTools.ts"]) {
    const source = readSource(file);
    assert.match(source, /activePreviewBuilds/);
    assert.match(source, /PREVIEW_BUILD_TIMEOUT_MS/);
    assert.match(source, /registerCancellable\(senderId/);
    assert.match(source, /activePreviewBuilds\.has\(senderId\)/);
    assert.match(source, /throw new Error\("Preview generation already in progress\."\)/);
    assert.match(source, /setTimeout/);
    assert.match(source, /proc\.kill\(\)/);
    assert.match(source, /activePreviewBuilds\.delete\(senderId\)/);
  }
});
