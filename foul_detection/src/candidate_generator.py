# src/candidate_generator.py
from typing import Dict, List

from src.config import CONTACT_THRESHOLD
from src.features import (
    distance_between_objects,
    velocity_from_history,
    acceleration_from_history,
    direction_change_deg,
)


def _build_histories(buffer, current_frame: Dict) -> Dict[int, List[Dict]]:
    histories = {}
    for player in current_frame["players"] + current_frame["goalkeepers"]:
        pid = player["id"]
        histories[pid] = buffer.get_track_history(pid)
    return histories


def _pick_victim_offender(p1: Dict, p2: Dict, histories: Dict[int, List[Dict]]):
    h1 = histories.get(p1["id"], [])
    h2 = histories.get(p2["id"], [])

    dc1 = direction_change_deg(h1) or 0.0
    dc2 = direction_change_deg(h2) or 0.0

    # اللي حركته اتغيرت أكتر نعتبره victim
    if dc1 >= dc2:
        return p1, p2
    return p2, p1


def generate_candidates(buffer) -> List[Dict]:
    frame = buffer.get_latest_frame()
    if frame is None:
        return []

    players = frame["players"]
    goalkeepers = frame["goalkeepers"]
    all_playable = players + goalkeepers

    if len(all_playable) < 2:
        return []

    histories = _build_histories(buffer, frame)
    candidates = []

    for i in range(len(all_playable)):
        for j in range(i + 1, len(all_playable)):
            p1 = all_playable[i]
            p2 = all_playable[j]

            # DEMO MODE:
            # تجاهل team filter مؤقتًا عشان الداتا عندك كلها team 0 تقريبًا
            dist = distance_between_objects(p1, p2)
            if dist > CONTACT_THRESHOLD:
                continue

            victim, offender = _pick_victim_offender(p1, p2, histories)

            victim_history = histories.get(victim["id"], [])
            offender_history = histories.get(offender["id"], [])

            victim_speed = velocity_from_history(victim_history)
            victim_acc = acceleration_from_history(victim_history)
            victim_dir_change = direction_change_deg(victim_history)

            sudden_motion_change = False
            if victim_speed is not None and victim_speed <= 2.5:
                sudden_motion_change = True

            if victim_acc is not None and victim_acc < -1.5:
                sudden_motion_change = True

            if victim_dir_change is not None and victim_dir_change >= 25:
                sudden_motion_change = True

            # لو قريبين جدًا أو فيه تغير حركة واضح -> foul candidate
            interaction_type = "foul_candidate" if (dist <= 1.2 or sudden_motion_change) else "normal_duel"

            candidate = {
                "job_id": frame["job_id"],
                "frame_id": frame["frame_id"],
                "timestamp_sec": frame["timestamp_sec"],
                "event_type": interaction_type,
                "offender_id": offender["id"],
                "victim_id": victim["id"],
                "team_id": offender.get("team_id"),
                "distance_m": dist,
                "near_ball_owner": False,
                "sudden_motion_change": sudden_motion_change,
                "possession_switch_player": False,
                "possession_switch_team": False,
                "victim_speed": victim_speed,
                "victim_acceleration": victim_acc,
                "victim_direction_change_deg": victim_dir_change,
            }

            print(
                "[DEBUG RAW CANDIDATE]",
                {
                    "frame_id": frame["frame_id"],
                    "offender_id": offender["id"],
                    "victim_id": victim["id"],
                    "distance_m": round(dist, 3),
                    "victim_speed": victim_speed,
                    "victim_acc": victim_acc,
                    "victim_dir_change": victim_dir_change,
                    "interaction_type": interaction_type,
                }
            )

            candidates.append(candidate)

    return candidates