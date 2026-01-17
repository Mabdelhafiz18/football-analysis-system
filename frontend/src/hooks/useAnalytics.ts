import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = "http://localhost:8000";

// Heatmap types
interface AggregatedHeatmap {
  grid_w: number;
  grid_h: number;
  home: number[][];
  away: number[][];
}

interface HeatmapStats {
  totalMatches: number;
  aggregatedHeatmap: AggregatedHeatmap | null;
}

// Backend response type
interface ApiAnalyticsResponse {
  totalMatches: number;
  completedMatches: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
  decisions: {
    total: number;
    offsides: number;
    fouls: number;
  };
  shots: {
    total: number;
    goals: number;
    avgXG: number;
  };
  cards: {
    yellow: number;
    red: number;
  };
  leagueBreakdown: Record<string, { total: number; completed: number }>;
  statusBreakdown: {
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  heatmapStats?: HeatmapStats;
}

// Frontend analytics type
export interface Analytics {
  totalMatches: number;
  completedMatches: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
  decisions: {
    total: number;
    offsides: number;
    fouls: number;
  };
  shots: {
    total: number;
    goals: number;
    avgXG: number;
  };
  cards: {
    yellow: number;
    red: number;
  };
  leagueBreakdown: Record<string, { total: number; completed: number }>;
  statusBreakdown: {
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  heatmapStats?: HeatmapStats;
}

// Export heatmap types for use in other components
export type { HeatmapStats, AggregatedHeatmap };

// Transform API response to frontend type (currently 1:1 but allows future modifications)
function transformAnalytics(data: ApiAnalyticsResponse): Analytics {
  return {
    totalMatches: data.totalMatches,
    completedMatches: data.completedMatches,
    totalGoals: data.totalGoals,
    avgGoalsPerMatch: data.avgGoalsPerMatch,
    decisions: {
      total: data.decisions.total,
      offsides: data.decisions.offsides,
      fouls: data.decisions.fouls,
    },
    shots: {
      total: data.shots.total,
      goals: data.shots.goals,
      avgXG: data.shots.avgXG,
    },
    cards: {
      yellow: data.cards.yellow,
      red: data.cards.red,
    },
    leagueBreakdown: data.leagueBreakdown,
    statusBreakdown: data.statusBreakdown,
    heatmapStats: data.heatmapStats,
  };
}

// Fetch analytics from backend
async function fetchAnalytics(): Promise<Analytics> {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics`);
    if (!response.ok) {
      throw new Error("Failed to fetch analytics");
    }
    const data: ApiAnalyticsResponse = await response.json();
    return transformAnalytics(data);
  } catch (error) {
    console.warn("Using mock analytics data:", error);
    return getMockAnalytics();
  }
}

// Mock analytics data for fallback
function getMockAnalytics(): Analytics {
  return {
    totalMatches: 2,
    completedMatches: 2,
    totalGoals: 8,
    avgGoalsPerMatch: 4,
    decisions: {
      total: 156,
      offsides: 48,
      fouls: 108,
    },
    shots: {
      total: 27,
      goals: 8,
      avgXG: 2.5,
    },
    cards: {
      yellow: 5,
      red: 1,
    },
    leagueBreakdown: {
      "Premier League": { total: 1, completed: 1 },
      "La Liga": { total: 1, completed: 1 },
    },
    statusBreakdown: {
      completed: 2,
      processing: 0,
      pending: 0,
      failed: 0,
    },
    heatmapStats: {
      totalMatches: 2,
      aggregatedHeatmap: {
        grid_w: 12,
        grid_h: 8,
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
    },
  };
}

// Hook to fetch analytics
export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

export default useAnalytics;

