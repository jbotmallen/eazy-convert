import { ipcMain, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { pathToFileURL } from "url";
import { PDFDocument } from "pdf-lib";
import { getUniqueName, timestamp } from "./utils.js";
import {
  escapeHtml,
  assertDocumentFileWithinLimit,
  assertDocumentPathList,
  assertExistingDocumentPath,
} from "../../utils/security.js";
import { resolveRegisteredFilePath } from "../../utils/fileRegistry.js";
import { registerProducedOutput } from "../../utils/outputRegistry.js";

const PDF_EXTS = [".pdf"] as const;
const MAX_PDF_PAGE_COUNT = 500;

function assertPdfPageCountWithinLimit(count: number, label = "PDF"): void {
  if (count > MAX_PDF_PAGE_COUNT) {
    throw new Error(`${label} has too many pages (${count}). Maximum allowed is ${MAX_PDF_PAGE_COUNT}.`);
  }
}

async function loadPdfWithinPageLimit(inputPath: string, label = "PDF"): Promise<PDFDocument> {
  const buffer = fs.readFileSync(inputPath);
  const pdf = await PDFDocument.load(buffer);
  assertPdfPageCountWithinLimit(pdf.getPageCount(), label);
  return pdf;
}

/**
 * Renders every page of a PDF to a PNG using pdfjs-dist in a hidden Chromium
 * window and returns an array of base64-encoded PNG strings (one per page).
 *
 * We write a temp HTML file and use loadFile() so the renderer has a real
 * file:// origin. A data: URL would produce an opaque origin that Chromium
 * blocks from doing dynamic import() of file:// modules.
 */
async function renderPdfPages(inputPath: string, scale = 2.0): Promise<string[]> {
  const isDev = process.env.NODE_ENV === "development";
  const nmBase = isDev
    ? path.join(process.cwd(), "node_modules")
    : path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");

  const pdfjsMain   = path.join(nmBase, "pdfjs-dist", "build", "pdf.mjs");
  const pdfjsWorker = path.join(nmBase, "pdfjs-dist", "build", "pdf.worker.mjs");

  const pdfUrl    = pathToFileURL(inputPath).href;
  const pdfjsUrl  = pathToFileURL(pdfjsMain).href;
  const workerUrl = pathToFileURL(pdfjsWorker).href;

  // Write a minimal HTML file so the window loads with a file:// origin,
  // which allows the renderer to dynamically import other file:// modules.
  const tmpHtml = path.join(os.tmpdir(), `ec_pdfrender_${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, "<!DOCTYPE html><html><body></body></html>", "utf-8");

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  try {
    await win.loadFile(tmpHtml);
    win.webContents.on("will-navigate", (event) => event.preventDefault());

    // SECURITY: every interpolated value is JSON.stringify'd so a path
    // containing a quote, backtick, or other JS-string-breaking byte cannot
    // escape the string literal and execute attacker-controlled code in the
    // offscreen window.
    const pdfjsUrlLiteral  = JSON.stringify(pdfjsUrl);
    const workerUrlLiteral = JSON.stringify(workerUrl);
    const pdfUrlLiteral    = JSON.stringify(pdfUrl);
    const scaleLiteral     = JSON.stringify(scale);
    const images: string[] = await win.webContents.executeJavaScript(`
      (async () => {
        const pdfjsLib = await import(${pdfjsUrlLiteral});
        pdfjsLib.GlobalWorkerOptions.workerSrc = ${workerUrlLiteral};
        const pdf = await pdfjsLib.getDocument(${pdfUrlLiteral}).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: ${scaleLiteral} });
          const canvas = document.createElement('canvas');
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas.toDataURL('image/png').split(',')[1]);
        }
        return pages;
      })()
    `);

    return images;
  } finally {
    win.destroy();
    try { fs.unlinkSync(tmpHtml); } catch { /* ignore */ }
  }
}

export function registerPdfHandlers() {
  // Get page count of a PDF
  ipcMain.handle("document:page-count", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, PDF_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const pdf = await loadPdfWithinPageLimit(inputPath);
    return pdf.getPageCount();
  });

  // Merge multiple PDFs into one
  ipcMain.handle("document:merge", async (event, inputPaths: string[]) => {
    inputPaths = inputPaths.map((inputPath) => resolveRegisteredFilePath(event.sender.id, inputPath));
    assertDocumentPathList(inputPaths, PDF_EXTS, 2);
    inputPaths.forEach((filePath) => assertDocumentFileWithinLimit(filePath));
    const merged = await PDFDocument.create();
    let totalPageCount = 0;
    for (const filePath of inputPaths) {
      const pdf = await loadPdfWithinPageLimit(filePath, `PDF "${path.basename(filePath)}"`);
      totalPageCount += pdf.getPageCount();
      assertPdfPageCountWithinLimit(totalPageCount, "Merged PDF");
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    const outDir = path.dirname(inputPaths[0]);
    const outPath = getUniqueName(outDir, `Merged_${timestamp()}.pdf`);
    fs.writeFileSync(outPath, await merged.save());
    registerProducedOutput(outPath);
    return outPath;
  });

  // Split a PDF to a page range
  ipcMain.handle(
    "document:split",
    async (event, inputPath: string, fromPage: number, toPage: number) => {
      inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
      assertExistingDocumentPath(inputPath, PDF_EXTS);
      assertDocumentFileWithinLimit(inputPath);
      const src = await loadPdfWithinPageLimit(inputPath);
      const count = src.getPageCount();

      if (fromPage < 1 || toPage > count || fromPage > toPage) {
        throw new Error(`Invalid page range. PDF has ${count} pages.`);
      }

      const dest = await PDFDocument.create();
      const indices = Array.from(
        { length: toPage - fromPage + 1 },
        (_, i) => fromPage - 1 + i,
      );
      const pages = await dest.copyPages(src, indices);
      pages.forEach((page) => dest.addPage(page));

      const base = path.basename(inputPath, ".pdf");
      const outDir = path.dirname(inputPath);
      const outPath = getUniqueName(outDir, `${base}_p${fromPage}-p${toPage}.pdf`);
      fs.writeFileSync(outPath, await dest.save());
      registerProducedOutput(outPath);
      return outPath;
    },
  );

  // Convert PDF to plain text
  ipcMain.handle("document:pdf-to-text", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, PDF_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const buffer = fs.readFileSync(inputPath);
    const pdf = await PDFDocument.load(buffer);
    assertPdfPageCountWithinLimit(pdf.getPageCount());
    const { PDFParse } = await import("pdf-parse");
    const result = await new PDFParse({ data: buffer }).getText() as unknown as { text: string };

    const base = path.basename(inputPath, ".pdf");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.txt`);
    fs.writeFileSync(outPath, result.text, "utf-8");
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert PDF to HTML — renders each page as an image so the output is
  // visually accurate rather than relying on imperfect text extraction.
  ipcMain.handle("document:pdf-to-html", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, PDF_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    await loadPdfWithinPageLimit(inputPath);
    const images = await renderPdfPages(inputPath, 1.5);

    const title = path.basename(inputPath, ".pdf");
    const safeTitle = escapeHtml(title);
    const imgTags = images
      .map(
        (b64, i) =>
          `  <img src="data:image/png;base64,${b64}" alt="Page ${i + 1}" />`,
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; frame-src 'none'" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #525659; padding: 24px; }
  img { display: block; max-width: 100%; width: auto; margin: 0 auto 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
</style>
</head>
<body>
${imgTags}
</body>
</html>`;

    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${title}.html`);
    fs.writeFileSync(outPath, html, "utf-8");
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert PDF to DOCX via text extraction → html-to-docx.
  // Note: this is text-only — visual layout cannot be preserved without
  // an external tool such as LibreOffice.
  ipcMain.handle("document:pdf-to-docx", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, PDF_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    const buffer = fs.readFileSync(inputPath);
    const pdf = await PDFDocument.load(buffer);
    assertPdfPageCountWithinLimit(pdf.getPageCount());
    const { PDFParse } = await import("pdf-parse");
    const { default: HTMLtoDOCX } = await import("html-to-docx");
    const result = await new PDFParse({ data: buffer }).getText() as unknown as { text: string };

    const paragraphs = result.text
      .split(/\n{2,}/)
      .map((p: string) => p.trim().replace(/\n/g, " "))
      .filter(Boolean)
      .map((p: string) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${paragraphs}</body></html>`;
    const docxBuffer = await HTMLtoDOCX(html, undefined, { table: { row: { cantSplit: true } } }, undefined);

    const base = path.basename(inputPath, ".pdf");
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${base}.docx`);
    fs.writeFileSync(outPath, docxBuffer as unknown as Buffer);
    registerProducedOutput(outPath);
    return outPath;
  });

  // Convert PDF pages to images → ZIP archive
  ipcMain.handle("document:pdf-to-images", async (event, inputPath: string) => {
    inputPath = resolveRegisteredFilePath(event.sender.id, inputPath);
    assertExistingDocumentPath(inputPath, PDF_EXTS);
    assertDocumentFileWithinLimit(inputPath);
    await loadPdfWithinPageLimit(inputPath);
    const { default: JSZip } = await import("jszip");
    const images = await renderPdfPages(inputPath, 2.0);

    const zip = new JSZip();
    const baseName = path.basename(inputPath, ".pdf");
    for (let i = 0; i < images.length; i++) {
      zip.file(`${baseName}_page${i + 1}.png`, Buffer.from(images[i], "base64"));
    }
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const outDir = path.dirname(inputPath);
    const outPath = getUniqueName(outDir, `${baseName}_images.zip`);
    fs.writeFileSync(outPath, zipBuffer);
    registerProducedOutput(outPath);
    return outPath;
  });
}
