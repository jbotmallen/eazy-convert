import { ipcMain, dialog, BrowserWindow } from "electron";
import { registerFilePath } from "../utils/fileRegistry.js";

export function registerDialogHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle("dialog:openFile", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "All Media",
          extensions: [
            "png", "jpg", "jpeg", "webp", "mp4", "webm", "avi", "mov", "mkv",
            "mp3", "wav", "ogg", "aac", "flac",
          ],
        },
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff"],
        },
        { name: "Videos", extensions: ["mp4", "webm", "avi", "mov", "mkv"] },
        {
          name: "Audio",
          extensions: ["mp3", "wav", "ogg", "aac", "flac", "m4a"],
        },
      ],
    });

    return canceled ? null : registerFilePath(event.sender.id, filePaths[0]);
  });

  ipcMain.handle("dialog:openDocFile", async (event, type: "pdf" | "docx" | "md" | "image") => {
    const filterMap: Record<string, { name: string; extensions: string[] }[]> = {
      pdf: [{ name: "PDF", extensions: ["pdf"] }],
      docx: [{ name: "Word Document", extensions: ["docx"] }],
      md: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      image: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
    };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: filterMap[type] ?? [],
    });
    return canceled ? null : registerFilePath(event.sender.id, filePaths[0]);
  });

  ipcMain.handle("dialog:openDocFiles", async (event, type: "pdf" | "image" | "video" | "audio") => {
    const filterMap: Record<string, { name: string; extensions: string[] }[]> = {
      pdf:   [{ name: "PDF",    extensions: ["pdf"] }],
      image: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
      video: [{ name: "Videos", extensions: ["mp4", "webm", "avi", "mov", "mkv"] }],
      audio: [{ name: "Audio",  extensions: ["mp3", "wav", "ogg", "aac", "flac", "m4a"] }],
    };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: filterMap[type] ?? [],
    });
    return canceled ? [] : filePaths.map((filePath) => registerFilePath(event.sender.id, filePath));
  });
}
