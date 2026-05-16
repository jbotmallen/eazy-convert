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

const converterPages = [
  "src/components/Converter.tsx",
  "src/pages/ImageConverterPage.tsx",
  "src/pages/VideoConverterPage.tsx",
  "src/pages/AudioConverterPage.tsx",
  "src/pages/ImageCompressorPage.tsx",
  "src/pages/VideoCompressorPage.tsx",
  "src/pages/ImageBackgroundRemoverPage.tsx",
  "src/pages/AudioDenoiserPage.tsx",
  "src/pages/VideoDenoiserPage.tsx",
  "src/pages/YoutubeDownloaderPage.tsx",
  "src/pages/AudioTrimmerPage.tsx",
  "src/pages/VideoTrimmerPage.tsx",
];

test("converter field labels render with reusable icons", () => {
  const fieldLabelSource = readSource("src/components/ui/field-label.tsx");

  assert.match(fieldLabelSource, /icon:\s*LucideIcon/);
  assert.match(fieldLabelSource, /aria-hidden="true"/);
  assert.match(fieldLabelSource, /labelClasses/);

  for (const page of converterPages) {
    const source = readSource(page);
    assert.match(source, /FieldLabel/, `${page} should use FieldLabel for converter field labels`);
  }
});
