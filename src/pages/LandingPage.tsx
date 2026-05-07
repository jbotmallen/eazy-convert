import {
  ArrowRight,
  BadgeCheck,
  Download,
  FileAudio,
  FileText,
  Github,
  Image as ImageIcon,
  Linkedin,
  Mail,
  MonitorDown,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import heroImage from "../../public/main.png";
import logo from "../../public/logo.png";
import { cn } from "@/lib/utils";

const links = {
  release: "https://github.com/jbotmallen/eazy-convert/releases/tag/v1.0.0",
  repo: "https://github.com/jbotmallen/eazy-convert",
  github: "https://github.com/jbotmallen",
  linkedin: "https://www.linkedin.com/in/mark-allen-jugalbot-b60a5a1b6/",
  email: "mailto:markosallenus@gmail.com",
};

const features = [
  {
    title: "Local-first conversion",
    description: "Image, video, audio, PDF, Word, and Markdown work stays on your machine.",
    icon: ShieldCheck,
  },
  {
    title: "Built-in engines",
    description: "Bundled FFmpeg, PDF, DOCX, Markdown, and yt-dlp tooling means less setup.",
    icon: PackageCheck,
  },
  {
    title: "Focused workflows",
    description: "Batch conversion, document tools, and YouTube export live in one desktop app.",
    icon: MonitorDown,
  },
  {
    title: "Hardened desktop shell",
    description: "Sandboxed renderer, constrained IPC, and restrictive document windows by default.",
    icon: BadgeCheck,
  },
];

const formats = [
  { label: "Images", detail: "PNG, JPG, JPEG, WEBP", icon: ImageIcon },
  { label: "Video", detail: "MP4, WEBM, AVI, MOV, MKV", icon: Video },
  { label: "Audio", detail: "MP3, WAV, OGG, AAC, FLAC", icon: FileAudio },
  { label: "Docs", detail: "PDF, DOCX, Markdown", icon: FileText },
];

const roadmap = [
  "Cloud-safe web demo mode",
  "Image compression and background removal",
  "Video trimming and compression",
  "Audio splitting and denoise tools",
  "Signed releases with automated checksums",
];

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
};

interface LandingPageProps {
  landingOnly?: boolean;
}

export function LandingPage({ landingOnly = false }: LandingPageProps) {
  const { scrollYProgress } = useScroll();
  const heroShift = useTransform(scrollYProgress, [0, 0.35], [0, -42]);
  const imageScale = useTransform(scrollYProgress, [0, 0.35], [1, 0.96]);

  return (
    <div className="flex flex-col px-10">
      <section
        className={cn(
          "relative min-h-[calc(100svh-1rem)] overflow-hidden border-b border-border/60",
          landingOnly ? "pt-12 md:pt-16" : "-mt-18 pt-34",
        )}
      >
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImage}
            alt="EazyConvert desktop converter interface"
            className="h-full w-full object-cover opacity-28 dark:opacity-24"
          />
          <div className="absolute inset-0 bg-background/86 dark:bg-background/80" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-background to-transparent" />
        </div>

        <div className="container mx-auto grid min-h-[calc(100svh-8.5rem)] items-center gap-12 px-4 pb-16 lg:grid-cols-[0.88fr_1.12fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <img src={logo} alt="" className="h-12 w-12 rounded-lg border border-primary/25 bg-background/80 p-1" />
              <div>
                <p className="text-sm font-black uppercase italic tracking-tight">EazyConvert</p>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Version 1.0</p>
              </div>
            </div>

            <h1 className="max-w-4xl text-6xl font-black uppercase italic leading-[0.9] tracking-tighter md:text-8xl">
              Private desktop file conversion
            </h1>
            <p className="mt-7 max-w-2xl text-base font-medium leading-7 text-muted-foreground md:text-xl md:leading-8">
              Convert media and documents locally with a fast Electron app built around FFmpeg, PDF tooling, DOCX parsing, and Markdown export.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-13 gap-2 px-7 text-base font-black">
                <a href={links.release} target="_blank" rel="noreferrer">
                  <Download className="h-5 w-5" />
                  Download v1.0
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-13 gap-2 border-2 px-7 text-base font-black">
                <a href={links.repo} target="_blank" rel="noreferrer">
                  <Github className="h-5 w-5" />
                  View Source
                </a>
              </Button>
            </div>
          </motion.div>

          <motion.div style={{ y: heroShift, scale: imageScale }} className="hidden lg:block">
            <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card/30 shadow-2xl shadow-black/35">
              <img src={heroImage} alt="" className="w-full object-cover" />
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="border-b border-border/60 py-24"
      >
        <div className="container mx-auto px-4">
          <div className="mb-14 max-w-3xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-primary">Features</p>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter md:text-6xl">
              Built for local work, not cloud queues
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-background/92 p-6 transition-colors hover:bg-primary/5">
                  <Icon className="mb-8 h-8 w-8 text-primary" />
                  <h3 className="text-lg font-black uppercase italic tracking-tight">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="py-24"
      >
        <div className="container mx-auto grid gap-14 px-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-primary">Coverage</p>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter md:text-6xl">
              One app for common conversion paths
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Current release focuses on practical formats people use every day, with document utilities beside media conversion.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {formats.map((format, index) => {
              const Icon = format.icon;
              return (
                <motion.div
                  key={format.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06, duration: 0.35 }}
                  className="rounded-lg border border-border/70 bg-card/35 p-5"
                >
                  <Icon className="mb-10 h-6 w-6 text-primary" />
                  <p className="text-xl font-black uppercase italic tracking-tight">{format.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{format.detail}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="border-y border-border/60 bg-muted/10 py-24"
      >
        <div className="container mx-auto grid gap-12 px-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-primary">Future Roadmap</p>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter md:text-6xl">
              Next tools after desktop v1
            </h2>
          </div>

          <div className="divide-y divide-border/70 border-y border-border/70">
            {roadmap.map((item) => (
              <div key={item} className="flex items-center gap-4 py-5">
                <Wand2 className="h-5 w-5 shrink-0 text-primary" />
                <p className="text-base font-bold uppercase italic tracking-tight md:text-lg">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="py-24"
      >
        <div className="container mx-auto px-4">
          <div className="grid gap-10 rounded-lg border border-border/70 bg-card/30 p-6 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-primary">Contact Me</p>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter md:text-6xl">
                Want to report issue or request feature?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                Reach out by email, GitHub, or LinkedIn. No privacy or terms page is linked yet.
              </p>
            </div>

            <div className="flex flex-col justify-end gap-3 sm:min-w-64">
              <Button asChild className="h-12 justify-between gap-3 font-black">
                <a href={links.email}>
                  Email <Mail className="h-5 w-5" />
                </a>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-between gap-3 border-2 font-black">
                <a href={links.github} target="_blank" rel="noreferrer">
                  GitHub <Github className="h-5 w-5" />
                </a>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-between gap-3 border-2 font-black">
                <a href={links.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn <Linkedin className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          <a
            href={links.release}
            target="_blank"
            rel="noreferrer"
            className="group mt-10 inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary"
          >
            Download release build
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </motion.section>
    </div>
  );
}
