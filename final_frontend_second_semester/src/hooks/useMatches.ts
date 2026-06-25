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

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// Transform API match to frontend type
function transformMatch(data: ApiMatch): Match {
  return {
    id: data.id,
    homeTeam: data.home_team,
    awayTeam: data.away_team,
    date: data.date,
    league: data.league,
    status: (data.processing_status || data.status) as Match["status"],
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
    console.error("Failed to load matches from backend:", error);
    throw error;
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
    console.error("Failed to load match summary from backend:", error);
    throw error;
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
    console.error("Failed to load tactical model data:", error);
    throw error;
  }
}

// Fetch heatmap data
async function fetchHeatmap(): Promise<HeatmapPoint[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/tactical/heatmap`);
    if (!response.ok) throw new Error("Failed to fetch heatmap");
    return await response.json();
  } catch (error) {
    console.error("Failed to load heatmap data:", error);
    throw error;
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
    console.error("Failed to load pass-network data:", error);
    throw error;
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
    console.error("Failed to load xG shot data:", error);
    throw error;
  }
}

interface UploadVideoOptions {
  onProgress?: (progress: number) => void;
}

interface UploadVideoResponse {
  match_id: number;
  status: string;
  message: string;
}

// Upload video
async function uploadVideo(
  file: File,
  metadata: { homeTeam: string; awayTeam: string; date: string; league: string },
  options: UploadVideoOptions = {}
): Promise<UploadVideoResponse> {
  const formData = new FormData();
  formData.append("video", file);
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return new Promise<UploadVideoResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", `${API_BASE_URL}/upload/upload-video`);
    request.timeout = Number(import.meta.env.VITE_UPLOAD_TIMEOUT_MS || 2 * 60 * 60 * 1000);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      const contentType = request.getResponseHeader("content-type") || "";
      let payload: unknown = request.responseText;

      if (contentType.includes("application/json")) {
        try {
          payload = JSON.parse(request.responseText || "null");
        } catch {
          reject(new Error("Backend returned invalid JSON after upload."));
          return;
        }
      }

      if (request.status < 200 || request.status >= 300) {
        const message =
          typeof payload === "object" && payload && "message" in payload
            ? String((payload as { message?: unknown }).message)
            : typeof payload === "object" && payload && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : `Upload failed (${request.status})`;
        reject(new Error(message));
        return;
      }

      resolve(payload as UploadVideoResponse);
    };

    request.onerror = () => {
      reject(new Error("Upload failed because the backend connection was lost."));
    };

    request.ontimeout = () => {
      reject(new Error("Upload timed out before the backend accepted the full video."));
    };

    request.send(formData);
  });
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
async function fetchTrackingRange(matchId: number, startTime: number, endTime: number): Promise<{ frames: TrackingFrame[], fps: number, pitch: unknown } | null> {
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
    mutationFn: ({ file, metadata, onProgress }: { file: File; metadata: { homeTeam: string; awayTeam: string; date: string; league: string }; onProgress?: (progress: number) => void }) =>
      uploadVideo(file, metadata, { onProgress }),
  });
}
