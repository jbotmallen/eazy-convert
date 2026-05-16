import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("navigation renders as a hover-expandable pinned sidebar", () => {
  const navbarSource = readSource("src/components/Navbar.tsx");
  const appSource = readSource("src/App.tsx");

  assert.match(navbarSource, /const \[isPinned, setIsPinned\] = useState\(false\)/);
  assert.match(navbarSource, /const \[isHovered, setIsHovered\] = useState\(false\)/);
  assert.match(navbarSource, /const sidebarExpanded = isPinned \|\| isHovered/);
  assert.match(navbarSource, /onMouseEnter=\{\(\) => setIsHovered\(true\)\}/);
  assert.match(navbarSource, /onMouseLeave=\{\(\) => setIsHovered\(false\)\}/);
  assert.match(navbarSource, /aria-label=\{isPinned \? "Collapse sidebar" : "Pin sidebar"\}/);
  assert.match(navbarSource, /left-0 top-0 bottom-0/);
  assert.match(navbarSource, /sidebarExpanded \? "w-(56|60|64|72)" : "w-18"/);
  assert.match(appSource, /pl-18/);
});

test("sidebar parent navigation opens action branches on click", () => {
  const navbarSource = readSource("src/components/Navbar.tsx");

  assert.match(navbarSource, /Image Tools/);
  assert.match(navbarSource, /Converter/);
  assert.match(navbarSource, /Compressor/);
  assert.match(navbarSource, /Background Remover/);
  assert.match(navbarSource, /setOpenPanel\(\(current\) => \(current === section\.id \? null : section\.id\)\)/);
  assert.match(navbarSource, /ChevronRight/);
});

test("images to PDF lives under image converter instead of document tools", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");
  const imageSource = readSource("src/pages/ImageConverterPage.tsx");

  assert.doesNotMatch(appSource, /ImagesToPdfPage/);
  assert.doesNotMatch(appSource, /path="\/documents\/images-to-pdf"/);
  assert.match(navbarSource, /Image Converter/);
  assert.match(navbarSource, /Images -> PDF/);
  assert.match(navbarSource, /to: "\/images\?to=pdf"/);
  assert.doesNotMatch(navbarSource, /to: "\/documents\/images-to-pdf"/);
  assert.match(imageSource, /value: "pdf"/);
  assert.match(imageSource, /window\.api\.image\.toPdf\(files\.map\(\(file\) => file\.fileId\)\)/);
  assert.match(imageSource, /window\.api\.image\.showInFolder\(pdfOutputPath\)/);
  assert.doesNotMatch(imageSource, /window\.api\.document\.imagesToPdf/);

  const preloadSource = readSource("electron/preload.cts");
  const pdfHandlerSource = readSource("electron/handlers/document/pdf.ts");
  const imageHandlerSource = readSource("electron/handlers/converter/image.ts");
  assert.doesNotMatch(preloadSource, /document:images-to-pdf/);
  assert.doesNotMatch(pdfHandlerSource, /document:images-to-pdf/);
  assert.match(imageHandlerSource, /ipcMain\.handle\("image:to-pdf"/);
  assert.match(imageHandlerSource, /const PDF_IMAGE_EXTS = IMAGE_EXTS/);
  assert.match(imageHandlerSource, /convertImageToPngBuffer/);
});

test("sidebar expanded footer labels actions and avoids over-indented first level items", () => {
  const navbarSource = readSource("src/components/Navbar.tsx");

  assert.match(navbarSource, /GitHub/);
  assert.match(navbarSource, /Theme/);
  assert.match(navbarSource, /sidebarExpanded \? "opacity-100" : "pointer-events-none opacity-0"/);
  assert.doesNotMatch(navbarSource, /ml-3 mt-1 space-y-1 border-l border-border\/50 pl-3/);
});

test("global scrollbars use app theme colors instead of default platform chrome", () => {
  const cssSource = readSource("src/index.css");

  assert.match(cssSource, /scrollbar-width:\s*thin/);
  assert.match(cssSource, /scrollbar-color:\s*hsl\(var\(--primary\)/);
  assert.match(cssSource, /::-webkit-scrollbar/);
  assert.match(cssSource, /::-webkit-scrollbar-thumb/);
  assert.match(cssSource, /border:\s*2px solid hsl\(var\(--background\)/);
});
