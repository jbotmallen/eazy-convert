import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileCode2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SimpleToast } from "@/components/ui/simple-toast";
import { FileList } from "@/pages/document-converter/FileList";
import { SuccessMessage } from "@/pages/document-converter/SuccessMessage";
import { useDocumentFileState } from "@/hooks/useDocumentFileState";
import { useProcessing } from "@/context/useProcessing";
import { cn } from "@/lib/utils";
import type { Operation } from "@/pages/document-converter/constants";

type ConvertOp = "docx-to-html" | "docx-to-text";

interface ConvertOption {
  id: ConvertOp;
  label: string;
  description: string;
  icon: React.ElementType;
  fileType: "docx";
  inputLabel: string;
  hint: string;
  outputLabel: string;
}

const CONVERT_OPTIONS: ConvertOption[] = [
  {
    id: "docx-to-html",
    label: "DOCX → HTML",
    description: "Convert a Word document to a web-ready HTML file.",
    icon: FileCode2,
    fileType: "docx",
    inputLabel: "Word Document (.docx)",
    hint: "Drop a .docx file here, or click to browse",
    outputLabel: "HTML File",
  },
  {
    id: "docx-to-text",
    label: "DOCX → Text",
    description: "Extract plain text content from a Word document.",
    icon: FileText,
    fileType: "docx",
    inputLabel: "Word Document (.docx)",
    hint: "Drop a .docx file here, or click to browse",
    outputLabel: "Text File",
  },
];

function buildOp(opt: ConvertOption): Operation {
  return {
    id: opt.id as Operation["id"],
    label: opt.label,
    description: opt.description,
    icon: opt.icon,
    inputLabel: opt.inputLabel,
    hint: opt.hint,
    multi: false,
    fileType: opt.fileType,
    outputLabel: opt.outputLabel,
  };
}

export function DocConverterPage() {
  const [searchParams] = useSearchParams();
  const [activeId, setActiveId] = useState<ConvertOp>(() => {
    const param = searchParams.get("op") as ConvertOp | null;
    return CONVERT_OPTIONS.some((o) => o.id === param) ? param! : "docx-to-html";
  });
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const { setIsProcessing } = useProcessing();

  const activeOpt = CONVERT_OPTIONS.find((o) => o.id === activeId)!;
  const op = buildOp(activeOpt);

  const { files, setFiles, isDragOver, toast, setToast, handlePickFiles, handleDragOver, handleDragLeave, handleDrop, removeFile, clearFiles } =
    useDocumentFileState(activeOpt.fileType, false);

  // Sync URL param → selected op (e.g. when navigating from navbar)
  useEffect(() => {
    const param = searchParams.get("op") as ConvertOp | null;
    if (param && CONVERT_OPTIONS.some((o) => o.id === param)) {
      setActiveId(param);
      clearFiles();
      setOutputPath(null);
      setStatus("idle");
    }
  }, [searchParams, clearFiles]);

  const handleOpChange = (id: ConvertOp) => {
    setActiveId(id);
    clearFiles();
    setOutputPath(null);
    setStatus("idle");
  };

  const handleRun = async () => {
    if (files.length === 0) {
      setToast({ message: "Select a file first.", type: "error" });
      return;
    }
    setStatus("processing");
    setIsProcessing(true);
    setOutputPath(null);
    try {
      let result: string;
      switch (activeId) {
        case "docx-to-html":
          result = await window.api.document.docxToHtml(files[0].id);
          break;
        case "docx-to-text":
          result = await window.api.document.docxToText(files[0].id);
          break;
      }
      setOutputPath(result);
      setStatus("success");
      setToast({ message: "Done! Saved next to your source file.", type: "success" });
    } catch (err: unknown) {
      setStatus("error");
      setToast({ message: (err as Error)?.message || "Conversion failed.", type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const ActiveIcon = activeOpt.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full bg-card/40 border-border/50 shadow-2xl backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/5 pb-6">
          <CardTitle className="flex items-center gap-3 text-4xl font-black tracking-tighter uppercase italic text-primary">
            <FileCode2 className="h-9 w-9" />
            Document Converter
          </CardTitle>
          <CardDescription className="text-base font-medium italic mt-1">
            Convert between Word, HTML, and plain text formats.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8 pb-8 space-y-6">
          {/* Operation selector */}
          <div className="flex gap-2">
            {CONVERT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = activeId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleOpChange(opt.id)}
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
                </button>
              );
            })}
          </div>

          {/* File input — remount when op type changes so state resets */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <FileList
                op={op}
                files={files}
                status={status}
                isDragOver={isDragOver}
                onPickFiles={handlePickFiles}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onMoveFile={() => {}}
                onRemoveFile={removeFile}
                onRemoveAll={() => setFiles([])}
              />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {status === "success" && outputPath && (
              <SuccessMessage
                outputLabel={activeOpt.outputLabel}
                outputPath={outputPath}
                onShowInFolder={(p) => window.api.document.showInFolder(p)}
              />
            )}
          </AnimatePresence>

          <Button
            onClick={handleRun}
            disabled={files.length === 0 || status === "processing"}
            size="lg"
            className="w-full h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {status === "processing" ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                Converting...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <ActiveIcon className="h-6 w-6" />
                {activeOpt.label}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {toast && <SimpleToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </motion.div>
  );
}
