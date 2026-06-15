PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M = 68.0

INPUT_STREAM = "vision:frames"
OUTPUT_STREAM = "tactical:insights"
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0

TEAM_DIRECTIONS = {
    0: "left_to_right",
    1: "right_to_left",
}

CLASS_IDS = {
    "ball": 0,
    "valid_players": [1, 2],  # player + goalkeeper depending on Vision Core mapping
}

CONFIDENCE_THRESHOLD = 0.5
POSSESSION_DISTANCE_THRESHOLD_M = 3.0
PRESSURE_MEDIUM_THRESHOLD_M = 3.0
PRESSURE_HIGH_THRESHOLD_M = 1.5
COUNTER_ATTACK_PROGRESS_THRESHOLD_M = 18.0

WINDOWS = {
    "short": 5.0,
    "medium": 10.0,
    "long": 30.0,
}

HEATMAP_GRID_COLS = 21
HEATMAP_GRID_ROWS = 14
MIN_PLAYERS_FOR_TEAM_METRICS = 6
MIN_PLAYERS_FOR_FORMATION = 8

ALERT_THRESHOLDS = {
    "large_width": 45.0,
    "large_depth": 58.0,
    "low_compactness": 24.0,
    "space_between_lines": 22.0,
    "high_defensive_line_team0": 55.0,
    "high_defensive_line_team1": 50.0,
}
