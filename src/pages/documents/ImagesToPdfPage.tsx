import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SimpleToast } from "@/components/ui/simple-toast";
import { FileList } from "@/pages/document-converter/FileList";
import { SuccessMessage } from "@/pages/document-converter/SuccessMessage";
import { OPERATIONS } from "@/pages/document-converter/constants";
import { useDocumentFileState } from "@/hooks/useDocumentFileState";
import { useProcessing } from "@/context/useProcessing";

const op = OPERATIONS.find((o) => o.id === "images-to-pdf")!;

export function ImagesToPdfPage() {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const { setIsProcessing } = useProcessing();

  const { files, setFiles, isDragOver, toast, setToast, handlePickFiles, handleDragOver, handleDragLeave, handleDrop, moveFile, removeFile } =
    useDocumentFileState("image", true);

  const handleRun = async () => {
    if (files.length === 0) {
      setToast({ message: "Select at least one image.", type: "error" });
      return;
    }
    setStatus("processing");
    setIsProcessing(true);
    setOutputPath(null);
    try {
      const result = await window.api.document.imagesToPdf(files.map((file) => file.id));
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full bg-card/40 border-border/50 shadow-2xl backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/5 pb-6">
          <CardTitle className="flex items-center gap-3 text-4xl font-black tracking-tighter uppercase italic text-primary">
            <ImageIcon className="h-9 w-9" />
            Images → PDF
          </CardTitle>
          <CardDescription className="text-base font-medium italic mt-1">
            Pack JPG or PNG images into a single PDF. Order determines page order.
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

          <AnimatePresence>
            {status === "success" && outputPath && (
              <SuccessMessage
                outputLabel="Image PDF"
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
                <ImageIcon className="h-6 w-6" />
                Convert to PDF
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {toast && <SimpleToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </motion.div>
  );
}
