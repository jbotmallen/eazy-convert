import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Image as ImageIcon,
  Video,
  Music,
  Youtube,
  FileText,
  FilePlus2,
  Scissors,
  FileDown,
  FileCode2,
  RefreshCw,
  Minimize2,
  Eraser,
  Wand2,
  Github,
  ChevronDown,
  ChevronRight,
  Layers,
  Hash,
  AlignLeft,
  FileJson2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import logo from "../../public/logo.png";
import { ThemeToggle } from "./ThemeToggle";
import { useProcessing } from "@/context/useProcessing";
import type { CSSProperties } from "react";

type ElectronStyle = CSSProperties & { WebkitAppRegion?: "drag" | "no-drag" };
const dragStyle: ElectronStyle = { WebkitAppRegion: "drag" };
const noDragStyle: ElectronStyle = { WebkitAppRegion: "no-drag" };

interface NavSubItem {
  label: string;
  description: string;
  to: string;
  icon: React.ElementType;
  comingSoon?: boolean;
}

interface NavPanelItem {
  label: string;
  description: string;
  to: string;
  icon: React.ElementType;
  comingSoon?: boolean;
  subItems?: NavSubItem[];
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  activePrefix: string;
  items: NavPanelItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "images",
    label: "Images",
    icon: ImageIcon,
    activePrefix: "/images",
    items: [
      { label: "Image Converter", description: "Convert between PNG, JPG, WEBP, BMP", to: "/images", icon: RefreshCw },
      { label: "Image Compressor", description: "Reduce file size without quality loss", to: "#", icon: Minimize2, comingSoon: true },
      { label: "Background Remover", description: "Remove image backgrounds automatically", to: "#", icon: Eraser, comingSoon: true },
    ],
  },
  {
    id: "videos",
    label: "Videos",
    icon: Video,
    activePrefix: "/videos",
    items: [
      { label: "Video Converter", description: "Convert MP4, WEBM, AVI, MOV, MKV", to: "/videos", icon: RefreshCw },
      { label: "Video Trimmer", description: "Cut clips to the perfect length", to: "#", icon: Scissors, comingSoon: true },
      { label: "Video Compressor", description: "Shrink file size without losing quality", to: "#", icon: Minimize2, comingSoon: true },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    icon: Music,
    activePrefix: "/audio",
    items: [
      { label: "Audio Converter", description: "Convert MP3, WAV, OGG, AAC, FLAC", to: "/audio", icon: RefreshCw },
      { label: "Audio Splitter", description: "Split audio by timestamps", to: "#", icon: Scissors, comingSoon: true },
      { label: "Audio Denoiser", description: "Remove background noise from recordings", to: "#", icon: Wand2, comingSoon: true },
    ],
  },
  {
    id: "documents",
    label: "Docs",
    icon: FileText,
    activePrefix: "/documents",
    items: [
      {
        label: "PDF",
        description: "Merge, split and build PDF files",
        to: "#",
        icon: Layers,
        subItems: [
          { label: "PDF Converter",  description: "Convert PDF to Text, HTML, Word or Images", to: "/documents/pdf",           icon: RefreshCw  },
          { label: "Merge PDFs",     description: "Combine multiple PDFs into one file",        to: "/documents/merge",        icon: FilePlus2  },
          { label: "Split PDF",      description: "Extract a page range from a PDF",             to: "/documents/split",        icon: Scissors   },
          { label: "Images → PDF",   description: "Pack images into a single PDF",               to: "/documents/images-to-pdf", icon: ImageIcon },
        ],
      },
      {
        label: "Word",
        description: "Convert Word documents to other formats",
        to: "#",
        icon: FileText,
        subItems: [
          { label: "DOCX → HTML",     description: "Export as a web-ready HTML file",   to: "/documents/word?to=html",     icon: FileCode2  },
          { label: "DOCX → Text",     description: "Extract plain text content",         to: "/documents/word?to=text",     icon: AlignLeft  },
          { label: "DOCX → PDF",      description: "Export as a print-ready PDF",        to: "/documents/word?to=pdf",      icon: FileDown   },
          { label: "DOCX → Markdown", description: "Convert to Markdown format",         to: "/documents/word?to=markdown", icon: Hash       },
          { label: "DOCX → JSON",     description: "Structured JSON of the document",    to: "/documents/word?to=json",     icon: FileJson2  },
        ],
      },
      {
        label: "Markdown",
        description: "Render Markdown files as PDF",
        to: "#",
        icon: Hash,
        subItems: [
          { label: "Markdown → PDF", description: "Render .md as a styled PDF", to: "/documents/markdown-to-pdf", icon: FileDown },
        ],
      },
    ],
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    activePrefix: "/youtube",
    items: [
      { label: "Download Video", description: "Save YouTube videos as MP4", to: "/youtube?format=mp4", icon: Video },
      { label: "Download Audio", description: "Extract audio as MP3", to: "/youtube?format=mp3", icon: Music },
    ],
  },
];

export function Navbar() {
  const location = useLocation();
  const { isProcessing } = useProcessing();
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);

  const closePanel = () => {
    setOpenPanel(null);
    setOpenFlyout(null);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center">
      {/* Draggable title bar */}
      <div
        className="w-full h-10 flex items-center px-4 bg-background/40 backdrop-blur-sm border-b border-border/50"
        style={dragStyle}
      >
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 italic">
            EazyConvert Desktop
          </span>
        </div>
      </div>

      {/* Nav bar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between w-full max-w-4xl h-14 px-4 mt-4 rounded-2xl border-4 border-dotted border-border/80 bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/20"
        style={noDragStyle}
      >
        {/* Logo */}
        <Link
          to="/app"
          onClick={(e) => { if (isProcessing) e.preventDefault(); }}
          className={cn(
            "flex items-center gap-2 min-w-28",
            isProcessing && "opacity-40 cursor-not-allowed",
          )}
        >
          <div className="shadow-md shadow-primary/20 p-1 rounded-lg">
            <img src={logo} alt="EazyConvert" className="h-7 w-7 shrink-0 rounded-sm border-2 border-primary/20" />
          </div>
          <span className="text-sm font-black tracking-tighter uppercase italic hidden sm:block">
            EazyConvert
          </span>
        </Link>

        {/* Nav sections */}
        <div className="flex items-center gap-0.5">
          {NAV_SECTIONS.map((section) => {
            const isActive = location.pathname.startsWith(section.activePrefix);
            const isOpen = openPanel === section.id;
            const SectionIcon = section.icon;

            return (
              <div
                key={section.id}
                className="relative"
                onMouseEnter={() => { if (!isProcessing) setOpenPanel(section.id); }}
                onMouseLeave={closePanel}
              >
                {/* Section button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isProcessing) setOpenPanel((p) => (p === section.id ? null : section.id));
                  }}
                  className={cn(
                    "group relative flex items-center gap-1.5 h-9 px-2.5 rounded-xl transition-all duration-500",
                    "text-[11px] font-black uppercase italic tracking-wider",
                    isActive
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    isProcessing && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <SectionIcon className="h-3.5 w-3.5 shrink-0" />

                  {/* Label + chevron expand on hover or while panel is open */}
                  <span
                    className={cn(
                      "flex items-center gap-0.5 overflow-hidden whitespace-nowrap transition-all duration-500",
                      isOpen || isActive
                        ? "max-w-xs opacity-100 duration-500 transition-all"
                        : "max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100",
                    )}
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-500",
                        isOpen && "rotate-180",
                      )}
                    />
                  </span>

                  {/* Active underline dot */}
                  {isActive && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
                  )}
                </button>

                {/* Dropdown panel */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-1.5 z-50"
                    >
                      {/* Panel header */}
                      <div className="flex items-center gap-2 px-3 py-2 mb-0.5">
                        <SectionIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                          {section.label}
                        </span>
                      </div>

                      {/* Panel items */}
                      {section.items.map((item, idx) => {
                        const ItemIcon = item.icon;
                        const prevItem = section.items[idx - 1];
                        const showSeparator = item.comingSoon && prevItem && !prevItem.comingSoon;

                        // Flyout item (has subItems)
                        if (item.subItems) {
                          return (
                            <div
                              key={item.label}
                              className="relative"
                              onMouseEnter={() => setOpenFlyout(item.label)}
                              onMouseLeave={() => setOpenFlyout(null)}
                            >
                              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground group transition-colors cursor-default select-none">
                                <ItemIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold group-hover:text-primary transition-colors truncate">
                                    {item.label}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                                </div>
                                <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                              </div>

                              {/* Flyout panel — pl-2 creates a hover bridge so mouse can reach it */}
                              <AnimatePresence>
                                {openFlyout === item.label && (
                                  <motion.div
                                    initial={{ opacity: 0, x: -6, scale: 0.97 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -6, scale: 0.97 }}
                                    transition={{ duration: 0.12, ease: "easeOut" }}
                                    className="absolute left-full top-0 pl-2 z-50"
                                  >
                                    <div className="w-64 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-1.5">
                                      {/* Flyout header */}
                                      <div className="flex items-center gap-2 px-3 py-2 mb-0.5">
                                        <ItemIcon className="h-3.5 w-3.5 text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                          {item.label}
                                        </span>
                                      </div>

                                      {item.subItems.map((sub) => {
                                        const SubIcon = sub.icon;
                                        return (
                                          <Link
                                            key={sub.label}
                                            to={sub.to}
                                            onClick={closePanel}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground group transition-colors"
                                          >
                                            <SubIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-bold group-hover:text-primary transition-colors truncate">
                                                {sub.label}
                                              </p>
                                              <p className="text-[11px] text-muted-foreground truncate">{sub.description}</p>
                                            </div>
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        }

                        // Regular item
                        return (
                          <div key={item.label}>
                            {showSeparator && (
                              <div className="my-1.5 mx-3 border-t border-border/40" />
                            )}

                            {item.comingSoon ? (
                              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-40 cursor-not-allowed select-none">
                                <ItemIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-foreground truncate">{item.label}</p>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                      Soon
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                                </div>
                              </div>
                            ) : (
                              <Link
                                to={item.to}
                                onClick={closePanel}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground group transition-colors"
                              >
                                <ItemIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold group-hover:text-primary transition-colors truncate">
                                    {item.label}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                                </div>
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Right: GitHub + Theme */}
        <div className="flex justify-end min-w-28 gap-2">
          <Link
            to="https://github.com/jbotmallen/eazy-convert"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-muted/10 hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all active:scale-95 shadow-lg shadow-black/10"
          >
            <Github className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </div>
      </motion.nav>
    </div>
  );
}
