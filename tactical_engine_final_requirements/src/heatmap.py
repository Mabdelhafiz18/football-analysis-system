from config import HEATMAP_GRID_COLS, HEATMAP_GRID_ROWS, PITCH_LENGTH_M, PITCH_WIDTH_M
from geometry import clamp


class HeatmapModule:
    def calculate(self, frames):
        result = {}
        for team_id in [0, 1]:
            grid = [[0 for _ in range(HEATMAP_GRID_COLS)] for _ in range(HEATMAP_GRID_ROWS)]
            points = []
            for frame in frames:
                for p in frame.get("players", []):
                    if p["team_id"] != team_id:
                        continue
                    col = int(clamp(p["x"] / PITCH_LENGTH_M * HEATMAP_GRID_COLS, 0, HEATMAP_GRID_COLS - 1))
                    row = int(clamp(p["y"] / PITCH_WIDTH_M * HEATMAP_GRID_ROWS, 0, HEATMAP_GRID_ROWS - 1))
                    grid[row][col] += 1
                    points.append({"x": round(p["x"], 2), "y": round(p["y"], 2), "player_id": p["id"], "timestamp_sec": frame["timestamp_sec"]})
            result[str(team_id)] = {"grid_size": [HEATMAP_GRID_COLS, HEATMAP_GRID_ROWS], "team_grid": grid, "points": points}
        return result
