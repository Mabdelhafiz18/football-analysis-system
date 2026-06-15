"""
predict_from_vision_ndjson.py — Run xG inference on Vision NDJSON.

Reads the same NDJSON the offside model consumes, detects shot candidates from
ball kinematics (conservative), extracts freeze-frame features at the shot
moment, predicts xG with the trained model, attaches Vision diagnostic features
+ explanation, writes outputs/xg_events.json, and optionally publishes to Redis.

Usage:
    python src/predict_from_vision_ndjson.py --ndjson match.ndjson \
        --model models/xg_xgboost.pkl --schema models/xg_feature_schema.json \
        --out outputs/xg_events.json --fps 25 --job-id match_001
"""

from __future__ import annotations
import argparse
import json
import math
import os
import pickle
import sys
from collections import deque, defaultdict

import numpy as np
import pandas as pd

import features as F
import utils_geometry as geo
from explain_xg import explain_prediction

BALL, GK, PLAYER, REF = 0, 1, 2, 3


# ── attacking direction estimation (GK-based, per team, with fallback) ──────
class DirectionEstimator:
    def __init__(self, window_frames=1500):
        self.gk_x = {0: deque(maxlen=window_frames), 1: deque(maxlen=window_frames)}

    def observe(self, players):
        for p in players:
            if p["cls"] == GK and p["team"] in (0, 1):
                self.gk_x[p["team"]].append(p["xy"][0])

    def direction(self, team, pitch_x=geo.PITCH_X_M):
        dq = self.gk_x.get(team)
        if dq and len(dq) >= 20:
            mean_x = sum(dq) / len(dq)
            return "+x" if mean_x < pitch_x / 2 else "-x"
        other = self.gk_x.get(1 - team)
        if other and len(other) >= 20:
            mean_x = sum(other) / len(other)
            return "-x" if mean_x < pitch_x / 2 else "+x"
        return None


def parse_frame(pkt):
    players, ball = [], None
    for o in pkt.get("objects", []):
        cid = o.get("class_id")
        xy = o.get("pitch_xy_m")
        if xy is None:
            continue
        if cid == BALL and o.get("is_on_pitch", True):
            ball = [float(xy[0]), float(xy[1])]
        elif cid in (GK, PLAYER) and o.get("is_on_pitch", True) and o.get("id") is not None:
            players.append({"id": int(o["id"]), "team": o.get("team_id"),
                            "cls": cid, "xy": [float(xy[0]), float(xy[1])]})
    return {
        "frame_id": int(pkt["frame_id"]),
        "ts": float(pkt["timestamp_sec"]),
        "players": players,
        "ball": ball,
        "homography_age": int(pkt.get("homography_age_frames", -1)),
        "ball_gap": int(pkt.get("ball_gap_frames", -1)),
    }


def detect_shots(frames, cfg):
    """Conservative shot detection from ball kinematics.

    A shot candidate fires when:
      • ball speed jumps sharply (>= min_ball_speed)
      • ball moves toward the opponent goal (toward-goal velocity component)
      • an attacker was close to the ball just before release
      • ball separates from that attacker after release
      • shot originates in the attacking half / final third
      • homography fresh and ball_gap small
      • not a duplicate within dedup window
    """
    shots = []
    last_shot_frame = -10_000
    ball_hist = deque(maxlen=6)   # (frame_idx, ts, xy)

    for i, fr in enumerate(frames):
        if fr["ball"] is None:
            continue
        if fr["homography_age"] >= 0 and fr["homography_age"] > cfg["max_homography_age_frames"]:
            ball_hist.clear()
            continue
        if fr["ball_gap"] > cfg["max_ball_gap_frames"] and fr["ball_gap"] >= 0:
            ball_hist.clear()
            continue

        ball_hist.append((i, fr["ts"], fr["ball"]))
        if len(ball_hist) < 3:
            continue

        (i0, t0, xy0) = ball_hist[0]
        (i1, t1, xy1) = ball_hist[-1]
        dt = max(t1 - t0, 1e-3)
        speed = geo.euclidean(xy1, xy0) / dt
        if speed < cfg["min_ball_speed"]:
            continue

        # find nearest attacker just before release (use frame i0)
        pre = frames[i0]
        if not pre["players"]:
            continue

        # decide attacking team = team of nearest player to ball before release
        nearest = min(pre["players"], key=lambda p: geo.euclidean(p["xy"], xy0))
        d_before = geo.euclidean(nearest["xy"], xy0)
        if d_before > cfg["release_distance_before"]:
            continue
        atk_team = nearest["team"]
        if atk_team not in (0, 1):
            continue

        adir = cfg["dir_fn"](atk_team)
        if adir is None:
            adir = geo.infer_attacking_direction_from_shot(xy0[0])

        # ball must move toward goal
        gx, _ = geo.goal_center(adir)
        toward = (xy1[0] - xy0[0]) * (1 if adir == "+x" else -1) / dt
        if toward < cfg["min_toward_goal_velocity"]:
            continue

        # shot must originate in attacking half / final third
        depth = xy0[0] if adir == "+x" else (geo.PITCH_X_M - xy0[0])
        if depth < cfg["min_shot_depth_m"]:
            continue

        # ball separates from shooter after release
        d_after = geo.euclidean(nearest["xy"], xy1)
        if d_after < cfg["release_distance_after"]:
            continue

        # dedup
        if i0 - last_shot_frame < cfg["dedup_window_frames"]:
            continue
        last_shot_frame = i0

        shots.append({
            "shot_frame_idx": i0, "frame_id": pre["frame_id"], "ts": pre["ts"],
            "shooter_id": nearest["id"], "team_id": atk_team,
            "shot_xy": list(xy0), "attacking_direction": adir,
            "ball_speed_before_shot": speed,
            "homography_age": pre["homography_age"], "ball_gap": pre["ball_gap"],
        })
    return shots


def build_features_for_shot(shot, frames):
    pre = frames[shot["shot_frame_idx"]]
    adir = shot["attacking_direction"]
    atk = shot["team_id"]
    shot_xy = shot["shot_xy"]

    defenders = [p["xy"] for p in pre["players"] if p["team"] == (1 - atk) and p["cls"] == PLAYER]
    attackers = [p["xy"] for p in pre["players"] if p["team"] == atk and p["cls"] == PLAYER]
    gks = [p["xy"] for p in pre["players"] if p["team"] == (1 - atk) and p["cls"] == GK]
    gk_xy = gks[0] if gks else None

    trained = F.trained_features_from_vision(shot_xy, adir)   # body/type unknown from Vision
    diag = F.vision_diagnostic_features(
        shot_xy, adir, goalkeeper_xy=gk_xy, defenders=defenders, attackers=attackers,
        ball_speed_before_shot=shot["ball_speed_before_shot"])
    return trained, diag


def encode_row(trained, model_bundle):
    """Encode a trained-feature dict into the model's fixed column order."""
    cols = model_bundle["feature_columns"]
    numeric = model_bundle["numeric"]
    flags = model_bundle["flags"]
    categorical = model_bundle["categorical"]

    row = {c: 0.0 for c in cols}
    for n in numeric + flags:
        if n in row:
            row[n] = float(trained.get(n, 0) or 0)
    for cat in categorical:
        val = str(trained.get(cat, "unknown"))
        key = f"{cat}_{val}"
        if key in row:
            row[key] = 1.0
        # if unseen category (e.g. 'unknown'): all dummies 0 → model uses priors
    return pd.DataFrame([[row[c] for c in cols]], columns=cols)


def quality_label(xg, thresholds):
    if xg >= 0.35:
        return "Big Chance"
    if xg >= thresholds.get("high", 0.35):
        return "High Quality Chance"
    if xg >= thresholds.get("medium", 0.15):
        return "Medium Quality Chance"
    if xg >= thresholds.get("low", 0.05):
        return "Low Quality Chance"
    return "Very Low Quality Chance"


def main():
    ap = argparse.ArgumentParser(description="xG inference on Vision NDJSON.")
    ap.add_argument("--ndjson", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--schema", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=float, default=25.0)
    ap.add_argument("--job-id", default="match_001")
    ap.add_argument("--redis", default=None)
    ap.add_argument("--publish-redis", action="store_true")
    # shot detection thresholds (configurable)
    ap.add_argument("--min-ball-speed", type=float, default=8.0)
    ap.add_argument("--release-distance-before", type=float, default=2.5)
    ap.add_argument("--release-distance-after", type=float, default=2.5)
    ap.add_argument("--min-toward-goal-velocity", type=float, default=3.0)
    ap.add_argument("--min-shot-depth-m", type=float, default=85.0)
    ap.add_argument("--dedup-window-frames", type=int, default=50)
    ap.add_argument("--max-homography-age-frames", type=int, default=60)
    ap.add_argument("--max-ball-gap-frames", type=int, default=25)
    args = ap.parse_args()

    for path in (args.ndjson, args.model, args.schema):
        if not os.path.exists(path):
            print(f"[XG][ERROR] Not found: {path}", file=sys.stderr)
            return 1

    with open(args.model, "rb") as f:
        bundle = pickle.load(f)
    with open(args.schema, encoding="utf-8") as f:
        schema = json.load(f)
    thresholds = schema.get("quality_thresholds", {"low": 0.05, "medium": 0.15, "high": 0.35})

    # parse frames + estimate direction
    frames = []
    dir_est = DirectionEstimator()
    with open(args.ndjson, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                fr = parse_frame(json.loads(line))
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
            dir_est.observe(fr["players"])
            frames.append(fr)

    if not frames:
        print("[XG][ERROR] No frames parsed.", file=sys.stderr)
        return 1

    cfg = {
        "min_ball_speed": args.min_ball_speed,
        "release_distance_before": args.release_distance_before,
        "release_distance_after": args.release_distance_after,
        "min_toward_goal_velocity": args.min_toward_goal_velocity,
        "min_shot_depth_m": args.min_shot_depth_m,
        "dedup_window_frames": args.dedup_window_frames,
        "max_homography_age_frames": args.max_homography_age_frames,
        "max_ball_gap_frames": args.max_ball_gap_frames,
        "dir_fn": dir_est.direction,
    }

    shots = detect_shots(frames, cfg)
    events = []
    for sid, shot in enumerate(shots, start=1):
        trained, diag = build_features_for_shot(shot, frames)
        X = encode_row(trained, bundle)
        xg = float(bundle["model"].predict_proba(X)[:, 1][0])
        explanation = explain_prediction(bundle, X, trained, diag, xg)

        events.append({
            "event_type": "xg_shot",
            "schema_version": "xg.v1",
            "shot_id": sid,
            "job_id": args.job_id,
            "frame_id": shot["frame_id"],
            "timestamp_sec": round(shot["ts"], 2),
            "shooter_id": shot["shooter_id"],
            "team_id": shot["team_id"],
            "attacking_direction": shot["attacking_direction"],
            "xg": round(xg, 4),
            "quality": quality_label(xg, thresholds),
            "trained_features": {k: (round(v, 3) if isinstance(v, float) else v)
                                 for k, v in trained.items()},
            "vision_diagnostic_features": diag,
            "explanation": explanation,
            "debug": {
                "homography_age_frames": shot["homography_age"],
                "ball_gap_frames": shot["ball_gap"],
                "shot_detection_reason": "ball_speed_and_release",
                "model_version": "xg_xgboost_v1",
            },
        })

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)

    # also export a flat features CSV next to the events file
    csv_path = os.path.join(os.path.dirname(args.out) or ".", "xg_features.csv")
    try:
        import csv as _csv
        if events:
            rows = []
            for e in events:
                r = {"shot_id": e["shot_id"], "timestamp_sec": e["timestamp_sec"],
                     "team_id": e["team_id"], "xg": e["xg"], "quality": e["quality"]}
                r.update(e["trained_features"])
                r.update(e["vision_diagnostic_features"])
                rows.append(r)
            with open(csv_path, "w", newline="", encoding="utf-8") as cf:
                w = _csv.DictWriter(cf, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        else:
            open(csv_path, "w").close()
    except Exception as e:
        print(f"[XG][WARN] features CSV export failed: {e}", file=sys.stderr)

    total_xg = sum(e["xg"] for e in events)
    print(f"[XG] DONE — {len(events)} shots, total xG={total_xg:.2f} → {args.out}")
    for e in events:
        print(f"  shot#{e['shot_id']} t={e['timestamp_sec']}s team{e['team_id']} "
              f"xG={e['xg']} ({e['quality']})")

    if args.publish_redis and args.redis:
        try:
            from xg_redis_publisher import publish_events
            n = publish_events(args.redis, args.job_id, events)
            print(f"[XG] published {n} events to events:{args.job_id}:xg")
        except Exception as e:
            print(f"[XG][WARN] Redis publish failed: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
