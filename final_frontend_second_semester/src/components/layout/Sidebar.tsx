import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trophy,
  LayoutDashboard,
  Loader2,
  Radio,
  Settings,
  UploadCloud,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { UserMenu } from "@/components/auth/UserMenu";
import { usePermissions } from "@/hooks/usePermissions";
import { useUpload } from "@/contexts/UploadContext";
import { Progress } from "@/components/ui/progress";

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { canAccessRoute } = usePermissions();
  const { currentUpload } = useUpload();

  const navItems = [
    { title: "Command Center", href: "/dashboard", icon: LayoutDashboard },
    { title: "Analyze Match", href: "/upload", icon: UploadCloud },
    { title: "Match Library", href: "/matches", icon: Video },
    { title: "Results", href: "/results", icon: Trophy },
    { title: "Live Match", href: currentUpload ? `/match/${currentUpload.matchId}/live` : "/matches", icon: Radio },
    { title: "Analytics", href: "/analytics", icon: BarChart3 },
    { title: "Reports", href: "/reports", icon: FileText },
  ].filter((item) => item.href.startsWith("/match/") || canAccessRoute(item.href));

  return (
    <motion.aside initial={false} animate={{ width: collapsed ? 76 : 252 }} transition={{ duration: 0.2 }} className={cn("fixed left-0 top-0 z-30 h-screen border-r border-border/60 bg-card/90 backdrop-blur-2xl", className)}>
      <div className="flex h-full flex-col">
        <div className="flex h-20 items-center justify-between border-b border-border/60 px-4">
          <Link to="/dashboard" className="flex items-center gap-3"><div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25"><Video className="h-6 w-6 text-primary-foreground" /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" /></div>{!collapsed && <div><p className="text-lg font-black leading-none">Kora<span className="text-primary">Vision</span></p><p className="mt-1 text-[10px] uppercase tracking-[.16em] text-muted-foreground">AI Match Intelligence</p></div>}</Link>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="h-8 w-8">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
        </div>

        <nav className="flex-1 space-y-1.5 p-3">
          {navItems.map((item) => {
            const active = location.pathname === item.href || (item.href.startsWith("/match/") && location.pathname.startsWith("/match/"));
            return <Link key={`${item.title}-${item.href}`} to={item.href}><motion.div whileHover={{ x: 3 }} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition", active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}><item.icon className="h-5 w-5 shrink-0" />{!collapsed && <span>{item.title}</span>}</motion.div></Link>;
          })}
        </nav>

        {currentUpload && currentUpload.status !== "completed" && (
          <Link to={`/match/${currentUpload.matchId}/live`} className="mx-3 mb-3">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" />{!collapsed && <p className="truncate text-xs font-bold">{currentUpload.homeTeam} vs {currentUpload.awayTeam}</p>}</div>
              {!collapsed && <><Progress value={currentUpload.progress} className="mt-3 h-1.5" /><p className="mt-1.5 text-[10px] text-muted-foreground">{currentUpload.progress}% · {currentUpload.message || "Processing"}</p></>}
            </div>
          </Link>
        )}

        <div className="border-t border-border/60 p-3"><UserMenu collapsed={collapsed} /><Link to="/settings"><div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"><Settings className="h-5 w-5" />{!collapsed && <span>Settings</span>}</div></Link></div>
      </div>
    </motion.aside>
  );
}
