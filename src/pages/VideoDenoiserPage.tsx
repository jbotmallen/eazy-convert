import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileVideo,
  FolderOpen,
  Info,
  Loader2,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
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
import { useProcessing } from "@/context/useProcessing";
import {
  DENOISE_ENGINES,
  DENOISE_PRESETS,
  RNNOISE_MODELS,
  type DenoiseEngine,
  type DenoisePreset,
  type RnnoiseModelName,
} from "@/lib/audio-denoiser";
import { cn, getUserErrorMessage, showErrorToast, showSuccessToast } from "@/lib/utils";

const ALLOWED_EXTS = new Set([".mp4", ".webm", ".avi", ".mov", ".mkv"]);

function getDotExt(filename: string): string {
  return "." + (filename.split(".").pop()?.toLowerCase() ?? "");
}

export function VideoDenoiserPage() {
  const [file, setFile] = useState<FileRef | null>(null);
  const [engine, setEngine] = useState<DenoiseEngine>("rnnoise");
  const [preset, setPreset] = useState<DenoisePreset>("medium");
  const [model, setModel] = useState<RnnoiseModelName>("sh");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { setIsProcessing } = useProcessing();

  useEffect(() => {
    const remove = window.api.onProgress((p: number) => setProgress(p));
    return () => remove();
  }, []);

  const loadFile = useCallback((ref: FileRef) => {
    setError(null);
    if (!ALLOWED_EXTS.has(getDotExt(ref.name))) {
      setError("Unsupported video format.");
      return;
    }
    setFile(ref);
    setOutputPath(null);
    setProgress(0);
  }, []);

  const handleBrowse = useCallback(async () => {
    const ref = await window.api.openFile();
    if (ref) loadFile(ref);
  }, [loadFile]);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (!dropped) return;
      const ref = await window.api.registerDroppedFile(dropped);
      loadFile({ ...ref, name: dropped.name });
    },
    [loadFile],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setOutputPath(null);
    setProgress(0);
    setError(null);
  }, []);

  const handleRun = useCallback(async () => {
    if (!file) return;
    setIsRunning(true);
    setIsProcessing(true);
    setError(null);
    setOutputPath(null);
    setProgress(0);
    cancelledRef.current = false;

    try {
      const options =
        engine === "rnnoise"
          ? { engine, preset, model }
          : { engine, preset };
      const result = await window.api.video.denoise(file.id, options);
      if (cancelledRef.current) return;
      setOutputPath(result.outputPath);
      showSuccessToast("Video audio denoised successfully.");
    } catch (err) {
      if (cancelledRef.current) return;
      const message = getUserErrorMessage(err, "Denoising failed.");
      setError(message);
      showErrorToast(message);
    } finally {
      setIsRunning(false);
      setIsProcessing(false);
    }
  }, [file, engine, preset, model, setIsProcessing]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    window.api.cancelConvert();
    setIsRunning(false);
    setIsProcessing(false);
  }, [setIsProcessing]);

  const handleShowInFolder = useCallback(async () => {
    if (!outputPath) return;
    try {
      await window.api.video.showInFolder(outputPath);
    } catch (err) {
      const message = getUserErrorMessage(err);
      setError(message);
      showErrorToast(message);
    }
  }, [outputPath]);

  const activePresetHint = DENOISE_PRESETS.find((p) => p.id === preset)?.hint;

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
            <Sparkles className="h-10 w-10" />
            Video Denoiser
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-base font-medium italic">
            Clean background noise from video audio track. Video stream stays untouched.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pt-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <FieldLabel icon={Settings2}>Denoise Engine</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {DENOISE_ENGINES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setEngine(option.id)}
                    disabled={isRunning}
                    className={cn(
                      "group relative flex h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-black uppercase italic transition-colors",
                      engine === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-transparent hover:border-primary/40",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="ml-1 text-xs font-medium text-muted-foreground">
                {DENOISE_ENGINES.find((e) => e.id === engine)?.hint}
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel icon={SlidersHorizontal}>Strength Preset</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {DENOISE_PRESETS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPreset(option.id)}
                    disabled={isRunning}
                    className={cn(
                      "group relative flex h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-black uppercase italic transition-colors",
                      preset === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-transparent hover:border-primary/40",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    <span
                      className="relative inline-flex"
                      title={option.tooltip}
                      aria-label={`${option.label} preset details`}
                      tabIndex={0}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-left text-[11px] font-medium normal-case not-italic leading-snug tracking-normal text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <span className="block font-bold text-foreground">{option.hint}</span>
                        <span className="mt-1 block text-muted-foreground">{option.tooltip}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="ml-1 text-xs font-medium text-muted-foreground">{activePresetHint}</p>
            </div>

            {engine === "rnnoise" && (
              <div className="space-y-2">
                <FieldLabel icon={Settings2}>RNNoise Model</FieldLabel>
                <Select
                  value={model}
                  onValueChange={(v) => setModel(v as RnnoiseModelName)}
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                    {RNNOISE_MODELS.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="font-bold uppercase italic py-3 cursor-pointer"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="ml-1 text-xs font-medium text-muted-foreground">
                  {RNNOISE_MODELS.find((m) => m.id === model)?.hint}
                </p>
              </div>
            )}
          </div>

          {!file ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={handleBrowse}
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
                  <p className="text-xl font-bold tracking-tight">Click or drop a video file</p>
                  <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    Accepts .mp4 .webm .avi .mov .mkv
                  </p>
                </div>
              </div>
            </motion.button>
          ) : (
            <div
              className={cn(
                "space-y-3 rounded-xl border px-4 py-3 transition-colors",
                isRunning && "border-primary/40 bg-primary/5",
                !isRunning && outputPath && "border-green-500/30 bg-green-500/5",
                !isRunning && !outputPath && "border-border/50 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-3">
                <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </span>
                <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:block">
                  audio denoise
                </span>
                <span className="flex w-28 shrink-0 items-center justify-end">
                  {isRunning ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {progress}%
                    </span>
                  ) : outputPath ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-500">
                      <CheckCircle className="h-3 w-3" />
                      Done
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Ready
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isRunning}
                  className="ml-1 shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-20"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {outputPath && !isRunning && (
                <div className="grid gap-2 border-t border-border/40 pt-3 text-xs font-medium text-muted-foreground md:grid-cols-[1fr_auto]">
                  <p className="truncate" title={outputPath}>
                    {outputPath}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 text-xs font-bold uppercase tracking-wider"
                    onClick={handleShowInFolder}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Show
                  </Button>
                </div>
              )}
            </div>
          )}

          <AnimatePresence>
            {isRunning && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                  <span>Engine Active</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 shadow-lg shadow-primary/10" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02]",
                isRunning ? "flex-1" : "w-full",
              )}
              disabled={isRunning || !file}
              onClick={file ? handleRun : handleBrowse}
            >
              {isRunning ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Denoising...
                </div>
              ) : !file ? (
                "Select Video File"
              ) : (
                "Denoise Audio Track"
              )}
            </Button>

            <AnimatePresence>
              {isRunning && (
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

          {error && (
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="size-4" /> {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center border-t border-border/50 bg-muted/10 py-8">
          <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            <CheckCircle className="h-4 w-4 text-primary" />
            Local FFmpeg + RNNoise - Powered by KitBox
          </p>
        </CardFooter>
      </Card>

    </motion.div>
  );
}
