# Video Compressor Design

## Goal

Add a batch video compression workflow that outputs MP4 files locally using preset-driven FFmpeg settings.

## User Experience

The feature lives at `/videos/compress` and appears in the Videos navbar group as "Video Compressor". The page follows the existing batch video converter pattern: users can click to select videos, drag and drop videos, add more files, remove files, clear completed results, see per-file status, track overall progress, and cancel the active FFmpeg job.

V1 always outputs MP4. The UI should make that clear with an "Output: MP4" indicator, but it should not expose an output-format selector yet. The page structure should leave an obvious place for a future compatible-output-format selector.

The user selects one of four compression presets:

- Tiny: strongest compression, downscale to 360p when the source is larger.
- Small: strong compression, downscale to 720p when the source is larger.
- Balanced: default preset, downscale to 1080p when the source is larger.
- High Quality: lighter compression, keep original resolution.

Each output is saved beside its source as `name_compressed_YYYYMMDD-HHMMSS.mp4`. If a collision still occurs, the output path helper should add a suffix rather than overwriting an existing file.

## Main Process Architecture

Add dedicated video compression IPC instead of extending the generic converter handler. The current converter skips same-format files in the renderer, which is correct for conversion but wrong for compression. A dedicated handler keeps the concepts separate and gives compression its own validation and preset map.

Add:

- `video:compress(inputId, preset)` resolves a registered file ID, validates that it is an allowed video file, validates the preset, builds a timestamped MP4 output path, runs FFmpeg, streams progress through the existing `conversion-progress` event, and returns `{ success, outputPath, inputBytes, outputBytes }`.

Reuse existing infrastructure:

- `resolveRegisteredFilePath` for file ID resolution.
- `VIDEO_EXTS` for extension allowlisting.
- `validatePath`, `getUniquePath`, `getFfmpegPath`, and `getFfprobePath` for filesystem and tool access.
- The existing `conversion-progress` event for renderer progress.
- The existing cancel channel if practical, while avoiding conflicts with active video trim/conversion jobs.

Validation remains authoritative in the main process. Renderer validation is only for faster feedback.

## FFmpeg Behavior

All outputs use H.264 video and AAC audio in an MP4 container.

Preset mapping:

- Tiny: `-c:v libx264 -preset medium -crf 32 -vf scale=-2:min(360,ih) -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k`
- Small: `-c:v libx264 -preset medium -crf 30 -vf scale=-2:min(720,ih) -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k`
- Balanced: `-c:v libx264 -preset medium -crf 26 -vf scale=-2:min(1080,ih) -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k`
- High Quality: `-c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k`

The scale filters must not upscale smaller videos. If FFmpeg expression support is awkward in the local command builder, the implementation can probe the source height first and only include a scale filter when the source height exceeds the preset max height.

Progress should be calculated from FFmpeg `out_time_ms` against the probed source duration, matching the existing converter pattern.

## Renderer Architecture

Add `VideoCompressorPage.tsx` and route it from `App.tsx`. The page owns:

- Batch list of selected `FileRef` items.
- Selected compression preset.
- Per-file status, progress, output path, input size, output size, and error.
- Overall progress.
- Drag/drop state.
- Toast feedback.
- Cancel state.

Expose APIs in preload/types:

- `window.api.video.compress(inputId, preset)`

The renderer should not pass raw paths. It should pass registered file IDs only.

## Error Handling

User-facing errors should be short and specific:

- Unsupported video format.
- Input file not found.
- Could not read video duration.
- Invalid compression preset.
- Permission denied while writing output.
- Not enough disk space.
- Compression failed.

Canceling should kill the active FFmpeg process, reset the active file to ready, preserve the rest of the queue, and avoid showing a success toast for the canceled file.

## Tests and Verification

Add tests before implementation:

- Pure/source tests for preset IDs and route/nav wiring.
- Source/security tests that ensure `video:compress` resolves registered file IDs, validates extensions and presets, uses timestamped output names, and streams progress.
- Preload/type tests that ensure the renderer gets `window.api.video.compress`.

Verification commands:

- `node --experimental-strip-types --test tests/video-compressor.test.mjs`
- `node --test tests/security.test.mjs tests/landing-page-source.test.mjs tests/video-trimmer.test.mjs`
- `npm run build:main`
- `npm run build`
- `npm run lint`

## Scope Exclusions

V1 does not include output format selection, custom CRF sliders, bitrate mode, two-pass encoding, subtitle handling, audio-only compression, GPU encoding, estimated output size before compression, side-by-side preview, or web/cloud demo support.
