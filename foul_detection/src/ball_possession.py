# src/ball_possession.py
from typing import Dict, List, Optional, Tuple

from src.config import BALL_POSSESSION_RADIUS
from src.features import distance_between_objects


def infer_ball_owner(ball: Optional[Dict], players: List[Dict], goalkeepers: List[Dict]) -> Optional[Dict]:
    if ball is None:
        return None

    candidates = players + goalkeepers
    if not candidates:
        return None

    nearest = None
    nearest_dist = float("inf")

    for obj in candidates:
        dist = distance_between_objects(ball, obj)
        if dist < nearest_dist:
            nearest_dist = dist
            nearest = obj

    if nearest is not None and nearest_dist <= BALL_POSSESSION_RADIUS:
        return nearest

    return None


def infer_possession_team(owner: Optional[Dict]) -> Optional[int]:
    if owner is None:
        return None
    return owner.get("team_id")


def possession_switch(prev_owner: Optional[Dict], curr_owner: Optional[Dict]) -> bool:
    if prev_owner is None or curr_owner is None:
        return False
    return prev_owner.get("id") != curr_owner.get("id")


def team_possession_switch(prev_owner: Optional[Dict], curr_owner: Optional[Dict]) -> bool:
    prev_team = infer_possession_team(prev_owner)
    curr_team = infer_possession_team(curr_owner)

    if prev_team is None or curr_team is None:
        return False

    return prev_team != curr_team