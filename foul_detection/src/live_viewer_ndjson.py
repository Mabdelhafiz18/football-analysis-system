import json
from pathlib import Path
from collections import defaultdict

import cv2
import redis

from src.config import (
    VIDEO_PATH,
    NDJSON_PATH,
    REDIS_HOST,
    REDIS_PORT,
    OUTPUT_STREAM,
    EVENT_DISPLAY_SECONDS,
)


WINDOW_NAME = "Vision + Foul Viewer"


CLASS_NAMES = {
    0: "ball",
    1: "goalkeeper",
    2: "player",
    3: "referee",
}

# BGR
CLASS_COLORS = {
    0: (0, 255, 255),    # yellow
    1: (0, 128, 255),    # orange
    2: (0, 255, 0),      # green
    3: (255, 0, 255),    # magenta
}

OFFENDER_COLOR = (0, 0, 255)   # red
VICTIM_COLOR = (255, 0, 0)     # blue
EVENT_BANNER_COLOR = (0, 0, 180)


def load_ndjson(path: Path):
    frames = {}
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            packet = json.loads(line)
            frame_id = packet.get("frame_id")
            if frame_id is not None:
                frames[int(frame_id)] = packet
    return frames


def load_foul_events_from_redis(host: str, port: int, stream_key: str):
    r = redis.Redis(host=host, port=port, decode_responses=True)
    events = []

    for _, fields in r.xrange(stream_key, min="-", max="+"):
        raw = fields.get("data")
        if not raw:
            continue
        try:
            event = json.loads(raw)
            events.append(event)
        except json.JSONDecodeError:
            continue

    return events


def build_active_events_by_frame(events, fps, display_seconds):
    """
    كل event يفضل ظاهر لمدة display_seconds.
    """
    active_by_frame = defaultdict(list)
    display_frames = int(fps * display_seconds)

    for event in events:
        start_frame = int(event.get("frame_id", -1))
        if start_frame < 0:
            continue

        for f in range(start_frame, start_frame + display_frames):
            active_by_frame[f].append(event)

    return dict(active_by_frame)


def draw_label(frame, text, x, y, color, text_color=(0, 0, 0)):
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.5
    thickness = 1

    (w, h), _ = cv2.getTextSize(text, font, scale, thickness)
    y = max(y, h + 4)

    cv2.rectangle(frame, (x, y - h - 6), (x + w + 4, y), color, -1)
    cv2.putText(frame, text, (x + 2, y - 4), font, scale, text_color, thickness, cv2.LINE_AA)


def draw_header(frame, packet):
    frame_id = packet.get("frame_id", -1)
    timestamp_sec = packet.get("timestamp_sec", 0.0)
    objects_count = len(packet.get("objects", []))

    text = f"frame={frame_id} | ts={timestamp_sec:.3f}s | objects={objects_count}"
    cv2.putText(
        frame,
        text,
        (20, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )


def draw_object(frame, obj, override_color=None, extra_tag=None):
    class_id = obj.get("class_id")
    obj_id = obj.get("id")
    team_id = obj.get("team_id")
    confidence = obj.get("confidence")
    bbox = obj.get("bbox_xyxy")
    pitch_xy = obj.get("pitch_xy_m")
    is_on_pitch = obj.get("is_on_pitch", True)

    if bbox is None or len(bbox) != 4:
        return

    x1, y1, x2, y2 = map(int, bbox)
    color = override_color if override_color is not None else CLASS_COLORS.get(class_id, (200, 200, 200))
    class_name = CLASS_NAMES.get(class_id, f"class_{class_id}")

    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    label = f"{class_name}"
    if obj_id is not None:
        label += f" | id={obj_id}"
    if team_id is not None:
        label += f" | team={team_id}"
    if confidence is not None:
        label += f" | conf={confidence:.2f}"
    if extra_tag:
        label += f" | {extra_tag}"

    draw_label(frame, label, x1, y1 - 4, color, text_color=(255, 255, 255))

    if pitch_xy is not None and len(pitch_xy) == 2:
        px, py = pitch_xy
        extra = f"pitch=({px:.1f}, {py:.1f})"
        if not is_on_pitch:
            extra += " | off-pitch"

        cv2.putText(
            frame,
            extra,
            (x1, y2 + 16),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            color,
            1,
            cv2.LINE_AA,
        )


def draw_event_banner(frame, events):
    if not events:
        return

    x1, y1, x2, y2 = 20, 50, 1180, 140
    cv2.rectangle(frame, (x1, y1), (x2, y2), EVENT_BANNER_COLOR, -1)

    title = "FOUL DETECTED"
    cv2.putText(
        frame,
        title,
        (35, 82),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    y = 112
    for event in events[:2]:
        text = (
            f"type={event.get('interaction_type', 'unknown')} | "
            f"offender={event.get('offender_id')} | "
            f"victim={event.get('victim_id')} | "
            f"confidence={event.get('confidence', 0):.2f}"
        )
        cv2.putText(
            frame,
            text,
            (35, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        y += 26


def index_objects_by_id(packet):
    obj_map = {}
    for obj in packet.get("objects", []):
        oid = obj.get("id")
        if oid is not None:
            obj_map[int(oid)] = obj
    return obj_map


def main():
    video_path = Path(VIDEO_PATH)
    ndjson_path = Path(NDJSON_PATH)

    if not video_path.exists():
        print(f"[ERROR] Video not found: {video_path}")
        return

    if not ndjson_path.exists():
        print(f"[ERROR] NDJSON not found: {ndjson_path}")
        return

    print("[INFO] Loading NDJSON...")
    packets_by_frame = load_ndjson(ndjson_path)
    print(f"[INFO] Loaded {len(packets_by_frame)} frame packets")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("[ERROR] Could not open video.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    delay = int(1000 / fps) if fps and fps > 0 else 30

    print("[INFO] Loading foul events from Redis...")
    foul_events = load_foul_events_from_redis(REDIS_HOST, REDIS_PORT, OUTPUT_STREAM)
    print(f"[INFO] Loaded {len(foul_events)} foul events from Redis")

    active_events_by_frame = build_active_events_by_frame(
        foul_events,
        fps=fps if fps and fps > 0 else 25.0,
        display_seconds=EVENT_DISPLAY_SECONDS,
    )

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    frame_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[INFO] End of video.")
            break

        frame_index += 1
        packet = packets_by_frame.get(frame_index)

        if packet is not None:
            draw_header(frame, packet)

            for obj in packet.get("objects", []):
                draw_object(frame, obj)

            frame_events = active_events_by_frame.get(frame_index, [])
            if frame_events:
                draw_event_banner(frame, frame_events)
                obj_map = index_objects_by_id(packet)

                for event in frame_events:
                    offender_id = event.get("offender_id")
                    victim_id = event.get("victim_id")

                    if offender_id in obj_map:
                        draw_object(frame, obj_map[offender_id], override_color=OFFENDER_COLOR, extra_tag="OFFENDER")

                    if victim_id in obj_map:
                        draw_object(frame, obj_map[victim_id], override_color=VICTIM_COLOR, extra_tag="VICTIM")
        else:
            cv2.putText(
                frame,
                f"frame={frame_index} | no packet",
                (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
                cv2.LINE_AA,
            )

        cv2.imshow(WINDOW_NAME, frame)

        key = cv2.waitKey(delay) & 0xFF
        if key == 27:  # ESC
            break
        elif key == ord(" "):  # pause / resume
            while True:
                pause_key = cv2.waitKey(0) & 0xFF
                if pause_key == ord(" "):
                    break
                if pause_key == 27:
                    cap.release()
                    cv2.destroyAllWindows()
                    return

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()