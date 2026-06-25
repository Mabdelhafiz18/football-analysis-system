import { Navigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { MatchIntelligenceWorkspace } from "@/components/analysis/MatchIntelligenceWorkspace";

export default function RefereeDecisions() {
  const { id, analysisId } = useParams<{ id?: string; analysisId?: string }>();
  const matchId = Number(id || analysisId);
  if (!Number.isInteger(matchId) || matchId <= 0) return <Navigate to="/matches" replace />;
  return <AppLayout title="VAR Decisions & Replay"><MatchIntelligenceWorkspace matchId={matchId} /></AppLayout>;
}
