import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileList } from "@/pages/document-converter/FileList";
import { PageRangeSelector } from "@/pages/document-converter/PageRangeSelector";
import { SuccessMessage } from "@/pages/document-converter/SuccessMessage";
import { OPERATIONS } from "@/pages/document-converter/constants";
import { useDocumentFileState } from "@/hooks/useDocumentFileState";
import { useProcessing } from "@/context/useProcessing";
import { showErrorToast, showSuccessToast } from "@/lib/utils";

const op = OPERATIONS.find((o) => o.id === "split")!;

export function SplitPdfPage() {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [fromPage, setFromPage] = useState("1");
  const [toPage, setToPage] = useState("1");
  const { setIsProcessing } = useProcessing();

  const { files, setFiles, isDragOver, handleDragOver, handleDragLeave, handleDrop: _drop, removeFile } =
    useDocumentFileState("pdf", false);

  // Override pick/drop to also load page count when a PDF is selected
  const loadPageCount = async (fileRef: FileRef) => {
    try {
      const count = await window.api.document.pageCount(fileRef.id);
      setPageCount(count);
      setToPage(String(count));
    } catch {
      setPageCount(null);
    }
  };

  const handlePickFiles = async () => {
    try {
      const picked = await window.api.openDocFile("pdf");
      if (picked) {
        setFiles([picked]);
        await loadPageCount(picked);
      }
    } catch {
      showErrorToast("Could not open file picker. Try again or restart the app.");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    // files state updates async, so we watch the drop event directly
    const dropped = Array.from(e.dataTransfer.files).find((f) =>
      f.name.toLowerCase().endsWith(".pdf"),
    );
    if (dropped) {
      e.preventDefault();
      const fileRef = await window.api.registerDroppedFile(dropped);
      setFiles([fileRef]);
      await loadPageCount(fileRef);
    } else {
      await _drop(e);
    }
  };

  const handleRun = async () => {
    if (files.length === 0) {
      showErrorToast("Select a PDF first.");
      return;
    }
    const from = parseInt(fromPage, 10);
    const to = parseInt(toPage, 10);
    if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
      showErrorToast("Invalid page range.");
      return;
    }
    setStatus("processing");
    setIsProcessing(true);
    setOutputPath(null);
    try {
      const result = await window.api.document.split(files[0].id, from, to);
      setOutputPath(result);
      setStatus("success");
      showSuccessToast("Done! Saved next to your source file.");
    } catch (err: unknown) {
      setStatus("error");
      showErrorToast(err, "Split failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full bg-card/40 border-border/50 shadow-2xl backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/5 pb-6">
          <CardTitle className="flex items-center gap-3 text-4xl font-black tracking-tighter uppercase italic text-primary">
            <Scissors className="h-9 w-9" />
            Split PDF
          </CardTitle>
          <CardDescription className="text-base font-medium italic mt-1">
            Extract a range of pages from a PDF into a new file.
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
            onMoveFile={() => { }}
            onRemoveFile={removeFile}
            onRemoveAll={() => { setFiles([]); setPageCount(null); }}
          />

          {files.length > 0 && (
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
                outputLabel="Split PDF"
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
                Splitting...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <Scissors className="h-6 w-6" />
                Split PDF
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

    </motion.div>
  );
}
