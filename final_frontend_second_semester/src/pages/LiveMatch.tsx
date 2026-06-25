import { Navigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { MatchIntelligenceWorkspace } from "@/components/analysis/MatchIntelligenceWorkspace";

export default function LiveMatch() {
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) return <Navigate to="/matches" replace />;
  return <AppLayout title="Live Match Intelligence"><MatchIntelligenceWorkspace matchId={matchId} /></AppLayout>;
}
