import { ipcMain } from "electron";
import { registerPdfHandlers } from "./pdf.js";
import { registerDocxHandlers } from "./docx.js";
import { registerMarkdownHandlers } from "./markdown.js";
import { isAllowedDocumentPath } from "../../utils/security.js";

const OUTPUT_EXTS = [".pdf", ".txt", ".html", ".docx", ".md", ".json", ".zip"] as const;

export function registerDocumentHandlers() {
  registerPdfHandlers();
  registerDocxHandlers();
  registerMarkdownHandlers();

  // Open output file in system explorer
  ipcMain.handle("document:show-in-folder", async (_, filePath: string) => {
    if (!isAllowedDocumentPath(filePath, OUTPUT_EXTS)) throw new Error("Invalid output path.");
    const { existsSync, statSync } = await import("fs");
    if (!existsSync(filePath) || !statSync(filePath).isFile()) throw new Error("Output file not found.");
    const { shell } = await import("electron");
    shell.showItemInFolder(filePath);
  });
}
