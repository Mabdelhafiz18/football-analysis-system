from config import MIN_PLAYERS_FOR_TEAM_METRICS, TEAM_DIRECTIONS, ALERT_THRESHOLDS
from geometry import distance, mean


class TeamMetricsModule:
    def calculate(self, frame):
        result = {}
        for team_id in [0, 1]:
            players = [p for p in frame.get("players", []) if p["team_id"] == team_id]
            result[str(team_id)] = self._calculate_team(team_id, players)
        return result

    def _calculate_team(self, team_id, players):
        if len(players) < MIN_PLAYERS_FOR_TEAM_METRICS:
            return {
                "reliable": False,
                "reason": "low_detection_count",
                "players_count": len(players),
            }

        xs = [p["x"] for p in players]
        ys = [p["y"] for p in players]
        centroid = {"x": round(mean(xs), 2), "y": round(mean(ys), 2)}
        width = max(ys) - min(ys)
        depth = max(xs) - min(xs)
        compactness = mean(distance((p["x"], p["y"]), (centroid["x"], centroid["y"])) for p in players)

        direction = TEAM_DIRECTIONS[team_id]
        sorted_players = sorted(players, key=lambda p: p["x"])
        if direction == "left_to_right":
            defenders = sorted_players[:4]
            midfielders = sorted_players[4:8]
            attackers = sorted_players[8:]
        else:
            defenders = sorted_players[-4:]
            midfielders = sorted_players[-8:-4]
            attackers = sorted_players[:-8]

        defensive_line = mean(p["x"] for p in defenders)
        midfield_line = mean(p["x"] for p in midfielders)
        attacking_line = mean(p["x"] for p in attackers) if attackers else midfield_line
        block_type = self._block_type(team_id, defensive_line)

        return {
            "reliable": True,
            "players_count": len(players),
            "centroid": centroid,
            "width": round(width, 2),
            "depth": round(depth, 2),
            "compactness": round(compactness, 2),
            "team_spread_area": round(width * depth, 2),
            "defensive_line_height": round(defensive_line, 2),
            "midfield_line_height": round(midfield_line, 2),
            "attacking_line_height": round(attacking_line, 2),
            "block_type": block_type,
            "line_gaps": {
                "defense_midfield_gap": round(abs(midfield_line - defensive_line), 2),
                "midfield_attack_gap": round(abs(attacking_line - midfield_line), 2),
            },
        }

    def _block_type(self, team_id, defensive_line):
        direction = TEAM_DIRECTIONS[team_id]
        if direction == "left_to_right":
            if defensive_line < 30:
                return "low_block"
            if defensive_line <= 55:
                return "mid_block"
            return "high_block"
        if defensive_line > 75:
            return "low_block"
        if defensive_line >= 50:
            return "mid_block"
        return "high_block"
