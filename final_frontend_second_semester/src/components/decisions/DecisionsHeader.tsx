import { motion } from "framer-motion";
import { ChevronRight, Video, Flag, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { MatchInfo, DecisionsSummary } from "@/types/decisions";

interface DecisionsHeaderProps {
  matchInfo: MatchInfo | undefined;
  summary: DecisionsSummary;
  isLoading: boolean;
}

export function DecisionsHeader({ matchInfo, summary, isLoading }: DecisionsHeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass border-b border-border/50 sticky top-0 z-40"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo - Links back to landing */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-lg font-bold text-foreground">
                Vision<span className="text-primary">VAR</span>
              </span>
            </Link>

            {/* Breadcrumb */}
            <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium truncate">
                Referee Decisions
              </span>
            </nav>
            
            {/* Mobile Title */}
            <div className="sm:hidden flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Video className="h-4 w-4 text-primary" />
            </div>
          </div>

          {/* Center: Match Info */}
          <div className="flex-1 flex justify-center">
            {isLoading ? (
              <div className="h-10 w-64 bg-muted/50 rounded-lg animate-pulse" />
            ) : matchInfo ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 glass-card px-4 py-2 rounded-xl"
              >
                {/* Home Team */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full border-2"
                    style={{ borderColor: matchInfo.homeTeam.primaryColor }}
                  />
                  <span className="font-semibold text-sm hidden md:inline">
                    {matchInfo.homeTeam.shortName}
                  </span>
                </div>

                {/* Score */}
                <div className="flex items-center gap-1 font-mono text-lg font-bold">
                  <span>{matchInfo.score.home}</span>
                  <span className="text-muted-foreground">-</span>
                  <span>{matchInfo.score.away}</span>
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm hidden md:inline">
                    {matchInfo.awayTeam.shortName}
                  </span>
                  <div
                    className="w-6 h-6 rounded-full border-2"
                    style={{ borderColor: matchInfo.awayTeam.primaryColor }}
                  />
                </div>

                {/* Competition Badge */}
                <span className="hidden lg:inline-block ml-2 text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                  {matchInfo.competition}
                </span>
              </motion.div>
            ) : null}
          </div>

          {/* Right: Quick Stats & Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Quick Stats Pills */}
            <div className="hidden md:flex items-center gap-2">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30"
              >
                <Flag className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {summary.offsideCount.home + summary.offsideCount.away}
                </span>
              </motion.div>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/30"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">
                  {summary.foulCount.home + summary.foulCount.away}
                </span>
              </motion.div>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </motion.header>
  );
}

