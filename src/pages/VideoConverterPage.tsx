import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileVideo,
  Video,
  Plus,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
  Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
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
import { SimpleToast } from "@/components/ui/simple-toast";
import { cn } from "@/lib/utils";
import { useProcessing } from "@/context/useProcessing";

const FORMATS = [
  { value: "mp4",  label: "MP4 — Universal Standard" },
  { value: "webm", label: "WEBM — VP9 Next-Gen" },
  { value: "avi",  label: "AVI — Legacy Compatibility" },
  { value: "mov",  label: "MOV — Apple QuickTime" },
  { value: "mkv",  label: "MKV — Matroska Container" },
];

const QUALITY_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "2160",     label: "4K — 2160p" },
  { value: "1440",     label: "1440p" },
  { value: "1080",     label: "1080p" },
  { value: "720",      label: "720p" },
  { value: "480",      label: "480p" },
  { value: "360",      label: "360p" },
];

const ALLOWED_EXTS = new Set([".mp4", ".webm", ".avi", ".mov", ".mkv"]);

type FileStatus = "pending" | "converting" | "done" | "skipped" | "error";

interface FileItem {
  id: string;
  fileId: string;
  name: string;
  ext: string;
  status: FileStatus;
  progress: number;
  error?: string;
}

function getExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function VideoConverterPage() {
  const [files, setFiles]               = useState<FileItem[]>([]);
  const [format, setFormat]             = useState("mp4");
  const [quality, setQuality]           = useState("original");
  const [isConverting, setIsConverting] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [toast, setToast]               = useState<{ message: string; type: "success" | "error" } | null>(null);
  const { setIsProcessing }             = useProcessing();

  const cancelledRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const remove = window.api.onProgress((p: number) => {
      const id = currentIdRef.current;
      if (!id) return;
      setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: p } : f));
    });
    return () => remove();
  }, []);

  const buildItem = useCallback((fileRef: FileRef): FileItem | null => {
    const name = fileRef.name;
    const dotExt = "." + (name.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_EXTS.has(dotExt)) return null;
    return { id: crypto.randomUUID(), fileId: fileRef.id, name, ext: getExt(name), status: "pending", progress: 0 };
  }, []);

  const addFiles = useCallback((refs: FileRef[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.fileId));
      const newItems = refs.filter(p => !existing.has(p.id)).map(buildItem).filter((x): x is FileItem => x !== null);
      return [...prev, ...newItems];
    });
  }, [buildItem]);

  const handleAddClick = async () => {
    const refs = await window.api.openDocFiles("video");
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

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const clearCompleted = () => setFiles(prev => prev.filter(f => f.status === "pending" || f.status === "error"));

  const handleConvert = async () => {
    const queue = files.filter(f => f.status === "pending" || f.status === "error");
    if (!queue.length) return;

    cancelledRef.current = false;
    setIsProcessing(true);
    setIsConverting(true);
    setOverallProgress(0);

    let completed = 0;
    let doneCount = 0;
    const total = queue.length;

    for (const file of queue) {
      if (cancelledRef.current) break;

      if (file.ext === format) {
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "skipped" } : f));
        completed++;
        setOverallProgress(Math.round((completed / total) * 100));
        continue;
      }

      currentIdRef.current = file.id;
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "converting", progress: 0 } : f));

      try {
        await window.api.convert(file.fileId, format, quality);
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "done", progress: 100 } : f));
        doneCount++;
      } catch (err) {
        if (cancelledRef.current) {
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "pending", progress: 0 } : f));
        } else {
          const msg = err instanceof Error ? err.message : "Conversion failed.";
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "error", error: msg } : f));
        }
      }

      completed++;
      setOverallProgress(Math.round((completed / total) * 100));
    }

    currentIdRef.current = null;
    setIsConverting(false);
    setIsProcessing(false);

    if (!cancelledRef.current && doneCount > 0) {
      setToast({ message: `${doneCount} file${doneCount !== 1 ? "s" : ""} converted successfully.`, type: "success" });
    }
  };

  const handleCancel = () => { cancelledRef.current = true; window.api.cancelConvert(); };

  const isEmpty     = files.length === 0;
  const convertible = files.filter(f => f.status === "pending" || f.status === "error");
  const hasCompleted = files.some(f => f.status === "done" || f.status === "skipped");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full border-border bg-card/40 shadow-2xl backdrop-blur-md overflow-hidden font-sans">
        <CardHeader className="text-center pb-8 border-b border-border/50 bg-muted/5">
          <CardTitle className="text-4xl font-black tracking-tighter uppercase italic text-primary flex items-center justify-center gap-3">
            <Video className="h-10 w-10" />
            Video Pro
          </CardTitle>
          <CardDescription className="text-base font-medium max-w-md mx-auto italic">
            Batch convert MP4, WebM, AVI, MOV, and MKV with high-performance multi-threading.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-10 space-y-8">
          {/* Format + Quality selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                Target Format
              </label>
              <Select value={format} onValueChange={setFormat} disabled={isConverting}>
                <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                  {FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value} className="font-bold uppercase italic py-3 cursor-pointer">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                Output Quality
              </label>
              <Select value={quality} onValueChange={setQuality} disabled={isConverting}>
                <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                  {QUALITY_OPTIONS.map(q => (
                    <SelectItem key={q.value} value={q.value} className="font-bold uppercase italic py-3 cursor-pointer">
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Empty drop zone */}
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
                "w-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300",
                isDragOver
                  ? "border-primary/70 bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="rounded-2xl bg-primary/10 p-5 shadow-lg shadow-primary/5">
                  <Video className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold tracking-tight">Click or drop videos here</p>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    Accepts .mp4  .webm  .avi  .mov  .mkv
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
                  disabled={isConverting}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary hover:text-primary/70 disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add More
                </button>
                {hasCompleted && !isConverting && (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear Completed
                  </button>
                )}
              </div>

              <div
                className={cn(
                  "space-y-2 overflow-y-auto pr-1 max-h-72",
                  isDragOver && "ring-2 ring-primary/50 rounded-2xl",
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
                        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
                        file.status === "done"       && "border-green-500/30 bg-green-500/5",
                        file.status === "error"      && "border-destructive/30 bg-destructive/5",
                        file.status === "converting" && "border-primary/40 bg-primary/5",
                        file.status === "skipped"    && "border-border/30 bg-muted/10",
                        file.status === "pending"    && "border-border/50 bg-muted/20",
                      )}>
                        <FileVideo className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium truncate min-w-0" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex-shrink-0 hidden sm:block">
                          .{file.ext} → .{format}
                        </span>
                        <span className="flex-shrink-0 w-28 flex justify-end items-center">
                          {file.status === "pending" && (
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ready</span>
                          )}
                          {file.status === "converting" && (
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
                          {file.status === "skipped" && (
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground" title="Same format — skipped">
                              <Minus className="h-3 w-3" />
                              Skipped
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
                          disabled={isConverting && file.status === "converting"}
                          className="flex-shrink-0 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 transition-colors ml-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Overall progress bar */}
          <AnimatePresence>
            {isConverting && (
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

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02]",
                isConverting ? "flex-1" : "w-full",
              )}
              disabled={isConverting || (!isEmpty && convertible.length === 0)}
              onClick={isEmpty ? handleAddClick : handleConvert}
            >
              {isConverting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Converting...
                </div>
              ) : isEmpty ? (
                "Select Videos"
              ) : convertible.length === 0 ? (
                "All Done"
              ) : (
                `Convert ${convertible.length} File${convertible.length !== 1 ? "s" : ""}`
              )}
            </Button>

            <AnimatePresence>
              {isConverting && (
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
            Fast Local Engine — Powered by EazyConvert
          </p>
        </CardFooter>
      </Card>

      {toast && <SimpleToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </motion.div>
  );
}
