import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { MobileNavigation } from "./MobileNavigation";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 grid-background opacity-20" />
      <Sidebar className="hidden lg:block" />
      <div className="pb-24 transition-all duration-200 lg:pl-[252px] lg:pb-0">
        <AppHeader title={title} />
        <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="relative z-10 p-4 md:p-6 xl:p-8">
          {children}
        </motion.main>
      </div>
      <MobileNavigation />
    </div>
  );
}
