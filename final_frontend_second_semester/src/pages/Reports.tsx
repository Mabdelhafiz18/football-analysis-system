import { useMemo, useState } from "react";
import { Download, FileJson, FileText, Printer } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { MatchIntelligenceWorkspace } from "@/components/analysis/MatchIntelligenceWorkspace";
import { useMatches } from "@/hooks/useMatches";
import { useMatchAnalysis } from "@/services/analysisService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Reports() {
  const { data: matches = [] } = useMatches();
  const defaultId = useMemo(() => [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.id ?? null, [matches]);
  const [selected, setSelected] = useState("");
  const matchId = selected ? Number(selected) : defaultId;
  const { data } = useMatchAnalysis(matchId, false);

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `koravision-match-${data.match.id}-real-model-results.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Real model results exported");
  };

  return (
    <AppLayout title="Reports & Exports">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-primary"><FileText className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[.2em]">Post-match deliverables</span></div><h1 className="mt-3 text-4xl font-black">Reports Center</h1><p className="mt-2 text-muted-foreground">Print the real post-match workspace or export the exact PostgreSQL model-window payload as JSON.</p></div><div className="w-full xl:w-[420px]"><Select value={matchId ? String(matchId) : ""} onValueChange={setSelected}><SelectTrigger className="h-12"><SelectValue placeholder="Select match" /></SelectTrigger><SelectContent>{matches.map((match) => <SelectItem key={match.id} value={String(match.id)}>#{match.id} · {match.homeTeam} vs {match.awayTeam}</SelectItem>)}</SelectContent></Select></div></div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/70 bg-card/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Printer className="h-5 w-5 text-primary" />Professional printable report</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Uses the visible real match summary, tactical metrics, xG, offside and foul results. Select “Save as PDF” in the print dialog.</p><Button onClick={() => window.print()} disabled={!matchId} className="gap-2"><Printer className="h-4 w-4" />Print / Save PDF</Button></CardContent></Card>
          <Card className="border-border/70 bg-card/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileJson className="h-5 w-5 text-primary" />Raw model evidence</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Exports the exact match, processing job and model_window_results rows returned by the backend without recomputation.</p><Button onClick={downloadJson} disabled={!data} variant="outline" className="gap-2"><Download className="h-4 w-4" />Download JSON</Button></CardContent></Card>
        </div>

        {matchId && <div className="print-report"><MatchIntelligenceWorkspace matchId={matchId} compact /></div>}
      </div>
    </AppLayout>
  );
}
