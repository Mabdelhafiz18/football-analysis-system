import redis
import json
import uuid
from collections import deque

JOB_ID = "match_final_001"

INPUT_STREAM = f"evt:foul:{JOB_ID}"       # events from old foul system
OUTPUT_STREAM = f"evt:foul:v2:{JOB_ID}"   # cleaner V2 events

REDIS_HOST = "localhost"
REDIS_PORT = 6379

CONF_THRESHOLD = 0.60
MIN_EVENT_DURATION = 0.25
MERGE_GAP = 0.50

r = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True
)

events = r.xrange(INPUT_STREAM)

print(f"Reading old foul stream: {INPUT_STREAM}")
print(f"Writing V2 foul stream: {OUTPUT_STREAM}")
print(f"Found old events: {len(events)}")

raw_events = []

for msg_id, data in events:
    try:
        if "data" in data:
            event = json.loads(data["data"])
        else:
            event = data

        confidence = float(event.get("confidence", 0))
        start_sec = float(event.get("start_sec", event.get("frame_start", 0)))
        end_sec = float(event.get("end_sec", event.get("frame_end", start_sec)))

        if confidence >= CONF_THRESHOLD:
            raw_events.append({
                "start_sec": start_sec,
                "end_sec": end_sec,
                "peak_sec": (start_sec + end_sec) / 2,
                "confidence": confidence
            })

    except Exception as e:
        print("Skipping bad event:", e)

if not raw_events:
    print("No confident foul events found.")
    exit()

raw_events.sort(key=lambda x: x["start_sec"])

merged_events = []
current = raw_events[0]

for ev in raw_events[1:]:
    gap = ev["start_sec"] - current["end_sec"]

    if gap <= MERGE_GAP:
        current["end_sec"] = max(current["end_sec"], ev["end_sec"])

        if ev["confidence"] > current["confidence"]:
            current["confidence"] = ev["confidence"]
            current["peak_sec"] = ev["peak_sec"]
    else:
        merged_events.append(current)
        current = ev

merged_events.append(current)

final_events = []

for i, ev in enumerate(merged_events, start=1):
    duration = ev["end_sec"] - ev["start_sec"]

    if duration < MIN_EVENT_DURATION:
        continue

    conf = ev["confidence"]

    if conf >= 0.85:
        severity = "serious foul candidate"
    elif conf >= 0.70:
        severity = "medium"
    else:
        severity = "light"

    final_event = {
        "job_id": JOB_ID,
        "event_id": f"foul_v2_{i:03d}",
        "event_type": "foul",
        "start_sec": round(ev["start_sec"], 2),
        "peak_sec": round(ev["peak_sec"], 2),
        "end_sec": round(ev["end_sec"], 2),
        "offender_id": None,
        "victim_id": None,
        "team_id": None,
        "severity": severity,
        "ball_related": None,
        "confidence": round(conf, 3),
        "source": "foul_v2_aggregation"
    }

    final_events.append(final_event)

for event in final_events:
    r.xadd(OUTPUT_STREAM, {"data": json.dumps(event)})
    print("WROTE V2 EVENT:", event)

print(f"Done. Total V2 events: {len(final_events)}")