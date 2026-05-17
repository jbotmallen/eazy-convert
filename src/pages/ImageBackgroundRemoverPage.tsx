import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircle,
  Brush,
  CheckCircle,
  Eraser,
  FileImage,
  FileOutput,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessing } from "@/context/useProcessing";
import { formatBytes } from "@/lib/image-compressor";
import { cn, getUserErrorMessage, showErrorToast, showSuccessToast } from "@/lib/utils";

const OUTPUT_FORMATS: { value: BackgroundOutputFormat; label: string }[] = [
  { value: "png", label: "PNG - Transparent Quality" },
  { value: "webp", label: "WEBP - Smaller Transparent File" },
];

const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]);

type BackgroundOutputFormat = "png" | "webp";
type FileStatus = "pending" | "removing" | "done" | "error";
type BrushMode = "remove" | "restore";
type BrushShape = "circle" | "square";

type BackgroundRemovalResult = {
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

type EditorState = {
  fileId: string;
  outputPath: string;
  outputFormat: BackgroundOutputFormat;
  fileName: string;
  originalDataUrl: string;
  cutoutDataUrl: string;
} | null;

function getExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function ImageBackgroundRemoverPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [outputFormat, setOutputFormat] = useState<BackgroundOutputFormat>("png");
  const [isRemoving, setIsRemoving] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
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

  const handleRemoveBackground = async () => {
    const queue = files.filter(f => f.status === "pending" || f.status === "error");
    if (!queue.length) return;

    cancelledRef.current = false;
    completedRef.current = 0;
    totalRef.current = queue.length;
    setIsProcessing(true);
    setIsRemoving(true);
    setOverallProgress(0);

    let doneCount = 0;

    for (const file of queue) {
      if (cancelledRef.current) break;

      currentIdRef.current = file.id;
      setFiles(prev => prev.map(f => f.id === file.id ? {
        ...f,
        status: "removing",
        progress: 0,
        outputPath: undefined,
        inputBytes: undefined,
        outputBytes: undefined,
        error: undefined,
      } : f));

      try {
        const result: BackgroundRemovalResult = await window.api.image.removeBackground(file.fileId, { outputFormat });
        if (!result.success) throw new Error("Background removal failed.");

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
          const msg = getUserErrorMessage(err, "Background removal failed.");
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
    setIsRemoving(false);
    setIsProcessing(false);

    if (!cancelledRef.current && doneCount > 0) {
      showSuccessToast(`${doneCount} file${doneCount !== 1 ? "s" : ""} processed successfully.`);
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

  const openEditor = async (file: FileItem) => {
    if (!file.outputPath) return;
    setIsLoadingEditor(true);
    try {
      const sources = await window.api.image.getBackgroundEditSources(file.fileId, file.outputPath);
      setEditor({
        fileId: file.fileId,
        fileName: file.name,
        outputPath: file.outputPath,
        outputFormat: file.outputPath.toLowerCase().endsWith(".webp") ? "webp" : "png",
        ...sources,
      });
    } catch (err) {
      showErrorToast(err, "Could not load image editor.");
    } finally {
      setIsLoadingEditor(false);
    }
  };

  const handleEditorSaved = (fileId: string, originalOutputPath: string, savedPath: string, outputBytes: number) => {
    setFiles(prev => prev.map(file => (
      file.fileId === fileId && file.outputPath === originalOutputPath
        ? { ...file, outputPath: savedPath, outputBytes }
        : file
    )));
    showSuccessToast("Edited image saved successfully.");
  };

  const isEmpty = files.length === 0;
  const removable = files.filter(f => f.status === "pending" || f.status === "error");
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
            <Eraser className="h-10 w-10" />
            Background Remover
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-base font-medium italic">
            Batch remove image backgrounds locally and export transparent PNG or WEBP files.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pt-10">
          <div className="space-y-2">
            <FieldLabel icon={FileOutput}>Transparent Export Format</FieldLabel>
            <Select value={outputFormat} onValueChange={(value) => setOutputFormat(value as BackgroundOutputFormat)} disabled={isRemoving}>
              <SelectTrigger className="h-14 border-2 bg-transparent text-lg font-bold uppercase italic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-2 bg-card/90 backdrop-blur-xl">
                {OUTPUT_FORMATS.map(format => (
                  <SelectItem key={format.value} value={format.value} className="cursor-pointer py-3 font-bold uppercase italic">
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="ml-1 text-xs font-medium text-muted-foreground">
              PNG keeps maximum compatibility. WEBP usually makes smaller transparent files.
            </p>
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
                  disabled={isRemoving}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary transition-colors hover:text-primary/70 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add More
                </button>
                {hasCompleted && !isRemoving && (
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
                        file.status === "removing" && "border-primary/40 bg-primary/5",
                        file.status === "pending" && "border-border/50 bg-muted/20",
                      )}>
                        <div className="flex items-center gap-3">
                          <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
                            {file.name}
                          </span>
                          <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:block">
                            .{file.ext} to .{outputFormat}
                          </span>
                          <span className="flex w-28 shrink-0 items-center justify-end">
                            {file.status === "pending" && (
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ready</span>
                            )}
                            {file.status === "removing" && (
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
                            disabled={isRemoving && file.status === "removing"}
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
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2 text-xs font-bold uppercase tracking-wider"
                                disabled={isLoadingEditor}
                                onClick={() => openEditor(file)}
                              >
                                {isLoadingEditor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                Edit
                              </Button>
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
            {isRemoving && (
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
                isRemoving ? "flex-1" : "w-full",
              )}
              disabled={isRemoving || (!isEmpty && removable.length === 0)}
              onClick={isEmpty ? handleAddClick : handleRemoveBackground}
            >
              {isRemoving ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Removing...
                </div>
              ) : isEmpty ? (
                "Select Images"
              ) : removable.length === 0 ? (
                "All Done"
              ) : (
                `Remove ${removable.length} Background${removable.length !== 1 ? "s" : ""}`
              )}
            </Button>

            <AnimatePresence>
              {isRemoving && (
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

      {editor && (
        <BackgroundEditModal
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={handleEditorSaved}
        />
      )}
    </motion.div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function applyBrushToImageData(
  target: ImageData,
  source: ImageData,
  centerX: number,
  centerY: number,
  size: number,
  shape: BrushShape,
  mode: BrushMode,
) {
  const radius = Math.max(1, Math.round(size / 2));
  const startX = clamp(Math.floor(centerX - radius), 0, target.width - 1);
  const endX = clamp(Math.ceil(centerX + radius), 0, target.width - 1);
  const startY = clamp(Math.floor(centerY - radius), 0, target.height - 1);
  const endY = clamp(Math.ceil(centerY + radius), 0, target.height - 1);
  const radiusSq = radius * radius;

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (shape === "circle") {
        const dx = x - centerX;
        const dy = y - centerY;
        if ((dx * dx) + (dy * dy) > radiusSq) continue;
      }

      const index = (y * target.width + x) * 4;
      if (mode === "remove") {
        target.data[index + 3] = 0;
      } else {
        target.data[index] = source.data[index];
        target.data[index + 1] = source.data[index + 1];
        target.data[index + 2] = source.data[index + 2];
        target.data[index + 3] = 255;
      }
    }
  }
}

interface BackgroundEditModalProps {
  editor: NonNullable<EditorState>;
  onClose: () => void;
  onSaved: (fileId: string, originalOutputPath: string, savedPath: string, outputBytes: number) => void;
}

function BackgroundEditModal({ editor, onClose, onSaved }: BackgroundEditModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const currentImageDataRef = useRef<ImageData | null>(null);
  const isDrawingRef = useRef(false);
  const [mode, setMode] = useState<BrushMode>("restore");
  const [brushSize, setBrushSize] = useState(36);
  const [brushShape, setBrushShape] = useState<BrushShape>("circle");
  const [cursor, setCursor] = useState<{ x: number; y: number; size: number; visible: boolean }>({
    x: 0,
    y: 0,
    size: 0,
    visible: false,
  });
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCursor = useCallback((clientX: number, clientY: number, visible = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    setCursor({
      x: clientX - rect.left,
      y: clientY - rect.top,
      size: Math.max(4, brushSize * scale),
      visible,
    });
  }, [brushSize]);

  const paintAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const originalImageData = originalImageDataRef.current;
    const currentImageData = currentImageDataRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !originalImageData || !currentImageData) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    applyBrushToImageData(currentImageData, originalImageData, x, y, brushSize, brushShape, mode);
    context.putImageData(currentImageData, 0, 0);
  }, [brushShape, brushSize, mode]);

  useEffect(() => {
    let cancelled = false;

    async function prepareCanvas() {
      try {
        setIsReady(false);
        setError(null);
        const [originalImage, cutoutImage] = await Promise.all([
          loadImage(editor.originalDataUrl),
          loadImage(editor.cutoutDataUrl),
        ]);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !context) throw new Error("Canvas could not be initialized.");

        canvas.width = cutoutImage.naturalWidth;
        canvas.height = cutoutImage.naturalHeight;

        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = cutoutImage.naturalWidth;
        sourceCanvas.height = cutoutImage.naturalHeight;
        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
        if (!sourceContext) throw new Error("Canvas could not be initialized.");

        sourceContext.drawImage(originalImage, 0, 0, sourceCanvas.width, sourceCanvas.height);
        originalImageDataRef.current = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(cutoutImage, 0, 0, canvas.width, canvas.height);
        currentImageDataRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
        setIsReady(true);
      } catch (err) {
        if (!cancelled) setError(getUserErrorMessage(err, "Could not load image editor."));
      }
    }

    void prepareCanvas();
    return () => {
      cancelled = true;
    };
  }, [editor.cutoutDataUrl, editor.originalDataUrl]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isReady || isSaving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    updateCursor(event.clientX, event.clientY);
    paintAt(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateCursor(event.clientX, event.clientY);
    if (!isDrawingRef.current || !isReady || isSaving) return;
    paintAt(event.clientX, event.clientY);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    setError(null);
    try {
      const mimeType = editor.outputFormat === "webp" ? "image/webp" : "image/png";
      const result = await window.api.image.saveBackgroundEdit(editor.outputPath, canvas.toDataURL(mimeType, 0.92));
      if (!result.success) throw new Error("Could not save edited image.");
      onSaved(editor.fileId, editor.outputPath, result.outputPath, result.outputBytes);
      onClose();
    } catch (err) {
      setError(getUserErrorMessage(err, "Could not save edited image."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black uppercase italic tracking-tight">Refine Background Cutout</h2>
            <p className="truncate text-xs font-medium text-muted-foreground">{editor.fileName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-5 border-b border-border p-4 lg:border-b-0 lg:border-r">
            <Tabs value={mode} onValueChange={(value) => setMode(value as BrushMode)}>
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-full p-1">
                <TabsTrigger value="restore" className="rounded-full text-xs font-black uppercase">
                  <Brush className="h-4 w-4" />
                  Restore
                </TabsTrigger>
                <TabsTrigger value="remove" className="rounded-full text-xs font-black uppercase">
                  <Eraser className="h-4 w-4" />
                  Remove
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2">
              <FieldLabel icon={Brush} className="m-0">Brush Size</FieldLabel>
              <input
                type="range"
                min={4}
                max={120}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-full accent-primary"
              />
              <div className="text-xs font-bold text-muted-foreground">{brushSize}px</div>
            </div>

            <div className="space-y-2">
              <FieldLabel icon={Brush} className="m-0">Brush Shape</FieldLabel>
              <Select value={brushShape} onValueChange={(value) => setBrushShape(value as BrushShape)}>
                <SelectTrigger className="h-11 border-2 bg-transparent font-bold uppercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 bg-card/95 backdrop-blur-xl">
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-bold text-destructive">
                {error}
              </div>
            )}
          </aside>

          <div
            className="relative min-h-0 overflow-auto p-5"
            style={{
              backgroundImage: [
                "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%)",
                "linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%)",
                "linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%)",
                "linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)",
              ].join(","),
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
              backgroundSize: "24px 24px",
            }}
          >
            {!isReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <div className="relative mx-auto w-fit">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerEnter={(event) => updateCursor(event.clientX, event.clientY)}
                onPointerUp={stopDrawing}
                onPointerCancel={() => {
                  stopDrawing();
                  setCursor(prev => ({ ...prev, visible: false }));
                }}
                onPointerLeave={() => {
                  stopDrawing();
                  setCursor(prev => ({ ...prev, visible: false }));
                }}
                className="block max-h-[62vh] max-w-full cursor-none touch-none rounded-md border border-border bg-transparent shadow-2xl"
              />
              {cursor.visible && isReady && !isSaving && (
                <div
                  className={cn(
                    "pointer-events-none absolute border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]",
                    mode === "remove" ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10",
                    brushShape === "circle" ? "rounded-full" : "rounded-sm",
                  )}
                  style={{
                    width: cursor.size,
                    height: cursor.size,
                    left: cursor.x - (cursor.size / 2),
                    top: cursor.y - (cursor.size / 2),
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" className="gap-2 font-black uppercase" onClick={handleSave} disabled={!isReady || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Edit
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
