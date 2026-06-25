import { Navigate, useParams } from "react-router-dom";

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/match/${id}/live`} replace />;
}
