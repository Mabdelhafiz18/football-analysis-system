from config import COUNTER_ATTACK_PROGRESS_THRESHOLD_M


class TransitionModule:
    def calculate(self, frames, possession_module, progression):
        seq = []
        times = []
        for frame in frames:
            p = possession_module.calculate_frame(frame)
            if p.get("team_id") is not None:
                seq.append(p["team_id"])
                times.append(frame["timestamp_sec"])

        if len(seq) < 2:
            return {"active": False, "type": None, "team_id": None, "is_counter_attack": False, "reliable": False, "reason": "not_enough_possession_sequence"}

        if seq[0] == seq[-1]:
            return {"active": False, "type": None, "team_id": None, "is_counter_attack": False, "sequence": seq, "reliable": True}

        to_team = seq[-1]
        is_counter = progression.get("progressive_distance", 0) >= COUNTER_ATTACK_PROGRESS_THRESHOLD_M and (progression.get("is_final_third_entry") or progression.get("is_box_entry"))
        return {"active": True, "type": "defense_to_attack", "team_id": to_team, "is_counter_attack": bool(is_counter), "start_time": times[0], "sequence": seq, "reliable": True}
