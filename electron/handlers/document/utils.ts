import path from "path";
import fs from "fs";
import sanitizeHtmlLib from "sanitize-html";
import type { BrowserWindow } from "electron";

export const DOCUMENT_CSP = [
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  "font-src data:",
  "script-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function getUniqueName(dir: string, name: string): string {
  let candidate = path.join(dir, name);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
    i++;
  }
  return candidate;
}

// DOM-parser-based sanitiser (sanitize-html). Replaces a regex sanitiser that
// was correct for current mammoth/marked output but brittle against future
// mXSS variants. The allowlist below covers everything mammoth (DOCX → HTML)
// and marked (Markdown → HTML) actually emit; anything else is dropped.
//
// Still defence-in-depth: the rendering BrowserWindow disables JavaScript,
// runs sandboxed with contextIsolation, and the emitted HTML carries a CSP
// with `script-src 'none'` and `object-src 'none'`.
const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    "a", "b", "blockquote", "br", "code", "col", "colgroup", "del", "div",
    "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "li",
    "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table", "tbody",
    "td", "tfoot", "th", "thead", "tr", "u", "ul",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["class", "id"],
  },
  // Block javascript:, vbscript:, file:, blob:, data:text/*, data:application/*.
  // Allow https, http, mailto, and data:image/* (mammoth inlines DOCX images
  // as base64). Anything else on href/src is dropped.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  allowProtocolRelative: false,
  // Strip <script>/<style>/<svg>/<math> entirely, including their text.
  nonTextTags: ["script", "style", "textarea", "noscript", "svg", "math"],
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  // Drop any inline `style` since regex predecessor explicitly forbade
  // url()/expression(); easier to deny outright than to parse CSS.
  allowedStyles: {},
};

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}

export function createDocumentHtml(body: string, style: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${DOCUMENT_CSP}" />
<style>
${style}
</style>
</head>
<body>${sanitizeHtml(body)}</body>
</html>`;
}

export function hardenDocumentWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
}
