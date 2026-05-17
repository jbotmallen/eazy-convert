import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Monitor, Apple, HardDrive, CheckCircle2, Info, ArrowRight, HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "mac", label: "macOS", icon: Apple },
  { id: "linux", label: "Linux", icon: Terminal },
  { id: "faq", label: "FAQ", icon: HelpCircle },
];

const GUIDES = {
  windows: {
    steps: [
      "Download the KitBox-Setup-1.0.0.exe from our releases page.",
      "Double-click the installer. If Windows SmartScreen appears, click 'More Info' then 'Run anyway'.",
      "Follow the installation wizard to completion.",
      "Launch KitBox from your desktop—FFmpeg is already built-in and ready!",
    ],
    requirements: ["Windows 10 or 11 (64-bit)", "4GB RAM recommended", "200MB Disk Space"],
  },
  mac: {
    steps: [
      "Download KitBox-1.0.0.dmg for your architecture (Intel or Apple Silicon).",
      "Drag KitBox.app to your Applications folder.",
      "Right-click the app and select 'Open' to bypass the unidentified developer warning.",
      "The app is ready to use—no extra drivers or libraries required.",
    ],
    requirements: ["macOS 11.0 or later", "Apple Silicon (M1/M2/M3) or Intel", "150MB Disk Space"],
  },
  linux: {
    steps: [
      "Download the KitBox-1.0.0.AppImage file.",
      "Right-click the file, go to Properties > Permissions, and check 'Allow executing file as program'.",
      "Double-click to run. No installation or 'sudo' commands needed!",
      "Everything (including FFmpeg) is contained within the single AppImage file.",
    ],
    requirements: ["Ubuntu 20.04+, Fedora 34+, or Arch Linux", "FUSE installed (standard on most distros)", "100MB Disk Space"],
  },
};

type FAQItem = {
  q: string;
  a: string;
  detail?: string;
  link?: { label: string; url: string };
};

const FAQ_SECTIONS: { title: string; questions: FAQItem[] }[] = [
  {
    title: "General",
    questions: [
      {
        q: "Do I need to install anything extra?",
        a: "Nope. Just install and launch — everything is already included.",
        detail: "KitBox ships with its own self-contained build of FFmpeg (the engine that does the actual conversion work) baked directly into the app package. It never writes to your system PATH or conflicts with any FFmpeg you may have installed separately.",
      },
      {
        q: "Is my data private?",
        a: "Yes. Your files are processed entirely on your device and never sent anywhere.",
        detail: "KitBox makes zero outbound connections during file conversion. There is no telemetry, no cloud processing, and no analytics. You can verify this yourself by running it while offline — conversions work identically with no internet connection.",
      },
      {
        q: "Does it work without internet?",
        a: "For everything except YouTube downloads — yes, it's fully offline.",
        detail: "File conversion uses only your CPU and the bundled FFmpeg engine. The YouTube Downloader is the only feature that needs internet, because it must contact YouTube's servers to retrieve the video stream URL before downloading.",
      },
    ],
  },
  {
    title: "Windows",
    questions: [
      {
        q: "What is the SmartScreen warning?",
        a: "A Windows safety check for apps not from the Microsoft Store. It's normal — click 'More Info' then 'Run anyway'.",
        detail: "Windows SmartScreen flags apps that haven't built up enough download reputation in Microsoft's database. Indie apps distributed outside the Microsoft Store always trigger this. It's the same warning you'd see for most open-source software. It does not mean the app is harmful.",
      },
      {
        q: "My YouTube download failed — what do I do?",
        a: "Most likely a missing Windows component. Install the Visual C++ Redistributable below and try again.",
        detail: "The YouTube downloader bundled with KitBox is a native Windows binary compiled with Microsoft's C++ runtime. On fresh Windows installs or lean systems, this runtime may not be present. It's a free Microsoft package that many Windows apps require.",
        link: { label: "Download Visual C++ Redistributable (Microsoft)", url: "https://aka.ms/vs/17/release/vc_redist.x64.exe" },
      },
      {
        q: "Does installation need admin access?",
        a: "Yes, but only once during setup. After that, it runs like any normal app.",
        detail: "The installer writes files to Program Files and registers an entry in Add/Remove Programs — both require administrator rights. Once installed, KitBox runs entirely under your standard user account with no elevated permissions needed.",
      },
    ],
  },
  {
    title: "macOS",
    questions: [
      {
        q: "Mac says it can't verify the app — is it safe?",
        a: "Yes. macOS shows this for any app not from the App Store. Right-click → Open → Open again to run it.",
        detail: "Apple Gatekeeper blocks apps that aren't notarized through Apple's paid developer program ($99/year). This is a distribution cost barrier, not a security verdict. Right-clicking to open explicitly tells macOS you trust this app, bypassing the automatic block for all future launches.",
      },
      {
        q: "Does it work on newer Macs?",
        a: "Yes — it runs natively on both Apple Silicon (M-series) and older Intel Macs.",
        detail: "The app is distributed as a universal binary, meaning a single download contains two compiled versions: one for Apple Silicon (ARM64) and one for Intel (x86_64). macOS automatically picks the right one for your hardware with no extra setup.",
      },
    ],
  },
  {
    title: "Linux",
    questions: [
      {
        q: "The AppImage won't open — how do I fix it?",
        a: "Make the file executable first, or install a small system library called FUSE.",
        detail: "AppImages mount themselves as a virtual filesystem using FUSE (Filesystem in Userspace). On Ubuntu/Debian run: sudo apt install libfuse2. On Fedora: sudo dnf install fuse. To mark the file executable without a terminal: right-click → Properties → Permissions → 'Allow executing as program'.",
      },
      {
        q: "Is conversion fast on Linux?",
        a: "Yes. It uses your GPU automatically when available, and falls back to CPU otherwise.",
        detail: "KitBox attempts to use VA-API (Intel/AMD GPUs) or NVENC (NVIDIA GPUs) for hardware-accelerated video encoding. If your drivers don't expose these interfaces, it falls back to multi-threaded software encoding using libx264 or libvpx. No configuration needed.",
      },
    ],
  },
];

const AccordionItem = ({
  question,
  answer,
  detail,
  link,
}: {
  question: string;
  answer: string;
  detail?: string;
  link?: { label: string; url: string };
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const handleToggle = () => {
    if (isOpen) setShowDetail(false);
    setIsOpen(!isOpen);
  };

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between py-4 text-left hover:text-primary transition-colors group"
      >
        <span className="text-sm font-bold uppercase tracking-tight italic">{question}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 ml-3 transition-transform duration-300 text-muted-foreground", isOpen && "rotate-180 text-primary")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {answer}
              </p>

              {link && (
                <button
                  onClick={() => window.api.openExternal(link.url)}
                  className="text-sm text-primary hover:underline font-bold text-left"
                >
                  {link.label} →
                </button>
              )}

              {detail && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowDetail(!showDetail)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                  >
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", showDetail && "rotate-180")} />
                    {showDetail ? "Show less" : "Show more"}
                  </button>

                  <AnimatePresence>
                    {showDetail && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-muted-foreground/80 leading-relaxed bg-muted/40 rounded-xl p-3 border border-border/30">
                          {detail}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function GuidePage() {
  const [activeTab, setActiveTab] = useState("windows");

  return (
    <div className="container relative z-10 mx-auto max-w-6xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <h1 className="mb-4 text-5xl font-black tracking-tighter uppercase italic text-primary">
          Guide & Support
        </h1>
        <p className="text-lg font-medium text-muted-foreground italic">
          Everything you need to master KitBox.
        </p>
      </motion.div>

      <div className="flex flex-col gap-8">
        {/* Tabs */}
        <div className="flex justify-center gap-2 p-1 bg-muted/30 rounded-2xl border border-border/50 backdrop-blur-sm self-center">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-background rounded-xl shadow-lg shadow-black/5 border border-border/50"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "faq" ? (
            <motion.div
              key="faq"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              {FAQ_SECTIONS.map((section) => (
                <div key={section.title} className="bg-card/40 border border-border/50 rounded-3xl p-8 shadow-xl backdrop-blur-md h-fit">
                  <h3 className="text-xl font-black uppercase italic mb-6 text-primary flex items-center gap-3">
                    <div className="h-2 w-2 bg-primary rounded-full" />
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.questions.map((faq, idx) => (
                      <AccordionItem
                        key={idx}
                        question={faq.q}
                        answer={faq.a}
                        detail={faq.detail}
                        link={faq.link}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <div className="md:col-span-2 space-y-8">
                <div className="bg-card/40 border border-border/50 rounded-3xl p-8 shadow-xl backdrop-blur-md">
                  <h3 className="flex items-center gap-3 text-2xl font-black uppercase italic mb-8">
                    <HardDrive className="h-6 w-6 text-primary" />
                    Installation Steps
                  </h3>
                  <div className="space-y-6">
                    {GUIDES[activeTab as keyof typeof GUIDES].steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 group">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {idx + 1}
                        </div>
                        <p className="text-foreground/80 font-medium leading-relaxed pt-1">
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 shadow-lg">
                  <h3 className="flex items-center gap-3 text-xl font-black uppercase italic mb-6">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Requirements
                  </h3>
                  <ul className="space-y-4">
                    {GUIDES[activeTab as keyof typeof GUIDES].requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                        <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/30 border border-border/50 rounded-3xl p-8">
                  <h3 className="flex items-center gap-3 text-xl font-black uppercase italic mb-4">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    Built-in Engine
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground italic leading-relaxed">
                    KitBox uses a specialized internal version of FFmpeg. You don't need to download anything else to start converting.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
