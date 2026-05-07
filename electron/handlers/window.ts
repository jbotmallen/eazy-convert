import { ipcMain, BrowserWindow } from "electron";

export function registerWindowHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle("window:updateTitleBar", (_, theme: "light" | "dark") => {
    const isDark = theme === "dark";
    mainWindow.setTitleBarOverlay({
      color: isDark ? "#020617" : "#f8fafc", // Matches HSL 210 20% 98% approximately
      symbolColor: isDark ? "#94a3b8" : "#475569",
      height: 40,
    });
  });
}
