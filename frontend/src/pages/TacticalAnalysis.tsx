import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Flame, Share2, TrendingUp, Target } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { PitchVisualization, PassNetworkViz, ShotPredictionViz } from "@/components/tactical";
import { useMatches, useTactical, usePassNetwork, useShotPredictions } from "@/hooks/useMatches";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/match";

export default function TacticalAnalysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchId = parseInt(id || "1");

  const { data: matches } = useMatches();
  const { data: tactical, isLoading } = useTactical(matchId);
  const { data: passNetwork } = usePassNetwork();
  const { data: shots, isLoading: shotsLoading } = useShotPredictions(matchId);

  const match = matches?.find((m) => m.id === matchId);
  const [selectedTeam, setSelectedTeam] = useState<Team | "both">("both");

  const xGStats = useMemo(() => {
    if (!shots) return null;
    const homeShots = shots.filter(s => s.team === 'home');
    const awayShots = shots.filter(s => s.team === 'away');
    
    return {
      home: {
        totalXG: homeShots.reduce((sum, s) => sum + s.xg, 0),
        count: homeShots.length || 1,
        goals: homeShots.filter(s => s.outcome === 'goal').length
      },
      away: {
        totalXG: awayShots.reduce((sum, s) => sum + s.xg, 0),
        count: awayShots.length || 1,
        goals: awayShots.filter(s => s.outcome === 'goal').length
      }
    };
  }, [shots]);

  if (!match) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Match not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(`/match/${matchId}`)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Match
        </Button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tactical Analysis</h1>
            <p className="text-muted-foreground">
              {match.homeTeam} vs {match.awayTeam}
            </p>
          </div>

          {/* Team Selector */}
          <div className="flex items-center gap-2">
            <Button
              variant={selectedTeam === "home" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTeam("home")}
              className={cn(selectedTeam === "home" && "lime-glow")}
            >
              {match.homeTeam.split(" ")[0]}
            </Button>
            <Button
              variant={selectedTeam === "both" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTeam("both")}
            >
              Both
            </Button>
            <Button
              variant={selectedTeam === "away" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTeam("away")}
              className={cn(selectedTeam === "away" && "bg-destructive hover:bg-destructive/90")}
            >
              {match.awayTeam.split(" ")[0]}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="formation" className="space-y-4">
          <TabsList className="glass-card p-1">
            <TabsTrigger value="formation" className="gap-2">
              <Users className="h-4 w-4" />
              Formation
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-2">
              <Flame className="h-4 w-4" />
              Heatmap
            </TabsTrigger>
            <TabsTrigger value="passnetwork" className="gap-2">
              <Share2 className="h-4 w-4" />
              Pass Network
            </TabsTrigger>
            <TabsTrigger value="xg" className="gap-2">
              <Target className="h-4 w-4" />
              xG Analysis
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Formation Tab */}
          <TabsContent value="formation">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-xl p-4"
              >
                {isLoading ? (
                  <div className="aspect-[3/2] bg-muted/30 rounded-lg animate-pulse" />
                ) : tactical ? (
                  <PitchVisualization
                    positions={tactical.avgPositions}
                    showFormation={true}
                    showHeatmap={false}
                    selectedTeam={selectedTeam}
                  />
                ) : null}
              </motion.div>

              {/* Formation Info */}
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card rounded-xl p-4"
                >
                  <h3 className="font-semibold text-foreground mb-3">Formations</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Home</span>
                      <span className="font-mono font-bold text-primary">
                        {tactical?.formation.home || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Away</span>
                      <span className="font-mono font-bold text-destructive">
                        {tactical?.formation.away || "-"}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Key Players */}
                {tactical?.keyPlayers && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card rounded-xl p-4"
                  >
                    <h3 className="font-semibold text-foreground mb-3">Key Players</h3>
                    <div className="space-y-3">
                      {tactical.keyPlayers.map((player) => (
                        <div key={player.playerId} className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              player.team === "home"
                                ? "bg-primary/20 text-primary"
                                : "bg-destructive/20 text-destructive"
                            )}
                          >
                            {player.playerId}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {player.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {player.goals}G {player.assists}A • {player.passAccuracy}% pass
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Heatmap Tab */}
          <TabsContent value="heatmap">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-xl p-4"
              >
                {isLoading ? (
                  <div className="aspect-[3/2] bg-muted/30 rounded-lg animate-pulse" />
                ) : tactical ? (
                  <PitchVisualization
                    positions={tactical.avgPositions}
                    heatmapData={
                      selectedTeam === "away"
                        ? tactical.teamHeatmap.away
                        : tactical.teamHeatmap.home
                    }
                    showFormation={true}
                    showHeatmap={true}
                    selectedTeam={selectedTeam}
                  />
                ) : null}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card rounded-xl p-4"
              >
                <h3 className="font-semibold text-foreground mb-3">Heatmap Legend</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/20" />
                    <span className="text-sm text-muted-foreground">Low activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/50" />
                    <span className="text-sm text-muted-foreground">Medium activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary" />
                    <span className="text-sm text-muted-foreground">High activity</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Heatmap shows where players spent most time during the match.
                </p>
              </motion.div>
            </div>
          </TabsContent>

          {/* Pass Network Tab */}
          <TabsContent value="passnetwork">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-xl p-4"
              >
                {isLoading || !passNetwork || !tactical ? (
                  <div className="aspect-[3/2] bg-muted/30 rounded-lg animate-pulse" />
                ) : (
                  <PassNetworkViz
                    passes={passNetwork.passes}
                    positions={tactical.avgPositions.filter((p) => p.team === "home")}
                  />
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card rounded-xl p-4"
              >
                <h3 className="font-semibold text-foreground mb-3">Pass Network</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Visualization of passing connections between players. Thicker lines indicate
                  more passes.
                </p>
                {passNetwork && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Total connections: {passNetwork.passes.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max passes: {Math.max(...passNetwork.passes.map((p) => p.count))}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </TabsContent>

          {/* xG Analysis Tab */}
          <TabsContent value="xg">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-xl p-4"
              >
                {shotsLoading ? (
                  <div className="aspect-[3/2] bg-muted/30 rounded-lg animate-pulse" />
                ) : shots ? (
                  <ShotPredictionViz
                    shots={shots}
                    selectedTeam={selectedTeam}
                  />
                ) : (
                  <div className="aspect-[3/2] flex items-center justify-center border border-dashed rounded-lg">
                    <p className="text-muted-foreground">No shot data available</p>
                  </div>
                )}
              </motion.div>

              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card rounded-xl p-4"
                >
                  <h3 className="font-semibold text-foreground mb-3">Expected Goals (xG)</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Home xG</span>
                        <span className="font-bold text-primary">{xGStats?.home.totalXG.toFixed(2) || "0.00"}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(xGStats?.home.totalXG || 0) / (Math.max((xGStats?.home.totalXG || 0) + (xGStats?.away.totalXG || 0), 0.1)) * 100}%` }}
                          className="h-full bg-primary" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Away xG</span>
                        <span className="font-bold text-destructive">{xGStats?.away.totalXG.toFixed(2) || "0.00"}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(xGStats?.away.totalXG || 0) / (Math.max((xGStats?.home.totalXG || 0) + (xGStats?.away.totalXG || 0), 0.1)) * 100}%` }}
                          className="h-full bg-destructive" 
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card rounded-xl p-4"
                >
                  <h3 className="font-semibold text-foreground mb-3">Shot Quality</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Home Conversion</span>
                      <span className="text-xs font-mono font-bold">
                        {xGStats ? ((xGStats.home.goals / xGStats.home.count) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Away Conversion</span>
                      <span className="text-xs font-mono font-bold">
                        {xGStats ? ((xGStats.away.goals / xGStats.away.count) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      * Conversion rate = Goals / Total Shots
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tactical?.keyPlayers.map((player, index) => (
                <motion.div
                  key={player.playerId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                        player.team === "home"
                          ? "bg-primary/20 text-primary"
                          : "bg-destructive/20 text-destructive"
                      )}
                    >
                      {player.playerId}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{player.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{player.team}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-foreground">{player.goals}</p>
                      <p className="text-xs text-muted-foreground">Goals</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-foreground">{player.assists}</p>
                      <p className="text-xs text-muted-foreground">Assists</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-foreground">{player.shots}</p>
                      <p className="text-xs text-muted-foreground">Shots</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-foreground">{player.passAccuracy}%</p>
                      <p className="text-xs text-muted-foreground">Pass Acc</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

