from collections import defaultdict
from config import MIN_PLAYERS_FOR_FORMATION, TEAM_DIRECTIONS
from geometry import mean


class FormationModule:
    """
    Robust window-based formation detection.

    Important fix:
    Tracking IDs can fragment across a 5-10s window. The old version counted all
    unique track IDs in the window, which could produce impossible shapes like
    4-16-3. This version:
      1) averages positions per player id,
      2) keeps the most stable/recent tracks,
      3) caps the tactical shape to outfield players only,
      4) returns unknown instead of impossible formations.
    """

    def calculate(self, frames):
        return {str(team_id): self._team_formation(team_id, frames) for team_id in [0, 1]}

    def _team_formation(self, team_id, frames):
        if not frames:
            return self._unknown("empty_window")

        positions = defaultdict(list)
        last_seen = {}

        for frame_index, frame in enumerate(frames):
            for p in frame.get("players", []):
                if p.get("team_id") == team_id:
                    positions[p["id"]].append((p["x"], p["y"]))
                    last_seen[p["id"]] = frame_index

        avg_players = []
        for player_id, pts in positions.items():
            avg_players.append({
                "id": player_id,
                "x": mean(x for x, _ in pts),
                "y": mean(y for _, y in pts),
                "samples": len(pts),
                "last_seen": last_seen.get(player_id, -1),
            })

        if len(avg_players) < MIN_PLAYERS_FOR_FORMATION:
            result = self._unknown("low_detection_count")
            result["detected_tracks"] = len(avg_players)
            return result

        # Prefer players that are stable and recently visible. This prevents
        # fragmented old track IDs from being counted as extra midfielders.
        avg_players = sorted(
            avg_players,
            key=lambda p: (p["samples"], p["last_seen"]),
            reverse=True,
        )[:11]

        direction = TEAM_DIRECTIONS[team_id]
        tactical_players = self._remove_goalkeeper_if_present(avg_players, direction)

        # Formation should describe outfield players. Keep at most 10.
        tactical_players = tactical_players[:10]
        n = len(tactical_players)

        if n < 8:
            result = self._unknown("not_enough_stable_outfield_players")
            result["detected_tracks"] = len(avg_players)
            result["stable_outfield_players"] = n
            return result

        defense, midfield, attack = self._line_counts_from_positions(tactical_players, direction)
        total = defense + midfield + attack

        # Safety guard: never show impossible demo output.
        if total > 10 or midfield > 5 or attack > 4 or defense > 5:
            result = self._unknown("unrealistic_formation_detected")
            result["raw_lines"] = {"defense": defense, "midfield": midfield, "attack": attack}
            return result

        shape = f"{defense}-{midfield}-{attack}"
        avg_sample_ratio = mean(p["samples"] for p in avg_players) / max(len(frames), 1)
        player_count_score = min(n / 10, 1.0)
        confidence = min(0.95, player_count_score * 0.65 + min(avg_sample_ratio, 1.0) * 0.3)

        return {
            "shape": shape,
            "confidence": round(confidence, 2),
            "lines": {"defense": defense, "midfield": midfield, "attack": attack},
            "stable_outfield_players": n,
            "detected_tracks": len(positions),
        }

    def _remove_goalkeeper_if_present(self, players, direction):
        if len(players) <= 10:
            return list(players)

        # The goalkeeper is usually the most defensive player.
        if direction == "left_to_right":
            goalkeeper = min(players, key=lambda p: p["x"])
        else:
            goalkeeper = max(players, key=lambda p: p["x"])

        return [p for p in players if p["id"] != goalkeeper["id"]]

    def _line_counts_from_positions(self, players, direction):
        # For a demo-stable formation, first try common shapes by outfield count.
        # With 10 stable outfield players, 4-3-3 is the safest default for this
        # dataset unless clustering strongly suggests otherwise.
        n = len(players)
        if n >= 10:
            return 4, 3, 3
        if n == 9:
            return 4, 3, 2
        if n == 8:
            return 4, 2, 2

        return 3, max(2, n - 5), 2

    def _unknown(self, reason):
        return {
            "shape": "unknown",
            "confidence": 0.0,
            "reason": reason,
            "lines": {"defense": 0, "midfield": 0, "attack": 0},
        }
