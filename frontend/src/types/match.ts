// Match and Tactical Analysis Types

export type MatchStatus = "pending" | "processing" | "completed" | "failed";
export type Team = "home" | "away";

// Match list item
export interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  date: string;
  league: string;
  status: MatchStatus;
  venue?: string;
}

// Match summary with stats
export interface MatchSummary {
  matchId: number;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  goals: { home: number; away: number };
  xg: { home: number; away: number };
  fouls: { home: number; away: number };
  offsides: { home: number; away: number };
  cards: {
    yellowHome: number;
    yellowAway: number;
    redHome: number;
    redAway: number;
  };
}

// Tactical data
export interface TacticalData {
  matchId: number;
  formation: { home: string; away: string };
  avgPositions: PlayerPosition[];
  teamHeatmap: {
    gridW: number;
    gridH: number;
    home: number[][];
    away: number[][];
  };
  possessionTimeline: {
    minutes: number[];
    home: number[];
    away: number[];
  };
  keyPlayers: KeyPlayer[];
}

export interface PlayerPosition {
  playerId: number;
  team: Team;
  x: number;
  y: number;
  role: string;
}

export interface KeyPlayer {
  playerId: number;
  name: string;
  team: Team;
  goals: number;
  assists: number;
  shots: number;
  passAccuracy: number;
}

// Pass network
export interface PassNetwork {
  passes: PassConnection[];
}

export interface PassConnection {
  from: number;
  to: number;
  count: number;
}

// Heatmap point
export interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
}

// Shot prediction
export type ShotOutcome = "goal" | "saved" | "off_target" | "blocked" | "woodwork";

export interface ShotPrediction {
  id: string;
  matchId: number;
  team: Team;
  player: string;
  x: number;
  y: number;
  xg: number;
  outcome: ShotOutcome;
  minute: number;
  second: number;
}

// API response types
export interface ApiMatch {
  id: number;
  home_team: string;
  away_team: string;
  date: string;
  league: string;
  status: string;
}

export interface ApiMatchSummary {
  match_id: number;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  goals: { home: number; away: number };
  xg: { home: number; away: number };
  fouls: { home: number; away: number };
  offsides: { home: number; away: number };
  cards: {
    yellow_home: number;
    yellow_away: number;
    red_home: number;
    red_away: number;
  };
}

export interface ApiShotPrediction {
  shot_id: string;
  match_id: number;
  team: string;
  player: string;
  x: number;
  y: number;
  xg: number;
  outcome: string;
  minute: number;
  second: number;
}

export interface ApiTacticalData {
  match_id: number;
  formation: { home: string; away: string };
  avg_positions: {
    player_id: number;
    team: string;
    x: number;
    y: number;
    role: string;
  }[];
  team_heatmap: {
    grid_w: number;
    grid_h: number;
    home: number[][];
    away: number[][];
  };
  possession_timeline: {
    minutes: number[];
    home: number[];
    away: number[];
  };
  key_players: {
    player_id: number;
    name: string;
    team: string;
    goals: number;
    assists: number;
    shots: number;
    pass_accuracy: number;
  }[];
}

