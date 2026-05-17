import { ipcMain, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { createDocumentHtml, getUniqueName, hardenDocumentWindow } from "./utils.js";
import { assertDocumentFileWithinLimit, assertExistingDocumentPath } from "../../utils/security.js";
import { resolveRegisteredFilePath } from "../../utils/fileRegistry.js";
import { registerProducedOutput } from "../../utils/outputRegistry.js";

const DOCX_EXTS = [".docx"] as const;

/** Parse mammoth HTML into a structured JSON array of blocks. */
function mammothHtmlToDocJson(html: string, sourceFile: string): string {
  const stripInline = (s: string) =>
    s.replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

  const blocks: Array<{ pos: number; entry: Record<string, unknown> }> = [];
  const re = /<(h[1-6]|p|li)(?:\s[^>]*)?>([^]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    const text = stripInline(inner);
    if (!text) continue;
    const entry: Record<string, unknown> = { text };
    if (tag.startsWith("h")) { entry.type = "heading"; entry.level = parseInt(tag[1]); }
    else if (tag === "li") { entry.type = "listItem"; }
    else { entry.type = "paragraph"; }
    if (/<strong>/i.test(inner)) entry.bold = true;
    if (/<em>/i.test(inner)) entry.italic = true;
    blocks.push({ pos: m.index, entry });
  }

  return JSON.stringify({ document: path.basename(sourceFile), paragraphs: blocks.map((b) => b.entry) }, null, 2);
}

export function registerDocxHandlers() {
  // Convert DOCX to HTML
  ipcMain.handle("document:docx-to-html", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, DOCX_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ path: inputPath });

    const html = createDocumentHtml(result.value, `
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; line-height: 1.6; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; }
  th { background: #f0f0f0; }
`);

    const base = path.basename(inputPath, ".docx");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.html`);
    fs.writeFileSync(outPath, html, "utf-8");
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert DOCX to plain text
  ipcMain.handle("document:docx-to-text", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, DOCX_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: inputPath });

    const base = path.basename(inputPath, ".docx");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.txt`);
    fs.writeFileSync(outPath, result.value, "utf-8");
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert DOCX to PDF via Chromium print
  ipcMain.handle("document:docx-to-pdf", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, DOCX_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ path: inputPath });

    const html = createDocumentHtml(result.value, `
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; line-height: 1.6; color: #1a1a1a; }
  h1, h2, h3 { color: #111; margin-top: 1.4em; }
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

    const base = path.basename(inputPath, ".docx");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.pdf`);
    fs.writeFileSync(outPath, pdfBuffer);
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert DOCX to Markdown via mammoth → turndown
  ipcMain.handle("document:docx-to-markdown", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, DOCX_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const mammoth = await import("mammoth");
    const turndownModule = await import("turndown");
    const TurndownService = (turndownModule as unknown as { default: typeof import("turndown") }).default;

    const result = await mammoth.convertToHtml({ path: inputPath });
    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    const markdown = td.turndown(result.value);

    const base = path.basename(inputPath, ".docx");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.md`);
    fs.writeFileSync(outPath, markdown, "utf-8");
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert DOCX to structured JSON
  ipcMain.handle("document:docx-to-json", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, DOCX_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ path: inputPath });
    const json = mammothHtmlToDocJson(result.value, inputPath);

    const base = path.basename(inputPath, ".docx");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.json`);
    fs.writeFileSync(outPath, json, "utf-8");
    registerProducedOutput(outPath);
    return outPath;
  });
}
