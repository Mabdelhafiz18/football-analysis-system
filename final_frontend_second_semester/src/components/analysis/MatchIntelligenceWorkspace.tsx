import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Flag,
  PlayCircle,
  Radio,
  ShieldCheck,
  Target,
  Video,
} from "lucide-react";
import { LiveAnalysisDashboard } from "@/components/live/LiveAnalysisDashboard";
import { MatchVideoPlayer, type MatchVideoPlayerHandle, type ReplayRange } from "./MatchVideoPlayer";
import { RealDataNotice } from "./RealDataNotice";
import { useMatchAnalysis, getMatchVideoUrl } from "@/services/analysisService";
import { connectToMatchLive } from "@/services/liveModelService";
import { windowsToLiveState, mergeLiveMessage } from "@/utils/analysisWindowUtils";
import {
  asArray,
  asRecord,
  deepFindArrays,
  deepFindObject,
  formatMatchTime,
  formatPercentage,
  readNumber,
  readString,
  type UnknownRecord,
} from "@/utils/modelReaders";
import type { LiveModelHistory, LiveModelLatest, LiveModelMessage } from "@/types/liveAnalysis";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface MatchIntelligenceWorkspaceProps {
  matchId: number;
  compact?: boolean;
}

interface TimelineEvent {
  id: string;
  type: "foul" | "offside" | "xg" | "tactical";
  title: string;
  detail: string;
  timestamp: number;
  replay?: ReplayRange;
  confidence?: number | null;
}

const normalizeModelName = (name: string) => {
  if (name === "foul") return "foul_candidate";
  return name;
};

function extractXgEvents(history: LiveModelHistory) {
  const events: UnknownRecord[] = [];
  const seen = new Set<string>();
  for (const message of history.xg || []) {
    const arrays = deepFindArrays(message.result, ["events", "shots", "xg_events"]);
    for (const raw of arrays) {
      const event = asRecord(raw);
      const xg = readNumber(event, "xg");
      const type = readString(event, "event_type", "type");
      if (xg === null && type !== "xg_shot") continue;
      const key = `${readString(event, "shot_id", "id") || "shot"}-${readNumber(event, "frame_id") || ""}-${readNumber(event, "timestamp_sec") || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push(event);
      }
    }
  }
  return events;
}

function extractOffsideEvents(history: LiveModelHistory) {
  const events: UnknownRecord[] = [];
  const seen = new Set<string>();
  for (const message of history.offside || []) {
    const arrays = deepFindArrays(message.result, ["events", "offside_events"]);
    for (const raw of arrays) {
      const event = asRecord(raw);
      const key = `${readNumber(event, "freeze_frame_id", "frame_id") || ""}-${readNumber(event, "timestamp_sec", "freeze_timestamp_sec") || ""}-${readString(event, "receiver_id") || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push(event);
      }
    }
  }
  return events;
}

function extractFoulWindows(history: LiveModelHistory) {
  return (history.foul_candidate || [])
    .filter((message) => message.status === "completed" && message.result)
    .map((message) => ({ message, result: asRecord(message.result) }));
}

function buildTimeline(history: LiveModelHistory): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  for (const event of extractXgEvents(history)) {
    const timestamp = readNumber(event, "timestamp_sec") ?? 0;
    timeline.push({
      id: `xg-${readString(event, "shot_id", "id") || timestamp}`,
      type: "xg",
      title: `Shot · xG ${readNumber(event, "xg")?.toFixed(3) ?? "—"}`,
      detail: readString(event, "quality") || readString(asRecord(event.explanation), "summary") || "xG shot event",
      timestamp,
      replay: { start: Math.max(0, timestamp - 3), end: timestamp + 4, label: "xG shot replay" },
      confidence: readNumber(event, "xg"),
    });
  }

  for (const event of extractOffsideEvents(history)) {
    const timestamp = readNumber(event, "freeze_timestamp_sec", "timestamp_sec") ?? 0;
    timeline.push({
      id: `offside-${readNumber(event, "freeze_frame_id", "frame_id") || timestamp}`,
      type: "offside",
      title: readString(event, "decision", "recommendation") || "Offside review",
      detail: `Probability ${formatPercentage(readNumber(event, "offside_probability", "probability"))} · margin ${readNumber(event, "margin_m")?.toFixed(3) ?? "—"} m`,
      timestamp,
      replay: { start: Math.max(0, timestamp - 4), end: timestamp + 4, label: "Offside VAR replay" },
      confidence: readNumber(event, "offside_probability", "probability"),
    });
  }

  for (const { message, result } of extractFoulWindows(history)) {
    const decision = readString(result, "decision")?.toLowerCase();
    if (decision !== "foul" && decision !== "confirmed_foul") continue;
    const bounds = asRecord(result.clip_bounds);
    const start = readNumber(bounds, "start_time") ?? readNumber(result, "start_time") ?? 0;
    const end = readNumber(bounds, "end_time") ?? readNumber(result, "end_time") ?? start + 5;
    timeline.push({
      id: `foul-${message.window_number}`,
      type: "foul",
      title: "Foul detected",
      detail: `Window ${message.window_number} · confidence ${formatPercentage(readNumber(result, "confidence"))}`,
      timestamp: start,
      replay: { start, end, label: `Foul replay · window ${message.window_number}` },
      confidence: readNumber(result, "confidence"),
    });
  }

  for (const message of history.tactical || []) {
    for (const raw of deepFindArrays(message.result, ["alerts", "tactical_alerts"])) {
      const alert = asRecord(raw);
      const timestamp = readNumber(alert, "timestamp_sec") ?? 0;
      timeline.push({
        id: `tactical-${message.window_number}-${readString(alert, "type") || timestamp}`,
        type: "tactical",
        title: readString(alert, "type")?.replaceAll("_", " ") || "Tactical alert",
        detail: readString(alert, "message") || `Severity ${readString(alert, "severity") || "unknown"}`,
        timestamp,
      });
    }
  }

  return timeline.sort((a, b) => a.timestamp - b.timestamp);
}

function HeatmapGrid({ grid }: { grid: unknown }) {
  const rows = asArray(grid).map((row) => asArray(row).map((value) => Number(value) || 0));
  const max = Math.max(0, ...rows.flat());
  if (!rows.length || !rows.some((row) => row.length)) {
    return <p className="text-sm text-muted-foreground">Heatmap grid was not supplied by the tactical model.</p>;
  }

  return (
    <div
      className="grid aspect-[105/68] overflow-hidden rounded-xl border border-white/10 bg-emerald-950/60"
      style={{ gridTemplateColumns: `repeat(${Math.max(...rows.map((row) => row.length))}, minmax(0, 1fr))` }}
    >
      {rows.flatMap((row, y) => row.map((value, x) => {
        const strength = max > 0 ? value / max : 0;
        return (
          <div
            key={`${x}-${y}`}
            title={`${value}`}
            style={{ background: `rgba(163,230,53,${Math.max(0.04, strength * 0.92)})` }}
          />
        );
      }))}
    </div>
  );
}

function TacticalHeatmaps({ latest }: { latest?: LiveModelMessage }) {
  const tactical = deepFindObject(latest?.result, (item) => Boolean(item.teams)) || asRecord(latest?.result);
  const teams = asRecord(tactical.teams);
  const team0 = asRecord(teams["0"]);
  const team1 = asRecord(teams["1"]);
  const heat0 = asRecord(team0.heatmap);
  const heat1 = asRecord(team1.heatmap);

  const hasAny = Array.isArray(heat0.team_grid) || Array.isArray(heat1.team_grid) || asArray(heat0.points).length > 0 || asArray(heat1.points).length > 0;
  if (!latest?.result || !hasAny) {
    return (
      <Card className="border-border/70 bg-card/60">
        <CardHeader><CardTitle className="text-base">Tactical Heatmaps</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No heatmap was returned by the tactical model for this match. Nothing is generated or guessed by the frontend.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader><CardTitle className="text-base">Tactical Heatmaps</CardTitle></CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2"><p className="text-sm font-semibold">Team 0</p><HeatmapGrid grid={heat0.team_grid} /></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Team 1</p><HeatmapGrid grid={heat1.team_grid} /></div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, helper, icon: Icon }: { label: string; value: string | number; helper?: string; icon: typeof Activity }) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="flex items-start justify-between p-4">
        <div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{value}</p>{helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}</div>
        <div className="rounded-xl bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div>
      </CardContent>
    </Card>
  );
}

export function MatchIntelligenceWorkspace({ matchId, compact = false }: MatchIntelligenceWorkspaceProps) {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<LiveModelLatest>({});
  const [history, setHistory] = useState<LiveModelHistory>({});
  const playerRef = useRef<MatchVideoPlayerHandle>(null);

  const { data, isLoading, error, refetch } = useMatchAnalysis(matchId, true);

  useEffect(() => {
    if (!data?.windows) return;
    const state = windowsToLiveState(data.windows);
    setLatest(state.latest);
    setHistory(state.history);
  }, [data?.windows]);

  useEffect(() => {
    const source = connectToMatchLive(matchId, {
      onOpen: () => setConnected(true),
      onModelResult: (payload) => {
        const raw = asRecord(payload);
        const modelName = normalizeModelName(readString(raw, "model_name") || "unknown");
        const message: LiveModelMessage = {
          model_name: modelName,
          window_number: readNumber(raw, "window_number") ?? 0,
          status: readString(raw, "status") === "failed" ? "failed" : readString(raw, "status") === "completed" ? "completed" : "processing",
          result: raw.result,
          error: readString(raw, "error") || undefined,
          message: readString(raw, "message") || undefined,
          timestamp: new Date().toISOString(),
        };
        setLatest((previousLatest) => ({ ...previousLatest, [modelName]: message }));
        setHistory((previousHistory) => mergeLiveMessage(message, {}, previousHistory).history);
      },
      onStatus: () => void refetch(),
      onError: () => setConnected(false),
    });
    return () => source?.close();
  }, [matchId, refetch]);

  const timeline = useMemo(() => buildTimeline(history), [history]);
  const xgEvents = useMemo(() => extractXgEvents(history), [history]);
  const offsideEvents = useMemo(() => extractOffsideEvents(history), [history]);
  const foulWindows = useMemo(() => extractFoulWindows(history), [history]);
  const confirmedFouls = foulWindows.filter(({ result }) => ["foul", "confirmed_foul"].includes((readString(result, "decision") || "").toLowerCase()));
  const totalXg = xgEvents.reduce((sum, event) => sum + (readNumber(event, "xg") || 0), 0);
  const failedWindows = Object.values(history).flat().filter((item) => item.status === "failed").length;
  const jobStatus = data?.job?.status || data?.match?.processing_status || data?.match?.status || "unknown";
  const progress = Number(data?.job?.progress ?? (jobStatus === "completed" ? 100 : 0));

  if (isLoading && !data) {
    return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-[460px] w-full" /><Skeleton className="h-80 w-full" /></div>;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Could not load real match analysis</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : "The backend analysis endpoint is unavailable."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={jobStatus === "completed" ? "default" : "outline"}>{jobStatus.toUpperCase()}</Badge>
              <Badge variant={connected ? "default" : "outline"} className="gap-1"><Radio className="h-3 w-3" />{connected ? "LIVE SSE" : "REST HISTORY"}</Badge>
              {failedWindows > 0 && <Badge variant="destructive">{failedWindows} failed windows</Badge>}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{data.match.home_team} <span className="text-primary">vs</span> {data.match.away_team}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Match #{data.match.id} · {data.match.league || "League unavailable"} · {new Date(data.match.date).toLocaleString()}</p>
          </div>
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="mb-2 flex items-center justify-between text-sm"><span>AI processing</span><strong>{Number.isFinite(progress) ? `${progress}%` : "—"}</strong></div>
            <Progress value={Number.isFinite(progress) ? progress : 0} />
            <p className="mt-2 text-xs text-muted-foreground">{data.job?.message || "Model results are loaded directly from PostgreSQL and live SSE."}</p>
          </div>
        </div>
      </div>

      <RealDataNotice />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Model updates" value={Object.values(history).flat().length} helper="PostgreSQL + SSE" icon={Activity} />
        <SummaryCard label="xG shots" value={xgEvents.length} helper={`Total xG ${totalXg.toFixed(3)}`} icon={Target} />
        <SummaryCard label="Offside events" value={offsideEvents.length} helper="Only safety-gate emissions" icon={Flag} />
        <SummaryCard label="Confirmed fouls" value={confirmedFouls.length} helper={`${foulWindows.length} clips checked`} icon={ShieldCheck} />
        <SummaryCard label="Timeline events" value={timeline.length} helper="All model-backed events" icon={Clock3} />
      </div>

      {!compact && (
        <div className="grid gap-5 2xl:grid-cols-[1.15fr_.85fr]">
          <MatchVideoPlayer ref={playerRef} src={getMatchVideoUrl(matchId)} title="Match & VAR Replay" />
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Replay & Event Queue</CardTitle><Badge variant="outline">{timeline.length} events</Badge></CardHeader>
            <CardContent className="max-h-[500px] space-y-2 overflow-auto">
              {timeline.length ? timeline.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => event.replay ? playerRef.current?.playRange(event.replay) : playerRef.current?.seekTo(event.timestamp)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border/70 bg-background/30 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <PlayCircle className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{event.type}</Badge><span className="font-mono text-xs text-muted-foreground">{formatMatchTime(event.timestamp)}</span></div><p className="mt-1 text-sm font-semibold">{event.title}</p><p className="truncate text-xs text-muted-foreground">{event.detail}</p></div>
                </button>
              )) : <p className="text-sm text-muted-foreground">No replayable model event has been emitted yet.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <LiveAnalysisDashboard matchId={matchId} connected={connected || jobStatus === "completed"} latest={latest} history={history} teamNames={{ 0: data.match.home_team, 1: data.match.away_team }} />
      <TacticalHeatmaps latest={latest.tactical} />

      {jobStatus === "completed" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />Post-match model summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-muted-foreground">xG</p><p className="mt-1 font-bold">{xgEvents.length} shots · {totalXg.toFixed(3)} total</p></div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-muted-foreground">Offside</p><p className="mt-1 font-bold">{offsideEvents.length} emitted events</p></div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-muted-foreground">Foul</p><p className="mt-1 font-bold">{confirmedFouls.length} confirmed · {foulWindows.length} clips</p></div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-muted-foreground">Pipeline</p><p className="mt-1 font-bold">{failedWindows === 0 ? "All saved windows completed" : `${failedWindows} failed windows`}</p></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
