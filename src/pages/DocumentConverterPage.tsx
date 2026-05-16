import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileStack, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProcessing } from "@/context/useProcessing";

import type { OperationId, Status } from "./document-converter/types";
import { OPERATIONS, ALLOWED_EXTS, type Operation } from "./document-converter/constants";
import { OperationSelector } from "./document-converter/OperationSelector";
import { FileList } from "./document-converter/FileList";
import { PageRangeSelector } from "./document-converter/PageRangeSelector";
import { SuccessMessage } from "./document-converter/SuccessMessage";
import { showErrorToast, showSuccessToast } from "@/lib/utils";

export function DocumentConverterPage() {
  const [activeOp, setActiveOp] = useState<OperationId>("merge");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [fromPage, setFromPage] = useState("1");
  const [toPage, setToPage] = useState("1");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { setIsProcessing } = useProcessing();

  const op = OPERATIONS.find((o: { id: string; }) => o.id === activeOp)!;

  const resetState = useCallback((keepFiles = false) => {
    if (!keepFiles) setFiles([]);
    setStatus("idle");
    setOutputPath(null);
    setPageCount(null);
    setFromPage("1");
    setToPage("1");
  }, []);

  const handleOpChange = (id: OperationId) => {
    setActiveOp(id);
    resetState(false);
  };

  const loadPageCount = useCallback(async (fileRef: FileRef) => {
    try {
      const count = await window.api.document.pageCount(fileRef.id);
      setPageCount(count);
      setToPage(String(count));
    } catch {
      setPageCount(null);
    }
  }, []);

  const addFiles = useCallback((newFiles: FileRef[], currentOp: Operation) => {
    if (currentOp.multi) {
      setFiles((prev) => {
        const existing = new Set(prev.map((p) => p.id));
        const deduped = newFiles.filter((p) => !existing.has(p.id));
        return [...prev, ...deduped];
      });
    } else {
      const first = newFiles[0];
      setFiles([first]);
      if (currentOp.id === "split") {
        loadPageCount(first);
      }
    }
  }, [loadPageCount]);

  const handlePickFiles = async () => {
    try {
      if (op.multi) {
        const picked = await window.api.openDocFiles(op.fileType as "pdf" | "image");
        if (picked.length > 0) addFiles(picked, op);
      } else {
        const picked = await window.api.openDocFile(op.fileType);
        if (picked) addFiles([picked], op);
      }
    } catch {
      showErrorToast("Could not open file picker. Try again or restart the app.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== "processing") setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (status === "processing") return;

    const dropped = Array.from(e.dataTransfer.files);
    const allowed = ALLOWED_EXTS[op.fileType];
    const valid = dropped.filter((f) =>
      allowed.some((ext: string) => f.name.toLowerCase().endsWith(ext))
    );

    if (valid.length === 0) {
      const extList = allowed.join(", ");
      showErrorToast(`Only ${extList} files are accepted here.`);
      return;
    }

    try {
      const refs = await Promise.all(valid.map((f) => window.api.registerDroppedFile(f)));
      addFiles(refs, op);
    } catch {
      showErrorToast("Could not register dropped files.");
    }
  };

  const moveFile = (idx: number, dir: "up" | "down") => {
    setFiles((prev) => {
      const next = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRun = async () => {
    if (files.length === 0) {
      showErrorToast("Please select a file first.");
      return;
    }

    setStatus("processing");
    setIsProcessing(true);
    setOutputPath(null);

    try {
      let result: string = "";
      switch (activeOp) {
        case "merge":
          if (files.length < 2) throw new Error("Add at least 2 PDFs to merge.");
          result = await window.api.document.merge(files.map((file) => file.id));
          break;
        case "split": {
          const from = parseInt(fromPage, 10);
          const to = parseInt(toPage, 10);
          if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
            throw new Error("Invalid page range.");
          }
          result = await window.api.document.split(files[0].id, from, to);
          break;
        }
        case "markdown-to-pdf":
          result = await window.api.document.markdownToPdf(files[0].id);
          break;
        case "docx-to-html":
          result = await window.api.document.docxToHtml(files[0].id);
          break;
        case "docx-to-text":
          result = await window.api.document.docxToText(files[0].id);
          break;
      }
      setOutputPath(result);
      setStatus("success");
      showSuccessToast("Done! Saved next to your source file.");
    } catch (err: unknown) {
      setStatus("error");
      showErrorToast(err, "Conversion failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container relative z-10 mx-auto max-w-6xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <h1 className="mb-3 flex items-center justify-center gap-3 text-5xl font-black tracking-tighter uppercase italic text-primary">
          <FileStack className="h-12 w-12" />
          Documents
        </h1>
        <p className="text-lg font-medium text-muted-foreground italic">
          Convert, merge, and extract document files — all offline.
        </p>
      </motion.div>

      <div className="flex flex-col gap-8">
        <OperationSelector
          activeOp={activeOp}
          status={status}
          onOpChange={handleOpChange}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeOp}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="bg-card/40 border-border/50 shadow-2xl backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/5 pb-6">
                <CardTitle className="flex items-center gap-3 text-3xl font-black tracking-tighter uppercase italic text-primary">
                  <op.icon className="h-7 w-7" />
                  {op.label}
                </CardTitle>
                <CardDescription className="text-base font-medium italic mt-1">
                  {op.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-8 pb-8 space-y-6">
                <FileList
                  op={op}
                  files={files}
                  status={status}
                  isDragOver={isDragOver}
                  onPickFiles={handlePickFiles}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onMoveFile={moveFile}
                  onRemoveFile={removeFile}
                  onRemoveAll={() => setFiles([])}
                />

                {activeOp === "split" && files.length > 0 && (
                  <PageRangeSelector
                    pageCount={pageCount}
                    fromPage={fromPage}
                    toPage={toPage}
                    onFromChange={setFromPage}
                    onToChange={setToPage}
                  />
                )}

                <AnimatePresence>
                  {status === "success" && outputPath && (
                    <SuccessMessage
                      outputLabel={op.outputLabel}
                      outputPath={outputPath}
                      onShowInFolder={(p) => window.api.document.showInFolder(p)}
                    />
                  )}
                </AnimatePresence>

                {activeOp === "merge" && files.length === 1 && (
                  <p className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest text-center">
                    <Info className="h-3.5 w-3.5" />
                    Add at least one more PDF to enable merging.
                  </p>
                )}

                <Button
                  onClick={handleRun}
                  disabled={
                    files.length === 0 ||
                    (activeOp === "merge" && files.length < 2) ||
                    status === "processing"
                  }
                  size="lg"
                  className="w-full h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {status === "processing" ? (
                    <span className="flex items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <op.icon className="h-6 w-6" />
                      {op.label}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
