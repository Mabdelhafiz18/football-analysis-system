import argparse
import json
import os
from bisect import bisect_right

try:
    import cv2
except ImportError as exc:
    raise SystemExit("OpenCV is not installed. Run: pip install opencv-python") from exc

from engine import TacticalIntelligenceEngine


def load_insights_from_ndjson(ndjson_path):
    engine = TacticalIntelligenceEngine()
    insights = []
    with open(ndjson_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            insight = engine.process_raw_frame(raw)
            insights.append(insight)
    return insights


def build_lookup(insights):
    ordered = sorted(insights, key=lambda x: int(x.get("frame_id") or 0))
    frame_ids = [int(x.get("frame_id") or 0) for x in ordered]
    return frame_ids, ordered


def nearest_insight(frame_number, frame_ids, ordered):
    if not ordered:
        return None
    idx = bisect_right(frame_ids, frame_number) - 1
    if idx < 0:
        idx = 0
    return ordered[idx]


def draw_panel(frame, insight):
    if insight is None:
        return frame

    h, w = frame.shape[:2]
    panel_w = min(470, max(360, int(w * 0.30)))
    panel_h = min(h - 20, 305)
    overlay = frame.copy()
    cv2.rectangle(overlay, (12, 12), (panel_w, panel_h), (0, 0, 0), -1)
    frame = cv2.addWeighted(overlay, 0.55, frame, 0.45, 0)

    y = 38
    line_h = 23

    def put(text, size=0.48, thickness=1, color=(245, 245, 245)):
        nonlocal y
        if y > panel_h - 12:
            return
        cv2.putText(frame, str(text), (24, y), cv2.FONT_HERSHEY_SIMPLEX, size, color, thickness, cv2.LINE_AA)
        y += line_h

    put("TACTICAL INTELLIGENCE", 0.62, 2)
    put(f"Frame {insight.get('frame_id')} | {insight.get('timestamp_sec')}s", 0.45)

    reliability = insight.get("reliability", {})
    put(f"Reliability: {reliability.get('overall_confidence')}", 0.47)

    possession = insight.get("possession", {})
    team = possession.get("team_id")
    player = possession.get("player_id")
    conf = possession.get("confidence")
    quality = possession.get("quality", "")
    put(f"Possession: T{team} P{player} conf={conf} {quality}", 0.43)

    teams = insight.get("teams", {})
    for team_id in ["0", "1"]:
        team_data = teams.get(team_id, {})
        formation = team_data.get("formation", {})
        shape = formation.get("shape") or "unknown"
        if shape != "unknown":
            shape = f"{shape} ({formation.get('confidence')})"
        put(f"Team {team_id}: {shape} | {team_data.get('block_type')}", 0.43)

    pressure = insight.get("pressure", {})
    put(f"Pressure: {pressure.get('pressure_level')} | under={pressure.get('ball_carrier_under_pressure')}", 0.43)

    progression = insight.get("ball_progression", {})
    put(f"Ball: {progression.get('ball_zone')} | final3rd={progression.get('is_final_third_entry')} | box={progression.get('is_box_entry')}", 0.40)

    transition = insight.get("transition", {})
    put(f"Transition: {transition.get('type')} | counter={transition.get('is_counter_attack')}", 0.40)

    alerts = insight.get("alerts", [])[:4]
    put("Alerts:", 0.48, 2)
    for alert in alerts:
        severity = str(alert.get("severity", "")).upper()
        alert_type = alert.get("type")
        team_id = alert.get("team_id")
        color = (255, 255, 255)
        if severity == "HIGH":
            color = (80, 80, 255)
        elif severity == "MEDIUM":
            color = (80, 220, 255)
        put(f"- [{severity}] {alert_type} T{team_id}", 0.39, 1, color)

    return frame


def write_latest_json(insights, output_json):
    if not insights:
        return
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(insights[-1], f, indent=2)


def run(video_path, vision_ndjson, output_video, output_json, show=False):
    insights = load_insights_from_ndjson(vision_ndjson)
    write_latest_json(insights, output_json)
    frame_ids, ordered = build_lookup(insights)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise SystemExit(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    os.makedirs(os.path.dirname(output_video), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_video, fourcc, fps, (width, height))

    frame_number = 0
    last_insight = None
    printed_alerts = set()

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_number += 1
        insight = nearest_insight(frame_number, frame_ids, ordered)
        if insight is not None:
            last_insight = insight
            for alert in insight.get("alerts", []):
                key = (insight.get("frame_id"), alert.get("type"), alert.get("team_id"))
                if key not in printed_alerts:
                    printed_alerts.add(key)
                    print(f"[{insight.get('timestamp_sec')}s] {alert.get('severity').upper()} {alert.get('type')} | team={alert.get('team_id')} | {alert.get('message')}")

        annotated = draw_panel(frame, last_insight)
        writer.write(annotated)

        if show:
            cv2.imshow("Tactical Intelligence Engine", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    writer.release()
    if show:
        cv2.destroyAllWindows()

    print("=" * 80)
    print("VIDEO TACTICAL DEMO FINISHED")
    print("=" * 80)
    print(f"Input video: {video_path}")
    print(f"Vision NDJSON: {vision_ndjson}")
    print(f"Annotated video saved to: {output_video}")
    print(f"Latest JSON saved to: {output_json}")
    if last_insight:
        print(f"Latest frame: {last_insight.get('frame_id')}")
        print(f"Alerts count: {len(last_insight.get('alerts', []))}")
        print(f"Reliability: {last_insight.get('reliability', {}).get('overall_confidence')}")


def main():
    parser = argparse.ArgumentParser(description="Play a video with Tactical Intelligence insights overlay.")
    parser.add_argument("--video", required=True, help="Path to input match video")
    parser.add_argument("--vision", default="sample_data/vision_sample.ndjson", help="Vision Core NDJSON tracking output")
    parser.add_argument("--output-video", default="outputs/tactical_overlay.mp4", help="Annotated output video path")
    parser.add_argument("--output-json", default="outputs/latest_tactical_output.json", help="Latest tactical JSON output")
    parser.add_argument("--show", action="store_true", help="Open live preview window while processing")
    args = parser.parse_args()

    run(args.video, args.vision, args.output_video, args.output_json, args.show)


if __name__ == "__main__":
    main()
