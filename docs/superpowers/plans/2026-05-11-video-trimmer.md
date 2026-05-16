# Video Trimmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/videos/trim` desktop workflow that trims one local video with either fast stream-copy mode or accurate re-encode mode.

**Architecture:** Add small pure time/validation helpers, dedicated Electron video-tool IPC handlers, preload/type bindings, and a focused React page. Reuse existing file registry, FFmpeg/FFprobe helpers, progress event, cancel flow, navbar, and card UI patterns.

**Tech Stack:** Electron IPC, Node child_process, FFmpeg/FFprobe, React, TypeScript, Vite, node:test, ESLint.

---

## File Structure

- Create `src/lib/video-trimmer.ts`: pure time parsing, formatting, and trim range validation for renderer and tests.
- Create `electron/utils/videoTrim.ts`: main-process trim mode and range validation helpers.
- Create `electron/handlers/videoTools.ts`: `video:probe` and `video:trim` IPC handlers.
- Modify `electron/main.ts`: register video tool handlers.
- Modify `electron/preload.ts`: expose `window.api.video.probe` and `window.api.video.trim`.
- Modify `src/types.d.ts`: type `window.api.video`.
- Create `src/pages/VideoTrimmerPage.tsx`: single-video trimming UI.
- Modify `src/App.tsx`: route `/videos/trim`.
- Modify `src/components/Navbar.tsx`: activate "Video Trimmer" link.
- Create `tests/video-trimmer.test.mjs`: pure helper and source-wiring tests.
- Modify `tests/security.test.mjs`: security/source assertions for IPC handler validation.

---

### Task 1: Pure Time Helpers

**Files:**
- Create: `src/lib/video-trimmer.ts`
- Test: `tests/video-trimmer.test.mjs`

- [ ] **Step 1: Write failing tests**

Add `tests/video-trimmer.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
```

Expected: FAIL because `src/lib/video-trimmer.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/video-trimmer.ts`:

```ts
export type TrimMode = "fast" | "accurate";

export type TrimValidationResult =
  | { ok: true; clipSeconds: number }
  | { ok: false; error: string };

export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;

  const numbers = parts.map(Number);
  const [hours, minutes, seconds] =
    numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]];

  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function validateTrimRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
): TrimValidationResult {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || !Number.isFinite(durationSeconds)) {
    return { ok: false, error: "Enter valid start and end times." };
  }
  if (startSeconds < 0) return { ok: false, error: "Start time must be zero or greater." };
  if (endSeconds <= startSeconds) return { ok: false, error: "End time must be after start time." };
  if (endSeconds > durationSeconds) return { ok: false, error: "End time must be within the video duration." };
  return { ok: true, clipSeconds: endSeconds - startSeconds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
```

Expected: PASS for helper tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video-trimmer.ts tests/video-trimmer.test.mjs
git commit -m "test: add video trimmer time helpers"
```

---

### Task 2: Main-Process Video Tool IPC

**Files:**
- Create: `electron/utils/videoTrim.ts`
- Create: `electron/handlers/videoTools.ts`
- Modify: `electron/main.ts`
- Modify: `tests/security.test.mjs`

- [ ] **Step 1: Write failing security/source tests**

Append to `tests/security.test.mjs`:

```js
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/security.test.mjs
```

Expected: FAIL because `electron/handlers/videoTools.ts` does not exist or registration is missing.

- [ ] **Step 3: Implement IPC handler**

Create `electron/utils/videoTrim.ts`:

```ts
export type TrimMode = "fast" | "accurate";

export type TrimValidationResult =
  | { ok: true; clipSeconds: number }
  | { ok: false; error: string };

export function validateTrimRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
): TrimValidationResult {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || !Number.isFinite(durationSeconds)) {
    return { ok: false, error: "Enter valid start and end times." };
  }
  if (startSeconds < 0) return { ok: false, error: "Start time must be zero or greater." };
  if (endSeconds <= startSeconds) return { ok: false, error: "End time must be after start time." };
  if (endSeconds > durationSeconds) return { ok: false, error: "End time must be within the video duration." };
  return { ok: true, clipSeconds: endSeconds - startSeconds };
}
```

Create `electron/handlers/videoTools.ts`:

```ts
import { ipcMain } from "electron";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { VIDEO_EXTS } from "../utils/constants.js";
import { getFfmpegPath, getFfprobePath, getUniquePath, validatePath } from "../utils/helpers.js";
import { resolveRegisteredFilePath } from "../utils/fileRegistry.js";
import { validateTrimRange, type TrimMode } from "../utils/videoTrim.js";
import { applyVideoArgs } from "./converter/video.js";

const activeConversions = new Map<number, ChildProcess>();

function assertVideoInput(inputPath: string): string {
  if (!validatePath(inputPath)) throw new Error("Invalid input path.");
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) throw new Error("Input file not found.");
  const inputExt = path.extname(inputPath).toLowerCase();
  if (!VIDEO_EXTS.includes(inputExt)) throw new Error("Unsupported video format.");
  return inputExt;
}

async function probeDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfprobePath(), [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);

    let output = "";
    proc.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    proc.on("close", (code) => {
      const duration = Number.parseFloat(output);
      if (code === 0 && Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Could not read video duration."));
    });
    proc.on("error", () => reject(new Error("Could not read video duration.")));
  });
}

function parseFFmpegTrimError(stderr: string, code: number | null): string {
  if (/no such file or directory/i.test(stderr)) return "Input file not found.";
  if (/invalid data found/i.test(stderr)) return "File is corrupt or unsupported.";
  if (/permission denied/i.test(stderr)) return "Permission denied - check the output folder.";
  if (/no space left/i.test(stderr)) return "Not enough disk space.";
  return `Trimming failed (code ${code}).`;
}

export function registerVideoToolHandlers() {
  ipcMain.handle("video:probe", async (_, inputId: string) => {
    const inputPath = resolveRegisteredFilePath(inputId);
    assertVideoInput(inputPath);
    return { durationSeconds: await probeDuration(inputPath) };
  });

  ipcMain.handle(
    "video:trim",
    async (event, inputId: string, startSeconds: number, endSeconds: number, mode: TrimMode) => {
      if (mode !== "fast" && mode !== "accurate") throw new Error("Invalid trim mode.");

      const inputPath = resolveRegisteredFilePath(inputId);
      const inputExt = assertVideoInput(inputPath);
      const durationSeconds = await probeDuration(inputPath);
      const validation = validateTrimRange(startSeconds, endSeconds, durationSeconds);
      if (!validation.ok) throw new Error(validation.error);

      const outputPath = getUniquePath(
        path.join(path.dirname(inputPath), `${path.basename(inputPath, inputExt)}_trimmed${inputExt}`),
      );
      if (!validatePath(outputPath)) throw new Error("Invalid output path.");

      const clipSeconds = validation.clipSeconds;
      const args = ["-ss", String(startSeconds), "-to", String(endSeconds), "-i", inputPath];

      if (mode === "fast") {
        args.push("-c", "copy");
      } else if (!applyVideoArgs(inputExt, inputExt, args)) {
        throw new Error("Unsupported video format.");
      }

      args.push(outputPath);

      return new Promise<string>((resolve, reject) => {
        const ffmpegProcess = spawn(getFfmpegPath(), [
          "-y",
          "-hide_banner",
          "-loglevel", "error",
          "-progress", "pipe:1",
          ...args,
        ]);
        let stderrOutput = "";
        activeConversions.set(event.sender.id, ffmpegProcess);

        ffmpegProcess.stdout.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (line.startsWith("out_time_ms=")) {
              const outTimeMs = Number(line.split("=")[1]);
              if (!Number.isFinite(outTimeMs)) return;
              const progress = Math.min(99, Math.round((outTimeMs / 1_000_000 / clipSeconds) * 100));
              event.sender.send("conversion-progress", progress);
            }
          }
        });

        ffmpegProcess.stderr?.on("data", (data: Buffer) => { stderrOutput += data.toString(); });
        ffmpegProcess.on("close", (code) => {
          activeConversions.delete(event.sender.id);
          if (code === 0) {
            event.sender.send("conversion-progress", 100);
            resolve(outputPath);
          } else {
            reject(new Error(parseFFmpegTrimError(stderrOutput, code)));
          }
        });
        ffmpegProcess.on("error", (err) => {
          activeConversions.delete(event.sender.id);
          reject(err);
        });
      });
    },
  );
}
```

Modify `electron/main.ts`:

```ts
import { registerVideoToolHandlers } from "./handlers/videoTools.js";
```

Add near other registrations:

```ts
registerVideoToolHandlers();
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/security.test.mjs
npm run build:main
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/utils/videoTrim.ts electron/handlers/videoTools.ts electron/main.ts tests/security.test.mjs
git commit -m "feat: add video trim ipc handlers"
```

---

### Task 3: Preload and Renderer Types

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types.d.ts`
- Modify: `tests/video-trimmer.test.mjs`

- [ ] **Step 1: Write failing source test**

Append to `tests/video-trimmer.test.mjs`:

```js
test("preload exposes video trim APIs without raw file paths", () => {
  const preloadSource = readSource("electron/preload.ts");
  const typesSource = readSource("src/types.d.ts");

  assert.match(preloadSource, /video:\s*\{/);
  assert.match(preloadSource, /probe:\s*\(inputId: string\)/);
  assert.match(preloadSource, /trim:\s*\(inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' \| 'accurate'\)/);
  assert.match(typesSource, /video:\s*\{/);
  assert.match(typesSource, /probe: \(inputId: string\) => Promise<\{ durationSeconds: number \}>/);
  assert.match(typesSource, /trim: \(inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' \| 'accurate'\) => Promise<string>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
```

Expected: FAIL because APIs are not exposed.

- [ ] **Step 3: Add preload bindings and types**

Modify `electron/preload.ts` inside exposed API object:

```ts
  video: {
    probe: (inputId: string) => ipcRenderer.invoke('video:probe', inputId),
    trim: (
      inputId: string,
      startSeconds: number,
      endSeconds: number,
      mode: 'fast' | 'accurate',
    ) => ipcRenderer.invoke('video:trim', inputId, startSeconds, endSeconds, mode),
  },
```

Modify `src/types.d.ts` inside `window.api`:

```ts
      video: {
        probe: (inputId: string) => Promise<{ durationSeconds: number }>;
        trim: (inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' | 'accurate') => Promise<string>;
      };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
npm run build:main
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/preload.ts src/types.d.ts tests/video-trimmer.test.mjs
git commit -m "feat: expose video trim api"
```

---

### Task 4: Route and Navbar

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Navbar.tsx`
- Test: `tests/video-trimmer.test.mjs`

- [ ] **Step 1: Write failing source test**

Append to `tests/video-trimmer.test.mjs`:

```js
test("video trimmer route and navbar link are wired", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");

  assert.match(appSource, /VideoTrimmerPage/);
  assert.match(appSource, /path="\/videos\/trim"/);
  assert.match(navbarSource, /Video Trimmer/);
  assert.match(navbarSource, /to: "\/videos\/trim"/);
  assert.doesNotMatch(navbarSource, /Video Trimmer", description: "Cut clips to the perfect length", to: "#", icon: Scissors, comingSoon: true/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
```

Expected: FAIL because route/page/link are not wired.

- [ ] **Step 3: Wire route and nav**

Create a temporary page stub `src/pages/VideoTrimmerPage.tsx`:

```tsx
export function VideoTrimmerPage() {
  return <div className="container mx-auto px-4 py-16">Video Trimmer</div>;
}
```

Modify `src/App.tsx`:

```ts
import { VideoTrimmerPage } from "@/pages/VideoTrimmerPage";
```

Add route near `/videos`:

```tsx
<Route path="/videos/trim" element={<VideoTrimmerPage />} />
```

Modify `src/components/Navbar.tsx` Videos item:

```ts
{ label: "Video Trimmer", description: "Cut clips to the perfect length", to: "/videos/trim", icon: Scissors },
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Navbar.tsx src/pages/VideoTrimmerPage.tsx tests/video-trimmer.test.mjs
git commit -m "feat: route video trimmer page"
```

---

### Task 5: Video Trimmer UI

**Files:**
- Modify: `src/pages/VideoTrimmerPage.tsx`
- Test: `tests/video-trimmer.test.mjs`

- [ ] **Step 1: Write failing source test**

Append to `tests/video-trimmer.test.mjs`:

```js
test("video trimmer page provides file selection, time controls, mode toggle, progress, and cancel", () => {
  const source = readSource("src/pages/VideoTrimmerPage.tsx");

  assert.match(source, /window\.api\.openDocFiles\("video"\)/);
  assert.match(source, /window\.api\.registerDroppedFile/);
  assert.match(source, /window\.api\.video\.probe/);
  assert.match(source, /window\.api\.video\.trim/);
  assert.match(source, /parseDurationInput/);
  assert.match(source, /validateTrimRange/);
  assert.match(source, /setMode\("fast"\)/);
  assert.match(source, /setMode\("accurate"\)/);
  assert.match(source, /window\.api\.cancelConvert/);
  assert.match(source, /onProgress/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
```

Expected: FAIL because page is still a stub.

- [ ] **Step 3: Implement page**

Replace `src/pages/VideoTrimmerPage.tsx` with a full component that mirrors `VideoConverterPage` layout. Use these implementation requirements:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle, FileVideo, Loader2, Scissors, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SimpleToast } from "@/components/ui/simple-toast";
import { cn } from "@/lib/utils";
import { formatDuration, parseDurationInput, validateTrimRange, type TrimMode } from "@/lib/video-trimmer";
import { useProcessing } from "@/context/useProcessing";

const ALLOWED_EXTS = new Set([".mp4", ".webm", ".avi", ".mov", ".mkv"]);

function getDotExt(filename: string): string {
  return "." + (filename.split(".").pop()?.toLowerCase() ?? "");
}
```

Core behavior:

```tsx
const [file, setFile] = useState<FileRef | null>(null);
const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
const [startText, setStartText] = useState("00:00:00");
const [endText, setEndText] = useState("00:00:00");
const [mode, setMode] = useState<TrimMode>("fast");
const [isDragOver, setIsDragOver] = useState(false);
const [isTrimming, setIsTrimming] = useState(false);
const [progress, setProgress] = useState(0);
const [error, setError] = useState<string | null>(null);
const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
const cancelledRef = useRef(false);
const { setIsProcessing } = useProcessing();
```

Selection behavior:

```tsx
const loadFile = useCallback(async (ref: FileRef) => {
  setError(null);
  if (!ALLOWED_EXTS.has(getDotExt(ref.name))) {
    setError("Unsupported video format.");
    return;
  }
  setFile(ref);
  setDurationSeconds(null);
  setProgress(0);
  const result = await window.api.video.probe(ref.id);
  setDurationSeconds(result.durationSeconds);
  setStartText("00:00:00");
  setEndText(formatDuration(result.durationSeconds));
}, []);
```

Trim behavior:

```tsx
const startSeconds = parseDurationInput(startText);
const endSeconds = parseDurationInput(endText);
const validation = startSeconds !== null && endSeconds !== null && durationSeconds !== null
  ? validateTrimRange(startSeconds, endSeconds, durationSeconds)
  : { ok: false as const, error: "Enter valid start and end times." };

const handleTrim = async () => {
  if (!file || !validation.ok || startSeconds === null || endSeconds === null) return;
  cancelledRef.current = false;
  setIsTrimming(true);
  setIsProcessing(true);
  setProgress(0);
  setError(null);
  try {
    await window.api.video.trim(file.id, startSeconds, endSeconds, mode);
    if (!cancelledRef.current) setToast({ message: "Video trimmed successfully.", type: "success" });
  } catch (err) {
    if (!cancelledRef.current) setError(err instanceof Error ? err.message : "Trimming failed.");
  } finally {
    setIsTrimming(false);
    setIsProcessing(false);
  }
};
```

UI requirements:

- Card title "Video Trimmer" with `Scissors` icon.
- Drop zone when no file is selected.
- Selected file row with `FileVideo`, filename, duration, remove button.
- Two text inputs labeled Start and End.
- Clip length display using `validation.clipSeconds` when valid.
- Two mode buttons for Fast and Accurate; active button uses primary styling.
- Progress bar while trimming.
- Main button says Select Video, Trim Video, or Trimming.
- Cancel button calls `cancelledRef.current = true; window.api.cancelConvert();`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/VideoTrimmerPage.tsx tests/video-trimmer.test.mjs
git commit -m "feat: build video trimmer UI"
```

---

### Task 6: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run full focused test suite**

Run:

```bash
node --experimental-strip-types --test tests/video-trimmer.test.mjs
node --test tests/security.test.mjs tests/landing-page-source.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run Electron TypeScript build**

Run:

```bash
npm run build:main
```

Expected: `tsc -p electron/tsconfig.json` exits `0`.

- [ ] **Step 3: Run renderer production build**

Run:

```bash
npm run build
```

Expected: Vite build exits `0`.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: ESLint exits `0`.

- [ ] **Step 5: Run audit**

Run:

```bash
$env:NODE_OPTIONS='--use-system-ca'; npm audit --json
```

Expected: `"total": 0` vulnerabilities.

- [ ] **Step 6: Commit verification-only fixes if needed**

If any verification command fails because of this feature, fix the smallest relevant issue and commit:

```bash
git add .
git commit -m "fix: stabilize video trimmer"
```

---

## Self-Review

- Spec coverage: route/nav, one-file UI, probe, trim, fast/accurate mode, validation, progress, cancel, output naming, tests, and exclusions are covered.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: renderer and main process each define compatible `TrimMode`/range validation helpers, and `video.probe`, `video.trim`, `startSeconds`, `endSeconds`, and `durationSeconds` names are consistent across tasks.
