import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  AlignLeft,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Loader2,
  FolderOpen,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SimpleToast } from "@/components/ui/simple-toast";
import { useDocumentFileState } from "@/hooks/useDocumentFileState";
import { useProcessing } from "@/context/useProcessing";
import { cn } from "@/lib/utils";

type OutputFormat = "text" | "html" | "docx" | "images";

const OUTPUT_OPTIONS: { id: OutputFormat; label: string; ext: string; icon: React.ElementType; hint?: string }[] = [
  { id: "text",   label: "Text",    ext: ".txt",  icon: AlignLeft  },
  { id: "html",   label: "HTML",    ext: ".html", icon: FileCode2  },
  { id: "docx",   label: "Word",    ext: ".docx", icon: FileText   },
  { id: "images", label: "Images",  ext: ".zip",  icon: ImageIcon, hint: "Pages → ZIP" },
];

const VALID_FORMATS = OUTPUT_OPTIONS.map((o) => o.id);

export function PdfConverterPage() {
  const [searchParams] = useSearchParams();
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(() => {
    const p = searchParams.get("to") as OutputFormat | null;
    return p && VALID_FORMATS.includes(p) ? p : "text";
  });
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const { setIsProcessing } = useProcessing();

  const { files, setFiles, isDragOver, toast, setToast, handlePickFiles, handleDragOver, handleDragLeave, handleDrop } =
    useDocumentFileState("pdf", false);

  const handleRun = async () => {
    if (files.length === 0) {
      setToast({ message: "Select a PDF file first.", type: "error" });
      return;
    }
    setStatus("processing");
    setIsProcessing(true);
    setOutputPath(null);
    try {
      let result: string;
      switch (outputFormat) {
        case "text":   result = await window.api.document.pdfToText(files[0].id);   break;
        case "html":   result = await window.api.document.pdfToHtml(files[0].id);   break;
        case "docx":   result = await window.api.document.pdfToDocx(files[0].id);   break;
        case "images": result = await window.api.document.pdfToImages(files[0].id); break;
      }
      setOutputPath(result);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setToast({ message: (err as Error)?.message || "Conversion failed.", type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const activeOpt = OUTPUT_OPTIONS.find((o) => o.id === outputFormat)!;
  const ActiveIcon = activeOpt.icon;
  const filename = files[0]?.name;
  const outputFilename = outputPath?.split(/[/\\]/).pop();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full bg-card/40 border-border/50 shadow-2xl backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/5 pb-6">
          <CardTitle className="flex items-center gap-3 text-4xl font-black tracking-tighter uppercase italic text-primary">
            <Layers className="h-9 w-9" />
            PDF Converter
          </CardTitle>
          <CardDescription className="text-base font-medium italic mt-1">
            Convert a PDF to plain text, HTML, Word, or a ZIP of page images.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8 pb-8 space-y-6">
          {/* Format selector */}
          <div className="flex gap-2">
            {OUTPUT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = outputFormat === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setOutputFormat(opt.id);
                    setOutputPath(null);
                    setStatus("idle");
                  }}
                  disabled={status === "processing"}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border transition-all duration-200 text-center",
                    isActive
                      ? "bg-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/10"
                      : "bg-card/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    status === "processing" && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider leading-tight">
                    {opt.label}
                  </span>
                  {opt.hint && (
                    <span className="text-[9px] text-muted-foreground leading-tight">{opt.hint}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer min-h-80 transition-all duration-200",
              isDragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/50 hover:border-primary/40 hover:bg-muted/10",
              files.length > 0 && !isDragOver && "border-primary/30 bg-primary/[0.03]",
              status === "processing" && "pointer-events-none opacity-60",
            )}
            onClick={status !== "processing" ? handlePickFiles : undefined}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {files.length === 0 ? (
              <>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <Layers className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-muted-foreground">Drop .pdf here</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">or click to browse</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="rounded-2xl bg-primary/10 p-4">
                  <Layers className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center px-6">
                  <p className="text-sm font-bold break-all line-clamp-2">{filename}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles([]);
                      setOutputPath(null);
                      setStatus("idle");
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Success state */}
          <AnimatePresence>
            {status === "success" && outputPath && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20"
              >
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-primary">Done!</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{outputFilename}</p>
                  <button
                    type="button"
                    onClick={() => window.api.document.showInFolder(outputPath)}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1.5"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Show in Folder
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Convert button */}
          <Button
            onClick={handleRun}
            disabled={files.length === 0 || status === "processing"}
            size="lg"
            className="w-full h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {status === "processing" ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                {outputFormat === "images" ? "Rendering pages..." : "Converting..."}
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <ActiveIcon className="h-6 w-6" />
                PDF → {activeOpt.label}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {toast && <SimpleToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </motion.div>
  );
}
