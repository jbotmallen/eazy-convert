import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAfftdnFilter,
  buildArnndnFilter,
  escapeFfmpegFilterPath,
  isRnnoiseModelName,
  validateDenoiseOptions,
} from "../electron/utils/audioDenoise.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("afftdn filter maps preset to nr dB", () => {
  assert.equal(buildAfftdnFilter("light"), "afftdn=nr=6:nf=-50:nt=w");
  assert.equal(buildAfftdnFilter("medium"), "afftdn=nr=12:nf=-50:nt=w");
  assert.equal(buildAfftdnFilter("aggressive"), "afftdn=nr=24:nf=-50:nt=w");
});

test("arnndn filter maps preset to mix and includes escaped model path", () => {
  const filter = buildArnndnFilter("medium", "D:\\path\\sh.rnnn");
  assert.equal(filter, "arnndn=m=D\\\\:/path/sh.rnnn:mix=0.6");
});

test("escapeFfmpegFilterPath swaps backslashes and double-escapes colons", () => {
  assert.equal(escapeFfmpegFilterPath("D:\\a\\b"), "D\\\\:/a/b");
  assert.equal(escapeFfmpegFilterPath("/usr/x"), "/usr/x");
});

test("rejects unknown engine, preset, and model", () => {
  assert.throws(() => validateDenoiseOptions({ engine: "bogus", preset: "medium" }));
  assert.throws(() => validateDenoiseOptions({ engine: "fft", preset: "extreme" }));
  assert.throws(() => validateDenoiseOptions(null));
  assert.throws(() =>
    validateDenoiseOptions({ engine: "rnnoise", preset: "medium", model: "evil" }),
  );
});

test("validates rnnoise options and defaults model to sh", () => {
  const opts = validateDenoiseOptions({ engine: "rnnoise", preset: "medium" });
  assert.equal(opts.engine, "rnnoise");
  assert.equal(opts.preset, "medium");
  assert.equal(opts.model, "sh");
});

test("rnnoise model whitelist is sh/cb/mp", () => {
  assert.ok(isRnnoiseModelName("sh"));
  assert.ok(isRnnoiseModelName("cb"));
  assert.ok(isRnnoiseModelName("mp"));
  assert.ok(!isRnnoiseModelName("foo"));
  assert.ok(!isRnnoiseModelName(""));
});

test("denoise handler and preload wired into the app", () => {
  const mainSource = readSource("electron/main.ts");
  const preloadSource = readSource("electron/preload.cts");
  const typesSource = readSource("src/types.d.ts");
  const appSource = readSource("src/App.tsx");

  assert.match(mainSource, /registerAudioDenoiseHandlers\(\)/);
  assert.match(preloadSource, /audio:denoise/);
  assert.match(preloadSource, /video:denoise/);
  assert.match(typesSource, /denoise:\s*\(inputId: string, outputFormat:/);
  assert.match(typesSource, /denoise:\s*\(inputId: string, options:/);
  assert.match(appSource, /\/audio\/denoise/);
  assert.match(appSource, /\/videos\/denoise/);
});

test("rnnoise models are bundled in resources/rnnoise", () => {
  for (const name of ["sh", "cb", "mp"]) {
    const modelPath = path.join(repoRoot, "resources", "rnnoise", `${name}.rnnn`);
    assert.ok(fs.existsSync(modelPath), `${name}.rnnn must exist`);
    const stat = fs.statSync(modelPath);
    assert.ok(stat.size > 10_000, `${name}.rnnn should be non-trivial size`);
  }
});

test("package.json declares rnnoise as an extraResource", () => {
  const pkg = JSON.parse(readSource("package.json"));
  const extras = pkg.build?.extraResources ?? [];
  const hasRnnoise = extras.some(
    (entry) => entry?.from === "resources/rnnoise" && entry?.to === "rnnoise",
  );
  assert.ok(hasRnnoise, "package.json build.extraResources must include resources/rnnoise");
});
