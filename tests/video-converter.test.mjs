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

test("video converter uses image converter select styling and labels", () => {
  const source = readSource("src/pages/VideoConverterPage.tsx");

  assert.match(source, /Target Export Format/);
  assert.match(source, /SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent"/);
  assert.match(source, /SelectContent className="bg-card\/90 backdrop-blur-xl border-2"/);
  assert.match(source, /SelectItem key=\{f\.value\} value=\{f\.value\} className="font-bold uppercase italic py-3 cursor-pointer"/);
});

test("video converter quality tooltip shows actual preset resolutions", () => {
  const source = readSource("src/pages/VideoConverterPage.tsx");

  assert.match(source, /Info/);
  assert.match(source, /QUALITY_TOOLTIP/);
  assert.match(source, /3840 x 2160/);
  assert.match(source, /2560 x 1440/);
  assert.match(source, /1920 x 1080/);
  assert.match(source, /1280 x 720/);
  assert.match(source, /854 x 480/);
  assert.match(source, /640 x 360/);
});

test("batch converter pages show saved output paths under completed rows", () => {
  const pages = [
    ["AudioConverterPage", "audio"],
    ["ImageConverterPage", "image"],
    ["VideoConverterPage", "video"],
  ];

  for (const [page, apiGroup] of pages) {
    const source = readSource(`src/pages/${page}.tsx`);

    assert.match(source, /outputPath\?: string/);
    assert.match(source, /const outputPath = await window\.api\.convert/);
    assert.match(source, /status: "done", progress: 100, outputPath/);
    assert.match(source, /file\.status === "done" && file\.outputPath/);
    assert.match(source, /title=\{file\.outputPath\}/);
    assert.match(source, new RegExp(`window\\.api\\.${apiGroup}\\.showInFolder\\(outputPath\\)`));
    assert.match(source, /<FolderOpen className="h-3\.5 w-3\.5" \/>/);
  }
});
