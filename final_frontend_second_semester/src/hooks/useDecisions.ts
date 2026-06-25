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
const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// Transform API offside response to our Incident type
function transformOffsideResponse(data: ApiOffsideResponse): OffsideIncident {
  return {
    id: `offside-${data.incident_id}`,
    type: "offside",
    minute: data.minute,
    second: data.second,
    team: data.team as Team,
    playerNumber: data.player_number || 0,
    confidence: data.confidence,
    timestamp: data.timestamp || (data.minute * 60 + data.second),
    decision: data.decision as OffsideDecision,
    marginMeters: data.margin_m,
    isKeyDecision: data.margin_m < 0.2, // Close calls are key decisions
    offsideLineX: data.offside_line_x,
    playerX: data.player_x,
    playerY: data.player_y,
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
    playerNumber: data.player_number || 0,
    confidence: data.confidence,
    timestamp: data.timestamp || (data.minute * 60 + data.second),
    severity: data.severity as FoulSeverity,
    card: (data.card || data.card_type || "none") as CardType,
    foulType: data.foul_type,
    isKeyDecision: (data.card || data.card_type) !== "none" || data.severity === "high",
    x: data.x,
    y: data.y,
  };
}

// Fetch offside incidents from unified events endpoint
async function fetchOffsides(matchId: string): Promise<OffsideIncident[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/events?type=offside`);
    if (!response.ok) throw new Error("Failed to fetch offsides");
    const data = await response.json();
    // Transform from unified format with full position data
    return (data.offsides || []).map((item: any) => transformOffsideResponse({
      incident_id: item.incident_id,
      minute: item.minute,
      second: item.second,
      timestamp: item.timestamp,
      team: item.team,
      player_number: item.player_number,
      decision: item.decision,
      margin_m: item.margin_m || 0.15,
      confidence: item.confidence,
      offside_line_x: item.offside_line_x,
      player_x: item.player_x,
      player_y: item.player_y,
    }));
  } catch (error) {
    console.error("Failed to load offside events:", error);
    throw error;
  }
}

// Fetch foul incidents from unified events endpoint
async function fetchFouls(matchId: string): Promise<FoulIncident[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/events?type=foul`);
    if (!response.ok) throw new Error("Failed to fetch fouls");
    const data = await response.json();
    // Transform from unified format with full position data
    return (data.fouls || []).map((item: any) => transformFoulResponse({
      foul_id: item.foul_id,
      minute: item.minute,
      second: item.second,
      timestamp: item.timestamp,
      team: item.team,
      player_number: item.player_number,
      foul_type: item.foul_type,
      severity: item.severity || "medium",
      card: item.card_type || item.card || "none",
      card_type: item.card_type,
      confidence: item.confidence,
      x: item.x,
      y: item.y,
    }));
  } catch (error) {
    console.error("Failed to load foul events:", error);
    throw error;
  }
}

// Hook to fetch all decisions
export function useDecisions(analysisId: string) {
  const offsidesQuery = useQuery({
    queryKey: ["offsides", analysisId],
    queryFn: () => fetchOffsides(analysisId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const foulsQuery = useQuery({
    queryKey: ["fouls", analysisId],
    queryFn: () => fetchFouls(analysisId),
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

// Hook to get match info
export function useMatchInfo(analysisId: string) {
  return useQuery({
    queryKey: ["matchInfo", analysisId],
    queryFn: async (): Promise<MatchInfo> => {
      try {
        // Fetch match summary from backend
        const response = await fetch(`${API_BASE_URL}/matches/${analysisId}/summary`);
        if (!response.ok) throw new Error("Failed to fetch match info");
        const data = await response.json();

        // Transform to MatchInfo format
        return {
          matchId: analysisId,
          homeTeam: {
            name: data.home_team || "Home Team",
            shortName: (data.home_team || "HOM").substring(0, 3).toUpperCase(),
            primaryColor: "#4ade80",
            secondaryColor: "#166534",
          },
          awayTeam: {
            name: data.away_team || "Away Team",
            shortName: (data.away_team || "AWY").substring(0, 3).toUpperCase(),
            primaryColor: "#ef4444",
            secondaryColor: "#991b1b",
          },
          score: {
            home: data.goals?.home || 0,
            away: data.goals?.away || 0,
          },
          competition: data.league || "Unknown League",
          date: data.date || new Date().toISOString(),
          venue: data.venue || "Unknown Venue",
        };
      } catch (error) {
        console.error("Failed to load match info:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Generate explainability data for an incident
export function getExplainabilityData(incident: Incident): ExplainabilityData {
  if (incident.type === "offside") {
    const offsideIncident = incident as OffsideIncident;
    const marginCm = Math.round(offsideIncident.marginMeters * 100);
    const isOffside = offsideIncident.decision === "offside";

    return {
      visualEvidence: undefined
      numericReason: `${isOffside ? "Offside" : "Onside"} by ${marginCm}cm`,
      explanation: isOffside
        ? `Player #${offsideIncident.playerNumber} was ${marginCm}cm beyond the last defender when the ball was played.`
        : `Player #${offsideIncident.playerNumber} was ${marginCm}cm behind or level with the last defender when the ball was played.`,
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
      visualEvidence: undefined,
      numericReason: `${severityText} foul - ${cardText}`,
      explanation: `Player #${foulIncident.playerNumber} committed a ${foulIncident.severity} severity foul. ${foulIncident.card !== "none"
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
