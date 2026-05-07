import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { registerConverterHandlers } from "./handlers/converter/index.js";
import { registerDownloaderHandlers } from "./handlers/downloader.js";
import { registerDialogHandlers } from "./handlers/dialogs.js";
import { registerWindowHandlers } from "./handlers/window.js";
import { registerDocumentHandlers } from "./handlers/document/index.js";
import { isAllowedExternalUrl } from "./utils/security.js";
import { registerFilePath } from "./utils/fileRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 400,
    minHeight: 600,
    backgroundColor: "#020617",
    show: false,
    title: "EazyConvert",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#020617", // Matches your dark background
      symbolColor: "#94a3b8", // Muted slate color for buttons
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, process.env.NODE_ENV === "development" ? "../public/logo.png" : "logo.png"),
  });

  // Apply a strict Content Security Policy (CSP)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +  // unsafe-inline needed for Tailwind/CSS-in-JS
          "img-src 'self' data: blob:; " +        // Allow images from local, data URLs, and blobs
          "media-src 'self' blob:; " +            // Allow media from local and blobs
          "connect-src 'self' https://www.youtube.com https://*.googlevideo.com; " + // Allow connection to YT
          "object-src 'none'; " +
          "base-uri 'none'; " +
          "frame-src 'none';"
        ],
      },
    });
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.maximize();
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.on("before-input-event", (_, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === "i") {
        mainWindow?.webContents.openDevTools();
      }
    });
  }

  // Register Handlers
  registerConverterHandlers();
  registerDownloaderHandlers();
  registerDialogHandlers(mainWindow);
  registerWindowHandlers(mainWindow);
  registerDocumentHandlers();
  ipcMain.handle("file:register", (_, filePath: string) => registerFilePath(filePath));
  ipcMain.handle("open-external", (_, url: string) => {
    if (!isAllowedExternalUrl(url)) throw new Error("Blocked external URL.");
    return shell.openExternal(url);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
