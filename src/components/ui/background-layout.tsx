export function BackgroundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-background overflow-x-hidden">
      {/* Aceternity-style Grid Background */}
      <div className="absolute inset-0 z-0 h-full w-full bg-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[40px_40px] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)]" />

      {/* Radial Gradients for Depth */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-125 w-125 -translate-y-1/2 rounded-full bg-primary/10 dark:bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-125 w-125 translate-y-1/2 rounded-full bg-primary/10 dark:bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
