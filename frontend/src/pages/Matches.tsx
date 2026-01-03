import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  Calendar,
  MapPin,
  ChevronRight,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Match } from "@/types/match";

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

export default function Matches() {
  const { data: matches, isLoading, isError } = useMatches();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Get unique leagues
  const leagues = matches ? [...new Set(matches.map((m) => m.league))] : [];

  // Filter matches
  const filteredMatches = matches?.filter((match) => {
    const matchesSearch =
      match.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.awayTeam.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || match.status === statusFilter;
    const matchesLeague = leagueFilter === "all" || match.league === leagueFilter;
    return matchesSearch && matchesStatus && matchesLeague;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AppLayout title="Matches">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Matches</h1>
            <p className="text-muted-foreground">
              {filteredMatches?.length || 0} matches found
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="h-8 w-8"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="h-8 w-8"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
            <Link to="/upload">
              <Button className="gap-2 lime-glow">
                <Plus className="h-4 w-4" />
                Upload Match
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-muted/30">
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
          <Select value={leagueFilter} onValueChange={setLeagueFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-muted/30">
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

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-muted/30 rounded-xl animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center glass-card rounded-xl">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">Failed to load matches</p>
            <p className="text-sm text-muted-foreground mt-1">Please try again later</p>
          </div>
        ) : viewMode === "list" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Match</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>League</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches?.map((match, index) => {
                  const status = statusConfig[match.status];
                  const StatusIcon = status.icon;
                  return (
                    <motion.tr
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="group hover:bg-muted/30"
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {match.homeTeam} vs {match.awayTeam}
                        </div>
                        {match.venue && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {match.venue}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.homeScore !== undefined ? (
                          <span className="font-mono font-bold">
                            {match.homeScore} - {match.awayScore}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(match.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {match.league}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className={cn("flex items-center gap-1.5", status.color)}>
                          <StatusIcon className={cn("h-4 w-4", status.animate && "animate-spin")} />
                          <span className="text-sm">{status.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/match/${match.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            View
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches?.map((match, index) => (
              <MatchGridCard key={match.id} match={match} index={index} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function MatchGridCard({ match, index }: { match: Match; index: number }) {
  const status = statusConfig[match.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/match/${match.id}`}>
        <div className="glass-card rounded-xl p-4 hover:border-primary/50 transition-all group cursor-pointer">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-3">
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {match.league}
            </span>
            <div className={cn("flex items-center gap-1", status.color)}>
              <StatusIcon className={cn("h-3.5 w-3.5", status.animate && "animate-spin")} />
              <span className="text-xs">{status.label}</span>
            </div>
          </div>

          {/* Teams */}
          <div className="text-center mb-3">
            <div className="flex items-center justify-center gap-3">
              <div className="flex-1 text-right">
                <p className="font-semibold text-foreground truncate">{match.homeTeam}</p>
              </div>
              <div className="px-3 py-1 rounded-lg bg-muted/50">
                {match.homeScore !== undefined ? (
                  <span className="font-mono font-bold text-lg">
                    {match.homeScore} - {match.awayScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground">vs</span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground truncate">{match.awayTeam}</p>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(match.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </div>
            {match.venue && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {match.venue}
              </div>
            )}
          </div>

          {/* View Arrow */}
          <div className="flex justify-center mt-3">
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

