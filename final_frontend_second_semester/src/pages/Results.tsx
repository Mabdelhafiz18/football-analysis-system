import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { MatchIntelligenceWorkspace } from "@/components/analysis/MatchIntelligenceWorkspace";
import { useMatches } from "@/hooks/useMatches";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Results() {
  const { data: matches = [] } = useMatches();
  const completed = useMemo(() => matches.filter((m) => m.status === "completed").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [matches]);
  const [selected, setSelected] = useState("");
  const matchId = selected ? Number(selected) : completed[0]?.id ?? null;

  return (
    <AppLayout title="Match Results">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="flex items-center gap-2 text-primary"><Trophy className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[.2em]">Completed match intelligence</span></div><h1 className="mt-3 text-4xl font-black">Results</h1><p className="mt-2 max-w-2xl text-muted-foreground">Open the final saved result for a completed match: tactical metrics, heatmaps, xG shots, offside decisions, foul clips and timeline.</p></div>
          <div className="w-full xl:w-[420px]"><Select value={matchId ? String(matchId) : ""} onValueChange={setSelected}><SelectTrigger className="h-12"><SelectValue placeholder="Select completed match" /></SelectTrigger><SelectContent>{completed.map((match) => <SelectItem key={match.id} value={String(match.id)}>#{match.id} · {match.homeTeam} vs {match.awayTeam}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {matchId ? <MatchIntelligenceWorkspace matchId={matchId} /> : <Card><CardContent className="p-14 text-center text-muted-foreground">No completed match is available yet.</CardContent></Card>}
      </div>
    </AppLayout>
  );
}
