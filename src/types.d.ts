export {};

declare global {
  type FileRef = {
    id: string;
    name: string;
  };

  interface Window {
    api: {
      convert: (inputId: string, outputFormat: string, quality?: string) => Promise<string>;
      cancelConvert: () => void;
      onProgress: (callback: (progress: number) => void) => () => void;
      openFile: () => Promise<FileRef | null>;
      openDocFile: (type: 'pdf' | 'docx' | 'md' | 'image') => Promise<FileRef | null>;
      openDocFiles: (type: 'pdf' | 'image' | 'video' | 'audio') => Promise<FileRef[]>;
      registerDroppedFile: (file: File) => Promise<FileRef>;
      updateTitleBar: (theme: 'light' | 'dark') => Promise<void>;
      downloadYoutube: (url: string, format: 'mp4' | 'mp3', quality: string) => Promise<{ success: boolean; path: string }>;
      cancelDownload: () => void;
      checkYtDlp: () => Promise<{ ok: boolean; missing?: string }>;
      getYtFormats: (url: string) => Promise<number[]>;
      openExternal: (url: string) => Promise<void>;
      video: {
        probe: (inputId: string) => Promise<{ durationSeconds: number }>;
        preview: (inputId: string) => Promise<{ url: string }>;
        previewTrim: (inputId: string, startSeconds: number, endSeconds: number) => Promise<{ url: string }>;
        revokePreview: (urlOrToken: string) => Promise<{ success: boolean }>;
        trim: (inputId: string, startSeconds: number, endSeconds: number, mode: 'fast' | 'accurate') => Promise<{ success: boolean; outputPath: string }>;
        compress: (inputId: string, preset: 'tiny' | 'small' | 'balanced' | 'high-quality', outputFormat: string, options?: { crf?: number; maxHeight?: 360 | 480 | 720 | 1080 | 1440 | 2160 }) => Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }>;
        denoise: (inputId: string, options: { engine: 'rnnoise' | 'fft'; preset: 'light' | 'medium' | 'aggressive'; model?: 'sh' | 'cb' | 'mp' }) => Promise<{ success: true; outputPath: string }>;
        showInFolder: (filePath: string) => Promise<void>;
      };
      audio: {
        probe: (inputId: string) => Promise<{ durationSeconds: number }>;
        preview: (inputId: string) => Promise<{ url: string }>;
        previewTrim: (inputId: string, startSeconds: number, endSeconds: number) => Promise<{ url: string }>;
        revokePreview: (urlOrToken: string) => Promise<{ success: boolean }>;
        trim: (inputId: string, startSeconds: number, endSeconds: number, outputFormat: 'mp3' | 'ogg' | 'wav' | 'aac' | 'flac', options?: { mode: 'fast' | 'accurate'; qualityPreset: 'standard' | 'small' | 'high' | 'custom'; custom?: { bitrateKbps?: number; sampleRateHz?: number; channelMode?: 'source' | 'mono' | 'stereo'; compressionLevel?: number } }) => Promise<{ success: boolean; outputPath: string }>;
        denoise: (inputId: string, outputFormat: 'mp3' | 'ogg' | 'wav' | 'aac' | 'flac', options: { engine: 'rnnoise' | 'fft'; preset: 'light' | 'medium' | 'aggressive'; model?: 'sh' | 'cb' | 'mp' }) => Promise<{ success: true; outputPath: string }>;
        showInFolder: (filePath: string) => Promise<void>;
      };
      image: {
        toPdf: (imageIds: string[]) => Promise<string>;
        compress: (inputId: string, preset: 'tiny' | 'small' | 'balanced' | 'high-quality', outputFormat: 'auto' | 'webp' | 'jpg' | 'png', options?: { quality?: number; maxDimension?: 480 | 720 | 1080 | 1440 | 1920 | 2560 | 3840 }) => Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }>;
        removeBackground: (inputId: string, options?: { outputFormat?: 'png' | 'webp' }) => Promise<{ success: boolean; outputPath: string; inputBytes: number; outputBytes: number }>;
        getBackgroundEditSources: (inputId: string, outputPath: string) => Promise<{ originalDataUrl: string; cutoutDataUrl: string }>;
        saveBackgroundEdit: (outputPath: string, dataUrl: string) => Promise<{ success: boolean; outputPath: string; outputBytes: number }>;
        showInFolder: (filePath: string) => Promise<void>;
      };
      document: {
        pageCount: (inputId: string) => Promise<number>;
        merge: (inputIds: string[]) => Promise<string>;
        split: (inputId: string, fromPage: number, toPage: number) => Promise<string>;
        markdownToPdf: (inputId: string) => Promise<string>;
        docxToHtml: (inputId: string) => Promise<string>;
        docxToText: (inputId: string) => Promise<string>;
        docxToPdf: (inputId: string) => Promise<string>;
        docxToMarkdown: (inputId: string) => Promise<string>;
        docxToJson: (inputId: string) => Promise<string>;
        pdfToText: (inputId: string) => Promise<string>;
        pdfToHtml: (inputId: string) => Promise<string>;
        pdfToDocx: (inputId: string) => Promise<string>;
        pdfToImages: (inputId: string) => Promise<string>;
        showInFolder: (filePath: string) => Promise<void>;
      };
    };
  }
}

// Extend File interface to include path (Electron specific)
declare global {
  interface File {
    path?: string;
  }
}
