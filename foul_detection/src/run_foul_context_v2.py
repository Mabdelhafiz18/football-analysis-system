import redis
import json
import math

REDIS_HOST = "localhost"
REDIS_PORT = 6379

JOB_ID = "match_final_001"

VC_STREAM = f"vc:{JOB_ID}"
INPUT_FOUL_STREAM = f"evt:foul:v2:{JOB_ID}"
OUTPUT_STREAM = f"evt:foul:final:{JOB_ID}"

CONTEXT_WINDOW_SEC = 1.0
BALL_DISTANCE_THRESHOLD = 8.0


def safe_json_loads(value):
    try:
        return json.loads(value)
    except Exception:
        return None


def get_xy(obj):
    if "pitch_xy_m" in obj and obj["pitch_xy_m"]:
        xy = obj["pitch_xy_m"]
        return float(xy[0]), float(xy[1])

    if "bbox_xyxy" in obj and obj["bbox_xyxy"]:
        x1, y1, x2, y2 = obj["bbox_xyxy"]
        return (float(x1) + float(x2)) / 2, (float(y1) + float(y2)) / 2

    return None


def distance(a, b):
    if a is None or b is None:
        return None
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def load_stream_json(r, stream_name):
    messages = r.xrange(stream_name)
    items = []

    for msg_id, fields in messages:
        data = fields.get("data")
        if not data:
            continue

        parsed = safe_json_loads(data)
        if parsed is not None:
            items.append(parsed)

    return items


def filter_vc_frames(vc_frames, start_sec, end_sec):
    selected = []

    for frame in vc_frames:
        t = float(frame.get("timestamp_sec", 0.0))
        if start_sec - CONTEXT_WINDOW_SEC <= t <= end_sec + CONTEXT_WINDOW_SEC:
            selected.append(frame)

    return selected


def analyze_context(frames):
    if not frames:
        return {
            "context_status": "unavailable",
            "reason": "no_vision_core_frames_in_window",
            "offender_id": None,
            "victim_id": None,
            "team_id": None,
            "ball_related": None,
            "duel_type": "unknown",
            "motion_conflict": False,
            "turnover": None,
            "context_confidence": 0.0
        }

    frames_with_objects = [f for f in frames if len(f.get("objects", [])) > 0]

    if not frames_with_objects:
        return {
            "context_status": "unavailable",
            "reason": "vision_core_objects_empty",
            "offender_id": None,
            "victim_id": None,
            "team_id": None,
            "ball_related": None,
            "duel_type": "unknown",
            "motion_conflict": False,
            "turnover": None,
            "context_confidence": 0.0
        }

    best_pair = None
    best_pair_dist = None
    ball_related = False
    closest_ball_player = None
    closest_ball_dist = None

    for frame in frames_with_objects:
        objects = frame.get("objects", [])

        players = []
        balls = []

        for obj in objects:
            class_id = obj.get("class_id")

            # حسب Vision Core عندك: 0 ball, 2 player, 1 goalkeeper, 3 referee
            if class_id in [1, 2]:
                players.append(obj)
            elif class_id == 0:
                balls.append(obj)

        # أقرب لاعبين لبعض
        for i in range(len(players)):
            for j in range(i + 1, len(players)):
                p1_xy = get_xy(players[i])
                p2_xy = get_xy(players[j])
                d = distance(p1_xy, p2_xy)

                if d is None:
                    continue

                if best_pair_dist is None or d < best_pair_dist:
                    best_pair_dist = d
                    best_pair = (players[i], players[j])

        # أقرب لاعب للكرة
        if balls:
            ball_xy = get_xy(balls[0])

            for p in players:
                p_xy = get_xy(p)
                d = distance(p_xy, ball_xy)

                if d is None:
                    continue

                if closest_ball_dist is None or d < closest_ball_dist:
                    closest_ball_dist = d
                    closest_ball_player = p

    if closest_ball_dist is not None and closest_ball_dist <= BALL_DISTANCE_THRESHOLD:
        ball_related = True

    offender_id = None
    victim_id = None
    team_id = None

    if best_pair is not None:
        offender_id = best_pair[0].get("id")
        victim_id = best_pair[1].get("id")
        team_id = best_pair[0].get("team_id")

    if ball_related and best_pair_dist is not None:
        duel_type = "foul_candidate"
        motion_conflict = True
        context_confidence = 0.75
    elif best_pair_dist is not None:
        duel_type = "normal_duel"
        motion_conflict = False
        context_confidence = 0.45
    else:
        duel_type = "unknown"
        motion_conflict = False
        context_confidence = 0.20

    return {
        "context_status": "available",
        "reason": "vision_core_objects_found",
        "offender_id": offender_id,
        "victim_id": victim_id,
        "team_id": team_id,
        "ball_related": ball_related,
        "duel_type": duel_type,
        "motion_conflict": motion_conflict,
        "turnover": None,
        "context_confidence": context_confidence
    }


def combine_confidence(model_conf, context_conf):
    if context_conf <= 0:
        return model_conf

    return min(0.99, (model_conf * 0.75) + (context_conf * 0.25))


def update_severity(confidence, motion_conflict, ball_related):
    if confidence >= 0.85 and motion_conflict:
        return "serious foul candidate"
    elif confidence >= 0.70:
        return "medium"
    else:
        return "light"


def main():
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    foul_events = load_stream_json(r, INPUT_FOUL_STREAM)
    vc_frames = load_stream_json(r, VC_STREAM)

    print(f"Reading V2 foul stream: {INPUT_FOUL_STREAM}")
    print(f"Reading Vision Core stream: {VC_STREAM}")
    print(f"Writing final stream: {OUTPUT_STREAM}")
    print(f"Foul events: {len(foul_events)}")
    print(f"Vision frames: {len(vc_frames)}")

    if not foul_events:
        print("No V2 foul events found.")
        return

    for idx, event in enumerate(foul_events, start=1):
        start_sec = float(event.get("start_sec", 0.0))
        end_sec = float(event.get("end_sec", start_sec))
        model_conf = float(event.get("confidence", 0.0))

        frames = filter_vc_frames(vc_frames, start_sec, end_sec)
        context = analyze_context(frames)

        final_conf = combine_confidence(
            model_conf=model_conf,
            context_conf=context["context_confidence"]
        )

        severity = update_severity(
            confidence=final_conf,
            motion_conflict=context["motion_conflict"],
            ball_related=context["ball_related"]
        )

        final_event = {
            "job_id": JOB_ID,
            "event_id": f"foul_final_{idx:03d}",
            "event_type": "foul",
            "start_sec": event.get("start_sec"),
            "peak_sec": event.get("peak_sec"),
            "end_sec": event.get("end_sec"),
            "offender_id": context["offender_id"],
            "victim_id": context["victim_id"],
            "team_id": context["team_id"],
            "duel_type": context["duel_type"],
            "severity": severity,
            "ball_related": context["ball_related"],
            "motion_conflict": context["motion_conflict"],
            "turnover": context["turnover"],
            "confidence": round(final_conf, 3),
            "context_status": context["context_status"],
            "context_reason": context["reason"],
            "source": "foul_context_v2"
        }

        r.xadd(OUTPUT_STREAM, {"data": json.dumps(final_event)})
        print("WROTE FINAL EVENT:", final_event)

    print("Done.")


if __name__ == "__main__":
    main()