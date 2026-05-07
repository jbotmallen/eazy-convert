import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";

interface PageRangeSelectorProps {
  pageCount: number | null;
  fromPage: string;
  toPage: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
}

export function PageRangeSelector({
  pageCount,
  fromPage,
  toPage,
  onFromChange,
  onToChange,
}: PageRangeSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="space-y-3 overflow-hidden"
    >
      <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
        Page Range{pageCount ? ` — PDF has ${pageCount} pages` : ""}
      </label>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={fromPage}
            onChange={(e) => onFromChange(e.target.value)}
            placeholder="From"
            className="h-12 text-center font-bold text-lg border-2"
          />
        </div>
        <span className="text-muted-foreground font-bold text-lg">—</span>
        <div className="flex-1">
          <Input
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={toPage}
            onChange={(e) => onToChange(e.target.value)}
            placeholder="To"
            className="h-12 text-center font-bold text-lg border-2"
          />
        </div>
      </div>
    </motion.div>
  );
}
