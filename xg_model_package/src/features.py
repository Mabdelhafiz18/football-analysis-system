"""
features.py — Central feature engineering for the xG model.

Two clearly separated groups (per system spec):
  • TRAINED_MODEL_FEATURES   — computed from data available BOTH in StatsBomb
                                training data and at Vision inference time.
  • VISION_DIAGNOSTIC_FEATURES — computed only from Vision tracking; explain the
                                scene but are NOT fed to the trained model unless
                                the model was trained with matching features.

Keeping this in one module guarantees train/inference parity.
"""

from __future__ import annotations
from typing import Optional
import utils_geometry as geo

# ── Feature name registries (single source of truth) ────────────────────────
TRAINED_NUMERIC = [
    "distance_to_goal",
    "angle_to_goal",
    "shot_x",
    "shot_y",
]
TRAINED_CATEGORICAL = [
    "body_part",       # head / left_foot / right_foot / other
    "shot_type",       # open_play / free_kick / penalty / corner / kick_off
    "play_pattern",    # open_play / from_free_kick / from_corner / ...
]
TRAINED_FLAGS = [
    "is_penalty",
    "is_free_kick",
    "is_header",
    "is_foot",
    "is_first_time",
    "under_pressure",
    "is_one_on_one",
    "is_open_goal",
    "is_set_piece",
]
TRAINED_MODEL_FEATURES = TRAINED_NUMERIC + TRAINED_CATEGORICAL + TRAINED_FLAGS

VISION_DIAGNOSTIC_FEATURES = [
    "goalkeeper_distance",
    "goalkeeper_lateral_offset",
    "nearest_defender_distance",
    "num_defenders_2m",
    "num_defenders_5m",
    "num_defenders_10m",
    "defenders_in_cone",
    "nearest_defender_in_cone",
    "goal_visible_ratio",
    "attackers_box",
    "defenders_box",
    "local_density",
    "ball_speed_before_shot",
]


# ── Trained features from a StatsBomb shot event ────────────────────────────
def _norm_body_part(name: str) -> str:
    n = (name or "").lower()
    if "head" in n:
        return "head"
    if "left" in n:
        return "left_foot"
    if "right" in n:
        return "right_foot"
    return "other"


def _norm_shot_type(name: str) -> str:
    n = (name or "").lower()
    if "penalty" in n:
        return "penalty"
    if "free" in n:
        return "free_kick"
    if "corner" in n:
        return "corner"
    if "kick off" in n:
        return "kick_off"
    return "open_play"


def _norm_play_pattern(name: str) -> str:
    n = (name or "").lower().replace(" ", "_")
    return n or "open_play"


def trained_features_from_statsbomb(ev: dict) -> Optional[dict]:
    """Build the trained feature row from one StatsBomb shot event.

    Returns None if the shot has no usable location.
    """
    shot = ev.get("shot", {}) or {}
    loc = ev.get("location")
    if not loc or len(loc) < 2:
        return None

    sb_x, sb_y = float(loc[0]), float(loc[1])
    vx, vy = geo.statsbomb_to_vision(sb_x, sb_y)   # 120x80 -> 120x70

    body = _norm_body_part((shot.get("body_part") or {}).get("name", ""))
    stype = _norm_shot_type((shot.get("type") or {}).get("name", ""))
    pattern = _norm_play_pattern((ev.get("play_pattern") or {}).get("name", ""))

    return {
        "distance_to_goal": geo.distance_to_goal(vx, vy, "+x"),
        "angle_to_goal": geo.angle_to_goal(vx, vy, "+x"),
        "shot_x": vx,
        "shot_y": vy,
        "body_part": body,
        "shot_type": stype,
        "play_pattern": pattern,
        "is_penalty": int(stype == "penalty"),
        "is_free_kick": int(stype == "free_kick"),
        "is_header": int(body == "head"),
        "is_foot": int(body in ("left_foot", "right_foot")),
        "is_first_time": int(bool(shot.get("first_time", False))),
        "under_pressure": int(bool(ev.get("under_pressure", False))),
        "is_one_on_one": int(bool(shot.get("one_on_one", False))),
        "is_open_goal": int(bool(shot.get("open_goal", False))),
        "is_set_piece": int(stype in ("free_kick", "corner", "penalty")
                            or pattern in ("from_free_kick", "from_corner")),
    }


def label_from_statsbomb(ev: dict) -> int:
    """is_goal = 1 if the shot outcome is Goal."""
    outcome = ((ev.get("shot", {}) or {}).get("outcome") or {}).get("name", "")
    return int(outcome == "Goal")


# ── Trained features from a Vision shot candidate ───────────────────────────
def trained_features_from_vision(shot_xy, attacking_direction, *,
                                 body_part="unknown", shot_type="open_play",
                                 play_pattern="open_play", first_time=0,
                                 under_pressure=0, one_on_one=0, open_goal=0,
                                 set_piece=0,
                                 pitch_x=geo.PITCH_X_M,
                                 pitch_y=geo.VISION_PITCH_Y_M) -> dict:
    """Mirror of the StatsBomb trained features, from Vision geometry.

    body_part/shot_type are usually 'unknown'/'open_play' from Vision (we can't
    see the body part). The model handles 'unknown' via its categorical encoder.
    one_on_one/open_goal/set_piece default to 0 (Vision can't reliably infer them).
    """
    vx, vy = float(shot_xy[0]), float(shot_xy[1])
    return {
        "distance_to_goal": geo.distance_to_goal(vx, vy, attacking_direction, pitch_x, pitch_y),
        "angle_to_goal": geo.angle_to_goal(vx, vy, attacking_direction, pitch_x, pitch_y),
        "shot_x": vx,
        "shot_y": vy,
        "body_part": body_part,
        "shot_type": shot_type,
        "play_pattern": play_pattern,
        "is_penalty": int(shot_type == "penalty"),
        "is_free_kick": int(shot_type == "free_kick"),
        "is_header": int(body_part == "head"),
        "is_foot": int(body_part in ("left_foot", "right_foot")),
        "is_first_time": int(bool(first_time)),
        "under_pressure": int(bool(under_pressure)),
        "is_one_on_one": int(bool(one_on_one)),
        "is_open_goal": int(bool(open_goal)),
        "is_set_piece": int(bool(set_piece) or shot_type in ("penalty", "free_kick", "corner")),
    }


# ── Vision diagnostic features (inference only) ─────────────────────────────
def vision_diagnostic_features(shot_xy, attacking_direction, *,
                               goalkeeper_xy=None,
                               defenders=None, attackers=None,
                               ball_speed_before_shot=None,
                               pitch_x=geo.PITCH_X_M,
                               pitch_y=geo.VISION_PITCH_Y_M) -> dict:
    """Scene-pressure features from Vision tracking at the freeze frame.

    defenders / attackers: lists of (x, y) in meters. goalkeeper_xy: (x, y) or None.
    """
    defenders = defenders or []
    attackers = attackers or []
    gx, gy = geo.goal_center(attacking_direction, pitch_x, pitch_y)

    # goalkeeper relative geometry
    gk_dist = geo.euclidean(shot_xy, goalkeeper_xy) if goalkeeper_xy else None
    gk_lateral = abs(goalkeeper_xy[1] - gy) if goalkeeper_xy else None

    # defenders in the shot cone
    in_cone = [d for d in defenders if geo.in_shot_cone(d, shot_xy, attacking_direction, pitch_x, pitch_y)]
    nearest_cone = geo.nearest_player_distance(shot_xy, in_cone) if in_cone else None

    # box occupancy (18-yard box ≈ 16.5m deep, 40.3m wide)
    box_x_min = (pitch_x - 16.5) if attacking_direction == "+x" else 0.0
    box_x_max = pitch_x if attacking_direction == "+x" else 16.5
    box_y_min, box_y_max = gy - 20.16, gy + 20.16

    def in_box(p):
        return box_x_min <= p[0] <= box_x_max and box_y_min <= p[1] <= box_y_max

    blockers = list(defenders)
    if goalkeeper_xy:
        blockers.append(goalkeeper_xy)

    return {
        "goalkeeper_distance": round(gk_dist, 3) if gk_dist is not None else None,
        "goalkeeper_lateral_offset": round(gk_lateral, 3) if gk_lateral is not None else None,
        "nearest_defender_distance": (round(geo.nearest_player_distance(shot_xy, defenders), 3)
                                      if defenders else None),
        "num_defenders_2m": geo.count_players_within(shot_xy, defenders, 2.0),
        "num_defenders_5m": geo.count_players_within(shot_xy, defenders, 5.0),
        "num_defenders_10m": geo.count_players_within(shot_xy, defenders, 10.0),
        "defenders_in_cone": len(in_cone),
        "nearest_defender_in_cone": round(nearest_cone, 3) if nearest_cone is not None else None,
        "goal_visible_ratio": round(
            geo.goal_visible_ratio(shot_xy, blockers, attacking_direction, pitch_x, pitch_y), 3),
        "attackers_box": sum(1 for a in attackers if in_box(a)),
        "defenders_box": sum(1 for d in defenders if in_box(d)),
        "local_density": geo.count_players_within(shot_xy, list(defenders) + list(attackers), 5.0),
        "ball_speed_before_shot": (round(ball_speed_before_shot, 3)
                                   if ball_speed_before_shot is not None else None),
    }
