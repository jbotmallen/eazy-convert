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
  Pin,
  PinOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import logo from "/logo.png";
import { ThemeToggle } from "./ThemeToggle";
import { useProcessing } from "@/context/useProcessing";
import type { CSSProperties, ElementType } from "react";

type ElectronStyle = CSSProperties & { WebkitAppRegion?: "drag" | "no-drag" };
const noDragStyle: ElectronStyle = { WebkitAppRegion: "no-drag" };

interface NavSubItem {
  label: string;
  description: string;
  to: string;
  icon: ElementType;
  comingSoon?: boolean;
}

interface NavPanelItem {
  label: string;
  description: string;
  to: string;
  icon: ElementType;
  comingSoon?: boolean;
  subItems?: NavSubItem[];
}

interface NavSection {
  id: string;
  label: string;
  icon: ElementType;
  activePrefix: string;
  items: NavPanelItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "images",
    label: "Image Tools",
    icon: ImageIcon,
    activePrefix: "/images",
    items: [
      { label: "Image Converter", description: "Convert between PNG, JPG, WEBP, and more!", to: "/images", icon: RefreshCw },
      { label: "Images -> PDF", description: "Combine images into a PDF", to: "/images?to=pdf", icon: FileDown },
      { label: "Image Compressor", description: "Reduce file size without quality loss", to: "/images/compress", icon: Minimize2 },
      { label: "Background Remover", description: "Remove image backgrounds automatically", to: "/images/remove-background", icon: Eraser },
    ],
  },
  {
    id: "videos",
    label: "Video Tools",
    icon: Video,
    activePrefix: "/videos",
    items: [
      { label: "Video Converter", description: "Convert MP4, WEBM, AVI, MOV, MKV", to: "/videos", icon: RefreshCw },
      { label: "Video Trimmer", description: "Cut clips to the perfect length", to: "/videos/trim", icon: Scissors },
      { label: "Video Compressor", description: "Shrink file size without losing quality", to: "/videos/compress", icon: Minimize2 },
      { label: "Video Denoiser", description: "Remove background noise from video audio", to: "/videos/denoise", icon: Wand2 },
    ],
  },
  {
    id: "audio",
    label: "Audio Tools",
    icon: Music,
    activePrefix: "/audio",
    items: [
      { label: "Audio Converter", description: "Convert MP3, WAV, OGG, AAC, FLAC", to: "/audio", icon: RefreshCw },
      { label: "Audio Trimmer", description: "Cut audio to the perfect length", to: "/audio/trim", icon: Scissors },
      { label: "Audio Denoiser", description: "Remove background noise from recordings", to: "/audio/denoise", icon: Wand2 },
    ],
  },
  {
    id: "documents",
    label: "Document Tools",
    icon: FileText,
    activePrefix: "/documents",
    items: [
      {
        label: "PDF",
        description: "Convert, merge, and split PDF files",
        to: "#",
        icon: Layers,
        subItems: [
          { label: "PDF Converter", description: "Convert PDF to Text, HTML, Word or Images", to: "/documents/pdf", icon: RefreshCw },
          { label: "PDF Merger", description: "Combine multiple PDFs into one file", to: "/documents/merge", icon: FilePlus2 },
          { label: "PDF Splitter", description: "Extract a page range from a PDF", to: "/documents/split", icon: Scissors },
        ],
      },
      {
        label: "Word",
        description: "Convert Word documents to other formats",
        to: "#",
        icon: FileText,
        subItems: [
          { label: "Word Converter", description: "Convert DOCX to HTML, Text, PDF, Markdown, or JSON", to: "/documents/word", icon: FileCode2 },
        ],
      },
      {
        label: "Markdown",
        description: "Render Markdown files as PDF",
        to: "#",
        icon: Hash,
        subItems: [
          { label: "Markdown Converter", description: "Render .md as a styled PDF", to: "/documents/markdown-to-pdf", icon: FileDown },
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

function isItemActive(currentPath: string, item: NavPanelItem | NavSubItem) {
  if (item.to === "#") return false;
  return currentPath === item.to;
}

export function Navbar() {
  const location = useLocation();
  const { isProcessing } = useProcessing();
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sidebarExpanded = isPinned || isHovered;
  const currentPath = `${location.pathname}${location.search}`;

  const closePanel = () => {
    setOpenPanel(null);
    setOpenFlyout(null);
  };

  const closeAfterNavigate = () => {
    if (!isPinned) {
      closePanel();
    }
  };

  return (
    <motion.aside
      initial={{ x: -18, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed h-dvh left-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden border-r border-border/60 bg-background/92 shadow-2xl shadow-black/15 backdrop-blur-xl transition-[width] duration-300 ease-out",
        sidebarExpanded ? "w-64" : "w-18",
      )}
      style={noDragStyle}
    >

      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/40 px-3" style={noDragStyle}>
        <Link
          to="/app"
          onClick={(e) => {
            if (isProcessing) {
              e.preventDefault();
              return;
            }
            closeAfterNavigate();
          }}
          className={cn(
            "flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 transition-colors hover:bg-primary/5",
            isProcessing && "cursor-not-allowed opacity-40",
          )}
          title="KitBox"
        >
          <img src={logo} alt="KitBox" className="h-8 w-8 shrink-0 rounded-md border border-primary/25 bg-background p-0.5" />
          <span
            className={cn(
              "truncate text-sm font-black uppercase italic tracking-tight transition-opacity duration-200",
              sidebarExpanded ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            KitBox
          </span>
        </Link>

        <button
          type="button"
          aria-label={isPinned ? "Collapse sidebar" : "Pin sidebar"}
          title={isPinned ? "Collapse sidebar" : "Pin sidebar"}
          onClick={() => setIsPinned((pinned) => !pinned)}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/10 text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground",
            !sidebarExpanded && "hidden",
          )}
        >
          {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
      </div>

      <nav className="app-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2 py-3" aria-label="Primary navigation">
        <div className="space-y-1.5">
          {NAV_SECTIONS.map((section) => {
            const isActive = location.pathname.startsWith(section.activePrefix);
            const isOpen = openPanel === section.id;
            const SectionIcon = section.icon;

            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isProcessing) setOpenPanel((current) => (current === section.id ? null : section.id));
                  }}
                  disabled={isProcessing}
                  aria-expanded={isOpen}
                  title={section.label}
                  className={cn(
                    "group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    isProcessing && "cursor-not-allowed opacity-40",
                  )}
                >
                  <SectionIcon className="h-4.5 w-4.5 shrink-0" />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs font-black uppercase italic tracking-wide transition-opacity duration-200",
                      sidebarExpanded ? "opacity-100" : "pointer-events-none opacity-0",
                    )}
                  >
                    {section.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-200",
                      sidebarExpanded ? "opacity-100" : "opacity-0",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && sidebarExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 space-y-1">
                        {section.items.map((item) => (
                          <SidebarItem
                            key={item.label}
                            item={item}
                            isActive={isItemActive(currentPath, item)}
                            isProcessing={isProcessing}
                            currentPath={currentPath}
                            openFlyout={openFlyout}
                            setOpenFlyout={setOpenFlyout}
                            onNavigate={closeAfterNavigate}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-border/40 p-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="GitHub"
              onClick={() => window.api.openExternal("https://github.com/jbotmallen/eazy-convert")}
              className="flex h-9 shrink-0 items-center gap-3 rounded-lg border border-border bg-muted/10 px-2.5 text-muted-foreground transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95"
            >
              <Github className="h-4 w-4 shrink-0" />
            </button>
            <span
              className={cn(
                "min-w-0 truncate text-xs font-bold transition-opacity duration-200",
                sidebarExpanded ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              GitHub Source Code
            </span>
          </div>
          <div className="flex h-9 w-full items-center gap-3 rounded-lg">
            <ThemeToggle className="shrink-0" />
            <span
              className={cn(
                "min-w-0 truncate text-xs font-bold text-muted-foreground transition-opacity duration-200",
                sidebarExpanded ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              Toggle Themes
            </span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

interface SidebarItemProps {
  item: NavPanelItem;
  isActive: boolean;
  isProcessing: boolean;
  currentPath: string;
  openFlyout: string | null;
  setOpenFlyout: (label: string | null) => void;
  onNavigate: () => void;
}

function SidebarItem({
  item,
  isActive,
  isProcessing,
  currentPath,
  openFlyout,
  setOpenFlyout,
  onNavigate,
}: SidebarItemProps) {
  const ItemIcon = item.icon;
  const isOpen = openFlyout === item.label;

  if (item.subItems) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            if (!isProcessing) setOpenFlyout(isOpen ? null : item.label);
          }}
          disabled={isProcessing}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground",
            isProcessing && "cursor-not-allowed opacity-40",
          )}
        >
          <ItemIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold">{item.label}</span>
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-90")} />
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="ml-2 mt-1 space-y-1 border-l border-border/40 pl-2">
                {item.subItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const subIsActive = isItemActive(currentPath, sub);
                  return (
                    <Link
                      key={sub.label}
                      to={sub.to}
                      onClick={(e) => {
                        if (isProcessing || subIsActive) {
                          e.preventDefault();
                          return;
                        }
                        onNavigate();
                      }}
                      aria-current={subIsActive ? "page" : undefined}
                      tabIndex={subIsActive ? -1 : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                        subIsActive
                          ? "pointer-events-none cursor-default bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                        isProcessing && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{sub.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground/75">{sub.description}</p>
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

  if (item.comingSoon) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 opacity-40">
        <ItemIcon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-bold text-foreground">{item.label}</p>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">
              Soon
            </span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={(e) => {
        if (isProcessing || isActive) {
          e.preventDefault();
          return;
        }
        onNavigate();
      }}
      aria-current={isActive ? "page" : undefined}
      tabIndex={isActive ? -1 : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        isActive
          ? "pointer-events-none cursor-default bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
        isProcessing && "cursor-not-allowed opacity-40",
      )}
    >
      <ItemIcon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold">{item.label}</p>
        <p className="truncate text-[11px] text-muted-foreground/75">{item.description}</p>
      </div>
    </Link>
  );
}
