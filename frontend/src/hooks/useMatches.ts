import { useQuery, useMutation } from "@tanstack/react-query";
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
      name: p.name,
      team: p.team as Team,
      goals: p.goals,
      assists: p.assists,
      shots: p.shots,
      passAccuracy: p.pass_accuracy,
    })),
  };
}

// Transform API shot prediction to frontend type
function transformShotPrediction(data: ApiShotPrediction): ShotPrediction {
  return {
    id: data.shot_id,
    matchId: data.match_id,
    team: data.team as Team,
    player: data.player,
    x: data.x,
    y: data.y,
    xg: data.xg,
    outcome: data.outcome as ShotOutcome,
    minute: data.minute,
    second: data.second,
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

// Fetch pass network
async function fetchPassNetwork(): Promise<PassNetwork> {
  try {
    const response = await fetch(`${API_BASE_URL}/tactical/pass-network`);
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
    staleTime: 5 * 60 * 1000,
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

export function usePassNetwork() {
  return useQuery({
    queryKey: ["passNetwork"],
    queryFn: fetchPassNetwork,
    staleTime: 5 * 60 * 1000,
  });
}

export function useShotPredictions(matchId: number) {
  return useQuery({
    queryKey: ["shotPredictions", matchId],
    queryFn: () => fetchShotPredictions(matchId),
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
  return {
    matchId,
    formation: { home: "4-3-3", away: "4-2-3-1" },
    avgPositions: [
      { playerId: 1, team: "home", x: 0.1, y: 0.5, role: "GK" },
      { playerId: 2, team: "home", x: 0.25, y: 0.15, role: "LB" },
      { playerId: 3, team: "home", x: 0.25, y: 0.38, role: "CB" },
      { playerId: 4, team: "home", x: 0.25, y: 0.62, role: "CB" },
      { playerId: 5, team: "home", x: 0.25, y: 0.85, role: "RB" },
      { playerId: 6, team: "home", x: 0.45, y: 0.3, role: "CM" },
      { playerId: 7, team: "home", x: 0.45, y: 0.5, role: "CM" },
      { playerId: 8, team: "home", x: 0.45, y: 0.7, role: "CM" },
      { playerId: 9, team: "home", x: 0.7, y: 0.2, role: "LW" },
      { playerId: 10, team: "home", x: 0.75, y: 0.5, role: "ST" },
      { playerId: 11, team: "home", x: 0.7, y: 0.8, role: "RW" },
      { playerId: 12, team: "away", x: 0.9, y: 0.5, role: "GK" },
      { playerId: 13, team: "away", x: 0.75, y: 0.15, role: "LB" },
      { playerId: 14, team: "away", x: 0.75, y: 0.38, role: "CB" },
      { playerId: 15, team: "away", x: 0.75, y: 0.62, role: "CB" },
      { playerId: 16, team: "away", x: 0.75, y: 0.85, role: "RB" },
      { playerId: 17, team: "away", x: 0.55, y: 0.35, role: "CDM" },
      { playerId: 18, team: "away", x: 0.55, y: 0.65, role: "CDM" },
      { playerId: 19, team: "away", x: 0.4, y: 0.2, role: "LW" },
      { playerId: 20, team: "away", x: 0.35, y: 0.5, role: "CAM" },
      { playerId: 21, team: "away", x: 0.4, y: 0.8, role: "RW" },
      { playerId: 22, team: "away", x: 0.25, y: 0.5, role: "ST" },
    ],
    teamHeatmap: {
      gridW: 12,
      gridH: 8,
      home: [
        [0, 0, 0, 1, 2, 3, 4, 5, 3, 2, 1, 0],
        [0, 0, 1, 3, 5, 7, 8, 7, 5, 3, 1, 0],
        [0, 1, 2, 4, 6, 9, 12, 9, 6, 4, 2, 1],
        [1, 2, 4, 6, 8, 11, 15, 11, 8, 6, 4, 2],
        [1, 2, 4, 6, 8, 11, 15, 11, 8, 6, 4, 2],
        [0, 1, 2, 4, 6, 9, 12, 9, 6, 4, 2, 1],
        [0, 0, 1, 3, 5, 7, 8, 7, 5, 3, 1, 0],
        [0, 0, 0, 1, 2, 3, 4, 5, 3, 2, 1, 0],
      ],
      away: [
        [0, 0, 0, 1, 2, 3, 4, 5, 3, 2, 1, 0],
        [0, 0, 1, 2, 4, 6, 7, 6, 4, 2, 1, 0],
        [0, 1, 2, 3, 5, 7, 9, 7, 5, 3, 2, 1],
        [1, 2, 3, 5, 7, 9, 11, 9, 7, 5, 3, 2],
        [1, 2, 3, 5, 7, 9, 11, 9, 7, 5, 3, 2],
        [0, 1, 2, 3, 5, 7, 9, 7, 5, 3, 2, 1],
        [0, 0, 1, 2, 4, 6, 7, 6, 4, 2, 1, 0],
        [0, 0, 0, 1, 2, 3, 4, 5, 3, 2, 1, 0],
      ],
    },
    possessionTimeline: {
      minutes: [0, 15, 30, 45, 60, 75, 90],
      home: [55, 58, 62, 60, 57, 56, 58],
      away: [45, 42, 38, 40, 43, 44, 42],
    },
    keyPlayers: [
      { playerId: 10, name: "Marcus Rashford", team: "home", goals: 1, assists: 1, shots: 5, passAccuracy: 87 },
      { playerId: 22, name: "Mohamed Salah", team: "away", goals: 1, assists: 0, shots: 4, passAccuracy: 82 },
      { playerId: 7, name: "Bruno Fernandes", team: "home", goals: 0, assists: 1, shots: 3, passAccuracy: 91 },
    ],
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
      player: "Marcus Rashford",
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
      player: "Mohamed Salah",
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
      player: "Bruno Fernandes",
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
      player: "Marcus Rashford",
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
      player: "Darwin Núñez",
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
      player: "Antony",
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
      player: "Mohamed Salah",
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
      player: "Jadon Sancho",
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
      player: "Marcus Rashford",
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
      player: "Luis Díaz",
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
      player: "Bruno Fernandes",
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
      player: "Cody Gakpo",
      x: 0.85,
      y: 0.52,
      xg: 0.32,
      outcome: "blocked",
      minute: 79,
      second: 22,
    },
  ];
}

