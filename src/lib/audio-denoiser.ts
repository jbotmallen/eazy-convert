export type DenoiseEngine = "rnnoise" | "fft";
export type DenoisePreset = "light" | "medium" | "aggressive";
export type RnnoiseModelName = "sh" | "cb" | "mp";
export type AudioDenoiseOutputFormat = "mp3" | "ogg" | "wav" | "aac" | "flac";

export type DenoiseOptions = {
  engine: DenoiseEngine;
  preset: DenoisePreset;
  model?: RnnoiseModelName;
};

export const DENOISE_PRESETS: {
  id: DenoisePreset;
  label: string;
  hint: string;
  tooltip: string;
}[] = [
  {
    id: "light",
    label: "Light",
    hint: "Subtle clean-up, preserves voice texture.",
    tooltip: "RNNoise mix=0.3, afftdn nr=6 dB. Lowest suppression, safest on music and speech harmonics.",
  },
  {
    id: "medium",
    label: "Medium",
    hint: "Balanced noise removal.",
    tooltip: "RNNoise mix=0.6, afftdn nr=12 dB. Recommended default. Removes most steady noise without obvious artifacts.",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    hint: "Maximum noise removal. May warble music.",
    tooltip: "RNNoise mix=1.0, afftdn nr=24 dB. Full strength suppression. Can introduce warbling or pumping on tonal content.",
  },
];

export const RNNOISE_MODELS: { id: RnnoiseModelName; label: string; hint: string }[] = [
  { id: "sh", label: "General speech", hint: "Default. Works for most recordings." },
  { id: "cb", label: "Conference / call", hint: "Optimised for narrowband call audio." },
  { id: "mp", label: "Aggressive speech", hint: "Stronger model. Tighter on noise." },
];

export const DENOISE_ENGINES: { id: DenoiseEngine; label: string; hint: string }[] = [
  { id: "rnnoise", label: "RNNoise (speech)", hint: "Neural net. Best for voice and dialog." },
  { id: "fft", label: "FFT (hiss / hum)", hint: "Spectral subtraction. Best for stationary noise." },
];

export const AUDIO_DENOISE_OUTPUT_FORMATS: AudioDenoiseOutputFormat[] = [
  "mp3",
  "wav",
  "ogg",
  "aac",
  "flac",
];
