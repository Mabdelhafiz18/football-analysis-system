from config import POSSESSION_DISTANCE_THRESHOLD_M
from geometry import distance


class PossessionModule:
    """
    Possession detection with a hard + soft threshold.

    Hard threshold from requirements: 3m.
    Soft fallback: up to 7m gives weak possession instead of showing None all the time.
    This is useful for broadcast footage where ball/player pitch mapping can be noisy.
    """

    SOFT_POSSESSION_DISTANCE_M = 7.0

    def calculate_frame(self, frame):
        ball = frame.get("ball")
        players = frame.get("players", [])
        if not ball:
            return self._empty("ball_not_visible")
        if not players:
            return self._empty("no_players")

        nearest = min(players, key=lambda p: distance((ball["x"], ball["y"]), (p["x"], p["y"])))
        dist = distance((ball["x"], ball["y"]), (nearest["x"], nearest["y"]))

        if dist <= POSSESSION_DISTANCE_THRESHOLD_M:
            confidence = max(0.55, 1.0 - (dist / max(POSSESSION_DISTANCE_THRESHOLD_M, 0.1)) * 0.45)
            return {
                "team_id": nearest["team_id"],
                "player_id": nearest["id"],
                "distance_to_ball": round(dist, 2),
                "confidence": round(confidence, 2),
                "reliable": True,
                "quality": "strong",
            }

        if dist <= self.SOFT_POSSESSION_DISTANCE_M:
            # Weak but useful fallback. Dashboard can show this as lower confidence.
            confidence = max(0.2, 1.0 - (dist / self.SOFT_POSSESSION_DISTANCE_M))
            return {
                "team_id": nearest["team_id"],
                "player_id": nearest["id"],
                "distance_to_ball": round(dist, 2),
                "confidence": round(confidence, 2),
                "reliable": True,
                "quality": "weak",
                "reason": "soft_threshold",
            }

        return {
            "team_id": None,
            "player_id": None,
            "distance_to_ball": round(dist, 2),
            "confidence": 0.0,
            "reliable": False,
            "reason": "nearest_player_too_far",
        }

    def calculate_window(self, frames):
        counts = {0: 0, 1: 0, None: 0}
        sequence = []
        confidence_sum = {0: 0.0, 1: 0.0}

        for frame in frames:
            p = self.calculate_frame(frame)
            team_id = p.get("team_id") if p.get("reliable") else None
            counts[team_id] += 1
            sequence.append(team_id)
            if team_id in [0, 1]:
                confidence_sum[team_id] += p.get("confidence", 0.0)

        total = len(frames) or 1
        dominant = 0 if counts[0] > counts[1] else 1 if counts[1] > counts[0] else None
        stability = (counts[dominant] / total) if dominant is not None else 0.0
        avg_confidence = (confidence_sum[dominant] / max(counts[dominant], 1)) if dominant is not None else 0.0

        return {
            "dominant_team_id": dominant,
            "stability": round(stability, 2),
            "avg_confidence": round(avg_confidence, 2),
            "counts": {str(k): v for k, v in counts.items()},
            "sequence": sequence,
            "reliable": stability >= 0.35,
        }

    def _empty(self, reason):
        return {"team_id": None, "player_id": None, "distance_to_ball": None, "confidence": 0.0, "reliable": False, "reason": reason}
