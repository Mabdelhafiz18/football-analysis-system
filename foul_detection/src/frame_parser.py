# src/frame_parser.py
from typing import Dict, List, Optional, Tuple


BALL_CLASS_ID = 0
GOALKEEPER_CLASS_ID = 1
PLAYER_CLASS_ID = 2
REFEREE_CLASS_ID = 3


def is_valid_object(obj: Dict) -> bool:
    return "pitch_xy_m" in obj and obj["pitch_xy_m"] is not None


def get_xy(obj: Dict) -> Tuple[float, float]:
    x, y = obj["pitch_xy_m"]
    return float(x), float(y)


def parse_frame(packet: Dict) -> Dict:
    objects = packet.get("objects", [])

    players: List[Dict] = []
    goalkeepers: List[Dict] = []
    referees: List[Dict] = []
    ball: Optional[Dict] = None

    for obj in objects:
        if not is_valid_object(obj):
            continue

        class_id = obj.get("class_id")
        is_on_pitch = obj.get("is_on_pitch", True)

        if class_id == BALL_CLASS_ID:
            ball = obj
        elif class_id == PLAYER_CLASS_ID and is_on_pitch:
            players.append(obj)
        elif class_id == GOALKEEPER_CLASS_ID and is_on_pitch:
            goalkeepers.append(obj)
        elif class_id == REFEREE_CLASS_ID:
            referees.append(obj)

    return {
        "job_id": packet.get("job_id"),
        "frame_id": packet.get("frame_id"),
        "timestamp_sec": float(packet.get("timestamp_sec", 0.0)),
        "players": players,
        "goalkeepers": goalkeepers,
        "referees": referees,
        "ball": ball,
        "raw_packet": packet,
    }