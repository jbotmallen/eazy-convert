import { ArrowRight, FileAudio, HelpCircle, Image as ImageIcon, Video, Youtube } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const tools = [
  {
    to: "/images",
    label: "Image Converter",
    description: "Convert PNG, JPG, JPEG, and WEBP files locally.",
    icon: ImageIcon,
  },
  {
    to: "/videos",
    label: "Video Converter",
    description: "Convert MP4, WEBM, AVI, MOV, and MKV with FFmpeg.",
    icon: Video,
  },
  {
    to: "/audio",
    label: "Audio Converter",
    description: "Convert MP3, WAV, OGG, AAC, FLAC, and M4A.",
    icon: FileAudio,
  },
  {
    to: "/youtube",
    label: "YouTube Downloader",
    description: "Save supported YouTube media for lawful personal use.",
    icon: Youtube,
  },
  {
    to: "/guide",
    label: "Setup Guide",
    description: "Install help, dependency notes, and platform guidance.",
    icon: HelpCircle,
  },
];

export function AppHomePage() {
  return (
    <section className="container mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-5xl"
      >
        <div className="mb-12 max-w-3xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-primary">
            Desktop workspace
          </p>
          <h1 className="text-5xl font-black uppercase italic leading-none tracking-tighter md:text-7xl">
            Pick converter
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-muted-foreground md:text-lg">
            Local tools for private media and document conversion. Files stay on your machine.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <motion.div
                key={tool.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * index, duration: 0.35 }}
              >
                <Link
                  to={tool.to}
                  className="group flex min-h-34 items-start gap-4 rounded-lg border border-border/70 bg-card/35 p-5 transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-black uppercase italic tracking-tight">
                      {tool.label}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      {tool.description}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10">
          <Button asChild variant="outline" className="border-2 font-bold">
            <Link to="/">View public landing page</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
