import { createContext } from "react";

export interface ProcessingContextValue {
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

export const ProcessingContext = createContext<ProcessingContextValue | null>(null);
