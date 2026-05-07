import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
  convert: (inputId: string, outputFormat: string, quality?: string) => ipcRenderer.invoke('convert', inputId, outputFormat, quality),
  cancelConvert: () => ipcRenderer.send('cancel-convert'),
  onProgress: (callback: (progress: number) => void) => {
    const listener = (_: unknown, progress: number) => callback(progress);
    ipcRenderer.on('conversion-progress', listener);
    return () => ipcRenderer.removeListener('conversion-progress', listener);
  },
  downloadYoutube: (url: string, format: 'mp4' | 'mp3', quality: string) => ipcRenderer.invoke('download-youtube', url, format, quality),
  cancelDownload: () => ipcRenderer.send('cancel-download'),
  checkYtDlp: () => ipcRenderer.invoke('ytdlp:check'),
  getYtFormats: (url: string) => ipcRenderer.invoke('ytdlp:formats', url),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDocFile: (type: 'pdf' | 'docx' | 'md' | 'image') => ipcRenderer.invoke('dialog:openDocFile', type),
  openDocFiles: (type: 'pdf' | 'image' | 'video' | 'audio') => ipcRenderer.invoke('dialog:openDocFiles', type),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  updateTitleBar: (theme: 'light' | 'dark') => ipcRenderer.invoke('window:updateTitleBar', theme),
  registerDroppedFile: (file: File) => ipcRenderer.invoke('file:register', webUtils.getPathForFile(file)),
  document: {
    pageCount: (inputPath: string) => ipcRenderer.invoke('document:page-count', inputPath),
    merge: (inputPaths: string[]) => ipcRenderer.invoke('document:merge', inputPaths),
    split: (inputPath: string, fromPage: number, toPage: number) => ipcRenderer.invoke('document:split', inputPath, fromPage, toPage),
    imagesToPdf: (imagePaths: string[]) => ipcRenderer.invoke('document:images-to-pdf', imagePaths),
    markdownToPdf: (inputPath: string) => ipcRenderer.invoke('document:markdown-to-pdf', inputPath),
    docxToHtml: (inputPath: string) => ipcRenderer.invoke('document:docx-to-html', inputPath),
    docxToText: (inputPath: string) => ipcRenderer.invoke('document:docx-to-text', inputPath),
    docxToPdf: (inputPath: string) => ipcRenderer.invoke('document:docx-to-pdf', inputPath),
    docxToMarkdown: (inputPath: string) => ipcRenderer.invoke('document:docx-to-markdown', inputPath),
    docxToJson: (inputPath: string) => ipcRenderer.invoke('document:docx-to-json', inputPath),
    pdfToText: (inputPath: string) => ipcRenderer.invoke('document:pdf-to-text', inputPath),
    pdfToHtml: (inputPath: string) => ipcRenderer.invoke('document:pdf-to-html', inputPath),
    pdfToDocx: (inputPath: string) => ipcRenderer.invoke('document:pdf-to-docx', inputPath),
    pdfToImages: (inputPath: string) => ipcRenderer.invoke('document:pdf-to-images', inputPath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('document:show-in-folder', filePath),
  },
});
