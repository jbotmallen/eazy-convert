import { type OperationId } from "./types";
import {
  FilePlus2,
  Scissors,
  FileCode2,
  FileDown,
  FileText,
} from "lucide-react";

export interface Operation {
  id: OperationId;
  label: string;
  description: string;
  icon: React.ElementType;
  inputLabel: string;
  hint: string;
  multi: boolean;
  fileType: "pdf" | "docx" | "md" | "image";
  outputLabel: string;
}

export const OPERATIONS: Operation[] = [
  {
    id: "merge",
    label: "Merge PDFs",
    description: "Combine multiple PDF files into one document. Drag to reorder before merging.",
    icon: FilePlus2,
    inputLabel: "PDF Files",
    hint: "Drop PDF files here, or click to browse",
    multi: true,
    fileType: "pdf",
    outputLabel: "Merged PDF",
  },
  {
    id: "split",
    label: "Split PDF",
    description: "Extract a range of pages from a PDF into a new file.",
    icon: Scissors,
    inputLabel: "PDF File",
    hint: "Drop a PDF here, or click to browse",
    multi: false,
    fileType: "pdf",
    outputLabel: "Split PDF",
  },
  {
    id: "markdown-to-pdf",
    label: "Markdown → PDF",
    description: "Convert a Markdown (.md) file to a styled, print-ready PDF.",
    icon: FileDown,
    inputLabel: "Markdown File",
    hint: "Drop a .md file here, or click to browse",
    multi: false,
    fileType: "md",
    outputLabel: "PDF",
  },
  {
    id: "docx-to-html",
    label: "DOCX → HTML",
    description: "Convert a Word document to a web-ready HTML file.",
    icon: FileCode2,
    inputLabel: "Word Document (.docx)",
    hint: "Drop a .docx file here, or click to browse",
    multi: false,
    fileType: "docx",
    outputLabel: "HTML File",
  },
  {
    id: "docx-to-text",
    label: "DOCX → Text",
    description: "Extract plain text content from a Word document.",
    icon: FileText,
    inputLabel: "Word Document (.docx)",
    hint: "Drop a .docx file here, or click to browse",
    multi: false,
    fileType: "docx",
    outputLabel: "Text File",
  },
];

export const ALLOWED_EXTS: Record<string, string[]> = {
  pdf: [".pdf"],
  image: [".jpg", ".jpeg", ".png"],
  docx: [".docx"],
  md: [".md", ".markdown"],
};
