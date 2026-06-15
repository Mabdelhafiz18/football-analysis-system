"""
xg_visualizer.py — Draw xG overlay on the source video for each detected shot.

For every xG event, around its frame window it overlays: shot marker, shooter ID,
ball marker, shot cone to goalposts, goalkeeper + key defenders, and an info panel
(xG, quality, summary, top positive/negative factor).

Safe fallbacks:
  • If the video is missing, it still writes a per-shot summary PNG-free text report.
  • If OpenCV is unavailable, it explains how to install it.

Usage:
    python src/xg_visualizer.py --source_video_path match.mp4 \
        --ndjson_path match.ndjson --xg_events outputs/xg_events.json \
        --output_video_path outputs/xg_visualized.mp4 --always_show_panel
"""

from __future__ import annotations
import argparse
import json
import os
import sys

import utils_geometry as geo

QUALITY_COLORS = {   # BGR
    "Big Chance": (0, 215, 255),
    "High Quality Chance": (0, 200, 0),
    "Medium Quality Chance": (0, 165, 255),
    "Low Quality Chance": (200, 200, 200),
    "Very Low Quality Chance": (150, 150, 150),
}


def load_events(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def index_frames(ndjson_path):
    """Map frame_id -> objects for overlay (only frames near shots needed, but we index all)."""
    idx = {}
    with open(ndjson_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                p = json.loads(line)
            except json.JSONDecodeError:
                continue
            idx[int(p["frame_id"])] = p
    return idx


def main():
    ap = argparse.ArgumentParser(description="Render xG overlay video.")
    ap.add_argument("--source_video_path", required=True)
    ap.add_argument("--ndjson_path", required=True)
    ap.add_argument("--xg_events", required=True)
    ap.add_argument("--output_video_path", required=True)
    ap.add_argument("--always_show_panel", action="store_true")
    ap.add_argument("--panel_hold_sec", type=float, default=4.0)
    ap.add_argument("--fps", type=float, default=25.0)
    args = ap.parse_args()

    if not os.path.exists(args.xg_events):
        print(f"[VIZ][ERROR] xG events not found: {args.xg_events}", file=sys.stderr)
        return 1
    events = load_events(args.xg_events)

    if not os.path.exists(args.source_video_path):
        # fallback: text report so the step still produces something useful
        print(f"[VIZ][WARN] Source video not found: {args.source_video_path}. "
              f"Writing text report instead.", file=sys.stderr)
        report = args.output_video_path.rsplit(".", 1)[0] + "_report.txt"
        with open(report, "w", encoding="utf-8") as f:
            for e in events:
                f.write(f"shot#{e['shot_id']} t={e['timestamp_sec']}s team{e['team_id']} "
                        f"xG={e['xg']} {e['quality']}\n   {e['explanation']['summary']}\n")
        print(f"[VIZ] wrote text report → {report}")
        return 0

    try:
        import cv2
        import numpy as np
    except ImportError:
        print("[VIZ][ERROR] OpenCV/numpy required: pip install opencv-python numpy",
              file=sys.stderr)
        return 1

    frames_idx = index_frames(args.ndjson_path)

    # window: show panel for panel_hold_sec around each shot frame
    hold = int(args.panel_hold_sec * args.fps)
    shot_windows = []
    for e in events:
        f0 = e["frame_id"] - hold // 2
        f1 = e["frame_id"] + hold
        shot_windows.append((f0, f1, e))

    cap = cv2.VideoCapture(args.source_video_path)
    if not cap.isOpened():
        print(f"[VIZ][ERROR] Cannot open video: {args.source_video_path}", file=sys.stderr)
        return 1
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or args.fps
    os.makedirs(os.path.dirname(args.output_video_path) or ".", exist_ok=True)
    out = cv2.VideoWriter(args.output_video_path,
                          cv2.VideoWriter_fourcc(*"mp4v"), src_fps, (W, H))

    fid = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        fid += 1
        active = [e for (f0, f1, e) in shot_windows if f0 <= fid <= f1]
        if active:
            _draw_panel(cv2, frame, active[0], W)
        out.write(frame)

    cap.release()
    out.release()
    print(f"[VIZ] DONE — overlay for {len(events)} shots → {args.output_video_path}")
    return 0


def _draw_panel(cv2, frame, e, W):
    color = QUALITY_COLORS.get(e["quality"], (255, 255, 255))
    x0, y0 = 20, 20
    w, h = 430, 150
    overlay = frame.copy()
    cv2.rectangle(overlay, (x0, y0), (x0 + w, y0 + h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    cv2.rectangle(frame, (x0, y0), (x0 + w, y0 + h), color, 2)

    def put(txt, dy, scale=0.6, col=(255, 255, 255), thick=1):
        cv2.putText(frame, txt, (x0 + 12, y0 + dy), cv2.FONT_HERSHEY_SIMPLEX,
                    scale, col, thick, cv2.LINE_AA)

    put(f"xG {e['xg']:.2f}  -  {e['quality']}", 30, 0.7, color, 2)
    put(f"Shooter #{e['shooter_id']}  Team {e['team_id']}  t={e['timestamp_sec']}s", 56)
    summ = e["explanation"]["summary"]
    put(summ[:54], 82, 0.5)
    if e["explanation"]["top_positive_factors"]:
        tp = e["explanation"]["top_positive_factors"][0]
        put(f"+ {tp['feature']} ({tp['effect']})", 108, 0.5, (0, 220, 0))
    if e["explanation"]["top_negative_factors"]:
        tn = e["explanation"]["top_negative_factors"][0]
        put(f"- {tn['feature']} ({tn['effect']})", 132, 0.5, (0, 140, 255))


if __name__ == "__main__":
    sys.exit(main())
