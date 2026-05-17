# Video Compressor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch video compression with MP4 output, four presets, timestamped output filenames, progress, cancel, and file-manager access.

**Architecture:** Add pure preset helpers for renderer tests, main-process compression helpers for FFmpeg args and timestamped paths, extend existing video IPC handlers, expose `window.api.video.compress`, and build a dedicated `/videos/compress` page that mirrors existing batch video converter UX.

**Tech Stack:** Electron IPC, Node child_process, FFmpeg/FFprobe, React, TypeScript, Vite, node:test, ESLint.

---

## File Structure

- Create `src/lib/video-compressor.ts`: renderer-safe preset IDs, labels, descriptions, and formatting helpers.
- Create `electron/utils/videoCompress.ts`: main-process preset validation, FFmpeg arg builder, timestamp helper, and output path builder.
- Modify `electron/handlers/videoTools.ts`: add `video:compress` IPC using registered file IDs, FFmpeg progress, cancel, and byte stats.
- Modify `electron/preload.cts`: expose `window.api.video.compress`.
- Modify `src/types.d.ts`: type `window.api.video.compress`.
- Create `src/pages/VideoCompressorPage.tsx`: batch compressor UI.
- Modify `src/App.tsx`: add `/videos/compress` route.
- Modify `src/components/Navbar.tsx`: replace coming-soon Video Compressor with route.
- Modify `src/pages/AppHomePage.tsx`: add Video Compressor launcher.
- Create `tests/video-compressor.test.mjs`: preset, route, preload/type, and UI source tests.
- Modify `tests/security.test.mjs`: source-security tests for `video:compress`.

---

### Task 1: Red Tests

**Files:**
- Create: `tests/video-compressor.test.mjs`
- Modify: `tests/security.test.mjs`

- [ ] **Step 1: Add source tests for pure presets, preload/types, route/nav/home, and page behavior.**

- [ ] **Step 2: Add security source test for `video:compress`.**

- [ ] **Step 3: Run tests and confirm expected failure from missing compressor code.**

Run:

```bash
node --experimental-strip-types --test tests/video-compressor.test.mjs
node --test tests/security.test.mjs
```

Expected: FAIL from missing `src/lib/video-compressor.ts`, missing `video:compress`, missing route/page wiring.

---

### Task 2: Backend Compression IPC

**Files:**
- Create: `electron/utils/videoCompress.ts`
- Modify: `electron/handlers/videoTools.ts`

- [ ] **Step 1: Implement `CompressionPresetId`, preset map, timestamp helper, output path builder, FFmpeg arg builder, and preset validator in `electron/utils/videoCompress.ts`.**

Required preset IDs: `tiny`, `small`, `balanced`, `high-quality`.

Required output format: `name_compressed_YYYYMMDD-HHMMSS.mp4`, with `getUniquePath` fallback.

- [ ] **Step 2: Add `video:compress(inputId, preset)` handler to `electron/handlers/videoTools.ts`.**

Handler must:
- use `resolveRegisteredFilePath(inputId)`;
- call existing video input validation;
- reject concurrent active video work for same sender;
- probe duration for progress;
- validate preset before spawning FFmpeg;
- spawn FFmpeg with `-y`, `-hide_banner`, `-loglevel error`, `-progress pipe:1`;
- send `conversion-progress`;
- return `{ success: true, outputPath, inputBytes, outputBytes }`;
- parse common FFmpeg errors;
- use existing `cancel-convert` active process map.

- [ ] **Step 3: Run focused security test.**

Run:

```bash
node --test tests/security.test.mjs
```

Expected: security test for compressor passes.

---

### Task 3: API, Route, Nav, Home Wiring

**Files:**
- Modify: `electron/preload.cts`
- Modify: `src/types.d.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/pages/AppHomePage.tsx`

- [ ] **Step 1: Expose `compress` under existing `window.api.video`.**

Signature:

```ts
compress: (inputId: string, preset: 'tiny' | 'small' | 'balanced' | 'high-quality') =>
  Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }>;
```

- [ ] **Step 2: Add `/videos/compress` route and import `VideoCompressorPage`.**

- [ ] **Step 3: Replace Video Compressor navbar item from `comingSoon` to `/videos/compress`.**

- [ ] **Step 4: Add Video Compressor to app home tools.**

- [ ] **Step 5: Run focused source test.**

Run:

```bash
node --experimental-strip-types --test tests/video-compressor.test.mjs
```

Expected: API and route/nav/home tests pass once page/preset files exist.

---

### Task 4: Renderer Presets and Page

**Files:**
- Create: `src/lib/video-compressor.ts`
- Create: `src/pages/VideoCompressorPage.tsx`

- [ ] **Step 1: Implement renderer preset constants and `formatBytes`.**

Preset labels:
- Tiny
- Small
- Balanced
- High Quality

- [ ] **Step 2: Build `VideoCompressorPage.tsx` batch UI.**

Must include:
- `window.api.openDocFiles("video")`;
- `window.api.registerDroppedFile`;
- `window.api.video.compress(file.fileId, preset)`;
- `window.api.video.showInFolder(outputPath)`;
- `window.api.cancelConvert()`;
- `window.api.onProgress`;
- preset selector with `setPreset("tiny")`, `setPreset("small")`, `setPreset("balanced")`, `setPreset("high-quality")`;
- output indicator `Output: MP4`;
- accepted extensions `.mp4 .webm .avi .mov .mkv`;
- per-file statuses `pending`, `compressing`, `done`, `error`;
- per-file output path and size reduction when complete;
- overall progress bar;
- cancel restores active file to pending.

- [ ] **Step 3: Run focused source test.**

Run:

```bash
node --experimental-strip-types --test tests/video-compressor.test.mjs
```

Expected: PASS.

---

### Task 5: Integration Verification

**Files:**
- Fix only files touched by this plan if verification fails.

- [ ] **Step 1: Run compressor tests.**

```bash
node --experimental-strip-types --test tests/video-compressor.test.mjs
```

- [ ] **Step 2: Run existing source/security tests.**

```bash
node --test tests/security.test.mjs tests/landing-page-source.test.mjs tests/video-trimmer.test.mjs
```

- [ ] **Step 3: Run Electron build.**

```bash
npm run build:main
```

- [ ] **Step 4: Run renderer build.**

```bash
npm run build
```

- [ ] **Step 5: Run lint.**

```bash
npm run lint
```

---

## Self-Review

- Spec coverage: batch workflow, MP4-only output, Tiny/Small/Balanced/High Quality presets, timestamped names, progress, cancel, output stats, route/nav/home, and tests are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: preset IDs, IPC result shape, and route names match across tasks.
