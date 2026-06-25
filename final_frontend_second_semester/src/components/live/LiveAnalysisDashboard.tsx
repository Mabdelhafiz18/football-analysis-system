import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Crosshair,
  Gauge,
  Loader2,
  ShieldAlert,
  Swords,
  Target,
  Timer,
  Users,
  Waves,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  LiveModelHistory,
  LiveModelLatest,
  LiveModelMessage,
} from "@/types/liveAnalysis";

type UnknownRecord = Record<string, unknown>;

interface LiveAnalysisDashboardProps {
  matchId: number | null;
  connected: boolean;
  latest: LiveModelLatest;
  history: LiveModelHistory;
  teamNames?: { 0: string; 1: string };
}

const MODEL_CONFIG = [
  { key: "tactical", label: "Tactical", icon: Swords },
  { key: "xg", label: "xG", icon: Target },
  { key: "offside", label: "Offside", icon: ShieldAlert },
  { key: "foul_candidate", label: "Foul", icon: AlertTriangle },
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const record = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const firstDefined = (...values: unknown[]) => values.find((value) => value !== undefined && value !== null);

const readNumber = (obj: UnknownRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = obj[key];
    const numberValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return null;
};

const readString = (obj: UnknownRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
};

const readBoolean = (obj: UnknownRecord, ...keys: string[]) => {
  for (const key of keys) {
    if (typeof obj[key] === "boolean") return obj[key] as boolean;
  }
  return null;
};

function deepFindObject(
  value: unknown,
  predicate: (item: UnknownRecord) => boolean,
  depth = 0,
): UnknownRecord | null {
  if (depth > 5) return null;
  if (isRecord(value)) {
    if (predicate(value)) return value;
    for (const child of Object.values(value)) {
      const found = deepFindObject(child, predicate, depth + 1);
      if (found) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = deepFindObject(child, predicate, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function deepFindArrays(value: unknown, keys: string[], depth = 0): unknown[] {
  if (depth > 5) return [];
  if (isRecord(value)) {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key] as unknown[];
    }
    for (const child of Object.values(value)) {
      const found = deepFindArrays(child, keys, depth + 1);
      if (found.length) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = deepFindArrays(child, keys, depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

const unwrapResult = (message?: LiveModelMessage) => message?.result ?? null;

const formatTime = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const formatNumber = (value: number | null, digits = 1) =>
  value === null ? "—" : value.toFixed(digits);

const formatPercent = (value: number | null, digits = 0) => {
  if (value === null) return "—";
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(digits)}%`;
};

const statusIcon = (status?: string) => {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
};

function MetricCard({
  label,
  value,
  helper,
  icon: Icon = Gauge,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon?: typeof Gauge;
}) {
  return (
    <Card className="border-border/70 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <CircleDot className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TacticalPitch({ tactical, teamNames }: { tactical: UnknownRecord; teamNames?: { 0: string; 1: string } }) {
  const teams = record(tactical.teams);
  const team0 = record(teams["0"]);
  const team1 = record(teams["1"]);
  const ball = record(tactical.ball);

  const drawTeam = (team: UnknownRecord, key: string, cssColor: string) => {
    const centroid = record(team.centroid);
    const cx = readNumber(centroid, "x");
    const cy = readNumber(centroid, "y");
    const lines = [
      readNumber(team, "defensive_line_height"),
      readNumber(team, "midfield_line_height"),
      readNumber(team, "attacking_line_height"),
    ].filter((value): value is number => value !== null);

    return (
      <g key={key}>
        {lines.map((x, index) => (
          <line
            key={`${key}-${index}`}
            x1={x}
            x2={x}
            y1="1"
            y2="67"
            stroke={cssColor}
            strokeWidth="0.45"
            strokeDasharray="2 1.5"
            opacity="0.75"
          />
        ))}
        {cx !== null && cy !== null && (
          <>
            <circle cx={cx} cy={cy} r="2.6" fill={cssColor} stroke="white" strokeWidth="0.5" />
            <circle cx={cx} cy={cy} r="5" fill="none" stroke={cssColor} strokeWidth="0.4" opacity="0.5" />
          </>
        )}
      </g>
    );
  };

  const ballX = readNumber(ball, "x");
  const ballY = readNumber(ball, "y");
  const ballVisible = readBoolean(ball, "visible") !== false;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-emerald-950/30 p-2">
      <svg viewBox="0 0 105 68" className="w-full">
        <rect x="0" y="0" width="105" height="68" rx="2" fill="rgba(5,70,45,.35)" />
        <g fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="0.35">
          <rect x="1" y="1" width="103" height="66" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="1" y="13.84" width="16.5" height="40.32" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" />
          <rect x="1" y="24.84" width="5.5" height="18.32" />
          <rect x="98.5" y="24.84" width="5.5" height="18.32" />
        </g>
        {drawTeam(team0, "team0", "hsl(var(--primary))")}
        {drawTeam(team1, "team1", "hsl(var(--destructive))")}
        {ballVisible && ballX !== null && ballY !== null && (
          <circle cx={ballX} cy={ballY} r="1.4" fill="white" stroke="#111827" strokeWidth="0.45" />
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />{teamNames?.[0] || "Team 0"} centroid/lines</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-destructive" />{teamNames?.[1] || "Team 1"} centroid/lines</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-white" />Ball</span>
      </div>
    </div>
  );
}

function TeamMetrics({ teamId, team, label }: { teamId: string; team: UnknownRecord; label?: string }) {
  const formation = record(team.formation);
  const lineGaps = record(team.line_gaps);
  return (
    <Card className="border-border/70 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label || `Team ${teamId}`}</CardTitle>
          <Badge variant="outline">{readString(team, "block_type")?.replaceAll("_", " ") || "Unknown block"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-muted-foreground">Players</p><p className="font-semibold">{readNumber(team, "players_count") ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Formation</p><p className="font-semibold">{readString(formation, "shape") || "Unknown"}</p></div>
        <div><p className="text-muted-foreground">Width</p><p className="font-semibold">{formatNumber(readNumber(team, "width"))} m</p></div>
        <div><p className="text-muted-foreground">Depth</p><p className="font-semibold">{formatNumber(readNumber(team, "depth"))} m</p></div>
        <div><p className="text-muted-foreground">Compactness</p><p className="font-semibold">{formatNumber(readNumber(team, "compactness"))}</p></div>
        <div><p className="text-muted-foreground">Spread area</p><p className="font-semibold">{formatNumber(readNumber(team, "team_spread_area"), 0)} m²</p></div>
        <div><p className="text-muted-foreground">Def–Mid gap</p><p className="font-semibold">{formatNumber(readNumber(lineGaps, "defense_midfield_gap"))} m</p></div>
        <div><p className="text-muted-foreground">Mid–Att gap</p><p className="font-semibold">{formatNumber(readNumber(lineGaps, "midfield_attack_gap"))} m</p></div>
      </CardContent>
    </Card>
  );
}

function TacticalPanel({ latest, history, teamNames }: { latest?: LiveModelMessage; history: LiveModelMessage[]; teamNames?: { 0: string; 1: string } }) {
  const tactical = deepFindObject(unwrapResult(latest), (item) => isRecord(item.teams) || Array.isArray(item.alerts)) || record(unwrapResult(latest));
  const teams = record(tactical.teams);
  const possession = record(tactical.possession);
  const pressure = record(tactical.pressure);
  const progression = record(tactical.ball_progression);
  const transition = record(tactical.transition);
  const reliability = record(tactical.reliability);

  const alertList = useMemo(() => {
    const seen = new Set<string>();
    const items: UnknownRecord[] = [];
    for (const message of [...history].reverse()) {
      const result = unwrapResult(message);
      const alerts = deepFindArrays(result, ["alerts", "tactical_alerts"]);
      for (const raw of alerts) {
        const alert = record(raw);
        const key = `${readString(alert, "type")}-${readString(alert, "team_id")}-${Math.round(readNumber(alert, "timestamp_sec") || 0)}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(alert);
        }
        if (items.length >= 5) return items;
      }
    }
    return items;
  }, [history]);

  if (!latest?.result) {
    return <EmptyState title="Waiting for tactical metrics" description="Team shape, pitch positions, alerts and reliability will appear with the next tactical window." />;
  }

  const reliabilityScore = readNumber(reliability, "overall_confidence", "confidence");
  const possessionTeam = firstDefined(possession.team_id, possession.team) as string | number | undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Possession" value={possessionTeam === undefined || possessionTeam === null ? "Unknown" : (String(possessionTeam) === "0" ? teamNames?.[0] || "Team 0" : String(possessionTeam) === "1" ? teamNames?.[1] || "Team 1" : `Team ${possessionTeam}`)} helper={`Confidence ${formatPercent(readNumber(possession, "confidence"))}`} icon={Users} />
        <MetricCard label="Pressure" value={readString(pressure, "pressure_level")?.toUpperCase() || "Unknown"} helper={`Nearest opponent ${formatNumber(readNumber(pressure, "nearest_opponent_distance"))} m`} icon={Waves} />
        <MetricCard label="Ball zone" value={readString(progression, "ball_zone")?.replaceAll("_", " ") || "Unknown"} helper={`Progressive ${formatNumber(readNumber(progression, "progressive_distance"))} m`} icon={Crosshair} />
        <MetricCard label="Reliability" value={formatPercent(reliabilityScore)} helper={reliabilityScore !== null && reliabilityScore < 0.5 ? "Low tracking reliability" : reliabilityScore !== null && reliabilityScore < 0.75 ? "Moderate tracking confidence" : "Tracking confidence"} icon={Activity} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <TacticalPitch tactical={tactical} teamNames={teamNames} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <TeamMetrics teamId="0" label={teamNames?.[0]} team={record(teams["0"])} />
          <TeamMetrics teamId="1" label={teamNames?.[1]} team={record(teams["1"])} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">Current tactical state</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Carrier under pressure</p><p className="font-semibold">{readBoolean(pressure, "ball_carrier_under_pressure") === null ? "Unknown" : readBoolean(pressure, "ball_carrier_under_pressure") ? "Yes" : "No"}</p></div>
            <div><p className="text-muted-foreground">Final third entry</p><p className="font-semibold">{readBoolean(progression, "is_final_third_entry") ? "Yes" : "No"}</p></div>
            <div><p className="text-muted-foreground">Box entry</p><p className="font-semibold">{readBoolean(progression, "is_box_entry") ? "Yes" : "No"}</p></div>
            <div><p className="text-muted-foreground">Transition</p><p className="font-semibold">{readBoolean(transition, "active") ? readString(transition, "type") || "Active" : "None"}</p></div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">Latest tactical alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alertList.length ? alertList.map((alert, index) => (
              <div key={index} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <AlertTriangle className={cn("mt-0.5 h-4 w-4", readString(alert, "severity") === "high" ? "text-destructive" : "text-amber-500")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{readString(alert, "type")?.replaceAll("_", " ") || "Tactical alert"}</p>
                  <p className="text-xs text-muted-foreground">{readString(alert, "message") || `Team ${readString(alert, "team_id") || "—"}`}</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{formatTime(readNumber(alert, "timestamp_sec"))}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No important tactical alert in the received windows.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function xgEvents(history: LiveModelMessage[]) {
  const events: UnknownRecord[] = [];
  const seen = new Set<string>();
  for (const message of history) {
    const result = unwrapResult(message);
    const found = deepFindArrays(result, ["events", "shots", "xg_events"]);
    for (const raw of found) {
      const event = record(raw);
      const type = readString(event, "event_type", "type");
      if (type && type !== "xg_shot" && !Object.prototype.hasOwnProperty.call(event, "xg")) continue;
      const key = `${readString(event, "shot_id", "id") || "shot"}-${readNumber(event, "frame_id") || ""}-${readNumber(event, "timestamp_sec") || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push(event);
      }
    }
  }
  return events.sort((a, b) => (readNumber(a, "timestamp_sec") || 0) - (readNumber(b, "timestamp_sec") || 0));
}

function ShotMap({ events }: { events: UnknownRecord[] }) {
  const points = events.map((event, index) => {
    const shotXY = array(event.shot_xy);
    const features = record(event.trained_features);
    const x = Number(firstDefined(shotXY[0], event.x, event.position_x, features.x, features.shot_x));
    const y = Number(firstDefined(shotXY[1], event.y, event.position_y, features.y, features.shot_y));
    return { event, index, x, y };
  }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-emerald-950/30 p-2">
      <svg viewBox="0 0 105 68" className="w-full">
        <rect width="105" height="68" rx="2" fill="rgba(5,70,45,.35)" />
        <g fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="0.35">
          <rect x="1" y="1" width="103" height="66" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="1" y="13.84" width="16.5" height="40.32" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" />
        </g>
        {points.map(({ event, index, x, y }) => {
          const value = readNumber(event, "xg") || 0;
          return <circle key={index} cx={x} cy={y} r={1.5 + value * 4} fill="hsl(var(--primary))" stroke="white" strokeWidth="0.4" opacity="0.85" />;
        })}
      </svg>
      {!points.length && <p className="p-3 text-center text-xs text-muted-foreground">Shot coordinates are not present in the received events.</p>}
    </div>
  );
}

function XgPanel({ history, teamNames }: { history: LiveModelMessage[]; teamNames?: { 0: string; 1: string } }) {
  const events = useMemo(() => xgEvents(history), [history]);
  const latestResult = history.length ? record(unwrapResult(history[history.length - 1])) : {};
  const sumFromEvents = events.reduce((sum, event) => sum + (readNumber(event, "xg") || 0), 0);
  const totalXg = events.length ? sumFromEvents : history.reduce((sum, message) => sum + (readNumber(record(unwrapResult(message)), "total_xg") || 0), 0);
  const shotCount = events.length || history.reduce((sum, message) => sum + (readNumber(record(unwrapResult(message)), "shot_count", "shots_count") || 0), 0);
  const team0Xg = events.filter((event) => String(firstDefined(event.team_id, event.team)) === "0").reduce((sum, event) => sum + (readNumber(event, "xg") || 0), 0);
  const team1Xg = events.filter((event) => String(firstDefined(event.team_id, event.team)) === "1").reduce((sum, event) => sum + (readNumber(event, "xg") || 0), 0);
  const best = [...events].sort((a, b) => (readNumber(b, "xg") || 0) - (readNumber(a, "xg") || 0))[0];

  if (!history.length) return <EmptyState title="Waiting for xG results" description="Shot events, total xG, chance quality and explanations will appear live." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total shots" value={shotCount} icon={Target} />
        <MetricCard label="Total xG" value={totalXg.toFixed(3)} icon={BarChart3} />
        <MetricCard label={`${teamNames?.[0] || "Team 0"} xG`} value={team0Xg.toFixed(3)} icon={Users} />
        <MetricCard label={`${teamNames?.[1] || "Team 1"} xG`} value={team1Xg.toFixed(3)} icon={Users} />
        <MetricCard label="Best chance" value={best ? formatPercent(readNumber(best, "xg"), 1) : "—"} helper={best ? formatTime(readNumber(best, "timestamp_sec")) : undefined} icon={Crosshair} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <ShotMap events={events} />
        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">Shot events</CardTitle></CardHeader>
          <CardContent>
            {events.length ? (
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-card"><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2">Time</th><th>Team</th><th>Shooter</th><th>xG</th><th>Quality</th><th>Distance</th></tr></thead>
                  <tbody>
                    {events.map((event, index) => {
                      const features = record(event.trained_features);
                      return (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-2">{formatTime(readNumber(event, "timestamp_sec"))}</td>
                          <td>{readString(event, "team_id", "team") === "0" ? teamNames?.[0] || "Team 0" : readString(event, "team_id", "team") === "1" ? teamNames?.[1] || "Team 1" : readString(event, "team_id", "team") || "—"}</td>
                          <td>{readString(event, "shooter_id", "player_id") || "—"}</td>
                          <td className="font-mono font-semibold text-primary">{formatNumber(readNumber(event, "xg"), 3)}</td>
                          <td>{readString(event, "quality") || "—"}</td>
                          <td>{formatNumber(readNumber(features, "distance_to_goal"))} m</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No shot detected yet" description={`The xG service is running. Latest window status: ${readString(latestResult, "status") || "completed"}.`} />
            )}
          </CardContent>
        </Card>
      </div>

      {best && (
        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">Best chance explanation</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{readString(record(best.explanation), "summary") || "No explanation summary was returned."}</p>
            <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
              <span>Angle: {formatNumber(readNumber(record(best.trained_features), "angle_to_goal"))} deg</span>
              <span>Nearest defender: {formatNumber(readNumber(record(best.vision_diagnostic_features), "nearest_defender_distance"))} m</span>
              <span>Goal visibility: {formatPercent(readNumber(record(best.vision_diagnostic_features), "goal_visible_ratio"))}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function offsideEvents(history: LiveModelMessage[]) {
  const events: UnknownRecord[] = [];
  const seen = new Set<string>();
  for (const message of history) {
    const found = deepFindArrays(unwrapResult(message), ["events", "offside_events", "decisions"]);
    for (const raw of found) {
      const event = record(raw);
      const key = `${readNumber(event, "frame_id", "freeze_frame_id") || ""}-${readNumber(event, "timestamp_sec", "freeze_timestamp_sec") || ""}-${readString(event, "receiver_id") || ""}`;
      if (!seen.has(key)) { seen.add(key); events.push(event); }
    }
  }
  return events.sort((a, b) => (readNumber(a, "timestamp_sec", "freeze_timestamp_sec") || 0) - (readNumber(b, "timestamp_sec", "freeze_timestamp_sec") || 0));
}

function OffsidePanel({ history }: { history: LiveModelMessage[] }) {
  const events = useMemo(() => offsideEvents(history), [history]);
  const latestResult = history.length ? record(unwrapResult(history[history.length - 1])) : {};
  const latestEvent = events[events.length - 1];
  const passCandidates = readNumber(latestResult, "pass_candidates", "passes_count");
  const eventsCount = events.length || readNumber(latestResult, "events_count", "offside_count") || 0;

  if (!history.length) return <EmptyState title="Waiting for offside analysis" description="Pass candidates, safety-gate decisions and offside events will appear live." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events" value={eventsCount} icon={ShieldAlert} />
        <MetricCard label="Pass candidates" value={passCandidates ?? "—"} icon={Waves} />
        <MetricCard label="Latest probability" value={latestEvent ? formatPercent(readNumber(latestEvent, "offside_probability", "probability"), 1) : "—"} icon={Gauge} />
        <MetricCard label="Risk level" value={latestEvent ? readString(latestEvent, "risk_level", "risk") || "—" : "No event"} icon={AlertTriangle} />
      </div>

      {events.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.slice().reverse().map((event, index) => {
            const probability = readNumber(event, "offside_probability", "probability", "confidence");
            const timestamp = readNumber(event, "timestamp_sec", "freeze_timestamp_sec");
            return (
              <Card key={index} className="border-border/70 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{readString(event, "decision", "recommendation") || "Possible Offside"}</CardTitle>
                    <Badge variant={probability !== null && probability >= 0.8 ? "destructive" : "outline"}>{formatPercent(probability, 1)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground">Time</p><p className="font-semibold">{formatTime(timestamp)}</p></div>
                  <div><p className="text-muted-foreground">Frame</p><p className="font-semibold">{readNumber(event, "freeze_frame_id", "frame_id") ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Passer</p><p className="font-semibold">#{readString(event, "passer_id") || "—"}</p></div>
                  <div><p className="text-muted-foreground">Receiver</p><p className="font-semibold">#{readString(event, "receiver_id") || "—"}</p></div>
                  <div><p className="text-muted-foreground">Margin</p><p className="font-semibold">{formatNumber(readNumber(event, "margin_m"), 3)} m</p></div>
                  <div><p className="text-muted-foreground">Defensive line</p><p className="font-semibold">{formatNumber(readNumber(event, "penultimate_x", "offside_line_x"), 2)} m</p></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No valid offside event" description="The offside service completed its windows but no event passed all pass, direction, defender-line and confidence safety gates." />
      )}
    </div>
  );
}

function FoulPanel({ history }: { history: LiveModelMessage[] }) {
  const completed = history.filter((message) => message.status === "completed" && message.result);
  const latest = completed[completed.length - 1];
  const latestResult = record(unwrapResult(latest));
  const confirmed = completed.filter((message) => {
    const decision = readString(record(unwrapResult(message)), "decision")?.toLowerCase();
    return decision === "foul" || decision === "confirmed_foul";
  });

  if (!history.length) return <EmptyState title="Waiting for foul analysis" description="The backend will cut a clip from the uploaded video and send it to the GPU clip classifier." />;

  const clipClassifier = record(latestResult.clip_classifier);
  const motionModel = record(latestResult.ml_motion_model);
  const fusion = record(latestResult.fusion);
  const bounds = record(latestResult.clip_bounds);
  const clipStart = readNumber(bounds, "start_time") ?? readNumber(latestResult, "start_time");
  const clipEnd = readNumber(bounds, "end_time") ?? readNumber(latestResult, "end_time");
  const decision = readString(latestResult, "decision") || "Pending";
  const confidence = readNumber(latestResult, "confidence");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Final decision" value={decision.replaceAll("_", " ").toUpperCase()} icon={AlertTriangle} />
        <MetricCard label="Fusion confidence" value={formatPercent(confidence, 1)} icon={Gauge} />
        <MetricCard label="Windows checked" value={completed.length} icon={FileWindowIcon} />
        <MetricCard label="Confirmed fouls" value={confirmed.length} icon={ShieldAlert} />
        <MetricCard label="Clip time" value={`${formatTime(clipStart)}–${formatTime(clipEnd)}`} icon={Timer} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">GPU clip classifier</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Label</span><strong>{readString(clipClassifier, "label") || "—"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><strong>{formatPercent(readNumber(clipClassifier, "confidence"), 1)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Device</span><strong>{readString(clipClassifier, "device") || "—"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Latency</span><strong>{formatNumber(readNumber(clipClassifier, "latency_ms"), 0)} ms</strong></div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">Motion model</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Label</span><strong>{readString(motionModel, "label") || "—"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><strong>{formatPercent(readNumber(motionModel, "confidence"), 1)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Average motion</span><strong>{formatNumber(readNumber(record(motionModel.features), "avg_motion"), 4)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Max motion</span><strong>{formatNumber(readNumber(record(motionModel.features), "max_motion"), 4)}</strong></div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/50">
          <CardHeader><CardTitle className="text-base">Fusion result</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><strong>{readString(latestResult, "mode") || "—"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Verified clip</span><strong>{readBoolean(latestResult, "clip_verified") === true || readString(latestResult, "mode") === "live_gpu_clip" || Object.keys(clipClassifier).length > 0 ? "Yes" : "Unavailable"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Threshold</span><strong>{formatPercent(readNumber(record(fusion.thresholds), "clip_foul_threshold"), 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Window</span><strong>#{latest?.window_number ?? "—"}</strong></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/50">
        <CardHeader><CardTitle className="text-base">Recent foul decisions</CardTitle></CardHeader>
        <CardContent className="max-h-[300px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2">Window</th><th>Clip</th><th>Decision</th><th>Confidence</th><th>Classifier</th><th>Motion</th></tr></thead>
            <tbody>{completed.slice().reverse().map((message) => {
              const result = record(unwrapResult(message));
              const clip = record(result.clip_bounds);
              const start = readNumber(clip, "start_time") ?? readNumber(result, "start_time");
              const end = readNumber(clip, "end_time") ?? readNumber(result, "end_time");
              return <tr key={message.window_number} className="border-b border-border/50"><td className="py-2">{message.window_number}</td><td>{formatTime(start)}–{formatTime(end)}</td><td className="font-semibold">{readString(result, "decision") || "—"}</td><td>{formatPercent(readNumber(result, "confidence"), 1)}</td><td>{readString(record(result.clip_classifier), "label") || "—"}</td><td>{readString(record(result.ml_motion_model), "label") || "—"}</td></tr>;
            })}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function FileWindowIcon(props: React.ComponentProps<typeof Activity>) {
  return <Activity {...props} />;
}

function TimelinePanel({ history }: { history: LiveModelHistory }) {
  const items = useMemo(() => {
    const timeline: Array<{ time: number; type: string; title: string; detail: string }> = [];
    for (const event of xgEvents(history.xg || [])) {
      timeline.push({ time: readNumber(event, "timestamp_sec") || 0, type: "xG", title: `Shot · xG ${formatNumber(readNumber(event, "xg"), 3)}`, detail: readString(event, "quality") || "Shot event" });
    }
    for (const event of offsideEvents(history.offside || [])) {
      timeline.push({ time: readNumber(event, "timestamp_sec", "freeze_timestamp_sec") || 0, type: "Offside", title: readString(event, "decision", "recommendation") || "Offside review", detail: `Probability ${formatPercent(readNumber(event, "offside_probability", "probability"), 1)}` });
    }
    for (const message of history.foul_candidate || []) {
      const result = record(unwrapResult(message));
      const decision = readString(result, "decision")?.toLowerCase();
      if (decision === "foul" || decision === "confirmed_foul") {
        const bounds = record(result.clip_bounds);
        timeline.push({ time: readNumber(bounds, "start_time") || 0, type: "Foul", title: "Confirmed foul", detail: `Confidence ${formatPercent(readNumber(result, "confidence"), 1)}` });
      }
    }
    for (const message of history.tactical || []) {
      const alerts = deepFindArrays(unwrapResult(message), ["alerts", "tactical_alerts"]);
      for (const raw of alerts) {
        const alert = record(raw);
        if (["high", "medium"].includes(readString(alert, "severity") || "")) timeline.push({ time: readNumber(alert, "timestamp_sec") || 0, type: "Tactical", title: readString(alert, "type")?.replaceAll("_", " ") || "Tactical alert", detail: readString(alert, "message") || "" });
      }
    }
    return timeline.sort((a, b) => b.time - a.time).slice(0, 30);
  }, [history]);

  if (!items.length) return <EmptyState title="No timeline events yet" description="Shots, valid offside events, confirmed fouls and important tactical alerts will appear here." />;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.type}-${item.time}-${index}`} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 p-3">
          <span className="w-14 font-mono text-xs text-primary">{formatTime(item.time)}</span>
          <Badge variant="outline">{item.type}</Badge>
          <div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div>
        </div>
      ))}
    </div>
  );
}

export function LiveAnalysisDashboard({ matchId, connected, latest, history, teamNames }: LiveAnalysisDashboardProps) {
  const totalMessages = Object.values(history).reduce((sum, messages) => sum + messages.length, 0);

  return (
    <section className="space-y-4">
      <Card className="border-primary/20 bg-card/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Live Match Intelligence</h2>
              <Badge variant={connected ? "default" : "outline"}>{connected ? "LIVE" : "RECONNECTING"}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Match #{matchId ?? "—"} · {totalMessages} model updates received</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MODEL_CONFIG.map(({ key, label, icon: Icon }) => {
              const message = latest[key];
              return (
                <div key={key} className="flex min-w-[112px] items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0"><p className="truncate text-xs font-medium">{label}</p><p className="text-[10px] text-muted-foreground">{message ? `Window ${message.window_number}` : "Waiting"}</p></div>
                  <span className="ml-auto">{statusIcon(message?.status)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tactical">Tactical</TabsTrigger>
          <TabsTrigger value="xg">xG</TabsTrigger>
          <TabsTrigger value="offside">Offside</TabsTrigger>
          <TabsTrigger value="foul">Foul</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <TacticalPanel latest={latest.tactical} history={history.tactical || []} teamNames={teamNames} />
          <div className="grid gap-6 xl:grid-cols-2">
            <XgPanel history={history.xg || []} teamNames={teamNames} />
            <div className="space-y-6">
              <OffsidePanel history={history.offside || []} />
              <FoulPanel history={history.foul_candidate || []} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="tactical"><TacticalPanel latest={latest.tactical} history={history.tactical || []} teamNames={teamNames} /></TabsContent>
        <TabsContent value="xg"><XgPanel history={history.xg || []} teamNames={teamNames} /></TabsContent>
        <TabsContent value="offside"><OffsidePanel history={history.offside || []} /></TabsContent>
        <TabsContent value="foul"><FoulPanel history={history.foul_candidate || []} /></TabsContent>
        <TabsContent value="timeline"><TimelinePanel history={history} /></TabsContent>
      </Tabs>
    </section>
  );
}
