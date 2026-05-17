import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock3,
  FileVideo,
  FileOutput,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  Scissors,
  StepBack,
  StepForward,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProcessing } from "@/context/useProcessing";
import { cn, getUserErrorMessage, showErrorToast, showSuccessToast } from "@/lib/utils";
import {
  clampTrimRange,
  formatDuration,
  validateTrimRange,
  type TrimMode,
} from "@/lib/video-trimmer";

const ALLOWED_EXTS = new Set([".mp4", ".webm", ".avi", ".mov", ".mkv"]);

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

export function VideoTrimmerPage() {
  const [file, setFile] = useState<FileRef | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0);
  const [mode, setMode] = useState<TrimMode>("fast");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [trimPreviewUrl, setTrimPreviewUrl] = useState<string | null>(null);
  const [isGeneratingTrimPreview, setIsGeneratingTrimPreview] = useState(false);
  const [isPreviewingTrim, setIsPreviewingTrim] = useState(false);
  const [videoTab, setVideoTab] = useState("trimmed");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const isMountedRef = useRef(true);
  const probeRequestRef = useRef<string | null>(null);
  const previewRequestRef = useRef<string | null>(null);
  const trimPreviewRequestRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const trimPreviewUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
      await window.api.video.revokePreview(urlOrToken);
    } catch {
      // Preview revocation is best-effort; loading/removing should continue.
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
        await window.api.video.revokePreview(urlOrToken);
      } catch {
        // Preview revocation is best-effort; loading/removing should continue.
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
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isPreviewingTrim || video.currentTime < trimEndSeconds) return;
      video.pause();
      video.currentTime = trimEndSeconds;
      setIsPreviewingTrim(false);
    };
    const handlePreviewStop = () => setIsPreviewingTrim(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePreviewStop);
    video.addEventListener("ended", handlePreviewStop);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePreviewStop);
      video.removeEventListener("ended", handlePreviewStop);
    };
  }, [isPreviewingTrim, previewUrl, trimEndSeconds]);

  const loadFile = useCallback(async (ref: FileRef) => {
    setError(null);
    if (!ALLOWED_EXTS.has(getDotExt(ref.name))) {
      setError("Unsupported video format.");
      return;
    }

    await revokeCurrentPreview();

    setFile(ref);
    setDurationSeconds(null);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setProgress(0);
    setIsPreviewingTrim(false);
    setVideoTab("trimmed");
    setOutputPath(null);
    probeRequestRef.current = ref.id;
    previewRequestRef.current = ref.id;

    void window.api.video.preview(ref.id)
      .then(({ url }) => {
        if (previewRequestRef.current !== ref.id) {
          void window.api.video.revokePreview(url).catch(() => undefined);
          return;
        }

        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((err) => {
        if (previewRequestRef.current !== ref.id) return;
        setError(getUserErrorMessage(err, "Could not load video preview."));
      });

    try {
      const result = await window.api.video.probe(ref.id);
      if (probeRequestRef.current !== ref.id) return;
      const range = clampTrimRange(0, result.durationSeconds, result.durationSeconds);
      setDurationSeconds(result.durationSeconds);
      setTrimStartSeconds(range.startSeconds);
      setTrimEndSeconds(range.endSeconds);
    } catch (err) {
      if (probeRequestRef.current !== ref.id) return;
      setDurationSeconds(null);
      setError(getUserErrorMessage(err, "Could not read video duration."));
    }
  }, [revokeCurrentPreview]);

  const handleAddClick = async () => {
    const refs = await window.api.openDocFiles("video");
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

    setError("Unsupported video format.");
  };

  const handleRemoveFile = () => {
    setFile(null);
    setDurationSeconds(null);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setProgress(0);
    setError(null);
    setIsPreviewingTrim(false);
    setVideoTab("trimmed");
    setOutputPath(null);
    probeRequestRef.current = null;
    void revokeCurrentPreview();
  };

  const validation = useMemo(() => {
    if (durationSeconds === null) {
      return { ok: false as const, error: "Choose a video before trimming." };
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
      void window.api.video.previewTrim(file.id, trimStartSeconds, trimEndSeconds)
        .then(({ url }) => {
          if (trimPreviewRequestRef.current !== requestKey) {
            void window.api.video.revokePreview(url).catch(() => undefined);
            return;
          }

          const previousUrl = trimPreviewUrlRef.current;
          trimPreviewUrlRef.current = url;
          setTrimPreviewUrl(url);
          setIsGeneratingTrimPreview(false);
          if (previousUrl && previousUrl !== url) {
            void window.api.video.revokePreview(previousUrl).catch(() => undefined);
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
    if (isPreviewingTrim) videoRef.current?.pause();
  };

  const handleEndSlider = (value: string) => {
    if (durationSeconds === null) return;
    const range = clampTrimRange(trimStartSeconds, Number(value), durationSeconds);
    setTrimStartSeconds(range.startSeconds);
    setTrimEndSeconds(range.endSeconds);
    if (isPreviewingTrim) videoRef.current?.pause();
  };

  const handleTrim = async () => {
    if (!file || !validation.ok) return;

    cancelledRef.current = false;
    setIsTrimming(true);
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setIsPreviewingTrim(false);
    setOutputPath(null);

    try {
      const result = await window.api.video.trim(file.id, trimStartSeconds, trimEndSeconds, mode);
      if (!cancelledRef.current) {
        setOutputPath(result.outputPath);
        setProgress(100);
        showSuccessToast("Video trimmed successfully.");
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
      await window.api.video.showInFolder(outputPath);
    } catch (err) {
      const message = getUserErrorMessage(err, "Could not open the output folder.");
      setError(message);
      showErrorToast(message);
    }
  };

  const handleSeekStart = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = trimStartSeconds;
  };

  const handleSeekEnd = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = trimEndSeconds;
  };

  const handlePlayTrimPreview = async () => {
    const video = videoRef.current;
    if (!video || !validation.ok) return;

    if (isPreviewingTrim) {
      video.pause();
      setIsPreviewingTrim(false);
      return;
    }

    video.currentTime = trimStartSeconds;
    setIsPreviewingTrim(true);
    try {
      await video.play();
    } catch {
      setIsPreviewingTrim(false);
    }
  };

  const clipLabel = validation.ok ? formatTrimTime(validation.clipSeconds) : "--:--:--";
  const canUsePreview = Boolean(previewUrl && !isTrimming);
  const sliderMax = durationSeconds ?? 0;

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
            Video Trimmer
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-base font-medium italic">
            Trim MP4, WebM, AVI, MOV, and MKV clips with fast copy mode or accurate encoding.
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
                  <FileVideo className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold tracking-tight">Click or drop one video here</p>
                  <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    Accepts .mp4 .webm .avi .mov .mkv
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
                <FileVideo className="h-5 w-5 shrink-0 text-muted-foreground" />
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
                  title="Remove video"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {previewUrl && (
                <Tabs value={videoTab} onValueChange={setVideoTab} className="gap-3">
                  <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1">
                    <TabsTrigger value="trimmed" className="rounded-full text-xs font-black uppercase italic tracking-tighter">
                      Trimmed Preview
                    </TabsTrigger>
                    <TabsTrigger value="full" className="rounded-full text-xs font-black uppercase italic tracking-tighter">
                      Full Video
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="trimmed">
                    <div className="overflow-hidden rounded-xl border border-border/50 bg-black shadow-inner">
                      {trimPreviewUrl ? (
                        <video
                          controls
                          preload="metadata"
                          src={trimPreviewUrl}
                          className="aspect-video w-full bg-black object-contain"
                        />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center bg-black px-6 text-center text-sm font-bold text-white/60">
                          {isGeneratingTrimPreview ? "Updating trimmed preview..." : "Adjust the sliders to generate a trimmed preview."}
                        </div>
                      )}
                      <div className="border-t border-white/10 bg-black/80 p-3 text-white">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
                          Trim Preview
                        </p>
                        <p className="truncate text-sm font-bold tabular-nums">
                          {formatTrimTime(trimStartSeconds)} to {formatTrimTime(trimEndSeconds)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="full">
                    <div className="overflow-hidden rounded-xl border border-border/50 bg-black shadow-inner">
                      <video
                        ref={videoRef}
                        controls
                        preload="metadata"
                        src={previewUrl}
                        className="aspect-video w-full bg-black object-contain"
                      />
                      <div className="flex flex-col gap-3 border-t border-white/10 bg-black/80 p-3 text-white sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
                            Full Video
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Drag the sliders, then preview the selected range before trimming.
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-80">
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
                "Trim Video"
              ) : (
                "Select Video"
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
            Local Trim Engine - Powered by KitBox
          </p>
        </CardFooter>
      </Card>

    </motion.div>
  );
}
