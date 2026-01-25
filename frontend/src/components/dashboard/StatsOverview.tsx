import { motion } from "framer-motion";
import { Video, Flag, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@/types/match";

interface StatsOverviewProps {
  matches: Match[];
}

export function StatsOverview({ matches }: StatsOverviewProps) {
  const stats = [
    {
      label: "Total Matches",
      value: matches.length,
      icon: Video,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Completed",
      value: matches.filter((m) => m.status === "completed").length,
      icon: Flag,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Processing",
      value: matches.filter((m) => m.status === "processing").length,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      label: "Pending",
      value: matches.filter((m) => m.status === "pending").length,
      icon: AlertTriangle,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-card rounded-xl p-6 min-h-[120px]"
        >
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-lg", stat.bgColor)}>
              <stat.icon className={cn("h-7 w-7", stat.color)} />
            </div>
            <div className="flex-1">
              <p className="text-4xl font-bold text-foreground mb-1">{stat.value}</p>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

