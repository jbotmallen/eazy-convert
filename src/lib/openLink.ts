// Dual-mode external link opener.
// Desktop (Electron): routes through preload allowlist via window.api.openExternal.
// Web (browser build of landing page): falls back to a noopener window.open.
export function openLink(url: string): void {
  const api = (window as Window & { api?: { openExternal?: (url: string) => Promise<void> } }).api;
  if (api?.openExternal) {
    void api.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
