import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Input } from "@/components/ui/input";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const location = useLocation();

  // Generate breadcrumb from path
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    return { path, label };
  });

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl"
    >
      {/* Left: Title & Breadcrumb */}
      <div className="flex items-center gap-4">
        {title ? (
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        ) : (
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted-foreground">/</span>}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Search, Theme */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search matches..."
            className="w-64 pl-9 bg-muted/30 border-border/50 focus:border-primary/50"
          />
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </motion.header>
  );
}

