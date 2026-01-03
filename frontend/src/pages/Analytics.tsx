import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Flag,
  AlertTriangle,
  Target,
  Users,
  Trophy,
  Activity,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useMatches } from "@/hooks/useMatches";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

export default function Analytics() {
  const { data: matches, isLoading } = useMatches();
  const { role } = usePermissions();
  
  // Only manager and academy_admin can see AI Decision Accuracy
  const canViewDecisionAccuracy = role === "manager" || role === "academy_admin";

  // Calculate aggregated stats
  const stats = useMemo(() => {
    if (!matches) return null;

    const completedMatches = matches.filter((m) => m.status === "completed");
    const totalGoals = completedMatches.reduce(
      (sum, m) => sum + (m.homeScore || 0) + (m.awayScore || 0),
      0
    );
    const avgGoals = completedMatches.length > 0 ? totalGoals / completedMatches.length : 0;

    // League breakdown
    const leagueStats = matches.reduce((acc, match) => {
      if (!acc[match.league]) {
        acc[match.league] = { total: 0, completed: 0 };
      }
      acc[match.league].total++;
      if (match.status === "completed") {
        acc[match.league].completed++;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    // Status breakdown
    const statusBreakdown = {
      completed: matches.filter((m) => m.status === "completed").length,
      processing: matches.filter((m) => m.status === "processing").length,
      pending: matches.filter((m) => m.status === "pending").length,
      failed: matches.filter((m) => m.status === "failed").length,
    };

    return {
      totalMatches: matches.length,
      completedMatches: completedMatches.length,
      totalGoals,
      avgGoals,
      leagueStats,
      statusBreakdown,
    };
  }, [matches]);

  // Mock additional analytics data
  const decisionStats = {
    totalDecisions: 156,
    offsides: 48,
    fouls: 108,
    accuracy: 94.2,
  };

  const tacticalInsights = [
    { label: "Most Common Formation", value: "4-3-3", trend: "+12%" },
    { label: "Average Possession", value: "52%", trend: "+3%" },
    { label: "Pass Accuracy", value: "84%", trend: "+5%" },
    { label: "Shots per Match", value: "12.4", trend: "-2%" },
  ];

  return (
    <AppLayout title="Analytics">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics Overview</h1>
          <p className="text-muted-foreground">
            Aggregated statistics and insights across all matches
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-32 bg-muted/30 rounded-xl animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Trophy}
                label="Total Matches"
                value={stats?.totalMatches || 0}
                subValue={`${stats?.completedMatches || 0} completed`}
                color="primary"
                index={0}
              />
              <StatCard
                icon={Target}
                label="Total Goals"
                value={stats?.totalGoals || 0}
                subValue={`${stats?.avgGoals.toFixed(1)} avg/match`}
                color="green"
                index={1}
              />
              <StatCard
                icon={Flag}
                label="Offside Decisions"
                value={decisionStats.offsides}
                subValue="Across all matches"
                color="lime"
                index={2}
              />
              <StatCard
                icon={AlertTriangle}
                label="Foul Decisions"
                value={decisionStats.fouls}
                subValue="Across all matches"
                color="red"
                index={3}
              />
            </div>

            {/* Decision Accuracy - Only for manager and academy_admin */}
            {canViewDecisionAccuracy && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">AI Decision Accuracy</h2>
                </div>
                <div className="flex items-center gap-8">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="12"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${decisionStats.accuracy * 3.51} 351`}
                        initial={{ strokeDasharray: "0 351" }}
                        animate={{ strokeDasharray: `${decisionStats.accuracy * 3.51} 351` }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-foreground">
                        {decisionStats.accuracy}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Decisions Reviewed</span>
                      <span className="font-mono font-bold text-foreground">
                        {decisionStats.totalDecisions}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Correct Decisions</span>
                      <span className="font-mono font-bold text-green-500">
                        {Math.round(decisionStats.totalDecisions * (decisionStats.accuracy / 100))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Disputed Decisions</span>
                      <span className="font-mono font-bold text-yellow-500">
                        {Math.round(decisionStats.totalDecisions * ((100 - decisionStats.accuracy) / 100))}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* League Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Matches by League</h2>
                </div>
                <div className="space-y-4">
                  {stats &&
                    Object.entries(stats.leagueStats).map(([league, data], index) => {
                      const percentage = (data.completed / data.total) * 100;
                      return (
                        <motion.div
                          key={league}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.1 }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{league}</span>
                            <span className="text-sm text-muted-foreground">
                              {data.completed}/{data.total} completed
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </motion.div>

              {/* Tactical Insights */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Tactical Insights</h2>
                </div>
                <div className="space-y-4">
                  {tacticalInsights.map((insight, index) => (
                    <motion.div
                      key={insight.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div>
                        <p className="text-sm text-muted-foreground">{insight.label}</p>
                        <p className="text-xl font-bold text-foreground">{insight.value}</p>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-sm font-medium",
                          insight.trend.startsWith("+") ? "text-green-500" : "text-red-500"
                        )}
                      >
                        <TrendingUp
                          className={cn(
                            "h-4 w-4",
                            insight.trend.startsWith("-") && "rotate-180"
                          )}
                        />
                        {insight.trend}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Status Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Processing Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatusCard
                  label="Completed"
                  value={stats?.statusBreakdown.completed || 0}
                  total={stats?.totalMatches || 0}
                  color="green"
                />
                <StatusCard
                  label="Processing"
                  value={stats?.statusBreakdown.processing || 0}
                  total={stats?.totalMatches || 0}
                  color="yellow"
                />
                <StatusCard
                  label="Pending"
                  value={stats?.statusBreakdown.pending || 0}
                  total={stats?.totalMatches || 0}
                  color="gray"
                />
                <StatusCard
                  label="Failed"
                  value={stats?.statusBreakdown.failed || 0}
                  total={stats?.totalMatches || 0}
                  color="red"
                />
              </div>
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

interface StatCardProps {
  icon: typeof Trophy;
  label: string;
  value: number;
  subValue: string;
  color: "primary" | "green" | "red" | "lime";
  index: number;
}

function StatCard({ icon: Icon, label, value, subValue, color, index }: StatCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-500",
    red: "bg-destructive/10 text-destructive",
    lime: "bg-primary/10 text-primary",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
    </motion.div>
  );
}

interface StatusCardProps {
  label: string;
  value: number;
  total: number;
  color: "green" | "yellow" | "gray" | "red";
}

function StatusCard({ label, value, total, color }: StatusCardProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const colorClasses = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    gray: "bg-muted-foreground",
    red: "bg-destructive",
  };

  return (
    <div className="text-center p-4 rounded-lg bg-muted/20">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: 0.5 }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(0)}%</p>
    </div>
  );
}

