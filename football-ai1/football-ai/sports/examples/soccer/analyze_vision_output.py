import json
import math
from collections import Counter, defaultdict

INPUT = "rt_output_gpu_croatia_full.ndjson"
REPORT = "vision_core_full_match_report.txt"

frames = 0
objects_total = 0
empty_frames = 0

class_counts = Counter()
team_counts = Counter()
conf_values = []
low_conf = 0

ball_frames = []
ball_on_pitch = 0
ball_off_pitch = 0
ball_confs = []

out_of_bounds = 0
on_pitch_false = 0

track_frames = defaultdict(int)
track_classes = {}
track_team_counts = defaultdict(Counter)

schema_keys = Counter()
bad_schema_examples = []

first_frame = None
last_frame = None
first_ts = None
last_ts = None

speed_mps_count = 0
speed_valid_count = 0
ball_state_count = 0
attacking_direction_count = 0

with open(INPUT, "r", encoding="utf-8") as f:
    for line_no, line in enumerate(f, start=1):
        if not line.strip():
            continue

        try:
            pkt = json.loads(line)
        except Exception as e:
            print(f"Bad JSON at line {line_no}: {e}")
            continue

        frames += 1

        frame_id = pkt.get("frame_id")
        ts = pkt.get("timestamp_sec")

        if first_frame is None:
            first_frame = frame_id
            first_ts = ts

        last_frame = frame_id
        last_ts = ts

        if "ball_state" in pkt:
            ball_state_count += 1

        if "attacking_direction" in pkt or "team_directions" in pkt:
            attacking_direction_count += 1

        objects = pkt.get("objects", [])
        objects_total += len(objects)

        if len(objects) == 0:
            empty_frames += 1

        frame_has_ball = False

        for obj in objects:
            for k in obj.keys():
                schema_keys[k] += 1

            if "speed_mps" in obj:
                speed_mps_count += 1
            if "speed_valid" in obj:
                speed_valid_count += 1

            cid = obj.get("class_id")
            class_counts[cid] += 1

            team_id = obj.get("team_id")
            team_counts[str(team_id)] += 1

            conf = obj.get("confidence")
            if conf is not None:
                conf_values.append(conf)
                if conf < 0.65:
                    low_conf += 1

            xy = obj.get("pitch_xy_m") or obj.get("pitch_xy")
            is_on_pitch = obj.get("is_on_pitch")

            if is_on_pitch is False:
                on_pitch_false += 1

            if xy is not None:
                x, y = xy
                if x < 0 or x > 105 or y < 0 or y > 68:
                    out_of_bounds += 1

            tid = obj.get("id") or obj.get("track_id")
            if tid is not None and cid in [1, 2]:
                track_frames[tid] += 1
                track_classes[tid] = cid
                if team_id is not None:
                    track_team_counts[tid][team_id] += 1

            if cid == 0:
                frame_has_ball = True
                if conf is not None:
                    ball_confs.append(conf)
                if is_on_pitch is True:
                    ball_on_pitch += 1
                elif is_on_pitch is False:
                    ball_off_pitch += 1

        if frame_has_ball:
            ball_frames.append(frame_id)

# ball gaps
ball_gaps = []
for a, b in zip(ball_frames, ball_frames[1:]):
    if a is not None and b is not None:
        ball_gaps.append(b - a)

# team switching IDs
switching_ids = []
for tid, counts in track_team_counts.items():
    if len(counts) > 1:
        switching_ids.append((tid, dict(counts)))

ids_ge_10 = sum(1 for v in track_frames.values() if v >= 10)
ids_ge_50 = sum(1 for v in track_frames.values() if v >= 50)
ids_ge_100 = sum(1 for v in track_frames.values() if v >= 100)

duration = None
fps_est = None
if first_ts is not None and last_ts is not None:
    duration = last_ts - first_ts
    if duration > 0:
        fps_est = (frames - 1) / duration

def avg(vals):
    return sum(vals) / len(vals) if vals else 0

def pct(part, total):
    return (part / total * 100) if total else 0

with open(REPORT, "w", encoding="utf-8") as out:
    out.write("VISION CORE FULL MATCH REPORT\n")
    out.write("=" * 40 + "\n\n")

    out.write(f"frames: {frames}\n")
    out.write(f"frame range: {first_frame} -> {last_frame}\n")
    out.write(f"timestamp range: {first_ts} -> {last_ts}\n")
    out.write(f"duration_sec: {duration}\n")
    out.write(f"fps_est: {fps_est}\n")
    out.write(f"objects_total: {objects_total}\n")
    out.write(f"objects_per_frame_avg: {avg([objects_total / frames]) if frames else 0:.2f}\n")
    out.write(f"empty_frames: {empty_frames}\n\n")

    out.write("SCHEMA CHECK\n")
    out.write("-" * 20 + "\n")
    out.write(f"speed_mps_count: {speed_mps_count}\n")
    out.write(f"speed_valid_count: {speed_valid_count}\n")
    out.write(f"ball_state_count: {ball_state_count}\n")
    out.write(f"attacking_direction_count: {attacking_direction_count}\n")
    out.write(f"object_keys: {sorted(schema_keys.keys())}\n\n")

    out.write("CLASS COUNTS\n")
    out.write("-" * 20 + "\n")
    out.write(str(dict(class_counts)) + "\n\n")

    out.write("TEAM COUNTS\n")
    out.write("-" * 20 + "\n")
    out.write(str(dict(team_counts)) + "\n\n")

    out.write("CONFIDENCE\n")
    out.write("-" * 20 + "\n")
    out.write(f"mean_confidence: {avg(conf_values):.3f}\n")
    out.write(f"low_conf_below_0.65: {low_conf} ({pct(low_conf, len(conf_values)):.2f}%)\n\n")

    out.write("BALL\n")
    out.write("-" * 20 + "\n")
    out.write(f"ball_frames: {len(ball_frames)} / {frames} ({pct(len(ball_frames), frames):.2f}%)\n")
    out.write(f"ball_on_pitch: {ball_on_pitch}\n")
    out.write(f"ball_off_pitch: {ball_off_pitch}\n")
    out.write(f"ball_mean_conf: {avg(ball_confs):.3f}\n")
    out.write(f"ball_avg_gap_frames: {avg(ball_gaps):.2f}\n")
    out.write(f"ball_max_gap_frames: {max(ball_gaps) if ball_gaps else None}\n\n")

    out.write("PITCH\n")
    out.write("-" * 20 + "\n")
    out.write(f"out_of_bounds_by_range: {out_of_bounds} ({pct(out_of_bounds, objects_total):.2f}%)\n")
    out.write(f"is_on_pitch_false: {on_pitch_false} ({pct(on_pitch_false, objects_total):.2f}%)\n\n")

    out.write("TRACKER\n")
    out.write("-" * 20 + "\n")
    out.write(f"unique_player_gk_track_ids: {len(track_frames)}\n")
    out.write(f"ids_ge_10_frames: {ids_ge_10}\n")
    out.write(f"ids_ge_50_frames: {ids_ge_50}\n")
    out.write(f"ids_ge_100_frames: {ids_ge_100}\n")
    out.write(f"team_switching_ids_count: {len(switching_ids)}\n")
    out.write(f"team_switching_ids_sample: {switching_ids[:20]}\n")

print(f"Done. Report saved to: {REPORT}")