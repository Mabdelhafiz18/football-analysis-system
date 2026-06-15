from config import CLASS_IDS, CONFIDENCE_THRESHOLD


class VisionFrameParser:
    """Convert Vision Core objects schema into the engine internal schema."""

    def parse(self, raw_frame):
        objects = raw_frame.get("objects", []) or []
        players = []
        ball_candidates = []
        ignored = []

        for obj in objects:
            class_id = obj.get("class_id")
            pitch_xy = obj.get("pitch_xy_m")
            confidence = float(obj.get("confidence", 0) or 0)
            is_on_pitch = obj.get("is_on_pitch", True)

            if not pitch_xy or len(pitch_xy) != 2:
                ignored.append({"id": obj.get("id"), "reason": "missing_pitch_xy_m"})
                continue

            if confidence < CONFIDENCE_THRESHOLD:
                ignored.append({"id": obj.get("id"), "reason": "low_confidence"})
                continue

            if class_id == CLASS_IDS["ball"]:
                ball_candidates.append(obj)
                continue

            if (
                class_id in CLASS_IDS["valid_players"]
                and obj.get("team_id") in [0, 1]
                and is_on_pitch is True
            ):
                players.append({
                    "id": obj.get("id"),
                    "team_id": int(obj.get("team_id")),
                    "x": float(pitch_xy[0]),
                    "y": float(pitch_xy[1]),
                    "confidence": confidence,
                    "class_id": class_id,
                })
            else:
                ignored.append({"id": obj.get("id"), "reason": "ignored_class_or_off_pitch"})

        ball = None
        if ball_candidates:
            selected = max(ball_candidates, key=lambda o: float(o.get("confidence", 0) or 0))
            pitch_xy = selected.get("pitch_xy_m")
            ball = {
                "id": selected.get("id"),
                "x": float(pitch_xy[0]),
                "y": float(pitch_xy[1]),
                "confidence": float(selected.get("confidence", 0) or 0),
                "visible": True,
            }

        return {
            "job_id": raw_frame.get("job_id"),
            "frame_id": raw_frame.get("frame_id"),
            "timestamp_sec": float(raw_frame.get("timestamp_sec", raw_frame.get("timestamp", 0)) or 0),
            "players": players,
            "ball": ball,
            "ignored_objects": ignored,
            "raw_object_count": len(objects),
        }
