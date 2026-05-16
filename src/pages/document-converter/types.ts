export type OperationId =
  | "merge"
  | "split"
  | "markdown-to-pdf"
  | "docx-to-html"
  | "docx-to-text";

export type Status = "idle" | "processing" | "success" | "error";
