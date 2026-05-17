import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LandingPage } from "@/pages/LandingPage";
import { AppHomePage } from "@/pages/AppHomePage";
import { ImageConverterPage } from "@/pages/ImageConverterPage";
import { ImageCompressorPage } from "@/pages/ImageCompressorPage";
import { ImageBackgroundRemoverPage } from "@/pages/ImageBackgroundRemoverPage";
import { VideoConverterPage } from "@/pages/VideoConverterPage";
import { VideoTrimmerPage } from "@/pages/VideoTrimmerPage";
import { VideoCompressorPage } from "@/pages/VideoCompressorPage";
import { AudioConverterPage } from "@/pages/AudioConverterPage";
import { AudioTrimmerPage } from "@/pages/AudioTrimmerPage";
import { AudioDenoiserPage } from "@/pages/AudioDenoiserPage";
import { VideoDenoiserPage } from "@/pages/VideoDenoiserPage";
import { YoutubeDownloaderPage } from "@/pages/YoutubeDownloaderPage";
import { GuidePage } from "@/pages/GuidePage";
import { MergePdfPage } from "@/pages/documents/MergePdfPage";
import { SplitPdfPage } from "@/pages/documents/SplitPdfPage";
import { MarkdownToPdfPage } from "@/pages/documents/MarkdownToPdfPage";
import { WordConverterPage } from "@/pages/documents/WordConverterPage";
import { PdfConverterPage } from "@/pages/documents/PdfConverterPage";
import { BackgroundLayout } from "@/components/ui/background-layout";
import { Toaster } from "@/components/ui/sonner";
import { FloatingFAQ } from "@/components/FloatingFAQ";
import { ProcessingProvider } from "@/context/ProcessingProvider";

const landingOnly = import.meta.env.VITE_LANDING_ONLY === "true";

function App() {
  if (landingOnly) {
    return (
      <Router>
        <BackgroundLayout>
          <main className="flex-1">
            <Routes>
              <Route path="*" element={<LandingPage landingOnly />} />
            </Routes>
          </main>
        </BackgroundLayout>
      </Router>
    );
  }

  return (
    <ProcessingProvider>
      <Router>
        <BackgroundLayout>
          <Navbar />
          <div className="flex min-h-screen flex-col pl-18">
            <main className="flex-1 pb-5">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/app" element={<AppHomePage />} />
                <Route path="/images" element={<ImageConverterPage />} />
                <Route path="/images/compress" element={<ImageCompressorPage />} />
                <Route path="/images/remove-background" element={<ImageBackgroundRemoverPage />} />
                <Route path="/videos" element={<VideoConverterPage />} />
                <Route path="/videos/trim" element={<VideoTrimmerPage />} />
                <Route path="/videos/compress" element={<VideoCompressorPage />} />
                <Route path="/videos/denoise" element={<VideoDenoiserPage />} />
                <Route path="/audio" element={<AudioConverterPage />} />
                <Route path="/audio/trim" element={<AudioTrimmerPage />} />
                <Route path="/audio/denoise" element={<AudioDenoiserPage />} />
                <Route path="/youtube" element={<YoutubeDownloaderPage />} />
                <Route path="/documents" element={<Navigate to="/documents/merge" replace />} />
                <Route path="/documents/merge" element={<MergePdfPage />} />
                <Route path="/documents/split" element={<SplitPdfPage />} />
                <Route path="/documents/markdown-to-pdf" element={<MarkdownToPdfPage />} />
                <Route path="/documents/word" element={<WordConverterPage />} />
                <Route path="/documents/pdf" element={<PdfConverterPage />} />
                <Route path="/documents/convert" element={<Navigate to="/documents/word" replace />} />
                <Route path="/guide" element={<GuidePage />} />
              </Routes>
            </main>
            <Footer />
          </div>
          <FloatingFAQ />
          <Toaster position="top-center" richColors />
        </BackgroundLayout>
      </Router>
    </ProcessingProvider>
  );
}

export default App;
