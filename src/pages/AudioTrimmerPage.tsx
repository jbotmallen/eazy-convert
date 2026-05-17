import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock3,
  FileAudio,
  FileOutput,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  Scissors,
  Gauge,
  Settings2,
  StepBack,
  StepForward,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessing } from "@/context/useProcessing";
import {
  clampTrimRange,
  formatDuration,
  validateTrimRange,
  type AudioChannelMode,
  type AudioOutputFormat,
  type AudioQualityPreset,
  type AudioTrimMode,
  type AudioTrimOptions,
} from "@/lib/audio-trimmer";
import { cn, getUserErrorMessage, showErrorToast, showSuccessToast } from "@/lib/utils";

const FORMATS: { value: AudioOutputFormat; label: string }[] = [
  { value: "mp3", label: "MP3 - Universal" },
  { value: "ogg", label: "OGG - Vorbis" },
  { value: "wav", label: "WAV - Lossless" },
  { value: "aac", label: "AAC - Mobile" },
  { value: "flac", label: "FLAC - Lossless" },
];

const QUALITY_PRESETS: { value: AudioQualityPreset; label: string; description: string }[] = [
  { value: "standard", label: "Standard", description: "Balanced size and fidelity" },
  { value: "small", label: "Small", description: "Lower bitrate for sharing" },
  { value: "high", label: "High", description: "Higher fidelity export" },
  { value: "custom", label: "Custom", description: "Set encoding details" },
];

const ALLOWED_EXTS = new Set([".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"]);

function getDotExt(filename: string): string {
  return "." + (filename.split(".").pop()?.toLowerCase() ?? "");
}

function formatTrimTime(seconds: number): string {
  const rounded = Math.round(Math.max(0, seconds) * 10) / 10;
  const wholeSeconds = Math.floor(rounded);
  const base = formatDuration(wholeSeconds);
  const tenths = Math.round((rounded - wholeSeconds) * 10);
  return tenths > 0 ? `${base}.${tenths}` : base;
}

function buildAudioTrimOptions(
  mode: AudioTrimMode,
  qualityPreset: AudioQualityPreset,
  custom: {
    bitrateKbps: number;
    sampleRateHz: number;
    channelMode: AudioChannelMode;
    oggQuality: number;
    compressionLevel: number;
  },
): AudioTrimOptions {
  if (qualityPreset !== "custom") return { mode, qualityPreset };
  return {
    mode,
    qualityPreset,
    custom: {
      bitrateKbps: custom.bitrateKbps,
      quality: custom.oggQuality,
      sampleRateHz: custom.sampleRateHz,
      channelMode: custom.channelMode,
      compressionLevel: custom.compressionLevel,
    },
  };
}

export function AudioTrimmerPage() {
  const [file, setFile] = useState<FileRef | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0);
  const [mode, setMode] = useState<AudioTrimMode>("accurate");
  const [format, setFormat] = useState<AudioOutputFormat>("mp3");
  const [qualityPreset, setQualityPreset] = useState<AudioQualityPreset>("standard");
  const [bitrateKbps, setBitrateKbps] = useState(192);
  const [oggQuality, setOggQuality] = useState(4);
  const [sampleRateHz, setSampleRateHz] = useState(44100);
  const [channelMode, setChannelMode] = useState<AudioChannelMode>("source");
  const [compressionLevel, setCompressionLevel] = useState(5);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [trimPreviewUrl, setTrimPreviewUrl] = useState<string | null>(null);
  const [isGeneratingTrimPreview, setIsGeneratingTrimPreview] = useState(false);
  const [isPreviewingTrim, setIsPreviewingTrim] = useState(false);
  const [audioTab, setAudioTab] = useState("trimmed");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const isMountedRef = useRef(true);
  const probeRequestRef = useRef<string | null>(null);
  const previewRequestRef = useRef<string | null>(null);
  const trimPreviewRequestRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const trimPreviewUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { setIsProcessing } = useProcessing();

  useEffect(() => {
    const remove = window.api.onProgress((p: number) => {
      setProgress(p);
    });
    return () => remove();
  }, []);

  const revokeCurrentTrimPreview = useCallback(async () => {
    trimPreviewRequestRef.current = null;
    const urlOrToken = trimPreviewUrlRef.current;
    trimPreviewUrlRef.current = null;
    if (isMountedRef.current) {
      setTrimPreviewUrl(null);
      setIsGeneratingTrimPreview(false);
    }

    if (!urlOrToken) return;

    try {
      await window.api.audio.revokePreview(urlOrToken);
    } catch {
      // Preview revocation is best-effort.
    }
  }, []);

  const revokeCurrentPreview = useCallback(async () => {
    previewRequestRef.current = null;
    const urlOrToken = previewUrlRef.current;
    previewUrlRef.current = null;
    if (isMountedRef.current) {
      setPreviewUrl(null);
      setIsPreviewingTrim(false);
    }

    if (urlOrToken) {
      try {
        await window.api.audio.revokePreview(urlOrToken);
      } catch {
        // Preview revocation is best-effort.
      }
    }

    await revokeCurrentTrimPreview();
  }, [revokeCurrentTrimPreview]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      void revokeCurrentPreview();
    };
  }, [revokeCurrentPreview]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isPreviewingTrim || audio.currentTime < trimEndSeconds) return;
      audio.pause();
      audio.currentTime = trimEndSeconds;
      setIsPreviewingTrim(false);
    };
    const handlePreviewStop = () => setIsPreviewingTrim(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("pause", handlePreviewStop);
    audio.addEventListener("ended", handlePreviewStop);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("pause", handlePreviewStop);
      audio.removeEventListener("ended", handlePreviewStop);
    };
  }, [isPreviewingTrim, previewUrl, trimEndSeconds]);

  const loadFile = useCallback(async (ref: FileRef) => {
    setError(null);
    if (!ALLOWED_EXTS.has(getDotExt(ref.name))) {
      setError("Unsupported audio format.");
      return;
    }

    await revokeCurrentPreview();

    setFile(ref);
    setDurationSeconds(null);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setProgress(0);
    setIsPreviewingTrim(false);
    setAudioTab("trimmed");
    setOutputPath(null);
    probeRequestRef.current = ref.id;
    previewRequestRef.current = ref.id;

    void window.api.audio.preview(ref.id)
      .then(({ url }) => {
        if (previewRequestRef.current !== ref.id) {
          void window.api.audio.revokePreview(url).catch(() => undefined);
          return;
        }

        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((err) => {
        if (previewRequestRef.current !== ref.id) return;
        setError(getUserErrorMessage(err, "Could not load audio preview."));
      });

    try {
      const result = await window.api.audio.probe(ref.id);
      if (probeRequestRef.current !== ref.id) return;
      const range = clampTrimRange(0, result.durationSeconds, result.durationSeconds);
      setDurationSeconds(result.durationSeconds);
      setTrimStartSeconds(range.startSeconds);
      setTrimEndSeconds(range.endSeconds);
    } catch (err) {
      if (probeRequestRef.current !== ref.id) return;
      setDurationSeconds(null);
      setError(getUserErrorMessage(err, "Could not read audio duration."));
    }
  }, [revokeCurrentPreview]);

  const handleAddClick = async () => {
    const refs = await window.api.openDocFiles("audio");
    if (refs.length) await loadFile(refs[0]);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    for (const droppedFile of Array.from(e.dataTransfer.files)) {
      const ref = await window.api.registerDroppedFile(droppedFile);
      if (ALLOWED_EXTS.has(getDotExt(ref.name))) {
        await loadFile(ref);
        return;
      }
    }

    setError("Unsupported audio format.");
  };

  const handleRemoveFile = () => {
    setFile(null);
    setDurationSeconds(null);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setProgress(0);
    setError(null);
    setIsPreviewingTrim(false);
    setAudioTab("trimmed");
    setOutputPath(null);
    probeRequestRef.current = null;
    void revokeCurrentPreview();
  };

  const validation = useMemo(() => {
    if (durationSeconds === null) {
      return { ok: false as const, error: "Choose an audio file before trimming." };
    }
    return validateTrimRange(trimStartSeconds, trimEndSeconds, durationSeconds);
  }, [durationSeconds, trimEndSeconds, trimStartSeconds]);

  useEffect(() => {
    if (!file || !validation.ok || isTrimming) {
      void revokeCurrentTrimPreview();
      return;
    }

    const requestKey = `${file.id}:${trimStartSeconds}:${trimEndSeconds}`;
    trimPreviewRequestRef.current = requestKey;
    setIsGeneratingTrimPreview(true);

    const timer = setTimeout(() => {
      void window.api.audio.previewTrim(file.id, trimStartSeconds, trimEndSeconds)
        .then(({ url }) => {
          if (trimPreviewRequestRef.current !== requestKey) {
            void window.api.audio.revokePreview(url).catch(() => undefined);
            return;
          }

          const previousUrl = trimPreviewUrlRef.current;
          trimPreviewUrlRef.current = url;
          setTrimPreviewUrl(url);
          setIsGeneratingTrimPreview(false);
          if (previousUrl && previousUrl !== url) {
            void window.api.audio.revokePreview(previousUrl).catch(() => undefined);
          }
        })
        .catch((err) => {
          if (trimPreviewRequestRef.current !== requestKey) return;
          setTrimPreviewUrl(null);
          setIsGeneratingTrimPreview(false);
          setError(getUserErrorMessage(err, "Could not generate trimmed preview."));
        });
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [
    file,
    isTrimming,
    revokeCurrentTrimPreview,
    trimEndSeconds,
    trimStartSeconds,
    validation.ok,
  ]);

  const handleStartSlider = (value: string) => {
    if (durationSeconds === null) return;
    const range = clampTrimRange(Number(value), trimEndSeconds, durationSeconds);
    setTrimStartSeconds(range.startSeconds);
    setTrimEndSeconds(range.endSeconds);
    if (isPreviewingTrim) audioRef.current?.pause();
  };

  const handleEndSlider = (value: string) => {
    if (durationSeconds === null) return;
    const range = clampTrimRange(trimStartSeconds, Number(value), durationSeconds);
    setTrimStartSeconds(range.startSeconds);
    setTrimEndSeconds(range.endSeconds);
    if (isPreviewingTrim) audioRef.current?.pause();
  };

  const handleTrim = async () => {
    if (!file || !validation.ok) return;

    const options = buildAudioTrimOptions(mode, qualityPreset, {
      bitrateKbps,
      sampleRateHz,
      channelMode,
      oggQuality,
      compressionLevel,
    });

    cancelledRef.current = false;
    setIsTrimming(true);
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setIsPreviewingTrim(false);
    setOutputPath(null);

    try {
      const result = await window.api.audio.trim(file.id, trimStartSeconds, trimEndSeconds, format, options);
      if (!cancelledRef.current) {
        setOutputPath(result.outputPath);
        setProgress(100);
        showSuccessToast("Audio trimmed successfully.");
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(getUserErrorMessage(err, "Trimming failed."));
      }
    } finally {
      setIsTrimming(false);
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setIsPreviewingTrim(false);
    window.api.cancelConvert();
  };

  const handleOpenOutputFolder = async () => {
    if (!outputPath) return;
    try {
      await window.api.audio.showInFolder(outputPath);
    } catch (err) {
      const message = getUserErrorMessage(err, "Could not open the output folder.");
      setError(message);
      showErrorToast(message);
    }
  };

  const handleSeekStart = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = trimStartSeconds;
  };

  const handleSeekEnd = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = trimEndSeconds;
  };

  const handlePlayTrimPreview = async () => {
    const audio = audioRef.current;
    if (!audio || !validation.ok) return;

    if (isPreviewingTrim) {
      audio.pause();
      setIsPreviewingTrim(false);
      return;
    }

    audio.currentTime = trimStartSeconds;
    setIsPreviewingTrim(true);
    try {
      await audio.play();
    } catch {
      setIsPreviewingTrim(false);
    }
  };

  const clipLabel = validation.ok ? formatTrimTime(validation.clipSeconds) : "--:--:--";
  const canUsePreview = Boolean(previewUrl && !isTrimming);
  const sliderMax = durationSeconds ?? 0;
  const showCustomControls = qualityPreset === "custom";
  const usesBitrate = format !== "wav" && format !== "flac";
  const usesOggQuality = format === "ogg";
  const usesCompression = format === "flac";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full overflow-hidden border-border bg-card/40 font-sans shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b border-border/50 bg-muted/5 pb-8 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-4xl font-black uppercase italic tracking-tighter text-primary">
            <Scissors className="h-10 w-10" />
            Audio Trimmer
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-base font-medium italic">
            Trim MP3, WAV, OGG, AAC, FLAC, and M4A audio with previewed ranges and export presets.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pt-10">
          {!file ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={handleAddClick}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-300",
                isDragOver
                  ? "border-primary/70 bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="rounded-2xl bg-primary/10 p-5 shadow-lg shadow-primary/5">
                  <FileAudio className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold tracking-tight">Click or drop one audio file here</p>
                  <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    Accepts .mp3 .wav .ogg .aac .flac .m4a
                  </p>
                </div>
              </div>
            </motion.button>
          ) : (
            <div
              className={cn(
                "space-y-6 rounded-2xl border border-border/50 bg-muted/20 p-4 transition-colors",
                isDragOver && "ring-2 ring-primary/50",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-3">
                <FileAudio className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                    {durationSeconds === null ? "Reading duration" : `Duration ${formatTrimTime(durationSeconds)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isTrimming}
                  className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-20"
                  title="Remove audio"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {previewUrl && (
                <Tabs value={audioTab} onValueChange={setAudioTab} className="gap-3">
                  <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1">
                    <TabsTrigger value="trimmed" className="rounded-full text-xs font-black uppercase italic tracking-tighter">
                      Trimmed Preview
                    </TabsTrigger>
                    <TabsTrigger value="full" className="rounded-full text-xs font-black uppercase italic tracking-tighter">
                      Full Audio
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="trimmed">
                    <div className="overflow-hidden rounded-xl border border-border/50 bg-background shadow-inner">
                      <div className="grid min-h-34 place-items-center px-4 py-8">
                        {trimPreviewUrl ? (
                          <audio controls preload="metadata" src={trimPreviewUrl} className="w-full" />
                        ) : (
                          <div className="px-6 text-center text-sm font-bold text-muted-foreground">
                            {isGeneratingTrimPreview ? "Updating trimmed preview..." : "Adjust the sliders to generate a trimmed preview."}
                          </div>
                        )}
                      </div>
                      <div className="border-t border-border/50 bg-muted/20 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
                          Trim Preview
                        </p>
                        <p className="truncate text-sm font-bold tabular-nums">
                          {formatTrimTime(trimStartSeconds)} to {formatTrimTime(trimEndSeconds)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="full">
                    <div className="overflow-hidden rounded-xl border border-border/50 bg-background shadow-inner">
                      <div className="grid min-h-34 place-items-center px-4 py-8">
                        <audio
                          ref={audioRef}
                          controls
                          preload="metadata"
                          src={previewUrl}
                          className="w-full"
                        />
                      </div>
                      <div className="flex flex-col gap-3 border-t border-border/50 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
                            Full Audio
                          </p>
                          <p className="truncate text-sm font-bold tabular-nums">
                            {formatTrimTime(trimStartSeconds)} to {formatTrimTime(trimEndSeconds)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canUsePreview || !validation.ok}
                            onClick={handlePlayTrimPreview}
                            className="h-9 gap-2"
                          >
                            {isPreviewingTrim ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {isPreviewingTrim ? "Pause" : "Preview"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canUsePreview}
                            onClick={handleSeekStart}
                            title="Seek preview to start"
                            className="h-9 px-2"
                          >
                            <StepBack className="h-4 w-4" />
                            <span className="sr-only">Seek preview to start</span>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canUsePreview}
                            onClick={handleSeekEnd}
                            title="Seek preview to end"
                            className="h-9 px-2"
                          >
                            <StepForward className="h-4 w-4" />
                            <span className="sr-only">Seek preview to end</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <div className="space-y-5 rounded-xl border border-border/50 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/70">
                      Trim Range
                    </p>
                    <p className="mt-1 text-sm font-bold tabular-nums">
                      {formatTrimTime(trimStartSeconds)} to {formatTrimTime(trimEndSeconds)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/70">
                      Clip Length
                    </p>
                    <p className="mt-1 text-2xl font-black italic tracking-tighter text-primary">{clipLabel}</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <label className="grid gap-2">
                    <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                      <FieldLabel as="span" icon={Clock3} className="m-0">Start</FieldLabel>
                      <span className="font-mono tracking-normal text-foreground">{formatTrimTime(trimStartSeconds)}</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={sliderMax}
                      step={0.1}
                      value={trimStartSeconds}
                      disabled={durationSeconds === null || isTrimming}
                      onChange={(e) => handleStartSlider(e.target.value)}
                      className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                      <FieldLabel as="span" icon={Clock3} className="m-0">End</FieldLabel>
                      <span className="font-mono tracking-normal text-foreground">{formatTrimTime(trimEndSeconds)}</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={sliderMax}
                      step={0.1}
                      value={trimEndSeconds}
                      disabled={durationSeconds === null || isTrimming}
                      onChange={(e) => handleEndSlider(e.target.value)}
                      className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-border/50 bg-background/50 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel as="span" icon={FileOutput} className="m-0">Output Format</FieldLabel>
                    <Select value={format} onValueChange={(value) => setFormat(value as AudioOutputFormat)} disabled={isTrimming}>
                      <SelectTrigger className="h-12 bg-background/70 font-bold uppercase italic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((item) => (
                          <SelectItem key={item.value} value={item.value} className="font-bold uppercase italic">
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <div className="grid gap-2">
                    <FieldLabel as="span" icon={Scissors} className="m-0">Trim Mode</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={mode === "fast" ? "default" : "outline"}
                        disabled={isTrimming}
                        onClick={() => setMode("fast")}
                        className="h-12 font-black uppercase italic tracking-tighter"
                      >
                        Fast
                      </Button>
                      <Button
                        type="button"
                        variant={mode === "accurate" ? "default" : "outline"}
                        disabled={isTrimming}
                        onClick={() => setMode("accurate")}
                        className="h-12 font-black uppercase italic tracking-tighter"
                      >
                        Accurate
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <FieldLabel as="span" icon={Gauge} className="m-0">Quality</FieldLabel>
                  <div className="grid gap-2 md:grid-cols-4">
                    {QUALITY_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        disabled={isTrimming}
                        onClick={() => setQualityPreset(preset.value)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors disabled:opacity-40",
                          qualityPreset === preset.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/70 bg-background/50 hover:border-primary/50",
                        )}
                      >
                        <span className="block text-sm font-black uppercase italic tracking-tight">{preset.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{preset.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {showCustomControls && (
                  <div className="grid gap-4 rounded-lg border border-border/50 bg-muted/20 p-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <FieldLabel as="span" icon={Gauge} className="m-0">Custom Quality</FieldLabel>
                    </div>
                    {usesBitrate && !usesOggQuality && (
                      <label className="grid gap-2">
                        <span className="flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                          <FieldLabel as="span" icon={Gauge} className="m-0">Bitrate</FieldLabel>
                          <span className="font-mono tracking-normal text-foreground">{bitrateKbps} kbps</span>
                        </span>
                        <input
                          type="range"
                          min={64}
                          max={320}
                          step={16}
                          value={bitrateKbps}
                          disabled={isTrimming}
                          onChange={(e) => setBitrateKbps(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </label>
                    )}

                    {usesOggQuality && (
                      <label className="grid gap-2">
                        <span className="flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                          <FieldLabel as="span" icon={Gauge} className="m-0">Vorbis Quality</FieldLabel>
                          <span className="font-mono tracking-normal text-foreground">{oggQuality}</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={oggQuality}
                          disabled={isTrimming}
                          onChange={(e) => setOggQuality(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </label>
                    )}

                    <label className="grid gap-2">
                      <FieldLabel as="span" icon={Settings2} className="m-0">Sample Rate</FieldLabel>
                      <Select value={String(sampleRateHz)} onValueChange={(value) => setSampleRateHz(Number(value))} disabled={isTrimming}>
                        <SelectTrigger className="h-11 bg-background/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="44100">44.1 kHz</SelectItem>
                          <SelectItem value="48000">48 kHz</SelectItem>
                          <SelectItem value="96000">96 kHz</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="grid gap-2">
                      <FieldLabel as="span" icon={Settings2} className="m-0">Channels</FieldLabel>
                      <Select value={channelMode} onValueChange={(value) => setChannelMode(value as AudioChannelMode)} disabled={isTrimming}>
                        <SelectTrigger className="h-11 bg-background/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="source">Source</SelectItem>
                          <SelectItem value="mono">Mono</SelectItem>
                          <SelectItem value="stereo">Stereo</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>

                    {usesCompression && (
                      <label className="grid gap-2">
                        <span className="flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                          <FieldLabel as="span" icon={Gauge} className="m-0">FLAC Compression</FieldLabel>
                          <span className="font-mono tracking-normal text-foreground">{compressionLevel}</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={12}
                          step={1}
                          value={compressionLevel}
                          disabled={isTrimming}
                          onChange={(e) => setCompressionLevel(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                Drag the sliders, preview the selected range, then export the trimmed audio.
              </div>

              {!validation.ok && durationSeconds !== null && (
                <p className="flex items-center gap-2 text-sm font-bold text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {validation.error}
                </p>
              )}
            </div>
          )}

          <AnimatePresence>
            {isTrimming && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                  <span>Trim Active</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 shadow-lg shadow-primary/10" />
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {outputPath && (
            <div className="grid gap-2 rounded-xl border border-border/50 bg-muted/20 p-4">
              <FieldLabel icon={FileOutput} className="m-0 text-[10px] tracking-[0.3em] text-muted-foreground/70">Saved Output</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={outputPath}
                  className="h-12 flex-1 bg-background/70 font-mono text-xs"
                  aria-label="Saved output path"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 gap-2 font-black uppercase italic tracking-tighter"
                  onClick={handleOpenOutputFolder}
                >
                  <FolderOpen className="h-4 w-4" />
                  Open Folder
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02]",
                isTrimming ? "flex-1" : "w-full",
              )}
              disabled={Boolean(file) && (!validation.ok || isTrimming)}
              onClick={file ? handleTrim : handleAddClick}
            >
              {isTrimming ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Trimming
                </div>
              ) : file ? (
                "Trim Audio"
              ) : (
                "Select Audio"
              )}
            </Button>

            <AnimatePresence>
              {isTrimming && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className="h-16 px-8 font-black uppercase italic tracking-tighter"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/50 bg-muted/10 py-8">
          <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            <CheckCircle className="h-4 w-4 text-primary" />
            Local Audio Engine - Powered by KitBox
          </p>
        </CardFooter>
      </Card>

    </motion.div>
  );
}
