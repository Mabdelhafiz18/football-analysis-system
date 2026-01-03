import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Grid Background */}
      <div className="pointer-events-none fixed inset-0 grid-background opacity-20" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="pl-[240px] transition-all duration-200">
        {/* Header */}
        <AppHeader title={title} />

        {/* Page Content */}
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

