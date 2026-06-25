import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL, apiFetch } from "./apiClient";
import type { MatchAnalysisResponse } from "@/types/analysis";

export const getMatchAnalysis = (matchId: number) =>
  apiFetch<MatchAnalysisResponse>(`/api/analysis/matches/${matchId}`);

export const getMatchVideoUrl = (matchId: number) =>
  `${API_BASE_URL}/api/analysis/matches/${matchId}/video`;

export function useMatchAnalysis(matchId: number | null, live = false) {
  return useQuery({
    queryKey: ["real-match-analysis", matchId],
    queryFn: () => getMatchAnalysis(matchId!),
    enabled: Boolean(matchId),
    refetchInterval: live ? 3000 : false,
    staleTime: live ? 0 : 30_000,
    retry: 1,
  });
}
