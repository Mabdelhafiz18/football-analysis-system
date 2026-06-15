class OutputSchemaBuilder:
    def build(self, frame, teams, formations, heatmaps, possession, progression, pressure, transition, alerts, reliability):
        enriched_teams = {}
        for team_id in ["0", "1"]:
            team_data = dict(teams.get(team_id, {}))
            team_data.pop("reliable", None)
            team_data.pop("reason", None)
            team_data["formation"] = formations.get(team_id)
            team_data["heatmap"] = heatmaps.get(team_id)
            enriched_teams[team_id] = team_data

        ball = frame.get("ball") or {}
        return {
            "job_id": frame.get("job_id"),
            "frame_id": frame.get("frame_id"),
            "timestamp_sec": frame.get("timestamp_sec"),
            "ball": {"x": ball.get("x"), "y": ball.get("y"), "visible": bool(ball)},
            "teams": enriched_teams,
            "possession": {k: v for k, v in possession.items() if k != "reliable" and k != "reason"},
            "ball_progression": {k: v for k, v in progression.items() if k != "reliable" and k != "reason"},
            "pressure": {k: v for k, v in pressure.items() if k != "reliable" and k != "reason"},
            "transition": {k: v for k, v in transition.items() if k != "reliable" and k != "reason" and k != "sequence"},
            "alerts": alerts,
            "reliability": reliability,
        }

    def validate_minimal(self, output):
        required = ["job_id", "frame_id", "timestamp_sec", "ball", "teams", "possession", "ball_progression", "pressure", "transition", "alerts", "reliability"]
        missing = [key for key in required if key not in output]
        if missing:
            raise ValueError(f"Output schema missing keys: {missing}")
        for team_id in ["0", "1"]:
            if team_id not in output["teams"]:
                raise ValueError(f"Missing team {team_id} in output schema")
        return True
