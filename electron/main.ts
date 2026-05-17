import { app, BrowserWindow, ipcMain, Menu, protocol, shell } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { registerConverterHandlers } from "./handlers/converter/index.js";
import { registerDownloaderHandlers } from "./handlers/downloader.js";
import { registerDialogHandlers } from "./handlers/dialogs.js";
import { registerWindowHandlers } from "./handlers/window.js";
import { registerDocumentHandlers } from "./handlers/document/index.js";
import {
  createVideoPreviewProtocolHandler,
  registerVideoToolHandlers,
  VIDEO_PREVIEW_SCHEME,
  clearAllVideoPreviewTokens,
  cleanupAllVideoTrimPreviewFiles,
} from "./handlers/videoTools.js";
import {
  createAudioPreviewProtocolHandler,
  registerAudioToolHandlers,
  AUDIO_PREVIEW_SCHEME,
  clearAllAudioPreviewTokens,
  cleanupAllAudioTrimPreviewFiles,
} from "./handlers/audioTools.js";
import { registerAudioDenoiseHandlers } from "./handlers/audioDenoise.js";
import { isAllowedExternalUrl } from "./utils/security.js";
import { registerFilePath } from "./utils/fileRegistry.js";
import { cancelForSender } from "./utils/cancellationRegistry.js";
import fs from "fs";
import os from "os";

/**
 * Removes any leftover trim-preview temp files from prior runs that were not
 * cleaned up (crash / OS kill / unhandled rejection). Without this sweep, every
 * abnormal exit leaves user media fragments in the system tmp dir indefinitely
 * — possible disclosure on shared / multi-user machines.
 */
function sweepStaleTrimPreviewFiles(): void {
  const tmpDir = os.tmpdir();
  const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
  const PREFIXES = ["eazyconvert_trim_preview_", "eazyconvert_audio_trim_preview_"];
  try {
    const now = Date.now();
    for (const entry of fs.readdirSync(tmpDir)) {
      if (!PREFIXES.some((p) => entry.startsWith(p))) continue;
      const full = path.join(tmpDir, entry);
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        if (now - stat.mtimeMs < STALE_AFTER_MS) continue;
        fs.unlinkSync(full);
      } catch {
        // Best-effort sweep; ignore per-file failures.
      }
    }
  } catch {
    // tmp dir unreadable — nothing actionable.
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let videoPreviewProtocolRegistered = false;
let audioPreviewProtocolRegistered = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: VIDEO_PREVIEW_SCHEME,
    privileges: {
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
  {
    scheme: AUDIO_PREVIEW_SCHEME,
    privileges: {
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

function registerVideoPreviewProtocol() {
  if (videoPreviewProtocolRegistered) return;
  protocol.handle(VIDEO_PREVIEW_SCHEME, createVideoPreviewProtocolHandler());
  videoPreviewProtocolRegistered = true;
}

function registerAudioPreviewProtocol() {
  if (audioPreviewProtocolRegistered) return;
  protocol.handle(AUDIO_PREVIEW_SCHEME, createAudioPreviewProtocolHandler());
  audioPreviewProtocolRegistered = true;
}

function createWindow() {
  const isDevelopment = process.env.NODE_ENV === "development";
  registerVideoPreviewProtocol();
  registerAudioPreviewProtocol();

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 400,
    minHeight: 600,
    backgroundColor: "#020617",
    show: false,
    title: "KitBox",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#020617", // Matches your dark background
      symbolColor: "#94a3b8", // Muted slate color for buttons
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: true,
    icon: isDevelopment
      ? path.join(process.cwd(), "public", "icon.ico")
      : path.join(__dirname, "../dist/logo.png"),
  });

  // Apply a strict Content Security Policy (CSP)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
          (isDevelopment ? "script-src 'self' 'unsafe-inline'; " : "script-src 'self'; ") +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "media-src 'self' blob: app-video-preview: app-audio-preview:; " +
          (isDevelopment
            ? "connect-src 'self' http://localhost:5173 ws://localhost:5173; "
            : "connect-src 'self'; ") +
          "base-uri 'none'; " +
          "frame-src 'none';"
        ],
      },
    });
  });

  // safety against malicious popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  // safety against malicious navigation
  const appIndexFileUrl = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL() ?? "";
    const allowed =
      (isDevelopment && url.startsWith("http://localhost:5173")) ||
      url === appIndexFileUrl ||
      url === currentUrl;
    if (!allowed) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  // Register Handlers before loading the renderer so early page effects can invoke IPC safely.
  registerConverterHandlers();
  registerDownloaderHandlers();
  registerDialogHandlers(mainWindow);
  registerWindowHandlers(mainWindow);
  registerDocumentHandlers();
  registerVideoToolHandlers();
  registerAudioToolHandlers();
  registerAudioDenoiseHandlers();

  // Central cancellation dispatcher. Replaces multiple per-handler listeners
  // on the same channel — handlers now register their cancellable processes
  // via cancellationRegistry instead. See utils/cancellationRegistry.ts.
  ipcMain.on("cancel-convert", (event) => cancelForSender(event.sender.id));
  // safety against malicious file access
  ipcMain.handle("file:register", (event, filePath: string) => registerFilePath(event.sender.id, filePath));
  ipcMain.handle("open-external", (_, url: string) => {
    if (!isAllowedExternalUrl(url)) throw new Error("Blocked external URL.");
    return shell.openExternal(url);
  });

  if (isDevelopment) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.maximize();
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDevelopment) {
    mainWindow.webContents.on("before-input-event", (_, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === "i") {
        mainWindow?.webContents.openDevTools();
      }
    });

    mainWindow.webContents.on("context-menu", (_, params) => {
      if (!mainWindow) return;
      Menu.buildFromTemplate([
        {
          label: "Inspect Element",
          click: () => {
            mainWindow?.webContents.inspectElement(params.x, params.y);
            mainWindow?.webContents.openDevTools();
          },
        },
      ]).popup({ window: mainWindow });
    });
  }
}

app.whenReady().then(() => {
  sweepStaleTrimPreviewFiles();
  createWindow();
});

app.on("window-all-closed", () => {
  // Clearing preview tokens unlinks their backing temp files via the
  // PreviewTokenStore eviction callback. We still call the cleanup helpers
  // afterwards as a belt-and-braces sweep for any files registered without an
  // associated token.
  clearAllVideoPreviewTokens();
  clearAllAudioPreviewTokens();
  cleanupAllVideoTrimPreviewFiles();
  cleanupAllAudioTrimPreviewFiles();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  clearAllVideoPreviewTokens();
  clearAllAudioPreviewTokens();
  cleanupAllVideoTrimPreviewFiles();
  cleanupAllAudioTrimPreviewFiles();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
