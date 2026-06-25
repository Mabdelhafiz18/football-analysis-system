import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { MatchIntelligenceWorkspace } from "@/components/analysis/MatchIntelligenceWorkspace";
import { useMatches } from "@/hooks/useMatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Analytics() {
  const { data: matches = [], error } = useMatches();
  const latestMatchId = useMemo(() => {
    const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0]?.id ?? null;
  }, [matches]);
  const [selected, setSelected] = useState<string>("");
  const matchId = selected ? Number(selected) : latestMatchId;

  return (
    <AppLayout title="Match Analytics">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[.22em]">Per-match intelligence</span></div><h1 className="mt-3 text-4xl font-black">Analytics Workspace</h1><p className="mt-2 max-w-2xl text-muted-foreground">Choose the match you uploaded. Tactical metrics, heatmaps, xG, offside, foul and replay are loaded from its saved model outputs.</p></div>
          <div className="w-full xl:w-[380px]"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">Selected match</p><Select value={matchId ? String(matchId) : ""} onValueChange={setSelected}><SelectTrigger className="h-12"><SelectValue placeholder="Select a real backend match" /></SelectTrigger><SelectContent>{matches.map((match) => <SelectItem key={match.id} value={String(match.id)}>#{match.id} · {match.homeTeam} vs {match.awayTeam}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {error && <Alert variant="destructive"><AlertTitle>Match list unavailable</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "Backend error"}</AlertDescription></Alert>}
        {matchId ? <MatchIntelligenceWorkspace matchId={matchId} /> : <Card><CardContent className="p-14 text-center text-muted-foreground">Upload or select a match to open analytics.</CardContent></Card>}
      </div>
    </AppLayout>
  );
}
