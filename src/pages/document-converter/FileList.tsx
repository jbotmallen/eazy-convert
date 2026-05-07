import { motion } from "framer-motion";
import { FolderOpen, FileText, GripVertical, ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Operation, ALLOWED_EXTS } from "./constants";
import type { Status } from "./types";

interface FileListProps {
  op: Operation;
  files: FileRef[];
  status: Status;
  isDragOver: boolean;
  onPickFiles: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void | Promise<void>;
  onMoveFile: (idx: number, dir: "up" | "down") => void;
  onRemoveFile: (idx: number) => void;
  onRemoveAll: () => void;
}

export function FileList({
  op,
  files,
  status,
  isDragOver,
  onPickFiles,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveFile,
  onRemoveFile,
  onRemoveAll,
}: FileListProps) {
  const isMulti = op.multi;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
          {op.inputLabel}
        </label>
        {isMulti && files.length > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {files.length === 0 ? (
        <motion.button
          type="button"
          onClick={status !== "processing" ? onPickFiles : undefined}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          whileHover={status !== "processing" ? { scale: 1.01 } : {}}
          whileTap={status !== "processing" ? { scale: 0.99 } : {}}
          className={cn(
            "w-full min-h-100 flex flex-col items-center justify-center gap-4 px-6 py-14 border-2 border-dashed rounded-2xl transition-all duration-200",
            isDragOver
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
            status === "processing" && "opacity-50 cursor-not-allowed",
          )}
        >
          <div className={cn(
            "rounded-2xl p-4 transition-colors",
            isDragOver ? "bg-primary/20" : "bg-muted/30",
          )}>
            {isDragOver
              ? <FolderOpen className="h-10 w-10" />
              : <op.icon className="h-10 w-10" />
            }
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-bold uppercase tracking-wider">
              {isDragOver ? "Release to add files" : op.hint}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
              {ALLOWED_EXTS[op.fileType].join(" · ").toUpperCase()}
            </p>
          </div>
        </motion.button>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "space-y-2 rounded-2xl transition-all duration-150",
            isDragOver && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
          )}
        >
          {files.map((f, idx) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex items-center gap-2 px-3 py-2.5 bg-muted/20 border border-border/40 rounded-xl group"
            >
              {isMulti && (
                <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              )}

              {isMulti && (
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                  {idx + 1}
                </span>
              )}

              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/80 truncate flex-1">
                {f.name}
              </span>

              {isMulti && status !== "processing" && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => onMoveFile(idx, "up")}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-muted/60 disabled:opacity-20 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onMoveFile(idx, "down")}
                    disabled={idx === files.length - 1}
                    className="p-1 rounded hover:bg-muted/60 disabled:opacity-20 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveFile(idx)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {!isMulti && status !== "processing" && (
                <button
                  onClick={onRemoveAll}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}

          {isMulti && status !== "processing" && (
            <button
              onClick={onPickFiles}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border/50 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
            >
              <Plus className="h-3.5 w-3.5" />
              Add more files
            </button>
          )}

          {!isMulti && status !== "processing" && (
            <button
              onClick={onPickFiles}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border/50 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Choose a different file
            </button>
          )}
        </div>
      )}
    </div>
  );
}
