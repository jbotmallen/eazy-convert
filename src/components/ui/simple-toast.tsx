import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type: "success" | "error"
  onClose: () => void
}

export function SimpleToast({ message, type, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border px-6 py-4 shadow-lg transition-all animate-in slide-in-from-right-full",
        type === "success"
          ? "border-green-500 bg-green-950 text-green-50"
          : "border-red-500 bg-red-950 text-red-50"
      )}
    >
      <div className="text-sm font-semibold">{message}</div>
      <button
        type="button"
        title="Close Toast"
        onClick={onClose}
        className="ml-4 rounded-md p-1 hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
