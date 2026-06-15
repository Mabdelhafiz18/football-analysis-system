from config import TEAM_DIRECTIONS


class BallProgressionModule:
    def calculate(self, frames, possession):
        balls = [f["ball"] for f in frames if f.get("ball")]
        if len(balls) < 2:
            return {"ball_zone": None, "is_final_third_entry": False, "is_box_entry": False, "progressive_distance": 0.0, "reliable": False, "reason": "not_enough_ball_positions"}

        team_id = possession.get("team_id")
        if team_id is None:
            team_id = possession.get("dominant_team_id")
        if team_id is None:
            team_id = 0

        direction = TEAM_DIRECTIONS[int(team_id)]
        start_x = balls[0]["x"]
        end_x = balls[-1]["x"]
        progressive_distance = end_x - start_x if direction == "left_to_right" else start_x - end_x

        start_zone = self._zone(start_x, direction)
        end_zone = self._zone(end_x, direction)
        is_final_third_entry = start_zone != "attacking_third" and end_zone == "attacking_third"
        is_box_entry = self._in_box(end_x, balls[-1]["y"], direction)

        return {"ball_zone": end_zone, "is_final_third_entry": is_final_third_entry, "is_box_entry": is_box_entry, "progressive_distance": round(progressive_distance, 2), "reliable": True}

    def _zone(self, x, direction):
        if direction == "left_to_right":
            if x < 35:
                return "defensive_third"
            if x < 70:
                return "middle_third"
            return "attacking_third"
        if x > 70:
            return "defensive_third"
        if x > 35:
            return "middle_third"
        return "attacking_third"

    def _in_box(self, x, y, direction):
        # Simplified penalty-box zone using field coordinates.
        in_central_y = 13.84 <= y <= 54.16
        if direction == "left_to_right":
            return x >= 88.5 and in_central_y
        return x <= 16.5 and in_central_y
