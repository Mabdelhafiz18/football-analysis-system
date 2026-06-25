import { Link, useLocation } from "react-router-dom";
import { BarChart3, LayoutDashboard, UploadCloud, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

export function MobileNavigation() {
  const location = useLocation();
  const { canAccessRoute } = usePermissions();
  const items = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Upload", href: "/upload", icon: UploadCloud },
    { label: "Matches", href: "/matches", icon: Video },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
  ].filter((item) => canAccessRoute(item.href));

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-2xl border border-border/70 bg-card/95 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
      {items.map((item) => {
        const active = location.pathname === item.href;
        return <Link key={item.href} to={item.href} className={cn("flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold", active ? "bg-primary/15 text-primary" : "text-muted-foreground")}><item.icon className="h-5 w-5" /><span>{item.label}</span></Link>;
      })}
    </nav>
  );
}
