import { useQuery } from "@tanstack/react-query";
import type {
  Incident,
  OffsideIncident,
  FoulIncident,
  MatchInfo,
  DecisionsSummary,
  ExplainabilityData,
  ApiOffsideResponse,
  ApiFoulResponse,
  FoulSeverity,
  CardType,
  OffsideDecision,
  Team,
} from "@/types/decisions";

// API Base URL - adjust based on your backend
const API_BASE_URL = "http://localhost:8000";

// Transform API offside response to our Incident type
function transformOffsideResponse(data: ApiOffsideResponse): OffsideIncident {
  return {
    id: `offside-${data.incident_id}`,
    type: "offside",
    minute: data.minute,
    second: data.second,
    team: data.team as Team,
    player: data.player,
    confidence: data.confidence,
    timestamp: data.minute * 60 + data.second,
    decision: data.decision as OffsideDecision,
    marginMeters: data.margin_m,
    isKeyDecision: data.margin_m < 0.2, // Close calls are key decisions
  };
}

// Transform API foul response to our Incident type
function transformFoulResponse(data: ApiFoulResponse): FoulIncident {
  return {
    id: `foul-${data.foul_id}`,
    type: "foul",
    minute: data.minute,
    second: data.second,
    team: data.team as Team,
    player: data.player,
    confidence: data.confidence,
    timestamp: data.minute * 60 + data.second,
    severity: data.severity as FoulSeverity,
    card: data.card as CardType,
    isKeyDecision: data.card !== "none" || data.severity === "high",
  };
}

// Fetch offside incidents
async function fetchOffsides(): Promise<OffsideIncident[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/decisions/offside`);
    if (!response.ok) throw new Error("Failed to fetch offsides");
    const data: ApiOffsideResponse[] = await response.json();
    return data.map(transformOffsideResponse);
  } catch (error) {
    console.warn("Using mock offside data:", error);
    // Return mock data if API fails
    return getMockOffsides();
  }
}

// Fetch foul incidents
async function fetchFouls(): Promise<FoulIncident[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/decisions/fouls`);
    if (!response.ok) throw new Error("Failed to fetch fouls");
    const data: ApiFoulResponse[] = await response.json();
    return data.map(transformFoulResponse);
  } catch (error) {
    console.warn("Using mock foul data:", error);
    // Return mock data if API fails
    return getMockFouls();
  }
}

// Hook to fetch all decisions
export function useDecisions(analysisId: string) {
  const offsidesQuery = useQuery({
    queryKey: ["offsides", analysisId],
    queryFn: fetchOffsides,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const foulsQuery = useQuery({
    queryKey: ["fouls", analysisId],
    queryFn: fetchFouls,
    staleTime: 5 * 60 * 1000,
  });

  // Combine and sort all incidents by timestamp
  const allIncidents: Incident[] = [
    ...(offsidesQuery.data || []),
    ...(foulsQuery.data || []),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const isLoading = offsidesQuery.isLoading || foulsQuery.isLoading;
  const isError = offsidesQuery.isError && foulsQuery.isError;
  const error = offsidesQuery.error || foulsQuery.error;

  // Calculate summary
  const summary: DecisionsSummary = {
    totalIncidents: allIncidents.length,
    offsideCount: {
      home: allIncidents.filter((i) => i.type === "offside" && i.team === "home").length,
      away: allIncidents.filter((i) => i.type === "offside" && i.team === "away").length,
    },
    foulCount: {
      home: allIncidents.filter((i) => i.type === "foul" && i.team === "home").length,
      away: allIncidents.filter((i) => i.type === "foul" && i.team === "away").length,
    },
    cards: {
      yellowHome: allIncidents.filter(
        (i) => i.type === "foul" && i.team === "home" && (i as FoulIncident).card === "yellow"
      ).length,
      yellowAway: allIncidents.filter(
        (i) => i.type === "foul" && i.team === "away" && (i as FoulIncident).card === "yellow"
      ).length,
      redHome: allIncidents.filter(
        (i) => i.type === "foul" && i.team === "home" && (i as FoulIncident).card === "red"
      ).length,
      redAway: allIncidents.filter(
        (i) => i.type === "foul" && i.team === "away" && (i as FoulIncident).card === "red"
      ).length,
    },
  };

  return {
    incidents: allIncidents,
    offsides: offsidesQuery.data || [],
    fouls: foulsQuery.data || [],
    summary,
    isLoading,
    isError,
    error,
    offsidesError: offsidesQuery.isError,
    foulsError: foulsQuery.isError,
  };
}

// Hook to get match info (mock for now)
export function useMatchInfo(analysisId: string) {
  return useQuery({
    queryKey: ["matchInfo", analysisId],
    queryFn: async (): Promise<MatchInfo> => {
      // Return mock data - replace with actual API call when available
      return getMockMatchInfo();
    },
    staleTime: Infinity, // Match info doesn't change
  });
}

// Generate explainability data for an incident
export function getExplainabilityData(incident: Incident): ExplainabilityData {
  if (incident.type === "offside") {
    const offsideIncident = incident as OffsideIncident;
    const marginCm = Math.round(offsideIncident.marginMeters * 100);
    const isOffside = offsideIncident.decision === "offside";
    
    return {
      visualEvidence: "/placeholder.svg", // Would be actual frame image
      numericReason: `${isOffside ? "Offside" : "Onside"} by ${marginCm}cm`,
      explanation: isOffside
        ? `${offsideIncident.player} was ${marginCm}cm beyond the last defender when the ball was played.`
        : `${offsideIncident.player} was ${marginCm}cm behind or level with the last defender when the ball was played.`,
      confidence: offsideIncident.confidence,
      factors: [
        {
          name: "Distance Margin",
          value: `${marginCm}cm`,
          impact: isOffside ? "negative" : "positive",
        },
        {
          name: "AI Confidence",
          value: `${Math.round(offsideIncident.confidence * 100)}%`,
          impact: offsideIncident.confidence > 0.9 ? "positive" : "neutral",
        },
      ],
    };
  } else {
    const foulIncident = incident as FoulIncident;
    const severityText = {
      low: "Minor",
      medium: "Moderate",
      high: "Severe",
    }[foulIncident.severity];
    
    const cardText = foulIncident.card === "none" 
      ? "No card issued" 
      : `${foulIncident.card.charAt(0).toUpperCase() + foulIncident.card.slice(1)} card`;

    return {
      visualEvidence: "/placeholder.svg",
      numericReason: `${severityText} foul - ${cardText}`,
      explanation: `${foulIncident.player} committed a ${foulIncident.severity} severity foul. ${
        foulIncident.card !== "none"
          ? `A ${foulIncident.card} card was shown.`
          : "No card was warranted."
      }`,
      confidence: foulIncident.confidence,
      factors: [
        {
          name: "Severity",
          value: severityText,
          impact: foulIncident.severity === "high" ? "negative" : "neutral",
        },
        {
          name: "Card Decision",
          value: cardText,
          impact: foulIncident.card === "red" ? "negative" : "neutral",
        },
        {
          name: "AI Confidence",
          value: `${Math.round(foulIncident.confidence * 100)}%`,
          impact: foulIncident.confidence > 0.85 ? "positive" : "neutral",
        },
      ],
    };
  }
}

// Mock data functions
function getMockMatchInfo(): MatchInfo {
  return {
    matchId: "match-1",
    homeTeam: {
      name: "Manchester United",
      shortName: "MUN",
      primaryColor: "#DA291C",
      secondaryColor: "#FBE122",
    },
    awayTeam: {
      name: "Liverpool",
      shortName: "LIV",
      primaryColor: "#C8102E",
      secondaryColor: "#00B2A9",
    },
    score: {
      home: 2,
      away: 1,
    },
    competition: "Premier League",
    date: "2024-01-15",
    venue: "Old Trafford",
  };
}

function getMockOffsides(): OffsideIncident[] {
  return [
    {
      id: "offside-1001",
      type: "offside",
      minute: 12,
      second: 34,
      team: "away",
      player: "Mohamed Salah",
      decision: "offside",
      marginMeters: 0.15,
      confidence: 0.92,
      timestamp: 12 * 60 + 34,
      isKeyDecision: true,
    },
    {
      id: "offside-1002",
      type: "offside",
      minute: 28,
      second: 17,
      team: "home",
      player: "Marcus Rashford",
      decision: "onside",
      marginMeters: 0.08,
      confidence: 0.88,
      timestamp: 28 * 60 + 17,
      isKeyDecision: true,
    },
    {
      id: "offside-1003",
      type: "offside",
      minute: 35,
      second: 52,
      team: "away",
      player: "Darwin Núñez",
      decision: "offside",
      marginMeters: 0.32,
      confidence: 0.95,
      timestamp: 35 * 60 + 52,
      isKeyDecision: false,
    },
    {
      id: "offside-1004",
      type: "offside",
      minute: 61,
      second: 43,
      team: "home",
      player: "Antony",
      decision: "offside",
      marginMeters: 0.12,
      confidence: 0.89,
      timestamp: 61 * 60 + 43,
      isKeyDecision: true,
    },
    {
      id: "offside-1005",
      type: "offside",
      minute: 78,
      second: 29,
      team: "away",
      player: "Cody Gakpo",
      decision: "offside",
      marginMeters: 0.45,
      confidence: 0.97,
      timestamp: 78 * 60 + 29,
      isKeyDecision: false,
    },
  ];
}

function getMockFouls(): FoulIncident[] {
  return [
    {
      id: "foul-1001",
      type: "foul",
      minute: 5,
      second: 23,
      team: "away",
      player: "Fabinho",
      severity: "medium",
      card: "yellow",
      confidence: 0.88,
      timestamp: 5 * 60 + 23,
      isKeyDecision: true,
    },
    {
      id: "foul-1002",
      type: "foul",
      minute: 18,
      second: 47,
      team: "home",
      player: "Casemiro",
      severity: "low",
      card: "none",
      confidence: 0.82,
      timestamp: 18 * 60 + 47,
      isKeyDecision: false,
    },
    {
      id: "foul-1003",
      type: "foul",
      minute: 31,
      second: 35,
      team: "away",
      player: "Ibrahima Konaté",
      severity: "medium",
      card: "yellow",
      confidence: 0.91,
      timestamp: 31 * 60 + 35,
      isKeyDecision: true,
    },
    {
      id: "foul-1004",
      type: "foul",
      minute: 56,
      second: 54,
      team: "away",
      player: "Jordan Henderson",
      severity: "medium",
      card: "yellow",
      confidence: 0.89,
      timestamp: 56 * 60 + 54,
      isKeyDecision: true,
    },
    {
      id: "foul-1005",
      type: "foul",
      minute: 64,
      second: 19,
      team: "away",
      player: "Andy Robertson",
      severity: "high",
      card: "red",
      confidence: 0.94,
      timestamp: 64 * 60 + 19,
      isKeyDecision: true,
    },
    {
      id: "foul-1006",
      type: "foul",
      minute: 73,
      second: 41,
      team: "home",
      player: "Raphaël Varane",
      severity: "low",
      card: "none",
      confidence: 0.81,
      timestamp: 73 * 60 + 41,
      isKeyDecision: false,
    },
  ];
}

