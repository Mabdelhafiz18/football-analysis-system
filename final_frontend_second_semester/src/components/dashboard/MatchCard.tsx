import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, ChevronRight, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@/types/match";

interface MatchCardProps {
  match: Match;
  index: number;
}

const statusConfig = {
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    animate: true,
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export function MatchCard({ match, index }: MatchCardProps) {
  const status = statusConfig[match.status];
  const StatusIcon = status.icon;
  const formattedDate = new Date(match.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/match/${match.id}`}>
        <div className="glass-card rounded-xl p-6 hover:border-primary/50 transition-all duration-200 group cursor-pointer min-h-[140px]">
          <div className="flex items-center justify-between gap-6">
            {/* Teams & Score */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-6">
                {/* Home Team */}
                <div className="flex-1 text-right">
                  <p className="text-lg font-bold text-foreground truncate">{match.homeTeam}</p>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2 px-6 py-3 rounded-lg bg-muted/30">
                  {match.homeScore !== undefined && match.awayScore !== undefined ? (
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {match.homeScore} - {match.awayScore}
                    </span>
                  ) : (
                    <span className="text-base font-medium text-muted-foreground">vs</span>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex-1 text-left">
                  <p className="text-lg font-bold text-foreground truncate">{match.awayTeam}</p>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-center gap-5 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">{formattedDate}</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {match.league}
                </span>
                {match.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">{match.venue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status & Arrow */}
            <div className="flex items-center gap-4">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-full", status.bgColor)}>
                <StatusIcon
                  className={cn(
                    "h-5 w-5",
                    status.color,
                    status.animate && "animate-spin"
                  )}
                />
                <span className={cn("text-sm font-semibold", status.color)}>{status.label}</span>
              </div>
              <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

