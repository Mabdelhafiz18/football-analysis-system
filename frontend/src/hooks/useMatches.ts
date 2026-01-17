import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import type {
  Match,
  MatchSummary,
  TacticalData,
  PassNetwork,
  HeatmapPoint,
  ApiMatch,
  ApiMatchSummary,
  ApiTacticalData,
  Team,
  ShotPrediction,
  ApiShotPrediction,
  ShotOutcome,
} from "@/types/match";

const API_BASE_URL = "http://localhost:8000";

// Transform API match to frontend type
function transformMatch(data: ApiMatch): Match {
  return {
    id: data.id,
    homeTeam: data.home_team,
    awayTeam: data.away_team,
    date: data.date,
    league: data.league,
    status: data.status as Match["status"],
  };
}

// Transform API summary to frontend type
function transformSummary(data: ApiMatchSummary): MatchSummary {
  return {
    matchId: data.match_id,
    possession: data.possession,
    shots: data.shots,
    shotsOnTarget: data.shots_on_target,
    goals: data.goals,
    xg: data.xg,
    fouls: data.fouls,
    offsides: data.offsides,
    cards: {
      yellowHome: data.cards.yellow_home,
      yellowAway: data.cards.yellow_away,
      redHome: data.cards.red_home,
      redAway: data.cards.red_away,
    },
  };
}

// Transform API tactical data to frontend type
function transformTactical(data: ApiTacticalData): TacticalData {
  return {
    matchId: data.match_id,
    formation: data.formation,
    avgPositions: data.avg_positions.map((p) => ({
      playerId: p.player_id,
      team: p.team as Team,
      x: p.x,
      y: p.y,
      role: p.role,
    })),
    teamHeatmap: {
      gridW: data.team_heatmap.grid_w,
      gridH: data.team_heatmap.grid_h,
      home: data.team_heatmap.home,
      away: data.team_heatmap.away,
    },
    possessionTimeline: data.possession_timeline,
    keyPlayers: data.key_players.map((p) => ({
      playerId: p.player_id,
      team: p.team as Team,
      goals: p.goals,
      assists: p.assists,
      shots: p.shots,
      passAccuracy: p.pass_accuracy,
      touches: p.touches,
      duelsWon: p.duels_won,
    })),
    xgTimeline: data.xg_timeline,
    pressingIntensity: data.pressing_intensity ? {
      home: {
        highPressSequences: data.pressing_intensity.home.high_press_sequences,
        recoveriesInFinalThird: data.pressing_intensity.home.recoveries_in_final_third,
        ppda: data.pressing_intensity.home.ppda,
      },
      away: {
        highPressSequences: data.pressing_intensity.away.high_press_sequences,
        recoveriesInFinalThird: data.pressing_intensity.away.recoveries_in_final_third,
        ppda: data.pressing_intensity.away.ppda,
      },
    } : undefined,
  };
}

// Transform API shot prediction to frontend type
function transformShotPrediction(data: ApiShotPrediction): ShotPrediction {
  // Position can come from x/y (normalized 0-1) or position_x/position_y (meters)
  // Convert meters to normalized if needed (assuming 105m x 68m pitch)
  const x = data.x ?? (data.position_x ? data.position_x / 105 : 0.5);
  const y = data.y ?? (data.position_y ? data.position_y / 68 : 0.5);

  return {
    id: String(data.shot_id),
    matchId: data.match_id,
    team: data.team as Team,
    playerNumber: data.player_number,
    x,
    y,
    xg: data.xg,
    outcome: data.outcome as ShotOutcome,
    minute: data.minute,
    second: data.second,
    timestamp: data.timestamp,
    frameNumber: data.frame_number,
    positionX: data.position_x,
    positionY: data.position_y,
    targetX: data.target_x,
    targetY: data.target_y,
    isGoal: data.is_goal,
    isOnTarget: data.is_on_target,
    goalProbability: data.goal_probability,
    bodyPart: data.body_part as ShotPrediction["bodyPart"],
    shotType: data.shot_type as ShotPrediction["shotType"],
  };
}

// Fetch all matches
async function fetchMatches(): Promise<Match[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/matches`);
    if (!response.ok) throw new Error("Failed to fetch matches");
    const data: ApiMatch[] = await response.json();
    return data.map(transformMatch);
  } catch (error) {
    console.warn("Using mock match data:", error);
    return getMockMatches();
  }
}

// Fetch single match summary
async function fetchMatchSummary(matchId: number): Promise<MatchSummary> {
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/summary`);
    if (!response.ok) throw new Error("Failed to fetch match summary");
    const data: ApiMatchSummary = await response.json();
    return transformSummary(data);
  } catch (error) {
    console.warn("Using mock summary data:", error);
    return getMockSummary(matchId);
  }
}

// Fetch tactical data
async function fetchTactical(matchId: number): Promise<TacticalData> {
  try {
    const response = await fetch(`${API_BASE_URL}/tactical/match/${matchId}`);
    if (!response.ok) throw new Error("Failed to fetch tactical data");
    const data: ApiTacticalData = await response.json();
    return transformTactical(data);
  } catch (error) {
    console.warn("Using mock tactical data:", error);
    return getMockTactical(matchId);
  }
}

// Fetch heatmap data
async function fetchHeatmap(): Promise<HeatmapPoint[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/tactical/heatmap`);
    if (!response.ok) throw new Error("Failed to fetch heatmap");
    return await response.json();
  } catch (error) {
    console.warn("Using mock heatmap data:", error);
    return getMockHeatmap();
  }
}

// Fetch pass network - optional matchId for specific match, otherwise aggregated
async function fetchPassNetwork(matchId?: number): Promise<PassNetwork> {
  try {
    const url = matchId
      ? `${API_BASE_URL}/tactical/pass-network?match_id=${matchId}`
      : `${API_BASE_URL}/tactical/pass-network`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch pass network");
    return await response.json();
  } catch (error) {
    console.warn("Using mock pass network data:", error);
    return getMockPassNetwork();
  }
}

// Fetch shot predictions
async function fetchShotPredictions(matchId: number): Promise<ShotPrediction[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/decisions/goal-prediction?match_id=${matchId}`);
    if (!response.ok) throw new Error("Failed to fetch shot predictions");
    const data: ApiShotPrediction[] = await response.json();
    return data.map(transformShotPrediction);
  } catch (error) {
    console.warn("Using mock shot prediction data:", error);
    return getMockShotPredictions(matchId);
  }
}

// Upload video
async function uploadVideo(file: File, metadata: { homeTeam: string; awayTeam: string; date: string; league: string }) {
  const formData = new FormData();
  formData.append("video", file);
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const response = await fetch(`${API_BASE_URL}/upload/upload-video`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Failed to upload video");
  return await response.json();
}

// Match status response type
interface MatchStatusResponse {
  match_id: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message?: string;
  processed_at?: string;
  error?: string;
}

// Fetch match status (for polling)
async function fetchMatchStatus(matchId: number): Promise<MatchStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/matches/${matchId}/status`);
  if (!response.ok) throw new Error("Failed to fetch match status");
  return await response.json();
}

// Match events response type
interface MatchEventsResponse {
  offsides: Array<{
    incident_id: number;
    minute: number;
    second: number;
    team: string;
    player_number: number;
    decision: string;

    confidence: number;
    offside_line_x?: number;
  }>;
  fouls: Array<{
    foul_id: number;
    minute: number;
    second: number;
    team: string;
    player_number: number;
    foul_type: string;
    card_type: string;
    confidence: number;
    x?: number;
    y?: number;
  }>;
  shots: Array<{
    shot_id: number;
    minute: number;
    second: number;
    team: string;
    player_number: number;
    is_goal: boolean;
    xg: number;
  }>;
}

// Fetch match events (offsides, fouls, shots)
async function fetchMatchEvents(
  matchId: number,
  filters?: { type?: string; team?: string }
): Promise<MatchEventsResponse> {
  let url = `${API_BASE_URL}/matches/${matchId}/events`;
  const params = new URLSearchParams();
  if (filters?.type) params.append("type", filters.type);
  if (filters?.team) params.append("team", filters.team);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch match events");
  return await response.json();
}

// Hooks
export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: fetchMatches,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMatchSummary(matchId: number) {
  return useQuery({
    queryKey: ["matchSummary", matchId],
    queryFn: () => fetchMatchSummary(matchId),
    staleTime: 5 * 60 * 1000,
    enabled: !!matchId,
  });
}

export function useTactical(matchId: number) {
  return useQuery({
    queryKey: ["tactical", matchId],
    queryFn: () => fetchTactical(matchId),
    staleTime: 10 * 1000, // Reduced to 10s for testing
    enabled: !!matchId,
  });
}

export function useHeatmap() {
  return useQuery({
    queryKey: ["heatmap"],
    queryFn: fetchHeatmap,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePassNetwork(matchId?: number) {
  return useQuery({
    queryKey: matchId ? ["passNetwork", matchId] : ["passNetwork"],
    queryFn: () => fetchPassNetwork(matchId),
    staleTime: 5 * 60 * 1000,
  });
}

// Tracking Data Types
export interface TrackingPlayer {
  player_id: number;
  team: "home" | "away";
  x: number;
  y: number;
  bbox?: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface TrackingFrame {
  frame: number;
  t?: number;
  timestamp?: number;
  players: TrackingPlayer[];
  ball: {
    x: number;
    y: number;
    bbox?: [number, number, number, number];
  };
}

// Buffer duration in seconds
const BUFFER_DURATION = 10;

// Fetch tracking data for a time range
async function fetchTrackingRange(matchId: number, startTime: number, endTime: number): Promise<{ frames: TrackingFrame[], fps: number, pitch: any } | null> {
  try {
    const url = `${API_BASE_URL}/matches/${matchId}/tracking/range?start_time=${startTime}&end_time=${endTime}`;
    console.log(`[Tracking] Fetching range: ${startTime}-${endTime} for match ${matchId}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Tracking] Failed to fetch range: ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    console.log(`[Tracking] Received ${data?.frames?.length} frames for range ${startTime}-${endTime}, first frame t=${data?.frames?.[0]?.timestamp}`);
    return data;
  } catch (error) {
    console.error("[Tracking] Error fetching range:", error);
    return null;
  }
}

// Hook for real-time tracking data with buffering
export function useTracking(matchId: number, timestamp: number, enabled: boolean = true) {
  // Calculate which buffer chunk we need (e.g., 0-10s, 10-20s)
  const chunkIndex = Math.floor(timestamp / BUFFER_DURATION);
  const startTime = chunkIndex * BUFFER_DURATION;
  const endTime = startTime + BUFFER_DURATION;

  // 1. Fetch the chunk of data
  const { data: bufferData, isLoading, isError } = useQuery({
    queryKey: ["trackingRange", matchId, chunkIndex],
    queryFn: () => fetchTrackingRange(matchId, startTime, endTime),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    enabled: enabled && matchId > 0,
    gcTime: 2 * 60 * 1000, // Keep unused buffers for a bit
  });

  // 2. Extract the specific frame for the current timestamp from the buffer
  if (!bufferData || !bufferData.frames) {
    // if (enabled && (isLoading || isError)) {
    //     console.log(`[Tracking] No buffer. Loading: ${isLoading}, Error: ${isError}`);
    // }
    return { data: null };
  }

  // Find the closest frame in the loaded buffer
  // Assuming frames are sorted by timestamp/t
  const targetTime = timestamp;
  let closestFrame = null;
  let minDiff = Number.MAX_VALUE;

  for (const frame of bufferData.frames) {
    const t = frame.t !== undefined ? frame.t : frame.timestamp;

    if (t === undefined) continue;

    const diff = Math.abs(t - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestFrame = frame;
    }
    // Optimization: if we passed the target time by more than 0.1s, stop searching
    // (Available since frames are sorted)
    if (t > targetTime + 0.2) break;
  }

  // Only return frame if it's reasonably close (e.g. within 0.1s) to avoid showing stale data if buffer completely missed
  const isValid = minDiff < 0.25;

  if (!isValid && enabled && bufferData.frames.length > 0) {
    // console.warn(`[Tracking] Frame miss. Target: ${targetTime.toFixed(2)}, Closest Diff: ${minDiff.toFixed(2)}`);
  }

  return {
    data: isValid ? closestFrame : null
  };
}

export function useShotPredictions(matchId: number) {
  return useQuery({
    queryKey: ["shotPredictions", matchId],
    queryFn: () => fetchShotPredictions(matchId),
    staleTime: 5 * 60 * 1000,
    enabled: !!matchId,
  });
}

// Match Status Hook with Polling
export function useMatchStatus(matchId: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["matchStatus", matchId],
    queryFn: () => fetchMatchStatus(matchId!),
    enabled: !!matchId && options?.enabled !== false,
    refetchInterval: (query) => {
      // Stop polling when completed or failed
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
    staleTime: 0, // Always fetch fresh status
  });
}

// Match Events Hook
export function useMatchEvents(
  matchId: number,
  filters?: { type?: string; team?: string }
) {
  return useQuery({
    queryKey: ["matchEvents", matchId, filters],
    queryFn: () => fetchMatchEvents(matchId, filters),
    staleTime: 5 * 60 * 1000,
    enabled: !!matchId,
  });
}

export function useUploadVideo() {
  return useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata: { homeTeam: string; awayTeam: string; date: string; league: string } }) =>
      uploadVideo(file, metadata),
  });
}

// Mock data functions
function getMockMatches(): Match[] {
  return [
    {
      id: 1,
      homeTeam: "Manchester United",
      awayTeam: "Liverpool",
      homeScore: 2,
      awayScore: 1,
      date: "2024-03-15T15:00:00Z",
      league: "Premier League",
      status: "completed",
      venue: "Old Trafford",
    },
    {
      id: 2,
      homeTeam: "Barcelona",
      awayTeam: "Real Madrid",
      homeScore: 3,
      awayScore: 2,
      date: "2024-03-20T20:00:00Z",
      league: "La Liga",
      status: "completed",
      venue: "Camp Nou",
    },
    {
      id: 3,
      homeTeam: "Bayern Munich",
      awayTeam: "Borussia Dortmund",
      date: "2024-03-25T18:30:00Z",
      league: "Bundesliga",
      status: "processing",
      venue: "Allianz Arena",
    },
    {
      id: 4,
      homeTeam: "PSG",
      awayTeam: "Marseille",
      date: "2024-03-28T21:00:00Z",
      league: "Ligue 1",
      status: "pending",
      venue: "Parc des Princes",
    },
  ];
}

function getMockSummary(matchId: number): MatchSummary {
  return {
    matchId,
    possession: { home: 58, away: 42 },
    shots: { home: 14, away: 9 },
    goals: { home: 2, away: 1 },
    xg: { home: 1.85, away: 1.12 },
    fouls: { home: 11, away: 15 },
    offsides: { home: 3, away: 5 },
    cards: {
      yellowHome: 2,
      yellowAway: 4,
      redHome: 0,
      redAway: 1,
    },
  };
}

function getMockTactical(matchId: number): TacticalData {
  const isMatch1 = matchId === 1;

  const avgPositions: PlayerPosition[] = isMatch1 ? [
    { playerId: 101, team: "home", x: 0.05, y: 0.50, role: "GK" },
    { playerId: 102, team: "home", x: 0.22, y: 0.15, role: "LB" },
    { playerId: 103, team: "home", x: 0.18, y: 0.38, role: "CB" },
    { playerId: 104, team: "home", x: 0.18, y: 0.62, role: "CB" },
    { playerId: 105, team: "home", x: 0.22, y: 0.85, role: "RB" },
    { playerId: 106, team: "home", x: 0.45, y: 0.30, role: "CM" },
    { playerId: 107, team: "home", x: 0.35, y: 0.50, role: "CDM" },
    { playerId: 108, team: "home", x: 0.45, y: 0.70, role: "CM" },
    { playerId: 109, team: "home", x: 0.70, y: 0.18, role: "LW" },
    { playerId: 110, team: "home", x: 0.80, y: 0.50, role: "ST" },
    { playerId: 111, team: "home", x: 0.70, y: 0.82, role: "RW" },
    { playerId: 201, team: "away", x: 0.95, y: 0.50, role: "GK" },
    { playerId: 202, team: "away", x: 0.78, y: 0.15, role: "LB" },
    { playerId: 203, team: "away", x: 0.82, y: 0.38, role: "CB" },
    { playerId: 204, team: "away", x: 0.82, y: 0.62, role: "CB" },
    { playerId: 205, team: "away", x: 0.78, y: 0.85, role: "RB" },
    { playerId: 206, team: "away", x: 0.65, y: 0.40, role: "CDM" },
    { playerId: 207, team: "away", x: 0.65, y: 0.60, role: "CDM" },
    { playerId: 208, team: "away", x: 0.52, y: 0.15, role: "LM" },
    { playerId: 209, team: "away", x: 0.48, y: 0.50, role: "CAM" },
    { playerId: 210, team: "away", x: 0.52, y: 0.85, role: "RM" },
    { playerId: 211, team: "away", x: 0.25, y: 0.50, role: "ST" }
  ] : [
    { playerId: 301, team: "home", x: 0.05, y: 0.50, role: "GK" },
    { playerId: 302, team: "home", x: 0.22, y: 0.15, role: "LB" },
    { playerId: 303, team: "home", x: 0.18, y: 0.38, role: "CB" },
    { playerId: 304, team: "home", x: 0.18, y: 0.62, role: "CB" },
    { playerId: 305, team: "home", x: 0.22, y: 0.85, role: "RB" },
    { playerId: 306, team: "home", x: 0.45, y: 0.30, role: "CM" },
    { playerId: 307, team: "home", x: 0.35, y: 0.50, role: "CDM" },
    { playerId: 308, team: "home", x: 0.45, y: 0.70, role: "CM" },
    { playerId: 309, team: "home", x: 0.70, y: 0.18, role: "LW" },
    { playerId: 310, team: "home", x: 0.80, y: 0.50, role: "ST" },
    { playerId: 311, team: "home", x: 0.70, y: 0.82, role: "RW" },
    { playerId: 401, team: "away", x: 0.95, y: 0.50, role: "GK" },
    { playerId: 402, team: "away", x: 0.78, y: 0.15, role: "LB" },
    { playerId: 403, team: "away", x: 0.82, "y": 0.38, role: "CB" },
    { playerId: 404, team: "away", x: 0.82, "y": 0.62, role: "CB" },
    { playerId: 405, team: "away", x: 0.78, "y": 0.85, role: "RB" },
    { playerId: 406, team: "away", x: 0.55, "y": 0.30, role: "CM" },
    { playerId: 407, team: "away", x: 0.65, "y": 0.50, role: "CDM" },
    { playerId: 408, team: "away", x: 0.55, "y": 0.70, role: "CM" },
    { playerId: 409, team: "away", x: 0.30, "y": 0.18, role: "LW" },
    { playerId: 410, team: "away", x: 0.20, "y": 0.50, role: "ST" },
    { playerId: 411, team: "away", x: 0.30, "y": 0.82, role: "RW" }
  ];

  return {
    matchId,
    formation: { home: "4-3-3", away: isMatch1 ? "4-2-3-1" : "4-3-3" },
    avgPositions,
    teamHeatmap: {
      gridW: 12,
      gridH: 8,
      home: [
        [2, 3, 4, 6, 8, 10, 12, 14, 11, 8, 5, 2],
        [3, 5, 7, 10, 14, 18, 22, 24, 18, 12, 6, 3],
        [4, 7, 11, 16, 22, 28, 32, 30, 24, 16, 8, 4],
        [5, 9, 14, 20, 28, 35, 40, 38, 30, 20, 10, 5],
        [5, 9, 14, 20, 28, 35, 40, 38, 30, 20, 10, 5],
        [4, 7, 11, 16, 22, 28, 32, 30, 24, 16, 8, 4],
        [3, 5, 7, 10, 14, 18, 22, 24, 18, 12, 6, 3],
        [2, 3, 4, 6, 8, 10, 12, 14, 11, 8, 5, 2]
      ],
      away: [
        [2, 4, 7, 10, 12, 14, 12, 10, 8, 6, 4, 2],
        [3, 6, 10, 14, 18, 20, 18, 14, 10, 7, 5, 3],
        [4, 8, 14, 20, 26, 28, 24, 18, 12, 8, 6, 4],
        [5, 10, 16, 24, 32, 34, 30, 22, 14, 9, 7, 5],
        [5, 10, 16, 24, 32, 34, 30, 22, 14, 9, 7, 5],
        [4, 8, 14, 20, 26, 28, 24, 18, 12, 8, 6, 4],
        [3, 6, 10, 14, 18, 20, 18, 14, 10, 7, 5, 3],
        [2, 4, 7, 10, 12, 14, 12, 10, 8, 6, 4, 2]
      ],
    },
    possessionTimeline: {
      minutes: [0, 15, 30, 45, 60, 75, 90],
      home: [50, 50, 50, 50, 50, 50, 50],
      away: [50, 50, 50, 50, 50, 50, 50],
    },
    keyPlayers: [],
  };
}

function getMockHeatmap(): HeatmapPoint[] {
  return [
    { x: 20, y: 50, intensity: 0.7 },
    { x: 40, y: 30, intensity: 0.3 },
    { x: 60, y: 45, intensity: 0.9 },
    { x: 25, y: 70, intensity: 0.5 },
    { x: 75, y: 35, intensity: 0.8 },
    { x: 50, y: 50, intensity: 0.6 },
    { x: 30, y: 20, intensity: 0.4 },
    { x: 80, y: 60, intensity: 0.85 },
    { x: 15, y: 40, intensity: 0.2 },
    { x: 65, y: 25, intensity: 0.75 },
  ];
}

function getMockPassNetwork(): PassNetwork {
  return {
    passes: [
      { from: 8, to: 10, count: 12 },
      { from: 6, to: 22, count: 5 },
      { from: 10, to: 9, count: 8 },
      { from: 4, to: 6, count: 15 },
      { from: 6, to: 8, count: 10 },
      { from: 8, to: 11, count: 7 },
      { from: 5, to: 7, count: 9 },
      { from: 7, to: 9, count: 6 },
      { from: 9, to: 10, count: 11 },
      { from: 10, to: 7, count: 4 },
    ],
  };
}

function getMockShotPredictions(matchId: number): ShotPrediction[] {
  return [
    {
      id: "shot-1",
      matchId,
      team: "home",
      playerNumber: 10,
      x: 0.88,
      y: 0.48,
      xg: 0.42,
      outcome: "saved",
      minute: 7,
      second: 45,
    },
    {
      id: "shot-2",
      matchId,
      team: "away",
      playerNumber: 11,
      x: 0.85,
      y: 0.52,
      xg: 0.38,
      outcome: "off_target",
      minute: 14,
      second: 23,
    },
    {
      id: "shot-3",
      matchId,
      team: "home",
      playerNumber: 8,
      x: 0.82,
      y: 0.50,
      xg: 0.15,
      outcome: "blocked",
      minute: 21,
      second: 17,
    },
    {
      id: "shot-4",
      matchId,
      team: "home",
      playerNumber: 10,
      x: 0.92,
      y: 0.45,
      xg: 0.68,
      outcome: "goal",
      minute: 26,
      second: 52,
    },
    {
      id: "shot-5",
      matchId,
      team: "away",
      playerNumber: 9,
      x: 0.87,
      y: 0.55,
      xg: 0.35,
      outcome: "saved",
      minute: 33,
      second: 8,
    },
    {
      id: "shot-6",
      matchId,
      team: "home",
      playerNumber: 21,
      x: 0.78,
      y: 0.35,
      xg: 0.08,
      outcome: "off_target",
      minute: 39,
      second: 34,
    },
    {
      id: "shot-7",
      matchId,
      team: "away",
      playerNumber: 11,
      x: 0.89,
      y: 0.50,
      xg: 0.55,
      outcome: "goal",
      minute: 44,
      second: 19,
    },
    {
      id: "shot-8",
      matchId,
      team: "home",
      playerNumber: 25,
      x: 0.86,
      y: 0.42,
      xg: 0.28,
      outcome: "saved",
      minute: 52,
      second: 41,
    },
    {
      id: "shot-9",
      matchId,
      team: "home",
      playerNumber: 10,
      x: 0.91,
      y: 0.48,
      xg: 0.62,
      outcome: "saved",
      minute: 58,
      second: 27,
    },
    {
      id: "shot-10",
      matchId,
      team: "away",
      playerNumber: 7,
      x: 0.83,
      y: 0.58,
      xg: 0.12,
      outcome: "off_target",
      minute: 65,
      second: 13,
    },
    {
      id: "shot-11",
      matchId,
      team: "home",
      playerNumber: 8,
      x: 0.88,
      y: 0.50,
      xg: 0.45,
      outcome: "goal",
      minute: 71,
      second: 56,
    },
    {
      id: "shot-12",
      matchId,
      team: "away",
      playerNumber: 18,
      x: 0.85,
      y: 0.52,
      xg: 0.32,
      outcome: "blocked",
      minute: 79,
      second: 22,
    },
  ];
}
