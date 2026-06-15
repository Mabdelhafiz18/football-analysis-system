"""
utils_geometry.py — Geometry helpers for football xG analytics.

All pitch coordinates are in METERS unless noted.
Conventions:
  • Attacking direction "+x": the goal being attacked is at x = PITCH_X (max x).
  • Goal center y = PITCH_Y / 2.
  • StatsBomb raw pitch is 120 x 80 (units); Vision pitch is 120 x 70 (meters).
"""

from __future__ import annotations
import math
from typing import Iterable, Sequence

# ── Pitch / goal constants ──────────────────────────────────────────────────
GOAL_WIDTH_M = 7.32
PITCH_X_M = 120.0          # length (both StatsBomb and Vision share 120 on x)
VISION_PITCH_Y_M = 70.0    # Vision width (meters)
STATSBOMB_PITCH_Y = 80.0   # StatsBomb width (units)


def statsbomb_to_vision(x: float, y: float) -> tuple[float, float]:
    """Convert StatsBomb 120x80 coordinates to Vision 120x70 meters.

    x is shared (0..120); y is rescaled 80 -> 70.
    """
    vx = float(x)
    vy = float(y) * VISION_PITCH_Y_M / STATSBOMB_PITCH_Y
    return vx, vy


def goal_center(attacking_direction: str = "+x",
                pitch_x: float = PITCH_X_M,
                pitch_y: float = VISION_PITCH_Y_M) -> tuple[float, float]:
    """Center of the goal being attacked."""
    gx = pitch_x if attacking_direction == "+x" else 0.0
    return gx, pitch_y / 2.0


def goal_posts(attacking_direction: str = "+x",
               pitch_x: float = PITCH_X_M,
               pitch_y: float = VISION_PITCH_Y_M) -> tuple[tuple[float, float], tuple[float, float]]:
    """Return the two goalpost coordinates (left_post, right_post)."""
    gx = pitch_x if attacking_direction == "+x" else 0.0
    cy = pitch_y / 2.0
    return (gx, cy - GOAL_WIDTH_M / 2.0), (gx, cy + GOAL_WIDTH_M / 2.0)


def euclidean(a: Sequence[float], b: Sequence[float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def distance_to_goal(x: float, y: float,
                     attacking_direction: str = "+x",
                     pitch_x: float = PITCH_X_M,
                     pitch_y: float = VISION_PITCH_Y_M) -> float:
    gx, gy = goal_center(attacking_direction, pitch_x, pitch_y)
    return math.hypot(x - gx, y - gy)


def angle_to_goal(x: float, y: float,
                  attacking_direction: str = "+x",
                  pitch_x: float = PITCH_X_M,
                  pitch_y: float = VISION_PITCH_Y_M) -> float:
    """Shooting angle (degrees) subtended by the goal mouth from (x, y).

    Larger angle = wider, easier view of goal. Uses the law-of-cosines on the
    triangle formed by the shot point and the two posts. Returns 0..180.
    """
    p_left, p_right = goal_posts(attacking_direction, pitch_x, pitch_y)
    a = math.hypot(x - p_left[0], y - p_left[1])
    b = math.hypot(x - p_right[0], y - p_right[1])
    c = GOAL_WIDTH_M
    if a < 1e-6 or b < 1e-6:
        return 0.0
    cos_c = (a * a + b * b - c * c) / (2 * a * b)
    cos_c = max(-1.0, min(1.0, cos_c))
    return math.degrees(math.acos(cos_c))


def _sign(p1, p2, p3) -> float:
    return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])


def point_in_triangle(pt: Sequence[float],
                      v1: Sequence[float],
                      v2: Sequence[float],
                      v3: Sequence[float]) -> bool:
    """True if pt is inside triangle (v1, v2, v3)."""
    d1 = _sign(pt, v1, v2)
    d2 = _sign(pt, v2, v3)
    d3 = _sign(pt, v3, v1)
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (has_neg and has_pos)


def in_shot_cone(pt: Sequence[float], shot_xy: Sequence[float],
                 attacking_direction: str = "+x",
                 pitch_x: float = PITCH_X_M,
                 pitch_y: float = VISION_PITCH_Y_M) -> bool:
    """True if pt lies inside the triangle (shot point, left post, right post)."""
    p_left, p_right = goal_posts(attacking_direction, pitch_x, pitch_y)
    return point_in_triangle(pt, shot_xy, p_left, p_right)


def nearest_player_distance(shot_xy: Sequence[float],
                            players: Iterable[Sequence[float]]) -> float:
    """Min distance from shot to any player position. inf if none."""
    best = float("inf")
    for p in players:
        d = euclidean(shot_xy, p)
        if d < best:
            best = d
    return best


def count_players_within(shot_xy: Sequence[float],
                         players: Iterable[Sequence[float]],
                         radius_m: float) -> int:
    return sum(1 for p in players if euclidean(shot_xy, p) <= radius_m)


def goal_visible_ratio(shot_xy: Sequence[float],
                       blockers: Sequence[Sequence[float]],
                       attacking_direction: str = "+x",
                       pitch_x: float = PITCH_X_M,
                       pitch_y: float = VISION_PITCH_Y_M,
                       n_samples: int = 24,
                       block_half_width_m: float = 0.6) -> float:
    """Approximate fraction of the goal mouth visible from the shot point.

    Samples points across the goal line; a sample is 'blocked' if any blocker
    lies near the segment between the shot point and that sample. This is a
    geometric approximation (not true occlusion), suitable as a diagnostic.
    Returns 0..1.
    """
    p_left, p_right = goal_posts(attacking_direction, pitch_x, pitch_y)
    if n_samples < 2:
        n_samples = 2
    visible = 0
    for i in range(n_samples):
        t = i / (n_samples - 1)
        gx = p_left[0] + t * (p_right[0] - p_left[0])
        gy = p_left[1] + t * (p_right[1] - p_left[1])
        if not _segment_blocked(shot_xy, (gx, gy), blockers, block_half_width_m):
            visible += 1
    return visible / n_samples


def _segment_blocked(a: Sequence[float], b: Sequence[float],
                     blockers: Sequence[Sequence[float]],
                     half_width_m: float) -> bool:
    """True if any blocker is within half_width_m of segment a->b (excluding endpoints region)."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq < 1e-9:
        return False
    for blocker in blockers:
        px, py = blocker[0], blocker[1]
        t = ((px - ax) * dx + (py - ay) * dy) / seg_len_sq
        if t <= 0.05 or t >= 0.98:   # ignore blockers at/behind shooter or in goal
            continue
        cx, cy = ax + t * dx, ay + t * dy
        if math.hypot(px - cx, py - cy) <= half_width_m:
            return True
    return False


def infer_attacking_direction_from_shot(shot_x: float,
                                        pitch_x: float = PITCH_X_M) -> str:
    """If a shot is in the second half of the pitch, attack is +x, else -x.

    Used as a last-resort fallback when team direction is unknown.
    """
    return "+x" if shot_x >= pitch_x / 2.0 else "-x"
