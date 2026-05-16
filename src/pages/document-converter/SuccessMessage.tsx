import { motion } from "framer-motion";
import { CheckCircle, FolderOpen } from "lucide-react";
import { showErrorToast } from "@/lib/utils";

interface SuccessMessageProps {
  outputLabel: string;
  outputPath: string;
  onShowInFolder: (path: string) => void | Promise<void>;
}

export function SuccessMessage({ outputLabel, outputPath, onShowInFolder }: SuccessMessageProps) {
  const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;
  const handleShowInFolder = async () => {
    try {
      await onShowInFolder(outputPath);
    } catch (err) {
      showErrorToast(err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-4 px-5 py-4 bg-primary/5 border border-primary/20 rounded-2xl">
        <CheckCircle className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-primary mb-0.5">
            {outputLabel} saved
          </p>
          <p className="text-sm font-medium text-muted-foreground truncate">
            {fileName(outputPath)}
          </p>
        </div>
        <button
          onClick={handleShowInFolder}
          className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary hover:underline shrink-0"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Show in folder
        </button>
      </div>
    </motion.div>
  );
}
