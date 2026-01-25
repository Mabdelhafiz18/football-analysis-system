import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Filter } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { MatchCard } from "@/components/dashboard/MatchCard";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { useMatches } from "@/hooks/useMatches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";

export default function Dashboard() {
  const { data: matches, isLoading, isError } = useMatches();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const { hasPermission } = usePermissions();

  // Get unique leagues
  const leagues = matches
    ? [...new Set(matches.map((m) => m.league))]
    : [];

  // Filter matches
  const filteredMatches = matches?.filter((match) => {
    const matchesSearch =
      match.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.awayTeam.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || match.status === statusFilter;
    const matchesLeague = leagueFilter === "all" || match.league === leagueFilter;
    return matchesSearch && matchesStatus && matchesLeague;
  });

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Match Dashboard</h1>
            <p className="text-lg text-muted-foreground">
              Manage and analyze your football matches
            </p>
          </div>
          {hasPermission("upload_video") && (
            <Link to="/upload">
              <Button className="gap-2 lime-glow">
                <Plus className="h-4 w-4" />
                Upload Match
              </Button>
            </Link>
          )}
        </div>

        {/* Stats Overview */}
        {matches && <StatsOverview matches={matches} />}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 h-12 text-base"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-muted/30 h-12 text-base">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          {/* League Filter */}
          <Select value={leagueFilter} onValueChange={setLeagueFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-muted/30 h-12 text-base">
              <SelectValue placeholder="League" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              {leagues.map((league) => (
                <SelectItem key={league} value={league}>
                  {league}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Match List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">
              Matches ({filteredMatches?.length || 0})
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-muted/30 rounded-xl animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          ) : isError ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 text-center glass-card rounded-xl"
            >
              <p className="text-lg font-semibold text-destructive">Failed to load matches</p>
              <p className="text-base text-muted-foreground mt-2">
                Please try again later
              </p>
            </motion.div>
          ) : filteredMatches && filteredMatches.length > 0 ? (
            <div className="space-y-4">
              {filteredMatches.map((match, index) => (
                <MatchCard key={match.id} match={match} index={index} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-16 text-center glass-card rounded-xl"
            >
              <Filter className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <p className="text-xl font-bold text-foreground">No matches found</p>
              <p className="text-base text-muted-foreground mt-2">
                {searchQuery || statusFilter !== "all" || leagueFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first match to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && leagueFilter === "all" && hasPermission("upload_video") && (
                <Link to="/upload">
                  <Button className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Upload Match
                  </Button>
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

