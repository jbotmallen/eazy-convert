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
  video: {
    probe: (inputId: string) => ipcRenderer.invoke('video:probe', inputId),
    preview: (inputId: string) => ipcRenderer.invoke('video:preview', inputId),
    previewTrim: (inputId: string, startSeconds: number, endSeconds: number) => ipcRenderer.invoke('video:preview-trim', inputId, startSeconds, endSeconds),
    revokePreview: (urlOrToken: string) => ipcRenderer.invoke('video:preview:revoke', urlOrToken),
    trim: (inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' | 'accurate') => ipcRenderer.invoke('video:trim', inputId, startSeconds, endSeconds, mode),
    compress: (inputId: string, preset: 'tiny' | 'small' | 'balanced' | 'high-quality', outputFormat: string, options?: { crf?: number; maxHeight?: 360 | 480 | 720 | 1080 | 1440 | 2160 }): Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }> => ipcRenderer.invoke('video:compress', inputId, preset, outputFormat, options),
    denoise: (inputId: string, options: { engine: 'rnnoise' | 'fft'; preset: 'light' | 'medium' | 'aggressive'; model?: 'sh' | 'cb' | 'mp' }): Promise<{ success: true; outputPath: string }> => ipcRenderer.invoke('video:denoise', inputId, options),
    showInFolder: (filePath: string) => ipcRenderer.invoke('video:show-in-folder', filePath),
  },
  audio: {
    probe: (inputId: string) => ipcRenderer.invoke('audio:probe', inputId),
    preview: (inputId: string) => ipcRenderer.invoke('audio:preview', inputId),
    previewTrim: (inputId: string, startSeconds: number, endSeconds: number) => ipcRenderer.invoke('audio:preview-trim', inputId, startSeconds, endSeconds),
    revokePreview: (urlOrToken: string) => ipcRenderer.invoke('audio:preview:revoke', urlOrToken),
    trim: (inputId: string, startSeconds: number, endSeconds: number, outputFormat: 'mp3' | 'ogg' | 'wav' | 'aac' | 'flac', options?: { mode: 'fast' | 'accurate'; qualityPreset: 'standard' | 'small' | 'high' | 'custom'; custom?: { bitrateKbps?: number; sampleRateHz?: number; channelMode?: 'source' | 'mono' | 'stereo'; compressionLevel?: number } }) => ipcRenderer.invoke('audio:trim', inputId, startSeconds, endSeconds, outputFormat, options),
    denoise: (inputId: string, outputFormat: 'mp3' | 'ogg' | 'wav' | 'aac' | 'flac', options: { engine: 'rnnoise' | 'fft'; preset: 'light' | 'medium' | 'aggressive'; model?: 'sh' | 'cb' | 'mp' }): Promise<{ success: true; outputPath: string }> => ipcRenderer.invoke('audio:denoise', inputId, outputFormat, options),
    showInFolder: (filePath: string) => ipcRenderer.invoke('audio:show-in-folder', filePath),
  },
  image: {
    toPdf: (imageIds: string[]) => ipcRenderer.invoke('image:to-pdf', imageIds),
    compress: (inputId: string, preset: 'tiny' | 'small' | 'balanced' | 'high-quality', outputFormat: 'auto' | 'webp' | 'jpg' | 'png', options?: { quality?: number; maxDimension?: 480 | 720 | 1080 | 1440 | 1920 | 2560 | 3840 }): Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }> => ipcRenderer.invoke('image:compress', inputId, preset, outputFormat, options),
    removeBackground: (inputId: string, options?: { outputFormat?: 'png' | 'webp' }): Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }> => ipcRenderer.invoke('image:remove-background', inputId, options),
    getBackgroundEditSources: (inputId: string, outputPath: string): Promise<{ originalDataUrl: string; cutoutDataUrl: string }> => ipcRenderer.invoke('image:background-edit:sources', inputId, outputPath),
    saveBackgroundEdit: (outputPath: string, dataUrl: string): Promise<{ success: boolean; outputPath: string; outputBytes: number }> => ipcRenderer.invoke('image:background-edit:save', outputPath, dataUrl),
    showInFolder: (filePath: string) => ipcRenderer.invoke('image:show-in-folder', filePath),
  },
  document: {
    pageCount: (inputPath: string) => ipcRenderer.invoke('document:page-count', inputPath),
    merge: (inputPaths: string[]) => ipcRenderer.invoke('document:merge', inputPaths),
    split: (inputPath: string, fromPage: number, toPage: number) => ipcRenderer.invoke('document:split', inputPath, fromPage, toPage),
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
