import { useState } from "react";
import type { ReactNode } from "react";
import { ProcessingContext } from "./processing-context";

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  return (
    <ProcessingContext.Provider value={{ isProcessing, setIsProcessing }}>
      {children}
    </ProcessingContext.Provider>
  );
}
