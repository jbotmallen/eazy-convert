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
  assert.equal(isAllowedExternalUrl("https://github.com/example"), false);
  assert.equal(isAllowedExternalUrl("http://github.com/example"), false);
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
  const guardIndex = source.lastIndexOf('process.env.NODE_ENV === "development"', shortcutIndex);
  assert.ok(guardIndex > -1 && shortcutIndex - guardIndex < 120, "DevTools shortcut must be gated to development");
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
  assert.doesNotMatch(source, /script-src[^;]*'unsafe-inline'/, "app script CSP must not allow unsafe-inline");
  assert.match(source, /object-src 'none'/, "app CSP must block plugins");
  assert.match(source, /base-uri 'none'/, "app CSP must block base tag URL rewriting");
  assert.match(source, /frame-src 'none'/, "app CSP must block frames");
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
  const preloadSource = readSource("electron/preload.ts");
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
