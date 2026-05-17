import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FilePlus2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileList } from "@/pages/document-converter/FileList";
import { SuccessMessage } from "@/pages/document-converter/SuccessMessage";
import { OPERATIONS } from "@/pages/document-converter/constants";
import { useDocumentFileState } from "@/hooks/useDocumentFileState";
import { useProcessing } from "@/context/useProcessing";
import { showErrorToast, showSuccessToast } from "@/lib/utils";

const op = OPERATIONS.find((o) => o.id === "merge")!;

export function MergePdfPage() {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const { setIsProcessing } = useProcessing();

  const { files, setFiles, isDragOver, handlePickFiles, handleDragOver, handleDragLeave, handleDrop, moveFile, removeFile } =
    useDocumentFileState("pdf", true);

  const handleRun = async () => {
    if (files.length < 2) {
      showErrorToast("Add at least 2 PDFs to merge.");
      return;
    }
    setStatus("processing");
    setIsProcessing(true);
    setOutputPath(null);
    try {
      const result = await window.api.document.merge(files.map((file) => file.id));
      setOutputPath(result);
      setStatus("success");
      showSuccessToast("Done! Saved next to your source file.");
    } catch (err: unknown) {
      setStatus("error");
      showErrorToast(err, "Merge failed.");
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
            <FilePlus2 className="h-9 w-9" />
            Merge PDFs
          </CardTitle>
          <CardDescription className="text-base font-medium italic mt-1">
            Combine multiple PDF files into one. Drag to reorder before merging.
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

          {files.length === 1 && (
            <p className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest text-center">
              <Info className="h-3.5 w-3.5" />
              Add at least one more PDF to enable merging.
            </p>
          )}

          <AnimatePresence>
            {status === "success" && outputPath && (
              <SuccessMessage
                outputLabel="Merged PDF"
                outputPath={outputPath}
                onShowInFolder={(p) => window.api.document.showInFolder(p)}
              />
            )}
          </AnimatePresence>

          <Button
            onClick={handleRun}
            disabled={files.length < 2 || status === "processing"}
            size="lg"
            className="w-full h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {status === "processing" ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                Merging...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <FilePlus2 className="h-6 w-6" />
                Merge PDFs
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

    </motion.div>
  );
}
