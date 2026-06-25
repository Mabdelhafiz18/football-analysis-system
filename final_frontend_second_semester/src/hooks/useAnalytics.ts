import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/apiClient";

export interface Analytics {
  totalMatches: number;
  completedMatches: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
  decisions: { total: number; offsides: number; fouls: number };
  shots: { total: number; goals: number; avgXg: number };
  heatmap?: unknown;
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics-real"],
    queryFn: () => apiFetch<Analytics>("/analytics"),
    staleTime: 30_000,
    retry: 1,
  });
}
