class ReliabilityModule:
    def calculate(self, frame, teams):
        players = frame.get("players", [])
        ball = frame.get("ball")
        team_0_count = len([p for p in players if p["team_id"] == 0])
        team_1_count = len([p for p in players if p["team_id"] == 1])
        avg_conf = sum(p.get("confidence", 0) for p in players) / len(players) if players else 0.0
        team_0_reliable = team_0_count >= 6
        team_1_reliable = team_1_count >= 6
        ball_reliable = bool(ball and ball.get("confidence", 0) >= 0.5)
        count_score = min((team_0_count + team_1_count) / 20, 1.0)
        ball_score = 1.0 if ball_reliable else 0.0
        overall = count_score * 0.5 + avg_conf * 0.25 + ball_score * 0.25
        return {"team_0_reliable": team_0_reliable, "team_1_reliable": team_1_reliable, "ball_reliable": ball_reliable, "overall_confidence": round(overall, 2), "players_detected": team_0_count + team_1_count}
