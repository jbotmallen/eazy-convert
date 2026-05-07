export type OperationId =
  | "merge"
  | "split"
  | "images-to-pdf"
  | "markdown-to-pdf"
  | "docx-to-html"
  | "docx-to-text";

export type Status = "idle" | "processing" | "success" | "error";
