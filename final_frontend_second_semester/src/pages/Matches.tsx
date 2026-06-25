import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Video } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useMatches } from "@/hooks/useMatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function Matches() {
  const { data: matches = [], isLoading, error } = useMatches();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => matches.filter((match) => {
    const text = `${match.homeTeam} ${match.awayTeam} ${match.league}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === "all" || match.status === status);
  }), [matches, query, status]);

  return (
    <AppLayout title="Match Library">
      <div className="space-y-6">
        <div><h1 className="text-4xl font-black">Match Library</h1><p className="mt-2 text-muted-foreground">Select any saved match to open its live history, results, replay and post-match analytics.</p></div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams or league" className="pl-9" /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="processing">Processing</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select>
        </div>
        {error && <Alert variant="destructive"><AlertTitle>Cannot load matches</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "Backend unavailable"}. No fake matches are displayed.</AlertDescription></Alert>}
        {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : filtered.length ? (
          <div className="space-y-3">{filtered.map((match) => <Link key={match.id} to={`/match/${match.id}/live`}><Card className="border-border/70 bg-card/60 transition hover:border-primary/40"><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center"><div className="rounded-xl bg-primary/10 p-3"><Video className="h-6 w-6 text-primary" /></div><div className="flex-1"><h3 className="text-xl font-black">{match.homeTeam} <span className="text-primary">vs</span> {match.awayTeam}</h3><p className="mt-1 text-sm text-muted-foreground">{match.league || "League unavailable"} · {new Date(match.date).toLocaleString()}</p></div><Badge variant="outline">{match.status.toUpperCase()}</Badge></CardContent></Card></Link>)}</div>
        ) : <Card><CardContent className="p-12 text-center text-muted-foreground">No real backend match matches these filters.</CardContent></Card>}
      </div>
    </AppLayout>
  );
}
