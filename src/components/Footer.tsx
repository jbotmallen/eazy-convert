import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-md py-12 mt-auto relative z-20">
      <div className="container mx-auto px-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5 text-center md:text-left">
          <div className="col-span-2 space-y-4 flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-lg" />
              <span className="font-black tracking-tighter uppercase italic">KitBox</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Powerful, private, and insanely fast file conversion.
              Built for pros who value security and simplicity.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-primary/80">Convert</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/images" className="hover:text-primary transition-colors">Image Tool</Link></li>
              <li><Link to="/videos" className="hover:text-primary transition-colors">Video Tool</Link></li>
              <li><Link to="/audio" className="hover:text-primary transition-colors">Audio Tool</Link></li>
            </ul>
          </div>

           <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-primary/80">Download</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/youtube" className="hover:text-primary transition-colors">Youtube</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-primary/80">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Privacy-First</li>
              <li>Local Processing</li>
              <li>Open Source</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
          © {new Date().getFullYear()} KitBox. No files leave your machine. Ever.
        </div>
      </div>
    </footer>
  );
}
