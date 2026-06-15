"""
download_statsbomb.py — Download StatsBomb Open Data shot events into data/raw.

Pulls competitions -> matches -> events from the public StatsBomb GitHub mirror,
keeps only shot events (plus minimal context), and writes them as JSON lines.
No external auth needed. Works on Windows PowerShell.

Usage:
    python src/download_statsbomb.py --out data/raw
    python src/download_statsbomb.py --out data/raw --max-matches 200
    python src/download_statsbomb.py --out data/raw --competitions 43,11 --use-360
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"


def _get_json(url: str, retries: int = 3, timeout: int = 30):
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "xg-builder/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def list_competitions():
    return _get_json(f"{BASE}/competitions.json")


def list_matches(competition_id, season_id):
    return _get_json(f"{BASE}/matches/{competition_id}/{season_id}.json")


def get_events(match_id):
    return _get_json(f"{BASE}/events/{match_id}.json")


def get_360(match_id):
    """StatsBomb 360 freeze-frame data (only available for some matches)."""
    try:
        return _get_json(f"{BASE}/three-sixty/{match_id}.json")
    except RuntimeError:
        return None


def main():
    ap = argparse.ArgumentParser(description="Download StatsBomb Open Data shots.")
    ap.add_argument("--out", required=True, help="Output dir for raw shot JSONL.")
    ap.add_argument("--competitions", default="",
                    help="Comma-separated competition_ids to restrict (default: all).")
    ap.add_argument("--max-matches", type=int, default=300,
                    help="Cap number of matches (keeps download reasonable).")
    ap.add_argument("--use-360", action="store_true",
                    help="Also fetch 360 freeze-frame data when available.")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    shots_path = os.path.join(args.out, "shots.jsonl")
    meta_path = os.path.join(args.out, "download_meta.json")

    wanted = set()
    if args.competitions.strip():
        wanted = {int(c) for c in args.competitions.split(",") if c.strip()}

    print("[DL] Fetching competitions index ...")
    try:
        comps = list_competitions()
    except RuntimeError as e:
        print(f"[DL][ERROR] Could not fetch competitions: {e}", file=sys.stderr)
        return 1

    # unique (competition_id, season_id) pairs
    cs_pairs = []
    for c in comps:
        cid, sid = c["competition_id"], c["season_id"]
        if wanted and cid not in wanted:
            continue
        cs_pairs.append((cid, sid, c.get("competition_name", ""), c.get("season_name", "")))

    print(f"[DL] {len(cs_pairs)} competition-seasons selected.")

    n_shots = 0
    n_matches = 0
    n_360 = 0
    seen_match_ids = set()

    with open(shots_path, "w", encoding="utf-8") as fout:
        for cid, sid, cname, sname in cs_pairs:
            if n_matches >= args.max_matches:
                break
            try:
                matches = list_matches(cid, sid)
            except RuntimeError as e:
                print(f"[DL][WARN] skip comp {cid}/{sid}: {e}", file=sys.stderr)
                continue

            for m in matches:
                if n_matches >= args.max_matches:
                    break
                mid = m["match_id"]
                if mid in seen_match_ids:
                    continue
                seen_match_ids.add(mid)

                try:
                    events = get_events(mid)
                except RuntimeError as e:
                    print(f"[DL][WARN] skip match {mid}: {e}", file=sys.stderr)
                    continue

                frame_map = {}
                if args.use_360:
                    ff = get_360(mid)
                    if ff:
                        n_360 += 1
                        for entry in ff:
                            frame_map[entry.get("event_uuid")] = entry.get("freeze_frame")

                for ev in events:
                    if ev.get("type", {}).get("name") != "Shot":
                        continue
                    rec = {
                        "match_id": mid,
                        "competition_id": cid,
                        "season_id": sid,
                        "competition_name": cname,
                        "season_name": sname,
                        "event": ev,
                    }
                    if args.use_360 and ev.get("id") in frame_map:
                        rec["freeze_frame_360"] = frame_map[ev["id"]]
                    fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    n_shots += 1

                n_matches += 1
                if n_matches % 25 == 0:
                    print(f"[DL] processed {n_matches} matches, {n_shots} shots ...")

    meta = {
        "base_url": BASE,
        "competition_seasons": len(cs_pairs),
        "matches_processed": n_matches,
        "shots_written": n_shots,
        "matches_with_360": n_360,
        "use_360": args.use_360,
        "shots_path": shots_path,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[DL] DONE — {n_shots} shots from {n_matches} matches → {shots_path}")
    if n_shots == 0:
        print("[DL][WARN] No shots written. Check network or competition filter.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
