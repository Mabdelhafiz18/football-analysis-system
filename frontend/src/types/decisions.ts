// Unified Incident Types for Referee Decisions Page

export type IncidentType = "offside" | "foul";
export type FilterType = "all" | "offside" | "foul";
export type FoulSeverity = "low" | "medium" | "high";
export type CardType = "none" | "yellow" | "red";
export type OffsideDecision = "offside" | "onside";
export type Team = "home" | "away";

// Base incident shared by both types
export interface BaseIncident {
  id: string;
  type: IncidentType;
  minute: number;
  second: number;
  team: Team;
  player: string;
  confidence: number;
  timestamp: number; // Total seconds from start
  isKeyDecision?: boolean;
}

// Offside-specific incident
export interface OffsideIncident extends BaseIncident {
  type: "offside";
  decision: OffsideDecision;
  marginMeters: number; // Distance in meters
}

// Foul-specific incident
export interface FoulIncident extends BaseIncident {
  type: "foul";
  severity: FoulSeverity;
  card: CardType;
  foulType?: string; // push, tackle, trip, obstruction, etc.
}

// Union type for all incidents
export type Incident = OffsideIncident | FoulIncident;

// Match information
export interface MatchInfo {
  matchId: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score: {
    home: number;
    away: number;
  };
  competition: string;
  date: string;
  venue?: string;
}

export interface TeamInfo {
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor?: string;
  logo?: string;
}

// Summary statistics
export interface DecisionsSummary {
  totalIncidents: number;
  offsideCount: {
    home: number;
    away: number;
  };
  foulCount: {
    home: number;
    away: number;
  };
  cards: {
    yellowHome: number;
    yellowAway: number;
    redHome: number;
    redAway: number;
  };
}

// Explainability card data
export interface ExplainabilityData {
  visualEvidence: string; // URL to thumbnail or frame
  numericReason: string; // e.g., "Distance: 32cm offside" or "Contact from behind"
  explanation: string; // Plain language explanation
  confidence: number;
  factors?: ExplainabilityFactor[];
}

export interface ExplainabilityFactor {
  name: string;
  value: string | number;
  impact: "positive" | "negative" | "neutral";
}

// Overlay types for video player
export interface OverlayState {
  showPlayers: boolean;
  showBall: boolean;
  showOffsideLine: boolean;
  showFoulHighlight: boolean;
}

export interface PlayerOverlay {
  playerId: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  team: Team;
  isHighlighted: boolean;
  label?: string;
}

export interface OffsideLineOverlay {
  x: number; // X position as percentage
  attackerPosition: { x: number; y: number };
  defenderPosition: { x: number; y: number };
}

// Video player state
export interface VideoState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
}

// API Response types (matching your backend)
export interface ApiOffsideResponse {
  incident_id: number;
  minute: number;
  second: number;
  team: string;
  player: string;
  decision: string;
  margin_m: number;
  confidence: number;
}

export interface ApiFoulResponse {
  foul_id: number;
  minute: number;
  second: number;
  team: string;
  player: string;
  severity: string;
  card: string;
  confidence: number;
}

// Type guards
export function isOffsideIncident(incident: Incident): incident is OffsideIncident {
  return incident.type === "offside";
}

export function isFoulIncident(incident: Incident): incident is FoulIncident {
  return incident.type === "foul";
}

