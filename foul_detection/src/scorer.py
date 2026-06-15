# src/scorer.py
from typing import Dict


def score_candidate(candidate: Dict) -> Dict:
    score = 0.30

    distance = candidate.get("distance_m", 999.0)
    if distance <= 0.7:
        score += 0.35
    elif distance <= 1.0:
        score += 0.25
    elif distance <= 1.5:
        score += 0.15

    if candidate.get("sudden_motion_change"):
        score += 0.25

    dir_change = candidate.get("victim_direction_change_deg")
    if dir_change is not None:
        if dir_change >= 60:
            score += 0.15
        elif dir_change >= 25:
            score += 0.08

    victim_acc = candidate.get("victim_acceleration")
    if victim_acc is not None and victim_acc < -1.5:
        score += 0.10

    confidence = min(round(score, 3), 0.95)

    return {
        "job_id": candidate["job_id"],
        "frame_id": candidate["frame_id"],
        "timestamp_sec": candidate["timestamp_sec"],
        "event_type": "foul",
        "interaction_type": candidate["event_type"],
        "offender_id": candidate["offender_id"],
        "victim_id": candidate["victim_id"],
        "team_id": candidate["team_id"],
        "confidence": confidence,
    }