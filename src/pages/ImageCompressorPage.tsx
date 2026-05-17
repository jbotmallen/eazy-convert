import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileImage,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Loader2,
  Minimize2,
  Plus,
  FileOutput,
  Gauge,
  Ruler,
  Settings2,
  SlidersHorizontal,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useProcessing } from "@/context/useProcessing";
import {
  IMAGE_COMPRESSION_PRESETS,
  imageCompressionOptionsSchema,
  formatBytes,
  type ImageCompressionOutputFormat,
  type ImageCompressionPresetId,
} from "@/lib/image-compressor";
import { cn, getUserErrorMessage, showErrorToast, showSuccessToast } from "@/lib/utils";

const OUTPUT_FORMATS: { value: ImageCompressionOutputFormat; label: string }[] = [
  { value: "auto", label: "AUTO - WEBP, or PNG for WEBP inputs" },
  { value: "webp", label: "WEBP - Best Size Reduction" },
  { value: "jpg", label: "JPG - High Compatibility" },
  { value: "png", label: "PNG - Lossless Output" },
];

const MAX_DIMENSION_OPTIONS: { value: "original" | 480 | 720 | 1080 | 1440 | 1920 | 2560 | 3840; label: string }[] = [
  { value: "original", label: "Original" },
  { value: 480, label: "480 px" },
  { value: 720, label: "720 px" },
  { value: 1080, label: "1080 px" },
  { value: 1440, label: "1440 px" },
  { value: 1920, label: "1920 px" },
  { value: 2560, label: "2560 px" },
  { value: 3840, label: "3840 px" },
];

const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]);

type FileStatus = "pending" | "compressing" | "done" | "error";

type CompressionResult = {
  success: boolean;
  outputPath: string;
  inputBytes: number;
  outputBytes: number;
};

interface FileItem {
  id: string;
  fileId: string;
  name: string;
  ext: string;
  status: FileStatus;
  progress: number;
  outputPath?: string;
  inputBytes?: number;
  outputBytes?: number;
  error?: string;
}

function getExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function getReduction(inputBytes?: number, outputBytes?: number): string | null {
  if (!inputBytes || outputBytes === undefined) return null;
  const reduction = Math.round(((inputBytes - outputBytes) / inputBytes) * 100);
  return `${reduction}% ${reduction >= 0 ? "smaller" : "larger"}`;
}

export function ImageCompressorPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [preset, setPreset] = useState<ImageCompressionPresetId>("balanced");
  const [outputFormat, setOutputFormat] = useState<ImageCompressionOutputFormat>("auto");
  const [isCompressing, setIsCompressing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [customQuality, setCustomQuality] = useState(78);
  const [customMaxDimension, setCustomMaxDimension] = useState<"original" | 480 | 720 | 1080 | 1440 | 1920 | 2560 | 3840>("original");
  const { setIsProcessing } = useProcessing();

  const cancelledRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const completedRef = useRef(0);
  const totalRef = useRef(0);

  useEffect(() => {
    const remove = window.api.onProgress((p: number) => {
      const id = currentIdRef.current;
      if (!id) return;
      setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: p } : f));

      if (totalRef.current > 0) {
        const activeProgress = Math.max(0, Math.min(100, p)) / 100;
        setOverallProgress(Math.round(((completedRef.current + activeProgress) / totalRef.current) * 100));
      }
    });
    return () => remove();
  }, []);

  const buildItem = useCallback((fileRef: FileRef): FileItem | null => {
    const name = fileRef.name;
    const dotExt = "." + getExt(name);
    if (!ALLOWED_EXTS.has(dotExt)) return null;
    return {
      id: crypto.randomUUID(),
      fileId: fileRef.id,
      name,
      ext: getExt(name),
      status: "pending",
      progress: 0,
    };
  }, []);

  const addFiles = useCallback((refs: FileRef[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.fileId));
      const newItems = refs
        .filter(ref => !existing.has(ref.id))
        .map(buildItem)
        .filter((item): item is FileItem => item !== null);
      return [...prev, ...newItems];
    });
  }, [buildItem]);

  const handleAddClick = async () => {
    const refs = await window.api.openDocFiles("image");
    if (refs.length) addFiles(refs);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const refs: FileRef[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      refs.push(await window.api.registerDroppedFile(file));
    }
    addFiles(refs);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status === "pending" || f.status === "error"));
  };

  const setPresetById = (presetId: ImageCompressionPresetId) => {
    if (presetId === "tiny") setPreset("tiny");
    if (presetId === "small") setPreset("small");
    if (presetId === "balanced") setPreset("balanced");
    if (presetId === "high-quality") setPreset("high-quality");
  };

  const handleCompress = async () => {
    const queue = files.filter(f => f.status === "pending" || f.status === "error");
    if (!queue.length) return;

    const compressionOptions = showAdvancedControls ? {
      quality: customQuality,
      maxDimension: customMaxDimension === "original" ? undefined : customMaxDimension,
    } : undefined;
    const parsedOptions = imageCompressionOptionsSchema.safeParse(compressionOptions);
    if (!parsedOptions.success) {
      showErrorToast("Advanced options must use whole-number quality from 1 to 100 and a supported max dimension.");
      return;
    }

    cancelledRef.current = false;
    completedRef.current = 0;
    totalRef.current = queue.length;
    setIsProcessing(true);
    setIsCompressing(true);
    setOverallProgress(0);

    let doneCount = 0;

    for (const file of queue) {
      if (cancelledRef.current) break;

      currentIdRef.current = file.id;
      setFiles(prev => prev.map(f => f.id === file.id ? {
        ...f,
        status: "compressing",
        progress: 0,
        outputPath: undefined,
        inputBytes: undefined,
        outputBytes: undefined,
        error: undefined,
      } : f));

      try {
        const result: CompressionResult = await window.api.image.compress(file.fileId, preset, outputFormat, compressionOptions);
        if (!result.success) throw new Error("Image compression failed.");

        setFiles(prev => prev.map(f => f.id === file.id ? {
          ...f,
          status: "done",
          progress: 100,
          outputPath: result.outputPath,
          inputBytes: result.inputBytes,
          outputBytes: result.outputBytes,
        } : f));
        doneCount++;
      } catch (err) {
        if (cancelledRef.current) {
          setFiles(prev => prev.map(f => f.id === file.id ? {
            ...f,
            status: "pending",
            progress: 0,
            outputPath: undefined,
            inputBytes: undefined,
            outputBytes: undefined,
          } : f));
        } else {
          const msg = getUserErrorMessage(err, "Image compression failed.");
          setFiles(prev => prev.map(f => f.id === file.id ? {
            ...f,
            status: "error",
            error: msg,
          } : f));
        }
      }

      completedRef.current++;
      setOverallProgress(Math.round((completedRef.current / totalRef.current) * 100));
    }

    currentIdRef.current = null;
    completedRef.current = 0;
    totalRef.current = 0;
    setIsCompressing(false);
    setIsProcessing(false);

    if (!cancelledRef.current && doneCount > 0) {
      showSuccessToast(`${doneCount} file${doneCount !== 1 ? "s" : ""} compressed successfully.`);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    const activeId = currentIdRef.current;
    if (activeId) {
      setFiles(prev => prev.map(f => f.id === activeId ? { ...f, status: "pending", progress: 0 } : f));
    }
    window.api.cancelConvert();
  };

  const showInFolder = async (outputPath: string) => {
    try {
      await window.api.image.showInFolder(outputPath);
    } catch (err) {
      showErrorToast(err);
    }
  };

  const activePreset = IMAGE_COMPRESSION_PRESETS.find(item => item.id === preset) ?? IMAGE_COMPRESSION_PRESETS[2];
  const compressionOptions = showAdvancedControls ? {
    quality: customQuality,
    maxDimension: customMaxDimension === "original" ? undefined : customMaxDimension,
  } : undefined;
  const advancedValidation = imageCompressionOptionsSchema.safeParse(compressionOptions);
  const isEmpty = files.length === 0;
  const compressible = files.filter(f => f.status === "pending" || f.status === "error");
  const hasCompleted = files.some(f => f.status === "done");

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
            <Minimize2 className="h-10 w-10" />
            Image Compressor
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-base font-medium italic">
            Batch compress static PNG, JPG, WEBP, BMP, and TIFF images into smaller local files.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pt-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <FieldLabel icon={Settings2}>Compression Preset</FieldLabel>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {IMAGE_COMPRESSION_PRESETS.map((presetOption) => (
                  <button
                    key={presetOption.id}
                    type="button"
                    onClick={() => setPresetById(presetOption.id)}
                    disabled={isCompressing}
                    className={cn(
                      "group relative flex h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-black uppercase italic transition-colors",
                      preset === presetOption.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-transparent hover:border-primary/40",
                    )}
                  >
                    <span className="truncate">{presetOption.label}</span>
                    <span
                      className="relative inline-flex"
                      title={presetOption.tooltip}
                      aria-label={`${presetOption.label} preset details`}
                      tabIndex={0}
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-left text-[11px] font-medium normal-case not-italic leading-snug tracking-normal text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {presetOption.tooltip}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="ml-1 text-xs font-medium text-muted-foreground">
                {activePreset.description}
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel icon={FileOutput}>Target Export Format</FieldLabel>
              <Select value={outputFormat} onValueChange={(value) => setOutputFormat(value as ImageCompressionOutputFormat)} disabled={isCompressing}>
                <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                  {OUTPUT_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value} className="font-bold uppercase italic py-3 cursor-pointer">
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="ml-1 text-xs font-medium text-muted-foreground">
                Auto outputs WEBP, except WEBP inputs become PNG.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase italic tracking-tight">
                    Advanced Quality
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    Higher quality keeps more detail and usually creates larger files.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedControls((value) => !value)}
                disabled={isCompressing}
                className={cn(
                  "h-10 rounded-xl border px-4 text-xs font-black uppercase tracking-wider transition-colors",
                  showAdvancedControls
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {showAdvancedControls ? "Custom On" : "Use Preset"}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showAdvancedControls && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 grid gap-3 md:grid-cols-[1fr_5rem] md:items-center">
                    <label className="space-y-2">
                      <span className="flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                        <FieldLabel as="span" icon={Gauge} className="m-0 tracking-[0.18em]">Custom Quality</FieldLabel>
                        <span className="text-primary">{customQuality}</span>
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        step={1}
                        value={customQuality}
                        disabled={isCompressing}
                        onChange={(event) => setCustomQuality(Number(event.target.value))}
                        className="w-full accent-primary"
                      />
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={customQuality}
                      disabled={isCompressing}
                      onChange={(event) => setCustomQuality(Number(event.target.value))}
                      className="h-10 rounded-xl border border-border bg-background/60 px-3 text-center text-sm font-bold"
                    />
                    <label className="space-y-2 md:col-span-2">
                      <FieldLabel as="span" icon={Ruler} className="m-0 tracking-[0.18em]">Max Dimension</FieldLabel>
                      <Select
                        value={String(customMaxDimension)}
                        disabled={isCompressing}
                        onValueChange={(value) => {
                          setCustomMaxDimension(value === "original" ? "original" : Number(value) as 480 | 720 | 1080 | 1440 | 1920 | 2560 | 3840);
                        }}
                      >
                        <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                          {MAX_DIMENSION_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={String(option.value)} className="font-bold uppercase italic py-3 cursor-pointer">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  {!advancedValidation.success && (
                    <p className="mt-2 text-xs font-bold text-destructive">
                      Advanced options must use whole-number quality from 1 to 100 and a supported max dimension.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isEmpty ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={handleAddClick}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
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
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold tracking-tight">Click or drop images here</p>
                  <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    Accepts .png .jpg .jpeg .webp .bmp .tiff
                  </p>
                </div>
              </div>
            </motion.button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddClick}
                  disabled={isCompressing}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary transition-colors hover:text-primary/70 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add More
                </button>
                {hasCompleted && !isCompressing && (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Clear Completed
                  </button>
                )}
              </div>

              <div
                className={cn(
                  "max-h-80 space-y-2 overflow-y-auto pr-1",
                  isDragOver && "rounded-2xl ring-2 ring-primary/50",
                )}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <AnimatePresence initial={false}>
                  {files.map(file => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        "space-y-3 rounded-xl border px-4 py-3 transition-colors",
                        file.status === "done" && "border-green-500/30 bg-green-500/5",
                        file.status === "error" && "border-destructive/30 bg-destructive/5",
                        file.status === "compressing" && "border-primary/40 bg-primary/5",
                        file.status === "pending" && "border-border/50 bg-muted/20",
                      )}>
                        <div className="flex items-center gap-3">
                          <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
                            {file.name}
                          </span>
                          <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:block">
                            .{file.ext} to {outputFormat === "auto" ? "auto" : `.${outputFormat}`}
                          </span>
                          <span className="flex w-28 shrink-0 items-center justify-end">
                            {file.status === "pending" && (
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ready</span>
                            )}
                            {file.status === "compressing" && (
                              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {file.progress}%
                              </span>
                            )}
                            {file.status === "done" && (
                              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-500">
                                <CheckCircle className="h-3 w-3" />
                                Done
                              </span>
                            )}
                            {file.status === "error" && (
                              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive" title={file.error}>
                                <AlertCircle className="h-3 w-3" />
                                Error
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(file.id)}
                            disabled={isCompressing && file.status === "compressing"}
                            className="ml-1 shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-20"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {file.status === "done" && file.outputPath && (
                          <div className="grid gap-2 border-t border-border/40 pt-3 text-xs font-medium text-muted-foreground md:grid-cols-[1fr_auto]">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate" title={file.outputPath}>
                                {file.outputPath}
                              </p>
                              <p className="flex flex-wrap gap-x-3 gap-y-1">
                                {typeof file.inputBytes === "number" && (
                                  <span>Input {formatBytes(file.inputBytes)}</span>
                                )}
                                {typeof file.outputBytes === "number" && (
                                  <span>Output {formatBytes(file.outputBytes)}</span>
                                )}
                                {getReduction(file.inputBytes, file.outputBytes) && (
                                  <span>{getReduction(file.inputBytes, file.outputBytes)}</span>
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 gap-2 text-xs font-bold uppercase tracking-wider"
                              onClick={() => showInFolder(file.outputPath!)}
                            >
                              <FolderOpen className="h-4 w-4" />
                              Show
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          <AnimatePresence>
            {isCompressing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                  <span>Engine Active</span>
                  <span>{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-3 shadow-lg shadow-primary/10" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02]",
                isCompressing ? "flex-1" : "w-full",
              )}
              disabled={isCompressing || (!isEmpty && compressible.length === 0)}
              onClick={isEmpty ? handleAddClick : handleCompress}
            >
              {isCompressing ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Compressing...
                </div>
              ) : isEmpty ? (
                "Select Images"
              ) : compressible.length === 0 ? (
                "All Done"
              ) : (
                `Compress ${compressible.length} File${compressible.length !== 1 ? "s" : ""}`
              )}
            </Button>

            <AnimatePresence>
              {isCompressing && (
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
            Fast Local Engine - Powered by KitBox
          </p>
        </CardFooter>
      </Card>

    </motion.div>
  );
}
