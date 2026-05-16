import { useState, useCallback } from "react";
import { ALLOWED_EXTS } from "@/pages/document-converter/constants";
import { showErrorToast } from "@/lib/utils";

type FileType = "pdf" | "image" | "docx" | "md";

export function useDocumentFileState(fileType: FileType, multi: boolean) {
  const [files, setFiles] = useState<FileRef[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const addFiles = useCallback(
    (newPaths: FileRef[]) => {
      if (multi) {
        setFiles((prev) => {
          const existing = new Set(prev.map((p) => p.id));
          const deduped = newPaths.filter((p) => !existing.has(p.id));
          return [...prev, ...deduped];
        });
      } else {
        setFiles([newPaths[0]]);
      }
    },
    [multi],
  );

  const handlePickFiles = useCallback(async () => {
    try {
      if (multi) {
        const picked = await window.api.openDocFiles(fileType as "pdf" | "image");
        if (picked.length > 0) addFiles(picked);
      } else {
        const picked = await window.api.openDocFile(fileType);
        if (picked) addFiles([picked]);
      }
    } catch (err) {
      showErrorToast(err, "Could not open file picker. Try again or restart the app.");
    }
  }, [fileType, multi, addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      const allowed = ALLOWED_EXTS[fileType];
      const valid = dropped.filter((f) =>
        allowed.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );
      if (valid.length === 0) {
        showErrorToast(`Only ${allowed.join(", ")} files accepted here.`);
        return;
      }
      try {
        const refs = await Promise.all(valid.map((f) => window.api.registerDroppedFile(f)));
        addFiles(refs);
      } catch (err) {
        showErrorToast(err, "Could not register dropped files.");
      }
    },
    [fileType, addFiles],
  );

  const moveFile = useCallback((idx: number, dir: "up" | "down") => {
    setFiles((prev) => {
      const next = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearFiles = useCallback(() => setFiles([]), []);

  return {
    files,
    setFiles,
    isDragOver,
    handlePickFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    moveFile,
    removeFile,
    clearFiles,
  };
}
