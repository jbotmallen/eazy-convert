import { ipcMain, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { createDocumentHtml, getUniqueName, hardenDocumentWindow } from "./utils.js";
import { assertDocumentFileWithinLimit, assertExistingDocumentPath } from "../../utils/security.js";
import { resolveRegisteredFilePath } from "../../utils/fileRegistry.js";
import { registerProducedOutput } from "../../utils/outputRegistry.js";

const MARKDOWN_EXTS = [".md", ".markdown"] as const;

export function registerMarkdownHandlers() {
  // Convert Markdown to PDF via Chromium print
  ipcMain.handle("document:markdown-to-pdf", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, MARKDOWN_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const { marked } = await import("marked");
    const mdContent = fs.readFileSync(inputPath, "utf-8");
    const bodyHtml = await marked.parse(mdContent);

    const html = createDocumentHtml(bodyHtml, `
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1a1a1a; }
  h1, h2, h3 { color: #111; }
  code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 4px solid #ccc; margin: 0; padding: 0 16px; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; }
  th { background: #f0f0f0; }
`);

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: false,
      },
    });
    hardenDocumentWindow(win);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await win.webContents.printToPDF({ margins: { marginType: "default" } });
    win.destroy();

    const base = path.basename(inputPath, path.extname(inputPath));
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.pdf`);
    fs.writeFileSync(outPath, pdfBuffer);
    registerProducedOutput(outPath);
    return outPath;
  });
}
