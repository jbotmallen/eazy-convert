import { type ClassValue, clsx } from "clsx"
import { toast } from "sonner"
import { twMerge } from "tailwind-merge"

export const DEFAULT_USER_ERROR_MESSAGE = "An error occurred, try again or restart the app.";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFileName(p: string) {
  return p.split(/[\\/]/).pop() || p;
}

export function getUserErrorMessage(error: unknown, fallback = DEFAULT_USER_ERROR_MESSAGE) {
  const raw = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";

  const message = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  if (!message) return fallback;

  if (/output file not found/i.test(message)) {
    return "Output file not found. It may have been moved or deleted.";
  }

  if (/file not found/i.test(message)) {
    return "File not found. It may have been moved or deleted.";
  }

  if (/no such file or directory/i.test(message)) {
    return "File or folder not found. It may have been moved or deleted.";
  }

  if (/permission denied|access is denied|operation not permitted/i.test(message)) {
    return "Permission denied. Check file permissions and try again.";
  }

  return message;
}

export function showErrorToast(error: unknown, fallback = DEFAULT_USER_ERROR_MESSAGE) {
  toast.error(getUserErrorMessage(error, fallback));
}

export function showSuccessToast(message: string) {
  toast.success(message);
}
