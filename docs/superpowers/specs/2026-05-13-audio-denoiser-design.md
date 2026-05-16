# Audio Denoiser Design

## Goal

Add background-noise removal for local audio files and the audio track of local video files. Two engines, three strength presets, no preview, direct file output. Built on bundled FFmpeg (`arnndn` + `afftdn`) with three RNNoise model files shipped as `extraResources`.

## User Experience

Two pages, mirroring the existing trimmer / compressor split:

- `/audio/denoise` — input: any allowed audio file. Output: user-chosen audio format (MP3, OGG, WAV, AAC, FLAC).
- `/videos/denoise` — input: any allowed video file. Output: same container as input. Video stream is stream-copied; only the audio track is re-encoded (AAC 192 kbps).

Both pages accept a single file via drag-and-drop or browse. After loading the file, the user picks:

- **Engine** (Tabs):
  - `RNNoise (speech)` — neural net, best for voice / dialog.
  - `FFT (hiss / hum)` — spectral subtraction, best for stationary noise.
- **Strength** (Select): `Light`, `Medium`, `Aggressive`.
- **RNNoise model** (Select, only when engine = `RNNoise`): `General speech (sh)`, `Conference / call (cb)`, `Aggressive speech (mp)`.
- **Output format** (Select, audio page only): `mp3 / ogg / wav / aac / flac`. Defaults to `mp3`.

A single primary button runs the job. Progress bar reflects FFmpeg `out_time_ms` against probed duration. A Cancel button kills the active process. On success, the page shows the output path and an "Open in folder" button.

Output naming: `<basename>_denoised_<unix-ms>_<rand8>.<ext>`, written next to the source file.

## Strength Presets

| Preset | `arnndn` `mix` | `afftdn` `nr` (dB) |
|--------|---------------:|-------------------:|
| Light | 0.3 | 6 |
| Medium | 0.6 | 12 |
| Aggressive | 1.0 | 24 |

`afftdn` always uses `nf=-50` and `nt=w` (white noise reference). These defaults are conservative and avoid voice warble at Light / Medium.

## RNNoise Models

Three `.rnnn` files are bundled in `resources/rnnoise/`, sourced from `github.com/GregorR/rnnoise-models` (BSD-licensed). They are copied into the packaged app via `build.extraResources` so the path is `process.resourcesPath/rnnoise/<name>.rnnn` in production and `<repo>/resources/rnnoise/<name>.rnnn` in development.

Models bundled:

- `sh.rnnn` — somnolent-hogwash, general speech (default).
- `cb.rnnn` — conjoined-burgers, conference / call audio.
- `mp.rnnn` — marathon-prescription, more aggressive speech model.

`getRnnoiseModelPath(name)` in `electron/utils/helpers.ts` is the only function that knows where these live; everything else passes a resolved absolute path.

## FFmpeg Behavior

Filter strings are constructed by `electron/utils/audioDenoise.ts`:

- `buildAfftdnFilter(preset) → "afftdn=nr=<dB>:nf=-50:nt=w"`
- `buildArnndnFilter(preset, modelPath) → "arnndn=m=<escaped-path>:mix=<mix>"`

Windows paths require special escaping inside FFmpeg filter arguments. `escapeFfmpegFilterPath()` replaces backslashes with forward slashes and double-escapes drive colons (`D:` → `D\\:`). Smoke-tested against the bundled FFmpeg.

Audio command shape:

```
ffmpeg -n -hide_banner -loglevel error -progress pipe:1
       -i <in> -af <filter> <encoder-args> <out>
```

Video command shape (stream-copy video, replace audio):

```
ffmpeg -n -hide_banner -loglevel error -progress pipe:1
       -i <in>
       -map 0:v:0 -map 0:a:0
       -c:v copy
       -af <filter>
       -c:a aac -b:a 192k
       <out>
```

## Main Process Architecture

New module `electron/handlers/audioDenoise.ts` registers three IPC handlers:

- `audio:denoise(inputId, outputFormat, options)` → `{ success, outputPath }`
- `video:denoise(inputId, options)` → `{ success, outputPath }`
- `denoise:show-in-folder(filePath)` → opens Explorer / Finder selection.

The handler reuses:

- `resolveRegisteredFilePath` for inputId → path.
- `AUDIO_EXTS` / `VIDEO_EXTS` allowlists.
- `validatePath`, `getFfmpegPath`, `getFfprobePath`.
- The shared `conversion-progress` event for renderer progress.
- The shared `cancel-convert` channel (handler keeps its own `activeProcs` map and registers its own listener — multiple listeners coexist safely with the audio / video tool handlers).

Validation is authoritative in the main process. `validateDenoiseOptions` rejects unknown engines, presets, and model names; the model name is a strict three-item allowlist so the renderer cannot pass a raw filesystem path.

`registerAudioDenoiseHandlers()` is called from `electron/main.ts` alongside the existing handler registrations.

## Renderer Architecture

- `src/lib/audio-denoiser.ts` — shared types, preset / engine / model metadata for the UI.
- `src/pages/AudioDenoiserPage.tsx` — single-file UX, audio input only.
- `src/pages/VideoDenoiserPage.tsx` — single-file UX, video input only.
- `src/App.tsx` — adds `/audio/denoise` and `/videos/denoise` routes.
- `src/components/Navbar.tsx` — replaces the existing `Audio Denoiser` "Soon" entry with a live link, adds `Video Denoiser` to the Videos group.
- `src/pages/AppHomePage.tsx` — adds tool cards for both pages.
- `src/types.d.ts` — extends `window.api.audio` and `window.api.video` with `denoise(...)`.

Both pages share the same look-and-feel: drop zone → file card → settings card → progress / cancel → success card with "Open in folder".

## Test Plan

`tests/audio-denoiser.test.mjs` (node:test, `--experimental-strip-types`) covers:

- Preset → `afftdn` `nr` value mapping (Light / Medium / Aggressive).
- Preset + escaped model path → `arnndn` filter string.
- Windows path escaping rule.
- Validation rejects unknown engines, presets, and RNNoise model names.
- Validation defaults RNNoise model to `sh` when omitted.
- RNNoise model name whitelist is exactly `sh` / `cb` / `mp`.
- `registerAudioDenoiseHandlers()` is wired into `electron/main.ts`.
- Preload exposes `audio:denoise` and `video:denoise` IPC.
- `src/types.d.ts` declares `denoise` on both `audio` and `video` namespaces.
- Routes `/audio/denoise` and `/videos/denoise` are wired in `src/App.tsx`.
- The three `.rnnn` files exist in `resources/rnnoise/` and are non-trivial in size.
- `package.json` declares `resources/rnnoise` as an `extraResources` entry.

Manual QA:

- Noisy WAV → cleaner WAV (audible A/B).
- Noisy MP4 → cleaner MP4, video bytes intact (verify with `ffprobe` that video stream is unchanged).
- Cancel mid-run stops FFmpeg promptly.

## Open Items

- `arnndn` filter is confirmed present in `ffmpeg-static@^5.3.0`. If a future bump removes it, swap to a custom build or vendor a denoiser binary.
- Aggressive RNNoise (mix = 1.0) can warble musical content. Document in UI subtitle and keep Medium as the default.
- DeepFilterNet (better quality at higher CPU cost) is intentionally not wired up; the `engine` enum is open-ended so it can be added later without an IPC break.
