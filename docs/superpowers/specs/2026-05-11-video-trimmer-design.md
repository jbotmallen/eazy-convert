# Video Trimmer Design

## Goal

Add a first-class video trimming workflow that lets users cut a single local video into a shorter clip with either fast stream-copy trimming or slower accurate re-encoding.

## User Experience

The feature lives at `/videos/trim` and appears in the Videos navbar group as "Video Trimmer". The page follows the existing desktop tool style: one focused card, drag/drop or file picker, clear action buttons, progress, cancel, and toast feedback.

The user selects one `.mp4`, `.webm`, `.avi`, `.mov`, or `.mkv` file. The app probes duration with FFprobe and shows the file name, total duration, start time, end time, and computed clip length. Start and end are editable with `HH:MM:SS`-style inputs. Invalid ranges block trimming and show inline errors before IPC calls are made.

The page offers a two-option mode control:

- Fast: copy streams without re-encoding. This is much faster and preserves quality, but cuts near keyframes and may be slightly imprecise.
- Accurate: re-encode the selected segment. This is slower but cuts at the requested timestamps more reliably.

When trimming completes, the output is saved beside the input as a unique path based on `name_trimmed.ext`. The page shows success feedback and leaves the user ready to trim another range from the same file.

## Main Process Architecture

Add focused video tool IPC handlers separate from the existing generic converter handler:

- `video:probe(inputId)` resolves a registered file ID, validates it is an allowed video file, confirms it exists, and returns `{ durationSeconds }`.
- `video:trim(inputId, startSeconds, endSeconds, mode)` resolves the registered file ID, validates extension/time/mode, builds a safe unique output path, runs FFmpeg, streams progress through the existing `conversion-progress` event, and returns the output path.

Use the existing helpers and constraints:

- `resolveRegisteredFilePath` for file ID resolution.
- `VIDEO_EXTS` for extension allowlisting.
- `validatePath`, `getUniquePath`, `getFfmpegPath`, and `getFfprobePath` for filesystem and tool access.
- Existing `cancel-convert` event and active child process map pattern, or a shared cancel registration helper if the implementation extracts one.

Validation remains authoritative in the main process. Renderer validation is for UX only.

## FFmpeg Behavior

Probe duration:

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 input
```

Fast trim:

```bash
ffmpeg -y -hide_banner -loglevel error -progress pipe:1 -ss START -to END -i input -c copy output
```

Accurate trim:

```bash
ffmpeg -y -hide_banner -loglevel error -progress pipe:1 -ss START -to END -i input [codec args] output
```

Codec args match existing video conversion behavior:

- `.webm`: `libvpx-vp9`, `libopus`.
- `.mp4`, `.mov`, `.mkv`, `.avi`: `libx264`, `aac`.
- `.mp4` and `.mov`: include `yuv420p`.
- `.mp4`: include `+faststart`.

Progress should be calculated against clip duration (`endSeconds - startSeconds`), not full input duration.

## Renderer Architecture

Add `VideoTrimmerPage.tsx` and route it from `App.tsx`. The page owns:

- Selected `FileRef`.
- Probed duration.
- Start/end strings and parsed seconds.
- Mode: `"fast"` or `"accurate"`.
- Processing state, progress, output path, errors, and toast.

Expose APIs in preload/types:

- `window.api.video.probe(inputId)`
- `window.api.video.trim(inputId, startSeconds, endSeconds, mode)`

Keep the UI single-file initially because the first version is compact. Extract shared time parsing/formatting into a small pure module if it improves tests or keeps the page readable.

## Error Handling

User-facing errors should be short and specific:

- Unsupported file type.
- Could not read video duration.
- Start time must be before end time.
- End time must be within the video duration.
- Trimming failed because the input file is missing, unsupported, permission denied, disk is full, or FFmpeg fails.

Canceling should kill the active FFmpeg process, reset the active page state to ready, and avoid showing a success toast.

## Tests and Verification

Add tests before implementation:

- Pure tests for time parsing/formatting and range validation.
- Source/security tests that ensure the trimmer route/nav are wired and the preload exposes only registered-file APIs.
- Main-process helper tests where practical for validation helpers. Avoid spawning real FFmpeg in unit tests.

Verification commands:

- `node --test tests/security.test.mjs tests/landing-page-source.test.mjs tests/video-trimmer.test.mjs`
- `npm run build:main`
- `npm run build`
- `npm run lint`
- `npm audit --json` with `NODE_OPTIONS=--use-system-ca` when local CA requires it.

## Scope Exclusions

This version does not include video preview, draggable timeline handles, waveform rendering, batch trimming, frame stepping, subtitles, chapter export, overwrite behavior, or cloud/web demo support.
