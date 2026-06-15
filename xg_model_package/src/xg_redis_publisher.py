"""
xg_redis_publisher.py — Publish xG events to Redis stream events:{job_id}:xg.

Each event is JSON-serialized into a 'data' field, matching the offside model's
Redis convention. Safe to import even if redis is not installed.

Usage (standalone):
    python src/xg_redis_publisher.py --events outputs/xg_events.json \
        --redis redis://localhost:6379 --job-id match_001
"""

from __future__ import annotations
import argparse
import json
import sys


def publish_events(redis_url: str, job_id: str, events: list) -> int:
    """Publish events to events:{job_id}:xg. Returns number published."""
    try:
        import redis
    except ImportError:
        raise RuntimeError("redis package not installed (pip install redis)")

    client = redis.from_url(redis_url)
    client.ping()   # raises if unreachable
    stream = f"events:{job_id}:xg"
    n = 0
    for ev in events:
        client.xadd(stream, {"data": json.dumps(ev, ensure_ascii=False)})
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser(description="Publish xG events JSON to Redis.")
    ap.add_argument("--events", required=True)
    ap.add_argument("--redis", required=True)
    ap.add_argument("--job-id", default="match_001")
    args = ap.parse_args()

    import os
    if not os.path.exists(args.events):
        print(f"[REDIS][ERROR] Events file not found: {args.events}", file=sys.stderr)
        return 1
    with open(args.events, encoding="utf-8") as f:
        events = json.load(f)

    try:
        n = publish_events(args.redis, args.job_id, events)
    except Exception as e:
        print(f"[REDIS][ERROR] {e}", file=sys.stderr)
        return 1
    print(f"[REDIS] published {n} events → events:{args.job_id}:xg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
