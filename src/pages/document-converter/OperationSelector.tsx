import { OPERATIONS } from "./constants";
import { cn } from "@/lib/utils";
import type { Status, OperationId } from "./types";

interface OperationSelectorProps {
  activeOp: OperationId;
  status: Status;
  onOpChange: (id: OperationId) => void;
}

export function OperationSelector({ activeOp, status, onOpChange }: OperationSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
      {OPERATIONS.map((o) => {
        const Icon = o.icon;
        const isActive = activeOp === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onOpChange(o.id)}
            disabled={status === "processing"}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border transition-all duration-200 text-center",
              isActive
                ? "bg-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/10"
                : "bg-card/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
              status === "processing" && "opacity-50 cursor-not-allowed",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider leading-tight">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
