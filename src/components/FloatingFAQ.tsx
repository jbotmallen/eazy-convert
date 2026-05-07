import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

export function FloatingFAQ() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-8 right-8 z-50"
    >
      <Link
        to="/guide"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/20 transition-all hover:shadow-primary/40 group"
      >
        <HelpCircle className="h-6 w-6 transition-transform group-hover:rotate-12" />
        <span className="absolute right-full mr-4 whitespace-nowrap rounded-lg bg-card px-3 py-1.5 text-xs font-black uppercase tracking-widest text-card-foreground opacity-0 transition-opacity group-hover:opacity-100 border border-border/50">
          Need Help?
        </span>
      </Link>
    </motion.div>
  );
}
