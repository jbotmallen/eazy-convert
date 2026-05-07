import { Zap, ShieldCheck, Cpu, ArrowRight, Image as ImageIcon, Video, FileAudio, Youtube, HardDrive, Layers, Download, HelpCircle } from "lucide-react";
import { motion, easeInOut } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: easeInOut,
    },
  },
};

export function LandingPage() {
  const features = [
    {
      title: "100% Private",
      description: "Files are processed entirely on your machine. No cloud, no uploads, no leaks.",
      icon: ShieldCheck,
    },
    {
      title: "Optimized Speed",
      description: "Direct hardware access using multi-threaded FFmpeg for maximum performance.",
      icon: Zap,
    },
    {
      title: "Modern Engine",
      description: "Support for VP9, WebP, AV1, and high-fidelity audio codecs out of the box.",
      icon: Cpu,
    },
    {
      title: "Zero-Config",
      description: "No external dependencies. EazyConvert bundles its own professional-grade media engine.",
      icon: HardDrive,
    },
    {
      title: "Batch Engine",
      description: "Optimized for multi-core processors to handle multiple conversions simultaneously.",
      icon: Layers,
    },
    {
      title: "Direct Extraction",
      description: "Powerful YouTube stream extraction with automatic high-quality merging.",
      icon: Download,
    },
  ];

  const tools = [
    {
      to: "/images",
      label: "Image Pro",
      description: "Batch optimize PNG, JPG, WebP & TIFF",
      icon: ImageIcon,
      color: "bg-blue-500",
    },
    {
      to: "/videos",
      label: "Video Pro",
      description: "Convert MP4, MKV, MOV, AVI, and WebM",
      icon: Video,
      color: "bg-purple-500",
    },
    {
      to: "/audio",
      label: "Audio Pro",
      description: "Convert MP3, WAV, OGG, AAC, and FLAC",
      icon: FileAudio,
      color: "bg-orange-500",
    },
    {
      to: "/youtube",
      label: "YT Downloader",
      description: "Extract MP4 & MP3 from YouTube URLs",
      icon: Youtube,
      color: "bg-red-600",
    },
    {
      to: "/guide",
      label: "Setup Guide",
      description: "OS-specific installation & setup help",
      icon: HelpCircle,
      color: "bg-green-600",
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="flex flex-col"
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-transparent py-24 md:py-32">
        <div className="absolute inset-0 z-[-1] opacity-30">
          <div className="absolute top-0 right-0 h-125 w-125 translate-x-1/4 translate-y-[-1/4] rounded-full bg-primary/20 blur-[140px]" />
          <div className="absolute bottom-0 left-0 h-125 w-125 translate-x-[-1/4] translate-y-[1/4] rounded-full bg-primary/10 blur-[140px]" />
        </div>

        <div className="container mx-auto px-4 text-center">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-8">
            <Zap className="h-4 w-4 text-primary fill-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Version 1.0 Live</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="mb-6 text-6xl font-black tracking-tighter md:text-8xl italic uppercase leading-[0.9]">
            Convert <br />
            <span className="text-primary">Without Limits</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="mx-auto mb-10 max-w-4xl text-lg text-muted-foreground md:text-xl font-medium">
            EazyConvert is the professional-grade desktop utility for fast,
            private media conversion. No internet required.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/images">
              <Button size="lg" className="h-14 gap-2 text-lg px-10 font-bold shadow-xl shadow-primary/20">
                Start Converting <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/guide">
              <Button variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2">
                Setup Guide
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="bg-muted/10 py-24 border-y border-border/50">
        <div className="container mx-auto px-4">
          <motion.div variants={itemVariants} className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black tracking-tighter uppercase italic">The Toolset</h2>
            <p className="text-muted-foreground font-medium max-w-3xl mx-auto italic">
              Powerful media tools at your fingertips. No cloud, no limits.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <motion.div key={tool.label} variants={itemVariants}>
                <Link to={tool.to} className="group block h-full">
                  <Card className="h-full border-border bg-card/40 backdrop-blur-sm transition-all duration-300 group-hover:border-primary/50 group-hover:bg-accent/5 group-hover:shadow-2xl group-hover:shadow-primary/5">
                    <CardHeader>
                      <div className={tool.color + " w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-black/20 group-hover:scale-110 transition-transform"}>
                        <tool.icon className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-2xl font-black tracking-tight uppercase italic">{tool.label}</CardTitle>
                      <CardDescription className="text-base font-medium text-muted-foreground/80">{tool.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div key={feature.title} variants={itemVariants} className="flex flex-col items-center text-center">
                <div className="mb-8 rounded-2xl bg-primary/5 p-6 border border-primary/10">
                  <feature.icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mb-4 text-2xl font-black tracking-tight uppercase italic">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
