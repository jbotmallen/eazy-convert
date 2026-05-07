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
      document: {
        pageCount: (inputId: string) => Promise<number>;
        merge: (inputIds: string[]) => Promise<string>;
        split: (inputId: string, fromPage: number, toPage: number) => Promise<string>;
        imagesToPdf: (imageIds: string[]) => Promise<string>;
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
