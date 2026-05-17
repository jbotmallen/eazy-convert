import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const labelClasses = "ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground";

type FieldLabelProps = HTMLAttributes<HTMLElement> & {
  as?: "label" | "span";
  icon: LucideIcon;
};

export function FieldLabel({ as: Component = "label", icon: Icon, className, children, ...props }: FieldLabelProps) {
  return (
    <Component className={cn(labelClasses, className)} {...props}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary/80" />
      <span>{children}</span>
    </Component>
  );
}
