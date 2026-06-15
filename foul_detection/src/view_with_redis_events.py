import json
from pathlib import Path

import cv2
import redis


# =========================
# CONFIG
# =========================
REDIS_HOST = "localhost"
REDIS_PORT = 6379

JOB_ID = "match_final_001"
FOUL_STREAM = f"evt:foul:final:{JOB_ID}"

VIDEO_PATH = r"C:\Users\Moaz Alnoby\Downloads\football-ai1\football-ai1\football-ai\sports\121364_0.mp4"

ALERT_HOLD_SECONDS = 3.0


# =========================
# VIDEO UTILS
# =========================
def get_video_info(video_path: str):
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()

    if fps <= 0:
        fps = 25.0

    return total_frames, fps


# =========================
# REDIS HELPERS
# =========================
def load_foul_events(r, stream_name):
    messages = r.xrange(stream_name)
    events = []

    for msg_id, fields in messages:
        try:
            data = json.loads(fields["data"])
            events.append(data)
        except Exception:
            continue

    return events


def find_active_event(events, current_sec):
    for event in events:
        start_sec = float(event.get("start_sec", 0.0))
        end_sec = float(event.get("end_sec", 0.0))

        # اعرض التنبيه أثناء الحدث + مدة hold بسيطة بعده
        if start_sec <= current_sec <= end_sec + ALERT_HOLD_SECONDS:
            return event

    return None


# =========================
# DRAW HELPERS
# =========================
def draw_text_block(frame, lines, x, y, bg_color=(0, 0, 0), text_color=(255, 255, 255), scale=0.7):
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 2
    line_height = 28

    widths = []
    for line in lines:
        (w, _), _ = cv2.getTextSize(line, font, scale, thickness)
        widths.append(w)

    box_w = max(widths) + 20
    box_h = line_height * len(lines) + 10

    cv2.rectangle(frame, (x, y), (x + box_w, y + box_h), bg_color, -1)

    for i, line in enumerate(lines):
        cv2.putText(
            frame,
            line,
            (x + 10, y + 25 + i * line_height),
            font,
            scale,
            text_color,
            thickness,
            cv2.LINE_AA,
        )


def draw_alert_banner(frame, event):
    severity = event.get("severity", "foul")
    confidence = float(event.get("confidence", 0.0))
    start_sec = float(event.get("start_sec", 0.0))
    end_sec = float(event.get("end_sec", 0.0))

    lines = [
        "FOUL ALERT",
        f"Severity: {severity}",
        f"Confidence: {confidence:.2f}",
        f"Time: {start_sec:.2f}s -> {end_sec:.2f}s",
    ]

    draw_text_block(
        frame,
        lines,
        x=20,
        y=20,
        bg_color=(0, 0, 180),
        text_color=(255, 255, 255),
        scale=0.9,
    )


def draw_status_panel(frame, current_sec, total_frames, frame_index, fps, events_count):
    lines = [
        f"frame = {frame_index} / {total_frames}",
        f"time = {current_sec:.2f}s",
        f"fps = {fps:.2f}",
        f"foul events in Redis = {events_count}",
    ]

    draw_text_block(
        frame,
        lines,
        x=20,
        y=150,
        bg_color=(30, 30, 30),
        text_color=(255, 255, 255),
        scale=0.7,
    )


# =========================
# MAIN
# =========================
def main():
    video_path = Path(VIDEO_PATH)
    if not video_path.exists():
        print(f"[ERROR] Video not found: {video_path}")
        return

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    events = load_foul_events(r, FOUL_STREAM)
    print(f"[INFO] Loaded {len(events)} foul events from Redis stream: {FOUL_STREAM}")

    total_frames, fps = get_video_info(str(video_path))
    print(f"[INFO] Video: {video_path}")
    print(f"[INFO] Frames: {total_frames}, FPS: {fps:.2f}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("[ERROR] Could not open video")
        return

    delay = max(1, int(1000 / fps))
    window_name = "Viewer with Redis Foul Events"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    frame_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[INFO] End of video")
            break

        current_sec = frame_index / fps

        # اعمل refresh للأحداث كل frame عشان لو stream اتحدث
        events = load_foul_events(r, FOUL_STREAM)
        active_event = find_active_event(events, current_sec)

        # footer info
        cv2.putText(
            frame,
            f"frame={frame_index} | time={current_sec:.2f}s",
            (20, frame.shape[0] - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        draw_status_panel(
            frame=frame,
            current_sec=current_sec,
            total_frames=total_frames,
            frame_index=frame_index,
            fps=fps,
            events_count=len(events),
        )

        if active_event is not None:
            draw_alert_banner(frame, active_event)

        cv2.imshow(window_name, frame)

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

        frame_index += 1

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()