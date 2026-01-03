import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Flag,
  AlertTriangle,
  BarChart3,
  Video,
  Trophy,
  Target,
  FileText,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useMatches, useMatchSummary } from "@/hooks/useMatches";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchId = parseInt(id || "1");

  const { data: matches } = useMatches();
  const { data: summary, isLoading: summaryLoading } = useMatchSummary(matchId);
  const { hasPermission } = usePermissions();

  const match = matches?.find((m) => m.id === matchId);

  if (!match) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Match not found</p>
        </div>
      </AppLayout>
    );
  }

  const formattedDate = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Match Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex flex-col items-center text-center">
            {/* Teams & Score */}
            <div className="flex items-center gap-8 mb-4">
              {/* Home Team */}
              <div className="text-right">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-primary">
                    {match.homeTeam.substring(0, 3).toUpperCase()}
                  </span>
                </div>
                <p className="font-semibold text-foreground">{match.homeTeam}</p>
              </div>

              {/* Score */}
              <div className="text-center">
                {match.homeScore !== undefined && match.awayScore !== undefined ? (
                  <div className="text-5xl font-bold font-mono text-foreground">
                    {match.homeScore} - {match.awayScore}
                  </div>
                ) : (
                  <div className="text-2xl font-semibold text-muted-foreground">vs</div>
                )}
                <p className="text-sm text-muted-foreground mt-1">Full Time</p>
              </div>

              {/* Away Team */}
              <div className="text-left">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-destructive">
                    {match.awayTeam.substring(0, 3).toUpperCase()}
                  </span>
                </div>
                <p className="font-semibold text-foreground">{match.awayTeam}</p>
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {match.league}
              </span>
              {match.venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{match.venue}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hasPermission("view_decisions") && (
            <Link to={`/match/${matchId}/decisions`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="glass-card rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">VAR Decisions</p>
                    <p className="text-xs text-muted-foreground">Review offside & fouls</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          )}

          {hasPermission("view_tactical") && (
            <Link to={`/match/${matchId}/tactical`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                whileHover={{ scale: 1.02 }}
                className="glass-card rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <BarChart3 className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Tactical Analysis</p>
                    <p className="text-xs text-muted-foreground">Formations & heatmaps</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          )}

          {hasPermission("generate_reports") && (
            <Link to={`/reports?matchId=${matchId}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                className="glass-card rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-500/10">
                    <FileText className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Match Report</p>
                    <p className="text-xs text-muted-foreground">Generate PDF report</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          )}
        </div>

        {/* Stats Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="glass-card p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {hasPermission("view_tactical") && (
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            )}
            {hasPermission("view_decisions") && (
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {summaryLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : summary ? (
              <>
                {/* Main Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Possession"
                    home={summary.possession.home}
                    away={summary.possession.away}
                    suffix="%"
                    index={0}
                  />
                  <StatCard
                    label="Shots"
                    home={summary.shots.home}
                    away={summary.shots.away}
                    index={1}
                  />
                  {hasPermission("view_analytics") && (
                    <StatCard
                      label="Expected Goals"
                      home={summary.xg.home}
                      away={summary.xg.away}
                      decimal
                      index={2}
                    />
                  )}
                  <StatCard
                    label="Fouls"
                    home={summary.fouls.home}
                    away={summary.fouls.away}
                    index={3}
                  />
                </div>

                {/* Secondary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Offsides</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{summary.offsides.home}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-xl font-bold">{summary.offsides.away}</span>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="glass-card rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-5 rounded-sm bg-yellow-500" />
                      <span className="text-sm text-muted-foreground">Yellow Cards</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{summary.cards.yellowHome}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-xl font-bold">{summary.cards.yellowAway}</span>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-card rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-5 rounded-sm bg-red-500" />
                      <span className="text-sm text-muted-foreground">Red Cards</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{summary.cards.redHome}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-xl font-bold">{summary.cards.redAway}</span>
                    </div>
                  </motion.div>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="stats">
            <div className="glass-card rounded-xl p-8 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium">Detailed Statistics</p>
              <p className="text-sm text-muted-foreground mt-1">
                View full match statistics in the Tactical Analysis section
              </p>
              <Link to={`/match/${matchId}/tactical`}>
                <Button className="mt-4">View Tactical Analysis</Button>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="glass-card rounded-xl p-8 text-center">
              <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium">Match Timeline</p>
              <p className="text-sm text-muted-foreground mt-1">
                View key moments and decisions in VAR Review
              </p>
              <Link to={`/match/${matchId}/decisions`}>
                <Button className="mt-4">View VAR Decisions</Button>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

interface StatCardProps {
  label: string;
  home: number;
  away: number;
  suffix?: string;
  decimal?: boolean;
  index: number;
}

function StatCard({ label, home, away, suffix = "", decimal, index }: StatCardProps) {
  const total = home + away;
  const homePercent = total > 0 ? (home / total) * 100 : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.05 }}
      className="glass-card rounded-xl p-4"
    >
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl font-bold text-foreground">
          {decimal ? home.toFixed(2) : home}{suffix}
        </span>
        <span className="text-xl font-bold text-foreground">
          {decimal ? away.toFixed(2) : away}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${homePercent}%` }}
        />
        <div
          className="h-full bg-destructive transition-all duration-500"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
    </motion.div>
  );
}

