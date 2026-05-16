import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Youtube, Download, Loader2, CheckCircle, ExternalLink, AlertTriangle, FileOutput, Gauge, Link } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useProcessing } from "@/context/useProcessing";
import { showErrorToast, showSuccessToast } from "@/lib/utils";

const DEP_DOWNLOAD_URLS: Record<string, string> = {
  "Visual C++ Redistributable 2019+": "https://aka.ms/vs/17/release/vc_redist.x64.exe",
};

export function YoutubeDownloaderPage() {
  const [searchParams] = useSearchParams();
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"mp4" | "mp3">(() => {
    const p = searchParams.get("format");
    return p === "mp3" ? "mp3" : "mp4";
  });
  const [status, setStatus] = useState<"idle" | "downloading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [depCheck, setDepCheck] = useState<{ ok: boolean; missing?: string } | null>(null);
  const [quality, setQuality] = useState("best");
  const [ytFormats, setYtFormats] = useState<number[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const { setIsProcessing } = useProcessing();
  const cancelledRef = useRef(false);
  const formatsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    window.api.checkYtDlp().then(setDepCheck);
  }, []);

  useEffect(() => {
    const removeListener = window.api.onProgress((p: number) => {
      setProgress(p);
    });
    return () => removeListener();
  }, []);

  const resetFormats = useCallback(() => {
    setYtFormats([]);
    setQuality("best");
    setLoadingFormats(false);
    formatsAbortRef.current?.abort();
  }, []);

  // Debounced fetch of available qualities when URL + mp4 format changes
  useEffect(() => {
    const isYtUrl = /youtu/.test(url);
    if (!url || format !== "mp4" || !isYtUrl) {
      resetFormats();
      return;
    }

    formatsAbortRef.current?.abort();
    const controller = new AbortController();
    formatsAbortRef.current = controller;
    setLoadingFormats(true);
    setYtFormats([]);

    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      try {
        const formats = await window.api.getYtFormats(url);
        if (controller.signal.aborted) return;
        setYtFormats(formats);
        setQuality(formats.length > 0 ? String(formats[formats.length - 1]) : "best");
      } catch {
        if (!controller.signal.aborted) resetFormats();
      } finally {
        if (!controller.signal.aborted) setLoadingFormats(false);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, format, resetFormats]);

  const handleCancel = () => {
    cancelledRef.current = true;
    window.api.cancelDownload();
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      showErrorToast("Please enter a YouTube URL.");
      return;
    }

    cancelledRef.current = false;
    setIsProcessing(true);
    setStatus("downloading");
    setProgress(0);

    try {
      const result = await window.api.downloadYoutube(url, format, quality);
      if (result.success) {
        setStatus("success");
        showSuccessToast("Saved to your Downloads folder.");
        setUrl("");
      }
    } catch (error: unknown) {
      if (cancelledRef.current) {
        setStatus("idle");
        setProgress(0);
      } else {
        setStatus("error");
        showErrorToast(error, "Download failed.");
        setProgress(0);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const depDownloadUrl = depCheck?.missing ? DEP_DOWNLOAD_URLS[depCheck.missing] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-16"
    >
      <Card className="w-full border-border bg-card/40 shadow-2xl backdrop-blur-md overflow-hidden font-sans">
        <CardHeader className="text-center pb-8 border-b border-border/50 bg-muted/5">
          <CardTitle className="text-4xl font-black tracking-tighter uppercase italic text-primary flex items-center justify-center gap-3">
            <Youtube className="h-10 w-10" />
            YT Downloader
          </CardTitle>
          <CardDescription className="text-base font-medium max-w-md mx-auto italic">
            Extract high-quality video or audio directly from YouTube URLs.
          </CardDescription>
        </CardHeader>

        {depCheck?.ok === false ? (
          <CardContent className="pt-10 pb-10">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="rounded-2xl bg-destructive/10 p-5 shadow-lg">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold tracking-tight">Missing Dependency</p>
                <p className="text-muted-foreground">
                  The YT Downloader requires{" "}
                  <span className="font-bold text-foreground">{depCheck.missing}</span>{" "}
                  to run on Windows.
                </p>
              </div>
              <Button
                size="lg"
                className="h-14 px-8 font-black uppercase italic tracking-tighter"
                disabled={!depDownloadUrl}
                onClick={() => { if (depDownloadUrl) window.api.openExternal(depDownloadUrl); }}
              >
                <ExternalLink className="h-5 w-5 mr-2" />
                Download {depCheck.missing}
              </Button>
              <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-widest">
                Install it, then restart the app.
              </p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="pt-10">
            <form onSubmit={handleDownload} className="space-y-10">
              <div className="space-y-4">
                <FieldLabel icon={Link}>YouTube URL</FieldLabel>
                <div className="relative">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-14 text-lg border-2"
                    disabled={status === "downloading"}
                  />
                  <ExternalLink className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                </div>
              </div>

              <div className={format === "mp4" ? "grid grid-cols-2 gap-4" : ""}>
                <div className="space-y-2">
                  <FieldLabel icon={FileOutput}>Output Format</FieldLabel>
                  <Select
                    value={format}
                    onValueChange={(value) => setFormat(value as "mp4" | "mp3")}
                    disabled={status === "downloading"}
                  >
                    <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                      <SelectItem value="mp4" className="font-bold uppercase italic py-3 cursor-pointer">MP4 — Best Video + Audio</SelectItem>
                      <SelectItem value="mp3" className="font-bold uppercase italic py-3 cursor-pointer">MP3 — High Quality Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {format === "mp4" && (
                  <div className="space-y-2">
                    <FieldLabel icon={Gauge}>Output Quality</FieldLabel>
                    <Select
                      value={quality}
                      onValueChange={setQuality}
                      disabled={status === "downloading" || loadingFormats}
                    >
                      <SelectTrigger className="h-14 text-lg font-bold border-2 uppercase italic bg-transparent">
                        {loadingFormats ? (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Fetching...</span>
                          </span>
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent className="bg-card/90 backdrop-blur-xl border-2">
                        <SelectItem value="best" className="font-bold uppercase italic py-3 cursor-pointer">
                          Best Available
                        </SelectItem>
                        {[...ytFormats].reverse().map((h) => (
                          <SelectItem key={h} value={String(h)} className="font-bold uppercase italic py-3 cursor-pointer">
                            {h}p
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {status === "downloading" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                      <span>Engine Active</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 shadow-lg shadow-primary/10" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className={`h-16 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] ${status === "downloading" ? "flex-1" : "w-full"}`}
                  disabled={status === "downloading" || !url}
                >
                  {status === "downloading" ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Extracting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Download className="h-6 w-6" />
                      Execute Download
                    </div>
                  )}
                </Button>

                <AnimatePresence>
                  {status === "downloading" && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <Button
                        type="button"
                        variant="destructive"
                        size="lg"
                        className="h-16 px-8 font-black uppercase italic tracking-tighter"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </CardContent>
        )}

        <CardFooter className="justify-center border-t border-border/50 bg-muted/10 py-8">
          <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 text-center px-4">
            <CheckCircle className="h-4 w-4 text-primary" />
            Powered by yt-dlp & FFmpeg — Private & Fast
          </p>
        </CardFooter>
      </Card>

    </motion.div>
  );
}
