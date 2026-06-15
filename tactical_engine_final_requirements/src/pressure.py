from config import PRESSURE_HIGH_THRESHOLD_M, PRESSURE_MEDIUM_THRESHOLD_M
from geometry import distance


class PressureModule:
    def calculate(self, frame, possession):
        if not possession.get("reliable") or possession.get("player_id") is None:
            return {"ball_carrier_under_pressure": False, "nearest_opponent_distance": None, "pressure_level": "unknown", "reliable": False, "reason": "no_ball_carrier"}

        players = frame.get("players", [])
        carrier = next((p for p in players if p["id"] == possession["player_id"]), None)
        if carrier is None:
            return {"ball_carrier_under_pressure": False, "nearest_opponent_distance": None, "pressure_level": "unknown", "reliable": False, "reason": "carrier_missing"}

        opponents = [p for p in players if p["team_id"] != carrier["team_id"]]
        if not opponents:
            return {"ball_carrier_under_pressure": False, "nearest_opponent_distance": None, "pressure_level": "none", "reliable": False, "reason": "no_opponents"}

        nearest_distance = min(distance((carrier["x"], carrier["y"]), (o["x"], o["y"])) for o in opponents)
        if nearest_distance < PRESSURE_HIGH_THRESHOLD_M:
            level = "high"
        elif nearest_distance < PRESSURE_MEDIUM_THRESHOLD_M:
            level = "medium"
        elif nearest_distance < 6.0:
            level = "low"
        else:
            level = "none"

        return {"ball_carrier_under_pressure": level in ["medium", "high"], "nearest_opponent_distance": round(nearest_distance, 2), "pressure_level": level, "reliable": True}
