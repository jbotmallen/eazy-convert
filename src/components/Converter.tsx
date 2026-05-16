import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileVideo, FileImage, FileAudio, CheckCircle, Loader2, Video, Music, Image as ImageIcon, FolderOpen, FileOutput, Gauge } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn, getFileName, getUserErrorMessage, showErrorToast, showSuccessToast } from "@/lib/utils";
import { fileSchema, type FileValues } from "@/lib/validation";
import { useProcessing } from "@/context/useProcessing";

const QUALITY_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "2160", label: "4K — 2160p" },
  { value: "1440", label: "1440p" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
  { value: "360", label: "360p" },
];

interface FormatOption {
  value: string;
  label: string;
}

interface ConverterProps {
  mode: "images" | "videos" | "audio";
  title: string;
  description: string;
  allowedExtensions: string[];
  outputFormats: FormatOption[];
}

interface ExtendedFile extends File {
  fileId?: string;
  path?: string;
}

export function Converter({ mode, title, description, allowedExtensions, outputFormats }: ConverterProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "converting" | "success" | "error">("idle");
  const [quality, setQuality] = useState("original");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const { setIsProcessing } = useProcessing();
  const cancelledRef = useRef(false);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FileValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: {
      format: "",
    },
  });

  const selectedFile = watch("file") as ExtendedFile | undefined;

  // Real-time progress tracking
  useEffect(() => {
    const removeListener = window.api.onProgress((p: number) => {
      setProgress(p);
    });
    return () => removeListener();
  }, []);

  // Get current file extension to filter out the same format in output
  const selectedFileExt = useMemo(() => {
    if (!selectedFile) return null;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'jpeg') return 'jpg'; // Normalize jpeg to jpg for comparison
    return ext;
  }, [selectedFile]);

  // Filter formats to exclude the input format
  const availableFormats = useMemo(() => {
    return outputFormats.filter(fmt => fmt.value !== selectedFileExt);
  }, [outputFormats, selectedFileExt]);

  const handleFileSelect = async () => {
    const fileRef = await window.api.openFile();
    if (fileRef) {
      const fileName = fileRef.name;
      const dummyFile = new File([new Blob([], { type: "application/octet-stream" })], fileName) as ExtendedFile;

      dummyFile.fileId = fileRef.id;

      setValue("file", dummyFile as File, { shouldValidate: true });

      // Auto-set the first available format
      const ext = fileName.split('.').pop()?.toLowerCase();
      const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
      const firstAvailable = outputFormats.find(f => f.value !== normalizedExt);
      if (firstAvailable) {
        setValue("format", firstAvailable.value, { shouldValidate: true });
      }

      setStatus("idle");
      setProgress(0);
      setOutputPath(null);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    window.api.cancelConvert();
  };

  const showInFolder = async (filePath: string) => {
    try {
      if (mode === "videos") {
        await window.api.video.showInFolder(filePath);
        return;
      }
      if (mode === "audio") {
        await window.api.audio.showInFolder(filePath);
        return;
      }
      await window.api.image.showInFolder(filePath);
    } catch (error) {
      showErrorToast(error);
    }
  };

  const onSubmit = async (data: FileValues) => {
    const file = data.file as ExtendedFile;
    const inputId = file.fileId || file.path;

    if (!inputId) {
      showErrorToast("Invalid file path. Please select a file.");
      return;
    }

    cancelledRef.current = false;
    setIsProcessing(true);
    setStatus("converting");
    setProgress(0);
    setOutputPath(null);

    try {
      const finalPath = await window.api.convert(inputId, data.format, mode === "videos" ? quality : undefined);
      setOutputPath(finalPath);
      setStatus("success");
      showSuccessToast(`Converted to ${getFileName(finalPath)}`);
      reset();
    } catch (error: unknown) {
      if (cancelledRef.current) {
        setStatus("idle");
        setProgress(0);
      } else {
        const errorMessage = getUserErrorMessage(error, "Conversion failed.");
        setStatus("error");
        showErrorToast(errorMessage);
        setProgress(0);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getIcon = () => {
    if (selectedFile) {
      if (mode === "videos") return <FileVideo className="h-12 w-12 text-primary" />;
      if (mode === "audio") return <FileAudio className="h-12 w-12 text-primary" />;
      return <FileImage className="h-12 w-12 text-primary" />;
    }
    if (mode === "videos") return <Video className="h-12 w-12 text-muted-foreground" />;
    if (mode === "audio") return <Music className="h-12 w-12 text-muted-foreground" />;
    return <ImageIcon className="h-12 w-12 text-muted-foreground" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full border-border bg-card/40 shadow-2xl backdrop-blur-md overflow-hidden font-sans">
        <CardHeader className="text-center pb-8 border-b border-border/50 bg-muted/5">
          <CardTitle className="text-4xl font-black tracking-tighter uppercase italic text-primary">
            {title}
          </CardTitle>
          <CardDescription className="text-base font-medium max-w-md mx-auto italic">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">

            <motion.button
              whileHover={status !== "converting" ? { scale: 1.01 } : {}}
              whileTap={status !== "converting" ? { scale: 0.99 } : {}}
              type="button"
              onClick={status !== "converting" ? handleFileSelect : undefined}
              className={cn(
                "group relative w-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300",
                selectedFile
                  ? "border-primary/50 bg-primary/5 shadow-inner"
                  : "border-border hover:border-primary/40 hover:bg-muted/30",
                errors.file ? "border-destructive/50 bg-destructive/5" : "",
                status === "converting" ? "opacity-50 cursor-not-allowed" : "",
              )}
            >
              <div className="flex flex-col items-center gap-6">
                <motion.div
                  animate={selectedFile ? { scale: [1, 1.1, 1] } : {}}
                  className="rounded-2xl bg-primary/10 p-5 shadow-lg shadow-primary/5"
                >
                  {getIcon()}
                </motion.div>

                <div className="space-y-2">
                  <p className="text-xl font-bold tracking-tight">
                    {selectedFile ? selectedFile.name : `Click to select ${mode}`}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    {selectedFile ? "File Ready" : `Input: ${allowedExtensions.join(" ")}`}
                  </p>
                </div>
              </div>
            </motion.button>

            {errors.file && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-sm font-bold text-destructive text-center uppercase tracking-tighter">
                {errors.file.message as string}
              </motion.p>
            )}

            <div className="space-y-4">
              <div className={cn(mode === "videos" ? "grid grid-cols-2 gap-4" : "")}>
                <div className="space-y-2">
                  <FieldLabel icon={FileOutput}>Target Export Format</FieldLabel>
                  <Select
                    disabled={status === "converting" || !selectedFile}
                    onValueChange={(value) => setValue("format", value, { shouldValidate: true })}
                    value={watch("format")}
                  >
                    <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                      <SelectValue placeholder={selectedFile ? "Choose Format..." : "Select a file first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                      {availableFormats.map(fmt => (
                        <SelectItem key={fmt.value} value={fmt.value} className="font-bold uppercase italic py-3 cursor-pointer">
                          {fmt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mode === "videos" && (
                  <div className="space-y-2">
                    <FieldLabel icon={Gauge}>Output Quality</FieldLabel>
                    <Select
                      value={quality}
                      onValueChange={setQuality}
                      disabled={status === "converting" || !selectedFile}
                    >
                      <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                        {QUALITY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="font-bold uppercase italic py-3 cursor-pointer">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {errors.format && (
                <p className="text-sm font-bold text-destructive text-center uppercase tracking-tighter">{errors.format.message as string}</p>
              )}
            </div>

            <AnimatePresence>
              {status === "success" && outputPath && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground" title={outputPath}>
                      {outputPath}
                    </p>
                    <button
                      type="button"
                      onClick={() => showInFolder(outputPath)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-green-500/30 px-2.5 text-[11px] font-bold text-green-600 transition-colors hover:bg-green-500/10"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Open
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {status === "converting" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden"
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
                type="submit"
                size="lg"
                className={cn(
                  "h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02]",
                  status === "converting" ? "flex-1" : "w-full",
                )}
                disabled={status === "converting" || !selectedFile}
              >
                {status === "converting" ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  "Execute Conversion"
                )}
              </Button>

              <AnimatePresence>
                {status === "converting" && (
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
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/50 bg-muted/10 py-8">
          <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            <CheckCircle className="h-4 w-4 text-primary" />
            Fast Local Engine — Powered by KitBox
          </p>
        </CardFooter>
      </Card>

    </motion.div>
  );
}
