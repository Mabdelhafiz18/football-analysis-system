import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Plus,
  Radio,
  ShieldCheck,
  Video,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useMatches } from "@/hooks/useMatches";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusClass: Record<string, string> = {
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  processing: "border-primary/30 bg-primary/10 text-primary",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

export default function Dashboard() {
  const { data: matches = [], isLoading, error } = useMatches();
  const { hasPermission } = usePermissions();
  const active = matches.filter((match) => ["processing", "pending"].includes(match.status));
  const completed = matches.filter((match) => match.status === "completed");
  const failed = matches.filter((match) => match.status === "failed");
  const latest = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  return (
    <AppLayout title="KoraVision Command Center">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-6 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <div className="flex items-center gap-2 text-primary"><Radio className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[.24em]">Real-time football intelligence</span></div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">One dashboard for every <span className="text-primary">real model decision</span>.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Monitor Vision, Tactical, xG, Offside and Foul analysis live, review event replays, and open the complete post-match intelligence workspace.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {hasPermission("upload_video") && <Link to="/upload"><Button className="gap-2"><Plus className="h-4 w-4" />Analyze a match</Button></Link>}
                <Link to="/matches"><Button variant="outline" className="gap-2">Open match library <ArrowRight className="h-4 w-4" /></Button></Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="All matches" value={matches.length} icon={Video} />
              <Stat label="Live / queued" value={active.length} icon={Activity} />
              <Stat label="Completed" value={completed.length} icon={CheckCircle2} />
              <Stat label="Failed" value={failed.length} icon={ShieldCheck} />
            </div>
          </div>
        </section>

        {error && <Alert variant="destructive"><AlertTitle>Backend data unavailable</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "Could not load matches."} No mock matches are shown.</AlertDescription></Alert>}

        {active.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Live processing</h2><p className="text-sm text-muted-foreground">Open a running match to see SSE model updates.</p></div><Badge className="animate-pulse">LIVE</Badge></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {active.map((match) => <MatchTile key={match.id} match={match} live />)}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Recent matches</h2><p className="text-sm text-muted-foreground">Every card opens real saved model windows and match media.</p></div><Link to="/matches"><Button variant="ghost" className="gap-2">View all <ArrowRight className="h-4 w-4" /></Button></Link></div>
          {isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div> : latest.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{latest.map((match) => <MatchTile key={match.id} match={match} />)}</div>
          ) : <Card><CardContent className="p-10 text-center text-muted-foreground">No matches have been saved by the backend yet.</CardContent></Card>}
        </section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return <div className="min-w-36 rounded-2xl border border-border/70 bg-background/45 p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 text-3xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

function MatchTile({ match, live = false }: { match: { id: number; homeTeam: string; awayTeam: string; date: string; league: string; status: string }; live?: boolean }) {
  return (
    <motion.div whileHover={{ y: -4 }}>
      <Link to={`/match/${match.id}/live`}>
        <Card className="h-full border-border/70 bg-card/65 transition hover:border-primary/40">
          <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><Badge variant="outline" className={statusClass[match.status] || ""}>{match.status.toUpperCase()}</Badge>{live ? <Radio className="h-4 w-4 animate-pulse text-primary" /> : <Clock3 className="h-4 w-4 text-muted-foreground" />}</div></CardHeader>
          <CardContent><p className="text-xs uppercase tracking-[.2em] text-muted-foreground">{match.league || "League unavailable"}</p><h3 className="mt-3 text-xl font-black">{match.homeTeam}</h3><p className="my-1 text-sm font-bold text-primary">VS</p><h3 className="text-xl font-black">{match.awayTeam}</h3><p className="mt-4 text-xs text-muted-foreground">{new Date(match.date).toLocaleString()}</p></CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
