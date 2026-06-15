# src/features.py
import math
from typing import Dict, List, Optional, Tuple

from src.frame_parser import get_xy


def euclidean_distance_xy(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def distance_between_objects(obj1: Dict, obj2: Dict) -> float:
    return euclidean_distance_xy(get_xy(obj1), get_xy(obj2))


def velocity_from_history(history: List[Dict]) -> Optional[float]:
    if len(history) < 2:
        return None

    prev = history[-2]
    curr = history[-1]

    x1, y1 = get_xy(prev["object"])
    x2, y2 = get_xy(curr["object"])

    dt = curr["timestamp_sec"] - prev["timestamp_sec"]
    if dt <= 0:
        return None

    dist = euclidean_distance_xy((x1, y1), (x2, y2))
    return dist / dt


def acceleration_from_history(history: List[Dict]) -> Optional[float]:
    if len(history) < 3:
        return None

    h1 = history[-3:]
    v1 = velocity_from_history(h1[:2])
    v2 = velocity_from_history(h1[1:])

    if v1 is None or v2 is None:
        return None

    dt = h1[-1]["timestamp_sec"] - h1[-2]["timestamp_sec"]
    if dt <= 0:
        return None

    return (v2 - v1) / dt


def direction_vector(history: List[Dict]) -> Optional[Tuple[float, float]]:
    if len(history) < 2:
        return None

    prev = history[-2]
    curr = history[-1]

    x1, y1 = get_xy(prev["object"])
    x2, y2 = get_xy(curr["object"])
    return (x2 - x1, y2 - y1)


def angle_between_vectors_deg(v1: Tuple[float, float], v2: Tuple[float, float]) -> Optional[float]:
    mag1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2)
    mag2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2)

    if mag1 == 0 or mag2 == 0:
        return None

    dot = v1[0] * v2[0] + v1[1] * v2[1]
    cos_theta = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    return math.degrees(math.acos(cos_theta))


def direction_change_deg(history: List[Dict]) -> Optional[float]:
    if len(history) < 3:
        return None

    p1 = history[-3]["object"]
    p2 = history[-2]["object"]
    p3 = history[-1]["object"]

    x1, y1 = get_xy(p1)
    x2, y2 = get_xy(p2)
    x3, y3 = get_xy(p3)

    v1 = (x2 - x1, y2 - y1)
    v2 = (x3 - x2, y3 - y2)

    return angle_between_vectors_deg(v1, v2)


def relative_speed(history1: List[Dict], history2: List[Dict]) -> Optional[float]:
    v1 = velocity_from_history(history1)
    v2 = velocity_from_history(history2)

    if v1 is None or v2 is None:
        return None

    return abs(v1 - v2)